import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { getCalendarEvents, updateCalendarEvent, createCalendarEvent, deleteCalendarEvent } from '../api/extensions';
import { format, parseISO } from 'date-fns';

export default function TasksScreen() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('pending');

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      const raw = await getCalendarEvents({ user: user.id, event_type: 'task' });
      setTasks(Array.isArray(raw) ? raw : []);
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

  const filtered = tasks.filter((t) => {
    if (filter === 'done') return t.completed;
    if (filter === 'pending') return !t.completed;
    return true;
  });

  const toggleComplete = async (task: any) => {
    try {
      await updateCalendarEvent(task.id, { completed: !task.completed });
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, completed: !t.completed } : t)));
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Update failed');
    }
  };

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
      <Text style={styles.title}>Tasks</Text>
      <View style={styles.tabs}>
        {(['pending', 'done', 'all'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.tab, filter === f && styles.tabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.tabText, filter === f && styles.tabTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {filtered.length === 0 ? (
        <Text style={styles.empty}>No tasks</Text>
      ) : (
        filtered.map((task) => (
          <TouchableOpacity
            key={task.id}
            style={styles.task}
            onPress={() => toggleComplete(task)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, task.completed && styles.checkboxDone]}>
              {task.completed && <Text style={styles.check}>✓</Text>}
            </View>
            <View style={styles.taskBody}>
              <Text style={[styles.taskTitle, task.completed && styles.taskTitleDone]} numberOfLines={2}>
                {task.title}
              </Text>
              {(task.start_time || task.priority) && (
                <Text style={styles.taskMeta}>
                  {task.start_time ? format(parseISO(task.start_time), 'MMM d') : ''}
                  {task.priority ? ` · ${task.priority}` : ''}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  content: { padding: 20, paddingBottom: 48 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a', marginBottom: 16 },
  tabs: { flexDirection: 'row', marginBottom: 20 },
  tab: { paddingVertical: 8, paddingHorizontal: 16, marginRight: 8, borderRadius: 8, backgroundColor: '#f1f5f9' },
  tabActive: { backgroundColor: '#0f172a' },
  tabText: { color: '#64748b', fontSize: 14 },
  tabTextActive: { color: '#fff', fontWeight: '600' },
  empty: { color: '#64748b', fontSize: 14 },
  task: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#64748b', marginRight: 12, alignItems: 'center', justifyContent: 'center' },
  checkboxDone: { backgroundColor: '#22c55e', borderColor: '#22c55e' },
  check: { color: '#fff', fontWeight: '700', fontSize: 14 },
  taskBody: { flex: 1 },
  taskTitle: { color: '#0f172a', fontSize: 15 },
  taskTitleDone: { textDecorationLine: 'line-through', color: '#94a3b8' },
  taskMeta: { color: '#64748b', fontSize: 12, marginTop: 4 },
});
