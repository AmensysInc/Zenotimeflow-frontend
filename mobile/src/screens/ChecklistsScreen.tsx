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
import { useUserRole } from '../hooks/useUserRole';
import { api } from '../api/client';

function ensureArray<T>(raw: T | T[] | { results?: T[] }): T[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object' && 'results' in raw && Array.isArray((raw as any).results))
    return (raw as any).results;
  return [];
}

export default function ChecklistsScreen() {
  const { user } = useAuth();
  const { role } = useUserRole();
  const [templates, setTemplates] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [creating, setCreating] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', technology: '' });

  const isAdmin = role === 'super_admin' || role === 'operations_manager' || role === 'manager';

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      const raw = await api.get('/templates/');
      setTemplates(ensureArray(raw));
    } catch (e: any) {
      console.warn(e);
      setTemplates([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  const loadUsers = useCallback(async () => {
    try {
      const raw = await api.get('/auth/users/');
      const list = ensureArray(raw).filter((u: any) => u.profile?.status !== 'deleted');
      setUsers(list);
    } catch (e) {
      console.warn(e);
      setUsers([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (showCreateModal || showAssignModal) loadUsers();
  }, [showCreateModal, showAssignModal, loadUsers]);

  const handleCreate = async () => {
    if (!form.name.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }
    setCreating(true);
    try {
      await api.post('/templates/', {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        technology: form.technology.trim() || undefined,
        created_by: user?.id,
      });
      setShowCreateModal(false);
      setForm({ name: '', description: '', technology: '' });
      load();
      Alert.alert('Success', 'Check list created');
    } catch (e: any) {
      const msg = (e?.message || '').toLowerCase();
      const is404 = msg.includes('404') || e?.status === 404;
      Alert.alert(
        'Error',
        is404
          ? 'The checklists API is not available. Contact your admin to enable this feature.'
          : (e?.message || 'Failed to create check list')
      );
    } finally {
      setCreating(false);
    }
  };

  const openAssign = (template: any) => {
    setSelectedTemplate(template);
    setSelectedUserId('');
    setShowAssignModal(true);
  };

  const handleAssign = async () => {
    if (!selectedTemplate || !selectedUserId) {
      Alert.alert('Error', 'Select a user');
      return;
    }
    setAssigning(true);
    try {
      await api.post('/templates/assignments/', {
        template_id: selectedTemplate.id,
        user_id: selectedUserId,
        assigned_by: user?.id,
      });
      setShowAssignModal(false);
      setSelectedTemplate(null);
      setSelectedUserId('');
      load();
      Alert.alert('Success', 'User assigned');
    } catch (e: any) {
      const msg = (e?.message || '').toLowerCase();
      const is404 = msg.includes('404') || e?.status === 404;
      Alert.alert(
        'Error',
        is404
          ? 'The checklists API is not available. Contact your admin to enable this feature.'
          : (e?.message || 'Failed to assign user')
      );
    } finally {
      setAssigning(false);
    }
  };

  const getUserName = (u: any) => u.profile?.full_name || u.full_name || u.email || '—';

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
            <Text style={styles.title}>Check Lists</Text>
            <Text style={styles.subtitle}>Create and assign check lists</Text>
          </View>
          {isAdmin && (
            <TouchableOpacity style={styles.addBtn} onPress={() => setShowCreateModal(true)}>
              <Text style={styles.addBtnText}>+ Create</Text>
            </TouchableOpacity>
          )}
        </View>

        {templates.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No check lists yet</Text>
            {isAdmin && (
              <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowCreateModal(true)}>
                <Text style={styles.emptyBtnText}>Create check list</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          templates.map((t: any) => (
            <View key={t.id} style={styles.card}>
              <Text style={styles.cardTitle}>{t.name || 'Unnamed'}</Text>
              {t.description && <Text style={styles.cardMeta}>{t.description}</Text>}
              {isAdmin && (
                <TouchableOpacity style={styles.assignBtn} onPress={() => openAssign(t)}>
                  <Text style={styles.assignBtnText}>Assign to user</Text>
                </TouchableOpacity>
              )}
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={showCreateModal} transparent animationType="fade">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Create Check List</Text>
            <Text style={styles.label}>Name *</Text>
            <TextInput
              style={styles.input}
              value={form.name}
              onChangeText={(t) => setForm({ ...form, name: t })}
              placeholder="Check list name"
              placeholderTextColor="#94a3b8"
            />
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.inputArea]}
              value={form.description}
              onChangeText={(t) => setForm({ ...form, description: t })}
              placeholder="Optional"
              placeholderTextColor="#94a3b8"
              multiline
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setShowCreateModal(false)}>
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtnOk, creating && styles.disabled]}
                onPress={handleCreate}
                disabled={creating}
              >
                {creating ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalBtnOkText}>Create</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showAssignModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Assign to User</Text>
            {selectedTemplate && (
              <Text style={styles.assignHint}>Assign "{selectedTemplate.name}" to:</Text>
            )}
            <ScrollView style={styles.userList} nestedScrollEnabled>
              {users.map((u: any) => (
                <TouchableOpacity
                  key={u.id}
                  style={[styles.userRow, selectedUserId === u.id && styles.userRowSelected]}
                  onPress={() => setSelectedUserId(selectedUserId === u.id ? '' : u.id)}
                >
                  <Text style={[styles.userRowText, selectedUserId === u.id && styles.userRowTextSelected]}>
                    {getUserName(u)}
                  </Text>
                  <Text style={[styles.userRowEmail, selectedUserId === u.id && styles.userRowEmailSelected]}>{u.email}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setShowAssignModal(false)}>
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtnOk, (assigning || !selectedUserId) && styles.disabled]}
                onPress={handleAssign}
                disabled={assigning || !selectedUserId}
              >
                {assigning ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalBtnOkText}>Assign</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
  cardMeta: { fontSize: 13, color: '#64748b', marginTop: 4 },
  assignBtn: { marginTop: 12, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#e2e8f0', borderRadius: 8, alignSelf: 'flex-start' },
  assignBtnText: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  emptyCard: { padding: 24, backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#0f172a', marginBottom: 12 },
  emptyBtn: { paddingVertical: 10, paddingHorizontal: 20, backgroundColor: '#0f172a', borderRadius: 8 },
  emptyBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalBox: { backgroundColor: '#fff', borderRadius: 16, padding: 24, maxHeight: '80%' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 16 },
  label: { fontSize: 12, color: '#64748b', marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, fontSize: 16, color: '#0f172a' },
  inputArea: { minHeight: 60, textAlignVertical: 'top' },
  assignHint: { fontSize: 14, color: '#64748b', marginBottom: 12 },
  userList: { maxHeight: 200, marginBottom: 16 },
  userRow: { padding: 14, borderRadius: 8, marginBottom: 4, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
  userRowSelected: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  userRowText: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  userRowTextSelected: { color: '#fff' },
  userRowEmail: { fontSize: 13, color: '#64748b', marginTop: 2 },
  userRowEmailSelected: { color: 'rgba(255,255,255,0.8)' },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 16 },
  modalBtnCancel: { flex: 1, padding: 14, borderRadius: 8, backgroundColor: '#f1f5f9', alignItems: 'center' },
  modalBtnCancelText: { color: '#0f172a', fontSize: 16, fontWeight: '600' },
  modalBtnOk: { flex: 1, padding: 14, borderRadius: 8, backgroundColor: '#0f172a', alignItems: 'center' },
  modalBtnOkText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.7 },
});
