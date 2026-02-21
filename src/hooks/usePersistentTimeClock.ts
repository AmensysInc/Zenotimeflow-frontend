import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import apiClient from "@/lib/api-client";
import { ensureArray } from "@/lib/utils";
import { toast } from "sonner";

const ACTIVE_CLOCK_KEY = 'active_time_clock';
const BREAK_STATE_KEY = 'active_break_state';
const DEFAULT_BREAK_DURATION = 30; // Default break duration in minutes

interface ActiveClockState {
  entryId: string;
  clockInTime: string;
  employeeId: string;
  shiftId?: string;
}

interface BreakState {
  breakStartTime: string;
  breakDurationMinutes: number;
  notificationShown: boolean;
}

interface TimeClockEntry {
  id: string;
  clock_in: string | null;
  clock_out: string | null;
  break_start: string | null;
  break_end: string | null;
  total_hours: number | null;
  overtime_hours: number | null;
}

// Get stored active clock state - works without auth
const getStoredClockState = (): ActiveClockState | null => {
  try {
    const stored = localStorage.getItem(ACTIVE_CLOCK_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

// Store active clock state
const storeClockState = (state: ActiveClockState | null) => {
  if (state) {
    localStorage.setItem(ACTIVE_CLOCK_KEY, JSON.stringify(state));
  } else {
    localStorage.removeItem(ACTIVE_CLOCK_KEY);
  }
};

// Get stored break state
const getStoredBreakState = (): BreakState | null => {
  try {
    const stored = localStorage.getItem(BREAK_STATE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

// Store break state
const storeBreakState = (state: BreakState | null) => {
  if (state) {
    localStorage.setItem(BREAK_STATE_KEY, JSON.stringify(state));
  } else {
    localStorage.removeItem(BREAK_STATE_KEY);
  }
};

// Calculate elapsed WORKING time from stored clock-in (excluding break time)
const calculateElapsedTimeFromStorage = (breakStart?: string | null, breakEnd?: string | null): number => {
  const stored = getStoredClockState();
  if (stored?.clockInTime) {
    const clockIn = new Date(stored.clockInTime);
    const now = new Date();
    let diffMs = now.getTime() - clockIn.getTime();
    
    // Subtract completed break time
    if (breakStart && breakEnd) {
      const breakStartTime = new Date(breakStart);
      const breakEndTime = new Date(breakEnd);
      diffMs -= (breakEndTime.getTime() - breakStartTime.getTime());
    }
    // If currently on break, subtract time since break started
    else if (breakStart && !breakEnd) {
      const breakStartTime = new Date(breakStart);
      diffMs -= (now.getTime() - breakStartTime.getTime());
    }
    
    return Math.max(0, Math.floor(diffMs / 1000));
  }
  return 0;
};

// Format elapsed time
const formatElapsedTime = (seconds: number): string => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// Request notification permission
const requestNotificationPermission = async () => {
  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission();
  }
};

// Show break ending notification
const showBreakEndingNotification = () => {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('Break Ending Soon!', {
      body: 'Your break will end in 5 minutes. Please prepare to resume work.',
      icon: '/favicon.ico',
      tag: 'break-ending',
      requireInteraction: true
    });
  }
  // Also show in-app toast
  toast.warning('Break ending in 5 minutes!', {
    description: 'Please prepare to resume work.',
    duration: 10000
  });
};

export const usePersistentTimeClock = () => {
  const { user } = useAuth();
  const [activeEntry, setActiveEntry] = useState<TimeClockEntry | null>(null);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [breakElapsedSeconds, setBreakElapsedSeconds] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const breakIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const breakNotificationRef = useRef<NodeJS.Timeout | null>(null);
  const hasInitialized = useRef(false);

  // Request notification permission on mount
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // Initialize from localStorage immediately (before auth check)
  useEffect(() => {
    const stored = getStoredClockState();
    if (stored) {
      setElapsedSeconds(calculateElapsedTimeFromStorage());
      // Create a minimal activeEntry from stored state to show timer
      setActiveEntry({
        id: stored.entryId,
        clock_in: stored.clockInTime,
        clock_out: null,
        break_start: null,
        break_end: null,
        total_hours: null,
        overtime_hours: null
      });
    }
    
    // Check for active break state
    const breakState = getStoredBreakState();
    if (breakState) {
      const breakStart = new Date(breakState.breakStartTime);
      const elapsed = Math.floor((new Date().getTime() - breakStart.getTime()) / 1000);
      setBreakElapsedSeconds(elapsed);
    }
  }, []);

  // Calculate break time remaining and set up notification
  const setupBreakNotification = useCallback((breakDurationMinutes: number, breakStartTime: string) => {
    // Clear any existing notification timer
    if (breakNotificationRef.current) {
      clearTimeout(breakNotificationRef.current);
      breakNotificationRef.current = null;
    }
    
    const breakStart = new Date(breakStartTime);
    const breakEndTime = new Date(breakStart.getTime() + breakDurationMinutes * 60 * 1000);
    const notifyTime = new Date(breakEndTime.getTime() - 5 * 60 * 1000); // 5 minutes before
    const now = new Date();
    
    const timeUntilNotify = notifyTime.getTime() - now.getTime();
    
    // Check if we've already passed the notification time
    const storedBreak = getStoredBreakState();
    if (storedBreak?.notificationShown) {
      return; // Already showed notification
    }
    
    if (timeUntilNotify > 0) {
      // Set timer for 5 min before break ends
      breakNotificationRef.current = setTimeout(() => {
        showBreakEndingNotification();
        // Mark notification as shown
        const currentBreak = getStoredBreakState();
        if (currentBreak) {
          storeBreakState({ ...currentBreak, notificationShown: true });
        }
      }, timeUntilNotify);
    } else if (timeUntilNotify > -5 * 60 * 1000) {
      // We're within the last 5 minutes but haven't shown notification yet
      showBreakEndingNotification();
      const currentBreak = getStoredBreakState();
      if (currentBreak) {
        storeBreakState({ ...currentBreak, notificationShown: true });
      }
    }
  }, []);

  // Start timer immediately if there's an active clock state
  useEffect(() => {
    const stored = getStoredClockState();
    
    if (stored) {
      // Clear any existing interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      
      // Start the timer (will account for breaks)
      intervalRef.current = setInterval(() => {
        // We need to get break info from activeEntry
        setElapsedSeconds(prev => {
          const breakState = getStoredBreakState();
          // If on break, don't increment working time
          if (breakState) {
            return prev;
          }
          return calculateElapsedTimeFromStorage();
        });
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Handle break timer
  useEffect(() => {
    const breakState = getStoredBreakState();
    
    if (breakState) {
      // Clear existing break interval
      if (breakIntervalRef.current) {
        clearInterval(breakIntervalRef.current);
      }
      
      // Start break timer
      breakIntervalRef.current = setInterval(() => {
        const breakStart = new Date(breakState.breakStartTime);
        const elapsed = Math.floor((new Date().getTime() - breakStart.getTime()) / 1000);
        setBreakElapsedSeconds(elapsed);
      }, 1000);
      
      // Set up notification
      setupBreakNotification(breakState.breakDurationMinutes, breakState.breakStartTime);
    } else {
      setBreakElapsedSeconds(0);
      if (breakIntervalRef.current) {
        clearInterval(breakIntervalRef.current);
        breakIntervalRef.current = null;
      }
    }

    return () => {
      if (breakIntervalRef.current) {
        clearInterval(breakIntervalRef.current);
      }
    };
  }, [activeEntry?.break_start, activeEntry?.break_end, setupBreakNotification]);

  // Fetch employee and verify active entry when user is available
  const fetchEmployeeData = useCallback(async () => {
    if (!user) {
      // Even without user, check localStorage for persisted timer
      const stored = getStoredClockState();
      if (stored) {
        setElapsedSeconds(calculateElapsedTimeFromStorage());
      }
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

      // Check for active time clock entry in database
      const rawEntries = await apiClient.get<any>('/scheduler/time-clock/', {
        employee: employee.id
      });
      const entries = ensureArray(rawEntries);
      const activeEntryData = entries.find(entry => entry.clock_in && !entry.clock_out);

      if (activeEntryData) {
        setActiveEntry(activeEntryData);
        
        // Store in localStorage for persistence
        storeClockState({
          entryId: activeEntryData.id,
          clockInTime: activeEntryData.clock_in!,
          employeeId: employee.id,
          shiftId: activeEntryData.shift_id
        });
        
        // Handle break state
        if (activeEntryData.break_start && !activeEntryData.break_end) {
          // Currently on break - store break state
          storeBreakState({
            breakStartTime: activeEntryData.break_start,
            breakDurationMinutes: DEFAULT_BREAK_DURATION,
            notificationShown: false
          });
        } else {
          // Not on break - clear break state
          storeBreakState(null);
        }
        
        // Calculate elapsed time
        setElapsedSeconds(calculateElapsedTimeFromStorage(activeEntryData.break_start, activeEntryData.break_end));
        
        // Ensure timer is running
        if (!intervalRef.current) {
          intervalRef.current = setInterval(() => {
            const breakState = getStoredBreakState();
            if (!breakState) {
              setElapsedSeconds(calculateElapsedTimeFromStorage(activeEntryData.break_start, activeEntryData.break_end));
            }
          }, 1000);
        }
      } else {
        // No active entry in DB, clear local state
        setActiveEntry(null);
        storeClockState(null);
        storeBreakState(null);
        setElapsedSeconds(0);
        setBreakElapsedSeconds(0);
        
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    } catch (error) {
      console.error('Error fetching employee data:', error);
      
      // Try to recover from localStorage
      const stored = getStoredClockState();
      if (stored) {
        setElapsedSeconds(calculateElapsedTimeFromStorage());
      }
    } finally {
      setIsLoading(false);
      hasInitialized.current = true;
    }
  }, [user]);

  // Start break
  const startBreak = useCallback(async (breakDurationMinutes: number = DEFAULT_BREAK_DURATION) => {
    if (!activeEntry) {
      toast.error('No active time entry found');
      return;
    }

    try {
      const breakStartTime = new Date().toISOString();
      
      const data = await apiClient.post<TimeClockEntry>(`/scheduler/time-clock/${activeEntry.id}/start_break/`, {});

      setActiveEntry(data);
      
      // Store break state for persistence
      storeBreakState({
        breakStartTime,
        breakDurationMinutes,
        notificationShown: false
      });
      
      // Set up notification for 5 min before break ends
      setupBreakNotification(breakDurationMinutes, breakStartTime);
      
      toast.success(`Break started (${breakDurationMinutes} min)`);
      return data;
    } catch (error) {
      console.error('Error starting break:', error);
      toast.error('Failed to start break');
      throw error;
    }
  }, [activeEntry, setupBreakNotification]);

  // End break
  const endBreak = useCallback(async () => {
    if (!activeEntry) {
      toast.error('No active time entry found');
      return;
    }

    try {
      const data = await apiClient.post<TimeClockEntry>(`/scheduler/time-clock/${activeEntry.id}/end_break/`, {});

      setActiveEntry(data);
      
      // Clear break state
      storeBreakState(null);
      setBreakElapsedSeconds(0);
      
      // Clear notification timer
      if (breakNotificationRef.current) {
        clearTimeout(breakNotificationRef.current);
        breakNotificationRef.current = null;
      }
      
      // Resume work timer with updated entry
      setElapsedSeconds(calculateElapsedTimeFromStorage(data.break_start, data.break_end));
      
      toast.success('Break ended - timer resumed');
      return data;
    } catch (error) {
      console.error('Error ending break:', error);
      toast.error('Failed to end break');
      throw error;
    }
  }, [activeEntry]);

  // Clock in - validates shift belongs to this employee
  const clockIn = useCallback(async (shiftId?: string) => {
    if (!employeeId) {
      toast.error('Employee record not found');
      return;
    }

    try {
      // If a shiftId is provided, verify it belongs to this employee
      if (shiftId) {
        const shift = await apiClient.get<any>(`/scheduler/shifts/${shiftId}/`);
        
        if (!shift) {
          toast.error('Shift not found');
          return;
        }
        
        if (shift.employee !== employeeId && shift.employee_id !== employeeId) {
          toast.error('You can only clock in for your own assigned shifts');
          return;
        }
      }

      const data = await apiClient.post<TimeClockEntry>('/scheduler/time-clock/clock_in/', {
        employee_id: employeeId,
        shift_id: shiftId || null
      });

      setActiveEntry(data);
      
      // Store in localStorage immediately
      storeClockState({
        entryId: data.id,
        clockInTime: data.clock_in!,
        employeeId,
        shiftId
      });
      
      // Reset elapsed seconds and start timer
      setElapsedSeconds(0);
      
      // Clear existing interval and start new one
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      intervalRef.current = setInterval(() => {
        const breakState = getStoredBreakState();
        if (!breakState) {
          setElapsedSeconds(calculateElapsedTimeFromStorage());
        }
      }, 1000);
      
      toast.success('Clocked in successfully');
      return data;
    } catch (error) {
      console.error('Error clocking in:', error);
      toast.error('Failed to clock in');
      throw error;
    }
  }, [employeeId]);

  // Clock out
  const clockOut = useCallback(async () => {
    if (!activeEntry) {
      toast.error('No active time entry found');
      return;
    }

    try {
      const clockOutTime = new Date();
      const clockIn = new Date(activeEntry.clock_in!);
      
      // Calculate total hours
      let totalMinutes = (clockOutTime.getTime() - clockIn.getTime()) / (1000 * 60);
      
      // Subtract break time if applicable
      if (activeEntry.break_start && activeEntry.break_end) {
        const breakStart = new Date(activeEntry.break_start);
        const breakEnd = new Date(activeEntry.break_end);
        const breakMinutes = (breakEnd.getTime() - breakStart.getTime()) / (1000 * 60);
        totalMinutes -= breakMinutes;
      }
      
      const totalHours = Math.round((totalMinutes / 60) * 100) / 100;
      
      await apiClient.post('/scheduler/time-clock/clock_out/', {
        employee_id: employeeId,
        time_clock_id: activeEntry.id
      });

      // Clear state and localStorage
      setActiveEntry(null);
      storeClockState(null);
      storeBreakState(null);
      setElapsedSeconds(0);
      setBreakElapsedSeconds(0);
      
      // Stop all timers
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (breakIntervalRef.current) {
        clearInterval(breakIntervalRef.current);
        breakIntervalRef.current = null;
      }
      if (breakNotificationRef.current) {
        clearTimeout(breakNotificationRef.current);
        breakNotificationRef.current = null;
      }
      
      toast.success(`Clocked out. Total: ${totalHours.toFixed(2)} hours`);
    } catch (error) {
      console.error('Error clocking out:', error);
      toast.error('Failed to clock out');
    }
  }, [activeEntry]);

  // Initial fetch when user changes
  useEffect(() => {
    fetchEmployeeData();
  }, [fetchEmployeeData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (breakIntervalRef.current) {
        clearInterval(breakIntervalRef.current);
      }
      if (breakNotificationRef.current) {
        clearTimeout(breakNotificationRef.current);
      }
    };
  }, []);

  // Check if currently clocked in (from localStorage - works without auth)
  const isClockedIn = (): boolean => {
    return getStoredClockState() !== null;
  };

  // Check if currently on break - check localStorage and validate activeEntry
  const isOnBreak = (): boolean => {
    const breakState = getStoredBreakState();
    if (breakState) return true;
    
    // Also check activeEntry for valid break state (break_start exists and is after break_end or break_end is null)
    if (activeEntry?.break_start && !activeEntry?.break_end) return true;
    if (activeEntry?.break_start && activeEntry?.break_end) {
      // Check if break_start is after break_end (corrupted data from previous cycle)
      const start = new Date(activeEntry.break_start);
      const end = new Date(activeEntry.break_end);
      if (start > end) return true; // Currently on a new break
    }
    
    return false;
  };

  // Get break time remaining
  const getBreakTimeRemaining = (): number => {
    const breakState = getStoredBreakState();
    if (!breakState) return 0;
    
    const breakEnd = new Date(breakState.breakStartTime).getTime() + breakState.breakDurationMinutes * 60 * 1000;
    const remaining = Math.max(0, Math.floor((breakEnd - new Date().getTime()) / 1000));
    return remaining;
  };

  return {
    activeEntry,
    employeeId,
    isLoading,
    elapsedSeconds,
    breakElapsedSeconds,
    elapsedTimeFormatted: formatElapsedTime(elapsedSeconds),
    breakTimeFormatted: formatElapsedTime(breakElapsedSeconds),
    clockIn,
    clockOut,
    startBreak,
    endBreak,
    refetch: fetchEmployeeData,
    isClockedIn,
    isOnBreak,
    getBreakTimeRemaining
  };
};
