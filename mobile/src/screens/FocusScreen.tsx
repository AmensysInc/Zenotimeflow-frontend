import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { getFocusSessions, createFocusSession, updateFocusSession } from '../api/extensions';
import { format, parseISO } from 'date-fns';

export default function FocusScreen() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [active, setActive] = useState(false);
  const [currentSession, setCurrentSession] = useState<any>(null);
  const [seconds, setSeconds] = useState(0);

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      const raw = await getFocusSessions({ user: user.id });
      const list = Array.isArray(raw) ? raw : [];
      setSessions(list);
      const open = list.find((s: any) => s.start_time && !s.end_time);
      if (open) {
        setCurrentSession(open);
        setActive(true);
        const start = new Date(open.start_time).getTime();
        setSeconds(Math.floor((Date.now() - start) / 1000));
      } else {
        setCurrentSession(null);
        setActive(false);
        setSeconds(0);
      }
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [active]);

  const startSession = async () => {
    try {
      const created = await createFocusSession({
        user: user?.id,
        title: 'Focus session',
        start_time: new Date().toISOString(),
      });
      setCurrentSession(created);
      setActive(true);
      setSeconds(0);
      setSessions((prev) => [created, ...prev]);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to start session');
    }
  };

  const endSession = async () => {
    if (!currentSession?.id) return;
    try {
      await updateFocusSession(currentSession.id, {
        end_time: new Date().toISOString(),
        duration: seconds,
      });
      setActive(false);
      setCurrentSession(null);
      setSeconds(0);
      load();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to end session');
    }
  };

  const mm = Math.floor(seconds / 60);
  const ss = seconds % 60;
  const timeStr = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;

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
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#3b82f6" />}
    >
      <Text style={styles.title}>Focus</Text>
      {active ? (
        <View style={styles.timerCard}>
          <Text style={styles.timerText}>{timeStr}</Text>
          <Text style={styles.timerLabel}>Session in progress</Text>
          <TouchableOpacity style={styles.stopButton} onPress={endSession}>
            <Text style={styles.stopButtonText}>End session</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.startButton} onPress={startSession}>
          <Text style={styles.startButtonText}>Start focus session</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.sectionTitle}>Recent sessions</Text>
      {sessions.filter((s: any) => s.end_time).length === 0 ? (
        <Text style={styles.empty}>No completed sessions yet</Text>
      ) : (
        sessions
          .filter((s: any) => s.end_time)
          .slice(0, 15)
          .map((s: any) => (
            <View key={s.id} style={styles.sessionRow}>
              <Text style={styles.sessionDate}>{format(parseISO(s.start_time), 'MMM d, h:mm a')}</Text>
              <Text style={styles.sessionDuration}>{s.duration != null ? `${Math.round(s.duration / 60)} min` : '—'}</Text>
            </View>
          ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  content: { padding: 24, paddingBottom: 48 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a', marginBottom: 20 },
  timerCard: { backgroundColor: '#f8fafc', borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 24, borderWidth: 1, borderColor: '#e2e8f0' },
  timerText: { fontSize: 48, fontWeight: '700', color: '#0f172a', fontVariant: ['tabular-nums'] },
  timerLabel: { color: '#94a3b8', marginTop: 8 },
  stopButton: { marginTop: 20, backgroundColor: '#ef4444', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10 },
  stopButtonText: { color: '#fff', fontWeight: '600' },
  startButton: { backgroundColor: '#22c55e', padding: 18, borderRadius: 12, alignItems: 'center', marginBottom: 24 },
  startButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a', marginBottom: 12 },
  empty: { color: '#64748b', fontSize: 14 },
  sessionRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 12, backgroundColor: '#f8fafc', borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  sessionDate: { color: '#0f172a', fontSize: 14 },
  sessionDuration: { color: '#94a3b8', fontSize: 14 },
});
