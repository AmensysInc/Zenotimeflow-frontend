import { useState } from "react";
import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Users, Plus, Settings, BookOpen, TrendingUp, Calendar, ChevronRight, MessageCircle, CheckSquare, X, Edit, Trash2, Search, UserPlus } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TaskChat } from "@/components/TaskChat";
import { TaskNotes } from "@/components/TaskNotes";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { FileUpload } from "@/components/ui/file-upload";
// Supabase removed - using Django API
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

interface LearningTemplate {
  id: string;
  name: string;
  description: string;
  technology: string;
  created_at: string;
}

interface TeamMember {
  user_id: string;
  full_name: string | null;
  email: string;
}

interface TemplateTask {
  id: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  user_id: string;
  completed: boolean;
  created_at: string;
  notes?: string;
  files?: string[];
}

interface TemplateCardProps {
  template: LearningTemplate;
  assignedUsers: TeamMember[];
  tasks: TemplateTask[];
  unassignedUsers: TeamMember[];
  isExpanded: boolean;
  isAdmin: boolean;
  onToggleExpanded: () => void;
  onAssignUser: (userId: string) => void;
  onRemoveUser: (userId: string) => void;
  onAddTask: () => void;
  onEditTemplate: () => void;
  onDeleteTemplate?: () => void;
  onToggleTaskComplete?: (taskId: string, completed: boolean) => void;
  onEditTask?: (task: TemplateTask) => void;
  onReassignTask?: (task: TemplateTask) => void;
  onDeleteTask?: (taskId: string) => void;
  onUpdateTaskNotes?: (taskId: string, notes: string, files?: string[]) => void;
}

const getInitials = (name: string) => {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

const getTechnologyColor = (technology: string) => {
  const colors = {
    'React': 'bg-blue-500',
    'Node.js': 'bg-green-500',
    'Python': 'bg-yellow-500',
    'Java': 'bg-red-500',
    'JavaScript': 'bg-purple-500',
    'TypeScript': 'bg-indigo-500',
    'PHP': 'bg-pink-500',
    'C#': 'bg-orange-500',
    'Go': 'bg-teal-500',
    'Rust': 'bg-gray-500',
  };
  return colors[technology as keyof typeof colors] || 'bg-slate-500';
};

const getProgress = (tasks: TemplateTask[]) => {
  if (tasks.length === 0) return 0;
  const completedTasks = tasks.filter(task => task.completed || task.status === 'completed').length;
  return Math.round((completedTasks / tasks.length) * 100);
};

export const TemplateCard = ({
  template,
  assignedUsers,
  tasks,
  unassignedUsers,
  isExpanded,
  isAdmin,
  onToggleExpanded,
  onAssignUser,
  onRemoveUser,
  onAddTask,
  onEditTemplate,
  onDeleteTemplate,
  onToggleTaskComplete,
  onEditTask,
  onReassignTask,
  onDeleteTask,
  onUpdateTaskNotes,
}: TemplateCardProps) => {
  const progress = getProgress(tasks);
  const completedTasks = tasks.filter(task => task.completed || task.status === 'completed').length;
  
  // State for multi-select user assignment dialog
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Filter unassigned users based on search
  const filteredUnassignedUsers = unassignedUsers.filter(user => 
    user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const handleAssignUsers = () => {
    selectedUserIds.forEach(userId => {
      onAssignUser(userId);
    });
    setSelectedUserIds([]);
    setSearchQuery("");
    setIsAssignDialogOpen(false);
  };
  
  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };
  
  return (
    <Card className="group hover:shadow-lg transition-all duration-300 border-0 bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-4 flex-1">
            <div className={`w-16 h-16 rounded-2xl ${getTechnologyColor(template.technology)} flex items-center justify-center text-white font-bold text-lg shadow-lg`}>
              <BookOpen className="h-8 w-8" />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-xl font-bold text-gray-900 dark:text-white mb-2 line-clamp-1">
                {template.name}
              </CardTitle>
              <CardDescription className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                {template.description || "No description available"}
              </CardDescription>
              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                  {template.technology}
                </Badge>
                <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                  <Users className="h-4 w-4 mr-1" />
                  {assignedUsers.length} user{assignedUsers.length !== 1 ? 's' : ''}
                </div>
                <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                  <TrendingUp className="h-4 w-4 mr-1" />
                  {completedTasks}/{tasks.length} completed
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {isAdmin && (
              <>
                <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="shadow-sm bg-gradient-to-r from-blue-50 to-purple-50 hover:from-blue-100 hover:to-purple-100 border-blue-200"
                    >
                      <UserPlus className="h-4 w-4 mr-1" />
                      Assign Users
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[500px] max-h-[80vh]">
                    <DialogHeader>
                      <DialogTitle className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                        Assign Users to {template.name}
                      </DialogTitle>
                    </DialogHeader>
                    
                    <div className="space-y-4">
                      {/* Search Input */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search users..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-9 bg-background"
                        />
                      </div>
                      
                      {/* Selected Count */}
                      {selectedUserIds.length > 0 && (
                        <div className="flex items-center justify-between px-3 py-2 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                            {selectedUserIds.length} user{selectedUserIds.length !== 1 ? 's' : ''} selected
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedUserIds([])}
                            className="h-7 text-blue-600 hover:text-blue-700 hover:bg-blue-100"
                          >
                            Clear
                          </Button>
                        </div>
                      )}
                      
                      {/* Users List */}
                      <ScrollArea className="h-[320px] pr-4">
                        {filteredUnassignedUsers.length > 0 ? (
                          <div className="space-y-2">
                            {filteredUnassignedUsers.map((member) => (
                              <div
                                key={member.user_id}
                                onClick={() => toggleUserSelection(member.user_id)}
                                className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-accent hover:border-primary/50 cursor-pointer transition-all duration-200 group"
                              >
                                <Checkbox
                                  checked={selectedUserIds.includes(member.user_id)}
                                  onCheckedChange={() => toggleUserSelection(member.user_id)}
                                  className="border-2"
                                />
                                <Avatar className="h-10 w-10 ring-2 ring-background group-hover:ring-primary/20">
                                  <AvatarFallback className="text-sm font-semibold bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                                    {getInitials(member.full_name || member.email)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                                    {member.full_name || 'No name'}
                                  </div>
                                  <div className="text-xs text-muted-foreground truncate">
                                    {member.email}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-12 text-center">
                            <Users className="h-12 w-12 text-muted-foreground/50 mb-3" />
                            <p className="text-sm font-medium text-muted-foreground">
                              {searchQuery ? 'No users found' : 'All users are already assigned'}
                            </p>
                            {searchQuery && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Try a different search term
                              </p>
                            )}
                          </div>
                        )}
                      </ScrollArea>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex items-center justify-end space-x-2 pt-4 border-t">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setIsAssignDialogOpen(false);
                          setSelectedUserIds([]);
                          setSearchQuery("");
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleAssignUsers}
                        disabled={selectedUserIds.length === 0}
                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        Assign {selectedUserIds.length > 0 ? `(${selectedUserIds.length})` : ''}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="shadow-sm">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={onEditTemplate} className="cursor-pointer">
                      Edit Template
                    </DropdownMenuItem>
                    {onDeleteTemplate && (
                      <DropdownMenuItem onClick={onDeleteTemplate} className="cursor-pointer text-red-600">
                        Delete Template
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
            
            <Collapsible open={isExpanded} onOpenChange={onToggleExpanded}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="shadow-sm">
                  <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                </Button>
              </CollapsibleTrigger>
            </Collapsible>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Progress</span>
            <span className="text-sm font-semibold text-gray-900 dark:text-white">{progress}%</span>
          </div>
          <Progress 
            value={progress} 
            className="h-2 bg-gray-200 dark:bg-gray-700" 
          />
        </div>
      </CardHeader>

      <Collapsible open={isExpanded} onOpenChange={onToggleExpanded}>
        <CollapsibleContent>
          <CardContent className="pt-0">
            {/* Assigned Users Section */}
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                <Users className="h-4 w-4 mr-2" />
                Assigned Users ({assignedUsers.length})
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {assignedUsers.map((user) => {
                  const userTasks = tasks.filter(task => task.user_id === user.user_id);
                  const userProgress = getProgress(userTasks);
                  
                  return (
                    <div key={user.user_id} className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-sm bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                              {getInitials(user.full_name || user.email)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium text-sm">{user.full_name}</div>
                            <div className="text-xs text-gray-500">{user.email}</div>
                          </div>
                        </div>
                        {isAdmin && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                <Settings className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem 
                                onClick={() => onRemoveUser(user.user_id)}
                                className="cursor-pointer text-red-600"
                              >
                                Remove from template
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-600 dark:text-gray-400">
                          {userTasks.filter(t => t.completed || t.status === 'completed').length}/{userTasks.length} tasks
                        </span>
                        <span className="font-semibold text-blue-600 dark:text-blue-400">{userProgress}%</span>
                      </div>
                      <Progress value={userProgress} className="h-1 mt-1" />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tasks Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center">
                  <Calendar className="h-4 w-4 mr-2" />
                  Tasks ({tasks.length})
                </h4>
                {isAdmin && (
                  <Button onClick={onAddTask} size="sm" variant="outline" className="shadow-sm">
                    <Plus className="h-4 w-4 mr-1" />
                    Add Task
                  </Button>
                )}
              </div>
              
              {tasks.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No tasks created yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {tasks.map((task) => {
                    const assignedUser = assignedUsers.find(u => u.user_id === task.user_id);
                    const [isTaskExpanded, setIsTaskExpanded] = React.useState(false);
                    
                    return (
                      <Card key={task.id} className="hover:shadow-md transition-all duration-200 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                        <CardContent className="p-3">
                          {/* Collapsed View */}
                          <div 
                            className="flex items-center justify-between cursor-pointer"
                            onClick={() => setIsTaskExpanded(!isTaskExpanded)}
                          >
                            <div className="flex items-center space-x-3 flex-1">
                              {onToggleTaskComplete && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleTaskComplete(task.id, task.completed);
                                  }}
                                  className="h-6 w-6 p-0"
                                >
                                  {task.completed || task.status === 'completed' ? (
                                    <CheckSquare className="h-5 w-5 text-green-600" />
                                  ) : (
                                    <div className="h-5 w-5 border-2 border-gray-300 rounded" />
                                  )}
                                </Button>
                              )}
                              
                              <div className="flex-1 min-w-0">
                                <h3 className={`text-sm font-semibold truncate ${
                                  task.completed || task.status === 'completed' ? 'line-through text-gray-500' : 'text-gray-900 dark:text-white'
                                }`}>
                                  {task.title}
                                </h3>
                                <div className="flex items-center space-x-2 mt-1 text-xs text-gray-500">
                                  <span>Created {format(new Date(task.created_at), 'MMM dd, yyyy')}</span>
                                  {assignedUser && (
                                    <>
                                      <span>•</span>
                                      <span>{assignedUser.full_name}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              
                              <div className="flex items-center space-x-2">
                                <Badge 
                                  variant={task.priority === 'high' ? 'destructive' : task.priority === 'medium' ? 'default' : 'secondary'} 
                                  className="text-xs"
                                >
                                  {task.priority}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  <BookOpen className="h-3 w-3 mr-1" />
                                  Template
                                </Badge>
                              </div>
                              
                              {isTaskExpanded ? (
                                <ChevronRight className="h-4 w-4 rotate-90 transition-transform" />
                              ) : (
                                <ChevronRight className="h-4 w-4 transition-transform" />
                              )}
                            </div>
                          </div>

                          {/* Expanded View */}
                          {isTaskExpanded && (
                            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                              {/* Header with Actions */}
                              <div className="flex items-start justify-between mb-4">
                                <div className="flex-1">
                                  <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                                    {task.title}
                                  </h2>
                                  <div className="flex items-center space-x-2">
                                    <Badge variant={task.priority === 'high' ? 'destructive' : task.priority === 'medium' ? 'default' : 'secondary'}>
                                      {task.priority}
                                    </Badge>
                                    {(task.completed || task.status === 'completed') && (
                                      <Badge variant="default" className="bg-green-100 text-green-800">
                                        <CheckSquare className="mr-1 h-3 w-3" />
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
                                  {onToggleTaskComplete && (
                                    <Button
                                      variant={(task.completed || task.status === 'completed') ? "outline" : "default"}
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onToggleTaskComplete(task.id, task.completed);
                                      }}
                                    >
                                      {(task.completed || task.status === 'completed') ? (
                                        <>
                                          <X className="mr-1 h-4 w-4" />
                                          Mark Incomplete
                                        </>
                                      ) : (
                                        <>
                                          <CheckSquare className="mr-1 h-4 w-4" />
                                          Mark Complete
                                        </>
                                      )}
                                    </Button>
                                  )}
                                  {isAdmin && onEditTask && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => onEditTask(task)}
                                    >
                                      <Edit className="mr-1 h-4 w-4" />
                                      Edit
                                    </Button>
                                  )}
                                </div>
                              </div>

                              {/* Responsibilities/Description */}
                              {task.description && (
                                <div className="mb-4">
                                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                                    Responsibilities / Details
                                  </h3>
                                  <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
                                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                                      {task.description}
                                    </p>
                                  </div>
                                </div>
                              )}

                              {/* Actions Section */}
                              <div className="space-y-4">
                                {/* Notes Section */}
                                {isAdmin && (
                                  <div>
                                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                                      Notes
                                    </h3>
                                    <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                                      <TaskNotes
                                        taskId={task.id}
                                        taskTitle={task.title}
                                        assignedUsers={assignedUser ? [{
                                          user_id: assignedUser.user_id,
                                          full_name: assignedUser.full_name,
                                          email: assignedUser.email
                                        }] : []}
                                        isAdmin={isAdmin}
                                      />
                                    </div>
                                  </div>
                                )}

                                {/* Communication Section */}
                                {isAdmin && (
                                  <div>
                                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                                      Communication
                                    </h3>
                                    <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                                      <TaskChat
                                        taskId={task.id}
                                        taskTitle={task.title}
                                        assignedUsers={assignedUsers}
                                        isAdmin={isAdmin}
                                      />
                                    </div>
                                  </div>
                                )}

                                {/* Delete Button - At Bottom for Admins */}
                                {isAdmin && onDeleteTask && (
                                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      onClick={() => onDeleteTask(task.id)}
                                      className="w-full"
                                    >
                                      <Trash2 className="mr-1 h-4 w-4" />
                                      Delete Task
                                    </Button>
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
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};