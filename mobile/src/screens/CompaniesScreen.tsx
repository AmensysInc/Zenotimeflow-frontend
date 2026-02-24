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
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useUserRole } from '../hooks/useUserRole';
import { getCompanies, getOrganizations, createOrganization, createCompany } from '../api/extensions';

function getOrgId(c: any): string | null {
  const o = c.organization_id ?? c.organization;
  if (!o) return null;
  return typeof o === 'string' ? o : (o?.id ?? null);
}

export default function CompaniesScreen() {
  const { user } = useAuth();
  const { role } = useUserRole();
  const isOrganizationManager = role === 'operations_manager';
  const [companies, setCompanies] = useState<any[]>([]);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showOrgModal, setShowOrgModal] = useState(false);
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyOrgId, setCompanyOrgId] = useState('');
  const [creating, setCreating] = useState(false);

  const isSuperAdmin = role === 'super_admin';
  const canCreateOrg = isSuperAdmin;
  const canCreateCompany = isSuperAdmin || isOrganizationManager;
  const showHierarchy = isSuperAdmin;

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      const companyParams: any = {};
      if (isOrganizationManager && user?.id) companyParams.organization_manager = user.id;
      const orgParams = isOrganizationManager && user?.id ? { organization_manager: user.id } : {};
      const [rawCompanies, rawOrgs] = await Promise.all([
        getCompanies(Object.keys(companyParams).length ? companyParams : {}),
        isSuperAdmin ? getOrganizations({}) : isOrganizationManager ? getOrganizations(orgParams) : Promise.resolve([]),
      ]);
      setCompanies(Array.isArray(rawCompanies) ? rawCompanies : []);
      setOrganizations(Array.isArray(rawOrgs) ? rawOrgs : []);
    } catch (e) {
      console.warn(e);
      setCompanies([]);
      setOrganizations([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, isSuperAdmin, isOrganizationManager]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreateOrg = async () => {
    if (!orgName.trim()) {
      Alert.alert('Error', 'Organization name is required');
      return;
    }
    setCreating(true);
    try {
      await createOrganization({ name: orgName.trim() });
      setShowOrgModal(false);
      setOrgName('');
      load();
      Alert.alert('Success', 'Organization created');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to create organization');
    } finally {
      setCreating(false);
    }
  };

  const openCreateCompany = (orgId: string) => {
    setCompanyOrgId(orgId);
    setCompanyName('');
    setShowCompanyModal(true);
  };

  const handleCreateCompany = async () => {
    if (!companyName.trim()) {
      Alert.alert('Error', 'Company name is required');
      return;
    }
    if (showHierarchy && organizations.length > 0 && !companyOrgId) {
      Alert.alert('Error', 'Select an organization');
      return;
    }
    setCreating(true);
    try {
      const payload: any = { name: companyName.trim(), type: 'other' };
      if (companyOrgId) payload.organization_id = companyOrgId;
      await createCompany(payload);
      setShowCompanyModal(false);
      setCompanyName('');
      setCompanyOrgId('');
      load();
      Alert.alert('Success', 'Company created');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to create company');
    } finally {
      setCreating(false);
    }
  };

  const filteredCompanies = companies;
  const filteredOrgs = organizations;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0f172a" />
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
      <View style={styles.header}>
        <Text style={styles.title}>Organization Management</Text>
        <View style={styles.headerRow}>
          <Text style={styles.subtitle}>Manage organizations and companies</Text>
          {canCreateOrg && (
            <TouchableOpacity style={styles.addBtn} onPress={() => setShowOrgModal(true)}>
              <Text style={styles.addBtnText}>+ Org</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {showHierarchy ? (
        filteredOrgs.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No organizations found</Text>
            {canCreateOrg && (
              <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowOrgModal(true)}>
                <Text style={styles.emptyBtnText}>Create Organization</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filteredOrgs.map((org: any) => {
            const orgCompanies = filteredCompanies.filter((c) => getOrgId(c) === org.id);
            return (
              <View key={org.id} style={styles.orgSection}>
                <View style={styles.orgHeader}>
                  <View>
                    <Text style={styles.orgName}>{org.name || 'Unnamed'}</Text>
                    <Text style={styles.orgMeta}>
                      {orgCompanies.length} {orgCompanies.length === 1 ? 'company' : 'companies'}
                    </Text>
                  </View>
                </View>
                <View style={styles.companiesGrid}>
                  {orgCompanies.map((c: any) => (
                    <View key={c.id} style={styles.companyCard}>
                      <Text style={styles.cardTitle}>{c.name || 'Unnamed'}</Text>
                      {c.type && <Text style={styles.cardTag}>{c.type}</Text>}
                      {c.employees_count != null && (
                        <Text style={styles.cardMeta}>{c.employees_count} employees</Text>
                      )}
                    </View>
                  ))}
                  {canCreateCompany && (
                    <TouchableOpacity
                      style={styles.addCompanyCard}
                      onPress={() => openCreateCompany(org.id)}
                    >
                      <Text style={styles.addCompanyPlus}>+</Text>
                      <Text style={styles.addCompanyText}>Add Company</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )
      ) : (
        <>
          {canCreateCompany && organizations.length > 0 && (
            <TouchableOpacity
              style={styles.addBtnSecondary}
              onPress={() => openCreateCompany(organizations[0]?.id || '')}
            >
              <Text style={styles.addBtnText}>+ Company</Text>
            </TouchableOpacity>
          )}
          {filteredCompanies.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No companies found</Text>
              {canCreateCompany && organizations.length > 0 && (
                <TouchableOpacity
                  style={styles.emptyBtn}
                  onPress={() => openCreateCompany(organizations[0].id)}
                >
                  <Text style={styles.emptyBtnText}>Create company</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            filteredCompanies.map((c: any) => (
              <View key={c.id} style={styles.card}>
                <Text style={styles.cardTitle}>{c.name || 'Unnamed'}</Text>
                {c.type && <Text style={styles.cardTag}>{c.type}</Text>}
                {c.employees_count != null && (
                  <Text style={styles.cardMeta}>{c.employees_count} employees</Text>
                )}
              </View>
            ))
          )}
        </>
      )}

      <Modal visible={showOrgModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Create Organization</Text>
            <TextInput
              style={styles.input}
              value={orgName}
              onChangeText={setOrgName}
              placeholder="Organization name"
              placeholderTextColor="#94a3b8"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setShowOrgModal(false)}>
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtnOk, creating && styles.disabled]}
                onPress={handleCreateOrg}
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
        </View>
      </Modal>

      <Modal visible={showCompanyModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Create Company</Text>
            {showHierarchy && organizations.length > 1 && (
              <View style={styles.dropdownWrap}>
                <Text style={styles.inputLabel}>Organization</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.orgPicker}>
                  {organizations.map((o: any) => (
                    <TouchableOpacity
                      key={o.id}
                      style={[styles.orgChip, companyOrgId === o.id && styles.orgChipSelected]}
                      onPress={() => setCompanyOrgId(companyOrgId === o.id ? '' : o.id)}
                    >
                      <Text style={[styles.orgChipText, companyOrgId === o.id && styles.orgChipTextSelected]}>
                        {o.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
            {showHierarchy && organizations.length === 1 && (
              <Text style={styles.orgHint}>Organization: {organizations[0]?.name}</Text>
            )}
            <TextInput
              style={styles.input}
              value={companyName}
              onChangeText={setCompanyName}
              placeholder="Company name"
              placeholderTextColor="#94a3b8"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setShowCompanyModal(false)}>
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtnOk, creating && styles.disabled]}
                onPress={handleCreateCompany}
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
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  content: { padding: 20, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' },
  header: { marginBottom: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, gap: 12, flexWrap: 'wrap' },
  title: { fontSize: 20, fontWeight: '700', color: '#0f172a' },
  subtitle: { fontSize: 13, color: '#64748b', flex: 1 },
  addBtn: { backgroundColor: '#0f172a', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  addBtnSecondary: { alignSelf: 'flex-start', backgroundColor: '#0f172a', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, marginBottom: 16 },
  addBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  orgSection: { marginBottom: 24, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, overflow: 'hidden' },
  orgHeader: { backgroundColor: '#f8fafc', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  orgName: { fontSize: 18, fontWeight: '600', color: '#0f172a' },
  orgMeta: { fontSize: 13, color: '#64748b', marginTop: 4 },
  companiesGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 12 },
  companyCard: {
    width: '47%',
    padding: 14,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  card: { padding: 16, marginBottom: 12, backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a', marginBottom: 4 },
  cardTag: { fontSize: 12, color: '#64748b', marginTop: 2 },
  cardMeta: { fontSize: 13, color: '#64748b', marginTop: 2 },
  addCompanyCard: {
    width: '47%',
    minHeight: 100,
    padding: 14,
    backgroundColor: 'transparent',
    borderRadius: 10,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#94a3b8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCompanyPlus: { fontSize: 24, color: '#94a3b8', marginBottom: 4 },
  addCompanyText: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  emptyCard: { padding: 24, backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
  emptyText: { fontSize: 15, color: '#64748b', marginBottom: 12 },
  emptyBtn: { paddingVertical: 10, paddingHorizontal: 20, backgroundColor: '#0f172a', borderRadius: 8 },
  emptyBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modalBox: { backgroundColor: '#fff', borderRadius: 16, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 16 },
  inputLabel: { fontSize: 12, color: '#64748b', marginBottom: 6 },
  orgHint: { fontSize: 13, color: '#64748b', marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#0f172a',
    marginBottom: 16,
  },
  dropdownWrap: { marginBottom: 12 },
  orgPicker: { maxHeight: 80 },
  orgChip: { paddingHorizontal: 12, paddingVertical: 8, marginRight: 8, marginBottom: 4, backgroundColor: '#f1f5f9', borderRadius: 8 },
  orgChipSelected: { backgroundColor: '#0f172a' },
  orgChipText: { fontSize: 14, color: '#0f172a' },
  orgChipTextSelected: { color: '#fff' },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalBtnCancel: { flex: 1, padding: 14, borderRadius: 8, backgroundColor: '#f1f5f9', alignItems: 'center' },
  modalBtnCancelText: { color: '#0f172a', fontSize: 16, fontWeight: '600' },
  modalBtnOk: { flex: 1, padding: 14, borderRadius: 8, backgroundColor: '#0f172a', alignItems: 'center' },
  modalBtnOkText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.7 },
});
