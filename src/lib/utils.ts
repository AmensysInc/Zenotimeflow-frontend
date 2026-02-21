import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Normalize list API response to array (handles Django pagination or raw array). */
export function ensureArray<T>(data: T | T[] | { results?: T[]; data?: T[] } | null | undefined): T[] {
  if (data == null) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === "object") {
    if (Array.isArray((data as { results?: T[] }).results)) return (data as { results: T[] }).results;
    if (Array.isArray((data as { data?: T[] }).data)) return (data as { data: T[] }).data;
  }
  return [];
}

/** Format a string as US phone (XXX) XXX-XXXX (10 digits). Input can be digits or already formatted. */
export function formatPhoneUS(value: string | null | undefined): string {
  if (value == null || value === "") return "";
  const digits = value.replace(/\D/g, "");
  const limited = digits.slice(0, 10);
  if (limited.length === 0) return "";
  if (limited.length <= 3) return `(${limited}`;
  if (limited.length <= 6) return `(${limited.slice(0, 3)}) ${limited.slice(3)}`;
  return `(${limited.slice(0, 3)}) ${limited.slice(3, 6)}-${limited.slice(6)}`;
}

/** Strip to digits only for API/storage. */
export function parsePhoneUS(phone: string | null | undefined): string {
  if (phone == null || phone === "") return "";
  return phone.replace(/\D/g, "");
}
