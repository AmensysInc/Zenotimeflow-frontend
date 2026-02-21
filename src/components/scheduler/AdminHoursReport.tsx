import { useState, useEffect } from "react";
import { Clock, Download, Users, Calendar, Filter, FileSpreadsheet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
// Supabase removed - using Django API
import { format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { toast } from "sonner";

interface AdminHoursReportProps {
  companyId: string;
}

export default function AdminHoursReport({ companyId }: AdminHoursReportProps) {
  const [entries, setEntries] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'lastMonth' | 'custom'>('week');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [departments, setDepartments] = useState<any[]>([]);

  // Fetch departments
  useEffect(() => {
    const fetchDepartments = async () => {
      if (!companyId) return;
      const departments = await apiClient.get<any[]>('/scheduler/departments/', {
        company: companyId
      });
      setDepartments(departments);
    };
    fetchDepartments();
  }, [companyId]);

  // Fetch employees
  useEffect(() => {
    const fetchEmployees = async () => {
      if (!companyId) return;
      const employees = await apiClient.get<any[]>('/scheduler/employees/', {
        company: companyId,
        status: 'active'
      });
      setEmployees(employees);
    };
    fetchEmployees();
  }, [companyId]);

  // Fetch time entries
  useEffect(() => {
    const fetchEntries = async () => {
      if (!companyId) return;
      setLoading(true);

      let start: Date;
      let end: Date;
      const now = new Date();

      switch (dateRange) {
        case 'week':
          start = startOfWeek(now, { weekStartsOn: 1 });
          end = endOfWeek(now, { weekStartsOn: 1 });
          break;
        case 'month':
          start = startOfMonth(now);
          end = endOfMonth(now);
          break;
        case 'lastMonth':
          const lastMonth = subMonths(now, 1);
          start = startOfMonth(lastMonth);
          end = endOfMonth(lastMonth);
          break;
        case 'custom':
          start = startDate ? new Date(startDate) : startOfMonth(now);
          end = endDate ? new Date(endDate) : endOfMonth(now);
          break;
        default:
          start = startOfWeek(now, { weekStartsOn: 1 });
          end = endOfWeek(now, { weekStartsOn: 1 });
      }

      let entries = await apiClient.get<any[]>('/scheduler/time-clock/', {
        clock_in__gte: start.toISOString(),
        clock_in__lte: end.toISOString()
      });
      
      // Filter by company and department
      const employees = await apiClient.get<any[]>('/scheduler/employees/', {
        company: companyId
      });
      const employeeIds = employees.map((e: any) => e.id);
      entries = entries.filter((e: any) => employeeIds.includes(e.employee));
      
      if (selectedDepartment !== 'all') {
        const deptEmployeeIds = employees
          .filter((e: any) => e.department === selectedDepartment)
          .map((e: any) => e.id);
        entries = entries.filter((e: any) => deptEmployeeIds.includes(e.employee));
      }
      
      if (selectedEmployee !== 'all') {
        entries = entries.filter((e: any) => e.employee === selectedEmployee);
      }
      
      setEntries(entries.sort((a: any, b: any) => 
        new Date(b.clock_in || 0).getTime() - new Date(a.clock_in || 0).getTime()
      ));
      setLoading(false);
    };

    fetchEntries();
  }, [companyId, dateRange, startDate, endDate, selectedEmployee, selectedDepartment]);

  // Calculate summaries
  const calculateSummary = () => {
    const summary: Record<string, {
      employeeId: string;
      name: string;
      position: string;
      department: string;
      totalHours: number;
      overtimeHours: number;
      entries: number;
      hourlyRate: number;
    }> = {};

    entries.forEach(entry => {
      const empId = entry.employee_id;
      const emp = entry.employees;
      
      if (!summary[empId]) {
        const dept = departments.find(d => d.id === emp?.department_id);
        summary[empId] = {
          employeeId: empId,
          name: `${emp?.first_name || ''} ${emp?.last_name || ''}`.trim(),
          position: emp?.position || 'N/A',
          department: dept?.name || 'N/A',
          totalHours: 0,
          overtimeHours: 0,
          entries: 0,
          hourlyRate: Number(emp?.hourly_rate || 0),
        };
      }

      summary[empId].totalHours += Number(entry.total_hours || 0);
      summary[empId].overtimeHours += Number(entry.overtime_hours || 0);
      summary[empId].entries += 1;
    });

    return Object.values(summary).sort((a, b) => b.totalHours - a.totalHours);
  };

  const summaryData = calculateSummary();
  const totalHours = summaryData.reduce((sum, s) => sum + s.totalHours, 0);
  const totalOvertime = summaryData.reduce((sum, s) => sum + s.overtimeHours, 0);
  const totalCost = summaryData.reduce((sum, s) => sum + (s.totalHours * s.hourlyRate), 0);

  // Export to Excel (CSV)
  const exportToExcel = () => {
    let csvContent = 'Employee,Position,Department,Total Hours,Overtime Hours,Hourly Rate,Total Cost,Entries\n';
    
    summaryData.forEach(row => {
      const th = Number(row.totalHours) || 0;
      const ot = Number(row.overtimeHours) || 0;
      const rate = Number(row.hourlyRate) || 0;
      const cost = th * rate;
      csvContent += `"${row.name}","${row.position}","${row.department}",${th.toFixed(2)},${ot.toFixed(2)},${rate.toFixed(2)},${cost.toFixed(2)},${row.entries}\n`;
    });
    
    const sumH = Number(totalHours) || 0;
    const sumO = Number(totalOvertime) || 0;
    const sumC = Number(totalCost) || 0;
    csvContent += `\nTotals,,,${sumH.toFixed(2)},${sumO.toFixed(2)},,${sumC.toFixed(2)},${entries.length}\n`;
    
    // Add detailed entries
    csvContent += '\n\nDetailed Time Entries\n';
    csvContent += 'Employee,Date,Clock In,Clock Out,Break (min),Total Hours,Overtime,Notes\n';
    
    entries.forEach(entry => {
      const emp = entry.employees;
      const date = entry.clock_in ? format(parseISO(entry.clock_in), 'yyyy-MM-dd') : '-';
      const clockIn = entry.clock_in ? format(parseISO(entry.clock_in), 'HH:mm') : '-';
      const clockOut = entry.clock_out ? format(parseISO(entry.clock_out), 'HH:mm') : 'Active';
      
      let breakMin = 0;
      if (entry.break_start && entry.break_end) {
        breakMin = Math.round((new Date(entry.break_end).getTime() - new Date(entry.break_start).getTime()) / (1000 * 60));
      }
      
      csvContent += `"${emp?.first_name} ${emp?.last_name}",${date},${clockIn},${clockOut},${breakMin},${(entry.total_hours || 0).toFixed(2)},${(entry.overtime_hours || 0).toFixed(2)},"${entry.notes || ''}"\n`;
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hours-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    toast.success('Report exported successfully');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Employee Hours Report
          </CardTitle>
          <Button onClick={exportToExcel} className="gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Export to Excel
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Select value={dateRange} onValueChange={(v: any) => setDateRange(v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="lastMonth">Last Month</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>

          {dateRange === 'custom' && (
            <>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                placeholder="Start Date"
              />
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                placeholder="End Date"
              />
            </>
          )}

          <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
            <SelectTrigger>
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map(dept => (
                <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
            <SelectTrigger>
              <SelectValue placeholder="All Employees" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Employees</SelectItem>
              {employees.map(emp => (
                <SelectItem key={emp.id} value={emp.id}>
                  {emp.first_name} {emp.last_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold">{summaryData.length}</div>
            <div className="text-sm text-muted-foreground">Employees</div>
          </div>
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold">{(Number(totalHours) || 0).toFixed(1)}h</div>
            <div className="text-sm text-muted-foreground">Total Hours</div>
          </div>
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold text-amber-600">{(Number(totalOvertime) || 0).toFixed(1)}h</div>
            <div className="text-sm text-muted-foreground">Overtime</div>
          </div>
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">${(Number(totalCost) || 0).toFixed(0)}</div>
            <div className="text-sm text-muted-foreground">Est. Cost</div>
          </div>
        </div>

        {/* Summary Table */}
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : summaryData.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No time entries found for this period</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Department</TableHead>
                <TableHead className="text-right">Total Hours</TableHead>
                <TableHead className="text-right">Overtime</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Est. Cost</TableHead>
                <TableHead className="text-right">Entries</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summaryData.map((row) => (
                <TableRow key={row.employeeId}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>
                          {row.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{row.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>{row.position}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{row.department}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {(Number(row.totalHours) || 0).toFixed(1)}h
                  </TableCell>
                  <TableCell className="text-right">
                    {Number(row.overtimeHours) > 0 ? (
                      <span className="text-amber-600">{(Number(row.overtimeHours) || 0).toFixed(1)}h</span>
                    ) : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    ${(Number(row.hourlyRate) || 0).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right text-green-600">
                    ${((Number(row.totalHours) || 0) * (Number(row.hourlyRate) || 0)).toFixed(0)}
                  </TableCell>
                  <TableCell className="text-right">{row.entries}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
