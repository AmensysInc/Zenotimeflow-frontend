import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import apiClient from "@/lib/api-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { TaskChat } from "@/components/TaskChat";
import { CheckCircle, Clock, AlertCircle, BookOpen, MessageCircle, Save, Calendar } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface TemplateTask {
  id: string;
  template_id: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  due_date: string;
  created_at: string;
  completed: boolean;
  notes?: string;
  files?: string[];
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

function UserTemplateTasks() {
  const { user } = useAuth();
  const [templatesWithTasks, setTemplatesWithTasks] = useState<TemplateWithTasks[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<TemplateTask | null>(null);
  const [isNotesDialogOpen, setIsNotesDialogOpen] = useState(false);
  const [newNote, setNewNote] = useState('');

  useEffect(() => {
    fetchUserTemplateTasks();
  }, [user]);

  // Note: Real-time updates will be handled by Django Channels in the future

  const fetchUserTemplateTasks = async () => {
    if (!user) return;

    try {
      // Note: Template assignments endpoint needs to be implemented in Django
      // For now, fetch tasks directly for the user with template_id
      const tasks = await apiClient.get<any[]>('/calendar/events/', { 
        user: user.id,
        template_id__isnull: false
      });

      if (!tasks || tasks.length === 0) {
        setLoading(false);
        return;
      }

      // Get unique template IDs from tasks
      const templateIds = [...new Set(tasks.map(t => t.template_id).filter(Boolean))];

      // Note: Learning templates endpoint needs to be implemented in Django
      // For now, create a mock template structure
      const templates = templateIds.map(id => ({
        id,
        name: `Template ${id}`,
        description: '',
        technology: ''
      }));

      // Combine templates with their tasks, transforming calendar_events to TemplateTask format
      const templatesWithTasksData: TemplateWithTasks[] = (templates || []).map(template => ({
        template,
        tasks: (tasks || []).filter(task => task.template_id === template.id).map(task => ({
          id: task.id,
          template_id: task.template_id!,
          title: task.title,
          description: task.description || '',
          priority: task.priority,
          status: task.completed ? 'completed' : 'pending',
          due_date: task.start_time || '',
          created_at: task.created_at,
          completed: task.completed || false,
          notes: task.notes || '',
          files: Array.isArray(task.files) ? (task.files as string[]) : [],
        }))
      }));

      setTemplatesWithTasks(templatesWithTasksData);
    } catch (error) {
      toast.error('Failed to fetch template tasks');
    } finally {
      setLoading(false);
    }
  };

  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    try {
      const completed = newStatus === 'completed';
      await apiClient.patch(`/calendar/events/${taskId}/`, { 
        completed: completed,
        completed_at: completed ? new Date().toISOString() : null 
      });
      
      toast.success('Task status updated');
      fetchUserTemplateTasks();
    } catch (error) {
      toast.error('Failed to update task status');
    }
  };

  const addTaskNote = async (taskId: string, newNote: string) => {
    if (!newNote.trim()) return;

    try {
      // Get current task to append to existing notes
      const currentTask = await apiClient.get<any>(`/calendar/events/${taskId}/`);

      const currentNotes = currentTask?.notes || "";
      
      // For template tasks, don't add timestamps - just append the note
      const updatedNotes = currentNotes 
        ? `${currentNotes}\n\n${newNote}`
        : newNote;

      await apiClient.patch(`/calendar/events/${taskId}/`, { notes: updatedNotes });
      
      toast.success('Progress note added');
      fetchUserTemplateTasks();
    } catch (error) {
      toast.error('Failed to add progress note');
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'secondary';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'default';
      case 'in_progress': return 'secondary';
      case 'pending': return 'outline';
      default: return 'outline';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return CheckCircle;
      case 'in_progress': return Clock;
      case 'pending': return AlertCircle;
      default: return AlertCircle;
    }
  };

  const getTemplateProgress = (tasks: TemplateTask[]) => {
    if (tasks.length === 0) return 0;
    const completedTasks = tasks.filter(task => task.status === 'completed').length;
    return Math.round((completedTasks / tasks.length) * 100);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (templatesWithTasks.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No Learning Templates Assigned</h3>
          <p className="text-muted-foreground">
            You don't have any learning templates assigned yet. Check back later or contact your manager.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Learning Templates</h2>
        <p className="text-muted-foreground">Track your progress on assigned learning templates</p>
      </div>

      {templatesWithTasks.map(({ template, tasks }) => (
        <Card key={template.id}>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-xl">{template.name}</CardTitle>
                <CardDescription className="text-sm">
                  {template.technology} • {tasks.length} tasks
                </CardDescription>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-primary">
                  {getTemplateProgress(tasks)}%
                </div>
                <p className="text-sm text-muted-foreground">Complete</p>
              </div>
            </div>
            <div className="mt-4">
              <Progress value={getTemplateProgress(tasks)} className="h-2" />
            </div>
            {template.description && (
              <p className="text-sm text-muted-foreground mt-2">{template.description}</p>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {tasks.map((task) => {
                const [isExpanded, setIsExpanded] = useState(false);
                return (
                  <Card key={task.id} className="hover:shadow-md transition-all duration-200 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                    <CardContent className="p-4">
                      {/* Collapsed View */}
                      <div 
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => setIsExpanded(!isExpanded)}
                      >
                        <div className="flex items-center space-x-3 flex-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              const newStatus = task.completed ? 'pending' : 'completed';
                              updateTaskStatus(task.id, newStatus);
                            }}
                            className="h-6 w-6 p-0"
                          >
                            {task.completed ? (
                              <CheckCircle className="h-5 w-5 text-green-600" />
                            ) : (
                              <div className="h-5 w-5 border-2 border-gray-300 rounded" />
                            )}
                          </Button>
                          
                          <div className="flex-1">
                            <h3 className={`text-base font-semibold ${
                              task.completed ? 'line-through text-gray-500' : 'text-gray-900 dark:text-white'
                            }`}>
                              {task.title}
                            </h3>
                            <div className="flex items-center space-x-2 mt-1 text-xs text-gray-500">
                              <span>Created {format(new Date(task.created_at), 'MMM dd, yyyy')}</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <Badge variant={getPriorityColor(task.priority)} className="text-xs">
                              {task.priority}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              <BookOpen className="h-3 w-3 mr-1" />
                              Template
                            </Badge>
                          </div>
                          
                          {isExpanded ? (
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          ) : (
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          )}
                        </div>
                      </div>

                      {/* Expanded View */}
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                          {/* Header with Actions */}
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                                {task.title}
                              </h2>
                              <div className="flex items-center space-x-2">
                                <Badge variant={getPriorityColor(task.priority)}>
                                  {task.priority}
                                </Badge>
                                {task.completed && (
                                  <Badge variant="default" className="bg-green-100 text-green-800">
                                    <CheckCircle className="mr-1 h-3 w-3" />
                                    Completed
                                  </Badge>
                                )}
                                <Badge variant="outline" className="bg-blue-50 text-blue-700">
                                  <BookOpen className="mr-1 h-3 w-3" />
                                  Template Task
                                </Badge>
                              </div>
                            </div>
                            
                            {/* Top Right Actions */}
                            <div className="flex items-center space-x-2">
                              <Button
                                variant={task.completed ? "outline" : "default"}
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const newStatus = task.completed ? 'pending' : 'completed';
                                  updateTaskStatus(task.id, newStatus);
                                }}
                              >
                                {task.completed ? (
                                  <>
                                    <svg className="mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                    Mark Incomplete
                                  </>
                                ) : (
                                  <>
                                    <svg className="mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    Mark Complete
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>

                          {/* Responsibilities/Description */}
                          {task.description && (
                            <div className="mb-6">
                              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                                Responsibilities / Details
                              </h3>
                              <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                                  {task.description}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Attachments and Actions Section */}
                          <div className="space-y-4">
                            {/* Attachments */}
                            {task.files && task.files.length > 0 && (
                              <div>
                                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                                  Attachments
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                  {task.files.map((file, index) => (
                                    <a
                                      key={index}
                                      href={file}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs px-3 py-1 bg-blue-50 text-blue-700 rounded-full hover:bg-blue-100"
                                    >
                                      Attachment {index + 1}
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Notes Section */}
                            <div>
                              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                                Notes
                              </h3>
                              <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                                <Textarea
                                  placeholder="Add your notes here..."
                                  value={task.notes || ''}
                                  readOnly
                                  className="min-h-24 mb-2 bg-white dark:bg-gray-800"
                                />
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setSelectedTask(task);
                                    setIsNotesDialogOpen(true);
                                  }}
                                >
                                  <Save className="h-4 w-4 mr-1" />
                                  Add Note
                                </Button>
                              </div>
                            </div>

                            {/* Communication Section */}
                            {user?.id && (
                              <div>
                                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                                  Communication
                                </h3>
                                <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                                  <TaskChat
                                    taskId={task.id}
                                    taskTitle={task.title}
                                    assignedUsers={[{
                                      user_id: user.id,
                                      full_name: user.user_metadata?.full_name || null,
                                      email: user.email || ''
                                    }]}
                                    isAdmin={false}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Notes Dialog */}
      <Dialog open={isNotesDialogOpen} onOpenChange={setIsNotesDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <MessageCircle className="h-5 w-5" />
              <span>Task Progress Notes</span>
            </DialogTitle>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">{selectedTask.title}</h4>
                <p className="text-sm text-muted-foreground">{selectedTask.description}</p>
              </div>
              
              {selectedTask.notes && (
                <div>
                  <Label className="text-sm font-medium">Previous Notes:</Label>
                  <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-800 rounded-md border">
                    <pre className="text-sm whitespace-pre-wrap">{selectedTask.notes}</pre>
                  </div>
                </div>
              )}
              
              <div>
                <Label htmlFor="new-note">Add Progress Note:</Label>
                <Textarea
                  id="new-note"
                  placeholder="Describe your progress, challenges, or thoughts about this task..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="min-h-24 mt-1"
                />
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => {
                  setIsNotesDialogOpen(false);
                  setNewNote('');
                  setSelectedTask(null);
                }}>
                  Cancel
                </Button>
                <Button 
                  onClick={() => {
                    if (selectedTask) {
                      addTaskNote(selectedTask.id, newNote);
                      setIsNotesDialogOpen(false);
                      setNewNote('');
                      setSelectedTask(null);
                    }
                  }}
                  disabled={!newNote.trim()}
                >
                  <Save className="h-4 w-4 mr-1" />
                  Add Note
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export { UserTemplateTasks };
export default UserTemplateTasks;