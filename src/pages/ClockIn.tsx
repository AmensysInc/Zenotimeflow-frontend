import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import apiClient from "@/lib/api-client";
import { Loader2 } from "lucide-react";

/**
 * Clock In login – same look as main Auth page (8080).
 * Username + PIN, then redirect to app (employee dashboard or home).
 */
const ClockIn = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const { toast } = useToast();

  const handleClockIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUsername = username.trim();
    if (!trimmedUsername || !pin.trim()) {
      toast({
        title: "Validation error",
        description: "Please enter username and PIN",
        variant: "destructive",
      });
      return;
    }
    setIsLoading(true);
    try {
      await apiClient.employeeLogin(trimmedUsername, pin.trim());
      toast({ title: "Signed in", description: "Redirecting…" });
      window.location.href = "/";
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Invalid username or PIN. Please try again.";
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
        <img
          src="/lovable-uploads/dfd7bdde-fe82-4a7a-b7bd-d93fa625c987.png"
          alt="Zeno TimeFlow Logo"
          className="h-16 w-auto"
        />
        <span className="text-2xl font-bold text-foreground">Zeno Time Flow</span>
      </div>
      <div className="absolute top-4 right-4">
        <Button asChild variant="outline" size="default">
          <Link to="/auth">Main login</Link>
        </Button>
      </div>
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Welcome to ZenoTimeFlow</CardTitle>
            <CardDescription>
              Sign in to clock in and manage your time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleClockIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username or email</Label>
                <Input
                  id="username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username or email"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pin">PIN</Label>
                <Input
                  id="pin"
                  type="password"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Enter your PIN"
                  maxLength={8}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
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

export default ClockIn;
