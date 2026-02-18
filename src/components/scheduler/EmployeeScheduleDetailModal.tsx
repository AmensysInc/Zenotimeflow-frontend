import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar, Clock, Edit2, Save, X } from "lucide-react";
import { format, parseISO, differenceInMinutes } from "date-fns";
// Supabase removed - using Django API
import { toast } from "sonner";

interface ShiftWithClock {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  notes: string | null;
  break_minutes: number | null;
  clockEntry?: {
    id: string;
    clock_in: string | null;
    clock_out: string | null;
    break_start: string | null;
    break_end: string | null;
    total_hours: number | null;
  } | null;
}

interface EmployeeScheduleDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: { id: string; first_name: string; last_name: string } | null;
  shifts: ShiftWithClock[];
  isSuperAdmin: boolean;
  onDataUpdated: () => void;
}

export default function EmployeeScheduleDetailModal({
  open,
  onOpenChange,
  employee,
  shifts,
  isSuperAdmin,
  onDataUpdated,
}: EmployeeScheduleDetailModalProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editClockIn, setEditClockIn] = useState("");
  const [editClockOut, setEditClockOut] = useState("");
  const [saving, setSaving] = useState(false);

  if (!employee) return null;

  const calculateHours = (shift: ShiftWithClock): number => {
    const ce = shift.clockEntry;
    if (!ce?.clock_in) return 0;
    const clockIn = new Date(ce.clock_in);
    const clockOut = ce.clock_out ? new Date(ce.clock_out) : null;
    if (!clockOut) return 0;
    let totalMin = differenceInMinutes(clockOut, clockIn);
    // Deduct break
    if (ce.break_start && ce.break_end) {
      totalMin -= differenceInMinutes(new Date(ce.break_end), new Date(ce.break_start));
    }
    return Math.max(0, totalMin / 60);
  };

  const grandTotal = shifts.reduce((sum, s) => sum + calculateHours(s), 0);

  const startEdit = (shift: ShiftWithClock) => {
    const ce = shift.clockEntry;
    setEditingId(shift.id);
    setEditClockIn(ce?.clock_in ? format(parseISO(ce.clock_in), "yyyy-MM-dd'T'HH:mm") : "");
    setEditClockOut(ce?.clock_out ? format(parseISO(ce.clock_out), "yyyy-MM-dd'T'HH:mm") : "");
  };

  const saveEdit = async (shift: ShiftWithClock) => {
    if (!shift.clockEntry?.id) {
      toast.error("No time clock entry to edit");
      return;
    }
    setSaving(true);
    try {
      const updates: any = {};
      if (editClockIn) updates.clock_in = new Date(editClockIn).toISOString();
      if (editClockOut) updates.clock_out = new Date(editClockOut).toISOString();

      // Recalculate total hours
      if (updates.clock_in && updates.clock_out) {
        let totalMin = differenceInMinutes(new Date(updates.clock_out), new Date(updates.clock_in));
        const ce = shift.clockEntry;
        if (ce?.break_start && ce?.break_end) {
          totalMin -= differenceInMinutes(new Date(ce.break_end), new Date(ce.break_start));
        }
        updates.total_hours = Math.max(0, totalMin / 60);
      }

      await apiClient.patch(`/scheduler/time-clock/${shift.clockEntry.id}/`, updates);
      toast.success("Time clock updated");
      setEditingId(null);
      onDataUpdated();
    } catch (err: any) {
      console.error("Error updating time clock:", err);
      toast.error("Failed to update: " + (err.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-bold text-primary">
                {employee.first_name[0]}{employee.last_name[0]}
              </span>
            </div>
            <span>{employee.first_name} {employee.last_name}</span>
          </DialogTitle>
        </DialogHeader>

        {shifts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>No shifts found for this period</p>
          </div>
        ) : (
          <div className="space-y-3">
            {shifts.map((shift) => {
              const hours = calculateHours(shift);
              const ce = shift.clockEntry;
              const isEditing = editingId === shift.id;
              const shiftDate = parseISO(shift.start_time);

              return (
                <div key={shift.id} className="border rounded-lg p-4 space-y-2 bg-muted/30">
                  {/* Date & Day */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{format(shiftDate, "EEEE, MMM d, yyyy")}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {hours > 0 && (
                        <Badge variant="outline">{hours.toFixed(2)} hrs</Badge>
                      )}
                      {isSuperAdmin && ce && !isEditing && (
                        <Button size="sm" variant="ghost" onClick={() => startEdit(shift)}>
                          <Edit2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Shift time */}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>Shift: {format(shiftDate, "h:mm a")} - {format(parseISO(shift.end_time), "h:mm a")}</span>
                  </div>

                  {/* Clock data */}
                  {isEditing ? (
                    <div className="space-y-2 pt-2 border-t">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-muted-foreground">Clock In</label>
                          <Input
                            type="datetime-local"
                            value={editClockIn}
                            onChange={(e) => setEditClockIn(e.target.value)}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Clock Out</label>
                          <Input
                            type="datetime-local"
                            value={editClockOut}
                            onChange={(e) => setEditClockOut(e.target.value)}
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} disabled={saving}>
                          <X className="h-3 w-3 mr-1" /> Cancel
                        </Button>
                        <Button size="sm" onClick={() => saveEdit(shift)} disabled={saving}>
                          <Save className="h-3 w-3 mr-1" /> Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm pt-1">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Clock In:</span>
                        <span className={ce?.clock_in ? "text-green-600 font-medium" : "text-muted-foreground"}>
                          {ce?.clock_in ? format(parseISO(ce.clock_in), "h:mm a") : "—"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Clock Out:</span>
                        <span className={ce?.clock_out ? "text-green-600 font-medium" : "text-muted-foreground"}>
                          {ce?.clock_out ? format(parseISO(ce.clock_out), "h:mm a") : "—"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Grand Total */}
            <div className="border-t pt-3 flex justify-between items-center font-semibold">
              <span>Total Hours</span>
              <Badge className="text-base px-3 py-1">{grandTotal.toFixed(2)} hrs</Badge>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
