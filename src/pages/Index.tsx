import { Link } from "react-router-dom";
import { CLOCK_IN_LINK, CLOCK_IN_SAME_ORIGIN } from "@/lib/clock-in-url";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CheckSquare } from "lucide-react";

const Index = () => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Logged-in users: send to app so AppRouter + RedirectToUserHome can show role dashboard
    if (!isLoading && user) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-4">
        <div className="flex items-center gap-3">
          <img src="/lovable-uploads/dfd7bdde-fe82-4a7a-b7bd-d93fa625c987.png" alt="Zeno TimeFlow Logo" className="h-16 w-auto" />
          <span className="text-2xl font-bold text-foreground">Zeno Time Flow</span>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="default">
            <a href={CLOCK_IN_LINK} {...(!CLOCK_IN_SAME_ORIGIN && { target: "_blank", rel: "noopener noreferrer" })}>Clock In</a>
          </Button>
          <Button asChild variant="outline" size="default">
            <Link to="/auth">Sign In</Link>
          </Button>
        </div>
      </header>
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-2xl mx-auto px-4">
          <h1 className="text-4xl font-bold mb-4">Manage Your Time, Boost Your Productivity</h1>
          <p className="text-xl text-muted-foreground mb-8">
            Track tasks, schedule events, and focus better with our comprehensive time management platform
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Button asChild size="lg">
              <Link to="/auth">Get Started</Link>
            </Button>
          </div>
          <div className="flex justify-center">
            <div className="flex items-start gap-3 max-w-md">
              <CheckSquare className="h-6 w-6 text-primary mt-1" />
              <div>
                <h3 className="font-semibold mb-2">Task Management</h3>
                <p className="text-sm text-muted-foreground">Create, organize, and track your tasks with priorities and due dates</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;