import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '@/lib/api-client';
import { toast } from 'sonner';

/** Normalize list API response to array (handles Django pagination or raw array). */
function ensureArray<T>(data: T | T[] | { results?: T[]; data?: T[] } | null | undefined): T[] {
  if (data == null) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === 'object') {
    if (Array.isArray((data as { results?: T[] }).results)) return (data as { results: T[] }).results;
    if (Array.isArray((data as { data?: T[] }).data)) return (data as { data: T[] }).data;
  }
  return [];
}

/** Normalize company: organization_id and company_manager_id (Django may return organization/company_manager as FK). */
function normalizeCompany<T extends { organization_id?: string; organization?: string | { id?: string }; company_manager_id?: string; company_manager?: string }>(c: T): T & { organization_id?: string; company_manager_id?: string } {
  const orgId = c.organization_id ?? (typeof c.organization === 'string' ? c.organization : (c.organization as any)?.id);
  const managerId = c.company_manager_id ?? (typeof c.company_manager === 'string' ? c.company_manager : (c.company_manager as any)?.id);
  return { ...c, organization_id: orgId, company_manager_id: managerId };
}

/**
 * Normalize employee from API to flat Employee shape.
 * Backend may return nested employee.user (e.g. { user: { email, full_name } }) or company as FK object.
 * Ensures first_name, last_name, email, company_id are set from employee or linked user.
 */
function normalizeEmployee(raw: any): Employee {
  const user = raw?.user;
  const fullName = (user?.full_name || raw?.full_name || '').trim() || `${(raw?.first_name || '').trim()} ${(raw?.last_name || '').trim()}`.trim();
  const parts = fullName.split(/\s+/);
  const first_name = (raw?.first_name ?? parts[0] ?? '').toString().trim();
  const last_name = (raw?.last_name ?? (parts.length > 1 ? parts.slice(1).join(' ') : '')).toString().trim();
  const email = (raw?.email ?? user?.email ?? '').toString().trim();
  const companyId = raw?.company_id ?? (typeof raw?.company === 'string' ? raw.company : raw?.company?.id);
  return {
    id: raw?.id,
    first_name: first_name || '—',
    last_name: last_name || '—',
    email: email || '—',
    phone: raw?.phone ?? user?.phone,
    hire_date: raw?.hire_date,
    hourly_rate: raw?.hourly_rate,
    status: raw?.status ?? 'active',
    company_id: companyId ?? null,
    department_id: raw?.department_id ?? (typeof raw?.department === 'string' ? raw.department : raw?.department?.id),
    team_id: raw?.team_id ?? (typeof raw?.team === 'string' ? raw.team : raw?.team?.id),
    position: raw?.position,
    emergency_contact_name: raw?.emergency_contact_name,
    emergency_contact_phone: raw?.emergency_contact_phone,
    notes: raw?.notes,
    created_at: raw?.created_at ?? new Date().toISOString(),
    user_id: raw?.user_id ?? (typeof raw?.user === 'string' ? raw.user : raw?.user?.id)
  } as Employee;
}

export interface Organization {
  id: string;
  name: string;
  color?: string;
  address?: string;
  phone?: string;
  email?: string;
  operations_manager_id?: string;
  organization_manager_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

/** Manager details returned on company (company_manager_details). */
export interface CompanyManagerDetails {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  is_active?: boolean;
}

export interface Company {
  id: string;
  name: string;
  type: string;
  color?: string;
  address?: string;
  phone?: string;
  email?: string;
  field_type?: 'IT' | 'Non-IT';
  operations_manager_id?: string;
  company_manager_id?: string;
  organization_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  /** Manager details (from API); a company can have one manager. */
  company_manager_details?: CompanyManagerDetails | null;
  /** Number of employees in this company (no limit). */
  employees_count?: number;
  /** Preview list of employees for display. */
  employees_preview?: { id: string; full_name: string; email: string; status: string }[];
}

export interface Department {
  id: string;
  name: string;
  color?: string;
  company_id: string;
  created_at: string;
}

export interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  hire_date?: string;
  hourly_rate?: number;
  status: string;
  company_id: string | null;
  department_id?: string;
  team_id?: string | null;
  position?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  notes?: string;
  created_at: string;
  user_id?: string | null;
}

export interface Shift {
  id: string;
  employee_id: string;
  company_id: string;
  department_id?: string;
  team_id?: string | null;
  start_time: string;
  end_time: string;
  break_minutes?: number;
  notes?: string;
  status: string;
  hourly_rate?: number;
  created_at: string;
  // Missed shift tracking fields
  is_missed?: boolean;
  missed_at?: string;
  replacement_employee_id?: string;
  replacement_approved_at?: string;
  replacement_started_at?: string;
}

export interface ShiftReplacementRequest {
  id: string;
  shift_id: string;
  original_employee_id: string;
  replacement_employee_id: string;
  company_id: string;
  status: 'pending' | 'approved' | 'rejected';
  requested_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
  reviewer_notes?: string;
  created_at: string;
  updated_at: string;
}

export function useOrganizations(organizationManagerId?: string) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrganizations = useCallback(async () => {
    try {
      const params = organizationManagerId ? { organization_manager: organizationManagerId } : undefined;
      const data = await apiClient.get<Organization[] | { results?: Organization[] }>('/scheduler/organizations/', params);
      setOrganizations(ensureArray(data));
    } catch (error) {
      console.error('Error fetching organizations:', error);
      toast.error('Failed to fetch organizations');
    } finally {
      setLoading(false);
    }
  }, [organizationManagerId]);

  const createOrganization = async (orgData: Omit<Organization, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      // Map field names from Supabase to Django
      const payload: any = { ...orgData };
      if (payload.organization_manager_id) {
        payload.organization_manager = payload.organization_manager_id;
        delete payload.organization_manager_id;
      }
      if (payload.operations_manager_id) {
        payload.operations_manager = payload.operations_manager_id;
        delete payload.operations_manager_id;
      }
      
      const data = await apiClient.post<Organization>('/scheduler/organizations/', payload);
      
      setOrganizations(prev => [data, ...prev]);
      toast.success('Organization created successfully');
      return data;
    } catch (error) {
      console.error('Error creating organization:', error);
      toast.error('Failed to create organization');
      throw error;
    }
  };

  const updateOrganization = async (id: string, updates: Partial<Organization>) => {
    try {
      // Map field names from Supabase to Django
      const payload: any = { ...updates };
      if (payload.organization_manager_id !== undefined) {
        payload.organization_manager = payload.organization_manager_id;
        delete payload.organization_manager_id;
      }
      if (payload.operations_manager_id !== undefined) {
        payload.operations_manager = payload.operations_manager_id;
        delete payload.operations_manager_id;
      }
      
      const data = await apiClient.patch<Organization>(`/scheduler/organizations/${id}/`, payload);
      
      setOrganizations(prev => prev.map(o => o.id === id ? data : o));
      toast.success('Organization updated successfully');
      return data;
    } catch (error) {
      console.error('Error updating organization:', error);
      toast.error('Failed to update organization');
      throw error;
    }
  };

  const deleteOrganization = async (id: string) => {
    try {
      await apiClient.delete(`/scheduler/organizations/${id}/`);
      
      setOrganizations(prev => prev.filter(o => o.id !== id));
      toast.success('Organization deleted successfully');
    } catch (error) {
      console.error('Error deleting organization:', error);
      toast.error('Failed to delete organization');
      throw error;
    }
  };

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  return {
    organizations,
    loading,
    createOrganization,
    updateOrganization,
    deleteOrganization,
    refetch: fetchOrganizations,
    fetchOrganizations
  };
}

export function useCompanies(companyManagerId?: string, organizationManagerId?: string) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCompanies = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (organizationManagerId) params.organization_manager = organizationManagerId;
      else if (companyManagerId) params.company_manager = companyManagerId;
      const data = await apiClient.get<Company[] | { results?: Company[] }>('/scheduler/companies/', Object.keys(params).length ? params : undefined);
      setCompanies(ensureArray(data).map(normalizeCompany));
    } catch (error) {
      console.error('Error fetching companies:', error);
      toast.error('Failed to fetch companies');
    } finally {
      setLoading(false);
    }
  }, [companyManagerId, organizationManagerId]);

  const createCompany = async (companyData: Omit<Company, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      // Map field names from Supabase to Django
      const payload: any = { ...companyData };
      if (payload.organization_id) {
        payload.organization = payload.organization_id;
        delete payload.organization_id;
      }
      if (payload.company_manager_id) {
        payload.company_manager = payload.company_manager_id;
        delete payload.company_manager_id;
      }
      if (payload.operations_manager_id) {
        payload.operations_manager = payload.operations_manager_id;
        delete payload.operations_manager_id;
      }
      
      const data = await apiClient.post<Company>('/scheduler/companies/', payload);
      
      setCompanies(prev => [normalizeCompany(data as any), ...prev]);
      toast.success('Company created successfully');
      return data;
    } catch (error) {
      console.error('Error creating company:', error);
      toast.error('Failed to create company');
      throw error;
    }
  };

  const updateCompany = async (id: string, updates: Partial<Company>) => {
    try {
      // Map field names from Supabase to Django
      const payload: any = { ...updates };
      if (payload.organization_id !== undefined) {
        payload.organization = payload.organization_id;
        delete payload.organization_id;
      }
      if (payload.company_manager_id !== undefined) {
        payload.company_manager = payload.company_manager_id;
        delete payload.company_manager_id;
      }
      if (payload.operations_manager_id !== undefined) {
        payload.operations_manager = payload.operations_manager_id;
        delete payload.operations_manager_id;
      }
      
      const data = await apiClient.patch<Company>(`/scheduler/companies/${id}/`, payload);
      
      setCompanies(prev => prev.map(c => c.id === id ? normalizeCompany(data as any) : c));
      toast.success('Company updated successfully');
      return data;
    } catch (error) {
      console.error('Error updating company:', error);
      toast.error('Failed to update company');
      throw error;
    }
  };

  const deleteCompany = async (id: string) => {
    try {
      await apiClient.delete(`/scheduler/companies/${id}/`);
      
      setCompanies(prev => prev.filter(c => c.id !== id));
      toast.success('Company deleted successfully');
    } catch (error) {
      console.error('Error deleting company:', error);
      toast.error('Failed to delete company');
      throw error;
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  return {
    companies,
    loading,
    createCompany,
    updateCompany,
    deleteCompany,
    refetch: fetchCompanies,
    fetchCompanies
  };
}

export function useDepartments(companyId?: string) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDepartments = async () => {
    try {
      const isValidUuid = companyId && companyId !== 'all' && 
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(companyId);
      
      const params: any = {};
      if (isValidUuid) {
        params.company = companyId;
      }
      
      const data = await apiClient.get<Department[] | { results?: Department[] }>('/scheduler/departments/', params);
      setDepartments(ensureArray(data));
    } catch (error) {
      console.error('Error fetching departments:', error);
      toast.error('Failed to fetch departments');
    } finally {
      setLoading(false);
    }
  };

  const createDepartment = async (departmentData: Omit<Department, 'id' | 'created_at'>) => {
    try {
      const payload: any = { ...departmentData };
      if (payload.company_id) {
        payload.company = payload.company_id;
        delete payload.company_id;
      }
      
      const data = await apiClient.post<Department>('/scheduler/departments/', payload);
      
      setDepartments(prev => [data, ...prev]);
      toast.success('Department created successfully');
      return data;
    } catch (error) {
      console.error('Error creating department:', error);
      toast.error('Failed to create department');
      throw error;
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, [companyId]);

  return {
    departments,
    loading,
    createDepartment,
    refetch: fetchDepartments
  };
}

export function useEmployees(companyId?: string) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  // Use ref to track fetched company to avoid stale closure issues
  const fetchedCompanyRef = React.useRef<string | undefined>(undefined);
  const isMountedRef = React.useRef(true);

  // Check if companyId is a valid UUID (not empty)
  const isValidCompanyId = companyId && companyId !== '' && 
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(companyId);
  
  // "all" is a special case - fetch all employees
  const fetchAll = companyId === 'all';

  const fetchEmployees = async (targetCompanyId: string | undefined, forceRefresh = false) => {
    // Handle "all" case - fetch all employees without company filter
    const shouldFetchAll = targetCompanyId === 'all';
    
    // Validate the target company ID (unless fetching all)
    const isValid = shouldFetchAll || (targetCompanyId && targetCompanyId !== '' && 
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetCompanyId));
    
    if (!isValid) {
      if (isMountedRef.current) {
        setEmployees([]);
        setLoading(false);
        fetchedCompanyRef.current = undefined;
      }
      return;
    }

    // Skip if already fetched for this company (unless forced)
    if (!forceRefresh && fetchedCompanyRef.current === targetCompanyId) {
      return;
    }
    if (forceRefresh) {
      fetchedCompanyRef.current = undefined;
    }
    
    try {
      if (isMountedRef.current) {
        setLoading(true);
      }
      
      // RBAC: backend should return scoped list (Super Admin = all; org/company manager = their org/company)
      const baseParams: any = {};
      if (!shouldFetchAll && targetCompanyId) {
        baseParams.company = targetCompanyId;
        baseParams.company_id = targetCompanyId; // some backends filter by company_id
      }
      baseParams.page_size = 100;
      baseParams.limit = 500;

      let allItems: any[] = [];
      const params = { ...baseParams };
      const data = await apiClient.get<any>('/scheduler/employees/', params);
      if (Array.isArray(data)) {
        allItems = data;
      } else {
        const chunk = ensureArray(data);
        const total = (data as any)?.count ?? (data as any)?.total;
        allItems = chunk;
        let page = 2;
        while (
          typeof total === 'number' && allItems.length < total && page <= 50
        ) {
          const nextData = await apiClient.get<any>('/scheduler/employees/', { ...baseParams, page });
          const nextChunk = ensureArray(nextData);
          allItems = allItems.concat(nextChunk);
          if (nextChunk.length === 0) break;
          page += 1;
        }
      }

      if (isMountedRef.current) {
        setEmployees(allItems.map(normalizeEmployee));
        fetchedCompanyRef.current = targetCompanyId;
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast.error('Failed to fetch employees');
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  const createEmployee = async (employeeData: Omit<Employee, 'id' | 'created_at'>) => {
    try {
      const payload: any = { ...employeeData };
      if (payload.company_id) {
        payload.company = payload.company_id;
        delete payload.company_id;
      }
      if (payload.department_id) {
        payload.department = payload.department_id;
        delete payload.department_id;
      }
      if (payload.team_id) {
        payload.team = payload.team_id;
        delete payload.team_id;
      }
      if (payload.user_id) {
        payload.user = payload.user_id;
        delete payload.user_id;
      }
      
      const data = await apiClient.post<Employee>('/scheduler/employees/', payload);
      const normalized = normalizeEmployee(data);
      setEmployees(prev => [normalized, ...prev]);
      toast.success('Employee created successfully');
      return normalized;
    } catch (error) {
      console.error('Error creating employee:', error);
      toast.error('Failed to create employee');
      throw error;
    }
  };

  const updateEmployee = async (id: string, updates: Partial<Employee>) => {
    try {
      const payload: any = { ...updates };
      if (payload.company_id !== undefined) {
        payload.company = payload.company_id;
        delete payload.company_id;
      }
      if (payload.department_id !== undefined) {
        payload.department = payload.department_id;
        delete payload.department_id;
      }
      if (payload.team_id !== undefined) {
        payload.team = payload.team_id;
        delete payload.team_id;
      }
      if (payload.user_id !== undefined) {
        payload.user = payload.user_id;
        delete payload.user_id;
      }
      
      const data = await apiClient.patch<Employee>(`/scheduler/employees/${id}/`, payload);
      const normalized = normalizeEmployee(data);
      setEmployees(prev => prev.map(e => e.id === id ? normalized : e));
      toast.success('Employee updated successfully');
      return data;
    } catch (error) {
      console.error('Error updating employee:', error);
      toast.error('Failed to update employee');
      throw error;
    }
  };

  const deleteEmployee = async (id: string) => {
    try {
      await apiClient.delete(`/scheduler/employees/${id}/`);

      setEmployees(prev => prev.filter(e => e.id !== id));
      toast.success('Employee deleted successfully');
    } catch (error) {
      console.error('Error deleting employee:', error);
      toast.error('Failed to delete employee');
      throw error;
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    
    // Only clear employees if switching to a different valid company or to invalid
    if (companyId !== fetchedCompanyRef.current) {
      // Don't reset to empty immediately - let fetch handle it to avoid flicker
      fetchEmployees(companyId, false);
    }
    
    // Real-time subscriptions removed - can be added back with WebSocket support later

    return () => {
      isMountedRef.current = false;
    };
  }, [companyId, isValidCompanyId, fetchAll]);

  return {
    employees,
    loading,
    createEmployee,
    updateEmployee,
    deleteEmployee,
    refetch: () => fetchEmployees(companyId, true)
  };
}

export function useShifts(companyId?: string, weekStart?: Date, weekEnd?: Date) {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const isMountedRef = React.useRef(true);
  const fetchingRef = React.useRef(false);

  // Check if companyId is a valid UUID (not "all" or empty)
  const isValidCompanyId = companyId && companyId !== 'all' && 
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(companyId);

  // Stabilize weekStart/weekEnd to prevent infinite loops
  const weekStartTime = weekStart?.getTime();
  const weekEndTime = weekEnd?.getTime();

  const fetchShifts = React.useCallback(async () => {
    // Only fetch if we have a valid company ID - otherwise return empty array
    if (!isValidCompanyId) {
      if (isMountedRef.current) {
        setShifts([]);
        setLoading(false);
      }
      return;
    }

    // Prevent concurrent fetches
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    
    try {
      if (isMountedRef.current) {
        setLoading(true);
      }
      
      const params: any = { company: companyId };
      
      if (weekStart) {
        const computedEnd = weekEnd ? new Date(weekEnd.getTime() + 24 * 60 * 60 * 1000) : (() => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); return d; })();
        params.start_date = weekStart.toISOString();
        params.end_date = computedEnd.toISOString();
      }
      
      const data = await apiClient.get<Shift[] | { results?: Shift[] }>('/scheduler/shifts/', params);

      if (isMountedRef.current) {
        setShifts(ensureArray(data));
      }
    } catch (error) {
      console.error('Error fetching shifts:', error);
      if (isMountedRef.current) {
        toast.error('Failed to fetch shifts');
      }
    } finally {
      fetchingRef.current = false;
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [companyId, isValidCompanyId, weekStartTime, weekEndTime]);

  const createShift = async (shiftData: Omit<Shift, 'id' | 'created_at'>) => {
    try {
      const payload: any = { ...shiftData };
      if (payload.employee_id) {
        payload.employee = payload.employee_id;
        delete payload.employee_id;
      }
      if (payload.company_id) {
        payload.company = payload.company_id;
        delete payload.company_id;
      }
      if (payload.department_id) {
        payload.department = payload.department_id;
        delete payload.department_id;
      }
      if (payload.team_id) {
        payload.team = payload.team_id;
        delete payload.team_id;
      }
      if (payload.replacement_employee_id) {
        payload.replacement_employee = payload.replacement_employee_id;
        delete payload.replacement_employee_id;
      }
      
      const data = await apiClient.post<Shift>('/scheduler/shifts/', payload);
      
      setShifts(prev => [...prev, data]);
      toast.success('Shift created successfully');
      return data;
    } catch (error) {
      console.error('Error creating shift:', error);
      toast.error('Failed to create shift');
      throw error;
    }
  };

  const updateShift = async (id: string, updates: Partial<Shift>) => {
    try {
      const payload: any = { ...updates };
      if (payload.employee_id !== undefined) {
        payload.employee = payload.employee_id;
        delete payload.employee_id;
      }
      if (payload.company_id !== undefined) {
        payload.company = payload.company_id;
        delete payload.company_id;
      }
      if (payload.department_id !== undefined) {
        payload.department = payload.department_id;
        delete payload.department_id;
      }
      if (payload.team_id !== undefined) {
        payload.team = payload.team_id;
        delete payload.team_id;
      }
      if (payload.replacement_employee_id !== undefined) {
        payload.replacement_employee = payload.replacement_employee_id;
        delete payload.replacement_employee_id;
      }
      
      const data = await apiClient.patch<Shift>(`/scheduler/shifts/${id}/`, payload);
      
      setShifts(prev => prev.map(s => s.id === id ? data : s));
      toast.success('Shift updated successfully');
      return data;
    } catch (error) {
      console.error('Error updating shift:', error);
      toast.error('Failed to update shift');
      throw error;
    }
  };

  const deleteShift = async (id: string) => {
    try {
      // Unlink any time-clock entries that reference this shift so delete can succeed
      const clockEntries = await apiClient.get<any[]>('/scheduler/time-clock/', { shift: id });
      const list = ensureArray(clockEntries);
      await Promise.all(list.map((entry: any) =>
        apiClient.patch(`/scheduler/time-clock/${entry.id}/`, { shift: null })
      ));
      await apiClient.delete(`/scheduler/shifts/${id}/`);
      setShifts(prev => prev.filter(s => s.id !== id));
      toast.success('Shift deleted successfully');
    } catch (error) {
      console.error('Error deleting shift:', error);
      toast.error('Failed to delete shift');
      throw error;
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    fetchShifts();
    
    // Real-time subscriptions removed - can be added back with WebSocket support later

    return () => {
      isMountedRef.current = false;
    };
  }, [companyId, weekStartTime, weekEndTime, fetchShifts]);

  return {
    shifts,
    loading,
    createShift,
    updateShift,
    deleteShift,
    refetch: fetchShifts
  };
}