import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDepartments } from "@/hooks/useSchedulerDatabase";
// Supabase removed - using Django API
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface CreateShiftModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId?: string;
  onScheduleCreated?: () => void;
}

const DEFAULT_SHIFT_SLOTS = [
  { id: "morning", name: "Morning Shift", time: "6:00 AM - 2:00 PM", startHour: 6, endHour: 14 },
  { id: "afternoon", name: "Afternoon Shift", time: "2:00 PM - 10:00 PM", startHour: 14, endHour: 22 },
  { id: "night", name: "Night Shift", time: "10:00 PM - 6:00 AM", startHour: 22, endHour: 6 }
];

export default function CreateShiftModal({ 
  open, 
  onOpenChange, 
  companyId,
  onScheduleCreated
}: CreateShiftModalProps) {
  const { departments } = useDepartments(companyId);
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    schedule_name: "",
    description: "",
    department_id: ""
  });

  // Get current week's Monday
  const getWeekStart = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  };

  const getWeekDates = () => {
    const monday = getWeekStart();
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const weekDates = getWeekDates();
  const weekStart = getWeekStart();

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setFormData({
        schedule_name: `Week of ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
        description: "",
        department_id: ""
      });
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!companyId || !user?.id) {
      toast({
        title: "Error",
        description: "Company or user not available",
        variant: "destructive"
      });
      return;
    }

    if (!formData.schedule_name.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter a name for the schedule",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Create schedule template with empty shifts - manager will assign employees later
      const templateData = {
        shiftSlots: DEFAULT_SHIFT_SLOTS,
        shifts: [], // Empty - no employees assigned yet
        week_start: weekStart.toISOString(),
        department_id: formData.department_id || null
      };

      await apiClient.post('/scheduler/schedule-templates/', {
        name: formData.schedule_name.trim(),
        description: formData.description.trim() || null,
          template_data: templateData,
          company_id: companyId,
          created_by: user.id
        }]);

      if (error) throw error;

      toast({
        title: "Schedule Created",
        description: `"${formData.schedule_name}" has been created. Load it to assign employees.`
      });

      onScheduleCreated?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to create schedule:', error);
      toast({
        title: "Error",
        description: "Failed to create schedule. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Create New Schedule</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Create a weekly schedule template ({weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})
          </p>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Schedule Name */}
          <div className="space-y-2">
            <Label htmlFor="schedule_name">Schedule Name *</Label>
            <Input
              id="schedule_name"
              value={formData.schedule_name}
              onChange={(e) => setFormData(prev => ({ ...prev, schedule_name: e.target.value }))}
              placeholder="e.g., Week 5 Schedule"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Add notes about this schedule..."
              rows={2}
            />
          </div>

          {/* Department Selection */}
          <div className="space-y-2">
            <Label htmlFor="department">Department (Optional)</Label>
            <Select
              value={formData.department_id}
              onValueChange={(value) => setFormData(prev => ({ ...prev, department_id: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="All departments" />
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

          {/* Summary */}
          <div className="bg-muted/50 p-3 rounded-lg">
            <p className="text-sm font-medium">Schedule Template</p>
            <p className="text-xs text-muted-foreground mt-1">
              This will create an empty schedule with 3 shift slots (Morning, Afternoon, Night) for 7 days. 
              Load the schedule and drag employees to assign shifts.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading}
            >
              {loading ? "Creating..." : "Create Schedule"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
