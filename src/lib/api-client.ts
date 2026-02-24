/**
 * Django API Client – Zeno-time-flow
 * Handles auth (login/logout/getCurrentUser), token storage, and authenticated requests.
 * When served from 8080 we use same-origin /api so the dev proxy forwards to the backend (no CORS, single origin).
 */
function getApiUrl(): string {
  if (typeof window !== "undefined" && window.location?.port === "8080") return "/api";
  return import.meta.env.VITE_API_URL || "http://localhost:8000/api";
}
const API_URL = getApiUrl();

interface RequestOptions extends RequestInit {
  params?: Record<string, any>;
}

/** Backend may return access/refresh or access_token/refresh_token */
function getAccessToken(data: any): string | undefined {
  return data?.access ?? data?.access_token;
}
function getRefreshToken(data: any): string | undefined {
  return data?.refresh ?? data?.refresh_token;
}

/** Extract user-friendly message from Django-style error response (detail, message, or field errors). */
function extractErrorMessage(err: Record<string, unknown>): string {
  if (!err || typeof err !== "object") return "";
  const d = err.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" ");
  const msg = err.message;
  if (typeof msg === "string") return msg;
  // Field errors: { email: ["This field is required."], password: ["Too short"] }
  const keys = Object.keys(err).filter((k) => k !== "message" && k !== "detail");
  if (keys.length) {
    const parts = keys.flatMap((k) => {
      const v = (err as any)[k];
      return Array.isArray(v) ? v : [String(v)];
    });
    return parts.join(" ");
  }
  return "";
}

class ApiClient {
  private baseURL: string;
  private token: string | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    if (typeof window !== "undefined") {
      this.token = localStorage.getItem("access_token");
    }
  }

  setToken(token: string | null) {
    this.token = token;
    if (typeof window !== "undefined") {
      if (token) localStorage.setItem("access_token", token);
      else localStorage.removeItem("access_token");
    }
  }

  getToken(): string | null {
    return this.token;
  }

  private buildURL(endpoint: string, params?: Record<string, any>): string {
    const url = new URL(`${this.baseURL}${endpoint}`, window.location.origin);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value != null) url.searchParams.append(key, String(value));
      });
    }
    return url.toString();
  }

  private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { params, ...fetchOptions } = options;
    const url = this.buildURL(endpoint, params);

    // Use in-memory token, or re-read from localStorage (e.g. after login in same session)
    const token = this.token ?? (typeof window !== "undefined" ? localStorage.getItem("access_token") : null);
    if (token) this.token = token;

    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...(fetchOptions.headers as Record<string, string>),
    };
    if (token) {
      (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(url, { ...fetchOptions, headers });

    // 401: clear token so auth context will set user to null and redirect to login
    if (response.status === 401) {
      this.setToken(null);
      if (typeof window !== "undefined") {
        localStorage.removeItem("refresh_token");
      }
      const err = await response.json().catch(() => ({}));
      throw new Error((err as any).detail || err?.message || "Unauthorized");
    }

    // 403: Forbidden - user lacks permission (keep token, surface message)
    if (response.status === 403) {
      const err = await response.json().catch(() => ({}));
      const message = (err as any)?.detail || (err as any)?.message || "You don't have permission to perform this action.";
      throw new Error(message);
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({})) as Record<string, unknown>;
      // Django REST: detail (string or array), or field errors like { email: ["..."] }
      const message = extractErrorMessage(err);
      throw new Error(message || `HTTP ${response.status}`);
    }

    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      return response.json() as Promise<T>;
    }
    return {} as T;
  }

  async get<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET', params });
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async patch<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  /** Login: username or email + password. Send same value as "username"; backend must look up user by username OR email. */
  async login(usernameOrEmail: string, password: string) {
    const trimmed = usernameOrEmail.trim();
    const response = await this.post<any>("/auth/login/", {
      username: trimmed,
      password,
    });
    const access = getAccessToken(response);
    const refresh = getRefreshToken(response);
    if (!access) {
      throw new Error("Invalid login response: no access token");
    }
    this.setToken(access);
    if (typeof window !== "undefined" && refresh) {
      localStorage.setItem("refresh_token", refresh);
    }
    return response;
  }

  /** Employee clock-in login: username or email + PIN. Backend must resolve by username OR email. */
  async employeeLogin(usernameOrEmail: string, pin: string) {
    const trimmed = usernameOrEmail.trim();
    let response: any;
    try {
      response = await this.post<any>("/auth/employee-login/", { username: trimmed, pin });
    } catch (e: any) {
      if (e?.message?.includes("404") || e?.message?.toLowerCase()?.includes("not found")) {
        response = await this.post<any>("/auth/login/", { username: trimmed, password: pin });
      } else {
        throw e;
      }
    }
    const access = getAccessToken(response);
    const refresh = getRefreshToken(response);
    if (!access) throw new Error("Invalid login response: no access token");
    this.setToken(access);
    if (typeof window !== "undefined" && refresh) {
      localStorage.setItem("refresh_token", refresh);
    }
    return response;
  }

  async register(data: {
    email: string;
    password: string;
    password_confirm: string;
    full_name?: string;
  }) {
    const response = await this.post<any>("/auth/register/", data);
    const access = getAccessToken(response);
    const refresh = getRefreshToken(response);
    if (access) {
      this.setToken(access);
      if (typeof window !== "undefined" && refresh) {
        localStorage.setItem("refresh_token", refresh);
      }
    }
    return response;
  }

  async logout() {
    const refreshToken =
      typeof window !== "undefined" ? localStorage.getItem("refresh_token") : null;
    if (refreshToken) {
      try {
        await this.post("/auth/logout/", { refresh: refreshToken });
      } catch (e) {
        console.error("Logout error:", e);
      }
    }
    this.setToken(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("refresh_token");
    }
  }

  async getCurrentUser() {
    return this.get('/auth/user/');
  }
}

export const apiClient = new ApiClient(API_URL);
export default apiClient;

