import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { getOrganizations, getCompanies } from '../api/extensions';

function ensureArray<T>(raw: T | T[] | { results?: T[] }): T[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object' && 'results' in raw && Array.isArray((raw as any).results))
    return (raw as any).results;
  return [];
}

const ROLES = [
  { value: 'employee', label: 'Employee' },
  { value: 'house_keeping', label: 'House Keeping' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'manager', label: 'Company Manager' },
  { value: 'operations_manager', label: 'Organization Manager' },
  { value: 'super_admin', label: 'Super Admin' },
];

export default function UserManagementScreen() {
  const { user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    full_name: '',
    password: '',
    employee_pin: '',
    role: 'employee' as string,
    organization_id: '',
    company_id: '',
  });

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      const raw = await api.get('/auth/users/');
      setUsers(ensureArray(raw));
    } catch (e) {
      console.warn(e);
      setUsers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  const loadOrgAndCompanies = useCallback(async () => {
    try {
      const [rawOrgs, rawCompanies] = await Promise.all([
        getOrganizations({}),
        getCompanies({}),
      ]);
      setOrganizations(ensureArray(rawOrgs));
      setCompanies(ensureArray(rawCompanies));
    } catch (e) {
      console.warn(e);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (showCreateModal) loadOrgAndCompanies();
  }, [showCreateModal, loadOrgAndCompanies]);

  const getOrgId = (c: any) => c.organization_id ?? c.organization?.id ?? c.organization;
  const filteredCompanies = newUser.organization_id
    ? companies.filter((c: any) => getOrgId(c) === newUser.organization_id)
    : companies;

  const handleCreateUser = async () => {
    const email = newUser.email.trim();
    const password = newUser.password;
    if (!email) {
      Alert.alert('Error', 'Email is required');
      return;
    }
    if (!password) {
      Alert.alert('Error', 'Password is required');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }
    if (newUser.role === 'operations_manager' && !newUser.organization_id) {
      Alert.alert('Error', 'Select an organization for Organization Manager');
      return;
    }
    if (newUser.role === 'manager' && (!newUser.organization_id || !newUser.company_id)) {
      Alert.alert('Error', 'Select organization and company for Company Manager');
      return;
    }
    if (['employee', 'house_keeping', 'maintenance'].includes(newUser.role) && !newUser.company_id) {
      Alert.alert('Error', 'Select a company for this role');
      return;
    }

    setCreating(true);
    try {
      const fullName = newUser.full_name.trim() || email.split('@')[0];
      const backendRole =
        newUser.role === 'super_admin' ? 'super_admin' :
        newUser.role === 'operations_manager' ? 'organization_manager' :
        newUser.role === 'manager' ? 'company_manager' : 'employee';

      const payload: Record<string, any> = {
        email,
        password,
        full_name: fullName,
        role: backendRole,
      };
      if (newUser.role === 'operations_manager' && newUser.organization_id) {
        payload.organization_id = newUser.organization_id;
      }
      if (['manager', 'employee', 'house_keeping', 'maintenance'].includes(newUser.role) && newUser.company_id) {
        payload.company_id = newUser.company_id;
        if (newUser.role === 'manager' && newUser.organization_id) {
          payload.organization_id = newUser.organization_id;
        }
      }
      if (['employee', 'house_keeping', 'maintenance'].includes(newUser.role) && newUser.employee_pin?.trim()) {
        payload.employee_pin = newUser.employee_pin.trim();
      }

      await api.post('/auth/users/', payload);
      setShowCreateModal(false);
      setNewUser({ email: '', full_name: '', password: '', employee_pin: '', role: 'employee', organization_id: '', company_id: '' });
      load();
      Alert.alert('Success', 'User created');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to create user');
    } finally {
      setCreating(false);
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
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#3b82f6" />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>User Management</Text>
            <Text style={styles.subtitle}>{users.length} users</Text>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowCreateModal(true)}>
            <Text style={styles.addBtnText}>+ Add User</Text>
          </TouchableOpacity>
        </View>

        {users.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No users found</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowCreateModal(true)}>
              <Text style={styles.emptyBtnText}>Create user</Text>
            </TouchableOpacity>
          </View>
        ) : (
          users.map((u: any) => (
            <View key={u.id} style={styles.card}>
              <Text style={styles.cardTitle}>{u.profile?.full_name || u.full_name || u.email || '—'}</Text>
              <Text style={styles.cardMeta}>{u.email}</Text>
              {u.roles?.length > 0 && (
                <Text style={styles.cardRole}>{u.roles.map((r: any) => r.role || r).join(', ')}</Text>
              )}
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={showCreateModal} transparent animationType="fade">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.modalScroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>Create User</Text>

              <Text style={styles.label}>Email *</Text>
              <TextInput
                style={styles.input}
                value={newUser.email}
                onChangeText={(t) => setNewUser({ ...newUser, email: t })}
                placeholder="user@example.com"
                placeholderTextColor="#94a3b8"
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.label}>Full name</Text>
              <TextInput
                style={styles.input}
                value={newUser.full_name}
                onChangeText={(t) => setNewUser({ ...newUser, full_name: t })}
                placeholder="Optional"
                placeholderTextColor="#94a3b8"
              />

              <Text style={styles.label}>Password *</Text>
              <TextInput
                style={styles.input}
                value={newUser.password}
                onChangeText={(t) => setNewUser({ ...newUser, password: t })}
                placeholder="Min 8 characters"
                placeholderTextColor="#94a3b8"
                secureTextEntry
              />

              <Text style={styles.label}>Role *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.roleChips}>
                {ROLES.map((r) => (
                  <TouchableOpacity
                    key={r.value}
                    style={[styles.roleChip, newUser.role === r.value && styles.roleChipSelected]}
                    onPress={() => setNewUser({ ...newUser, role: r.value, organization_id: '', company_id: '' })}
                  >
                    <Text style={[styles.roleChipText, newUser.role === r.value && styles.roleChipTextSelected]}>{r.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {(newUser.role === 'operations_manager' || newUser.role === 'manager' || ['employee', 'house_keeping', 'maintenance'].includes(newUser.role)) && (
                <>
                  <Text style={styles.label}>Organization</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
                    <TouchableOpacity
                      style={[styles.chip, !newUser.organization_id && styles.chipSelected]}
                      onPress={() => setNewUser({ ...newUser, organization_id: '', company_id: '' })}
                    >
                      <Text style={[styles.chipText, !newUser.organization_id && styles.chipTextSelected]}>—</Text>
                    </TouchableOpacity>
                    {organizations.map((o: any) => (
                      <TouchableOpacity
                        key={o.id}
                        style={[styles.chip, newUser.organization_id === o.id && styles.chipSelected]}
                        onPress={() => setNewUser({ ...newUser, organization_id: newUser.organization_id === o.id ? '' : o.id, company_id: '' })}
                      >
                        <Text style={[styles.chipText, newUser.organization_id === o.id && styles.chipTextSelected]}>{o.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}

              {(newUser.role === 'manager' || ['employee', 'house_keeping', 'maintenance'].includes(newUser.role)) && (
                <>
                  <Text style={styles.label}>Company</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
                    {filteredCompanies.map((c: any) => (
                      <TouchableOpacity
                        key={c.id}
                        style={[styles.chip, newUser.company_id === c.id && styles.chipSelected]}
                        onPress={() => setNewUser({ ...newUser, company_id: newUser.company_id === c.id ? '' : c.id })}
                      >
                        <Text style={[styles.chipText, newUser.company_id === c.id && styles.chipTextSelected]}>{c.name}</Text>
                      </TouchableOpacity>
                    ))}
                    {filteredCompanies.length === 0 && (
                      <Text style={styles.hintSmall}>Select org first</Text>
                    )}
                  </ScrollView>
                </>
              )}

              {['employee', 'house_keeping', 'maintenance'].includes(newUser.role) && (
                <>
                  <Text style={styles.label}>Employee PIN (optional)</Text>
                  <TextInput
                    style={styles.input}
                    value={newUser.employee_pin}
                    onChangeText={(t) => setNewUser({ ...newUser, employee_pin: t })}
                    placeholder="4-digit PIN"
                    placeholderTextColor="#94a3b8"
                    keyboardType="number-pad"
                    maxLength={4}
                  />
                </>
              )}

              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setShowCreateModal(false)}>
                  <Text style={styles.modalBtnCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtnOk, creating && styles.disabled]}
                  onPress={handleCreateUser}
                  disabled={creating}
                >
                  {creating ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.modalBtnOkText}>Create</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 48 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  subtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },
  addBtn: { backgroundColor: '#0f172a', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  addBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  card: { padding: 16, marginBottom: 12, backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  cardMeta: { fontSize: 14, color: '#64748b', marginTop: 2 },
  cardRole: { fontSize: 12, color: '#0f172a', marginTop: 4, fontWeight: '500' },
  emptyCard: { padding: 24, backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#64748b', marginBottom: 12 },
  emptyBtn: { paddingVertical: 10, paddingHorizontal: 20, backgroundColor: '#0f172a', borderRadius: 8 },
  emptyBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalScroll: { flexGrow: 1, justifyContent: 'center' },
  modalBox: { backgroundColor: '#fff', borderRadius: 16, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 20 },
  label: { fontSize: 12, color: '#64748b', marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, fontSize: 16, color: '#0f172a', marginBottom: 4 },
  roleChips: { marginBottom: 8 },
  roleChip: { paddingHorizontal: 12, paddingVertical: 8, marginRight: 8, marginBottom: 4, backgroundColor: '#f1f5f9', borderRadius: 8, alignSelf: 'flex-start' },
  roleChipSelected: { backgroundColor: '#0f172a' },
  roleChipText: { fontSize: 14, color: '#0f172a' },
  roleChipTextSelected: { color: '#fff' },
  chips: { flexDirection: 'row', marginBottom: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, marginRight: 8, marginBottom: 4, backgroundColor: '#f1f5f9', borderRadius: 8 },
  chipSelected: { backgroundColor: '#0f172a' },
  chipText: { fontSize: 14, color: '#0f172a' },
  chipTextSelected: { color: '#fff' },
  hintSmall: { fontSize: 13, color: '#94a3b8', marginBottom: 8 },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 24 },
  modalBtnCancel: { flex: 1, padding: 14, borderRadius: 8, backgroundColor: '#f1f5f9', alignItems: 'center' },
  modalBtnCancelText: { color: '#0f172a', fontSize: 16, fontWeight: '600' },
  modalBtnOk: { flex: 1, padding: 14, borderRadius: 8, backgroundColor: '#0f172a', alignItems: 'center' },
  modalBtnOkText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.7 },
});
