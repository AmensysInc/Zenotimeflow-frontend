import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Calendar, Check, Plus, Flame, Clock, Users, Edit, Trash2, StickyNote, ChevronLeft, ChevronRight, RotateCcw, Target } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import apiClient from '@/lib/api-client';
import { toast } from 'sonner';
import { format, isToday } from 'date-fns';

interface Habit {
  id: string;
  title: string;
  description?: string;
  category: string;
  frequency: 'daily' | 'weekly';
  target_count: number;
  current_streak: number;
  best_streak: number;
  created_at: string;
  color: string;
  notes?: string;
  start_date?: string;
  start_time?: string;
  end_date?: string;
}

interface HabitCompletion {
  id: string;
  habit_id: string;
  date: string;
  completed: boolean;
}

const Habits = () => {
  const { user } = useAuth();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [completions, setCompletions] = useState<HabitCompletion[]>([]);
  const [isAddingHabit, setIsAddingHabit] = useState(false);
  const [isEditingHabit, setIsEditingHabit] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [users, setUsers] = useState<Array<{ id: string; full_name: string; email: string }>>([]);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedWeekDate, setSelectedWeekDate] = useState<string | null>(null);
  const [isNotesDialogOpen, setIsNotesDialogOpen] = useState(false);
  const [currentHabitForNotes, setCurrentHabitForNotes] = useState<Habit | null>(null);
  const [habitNotes, setHabitNotes] = useState('');
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    return weekStart;
  });

  const [newHabit, setNewHabit] = useState({
    title: '',
    description: '',
    category: 'health',
    frequency: 'daily' as const,
    target_count: 1,
    color: '#10b981',
    notes: '',
        start_date: new Date().toISOString().split('T')[0],
        end_date: ''
  });

  const [editHabitForm, setEditHabitForm] = useState({
    title: '',
    description: '',
    category: 'health',
    frequency: 'daily' as 'daily' | 'weekly',
    target_count: 1,
    color: '#10b981',
        start_date: '',
        end_date: ''
  });

  const categories = [
    { value: 'health', label: 'Health & Fitness', color: '#10b981' },
    { value: 'productivity', label: 'Productivity', color: '#3b82f6' },
    { value: 'learning', label: 'Learning', color: '#8b5cf6' },
    { value: 'mindfulness', label: 'Mindfulness', color: '#f59e0b' },
    { value: 'social', label: 'Social', color: '#ef4444' },
    { value: 'creative', label: 'Creative', color: '#ec4899' }
  ];

  const colors = [
    '#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899',
    '#14b8a6', '#6366f1', '#84cc16', '#f97316', '#06b6d4', '#a855f7'
  ];

  useEffect(() => {
    if (user) {
      const initializeData = async () => {
        await checkUserRole();
        loadHabits();
        loadCompletions();
      };
      initializeData();
    }
  }, [user, selectedUserId]);

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

  const loadHabits = async () => {
    if (!user) return;

    const targetUserId = selectedUserId || user.id;
    
    const habits = await apiClient.get<any[]>('/habits/habits/', { user: targetUserId });
    setHabits(habits.map((habit: any) => ({
      ...habit,
      frequency: habit.frequency as 'daily' | 'weekly'
    })));
    setIsLoading(false);
  };

  const loadCompletions = async () => {
    if (!user) return;

    const targetUserId = selectedUserId || user.id;
    
    const completions = await apiClient.get<any[]>('/habits/completions/', { user: targetUserId });
    setCompletions(completions);
  };

  const createHabit = async () => {
    if (!newHabit.title.trim()) {
      toast.error('Please enter a title for the habit');
      return;
    }

    try {
      await apiClient.post('/habits/habits/', {
        title: newHabit.title,
        description: newHabit.description,
        category: newHabit.category,
        frequency: newHabit.frequency,
        target_count: newHabit.target_count,
        color: newHabit.color,
        notes: newHabit.notes,
        start_date: newHabit.start_date,
        end_date: newHabit.end_date || null,
        user: user?.id
      });
      setNewHabit({
        title: '',
        description: '',
        category: 'health',
        frequency: 'daily',
        target_count: 1,
        color: '#10b981',
        notes: '',
        start_date: new Date().toISOString().split('T')[0],
        end_date: ''
      });
      setIsAddingHabit(false);
      toast.success('Habit created successfully');
      loadHabits();
    }
  };

  const startEditHabit = (habit: Habit) => {
    setEditingHabit(habit);
    setEditHabitForm({
      title: habit.title,
      description: habit.description || '',
      category: habit.category,
      frequency: habit.frequency,
      target_count: habit.target_count,
      color: habit.color,
        start_date: habit.start_date || '',
        end_date: habit.end_date || ''
    });
    setIsEditingHabit(true);
  };

  const updateHabit = async () => {
    if (!editingHabit || !editHabitForm.title.trim()) {
      toast.error('Please enter a title for the habit');
      return;
    }

    try {
      await apiClient.patch(`/habits/habits/${editingHabit.id}/`, {
        title: editHabitForm.title,
        description: editHabitForm.description,
        category: editHabitForm.category,
        frequency: editHabitForm.frequency,
        target_count: editHabitForm.target_count,
        color: editHabitForm.color,
        start_date: editHabitForm.start_date || null,
        end_date: editHabitForm.end_date || null
      });
      setIsEditingHabit(false);
      setEditingHabit(null);
      toast.success('Habit updated successfully');
      loadHabits();
    } catch (error: any) {
      console.error('Error updating habit:', error);
      toast.error('Failed to update habit');
    }
  };

  const deleteHabit = async (habitId: string) => {
    // First delete all completions for this habit
    try {
      const completions = await apiClient.get<any[]>('/habits/completions/', { habit: habitId });
      await Promise.all(completions.map((c: any) => 
        apiClient.delete(`/habits/completions/${c.id}/`)
      ));
    } catch (completionsError: any) {
      console.error('Error deleting habit completions:', completionsError);
      toast.error('Failed to delete habit completions');
      return;
    }

    // Then delete the habit itself
    try {
      await apiClient.delete(`/habits/habits/${habitId}/`);
      toast.success('Habit deleted successfully');
      loadHabits();
      loadCompletions();
    } catch (error: any) {
      console.error('Error deleting habit:', error);
      toast.error('Failed to delete habit');
    }
  };

  const toggleHabitCompletion = async (habitId: string) => {
    if (!user) return;

    const today = new Date().toISOString().split('T')[0];
    const targetUserId = selectedUserId || user.id;
    const existingCompletion = completions.find(c => c.habit_id === habitId && c.date === today);
    
    if (existingCompletion) {
      try {
        await apiClient.patch(`/habits/completions/${existingCompletion.id}/`, { 
          completed: !existingCompletion.completed 
        });
      } catch (error: any) {
        console.error('Error updating completion:', error);
        toast.error('Failed to update habit completion');
        return;
      }
    } else {
      try {
        await apiClient.post('/habits/completions/', {
          habit: habitId,
          user: targetUserId,
          date: today,
          completed: true
        });
      } catch (error: any) {
        console.error('Error creating completion:', error);
        toast.error('Failed to mark habit as complete');
        return;
      }
    }

    // Update streak in habits table
    const habit = habits.find(h => h.id === habitId);
    if (habit) {
      const wasCompleted = existingCompletion?.completed || false;
      const isNowCompleted = !wasCompleted;
      
      try {
        await apiClient.patch(`/habits/habits/${habitId}/`, {
          current_streak: isNowCompleted ? habit.current_streak + 1 : Math.max(0, habit.current_streak - 1),
          best_streak: isNowCompleted && habit.current_streak + 1 > habit.best_streak ? habit.current_streak + 1 : habit.best_streak
        });
      } catch (error: any) {
        console.error('Error updating habit streak:', error);
      }
    }

    toast.success(existingCompletion?.completed ? 'Habit marked as incomplete' : 'Habit completed!');
    loadHabits();
    loadCompletions();
  };

  const getHabitCompletion = (habitId: string, date: string) => {
    return completions.find(c => c.habit_id === habitId && c.date === date)?.completed || false;
  };

  const getWeeklyCalendar = () => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart);
      date.setDate(currentWeekStart.getDate() + i);
      days.push(date);
    }
    return days;
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newWeekStart = new Date(currentWeekStart);
    newWeekStart.setDate(currentWeekStart.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentWeekStart(newWeekStart);
    setSelectedWeekDate(null); // Clear selection when changing weeks
  };

  const toggleWeeklyHabitCompletion = async (habitId: string, date: Date) => {
    if (!user) return;

    const dateStr = date.toISOString().split('T')[0];
    const targetUserId = selectedUserId || user.id;
    const existingCompletion = completions.find(c => c.habit_id === habitId && c.date === dateStr);
    
    if (existingCompletion) {
      try {
        await apiClient.patch(`/habits/completions/${existingCompletion.id}/`, { 
          completed: !existingCompletion.completed 
        });
      } catch (error: any) {
        console.error('Error updating completion:', error);
        toast.error('Failed to update habit completion');
        return;
      }
    } else {
      try {
        await apiClient.post('/habits/completions/', {
          habit: habitId,
          user: targetUserId,
          date: dateStr,
          completed: true
        });
      } catch (error: any) {
        console.error('Error creating completion:', error);
        toast.error('Failed to mark habit as complete');
        return;
      }
    }

    toast.success(existingCompletion?.completed ? 'Day marked as incomplete' : 'Day completed!');
    loadCompletions();
  };

  const openNotesDialog = (habit: Habit) => {
    setCurrentHabitForNotes(habit);
    setHabitNotes(habit.notes || '');
    setIsNotesDialogOpen(true);
  };

  const saveHabitNotes = async () => {
    if (!currentHabitForNotes) return;

    try {
      await apiClient.patch(`/habits/habits/${currentHabitForNotes.id}/`, { notes: habitNotes });
      toast.success('Notes saved successfully');
      setIsNotesDialogOpen(false);
      setCurrentHabitForNotes(null);
      setHabitNotes('');
      loadHabits();
    } catch (error: any) {
      console.error('Error updating habit notes:', error);
      toast.error('Failed to save notes');
    }
  };

  const getDayHabits = (dateStr: string) => {
    // Filter habits that should be active on the given date
    return habits
      .filter(h => {
        // If no start_date is set, show for all days (legacy habits)
        if (!h.start_date) return h.frequency === 'daily';
        
        if (h.frequency === 'daily') {
          // Check if date is before start_date
          if (dateStr < h.start_date) return false;
          
          // Check if date is after end_date (if specified)
          if (h.end_date && dateStr > h.end_date) return false;
          
          // Show habit only within start_date and end_date range
          return true;
        }
        
        return false;
      })
      .map(habit => ({
        ...habit,
        completed: getHabitCompletion(habit.id, dateStr)
      }));
  };

  const weekDays = getWeeklyCalendar();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header with modern gradient */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4 border border-border/50">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-50"></div>
          <div className="relative flex items-center justify-between">
            <div className="space-y-1">
              <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                Daily Routines
              </h1>
              <p className="text-sm text-muted-foreground">Fuel your daily motivation and build powerful routines</p>
              {selectedUserId && userRole && (userRole === 'manager' || userRole === 'super_admin') && (
                <div className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
                  <Users className="w-4 h-4 mr-2 text-primary" />
                  <span className="text-sm text-primary font-medium">
                    Viewing: {users.find(u => u.id === selectedUserId)?.full_name}
                  </span>
                </div>
              )}
            </div>
            {(!selectedUserId || selectedUserId === user?.id) && (
              <Dialog open={isAddingHabit} onOpenChange={setIsAddingHabit}>
                <DialogTrigger asChild>
                  <Button size="default" className="group relative overflow-hidden bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 transition-all duration-300">
                    <Plus className="w-4 h-4 mr-2" />
                    <span className="font-medium">New Habit</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-bold">
                      Create New Habit
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="space-y-1">
                      <Label htmlFor="title" className="text-sm font-medium">Title</Label>
                      <Input
                        id="title"
                        value={newHabit.title}
                        onChange={(e) => setNewHabit({ ...newHabit, title: e.target.value })}
                        placeholder="e.g., Morning Exercise"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="description" className="text-sm font-medium">Description (optional)</Label>
                      <Input
                        id="description"
                        value={newHabit.description}
                        onChange={(e) => setNewHabit({ ...newHabit, description: e.target.value })}
                        placeholder="e.g., 30 minutes of cardio"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="category" className="text-sm font-medium">Category</Label>
                        <Select value={newHabit.category} onValueChange={(value) => setNewHabit({ ...newHabit, category: value })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map(cat => (
                              <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="frequency" className="text-sm font-medium">Frequency</Label>
                        <Select value={newHabit.frequency} onValueChange={(value: any) => setNewHabit({ ...newHabit, frequency: value })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="start-date" className="text-sm font-medium">Start Date</Label>
                        <Input
                          id="start-date"
                          type="date"
                          value={newHabit.start_date}
                          onChange={(e) => setNewHabit({ ...newHabit, start_date: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="end-date" className="text-sm font-medium">End Date (optional)</Label>
                        <Input
                          id="end-date"
                          type="date"
                          value={newHabit.end_date}
                          onChange={(e) => setNewHabit({ ...newHabit, end_date: e.target.value })}
                          min={newHabit.start_date}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="notes" className="text-sm font-medium">Notes (optional)</Label>
                      <Textarea
                        id="notes"
                        value={newHabit.notes}
                        onChange={(e) => setNewHabit({ ...newHabit, notes: e.target.value })}
                        placeholder="Any additional notes about this habit..."
                        rows={2}
                        className="resize-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Color</Label>
                      <div className="flex flex-wrap gap-2">
                        {colors.map(color => (
                          <button
                            key={color}
                            className={`w-8 h-8 rounded-full border-2 transition-all duration-200 hover:scale-110 ${
                              newHabit.color === color 
                                ? 'border-foreground shadow-lg scale-110' 
                                : 'border-border/30 hover:border-border/60'
                            }`}
                            style={{ backgroundColor: color }}
                            onClick={() => setNewHabit({ ...newHabit, color })}
                          />
                        ))}
                      </div>
                    </div>
                    <Button 
                      onClick={createHabit} 
                      className="w-full"
                    >
                      Create Habit
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {/* Edit Habit Dialog */}
        <Dialog open={isEditingHabit} onOpenChange={setIsEditingHabit}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">
                Edit Habit
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1">
                <Label htmlFor="edit-title" className="text-sm font-medium">Title</Label>
                <Input
                  id="edit-title"
                  value={editHabitForm.title}
                  onChange={(e) => setEditHabitForm({ ...editHabitForm, title: e.target.value })}
                  placeholder="e.g., Morning Exercise"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-description" className="text-sm font-medium">Description (optional)</Label>
                <Input
                  id="edit-description"
                  value={editHabitForm.description}
                  onChange={(e) => setEditHabitForm({ ...editHabitForm, description: e.target.value })}
                  placeholder="e.g., 30 minutes of cardio"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="edit-category" className="text-sm font-medium">Category</Label>
                  <Select value={editHabitForm.category} onValueChange={(value) => setEditHabitForm({ ...editHabitForm, category: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => (
                        <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-frequency" className="text-sm font-medium">Frequency</Label>
                  <Select value={editHabitForm.frequency} onValueChange={(value: any) => setEditHabitForm({ ...editHabitForm, frequency: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="edit-start-date" className="text-sm font-medium">Start Date</Label>
                  <Input
                    id="edit-start-date"
                    type="date"
                    value={editHabitForm.start_date}
                    onChange={(e) => setEditHabitForm({ ...editHabitForm, start_date: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-end-date" className="text-sm font-medium">End Date (optional)</Label>
                  <Input
                    id="edit-end-date"
                    type="date"
                    value={editHabitForm.end_date}
                    onChange={(e) => setEditHabitForm({ ...editHabitForm, end_date: e.target.value })}
                    min={editHabitForm.start_date}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Color</Label>
                <div className="flex flex-wrap gap-2">
                  {colors.map(color => (
                    <button
                      key={color}
                      className={`w-8 h-8 rounded-full border-2 transition-all duration-200 hover:scale-110 ${
                        editHabitForm.color === color 
                          ? 'border-foreground shadow-lg scale-110' 
                          : 'border-border/30 hover:border-border/60'
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => setEditHabitForm({ ...editHabitForm, color })}
                    />
                  ))}
                </div>
              </div>
              <Button 
                onClick={updateHabit} 
                className="w-full"
              >
                Update Habit
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* All Habits List */}
        <div className="space-y-4">
          {habits.map((habit) => {
            const isCompleted = getHabitCompletion(habit.id, format(new Date(), 'yyyy-MM-dd'));
            
            return (
              <Card key={habit.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: habit.color }}
                    />
                    <div className={isCompleted ? 'line-through opacity-60' : ''}>
                      <h3 className="text-base font-medium">{habit.title}</h3>
                      {habit.description && (
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {habit.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>Created {format(new Date(habit.created_at), 'MMM dd, yyyy')}</span>
                        {habit.start_date && (
                          <span>Start: {habit.start_date}</span>
                        )}
                        {habit.end_date && (
                          <span>End: {habit.end_date}</span>
                        )}
                      </div>
                      {habit.start_date && habit.start_date > format(new Date(), 'yyyy-MM-dd') && (
                        <div className="mt-2 text-sm text-blue-600 dark:text-blue-400">
                          Next: {format(new Date(habit.start_date + 'T00:00:00'), 'EEE, MMM d')}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant={isCompleted ? "secondary" : "default"}
                      size="sm"
                      onClick={() => toggleHabitCompletion(habit.id)}
                    >
                      {isCompleted ? (
                        <>
                          <RotateCcw className="h-4 w-4 mr-1" />
                          Undo
                        </>
                      ) : (
                        <>
                          <Check className="h-4 w-4 mr-1" />
                          Complete
                        </>
                      )}
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startEditHabit(habit)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Habit</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{habit.title}"? This action cannot be undone and will delete all completion history.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteHabit(habit.id)} className="bg-red-600 hover:bg-red-700">
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </Card>
            );
          })}
          
          {habits.length === 0 && (
            <Card className="p-8 text-center">
              <Target className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">No habits created yet</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                Create your first habit to get started
              </p>
            </Card>
          )}
        </div>

        {/* Notes Dialog */}
        <Dialog open={isNotesDialogOpen} onOpenChange={setIsNotesDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">
                Notes for "{currentHabitForNotes?.title}"
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Textarea
                value={habitNotes}
                onChange={(e) => setHabitNotes(e.target.value)}
                placeholder="Add notes about this habit..."
                rows={6}
                className="border-2 focus:border-primary/50 transition-colors resize-none"
                readOnly
              />
              <div className="text-sm text-muted-foreground">
                These notes are read-only. You can view but not edit them here.
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Habits;
