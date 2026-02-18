import { useState, useEffect } from 'react';
import apiClient from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface MissedShift {
  id: string;
  employee_id: string;
  company_id: string;
  department_id?: string;
  start_time: string;
  end_time: string;
  status: string;
  is_missed: boolean;
  missed_at: string;
  replacement_employee_id?: string;
  replacement_approved_at?: string;
  replacement_started_at?: string;
  // Derived from time_clock for the replacement employee (for UI accuracy)
  replacement_clock_in?: string;
  replacement_clock_out?: string;
  replacement_break_start?: string;
  replacement_break_end?: string;
  notes?: string;
  employee?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  replacement_employee?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  company?: {
    id: string;
    name: string;
    organization_id?: string;
  };
}

export interface ReplacementRequest {
  id: string;
  shift_id: string;
  original_employee_id: string;
  replacement_employee_id: string;
  company_id: string;
  status: string;
  requested_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
  reviewer_notes?: string;
  shift?: MissedShift;
  original_employee?: {
    id: string;
    first_name: string;
    last_name: string;
  };
  replacement_employee?: {
    id: string;
    first_name: string;
    last_name: string;
  };
}

const GRACE_PERIOD_MINUTES = 15;

export function useMissedShifts(companyId?: string, employeeCompanyId?: string) {
  const { user } = useAuth();
  const [missedShifts, setMissedShifts] = useState<MissedShift[]>([]);
  const [replacementRequests, setReplacementRequests] = useState<ReplacementRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [myEmployeeId, setMyEmployeeId] = useState<string | null>(null);

  // Get current user's employee ID once
  useEffect(() => {
    const getMyEmployee = async () => {
      if (!user) return;
      try {
        const employees = await apiClient.get<any[]>('/scheduler/employees/', { user: user.id });
        setMyEmployeeId(employees?.[0]?.id || null);
      } catch (error) {
        console.error('Error fetching employee:', error);
        setMyEmployeeId(null);
      }
    };
    getMyEmployee();
  }, [user]);

  const fetchMissedShifts = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // Determine which company to filter by
      const filterCompanyId = companyId && companyId !== 'all' ? companyId : employeeCompanyId;
      
      const params: any = { is_missed: true };
      if (filterCompanyId) {
        params.company = filterCompanyId;
      }
      
      const data = await apiClient.get<any[]>('/scheduler/shifts/', params);
      
      // Fetch replacement employee info for shifts that have one
      // Also check if replacement has clocked in via time_clock
      // Also filter out shifts where the current employee is the one who missed (can't replace yourself)
      const shiftsWithReplacements = await Promise.all(
        (data || [])
          .filter((shift: any) => (shift.employee || shift.employee_id) !== myEmployeeId) // Exclude own missed shifts
          .map(async (shift: any) => {
            let enrichedShift = { ...shift };
            
            const replacementEmployeeId = shift.replacement_employee || shift.replacement_employee_id;
            if (replacementEmployeeId) {
              // Fetch replacement employee details
              try {
                const replEmployee = await apiClient.get<any>(`/scheduler/employees/${replacementEmployeeId}/`);
                enrichedShift.replacement_employee = replEmployee;
              } catch (error) {
                console.error('Error fetching replacement employee:', error);
              }
              
              // Check if replacement has clocked in (even if replacement_started_at wasn't set)
              try {
                const clockEntries = await apiClient.get<any[]>('/scheduler/time-clock/', {
                  shift: shift.id,
                  employee: replacementEmployeeId
                });
                const clockEntry = clockEntries.find(e => e.clock_in);

                if (clockEntry) {
                  enrichedShift.replacement_clock_in = clockEntry.clock_in || undefined;
                  enrichedShift.replacement_clock_out = clockEntry.clock_out || undefined;
                  enrichedShift.replacement_break_start = clockEntry.break_start || undefined;
                  enrichedShift.replacement_break_end = clockEntry.break_end || undefined;
                }
                
                // If there's a clock entry, treat the shift as started
                if (clockEntry?.clock_in && !shift.replacement_started_at) {
                  enrichedShift.replacement_started_at = clockEntry.clock_in;
                  enrichedShift.status = 'in_progress';
                }

                // If replacement clocked out, reflect completion in UI
                if (clockEntry?.clock_out) {
                  enrichedShift.status = 'completed';
                }
              } catch (error) {
                console.error('Error fetching clock entry:', error);
              }
            }
            return enrichedShift;
          })
      );
      
      setMissedShifts(shiftsWithReplacements);
    } catch (error) {
      console.error('Error fetching missed shifts:', error);
      toast.error('Failed to load missed shifts');
    } finally {
      setLoading(false);
    }
  };

  const fetchReplacementRequests = async () => {
    if (!user) return;
    
    try {
      const params: any = {};
      if (companyId && companyId !== 'all') {
        params.company = companyId;
      }
      
      const data = await apiClient.get<ReplacementRequest[]>('/scheduler/replacement-requests/', params);
      setReplacementRequests(data || []);
    } catch (error) {
      console.error('Error fetching replacement requests:', error);
    }
  };

  // Check for shifts that should be marked as missed (15 min grace period)
  // IMPORTANT: Only marks shifts as missed if they were created BEFORE their start_time.
  // Shifts created retroactively (for past dates) should NOT be auto-marked as missed.
  const checkAndMarkMissedShifts = async () => {
    if (!user) return;
    
    try {
      const now = new Date();
      const graceThreshold = new Date(now.getTime() - GRACE_PERIOD_MINUTES * 60 * 1000);
      
      // Find scheduled shifts that have passed the grace period without clock-in
      // Include created_at to filter out retroactively created shifts
      const overdueShifts = await apiClient.get<any[]>('/scheduler/shifts/', {
        status: 'scheduled',
        is_missed: false,
        start_date: graceThreshold.toISOString()
      });
      
      if (!overdueShifts || overdueShifts.length === 0) return;
      
      // Check each shift for time clock entry
      for (const shift of overdueShifts) {
        // Skip shifts that were created AFTER their start_time (retroactively added)
        // These are intentionally added for past dates and should not be auto-marked as missed
        const shiftStartTime = new Date(shift.start_time);
        const shiftCreatedAt = new Date(shift.created_at);
        if (shiftCreatedAt > shiftStartTime) {
          continue; // Skip retroactively created shifts
        }
        
        const clockEntries = await apiClient.get<any[]>('/scheduler/time-clock/', {
          shift: shift.id
        });
        const clockEntry = clockEntries.find(e => e.clock_in);
        
        // If no clock entry, mark as missed
        if (!clockEntry) {
          await apiClient.post(`/scheduler/shifts/${shift.id}/mark_missed/`, {});
        }
      }
      
      // Refresh the missed shifts list
      await fetchMissedShifts();
    } catch (error) {
      console.error('Error checking missed shifts:', error);
    }
  };

  // Request to take over a missed shift
  const requestReplacement = async (shiftId: string, originalEmployeeId: string, companyIdForRequest: string) => {
    if (!user) return;
    
    try {
      // Get current user's employee record
      const employees = await apiClient.get<any[]>('/scheduler/employees/', { user: user.id });
      const myEmployee = employees?.[0];
      
      if (!myEmployee) {
        toast.error('You must be an employee to request a shift replacement');
        return;
      }
      
      // Check if already requested
      const requests = await apiClient.get<any[]>('/scheduler/replacement-requests/', {
        shift: shiftId,
        replacement_employee: myEmployee.id
      });
      
      if (requests && requests.length > 0) {
        toast.error('You have already requested this shift');
        return;
      }
      
      await apiClient.post('/scheduler/replacement-requests/', {
        shift: shiftId,
        original_employee: originalEmployeeId,
        replacement_employee: myEmployee.id,
        company: companyIdForRequest,
        status: 'pending'
      });
      
      toast.success('Replacement request submitted');
      await fetchReplacementRequests();
    } catch (error) {
      console.error('Error requesting replacement:', error);
      toast.error('Failed to submit replacement request');
    }
  };

  // Approve replacement request (manager action)
  const approveRequest = async (requestId: string) => {
    if (!user) return;
    
    try {
      // Approve the request (this will also update the shift)
      await apiClient.post(`/scheduler/replacement-requests/${requestId}/approve/`, {});
      
      toast.success('Replacement approved');
      await fetchReplacementRequests();
      await fetchMissedShifts();
    } catch (error) {
      console.error('Error approving request:', error);
      toast.error('Failed to approve replacement');
    }
  };

  // Reject replacement request (manager action)
  const rejectRequest = async (requestId: string, notes?: string) => {
    if (!user) return;
    
    try {
      await apiClient.post(`/scheduler/replacement-requests/${requestId}/reject/`, {
        notes: notes
      });
      
      toast.success('Replacement rejected');
      await fetchReplacementRequests();
    } catch (error) {
      console.error('Error rejecting request:', error);
      toast.error('Failed to reject replacement');
    }
  };

  // Mark replacement as started (employee starts working the shift)
  // Returns true if successful, so callers can trigger their own refetches
  const startReplacementShift = async (shiftId: string): Promise<boolean> => {
    if (!user) return false;
    
    try {
      // Get employee record
      const employees = await apiClient.get<any[]>('/scheduler/employees/', { user: user.id });
      const myEmployee = employees?.[0];
      
      if (!myEmployee) {
        toast.error('Employee record not found');
        return false;
      }
      
      // Verify this employee is the approved replacement
      const shift = await apiClient.get<any>(`/scheduler/shifts/${shiftId}/`);
      
      const replacementEmployeeId = shift.replacement_employee || shift.replacement_employee_id;
      if (replacementEmployeeId !== myEmployee.id) {
        toast.error('You are not approved to work this shift');
        return false;
      }
      
      // Create time clock entry for the replacement employee (this will also update the shift)
      await apiClient.post('/scheduler/time-clock/clock_in/', {
        employee_id: myEmployee.id,
        shift_id: shiftId
      });
      
      toast.success('Shift started successfully');
      await fetchMissedShifts();
      return true;
    } catch (error) {
      console.error('Error starting replacement shift:', error);
      toast.error('Failed to start shift');
      return false;
    }
  };

  useEffect(() => {
    if (!user) return;

    fetchMissedShifts();
    fetchReplacementRequests();

    // Check for missed shifts every minute
    const intervalId = setInterval(checkAndMarkMissedShifts, 60000);

    // Initial check
    checkAndMarkMissedShifts();

    return () => {
      clearInterval(intervalId);
    };
  }, [user, companyId, employeeCompanyId, myEmployeeId]);

  return {
    missedShifts,
    replacementRequests,
    loading,
    myEmployeeId,
    requestReplacement,
    approveRequest,
    rejectRequest,
    startReplacementShift,
    refetch: () => {
      fetchMissedShifts();
      fetchReplacementRequests();
    }
  };
}
