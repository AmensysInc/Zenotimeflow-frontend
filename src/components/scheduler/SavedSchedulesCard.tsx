import { useState, useEffect } from "react";
import { Calendar, Edit, Trash2, Clock, Users, Copy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import apiClient from "@/lib/api-client";
import { ensureArray } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Exported for use in other components
export interface SavedSchedule {
  id: string;
  name: string;
  description: string | null;
  template_data: {
    shiftSlots: Array<{
      id: string;
      name: string;
      time: string;
      startHour: number;
      endHour: number;
    }>;
    shifts: Array<{
      employee_id: string;
      employee_name: string;
      day_index: number;
      slot_id: string;
      start_hour: number;
      end_hour: number;
      break_minutes: number;
      hourly_rate?: number;
      department_id?: string;
    }>;
    week_start: string;
    week_end?: string;
  };
  created_at: string;
  updated_at: string;
}

interface SavedSchedulesCardProps {
  companyId: string;
  /** Display name for the selected company (e.g. "Gas Stations") */
  companyName?: string;
  /** Display name for the selected organization, if any (e.g. for super_admin) */
  organizationName?: string;
  onLoadSchedule: (template: SavedSchedule) => void;
  onEditSchedule: (template: SavedSchedule) => void;
  onCopyToCurrentWeek?: (template: SavedSchedule) => void;
  /** Called after a schedule (and its shifts) are deleted so the parent can refetch the shift list. */
  onScheduleDeleted?: () => void;
  currentWeekLabel?: string;
  refreshTrigger?: number;
}

export default function SavedSchedulesCard({ 
  companyId, 
  companyName,
  organizationName,
  onLoadSchedule, 
  onEditSchedule,
  onCopyToCurrentWeek,
  onScheduleDeleted,
  currentWeekLabel,
  refreshTrigger 
}: SavedSchedulesCardProps) {
  const [savedSchedules, setSavedSchedules] = useState<SavedSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState<SavedSchedule | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (companyId) {
      fetchSavedSchedules();
    }
  }, [companyId, refreshTrigger]);

  const fetchSavedSchedules = async () => {
    setLoading(true);
    try {
      const raw = await apiClient.get<any>('/scheduler/schedule-templates/', {
        company: companyId
      });
      const templates = ensureArray(raw);
      
      // Parse template_data from JSON
      const parsedData = templates.map((item: any) => ({
        ...item,
        template_data: typeof item.template_data === 'string' 
          ? JSON.parse(item.template_data) 
          : item.template_data
      })) as SavedSchedule[];
      
      setSavedSchedules(parsedData);
    } catch (error) {
      console.error('Error fetching saved schedules:', error);
      toast({
        title: "Error",
        description: "Failed to load saved schedules",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!scheduleToDelete) return;
    
    try {
      const weekStart = scheduleToDelete.template_data?.week_start;
      const weekEnd = scheduleToDelete.template_data?.week_end;

      // Also delete actual shifts in this schedule's date range so the calendar is cleared
      if (companyId && weekStart) {
        const startDate = new Date(weekStart);
        startDate.setHours(0, 0, 0, 0);
        const endDate = weekEnd ? new Date(weekEnd) : new Date(startDate);
        if (!weekEnd) endDate.setDate(endDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
        try {
          const rawShifts = await apiClient.get<any>('/scheduler/shifts/', {
            company: companyId,
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString()
          });
          const shiftsInRange = ensureArray(rawShifts);
          for (const shift of shiftsInRange) {
            const rawClock = await apiClient.get<any>('/scheduler/time-clock/', { shift: shift.id });
            const clockEntries = ensureArray(rawClock);
            await Promise.all(clockEntries.map((entry: any) =>
              apiClient.patch(`/scheduler/time-clock/${entry.id}/`, { shift: null })
            ));
            await apiClient.delete(`/scheduler/shifts/${shift.id}/`);
          }
        } catch (err) {
          console.error('Error clearing shifts for deleted schedule:', err);
          // Continue to delete the template even if shift cleanup fails
        }
      }

      // If duplicates exist for the same week, delete all for that week to avoid "ghost" schedules.
      if (weekStart) {
        const raw = await apiClient.get<any>('/scheduler/schedule-templates/', {
          company: companyId
        });
        const templates = ensureArray(raw);
        const matchingTemplates = templates.filter((t: any) => {
          const data = typeof t.template_data === 'string' 
            ? JSON.parse(t.template_data) 
            : t.template_data;
          return data?.week_start === weekStart;
        });
        await Promise.all(matchingTemplates.map((t: any) => 
          apiClient.delete(`/scheduler/schedule-templates/${t.id}/`)
        ));
      } else {
        await apiClient.delete(`/scheduler/schedule-templates/${scheduleToDelete.id}/`);
      }

      // Optimistic UI update
      setSavedSchedules((prev) =>
        weekStart
          ? prev.filter((s) => s.template_data?.week_start !== weekStart)
          : prev.filter((s) => s.id !== scheduleToDelete.id)
      );
      
      toast({
        title: "Schedule Deleted",
        description: `"${scheduleToDelete.name}" and its shifts have been deleted.`
      });
      
      // Re-fetch to ensure UI matches DB
      fetchSavedSchedules();
      onScheduleDeleted?.();
    } catch (error) {
      console.error('Error deleting schedule:', error);
      toast({
        title: "Error",
        description: "Failed to delete schedule",
        variant: "destructive"
      });
    } finally {
      setDeleteDialogOpen(false);
      setScheduleToDelete(null);
    }
  };

  const getShiftCount = (template: SavedSchedule) => {
    return template.template_data?.shifts?.length || 0;
  };

  const getWeekRange = (template: SavedSchedule) => {
    if (!template.template_data?.week_start) return "No date set";
    try {
      const weekStart = parseISO(template.template_data.week_start);
      const weekEnd = template.template_data.week_end
        ? parseISO(template.template_data.week_end)
        : (() => { const e = new Date(weekStart); e.setDate(e.getDate() + 6); return e; })();
      return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
    } catch {
      return "Invalid date";
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            All Schedules
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Loading saved schedules...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            All Schedules
            {companyName && (
              <span className="font-normal text-muted-foreground">
                — {[organizationName, companyName].filter(Boolean).join(' · ')}
              </span>
            )}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {companyName
              ? `Saved schedules for ${companyName}`
              : 'View and manage your saved weekly schedules'}
          </p>
        </CardHeader>
        <CardContent>
          {savedSchedules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No saved schedules yet</p>
              <p className="text-sm mt-1">Save your current schedule to see it here</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {savedSchedules.map((schedule) => (
                <Card 
                  key={schedule.id} 
                  className="border hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => onEditSchedule(schedule)}
                >
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-lg">{schedule.name}</h3>
                          {schedule.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {schedule.description}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {getWeekRange(schedule)}
                        </Badge>
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {getShiftCount(schedule)} shifts
                        </Badge>
                      </div>
                      
                      <div className="text-xs text-muted-foreground">
                        Saved: {format(parseISO(schedule.created_at), 'MMM d, yyyy h:mm a')}
                      </div>
                      
                      <div className="flex flex-col gap-2 pt-2 border-t">
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="default" 
                            size="sm" 
                            className="flex-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditSchedule(schedule);
                            }}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setScheduleToDelete(schedule);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        {onCopyToCurrentWeek && (
                          <Button 
                            variant="secondary" 
                            size="sm" 
                            className="w-full"
                            onClick={(e) => {
                              e.stopPropagation();
                              onCopyToCurrentWeek(schedule);
                            }}
                          >
                            <Copy className="h-4 w-4 mr-1" />
                            Copy to {currentWeekLabel || 'Current Week'}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Schedule</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{scheduleToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
