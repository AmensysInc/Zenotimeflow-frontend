import { useMemo, useState, useEffect, useCallback } from "react";
import { Calendar, Clock, Users, Building, Filter, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import apiClient from "@/lib/api-client";
import { ensureArray } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
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
  const { role, isSuperAdmin, isOrganizationManager, isCompanyManager, isEmployee, isLoading: roleLoading } = useUserRole();

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [timeClockEntries, setTimeClockEntries] = useState<TimeClockEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [employeeCompanyId, setEmployeeCompanyId] = useState<string | null>(null);
  const [employeeCompanyLoading, setEmployeeCompanyLoading] = useState(false);
  const [loggedInEmployeeId, setLoggedInEmployeeId] = useState<string | null>(null);

  const [selectedOrganization, setSelectedOrganization] = useState<string>("all");
  const [selectedCompany, setSelectedCompany] = useState<string>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("weekly");
  const [currentDate, setCurrentDate] = useState(new Date());

  // Modal state
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const hasAdminAccess = isSuperAdmin || isOrganizationManager || isCompanyManager || role === 'admin';
  const hasAccess = hasAdminAccess || isEmployee;

  // Determine if a specific company is selected (or only one available). For employee, use their company.
  const activeCompanyId = useMemo(() => {
    if (isEmployee && employeeCompanyId) return employeeCompanyId;
    if (selectedCompany !== "all") return selectedCompany;
    if (companies.length === 1) return companies[0]?.id ?? null;
    return null;
  }, [isEmployee, employeeCompanyId, selectedCompany, companies]);

  const activeCompanyName = useMemo(() => {
    if (!activeCompanyId) return "";
    return companies.find((c) => c.id === activeCompanyId)?.name || "";
  }, [activeCompanyId, companies]);

  // Load filters (admin only; employees use their own company from employee record)
  useEffect(() => {
    if (!hasAdminAccess || !user) return;
    loadFilters();
  }, [user, role, hasAdminAccess, selectedOrganization]);

  // Employee: resolve their company so they can see "My Schedule" + co-workers in same company
  useEffect(() => {
    if (!user || !isEmployee) return;
    setEmployeeCompanyLoading(true);
    const loadEmployeeCompany = async () => {
      try {
        const empData = await apiClient.get<any>('/scheduler/employees/', { user: user.id });
        const list = ensureArray(empData);
        const emp = list[0];
        if (!emp?.company_id && !emp?.company) {
          setEmployeeCompanyLoading(false);
          return;
        }
        const cid = emp.company_id ?? (typeof emp.company === 'string' ? emp.company : (emp.company as any)?.id);
        const cname = (emp.company as any)?.name ?? 'My Company';
        const orgId = (emp.company as any)?.organization_id ?? (emp.company as any)?.organization ?? '';
        setEmployeeCompanyId(cid);
        setLoggedInEmployeeId(emp.id ?? null);
        setCompanies([{ id: cid, name: cname, organization_id: orgId }]);
        setSelectedCompany(cid);
      } catch (e) {
        console.error('Error loading employee company:', e);
        toast.error('Could not load your company.');
      } finally {
        setEmployeeCompanyLoading(false);
      }
    };
    loadEmployeeCompany();
  }, [user, isEmployee]);

  const loadFilters = async () => {
    if (!user) return;
    try {
      // Load organizations for Super Admin and Organization Managers
      if (isSuperAdmin) {
        const data = await apiClient.get<any>("/scheduler/organizations/");
        setOrganizations(ensureArray(data));
      } else if (isOrganizationManager) {
        const data = await apiClient.get<any>("/scheduler/organizations/", { organization_manager: user.id });
        setOrganizations(ensureArray(data));
      }

      // Build company query params based on role
      const params: any = { page_size: 500, limit: 500 };
      if (isSuperAdmin) {
        // Super Admin: filter by organization if selected, otherwise show all
        if (selectedOrganization !== "all") {
          params.organization = selectedOrganization;
        }
      } else if (isOrganizationManager) {
        // Organization Manager: only show companies in their organizations
        const orgs = await apiClient.get<any>("/scheduler/organizations/", { organization_manager: user.id });
        const orgList = ensureArray(orgs);
        const orgIds = orgList.map((o: any) => o.id);
        if (orgIds.length > 0) {
          params.organization = orgIds.join(',');
        }
      } else if (isCompanyManager) {
        // Company Manager: only show their assigned company
        params.company_manager = user.id;
      } else if (role === 'admin') {
        // Admin: same as super_admin for company list (all or by org)
        if (selectedOrganization !== "all") {
          params.organization = selectedOrganization;
        }
      }

      const companiesData = await apiClient.get<any>("/scheduler/companies/", params);
      const companiesList = ensureArray(companiesData);
      setCompanies(companiesList);

      // Auto-select company if only one exists and none is selected
      if (companiesList.length === 1 && selectedCompany === "all") {
        setSelectedCompany(companiesList[0].id);
      }
    } catch (error) {
      console.error("Error loading filters:", error);
      toast.error("Failed to load companies. Please refresh the page.");
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

      // Fetch employees (request larger page for paginated backends)
      const empData = await apiClient.get<any>('/scheduler/employees/', {
        company: activeCompanyId,
        status: 'active',
        page_size: 500,
        limit: 500
      });
      const empList = ensureArray(empData).map((e: any) => ({
        id: e.id,
        first_name: e.first_name ?? e.firstName ?? '',
        last_name: e.last_name ?? e.lastName ?? '',
        position: e.position ?? e.employee_position ?? null,
        status: e.status ?? e.employee_status ?? 'active',
      }));
      setEmployees(empList.sort((a: any, b: any) => 
        (a.first_name || '').localeCompare(b.first_name || '')
      ));

      // Fetch shifts (try both date param styles for backend compatibility)
      const shiftsRaw = await apiClient.get<any>('/scheduler/shifts/', {
        company: activeCompanyId,
        start_time__gte: start.toISOString(),
        start_time__lte: end.toISOString(),
        start_date: start.toISOString(),
        end_date: end.toISOString()
      });
      const rawShifts = ensureArray(shiftsRaw);
      // Normalize so we always have employee_id (API may return employee object or id)
      const shiftsData = rawShifts.map((s: any) => ({
        ...s,
        id: s.id,
        employee_id: s.employee_id ?? (typeof s.employee === 'object' && s.employee != null ? (s.employee as any).id : s.employee) ?? null,
        company_id: s.company_id ?? (typeof s.company === 'object' && s.company != null ? (s.company as any).id : s.company) ?? s.company_id,
        start_time: s.start_time,
        end_time: s.end_time,
        status: s.status ?? 'scheduled',
        notes: s.notes ?? null,
        break_minutes: s.break_minutes ?? null
      })).filter((s: any) => s.employee_id != null);
      setShifts(shiftsData.sort((a: any, b: any) =>
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      ));

      // Fetch time clock entries
      const shiftIds = shiftsData.map((s: any) => s.id);
      if (shiftIds.length > 0) {
        const clockData = await apiClient.get<any>('/scheduler/time-clock/', {
          shift__in: shiftIds.join(',')
        });
        const rawClock = ensureArray(clockData);
        const normalizedClock = rawClock.map((tc: any) => ({
          ...tc,
          id: tc.id,
          employee_id: tc.employee_id ?? (typeof tc.employee === 'object' && tc.employee != null ? (tc.employee as any).id : tc.employee) ?? null,
          shift_id: tc.shift_id ?? (typeof tc.shift === 'object' && tc.shift != null ? (tc.shift as any).id : tc.shift) ?? null,
          clock_in: tc.clock_in ?? null,
          clock_out: tc.clock_out ?? null,
          break_start: tc.break_start ?? null,
          break_end: tc.break_end ?? null,
          total_hours: tc.total_hours != null ? Number(tc.total_hours) : null
        }));
        setTimeClockEntries(normalizedClock);
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

  // Resolve employee id from shift/clock (normalized in loadData; compare as string for robustness)
  const shiftEmployeeId = (s: Shift) => (s as any).employee_id != null ? String((s as any).employee_id) : null;
  const clockEmployeeId = (tc: TimeClockEntry) => (tc as any).employee_id != null ? String((tc as any).employee_id) : null;
  const clockShiftId = (tc: TimeClockEntry) => (tc as any).shift_id != null ? String((tc as any).shift_id) : null;

  // Get shifts for a specific employee
  const getEmployeeShiftsWithClock = (empId: string) => {
    const id = String(empId);
    const empShifts = shifts.filter((s) => shiftEmployeeId(s) === id);
    return empShifts.map((s) => {
      const clockEntry = timeClockEntries.find((tc) => clockShiftId(tc) === String(s.id) && clockEmployeeId(tc) === id);
      return { ...s, clockEntry: clockEntry || null };
    });
  };

  // Get summary stats for an employee (coerce total_hours to number in case API returns string)
  const getEmployeeSummary = (empId: string) => {
    const id = String(empId);
    const empShifts = shifts.filter((s) => shiftEmployeeId(s) === id);
    const empClock = timeClockEntries.filter((tc) => clockEmployeeId(tc) === id);
    const totalHours = empClock.reduce((sum, tc) => sum + Number(tc.total_hours || 0), 0);
    return { shiftCount: empShifts.length, totalHours };
  };

  const handleEmployeeClick = (emp: Employee) => {
    setSelectedEmployee(emp);
    setDetailOpen(true);
  };

  // Show loading while role is resolving so we never render with stale/missing role (avoids blank or wrong access state)
  if (roleLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

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
            {isEmployee ? "My Schedule" : "Employee Schedule"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isEmployee
              ? "Your shifts and your co-workers' schedules in your company."
              : "Monitor employee schedules, shifts, and attendance"}
          </p>
        </div>
        {/* Download Report - only when company is selected and not employee view */}
        {activeCompanyId && !isEmployee && (
          <Button variant="outline" onClick={() => setReportOpen(true)}>
            <Download className="h-4 w-4 mr-2" />
            Download Report
          </Button>
        )}
      </div>

      {/* Filters - only for admin roles; employee sees fixed company */}
      {hasAdminAccess && (
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

            {companies.length >= 1 && (
              <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                <SelectTrigger className="w-[200px]">
                  <Building className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Select Company" />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  <SelectItem value="all">All Companies</SelectItem>
                  {companies.map((company: Company) => (
                    <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>
      )}

      {/* Employee: show company badge when their company is loaded */}
      {isEmployee && activeCompanyName && (
        <Card className="bg-muted/50">
          <CardContent className="p-3 flex items-center gap-2">
            <Building className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{activeCompanyName}</span>
          </CardContent>
        </Card>
      )}

      {/* No company selected / loading */}
      {!activeCompanyId ? (
        <Card>
          <CardContent className="p-8 text-center">
            {isEmployee && employeeCompanyLoading ? (
              <>
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Loading your schedule</h3>
                <p className="text-muted-foreground">Fetching your company and co-workers...</p>
              </>
            ) : (
              <>
                <Building className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-medium mb-2">
                  {isEmployee
                    ? "No employee record"
                    : companies.length === 0
                    ? "No Companies Available"
                    : "Select a Company"}
                </h3>
                <p className="text-muted-foreground">
                  {isEmployee
                    ? "Your account is not linked to a company. Please contact your administrator."
                    : companies.length === 0
                    ? "No companies found. Please create a company first or contact your administrator."
                    : "Please select an organization and company to view employee schedules."}
                </p>
              </>
            )}
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
                const isLoggedInUser = isEmployee && loggedInEmployeeId === emp.id;
                return (
                  <Card
                    key={emp.id}
                    className={`cursor-pointer hover:border-primary/50 hover:shadow-md transition-all ${isLoggedInUser ? 'ring-2 ring-primary border-primary bg-primary/5' : ''}`}
                    onClick={() => handleEmployeeClick(emp)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${isLoggedInUser ? 'bg-primary text-primary-foreground' : 'bg-primary/10'}`}>
                          <span className={`text-sm font-bold ${isLoggedInUser ? 'text-primary-foreground' : 'text-primary'}`}>
                            {(emp.first_name ?? '')[0]}{(emp.last_name ?? '')[0] || '?'}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate flex items-center gap-2">
                            {emp.first_name ?? ''} {emp.last_name ?? ''}
                            {isLoggedInUser && (
                              <span className="text-xs font-normal px-1.5 py-0.5 rounded bg-primary text-primary-foreground">You</span>
                            )}
                          </p>
                          {emp.position && (
                            <p className="text-xs text-muted-foreground truncate">{emp.position}</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-medium">{summary.shiftCount} shifts</p>
                          <p className="text-xs text-muted-foreground">{(Number(summary.totalHours) || 0).toFixed(1)} hrs</p>
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
                      {(Number(timeClockEntries.reduce((sum, tc) => sum + Number(tc.total_hours || 0), 0)) || 0).toFixed(1)}
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
