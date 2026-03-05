import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import apiClient from "@/lib/api-client";
import type { UserRole } from "@/types/auth";
import { getPrimaryRole } from "@/types/auth";

export type { UserRole };

/**
 * Role Hierarchy:
 * 1. Super Admin - Full access
 * 2. Organization Manager (operations_manager) - Assigned organization only
 * 3. Company Manager (manager) - Assigned company only
 * 4. Employee - Own profile and shifts
 */
export const useUserRole = () => {
  const { user, role: authRole } = useAuth();
  const [role, setRole] = useState<UserRole | null>(authRole ?? null);
  const [allRoles, setAllRoles] = useState<UserRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRole(null);
      setAllRoles([]);
      setIsLoading(false);
      return;
    }
    // Use role from auth context when available to avoid duplicate getCurrentUser
    const rolesFromUser = user?.roles;
    if (rolesFromUser && Array.isArray(rolesFromUser) && rolesFromUser.length > 0) {
      const roles = rolesFromUser.map((r: { role?: string; name?: string }) => (r.role ?? r.name) as UserRole);
      setAllRoles(roles);
      setRole(authRole ?? getPrimaryRole(rolesFromUser));
      setIsLoading(false);
      return;
    }
    if (authRole != null) {
      setRole(authRole);
      setAllRoles([authRole]);
      setIsLoading(false);
      return;
    }
    // No roles in user and no authRole: fetch once to get roles
    const fetchUserRole = async () => {
      try {
        const userData = (await apiClient.getCurrentUser()) as { roles?: { role?: string; name?: string }[] };
        if (userData?.roles?.length) {
          const roles = userData.roles.map((r) => (r.role ?? r.name) as UserRole);
          setAllRoles(roles);
          setRole(
            roles.includes('super_admin') ? 'super_admin'
            : roles.includes('operations_manager') ? 'operations_manager'
            : roles.includes('manager') ? 'manager'
            : roles.includes('admin') ? 'admin'
            : roles.includes('employee') ? 'employee'
            : roles.includes('house_keeping') ? 'house_keeping'
            : roles.includes('maintenance') ? 'maintenance'
            : 'user'
          );
        } else {
          setRole('user');
          setAllRoles(['user']);
        }
      } catch (error) {
        console.error('Error in fetchUserRole:', error);
        setRole(null);
      } finally {
        setIsLoading(false);
      }
    };
    fetchUserRole();
  }, [user?.id, authRole]);

  // Super Admin, Organization Manager (operations_manager), and Company Manager (manager) have admin privileges
  const isAdmin = role === 'admin' || role === 'super_admin' || role === 'operations_manager' || role === 'manager';
  // Employees, house_keeping, and maintenance are all operational staff with same access level
  const isEmployee = role === 'employee' || role === 'house_keeping' || role === 'maintenance';
  const isSuperAdmin = role === 'super_admin';
  const isOrganizationManager = role === 'operations_manager';
  const isCompanyManager = role === 'manager';
  const canManageShifts = role === 'admin' || role === 'super_admin' || role === 'operations_manager' || role === 'manager';

  return { 
    role, 
    allRoles, 
    isLoading, 
    isAdmin, 
    isEmployee,
    isSuperAdmin,
    isOrganizationManager,
    isCompanyManager,
    canManageShifts 
  };
};
