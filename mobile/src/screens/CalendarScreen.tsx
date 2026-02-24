import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { getCalendarEvents, getShifts } from '../api/extensions';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  parseISO,
} from 'date-fns';

export default function CalendarScreen() {
  const { user, employee: authEmployee } = useAuth();
  const [events, setEvents] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [month, setMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { width } = useWindowDimensions();
  const cellSize = Math.floor((width - 40) / 7);

  const load = useCallback(async () => {
    if (!user?.id) return;
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    try {
      const [rawEvents, rawShifts] = await Promise.all([
        getCalendarEvents({ user: user.id, start_time__gte: start.toISOString(), end_time__lte: end.toISOString() }),
        authEmployee?.id ? getShifts({ employee: authEmployee.id, start_time__gte: start.toISOString(), start_time__lte: end.toISOString() }) : [],
      ]);
      setEvents(Array.isArray(rawEvents) ? rawEvents : []);
      setShifts(Array.isArray(rawShifts) ? rawShifts : []);
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, authEmployee?.id, month]);

  useEffect(() => {
    load();
  }, [load]);

  const combined = [
    ...events.map((e: any) => ({ ...e, type: 'event', start: e.start_time, end: e.end_time, title: e.title })),
    ...shifts.map((s: any) => ({ ...s, type: 'shift', start: s.start_time, end: s.end_time, title: 'Shift' })),
  ].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getEventCountForDate = (date: Date) => {
    return combined.filter((item) => isSameDay(new Date(item.start), date)).length;
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#3b82f6" />}
    >
      <View style={styles.header}>
        <View style={styles.navRow}>
          <TouchableOpacity onPress={() => setMonth((m) => subMonths(m, 1))} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.navButton}>‹</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setMonth(new Date()); setSelectedDate(new Date()); }} style={styles.todayBtn}>
            <Text style={styles.todayText}>Today</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMonth((m) => addMonths(m, 1))} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.navButton}>›</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.monthTitle}>{format(month, 'MMMM yyyy')}</Text>
      </View>

      <View style={styles.calendarWrap}>
        <View style={styles.dayHeaders}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <Text key={d} style={styles.dayHeader} numberOfLines={1}>{d}</Text>
          ))}
        </View>
        <View style={styles.grid}>
          {calendarDays.map((date, index) => {
            const inMonth = isSameMonth(date, month);
            const today = isToday(date);
            const selected = isSameDay(date, selectedDate);
            const count = getEventCountForDate(date);
            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.cell,
                  { width: cellSize, height: cellSize },
                  !inMonth && styles.cellOtherMonth,
                  selected && styles.cellSelected,
                ]}
                onPress={() => setSelectedDate(date)}
                activeOpacity={0.7}
              >
                <View style={[styles.dateNumWrap, today && styles.dateNumToday, selected && styles.dateNumSelected]}>
                  <Text style={[
                    styles.dateNum,
                    !inMonth && styles.dateNumMuted,
                    selected && styles.dateNumSelectedText,
                  ]}>
                    {format(date, 'd')}
                  </Text>
                </View>
                {count > 0 && (
                  <View style={styles.dotRow}>
                    {Array.from({ length: Math.min(3, count) }).map((_, i) => (
                      <View key={i} style={styles.eventDot} />
                    ))}
                    {count > 3 && <Text style={styles.moreText}>+{count - 3}</Text>}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#3b82f6" style={{ marginVertical: 24 }} />
      ) : (
        <>
          <Text style={styles.sectionTitle}>Events & shifts</Text>
          {combined.length === 0 ? (
            <Text style={styles.empty}>No events or shifts this month</Text>
          ) : (
            combined.slice(0, 30).map((item: any, i) => (
              <View key={item.id || i} style={styles.item}>
                <View style={[styles.dot, item.type === 'shift' ? styles.dotShift : styles.dotEvent]} />
                <View style={styles.itemBody}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <Text style={styles.itemTime}>
                    {format(parseISO(item.start), 'EEE MMM d, h:mm a')}
                    {item.end ? ` – ${format(parseISO(item.end), 'h:mm a')}` : ''}
                  </Text>
                </View>
              </View>
            ))
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  content: { padding: 20, paddingBottom: 48 },
  header: { marginBottom: 16 },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  navButton: { color: '#0f172a', fontSize: 22, padding: 4, minWidth: 32, textAlign: 'center' },
  todayBtn: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  todayText: { color: '#0f172a', fontSize: 14, fontWeight: '600' },
  monthTitle: { fontSize: 20, fontWeight: '700', color: '#0f172a' },
  calendarWrap: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
  },
  dayHeaders: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  dayHeader: { flex: 1, textAlign: 'center', paddingVertical: 8, fontSize: 12, fontWeight: '600', color: '#64748b' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
    padding: 4,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  cellOtherMonth: { backgroundColor: '#f8fafc' },
  cellSelected: { backgroundColor: 'rgba(139, 92, 246, 0.08)' },
  dateNumWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateNumToday: { borderWidth: 1, borderColor: '#8b5cf6' },
  dateNumSelected: { backgroundColor: '#8b5cf6' },
  dateNum: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  dateNumMuted: { color: '#94a3b8' },
  dateNumSelectedText: { color: '#ffffff' },
  dotRow: { flexDirection: 'row', marginTop: 2, gap: 2, flexWrap: 'wrap', justifyContent: 'center' },
  eventDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#8b5cf6' },
  moreText: { fontSize: 8, color: '#64748b', marginLeft: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a', marginBottom: 12 },
  empty: { color: '#64748b', fontSize: 14 },
  item: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 12 },
  dotEvent: { backgroundColor: '#8b5cf6' },
  dotShift: { backgroundColor: '#3b82f6' },
  itemBody: { flex: 1 },
  itemTitle: { color: '#0f172a', fontSize: 14 },
  itemTime: { color: '#64748b', fontSize: 12, marginTop: 2 },
});
