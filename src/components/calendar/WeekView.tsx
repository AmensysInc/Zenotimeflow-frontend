import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isToday, eachHourOfInterval, startOfDay, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { getEventColor, getPriorityOverlay } from "@/utils/userColors";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  all_day: boolean;
  event_type: string;
  priority: string;
  created_at: string;
  user_id: string;
  completed: boolean;
}

interface WeekViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onTimeSlotClick: (date: Date, hour: number) => void;
  onEditEvent?: (event: CalendarEvent) => void;
  onDeleteEvent?: (eventId: string) => void;
  onToggleComplete?: (eventId: string, currentStatus: boolean) => void;
  onUserEventClick?: (userId: string) => void;
  getUserName?: (userId: string) => string;
  /** When true, shifts are not shown as OVERDUE (employee is clocked in). */
  isClockedIn?: boolean;
}

export const WeekView = ({ currentDate, events, onTimeSlotClick, onEditEvent, onDeleteEvent, onToggleComplete, onUserEventClick, getUserName, isClockedIn }: WeekViewProps) => {
  const weekStart = startOfWeek(currentDate);
  const weekEnd = endOfWeek(currentDate);
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
  
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const getEventsForTimeSlot = (date: Date, hour: number) => {
    return events.filter(event => {
      const eventStart = new Date(event.start_time);
      const eventEnd = new Date(event.end_time);
      
      // Show event if it starts in this hour OR spans through this hour
      const eventStartHour = eventStart.getHours();
      const eventEndHour = eventEnd.getHours();
      
      return isSameDay(eventStart, date) && 
             eventStartHour <= hour && hour <= eventEndHour;
    });
  };

  const getEventPosition = (event: CalendarEvent) => {
    const eventStart = new Date(event.start_time);
    const eventEnd = new Date(event.end_time);
    const startMinutes = eventStart.getMinutes();
    const durationMs = eventEnd.getTime() - eventStart.getTime();
    const durationHours = durationMs / (1000 * 60 * 60);
    
    // Calculate position from top of hour slot (each hour = 60px)
    const minuteOffset = (startMinutes / 60) * 60;
    const height = Math.max(15, durationHours * 60);
    
    return { minuteOffset, height };
  };

  const getOverlappingEvents = (date: Date, hour: number) => {
    const slotEvents = getEventsForTimeSlot(date, hour);
    
    // Sort events by start time for consistent positioning
    const sortedEvents = slotEvents.sort((a, b) => 
      new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );
    
    return sortedEvents.map((event, index) => {
      // Find truly overlapping events (time intersection)
      const overlapping = sortedEvents.filter((otherEvent) => {
        if (otherEvent.id === event.id) return false;
        const eventStart = new Date(event.start_time);
        const eventEnd = new Date(event.end_time);
        const otherStart = new Date(otherEvent.start_time);
        const otherEnd = new Date(otherEvent.end_time);
        
        // Check if times actually overlap
        return (eventStart < otherEnd && eventEnd > otherStart);
      });
      
      const totalOverlapping = overlapping.length + 1;
      
      return { 
        event, 
        overlappingCount: totalOverlapping, 
        position: index % totalOverlapping // Distribute positions evenly
      };
    });
  };

  const getEventStyling = (event: CalendarEvent, isOverdue: boolean) => {
    const eventColor = getEventColor(event.start_time, event.priority);
    const priorityOverlay = getPriorityOverlay(event.priority, isOverdue);
    return `${eventColor} ${priorityOverlay}`;
  };

  const isEventOverdue = (event: CalendarEvent) => {
    if (event.event_type === 'shift' && isClockedIn) return false;
    const now = new Date();
    const eventDate = new Date(event.start_time);
    return eventDate < now && !event.all_day;
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-8 border-b">
        <div className="p-3 bg-muted"></div>
        {weekDays.map((day) => (
          <div key={day.toISOString()} className="p-3 text-center bg-muted border-l">
            <div className="text-sm text-muted-foreground">{format(day, "EEE")}</div>
            <div className={cn(
              "text-lg font-semibold",
              isToday(day) && "text-primary"
            )}>
              {format(day, "d")}
            </div>
          </div>
        ))}
      </div>

      {/* Time slots */}
      <div className="max-h-[600px] overflow-y-auto">
        {hours.map((hour) => (
          <div key={hour} className="grid grid-cols-8 border-b border-border">
            <div className="p-2 text-xs text-muted-foreground text-right bg-muted/50 border-r">
              {format(new Date().setHours(hour, 0, 0, 0), "h a")}
            </div>
            {weekDays.map((day) => {
              return (
                <div
                  key={`${day.toISOString()}-${hour}`}
                  className="min-h-[60px] p-1 border-l border-border hover:bg-muted/30 cursor-pointer transition-colors relative"
                  onClick={() => onTimeSlotClick(day, hour)}
                >
                  {getOverlappingEvents(day, hour).map(({ event, overlappingCount, position }) => {
                    const isOverdue = isEventOverdue(event);
                    const { minuteOffset, height } = getEventPosition(event);
                    const startHour = new Date(event.start_time).getHours();
                    
                    // Only render the event in its starting hour to avoid duplicates
                    if (startHour !== hour) return null;
                    
                    // Calculate width and position for side-by-side display
                    const width = overlappingCount > 1 ? `${95 / overlappingCount}%` : '95%';
                    const leftOffset = overlappingCount > 1 ? `${(position * 95) / overlappingCount + 1}%` : '1%';
                    
                    return (
                      <div
                        key={event.id}
                        className={cn(
                          "text-xs p-1 rounded text-gray-800 cursor-pointer hover:opacity-80 absolute z-10 border border-gray-200 overflow-hidden",
                          getEventStyling(event, isOverdue)
                        )}
                        style={{ 
                          height: `${Math.max(height, 20)}px`,
                          top: `${minuteOffset}px`,
                          width: width,
                          left: leftOffset,
                          right: 'auto',
                          zIndex: 10 + position // Ensure proper layering
                        }}
                        title={`${event.title} (${event.priority} priority)${isOverdue ? ' - OVERDUE' : ''}${getUserName && onUserEventClick ? ` - ${getUserName(event.user_id)}` : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onUserEventClick && e.ctrlKey) {
                            onUserEventClick(event.user_id);
                          } else {
                            onEditEvent?.(event);
                          }
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          onDeleteEvent?.(event.id);
                        }}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className={cn("truncate text-xs", event.completed && "line-through opacity-60")}>{event.title}</span>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {getUserName && (
                              <span className="text-xs opacity-75">
                                {getUserName(event.user_id)?.split(' ')[0] || 'User'}
                              </span>
                            )}
                            <Button
                              size="icon"
                              variant={event.completed ? "default" : "secondary"}
                              className={cn(
                                "h-5 w-5 bg-white/90 hover:bg-white border border-gray-300 shadow-sm",
                                event.completed && "bg-green-500 border-green-500 text-white hover:bg-green-600"
                              )}
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleComplete?.(event.id, event.completed);
                              }}
                            >
                              <Check className="h-2.5 w-2.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};