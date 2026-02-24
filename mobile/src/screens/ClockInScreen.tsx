import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import DailyReportScreen from './DailyReportScreen';
import WeeklyReportScreen from './WeeklyReportScreen';
import { Shift } from '../storage/shiftStorage';
import {
  getShifts,
  getTimeClockEntries,
  clockIn as apiClockIn,
  clockOut as apiClockOut,
  startBreak as apiStartBreak,
  endBreak as apiEndBreak,
  TimeClockEntry,
} from '../api/extensions';

function useLiveTime() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((n) => n.toString().padStart(2, '0')).join(':');
}

function formatDurationShort(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  if (m > 0) return `${m}m`;
  return `${seconds}s`;
}

function parseMs(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return isNaN(t) ? null : t;
}

export default function ClockInScreen() {
  const { logout, employee } = useAuth();
  const [activeEntry, setActiveEntry] = useState<TimeClockEntry | null>(null);
  const [entries, setEntries] = useState<TimeClockEntry[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [clockInTime, setClockInTime] = useState<number | null>(null);
  const [breakStartTime, setBreakStartTime] = useState<number | null>(null);
  const [breakEndTime, setBreakEndTime] = useState<number | null>(null);
  const [clockOutTime, setClockOutTime] = useState<number | null>(null);
  const [workTimeBeforeBreak, setWorkTimeBeforeBreak] = useState(0);
  const [totalBreakTime, setTotalBreakTime] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [breakDuration, setBreakDuration] = useState(0);
  const [showDailyReport, setShowDailyReport] = useState(false);
  const [showWeeklyReport, setShowWeeklyReport] = useState(false);
  const [weeklyShifts, setWeeklyShifts] = useState<Shift[]>([]);
  const now = useLiveTime();

  const fetchData = useCallback(async () => {
    if (!employee?.id) return;
    try {
      const [shiftList, entryList] = await Promise.all([
        getShifts({ employee: employee.id }),
        getTimeClockEntries({ employee: employee.id }),
      ]);
      setShifts(Array.isArray(shiftList) ? shiftList : []);
      const list = Array.isArray(entryList) ? entryList : [];
      setEntries(list);
      const active = list.find((e: TimeClockEntry) => e.clock_in && !e.clock_out) || null;
      setActiveEntry(active);
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      if (active) {
        setClockInTime(parseMs(active.clock_in));
        setClockOutTime(parseMs(active.clock_out));
        setBreakStartTime(parseMs(active.break_start));
        setBreakEndTime(parseMs(active.break_end));
        const ci = parseMs(active.clock_in) || 0;
        const co = parseMs(active.clock_out);
        const bs = parseMs(active.break_start);
        const be = parseMs(active.break_end);
        let breakSec = 0;
        if (bs && be) breakSec = Math.floor((be - bs) / 1000);
        if (co) {
          setElapsed(Math.max(0, Math.floor((co - ci) / 1000) - breakSec));
          setTotalBreakTime(breakSec);
        } else {
          setTotalBreakTime(breakSec);
          setElapsed(Math.max(0, Math.floor((Date.now() - ci) / 1000) - breakSec));
        }
      } else {
        const lastClosed = list
          .filter((e: TimeClockEntry) => e.clock_out && parseMs(e.clock_in) !== null && parseMs(e.clock_in)! >= todayStart.getTime() && parseMs(e.clock_out)! <= todayEnd.getTime())
          .sort((a: TimeClockEntry, b: TimeClockEntry) => (parseMs(b.clock_out) || 0) - (parseMs(a.clock_out) || 0))[0];
        if (lastClosed) {
          const ci = parseMs(lastClosed.clock_in) || 0;
          const co = parseMs(lastClosed.clock_out) || 0;
          const bs = parseMs(lastClosed.break_start);
          const be = parseMs(lastClosed.break_end);
          let breakSec = 0;
          if (bs && be) breakSec = Math.floor((be - bs) / 1000);
          setClockInTime(ci);
          setClockOutTime(co ?? null);
          setBreakStartTime(bs);
          setBreakEndTime(be);
          setElapsed(Math.max(0, Math.floor((co! - ci) / 1000) - breakSec));
          setTotalBreakTime(breakSec);
        } else {
          setClockInTime(null);
          setClockOutTime(null);
          setBreakStartTime(null);
          setBreakEndTime(null);
          setElapsed(0);
          setTotalBreakTime(0);
        }
      }
    } catch (e) {
      console.warn('Fetch time clock failed:', e);
    } finally {
      setLoading(false);
    }
  }, [employee?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!clockInTime || clockOutTime) return;
    if (breakStartTime && !breakEndTime) {
      const tick = () => setBreakDuration(Math.floor((Date.now() - breakStartTime) / 1000));
      tick();
      const interval = setInterval(tick, 1000);
      return () => clearInterval(interval);
    } else {
      const tick = () => {
        let workSeconds = Math.floor((Date.now() - clockInTime) / 1000);
        if (totalBreakTime > 0) workSeconds -= totalBreakTime;
        setElapsed(workSeconds);
      };
      tick();
      const interval = setInterval(tick, 1000);
      return () => clearInterval(interval);
    }
  }, [clockInTime, breakStartTime, breakEndTime, clockOutTime, totalBreakTime]);

  const handleClockIn = async (shiftId?: string) => {
    if (!employee?.id) return;
    setActionLoading(true);
    try {
      const entry = await apiClockIn(employee.id, shiftId);
      const clockInMs = entry?.clock_in ? parseMs(entry.clock_in) : null;
      if (entry?.id && clockInMs != null) {
        const normalized: TimeClockEntry = {
          id: entry.id,
          employee_id: (entry as any).employee ?? employee.id,
          shift_id: (entry as any).shift ?? undefined,
          clock_in: entry.clock_in,
          clock_out: entry.clock_out ?? null,
          break_start: entry.break_start ?? null,
          break_end: entry.break_end ?? null,
          total_hours: entry.total_hours ?? null,
        };
        setActiveEntry(normalized);
        setClockInTime(clockInMs);
        setClockOutTime(null);
        setBreakStartTime(null);
        setBreakEndTime(null);
        setElapsed(0);
        setTotalBreakTime(0);
        setEntries((prev) => [normalized, ...prev]);
      } else {
        await fetchData();
      }
    } catch (err: any) {
      Alert.alert('Clock in failed', err?.message || 'Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartBreak = async () => {
    if (!activeEntry) return;
    setWorkTimeBeforeBreak(elapsed);
    setActionLoading(true);
    try {
      await apiStartBreak(activeEntry.id);
      await fetchData();
    } catch (err: any) {
      Alert.alert('Break failed', err?.message || 'Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEndBreak = async () => {
    if (!activeEntry) return;
    setActionLoading(true);
    try {
      const entry = await apiEndBreak(activeEntry.id);
      const normalized: TimeClockEntry = {
        id: entry.id,
        employee_id: (entry as any).employee ?? employee?.id,
        shift_id: (entry as any).shift ?? undefined,
        clock_in: entry.clock_in,
        clock_out: entry.clock_out ?? null,
        break_start: entry.break_start ?? null,
        break_end: entry.break_end ?? null,
        total_hours: entry.total_hours ?? null,
      };
      setActiveEntry(normalized);
      const breakEndMs = entry?.break_end ? parseMs(entry.break_end) : null;
      if (breakEndMs != null) {
        setBreakEndTime(breakEndMs);
        if (breakStartTime) {
          const breakSec = Math.floor((breakEndMs - breakStartTime) / 1000);
          setTotalBreakTime((prev) => prev + breakSec);
        }
      }
      setEntries((prev) => prev.map((e) => (e.id === entry.id ? normalized : e)));
    } catch (err: any) {
      Alert.alert('End break failed', err?.message || 'Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!activeEntry || !employee?.id) return;
    setActionLoading(true);
    try {
      await apiClockOut(employee.id, activeEntry.id);
      await fetchData();
    } catch (err: any) {
      Alert.alert('Clock out failed', err?.message || 'Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleClockInNewShift = async () => {
    await logout();
  };

  const totalWorkTime = !clockInTime
    ? 0
    : clockOutTime
    ? elapsed
    : breakStartTime && !breakEndTime
    ? workTimeBeforeBreak
    : elapsed;

  useEffect(() => {
    if (showDailyReport && employee?.id) fetchData();
  }, [showDailyReport]);

  useEffect(() => {
    if (!showWeeklyReport || !employee?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const entryList = await getTimeClockEntries({ employee: employee.id });
        const list = Array.isArray(entryList) ? entryList : [];
        const now = new Date();
        const weekStart = new Date(now);
        const day = weekStart.getDay();
        const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1);
        weekStart.setDate(diff);
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        const startMs = weekStart.getTime();
        const endMs = weekEnd.getTime();
        const inWeek = list.filter((e: TimeClockEntry) => {
          const ms = parseMs(e.clock_in);
          return ms != null && ms >= startMs && ms <= endMs;
        });
        const shiftMap = new Map<string, { clockIn: number; clockOut: number; workSec: number; breakSec: number }>();
        inWeek.forEach((e: TimeClockEntry) => {
          const ci = parseMs(e.clock_in) || 0;
          const co = parseMs(e.clock_out);
          const bs = parseMs(e.break_start);
          const be = parseMs(e.break_end);
          const dateKey = new Date(ci).toISOString().slice(0, 10);
          let breakSec = 0;
          if (bs && be) breakSec = Math.floor((be - bs) / 1000);
          const workSec = e.total_hours != null && Number(e.total_hours) > 0
            ? Math.round(Number(e.total_hours) * 3600)
            : Math.max(0, Math.floor(((co || Date.now()) - ci) / 1000) - breakSec);
          const existing = shiftMap.get(dateKey);
          if (existing) {
            existing.workSec += workSec;
            existing.breakSec += breakSec;
            if (ci < existing.clockIn) existing.clockIn = ci;
            if (co && (!existing.clockOut || co > existing.clockOut)) existing.clockOut = co;
          } else {
            shiftMap.set(dateKey, { clockIn: ci, clockOut: co || Date.now(), workSec, breakSec });
          }
        });
        const shiftsForWeek: Shift[] = Array.from(shiftMap.entries()).map(([date, v]) => ({
          id: date,
          date,
          clockIn: v.clockIn,
          clockOut: v.clockOut,
          workTimeSeconds: v.workSec,
          breakTimeSeconds: v.breakSec,
        }));
        if (!cancelled) setWeeklyShifts(shiftsForWeek);
      } catch (_) {
        if (!cancelled) setWeeklyShifts([]);
      }
    })();
    return () => { cancelled = true; };
  }, [showWeeklyReport, employee?.id]);

  if (!employee) {
    return (
      <View style={[styles.container, styles.noEmployeeContainer]}>
        <View style={styles.noEmployeeCard}>
          <Text style={styles.noEmployeeTitle}>No Employee Record</Text>
          <Text style={styles.noEmployeeText}>Your account is not linked to an employee. Use the web app to clock in or contact your admin.</Text>
          <TouchableOpacity style={styles.noEmployeeLogoutBtn} onPress={logout}>
            <Text style={styles.noEmployeeLogoutText}>Sign out</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (showWeeklyReport) {
    return (
      <WeeklyReportScreen
        shifts={weeklyShifts}
        employeeName={(employee as any)?.full_name ?? (employee as any)?.first_name ? `${(employee as any).first_name} ${(employee as any).last_name}` : undefined}
        companyName={(employee as any)?.company_name ?? undefined}
        onBack={() => setShowWeeklyReport(false)}
      />
    );
  }

  if (showDailyReport) {
    const reportClockInTime = clockInTime || Date.now();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    let todayEntriesList = entries.filter((e: TimeClockEntry) => {
      const ms = parseMs(e.clock_in);
      return ms != null && ms >= todayStart.getTime() && ms <= todayEnd.getTime();
    });
    if (todayEntriesList.length === 0 && clockInTime) {
      todayEntriesList = [{
        id: 'current',
        clock_in: new Date(clockInTime).toISOString(),
        clock_out: clockOutTime ? new Date(clockOutTime).toISOString() : null,
        break_start: breakStartTime ? new Date(breakStartTime).toISOString() : null,
        break_end: breakEndTime ? new Date(breakEndTime).toISOString() : null,
        total_hours: null,
      }];
    }
    return (
      <DailyReportScreen
        clockInTime={reportClockInTime}
        clockOutTime={clockOutTime}
        breakStartTime={breakStartTime}
        breakEndTime={breakEndTime}
        totalWorkTime={totalWorkTime}
        totalBreakTime={totalBreakTime}
        todayEntries={todayEntriesList.length > 0 ? todayEntriesList : undefined}
        employeeName={(employee as any)?.full_name ?? ((employee as any)?.first_name ? `${(employee as any).first_name} ${(employee as any).last_name}` : undefined)}
        employeePosition={(employee as any)?.position}
        companyName={(employee as any)?.company_name ?? undefined}
        onBack={() => setShowDailyReport(false)}
        onViewWeekly={() => setShowWeeklyReport(true)}
      />
    );
  }

  const displayName = (employee as any)?.full_name ?? ((employee as any)?.first_name ? `${(employee as any).first_name} ${(employee as any).last_name}` : 'Employee');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{(employee as any)?.company_name ?? 'Zeno Time Flow'}</Text>
          <Text style={styles.headerSub}>Employee Time Clock System</Text>
        </View>

        <View style={styles.datetime}>
          <Text style={styles.date}>{formatDate(now)}</Text>
          <Text style={styles.time}>{formatTime(now)}</Text>
        </View>

        <View style={styles.body}>
          <View style={styles.employeeInfo}>
            <Text style={styles.employeeName}>
              {clockOutTime ? `Great work today, ${(employee as any).first_name || (employee as any).full_name || '!'}` : `Welcome, ${displayName}`}
            </Text>
            <Text style={styles.employeeMeta}>Position: {(employee as any).position || 'Employee'}</Text>
            <Text style={styles.employeeMeta}>Employee ID: {employee.id.slice(0, 8)}</Text>
          </View>

          {!clockInTime ? (
            <>
              <View style={[styles.statusBox, styles.statusReady]}>
                <Text style={styles.statusTitle}>Ready to Clock In</Text>
                <Text style={styles.statusHint}>Please clock in to start your shift</Text>
              </View>

              <TouchableOpacity style={[styles.btn, styles.btnClockIn]} onPress={() => handleClockIn()} disabled={actionLoading}>
                <Text style={styles.btnText}>{actionLoading ? '…' : 'Clock In'}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.btn, styles.btnViewReport]} onPress={() => setShowDailyReport(true)}>
                <Text style={styles.btnText}>View Reports</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.btn, styles.btnLogout]} onPress={logout}>
                <Text style={styles.btnText}>Logout</Text>
              </TouchableOpacity>
            </>
          ) : clockOutTime ? (
            <>
              <View style={[styles.statusBox, styles.statusClockedOut]}>
                <Text style={styles.statusTitle}>STATUS: CLOCKED OUT</Text>
                <Text style={styles.statusTime}>{formatDuration(elapsed)}</Text>
                <Text style={styles.statusHint}>Total hours worked today</Text>
              </View>

              <View style={styles.summaryBox}>
                <Text style={styles.summaryTitle}>Today's Summary</Text>
                <View style={styles.summaryGrid}>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Clock In:</Text>
                    <Text style={styles.summaryValue}>{clockInTime ? formatTime(clockInTime) : '—'}</Text>
                  </View>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Clock Out:</Text>
                    <Text style={styles.summaryValue}>{formatTime(clockOutTime)}</Text>
                  </View>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Work Time:</Text>
                    <Text style={styles.summaryValue}>{formatDurationShort(elapsed)}</Text>
                  </View>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Break Time:</Text>
                    <Text style={styles.summaryValue}>{formatDurationShort(totalBreakTime)}</Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity style={[styles.btn, styles.btnClockIn]} onPress={() => handleClockIn()} disabled={actionLoading}>
                <Text style={styles.btnText}>{actionLoading ? '…' : 'Clock In Again'}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.btn, styles.btnViewReport]} onPress={() => setShowDailyReport(true)}>
                <Text style={styles.btnText}>View Full History</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.btn, styles.btnLogout]} onPress={handleClockInNewShift}>
                <Text style={styles.btnText}>Logout</Text>
              </TouchableOpacity>

              <View style={styles.successOut}>
                <Text style={styles.successOutText}>
                  Clocked out successfully at {formatTime(clockOutTime)}{'\n'}
                  <Text style={styles.successOutSmall}>Have a great evening!</Text>
                </Text>
              </View>
            </>
          ) : breakStartTime && !breakEndTime ? (
            <>
              <View style={[styles.statusBox, styles.statusOnBreak]}>
                <Text style={styles.statusTitle}>STATUS: ON BREAK</Text>
                <Text style={styles.statusTime}>{formatDuration(breakDuration)}</Text>
                <Text style={styles.statusHint}>Break duration</Text>
              </View>

              <View style={styles.breakNote}>
                <Text style={styles.breakNoteText}>
                  <Text style={styles.breakNoteBold}>Total Work Time Today:</Text> {formatDurationShort(workTimeBeforeBreak)}{'\n'}
                  <Text style={styles.breakNoteBold}>Break Started:</Text> {breakStartTime ? formatTime(breakStartTime) : '—'}
                </Text>
              </View>

              <TouchableOpacity style={[styles.btn, styles.btnEndBreak]} onPress={handleEndBreak} disabled={actionLoading}>
                <Text style={styles.btnText}>{actionLoading ? '…' : 'End Break'}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.btn, styles.btnLogout]} onPress={logout}>
                <Text style={styles.btnText}>Logout</Text>
              </TouchableOpacity>

              <View style={styles.successBreak}>
                <Text style={styles.successBreakText}>Break started at {breakStartTime ? formatTime(breakStartTime) : '—'}</Text>
              </View>
            </>
          ) : (
            <>
              <View style={[styles.statusBox, styles.statusClockedIn]}>
                <Text style={styles.statusTitle}>STATUS: CLOCKED IN</Text>
                <Text style={styles.statusTime}>{formatDuration(elapsed)}</Text>
                <Text style={styles.statusHint}>Hours worked today</Text>
              </View>

              <View style={styles.buttonGrid}>
                <TouchableOpacity style={[styles.btn, styles.btnBreak]} onPress={handleStartBreak} disabled={actionLoading}>
                  <Text style={styles.btnBreakText}>{actionLoading ? '…' : 'Start Break'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, styles.btnClockOut]} onPress={handleClockOut} disabled={actionLoading}>
                  <Text style={styles.btnText}>{actionLoading ? '…' : 'Clock Out'}</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={[styles.btn, styles.btnLogout]} onPress={logout}>
                <Text style={styles.btnText}>Logout</Text>
              </TouchableOpacity>

              <View style={styles.success}>
                <Text style={styles.successText}>Clocked in successfully at {clockInTime ? formatTime(clockInTime) : '—'}</Text>
              </View>
            </>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Zeno Time Flow</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  centered: { justifyContent: 'center', alignItems: 'center', padding: 24 },
  noEmployeeContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  noEmployeeCard: { backgroundColor: '#f8fafc', borderRadius: 12, padding: 24, maxWidth: 340, borderWidth: 1, borderColor: '#e2e8f0' },
  noEmployeeTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 8, textAlign: 'center' },
  noEmployeeText: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  noEmployeeLogoutBtn: { backgroundColor: '#0f172a', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8, alignItems: 'center' },
  noEmployeeLogoutText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  content: { padding: 24, paddingBottom: 48 },
  card: { backgroundColor: '#ffffff', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0' },
  header: { backgroundColor: '#f8fafc', padding: 20, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  headerTitle: { color: '#0f172a', fontSize: 22, fontWeight: '700', marginBottom: 4 },
  headerSub: { color: '#64748b', fontSize: 13 },
  datetime: { backgroundColor: '#ffffff', padding: 16, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  date: { fontSize: 14, color: '#64748b', marginBottom: 4 },
  time: { fontSize: 28, fontWeight: '700', color: '#0f172a', fontVariant: ['tabular-nums'] },
  body: { padding: 20 },
  employeeInfo: { backgroundColor: '#f8fafc', padding: 16, borderRadius: 12, marginBottom: 20, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  employeeName: { color: '#0f172a', fontSize: 18, fontWeight: '700', marginBottom: 4 },
  employeeMeta: { color: '#64748b', fontSize: 13, marginTop: 2 },
  statusBox: { padding: 15, borderRadius: 12, alignItems: 'center', marginBottom: 20, borderWidth: 2 },
  statusReady: { backgroundColor: '#f8fafc', borderColor: '#0f172a' },
  statusClockedIn: { backgroundColor: '#ecfdf5', borderColor: '#22c55e' },
  statusOnBreak: { backgroundColor: '#fffbeb', borderColor: '#f59e0b' },
  statusClockedOut: { backgroundColor: '#fef2f2', borderColor: '#ef4444' },
  statusTitle: { fontSize: 13, fontWeight: '600', marginBottom: 5, color: '#0f172a' },
  statusTime: { fontSize: 22, fontWeight: '700', fontVariant: ['tabular-nums'], color: '#0f172a' },
  statusHint: { fontSize: 11, marginTop: 5, color: '#64748b' },
  breakNote: { backgroundColor: '#fffbeb', padding: 12, borderRadius: 12, marginBottom: 15, borderLeftWidth: 4, borderLeftColor: '#f59e0b' },
  breakNoteText: { fontSize: 12, color: '#92400e', margin: 0 },
  breakNoteBold: { fontWeight: '700' },
  buttonGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 20, justifyContent: 'space-between', width: '100%' },
  btn: { padding: 15, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flex: 1, minWidth: '45%', marginHorizontal: 6, minHeight: 50 },
  btnClockIn: { backgroundColor: '#22c55e', flexBasis: '100%' },
  btnBreak: { backgroundColor: '#f59e0b' },
  btnClockOut: { backgroundColor: '#ef4444' },
  btnLogout: { backgroundColor: '#64748b', marginTop: 12, marginHorizontal: 0, width: '100%' },
  btnEndBreak: { backgroundColor: '#06b6d4', marginBottom: 12, marginHorizontal: 0, width: '100%' },
  btnViewReport: { backgroundColor: '#64748b', marginTop: 12, marginHorizontal: 0, width: '100%' },
  summaryBox: { backgroundColor: '#f8fafc', padding: 15, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#e2e8f0' },
  summaryTitle: { color: '#0f172a', fontSize: 14, fontWeight: '700', marginBottom: 10, textAlign: 'center' },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  summaryItem: { width: '48%', marginBottom: 10 },
  summaryLabel: { color: '#64748b', fontSize: 12, fontWeight: '600', marginBottom: 4 },
  summaryValue: { color: '#0f172a', fontSize: 12 },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  btnBreakText: { color: '#0f172a', fontSize: 14, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  success: { backgroundColor: '#ecfdf5', padding: 15, borderRadius: 12, marginTop: 15, borderWidth: 1, borderColor: '#22c55e' },
  successText: { color: '#166534', fontWeight: '600', textAlign: 'center' },
  successBreak: { backgroundColor: '#fffbeb', padding: 15, borderRadius: 12, marginTop: 15, borderWidth: 1, borderColor: '#f59e0b' },
  successBreakText: { color: '#92400e', fontWeight: '600', textAlign: 'center' },
  successOut: { backgroundColor: '#fef2f2', padding: 15, borderRadius: 12, marginTop: 15, borderWidth: 1, borderColor: '#ef4444' },
  successOutText: { color: '#991b1b', fontWeight: '600', textAlign: 'center' },
  successOutSmall: { fontSize: 12 },
  footer: { backgroundColor: '#f8fafc', padding: 12, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  footerText: { fontSize: 11, color: '#94a3b8' },
});
