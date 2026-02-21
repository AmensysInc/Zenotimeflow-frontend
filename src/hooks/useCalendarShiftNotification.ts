import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import apiClient from "@/lib/api-client";
import { parseISO, differenceInMinutes, isToday } from "date-fns";
import { usePersistentTimeClock } from "@/hooks/usePersistentTimeClock";

interface Shift {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
}

const CALENDAR_NOTIFICATION_KEY = 'calendar_shift_notifications_shown';
const CALENDAR_DISMISSED_KEY = 'calendar_shift_dismissed';

export const useCalendarShiftNotification = () => {
  const { user } = useAuth();
  const { clockIn, activeEntry } = usePersistentTimeClock();
  const [upcomingShift, setUpcomingShift] = useState<Shift | null>(null);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationShift, setNotificationShift] = useState<Shift | null>(null);
  const [dismissedShift, setDismissedShift] = useState<Shift | null>(null);

  // Get already shown notifications from localStorage
  const getShownNotifications = useCallback((): string[] => {
    try {
      const stored = localStorage.getItem(CALENDAR_NOTIFICATION_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }, []);

  // Mark notification as shown
  const markNotificationShown = useCallback((shiftId: string) => {
    const shown = getShownNotifications();
    if (!shown.includes(shiftId)) {
      shown.push(shiftId);
      // Keep only last 50 notifications
      const trimmed = shown.slice(-50);
      localStorage.setItem(CALENDAR_NOTIFICATION_KEY, JSON.stringify(trimmed));
    }
  }, [getShownNotifications]);

  // Check if notification was already shown
  const wasNotificationShown = useCallback((shiftId: string): boolean => {
    const shown = getShownNotifications();
    return shown.includes(shiftId);
  }, [getShownNotifications]);

  // Start shift handler
  const startShift = useCallback(async (): Promise<boolean> => {
    if (notificationShift) {
      try {
        await clockIn(notificationShift.id);
        setShowNotification(false);
        setNotificationShift(null);
        return true;
      } catch (error) {
        console.error('Error starting shift:', error);
        return false;
      }
    }
    return false;
  }, [notificationShift, clockIn]);

  // Dismiss notification - keeps the shift info for the banner
  const dismissNotification = useCallback(() => {
    setShowNotification(false);
    if (notificationShift) {
      markNotificationShown(`${notificationShift.id}-dismissed`);
      setDismissedShift(notificationShift);
      // Store in localStorage for persistence
      localStorage.setItem(CALENDAR_DISMISSED_KEY, JSON.stringify(notificationShift));
    }
  }, [notificationShift, markNotificationShown]);

  // Clear dismissed shift (when starting shift or shift time passes)
  const clearDismissedShift = useCallback(() => {
    setDismissedShift(null);
    localStorage.removeItem(CALENDAR_DISMISSED_KEY);
  }, []);

  // Load dismissed shift from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CALENDAR_DISMISSED_KEY);
      if (stored) {
        const shift = JSON.parse(stored);
        const now = new Date();
        const shiftStart = parseISO(shift.start_time);
        const minutesPassed = differenceInMinutes(now, shiftStart);
        
        // Only restore if shift hasn't started more than 30 minutes ago
        if (minutesPassed < 30) {
          setDismissedShift(shift);
        } else {
          localStorage.removeItem(CALENDAR_DISMISSED_KEY);
        }
      }
    } catch {
      localStorage.removeItem(CALENDAR_DISMISSED_KEY);
    }
  }, []);

  // Start shift from banner
  const startShiftFromBanner = useCallback(async (): Promise<boolean> => {
    // Banner can be shown for either a dismissed notification shift OR an upcoming shift.
    // If the modal wasn't shown (or was already shown), we still need to clock in from the banner.
    const shiftToStart = dismissedShift || notificationShift || upcomingShift;
    if (shiftToStart) {
      try {
        await clockIn(shiftToStart.id);
        clearDismissedShift();
        setUpcomingShift(null);
        setShowNotification(false);
        setNotificationShift(null);
        return true;
      } catch (error) {
        console.error('Error starting shift:', error);
        return false;
      }
    }
    return false;
  }, [dismissedShift, notificationShift, upcomingShift, clockIn, clearDismissedShift]);

  // Check for upcoming shifts
  const checkUpcomingShifts = useCallback(async () => {
    if (!user) return;
    
    // If already clocked in, clear any upcoming shift state
    if (activeEntry) {
      setUpcomingShift(null);
      setNotificationShift(null);
      setShowNotification(false);
      return;
    }

    try {
      // Get employee record for current user
      const employees = await apiClient.get<any[]>('/scheduler/employees/', { user: user.id });
      const employee = employees?.[0];

      if (!employee) {
        console.log('No employee record found for user');
        return;
      }

      const now = new Date();
      const today = now.toISOString().split('T')[0];

      // Get today's shifts for this employee
      const shifts = await apiClient.get<Shift[]>('/scheduler/shifts/', {
        employee: employee.id,
        start_date: `${today}T00:00:00`,
        end_date: `${today}T23:59:59`
      });

      if (!shifts || shifts.length === 0) {
        console.log('No shifts found for today');
        setUpcomingShift(null);
        return;
      }

      console.log('Found shifts for today:', shifts.length, 'Current time:', now.toISOString());

      // Find the next upcoming shift: notification bar 15 minutes before; banner stays up to 15 min after start
      for (const shift of shifts) {
        const startTime = parseISO(shift.start_time);
        const minutesUntilStart = differenceInMinutes(startTime, now);

        // Banner appears 15 minutes before shift starts and stays visible up to 15 minutes after start
        if (minutesUntilStart <= 15 && minutesUntilStart >= -15) {
          setUpcomingShift(shift);
          const notificationKey = `${shift.id}-${today}`;
          const dismissedKey = `${shift.id}-dismissed`;
          // Show notification modal 15 minutes before shift start (not after)
          if (minutesUntilStart <= 15 && minutesUntilStart > 0) {
            if (!wasNotificationShown(notificationKey) && !wasNotificationShown(dismissedKey)) {
              setShowNotification(true);
              setNotificationShift(shift);
              markNotificationShown(notificationKey);
            }
          }
          return;
        }
      }

      console.log('No upcoming shifts within the time window');
      setUpcomingShift(null);
    } catch (error) {
      console.error('Error checking upcoming shifts:', error);
    }
  }, [user, activeEntry, wasNotificationShown, markNotificationShown]);

  // Check shifts every 30 seconds
  useEffect(() => {
    checkUpcomingShifts();
    
    const interval = setInterval(checkUpcomingShifts, 30000);
    
    return () => clearInterval(interval);
  }, [checkUpcomingShifts]);

  return { 
    upcomingShift, 
    showNotification, 
    notificationShift,
    dismissedShift,
    startShift, 
    startShiftFromBanner,
    dismissNotification,
    clearDismissedShift
  };
};
