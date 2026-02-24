import { useState, useEffect } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  CheckSquare,
  Calendar,
  Timer,
  Target,
  Users,
  Settings,
  GraduationCap,
  Building,
  Clock,
  UserCheck,
  LayoutDashboard,
  CalendarClock,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import apiClient from "@/lib/api-client";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

/**
 * Role Hierarchy:
 * 1. Super Admin - Full access; can assign tasks and check lists to anyone.
 * 2. Organization Manager (operations_manager) - Can assign to company managers and employees in their org.
 * 3. Company Manager (manager) - Can assign to employees in their company(ies).
 * 4. Employee - Can create own tasks, focus hours, daily routines; cannot create check lists (only receive them).
 */
type UserRole = 'user' | 'admin' | 'super_admin' | 'operations_manager' | 'manager' | 'employee' | 'house_keeping' | 'maintenance';

export function AppSidebar() {
  const { state } = useSidebar();
  const { user, role: authRole } = useAuth(); // Use role from auth context
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [userAppType, setUserAppType] = useState<string | null>(null);
  const [isEmployeeLinked, setIsEmployeeLinked] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const collapsed = state === "collapsed";

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;
      
      // Use role from auth context if available, otherwise fetch
      if (authRole) {
        setUserRole(authRole);
      }
      
      // Fetch user roles for app_type determination
      const userData = await apiClient.getCurrentUser() as any;
      const rolesData = userData?.roles || [];
      
      // Check if user has employee record
      try {
        const employees = await apiClient.get<any[]>('/scheduler/employees/', { user: user.id });
        setIsEmployeeLinked(employees && employees.length > 0);
      } catch {
        setIsEmployeeLinked(false);
      }
      
      if (rolesData && rolesData.length > 0) {
        const roles = rolesData.map((item: any) => (item.role ?? item.name) as UserRole);
        const appTypes = rolesData.map((item: any) => item.app_type);
        
        // Determine primary role (use authRole if available, otherwise determine from roles)
        let primaryRole: UserRole | null = authRole || null;
        if (!primaryRole && roles.length > 0) {
          if (roles.includes('super_admin')) {
            primaryRole = 'super_admin';
          } else if (roles.includes('operations_manager')) {
            primaryRole = 'operations_manager';
          } else if (roles.includes('manager')) {
            primaryRole = 'manager';
          } else if (roles.includes('admin')) {
            primaryRole = 'admin';
          } else if (roles.includes('employee')) {
            primaryRole = 'employee';
          } else if (roles.includes('house_keeping')) {
            primaryRole = 'house_keeping';
          } else if (roles.includes('maintenance')) {
            primaryRole = 'maintenance';
          } else {
            primaryRole = 'user';
          }
        }
        
        setUserRole(primaryRole);
        
        // Determine app type based on role
        if (primaryRole === 'super_admin') {
          setUserAppType('both');
        } else if (primaryRole === 'operations_manager' || primaryRole === 'manager' || primaryRole === 'admin') {
          setUserAppType('scheduler');
        } else if (primaryRole === 'employee' || primaryRole === 'house_keeping' || primaryRole === 'maintenance') {
          setUserAppType('employee');
        } else {
          setUserAppType(appTypes[0] || 'calendar');
        }
      } else {
        setUserRole(authRole || null);
        setUserAppType('calendar');
      }
    };

    fetchUserData();
  }, [user, authRole]);

  // Main features - available to all users
  const mainItems = [
    { title: "Calendar", url: "/calendar", icon: Calendar },
    { title: "Tasks", url: "/tasks", icon: CheckSquare },
    { title: "Focus Hours", url: "/focus", icon: Timer },
    { title: "Daily Routines", url: "/habits", icon: Target },
  ];

  // Employee-specific items: own dashboard and own schedule (not manager schedule)
  const employeeItems = [
    { title: "My Dashboard", url: "/employee/dashboard", icon: LayoutDashboard },
    { title: "My Schedule", url: "/scheduler/employee-schedule", icon: Calendar },
  ];

  // Admin scheduler items - super_admin sees all
  const schedulerAdminItems = [
    { title: "Companies", url: "/scheduler/companies", icon: Building },
    { title: "Schedule", url: "/scheduler/schedule", icon: Calendar },
    { title: "Employees", url: "/scheduler/employees", icon: UserCheck },
    { title: "Employee Schedule", url: "/scheduler/employee-schedule", icon: CalendarClock },
    { title: "Time Clock", url: "/scheduler/time-clock", icon: Clock },
    { title: "Missed Shifts", url: "/scheduler/missed-shifts", icon: AlertTriangle },
  ];

  // Management items based on role
  const getManagementItems = () => {
    const items = [
      { title: "Account", url: "/account", icon: Settings },
    ];

    // Checklists for managers, operations_managers, and super_admins only (not employees)
    if (userRole === 'super_admin' || userRole === 'manager' || userRole === 'operations_manager') {
      items.push({ title: "Check Lists", url: "/template", icon: GraduationCap });
    }

    // User Management only for super_admin
    if (userRole === 'super_admin') {
      items.push({ title: "User Management", url: "/user-management", icon: Users });
    }

    return items;
  };

  const isActive = (path: string) => currentPath === path;
  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive ? "bg-accent text-accent-foreground font-medium" : "hover:bg-accent/50";

  // Determine which sections to show based on role hierarchy
  // Operational staff includes employee, house_keeping, and maintenance
  // Note: super_admin and admin have their own role, so they won't be operational staff
  const isOperationalStaff = userRole === 'employee' || userRole === 'house_keeping' || userRole === 'maintenance';
  
  const showMainFeatures = isOperationalStaff || 
    userRole === 'manager' || userRole === 'super_admin' || userRole === 'admin' || userRole === 'operations_manager' ||
    userAppType === 'calendar' || userAppType === 'both' || userAppType === 'calendar_plus';
  
  // Show employee section for all operational staff so they can open dashboard (page shows "Not an Employee" if not linked)
  const showEmployeeSection = isOperationalStaff;
  
  // Super admin and admin ALWAYS see scheduler section, regardless of other roles
  const showSchedulerAdmin = userRole === 'super_admin' || userRole === 'admin' || 
    userRole === 'operations_manager' || userRole === 'manager' ||
    userAppType === 'scheduler' || userAppType === 'both';

  const schedulerItemsForRole = (() => {
    // Super admin sees ALL scheduler items
    if (userRole === 'super_admin' || userRole === 'admin') {
      return schedulerAdminItems;
    }
    if (userRole === 'manager') {
      return schedulerAdminItems.filter((item) => item.title !== 'Companies');
    }
    if (userRole === 'operations_manager') {
      return schedulerAdminItems.filter((item) => item.title !== 'Schedule');
    }
    return schedulerAdminItems;
  })();

  return (
    <Sidebar className={collapsed ? "w-14" : "w-60"} collapsible="icon">
      <SidebarContent>
        {/* Main Features - available to all */}
        {showMainFeatures && (
          <SidebarGroup>
            <SidebarGroupLabel>Main Features</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {mainItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url} className={getNavCls}>
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Employee Section - only for employees */}
        {showEmployeeSection && (
          <SidebarGroup>
            <SidebarGroupLabel>My Work</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {employeeItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url} className={getNavCls}>
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Scheduler Admin Section - for admins, super_admins, managers, operations_managers */}
        {/* Super admin and admin ALWAYS see this section, even if they have employee role */}
        {showSchedulerAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>
              {userAppType === 'calendar_plus' ? 'Companies' : 'Scheduler'}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {userAppType === 'calendar_plus' ? (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink to="/scheduler/companies" className={getNavCls}>
                        <Building className="h-4 w-4" />
                        {!collapsed && <span>Companies</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ) : (
                  schedulerItemsForRole.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink to={item.url} className={getNavCls}>
                          <item.icon className="h-4 w-4" />
                          {!collapsed && <span>{item.title}</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Management Section - always visible */}
        <SidebarGroup>
          <SidebarGroupLabel>Management</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {getManagementItems().map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} className={getNavCls}>
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
