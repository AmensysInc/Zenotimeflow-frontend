import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isToday } from "date-fns";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { getUserColor, getPriorityOverlay } from "@/utils/userColors";

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
  completed?: boolean;
}

interface MonthViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onDateClick: (date: Date) => void;
  onEditEvent?: (event: CalendarEvent) => void;
  onDeleteEvent?: (eventId: string) => void;
  onUserEventClick?: (userId: string) => void;
  getUserName?: (userId: string) => string;
  /** When true, shifts are not shown as OVERDUE (employee is clocked in). */
  isClockedIn?: boolean;
}

export const MonthView = ({ currentDate, events, onDateClick, onEditEvent, onDeleteEvent, onUserEventClick, getUserName, isClockedIn }: MonthViewProps) => {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  
  const calendarDays = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd,
  });

  const getEventsForDate = (date: Date) => {
    return events.filter(event => {
      const eventDate = new Date(event.start_time);
      return isSameDay(eventDate, date);
    });
  };

  // Generate consistent colors for meetings based on event id for truly unique colors
  const getMeetingColor = (eventId: string) => {
    const colors = [
      'from-red-500 to-red-600', 
      'from-blue-500 to-blue-600', 
      'from-green-500 to-green-600', 
      'from-purple-500 to-purple-600',
      'from-orange-500 to-orange-600', 
      'from-pink-500 to-pink-600', 
      'from-indigo-500 to-indigo-600', 
      'from-teal-500 to-teal-600',
      'from-cyan-500 to-cyan-600',
      'from-emerald-500 to-emerald-600',
      'from-yellow-500 to-yellow-600',
      'from-rose-500 to-rose-600'
    ];
    
    // Create hash from event ID for consistent but unique color
    const hash = eventId.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
    return colors[Math.abs(hash) % colors.length];
  };

  const getEventStyling = (event: CalendarEvent, isOverdue: boolean) => {
    const baseClasses = "rounded-lg px-3 py-2 text-xs font-medium text-white shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105 cursor-pointer backdrop-blur-sm";
    
    // Handle completed events with strike-through
    const completedClasses = event.completed ? "line-through opacity-70" : "";
    
    if (event.event_type === 'meeting') {
      return `${baseClasses} bg-gradient-to-r ${getMeetingColor(event.id)} ${completedClasses}`;
    }
    
    if (isOverdue) {
      return `${baseClasses} bg-gradient-to-r from-red-500 to-red-600 ring-2 ring-red-200 ${completedClasses}`;
    }
    
    switch (event.priority) {
      case "urgent":
        return `${baseClasses} bg-gradient-to-r from-red-500 to-pink-500 ${completedClasses}`;
      case "high":
        return `${baseClasses} bg-gradient-to-r from-orange-500 to-red-500 ${completedClasses}`;
      case "medium":
        return `${baseClasses} bg-gradient-to-r from-blue-500 to-purple-500 ${completedClasses}`;
      case "low":
        return `${baseClasses} bg-gradient-to-r from-green-500 to-blue-500 ${completedClasses}`;
      default:
        return `${baseClasses} bg-gradient-to-r from-gray-500 to-gray-600 ${completedClasses}`;
    }
  };

  const isEventOverdue = (event: CalendarEvent) => {
    if (event.event_type === 'shift' && isClockedIn) return false;
    const now = new Date();
    const eventDate = new Date(event.start_time);
    return eventDate < now && !event.all_day;
  };

  return (
    <div className="bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-2xl shadow-xl overflow-hidden">
      <div className="grid grid-cols-7">
        {/* Header row */}
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, idx) => (
          <div key={day} className="bg-gradient-to-r from-gray-50 to-gray-100/50 border-b border-gray-200/60 p-4 text-center font-semibold text-gray-700 text-sm tracking-wide">
            {day}
          </div>
        ))}
        
        {/* Calendar grid */}
        {calendarDays.map((date, index) => {
          const dayEvents = getEventsForDate(date);
          const isCurrentMonth = isSameMonth(date, currentDate);
          const isCurrentDay = isToday(date);
          
          return (
            <div
              key={index}
              className={cn(
                "min-h-[130px] p-3 border-b border-r border-gray-100/50 hover:bg-gradient-to-br hover:from-blue-50/50 hover:to-purple-50/50 cursor-pointer transition-all duration-300 relative group",
                !isCurrentMonth && "bg-gray-50/30 text-gray-400",
                isCurrentDay && "bg-gradient-to-br from-blue-50 to-purple-50 ring-2 ring-blue-200/50"
              )}
              onClick={() => onDateClick(date)}
            >
              <div className={cn(
                "text-sm font-bold mb-3 w-8 h-8 flex items-center justify-center rounded-full transition-all duration-300",
                isCurrentDay 
                  ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg transform scale-110" 
                  : "hover:bg-gray-100 group-hover:scale-105"
              )}>
                {format(date, "d")}
              </div>
              
              <div className="space-y-1.5">
                {dayEvents.slice(0, 3).map((event) => {
                  const isOverdue = isEventOverdue(event);
                  return (
                    <div
                      key={event.id}
                      className={cn(
                        getEventStyling(event, isOverdue),
                        "truncate"
                      )}
                      title={`${event.title} (${event.priority} priority)${isOverdue ? ' - OVERDUE' : ''}${event.completed ? ' - COMPLETED' : ''}${getUserName && onUserEventClick ? ` - ${getUserName(event.user_id)}` : ''}`}
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
                        <span className={cn("truncate flex-1 font-medium", event.completed && "line-through")}>
                          {event.title}
                        </span>
                        {getUserName && (
                          <span className="text-xs opacity-90 ml-2 bg-white/20 px-2 py-0.5 rounded-full">
                            {getUserName(event.user_id)?.split(' ')[0] || 'User'}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {dayEvents.length > 3 && (
                  <div className="text-xs text-gray-600 font-medium bg-gray-100/80 rounded-lg px-2 py-1 text-center backdrop-blur-sm">
                    +{dayEvents.length - 3} more events
                  </div>
                )}
              </div>
              
              {/* Hover effect overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg pointer-events-none" />
            </div>
          );
        })}
      </div>
    </div>
  );
};