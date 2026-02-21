import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import apiClient from "@/lib/api-client";
import type { UserRole } from "@/types/auth";

export type { UserRole };

/**
 * Role Hierarchy:
 * 1. Super Admin - Full access
 * 2. Organization Manager (operations_manager) - Assigned organization only
 * 3. Company Manager (manager) - Assigned company only
 * 4. Employee - Own profile and shifts
 */
export const useUserRole = () => {
  const { user } = useAuth();
  const [role, setRole] = useState<UserRole | null>(null);
  const [allRoles, setAllRoles] = useState<UserRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserRole = async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      const userData = await apiClient.getCurrentUser() as any;
      
      // Check if user has roles in the response
      if (userData?.roles && userData.roles.length > 0) {
        const roles = userData.roles.map((r: any) => (r.role ?? r.name) as UserRole);
        setAllRoles(roles);
        
        // Determine primary role based on hierarchy priority
        if (roles.includes('super_admin')) {
          setRole('super_admin');
        } else if (roles.includes('operations_manager')) {
          setRole('operations_manager'); // Organization Manager
        } else if (roles.includes('manager')) {
          setRole('manager'); // Company Manager
        } else if (roles.includes('admin')) {
          setRole('admin');
        } else if (roles.includes('employee')) {
          setRole('employee');
        } else if (roles.includes('house_keeping')) {
          setRole('house_keeping');
        } else if (roles.includes('maintenance')) {
          setRole('maintenance');
        } else {
          setRole('user');
        }
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

  useEffect(() => {
    fetchUserRole();
  }, [user]);

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
