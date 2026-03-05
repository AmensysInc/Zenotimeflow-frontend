import { Suspense, lazy } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import RoleProtectedRoute from "@/components/RoleProtectedRoute";
import Layout from "@/components/Layout";
import { RedirectToUserHome } from "@/components/RedirectToUserHome";
import { ClockInRedirect } from "@/components/ClockInRedirect";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Lazy-loaded pages (heavy routes) – shrink initial bundle and speed first load
const Tasks = lazy(() => import("@/pages/Tasks"));
const Calendar = lazy(() => import("@/pages/Calendar"));
const Focus = lazy(() => import("@/pages/Focus"));
const Habits = lazy(() => import("@/pages/Habits"));
const Profile = lazy(() => import("@/pages/Profile"));
const Account = lazy(() => import("@/pages/Account"));
const UserManagement = lazy(() => import("@/pages/UserManagement"));
const Template = lazy(() => import("@/pages/Template"));

const SuperAdminDashboard = lazy(() => import("@/pages/dashboards/SuperAdminDashboard"));
const OrganizationDashboard = lazy(() => import("@/pages/dashboards/OrganizationDashboard"));
const CompanyDashboard = lazy(() => import("@/pages/dashboards/CompanyDashboard"));
const EmployeeDashboard = lazy(() => import("@/pages/scheduler/EmployeeDashboard"));

const SchedulerCompanies = lazy(() => import("@/pages/scheduler/Companies"));
const SchedulerSchedule = lazy(() => import("@/pages/scheduler/Schedule"));
const SchedulerEmployees = lazy(() => import("@/pages/scheduler/Employees"));
const SchedulerTimeClock = lazy(() => import("@/pages/scheduler/TimeClock"));
const EmployeeSchedule = lazy(() => import("@/pages/scheduler/EmployeeSchedule"));
const MissedShifts = lazy(() => import("@/pages/scheduler/MissedShifts"));

const NotFound = lazy(() => import("@/pages/NotFound"));
const ClockIn = lazy(() => import("@/pages/ClockIn"));

const PageLoader = () => (
  <div className="min-h-[40vh] flex items-center justify-center">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
  </div>
);

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
    if (isClockPath) {
      return (
        <Suspense fallback={<PageLoader />}>
          <ClockIn />
        </Suspense>
      );
    }
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
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<RedirectToUserHome />} />
                  <Route path="/dashboard" element={<RedirectToUserHome />} />
                  <Route path="/clock-in" element={<ClockInRedirect />} />

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
              </Suspense>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
};

export default AppRouter;
