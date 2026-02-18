import { useState, useEffect } from "react";
import { Calendar, Users, Clock, TrendingUp, AlertTriangle, Plus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import apiClient from "@/lib/api-client";
import { useNavigate } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function SchedulerDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [selectedLocation, setSelectedLocation] = useState<string>("all");
  const [companies, setCompanies] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalEmployees: 0,
    activeShifts: 0,
    totalHours: 0,
    pendingRequests: 0
  });
  const [todayShifts, setTodayShifts] = useState<any[]>([]);

  useEffect(() => {
    loadCompanies();
  }, []);

  useEffect(() => {
    if (selectedCompany) {
      loadLocations();
      loadDashboardData();
    }
  }, [selectedCompany, selectedLocation]);

  const loadCompanies = async () => {
    try {
      const data = await apiClient.get<any[]>('/scheduler/companies/');
      
      setCompanies(data || []);
      
      // Auto-select first company if available
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
      
      // Reset location selection when company changes
      setSelectedLocation("all");
    } catch (error) {
      console.error('Error loading locations:', error);
    }
  };

  const loadDashboardData = async () => {
    if (!selectedCompany) return;
    
    setLoading(true);
    try {
      // Get total employees count for selected company
      const params: any = { company: selectedCompany };
      if (selectedLocation && selectedLocation !== "all") {
        params.department = selectedLocation;
      }

      const employees = await apiClient.get<any[]>('/scheduler/employees/', params);
      const employeeCount = employees.length;

      // Get today's shifts for selected company
      const today = new Date().toISOString().split('T')[0];
      const shiftsParams: any = {
        company: selectedCompany,
        start_date: `${today}T00:00:00.000Z`,
        end_date: `${today}T23:59:59.999Z`
      };

      const shifts = await apiClient.get<any[]>('/scheduler/shifts/', shiftsParams);

      // Calculate active shifts and total hours
      const now = new Date();
      const activeShifts = shifts?.filter(shift => {
        const startTime = new Date(shift.start_time);
        const endTime = new Date(shift.end_time);
        return startTime <= now && endTime >= now;
      }) || [];

      const totalHours = shifts?.reduce((sum, shift) => {
        const start = new Date(shift.start_time);
        const end = new Date(shift.end_time);
        const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        return sum + hours;
      }, 0) || 0;

      setStats({
        totalEmployees: employeeCount || 0,
        activeShifts: activeShifts.length,
        totalHours: Math.round(totalHours),
        pendingRequests: 0 // Placeholder for future implementation
      });

      // Format today's shifts for display
      const formattedShifts = shifts?.slice(0, 5).map(shift => ({
        id: shift.id,
        employee: `${shift.employee_first_name || ''} ${shift.employee_last_name || ''}`.trim() || 'Unknown',
        department: shift.department_name || 'Unassigned',
        time: `${new Date(shift.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(shift.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        status: activeShifts.find(active => active.id === shift.id) ? 'in_progress' : 'scheduled'
      })) || [];

      setTodayShifts(formattedShifts);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome to Roster Joy - your employee scheduling hub
          </p>
        </div>
        <Button onClick={() => navigate('/scheduler/schedule')}>
          <Plus className="h-4 w-4 mr-2" />
          Create Schedule
        </Button>
      </div>

      {/* Company and Location Filters */}
      <div className="grid gap-4 md:grid-cols-2">
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
      </div>

      {!selectedCompany ? (
        <div className="text-center py-12">
          <Calendar className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">Select a Company</h3>
          <p className="text-muted-foreground mb-4">
            Choose a company above to view dashboard data and manage schedules.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : stats.totalEmployees}</div>
                <p className="text-xs text-muted-foreground">
                  Total registered employees
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Shifts</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : stats.activeShifts}</div>
                <p className="text-xs text-muted-foreground">
                  Currently in progress
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Hours This Week</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : stats.totalHours}</div>
                <p className="text-xs text-muted-foreground">
                  Scheduled for today
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.pendingRequests}</div>
                <p className="text-xs text-muted-foreground">
                  Need approval
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>
                  Today's Shifts
                  {selectedLocation && selectedLocation !== "all" && (
                    <span className="text-sm font-normal text-muted-foreground ml-2">
                      - {locations.find(l => l.id === selectedLocation)?.name}
                    </span>
                  )}
                </CardTitle>
                <CardDescription>
                  Overview of scheduled shifts for today
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {loading ? (
                  Array(2).fill(0).map((_, i) => (
                    <div key={i} className="flex items-center space-x-4">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-24 mb-1" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                      <div className="text-right">
                        <Skeleton className="h-4 w-20 mb-1" />
                        <Skeleton className="h-5 w-16" />
                      </div>
                    </div>
                  ))
                ) : todayShifts.length > 0 ? (
                  todayShifts.map((shift) => (
                    <div key={shift.id} className="flex items-center space-x-4">
                      <Avatar>
                        <AvatarFallback>{shift.employee.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{shift.employee}</p>
                        <p className="text-xs text-muted-foreground">{shift.department}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm">{shift.time}</p>
                        <Badge variant={shift.status === 'in_progress' ? 'default' : 'secondary'}>
                          {shift.status === 'in_progress' ? 'Active' : 'Scheduled'}
                        </Badge>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No shifts scheduled for today</p>
                    <Button 
                      variant="outline" 
                      className="mt-2" 
                      onClick={() => navigate('/scheduler/schedule')}
                    >
                      Create Schedule
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>
                  Frequently used actions for schedule management
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/scheduler/schedule')}>
                  <Calendar className="h-4 w-4 mr-2" />
                  View Full Schedule
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/scheduler/employees')}>
                  <Users className="h-4 w-4 mr-2" />
                  Manage Employees
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/scheduler/time-clock')}>
                  <Clock className="h-4 w-4 mr-2" />
                  Time Clock Reports
                </Button>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}