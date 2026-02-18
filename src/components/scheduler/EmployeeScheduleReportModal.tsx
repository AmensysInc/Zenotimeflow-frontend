import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download } from "lucide-react";
// Supabase removed - using Django API
import { toast } from "sonner";
import { format, parseISO, differenceInMinutes } from "date-fns";

interface EmployeeScheduleReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  companyName: string;
}

export default function EmployeeScheduleReportModal({
  open,
  onOpenChange,
  companyId,
  companyName,
}: EmployeeScheduleReportModalProps) {
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [generating, setGenerating] = useState(false);

  const generateReport = async () => {
    if (!startDate || !endDate) {
      toast.error("Please select both start and end dates");
      return;
    }

    setGenerating(true);
    try {
      const startISO = new Date(startDate + "T00:00:00").toISOString();
      const endISO = new Date(endDate + "T23:59:59").toISOString();

      // Fetch employees for this company
      const employees = await apiClient.get<any[]>('/scheduler/employees/', {
        company: companyId,
        status: 'active'
      });
      
      if (!employees || employees.length === 0) {
        toast.error("No employees found");
        return;
      }

      // Fetch shifts in range
      const shifts = await apiClient.get<any[]>('/scheduler/shifts/', {
        company: companyId,
        start_time__gte: startISO,
        start_time__lte: endISO
      });

      const shiftIds = shifts.map((s: any) => s.id);

      // Fetch time clock entries
      let clockEntries: any[] = [];
      if (shiftIds.length > 0) {
        const clockData = await apiClient.get<any[]>('/scheduler/time-clock/', {
          shift__in: shiftIds.join(',')
        });
        clockEntries = clockData || [];
      }

      // Calculate total hours per employee
      const employeeHours: Record<string, number> = {};
      for (const entry of clockEntries) {
        if (!entry.clock_in || !entry.clock_out) continue;
        let totalMin = differenceInMinutes(new Date(entry.clock_out), new Date(entry.clock_in));
        if (entry.break_start && entry.break_end) {
          totalMin -= differenceInMinutes(new Date(entry.break_end), new Date(entry.break_start));
        }
        const hours = Math.max(0, totalMin / 60);
        employeeHours[entry.employee_id] = (employeeHours[entry.employee_id] || 0) + hours;
      }

      // Build CSV
      const rows = [["Employee Name", "Total Hours"]];
      for (const emp of employees) {
        const totalHrs = employeeHours[emp.id] || 0;
        rows.push([`${emp.first_name} ${emp.last_name}`, totalHrs.toFixed(2)]);
      }

      const csvContent = rows.map((r) => r.join(",")).join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${companyName}_Hours_Report_${startDate}_to_${endDate}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success("Report downloaded successfully");
      onOpenChange(false);
    } catch (err: any) {
      console.error("Error generating report:", err);
      toast.error("Failed to generate report");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Download Hours Report
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Download a report for <strong>{companyName}</strong> with each employee's total hours in the selected date range.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Start Date</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">End Date</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={generateReport} disabled={generating}>
            <Download className="h-4 w-4 mr-2" />
            {generating ? "Generating..." : "Download Report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
