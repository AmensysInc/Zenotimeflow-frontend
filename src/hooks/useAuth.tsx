import { useState, useEffect, createContext, useContext } from "react";
import apiClient from "@/lib/api-client";
import { type UserRole, getPrimaryRole } from "@/types/auth";

export type { UserRole };

interface User {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  status?: string;
  roles?: { role?: string }[];
  /** Set by backend when user has assigned company (e.g. company manager). */
  company_id?: string | null;
  assigned_company?: string | null;
  /** Set by backend when user has assigned organization (e.g. operations manager). */
  organization_id?: string | null;
}

interface AuthContextType {
  user: User | null;
  /** Primary role derived from backend user.roles; used for routing and RBAC. */
  role: UserRole | null;
  session: { access_token: string } | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [session, setSession] = useState<{ access_token: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        const token = apiClient.getToken();
        if (token) {
          try {
            const userData = (await apiClient.getCurrentUser()) as User | undefined;
            if (isMounted && userData) {
              const primaryRole = getPrimaryRole(userData?.roles);
              setUser(userData);
              setRole(primaryRole);
              setSession({ access_token: token });
            }
            if (isMounted) setIsLoading(false);
          } catch (error) {
            console.error("Auth init: getCurrentUser failed", error);
            apiClient.setToken(null);
            if (isMounted) {
              setUser(null);
              setRole(null);
              setSession(null);
              setIsLoading(false);
            }
          }
        } else {
          if (isMounted) {
            setUser(null);
            setRole(null);
            setSession(null);
            setIsLoading(false);
          }
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
        if (isMounted) setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const signOut = async () => {
    try {
      setUser(null);
      setRole(null);
      setSession(null);
      await apiClient.logout();
    } catch (error) {
      console.error("Error during sign out:", error);
      setUser(null);
      setRole(null);
      setSession(null);
    }
    window.location.href = "/";
  };

  return (
    <AuthContext.Provider value={{ user, role, session, isLoading, signOut }}>
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