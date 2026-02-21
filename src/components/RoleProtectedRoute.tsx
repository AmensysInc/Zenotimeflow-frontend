import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { getDefaultRouteForRole } from "@/components/RedirectToUserHome";
import type { UserRole } from "@/types/auth";
import { useEffect } from "react";

interface RoleProtectedRouteProps {
  children: React.ReactNode;
  /** Allowed roles for this route. If empty or undefined, any authenticated user can access. */
  allowedRoles?: UserRole[];
}


export default function RoleProtectedRoute({ children, allowedRoles }: RoleProtectedRouteProps) {
  const { user, role, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      navigate("/auth", { replace: true, state: { from: location.pathname } });
      return;
    }
    if (allowedRoles?.length && role && !allowedRoles.includes(role)) {
      const dashboard = getDefaultRouteForRole(role);
      navigate(dashboard, { replace: true });
    }
  }, [user, role, isLoading, allowedRoles, navigate, location.pathname]);

  // Always show a visible state so the user never sees a blank screen
  const loadingOrRedirecting = (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );

  if (isLoading) return loadingOrRedirecting;

  if (!user) return loadingOrRedirecting;

  if (allowedRoles?.length && role && !allowedRoles.includes(role)) {
    return loadingOrRedirecting;
  }

  return <>{children}</>;
}
