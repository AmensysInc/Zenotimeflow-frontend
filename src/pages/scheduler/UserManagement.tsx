import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import apiClient from "@/lib/api-client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Users, Plus, Edit, Trash2, Search, Filter, Mail, UserPlus } from "lucide-react";

interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  created_at: string;
  status: string;
  role: string;
}

export default function SchedulerUserManagement() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newUser, setNewUser] = useState({
    email: "",
    full_name: "",
    password: "",
    role: "employee" as "employee" | "house_keeping" | "maintenance" | "manager" | "operations_manager" | "super_admin"
  });
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  
  const { toast } = useToast();

  useEffect(() => {
    checkAuthorizationAndLoadUsers();
  }, [user]);

  // Set up real-time subscriptions for employees and profiles changes
  useEffect(() => {
    if (!isAuthorized) return;

    // Note: Real-time updates will be handled by Django Channels in the future
    // Removed Supabase real-time subscriptions
  }, [isAuthorized]);

  const checkAuthorizationAndLoadUsers = async () => {
    if (!user) return;

    try {
      // Check if user has scheduler admin rights or is super admin
      const userData = await apiClient.getCurrentUser() as any;
      const roles = userData?.roles || [];
      const hasSchedulerAdmin = roles.some((r: any) => 
        r.role === 'super_admin' || (r.role === 'admin' && r.app_type === 'scheduler')
      ) || false;

      // Also check if it's the main admin email
      const isMainAdmin = user.email === 'kuladeepparchuri@gmail.com';
      
      if (hasSchedulerAdmin || isMainAdmin) {
        setIsAuthorized(true);
        await loadUsers();
      } else {
        setIsAuthorized(false);
        setLoading(false);
      }
    } catch (error) {
      console.error('Error checking authorization:', error);
      toast({
        title: "Error",
        description: "Failed to check authorization",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      // Get all users
      const allUsers = await apiClient.get<any[]>('/auth/users/');
      const profiles = allUsers.map((u: any) => ({
        ...u.profile,
        user_id: u.id,
        email: u.email
      })).sort((a: any, b: any) => 
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );

      // Get all employees with their user_ids (to check if user is linked to scheduler via employees table)
      const allEmployees = await apiClient.get<any[]>('/scheduler/employees/');
      
      // Create sets for quick lookup
      const employeeUserIds = new Set(allEmployees.map((e: any) => e.user).filter(Boolean));
      const employeeEmails = new Set(allEmployees.map((e: any) => e.email?.toLowerCase()).filter(Boolean));

      // Get users with scheduler access
      const usersWithRoles = profiles.map((profile: any) => {
        const userData = allUsers.find((u: any) => u.id === profile.user_id);
        const rolesData = userData?.roles || [];

          // Check if user has scheduler access via roles
          const hasSchedulerAccess = rolesData?.some(r => r.app_type === 'scheduler') || false;
          
          // Check if user is an employee (by user_id OR email match)
          const isEmployeeByUserId = employeeUserIds.has(profile.user_id);
          const isEmployeeByEmail = employeeEmails.has(profile.email?.toLowerCase());
          const isEmployeeInScheduler = isEmployeeByUserId || isEmployeeByEmail;
          
          // Check if user has employee role in user_roles table (regardless of app_type)
          const hasEmployeeRole = rolesData?.some(r => r.role === 'employee') || false;
          
          // Include user if they have scheduler access, are in employees table, or have employee role
          if (!hasSchedulerAccess && !isEmployeeInScheduler && !hasEmployeeRole) return null;

          // Get all roles from user_roles table
          const allRoles = rolesData?.map(r => r.role) || [];
          
          // Determine role based on hierarchy - employees table takes priority for 'employee' role
          let highestRole = 'user';
          
          // Check for management roles first (these always take priority)
          if (allRoles.includes('super_admin')) {
            highestRole = 'super_admin';
          } else if (allRoles.includes('operations_manager')) {
            highestRole = 'operations_manager';
          } else if (allRoles.includes('manager')) {
            highestRole = 'manager';
          } else if (allRoles.includes('admin')) {
            highestRole = 'admin';
          } else if (isEmployeeInScheduler || hasEmployeeRole) {
            // User is an employee if they're in employees table OR have employee role
            highestRole = 'employee';
          }

        return {
          ...profile,
          role: highestRole
        };
      });

      // Filter out null values (users without scheduler access)
      const schedulerUsers = usersWithRoles.filter(user => user !== null);
      console.log('Loaded scheduler users:', schedulerUsers.map(u => ({ email: u.email, role: u.role })));
      setUsers(schedulerUsers);
    } catch (error) {
      console.error('Error loading users:', error);
      toast({
        title: "Error",
        description: "Failed to load scheduler users",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (userId: string, newRole: 'employee' | 'manager' | 'operations_manager' | 'super_admin') => {
    try {
      const userData = await apiClient.get<any>(`/auth/users/${userId}/`);
      const schedulerRole = userData?.roles?.find((r: any) => r.app_type === 'scheduler');
      
      if (schedulerRole) {
        await apiClient.patch(`/auth/user-roles/${schedulerRole.id}/`, { role: newRole });
      } else {
        await apiClient.post('/auth/user-roles/', {
          user: userId,
          role: newRole,
          app_type: 'scheduler'
        });
      }

      toast({
        title: "Success",
        description: "User role updated successfully",
      });

      await loadUsers();
    } catch (error) {
      console.error('Error updating user role:', error);
      toast({
        title: "Error",
        description: "Failed to update user role",
        variant: "destructive",
      });
    }
  };

  const createUser = async () => {
    if (!newUser.email || !newUser.password) {
      toast({
        title: "Error",
        description: "Email and password are required",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      // Create user via Django API
      let data;
      try {
        data = await apiClient.post('/auth/register/', {
          email: newUser.email,
          full_name: newUser.full_name,
          role: newUser.role,
          password: newUser.password,
          app_type: 'scheduler'
        });
      } catch (error: any) {
        console.error('User creation error:', error);
        let errorMessage = "Failed to create user. Please try again.";
        
        if (error.message) {
          errorMessage = error.message;
        }
        
        throw new Error(errorMessage);
      }

      // Check if the response contains an error
      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: "User Created Successfully",
        description: `${newUser.full_name} has been added. A welcome email will be sent to ${newUser.email}.`,
      });

      // Clear the form and close dialog
      setNewUser({ email: "", full_name: "", role: "employee", password: "" });
      setIsDialogOpen(false);
      
      // Reload users to show the new user
      await loadUsers();
    } catch (error: any) {
      console.error('Error creating user:', error);
      
      // Display user-friendly error message
      let displayMessage = error.message || "Failed to create user";
      
      // Clean up technical error messages
      if (displayMessage.includes('non-2xx') || displayMessage.includes('status code')) {
        displayMessage = "Unable to create user. Please check all fields and try again.";
      }
      
      toast({
        title: "Could not create user",
        description: displayMessage,
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const editUser = async () => {
    if (!editingUser) return;

    try {
      await apiClient.patch(`/auth/profiles/${editingUser.user_id}/`, { 
        full_name: editingUser.full_name,
        email: editingUser.email
      });

      toast({
        title: "Success",
        description: "User updated successfully",
      });

      setIsEditDialogOpen(false);
      setEditingUser(null);
      await loadUsers();
    } catch (error: any) {
      console.error('Error updating user:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update user",
        variant: "destructive",
      });
    }
  };

  const deleteUser = async (userId: string, userEmail: string) => {
    if (!confirm(`Are you sure you want to remove ${userEmail} from the scheduler app? This will mark the user as deleted.`)) {
      return;
    }

    try {
      // Mark user as deleted in profiles table
      await apiClient.patch(`/auth/profiles/${userId}/`, { status: 'deleted' });

      await loadUsers();

      toast({
        title: "Success", 
        description: "User removed from scheduler app successfully",
      });
    } catch (error: any) {
      console.error('Error removing user:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to remove user",
        variant: "destructive",
      });
    }
  };

  const reinviteUser = async (userEmail: string, userFullName: string, userRole: string) => {
    try {
      // Generate a temporary password for reinvitation
      const tempPassword = Math.random().toString(36).slice(-12);
      
      // Send reinvite email
      // Note: Email sending endpoint needs to be implemented in Django
      try {
        await apiClient.post('/auth/send-welcome-email/', {
          email: userEmail,
          full_name: userFullName,
          role: userRole,
          password: tempPassword,
          is_reinvite: true
        });
      } catch (error: any) {
        throw error;
      }

      toast({
        title: "Success",
        description: `Reinvitation email sent to ${userEmail}`,
      });
    } catch (error: any) {
      console.error('Error sending reinvitation:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to send reinvitation email",
        variant: "destructive",
      });
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'default';
      case 'deleted':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'destructive';
      case 'admin':
        return 'default';
      default:
        return 'secondary';
    }
  };

  // Filter users based on search term, role, and status
  const filteredUsers = users.filter((userItem) => {
    const matchesSearch = 
      userItem.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      userItem.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Normalize role comparison - handle both 'employee' in user_roles and users linked via employees table
    const userRole = userItem.role?.toLowerCase() || 'user';
    const filterRole = selectedRole?.toLowerCase() || 'all';
    const matchesRole = filterRole === "all" || userRole === filterRole;
    const matchesStatus = selectedStatus === "all" || userItem.status === selectedStatus;
    
    return matchesSearch && matchesRole && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <Users className="h-16 w-16 text-muted-foreground" />
        <h2 className="text-2xl font-bold">Access Denied</h2>
        <p className="text-muted-foreground">You don't have permission to manage scheduler users.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Scheduler User Management</h1>
        <p className="text-muted-foreground">
          Manage users and their roles in the Roster Joy scheduler app.
        </p>
      </div>

      {/* Filters Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search Filter */}
            <div className="flex-1">
              <Label htmlFor="search" className="text-sm font-medium">
                Search Users
              </Label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Role Filter */}
            <div className="w-full sm:w-48">
              <Label htmlFor="role-filter" className="text-sm font-medium">
                Filter by Role
              </Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="house_keeping">House Keeping</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="manager">Company Manager</SelectItem>
                  <SelectItem value="operations_manager">Organization Manager</SelectItem>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter */}
            <div className="w-full sm:w-48">
              <Label htmlFor="status-filter" className="text-sm font-medium">
                Filter by Status
              </Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="deleted">Deleted</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Scheduler Users ({filteredUsers.length} of {users.length})
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Scheduler User
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Add New Scheduler User</DialogTitle>
                  <DialogDescription>
                    Create a new user account for the Roster Joy scheduler app.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="email" className="text-right">
                      Email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                      className="col-span-3"
                      placeholder="user@example.com"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="full_name" className="text-right">
                      Full Name
                    </Label>
                    <Input
                      id="full_name"
                      value={newUser.full_name}
                      onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                      className="col-span-3"
                      placeholder="John Doe"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="password" className="text-right">
                      Password
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      className="col-span-3"
                      placeholder="Temporary password"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="role" className="text-right">
                      Role
                    </Label>
                    <Select value={newUser.role} onValueChange={(value: "employee" | "house_keeping" | "maintenance" | "manager" | "operations_manager" | "super_admin") => setNewUser({ ...newUser, role: value })}>
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="employee">Employee</SelectItem>
                        <SelectItem value="house_keeping">House Keeping</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                        <SelectItem value="manager">Company Manager</SelectItem>
                        <SelectItem value="operations_manager">Organization Manager</SelectItem>
                        <SelectItem value="super_admin">Super Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="submit"
                    disabled={isCreating}
                    onClick={createUser}
                  >
                    {isCreating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create User"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.full_name || "No name"}
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(user.status)}>
                        {user.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(user.role)}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(user.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingUser(user);
                          setIsEditDialogOpen(true);
                        }}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      
                      <Select
                        value={user.role}
                        onValueChange={(value: 'employee' | 'manager' | 'operations_manager' | 'super_admin') => 
                          updateUserRole(user.user_id, value)
                        }
                      >
                        <SelectTrigger className="w-auto h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="employee">Employee</SelectItem>
                          <SelectItem value="house_keeping">House Keeping</SelectItem>
                          <SelectItem value="maintenance">Maintenance</SelectItem>
                          <SelectItem value="manager">Company Manager</SelectItem>
                          <SelectItem value="operations_manager">Organization Manager</SelectItem>
                          <SelectItem value="super_admin">Super Admin</SelectItem>
                        </SelectContent>
                      </Select>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => reinviteUser(user.email, user.full_name, user.role)}
                      >
                        <Mail className="h-3 w-3" />
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deleteUser(user.user_id, user.email)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <div className="flex flex-col items-center gap-2">
                        <Users className="h-8 w-8 text-muted-foreground" />
                        <p className="text-muted-foreground">No scheduler users found</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information.
            </DialogDescription>
          </DialogHeader>
          {editingUser && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-email" className="text-right">
                  Email
                </Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editingUser.email}
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-full-name" className="text-right">
                  Full Name
                </Label>
                <Input
                  id="edit-full-name"
                  value={editingUser.full_name}
                  onChange={(e) => setEditingUser({ ...editingUser, full_name: e.target.value })}
                  className="col-span-3"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={editUser}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}