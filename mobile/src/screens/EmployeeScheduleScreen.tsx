import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { getShifts } from '../api/extensions';
import { format, parseISO } from 'date-fns';

export default function EmployeeScheduleScreen() {
  const { user, employee } = useAuth();
  const [shifts, setShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id || !employee?.id) {
      setLoading(false);
      return;
    }
    try {
      const now = new Date();
      const start = new Date(now);
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now);
      end.setMonth(end.getMonth() + 2);
      end.setDate(0);
      end.setHours(23, 59, 59, 999);
      const raw = await getShifts({
        employee: employee.id,
        start_time__gte: start.toISOString(),
        start_time__lte: end.toISOString(),
      });
      setShifts(Array.isArray(raw) ? raw : []);
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, employee?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const bg = '#ffffff';
  const cardBg = '#ffffff';
  const textColor = '#0f172a';
  const textSec = '#64748b';

  if (loading && shifts.length === 0) {
    return (
      <View style={[styles.centered, { backgroundColor: bg }]}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: bg }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#3b82f6" />
      }
    >
      <Text style={[styles.title, { color: textColor }]}>Employee Schedule</Text>
      <Text style={[styles.subtitle, { color: textSec }]}>My shifts</Text>
      {shifts.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: cardBg, borderColor: '#e2e8f0' }]}>
          <Text style={[styles.emptyText, { color: textSec }]}>No shifts scheduled</Text>
        </View>
      ) : (
        shifts.map((s: any) => (
          <View key={s.id} style={[styles.card, { backgroundColor: cardBg, borderColor: '#e2e8f0' }]}>
            <Text style={[styles.cardTitle, { color: textColor }]}>
              {format(parseISO(s.start_time), 'EEE MMM d')} • {format(parseISO(s.start_time), 'h:mm a')} – {format(parseISO(s.end_time), 'h:mm a')}
            </Text>
            {s.employees && (
              <Text style={[styles.cardMeta, { color: textSec }]}>
                {s.employees.first_name} {s.employees.last_name}
              </Text>
            )}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 14, marginBottom: 20 },
  card: { borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1 },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  cardMeta: { fontSize: 13, marginTop: 2 },
  emptyCard: { borderRadius: 12, padding: 24, alignItems: 'center', borderWidth: 1 },
  emptyText: { fontSize: 15 },
});
