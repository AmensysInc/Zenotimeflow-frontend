import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import apiClient from "@/lib/api-client";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const Auth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      navigate("/", { replace: true });
    }
  }, [user, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      toast({
        title: "Validation error",
        description: "Please enter email and password",
        variant: "destructive",
      });
      return;
    }
    setIsLoading(true);

    try {
      await apiClient.login(trimmedEmail, password);
      // Redirect to dashboard so AppRouter runs RedirectToUserHome and sends user to role-specific dashboard
      window.location.href = "/dashboard";
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Invalid email or password. Please try again.";
      toast({
        title: "Sign in failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="absolute top-4 left-4 flex items-center gap-3">
        <img src="/lovable-uploads/dfd7bdde-fe82-4a7a-b7bd-d93fa625c987.png" alt="Zeno TimeFlow Logo" className="h-16 w-auto" />
        <span className="text-2xl font-bold text-foreground">Zeno Time Flow</span>
      </div>
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Welcome to ZenoTimeFlow</CardTitle>
            <CardDescription>
              Sign in to manage your time, tasks, and productivity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                />
              </div>
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign In
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
