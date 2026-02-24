import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

interface MenuItem {
  title: string;
  screen: string;
  icon: string;
}

const MAIN_ITEMS: MenuItem[] = [
  { title: 'Focus Hours', screen: 'Focus', icon: '⏱' },
  { title: 'Daily Routines', screen: 'Habits', icon: '💪' },
];

const SCHEDULER_ITEMS: MenuItem[] = [
  { title: 'Dashboard', screen: 'AdminDashboard', icon: '📊' },
  { title: 'Schedule', screen: 'Schedule', icon: '📅' },
  { title: 'Employee Schedule', screen: 'EmployeeSchedule', icon: '📋' },
  { title: 'Missed Shifts', screen: 'MissedShifts', icon: '⚠' },
];

const MANAGEMENT_ITEMS: MenuItem[] = [
  { title: 'Account', screen: 'Account', icon: '⚙' },
  { title: 'Check Lists', screen: 'Checklists', icon: '📝' },
  { title: 'User Management', screen: 'UserManagement', icon: '👥' },
];

function MenuSection({ title, items }: { title: string; items: MenuItem[] }) {
  const navigation = useNavigation<any>();

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.map((item) => (
        <TouchableOpacity
          key={item.screen}
          style={styles.menuRow}
          onPress={() => navigation.navigate(item.screen)}
          activeOpacity={0.7}
        >
          <Text style={styles.menuIcon}>{item.icon}</Text>
          <Text style={styles.menuTitle}>{item.title}</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function MenuScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Menu</Text>
      <Text style={styles.subtitle}>Super Admin</Text>

      <MenuSection title="Main" items={MAIN_ITEMS} />
      <MenuSection title="Scheduler" items={SCHEDULER_ITEMS} />
      <MenuSection title="Management" items={MANAGEMENT_ITEMS} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  content: { padding: 20, paddingBottom: 48 },
  title: { fontSize: 24, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#64748b', marginBottom: 24 },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  menuIcon: { fontSize: 20, marginRight: 14 },
  menuTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: '#0f172a' },
  menuArrow: { fontSize: 20, color: '#94a3b8', fontWeight: '300' },
});
