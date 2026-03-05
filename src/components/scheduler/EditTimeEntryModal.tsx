import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import apiClient from "@/lib/api-client";

interface EditTimeEntryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: {
    id: string;
    clock_in: string | null;
    clock_out: string | null;
    employees?: { first_name?: string; last_name?: string };
  } | null;
  onSuccess?: () => void;
}

function toLocalDateTimeISO(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EditTimeEntryModal({ open, onOpenChange, entry, onSuccess }: EditTimeEntryModalProps) {
  const [loading, setLoading] = useState(false);
  const [clockIn, setClockIn] = useState("");
  const [clockOut, setClockOut] = useState("");

  useEffect(() => {
    if (open && entry) {
      setClockIn(toLocalDateTimeISO(entry.clock_in));
      setClockOut(entry.clock_out ? toLocalDateTimeISO(entry.clock_out) : "");
    }
  }, [open, entry]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entry) return;
    if (!clockIn.trim()) {
      toast.error("Clock in time is required");
      return;
    }
    setLoading(true);
    try {
      const payload: { clock_in: string; clock_out?: string | null } = {
        clock_in: new Date(clockIn).toISOString(),
      };
      if (clockOut.trim()) {
        payload.clock_out = new Date(clockOut).toISOString();
      } else {
        payload.clock_out = null;
      }
      await apiClient.patch(`/scheduler/time-clock/${entry.id}/`, payload);
      await (onSuccess?.() ?? Promise.resolve());
      onOpenChange(false);
      toast.success("Time entry updated");
    } catch (err: any) {
      console.error("Failed to update time entry:", err);
      toast.error(err?.message || "Failed to update time entry");
    } finally {
      setLoading(false);
    }
  };

  if (!entry) return null;

  const employeeName = `${entry.employees?.first_name || ""} ${entry.employees?.last_name || ""}`.trim() || "Employee";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Edit clock in / out</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground mb-4">{employeeName}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="clock_in">Clock In</Label>
            <Input
              id="clock_in"
              type="datetime-local"
              value={clockIn}
              onChange={(e) => setClockIn(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="clock_out">Clock Out (leave empty if still clocked in)</Label>
            <Input
              id="clock_out"
              type="datetime-local"
              value={clockOut}
              onChange={(e) => setClockOut(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
