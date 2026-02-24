import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import RoleProtectedRoute from "@/components/RoleProtectedRoute";
import Layout from "@/components/Layout";

// Calendar App Pages
import Tasks from "@/pages/Tasks";
import Calendar from "@/pages/Calendar";
import Focus from "@/pages/Focus";
import Habits from "@/pages/Habits";
import Profile from "@/pages/Profile";
import Account from "@/pages/Account";
import UserManagement from "@/pages/UserManagement";
import Template from "@/pages/Template";

// Role-based dashboards
import SuperAdminDashboard from "@/pages/dashboards/SuperAdminDashboard";
import OrganizationDashboard from "@/pages/dashboards/OrganizationDashboard";
import CompanyDashboard from "@/pages/dashboards/CompanyDashboard";
import EmployeeDashboard from "@/pages/scheduler/EmployeeDashboard";

// Scheduler App Pages
import SchedulerCompanies from "@/pages/scheduler/Companies";
import SchedulerSchedule from "@/pages/scheduler/Schedule";
import SchedulerEmployees from "@/pages/scheduler/Employees";
import SchedulerTimeClock from "@/pages/scheduler/TimeClock";
import EmployeeSchedule from "@/pages/scheduler/EmployeeSchedule";
import MissedShifts from "@/pages/scheduler/MissedShifts";

import NotFound from "@/pages/NotFound";
import ClockIn from "@/pages/ClockIn";
import { RedirectToUserHome } from "@/components/RedirectToUserHome";
import { ClockInRedirect } from "@/components/ClockInRedirect";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const AppRouter = () => {
  const { user, isLoading: authLoading } = useAuth();
  const location = useLocation();
  const isClockPath = location.pathname === "/clock" || location.pathname.startsWith("/clock/");

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) {
    if (isClockPath) return <ClockIn />;
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={redirect ? `/auth?redirect=${redirect}` : "/auth"} replace />;
  }

  return (
    <Routes>
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                {/* Entry: redirect to role dashboard */}
                <Route path="/" element={<RedirectToUserHome />} />
                <Route path="/dashboard" element={<RedirectToUserHome />} />
                <Route path="/clock-in" element={<ClockInRedirect />} />

                {/* Role-based dashboard routes */}
                <Route
                  path="/super-admin/dashboard"
                  element={
                    <RoleProtectedRoute allowedRoles={["super_admin", "admin"]}>
                      <SuperAdminDashboard />
                    </RoleProtectedRoute>
                  }
                />
                <Route
                  path="/organization/dashboard"
                  element={
                    <RoleProtectedRoute allowedRoles={["operations_manager"]}>
                      <OrganizationDashboard />
                    </RoleProtectedRoute>
                  }
                />
                <Route
                  path="/company/dashboard"
                  element={
                    <RoleProtectedRoute allowedRoles={["manager"]}>
                      <CompanyDashboard />
                    </RoleProtectedRoute>
                  }
                />
                <Route
                  path="/employee/dashboard"
                  element={
                    <RoleProtectedRoute
                      allowedRoles={["employee", "house_keeping", "maintenance"]}
                    >
                      <ErrorBoundary>
                        <EmployeeDashboard />
                      </ErrorBoundary>
                    </RoleProtectedRoute>
                  }
                />

                {/* Calendar / productivity (all authenticated) */}
                <Route
                  path="/calendar"
                  element={
                    <ErrorBoundary>
                      <Calendar />
                    </ErrorBoundary>
                  }
                />
                <Route path="/tasks" element={<ErrorBoundary><Tasks /></ErrorBoundary>} />
                <Route path="/focus" element={<ErrorBoundary><Focus /></ErrorBoundary>} />
                <Route path="/habits" element={<ErrorBoundary><Habits /></ErrorBoundary>} />
                <Route path="/user-management" element={<UserManagement />} />
                <Route path="/template" element={<Template />} />
                <Route path="/account" element={<Account />} />
                <Route path="/profile" element={<Profile />} />

                {/* Scheduler routes - RBAC: admin roles for management; employees use my-dashboard / employee-schedule */}
                <Route
                  path="/scheduler/companies"
                  element={
                    <RoleProtectedRoute allowedRoles={["super_admin", "admin", "operations_manager", "manager"]}>
                      <SchedulerCompanies />
                    </RoleProtectedRoute>
                  }
                />
                <Route
                  path="/scheduler/schedule"
                  element={
                    <RoleProtectedRoute allowedRoles={["super_admin", "admin", "operations_manager", "manager", "employee", "house_keeping", "maintenance"]}>
                      <ErrorBoundary>
                        <SchedulerSchedule />
                      </ErrorBoundary>
                    </RoleProtectedRoute>
                  }
                />
                <Route
                  path="/scheduler/employees"
                  element={
                    <RoleProtectedRoute allowedRoles={["super_admin", "admin", "operations_manager", "manager"]}>
                      <ErrorBoundary>
                        <SchedulerEmployees />
                      </ErrorBoundary>
                    </RoleProtectedRoute>
                  }
                />
                <Route
                  path="/scheduler/time-clock"
                  element={
                    <RoleProtectedRoute allowedRoles={["super_admin", "admin", "operations_manager", "manager"]}>
                      <ErrorBoundary>
                        <SchedulerTimeClock />
                      </ErrorBoundary>
                    </RoleProtectedRoute>
                  }
                />
                <Route
                  path="/scheduler/my-dashboard"
                  element={
                    <RoleProtectedRoute
                      allowedRoles={["employee", "house_keeping", "maintenance"]}
                    >
                      <EmployeeDashboard />
                    </RoleProtectedRoute>
                  }
                />
                <Route path="/scheduler/employee-schedule" element={<ErrorBoundary><EmployeeSchedule /></ErrorBoundary>} />
                <Route
                  path="/scheduler/missed-shifts"
                  element={
                    <RoleProtectedRoute allowedRoles={["super_admin", "admin", "operations_manager", "manager"]}>
                      <MissedShifts />
                    </RoleProtectedRoute>
                  }
                />
                <Route path="/scheduler" element={<RedirectToUserHome />} />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
};

export default AppRouter;