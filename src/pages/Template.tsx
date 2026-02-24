import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import apiClient from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, BookOpen, Users, TrendingUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { TemplateCard } from "@/components/TemplateCard";
import UserTemplateTasks from "@/components/UserTemplateTasks";

interface LearningTemplate {
  id: string;
  name: string;
  description: string;
  technology: string;
  created_at: string;
}

interface TemplateAssignment {
  id: string;
  template_id: string;
  user_id: string;
  assigned_at: string;
}

interface TemplateTask {
  id: string;
  template_id: string;
  user_id: string;
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

interface TeamMember {
  user_id: string;
  full_name: string;
  email: string;
}

const LearningTemplates = () => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<LearningTemplate[]>([]);
  const [assignments, setAssignments] = useState<TemplateAssignment[]>([]);
  const [templateTasks, setTemplateTasks] = useState<TemplateTask[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [expandedTemplates, setExpandedTemplates] = useState(new Set<string>());

  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<LearningTemplate | null>(null);

  // Form states
  const [templateForm, setTemplateForm] = useState({
    name: "",
    description: "",
    technology: "",
  });

  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    priority: "medium",
    due_date: "",
  });

  const [editTaskForm, setEditTaskForm] = useState({
    id: "",
    title: "",
    description: "",
    priority: "medium",
    due_date: "",
    user_id: "",
  });

  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedTask, setSelectedTask] = useState<TemplateTask | null>(null);
  const [isEditTaskDialogOpen, setIsEditTaskDialogOpen] = useState(false);
  const [isReassignDialogOpen, setIsReassignDialogOpen] = useState(false);

  useEffect(() => {
    if (user) {
      checkUserRole();
    }
  }, [user]);

  useEffect(() => {
    if (user && isAdmin !== null) {
      fetchTemplates();
      fetchTeamMembers();
    }
  }, [user, isAdmin]);

  useEffect(() => {
    if (expandedTemplates.size > 0) {
      fetchAllTemplateData();
    }
  }, [expandedTemplates]);

  const checkUserRole = async () => {
    if (!user) return;
    
    try {
      const userData = await apiClient.getCurrentUser() as any;
      const roles = userData?.roles || [];
      const roleNames = roles.map((r: any) => r.role);
      setIsAdmin(roleNames.includes('super_admin') || roleNames.includes('operations_manager') || roleNames.includes('manager'));
    } catch (error) {
      setIsAdmin(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const data = await apiClient.get<any>('/templates/');
      const list = Array.isArray(data) ? data : (data?.results ?? []);
      setTemplates(list);
    } catch (error) {
      console.error('Error fetching templates:', error);
      setTemplates([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTeamMembers = async () => {
    if (!isAdmin || !user) return;
    
    try {
      const userData = await apiClient.getCurrentUser() as any;
      const roles = userData?.roles || [];
      const roleNames = roles.map((r: any) => r.role);
      const isSuperAdmin = roleNames.includes('super_admin');
      const isOrgManager = roleNames.includes('operations_manager');
      const isCompanyManager = roleNames.includes('manager');

      if (isSuperAdmin) {
        const users = await apiClient.get<any[]>('/auth/users/');
        const teamMembersData = (Array.isArray(users) ? users : [])
          .filter((u: any) => u.profile?.status !== 'deleted' && (u.profile?.status === 'active' || !u.profile?.status))
          .map((u: any) => ({
            user_id: u.id,
            full_name: u.profile?.full_name || u.full_name || null,
            email: u.email
          }));
        setTeamMembers(teamMembersData);
        return;
      }
      if (isOrgManager) {
        const companies = await apiClient.get<any[]>('/scheduler/companies/', { operations_manager: user.id });
        const companiesList = Array.isArray(companies) ? companies : [];
        const companyIds = companiesList.map((c: any) => c?.id).filter(Boolean);
        const managerIds = companiesList.map((c: any) => c?.company_manager || c?.company_manager_id).filter(Boolean);
        const seen = new Set<string>();
        const teamMembersData: TeamMember[] = [];
        if (managerIds.length > 0) {
          const usersRaw = await apiClient.get<any[]>('/auth/users/');
          const usersList = Array.isArray(usersRaw) ? usersRaw : [];
          usersList.filter((u: any) => managerIds.includes(u?.id)).forEach((u: any) => {
            if (u?.id && !seen.has(u.id)) {
              seen.add(u.id);
              teamMembersData.push({ user_id: u.id, full_name: u?.profile?.full_name || u?.full_name || null, email: u?.email });
            }
          });
        }
        for (const companyId of companyIds) {
          const employees = await apiClient.get<any[]>('/scheduler/employees/', { company: companyId, status: 'active' });
          const list = Array.isArray(employees) ? employees : [];
          list.filter((emp: any) => emp?.user || emp?.user_id).forEach((emp: any) => {
            const uid = emp.user || emp.user_id;
            if (uid && !seen.has(uid)) {
              seen.add(uid);
              teamMembersData.push({
                user_id: uid,
                full_name: `${emp?.first_name ?? ''} ${emp?.last_name ?? ''}`.trim() || null,
                email: emp?.email
              });
            }
          });
        }
        setTeamMembers(teamMembersData);
        return;
      }
      if (isCompanyManager) {
        const companies = await apiClient.get<any[]>('/scheduler/companies/', { company_manager: user.id });
        const companiesList = Array.isArray(companies) ? companies : [];
        const companyIds = companiesList.map((c: any) => c?.id).filter(Boolean);
        const teamMembersData: TeamMember[] = [];
        for (const companyId of companyIds) {
          const employees = await apiClient.get<any[]>('/scheduler/employees/', { company: companyId, status: 'active' });
          const list = Array.isArray(employees) ? employees : [];
          list.filter((emp: any) => emp?.user || emp?.user_id).forEach((emp: any) => {
            teamMembersData.push({
              user_id: emp.user || emp.user_id,
              full_name: `${emp?.first_name ?? ''} ${emp?.last_name ?? ''}`.trim() || null,
              email: emp?.email
            });
          });
        }
        setTeamMembers(teamMembersData);
        return;
      }
      setTeamMembers([]);
    } catch (error) {
      console.error('Error fetching team members for check lists:', error);
      setTeamMembers([]);
    }
  };

  const fetchAllTemplateData = async () => {
    if (!user) return;

    try {
      const assignData = await apiClient.get<any>('/templates/assignments/');
      const assignList = Array.isArray(assignData) ? assignData : (assignData?.results ?? []);
      setAssignments(assignList.map((a: any) => ({
        id: a.id,
        template_id: a.template_id ?? a.template,
        user_id: a.user_id ?? a.user,
        assigned_at: a.assigned_at,
      })));

      // Fetch tasks for expanded templates
      const templateIds = Array.from(expandedTemplates);
      if (templateIds.length === 0) return;

      const params: any = { template_id: templateIds.join(',') };
      if (!isAdmin) {
        params.user = user.id;
      }

      const tasksData = await apiClient.get<any[]>('/calendar/events/', params);

      const transformedTasks = (tasksData || []).map(task => ({
        id: task.id,
        template_id: task.template_id,
        user_id: task.user_id,
        title: task.title,
        description: task.description || '',
        priority: task.priority || 'medium',
        status: task.completed ? 'completed' : 'pending',
        due_date: task.start_time,
        created_at: task.created_at,
        completed: task.completed || false,
        notes: task.notes || '',
        files: Array.isArray(task.files) ? (task.files as string[]) : [],
      }));

      setTemplateTasks(transformedTasks);
    } catch (error) {
      console.error('Failed to fetch template data:', error);
    }
  };

  const createTemplate = async () => {
    if (!user || !isAdmin) return;

    try {
      // Note: Learning templates endpoint needs to be implemented in Django
      await apiClient.post('/templates/', {
        ...templateForm,
        created_by: user.id,
      });

      toast.success('Template created successfully');
      setIsCreateDialogOpen(false);
      setTemplateForm({ name: "", description: "", technology: "" });
      fetchTemplates();
    } catch (error) {
      toast.error('Failed to create template');
    }
  };

  const updateTemplate = async () => {
    if (!user || !isAdmin || !selectedTemplate) return;

    try {
      // Note: Learning templates endpoint needs to be implemented in Django
      await apiClient.patch(`/templates/${selectedTemplate.id}/`, {
        name: templateForm.name,
        description: templateForm.description,
        technology: templateForm.technology,
      });

      toast.success('Template updated successfully');
      setIsEditDialogOpen(false);
      setTemplateForm({ name: "", description: "", technology: "" });
      setSelectedTemplate(null);
      fetchTemplates();
    } catch (error) {
      toast.error('Failed to update template');
    }
  };

  const updateTask = async () => {
    if (!user || !selectedTask) return;

    try {
      await apiClient.patch(`/calendar/events/${editTaskForm.id}/`, {
        title: editTaskForm.title,
        description: editTaskForm.description,
        priority: editTaskForm.priority,
        start_time: editTaskForm.due_date ? new Date(editTaskForm.due_date).toISOString() : null,
        end_time: editTaskForm.due_date ? new Date(editTaskForm.due_date).toISOString() : null,
      });

      toast.success('Task updated successfully');
      setIsEditTaskDialogOpen(false);
      setEditTaskForm({ id: "", title: "", description: "", priority: "medium", due_date: "", user_id: "" });
      setSelectedTask(null);
      fetchAllTemplateData();
    } catch (error) {
      toast.error('Failed to update task');
    }
  };

  const reassignTask = async () => {
    if (!user || !selectedTask || !editTaskForm.user_id) return;

    try {
      await apiClient.patch(`/calendar/events/${selectedTask.id}/`, {
        user: editTaskForm.user_id,
      });

      toast.success('Task reassigned successfully');
      setIsReassignDialogOpen(false);
      setEditTaskForm({ id: "", title: "", description: "", priority: "medium", due_date: "", user_id: "" });
      setSelectedTask(null);
      fetchAllTemplateData();
    } catch (error) {
      toast.error('Failed to reassign task');
    }
  };

  const handleEditTask = (task: TemplateTask) => {
    setSelectedTask(task);
    setEditTaskForm({
      id: task.id,
      title: task.title,
      description: task.description,
      priority: task.priority,
      due_date: task.due_date ? new Date(task.due_date).toISOString().split('T')[0] : '',
      user_id: task.user_id,
    });
    setIsEditTaskDialogOpen(true);
  };

  const handleReassignTask = (task: TemplateTask) => {
    setSelectedTask(task);
    setEditTaskForm({
      id: task.id,
      title: task.title,
      description: task.description,
      priority: task.priority,
      due_date: task.due_date ? new Date(task.due_date).toISOString().split('T')[0] : '',
      user_id: task.user_id,
    });
    setIsReassignDialogOpen(true);
  };

  const deleteTemplate = async (templateId: string) => {
    if (!isAdmin) return;

    try {
      // Delete all associated tasks first
      const tasks = await apiClient.get<any[]>('/calendar/events/', { template_id: templateId });
      await Promise.all(tasks.map((task: any) => apiClient.delete(`/calendar/events/${task.id}/`)));

      // Delete all assignments
      // Note: Template assignments endpoint needs to be implemented in Django

      // Delete the template
      // Note: Learning templates endpoint needs to be implemented in Django
      await apiClient.delete(`/templates/${templateId}/`);

      toast.success('Template deleted successfully');
      fetchTemplates();
      fetchAllTemplateData();
    } catch (error) {
      toast.error('Failed to delete template');
    }
  };

  const createTask = async () => {
    if (!user || !selectedTemplate) return;

    try {
      // If no users selected, create a template-level task without user assignment
      if (selectedUserIds.length === 0) {
        await apiClient.post('/calendar/events/', {
          title: taskForm.title,
          description: taskForm.description,
          priority: taskForm.priority,
          start_time: taskForm.due_date ? new Date(taskForm.due_date).toISOString() : null,
          end_time: taskForm.due_date ? new Date(taskForm.due_date).toISOString() : null,
          all_day: true,
          event_type: 'task',
          user: user.id, // Assign to current admin
          template_id: selectedTemplate.id,
        });
      } else {
        // Create tasks for selected users
        const taskPromises = selectedUserIds.map(userId =>
          apiClient.post('/calendar/events/', {
            title: taskForm.title,
            description: taskForm.description,
            priority: taskForm.priority,
            start_time: taskForm.due_date ? new Date(taskForm.due_date).toISOString() : null,
            end_time: taskForm.due_date ? new Date(taskForm.due_date).toISOString() : null,
            all_day: true,
            event_type: 'task',
            user: userId,
            template_id: selectedTemplate.id,
          })
        );

        await Promise.all(taskPromises);
      }

      toast.success('Task created successfully');
      setIsTaskDialogOpen(false);
      setTaskForm({ title: "", description: "", priority: "medium", due_date: "" });
      setSelectedUserIds([]);
      fetchAllTemplateData();
    } catch (error) {
      toast.error('Failed to create task');
    }
  };

  const assignUserToTemplate = async (templateId: string, userId: string) => {
    if (!user || !isAdmin) return;

    try {
      // Note: Template assignments endpoint needs to be implemented in Django
      await apiClient.post('/templates/assignments/', {
        template_id: templateId,
        user_id: userId,
        assigned_by: user.id,
      });
      
      toast.success('User assigned to template successfully');
      fetchAllTemplateData();
    } catch (error) {
      toast.error('Failed to assign user to template');
    }
  };

  const removeUserFromTemplate = async (templateId: string, userId: string) => {
    if (!isAdmin) return;

    try {
      // Remove template assignment
      // Note: Template assignments endpoint needs to be implemented in Django
      await apiClient.delete(`/templates/assignments/?template_id=${templateId}&user_id=${userId}`);

      // Keep tasks but mark them as unassigned by removing user reference
      // This preserves the task history and content
      const tasks = await apiClient.get<any[]>('/calendar/events/', { template_id: templateId, user: userId });
      await Promise.all(tasks.map((task: any) => 
        apiClient.patch(`/calendar/events/${task.id}/`, { user: null })
      ));

      toast.success('User removed from template successfully. Tasks preserved as unassigned.');
      fetchAllTemplateData();
    } catch (error) {
      toast.error('Failed to remove user from template');
    }
  };

  const updateTaskNotes = async (taskId: string, notes: string, files?: string[]) => {
    try {
      const updateData: any = { notes };
      if (files) {
        updateData.files = JSON.stringify(files);
      }

      await apiClient.patch(`/calendar/events/${taskId}/`, updateData);

      toast.success('Notes updated successfully');
      fetchAllTemplateData();
    } catch (error) {
      toast.error('Failed to update notes');
    }
  };

  const toggleTaskCompletion = async (taskId: string, completed: boolean) => {
    try {
      await apiClient.patch(`/calendar/events/${taskId}/`, { 
        completed: !completed,
        completed_at: !completed ? new Date().toISOString() : null 
      });

      toast.success(`Task marked as ${!completed ? 'completed' : 'pending'}`);
      fetchAllTemplateData();
    } catch (error) {
      toast.error('Failed to update task status');
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      await apiClient.delete(`/calendar/events/${taskId}/`);

      toast.success('Task deleted successfully');
      fetchAllTemplateData();
    } catch (error) {
      toast.error('Failed to delete task');
    }
  };

  const getAssignedUsers = (templateId: string) => {
    return assignments
      .filter(a => a.template_id === templateId)
      .map(a => {
        const profile = teamMembers.find(tm => tm.user_id === a.user_id);
        return {
          user_id: a.user_id,
          full_name: profile?.full_name || 'Unknown',
          email: profile?.email || 'Unknown'
        };
      });
  };

  const getTemplateTasks = (templateId: string) => {
    return templateTasks.filter(task => task.template_id === templateId);
  };

  const getUnassignedUsers = (templateId: string) => {
    const assignedUserIds = assignments
      .filter(a => a.template_id === templateId)
      .map(a => a.user_id);
    
    return teamMembers.filter(member => !assignedUserIds.includes(member.user_id));
  };

  const toggleTemplateExpanded = (templateId: string) => {
    setExpandedTemplates(prev => {
      const newSet = new Set(prev);
      if (newSet.has(templateId)) {
        newSet.delete(templateId);
      } else {
        newSet.add(templateId);
      }
      return newSet;
    });
  };

  if (isLoading || isAdmin === null) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!isAdmin) {
    return <UserTemplateTasks />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Check Lists
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mt-2">
              Create and manage Check List with tasks and assignments
            </p>
          </div>
          
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg">
                <Plus className="mr-2 h-5 w-5" />
                New Checklist
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Check-List</DialogTitle>
                <DialogDescription>
                  Create a new Check-List template to organize tasks and assignments.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Template Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., React Development"
                    value={templateForm.name}
                    onChange={(e) => setTemplateForm(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Brief description of the learning template"
                    value={templateForm.description}
                    onChange={(e) => setTemplateForm(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="technology">Technology/Category</Label>
                  <Input
                    id="technology"
                    placeholder="e.g., React, Python, Java"
                    value={templateForm.technology}
                    onChange={(e) => setTemplateForm(prev => ({ ...prev, technology: e.target.value }))}
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={createTemplate} disabled={!templateForm.name.trim()}>
                    Create Template
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>


        {/* Templates Grid */}
        {templates.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <BookOpen className="mx-auto h-16 w-16 text-gray-400 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                No templates created yet
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Get started by creating your first Check-List
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Template
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {templates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                assignedUsers={getAssignedUsers(template.id)}
                tasks={getTemplateTasks(template.id)}
                unassignedUsers={getUnassignedUsers(template.id)}
                isExpanded={expandedTemplates.has(template.id)}
                isAdmin={isAdmin}
                onToggleExpanded={() => toggleTemplateExpanded(template.id)}
                onAssignUser={(userId) => assignUserToTemplate(template.id, userId)}
                onRemoveUser={(userId) => removeUserFromTemplate(template.id, userId)}
                onAddTask={() => {
                  setSelectedTemplate(template);
                  setIsTaskDialogOpen(true);
                }}
                onEditTemplate={() => {
                  setSelectedTemplate(template);
                  setTemplateForm({
                    name: template.name,
                    description: template.description,
                    technology: template.technology,
                  });
                  setIsEditDialogOpen(true);
                }}
                onDeleteTemplate={() => deleteTemplate(template.id)}
                onToggleTaskComplete={toggleTaskCompletion}
                onEditTask={handleEditTask}
                onReassignTask={handleReassignTask}
                onDeleteTask={(taskId) => deleteTask(taskId)}
                onUpdateTaskNotes={updateTaskNotes}
              />
            ))}
          </div>
        )}

        {/* Task Creation Dialog */}
        <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Task</DialogTitle>
              <DialogDescription>
                Create a new task for the "{selectedTemplate?.name}" template.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="task-title">Task Title</Label>
                <Input
                  id="task-title"
                  placeholder="Enter task title"
                  value={taskForm.title}
                  onChange={(e) => setTaskForm(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>
              
              <div>
                <Label htmlFor="task-description">Description</Label>
                <Textarea
                  id="task-description"
                  placeholder="Enter task description"
                  value={taskForm.description}
                  onChange={(e) => setTaskForm(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="task-priority">Priority</Label>
                  <Select value={taskForm.priority} onValueChange={(value) => setTaskForm(prev => ({ ...prev, priority: value }))}>
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
                
                <div>
                  <Label htmlFor="task-due-date">Due Date</Label>
                  <Input
                    id="task-due-date"
                    type="date"
                    value={taskForm.due_date}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, due_date: e.target.value }))}
                  />
                </div>
              </div>
              
              <div>
                <Label>Assign to Users (Optional)</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Leave unchecked to create a general template task, or select users to assign specifically.
                </p>
                <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto border rounded p-2 mt-2">
                  {getAssignedUsers(selectedTemplate?.id || '').map((user) => (
                    <div key={user.user_id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`user-${user.user_id}`}
                        checked={selectedUserIds.includes(user.user_id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedUserIds(prev => [...prev, user.user_id]);
                          } else {
                            setSelectedUserIds(prev => prev.filter(id => id !== user.user_id));
                          }
                        }}
                      />
                      <label htmlFor={`user-${user.user_id}`} className="text-sm">
                        {user.full_name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsTaskDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={createTask} 
                  disabled={!taskForm.title.trim()}
                >
                  Create Task
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Template Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Template</DialogTitle>
              <DialogDescription>
                Update the learning template details.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-name">Template Name</Label>
                <Input
                  id="edit-name"
                  placeholder="e.g., React Development"
                  value={templateForm.name}
                  onChange={(e) => setTemplateForm(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  placeholder="Brief description of the learning template"
                  value={templateForm.description}
                  onChange={(e) => setTemplateForm(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="edit-technology">Technology/Category</Label>
                <Input
                  id="edit-technology"
                  placeholder="e.g., React, Python, Java"
                  value={templateForm.technology}
                  onChange={(e) => setTemplateForm(prev => ({ ...prev, technology: e.target.value }))}
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={updateTemplate} disabled={!templateForm.name.trim()}>
                  Update Template
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Task Dialog */}
        <Dialog open={isEditTaskDialogOpen} onOpenChange={setIsEditTaskDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Task</DialogTitle>
              <DialogDescription>
                Update the task details for "{selectedTask?.title}".
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-task-title">Task Title</Label>
                <Input
                  id="edit-task-title"
                  placeholder="Enter task title"
                  value={editTaskForm.title}
                  onChange={(e) => setEditTaskForm(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>
              
              <div>
                <Label htmlFor="edit-task-description">Description</Label>
                <Textarea
                  id="edit-task-description"
                  placeholder="Enter task description"
                  value={editTaskForm.description}
                  onChange={(e) => setEditTaskForm(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-task-priority">Priority</Label>
                  <Select value={editTaskForm.priority} onValueChange={(value) => setEditTaskForm(prev => ({ ...prev, priority: value }))}>
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
                
                <div>
                  <Label htmlFor="edit-task-due-date">Due Date</Label>
                  <Input
                    id="edit-task-due-date"
                    type="date"
                    value={editTaskForm.due_date}
                    onChange={(e) => setEditTaskForm(prev => ({ ...prev, due_date: e.target.value }))}
                  />
                </div>
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsEditTaskDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={updateTask} 
                  disabled={!editTaskForm.title.trim()}
                >
                  Update Task
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Reassign Task Dialog */}
        <Dialog open={isReassignDialogOpen} onOpenChange={setIsReassignDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Reassign Task</DialogTitle>
              <DialogDescription>
                Reassign "{selectedTask?.title}" to a different user.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="reassign-user">Assign to User</Label>
                <Select value={editTaskForm.user_id} onValueChange={(value) => setEditTaskForm(prev => ({ ...prev, user_id: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a user" />
                  </SelectTrigger>
                  <SelectContent>
                    {teamMembers.map((member) => (
                      <SelectItem key={member.user_id} value={member.user_id}>
                        {member.full_name} ({member.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsReassignDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={reassignTask} 
                  disabled={!editTaskForm.user_id}
                >
                  Reassign Task
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default LearningTemplates;
