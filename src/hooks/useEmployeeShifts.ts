import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import apiClient from "@/lib/api-client";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO, isToday as checkIsToday } from "date-fns";

interface Shift {
  id: string;
  employee_id: string;
  company_id: string;
  start_time: string;
  end_time: string;
  status: string;
  notes?: string;
  employee?: {
    first_name: string;
    last_name: string;
  };
}

export const useEmployeeShifts = () => {
  const { user } = useAuth();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [todayShift, setTodayShift] = useState<Shift | null>(null);

  // Fetch employee's shifts
  const fetchShifts = useCallback(async (startDate?: Date, endDate?: Date) => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      // Get employee record
      const employees = await apiClient.get<any[]>('/scheduler/employees/', { user: user.id });
      const employee = employees?.[0];

      if (!employee) {
        setIsLoading(false);
        return;
      }

      setEmployeeId(employee.id);
      setCompanyId(employee.company?.id || employee.company_id);

      // Default to this week if no dates provided
      const start = startDate || startOfWeek(new Date(), { weekStartsOn: 1 });
      const end = endDate || endOfWeek(new Date(), { weekStartsOn: 1 });

      const shiftsData = await apiClient.get<Shift[]>('/scheduler/shifts/', {
        employee: employee.id,
        start_date: start.toISOString(),
        end_date: end.toISOString()
      });

      setShifts(shiftsData || []);

      // Find today's shift
      const today = (shiftsData || []).find(shift => {
        const shiftDate = parseISO(shift.start_time);
        return checkIsToday(shiftDate);
      });
      setTodayShift(today || null);

    } catch (error) {
      console.error('Error fetching shifts:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Fetch all company shifts (for schedule view)
  const fetchAllCompanyShifts = useCallback(async (startDate?: Date, endDate?: Date): Promise<Shift[]> => {
    if (!companyId) return [];

    try {
      const start = startDate || startOfWeek(new Date(), { weekStartsOn: 1 });
      const end = endDate || endOfWeek(new Date(), { weekStartsOn: 1 });

      const data = await apiClient.get<Shift[]>('/scheduler/shifts/', {
        company: companyId,
        start_date: start.toISOString(),
        end_date: end.toISOString()
      });

      return data || [];
    } catch (error) {
      console.error('Error fetching company shifts:', error);
      return [];
    }
  }, [companyId]);

  // Get week hours
  const getWeekHours = useCallback(() => {
    return shifts.reduce((total, shift) => {
      const start = new Date(shift.start_time);
      const end = new Date(shift.end_time);
      const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      return total + hours;
    }, 0);
  }, [shifts]);

  // Initial fetch
  useEffect(() => {
    fetchShifts();
  }, [fetchShifts]);

  return {
    shifts,
    todayShift,
    employeeId,
    companyId,
    isLoading,
    getWeekHours,
    fetchShifts,
    fetchAllCompanyShifts
  };
};
