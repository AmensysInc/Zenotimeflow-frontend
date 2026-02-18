import React, { useState, useEffect } from 'react';
import apiClient from '@/lib/api-client';
import { toast } from 'sonner';

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

export function useOrganizations() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrganizations = async () => {
    try {
      const data = await apiClient.get<Organization[]>('/scheduler/organizations/');
      setOrganizations(data || []);
    } catch (error) {
      console.error('Error fetching organizations:', error);
      toast.error('Failed to fetch organizations');
    } finally {
      setLoading(false);
    }
  };

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
  }, []);

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

export function useCompanies() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCompanies = async () => {
    try {
      const data = await apiClient.get<Company[]>('/scheduler/companies/');
      setCompanies(data || []);
    } catch (error) {
      console.error('Error fetching companies:', error);
      toast.error('Failed to fetch companies');
    } finally {
      setLoading(false);
    }
  };

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
      
      setCompanies(prev => [data, ...prev]);
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
      
      setCompanies(prev => prev.map(c => c.id === id ? data : c));
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
  }, []);

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
      
      const data = await apiClient.get<Department[]>('/scheduler/departments/', params);
      setDepartments(data || []);
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
    
    try {
      if (isMountedRef.current) {
        setLoading(true);
      }
      
      const params: any = {};
      if (!shouldFetchAll && targetCompanyId) {
        params.company = targetCompanyId;
      }
      
      const data = await apiClient.get<Employee[]>('/scheduler/employees/', params);

      if (isMountedRef.current) {
        setEmployees(data || []);
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
      
      setEmployees(prev => [data, ...prev]);
      toast.success('Employee created successfully');
      return data;
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
      
      setEmployees(prev => prev.map(e => e.id === id ? data : e));
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
      
      const data = await apiClient.get<Shift[]>('/scheduler/shifts/', params);

      if (isMountedRef.current) {
        setShifts(data || []);
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