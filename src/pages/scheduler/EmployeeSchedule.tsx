import { useMemo, useState, useEffect, useCallback } from "react";
import { Calendar, Clock, Users, Building, Filter, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import apiClient from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays, addWeeks, addMonths, parseISO } from "date-fns";
import EmployeeScheduleDetailModal from "@/components/scheduler/EmployeeScheduleDetailModal";
import EmployeeScheduleReportModal from "@/components/scheduler/EmployeeScheduleReportModal";

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  position: string | null;
  status: string;
}

interface Shift {
  id: string;
  employee_id: string;
  company_id: string;
  start_time: string;
  end_time: string;
  status: string;
  notes: string | null;
  break_minutes: number | null;
}

interface TimeClockEntry {
  id: string;
  employee_id: string;
  shift_id: string | null;
  clock_in: string | null;
  clock_out: string | null;
  break_start: string | null;
  break_end: string | null;
  total_hours: number | null;
}

interface Organization {
  id: string;
  name: string;
}

interface Company {
  id: string;
  name: string;
  organization_id: string;
}

type ViewMode = "daily" | "weekly" | "monthly";

export default function EmployeeSchedule() {
  const { user } = useAuth();
  const { role, isSuperAdmin, isOrganizationManager, isCompanyManager } = useUserRole();

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [timeClockEntries, setTimeClockEntries] = useState<TimeClockEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const [selectedOrganization, setSelectedOrganization] = useState<string>("all");
  const [selectedCompany, setSelectedCompany] = useState<string>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("weekly");
  const [currentDate, setCurrentDate] = useState(new Date());

  // Modal state
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const hasAccess = isSuperAdmin || isOrganizationManager || isCompanyManager;

  // Determine if a specific company is selected (or only one available)
  const activeCompanyId = useMemo(() => {
    if (selectedCompany !== "all") return selectedCompany;
    if (companies.length === 1) return companies[0].id;
    return null;
  }, [selectedCompany, companies]);

  const activeCompanyName = useMemo(() => {
    if (!activeCompanyId) return "";
    return companies.find((c) => c.id === activeCompanyId)?.name || "";
  }, [activeCompanyId, companies]);

  // Load filters
  useEffect(() => {
    if (!hasAccess || !user) return;
    loadFilters();
  }, [user, role, hasAccess, selectedOrganization]);

  const loadFilters = async () => {
    if (!user) return;
    try {
      if (isSuperAdmin) {
        const data = await apiClient.get<any[]>("/scheduler/organizations/");
        setOrganizations(data || []);
      } else if (isOrganizationManager) {
        const data = await apiClient.get<any[]>("/scheduler/organizations/", { organization_manager: user.id });
        setOrganizations(data || []);
      }

      const params: any = {};
      if (isSuperAdmin) {
        if (selectedOrganization !== "all") {
          params.organization = selectedOrganization;
        }
      } else if (isOrganizationManager) {
        const orgs = await apiClient.get<any[]>("/scheduler/organizations/", { organization_manager: user.id });
        const orgIds = orgs?.map((o) => o.id) || [];
        if (orgIds.length > 0) params.organization = orgIds.join(',');
      } else if (isCompanyManager) {
        params.company_manager = user.id;
      }

      const companiesData = await apiClient.get<any[]>("/scheduler/companies/", params);
      setCompanies(companiesData || []);
    } catch (error) {
      console.error("Error loading filters:", error);
    }
  };

  // Load employees & data when company is selected
  useEffect(() => {
    if (!activeCompanyId || !hasAccess) {
      setEmployees([]);
      setShifts([]);
      setTimeClockEntries([]);
      return;
    }
    loadData();
  }, [activeCompanyId, hasAccess, viewMode, currentDate]);

  const getDateRange = () => {
    switch (viewMode) {
      case "daily":
        return { start: startOfDay(currentDate), end: endOfDay(currentDate) };
      case "weekly":
        return { start: startOfWeek(currentDate, { weekStartsOn: 1 }), end: endOfWeek(currentDate, { weekStartsOn: 1 }) };
      case "monthly":
        return { start: startOfMonth(currentDate), end: endOfMonth(currentDate) };
    }
  };

  const loadData = async () => {
    if (!activeCompanyId) return;
    setLoading(true);
    try {
      const { start, end } = getDateRange();

      // Fetch employees
      const empData = await apiClient.get<any[]>('/scheduler/employees/', {
        company: activeCompanyId,
        status: 'active'
      });
      setEmployees(empData.sort((a: any, b: any) => 
        (a.first_name || '').localeCompare(b.first_name || '')
      ));

      // Fetch shifts
      const shiftsData = await apiClient.get<any[]>('/scheduler/shifts/', {
        company: activeCompanyId,
        start_time__gte: start.toISOString(),
        start_time__lte: end.toISOString()
      });
      setShifts(shiftsData.sort((a: any, b: any) => 
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      ));

      // Fetch time clock entries
      const shiftIds = shiftsData.map((s: any) => s.id);
      if (shiftIds.length > 0) {
        const clockData = await apiClient.get<any[]>('/scheduler/time-clock/', {
          shift__in: shiftIds.join(',')
        });
        setTimeClockEntries(clockData || []);
      } else {
        setTimeClockEntries([]);
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const navigateDate = (direction: "prev" | "next") => {
    switch (viewMode) {
      case "daily":
        setCurrentDate((prev) => addDays(prev, direction === "next" ? 1 : -1));
        break;
      case "weekly":
        setCurrentDate((prev) => addWeeks(prev, direction === "next" ? 1 : -1));
        break;
      case "monthly":
        setCurrentDate((prev) => addMonths(prev, direction === "next" ? 1 : -1));
        break;
    }
  };

  const getDateRangeLabel = () => {
    const { start, end } = getDateRange();
    switch (viewMode) {
      case "daily":
        return format(currentDate, "EEEE, MMMM d, yyyy");
      case "weekly":
        return `${format(start, "MMM d")} - ${format(end, "MMM d, yyyy")}`;
      case "monthly":
        return format(currentDate, "MMMM yyyy");
    }
  };

  // Get shifts for a specific employee
  const getEmployeeShiftsWithClock = (empId: string) => {
    const empShifts = shifts.filter((s) => s.employee_id === empId);
    return empShifts.map((s) => {
      const clockEntry = timeClockEntries.find((tc) => tc.shift_id === s.id && tc.employee_id === empId);
      return { ...s, clockEntry: clockEntry || null };
    });
  };

  // Get summary stats for an employee
  const getEmployeeSummary = (empId: string) => {
    const empShifts = shifts.filter((s) => s.employee_id === empId);
    const empClock = timeClockEntries.filter((tc) => tc.employee_id === empId);
    const totalHours = empClock.reduce((sum, tc) => sum + (tc.total_hours || 0), 0);
    return { shiftCount: empShifts.length, totalHours };
  };

  const handleEmployeeClick = (emp: Employee) => {
    setSelectedEmployee(emp);
    setDetailOpen(true);
  };

  if (!hasAccess) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">You don't have permission to view employee schedules.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="h-6 w-6" />
            Employee Schedule
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor employee schedules, shifts, and attendance
          </p>
        </div>
        {/* Download Report - only when company is selected */}
        {activeCompanyId && (
          <Button variant="outline" onClick={() => setReportOpen(true)}>
            <Download className="h-4 w-4 mr-2" />
            Download Report
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters:</span>
            </div>

            {isSuperAdmin && organizations.length > 0 && (
              <Select value={selectedOrganization} onValueChange={(v) => { setSelectedOrganization(v); setSelectedCompany("all"); }}>
                <SelectTrigger className="w-[200px]">
                  <Building className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="All Organizations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Organizations</SelectItem>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {companies.length > 1 && (
              <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                <SelectTrigger className="w-[200px]">
                  <Building className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Select Company" />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  <SelectItem value="all">All Companies</SelectItem>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {companies.length === 1 && (
              <Badge variant="secondary" className="px-3 py-1.5">
                <Building className="h-4 w-4 mr-2" />
                {companies[0].name}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* No company selected message */}
      {!activeCompanyId ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Building className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-medium mb-2">Select a Company</h3>
            <p className="text-muted-foreground">
              Please select an organization and company to view employee schedules.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* View Controls */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
              <TabsList>
                <TabsTrigger value="daily">Daily</TabsTrigger>
                <TabsTrigger value="weekly">Weekly</TabsTrigger>
                <TabsTrigger value="monthly">Monthly</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => navigateDate("prev")}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[200px] text-center">
                {getDateRangeLabel()}
              </span>
              <Button variant="outline" size="icon" onClick={() => navigateDate("next")}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
                Today
              </Button>
            </div>
          </div>

          {/* Employee List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : employees.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-medium mb-2">No Employees Found</h3>
                <p className="text-muted-foreground">No active employees in this company.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {employees.map((emp) => {
                const summary = getEmployeeSummary(emp.id);
                return (
                  <Card
                    key={emp.id}
                    className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all"
                    onClick={() => handleEmployeeClick(emp)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-sm font-bold text-primary">
                            {emp.first_name[0]}{emp.last_name[0]}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{emp.first_name} {emp.last_name}</p>
                          {emp.position && (
                            <p className="text-xs text-muted-foreground truncate">{emp.position}</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-medium">{summary.shiftCount} shifts</p>
                          <p className="text-xs text-muted-foreground">{summary.totalHours.toFixed(1)} hrs</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Period Summary */}
          {!loading && employees.length > 0 && shifts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Period Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <p className="text-2xl font-bold">{employees.length}</p>
                    <p className="text-sm text-muted-foreground">Employees</p>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <p className="text-2xl font-bold">{shifts.length}</p>
                    <p className="text-sm text-muted-foreground">Total Shifts</p>
                  </div>
                  <div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">
                      {timeClockEntries.filter((tc) => tc.clock_in && tc.clock_out).length}
                    </p>
                    <p className="text-sm text-muted-foreground">Completed</p>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <p className="text-2xl font-bold">
                      {timeClockEntries.reduce((sum, tc) => sum + (tc.total_hours || 0), 0).toFixed(1)}
                    </p>
                    <p className="text-sm text-muted-foreground">Total Hours</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Employee Detail Modal */}
      <EmployeeScheduleDetailModal
        open={detailOpen}
        onOpenChange={setDetailOpen}
        employee={selectedEmployee}
        shifts={selectedEmployee ? getEmployeeShiftsWithClock(selectedEmployee.id) : []}
        isSuperAdmin={isSuperAdmin}
        onDataUpdated={loadData}
      />

      {/* Report Modal */}
      {activeCompanyId && (
        <EmployeeScheduleReportModal
          open={reportOpen}
          onOpenChange={setReportOpen}
          companyId={activeCompanyId}
          companyName={activeCompanyName}
        />
      )}
    </div>
  );
}
