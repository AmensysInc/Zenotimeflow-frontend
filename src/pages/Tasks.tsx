import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Calendar, Clock, Flag, CheckSquare, Trash2, Filter, User, X, ChevronRight, List, Edit, Check, ChevronDown, BookOpen, AlertCircle, RefreshCw, Target, TrendingUp, Sparkles, Zap } from "lucide-react";
import { AdminTaskCard } from "@/components/AdminTaskCard";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import apiClient from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  start_time: string | null;
  end_time: string | null;
  all_day: boolean;
  event_type: string;
  created_at: string;
  user_id: string;
  created_by?: string;
  parent_task_id?: string | null;
  completed?: boolean | null;
  completed_at?: string | null;
  template_id?: string | null;
  notes?: string | null;
  files?: any;
  profiles?: {
    full_name: string | null;
    email: string;
  } | null;
  sub_tasks?: CalendarEvent[];
}

interface TeamMember {
  user_id: string;
  full_name: string | null;
  email: string;
}

interface TemplateTask {
  id: string;
  template_id: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  due_date: string;
  created_at: string;
}

interface LearningTemplate {
  id: string;
  name: string;
  description: string;
  technology: string;
}

interface TemplateWithTasks {
  template: LearningTemplate;
  tasks: TemplateTask[];
}

const Tasks = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<CalendarEvent[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [templatesWithTasks, setTemplatesWithTasks] = useState<TemplateWithTasks[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubTaskDialogOpen, setIsSubTaskDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [parentTaskForSubTask, setParentTaskForSubTask] = useState<CalendarEvent | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filters, setFilters] = useState({
    teamMember: "all",
    priority: "all",
    dateRange: "today", // Default to today's tasks
    taskType: "all",
    status: "pending", // Default to pending tasks only
  });

  // Helper variable for admin permissions - super_admin, operations_manager, and manager can assign tasks
  const isAdminUser = userRole === 'super_admin' || userRole === 'operations_manager' || userRole === 'manager';
  const [newEvent, setNewEvent] = useState({
    title: "",
    description: "",
    priority: "medium",
    start_time: "",
    end_time: "",
    all_day: false,
    event_type: "task",
    is_primary_task: false,
    assigned_user_id: "",
  });

  const [newSubTask, setNewSubTask] = useState({
    title: "",
    description: "",
    priority: "medium",
    start_time: "",
    end_time: "",
    all_day: false,
    event_type: "task",
    assigned_user_id: "",
  });

  useEffect(() => {
    if (user) {
      fetchUserRole();
    }
  }, [user]);

  useEffect(() => {
    if (user && userRole !== null) {
      fetchEvents();
      const cleanup = setupRealtimeSubscription();
      if (userRole === 'user') {
        fetchUserTemplateTasks();
      }
      
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          console.log('Page became visible, refreshing tasks...');
          refreshData();
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      return () => {
        cleanup();
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [user, userRole]);

  useEffect(() => {
    if (userRole === 'super_admin' || userRole === 'operations_manager' || userRole === 'manager') {
      fetchTeamMembers();
    }
  }, [userRole]);

  useEffect(() => {
    applyFilters();
  }, [events, filters]);

  const setupRealtimeSubscription = () => {
    // Real-time subscriptions removed - can be added back with WebSocket support later
    return () => {};
  };

  const refreshData = async () => {
    console.log('Refreshing all task data...');
    await fetchEvents();
    if (userRole === 'user') {
      await fetchUserTemplateTasks();
    }
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await refreshData();
    toast({
      title: "Refreshed",
      description: "Task data has been refreshed",
    });
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const fetchUserRole = async () => {
    if (!user) {
      console.log("No user found for role fetch");
      return;
    }
    
    console.log("Fetching user role for:", user.id);
    
    try {
      const userData = await apiClient.getCurrentUser() as any;
      const roles = userData?.roles || [];
      const roleNames = roles.map((r: any) => r.role);
      
      if (roleNames.includes('super_admin')) {
        setUserRole('super_admin');
      } else if (roleNames.includes('operations_manager')) {
        setUserRole('operations_manager');
      } else if (roleNames.includes('manager')) {
        setUserRole('manager');
      } else if (roleNames.includes('employee')) {
        setUserRole('employee');
      } else {
        setUserRole('user');
      }
    } catch (error) {
      console.error('Error fetching user role:', error);
      setUserRole('user');
    }
  };

  const fetchEvents = async () => {
    if (!user || userRole === null) return;
    
    const params: any = { event_type: 'task' };
    
    // Role-based task filtering:
    // - Super Admin: sees all tasks (for management purposes)
    // - Organization Manager: sees tasks assigned to them (by super admin)
    // - Company Manager: sees tasks assigned to them (by super admin or org manager)
    // - Employee: sees tasks assigned to them (by their company manager)
    // - User: sees only their own tasks
    
    if (userRole === 'super_admin') {
      // Super admins see all tasks without template_id
      // No user filter needed
    } else {
      // All other roles see tasks assigned to them
      params.user = user.id;
    }
    
    const eventsData = await apiClient.get<CalendarEvent[]>('/calendar/events/', params);

    // Get user profiles for display (if needed)
    // Note: User info might already be included in the response

    const eventsWithProfiles = eventsData || [];

    const primaryTasks = eventsWithProfiles.filter(event => !event.parent_task_id);
    const subTasks = eventsWithProfiles.filter(event => event.parent_task_id);

    const tasksWithSubTasks = primaryTasks.map(task => ({
      ...task,
      sub_tasks: subTasks.filter(subTask => subTask.parent_task_id === task.id)
    }));

    setEvents(tasksWithSubTasks);
    setIsLoading(false);
  };

  const fetchTeamMembers = async () => {
    if (userRole !== 'super_admin' && userRole !== 'operations_manager' && userRole !== 'manager') return;
    
    try {
      // Fetch all users (Django will handle role-based filtering)
      const users = await apiClient.get<any[]>('/auth/users/');
      
      // Filter users with valid roles
      const teamMembersData = users
        .filter((u: any) => {
          const roles = u.roles || [];
          const roleNames = roles.map((r: any) => r.role);
          return roleNames.some((role: string) => 
            ['operations_manager', 'manager', 'employee', 'house_keeping', 'maintenance'].includes(role)
          );
        })
        .map((u: any) => ({
          user_id: u.id,
          full_name: u.profile?.full_name || u.full_name || null,
          email: u.email
        }));

      setTeamMembers(teamMembersData);
    } catch (error) {
      console.error("Error fetching team members:", error);
        setTeamMembers([]);
      } else {
        setTeamMembers(data || []);
      }
    } else if (userRole === 'operations_manager') {
      // Organization managers can assign tasks to company managers within their organization
      const companies = await apiClient.get<any[]>('/scheduler/companies/', { operations_manager: user?.id });
      const managerIds = companies?.map(c => c.company_manager || c.company_manager_id).filter(Boolean) || [];
      
      if (managerIds.length > 0) {
        const users = await apiClient.get<any[]>('/auth/users/');
        const teamMembersData = users
          .filter((u: any) => managerIds.includes(u.id))
          .map((u: any) => ({
            user_id: u.id,
            full_name: u.profile?.full_name || u.full_name || null,
            email: u.email
          }));
        setTeamMembers(teamMembersData);
      } else {
        setTeamMembers([]);
      }
    } else if (userRole === 'manager') {
      // Company managers see their company employees with active status
      const companies = await apiClient.get<any[]>('/scheduler/companies/', { company_manager: user?.id });
      const companyIds = companies.map(c => c.id);
      
      if (companyIds.length > 0) {
        const allEmployees: any[] = [];
        for (const companyId of companyIds) {
          const employees = await apiClient.get<any[]>('/scheduler/employees/', { company: companyId, status: 'active' });
          allEmployees.push(...employees);
        }
        
        const teamMembersData = allEmployees
          .filter(emp => emp.user || emp.user_id)
          .map(emp => ({
            user_id: emp.user || emp.user_id,
            full_name: `${emp.first_name} ${emp.last_name}`.trim(),
            email: emp.email
          }));
        
        setTeamMembers(teamMembersData);
      } else {
        setTeamMembers([]);
      }
    }
  };

  const applyFilters = () => {
    let filtered = [...events];

    if (filters.taskType && filters.taskType !== "all") {
      switch (filters.taskType) {
        case "template":
          filtered = filtered.filter(event => event.template_id !== null);
          break;
        case "admin_assigned":
          if (userRole === 'user') {
            filtered = filtered.filter(event => 
              event.template_id === null && 
              event.user_id === user?.id &&
              event.created_by !== event.user_id
            );
          } else {
            filtered = filtered.filter(event => 
              event.template_id === null && 
              event.user_id !== user?.id &&
              event.created_by === user?.id
            );
          }
          break;
        case "personal":
          if (userRole === 'user') {
            filtered = filtered.filter(event => 
              event.template_id === null &&
              event.user_id === user?.id &&
              event.created_by === event.user_id
            );
          } else {
            filtered = filtered.filter(event => 
              event.template_id === null &&
              event.user_id === user?.id &&
              event.created_by === user?.id
            );
          }
          break;
      }
    }

    if (filters.status && filters.status !== "all") {
      switch (filters.status) {
        case "completed":
          filtered = filtered.filter(event => event.completed === true);
          break;
        case "pending":
          filtered = filtered.filter(event => event.completed !== true);
          break;
      }
    }

    if (userRole === 'super_admin' || userRole === 'manager') {
      if (filters.teamMember && filters.teamMember !== "all") {
        filtered = filtered.filter(event => event.user_id === filters.teamMember);
      }

      if (filters.priority && filters.priority !== "all") {
        filtered = filtered.filter(event => event.priority === filters.priority);
      }
    }

    if (filters.dateRange && filters.dateRange !== "all") {
      const today = new Date();
      const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      
      switch (filters.dateRange) {
        case "today":
          filtered = filtered.filter(event => {
            const eventDate = new Date(event.start_time);
            const startOfEventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
            return startOfEventDay.getTime() === startOfToday.getTime();
          });
          break;
        case "week":
          const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
          filtered = filtered.filter(event => {
            const eventDate = new Date(event.start_time);
            return eventDate >= today && eventDate <= weekFromNow;
          });
          break;
        case "month":
          const monthFromNow = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());
          filtered = filtered.filter(event => {
            const eventDate = new Date(event.start_time);
            return eventDate >= today && eventDate <= monthFromNow;
          });
          break;
      }
    }

    setFilteredEvents(filtered);
  };

  const createEvent = async () => {
    if (!newEvent.title.trim()) {
      toast({
        title: "Title required",
        description: "Please enter an event title",
        variant: "destructive",
      });
      return;
    }

    const eventData = {
      title: newEvent.title,
      description: newEvent.description || null,
      priority: newEvent.priority,
      start_time: newEvent.start_time ? new Date(newEvent.start_time).toISOString() : new Date().toISOString(),
      end_time: newEvent.end_time ? new Date(newEvent.end_time).toISOString() : (newEvent.start_time ? new Date(newEvent.start_time).toISOString() : new Date().toISOString()),
      all_day: newEvent.all_day,
      event_type: newEvent.event_type,
      user_id: (isAdminUser && newEvent.assigned_user_id && newEvent.assigned_user_id !== "self") ? newEvent.assigned_user_id : user?.id,
      created_by: user?.id,
    };

    try {
      const insertedTask = await apiClient.post<CalendarEvent>('/calendar/events/', eventData);
      toast({
        title: "Task created successfully!",
        description: newEvent.title,
      });
      
      setNewEvent({
        title: "",
        description: "",
        priority: "medium",
        start_time: "",
        end_time: "",
        all_day: false,
        event_type: "task",
        is_primary_task: false,
        assigned_user_id: "",
      });
      setIsDialogOpen(false);
      fetchEvents();
    } catch (error: any) {
      toast({
        title: "Error creating event",
        description: error.message || "Failed to create task",
        variant: "destructive",
      });
    }
  };

  const fetchUserTemplateTasks = async () => {
    if (!user || userRole !== 'user') return;
    
    try {
      // Note: Template assignments and tasks may need to be implemented in Django backend
      // For now, return empty array
      setTemplatesWithTasks([]);
      setTemplatesLoading(false);
      return;

      // TODO: Implement template assignments API in Django
      // const assignments = await apiClient.get('/tasks/template-assignments/', { user: user.id });
      // const templatesData = await Promise.all(...);

      const validTemplatesData = templatesData.filter(item => item !== null) as TemplateWithTasks[];
      setTemplatesWithTasks(validTemplatesData);
    } catch (error) {
      console.error('Error in fetchUserTemplateTasks:', error);
    } finally {
      setTemplatesLoading(false);
    }
  };

  // AdminTaskCard callback functions
  const toggleTaskComplete = async (taskId: string, currentCompleted: boolean) => {
    try {
      const newCompleted = !currentCompleted;
      
      await apiClient.patch(`/calendar/events/${taskId}/`, {
        completed: newCompleted,
        completed_at: newCompleted ? new Date().toISOString() : null
      });

      toast({
        title: "Task updated",
        description: `Task marked as ${newCompleted ? 'completed' : 'pending'}`,
          variant: "destructive",
        });
      } else {
        // Update local state immediately for better UX
        setEvents(prevEvents => 
          prevEvents.map(event => 
            event.id === taskId 
              ? { ...event, completed: newCompleted, completed_at: newCompleted ? new Date().toISOString() : null }
              : event
          )
        );
        
        toast({
          title: newCompleted ? "Task completed!" : "Task reopened",
          description: "Task status updated successfully",
        });
      }
    } catch (error) {
      console.error('Error toggling task completion:', error);
    }
  };

  const openSubTaskDialog = (parentTask: CalendarEvent) => {
    setParentTaskForSubTask(parentTask);
    setIsSubTaskDialogOpen(true);
  };

  const openEditDialog = (task: CalendarEvent) => {
    setSelectedEvent(task);
    setIsEditDialogOpen(true);
  };

  const openDetailDialog = (task: CalendarEvent) => {
    setSelectedEvent(task);
    setIsDetailDialogOpen(true);
  };

  const updateTaskNotes = async (taskId: string, notes: string, files?: string[]) => {
    try {
      await apiClient.patch(`/calendar/events/${taskId}/`, {
        notes,
        files: files || []
      });

      toast({
        title: "Notes updated",
          description: error.message,
          variant: "destructive",
        });
      } else {
        await fetchEvents();
        toast({
          title: "Notes updated",
          description: "Task notes saved successfully",
        });
      }
    } catch (error) {
      console.error('Error updating task notes:', error);
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      await apiClient.delete(`/calendar/events/${taskId}/`);

      toast({
        title: "Task deleted",
        description: "Task removed successfully",
      });
        await fetchEvents();
        toast({
          title: "Task deleted",
          description: "Task removed successfully",
        });
      }
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const createSubTask = async () => {
    if (!newSubTask.title.trim() || !parentTaskForSubTask) {
      toast({
        title: "Title required",
        description: "Please enter a sub-task title",
        variant: "destructive",
      });
      return;
    }

    const subTaskData = {
      title: newSubTask.title,
      description: newSubTask.description || null,
      priority: newSubTask.priority,
      start_time: newSubTask.start_time ? new Date(newSubTask.start_time).toISOString() : new Date().toISOString(),
      end_time: newSubTask.end_time ? new Date(newSubTask.end_time).toISOString() : (newSubTask.start_time ? new Date(newSubTask.start_time).toISOString() : new Date().toISOString()),
      all_day: newSubTask.all_day,
      event_type: newSubTask.event_type,
      parent_task_id: parentTaskForSubTask.id,
      user_id: (isAdminUser && newSubTask.assigned_user_id && newSubTask.assigned_user_id !== "self") ? newSubTask.assigned_user_id : parentTaskForSubTask.user_id,
      created_by: user?.id,
    };

    try {
      await apiClient.post('/calendar/events/', subTaskData);
      toast({
        title: "Sub-task created successfully!",
        description: newSubTask.title,
      });
      
      setNewSubTask({
        title: "",
        description: "",
        priority: "medium",
        start_time: "",
        end_time: "",
        all_day: false,
        event_type: "task",
        assigned_user_id: "",
      });
      setIsSubTaskDialogOpen(false);
      setParentTaskForSubTask(null);
      fetchEvents();
    } catch (error: any) {
      toast({
        title: "Error creating sub-task",
        description: error.message || "Failed to create sub-task",
        variant: "destructive",
      });
    }
  };

  const updateEvent = async (event: CalendarEvent | null) => {
    if (!event) return;

    try {
      await apiClient.patch(`/calendar/events/${event.id}/`, {
        title: event.title,
        description: event.description,
        priority: event.priority,
        start_time: event.start_time,
        end_time: event.end_time,
        all_day: event.all_day,
      });

      toast({
        title: "Task updated",
        description: "Task updated successfully",
      });
        await fetchEvents();
        setIsEditDialogOpen(false);
        setSelectedEvent(null);
        toast({
          title: "Task updated",
          description: "Task updated successfully",
        });
      }
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  if (isLoading) {
    console.log("Tasks page loading...", { user, userRole });
    return (
      <div className="flex items-center justify-center h-96 bg-gradient-to-br from-background via-background/95 to-primary/5">
        <div className="relative">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Target className="w-8 h-8 text-primary animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-primary/5 animate-fade-in">
      {/* Compact Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-border/50 backdrop-blur-sm">
        <div className="relative px-6 py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 backdrop-blur-sm border border-primary/20">
                <Target className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-foreground via-foreground/90 to-foreground/70 bg-clip-text text-transparent">
                  Tasks
                </h1>
                <p className="text-sm text-muted-foreground/80">
                  Manage your tasks and events in one place
                </p>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant="outline"
                size="sm"
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="bg-background/80 backdrop-blur-sm border-border/50"
              >
                <RefreshCw className={`w-4 h-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-gradient-to-r from-primary to-primary/80">
                    <Plus className="mr-1 h-4 w-4" />
                    New Task
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Create New Task</DialogTitle>
                    <DialogDescription>
                      Add a new task to your calendar. Fill in the details below.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    {isAdminUser && (
                      <div className="grid gap-2">
                        <Label>Assign to User</Label>
                        <Select
                          value={newEvent.assigned_user_id}
                          onValueChange={(value) => setNewEvent({ ...newEvent, assigned_user_id: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Assign to myself" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="self">Assign to myself</SelectItem>
                            {teamMembers.map((member) => (
                              <SelectItem key={member.user_id} value={member.user_id}>
                                {member.full_name} ({member.email})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="grid gap-2">
                      <Label htmlFor="title">Title *</Label>
                      <Input
                        id="title"
                        placeholder="Enter task title"
                        value={newEvent.title}
                        onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        placeholder="Enter task description"
                        value={newEvent.description}
                        onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="priority">Priority</Label>
                      <Select value={newEvent.priority} onValueChange={(value) => setNewEvent({ ...newEvent, priority: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="all-day"
                        checked={newEvent.all_day}
                        onCheckedChange={(checked) => setNewEvent({ ...newEvent, all_day: checked })}
                      />
                      <Label htmlFor="all-day">All day</Label>
                    </div>

                    {!newEvent.all_day && (
                      <>
                        <div className="grid gap-2">
                          <Label htmlFor="start-time">Start Time</Label>
                          <Input
                            id="start-time"
                            type="datetime-local"
                            value={newEvent.start_time}
                            onChange={(e) => setNewEvent({ ...newEvent, start_time: e.target.value })}
                          />
                        </div>

                        <div className="grid gap-2">
                          <Label htmlFor="end-time">End Time</Label>
                          <Input
                            id="end-time"
                            type="datetime-local"
                            value={newEvent.end_time}
                            onChange={(e) => setNewEvent({ ...newEvent, end_time: e.target.value })}
                          />
                        </div>
                      </>
                    )}
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={createEvent}>Create Task</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-6 space-y-6">
        {/* Compact Filters */}
        <Card className="border shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Filters:</span>
                {(filters.status !== 'pending' || filters.dateRange !== 'today' || filters.taskType !== 'all' || filters.priority !== 'all' || filters.teamMember !== 'all') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFilters({
                      teamMember: "all",
                      priority: "all",
                      dateRange: "all",
                      taskType: "all",
                      status: "all",
                    })}
                    className="h-7 px-2"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Clear
                  </Button>
                )}
              </div>
              
              <div className="flex items-center gap-2 flex-wrap flex-1 justify-end">
                <Select value={filters.taskType} onValueChange={(value) => setFilters({ ...filters, taskType: value })}>
                  <SelectTrigger className="h-8 w-32 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tasks</SelectItem>
                    <SelectItem value="personal">Personal</SelectItem>
                    <SelectItem value="admin_assigned">Admin Assigned</SelectItem>
                    <SelectItem value="template">Template</SelectItem>
                  </SelectContent>
                </Select>

                {isAdminUser && (
                  <Select value={filters.teamMember} onValueChange={(value) => setFilters({ ...filters, teamMember: value })}>
                    <SelectTrigger className="h-8 w-32 text-xs">
                      <SelectValue placeholder="Team Member" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Members</SelectItem>
                      {teamMembers.map((member) => (
                        <SelectItem key={member.user_id} value={member.user_id}>
                          {member.full_name || member.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <Select value={filters.priority} onValueChange={(value) => setFilters({ ...filters, priority: value })}>
                  <SelectTrigger className="h-8 w-32 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filters.dateRange} onValueChange={(value) => setFilters({ ...filters, dateRange: value })}>
                  <SelectTrigger className="h-8 w-32 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Dates</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="week">This Week</SelectItem>
                    <SelectItem value="month">This Month</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filters.status} onValueChange={(value) => setFilters({ ...filters, status: value })}>
                  <SelectTrigger className="h-8 w-32 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tasks</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tasks Display */}
        {filteredEvents.length > 0 ? (
          <div className="space-y-4 animate-fade-in">
            {filteredEvents.map((event) => (
              <AdminTaskCard 
                key={event.id} 
                task={event}
                isAdmin={isAdminUser}
                onToggleComplete={toggleTaskComplete}
                onAddSubTask={openSubTaskDialog}
                onEditTask={openEditDialog}
                onViewDetails={openDetailDialog}
                onUpdateNotes={updateTaskNotes}
                onDeleteTask={deleteTask}
              />
            ))}
          </div>
        ) : (
          <Card className="border-0 shadow-2xl bg-gradient-to-br from-card/50 via-card/30 to-card/50 backdrop-blur-sm animate-scale-in">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-6 rounded-full bg-gradient-to-br from-muted/50 to-muted/30 mb-6">
                <List className="w-12 h-12 text-muted-foreground/60" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-muted-foreground">No tasks found</h3>
              <p className="text-muted-foreground/80 mb-6 max-w-md">
                {events.length === 0 
                  ? "Get started by creating your first task" 
                  : "Try adjusting your filters to see more tasks"
                }
              </p>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Task
                  </Button>
                </DialogTrigger>
              </Dialog>
            </CardContent>
          </Card>
        )}

        {/* Templates Section */}
        {userRole === 'user' && (
          <Card className="border-0 shadow-2xl bg-gradient-to-br from-card/80 via-card to-card/90 backdrop-blur-sm animate-fade-in">
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-3 bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/10 border border-emerald-500/20">
                  <BookOpen className="h-6 w-6 text-emerald-600" />
                </div>
                Templates
              </CardTitle>
              <CardDescription className="text-base">
                Track your progress on assigned templates
              </CardDescription>
            </CardHeader>
            <CardContent>
              {templatesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : templatesWithTasks.length > 0 ? (
                <div className="space-y-6">
                  {templatesWithTasks.map(({ template, tasks }) => {
                    // Filter to show only pending tasks by default
                    const pendingTasks = tasks.filter(task => task.status !== 'completed');
                    const completedCount = tasks.filter(task => task.status === 'completed').length;
                    
                    // Only show template if it has pending tasks
                    if (pendingTasks.length === 0) return null;
                    
                    return (
                      <div key={template.id} className="p-6 rounded-2xl bg-gradient-to-r from-background/50 to-background/30 border border-border/50 backdrop-blur-sm hover:shadow-lg transition-all duration-300">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h3 className="text-lg font-semibold">{template.name}</h3>
                            <p className="text-sm text-muted-foreground">{template.description}</p>
                            <Badge variant="outline" className="mt-2 bg-primary/10 text-primary border-primary/20">
                              {template.technology}
                            </Badge>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-primary">
                              {completedCount}/{tasks.length}
                            </div>
                            <div className="text-sm text-muted-foreground">Tasks Completed</div>
                            <div className="text-xs text-muted-foreground/70 mt-1">
                              {pendingTasks.length} pending
                            </div>
                          </div>
                        </div>
                        <Progress 
                          value={tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0} 
                          className="h-2 bg-muted/50"
                        />
                      </div>
                     );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <BookOpen className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                  <p className="text-muted-foreground">No templates assigned yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Sub Task Dialog */}
        <Dialog open={isSubTaskDialogOpen} onOpenChange={setIsSubTaskDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create Sub Task</DialogTitle>
              <DialogDescription>
                Add a sub-task to {parentTaskForSubTask?.title}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {isAdminUser && (
                <div className="grid gap-2">
                  <Label>Assign to User</Label>
                  <Select
                    value={newSubTask.assigned_user_id}
                    onValueChange={(value) => setNewSubTask({ ...newSubTask, assigned_user_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Same as parent task" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="self">Same as parent task</SelectItem>
                      {teamMembers.map((member) => (
                        <SelectItem key={member.user_id} value={member.user_id}>
                          {member.full_name} ({member.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="sub-title">Title *</Label>
                <Input
                  id="sub-title"
                  placeholder="Enter sub-task title"
                  value={newSubTask.title}
                  onChange={(e) => setNewSubTask({ ...newSubTask, title: e.target.value })}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="sub-description">Description</Label>
                <Textarea
                  id="sub-description"
                  placeholder="Enter sub-task description"
                  value={newSubTask.description}
                  onChange={(e) => setNewSubTask({ ...newSubTask, description: e.target.value })}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="sub-priority">Priority</Label>
                <Select value={newSubTask.priority} onValueChange={(value) => setNewSubTask({ ...newSubTask, priority: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="sub-all-day"
                  checked={newSubTask.all_day}
                  onCheckedChange={(checked) => setNewSubTask({ ...newSubTask, all_day: checked })}
                />
                <Label htmlFor="sub-all-day">All day</Label>
              </div>

              {!newSubTask.all_day && (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="sub-start-time">Start Time</Label>
                    <Input
                      id="sub-start-time"
                      type="datetime-local"
                      value={newSubTask.start_time}
                      onChange={(e) => setNewSubTask({ ...newSubTask, start_time: e.target.value })}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="sub-end-time">End Time</Label>
                    <Input
                      id="sub-end-time"
                      type="datetime-local"
                      value={newSubTask.end_time}
                      onChange={(e) => setNewSubTask({ ...newSubTask, end_time: e.target.value })}
                    />
                  </div>
                </>
              )}
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsSubTaskDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={createSubTask}>Create Sub Task</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Task Details Dialog */}
        <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle className="text-xl">{selectedEvent?.title}</DialogTitle>
            </DialogHeader>
            {selectedEvent && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Priority</Label>
                    <Badge variant={selectedEvent.priority === 'high' ? 'destructive' : selectedEvent.priority === 'medium' ? 'default' : 'secondary'} className="mt-1">
                      {selectedEvent.priority}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Status</Label>
                    <Badge variant={selectedEvent.completed ? 'default' : 'outline'} className="mt-1">
                      {selectedEvent.completed ? 'Completed' : 'Pending'}
                    </Badge>
                  </div>
                </div>

                {selectedEvent.description && (
                  <div>
                    <Label className="text-sm font-medium">Description</Label>
                    <p className="text-sm text-muted-foreground mt-1">{selectedEvent.description}</p>
                  </div>
                )}

                {selectedEvent.start_time && (
                  <div>
                    <Label className="text-sm font-medium">
                      {selectedEvent.all_day ? "Date" : "Start Time"}
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {selectedEvent.all_day 
                        ? format(new Date(selectedEvent.start_time), "MMMM dd, yyyy")
                        : format(new Date(selectedEvent.start_time), "MMMM dd, yyyy 'at' h:mm a")
                      }
                    </p>
                  </div>
                )}

                {!selectedEvent.all_day && selectedEvent.end_time && (
                  <div>
                    <Label className="text-sm font-medium">End Time</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {format(new Date(selectedEvent.end_time), "MMMM dd, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                )}

                {isAdminUser && selectedEvent.profiles && (
                  <div>
                    <Label className="text-sm font-medium">Assigned to</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {selectedEvent.profiles.full_name || selectedEvent.profiles.email}
                    </p>
                  </div>
                )}

                {selectedEvent.completed_at && (
                  <div>
                    <Label className="text-sm font-medium">Completed on</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {format(new Date(selectedEvent.completed_at), "MMMM dd, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                )}

                <div>
                  <Label className="text-sm font-medium">Created on</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {format(new Date(selectedEvent.created_at), "MMMM dd, yyyy 'at' h:mm a")}
                  </p>
                </div>

                {selectedEvent.notes && (
                  <div>
                    <Label className="text-sm font-medium">Notes</Label>
                    <p className="text-sm text-muted-foreground mt-1">{selectedEvent.notes}</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Task Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Edit Task</DialogTitle>
              <DialogDescription>
                Update the task details below.
              </DialogDescription>
            </DialogHeader>
            {selectedEvent && (
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-title">Title</Label>
                  <Input
                    id="edit-title"
                    value={selectedEvent.title}
                    onChange={(e) => setSelectedEvent({ ...selectedEvent, title: e.target.value })}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="edit-description">Description</Label>
                  <Textarea
                    id="edit-description"
                    value={selectedEvent.description || ""}
                    onChange={(e) => setSelectedEvent({ ...selectedEvent, description: e.target.value })}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="edit-priority">Priority</Label>
                  <Select value={selectedEvent.priority} onValueChange={(value) => setSelectedEvent({ ...selectedEvent, priority: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="edit-all-day"
                    checked={selectedEvent.all_day}
                    onCheckedChange={(checked) => setSelectedEvent({ ...selectedEvent, all_day: checked })}
                  />
                  <Label htmlFor="edit-all-day">All day</Label>
                </div>

                {!selectedEvent.all_day && (
                  <>
                    <div className="grid gap-2">
                      <Label htmlFor="edit-start-time">Start Time</Label>
                      <Input
                        id="edit-start-time"
                        type="datetime-local"
                        value={selectedEvent.start_time ? (() => {
                          const date = new Date(selectedEvent.start_time);
                          const year = date.getFullYear();
                          const month = String(date.getMonth() + 1).padStart(2, '0');
                          const day = String(date.getDate()).padStart(2, '0');
                          const hours = String(date.getHours()).padStart(2, '0');
                          const minutes = String(date.getMinutes()).padStart(2, '0');
                          return `${year}-${month}-${day}T${hours}:${minutes}`;
                        })() : ""}
                        onChange={(e) => setSelectedEvent({ ...selectedEvent, start_time: e.target.value ? new Date(e.target.value).toISOString() : "" })}
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="edit-end-time">End Time</Label>
                      <Input
                        id="edit-end-time"
                        type="datetime-local"
                        value={selectedEvent.end_time ? (() => {
                          const date = new Date(selectedEvent.end_time);
                          const year = date.getFullYear();
                          const month = String(date.getMonth() + 1).padStart(2, '0');
                          const day = String(date.getDate()).padStart(2, '0');
                          const hours = String(date.getHours()).padStart(2, '0');
                          const minutes = String(date.getMinutes()).padStart(2, '0');
                          return `${year}-${month}-${day}T${hours}:${minutes}`;
                        })() : ""}
                        onChange={(e) => setSelectedEvent({ ...selectedEvent, end_time: e.target.value ? new Date(e.target.value).toISOString() : "" })}
                      />
                    </div>
                  </>
                )}
              </div>
            )}
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => updateEvent(selectedEvent)}>
                Update Task
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Tasks;