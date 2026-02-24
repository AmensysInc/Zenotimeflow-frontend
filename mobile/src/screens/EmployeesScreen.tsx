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
import { getEmployees, getCompanies } from '../api/extensions';

export default function EmployeesScreen() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [rawEmp, rawCo] = await Promise.all([
        getEmployees(selectedCompany ? { company: selectedCompany } : {}),
        getCompanies({}),
      ]);
      setEmployees(Array.isArray(rawEmp) ? rawEmp : []);
      setCompanies(Array.isArray(rawCo) ? rawCo : []);
    } catch (e) {
      console.warn(e);
      setEmployees([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, selectedCompany]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && employees.length === 0) {
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
      <Text style={styles.title}>Employees</Text>
      <Text style={styles.subtitle}>{employees.length} {employees.length === 1 ? 'employee' : 'employees'}</Text>

      {companies.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          <View style={[styles.chip, !selectedCompany && styles.chipActive]}>
            <Text style={[styles.chipText, !selectedCompany && styles.chipTextActive]}>All</Text>
          </View>
          {companies.map((c: any) => (
            <TouchableOpacity
              key={c.id}
              style={[styles.chip, selectedCompany === c.id && styles.chipActive]}
              onPress={() => setSelectedCompany(prev => prev === c.id ? null : c.id)}
            >
              <Text style={[styles.chipText, selectedCompany === c.id && styles.chipTextActive]} numberOfLines={1}>
                {c.name || 'Unnamed'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {employees.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No employees found</Text>
        </View>
      ) : (
        employees.map((e: any) => (
          <View key={e.id} style={styles.card}>
            <Text style={styles.cardTitle}>
              {e.first_name} {e.last_name}
            </Text>
            <Text style={styles.cardMeta}>{e.email || '—'}</Text>
            {e.position && <Text style={styles.cardMeta}>{e.position}</Text>}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  content: { padding: 20, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#64748b', marginBottom: 16 },
  filterRow: { marginBottom: 16, flexGrow: 0 },
  chip: { backgroundColor: '#334155', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8 },
  chipActive: { backgroundColor: '#3b82f6' },
  chipText: { color: '#94a3b8', fontSize: 13 },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  card: { backgroundColor: '#1e293b', borderRadius: 12, padding: 16, marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#f8fafc', marginBottom: 4 },
  cardMeta: { fontSize: 13, color: '#94a3b8', marginTop: 2 },
  emptyCard: { backgroundColor: '#1e293b', borderRadius: 12, padding: 24, alignItems: 'center' },
  emptyText: { color: '#64748b', fontSize: 15 },
});
