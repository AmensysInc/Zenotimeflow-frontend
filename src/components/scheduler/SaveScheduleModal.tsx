import { useState, useEffect } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
// Supabase removed - using Django API
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface ShiftSlot {
  id: string;
  name: string;
  time: string;
  startHour: number;
  endHour: number;
}

interface ShiftData {
  employee_id: string;
  employee_name: string;
  day_index: number;
  slot_id: string;
  start_hour: number;
  end_hour: number;
  break_minutes: number;
  hourly_rate?: number;
  department_id?: string;
}

interface SaveScheduleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  shiftSlots: ShiftSlot[];
  shifts: ShiftData[];
  weekStart: Date;
  existingTemplate?: {
    id: string;
    name: string;
    description: string | null;
  } | null;
  onSaved: () => void;
}

export default function SaveScheduleModal({
  open,
  onOpenChange,
  companyId,
  shiftSlots,
  shifts,
  weekStart,
  existingTemplate,
  onSaved
}: SaveScheduleModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [existingScheduleForWeek, setExistingScheduleForWeek] = useState<{ id: string; name: string; description: string | null } | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  // Check for existing schedule for current week and reset form when modal opens
  useEffect(() => {
    if (open) {
      const checkExistingSchedule = async () => {
        if (existingTemplate) {
          // If editing a template directly, use that
          setName(existingTemplate.name);
          setDescription(existingTemplate.description || "");
          setExistingScheduleForWeek(null);
          return;
        }

        // Check if there's already a schedule for this week
        const weekStartStr = weekStart.toISOString();
        const existingSchedules = await apiClient.get<any[]>('/scheduler/schedule-templates/', {
          company: companyId
        });

        const matchingSchedule = existingSchedules.find((schedule: any) => {
          const scheduleData = typeof schedule.template_data === 'string' 
            ? JSON.parse(schedule.template_data) 
            : schedule.template_data;
          return scheduleData?.week_start === weekStartStr;
        });

        if (matchingSchedule) {
          setName(matchingSchedule.name);
          setDescription(matchingSchedule.description || "");
          setExistingScheduleForWeek({
            id: matchingSchedule.id,
            name: matchingSchedule.name,
            description: matchingSchedule.description
          });
        } else {
          // Default name based on week
          setName(`Week of ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`);
          setDescription("");
          setExistingScheduleForWeek(null);
        }
      };

      checkExistingSchedule();
    }
  }, [open, existingTemplate, weekStart, companyId]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter a name for the schedule",
        variant: "destructive"
      });
      return;
    }

    if (!user?.id) {
      toast({
        title: "Not signed in",
        description: "Please sign in again and try saving.",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      const templateData = JSON.parse(JSON.stringify({
        shiftSlots,
        shifts,
        week_start: weekStart.toISOString()
      }));

      // Check for existing schedule with same week_start for this company (to prevent duplicates)
      const weekStartStr = weekStart.toISOString();
      const existingSchedules = await apiClient.get<any[]>('/scheduler/schedule-templates/', {
        company: companyId
      });
      
      // Find if there's already a schedule for this week
      const duplicateSchedule = existingSchedules.find((schedule: any) => {
        const scheduleData = typeof schedule.template_data === 'string' 
          ? JSON.parse(schedule.template_data) 
          : schedule.template_data;
        return scheduleData?.week_start === weekStartStr && schedule.id !== existingTemplate?.id;
      });

      if (existingTemplate) {
        // Update existing template
        await apiClient.patch(`/scheduler/schedule-templates/${existingTemplate.id}/`, {
          name: name.trim(),
          description: description.trim() || null,
          template_data: templateData,
        });
        
        toast({
          title: "Schedule Updated",
          description: `"${name}" has been updated successfully.`
        });
      } else if (duplicateSchedule) {
        // Update the existing schedule for this week instead of creating a duplicate
        await apiClient.patch(`/scheduler/schedule-templates/${duplicateSchedule.id}/`, {
          name: name.trim(),
          description: description.trim() || null,
          template_data: templateData,
        });
        
        toast({
          title: "Schedule Updated",
          description: `Existing schedule for this week has been updated to "${name}".`
        });
      } else {
        // Create new template
        await apiClient.post('/scheduler/schedule-templates/', {
          name: name.trim(),
          description: description.trim() || null,
          template_data: templateData,
          company: companyId,
          created_by: user.id
        });
        
        toast({
          title: "Schedule Saved",
          description: `"${name}" has been saved successfully.`
        });
      }

      onSaved();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving schedule:', error);
      toast({
        title: "Error",
        description: "Failed to save schedule. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  // Determine if we're updating (either explicit template or detected week match)
  const isUpdating = existingTemplate || existingScheduleForWeek;
  const scheduleLabel = existingTemplate?.name || existingScheduleForWeek?.name || name;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="h-5 w-5" />
            {isUpdating ? "Update Schedule" : "Save Schedule"}
          </DialogTitle>
          <DialogDescription>
            {isUpdating 
              ? `Update "${scheduleLabel}" with current shifts`
              : "Save the current week's schedule for future use"
            }
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="scheduleName">Schedule Name</Label>
            <Input
              id="scheduleName"
              name="scheduleName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter schedule name"
              autoComplete="off"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description for this schedule"
              rows={3}
            />
          </div>
          
          <div className="bg-muted/50 rounded-lg p-3 text-sm">
            <div className="font-medium mb-1">Schedule Details:</div>
            <ul className="text-muted-foreground space-y-1">
              <li>• {shifts.length} shifts configured</li>
              <li>• {shiftSlots.length} time slots</li>
              <li>• Week starting: {weekStart.toLocaleDateString('en-US', { 
                weekday: 'long', 
                month: 'long', 
                day: 'numeric', 
                year: 'numeric' 
              })}</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : existingTemplate ? "Update Schedule" : "Save Schedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
