import { useState, useEffect } from "react";
import { FileText, CheckCircle, Clock, AlertCircle, Users, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
// Supabase removed - using Django API
import { format, parseISO, isPast, isToday } from "date-fns";

interface AdminTasksOverviewProps {
  companyId?: string;
}

export default function AdminTasksOverview({ companyId }: AdminTasksOverviewProps) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed' | 'overdue'>('all');
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');

  useEffect(() => {
    const fetchEmployees = async () => {
      if (!companyId) return;
      
      const data = await apiClient.get<any[]>('/scheduler/employees/', {
        company: companyId,
        status: 'active'
      });
      
      setEmployees(data || []);
    };
    
    fetchEmployees();
  }, [companyId]);

  useEffect(() => {
    const fetchTasks = async () => {
      setLoading(true);
      
      // Get user IDs from employees
      const userIds = employees
        .filter(e => e.user_id)
        .map(e => e.user_id);
      
      if (userIds.length === 0) {
        setTasks([]);
        setLoading(false);
        return;
      }
      
      const tasks = await apiClient.get<any[]>('/calendar/events/', {
        user__in: userIds.join(','),
        event_type: 'task'
      });
      
      // Enrich with employee data
      const enrichedTasks = tasks.map((task: any) => {
        const employee = employees.find((e: any) => e.user_id === task.user);
        return {
          ...task,
          employee_name: employee 
            ? `${employee.first_name} ${employee.last_name}`
            : 'Unknown',
        };
      }).sort((a: any, b: any) => 
        new Date(a.start_time || 0).getTime() - new Date(b.start_time || 0).getTime()
      );
        setTasks(enrichedTasks);
      }
      setLoading(false);
    };
    
    if (employees.length > 0) {
      fetchTasks();
    }
  }, [employees]);

  const getStatusInfo = (task: any) => {
    if (task.completed) {
      return { label: 'Completed', color: 'bg-green-500', icon: CheckCircle };
    }
    
    const dueDate = task.end_time ? parseISO(task.end_time) : null;
    if (dueDate && isPast(dueDate)) {
      return { label: 'Overdue', color: 'bg-red-500', icon: AlertCircle };
    }
    if (dueDate && isToday(dueDate)) {
      return { label: 'Due Today', color: 'bg-amber-500', icon: Clock };
    }
    
    return { label: 'Pending', color: 'bg-blue-500', icon: Clock };
  };

  const filteredTasks = tasks.filter(task => {
    // Employee filter
    if (selectedEmployee !== 'all') {
      const employee = employees.find(e => e.id === selectedEmployee);
      if (!employee || task.user_id !== employee.user_id) return false;
    }
    
    // Status filter
    if (filter === 'pending') return !task.completed;
    if (filter === 'completed') return task.completed;
    if (filter === 'overdue') {
      const dueDate = task.end_time ? parseISO(task.end_time) : null;
      return !task.completed && dueDate && isPast(dueDate);
    }
    return true;
  });

  const stats = {
    total: tasks.length,
    pending: tasks.filter(t => !t.completed).length,
    completed: tasks.filter(t => t.completed).length,
    overdue: tasks.filter(t => {
      const dueDate = t.end_time ? parseISO(t.end_time) : null;
      return !t.completed && dueDate && isPast(dueDate);
    }).length,
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            All Employee Tasks
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Employees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                {employees.map(emp => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.first_name} {emp.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <button
            onClick={() => setFilter('all')}
            className={`text-center p-4 rounded-lg transition-colors ${
              filter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted/50 hover:bg-muted'
            }`}
          >
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm opacity-80">Total</div>
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`text-center p-4 rounded-lg transition-colors ${
              filter === 'pending' ? 'bg-blue-500 text-white' : 'bg-muted/50 hover:bg-muted'
            }`}
          >
            <div className="text-2xl font-bold">{stats.pending}</div>
            <div className="text-sm opacity-80">Pending</div>
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`text-center p-4 rounded-lg transition-colors ${
              filter === 'completed' ? 'bg-green-500 text-white' : 'bg-muted/50 hover:bg-muted'
            }`}
          >
            <div className="text-2xl font-bold">{stats.completed}</div>
            <div className="text-sm opacity-80">Completed</div>
          </button>
          <button
            onClick={() => setFilter('overdue')}
            className={`text-center p-4 rounded-lg transition-colors ${
              filter === 'overdue' ? 'bg-red-500 text-white' : 'bg-muted/50 hover:bg-muted'
            }`}
          >
            <div className="text-2xl font-bold">{stats.overdue}</div>
            <div className="text-sm opacity-80">Overdue</div>
          </button>
        </div>

        {/* Tasks Table */}
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading tasks...</div>
        ) : filteredTasks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No tasks found</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTasks.map((task) => {
                const status = getStatusInfo(task);
                const StatusIcon = status.icon;
                
                return (
                  <TableRow key={task.id}>
                    <TableCell>
                      <div>
                        <div className={`font-medium ${task.completed ? 'line-through text-muted-foreground' : ''}`}>
                          {task.title}
                        </div>
                        {task.description && (
                          <div className="text-sm text-muted-foreground line-clamp-1">
                            {task.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            {task.employee_name?.split(' ').map((n: string) => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <span>{task.employee_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {task.end_time ? format(parseISO(task.end_time), 'MMM d, yyyy') : '-'}
                    </TableCell>
                    <TableCell>
                      {task.priority === 'high' && <Badge variant="destructive">High</Badge>}
                      {task.priority === 'medium' && <Badge variant="default">Medium</Badge>}
                      {task.priority === 'low' && <Badge variant="secondary">Low</Badge>}
                    </TableCell>
                    <TableCell>
                      <Badge className={`${status.color} text-white`}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {status.label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
