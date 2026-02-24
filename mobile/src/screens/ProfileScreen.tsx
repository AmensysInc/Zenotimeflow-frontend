import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useUserRole } from '../hooks/useUserRole';

export default function ProfileScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user, employee, logout } = useAuth();
  const { role } = useUserRole();

  const handleLogout = () => {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: logout },
    ]);
  };

  const roleLabel = role === 'super_admin' ? 'Super Admin' : role === 'operations_manager' ? 'Org Manager' : role === 'manager' ? 'Company Manager' : role === 'admin' ? 'Admin' : role === 'employee' ? 'Employee' : role || 'User';

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 20) }]}>
      <Text style={styles.title}>Profile</Text>
      {role && <Text style={styles.roleBadge}>{roleLabel}</Text>}
      <View style={styles.card}>
        {user && (
          <>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>{user.email ?? '—'}</Text>
            {user.full_name && (
              <>
                <Text style={styles.label}>Name</Text>
                <Text style={styles.value}>{user.full_name}</Text>
              </>
            )}
          </>
        )}
        {employee && (
          <>
            <Text style={styles.label}>Employee</Text>
            <Text style={styles.value}>
              {employee.first_name} {employee.last_name}
            </Text>
          </>
        )}
      </View>
      <TouchableOpacity
        style={styles.accountLink}
        onPress={() => navigation.getParent()?.navigate?.('Menu', { screen: 'Account' })}
      >
        <Text style={styles.accountLinkText}>Account settings →</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  content: { padding: 20, paddingBottom: 48 },
  title: { fontSize: 24, fontWeight: '700', color: '#0f172a', marginBottom: 8 },
  roleBadge: { fontSize: 13, color: '#0f172a', marginBottom: 20, fontWeight: '600' },
  card: { backgroundColor: '#f8fafc', borderRadius: 12, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  accountLink: { padding: 14, marginBottom: 24, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12 },
  accountLinkText: { color: '#3b82f6', fontSize: 14, fontWeight: '600' },
  label: { fontSize: 12, color: '#64748b', marginBottom: 4 },
  value: { fontSize: 16, color: '#0f172a', marginBottom: 16 },
  logoutButton: { backgroundColor: '#0f172a', padding: 16, borderRadius: 12, alignItems: 'center' },
  logoutButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
