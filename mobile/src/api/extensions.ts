import { api } from './client';

function ensureArray<T>(raw: T | T[] | { results?: T[] }): T[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object' && 'results' in raw && Array.isArray((raw as any).results))
    return (raw as any).results;
  return [];
}

/** Current user (same as web GET /auth/user/) */
export async function getCurrentUser(): Promise<any> {
  return api.get('/auth/user/');
}

/** Calendar/events – tasks and events (same as web) */
export async function getCalendarEvents(params?: Record<string, any>): Promise<any[]> {
  const data = await api.get<any>('/calendar/events/', params);
  return ensureArray(data);
}

export async function createCalendarEvent(payload: any): Promise<any> {
  return api.post('/calendar/events/', payload);
}

export async function updateCalendarEvent(id: string, payload: any): Promise<any> {
  return api.patch(`/calendar/events/${id}/`, payload);
}

export async function deleteCalendarEvent(id: string): Promise<void> {
  await api.delete(`/calendar/events/${id}/`);
}

/** Focus sessions */
export async function getFocusSessions(params?: Record<string, any>): Promise<any[]> {
  const data = await api.get<any>('/focus/sessions/', params);
  return ensureArray(data);
}

export async function createFocusSession(payload: any): Promise<any> {
  return api.post('/focus/sessions/', payload);
}

export async function updateFocusSession(id: string, payload: any): Promise<any> {
  return api.patch(`/focus/sessions/${id}/`, payload);
}

/** Habits */
export async function getHabits(params?: Record<string, any>): Promise<any[]> {
  const data = await api.get<any>('/habits/habits/', params);
  return ensureArray(data);
}

export async function getHabitCompletions(params?: Record<string, any>): Promise<any[]> {
  const data = await api.get<any>('/habits/completions/', params);
  return ensureArray(data);
}

export async function createHabit(payload: any): Promise<any> {
  return api.post('/habits/habits/', payload);
}

export async function updateHabit(id: string, payload: any): Promise<any> {
  return api.patch(`/habits/habits/${id}/`, payload);
}

export async function deleteHabit(id: string): Promise<void> {
  await api.delete(`/habits/habits/${id}/`);
}

export async function createHabitCompletion(payload: any): Promise<any> {
  return api.post('/habits/completions/', payload);
}

export async function updateHabitCompletion(id: string, payload: any): Promise<any> {
  return api.patch(`/habits/completions/${id}/`, payload);
}

/** Scheduler – shifts (employee filter or company + date range for schedule) */
export async function getShifts(params: Record<string, any>): Promise<any[]> {
  const data = await api.get<any>('/scheduler/shifts/', params);
  return ensureArray(data);
}

export async function createShift(payload: any): Promise<any> {
  const body: any = { ...payload };
  if (body.employee_id) { body.employee = body.employee_id; delete body.employee_id; }
  if (body.company_id) { body.company = body.company_id; delete body.company_id; }
  return api.post<any>('/scheduler/shifts/', body);
}

export async function updateShift(id: string, payload: any): Promise<any> {
  const body: any = { ...payload };
  if (body.employee_id !== undefined) { body.employee = body.employee_id; delete body.employee_id; }
  if (body.company_id !== undefined) { body.company = body.company_id; delete body.company_id; }
  return api.patch<any>(`/scheduler/shifts/${id}/`, body);
}

export async function deleteShift(id: string): Promise<void> {
  return api.delete(`/scheduler/shifts/${id}/`);
}

/** Scheduler – time clock (you may already have these in your existing app) */
export async function getTimeClockEntries(params: Record<string, any>): Promise<any[]> {
  const data = await api.get<any>('/scheduler/time-clock/', params);
  return ensureArray(data);
}

/** Scheduler – employees (current user's employee record or filtered by company) */
export async function getEmployees(params?: Record<string, any>): Promise<any[]> {
  const data = await api.get<any>('/scheduler/employees/', params || {});
  return ensureArray(data);
}

/** Scheduler – companies (admin) */
export async function getCompanies(params?: Record<string, any>): Promise<any[]> {
  const data = await api.get<any>('/scheduler/companies/', params || {});
  return ensureArray(data);
}

export async function createCompany(payload: any): Promise<any> {
  return api.post('/scheduler/companies/', payload);
}

/** Scheduler – organizations (super_admin) */
export async function getOrganizations(params?: Record<string, any>): Promise<any[]> {
  const data = await api.get<any>('/scheduler/organizations/', params || {});
  return ensureArray(data);
}

export async function createOrganization(payload: any): Promise<any> {
  return api.post('/scheduler/organizations/', payload);
}


/** Time clock entry shape (matches Zeno_Time_Flow / backend) */
export interface TimeClockEntry {
  id: string;
  employee_id?: string;
  shift_id?: string | null;
  clock_in: string | null;
  clock_out: string | null;
  break_start: string | null;
  break_end: string | null;
  total_hours: number | null;
  created_at?: string;
  updated_at?: string;
}

/** Time clock – clock in/out and breaks (same backend as web / Zeno_Time_Flow) */
export async function clockIn(employeeId: string, shiftId?: string): Promise<TimeClockEntry> {
  const body: { employee_id: string; shift_id?: string } = { employee_id: employeeId };
  if (shiftId) body.shift_id = shiftId;
  return api.post<TimeClockEntry>('/scheduler/time-clock/clock_in/', body);
}

export async function clockOut(employeeId: string, timeClockId: string): Promise<TimeClockEntry> {
  return api.post<TimeClockEntry>(`/scheduler/time-clock/clock_out/`, {
    employee_id: employeeId,
    time_clock_id: timeClockId,
  });
}

export async function startBreak(entryId: string): Promise<any> {
  return api.post(`/scheduler/time-clock/${entryId}/start_break/`, {});
}

export async function endBreak(entryId: string): Promise<any> {
  return api.post(`/scheduler/time-clock/${entryId}/end_break/`, {});
}
