import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import type { UserRole } from "@/types/auth";

/**
 * Role-based default dashboard routes. Used after login and for unauthorized redirects.
 * Super Admin -> /super-admin/dashboard
 * Organization Manager -> /organization/dashboard
 * Company Manager -> /company/dashboard
 * Employee -> /employee/dashboard
 */
export function getDefaultRouteForRole(role: UserRole | null): string {
  switch (role) {
    case "super_admin":
      return "/super-admin/dashboard";
    case "operations_manager":
      return "/organization/dashboard";
    case "manager":
      return "/company/dashboard";
    case "admin":
      return "/super-admin/dashboard";
    case "employee":
    case "house_keeping":
    case "maintenance":
      return "/employee/dashboard";
    case "user":
    default:
      return "/calendar";
  }
}

/**
 * Redirects to the role-appropriate dashboard. Uses auth.role from context (no extra fetch).
 */
export function RedirectToUserHome() {
  const { user, role, isLoading } = useAuth();
  const target = getDefaultRouteForRole(role ?? "user");

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <Navigate to={target} replace />;
}
