import { useState } from "react";
import { Clock, MapPin, UserCheck, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
// Supabase removed - using Django API
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface MissedShift {
  id: string;
  employee_id: string;
  company_id: string;
  start_time: string;
  end_time: string;
  employeeName: string;
  companyName?: string;
  departmentName?: string;
}

interface MissedShiftRequestModalProps {
  shift: MissedShift | null;
  employeeId: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function MissedShiftRequestModal({
  shift,
  employeeId,
  onClose,
  onSuccess
}: MissedShiftRequestModalProps) {
  const [requesting, setRequesting] = useState(false);

  const handleRequestShift = async () => {
    if (!shift) return;

    try {
      setRequesting(true);

      // Check if already requested
      const requests = await apiClient.get<any[]>('/scheduler/replacement-requests/', {
        shift: shift.id,
        replacement_employee: employeeId
      });
      const existing = requests && requests.length > 0 ? requests[0] : null;

      if (existing) {
        toast.error('You have already requested this shift');
        onClose();
        return;
      }

      // Create replacement request
      await apiClient.post('/scheduler/replacement-requests/', {
        shift: shift.id,
        original_employee: shift.employee_id,
        replacement_employee: employeeId,
          company_id: shift.company_id,
          status: 'pending'
        });

      if (error) throw error;

      toast.success('Request sent to manager for approval');
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Error requesting shift:', error);
      toast.error('Failed to send request');
    } finally {
      setRequesting(false);
    }
  };

  return (
    <Dialog open={!!shift} onOpenChange={() => onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request to Cover Shift</DialogTitle>
          <DialogDescription>
            You are requesting to cover this missed shift. The manager will be notified and must approve your request before you can clock in.
          </DialogDescription>
        </DialogHeader>

        {shift && (
          <div className="py-4 space-y-3">
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">
                Originally assigned to: {shift.employeeName}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>
                {format(parseISO(shift.start_time), 'EEEE, MMMM d, yyyy')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>
                {format(parseISO(shift.start_time), 'h:mm a')} - {format(parseISO(shift.end_time), 'h:mm a')}
              </span>
            </div>
            {shift.companyName && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{shift.companyName}</span>
              </div>
            )}
            {shift.departmentName && (
              <div className="flex items-center gap-2">
                <Badge variant="outline">{shift.departmentName}</Badge>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleRequestShift} disabled={requesting}>
            <Send className="h-4 w-4 mr-2" />
            {requesting ? 'Sending...' : 'Send Request to Manager'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
