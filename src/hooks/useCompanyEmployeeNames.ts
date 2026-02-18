import { useEffect, useMemo, useState } from "react";
import apiClient from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";

export type CompanyEmployeeName = {
  id: string;
  first_name: string;
  last_name: string;
};

/**
 * Fetches a minimal, safe list of employee names for a company using the
 * SECURITY DEFINER RPC `get_company_employee_names`.
 *
 * This is used to reliably resolve names in schedule views even when direct
 * SELECT access to `employees` is restricted by RLS.
 */
export function useCompanyEmployeeNames(companyId?: string | null) {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<CompanyEmployeeName[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!user || !companyId || companyId === "all") {
        setEmployees([]);
        setError(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Use employees endpoint with company filter
        const data = await apiClient.get<any[]>('/scheduler/employees/', { company: companyId });

        // Be tolerant of partial names (some rows may have missing/blank last_name)
        // so we don't drop valid employees and end up rendering "Unknown" in the UI.
        const normalized: CompanyEmployeeName[] = Array.isArray(data)
          ? data
              .filter((e: any) => e?.id && (e?.first_name || e?.last_name))
              .map((e: any) => ({
                id: String(e.id),
                first_name: String(e?.first_name ?? "").trim(),
                last_name: String(e?.last_name ?? "").trim(),
              }))
          : [];

        if (!cancelled) setEmployees(normalized);
      } catch (e: any) {
        if (!cancelled) {
          setEmployees([]);
          setError(e?.message || "Failed to load employee names");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [companyId, user]);

  const namesById = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of employees) {
      const full = `${e.first_name} ${e.last_name}`.trim();
      if (full) map.set(e.id, full);
    }
    return map;
  }, [employees]);

  return { employees, namesById, loading, error };
}
