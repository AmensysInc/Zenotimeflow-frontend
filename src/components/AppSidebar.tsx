import { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
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
 * 1. Super Admin - Full access to entire application
 * 2. Organization Manager (operations_manager) - Access to assigned organization
 * 3. Company Manager (manager) - Access to assigned company
 * 4. Employee - Access to own profile and tasks only
 */
type UserRole = 'user' | 'admin' | 'super_admin' | 'operations_manager' | 'manager' | 'employee' | 'house_keeping' | 'maintenance';

export function AppSidebar() {
  const { state } = useSidebar();
  const { user } = useAuth();
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [userAppType, setUserAppType] = useState<string | null>(null);
  const [isEmployeeLinked, setIsEmployeeLinked] = useState(false);
  const location = useLocation();
  const currentPath = location.pathname;
  const collapsed = state === "collapsed";

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;
      
      // Fetch user roles
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
        const roles = rolesData.map((item: any) => item.role as UserRole);
        const appTypes = rolesData.map((item: any) => item.app_type);
        
        // Determine primary role
        if (roles.includes('super_admin')) {
          setUserRole('super_admin');
          setUserAppType('both');
        } else if (roles.includes('operations_manager')) {
          setUserRole('operations_manager');
          // Organization Managers need full scheduler access
          setUserAppType('scheduler');
        } else if (roles.includes('manager')) {
          setUserRole('manager');
         // Company Managers are part of the Scheduler app (they manage employees + schedules)
         setUserAppType('scheduler');
        } else if (roles.includes('admin')) {
          setUserRole('admin');
          setUserAppType('scheduler');
        } else if (roles.includes('employee')) {
          setUserRole('employee');
          setUserAppType('employee');
        } else if (roles.includes('house_keeping')) {
          setUserRole('house_keeping');
          setUserAppType('employee');
        } else if (roles.includes('maintenance')) {
          setUserRole('maintenance');
          setUserAppType('employee');
        } else {
          setUserRole('user');
          setUserAppType(appTypes[0] || 'calendar');
        }
      } else {
        setUserRole(null);
        setUserAppType('calendar');
      }
    };

    fetchUserData();
  }, [user]);

  // Main features - available to all users
  const mainItems = [
    { title: "Calendar", url: "/calendar", icon: Calendar },
    { title: "Tasks", url: "/tasks", icon: CheckSquare },
    { title: "Focus Hours", url: "/focus", icon: Timer },
    { title: "Daily Routines", url: "/habits", icon: Target },
  ];

  // Employee-specific items (schedule view)
  const employeeItems = [
    { title: "My Dashboard", url: "/scheduler/my-dashboard", icon: LayoutDashboard },
    { title: "Schedule", url: "/scheduler/schedule", icon: Calendar },
  ];

  // Admin scheduler items
  const schedulerAdminItems = [
    { title: "Companies", url: "/scheduler/companies", icon: Building },
    { title: "Schedule", url: "/scheduler/schedule", icon: Calendar },
    { title: "Employees", url: "/scheduler/employees", icon: UserCheck },
    { title: "Employee Schedule", url: "/scheduler/employee-schedule", icon: CalendarClock },
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
  const isOperationalStaff = userRole === 'employee' || userRole === 'house_keeping' || userRole === 'maintenance';
  
  const showMainFeatures = isOperationalStaff || 
    userRole === 'manager' || userRole === 'super_admin' || userRole === 'operations_manager' ||
    userAppType === 'calendar' || userAppType === 'both' || userAppType === 'calendar_plus';
  
  const showEmployeeSection = (isOperationalStaff && isEmployeeLinked);
  
  const showSchedulerAdmin = userRole === 'super_admin' || userRole === 'admin' || 
    userRole === 'operations_manager' || userRole === 'manager' ||
    userAppType === 'scheduler' || userAppType === 'both';

  const schedulerItemsForRole = (() => {
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
                      <NavLink to={item.url} end className={getNavCls}>
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
                      <NavLink to={item.url} end className={getNavCls}>
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

        {/* Scheduler Admin Section - for admins only, not regular employees */}
        {showSchedulerAdmin && !isOperationalStaff && (
          <SidebarGroup>
            <SidebarGroupLabel>
              {userAppType === 'calendar_plus' ? 'Companies' : 'Scheduler'}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {userAppType === 'calendar_plus' ? (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink to="/scheduler/companies" end className={getNavCls}>
                        <Building className="h-4 w-4" />
                        {!collapsed && <span>Companies</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ) : (
                  schedulerItemsForRole.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink to={item.url} end className={getNavCls}>
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
                    <NavLink to={item.url} end className={getNavCls}>
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
