import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}`;
  return `0:${m.toString().padStart(2, '0')}`;
}

function formatDurationShort(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  if (m > 0) return `${m}m`;
  return `${seconds}s`;
}

interface TimeEvent {
  type: 'clock_in' | 'break_start' | 'break_end' | 'clock_out';
  timestamp: number;
  label: string;
  subLabel: string;
  isBreak: boolean;
}

export interface TodayEntry {
  id: string;
  clock_in: string | null;
  clock_out: string | null;
  break_start: string | null;
  break_end: string | null;
  total_hours: number | null;
}

function parseMs(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return isNaN(t) ? null : t;
}

interface DailyReportScreenProps {
  clockInTime: number;
  clockOutTime: number | null;
  breakStartTime: number | null;
  breakEndTime: number | null;
  totalWorkTime: number;
  totalBreakTime: number;
  todayEntries?: TodayEntry[];
  employeeName?: string;
  employeePosition?: string;
  companyName?: string;
  onBack: () => void;
  onViewWeekly: () => void;
}

export default function DailyReportScreen({
  clockInTime,
  clockOutTime,
  breakStartTime,
  breakEndTime,
  totalWorkTime,
  totalBreakTime,
  todayEntries = [],
  employeeName,
  employeePosition,
  companyName,
  onBack,
  onViewWeekly,
}: DailyReportScreenProps) {
  const displayName = employeeName ?? 'Employee';
  const displayPosition = employeePosition ?? 'Employee';
  const displayCompany = companyName ?? 'Zeno Time Flow';
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!clockInTime || clockOutTime) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [clockInTime, clockOutTime]);

  const useTodayEntries = todayEntries.length > 0;
  let reportTotalWorkSeconds = totalWorkTime;
  let reportTotalBreakSeconds = totalBreakTime;
  if (useTodayEntries) {
    let workSec = 0;
    let breakSec = 0;
    const now = Date.now();
    todayEntries.forEach((entry) => {
      const ci = parseMs(entry.clock_in);
      const co = parseMs(entry.clock_out);
      const bs = parseMs(entry.break_start);
      const be = parseMs(entry.break_end);
      if (!ci) return;
      let entryBreak = 0;
      if (bs && be) entryBreak = Math.floor((be - bs) / 1000);
      else if (bs && !be) entryBreak = Math.floor((now - bs) / 1000);
      breakSec += entryBreak;
      const th = entry.total_hours != null ? Number(entry.total_hours) : null;
      if (th != null && th > 0) {
        workSec += Math.round(th * 3600);
      } else if (co) {
        workSec += Math.max(0, Math.floor((co - ci) / 1000) - entryBreak);
      } else {
        workSec += Math.max(0, Math.floor((now - ci) / 1000) - entryBreak);
      }
    });
    reportTotalWorkSeconds = workSec;
    reportTotalBreakSeconds = breakSec;
  } else if (clockInTime && !clockOutTime) {
    reportTotalWorkSeconds = Math.max(0, Math.floor((Date.now() - clockInTime) / 1000) - totalBreakTime);
  }

  const events: TimeEvent[] = [
    { type: 'clock_in', timestamp: clockInTime, label: 'Clock In', subLabel: 'Start of shift', isBreak: false },
  ];
  if (breakStartTime) {
    events.push({ type: 'break_start', timestamp: breakStartTime, label: 'Break Start', subLabel: 'Lunch break', isBreak: true });
  }
  if (breakEndTime) {
    events.push({
      type: 'break_end',
      timestamp: breakEndTime,
      label: 'Break End',
      subLabel: breakStartTime ? `Duration: ${formatDurationShort(Math.floor((breakEndTime - breakStartTime) / 1000))}` : 'Break end',
      isBreak: true,
    });
  }
  if (clockOutTime) {
    events.push({ type: 'clock_out', timestamp: clockOutTime, label: 'Clock Out', subLabel: 'End of shift', isBreak: false });
  }

  const dateLabel = (() => {
    const d = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  })();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{displayCompany}</Text>
          <Text style={styles.headerSub}>Daily Hours Report</Text>
        </View>

        <View style={styles.report}>
          <View style={styles.reportHeader}>
            <Text style={styles.reportName}>{displayName}</Text>
            <Text style={styles.reportPosition}>{displayPosition}</Text>
            <Text style={styles.reportDate}>{dateLabel}</Text>
          </View>

          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Total Hours</Text>
              <Text style={styles.summaryValue}>{formatDuration(reportTotalWorkSeconds)}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Break Time</Text>
              <Text style={styles.summaryValue}>{formatDuration(reportTotalBreakSeconds)}</Text>
            </View>
          </View>

          {useTodayEntries ? (
            <View style={styles.entries}>
              <View style={[styles.entry, styles.entryHeader]}>
                <Text style={[styles.entryHeaderText, styles.col1]} numberOfLines={1}>Clock In</Text>
                <Text style={[styles.entryHeaderText, styles.col2]} numberOfLines={1}>Clock Out</Text>
                <Text style={[styles.entryHeaderText, styles.col3]} numberOfLines={1}>Break</Text>
                <Text style={[styles.entryHeaderText, styles.col4]} numberOfLines={1}>Total</Text>
              </View>
              {todayEntries
                .slice()
                .sort((a, b) => (parseMs(a.clock_in) || 0) - (parseMs(b.clock_in) || 0))
                .map((entry) => {
                  const ci = parseMs(entry.clock_in);
                  const co = parseMs(entry.clock_out);
                  const bs = parseMs(entry.break_start);
                  const be = parseMs(entry.break_end);
                  let breakSec = 0;
                  if (bs && be) breakSec = Math.floor((be - bs) / 1000);
                  else if (bs && !be) breakSec = Math.floor((Date.now() - bs) / 1000);
                  let workSec = 0;
                  if (entry.total_hours != null && entry.total_hours > 0) {
                    workSec = Math.round(entry.total_hours * 3600);
                  } else if (ci) {
                    const end = co || Date.now();
                    workSec = Math.max(0, Math.floor((end - ci) / 1000) - breakSec);
                  }
                  const clockOutLabel = co ? formatTime(co) : 'Active';
                  return (
                    <View key={entry.id} style={styles.entry}>
                      <Text style={[styles.entryTime, styles.col1]} numberOfLines={1}>{ci ? formatTime(ci) : '—'}</Text>
                      <Text style={[styles.entryTime, styles.col2]} numberOfLines={1}>{clockOutLabel}</Text>
                      <Text style={[styles.entrySub, styles.col3]} numberOfLines={1}>{breakSec > 0 ? formatDurationShort(breakSec) : '—'}</Text>
                      <Text style={[styles.entryTime, styles.col4]} numberOfLines={1}>{formatDurationShort(workSec)}</Text>
                    </View>
                  );
                })}
              <View style={[styles.entry, styles.entryTotal, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                <Text style={styles.entryTotalLabel}>Today total</Text>
                <Text style={styles.entryTotalValue}>{formatDuration(reportTotalWorkSeconds)}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.entries}>
              {events.map((e, idx) => (
                <View key={idx} style={[styles.entry, e.isBreak && styles.entryBreak]}>
                  <View>
                    <Text style={styles.entryLabel}>{e.label}</Text>
                    <Text style={styles.entrySub}>{e.subLabel}</Text>
                  </View>
                  <Text style={styles.entryTime}>{formatTime(e.timestamp)}</Text>
                </View>
              ))}
              {clockOutTime && (
                <View style={[styles.entry, styles.entryTotal]}>
                  <Text style={styles.entryTotalLabel}>TOTAL WORK TIME</Text>
                  <Text style={styles.entryTotalValue}>{formatDuration(reportTotalWorkSeconds)}</Text>
                </View>
              )}
            </View>
          )}

          <TouchableOpacity style={styles.btnViewWeekly} onPress={onViewWeekly}>
            <Text style={styles.btnText}>View Weekly Summary</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.btnBack} onPress={onBack}>
            <Text style={styles.btnBackText}>Back</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Zeno Time Flow</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { padding: 24, paddingBottom: 48 },
  card: { backgroundColor: '#1e293b', borderRadius: 20, overflow: 'hidden' },
  header: { backgroundColor: '#1e293b', padding: 25, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#334155' },
  headerTitle: { color: '#f8fafc', fontSize: 24, fontWeight: '700', marginBottom: 4 },
  headerSub: { color: '#94a3b8', fontSize: 13 },
  report: { padding: 25 },
  reportHeader: { backgroundColor: '#0f172a', padding: 20, borderRadius: 12, marginBottom: 20, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  reportName: { color: '#f8fafc', fontSize: 20, fontWeight: '700', marginBottom: 4 },
  reportPosition: { color: '#94a3b8', fontSize: 14 },
  reportDate: { color: '#94a3b8', fontSize: 12, marginTop: 8 },
  summaryRow: { flexDirection: 'row', gap: 15, marginBottom: 20 },
  summaryCard: { flex: 1, backgroundColor: '#0f172a', padding: 15, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  summaryLabel: { fontSize: 12, color: '#64748b', marginBottom: 8, textTransform: 'uppercase' },
  summaryValue: { fontSize: 24, fontWeight: '700', color: '#6366f1', fontVariant: ['tabular-nums'] },
  entries: { borderWidth: 1, borderColor: '#334155', borderRadius: 12, overflow: 'hidden' },
  entry: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#334155', backgroundColor: '#1e293b' },
  entryHeader: { backgroundColor: '#334155' },
  entryHeaderText: { fontSize: 11, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase' },
  col1: { flex: 1 },
  col2: { flex: 1 },
  col3: { flex: 0.8 },
  col4: { flex: 0.8 },
  entryBreak: { backgroundColor: '#422006' },
  entryLabel: { fontWeight: '600', color: '#e2e8f0', fontSize: 13 },
  entrySub: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  entryTime: { fontWeight: '700', color: '#6366f1', fontSize: 14, fontVariant: ['tabular-nums'] },
  entryTotal: { backgroundColor: '#0f172a', borderBottomWidth: 0, borderTopWidth: 3, borderTopColor: '#6366f1' },
  entryTotalLabel: { color: '#6366f1', fontSize: 15, fontWeight: '700' },
  entryTotalValue: { color: '#6366f1', fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
  btnViewWeekly: { backgroundColor: '#6366f1', padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  btnBack: { marginTop: 12, padding: 12, alignItems: 'center' },
  btnBackText: { color: '#6366f1', fontSize: 14, fontWeight: '600' },
  footer: { backgroundColor: '#0f172a', padding: 12, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#334155' },
  footerText: { fontSize: 11, color: '#64748b' },
});
