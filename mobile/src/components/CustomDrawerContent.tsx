import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { DrawerContentScrollView, DrawerItemList } from '@react-navigation/drawer';
import { useAuth } from '../context/AuthContext';
import { useUserRole } from '../hooks/useUserRole';

const theme = {
  bg: '#ffffff',
  text: '#0f172a',
  textMuted: '#64748b',
  border: '#e2e8f0',
  accent: '#3b82f6',
  danger: '#ef4444',
};

export default function CustomDrawerContent(props: any) {
  const { user, logout } = useAuth();
  const { role } = useUserRole();
  const roleLabel = role === 'super_admin' ? 'Super Admin' : role === 'operations_manager' ? 'Org Manager' : role === 'manager' ? 'Company Manager' : role === 'admin' ? 'Admin' : '';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>Zeno Time Flow</Text>
        {roleLabel ? <Text style={styles.role}>{roleLabel}</Text> : null}
        {user?.email ? <Text style={styles.email} numberOfLines={1}>{user.email}</Text> : null}
      </View>
      <DrawerContentScrollView {...props} contentContainerStyle={styles.scroll} style={styles.drawer}>
        <DrawerItemList {...props} />
      </DrawerContentScrollView>
      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  header: { padding: 20, paddingTop: 48, borderBottomWidth: 1, borderBottomColor: theme.border },
  logo: { fontSize: 18, fontWeight: '700', color: theme.text, marginBottom: 4 },
  role: { fontSize: 12, color: theme.accent, fontWeight: '600', marginBottom: 2 },
  email: { fontSize: 12, color: theme.textMuted },
  scroll: { paddingTop: 16 },
  drawer: { flex: 1 },
  logoutBtn: { padding: 16, margin: 16, marginTop: 8, borderTopWidth: 1, borderTopColor: theme.border },
  logoutText: { color: theme.danger, fontSize: 15, fontWeight: '600' },
});
