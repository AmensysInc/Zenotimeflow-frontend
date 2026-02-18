import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import apiClient from "@/lib/api-client";

export type AppType = 'calendar' | 'scheduler';

export const useUserAppType = () => {
  const { user } = useAuth();
  const [appType, setAppType] = useState<AppType | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUserAppType = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        // Get user's roles to determine app access
        const userData = await apiClient.getCurrentUser() as any;
        const roles = userData?.roles || [];

        if (roles.length > 0) {
          // Check if user is admin (gets access to both apps)
          const isAdmin = roles.some((role: any) => role.role === 'admin' || role.role === 'super_admin');
          
          if (isAdmin) {
            // Admin gets app selector to choose - always show selector for admins
            setAppType(null);
          } else {
            // Check if regular user has multiple app access
            const uniqueAppTypes = [...new Set(roles.map((role: any) => role.app_type).filter(Boolean))];
            if (uniqueAppTypes.length > 1) {
              // User has access to multiple apps, show selector
              setAppType(null);
            } else if (uniqueAppTypes.length === 1) {
              // Regular user gets their single assigned app
              setAppType(uniqueAppTypes[0] as AppType);
            } else {
              // No app type specified, show selector
              setAppType(null);
            }
          }
        } else {
          // No role found, show app selector
          setAppType(null);
        }
      } catch (error) {
        console.error('Error in fetchUserAppType:', error);
        setAppType(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserAppType();
  }, [user]);

  return { appType, isLoading };
};