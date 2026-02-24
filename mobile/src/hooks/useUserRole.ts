import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getCurrentUser } from '../api/extensions';

export type UserRole =
  | 'super_admin'
  | 'operations_manager'
  | 'manager'
  | 'admin'
  | 'employee'
  | 'house_keeping'
  | 'maintenance'
  | 'user';

/**
 * Role hierarchy (matches web):
 * 1. Super Admin - Full access
 * 2. Organization Manager (operations_manager)
 * 3. Company Manager (manager)
 * 4. Employee / house_keeping / maintenance
 */
export function useUserRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setRole(null);
      setIsLoading(false);
      return;
    }

    (async () => {
      try {
        const userData = await getCurrentUser();
        if (cancelled) return;
        const roles = userData?.roles || [];
        const roleList = roles.map((r: any) => (r.role ?? r.name) as UserRole);

        if (roleList.includes('super_admin')) {
          setRole('super_admin');
        } else if (roleList.includes('operations_manager')) {
          setRole('operations_manager');
        } else if (roleList.includes('manager')) {
          setRole('manager');
        } else if (roleList.includes('admin')) {
          setRole('admin');
        } else if (roleList.includes('employee')) {
          setRole('employee');
        } else if (roleList.includes('house_keeping')) {
          setRole('house_keeping');
        } else if (roleList.includes('maintenance')) {
          setRole('maintenance');
        } else {
          setRole('user');
        }
      } catch (e) {
        if (!cancelled) setRole('user');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const isAdmin =
    role === 'super_admin' ||
    role === 'operations_manager' ||
    role === 'manager' ||
    role === 'admin';
  const isEmployee = role === 'employee' || role === 'house_keeping' || role === 'maintenance';

  return { role, isLoading, isAdmin, isEmployee };
}
