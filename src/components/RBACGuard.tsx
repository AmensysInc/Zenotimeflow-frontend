/**
 * RBAC Route Guard – reuse RoleProtectedRoute for role-based access.
 * Use for routes that only certain roles can access; others are redirected to their dashboard.
 *
 * Usage:
 *   <RBACGuard allowedRoles={["super_admin", "manager"]}>
 *     <AdminOnlyPage />
 *   </RBACGuard>
 */
import RoleProtectedRoute from "@/components/RoleProtectedRoute";
import type { UserRole } from "@/types/auth";

interface RBACGuardProps {
  children: React.ReactNode;
  /** Roles that can access this route. Others are redirected to their role dashboard. */
  allowedRoles: UserRole[];
}

export default function RBACGuard({ children, allowedRoles }: RBACGuardProps) {
  return (
    <RoleProtectedRoute allowedRoles={allowedRoles}>
      {children}
    </RoleProtectedRoute>
  );
}
