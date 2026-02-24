import { useState } from "react";
import { Clock, Calendar, TrendingUp, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import type { TimeClockEntry } from "@/hooks/useEmployeeTimeClock";

interface EmployeeHoursProps {
  entries: TimeClockEntry[];
}

export default function EmployeeHours({ entries }: EmployeeHoursProps) {
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('week');

  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const filteredEntries = entries.filter(entry => {
    if (!entry.clock_in) return false;
    const clockIn = parseISO(entry.clock_in);
    
    if (period === 'week') {
      return isWithinInterval(clockIn, { start: weekStart, end: weekEnd });
    }
    if (period === 'month') {
      return isWithinInterval(clockIn, { start: monthStart, end: monthEnd });
    }
    return true;
  });

  const totalHours = filteredEntries.reduce((sum, entry) => sum + (Number(entry.total_hours) || 0), 0);
  const overtimeHours = filteredEntries.reduce((sum, entry) => sum + (Number(entry.overtime_hours) || 0), 0);
  const avgHoursPerDay = filteredEntries.length > 0 ? totalHours / filteredEntries.length : 0;

  const formatDuration = (hours: number | null) => {
    if (!hours) return '-';
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  };

  const downloadHoursReport = () => {
    let csvContent = 'Date,Clock In,Clock Out,Break Duration,Total Hours,Overtime\n';
    
    filteredEntries.forEach(entry => {
      const date = entry.clock_in ? format(parseISO(entry.clock_in), 'yyyy-MM-dd') : '-';
      const clockIn = entry.clock_in ? format(parseISO(entry.clock_in), 'HH:mm') : '-';
      const clockOut = entry.clock_out ? format(parseISO(entry.clock_out), 'HH:mm') : '-';
      
      let breakDuration = 0;
      if (entry.break_start && entry.break_end) {
        const breakStart = new Date(entry.break_start);
        const breakEnd = new Date(entry.break_end);
        breakDuration = Math.round((breakEnd.getTime() - breakStart.getTime()) / (1000 * 60));
      }
      
      csvContent += `${date},${clockIn},${clockOut},${breakDuration}min,${(Number(entry.total_hours) || 0).toFixed(2)},${(Number(entry.overtime_hours) || 0).toFixed(2)}\n`;
    });
    
      csvContent += `\nTotal Hours,,,,${(Number(totalHours) || 0).toFixed(2)},${(Number(overtimeHours) || 0).toFixed(2)}\n`;
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `my-hours-${format(now, 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            My Hours
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge 
              variant={period === 'week' ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => setPeriod('week')}
            >
              This Week
            </Badge>
            <Badge 
              variant={period === 'month' ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => setPeriod('month')}
            >
              This Month
            </Badge>
            <Badge 
              variant={period === 'all' ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => setPeriod('all')}
            >
              All Time
            </Badge>
            <Button variant="outline" size="sm" onClick={downloadHoursReport}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold">{(Number(totalHours) || 0).toFixed(1)}h</div>
            <div className="text-sm text-muted-foreground">Total Hours</div>
          </div>
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold text-amber-600">{(Number(overtimeHours) || 0).toFixed(1)}h</div>
            <div className="text-sm text-muted-foreground">Overtime</div>
          </div>
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold">{(Number(avgHoursPerDay) || 0).toFixed(1)}h</div>
            <div className="text-sm text-muted-foreground">Avg per Day</div>
          </div>
        </div>

        {/* Hours Table */}
        {filteredEntries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No time entries for this period</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Clock In</TableHead>
                <TableHead>Clock Out</TableHead>
                <TableHead>Break</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Overtime</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEntries.map((entry) => {
                let breakMinutes = 0;
                if (entry.break_start && entry.break_end) {
                  const breakStart = new Date(entry.break_start);
                  const breakEnd = new Date(entry.break_end);
                  breakMinutes = Math.round((breakEnd.getTime() - breakStart.getTime()) / (1000 * 60));
                }
                
                return (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">
                      {entry.clock_in ? format(parseISO(entry.clock_in), 'EEE, MMM d') : '-'}
                    </TableCell>
                    <TableCell>
                      {entry.clock_in ? format(parseISO(entry.clock_in), 'h:mm a') : '-'}
                    </TableCell>
                    <TableCell>
                      {entry.clock_out ? format(parseISO(entry.clock_out), 'h:mm a') : (
                        <Badge variant="outline" className="text-green-600">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {breakMinutes > 0 ? `${breakMinutes}m` : '-'}
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatDuration(entry.total_hours)}
                    </TableCell>
                    <TableCell>
                      {entry.overtime_hours && entry.overtime_hours > 0 ? (
                        <span className="text-amber-600 font-medium">
                          {formatDuration(entry.overtime_hours)}
                        </span>
                      ) : '-'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
