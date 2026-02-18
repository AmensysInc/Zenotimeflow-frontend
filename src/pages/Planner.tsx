import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Calendar, Clock, Target, Plus, Settings } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import apiClient from '@/lib/api-client';
import { toast } from 'sonner';

interface FocusBlock {
  id: string;
  title: string;
  duration: number;
  category: string;
  priority: 'low' | 'medium' | 'high';
  scheduled_time?: string;
  completed: boolean;
  date: string;
}

interface WeeklyGoal {
  id: string;
  title: string;
  target_hours: number;
  current_hours: number;
  category: string;
}

const Planner = () => {
  const { user } = useAuth();
  const [focusBlocks, setFocusBlocks] = useState<FocusBlock[]>([]);
  const [weeklyGoals, setWeeklyGoals] = useState<WeeklyGoal[]>([]);
  const [isAddingBlock, setIsAddingBlock] = useState(false);
  const [isAddingGoal, setIsAddingGoal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const [newBlock, setNewBlock] = useState({
    title: '',
    duration: 60,
    category: 'work',
    priority: 'medium' as const,
    scheduled_time: ''
  });

  const [newGoal, setNewGoal] = useState({
    title: '',
    target_hours: 20,
    category: 'focus'
  });

  const categories = [
    { value: 'work', label: 'Work', color: 'bg-blue-500' },
    { value: 'personal', label: 'Personal', color: 'bg-green-500' },
    { value: 'learning', label: 'Learning', color: 'bg-purple-500' },
    { value: 'health', label: 'Health', color: 'bg-red-500' }
  ];

  const priorities = [
    { value: 'low', label: 'Low', color: 'bg-gray-500' },
    { value: 'medium', label: 'Medium', color: 'bg-yellow-500' },
    { value: 'high', label: 'High', color: 'bg-red-500' }
  ];

  useEffect(() => {
    if (user) {
      loadFocusBlocks();
      loadWeeklyGoals();
    }
  }, [user, selectedDate]);

  const loadFocusBlocks = async () => {
    try {
      const nextDate = new Date(new Date(selectedDate).getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const sessions = await apiClient.get<any[]>('/focus/sessions/', { 
        user: user?.id,
        start_time__gte: `${selectedDate}T00:00:00`,
        start_time__lt: `${nextDate}T00:00:00`
      });

      const blocks = sessions.map((session: any) => ({
        id: session.id,
        title: session.notes || 'Focus Session',
        duration: session.duration || 60,
        category: 'work',
        priority: 'medium' as const,
        scheduled_time: session.start_time,
        completed: !!session.end_time,
        date: selectedDate
      })) || [];

      setFocusBlocks(blocks);
    } catch (error) {
      console.error('Error loading focus blocks:', error);
    }
  };

  const loadWeeklyGoals = async () => {
    // Mock data for weekly goals since we don't have a dedicated table
    setWeeklyGoals([
      {
        id: '1',
        title: 'Focus Time',
        target_hours: 20,
        current_hours: 14,
        category: 'focus'
      },
      {
        id: '2',
        title: 'Deep Work',
        target_hours: 15,
        current_hours: 8,
        category: 'work'
      }
    ]);
  };

  const createFocusBlock = async () => {
    if (!newBlock.title.trim()) {
      toast.error('Please enter a title for the focus block');
      return;
    }

    try {
      const startTime = newBlock.scheduled_time 
        ? `${selectedDate}T${newBlock.scheduled_time}:00`
        : new Date().toISOString();

      const data = await apiClient.post('/focus/sessions/', {
        title: newBlock.title,
        user: user?.id,
        start_time: startTime,
        end_time: new Date(new Date(startTime).getTime() + newBlock.duration * 60 * 1000).toISOString(),
        duration: newBlock.duration,
        notes: newBlock.title,
        productivity_score: 0,
        interruptions: 0,
      });

      const focusBlock: FocusBlock = {
        id: data.id,
        title: newBlock.title,
        duration: newBlock.duration,
        category: newBlock.category,
        priority: newBlock.priority,
        scheduled_time: startTime,
        completed: false,
        date: selectedDate
      };

      setFocusBlocks([...focusBlocks, focusBlock]);
      setNewBlock({
        title: '',
        duration: 60,
        category: 'work',
        priority: 'medium',
        scheduled_time: ''
      });
      setIsAddingBlock(false);
      toast.success('Focus block created successfully');
    } catch (error) {
      console.error('Error creating focus block:', error);
      toast.error('Failed to create focus block');
    }
  };

  const toggleBlockCompletion = async (blockId: string) => {
    const block = focusBlocks.find(b => b.id === blockId);
    if (!block) return;

    try {
      await apiClient.patch(`/focus/sessions/${blockId}/`, {
        end_time: block.completed ? null : new Date().toISOString()
      });

      setFocusBlocks(focusBlocks.map(b => 
        b.id === blockId ? { ...b, completed: !b.completed } : b
      ));
      
      toast.success(block.completed ? 'Focus block reopened' : 'Focus block completed');
    } catch (error) {
      console.error('Error updating focus block:', error);
      toast.error('Failed to update focus block');
    }
  };

  const getUpcomingBlocks = () => {
    return focusBlocks
      .filter(block => !block.completed && block.scheduled_time)
      .sort((a, b) => new Date(a.scheduled_time!).getTime() - new Date(b.scheduled_time!).getTime())
      .slice(0, 3);
  };

  const getTodayStats = () => {
    const totalBlocks = focusBlocks.length;
    const completedBlocks = focusBlocks.filter(b => b.completed).length;
    const totalHours = focusBlocks.reduce((sum, b) => sum + b.duration, 0) / 60;
    const completedHours = focusBlocks.filter(b => b.completed).reduce((sum, b) => sum + b.duration, 0) / 60;

    return { totalBlocks, completedBlocks, totalHours, completedHours };
  };

  const stats = getTodayStats();

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Planner</h1>
            <p className="text-muted-foreground">Protect time. Get focused.</p>
          </div>
          <div className="flex items-center gap-4">
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-auto"
            />
            <Dialog open={isAddingBlock} onOpenChange={setIsAddingBlock}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Focus Block
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Focus Block</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      value={newBlock.title}
                      onChange={(e) => setNewBlock({ ...newBlock, title: e.target.value })}
                      placeholder="e.g., Deep work on project"
                    />
                  </div>
                  <div>
                    <Label htmlFor="duration">Duration (minutes)</Label>
                    <Input
                      id="duration"
                      type="number"
                      value={newBlock.duration}
                      onChange={(e) => setNewBlock({ ...newBlock, duration: parseInt(e.target.value) })}
                      min="15"
                      max="480"
                    />
                  </div>
                  <div>
                    <Label htmlFor="time">Scheduled Time (optional)</Label>
                    <Input
                      id="time"
                      type="time"
                      value={newBlock.scheduled_time}
                      onChange={(e) => setNewBlock({ ...newBlock, scheduled_time: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="category">Category</Label>
                    <Select value={newBlock.category} onValueChange={(value) => setNewBlock({ ...newBlock, category: value })}>
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
                  <div>
                    <Label htmlFor="priority">Priority</Label>
                    <Select value={newBlock.priority} onValueChange={(value: any) => setNewBlock({ ...newBlock, priority: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {priorities.map(pri => (
                          <SelectItem key={pri.value} value={pri.value}>{pri.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={createFocusBlock} className="w-full">
                    Create Focus Block
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Today's Focus</p>
                  <p className="text-2xl font-bold">{stats.completedHours.toFixed(1)}h</p>
                </div>
                <Clock className="w-8 h-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Blocks Completed</p>
                  <p className="text-2xl font-bold">{stats.completedBlocks}/{stats.totalBlocks}</p>
                </div>
                <Target className="w-8 h-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Completion Rate</p>
                  <p className="text-2xl font-bold">{stats.totalBlocks > 0 ? Math.round((stats.completedBlocks / stats.totalBlocks) * 100) : 0}%</p>
                </div>
                <Calendar className="w-8 h-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Planned Hours</p>
                  <p className="text-2xl font-bold">{stats.totalHours.toFixed(1)}h</p>
                </div>
                <Settings className="w-8 h-8 text-primary" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Focus Blocks */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Today's Focus Blocks</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {focusBlocks.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No focus blocks scheduled for today</p>
                      <p className="text-sm">Create your first focus block to get started</p>
                    </div>
                  ) : (
                    focusBlocks.map(block => (
                      <div key={block.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex items-center space-x-3">
                          <div className={`w-3 h-3 rounded-full ${categories.find(c => c.value === block.category)?.color || 'bg-gray-500'}`} />
                          <div>
                            <h4 className="font-medium">{block.title}</h4>
                            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                              <span>{block.duration} min</span>
                              {block.scheduled_time && (
                                <span>• {new Date(block.scheduled_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant={block.priority === 'high' ? 'destructive' : block.priority === 'medium' ? 'default' : 'secondary'}>
                            {block.priority}
                          </Badge>
                          <Button
                            variant={block.completed ? "secondary" : "outline"}
                            size="sm"
                            onClick={() => toggleBlockCompletion(block.id)}
                          >
                            {block.completed ? "Completed" : "Start"}
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Weekly Goals */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Weekly Goals</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {weeklyGoals.map(goal => (
                    <div key={goal.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">{goal.title}</h4>
                        <span className="text-sm text-muted-foreground">
                          {goal.current_hours}h / {goal.target_hours}h
                        </span>
                      </div>
                      <Progress 
                        value={(goal.current_hours / goal.target_hours) * 100} 
                        className="h-2"
                      />
                    </div>
                  ))}
                  
                  <Dialog open={isAddingGoal} onOpenChange={setIsAddingGoal}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full mt-4">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Goal
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create Weekly Goal</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="goal-title">Title</Label>
                          <Input
                            id="goal-title"
                            value={newGoal.title}
                            onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })}
                            placeholder="e.g., Deep Work Sessions"
                          />
                        </div>
                        <div>
                          <Label htmlFor="target-hours">Target Hours</Label>
                          <Input
                            id="target-hours"
                            type="number"
                            value={newGoal.target_hours}
                            onChange={(e) => setNewGoal({ ...newGoal, target_hours: parseInt(e.target.value) })}
                            min="1"
                            max="80"
                          />
                        </div>
                        <Button onClick={() => setIsAddingGoal(false)} className="w-full">
                          Create Goal
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>

            {/* Upcoming Blocks */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Upcoming</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {getUpcomingBlocks().length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No upcoming blocks scheduled
                    </p>
                  ) : (
                    getUpcomingBlocks().map(block => (
                      <div key={block.id} className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{block.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {block.scheduled_time && new Date(block.scheduled_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <Badge variant="outline">{block.duration}m</Badge>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Planner;