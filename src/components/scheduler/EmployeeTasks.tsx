import { useState, useEffect } from "react";
import { FileText, CheckCircle, Clock, AlertCircle, MoreHorizontal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
// Supabase removed - using Django API
import { format, parseISO, isPast, isToday } from "date-fns";
import { toast } from "sonner";

interface EmployeeTasksProps {
  userId: string;
}

type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export default function EmployeeTasks({ userId }: EmployeeTasksProps) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');

  const fetchTasks = async () => {
    setLoading(true);
    
    const tasks = await apiClient.get<any[]>('/calendar/events/', {
      user: userId,
      event_type: 'task'
    });
    setTasks(tasks.sort((a: any, b: any) => 
      new Date(a.start_time || 0).getTime() - new Date(b.start_time || 0).getTime()
    ));
    setLoading(false);
  };

  useEffect(() => {
    if (userId) {
      fetchTasks();
    }
  }, [userId]);

  const updateTaskStatus = async (taskId: string, newStatus: string, completed: boolean) => {
    try {
      const updates: any = { 
        event_type: newStatus === 'completed' ? 'task' : 'task',
        completed: completed 
      };
      
      if (completed) {
        updates.completed_at = new Date().toISOString();
      } else {
        updates.completed_at = null;
      }
      
      await apiClient.patch(`/calendar/events/${taskId}/`, updates);
      
      // Update local state
      setTasks(prev => prev.map(task => 
        task.id === taskId 
          ? { ...task, completed, completed_at: completed ? new Date().toISOString() : null }
          : task
      ));
      
      toast.success(`Task marked as ${completed ? 'completed' : 'pending'}`);
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('Failed to update task');
    }
  };

  const getStatusBadge = (task: any) => {
    if (task.completed) {
      return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" /> Completed</Badge>;
    }
    
    const dueDate = task.end_time ? parseISO(task.end_time) : null;
    if (dueDate && isPast(dueDate)) {
      return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" /> Overdue</Badge>;
    }
    if (dueDate && isToday(dueDate)) {
      return <Badge variant="default"><Clock className="h-3 w-3 mr-1" /> Due Today</Badge>;
    }
    
    return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return <Badge variant="destructive">High</Badge>;
      case 'medium':
        return <Badge variant="default">Medium</Badge>;
      case 'low':
        return <Badge variant="secondary">Low</Badge>;
      default:
        return null;
    }
  };

  const filteredTasks = tasks.filter(task => {
    if (filter === 'pending') return !task.completed;
    if (filter === 'completed') return task.completed;
    return true;
  });

  const pendingCount = tasks.filter(t => !t.completed).length;
  const completedCount = tasks.filter(t => t.completed).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            My Tasks
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge 
              variant={filter === 'all' ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => setFilter('all')}
            >
              All ({tasks.length})
            </Badge>
            <Badge 
              variant={filter === 'pending' ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => setFilter('pending')}
            >
              Pending ({pendingCount})
            </Badge>
            <Badge 
              variant={filter === 'completed' ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => setFilter('completed')}
            >
              Completed ({completedCount})
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading tasks...
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No tasks found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTasks.map((task) => (
              <div 
                key={task.id} 
                className={`flex items-center justify-between p-4 border rounded-lg transition-colors ${
                  task.completed ? 'bg-muted/50 opacity-70' : 'bg-card hover:bg-muted/50'
                }`}
              >
                <div className="flex items-start gap-4 flex-1">
                  <button
                    onClick={() => updateTaskStatus(task.id, task.completed ? 'pending' : 'completed', !task.completed)}
                    className={`mt-1 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                      task.completed 
                        ? 'bg-green-500 border-green-500 text-white' 
                        : 'border-muted-foreground hover:border-primary'
                    }`}
                  >
                    {task.completed && <CheckCircle className="h-4 w-4" />}
                  </button>
                  <div className="flex-1">
                    <h4 className={`font-medium ${task.completed ? 'line-through text-muted-foreground' : ''}`}>
                      {task.title}
                    </h4>
                    {task.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {task.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      {task.end_time && (
                        <span className="text-xs text-muted-foreground">
                          Due: {format(parseISO(task.end_time), 'MMM d, yyyy h:mm a')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getPriorityBadge(task.priority)}
                  {getStatusBadge(task)}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {!task.completed && (
                        <DropdownMenuItem onClick={() => updateTaskStatus(task.id, 'completed', true)}>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Mark Complete
                        </DropdownMenuItem>
                      )}
                      {task.completed && (
                        <DropdownMenuItem onClick={() => updateTaskStatus(task.id, 'pending', false)}>
                          <Clock className="h-4 w-4 mr-2" />
                          Mark Pending
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
