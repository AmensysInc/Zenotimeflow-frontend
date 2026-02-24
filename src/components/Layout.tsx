import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { LogOut, MapPin, Bell, Clock } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useShiftNotifications } from "@/hooks/useShiftNotifications";
import { usePersistentTimeClock } from "@/hooks/usePersistentTimeClock";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { CLOCK_IN_LINK, CLOCK_IN_SAME_ORIGIN } from "@/lib/clock-in-url";
import { useUserRole } from "@/hooks/useUserRole";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { role } = useUserRole();
  const [locationEnabled, setLocationEnabled] = useState(() => {
    return localStorage.getItem('locationEnabled') === 'true';
  });
  
  // Use shift notifications hook
  const { upcomingShift } = useShiftNotifications();
  
  // Use persistent time clock
  const { activeEntry, elapsedTimeFormatted } = usePersistentTimeClock();
  
  // Only show shift timer for employee role
  const isEmployee = role === 'employee';

  const toggleLocation = () => {
    const newState = !locationEnabled;
    setLocationEnabled(newState);
    localStorage.setItem('locationEnabled', String(newState));
    
    if (newState) {
      toast.success('Location tracking enabled', {
        description: 'Your location will be included with notes'
      });
    } else {
      toast.info('Location tracking disabled');
    }
  };

  // Expose location state globally
  useEffect(() => {
    window.locationTrackingEnabled = locationEnabled;
  }, [locationEnabled]);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col">
          <header className="h-14 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
            <div className="flex items-center justify-between h-full px-4">
              <div className="flex items-center gap-2">
                <SidebarTrigger />
                <div className="flex items-center gap-3">
                  <img src="/lovable-uploads/dfd7bdde-fe82-4a7a-b7bd-d93fa625c987.png" alt="Zeno TimeFlow Logo" className="h-14 w-auto" />
                  <span className="text-lg font-semibold text-foreground">Zeno Time Flow</span>
                  <Button
                    variant={locationEnabled ? "default" : "ghost"}
                    size="sm"
                    onClick={toggleLocation}
                    className="h-8 w-8 p-0"
                    title={locationEnabled ? "Location tracking enabled" : "Location tracking disabled"}
                  >
                    <MapPin className={`h-4 w-4 ${locationEnabled ? 'fill-current' : ''}`} />
                  </Button>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                {/* Clock In - opens React Native mobile app (email + PIN login) */}
                <Button
                  variant="default"
                  size="sm"
                  className="gap-2 bg-primary hover:bg-primary/90"
                  asChild
                >
                  <a href={CLOCK_IN_LINK} className="inline-flex items-center gap-2" {...(!CLOCK_IN_SAME_ORIGIN && { target: "_blank", rel: "noopener noreferrer" })}>
                    <Clock className="h-4 w-4" />
                    Clock In
                  </a>
                </Button>
                {/* Show active time clock indicator - only for employee role */}
                {activeEntry && isEmployee && (
                  <Badge 
                    variant="default" 
                    className="cursor-pointer gap-2 bg-green-600 hover:bg-green-700"
                    onClick={() => navigate('/scheduler/my-dashboard')}
                  >
                    <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                    {elapsedTimeFormatted}
                  </Badge>
                )}
                
                {/* Show upcoming shift notification - only for employee role */}
                {upcomingShift && !activeEntry && isEmployee && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-amber-600 border-amber-600 hover:bg-amber-50"
                    onClick={() => navigate('/scheduler/my-dashboard')}
                  >
                    <Bell className="h-4 w-4" />
                    Shift Soon
                  </Button>
                )}
                
                <span className="text-sm text-muted-foreground">
                  {user?.email}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={signOut}
                  className="h-8 w-8 p-0"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </header>
          
          <main className="flex-1 p-6 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Layout;
