import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, API_TIMEOUT_MS } from './config';

const TOKEN_KEY = '@zenotime/access_token';
const REFRESH_KEY = '@zenotime/refresh_token';
const AUTH_DATA_KEY = '@zenotime/auth_data';

function buildUrl(path: string, params?: Record<string, any>): string {
  const base = API_BASE_URL.replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  if (!params || !Object.keys(params).length) return `${base}${p}`;
  const search = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== '') search.append(k, String(v));
  });
  const q = search.toString();
  return q ? `${base}${p}?${q}` : `${base}${p}`;
}

export async function getStoredToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function setStoredTokens(access: string | null, refresh?: string | null): Promise<void> {
  if (access) await AsyncStorage.setItem(TOKEN_KEY, access);
  else await AsyncStorage.removeItem(TOKEN_KEY);
  if (refresh !== undefined) {
    if (refresh) await AsyncStorage.setItem(REFRESH_KEY, refresh);
    else await AsyncStorage.removeItem(REFRESH_KEY);
  }
}

export async function getStoredAuthData(): Promise<any> {
  const raw = await AsyncStorage.getItem(AUTH_DATA_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function setStoredAuthData(data: any): Promise<void> {
  if (data) await AsyncStorage.setItem(AUTH_DATA_KEY, JSON.stringify(data));
  else await AsyncStorage.removeItem(AUTH_DATA_KEY);
}

export async function clearAuthStorage(): Promise<void> {
  await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_KEY, AUTH_DATA_KEY]);
}

/** Extract user-friendly message from Django-style error (detail, message, field errors). */
function extractErrorMessage(err: Record<string, unknown>): string {
  if (!err || typeof err !== 'object') return '';
  const d = err.detail;
  if (typeof d === 'string') return d;
  if (Array.isArray(d)) return d.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ');
  const msg = err.message;
  if (typeof msg === 'string') return msg;
  const nfe = (err as any).non_field_errors;
  if (Array.isArray(nfe) && nfe.length) return nfe.join(' ');
  const keys = Object.keys(err).filter((k) => k !== 'message' && k !== 'detail');
  if (keys.length) {
    const parts = keys.flatMap((k) => {
      const v = (err as any)[k];
      return Array.isArray(v) ? v : [String(v)];
    });
    return parts.join(' ');
  }
  return '';
}

export type ApiRequestFn = (
  method: string,
  path: string,
  body?: any,
  params?: Record<string, any>
) => Promise<any>;

export async function apiRequest<T = any>(
  method: string,
  path: string,
  body?: any,
  params?: Record<string, any>
): Promise<T> {
  const token = await getStoredToken();
  const url = buildUrl(path, params);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      signal: controller.signal,
      ...(body != null && method !== 'GET' ? { body: JSON.stringify(body) } : {}),
    });
  } catch (e: any) {
    clearTimeout(timeoutId);
    if (e?.name === 'AbortError') {
      throw new Error(
        'Request timed out. Check: 1) Backend running 2) Device on same WiFi as PC 3) Correct IP in mobile/.env (run ipconfig to get your IP)'
      );
    }
    const msg = e?.message || String(e);
    if (
      msg.toLowerCase().includes('timeout') ||
      msg.toLowerCase().includes('network') ||
      msg.toLowerCase().includes('failed to fetch')
    ) {
      throw new Error(
        `Can't reach server. Ensure backend is running, device is on same WiFi, and mobile/.env has EXPO_PUBLIC_API_URL=http://YOUR_IP:8085/api`
      );
    }
    throw e;
  }
  clearTimeout(timeoutId);

  if (res.status === 401) {
    await clearAuthStorage();
    const err: any = await res.json().catch(() => ({}));
    throw new Error(extractErrorMessage(err) || 'Unauthorized');
  }
  if (!res.ok) {
    const err: any = await res.json().catch(() => ({}));
    const msg = extractErrorMessage(err) || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  const contentType = res.headers.get('content-type');
  if (contentType?.includes('application/json')) return res.json() as Promise<T>;
  return {} as T;
}

export const api = {
  get: <T = any>(path: string, params?: Record<string, any>) =>
    apiRequest<T>('GET', path, undefined, params),
  post: <T = any>(path: string, body?: any) => apiRequest<T>('POST', path, body),
  patch: <T = any>(path: string, body?: any) => apiRequest<T>('PATCH', path, body),
  delete: <T = any>(path: string) => apiRequest<T>('DELETE', path),
};
