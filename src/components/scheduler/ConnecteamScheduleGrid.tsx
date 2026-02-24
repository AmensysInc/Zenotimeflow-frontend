import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { format, isSameDay } from 'date-fns';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { 
  Plus, 
  Clock, 
  AlertTriangle, 
  X, 
  Calendar,
  Users,
  ChevronLeft,
  ChevronRight,
  Bell,
  Trash2,
  Edit,
  Check
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Employee, Shift } from '@/hooks/useSchedulerDatabase';
import { AvailabilityStatus } from '@/hooks/useEmployeeAvailability';
import { ScheduleTeam } from '@/hooks/useScheduleTeams';
import { DateRange } from 'react-day-picker';

interface ConnecteamScheduleGridProps {
  onCreateShiftDirect?: (employeeId: string, dayIndex: number, startTime: string, endTime: string) => void;
  employees: Employee[];
  shifts: Shift[];
  teams?: ScheduleTeam[];
  weekDates: Date[];
  isEditMode: boolean;
  canManageShifts: boolean;
  getEmployeeName: (id: string) => string;
  getAvailabilityStatus: (employeeId: string, date: Date) => AvailabilityStatus;
  onDragStart: (e: React.DragEvent, employeeId: string, shift?: Shift) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, employeeId: string, dayIndex: number) => void;
  onDragEnd: () => void;
  onShiftClick: (shift: Shift) => void;
  onAddShift: (employeeId: string, dayIndex: number) => void;
  onDeleteShift: (shiftId: string) => void;
  onReassignShift?: (shiftId: string, newEmployeeId: string) => void;
  onSetAvailability?: (employeeId: string, date: Date, status: AvailabilityStatus) => void;
  checkShiftConflict: (employeeId: string, startTime: Date, endTime: Date, excludeShiftId?: string) => Shift | undefined;
  onNavigateWeek: (direction: 'prev' | 'next') => void;
  onDateRangeSelect?: (start: Date, end: Date) => void;
  weekLabel: string;
  onToggleEditMode: () => void;
  onSaveSchedule: () => void;
  onAddNewSchedule: () => void;
  onClearWeek: () => void;
  onDuplicateWeek: () => void;
  onPrint: () => void;
  onDownload: () => void;
  isEmployeeView?: boolean;
  currentEmployeeId?: string;
}

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Sentinel for unassigned shift (Radix Select forbids empty string value). */
const UNASSIGNED_SELECT_VALUE = '__unassigned__';

const presetShifts = [
  { label: 'Morning (6AM-2PM)', startHour: 6, endHour: 14 },
  { label: 'Afternoon (2PM-10PM)', startHour: 14, endHour: 22 },
  { label: 'Night (10PM-6AM)', startHour: 22, endHour: 6 },
  { label: 'Day (9AM-5PM)', startHour: 9, endHour: 17 },
];

interface InlineShiftForm {
  dayIndex: number;
  selectedPreset: string;
  startTime: string;
  endTime: string;
  employeeId: string;
  shiftCreated: boolean;
}

export default function ConnecteamScheduleGrid({
  onCreateShiftDirect,
  employees,
  shifts,
  teams = [],
  weekDates,
  isEditMode,
  canManageShifts,
  getEmployeeName,
  getAvailabilityStatus,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onShiftClick,
  onAddShift,
  onDeleteShift,
  onReassignShift,
  onSetAvailability,
  checkShiftConflict,
  onNavigateWeek,
  onDateRangeSelect,
  weekLabel,
  onToggleEditMode,
  onSaveSchedule,
  onAddNewSchedule,
  onClearWeek,
  onDuplicateWeek,
  onPrint,
  onDownload,
  isEmployeeView = false,
  currentEmployeeId
}: ConnecteamScheduleGridProps) {
  const [inlineForm, setInlineForm] = useState<InlineShiftForm | null>(null);
  const [calendarRange, setCalendarRange] = useState<DateRange | undefined>(undefined);

  const closeInlineForm = useCallback(() => setInlineForm(null), []);

  useEffect(() => {
    if (!inlineForm || inlineForm.shiftCreated) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setInlineForm(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [inlineForm]);

  useEffect(() => {
    if (!isEditMode) setInlineForm(null);
  }, [isEditMode]);

  const getTeamColor = (teamId: string | null | undefined): string => {
    if (!teamId) return '#6B7280';
    const team = teams.find(t => t.id === teamId);
    return team?.color || '#6B7280';
  };

  const getShiftsForDay = (date: Date): Shift[] => {
    return shifts.filter(shift => {
      const shiftDate = new Date(shift.start_time);
      return isSameDay(shiftDate, date);
    });
  };

  const getDayStats = (date: Date) => {
    const dayShifts = getShiftsForDay(date);
    const totalHours = dayShifts.reduce((acc, shift) => {
      const start = new Date(shift.start_time);
      const end = new Date(shift.end_time);
      return acc + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    }, 0);
    const uniqueEmployees = new Set(dayShifts.map(s => s.employee_id)).size;
    return { hours: totalHours.toFixed(0), shifts: dayShifts.length, users: uniqueEmployees };
  };

  const weeklyStats = useMemo(() => {
    let totalHours = 0;
    let totalShifts = 0;
    const uniqueUsers = new Set<string>();
    const relevantShifts = isEmployeeView && currentEmployeeId 
      ? shifts.filter(s => s.employee_id === currentEmployeeId)
      : shifts;
    relevantShifts.forEach(shift => {
      const start = new Date(shift.start_time);
      const end = new Date(shift.end_time);
      totalHours += (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      totalShifts++;
      uniqueUsers.add(shift.employee_id);
    });
    return { hours: totalHours.toFixed(0), shifts: totalShifts, users: uniqueUsers.size };
  }, [shifts, isEmployeeView, currentEmployeeId]);

  const formatShiftTime = (shift: Shift): string => {
    const start = new Date(shift.start_time);
    const end = new Date(shift.end_time);
    return `${format(start, 'HH:mm')} - ${format(end, 'HH:mm')}`;
  };

  const getShiftColor = (shift: Shift): string => {
    if (shift.is_missed) return 'bg-red-500 text-white';
    if (shift.status === 'completed') return 'bg-green-500 text-white';
    if (shift.status === 'in_progress') return 'bg-blue-500 text-white';
    return 'bg-amber-600 text-white';
  };

  const isToday = (date: Date): boolean => isSameDay(date, new Date());

  const handleStartInlineForm = (dayIndex: number) => {
    setInlineForm({
      dayIndex,
      selectedPreset: 'Morning (6AM-2PM)',
      startTime: '06:00',
      endTime: '14:00',
      employeeId: '',
      shiftCreated: false,
    });
  };

  const handlePresetChange = (presetLabel: string) => {
    if (!inlineForm) return;
    const preset = presetShifts.find(p => p.label === presetLabel);
    if (preset) {
      setInlineForm({
        ...inlineForm,
        selectedPreset: presetLabel,
        startTime: `${String(preset.startHour).padStart(2, '0')}:00`,
        endTime: `${String(preset.endHour).padStart(2, '0')}:00`,
      });
    }
  };

  const handleCreateShift = async () => {
    if (!inlineForm) return;
    if (employees.length > 0 && !inlineForm.employeeId) return; // require employee when list exists
    if (employees.length === 0) return; // need at least one employee to assign
    if (onCreateShiftDirect && inlineForm.employeeId) {
      try {
        await onCreateShiftDirect(inlineForm.employeeId, inlineForm.dayIndex, inlineForm.startTime, inlineForm.endTime);
        setInlineForm(null);
      } catch {
        // Parent shows toast; keep form open so user can fix and retry
      }
      return;
    }
    if (onAddShift && inlineForm.employeeId) {
      try {
        onAddShift(inlineForm.employeeId, inlineForm.dayIndex);
        setInlineForm(null);
      } catch {
        // Keep form open on error
      }
      return;
    }
    setInlineForm({ ...inlineForm, shiftCreated: true });
  };

  const handleAssignEmployee = (employeeId: string) => {
    if (!inlineForm || !employeeId) return;
    if (onCreateShiftDirect) {
      onCreateShiftDirect(employeeId, inlineForm.dayIndex, inlineForm.startTime, inlineForm.endTime);
    } else {
      onAddShift(employeeId, inlineForm.dayIndex);
    }
    // Close the form after assigning
    setInlineForm(null);
  };

  // Handle dropping a shift card onto a day column to move it
  const handleDayDrop = (e: React.DragEvent, dayIndex: number) => {
    if (!isEditMode) return;
    e.preventDefault();
    const shiftId = e.dataTransfer.getData('shiftId');
    const employeeId = e.dataTransfer.getData('employeeId');
    if (shiftId && employeeId) {
      onDrop(e, employeeId, dayIndex);
    }
  };

  return (
    <div className="flex flex-col h-full bg-card rounded-lg border overflow-hidden">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between p-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onNavigateWeek('prev')}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 font-medium">
                  <Calendar className="h-4 w-4" />
                  {weekLabel}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <div className="flex flex-col">
                  <CalendarPicker
                    mode="range"
                    selected={calendarRange}
                    onSelect={(range: DateRange | undefined) => {
                      if (!range) {
                        setCalendarRange(undefined);
                        return;
                      }
                      // If both from and to are set (user completed a range), apply it
                      if (range.from && range.to) {
                        setCalendarRange(range);
                        if (onDateRangeSelect) {
                          onDateRangeSelect(range.from, range.to);
                        }
                      } else {
                        // Only from is set - user is picking start date
                        setCalendarRange(range);
                      }
                    }}
                    numberOfMonths={2}
                    disabled={false}
                    className={cn("p-3 pointer-events-auto")}
                  />
                  <div className="flex items-center justify-between px-4 pb-3">
                    <span className="text-xs text-muted-foreground">
                      {calendarRange?.from && !calendarRange?.to 
                        ? `Start: ${format(calendarRange.from, 'MMM d')} — now pick end date`
                        : calendarRange?.from && calendarRange?.to
                          ? `${format(calendarRange.from, 'MMM d')} - ${format(calendarRange.to, 'MMM d')}`
                          : 'Pick a start date'}
                    </span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 text-xs"
                      onClick={() => setCalendarRange(undefined)}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onNavigateWeek('next')}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {!isEmployeeView && canManageShifts && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1" onClick={onToggleEditMode}>
              <Edit className="h-4 w-4" />
              {isEditMode ? 'Exit Edit' : 'Edit'}
            </Button>
            <Button variant="outline" size="sm" className="gap-1" onClick={onDuplicateWeek}>
              <Plus className="h-4 w-4" />
              Duplicate
            </Button>
            <Button variant="outline" size="sm" onClick={onPrint}>Print</Button>
            <Button variant="outline" size="sm" onClick={onDownload}>Download</Button>
            <Button variant="outline" size="sm" className="gap-1 text-destructive hover:text-destructive" onClick={onClearWeek}>
              <Trash2 className="h-4 w-4" />
              Clear
            </Button>
            <Button size="sm" className="bg-primary text-primary-foreground" onClick={onSaveSchedule}>
              Publish
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Bell className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Day Columns Grid */}
      <div className="flex-1 overflow-auto">
        <div className={cn("grid min-w-[1100px] h-full")} style={{ gridTemplateColumns: `repeat(${weekDates.length}, minmax(0, 1fr))` }}>
          <TooltipProvider>
            {weekDates.map((date, dayIndex) => {
              const stats = getDayStats(date);
              const today = isToday(date);
              const dayShifts = getShiftsForDay(date);

              return (
                <div
                  key={dayIndex}
                  className={cn(
                    "border-r last:border-r-0 flex flex-col",
                    today && "bg-primary/5"
                  )}
                  onDragOver={onDragOver}
                  onDrop={(e) => handleDayDrop(e, dayIndex)}
                >
                  {/* Day Header */}
                  <div className={cn(
                    "p-2 text-center border-b sticky top-0 z-10 bg-muted/20",
                    today && "bg-primary/10"
                  )}>
                    <div className={cn(
                      "inline-flex items-center justify-center rounded-full px-3 py-1 mb-1",
                      today ? "bg-destructive text-destructive-foreground font-bold" : "font-medium"
                    )}>
                      {format(date, 'EEE')} {format(date, 'd/M')}
                    </div>
                    <div className="flex items-center justify-center gap-2 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-0.5">
                        <Clock className="h-3 w-3" />{stats.hours}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <Calendar className="h-3 w-3" />{stats.shifts}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <Users className="h-3 w-3" />{stats.users}
                      </span>
                    </div>
                    {today && (
                      <div className="mt-1 mx-auto w-3/4 h-1 bg-destructive rounded-full" />
                    )}
                  </div>

                  {/* Shift Cards */}
                  <div className="flex-1 p-2 space-y-2">
                    {dayShifts.map((shift) => {
                      const shiftEmployeeId = shift.employee_id ?? (typeof (shift as any).employee === 'string' ? (shift as any).employee : (shift as any).employee?.id);
                      const employeeName = getEmployeeName(shiftEmployeeId || '');
                      const employee = employees.find(e => e.id === shiftEmployeeId);

                      return (
                        <div
                          key={shift.id}
                          draggable={canManageShifts && isEditMode}
                          onDragStart={(e) => {
                              const empId = shift.employee_id ?? (typeof (shift as any).employee === 'string' ? (shift as any).employee : (shift as any).employee?.id) ?? '';
                              if (isEditMode) onDragStart(e, empId, shift);
                            }}
                          onDragEnd={onDragEnd}
                          onClick={() => canManageShifts && isEditMode && onShiftClick(shift)}
                          className={cn(
                            "rounded-xl p-4 cursor-pointer transition-all relative group/shift shadow-sm",
                            getShiftColor(shift),
                            isEditMode && "hover:opacity-90 hover:shadow-md"
                          )}
                        >
                          {/* Time range */}
                          <div className="font-bold text-base mb-2 tracking-wide">
                            {formatShiftTime(shift)}
                          </div>

                          {/* Employee name with reassign dropdown */}
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7">
                              <AvatarFallback 
                                className="text-[10px] font-semibold"
                                style={{ 
                                  backgroundColor: getTeamColor((employee as any)?.team_id),
                                  color: 'white'
                                }}
                              >
                                {employeeName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            {canManageShifts && isEditMode && onReassignShift ? (
                              <Select
                                value={shiftEmployeeId || UNASSIGNED_SELECT_VALUE}
                                onValueChange={(newEmpId) => {
                                  if (newEmpId === UNASSIGNED_SELECT_VALUE) return;
                                  if (newEmpId !== shiftEmployeeId) {
                                    onReassignShift(shift.id, newEmpId);
                                  }
                                }}
                              >
                                <SelectTrigger 
                                  className="h-7 px-2 text-sm font-medium border-0 bg-transparent text-inherit hover:bg-black/10 rounded-md w-auto min-w-0 flex-1 [&>svg]:text-inherit [&>svg]:opacity-70"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <SelectValue>{employeeName}</SelectValue>
                                </SelectTrigger>
                                <SelectContent className="bg-popover border shadow-lg z-50">
                                  <SelectItem value={UNASSIGNED_SELECT_VALUE}>Unassigned</SelectItem>
                                  {employees.filter((emp) => emp.id).map((emp) => (
                                    <SelectItem key={emp.id} value={emp.id}>
                                      {emp.first_name} {emp.last_name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <span className="text-sm font-medium truncate">{employeeName}</span>
                            )}
                          </div>

                          {shift.notes && (
                            <div className="text-xs opacity-80 truncate mt-2">
                              {shift.notes}
                            </div>
                          )}

                          {shift.replacement_employee_id && (
                            <div className="text-xs opacity-80 mt-1 flex items-center gap-1">
                              <Users className="h-3 w-3" /> Replacement assigned
                            </div>
                          )}

                          {/* Delete button - only in edit mode */}
                          {canManageShifts && isEditMode && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute top-1.5 right-1.5 h-6 w-6 opacity-0 group-hover/shift:opacity-100 bg-black/20 hover:bg-destructive/20 hover:bg-opacity-100"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteShift(shift.id);
                              }}
                              title="Delete shift"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      );
                    })}

                    {/* Inline Add Shift Form - employee + preset + time + create */}
                    {inlineForm && inlineForm.dayIndex === dayIndex && !inlineForm.shiftCreated && (
                      <div
                        className="relative z-20 rounded-xl border-2 border-dashed border-primary/60 p-4 bg-card shadow-lg space-y-3"
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        <Select
                          value={inlineForm.employeeId}
                          onValueChange={(value) => setInlineForm({ ...inlineForm, employeeId: value })}
                        >
                          <SelectTrigger className="h-10 text-sm text-left bg-background [&>span]:truncate [&>span]:block [&>span]:text-left">
                            <SelectValue placeholder="Select employee" />
                          </SelectTrigger>
                          <SelectContent className="bg-popover border shadow-lg z-50">
                            {employees.map((emp) => (
                              <SelectItem key={emp.id} value={emp.id}>
                                {emp.first_name} {emp.last_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select value={inlineForm.selectedPreset} onValueChange={handlePresetChange}>
                          <SelectTrigger className="h-10 text-sm text-left bg-background [&>span]:truncate [&>span]:block [&>span]:text-left">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-popover border shadow-lg z-50">
                            {presetShifts.map((preset) => (
                              <SelectItem key={preset.label} value={preset.label}>
                                {preset.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            type="time"
                            className="h-10 text-sm bg-background"
                            value={inlineForm.startTime}
                            onChange={(e) => setInlineForm({ ...inlineForm, startTime: e.target.value, selectedPreset: 'Custom' })}
                          />
                          <Input
                            type="time"
                            className="h-10 text-sm bg-background"
                            value={inlineForm.endTime}
                            onChange={(e) => setInlineForm({ ...inlineForm, endTime: e.target.value, selectedPreset: 'Custom' })}
                          />
                        </div>

                        <div className="flex gap-2 items-center">
                          <Button
                            type="button"
                            size="sm"
                            className="flex-1 h-10"
                            onClick={() => handleCreateShift()}
                            disabled={employees.length === 0 || (employees.length > 0 && !inlineForm.employeeId)}
                          >
                            <Check className="h-4 w-4 mr-1" /> Create Shift
                          </Button>
                          <button
                            type="button"
                            className="inline-flex items-center justify-center gap-1.5 h-10 px-3 rounded-md border border-input bg-background hover:bg-muted shrink-0 text-sm font-medium"
                            aria-label="Cancel"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              closeInlineForm();
                            }}
                            onPointerDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              closeInlineForm();
                            }}
                          >
                            <X className="h-4 w-4" /> Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Employee assignment - OUTSIDE the shift creation box, shown after shift created */}
                    {inlineForm && inlineForm.dayIndex === dayIndex && inlineForm.shiftCreated && (
                      <div className="space-y-2 p-3 rounded-lg bg-muted/40">
                        <p className="text-xs font-medium text-muted-foreground">Assign employee to shift ({inlineForm.startTime} - {inlineForm.endTime}):</p>
                        <Select onValueChange={handleAssignEmployee}>
                          <SelectTrigger className="h-10 text-sm text-left bg-background [&>span]:truncate [&>span]:block [&>span]:text-left">
                            <SelectValue placeholder="Select employee" />
                          </SelectTrigger>
                          <SelectContent className="bg-popover border shadow-lg z-50">
                            {employees.map((emp) => (
                              <SelectItem key={emp.id} value={emp.id}>
                                {emp.first_name} {emp.last_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full h-9 text-xs"
                          onClick={() => setInlineForm(null)}
                        >
                          Done
                        </Button>
                      </div>
                    )}

                    {/* Add Shift Button - only when edit mode is on */}
                    {canManageShifts && isEditMode && (inlineForm === null || inlineForm.dayIndex !== dayIndex) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full border-2 border-dashed border-muted-foreground/20 hover:border-primary hover:bg-primary/5 text-muted-foreground"
                        onClick={() => handleStartInlineForm(dayIndex)}
                      >
                        <Plus className="h-4 w-4 mr-1" /> Add Shift
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </TooltipProvider>
        </div>
      </div>

      {/* Weekly Summary Footer */}
      <div className="border-t bg-muted/30 p-3">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 font-medium text-sm">
            <span className="text-muted-foreground">
              {isEmployeeView ? 'My weekly summary' : 'Weekly summary'}
            </span>
          </div>
          <div className={cn(
            "flex-1 grid gap-4",
            isEmployeeView ? "grid-cols-2" : "grid-cols-5"
          )}>
            <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-md">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{isEmployeeView ? 'My Hours' : 'Hours'}</span>
              <span className="font-bold">{weeklyStats.hours}:00</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-md">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{isEmployeeView ? 'My Shifts' : 'Shifts'}</span>
              <span className="font-bold">{weeklyStats.shifts}</span>
            </div>
            {!isEmployeeView && (
              <>
                <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-md">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Users</span>
                  <span className="font-bold">{weeklyStats.users}</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-md">
                  <span className="text-sm text-muted-foreground">Labor</span>
                  <span className="font-bold">--</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-md">
                  <span className="text-sm text-muted-foreground">Sales</span>
                  <span className="font-bold">--</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
