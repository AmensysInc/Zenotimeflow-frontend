import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import apiClient from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Shield } from "lucide-react";

const ALLOWED_ADMIN_EMAIL = "kuladeepparchuri@gmail.com";

const AdminAuth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  const { user } = useAuth();

  useEffect(() => {
    // Check if user is already logged in
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Check if email is allowed
    if (email !== ALLOWED_ADMIN_EMAIL) {
      toast({
        title: "Access Denied",
        description: "This admin portal is restricted to authorized personnel only.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    try {
      await apiClient.login(email, password);
      
      toast({
        title: "Welcome Admin",
        description: "Successfully signed in to TimeFlow Admin Portal.",
      });
      navigate("/dashboard");
    } catch (error: any) {
      toast({
        title: "Sign in failed",
        description: error.message || "Invalid credentials",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-2 border-primary/20">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <Shield className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-primary">TimeFlow Admin Portal</CardTitle>
          <CardDescription>
            Restricted access for authorized administrators
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Admin Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your admin email"
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
              <Shield className="mr-2 h-4 w-4" />
              Admin Sign In
            </Button>
          </form>
          
          <div className="mt-6 p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground text-center">
              Access restricted to: <br />
              <code className="font-mono text-xs bg-background px-2 py-1 rounded">
                {ALLOWED_ADMIN_EMAIL}
              </code>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminAuth;