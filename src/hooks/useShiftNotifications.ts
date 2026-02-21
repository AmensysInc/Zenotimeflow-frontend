import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import apiClient from "@/lib/api-client";
import { ensureArray } from "@/lib/utils";
import { parseISO, differenceInMinutes, isToday } from "date-fns";
import { toast } from "sonner";

interface Shift {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
}

const NOTIFICATION_SHOWN_KEY = 'shift_notifications_shown';

export const useShiftNotifications = () => {
  const { user } = useAuth();
  const [upcomingShift, setUpcomingShift] = useState<Shift | null>(null);
  const [shouldNotify, setShouldNotify] = useState(false);

  // Get already shown notifications from localStorage
  const getShownNotifications = useCallback((): string[] => {
    try {
      const stored = localStorage.getItem(NOTIFICATION_SHOWN_KEY);
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
      // Keep only last 50 notifications to avoid storage bloat
      const trimmed = shown.slice(-50);
      localStorage.setItem(NOTIFICATION_SHOWN_KEY, JSON.stringify(trimmed));
    }
  }, [getShownNotifications]);

  // Check if notification was already shown
  const wasNotificationShown = useCallback((shiftId: string): boolean => {
    const shown = getShownNotifications();
    return shown.includes(shiftId);
  }, [getShownNotifications]);

  // Request notification permission
  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }, []);

  // Send browser notification
  const sendBrowserNotification = useCallback((shift: Shift) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      const startTime = parseISO(shift.start_time);
      const timeStr = startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      new Notification('Shift Starting Soon!', {
        body: `Your shift starts at ${timeStr}. Please clock in soon.`,
        icon: '/lovable-uploads/dfd7bdde-fe82-4a7a-b7bd-d93fa625c987.png',
        tag: `shift-${shift.id}`,
        requireInteraction: true
      });
    }
  }, []);

  // Check for upcoming shifts
  const checkUpcomingShifts = useCallback(async () => {
    if (!user) return;

    try {
      // Get employee record for current user
      const rawEmployees = await apiClient.get<any>('/scheduler/employees/', { user: user.id });
      const employees = ensureArray(rawEmployees);
      const employee = employees[0];

      if (!employee) return;

      const now = new Date();
      const today = now.toISOString().split('T')[0];

      // Get today's shifts for this employee
      const rawShifts = await apiClient.get<any>('/scheduler/shifts/', {
        employee: employee.id,
        start_date: `${today}T00:00:00`,
        end_date: `${today}T23:59:59`
      });
      const shifts = ensureArray(rawShifts);

      if (shifts.length === 0) {
        setUpcomingShift(null);
        return;
      }

      // Find the next upcoming shift (not yet clocked in)
      for (const shift of shifts) {
        const startTime = parseISO(shift.start_time);
        const minutesUntilStart = differenceInMinutes(startTime, now);

        // Check if shift is within 5 minutes and hasn't been notified
        if (minutesUntilStart <= 5 && minutesUntilStart >= -10) {
          setUpcomingShift(shift);
          
          // Only notify if not already shown for this shift
          const notificationKey = `${shift.id}-${today}`;
          if (!wasNotificationShown(notificationKey) && minutesUntilStart <= 5 && minutesUntilStart >= 0) {
            setShouldNotify(true);
            markNotificationShown(notificationKey);
            
            // Show in-app toast
            toast.warning('Shift Starting Soon!', {
              description: `Your shift starts in ${Math.max(0, minutesUntilStart)} minutes. Please clock in.`,
              duration: 10000,
              action: {
                label: 'Go to Time Clock',
                onClick: () => {
                  window.location.href = '/scheduler/my-dashboard';
                }
              }
            });
            
            // Send browser notification
            sendBrowserNotification(shift);
          }
          return;
        }
      }

      setUpcomingShift(null);
    } catch (error) {
      console.error('Error checking upcoming shifts:', error);
    }
  }, [user, wasNotificationShown, markNotificationShown, sendBrowserNotification]);

  // Initial permission request and check
  useEffect(() => {
    requestNotificationPermission();
  }, [requestNotificationPermission]);

  // Check shifts every minute
  useEffect(() => {
    checkUpcomingShifts();
    
    const interval = setInterval(checkUpcomingShifts, 60000); // Check every minute
    
    return () => clearInterval(interval);
  }, [checkUpcomingShifts]);

  return { upcomingShift, shouldNotify };
};
