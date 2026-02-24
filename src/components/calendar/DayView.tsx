import { format, isToday } from "date-fns";
import { cn } from "@/lib/utils";
import { getUserColor, getPriorityOverlay } from "@/utils/userColors";
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

interface DayViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onTimeSlotClick: (hour: number) => void;
  onEditEvent?: (event: CalendarEvent) => void;
  onDeleteEvent?: (eventId: string) => void;
  onToggleComplete?: (eventId: string, currentStatus: boolean) => void;
  onUserEventClick?: (userId: string) => void;
  getUserName?: (userId: string) => string;
  /** When true, shifts are not shown as OVERDUE (employee is clocked in). */
  isClockedIn?: boolean;
}

export const DayView = ({ currentDate, events, onTimeSlotClick, onEditEvent, onDeleteEvent, onToggleComplete, onUserEventClick, getUserName, isClockedIn }: DayViewProps) => {
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const getEventsForHour = (hour: number) => {
    return events.filter(event => {
      const eventStart = new Date(event.start_time);
      const eventEnd = new Date(event.end_time);
      const isSameDay = eventStart.toDateString() === currentDate.toDateString();
      
      // Show event if it starts in this hour OR spans through this hour
      const eventStartHour = eventStart.getHours();
      const eventEndHour = eventEnd.getHours();
      
      return isSameDay && eventStartHour <= hour && hour <= eventEndHour;
    });
  };

  const getEventPosition = (event: CalendarEvent) => {
    const eventStart = new Date(event.start_time);
    const eventEnd = new Date(event.end_time);
    const startHour = eventStart.getHours();
    const startMinutes = eventStart.getMinutes();
    const durationMs = eventEnd.getTime() - eventStart.getTime();
    const durationHours = durationMs / (1000 * 60 * 60);
    
    // Calculate position from top of hour slot (each hour = 80px)
    const minuteOffset = (startMinutes / 60) * 80;
    const height = Math.max(20, durationHours * 80);
    
    return { minuteOffset, height };
  };

  const getOverlappingEvents = (hour: number) => {
    const hourEvents = getEventsForHour(hour);
    
    // Sort events by start time for consistent positioning
    const sortedEvents = hourEvents.sort((a, b) => 
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
    const userColor = getUserColor(event.user_id);
    const priorityOverlay = getPriorityOverlay(event.priority, isOverdue);
    return `${userColor} ${priorityOverlay}`;
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
      <div className="p-4 bg-muted border-b">
        <div className="text-sm text-muted-foreground">{format(currentDate, "EEEE")}</div>
        <div className={cn(
          "text-2xl font-bold",
          isToday(currentDate) && "text-primary"
        )}>
          {format(currentDate, "MMMM d, yyyy")}
        </div>
      </div>

      {/* Time slots */}
      <div className="max-h-[600px] overflow-y-auto">
        {hours.map((hour) => {
          const hourEvents = getEventsForHour(hour);
          return (
            <div key={hour} className="flex border-b border-border">
              <div className="w-20 p-3 text-xs text-muted-foreground text-right bg-muted/50 border-r">
                {format(new Date().setHours(hour, 0, 0, 0), "h a")}
              </div>
              <div
                className="flex-1 min-h-[80px] p-2 hover:bg-muted/30 cursor-pointer transition-colors relative"
                onClick={() => onTimeSlotClick(hour)}
              >
                {getOverlappingEvents(hour).map(({ event, overlappingCount, position }) => {
                  const isOverdue = isEventOverdue(event);
                  const { minuteOffset, height } = getEventPosition(event);
                  const startHour = new Date(event.start_time).getHours();
                  
                  // Only render the event in its starting hour to avoid duplicates
                  if (startHour !== hour) return null;
                  
                  // Calculate width and position for side-by-side display
                  const width = overlappingCount > 1 ? `${95 / overlappingCount}%` : '95%';
                  const leftOffset = overlappingCount > 1 ? `${(position * 95) / overlappingCount + 2}%` : '2%';
                  
                  return (
                    <div
                      key={event.id}
                      className={cn(
                        "p-2 rounded text-gray-800 cursor-pointer hover:opacity-80 absolute z-10 border border-gray-300 overflow-hidden",
                        getEventStyling(event, isOverdue)
                      )}
                      style={{ 
                        height: `${Math.max(height, 25)}px`,
                        top: `${minuteOffset}px`,
                        width: width,
                        left: leftOffset,
                        right: 'auto',
                        zIndex: 10 + position // Ensure proper layering
                      }}
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
                      <div className="flex items-center justify-between">
                        <span className={cn("font-medium", event.completed && "line-through opacity-60")}>{event.title}</span>
                        <div className="flex items-center gap-1">
                          {getUserName && (
                            <span className="text-xs opacity-75">
                              {getUserName(event.user_id)}
                            </span>
                          )}
                          <Button
                            size="icon"
                            variant={event.completed ? "default" : "secondary"}
                            className={cn(
                              "h-6 w-6 flex-shrink-0 bg-white/90 hover:bg-white border border-gray-300 shadow-sm",
                              event.completed && "bg-green-500 border-green-500 text-white hover:bg-green-600"
                            )}
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleComplete?.(event.id, event.completed);
                            }}
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="text-xs opacity-75 mt-1">
                        {event.priority} priority{isOverdue ? ' - OVERDUE' : ''}{event.completed ? ' - COMPLETED' : ''}
                      </div>
                      {event.description && (
                        <div className="text-xs opacity-90 mt-1">{event.description}</div>
                      )}
                      <div className="text-xs opacity-75 mt-1">
                        {format(new Date(event.start_time), "h:mm a")} - {format(new Date(event.end_time), "h:mm a")}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};