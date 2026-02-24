import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { getShifts, getTimeClockEntries, getCalendarEvents } from '../api/extensions';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO, isToday } from 'date-fns';

export default function DashboardScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { user, employee: authEmployee } = useAuth();
  const [shifts, setShifts] = useState<any[]>([]);
  const [entries, setEntries] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      const empId = authEmployee?.id;
      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
      const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
      const monthStart = startOfMonth(new Date());
      const monthEnd = endOfMonth(new Date());

      const [rawShifts, rawEntries, rawTasks] = await Promise.all([
        empId ? getShifts({ employee: empId, start_time__gte: weekStart.toISOString(), start_time__lte: weekEnd.toISOString() }) : [],
        empId ? getTimeClockEntries({ employee: empId }) : [],
        getCalendarEvents({ user: user.id, start_time__gte: monthStart.toISOString(), end_time__lte: monthEnd.toISOString() }),
      ]);
      setShifts(Array.isArray(rawShifts) ? rawShifts : []);
      setEntries(Array.isArray(rawEntries) ? rawEntries : []);
      setTasks(Array.isArray(rawTasks) ? rawTasks : []);
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, authEmployee?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  const todayEntries = entries.filter((e: any) => e.clock_in && isToday(parseISO(e.clock_in)));
  const weekEntries = entries.filter((e: any) => {
    if (!e.clock_in) return false;
    const d = parseISO(e.clock_in);
    return d >= weekStart && d <= weekEnd;
  });
  const totalHours = (list: any[]) =>
    list.reduce((sum, e) => sum + Number(e.total_hours || 0), 0);
  const todayHours = totalHours(todayEntries);
  const weekHours = totalHours(weekEntries);
  const todayShift = shifts.find((s: any) => isToday(parseISO(s.start_time)));

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 20) }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#3b82f6" />}
    >
      <Text style={styles.title}>Dashboard</Text>
      {authEmployee && (
        <Text style={styles.subtitle}>{authEmployee.first_name} {authEmployee.last_name}</Text>
      )}

      <View style={styles.cards}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Today's hours</Text>
          <Text style={styles.cardValue}>{todayHours.toFixed(1)}h</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>This week</Text>
          <Text style={styles.cardValue}>{weekHours.toFixed(1)}h</Text>
        </View>
      </View>

      {todayShift && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today's shift</Text>
          <Text style={styles.shiftText}>
            {format(parseISO(todayShift.start_time), 'h:mm a')} – {format(parseISO(todayShift.end_time), 'h:mm a')}
          </Text>
        </View>
      )}

      {shifts.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming shifts</Text>
          {shifts.slice(0, 5).map((s: any) => (
            <Text key={s.id} style={styles.row}>
              {format(parseISO(s.start_time), 'EEE MMM d')} – {format(parseISO(s.end_time), 'h:mm a')}
            </Text>
          ))}
        </View>
      )}

      {tasks.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tasks this month</Text>
          {tasks.filter((t: any) => !t.completed).slice(0, 5).map((t: any) => (
            <TouchableOpacity
              key={t.id}
              onPress={() => navigation?.navigate?.('Tasks')}
              style={styles.taskRow}
            >
              <Text style={styles.taskTitle} numberOfLines={1}>{t.title}</Text>
              <Text style={styles.taskMeta}>{t.start_time ? format(parseISO(t.start_time), 'MMM d') : ''}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  content: { padding: 24, paddingBottom: 48 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#64748b', marginBottom: 20 },
  cards: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  card: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  cardLabel: { fontSize: 12, color: '#64748b', marginBottom: 4 },
  cardValue: { fontSize: 20, fontWeight: '700', color: '#0f172a' },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a', marginBottom: 8 },
  shiftText: { color: '#64748b', fontSize: 14 },
  row: { color: '#64748b', fontSize: 14, marginBottom: 4 },
  taskRow: { backgroundColor: '#f8fafc', borderRadius: 8, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  taskTitle: { color: '#0f172a', fontSize: 14 },
  taskMeta: { color: '#64748b', fontSize: 12, marginTop: 4 },
});
