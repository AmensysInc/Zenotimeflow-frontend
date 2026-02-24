import { Navigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";

/**
 * Redirects to the appropriate clock-in page based on role.
 * Employees -> /employee/dashboard (has clock in/out)
 * Managers/Admins -> /scheduler/time-clock
 */
export function ClockInRedirect() {
  const { role } = useUserRole();

  if (role === "employee" || role === "house_keeping" || role === "maintenance") {
    return <Navigate to="/employee/dashboard" replace />;
  }
  return <Navigate to="/scheduler/time-clock" replace />;
}
