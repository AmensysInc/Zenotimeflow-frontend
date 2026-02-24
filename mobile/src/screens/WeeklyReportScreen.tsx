import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Shift } from '../storage/shiftStorage';

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}`;
  return `0:${m.toString().padStart(2, '0')}`;
}

interface WeeklyReportScreenProps {
  shifts: Shift[];
  employeeName?: string;
  companyName?: string;
  onBack: () => void;
}

export default function WeeklyReportScreen({ shifts, employeeName, companyName, onBack }: WeeklyReportScreenProps) {
  const displayName = employeeName ?? 'Employee';
  const displayCompany = companyName ?? 'Zeno Time Flow';
  const now = new Date();
  const weekStart = new Date(now);
  const day = weekStart.getDay();
  const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1);
  weekStart.setDate(diff);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const weekLabel = `Week of ${months[weekStart.getMonth()]} ${weekStart.getDate()} - ${months[weekEnd.getMonth()]} ${weekEnd.getDate()}, ${weekEnd.getFullYear()}`;

  const totalSeconds = shifts.reduce((sum, s) => sum + s.workTimeSeconds, 0);
  const daysWorked = shifts.length;

  const labels: Record<number, string> = { 0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat' };

  const sortedShifts = [...shifts].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{displayCompany}</Text>
          <Text style={styles.headerSub}>Weekly Summary Report</Text>
        </View>

        <View style={styles.report}>
          <View style={styles.reportHeader}>
            <Text style={styles.reportName}>{displayName}</Text>
            <Text style={styles.reportWeek}>{weekLabel}</Text>
          </View>

          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Total Hours</Text>
              <Text style={styles.summaryValue}>{formatDuration(totalSeconds)}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Days Worked</Text>
              <Text style={styles.summaryValue}>{daysWorked}</Text>
            </View>
          </View>

          <View style={styles.entries}>
            {sortedShifts.length === 0 ? (
              <View style={styles.emptyEntry}>
                <Text style={styles.emptyText}>No shifts recorded this week.</Text>
              </View>
            ) : (
              sortedShifts.map((shift) => {
                const d = new Date(shift.date + 'T12:00:00');
                const dayLabel = `${labels[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
                const timeRange = `${formatTime(shift.clockIn)} - ${formatTime(shift.clockOut)}`;
                return (
                  <View key={shift.id} style={styles.entry}>
                    <View>
                      <Text style={styles.entryLabel}>{dayLabel}</Text>
                      <Text style={styles.entrySub}>{timeRange}</Text>
                    </View>
                    <Text style={styles.entryTime}>{formatDuration(shift.workTimeSeconds)}</Text>
                  </View>
                );
              })
            )}
            {sortedShifts.length > 0 && (
              <View style={[styles.entry, styles.entryTotal]}>
                <Text style={styles.entryTotalLabel}>WEEKLY TOTAL</Text>
                <Text style={styles.entryTotalValue}>{formatDuration(totalSeconds)}</Text>
              </View>
            )}
          </View>

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
  reportWeek: { color: '#94a3b8', fontSize: 14 },
  summaryRow: { flexDirection: 'row', gap: 15, marginBottom: 20 },
  summaryCard: { flex: 1, backgroundColor: '#0f172a', padding: 15, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  summaryLabel: { fontSize: 12, color: '#64748b', marginBottom: 8, textTransform: 'uppercase' },
  summaryValue: { fontSize: 24, fontWeight: '700', color: '#6366f1', fontVariant: ['tabular-nums'] },
  entries: { borderWidth: 1, borderColor: '#334155', borderRadius: 12, overflow: 'hidden' },
  entry: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#334155', backgroundColor: '#1e293b' },
  emptyEntry: { padding: 20, alignItems: 'center' },
  emptyText: { color: '#64748b', fontSize: 14 },
  entryLabel: { fontWeight: '600', color: '#e2e8f0', fontSize: 13 },
  entrySub: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  entryTime: { fontWeight: '700', color: '#6366f1', fontSize: 14, fontVariant: ['tabular-nums'] },
  entryTotal: { backgroundColor: '#0f172a', borderBottomWidth: 0, borderTopWidth: 3, borderTopColor: '#6366f1' },
  entryTotalLabel: { color: '#6366f1', fontSize: 15, fontWeight: '700' },
  entryTotalValue: { color: '#6366f1', fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
  btnBack: { marginTop: 20, padding: 12, alignItems: 'center' },
  btnBackText: { color: '#6366f1', fontSize: 14, fontWeight: '600' },
  footer: { backgroundColor: '#0f172a', padding: 12, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#334155' },
  footerText: { fontSize: 11, color: '#64748b' },
});
