import { useState, useEffect } from "react";
import { Clock, Play, Square, Calendar, Download, Filter, Users, MapPin, Coffee, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import apiClient from "@/lib/api-client";
import { toast } from "sonner";
import AdminHoursReport from "@/components/scheduler/AdminHoursReport";
import AdminTasksOverview from "@/components/scheduler/AdminTasksOverview";

export default function SchedulerTimeClock() {
  const [selectedPeriod, setSelectedPeriod] = useState<string>("today");
  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [selectedLocation, setSelectedLocation] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [timeEntries, setTimeEntries] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [clockingIn, setClockingIn] = useState<string | null>(null);

  useEffect(() => {
    loadCompanies();
  }, []);

  useEffect(() => {
    if (selectedCompany) {
      loadLocations();
      loadTimeClockData();
    }
  }, [selectedCompany, selectedLocation, selectedPeriod]);

  const loadCompanies = async () => {
    try {
      const data = await apiClient.get<any[]>('/scheduler/companies/');
      
      setCompanies(data || []);
      
      if (data && data.length > 0 && !selectedCompany) {
        setSelectedCompany(data[0].id);
      }
    } catch (error) {
      console.error('Error loading companies:', error);
    }
  };

  const loadLocations = async () => {
    if (!selectedCompany) return;
    
    try {
      const data = await apiClient.get<any[]>('/scheduler/departments/', { company: selectedCompany });
      
      setLocations(data || []);
      setSelectedLocation("all");
    } catch (error) {
      console.error('Error loading locations:', error);
    }
  };

  const loadTimeClockData = async () => {
    if (!selectedCompany) return;
    
    setLoading(true);
    try {
      // Get employees first, then get their time clock entries
      const employeesParams: any = { company: selectedCompany, status: 'active' };
      if (selectedLocation && selectedLocation !== "all") {
        employeesParams.department = selectedLocation;
      }

      const employeesData = await apiClient.get<any[]>('/scheduler/employees/', employeesParams);
      
      // Get time clock entries for all employees
      const allTimeEntries: any[] = [];
      for (const emp of employeesData) {
        const entries = await apiClient.get<any[]>('/scheduler/time-clock/', { employee: emp.id });
        allTimeEntries.push(...entries.map(e => ({ ...e, employees: emp })));
      }
      
      const timeData = allTimeEntries.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setTimeEntries(timeData || []);
      setEmployees(employeesData || []);
    } catch (error) {
      console.error('Error loading time clock data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get current location
  const getCurrentLocation = (): Promise<{ lat: number; lng: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => reject(error),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  };

  // Clock in employee
  const handleClockIn = async (employeeId: string) => {
    setClockingIn(employeeId);
    
    try {
      let location = null;
      try {
        location = await getCurrentLocation();
        toast.success('Location captured');
      } catch (locError) {
        console.warn('Could not get location:', locError);
        toast.warning('Clocking in without location');
      }
      
      await apiClient.post('/scheduler/time-clock/clock_in/', {
        employee_id: employeeId
      });
      
      toast.success('Clocked in successfully');
      loadTimeClockData();
    } catch (error) {
      console.error('Error clocking in:', error);
      toast.error('Failed to clock in');
    } finally {
      setClockingIn(null);
    }
  };

  // Clock out employee
  const handleClockOut = async (entryId: string, clockInTime: string) => {
    try {
      let location = null;
      try {
        location = await getCurrentLocation();
        toast.success('Location captured');
      } catch (locError) {
        console.warn('Could not get location:', locError);
      }
      
      const clockOutTime = new Date();
      const clockIn = new Date(clockInTime);
      
      // Calculate total hours
      const totalMinutes = (clockOutTime.getTime() - clockIn.getTime()) / (1000 * 60);
      const totalHours = Math.round((totalMinutes / 60) * 100) / 100;
      const overtimeHours = totalHours > 8 ? Math.round((totalHours - 8) * 100) / 100 : 0;
      
      await apiClient.patch(`/scheduler/time-clock/${currentClockEntry.id}/`, {
        clock_out: clockOutTime.toISOString(),
        total_hours: totalHours,
        overtime_hours: overtimeHours,
      })
        .eq('id', entryId);
      
      if (error) throw error;
      
      toast.success(`Clocked out. Total: ${totalHours.toFixed(2)} hours`);
      loadTimeClockData();
    } catch (error) {
      console.error('Error clocking out:', error);
      toast.error('Failed to clock out');
    }
  };

  const activeEmployees = timeEntries.filter(entry => entry.clock_out === null);
  const totalHours = timeEntries.reduce((sum, entry) => sum + (entry.total_hours || 0), 0);
  const avgHours = timeEntries.length > 0 ? totalHours / timeEntries.length : 0;
  const overtimeHours = timeEntries.reduce((sum, entry) => sum + (entry.overtime_hours || 0), 0);

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  // Check if employee is already clocked in
  const isEmployeeClockedIn = (employeeId: string) => {
    return activeEmployees.some(e => e.employee_id === employeeId);
  };

  const getActiveEntry = (employeeId: string) => {
    return activeEmployees.find(e => e.employee_id === employeeId);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Time Clock</h1>
          <p className="text-muted-foreground">
            Track employee time and manage attendance
          </p>
        </div>
      </div>

      {/* Company and Location Filters */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <label className="text-sm font-medium">Select Company</label>
          <Select value={selectedCompany} onValueChange={setSelectedCompany}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a company..." />
            </SelectTrigger>
            <SelectContent>
              {companies.map((company) => (
                <SelectItem key={company.id} value={company.id}>
                  {company.name} ({company.type})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Select Location</label>
          <Select 
            value={selectedLocation} 
            onValueChange={setSelectedLocation}
            disabled={!selectedCompany || locations.length === 0}
          >
            <SelectTrigger>
              <SelectValue placeholder={locations.length === 0 ? "No locations available" : "All locations"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              {locations.map((location) => (
                <SelectItem key={location.id} value={location.id}>
                  {location.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Time Period</label>
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {!selectedCompany ? (
        <div className="text-center py-12">
          <Clock className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">Select a Company</h3>
          <p className="text-muted-foreground mb-4">
            Choose a company above to view time clock data and manage employee attendance.
          </p>
        </div>
      ) : (
        <Tabs defaultValue="clock" className="space-y-4">
          <TabsList>
            <TabsTrigger value="clock" className="gap-2">
              <Clock className="h-4 w-4" />
              Time Clock
            </TabsTrigger>
            <TabsTrigger value="hours" className="gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Hours Report
            </TabsTrigger>
            <TabsTrigger value="tasks" className="gap-2">
              <Calendar className="h-4 w-4" />
              Tasks Overview
            </TabsTrigger>
          </TabsList>

          <TabsContent value="clock" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Currently Clocked In</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {loading ? <Skeleton className="h-8 w-12" /> : activeEmployees.length}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total Hours Today</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {loading ? <Skeleton className="h-8 w-16" /> : totalHours.toFixed(1)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Average Hours</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {loading ? <Skeleton className="h-8 w-16" /> : avgHours.toFixed(1)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Overtime Hours</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-amber-600">
                    {loading ? <Skeleton className="h-8 w-12" /> : overtimeHours.toFixed(1)}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {/* Currently Active */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Currently Active
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="space-y-3">
                      {Array(2).fill(0).map((_, i) => (
                        <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <Skeleton className="h-10 w-10 rounded-full" />
                            <div>
                              <Skeleton className="h-4 w-24 mb-1" />
                              <Skeleton className="h-3 w-20" />
                            </div>
                          </div>
                          <Skeleton className="h-8 w-20" />
                        </div>
                      ))}
                    </div>
                  ) : activeEmployees.length > 0 ? (
                    <div className="space-y-3">
                      {activeEmployees.map((entry) => (
                        <div key={entry.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarFallback>
                                {`${entry.employees?.first_name?.[0] || ''}${entry.employees?.last_name?.[0] || ''}`}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">
                                {`${entry.employees?.first_name || ''} ${entry.employees?.last_name || ''}`}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                Clocked in at {entry.clock_in ? new Date(entry.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="default">
                              <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                              Active
                            </Badge>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleClockOut(entry.id, entry.clock_in)}
                              className="gap-1"
                            >
                              <Square className="h-4 w-4" />
                              Clock Out
                              <MapPin className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No employees currently clocked in</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Quick Clock In */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Play className="h-5 w-5" />
                    Quick Clock In
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="space-y-3">
                      {Array(3).fill(0).map((_, i) => (
                        <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <Skeleton className="h-10 w-10 rounded-full" />
                            <Skeleton className="h-4 w-24" />
                          </div>
                          <Skeleton className="h-8 w-20" />
                        </div>
                      ))}
                    </div>
                  ) : employees.length > 0 ? (
                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                      {employees.map((employee) => {
                        const isClockedIn = isEmployeeClockedIn(employee.id);
                        const activeEntry = getActiveEntry(employee.id);
                        
                        return (
                          <div key={employee.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-3">
                              <Avatar>
                                <AvatarFallback>
                                  {`${employee.first_name?.[0] || ''}${employee.last_name?.[0] || ''}`}
                                </AvatarFallback>
                              </Avatar>
                              <div className="font-medium">
                                {`${employee.first_name || ''} ${employee.last_name || ''}`}
                              </div>
                            </div>
                            {isClockedIn ? (
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => activeEntry && handleClockOut(activeEntry.id, activeEntry.clock_in)}
                                className="gap-1"
                              >
                                <Square className="h-4 w-4" />
                                Clock Out
                              </Button>
                            ) : (
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleClockIn(employee.id)}
                                disabled={clockingIn === employee.id}
                                className="gap-1"
                              >
                                <Play className="h-4 w-4" />
                                {clockingIn === employee.id ? 'Clocking...' : 'Clock In'}
                                <MapPin className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No active employees available</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Time Entries Table */}
            <Card>
              <CardHeader>
                <CardTitle>Time Entries</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-2">
                    {Array(3).fill(0).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Clock In</TableHead>
                        <TableHead>Clock Out</TableHead>
                        <TableHead>Break</TableHead>
                        <TableHead>Total Hours</TableHead>
                        <TableHead>Overtime</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {timeEntries.length > 0 ? timeEntries.map((entry) => {
                        let breakMin = 0;
                        if (entry.break_start && entry.break_end) {
                          breakMin = Math.floor((new Date(entry.break_end).getTime() - new Date(entry.break_start).getTime()) / (1000 * 60));
                        }
                        
                        return (
                          <TableRow key={entry.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback>
                                    {`${entry.employees?.first_name?.[0] || ''}${entry.employees?.last_name?.[0] || ''}`}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="font-medium">
                                  {`${entry.employees?.first_name || ''} ${entry.employees?.last_name || ''}`}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>{entry.clock_in ? new Date(entry.clock_in).toLocaleDateString() : '-'}</TableCell>
                            <TableCell>
                              {entry.clock_in ? new Date(entry.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                            </TableCell>
                            <TableCell>
                              {entry.clock_out ? new Date(entry.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                            </TableCell>
                            <TableCell>{breakMin > 0 ? `${breakMin}m` : '-'}</TableCell>
                            <TableCell className="font-medium">
                              {entry.total_hours ? `${entry.total_hours.toFixed(1)}h` : "-"}
                            </TableCell>
                            <TableCell>
                              {entry.overtime_hours && entry.overtime_hours > 0 ? (
                                <span className="text-amber-600 font-medium">{entry.overtime_hours.toFixed(1)}h</span>
                              ) : '-'}
                            </TableCell>
                            <TableCell>
                              <Badge variant={entry.clock_out ? 'secondary' : 'default'}>
                                {entry.clock_out ? 'Completed' : 'Active'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      }) : (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8">
                            <Clock className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                            <p className="text-muted-foreground">No time entries found</p>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="hours">
            <AdminHoursReport companyId={selectedCompany} />
          </TabsContent>

          <TabsContent value="tasks">
            <AdminTasksOverview companyId={selectedCompany} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
