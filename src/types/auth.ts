/**
 * Shared auth/role types for Zeno-time-flow.
 * Single source of truth for role hierarchy and user shape from backend.
 */

export type UserRole =
  | "super_admin"
  | "operations_manager"
  | "manager"
  | "admin"
  | "employee"
  | "house_keeping"
  | "maintenance"
  | "user";

/** Backend login response - support both snake_case and alternative keys */
export interface LoginResponse {
  user?: any;
  access?: string;
  access_token?: string;
  refresh?: string;
  refresh_token?: string;
}

/** Derive primary role from backend roles array (priority order). Supports role or name. */
export function getPrimaryRole(roles: { role?: string; name?: string }[] | undefined): UserRole {
  if (!roles?.length) return "user";
  const roleNames = roles.map((r) => ((r.role ?? r.name) || "").toLowerCase());
  if (roleNames.includes("super_admin")) return "super_admin";
  if (roleNames.includes("operations_manager")) return "operations_manager";
  if (roleNames.includes("manager")) return "manager";
  if (roleNames.includes("admin")) return "admin";
  if (roleNames.includes("employee")) return "employee";
  if (roleNames.includes("house_keeping")) return "house_keeping";
  if (roleNames.includes("maintenance")) return "maintenance";
  if (roleNames.includes("user")) return "user";
  return "user";
}
