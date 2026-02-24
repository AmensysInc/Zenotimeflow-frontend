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
import { useAuth } from '../context/AuthContext';
import { getCompanies, getEmployees, getShifts } from '../api/extensions';
import { useUserRole } from '../hooks/useUserRole';

export default function AdminDashboardScreen({ navigation }: any) {
  const { user } = useAuth();
  const { role } = useUserRole();
  const [companies, setCompanies] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [missedCount, setMissedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [rawCo, rawEmp, rawMissed] = await Promise.all([
        getCompanies({}),
        getEmployees({}),
        getShifts({ is_missed: true }),
      ]);
      setCompanies(Array.isArray(rawCo) ? rawCo : []);
      setEmployees(Array.isArray(rawEmp) ? rawEmp : []);
      setMissedCount(Array.isArray(rawMissed) ? rawMissed.length : 0);
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

  const roleLabel =
    role === 'super_admin' ? 'Super Admin' :
    role === 'operations_manager' ? 'Org Manager' :
    role === 'manager' ? 'Company Manager' :
    role === 'admin' ? 'Admin' : 'Manager';

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
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#3b82f6" />
      }
    >
      <Text style={styles.title}>Admin Dashboard</Text>
      <Text style={styles.subtitle}>{roleLabel}</Text>

      <View style={styles.cards}>
        <TouchableOpacity style={styles.card} onPress={() => navigation?.navigate?.('Companies')}>
          <Text style={styles.cardValue}>{companies.length}</Text>
          <Text style={styles.cardLabel}>Companies</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.card} onPress={() => navigation?.navigate?.('Employees')}>
          <Text style={styles.cardValue}>{employees.length}</Text>
          <Text style={styles.cardLabel}>Employees</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.card} onPress={() => navigation?.navigate?.('MissedShifts')}>
          <Text style={[styles.cardValue, missedCount > 0 && styles.cardValueAlert]}>{missedCount}</Text>
          <Text style={styles.cardLabel}>Missed Shifts</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.quickLinks}>
        <Text style={styles.sectionTitle}>Quick Links</Text>
        <TouchableOpacity style={styles.linkRow} onPress={() => navigation?.navigate?.('Companies')}>
          <Text style={styles.linkText}>Companies</Text>
          <Text style={styles.linkArrow}>→</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkRow} onPress={() => navigation?.navigate?.('Employees')}>
          <Text style={styles.linkText}>Employees</Text>
          <Text style={styles.linkArrow}>→</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkRow} onPress={() => navigation?.navigate?.('MissedShifts')}>
          <Text style={styles.linkText}>Missed Shifts</Text>
          <Text style={styles.linkArrow}>→</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  content: { padding: 20, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' },
  title: { fontSize: 24, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#64748b', marginBottom: 24 },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  card: { flex: 1, minWidth: '30%', backgroundColor: '#f8fafc', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  cardValue: { fontSize: 28, fontWeight: '700', color: '#0f172a' },
  cardValueAlert: { color: '#f59e0b' },
  cardLabel: { fontSize: 12, color: '#64748b', marginTop: 4 },
  quickLinks: { backgroundColor: '#f8fafc', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0' },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#64748b', padding: 16, paddingBottom: 8 },
  linkRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  linkText: { color: '#0f172a', fontSize: 16 },
  linkArrow: { color: '#64748b', fontSize: 16 },
});
