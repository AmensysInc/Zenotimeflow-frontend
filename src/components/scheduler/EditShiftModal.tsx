import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useShifts, useEmployees, useDepartments, Shift, Employee } from "@/hooks/useSchedulerDatabase";
import apiClient from "@/lib/api-client";

interface EditShiftModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shift: Shift | null;
  companyId?: string;
  onShiftUpdated?: () => void;
}

export default function EditShiftModal({ open, onOpenChange, shift, companyId, onShiftUpdated }: EditShiftModalProps) {
  const { updateShift, deleteShift } = useShifts();
  const { employees } = useEmployees(companyId);
  const { departments } = useDepartments(companyId);
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    employee_id: "",
    department_id: "",
    date: "",
    start_time: "",
    end_time: "",
    break_minutes: 30,
    hourly_rate: "",
    notes: "",
    status: "scheduled"
  });

  // Set form data when shift changes
  useEffect(() => {
    if (shift && open) {
      const startDate = new Date(shift.start_time);
      const endDate = new Date(shift.end_time);
      
      setFormData({
        employee_id: shift.employee_id,
        department_id: shift.department_id || "",
        date: startDate.toISOString().split('T')[0],
        start_time: startDate.toTimeString().slice(0, 5),
        end_time: endDate.toTimeString().slice(0, 5),
        break_minutes: shift.break_minutes || 30,
        hourly_rate: shift.hourly_rate?.toString() || "",
        notes: shift.notes || "",
        status: shift.status
      });
    }
  }, [shift, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!shift || !formData.employee_id || !formData.date || !formData.start_time || !formData.end_time) {
      return;
    }

    setLoading(true);
    try {
      const startDateTime = new Date(`${formData.date}T${formData.start_time}:00`);
      const endDateTime = new Date(`${formData.date}T${formData.end_time}:00`);
      
      await updateShift(shift.id, {
        employee_id: formData.employee_id,
        department_id: formData.department_id || undefined,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        break_minutes: formData.break_minutes,
        hourly_rate: formData.hourly_rate ? parseFloat(formData.hourly_rate) : undefined,
        notes: formData.notes || undefined,
        status: formData.status
      });
      onShiftUpdated?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to update shift:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!shift) return;
    
    if (!confirm('Are you sure you want to delete this shift? This action cannot be undone.')) {
      return;
    }

    setDeleteLoading(true);
    try {
      // First unlink any time_clock entries that reference this shift
      const clockEntries = await apiClient.get<any[]>('/scheduler/time-clock/', {
        shift: shift.id
      });
      await Promise.all(clockEntries.map((entry: any) => 
        apiClient.patch(`/scheduler/time-clock/${entry.id}/`, { shift: null })
      ));
      
      // Now delete the shift
      await deleteShift(shift.id);
      onShiftUpdated?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to delete shift:', error);
    } finally {
      setDeleteLoading(false);
    }
  };

  const selectedEmployee = employees.find(e => e.id === formData.employee_id);

  if (!shift) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Edit Shift</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="employee">Employee *</Label>
              <Select
                value={formData.employee_id}
                onValueChange={(value) => {
                  const employee = employees.find(e => e.id === value);
                  setFormData(prev => ({
                    ...prev,
                    employee_id: value,
                    department_id: employee?.department_id || prev.department_id,
                    hourly_rate: employee?.hourly_rate?.toString() || prev.hourly_rate
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.first_name} {employee.last_name} - {employee.position}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Select
                value={formData.department_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, department_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((department) => (
                    <SelectItem key={department.id} value={department.id}>
                      {department.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Date *</Label>
            <Input
              id="date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_time">Start Time *</Label>
              <Input
                id="start_time"
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end_time">End Time *</Label>
              <Input
                id="end_time"
                type="time"
                value={formData.end_time}
                onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="hourly_rate">
              Hourly Rate {selectedEmployee?.hourly_rate && `(Default: $${selectedEmployee.hourly_rate})`}
            </Label>
            <Input
              id="hourly_rate"
              type="number"
              min="0"
              step="0.01"
              value={formData.hourly_rate}
              onChange={(e) => setFormData(prev => ({ ...prev, hourly_rate: e.target.value }))}
              placeholder={selectedEmployee?.hourly_rate?.toString() || "15.00"}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="no_show">No Show</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Add any additional notes for this shift..."
              rows={3}
            />
          </div>

          <div className="flex justify-between pt-4">
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={loading || deleteLoading}
            >
              {deleteLoading ? "Deleting..." : "Delete Shift"}
            </Button>
            
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading || deleteLoading}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={loading || deleteLoading || !formData.employee_id || !formData.date || !formData.start_time || !formData.end_time}
              >
                {loading ? "Updating..." : "Update Shift"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}