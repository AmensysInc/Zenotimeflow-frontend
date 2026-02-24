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
import { useUserRole } from '../hooks/useUserRole';
import {
  getOrganizations,
  getCompanies,
  getEmployees,
  getShifts,
  createShift,
} from '../api/extensions';
import { format, parseISO, addDays } from 'date-fns';

function ensureArray<T>(raw: T | T[] | { results?: T[] }): T[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object' && 'results' in raw && Array.isArray((raw as any).results))
    return (raw as any).results;
  return [];
}

export default function ScheduleScreen() {
  const { user } = useAuth();
  const { role } = useUserRole();
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedOrg, setSelectedOrg] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('');
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay() + 1);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const isSuperAdmin = role === 'super_admin';
  const isOrgManager = role === 'operations_manager';
  const isManager = role === 'manager';
  const canManage = isSuperAdmin || isOrgManager || isManager;

  const weekStartTs = weekStart.getTime();
  const weekEnd = React.useMemo(() => addDays(weekStart, 6), [weekStartTs]);

  const loadOrgsAndCompanies = useCallback(async () => {
    if (!user?.id) return;
    try {
      if (isSuperAdmin) {
        const rawOrgs = await getOrganizations({});
        setOrganizations(ensureArray(rawOrgs));
      }
      const params: any = {};
      if (isOrgManager && user?.id) params.organization_manager = user.id;
      if (isManager && user?.id) params.company_manager = user.id;
      const rawCompanies = await getCompanies(params);
      let list = ensureArray(rawCompanies);
      if (isSuperAdmin && selectedOrg) {
        list = list.filter((c: any) => (c.organization_id ?? c.organization?.id ?? c.organization) === selectedOrg);
      }
      setCompanies(list);
      if (list.length > 0 && (!selectedCompany || !list.some((c: any) => c.id === selectedCompany))) {
        setSelectedCompany(list[0].id);
      }
    } catch (e) {
      console.warn(e);
    }
  }, [user?.id, isSuperAdmin, isOrgManager, isManager, selectedOrg]);

  const loadEmployees = useCallback(async () => {
    if (!selectedCompany) return;
    try {
      const raw = await getEmployees({ company: selectedCompany, status: 'active' });
      setEmployees(ensureArray(raw));
    } catch (e) {
      console.warn(e);
      setEmployees([]);
    }
  }, [selectedCompany]);

  const loadShifts = useCallback(async () => {
    if (!selectedCompany) {
      setShifts([]);
      setLoading(false);
      return;
    }
    try {
      const end = addDays(weekStart, 7);
      const raw = await getShifts({
        company: selectedCompany,
        start_date: weekStart.toISOString(),
        end_date: end.toISOString(),
      });
      setShifts(ensureArray(raw));
    } catch (e) {
      console.warn(e);
      setShifts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedCompany, weekStartTs]);

  useEffect(() => {
    loadOrgsAndCompanies();
  }, [loadOrgsAndCompanies]);

  useEffect(() => {
    if (selectedCompany) {
      setLoading(true);
      loadEmployees();
      loadShifts();
    } else {
      setLoading(false);
    }
  }, [selectedCompany, loadEmployees, loadShifts]);

  const handleAddShift = async () => {
    if (!selectedCompany) {
      Alert.alert('Info', 'Select a company first');
      return;
    }
    if (employees.length === 0) {
      Alert.alert('Info', 'No employees in this company. Add employees first.');
      return;
    }
    const emp = employees[0];
    const start = new Date(weekStart);
    start.setHours(6, 0, 0, 0);
    const end = new Date(start);
    end.setHours(14, 0, 0, 0);
    try {
      await createShift({
        company_id: selectedCompany,
        employee_id: emp.id,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        status: 'scheduled',
      });
      loadShifts();
      Alert.alert('Success', 'Shift created');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to create shift');
    }
  };

  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const getShiftsForDay = (date: Date) =>
    shifts.filter((s) => {
      const d = parseISO(s.start_time);
      return (
        d.getFullYear() === date.getFullYear() &&
        d.getMonth() === date.getMonth() &&
        d.getDate() === date.getDate()
      );
    });

  const getEmpName = (s: any) => {
    const e = s.employees || s.employee;
    if (!e) return '—';
    return `${e.first_name || ''} ${e.last_name || ''}`.trim() || e.email || '—';
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await loadOrgsAndCompanies();
            if (selectedCompany) await loadShifts();
            setRefreshing(false);
          }}
          tintColor="#3b82f6"
        />
      }
    >
      <Text style={styles.title}>Schedule</Text>

      {isSuperAdmin && organizations.length > 0 && (
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>Organization</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
            <TouchableOpacity
              style={[styles.chip, !selectedOrg && styles.chipSelected]}
              onPress={() => setSelectedOrg('')}
            >
              <Text style={[styles.chipText, !selectedOrg && styles.chipTextSelected]}>All</Text>
            </TouchableOpacity>
            {organizations.map((o: any) => (
              <TouchableOpacity
                key={o.id}
                style={[styles.chip, selectedOrg === o.id && styles.chipSelected]}
                onPress={() => setSelectedOrg(selectedOrg === o.id ? '' : o.id)}
              >
                <Text style={[styles.chipText, selectedOrg === o.id && styles.chipTextSelected]}>{o.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {companies.length > 0 && (
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>Company</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
            {companies.map((c: any) => (
              <TouchableOpacity
                key={c.id}
                style={[styles.chip, selectedCompany === c.id && styles.chipSelected]}
                onPress={() => setSelectedCompany(c.id)}
              >
                <Text style={[styles.chipText, selectedCompany === c.id && styles.chipTextSelected]}>{c.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={styles.weekRow}>
        <TouchableOpacity onPress={() => setWeekStart(addDays(weekStart, -7))}>
          <Text style={styles.navBtn}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.weekLabel}>
          {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d')}
        </Text>
        <TouchableOpacity onPress={() => setWeekStart(addDays(weekStart, 7))}>
          <Text style={styles.navBtn}>›</Text>
        </TouchableOpacity>
      </View>

      {canManage && selectedCompany && (
        <TouchableOpacity style={styles.addBtn} onPress={handleAddShift}>
          <Text style={styles.addBtnText}>+ Add Shift</Text>
        </TouchableOpacity>
      )}

      {loading ? (
        <ActivityIndicator size="large" color="#3b82f6" style={{ marginVertical: 24 }} />
      ) : !selectedCompany ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Select a company</Text>
        </View>
      ) : (
        weekDates.map((date) => {
          const dayShifts = getShiftsForDay(date);
          return (
            <View key={date.toISOString()} style={styles.daySection}>
              <Text style={styles.dayHeader}>{format(date, 'EEE MMM d')}</Text>
              {dayShifts.length === 0 ? (
                <Text style={styles.noShifts}>No shifts</Text>
              ) : (
                dayShifts.map((s: any) => (
                  <View key={s.id} style={styles.shiftCard}>
                    <Text style={styles.shiftTime}>
                      {format(parseISO(s.start_time), 'h:mm a')} – {format(parseISO(s.end_time), 'h:mm a')}
                    </Text>
                    <Text style={styles.shiftEmp}>{getEmpName(s)}</Text>
                  </View>
                ))
              )}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  content: { padding: 20, paddingBottom: 48 },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a', marginBottom: 16 },
  filterRow: { marginBottom: 12 },
  filterLabel: { fontSize: 12, fontWeight: '600', color: '#64748b', marginBottom: 6 },
  chips: { flexDirection: 'row' },
  chip: { paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, backgroundColor: '#f1f5f9', borderRadius: 8 },
  chipSelected: { backgroundColor: '#0f172a' },
  chipText: { fontSize: 14, color: '#0f172a' },
  chipTextSelected: { color: '#fff' },
  weekRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 12 },
  navBtn: { fontSize: 24, color: '#0f172a', padding: 4 },
  weekLabel: { flex: 1, fontSize: 16, fontWeight: '600', color: '#0f172a', textAlign: 'center' },
  addBtn: { alignSelf: 'flex-start', backgroundColor: '#0f172a', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, marginBottom: 20 },
  addBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  daySection: { marginBottom: 20 },
  dayHeader: { fontSize: 14, fontWeight: '700', color: '#0f172a', marginBottom: 8 },
  shiftCard: { padding: 12, backgroundColor: '#f8fafc', borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  shiftTime: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  shiftEmp: { fontSize: 13, color: '#64748b', marginTop: 2 },
  noShifts: { fontSize: 13, color: '#94a3b8', fontStyle: 'italic', marginBottom: 8 },
  empty: { padding: 24, alignItems: 'center' },
  emptyText: { fontSize: 15, color: '#64748b' },
});
