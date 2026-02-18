import { useState, useEffect, createContext, useContext } from "react";
import apiClient from "@/lib/api-client";

interface User {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  status?: string;
}

interface AuthContextType {
  user: User | null;
  session: { access_token: string } | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<{ access_token: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    // Check for existing session first
    const initializeAuth = async () => {
      try {
        const token = apiClient.getToken();
        if (token) {
          try {
            const userData = await apiClient.getCurrentUser();
            if (isMounted) {
              console.log('Initial session check:', userData?.email || 'No user');
              setUser(userData as User);
              setSession({ access_token: token });
              setIsLoading(false);
            }
          } catch (error) {
            console.error('Error getting user:', error);
            // Token might be invalid, clear it
            apiClient.setToken(null);
            if (isMounted) {
              setUser(null);
              setSession(null);
              setIsLoading(false);
            }
          }
        } else {
          if (isMounted) {
            setUser(null);
            setSession(null);
            setIsLoading(false);
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    // Initialize auth
    initializeAuth();
  }, []);

  const signOut = async () => {
    console.log('Signing out user...');
    
    try {
      // Clear local state immediately
      setUser(null);
      setSession(null);
      
      // Perform Django logout
      await apiClient.logout();
      
      console.log('Sign out completed, redirecting to home...');
      
      // Force redirect to home page
      window.location.href = '/';
    } catch (error) {
      console.error('Error during sign out:', error);
      
      // Force cleanup and redirect even if signOut fails
      setUser(null);
      setSession(null);
      
      // Fallback redirect to home page
      window.location.href = '/';
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, isLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};