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
import {
  getHabits,
  getHabitCompletions,
  createHabitCompletion,
  updateHabitCompletion,
} from '../api/extensions';
import { format, isToday } from 'date-fns';

const TODAY = format(new Date(), 'yyyy-MM-dd');

export default function HabitsScreen() {
  const { user } = useAuth();
  const [habits, setHabits] = useState<any[]>([]);
  const [completions, setCompletions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [rawHabits, rawCompletions] = await Promise.all([
        getHabits({ user: user.id }),
        getHabitCompletions({ user: user.id, date: TODAY }),
      ]);
      setHabits(Array.isArray(rawHabits) ? rawHabits : []);
      setCompletions(Array.isArray(rawCompletions) ? rawCompletions : []);
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

  const isCompleted = (habitId: string) =>
    completions.some((c: any) => c.habit_id === habitId && c.date === TODAY && c.completed);

  const toggleCompletion = async (habit: any) => {
    const completed = isCompleted(habit.id);
    try {
      const existing = completions.find((c: any) => c.habit_id === habit.id && c.date === TODAY);
      if (existing) {
        await updateHabitCompletion(existing.id, { completed: !completed });
      } else {
        await createHabitCompletion({
          habit_id: habit.id,
          user: user?.id,
          date: TODAY,
          completed: true,
        });
      }
      load();
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
      <Text style={styles.title}>Habits</Text>
      <Text style={styles.date}>{format(new Date(), 'EEEE, MMMM d')}</Text>
      {habits.length === 0 ? (
        <Text style={styles.empty}>No habits yet. Add them on the web app.</Text>
      ) : (
        habits.map((habit) => {
          const done = isCompleted(habit.id);
          return (
            <TouchableOpacity
              key={habit.id}
              style={[styles.habit, done && styles.habitDone]}
              onPress={() => toggleCompletion(habit)}
              activeOpacity={0.7}
            >
              <View style={[styles.circle, done && styles.circleDone]}>
                {done && <Text style={styles.check}>✓</Text>}
              </View>
              <View style={styles.habitBody}>
                <Text style={[styles.habitTitle, done && styles.habitTitleDone]}>{habit.title}</Text>
                {habit.current_streak != null && habit.current_streak > 0 && (
                  <Text style={styles.streak}>🔥 {habit.current_streak} day streak</Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  content: { padding: 24, paddingBottom: 48 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  date: { fontSize: 14, color: '#94a3b8', marginBottom: 20 },
  empty: { color: '#64748b', fontSize: 14 },
  habit: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  habitDone: { opacity: 0.85 },
  circle: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: '#64748b', marginRight: 14, alignItems: 'center', justifyContent: 'center' },
  circleDone: { backgroundColor: '#22c55e', borderColor: '#22c55e' },
  check: { color: '#fff', fontWeight: '700', fontSize: 14 },
  habitBody: { flex: 1 },
  habitTitle: { color: '#0f172a', fontSize: 16 },
  habitTitleDone: { textDecorationLine: 'line-through', color: '#94a3b8' },
  streak: { color: '#f59e0b', fontSize: 12, marginTop: 4 },
});
