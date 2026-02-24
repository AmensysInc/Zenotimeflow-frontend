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

export default function MissedShiftsScreen() {
  const { user } = useAuth();
  const [shifts, setShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      const raw = await getShifts({ is_missed: true });
      setShifts(Array.isArray(raw) ? raw : []);
    } catch (e) {
      console.warn(e);
      setShifts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && shifts.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#3b82f6" />
      }
    >
      <Text style={styles.title}>Missed Shifts</Text>
      <Text style={styles.subtitle}>{shifts.length} missed</Text>

      {shifts.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No missed shifts</Text>
        </View>
      ) : (
        shifts.map((s: any) => {
          const emp = s.employees || s.employee;
          const empName = emp
            ? `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || emp.email || '—'
            : '—';
          const start = s.start_time ? parseISO(s.start_time) : null;
          const end = s.end_time ? parseISO(s.end_time) : null;
          return (
            <View key={s.id} style={styles.card}>
              <Text style={styles.cardTitle}>{empName}</Text>
              {start && end && (
                <Text style={styles.cardMeta}>
                  {format(start, 'EEE MMM d')} • {format(start, 'h:mm a')} – {format(end, 'h:mm a')}
                </Text>
              )}
              {s.company_name && <Text style={styles.cardMeta}>{s.company_name}</Text>}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  content: { padding: 20, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#64748b', marginBottom: 20 },
  card: { backgroundColor: '#fffbeb', borderRadius: 12, padding: 16, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: '#f59e0b', borderWidth: 1, borderColor: '#e2e8f0' },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a', marginBottom: 4 },
  cardMeta: { fontSize: 13, color: '#64748b', marginTop: 2 },
  emptyCard: { backgroundColor: '#1e293b', borderRadius: 12, padding: 24, alignItems: 'center' },
  emptyText: { color: '#64748b', fontSize: 15 },
});
