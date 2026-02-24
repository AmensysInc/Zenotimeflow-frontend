import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import apiClient from "@/lib/api-client";
import { ensureArray } from "@/lib/utils";
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
import { Loader2, Users, Plus, Edit, Trash2, Search, Filter, Mail, Building, Building2 } from "lucide-react";

interface UserProfile {
  id: string;
  user_id: string;
  username?: string;
  full_name: string;
  email: string;
  created_at: string;
  status: string;
  role: string;
  manager_id?: string;
  manager_name?: string;
  field_type?: 'IT' | 'Non-IT';
  organization_id?: string;
  company_id?: string;
  employee_pin?: string;
}

export default function UserManagement() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newUser, setNewUser] = useState({
    email: "",
    username: "",
    full_name: "",
    password: "",
    employee_pin: "",
    role: "employee" as "employee" | "house_keeping" | "maintenance" | "manager" | "operations_manager" | "super_admin",
    manager_id: "none",
    organization_id: "",
    company_id: ""
  });
  const [managers, setManagers] = useState<UserProfile[]>([]);
  const [operationsManagers, setOperationsManagers] = useState<UserProfile[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<string>('');
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAssignCompanyDialogOpen, setIsAssignCompanyDialogOpen] = useState(false);
  const [companies, setCompanies] = useState<any[]>([]);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [selectedUserForAssignment, setSelectedUserForAssignment] = useState<UserProfile | null>(null);
  
  // Multi-user assignment states
  const [selectedUsersForAssignment, setSelectedUsersForAssignment] = useState<string[]>([]);
  const [availableUsersForAssignment, setAvailableUsersForAssignment] = useState<UserProfile[]>([]);
  
  const [assignmentData, setAssignmentData] = useState({
    organization_id: "",
    company_id: "",
    role: "employee" as "employee" | "house_keeping" | "maintenance" | "manager" | "operations_manager" | "super_admin"
  });

  useEffect(() => {
    if (isAssignCompanyDialogOpen) {
      loadAvailableUsers();
    }
  }, [isAssignCompanyDialogOpen, users, companies]);

  // When Add User or Edit User dialog opens, load org/company so dropdowns work
  useEffect(() => {
    if ((isDialogOpen || isEditDialogOpen) && isAuthorized) {
      loadOrganizations();
      loadCompanies();
    }
  }, [isDialogOpen, isEditDialogOpen, isAuthorized]);

  const loadAvailableUsers = async () => {
    try {
      // Get all users who are already assigned to companies
      const assignedUserIds = new Set();
      
      // Add operations managers and company managers from companies
      companies.forEach(company => {
        if (company.operations_manager_id) {
          assignedUserIds.add(company.operations_manager_id);
        }
        if (company.company_manager_id) {
          assignedUserIds.add(company.company_manager_id);
        }
      });

      // Add employees from employees table
      const rawEmployees = await apiClient.get<any>('/scheduler/employees/', { status: 'active' });
      const employees = ensureArray(rawEmployees);

      employees.forEach(employee => {
        if (employee.user_id) {
          assignedUserIds.add(employee.user_id);
        }
      });

      // Filter users to show only unassigned ones
      const availableUsers = users.filter(userProfile => {
        // Exclude current user (super admin doing the assignment)
        if (userProfile.user_id === user?.id) {
          return false;
        }
        
        // Exclude users who are already assigned to companies
        if (assignedUserIds.has(userProfile.user_id)) {
          return false;
        }
        
        // Only show active users
        if (userProfile.status !== 'active') {
          return false;
        }
        
        // Show users and admins (potential candidates for assignment)
        return ['user', 'admin'].includes(userProfile.role);
      });

      setAvailableUsersForAssignment(availableUsers);
    } catch (error) {
      console.error('Error loading available users:', error);
    }
  };
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  
  const { toast } = useToast();

  useEffect(() => {
    checkAuthorizationAndLoadUsers();
    loadCompanies();
    loadOrganizations();

    // Note: Real-time updates will be handled by Django Channels in the future
    // Removed Supabase real-time subscriptions
  }, [user]);

  const checkAuthorizationAndLoadUsers = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      // Check if user is super admin
      const userData = await apiClient.getCurrentUser() as any;
      const roles = userData?.roles || [];
      const isSuperAdmin = roles.some((r: any) => r.role === 'super_admin') || false;
      const isRamaAdmin = user.email === 'rama.k@amensys.com';
      
      if (isSuperAdmin || isRamaAdmin) {
        setIsAuthorized(true);
        setCurrentUserRole('super_admin');
        // Load users first, then managers/ops managers
        await loadUsers();
        // Load managers and ops managers in parallel (non-blocking)
        loadManagers().catch(err => console.error('Error loading managers:', err));
        loadOperationsManagers().catch(err => console.error('Error loading operations managers:', err));
      } else {
        setIsAuthorized(false);
        setLoading(false);
      }
    } catch (error: any) {
      console.error('Error checking authorization:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to check authorization",
        variant: "destructive",
      });
      setIsAuthorized(false);
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      // Get all users from backend users table only (no employees-without-account merge)
      // Prefer is_staff=false so we only show real app users if backend supports it
      let rawUsers: any;
      try {
        rawUsers = await apiClient.get<any>('/auth/users/', { is_staff: false });
      } catch (_) {
        try {
          rawUsers = await apiClient.get<any>('/auth/users/');
        } catch (slashError: any) {
          try {
            rawUsers = await apiClient.get<any>('/auth/users');
          } catch (noSlashError: any) {
            throw new Error(`Failed to fetch users: ${(noSlashError as Error)?.message || 'Unknown error'}`);
          }
        }
      }
      const rawList = ensureArray(rawUsers);
      // One row per email (backend may return same user multiple times with different ids)
      const seenEmails = new Set<string>();
      const allUsers = rawList.filter((u: any) => {
        const email = (u?.email ?? u?.profile?.email ?? '').toString().toLowerCase().trim();
        const key = email || (u?.id ?? u?.user_id)?.toString();
        if (!key || seenEmails.has(key)) return false;
        seenEmails.add(key);
        return true;
      });

      // Normalize user data: backend may return { id, email, profile: {...} } or { id, email, full_name, ... }
      const profiles = allUsers
        .filter((u: any) => {
          // Skip deleted users
          const status = u.profile?.status ?? u.status;
          return status !== 'deleted';
        })
        .map((u: any) => {
          // Handle both nested profile and flat structure
          const profile = u.profile || {};
          return {
            id: profile.id || u.id,
            user_id: u.id,
            username: u.username ?? profile.username ?? '',
            email: u.email || profile.email || '',
            full_name: profile.full_name || u.full_name || '',
            created_at: profile.created_at || u.created_at || new Date().toISOString(),
            status: profile.status || u.status || 'active',
            manager_id: profile.manager_id || u.manager_id,
            manager_name: profile.manager_name || u.manager_name,
            manager: profile.manager_id ? { user_id: profile.manager_id, full_name: profile.manager_name } : null,
            roles: u.roles || []
          };
        })
        .sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

      // Load all employee records (including those created by org managers/managers)
      const rawEmployees = await apiClient.get<any>('/scheduler/employees/', { status: 'active' });
      const employeeRows: any[] = Array.isArray(rawEmployees)
        ? rawEmployees
        : (rawEmployees && typeof rawEmployees === 'object' && Array.isArray((rawEmployees as any).results))
          ? (rawEmployees as any).results
          : (rawEmployees && typeof rawEmployees === 'object' && Array.isArray((rawEmployees as any).data))
            ? (rawEmployees as any).data
            : [];

      const employeeUserIds = new Set(
        employeeRows.map((e) => e.user_id).filter(Boolean) as string[]
      );
      const employeeEmails = new Set(
        employeeRows
          .map((e) => e.email?.toLowerCase())
          .filter(Boolean) as string[]
      );

      // Create a map of employees by email for quick lookup
      const employeesByEmail = new Map(
        employeeRows.map((e) => [e.email?.toLowerCase(), e])
      );

      // Get all users with their roles (roles are included in the user response or already in profile)
      const usersWithRoles = profiles.map((profile: any) => {
        const userData = allUsers.find((u: any) => u.id === profile.user_id);
        const rolesData = profile.roles || userData?.roles || [];

          const isEmployee =
            employeeUserIds.has(profile.user_id) ||
            employeeEmails.has(profile.email?.toLowerCase());

          // Determine highest priority role
          let highestRole = 'user';
          if (rolesData && rolesData.length > 0) {
            const roles = rolesData.map(r => r.role);
            if (roles.includes('super_admin')) {
              highestRole = 'super_admin';
            } else if (roles.includes('operations_manager')) {
              highestRole = 'operations_manager';
            } else if (roles.includes('manager')) {
              highestRole = 'manager';
            } else if (roles.includes('admin')) {
              highestRole = 'admin';
            } else if (roles.includes('employee') || isEmployee) {
              highestRole = 'employee';
            } else if (roles.includes('user')) {
              highestRole = 'user';
            }
          } else if (isEmployee) {
            // If user_roles rows are missing, still treat linked employees as employees
            highestRole = 'employee';
          }

        return {
          ...profile,
          role: highestRole,
          manager_name: profile.manager?.full_name || null
        };
      });

      // Show only backend auth users so list and count match the backend users table
      setUsers(usersWithRoles);
    } catch (error: any) {
      console.error('Error loading users:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to load users. Check console for details.",
        variant: "destructive",
      });
      setUsers([]); // Set empty array on error so UI shows "No users" instead of hanging
    } finally {
      setLoading(false);
    }
  };

  // Keep user management data in sync with the backend (users, organizations, companies)
  const POLL_INTERVAL_MS = 30000; // 30 seconds
  useEffect(() => {
    if (!user || !isAuthorized) return;

    const refreshFromBackend = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        loadUsers();
        loadOrganizations();
        loadCompanies();
      }
    };

    // Refetch when user returns to the tab
    document.addEventListener('visibilitychange', refreshFromBackend);

    // Refetch when window gains focus (e.g. switching back from another app or tab)
    window.addEventListener('focus', refreshFromBackend);

    // Poll periodically while tab is visible so list matches backend DB
    const intervalId = setInterval(refreshFromBackend, POLL_INTERVAL_MS);

    return () => {
      document.removeEventListener('visibilitychange', refreshFromBackend);
      window.removeEventListener('focus', refreshFromBackend);
      clearInterval(intervalId);
    };
  }, [user, isAuthorized]);

  const loadManagers = async () => {
    try {
      // Get all users with admin role (potential managers)
      const allUsers = await apiClient.get<any[]>('/auth/users/');
      const adminUsers = allUsers.filter((u: any) => {
        const roles = u.roles || [];
        return roles.some((r: any) => r.role === 'admin') && 
               (u.profile?.status === 'active' || !u.profile?.status);
      });

      const adminProfiles = adminUsers.map((u: any) => ({
        ...u.profile,
        user_id: u.id,
        email: u.email,
        role: 'admin'
      }));

      setManagers(adminProfiles);
    } catch (error) {
      console.error('Error loading managers:', error);
    }
  };

  const loadOperationsManagers = async () => {
    try {
      // Get all users with operations_manager role
      const allUsers = await apiClient.get<any[]>('/auth/users/');
      const opsManagerUsers = allUsers.filter((u: any) => {
        const roles = u.roles || [];
        return roles.some((r: any) => r.role === 'operations_manager') && 
               (u.profile?.status === 'active' || !u.profile?.status);
      });

      // Map profiles with their app_type (field_type)
      const profilesWithFieldType = opsManagerUsers.map((u: any) => {
        const roleData = u.roles?.find((r: any) => r.role === 'operations_manager');
        const fieldType = roleData?.app_type === 'calendar' ? 'IT' : 'Non-IT';
        return {
          ...u.profile,
          user_id: u.id,
          email: u.email,
          role: 'operations_manager',
          field_type: fieldType as 'IT' | 'Non-IT'
        };
      });
      setOperationsManagers(profilesWithFieldType);
    } catch (error) {
      console.error('Error loading operations managers:', error);
    }
  };

  const loadCompanies = async (): Promise<any[]> => {
    try {
      const raw = await apiClient.get<any>('/scheduler/companies/');
      const list = ensureArray(raw).map((c: any) => ({
        ...c,
        organization_id: c.organization_id ?? (typeof c.organization === 'string' ? c.organization : c.organization?.id)
      }));
      const sorted = list.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
      setCompanies(sorted);
      return sorted;
    } catch (error) {
      console.error('Error loading companies:', error);
      return [];
    }
  };

  const loadOrganizations = async (): Promise<any[]> => {
    try {
      const raw = await apiClient.get<any>('/scheduler/organizations/');
      const list = ensureArray(raw);
      const sorted = list.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
      setOrganizations(sorted);
      return sorted;
    } catch (error) {
      console.error('Error loading organizations:', error);
      return [];
    }
  };

  const updateUserRole = async (userId: string, newRole: 'employee' | 'manager' | 'operations_manager' | 'super_admin') => {
    try {
      // Get existing user roles
      const userData = await apiClient.get<any>(`/auth/users/${userId}/`);
      const existingRoles = userData?.roles || [];

      if (existingRoles.length > 0) {
        // Update existing role - find the scheduler role and update it
        const schedulerRole = existingRoles.find((r: any) => r.app_type === 'scheduler');
        if (schedulerRole) {
          await apiClient.patch(`/auth/user-roles/${schedulerRole.id}/`, { role: newRole });
        } else {
          // Insert new role if none exists for scheduler
          await apiClient.post('/auth/user-roles/', {
            user: userId,
            role: newRole,
            app_type: 'scheduler'
          });
        }
      } else {
        // Insert new role if none exists
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
    } catch (error: any) {
      console.error('Error updating user role:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update user role",
        variant: "destructive",
      });
    }
  };

  /** Dynamic validation: require org/company based on selected role. */
  const getCreateUserValidationError = (): string | null => {
    const email = newUser.email?.trim();
    const username = newUser.username?.trim();
    const password = newUser.password;
    if (!username) return "Username is required.";
    if (!email) return "Email is required.";
    if (!password) return "Password is required.";
    if (password.length < 8) return "Password must be at least 8 characters.";
    if (newUser.role === "operations_manager" && !newUser.organization_id) {
      return "Please select an organization for Organization Manager.";
    }
    if (newUser.role === "manager") {
      if (!newUser.organization_id) return "Please select an organization for Company Manager.";
      if (!newUser.company_id) return "Please select a company for Company Manager.";
    }
    if (
      (newUser.role === "employee" || newUser.role === "house_keeping" || newUser.role === "maintenance") &&
      !newUser.company_id
    ) {
      return "Please select a company for this role.";
    }
    return null;
  };

  const createUser = async () => {
    // Prevent duplicate submissions
    if (isCreating) return;

    const validationError = getCreateUserValidationError();
    if (validationError) {
      toast({ title: "Validation error", description: validationError, variant: "destructive" });
      return;
    }

    setIsCreating(true);
    let successMessage = "User created successfully.";

    try {
      // Ensure we have auth token (api-client sends Bearer from localStorage)
      const token = apiClient.getToken();
      if (!token) {
        toast({ title: "Session expired", description: "Please sign in again.", variant: "destructive" });
        setIsCreating(false);
        return;
      }

      // Check if user already exists (by email or username) – support paginated or list response
      let existingProfile: any = null;
      try {
        const rawUsers = await apiClient.get<any>("/auth/users/", {});
        const list = ensureArray(rawUsers);
        const emailLower = newUser.email.trim().toLowerCase();
        const usernameLower = newUser.username.trim().toLowerCase();
        existingProfile = list.find((u: any) => {
          const uEmail = (u.email || u.profile?.email || "").toLowerCase();
          const uUsername = (u.username || "").toLowerCase();
          return uEmail === emailLower || uUsername === usernameLower;
        }) || null;
      } catch {
        // Ignore pre-check errors; backend will reject duplicate on register
      }

      if (existingProfile) {
        if (existingProfile.profile?.status === "deleted") {
          await apiClient.patch(`/auth/profiles/${existingProfile.id}/`, {
            status: "active",
            full_name: newUser.full_name || existingProfile.profile?.full_name,
          });
          await apiClient.post("/auth/user-roles/", {
            user: existingProfile.id,
            role: newUser.role,
            app_type: "scheduler",
          });
          successMessage = "User reactivated and role assigned.";
        } else {
          toast({
            title: "User already exists",
            description: "A user with this email already exists. Use a different email or edit the existing user from the list below.",
            variant: "destructive",
          });
          setIsCreating(false);
          return;
        }
      } else {
        // Use POST /auth/users/ so backend saves user + role + org/company + employee (with company & PIN) in one go
        const fullName = newUser.full_name?.trim() || newUser.email.trim().split("@")[0];
        const backendRole =
          newUser.role === "operations_manager"
            ? "organization_manager"
            : newUser.role === "manager"
              ? "company_manager"
              : "employee"; // employee, house_keeping, maintenance all create an employee record

        const usersPayload: Record<string, any> = {
          email: newUser.email.trim(),
          username: newUser.username.trim(),
          password: newUser.password,
          full_name: fullName,
          role: backendRole,
        };
        if (newUser.role === "operations_manager" && newUser.organization_id) {
          usersPayload.organization_id = newUser.organization_id;
        }
        if ((newUser.role === "manager" || newUser.role === "employee" || newUser.role === "house_keeping" || newUser.role === "maintenance") && newUser.company_id) {
          usersPayload.company_id = newUser.company_id;
          if (newUser.role === "manager" && newUser.organization_id) usersPayload.organization_id = newUser.organization_id;
        }
        if (newUser.role === "employee" || newUser.role === "house_keeping" || newUser.role === "maintenance") {
          usersPayload.employee_pin = newUser.employee_pin?.trim() || null;
        }

        const data = await apiClient.post<any>("/auth/users/", usersPayload);
        const userId = data?.id ?? data?.user?.id;
        if (!userId) {
          toast({ title: "Error", description: "Invalid response: no user id returned.", variant: "destructive" });
          setIsCreating(false);
          return;
        }

        if (newUser.role === "operations_manager") successMessage = "User created and assigned as Organization Manager.";
        else if (newUser.role === "manager") successMessage = "User created and assigned as Company Manager.";
        else if (newUser.role === "employee") successMessage = "User created and added to company.";
        else if (newUser.role === "house_keeping" || newUser.role === "maintenance") {
          try {
            await apiClient.post("/auth/user-roles/", { user: userId, role: newUser.role, app_type: "scheduler" });
          } catch {
            // Role may already exist
          }
          let teamId: string | null = null;
          const teamName = newUser.role === "house_keeping" ? "House Keeping" : "Maintenance";
          try {
            const teams = await apiClient.get<any[]>("/scheduler/teams/", { company: newUser.company_id, name: teamName });
            if (teams?.length) teamId = teams[0].id;
            else {
              const newTeam = await apiClient.post<any>("/scheduler/teams/", {
                company: newUser.company_id,
                name: teamName,
                color: newUser.role === "house_keeping" ? "#3B82F6" : "#EF4444",
              });
              if (newTeam?.id) teamId = newTeam.id;
            }
            if (teamId) {
              const employees = await apiClient.get<any[]>("/scheduler/employees/", { user: userId });
              const emp = Array.isArray(employees) ? employees[0] : null;
              if (emp) await apiClient.patch(`/scheduler/employees/${emp.id}/`, { team: teamId });
            }
          } catch {
            /* ignore */
          }
          successMessage = "User created and added to company.";
        }
      }

      setNewUser({
        email: "",
        username: "",
        full_name: "",
        role: "employee",
        password: "",
        employee_pin: "",
        manager_id: "none",
        organization_id: "",
        company_id: "",
      });
      setIsDialogOpen(false);
      toast({ title: "Success", description: successMessage });
      await loadUsers();
    } catch (error: any) {
      console.error("User creation error:", error);
      const msg = error?.message || "Failed to create user. Check console for details.";
      const isDuplicateEmail = /already exists|duplicate|email.*taken/i.test(msg);
      toast({
        title: isDuplicateEmail ? "User already exists" : "Error",
        description: isDuplicateEmail
          ? "A user with this email is already registered. Use a different email or find and edit the existing user in the list below."
          : msg,
        variant: "destructive",
      });
      // Keep dialog open on duplicate email so user can change email
      if (!isDuplicateEmail) setIsDialogOpen(false);
    } finally {
      setIsCreating(false);
    }
  };

  const editUser = async () => {
    if (!editingUser) return;

    try {
      // Update user username if supported (User model)
      const usernameVal = (editingUser.username ?? '').trim();
      if (usernameVal) {
        try {
          await apiClient.patch(`/auth/users/${editingUser.user_id}/`, { username: usernameVal });
        } catch (userPatchErr: any) {
          if (userPatchErr?.message && !userPatchErr.message.includes('404')) {
            console.warn('Could not update username:', userPatchErr);
          }
        }
      }
      // Update profile
      await apiClient.patch(`/auth/profiles/${editingUser.user_id}/`, { 
        full_name: editingUser.full_name,
        email: editingUser.email
      });

      // Update user role
      await updateUserRole(editingUser.user_id, editingUser.role as any);

      // Handle role-specific assignments
      // For Organization Manager - update organization assignment
      if (editingUser.role === 'operations_manager' && editingUser.organization_id) {
        // First, remove from any previously assigned organization
        const orgs = await apiClient.get<any[]>('/scheduler/organizations/', { organization_manager: editingUser.user_id });
        await Promise.all(orgs.map((org: any) => 
          apiClient.patch(`/scheduler/organizations/${org.id}/`, { organization_manager: null })
        ));
        
        // Then assign to new organization
        try {
          await apiClient.patch(`/scheduler/organizations/${editingUser.organization_id}/`, { 
            organization_manager: editingUser.user_id 
          });
        } catch (orgError: any) {
          console.error('Error assigning organization manager:', orgError);
        }
      }
      
      // For Company Manager - update company assignment
      if (editingUser.role === 'manager' && editingUser.company_id) {
        // First, remove from any previously assigned company
        const companies = await apiClient.get<any[]>('/scheduler/companies/', { company_manager: editingUser.user_id });
        await Promise.all(companies.map((comp: any) => 
          apiClient.patch(`/scheduler/companies/${comp.id}/`, { company_manager: null })
        ));
        
        // Then assign to new company
        try {
          await apiClient.patch(`/scheduler/companies/${editingUser.company_id}/`, { 
            company_manager: editingUser.user_id 
          });
        } catch (companyError: any) {
          console.error('Error assigning company manager:', companyError);
        }
      }
      
      // Handle employee-type role company assignment (employee, house_keeping, maintenance)
      if ((editingUser.role === 'employee' || editingUser.role === 'house_keeping' || editingUser.role === 'maintenance') && editingUser.company_id) {
        // Auto-assign team based on role
        let teamId: string | null = null;
        if (editingUser.role === 'house_keeping' || editingUser.role === 'maintenance') {
          const teamName = editingUser.role === 'house_keeping' ? 'House Keeping' : 'Maintenance';
          try {
            const teams = await apiClient.get<any[]>('/scheduler/teams/', { 
              company: editingUser.company_id,
              name: teamName 
            });
            
            if (teams && teams.length > 0) {
              teamId = teams[0].id;
            } else {
              // Create the team if it doesn't exist
              const newTeam = await apiClient.post<{ id: string }>('/scheduler/teams/', {
                company: editingUser.company_id,
                name: teamName,
                color: editingUser.role === 'house_keeping' ? '#3B82F6' : '#EF4444'
              });
              
              if (newTeam?.id) {
                teamId = newTeam.id;
              }
            }
          } catch (error) {
            console.error('Error handling team:', error);
          }
        }
        
        // Check if employee record already exists
        let existingEmployee;
        try {
          const employees = await apiClient.get<any[]>('/scheduler/employees/', { 
            user: editingUser.user_id 
          });
          existingEmployee = employees && employees.length > 0 ? employees[0] : null;
          
          if (!existingEmployee) {
            const employeesByEmail = await apiClient.get<any[]>('/scheduler/employees/', { 
              email: editingUser.email 
            });
            existingEmployee = employeesByEmail && employeesByEmail.length > 0 ? employeesByEmail[0] : null;
          }
        } catch (error) {
          // Employee doesn't exist, that's fine
        }

        if (existingEmployee) {
          try {
            const pinValue = (editingUser.employee_pin as string)?.trim() || null;
            await apiClient.patch(`/scheduler/employees/${existingEmployee.id}/`, { 
              company: editingUser.company_id || null,
              team: teamId,
              employee_pin: pinValue,
            });
          } catch (updateError: any) {
            console.error('Error updating employee:', updateError);
          }
        } else {
          const nameParts = editingUser.full_name.trim().split(' ');
          const firstName = nameParts[0] || '';
          const lastName = nameParts.slice(1).join(' ') || '';
          
          try {
            await apiClient.post('/scheduler/employees/', {
              user: editingUser.user_id,
              email: editingUser.email,
              first_name: firstName,
              last_name: lastName,
              company: editingUser.company_id,
              team: teamId,
              status: 'active',
              hire_date: new Date().toISOString().split('T')[0],
              employee_pin: (editingUser.employee_pin as string)?.trim() || null,
            });
          } catch (insertError: any) {
            console.error('Error creating employee record:', insertError);
          }
        }
      }

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
    if (!confirm(`Are you sure you want to delete user ${userEmail}? This will completely remove them from the system and all company assignments.`)) {
      return;
    }

    try {
      console.log('Deleting user:', userId, userEmail);
      
      // 1. Clean up organization assignments - remove from operations_manager_id and organization_manager_id
      try {
        const orgs = await apiClient.get<any[]>('/scheduler/organizations/');
        const orgsToUpdate = orgs.filter((org: any) => 
          org.operations_manager === userId || org.organization_manager === userId
        );
        await Promise.all(orgsToUpdate.map((org: any) => 
          apiClient.patch(`/scheduler/organizations/${org.id}/`, { 
            operations_manager: null,
            organization_manager: null 
          })
        ));
      } catch (orgCleanupError: any) {
        console.error('Organization cleanup error:', orgCleanupError);
      }

      // 2. Clean up company assignments - remove from operations_manager_id and company_manager_id
      try {
        const companies = await apiClient.get<any[]>('/scheduler/companies/');
        const companiesToUpdate = companies.filter((comp: any) => 
          comp.operations_manager === userId || comp.company_manager === userId
        );
        await Promise.all(companiesToUpdate.map((comp: any) => 
          apiClient.patch(`/scheduler/companies/${comp.id}/`, { 
            operations_manager: null,
            company_manager: null 
          })
        ));
      } catch (companyCleanupError: any) {
        console.error('Company cleanup error:', companyCleanupError);
      }

      // 3. Delete only the ONE employee record linked to this user (backend filters by user=userId)
      try {
        const employees = await apiClient.get<any[]>('/scheduler/employees/', { user: userId });
        const list = Array.isArray(employees) ? employees : [];
        for (const emp of list) {
          if (emp.user_id === userId || emp.user === userId) {
            await apiClient.delete(`/scheduler/employees/${emp.id}/`);
            break; // At most one employee per user (OneToOne)
          }
        }
      } catch (employeeError: any) {
        console.log('No employee record to clean up by user_id:', employeeError);
      }

      // 3b. Virtual employees (same email, no user_id) - delete at most one
      if (userEmail) {
        try {
          const employees = await apiClient.get<any[]>('/scheduler/employees/', { email: userEmail });
          const list = Array.isArray(employees) ? employees : [];
          const virtual = list.find((emp: any) => !emp.user_id && !emp.user);
          if (virtual) {
            await apiClient.delete(`/scheduler/employees/${virtual.id}/`);
          }
        } catch (employeeEmailError: any) {
          console.log('No employee record to clean up by email:', employeeEmailError);
        }
      }

      // 4. Delete user roles
      try {
        const userData = await apiClient.get<any>(`/auth/users/${userId}/`);
        const roles = userData?.roles || [];
        await Promise.all(roles.map((role: any) => 
          apiClient.delete(`/auth/user-roles/${role.id}/`)
        ));
      } catch (rolesError: any) {
        console.error('Error deleting user roles:', rolesError);
        // Continue with deletion even if roles cleanup fails
      }

      // 5. Delete calendar events
      try {
        const events = await apiClient.get<any[]>('/calendar/events/', { user: userId });
        await Promise.all(events.map((event: any) => 
          apiClient.delete(`/calendar/events/${event.id}/`)
        ));
      } catch (eventsError: any) {
        console.log('No calendar events to clean up');
      }

      // 6. Delete other user-related data
      try {
        const habits = await apiClient.get<any[]>('/habits/habits/', { user: userId });
        await Promise.all(habits.map((habit: any) => 
          apiClient.delete(`/habits/habits/${habit.id}/`)
        ));
      } catch (habitsError: any) {
        console.log('No habits to clean up');
      }

      try {
        const sessions = await apiClient.get<any[]>('/focus/sessions/', { user: userId });
        await Promise.all(sessions.map((session: any) => 
          apiClient.delete(`/focus/sessions/${session.id}/`)
        ));
      } catch (focusError: any) {
        console.log('No focus sessions to clean up');
      }

      // 7. Finally mark profile as deleted (this maintains the record but marks it inactive)
      try {
        await apiClient.patch(`/auth/profiles/${userId}/`, { status: 'deleted' });
      } catch (profileError: any) {
        console.error('Error marking profile as deleted:', profileError);
        throw profileError;
      }

      console.log('User deletion successful - all references cleaned up');

      // Force reload users data from server
      setUsers([]);
      await loadUsers();

      toast({
        title: "Success", 
        description: "User completely removed from system and all company assignments",
      });
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete user",
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

  const assignUsersToCompany = async () => {
    const isOrgManager = assignmentData.role === "operations_manager";
    const needsCompany = !isOrgManager && assignmentData.role !== "super_admin";
    if (selectedUsersForAssignment.length === 0) {
      toast({ title: "Error", description: "Please select at least one user", variant: "destructive" });
      return;
    }
    if (isOrgManager && !assignmentData.organization_id) {
      toast({ title: "Error", description: "Please select an organization for Organization Manager", variant: "destructive" });
      return;
    }
    if (needsCompany && !assignmentData.company_id) {
      toast({ title: "Error", description: "Please select a company", variant: "destructive" });
      return;
    }

    try {
      // App type: for org manager use organization's first company or default scheduler; else use selected company
      let appType = 'scheduler';
      if (assignmentData.company_id) {
        const companyData = await apiClient.get<any>(`/scheduler/companies/${assignmentData.company_id}/`);
        appType = companyData?.field_type === 'IT' ? 'calendar' : 'scheduler';
      }

      // Process each selected user
      for (const userId of selectedUsersForAssignment) {
        // For operations_manager (Organization Manager), assign to organization only – no company
        if (assignmentData.role === "operations_manager") {
          await apiClient.patch(`/scheduler/organizations/${assignmentData.organization_id}/`, {
            organization_manager: userId,
          });
        } else if (assignmentData.role === "manager") {
          // For manager role (company manager), update the company
          await apiClient.patch(`/scheduler/companies/${assignmentData.company_id}/`, { 
            company_manager_id: userId 
          });
        } else if (assignmentData.role === "employee") {
          // For employee role, create employee record
          // First get the user profile data
          const userData = await apiClient.get<any>(`/auth/users/${userId}/`);
          const userProfile = userData?.profile || {};

          if (userProfile) {
            await apiClient.post('/scheduler/employees/', {
              user: userId,
              first_name: userProfile.full_name?.split(' ')[0] || '',
              last_name: userProfile.full_name?.split(' ').slice(1).join(' ') || '',
              email: userData.email || '',
              company: assignmentData.company_id,
              status: 'active'
            });
          }
        } else if (assignmentData.role === "super_admin") {
          // Super admin role - just add the role, no company assignment needed
        }

        // Update user role based on assignment and company type
        let finalRole: "user" | "admin" | "super_admin" | "operations_manager" | "manager" | "employee" = "employee";
        
        if (assignmentData.role === "operations_manager") {
          finalRole = "operations_manager";
        } else if (assignmentData.role === "manager") {
          finalRole = "manager";
        } else if (assignmentData.role === "employee") {
          finalRole = "employee";
        } else if (assignmentData.role === "super_admin") {
          finalRole = "super_admin";
        }
        
        // First, delete any existing scheduler/calendar roles for this user
        const userData = await apiClient.get<any>(`/auth/users/${userId}/`);
        const existingRoles = userData?.roles || [];
        const rolesToDelete = existingRoles.filter((r: any) =>
          r.app_type === 'calendar' || r.app_type === 'scheduler'
        );
        for (const role of rolesToDelete) {
          try {
            await apiClient.delete(`/auth/user-roles/${role.id}/`);
          } catch (e) {
            console.warn('Could not delete existing role:', e);
          }
        }

        // Create the new role – backend may expect POST or PUT
        const rolePayload = { user: userId, role: finalRole, app_type: appType };
        try {
          await apiClient.post('/auth/user-roles/', rolePayload);
        } catch (postErr: any) {
          if (postErr?.message?.includes('not allowed') || postErr?.message?.includes('405')) {
            try {
              await apiClient.put('/auth/user-roles/', rolePayload);
            } catch (putErr) {
              throw postErr;
            }
          } else {
            throw postErr;
          }
        }
      }

      const userCount = selectedUsersForAssignment.length;
      toast({
        title: "Success",
        description: `${userCount} user${userCount > 1 ? 's' : ''} assigned to company as ${assignmentData.role.replace('_', ' ')} successfully`,
      });

      setIsAssignCompanyDialogOpen(false);
      setSelectedUserForAssignment(null);
      setSelectedUsersForAssignment([]);
      setAssignmentData({ organization_id: "", company_id: "", role: "employee" });
      await loadUsers();
    } catch (error: any) {
      console.error('Error assigning users to company:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to assign users to company",
        variant: "destructive",
      });
    }
  };

  const toggleUserSelection = (userId: string) => {
    console.log('Toggling user selection for:', userId);
    console.log('Current selected users:', selectedUsersForAssignment);
    
    setSelectedUsersForAssignment(prev => {
      const newSelection = prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId];
      console.log('New selection:', newSelection);
      return newSelection;
    });
  };

  const selectAllUsers = () => {
    const availableUserIds = availableUsersForAssignment.map(user => user.user_id);
    setSelectedUsersForAssignment(availableUserIds);
  };

  const clearUserSelection = () => {
    setSelectedUsersForAssignment([]);
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
      case 'operations_manager':
        return 'default';
      case 'manager':
        return 'default';
      case 'admin':
        return 'default';
      default:
        return 'secondary';
    }
  };

  const formatRoleLabel = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'Super Admin';
      case 'operations_manager':
        return 'Organization Manager';
      case 'manager':
        return 'Company Manager';
      case 'employee':
        return 'Employee';
      case 'admin':
        return 'Admin';
      case 'user':
        return 'User';
      default:
        return role.replace('_', ' ');
    }
  };

  // Filter users based on search term, role, and status
  const filteredUsers = users.filter((user) => {
    const matchesSearch = 
      user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = selectedRole === "all" || user.role === selectedRole;
    const matchesStatus = selectedStatus === "all" || user.status === selectedStatus;
    
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
        <p className="text-muted-foreground">Only super administrators can access user management.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">User Management</h1>
        <p className="text-muted-foreground">
          Manage users and their roles in the system.
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
              <Users className="h-5 w-5" />
              Users ({filteredUsers.length} of {users.length})
            </div>
            <div className="flex items-center gap-2">
              <Dialog
                open={isDialogOpen}
                onOpenChange={(open) => {
                  setIsDialogOpen(open);
                  if (!open) {
                    loadUsers();
                    setSearchTerm("");
                    setSelectedRole("all");
                    setSelectedStatus("all");
                  }
                }}
              >
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add User
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Add New User</DialogTitle>
                  <DialogDescription>
                    Create a new user account and assign a role.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="username" className="text-right">
                      Username
                    </Label>
                    <Input
                      id="username"
                      type="text"
                      value={newUser.username}
                      onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                      className="col-span-3"
                      placeholder="Login username"
                    />
                  </div>
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
                    <Label htmlFor="employee_pin" className="text-right">
                      Employee PIN
                    </Label>
                    <Input
                      id="employee_pin"
                      type="text"
                      maxLength={4}
                      value={newUser.employee_pin}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                        setNewUser({ ...newUser, employee_pin: val });
                      }}
                      className="col-span-3"
                      placeholder="4-digit PIN"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="role" className="text-right">
                      Role
                    </Label>
                    <Select value={newUser.role} onValueChange={(value: "employee" | "house_keeping" | "maintenance" | "manager" | "operations_manager" | "super_admin") => setNewUser({ ...newUser, role: value, organization_id: "", company_id: "" })}>
                      <SelectTrigger className="col-span-3">
                        <SelectValue />
                      </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="employee">Employee</SelectItem>
                          <SelectItem value="house_keeping">House Keeping</SelectItem>
                          <SelectItem value="maintenance">Maintenance</SelectItem>
                          <SelectItem value="manager">Company Manager</SelectItem>
                          <SelectItem value="operations_manager">Organization Manager</SelectItem>
                          {currentUserRole === 'super_admin' && <SelectItem value="super_admin">Super Admin</SelectItem>}
                        </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Show Organization dropdown for Organization Manager */}
                  {newUser.role === 'operations_manager' && (
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="org_select" className="text-right">
                        Organization
                      </Label>
                      <Select 
                        value={newUser.organization_id} 
                        onValueChange={(value) => setNewUser({ ...newUser, organization_id: value })}
                      >
                        <SelectTrigger className="col-span-3">
                          <SelectValue placeholder="Select organization" />
                        </SelectTrigger>
                        <SelectContent>
                          {organizations.map((org) => (
                            <SelectItem key={org.id} value={org.id}>
                              {org.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  
                  {/* Show Organization/Company dropdowns for Company Manager role */}
                  {newUser.role === 'manager' && (
                    <>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="org_select" className="text-right">
                          Organization
                        </Label>
                        <Select 
                          value={newUser.organization_id} 
                          onValueChange={(value) => setNewUser({ ...newUser, organization_id: value, company_id: "" })}
                        >
                          <SelectTrigger className="col-span-3">
                            <SelectValue placeholder="Select organization" />
                          </SelectTrigger>
                          <SelectContent>
                            {organizations.map((org) => (
                              <SelectItem key={org.id} value={org.id}>
                                {org.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="company_select" className="text-right">
                          Company
                        </Label>
                        <Select 
                          value={newUser.company_id} 
                          onValueChange={(value) => setNewUser({ ...newUser, company_id: value })}
                          disabled={!newUser.organization_id}
                        >
                          <SelectTrigger className="col-span-3">
                            <SelectValue placeholder={newUser.organization_id ? "Select company" : "Select organization first"} />
                          </SelectTrigger>
                          <SelectContent>
                            {companies
                              .filter((company) => company.organization_id === newUser.organization_id)
                              .map((company) => (
                                <SelectItem key={company.id} value={company.id}>
                                  {company.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                  
                  {/* Show Organization/Company dropdowns for Employee-type roles */}
                  {(newUser.role === 'employee' || newUser.role === 'house_keeping' || newUser.role === 'maintenance') && (
                    <>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="org_select" className="text-right">
                          Organization
                        </Label>
                        <Select 
                          value={newUser.organization_id} 
                          onValueChange={(value) => setNewUser({ ...newUser, organization_id: value, company_id: "" })}
                        >
                          <SelectTrigger className="col-span-3">
                            <SelectValue placeholder="Select organization" />
                          </SelectTrigger>
                          <SelectContent>
                            {organizations.map((org) => (
                              <SelectItem key={org.id} value={org.id}>
                                {org.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="company_select" className="text-right">
                          Company
                        </Label>
                        <Select 
                          value={newUser.company_id} 
                          onValueChange={(value) => setNewUser({ ...newUser, company_id: value })}
                          disabled={!newUser.organization_id}
                        >
                          <SelectTrigger className="col-span-3">
                            <SelectValue placeholder={newUser.organization_id ? "Select company" : "Select organization first"} />
                          </SelectTrigger>
                          <SelectContent>
                            {companies
                              .filter((company) => company.organization_id === newUser.organization_id)
                              .map((company) => (
                                <SelectItem key={company.id} value={company.id}>
                                  {company.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    onClick={createUser}
                    disabled={isCreating}
                  >
                    {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isCreating ? "Creating…" : "Create User"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={isAssignCompanyDialogOpen} onOpenChange={setIsAssignCompanyDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Building2 className="h-4 w-4 mr-2" />
                  Assign to Organization
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Assign User to Organization</DialogTitle>
                  <DialogDescription>
                    Select users and assign them to an organization/company with a specific role.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">
                        Available Users ({selectedUsersForAssignment.length} selected)
                      </Label>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={selectAllUsers}
                        >
                          Select All
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={clearUserSelection}
                        >
                          Clear All
                        </Button>
                      </div>
                    </div>
                    <div className="border rounded-md max-h-48 overflow-y-auto">
                      {availableUsersForAssignment.length === 0 ? (
                        <div className="p-4 text-center text-muted-foreground text-sm">
                          No available users to assign. All users are either already assigned or don't have the required permissions.
                        </div>
                      ) : (
                        availableUsersForAssignment.map((userItem) => (
                            <div
                              key={userItem.user_id}
                              className="flex items-center gap-3 p-3 border-b last:border-b-0 hover:bg-muted/50"
                            >
                              <label className="flex items-center gap-3 cursor-pointer flex-1">
                                <input
                                  type="checkbox"
                                  checked={selectedUsersForAssignment.includes(userItem.user_id)}
                                  onChange={(e) => {
                                    console.log('Checkbox changed for:', userItem.user_id, e.target.checked);
                                    toggleUserSelection(userItem.user_id);
                                  }}
                                  className="h-4 w-4 rounded border-gray-300"
                                />
                                <div className="flex-1">
                                  <div className="font-medium text-sm">{userItem.full_name}</div>
                                  <div className="text-xs text-muted-foreground">{userItem.email}</div>
                                </div>
                                <Badge variant={getRoleBadgeVariant(userItem.role)} className="text-xs">
                                  {userItem.role === 'admin' ? 'Admin (Unassigned)' : userItem.role.replace('_', ' ')}
                                </Badge>
                              </label>
                            </div>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="organization_select" className="text-right">
                      Organization
                    </Label>
                    <Select 
                      value={assignmentData.organization_id} 
                      onValueChange={(value) => setAssignmentData({ ...assignmentData, organization_id: value, company_id: "" })}
                    >
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Select an organization" />
                      </SelectTrigger>
                      <SelectContent>
                        {organizations.map((org) => (
                          <SelectItem key={org.id} value={org.id}>
                            {org.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {assignmentData.role !== "operations_manager" && (
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="company_select" className="text-right">
                        Company
                      </Label>
                      <Select 
                        value={assignmentData.company_id} 
                        onValueChange={(value) => setAssignmentData({ ...assignmentData, company_id: value })}
                        disabled={!assignmentData.organization_id}
                      >
                        <SelectTrigger className="col-span-3">
                          <SelectValue placeholder={assignmentData.organization_id ? "Select a company" : "Select organization first"} />
                        </SelectTrigger>
                        <SelectContent>
                          {companies
                            .filter((company) => company.organization_id === assignmentData.organization_id)
                            .map((company) => (
                              <SelectItem key={company.id} value={company.id}>
                                {company.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="assignment_role" className="text-right">
                      Role
                    </Label>
                    <Select 
                      value={assignmentData.role} 
                      onValueChange={(value: "employee" | "manager" | "operations_manager" | "super_admin") => setAssignmentData({ ...assignmentData, role: value })}
                    >
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Select role" />
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
                    onClick={assignUsersToCompany}
                    disabled={
                      selectedUsersForAssignment.length === 0 ||
                      (assignmentData.role === "operations_manager" ? !assignmentData.organization_id : !assignmentData.company_id)
                    }
                  >
                    Assign {selectedUsersForAssignment.length} User{selectedUsersForAssignment.length !== 1 ? 's' : ''} to Organization
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Manager</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No users found matching the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((userProfile) => (
                <TableRow key={userProfile.id}>
                  <TableCell className="font-medium">
                    {userProfile.full_name || 'No name'}
                  </TableCell>
                  <TableCell>{userProfile.email}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(userProfile.status)}>
                      {userProfile.status.charAt(0).toUpperCase() + userProfile.status.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getRoleBadgeVariant(userProfile.role)}>
                      {formatRoleLabel(userProfile.role)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {userProfile.manager_name ? (
                      <span className="text-sm">{userProfile.manager_name}</span>
                    ) : (
                      <span className="text-sm text-muted-foreground">No manager</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {new Date(userProfile.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          // Load org/company lists first so we have fresh data for dropdowns and lookups
                          const [orgs, comps] = await Promise.all([loadOrganizations(), loadCompanies()]);
                          let orgId: string | undefined;
                          let companyId: string | undefined;
                          
                          if (userProfile.role === 'operations_manager') {
                            const org = orgs.find((o: any) => o.organization_manager === userProfile.user_id);
                            orgId = org?.id;
                            setEditingUser({ ...userProfile, organization_id: orgId, company_id: companyId });
                          } else if (userProfile.role === 'manager') {
                            const company = comps.find((c: any) => c.company_manager === userProfile.user_id);
                            if (company) {
                              companyId = company.id;
                              orgId = company.organization_id ?? company.organization;
                            }
                            setEditingUser({ ...userProfile, organization_id: orgId, company_id: companyId });
                          } else if (userProfile.role === 'employee' || userProfile.role === 'house_keeping' || userProfile.role === 'maintenance') {
                            let employee: any = null;
                            try {
                              const employees = await apiClient.get<any[]>('/scheduler/employees/', { 
                                user: userProfile.user_id 
                              });
                              employee = Array.isArray(employees) && employees.length > 0 ? employees[0] : null;
                              if (!employee) {
                                const byEmail = await apiClient.get<any[]>('/scheduler/employees/', { 
                                  email: userProfile.email 
                                });
                                employee = Array.isArray(byEmail) && byEmail.length > 0 ? byEmail[0] : null;
                              }
                            } catch (error) {
                              employee = null;
                            }
                            companyId = employee?.company_id ?? employee?.company ?? undefined;
                            if (companyId) {
                              const company = comps.find((c: any) => c.id === companyId);
                              orgId = company?.organization_id ?? company?.organization ?? undefined;
                            }
                            const pin = employee?.employee_pin != null && employee?.employee_pin !== '' ? String(employee.employee_pin) : '';
                            setEditingUser({
                              ...userProfile,
                              organization_id: orgId,
                              company_id: companyId,
                              employee_pin: pin,
                            });
                          } else {
                            setEditingUser({ ...userProfile, organization_id: orgId, company_id: companyId });
                          }
                          setIsEditDialogOpen(true);
                        }}
                        className="h-8 w-8 p-0"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => reinviteUser(userProfile.email, userProfile.full_name || '', userProfile.role)}
                        className="h-8 px-2"
                        title="Re-invite user"
                      >
                        <Mail className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteUser(userProfile.user_id, userProfile.email)}
                        className="h-8 w-8 p-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                ))
              )}
            </TableBody>
          </Table>
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
                <Label htmlFor="edit_username" className="text-right">
                  Username
                </Label>
                <Input
                  id="edit_username"
                  type="text"
                  autoComplete="username"
                  value={editingUser.username ?? ''}
                  onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })}
                  className="col-span-3"
                  placeholder="Login username"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit_email" className="text-right">
                  Email
                </Label>
                <Input
                  id="edit_email"
                  type="email"
                  value={editingUser.email}
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit_full_name" className="text-right">
                  Full Name
                </Label>
                <Input
                  id="edit_full_name"
                  value={editingUser.full_name || ""}
                  onChange={(e) => setEditingUser({ ...editingUser, full_name: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit_role" className="text-right">
                  Role
                </Label>
                <Select 
                  value={editingUser.role} 
                  onValueChange={(value: "employee" | "manager" | "operations_manager" | "super_admin") => setEditingUser({ ...editingUser, role: value, organization_id: undefined, company_id: undefined })}
                >
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
              
              {/* Show Organization dropdown for Organization Manager */}
              {editingUser.role === 'operations_manager' && (
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit_org_select" className="text-right">
                    Organization
                  </Label>
                  <Select 
                    value={editingUser.organization_id || ""} 
                    onValueChange={(value) => setEditingUser({ ...editingUser, organization_id: value })}
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select organization" />
                    </SelectTrigger>
                    <SelectContent>
                      {organizations.map((org) => (
                        <SelectItem key={org.id} value={org.id}>
                          {org.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              {/* Show Organization/Company dropdowns for Company Manager role */}
              {editingUser.role === 'manager' && (
                <>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="edit_org_select" className="text-right">
                      Organization
                    </Label>
                    <Select 
                      value={editingUser.organization_id || ""} 
                      onValueChange={(value) => setEditingUser({ ...editingUser, organization_id: value, company_id: undefined })}
                    >
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Select organization" />
                      </SelectTrigger>
                      <SelectContent>
                        {organizations.map((org) => (
                          <SelectItem key={org.id} value={org.id}>
                            {org.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="edit_company_select" className="text-right">
                      Company
                    </Label>
                    <Select 
                      value={editingUser.company_id || ""} 
                      onValueChange={(value) => setEditingUser({ ...editingUser, company_id: value })}
                      disabled={!editingUser.organization_id}
                    >
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder={editingUser.organization_id ? "Select company" : "Select organization first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {companies
                          .filter((company) => company.organization_id === editingUser.organization_id)
                          .map((company) => (
                            <SelectItem key={company.id} value={company.id}>
                              {company.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
              
              {/* Show Organization/Company dropdowns for Employee-type roles */}
              {(editingUser.role === 'employee' || editingUser.role === 'house_keeping' || editingUser.role === 'maintenance') && (
                <>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="edit_org_select" className="text-right">
                      Organization
                    </Label>
                    <Select 
                      value={editingUser.organization_id || ""} 
                      onValueChange={(value) => setEditingUser({ ...editingUser, organization_id: value, company_id: undefined })}
                    >
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Select organization" />
                      </SelectTrigger>
                      <SelectContent>
                        {organizations.map((org) => (
                          <SelectItem key={org.id} value={org.id}>
                            {org.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="edit_company_select" className="text-right">
                      Company
                    </Label>
                    <Select 
                      value={editingUser.company_id || ""} 
                      onValueChange={(value) => setEditingUser({ ...editingUser, company_id: value })}
                      disabled={!editingUser.organization_id}
                    >
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder={editingUser.organization_id ? "Select company" : "Select organization first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {companies
                          .filter((company) => company.organization_id === editingUser.organization_id)
                          .map((company) => (
                            <SelectItem key={company.id} value={company.id}>
                              {company.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="edit_employee_pin" className="text-right">
                      Employee PIN
                    </Label>
                    <Input
                      id="edit_employee_pin"
                      type="text"
                      inputMode="numeric"
                      placeholder="4-digit PIN"
                      maxLength={10}
                      value={editingUser.employee_pin ?? ""}
                      onChange={(e) => setEditingUser({ ...editingUser, employee_pin: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                      className="col-span-3"
                    />
                  </div>
                </>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditDialogOpen(false);
                setEditingUser(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={editUser}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}