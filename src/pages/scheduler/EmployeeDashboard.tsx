import { useState, useEffect } from "react";
import { Clock, Calendar, CheckCircle, MapPin, Play, Square, Coffee, FileText, TrendingUp, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useEmployeeTimeClock } from "@/hooks/useEmployeeTimeClock";
import { usePersistentTimeClock } from "@/hooks/usePersistentTimeClock";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import apiClient from "@/lib/api-client";
import { ensureArray } from "@/lib/utils";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isToday, parseISO } from "date-fns";
import EmployeeShifts from "@/components/scheduler/EmployeeShifts";
import EmployeeTasks from "@/components/scheduler/EmployeeTasks";
import EmployeeHours from "@/components/scheduler/EmployeeHours";
import { toast } from "sonner";

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { 
    employee, 
    entries, 
    loading, 
    calculatePeriodHours,
    refetch: refetchEntries
  } = useEmployeeTimeClock();
  
  // Use persistent time clock for clock in/out, breaks and timer - this persists across sessions
  const { 
    activeEntry, 
    elapsedTimeFormatted,
    breakTimeFormatted,
    clockIn, 
    clockOut,
    startBreak,
    endBreak,
    isOnBreak,
    refetch: refetchPersistent 
  } = usePersistentTimeClock();
  
  const [currentTime, setCurrentTime] = useState(new Date());
  const [shifts, setShifts] = useState<any[]>([]);
  const [todayShift, setTodayShift] = useState<any>(null);

  // Check if currently on break - use the function from hook
  const onBreak = isOnBreak();

  // Update clock every second (for current time display)
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);

  // Fetch employee's shifts including approved replacement shifts
  useEffect(() => {
    if (!employee) return;

    const fetchShifts = async () => {
      try {
        const today = new Date();
        const weekStart = startOfWeek(today, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

        const rawShifts = await apiClient.get<any>('/scheduler/shifts/', {
          employee: employee.id,
          start_time__gte: weekStart.toISOString(),
          start_time__lte: weekEnd.toISOString()
        });
        const shiftsList = ensureArray(rawShifts);
        setShifts(shiftsList.sort((a: any, b: any) =>
          new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
        ));

        const todaysShift = shiftsList.find((shift: any) => {
          const shiftDate = parseISO(shift.start_time);
          return isToday(shiftDate);
        });
        setTodayShift(todaysShift ?? null);
      } catch (err) {
        console.error('Error fetching shifts:', err);
        setShifts([]);
        setTodayShift(null);
      }
    };

    fetchShifts();
  }, [employee]);


  // Calculate hours for different periods (guard: entries may be non-array from hook initially)
  const entriesList = Array.isArray(entries) ? entries : [];
  const todayEntries = entriesList.filter(e => {
    if (!e.clock_in) return false;
    return isToday(parseISO(e.clock_in));
  });
  
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEntries = entriesList.filter(e => {
    if (!e.clock_in) return false;
    const clockIn = parseISO(e.clock_in);
    return clockIn >= weekStart && clockIn <= weekEnd;
  });
  
  const monthStart = startOfMonth(new Date());
  const monthEnd = endOfMonth(new Date());
  const monthEntries = entriesList.filter(e => {
    if (!e.clock_in) return false;
    const clockIn = parseISO(e.clock_in);
    return clockIn >= monthStart && clockIn <= monthEnd;
  });

  const todayHours = Number(calculatePeriodHours(todayEntries)) || 0;
  const weekHours = Number(calculatePeriodHours(weekEntries)) || 0;
  const monthHours = Number(calculatePeriodHours(monthEntries)) || 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
          <p className="text-sm text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="p-6 min-h-[60vh] bg-background flex items-center justify-center">
        <Card className="max-w-md w-full mx-auto">
          <CardHeader>
            <CardTitle>Not an Employee</CardTitle>
            <CardDescription>
              Your account is not linked to an employee record. Please contact your administrator.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome, {employee.first_name}!
          </h1>
          <p className="text-muted-foreground">
            {format(currentTime, 'EEEE, MMMM d, yyyy')} • {format(currentTime, 'h:mm:ss a')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12">
            <AvatarFallback className="text-lg">
              {employee.first_name[0]}{employee.last_name[0]}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{employee.first_name} {employee.last_name}</p>
            <p className="text-sm text-muted-foreground">{employee.position || 'Employee'}</p>
          </div>
        </div>
      </div>

      {/* Clock In/Out Card */}
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-center md:text-left">
              <h2 className="text-2xl font-bold mb-2">
                {activeEntry ? 'Currently Clocked In' : 'Not Clocked In'}
              </h2>
              {activeEntry && (
                <div className="space-y-2">
                  <div className="flex items-center gap-4 text-lg">
                    <span className="font-mono text-3xl font-bold text-primary">
                      {onBreak ? breakTimeFormatted : elapsedTimeFormatted}
                    </span>
                    <Badge variant={onBreak ? "secondary" : "default"} className="text-sm">
                      {onBreak ? "On Break" : "Working"}
                    </Badge>
                  </div>
                  {onBreak && (
                    <p className="text-sm text-muted-foreground">
                      Break time elapsed • Work timer paused at {elapsedTimeFormatted}
                    </p>
                  )}
                </div>
              )}
              {todayShift && !activeEntry && (
                <p className="text-muted-foreground mt-2">
                  Scheduled: {format(parseISO(todayShift.start_time), 'h:mm a')} - {format(parseISO(todayShift.end_time), 'h:mm a')}
                </p>
              )}
            </div>
            
            <div className="flex gap-3">
              {!activeEntry ? (
                <Button 
                  size="lg" 
                  className="gap-2"
                  onClick={async () => {
                    await clockIn(todayShift?.id);
                    refetchEntries();
                  }}
                >
                  <Play className="h-5 w-5" />
                  Clock In
                  <MapPin className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <>
                  {!onBreak ? (
                    <Button 
                      size="lg" 
                      variant="outline"
                      className="gap-2"
                      onClick={async () => {
                        await startBreak(30);
                        refetchEntries();
                        refetchPersistent();
                      }}
                    >
                      <Coffee className="h-5 w-5" />
                      Start Break
                    </Button>
                  ) : (
                    <Button 
                      size="lg" 
                      variant="secondary"
                      className="gap-2 border-2 border-orange-500 bg-orange-100 hover:bg-orange-200 text-orange-700"
                      onClick={async () => {
                        await endBreak();
                        refetchEntries();
                        refetchPersistent();
                      }}
                    >
                      <Coffee className="h-5 w-5" />
                      Stop Break
                    </Button>
                  )}
                  <Button 
                    size="lg" 
                    variant="destructive"
                    className="gap-2"
                    onClick={async () => {
                      await clockOut();
                      refetchEntries();
                    }}
                    disabled={onBreak}
                  >
                    <Square className="h-5 w-5" />
                    Clock Out
                    <MapPin className="h-4 w-4 ml-1" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayHours.toFixed(1)}h</div>
            <p className="text-xs text-muted-foreground">{todayEntries.length} entries</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              This Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{weekHours.toFixed(1)}h</div>
            <p className="text-xs text-muted-foreground">{weekEntries.length} entries</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              This Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{monthHours.toFixed(1)}h</div>
            <p className="text-xs text-muted-foreground">{monthEntries.length} entries</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Upcoming Shifts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{shifts.length}</div>
            <p className="text-xs text-muted-foreground">This week</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different sections */}
      <Tabs defaultValue="shifts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="shifts" className="gap-2">
            <Calendar className="h-4 w-4" />
            My Shifts
          </TabsTrigger>
          <TabsTrigger value="tasks" className="gap-2">
            <FileText className="h-4 w-4" />
            My Tasks
          </TabsTrigger>
          <TabsTrigger value="hours" className="gap-2">
            <Clock className="h-4 w-4" />
            My Hours
          </TabsTrigger>
        </TabsList>

        <TabsContent value="shifts">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                Your shifts and co-workers&apos; schedule. Use the <strong>Team Schedule</strong> tab below or open <strong>My Schedule</strong> for the full view.
              </p>
              <Button variant="outline" size="sm" onClick={() => navigate("/scheduler/employee-schedule")}>
                <Calendar className="h-4 w-4 mr-2" />
                My Schedule (you + co-workers)
              </Button>
            </div>
            <EmployeeShifts employeeId={employee.id} showTeamScheduleTab={true} />
          </div>
        </TabsContent>

        <TabsContent value="tasks">
          <EmployeeTasks userId={user?.id || ''} />
        </TabsContent>

        <TabsContent value="hours">
          <EmployeeHours entries={entries} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
