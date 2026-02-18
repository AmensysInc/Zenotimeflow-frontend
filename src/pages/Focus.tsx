import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Play, Pause, Square, Timer, Target, Brain, Users, FileText, ChevronDown, ChevronUp, Calendar, Plus, Filter } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import apiClient from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";

interface FocusSession {
  id: string;
  start_time: string;
  end_time: string | null;
  duration: number | null;
  productivity_score: number | null;
  interruptions: number;
  notes: string | null;
  created_at: string;
  title?: string;
  task_id?: string;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  created_by: string;
  user_id: string;
  event_type: string;
  start_time: string | null;
  end_time: string | null;
}

interface PlannedFocusSession {
  id: string;
  task_id: string | null;
  planned_date: string;
  planned_duration: number; // in minutes
  title: string;
  description: string | null;
  completed: boolean;
  user_id: string;
  created_at: string;
}

const Focus = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isActive, setIsActive] = useState(false);
  const [currentSession, setCurrentSession] = useState<FocusSession | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [notes, setNotes] = useState("");
  const [productivityScore, setProductivityScore] = useState(5);
  const [interruptions, setInterruptions] = useState(0);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [users, setUsers] = useState<Array<{ id: string; full_name: string; email: string }>>([]);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

  // New state for task-based focus sessions
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [plannedSessions, setPlannedSessions] = useState<PlannedFocusSession[]>([]);
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [showPlanDialog, setShowPlanDialog] = useState(false);
  
  // Filter states
  const [filterPeriod, setFilterPeriod] = useState<string>("week");
  const [filterType, setFilterType] = useState<string>("all");
  
  // Planning form states
  const [planTitle, setPlanTitle] = useState("");
  const [planDescription, setPlanDescription] = useState("");
  const [planDate, setPlanDate] = useState("");
  const [planDuration, setPlanDuration] = useState("25");
  const [planTaskId, setPlanTaskId] = useState("");

  useEffect(() => {
    if (user) {
      const initializeData = async () => {
        await checkUserRole();
        await Promise.all([
          fetchSessions(),
          fetchTasks(),
          fetchPlannedSessions()
        ]);
      };
      initializeData();
    }
  }, [user, selectedUserId]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isActive) {
      interval = setInterval(() => {
        setSeconds(seconds => seconds + 1);
      }, 1000);
    } else if (!isActive && seconds !== 0) {
      if (interval) clearInterval(interval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, seconds]);

  const checkUserRole = async () => {
    if (!user) return;

    try {
      const userData = await apiClient.getCurrentUser() as any;
      const roles = userData?.roles || [];
      const role = roles.length > 0 ? roles[0].role : 'user';
      
      console.log('User role set to:', role, 'for user:', user?.email);
      setUserRole(role);
      
      // Load users if manager
      if (role === 'manager' || role === 'super_admin') {
        await loadUsers();
      }
    } catch (error) {
      console.error('Error in checkUserRole:', error);
      setUserRole('user');
    }
  };

  const loadUsers = async () => {
    if (!user) return;

    try {
      const allUsers = await apiClient.get<any[]>('/auth/users/');
      const profiles = allUsers
        .filter((u: any) => u.id !== user.id && u.profile?.status !== 'deleted' && (u.profile?.status === 'active' || !u.profile?.status))
        .map((u: any) => ({ 
          id: u.id, 
          full_name: u.profile?.full_name || u.email || 'Unknown', 
          email: u.email || '' 
        }))
        .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));

      setUsers(profiles);
      console.log('Loaded users:', profiles.length);
      }
    } catch (error) {
      console.error('Error in loadUsers:', error);
    }
  };

  const fetchSessions = async () => {
    if (!user) return;

    const targetUserId = selectedUserId || user.id;
    
    const sessions = await apiClient.get<any[]>('/focus/sessions/', { 
      user: targetUserId 
    });
    setSessions(sessions.slice(0, 20));
    setIsLoading(false);
  };

  const fetchTasks = async () => {
    if (!user) return;

    const targetUserId = selectedUserId || user.id;
    
    const tasks = await apiClient.get<any[]>('/calendar/events/', { 
      user: targetUserId,
      event_type: 'task',
      completed: false
    });
    setTasks(tasks);
  };

  const fetchPlannedSessions = async () => {
    if (!user) return;
    
    // For now, we'll store planned sessions in focus_sessions with a special flag
    // or create a separate table. For simplicity, let's extend the current approach.
  };

  const startSession = async (taskId?: string) => {
    const selectedTask = taskId ? tasks.find(t => t.id === taskId) : null;
    const sessionTitle = selectedTask ? `Focus: ${selectedTask.title}` : "Focus Session";
    
    try {
      const data = await apiClient.post('/focus/sessions/', {
        title: sessionTitle,
        start_time: new Date().toISOString(),
        end_time: new Date(Date.now() + 25 * 60 * 1000).toISOString(), // 25 minutes default
        user: user?.id,
        interruptions: 0,
        productivity_score: 0,
        notes: "",
        task_id: taskId || null,
      });
      
      setCurrentSession(data);
      setIsActive(true);
      setSeconds(0);
      setInterruptions(0);
      setNotes("");
      setProductivityScore(5);
      setSelectedTaskId("");
      setShowTaskDialog(false);
      toast({
        title: "Focus session started",
        description: selectedTask ? `Working on: ${selectedTask.title}` : "Stay focused and productive!",
      });
    } catch (error: any) {
      toast({
        title: "Error starting session",
        description: error.message || "Failed to start session",
        variant: "destructive",
      });
    }
  };

  const startTaskFocusSession = () => {
    if (selectedTaskId) {
      startSession(selectedTaskId);
    }
  };

  const createPlannedSession = async () => {
    if (!planTitle || !planDate || !planDuration) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    try {
      await apiClient.post('/focus/sessions/', {
        title: planTitle,
        description: planDescription,
        start_time: new Date(planDate).toISOString(),
        end_time: new Date(new Date(planDate).getTime() + parseInt(planDuration) * 60 * 1000).toISOString(),
        user: user?.id,
        task_id: (planTaskId && planTaskId !== "none") ? planTaskId : null,
        interruptions: 0,
        productivity_score: 0,
        notes: "Planned session - not yet started",
      });
      toast({
        title: "Planned session created",
        description: `Scheduled for ${new Date(planDate).toLocaleDateString()}`
      });
      setShowPlanDialog(false);
      setPlanTitle("");
      setPlanDescription("");
      setPlanDate("");
      setPlanDuration("25");
      setPlanTaskId("");
      fetchSessions();
    }
  };

  const pauseSession = () => {
    setIsActive(false);
  };

  const resumeSession = () => {
    setIsActive(true);
  };

  const stopSession = async () => {
    if (!currentSession) return;

    const endTime = new Date().toISOString();
    const duration = Math.floor(seconds / 60); // Convert to minutes

    try {
      await apiClient.patch(`/focus/sessions/${currentSession.id}/`, {
        end_time: endTime,
        duration,
        productivity_score: productivityScore,
        interruptions,
        notes: notes || null,
      });
      
      toast({
        title: "Session completed",
        description: `Great work! You focused for ${duration} minutes.`,
      });
      setIsActive(false);
      setCurrentSession(null);
      setSeconds(0);
      setNotes("");
      setProductivityScore(5);
      setInterruptions(0);
      fetchSessions();
    } catch (error: any) {
      toast({
        title: "Error ending session",
        description: error.message || "Failed to end session",
        variant: "destructive",
      });
    }
  };

  const addInterruption = () => {
    setInterruptions(prev => prev + 1);
  };

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return "0m";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const toggleNotesExpansion = (sessionId: string) => {
    setExpandedNotes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sessionId)) {
        newSet.delete(sessionId);
      } else {
        newSet.add(sessionId);
      }
      return newSet;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-blue-50/30 to-purple-50/30 relative">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-grid-pattern opacity-[0.02] pointer-events-none" />
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-indigo-400/10 to-purple-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-blue-400/10 to-cyan-400/10 rounded-full blur-3xl pointer-events-none" />
      
      <div className="relative z-10 space-y-6 p-6">
        {/* Compact Header */}
        <div className="text-center py-4">
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 bg-clip-text text-transparent mb-2">
            Focus Hours
          </h1>
          <p className="text-sm text-gray-600">
            Track your focus work time and efficiency
          </p>
          {selectedUserId && userRole && (userRole === 'manager' || userRole === 'super_admin') && (
            <p className="text-xs text-purple-600 mt-1 font-medium">
              Viewing focus hours for: {users.find(u => u.id === selectedUserId)?.full_name}
            </p>
          )}
        </div>

        {/* Focus Timer Card */}
        <Card className="border shadow-lg">
          <CardHeader className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white pb-4">
            <CardTitle className="flex items-center justify-center gap-2 text-lg font-bold">
              <Timer className="h-5 w-5" />
              Focus Timer
            </CardTitle>
            <CardDescription className="text-indigo-100 text-center text-sm">
              Begin a focus session to track your efficiency
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 py-6">
            <div className="text-center">
              {/* Timer Display */}
              <div className="relative mb-6">
                <div className="text-6xl md:text-7xl font-mono font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-4 tracking-tight">
                  {formatTime(seconds)}
                </div>
                {currentSession && (
                  <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  </div>
                )}
              </div>
              
              {/* Interruptions Counter */}
              {currentSession && (
                <div className="flex items-center justify-center gap-4 mb-6">
                  <div className="bg-gradient-to-r from-orange-100 to-red-100 px-4 py-2 rounded-xl border border-orange-200">
                    <span className="text-orange-700 font-semibold text-sm">
                      Interruptions: {interruptions}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addInterruption}
                    className="border-orange-300 text-orange-600 hover:bg-orange-50 rounded-lg h-9 px-4"
                  >
                    +1 Interruption
                  </Button>
                </div>
              )}

              {/* Control Buttons */}
              <div className="flex items-center justify-center gap-3 flex-wrap">
                {!currentSession && (!selectedUserId || selectedUserId === user?.id) ? (
                  <>
                    <Button 
                      onClick={() => startSession()} 
                      size="default"
                      className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
                    >
                      <Play className="mr-2 h-4 w-4" />
                      Begin Productive Session
                    </Button>
                    
                    <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
                      <DialogTrigger asChild>
                        <Button 
                          variant="outline"
                          size="default"
                          className="border-2 border-indigo-300 text-indigo-600 hover:bg-indigo-50"
                        >
                          <Target className="mr-2 h-4 w-4" />
                          Focus on Task
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle>Select Task to Focus On</DialogTitle>
                          <DialogDescription>
                            Choose a task from your list to start a focused work session.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <Select value={selectedTaskId} onValueChange={setSelectedTaskId}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select a task..." />
                            </SelectTrigger>
                            <SelectContent className="bg-background border shadow-lg z-50">
                              {tasks.map((task) => (
                                <SelectItem key={task.id} value={task.id}>
                                  <div className="flex flex-col">
                                    <span className="font-medium">{task.title}</span>
                                    <span className="text-sm text-muted-foreground">
                                      {task.priority} priority
                                    </span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="flex justify-end gap-3">
                            <Button variant="outline" onClick={() => setShowTaskDialog(false)}>
                              Cancel
                            </Button>
                            <Button 
                              onClick={startTaskFocusSession} 
                              disabled={!selectedTaskId}
                              className="bg-indigo-600 hover:bg-indigo-700"
                            >
                              Start Focus Session
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>

                    <Dialog open={showPlanDialog} onOpenChange={setShowPlanDialog}>
                      <DialogTrigger asChild>
                        <Button 
                          variant="outline"
                          size="default"
                          className="border-2 border-green-300 text-green-600 hover:bg-green-50"
                        >
                          <Calendar className="mr-2 h-4 w-4" />
                          Plan Session
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-lg">
                        <DialogHeader>
                          <DialogTitle>Plan a Focus Session</DialogTitle>
                          <DialogDescription>
                            Schedule a focus session for later. You can plan sessions for the week or longer.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="plan-title">Session Title</Label>
                            <Input
                              id="plan-title"
                              value={planTitle}
                              onChange={(e) => setPlanTitle(e.target.value)}
                              placeholder="What will you focus on?"
                            />
                          </div>
                          <div>
                            <Label htmlFor="plan-description">Description (Optional)</Label>
                            <Textarea
                              id="plan-description"
                              value={planDescription}
                              onChange={(e) => setPlanDescription(e.target.value)}
                              placeholder="Additional details about this session..."
                              rows={3}
                            />
                          </div>
                          <div>
                            <Label htmlFor="plan-task">Link to Task (Optional)</Label>
                            <Select value={planTaskId} onValueChange={setPlanTaskId}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a task to link..." />
                              </SelectTrigger>
                              <SelectContent className="bg-background border shadow-lg z-50">
                                <SelectItem value="none">No task selected</SelectItem>
                                {tasks.map((task) => (
                                  <SelectItem key={task.id} value={task.id}>
                                    {task.title}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="plan-date">Planned Date & Time</Label>
                              <Input
                                id="plan-date"
                                type="datetime-local"
                                value={planDate}
                                onChange={(e) => setPlanDate(e.target.value)}
                              />
                            </div>
                            <div>
                              <Label htmlFor="plan-duration">Duration (minutes)</Label>
                              <Select value={planDuration} onValueChange={setPlanDuration}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-background border shadow-lg z-50">
                                  <SelectItem value="15">15 minutes</SelectItem>
                                  <SelectItem value="25">25 minutes</SelectItem>
                                  <SelectItem value="30">30 minutes</SelectItem>
                                  <SelectItem value="45">45 minutes</SelectItem>
                                  <SelectItem value="60">1 hour</SelectItem>
                                  <SelectItem value="90">1.5 hours</SelectItem>
                                  <SelectItem value="120">2 hours</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="flex justify-end gap-3">
                            <Button variant="outline" onClick={() => setShowPlanDialog(false)}>
                              Cancel
                            </Button>
                            <Button onClick={createPlannedSession} className="bg-green-600 hover:bg-green-700">
                              Create Plan
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </>
                ) : currentSession ? (
                  <>
                    {isActive ? (
                      <Button 
                        onClick={pauseSession} 
                        variant="outline" 
                        size="default"
                        className="border-2 border-orange-300 text-orange-600 hover:bg-orange-50"
                      >
                        <Pause className="mr-2 h-4 w-4" />
                        Pause
                      </Button>
                    ) : (
                      <Button 
                        onClick={resumeSession} 
                        size="default"
                        className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
                      >
                        <Play className="mr-2 h-4 w-4" />
                        Resume
                      </Button>
                    )}
                    <Button 
                      onClick={stopSession} 
                      variant="destructive" 
                      size="default"
                      className="bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 shadow-lg hover:shadow-xl transition-all duration-300"
                    >
                      <Square className="mr-2 h-4 w-4" />
                      Stop Session
                    </Button>
                  </>
                ) : selectedUserId && selectedUserId !== user?.id ? (
                  <div className="bg-gray-100 px-6 py-4 rounded-2xl">
                    <p className="text-gray-600 font-medium">Viewing another user's sessions (read-only)</p>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Session Notes */}
            {currentSession && (
              <div className="pt-8 border-t border-gray-200">
                <div className="max-w-2xl mx-auto space-y-4">
                  <Label htmlFor="session-notes" className="text-lg font-semibold text-gray-700">
                    Session Notes
                  </Label>
                  <Textarea
                    id="session-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="What did you work on? Any insights or challenges?"
                    rows={4}
                    className="rounded-xl border-gray-200 focus:border-indigo-300 focus:ring-indigo-200"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Compact Filter Controls */}
        <Card className="border shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Filters:</span>
              </div>
              
              <div className="flex items-center gap-2 flex-wrap">
                <Select value={filterPeriod} onValueChange={setFilterPeriod}>
                  <SelectTrigger className="w-32 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background border shadow-lg z-50">
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="week">This Week</SelectItem>
                    <SelectItem value="month">This Month</SelectItem>
                    <SelectItem value="all">All Time</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-32 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background border shadow-lg z-50">
                    <SelectItem value="all">All Sessions</SelectItem>
                    <SelectItem value="task-based">Task-based</SelectItem>
                    <SelectItem value="free-form">Free-form</SelectItem>
                    <SelectItem value="planned">Planned</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Sessions Card */}
        <Card className="border shadow-lg">
          <CardHeader className="bg-gradient-to-r from-purple-500 to-pink-600 text-white pb-3">
            <CardTitle className="flex items-center justify-center gap-2 text-lg font-bold">
              <Brain className="h-5 w-5" />
              Focus Sessions
            </CardTitle>
            <CardDescription className="text-purple-100 text-center text-sm">
              Your focus session history and planned sessions
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            {sessions.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-24 h-24 bg-gradient-to-r from-purple-100 to-pink-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Target className="h-12 w-12 text-purple-500" />
                </div>
                <p className="text-gray-600 text-lg max-w-md mx-auto">
                  No focus sessions yet. Begin your first session to track your productivity!
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {sessions.map((session) => (
                  <div 
                    key={session.id} 
                    className="group hover:shadow-lg transition-all duration-300 p-6 border border-gray-100 rounded-2xl bg-gradient-to-r from-white to-gray-50/50 hover:from-indigo-50/50 hover:to-purple-50/50"
                  >
                    <div className="flex items-center justify-between">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="font-semibold text-lg text-gray-800">
                            {session.title || "Focus Session"}
                          </span>
                          {session.task_id && (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                              Task-based
                            </Badge>
                          )}
                          {session.notes === "Planned session - not yet started" && (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              Planned
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-gray-500 bg-gray-100 px-3 py-1 rounded-full text-sm">
                            {new Date(session.start_time).toLocaleDateString()}
                          </span>
                          <span className="text-gray-500 bg-gray-100 px-3 py-1 rounded-full text-sm">
                            {new Date(session.start_time).toLocaleTimeString()}
                          </span>
                        </div>
                        
                        {/* Expandable Notes Section */}
                        {session.notes && (
                          <Collapsible>
                            <CollapsibleTrigger 
                              onClick={() => toggleNotesExpansion(session.id)}
                              className="flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors mt-3"
                            >
                              <FileText className="h-4 w-4" />
                              <span className="text-sm font-medium">View Notes</span>
                              {expandedNotes.has(session.id) ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </CollapsibleTrigger>
                            <CollapsibleContent className="mt-3">
                              <div className="bg-blue-50/80 p-4 rounded-lg border-l-4 border-blue-300">
                                <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
                                  {session.notes}
                                </p>
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-6 text-sm ml-6">
                        <div className="text-center">
                          <div className="font-bold text-xl text-indigo-600 mb-1">
                            {formatDuration(session.duration)}
                          </div>
                          <div className="text-gray-500 font-medium">Duration</div>
                        </div>
                        <div className="text-center">
                          <div className="font-bold text-xl text-orange-600 mb-1">
                            {session.interruptions}
                          </div>
                          <div className="text-gray-500 font-medium">Interruptions</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Manager User Filter */}
        {userRole && (userRole === 'manager' || userRole === 'super_admin') && (
          <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white">
              <CardTitle className="flex items-center justify-center gap-3 text-xl font-bold">
                <Users className="h-6 w-6" />
                View User Focus Sessions
                <Badge variant="secondary" className="ml-3 bg-white/20 text-white border-white/30">
                  Admin: {userRole}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex items-center gap-6 justify-center">
                <Label htmlFor="user-select" className="text-lg font-semibold text-gray-700">
                  Select User:
                </Label>
                <Select value={selectedUserId || 'my_sessions'} onValueChange={(value) => setSelectedUserId(value === 'my_sessions' ? null : value)}>
                  <SelectTrigger className="w-80 h-12 rounded-xl border-gray-200 bg-white">
                    <SelectValue placeholder="Select a user to view their focus sessions" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-gray-200 shadow-lg bg-white z-50">
                    <SelectItem value="my_sessions" className="rounded-lg">My Sessions</SelectItem>
                    {users.map(user => (
                      <SelectItem key={user.id} value={user.id} className="rounded-lg">
                        {user.full_name} ({user.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 px-4 py-2">
                  {users.length} users loaded
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Focus;
