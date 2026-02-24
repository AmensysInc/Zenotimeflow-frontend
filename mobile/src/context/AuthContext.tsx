import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import {
  getStoredToken,
  setStoredTokens,
  getStoredAuthData,
  setStoredAuthData,
  clearAuthStorage,
} from '../api/client';
import { getEmployees } from '../api/extensions';
import {
  storeAuthForBiometrics,
  clearBiometricAuth,
  getStoredBiometricAuth,
  authenticateWithBiometrics,
} from '../utils/biometrics';

type LoginIntent = 'full' | 'clockin' | null;

type AuthState = {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: any;
  employee: any;
  authData: any;
  loginIntent: LoginIntent;
};

const initialState: AuthState = {
  isAuthenticated: false,
  isLoading: true,
  user: null,
  employee: null,
  authData: null,
  loginIntent: null,
};

type AuthContextValue = AuthState & {
  login: (email: string, credential: string, options?: { intent?: 'full' | 'clockin'; usePassword?: boolean }) => Promise<void>;
  loginWithBiometrics: () => Promise<void>;
  logout: () => Promise<void>;
  refetchAuth: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(initialState);

  const applyAuthData = useCallback((data: any, intent?: LoginIntent) => {
    if (!data) {
      setState({
        ...initialState,
        isLoading: false,
      });
      return;
    }
    const user = data.user ?? data;
    const employee = data.employee ?? data.employee_id ?? null;
    setState((s) => ({
      isAuthenticated: true,
      isLoading: false,
      user: typeof user === 'object' ? user : { id: user },
      employee: typeof employee === 'object' ? employee : employee ? { id: employee } : null,
      authData: data,
      loginIntent: intent ?? s.loginIntent,
    }));
  }, []);

  const loadStoredAuth = useCallback(async () => {
    const token = await getStoredToken();
    const authData = await getStoredAuthData();
    if (token && authData) {
      applyAuthData(authData, 'full');
    } else {
      setState((s) => ({ ...s, isLoading: false }));
    }
  }, [applyAuthData]);

  useEffect(() => {
    loadStoredAuth();
  }, [loadStoredAuth]);

  // When user is authenticated but no employee in auth response, fetch employee by user
  useEffect(() => {
    if (!state.isAuthenticated || !state.user?.id || state.employee) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await getEmployees({ user: state.user.id });
        const emp = Array.isArray(list) ? list[0] : null;
        if (!cancelled && emp) {
          setState((s) => ({ ...s, employee: emp }));
          const authData = await getStoredAuthData();
          if (authData) {
            await setStoredAuthData({ ...authData, employee: emp });
          }
        }
      } catch {
        // ignore - user may not have an employee record
      }
    })();
    return () => { cancelled = true; };
  }, [state.isAuthenticated, state.user?.id, state.employee]);

  const login = useCallback(
    async (email: string, credential: string, options?: { intent?: 'full' | 'clockin'; usePassword?: boolean }) => {
      const intent = options?.intent ?? 'full';
      const usePassword = options?.usePassword ?? false;
      setState((s) => ({ ...s, isLoading: true }));
      try {
        let res: any;
        if (usePassword) {
          res = await api.post<any>('/auth/login/', { username: email, password: credential });
        } else {
          try {
            res = await api.post<any>('/auth/employee-login/', { username: email, pin: credential });
          } catch (e: any) {
            if (e?.message?.includes('404') || e?.message?.toLowerCase()?.includes('not found')) {
              res = await api.post<any>('/auth/login/', { username: email, password: credential });
            } else {
              throw e;
            }
          }
        }
        const access = res?.access ?? res?.access_token;
        const refresh = res?.refresh ?? res?.refresh_token;
        if (!access) throw new Error('No access token returned');
        await setStoredTokens(access, refresh);
        const authData = {
          user: res?.user ?? res?.user_id,
          employee: res?.employee ?? res?.employee_id,
          ...res,
        };
        await setStoredAuthData(authData);
        if (intent === 'full') {
          await storeAuthForBiometrics({ access, refresh, authData });
        }
        applyAuthData(authData, intent);
      } finally {
        setState((s) => ({ ...s, isLoading: false }));
      }
    },
    [applyAuthData]
  );

  const loginWithBiometrics = useCallback(async () => {
    setState((s) => ({ ...s, isLoading: true }));
    try {
      const success = await authenticateWithBiometrics('Sign in with biometrics');
      if (!success) {
        setState((s) => ({ ...s, isLoading: false }));
        return;
      }
      const stored = await getStoredBiometricAuth();
      if (!stored?.access || !stored?.authData) {
        setState((s) => ({ ...s, isLoading: false }));
        return;
      }
      await setStoredTokens(stored.access, stored.refresh);
      await setStoredAuthData(stored.authData);
      applyAuthData(stored.authData, 'full');
    } finally {
      setState((s) => ({ ...s, isLoading: false }));
    }
  }, [applyAuthData]);

  const logout = useCallback(async () => {
    await clearAuthStorage();
    await clearBiometricAuth();
    setState({ ...initialState, isLoading: false });
  }, []);

  const refetchAuth = useCallback(async () => {
    const authData = await getStoredAuthData();
    applyAuthData(authData);
  }, [applyAuthData]);

  const value: AuthContextValue = {
    ...state,
    login,
    loginWithBiometrics,
    logout,
    refetchAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
