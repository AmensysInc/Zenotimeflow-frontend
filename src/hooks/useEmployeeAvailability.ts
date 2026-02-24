import { useState, useEffect, useCallback } from 'react';
import apiClient from '@/lib/api-client';
import { ensureArray } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export type AvailabilityStatus = 'available' | 'prefers_to_work' | 'unavailable';

export interface EmployeeAvailability {
  id: string;
  employee_id: string;
  company_id: string;
  date: string;
  status: AvailabilityStatus;
  start_time?: string;
  end_time?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export function useEmployeeAvailability(companyId?: string, weekStart?: Date) {
  const { user } = useAuth();
  const [availability, setAvailability] = useState<EmployeeAvailability[]>([]);
  const [loading, setLoading] = useState(false);

  const isValidCompanyId = companyId && companyId !== 'all' && 
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(companyId);

  const fetchAvailability = useCallback(async () => {
    if (!user || !isValidCompanyId) {
      setAvailability([]);
      return;
    }

    try {
      setLoading(true);
      
      const params: any = { company: companyId };
      if (weekStart) {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);
        params.start_date = weekStart.toISOString().split('T')[0];
        params.end_date = weekEnd.toISOString().split('T')[0];
      }

      const data = await apiClient.get<EmployeeAvailability[] | { results?: EmployeeAvailability[] }>('/scheduler/availability/', params);

      // Normalize response (array or paginated) and cast status
      const typedData = ensureArray(data).map(item => ({
        ...item,
        status: item.status as AvailabilityStatus,
        employee_id: item.employee || item.employee_id,
        company_id: item.company || item.company_id
      }));
      setAvailability(typedData);
    } catch (error) {
      console.error('Error fetching availability:', error);
    } finally {
      setLoading(false);
    }
  }, [user, companyId, isValidCompanyId, weekStart]);

  const setEmployeeAvailability = async (
    employeeId: string, 
    date: Date, 
    status: AvailabilityStatus,
    notes?: string
  ) => {
    if (!user || !isValidCompanyId) return;

    try {
      const dateStr = date.toISOString().split('T')[0];
      
      // Check if exists first, then update or create
      const existing = availability.find(a => a.employee_id === employeeId && a.date === dateStr);
      
      let data: EmployeeAvailability;
      if (existing) {
        data = await apiClient.patch<EmployeeAvailability>(`/scheduler/availability/${existing.id}/`, {
          status,
          notes
        });
      } else {
        data = await apiClient.post<EmployeeAvailability>('/scheduler/availability/', {
          employee: employeeId,
          company: companyId,
          date: dateStr,
          status,
          notes
        });
      }

      // Cast the status field and normalize field names
      const typedData: EmployeeAvailability = {
        ...data,
        status: data.status as AvailabilityStatus,
        employee_id: data.employee || data.employee_id,
        company_id: data.company || data.company_id
      };

      setAvailability(prev => {
        const existing = prev.findIndex(a => a.employee_id === employeeId && a.date === dateStr);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = typedData;
          return updated;
        }
        return [...prev, typedData];
      });

      toast.success('Availability updated');
    } catch (error) {
      console.error('Error setting availability:', error);
      toast.error('Failed to update availability');
    }
  };

  const getAvailabilityForEmployee = useCallback((employeeId: string, date: Date): EmployeeAvailability | undefined => {
    const dateStr = date.toISOString().split('T')[0];
    return availability.find(a => a.employee_id === employeeId && a.date === dateStr);
  }, [availability]);

  const getAvailabilityStatus = useCallback((employeeId: string, date: Date): AvailabilityStatus => {
    const av = getAvailabilityForEmployee(employeeId, date);
    return av?.status || 'available'; // Default to available if not set
  }, [getAvailabilityForEmployee]);

  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);

  return {
    availability,
    loading,
    setEmployeeAvailability,
    getAvailabilityForEmployee,
    getAvailabilityStatus,
    refetch: fetchAvailability
  };
}
