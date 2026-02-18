import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import apiClient from "@/lib/api-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Users, Clock, BarChart3, ArrowRight } from "lucide-react";

interface UserAccess {
  hasCalendar: boolean;
  hasScheduler: boolean;
  isAdmin: boolean;
}

const AppSelector = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [userAccess, setUserAccess] = useState<UserAccess>({
    hasCalendar: false,
    hasScheduler: false,
    isAdmin: false
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUserAccess = async () => {
      if (!user) return;

      try {
        // Get user role and app type
        const userData = await apiClient.getCurrentUser() as any;
        const roles = userData?.roles || [];

        const isSuperAdmin = roles.some((r: any) => r.role === 'super_admin') || false;
        const hasCalendar = roles.some((r: any) => r.app_type === 'calendar') || true; // Everyone gets calendar access
        const hasScheduler = isSuperAdmin; // Only super admins get scheduler access

        setUserAccess({
          hasCalendar,
          hasScheduler,
          isAdmin: isSuperAdmin // Only super admins are considered "admin" for app switching
        });
      } catch (error) {
        console.error('Error checking user access:', error);
      } finally {
        setLoading(false);
      }
    };

    checkUserAccess();
  }, [user]);

  // Auto-redirect if user has access to only one app
  useEffect(() => {
    if (loading) return;
    
    const { hasCalendar, hasScheduler } = userAccess;
    
    if (hasCalendar && !hasScheduler) {
      navigate('/');
    } else if (hasScheduler && !hasCalendar) {
      navigate('/scheduler');
    }
  }, [userAccess, loading, navigate]);

  const handleAppSelection = (appType: 'calendar' | 'scheduler') => {
    if (appType === 'calendar') {
      navigate('/');
    } else {
      navigate('/scheduler');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  const { hasCalendar, hasScheduler, isAdmin } = userAccess;

  // If user has no access to any app
  if (!hasCalendar && !hasScheduler) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md">
          <CardHeader className="text-center">
            <CardTitle>No App Access</CardTitle>
            <CardDescription>
              You don't have access to any applications. Please contact your administrator.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <img src="/lovable-uploads/dfd7bdde-fe82-4a7a-b7bd-d93fa625c987.png" alt="Logo" className="h-12 w-auto" />
            <h1 className="text-3xl font-bold">Welcome to Zeno Platform</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            {isAdmin ? 'As a super admin, you have access to both applications. Choose one to continue:' : 'Welcome to Zeno Time Flow - Your Personal Productivity Platform'}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Logged in as: <span className="font-medium">{user?.email}</span>
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {hasCalendar && (
            <Card className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105">
              <CardHeader className="text-center pb-4">
                <div className="flex justify-center mb-4">
                  <div className="p-4 rounded-full bg-primary/10">
                    <Calendar className="h-12 w-12 text-primary" />
                  </div>
                </div>
                <CardTitle className="text-2xl">Zeno Time Flow</CardTitle>
                <CardDescription className="text-base">
                  Personal productivity and task management platform
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-3 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>Calendar & Event Management</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    <span>Task Planning & Tracking</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>Personal Dashboard</span>
                  </div>
                </div>
                <Button 
                  onClick={() => handleAppSelection('calendar')} 
                  className="w-full"
                  size="lg"
                >
                  Enter Calendar App
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          )}

          {hasScheduler && (
            <Card className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105">
              <CardHeader className="text-center pb-4">
                <div className="flex justify-center mb-4">
                  <div className="p-4 rounded-full bg-green-500/10">
                    <Clock className="h-12 w-12 text-green-600" />
                  </div>
                </div>
                <CardTitle className="text-2xl">Roster Joy</CardTitle>
                <CardDescription className="text-base">
                  Employee scheduling and workforce management system
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-3 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>Employee Management</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>Shift Scheduling</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>Time Clock & Reports</span>
                  </div>
                </div>
                <Button 
                  onClick={() => handleAppSelection('scheduler')} 
                  className="w-full"
                  size="lg"
                  variant="outline"
                >
                  Enter Scheduler App
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {isAdmin && (
          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground">
              💡 <strong>Super Admin Tip:</strong> You can switch between apps anytime using the app switcher in the header
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AppSelector;