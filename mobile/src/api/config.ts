/**
 * API base URL – same backend as web (zenotimeflow.com / your Django API).
 * When the app is loaded from the main app at 8080/clock, always use same-origin /api so Vite proxies to the backend (no timeout, no CORS).
 * For standalone Expo (e.g. 8081 or device) use EXPO_PUBLIC_API_URL or your machine IP (device cannot use localhost).
 */
function getApiBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location?.port === '8080') return '/api';
  const envUrl = typeof process !== 'undefined' && (process as any).env?.EXPO_PUBLIC_API_URL;
  if (envUrl) return envUrl;
  return 'http://localhost:8000/api';
}
export const API_BASE_URL = getApiBaseUrl();

/** Request timeout in ms. */
export const API_TIMEOUT_MS = 30000;
