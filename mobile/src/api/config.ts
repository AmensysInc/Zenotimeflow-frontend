/**
 * API base URL – same backend as web (zenotimeflow.com / your Django API).
 * Browser (web): use same-origin /api so the site proxies to the backend (dev and production).
 * Native app / Expo standalone: use EXPO_PUBLIC_API_URL or fallback for device/emulator.
 */
function getApiBaseUrl(): string {
  const g = typeof globalThis !== 'undefined' ? globalThis : undefined;
  const win = g && (g as any).window;
  if (win != null) return '/api';
  const envUrl = typeof process !== 'undefined' && (process as any).env?.EXPO_PUBLIC_API_URL;
  if (envUrl) return envUrl;
  return 'http://localhost:8085/api';
}
export const API_BASE_URL = getApiBaseUrl();

/** Request timeout in ms. */
export const API_TIMEOUT_MS = 30000;
