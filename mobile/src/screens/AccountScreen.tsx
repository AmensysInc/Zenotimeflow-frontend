import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

export default function AccountScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const [profile, setProfile] = useState({ full_name: '', email: '', mobile_number: '' });
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });

  useEffect(() => {
    if (user) fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    try {
      const userData = (await api.get('/auth/user/')) as any;
      const p = userData?.profile || {};
      setProfile({
        full_name: p.full_name || userData?.full_name || user?.email?.split('@')[0] || '',
        email: userData?.email || user?.email || '',
        mobile_number: p.mobile_number || '',
      });
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async () => {
    setUpdating(true);
    try {
      await api.patch('/auth/profile/', profile);
      Alert.alert('Success', 'Profile updated');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update profile');
    } finally {
      setUpdating(false);
    }
  };

  const changePassword = async () => {
    if (passwords.newPassword !== passwords.confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    if (passwords.newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }
    setChangingPassword(true);
    try {
      await api.post('/auth/change-password/', {
        current_password: passwords.currentPassword,
        new_password: passwords.newPassword,
      });
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
      Alert.alert('Success', 'Password changed');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to change password');
    } finally {
      setChangingPassword(false);
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
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Account</Text>
        <Text style={styles.subtitle}>Manage your profile and password</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Full name</Text>
          <TextInput
            style={styles.input}
            value={profile.full_name}
            onChangeText={(t) => setProfile({ ...profile, full_name: t })}
            placeholder="Your name"
            placeholderTextColor="#94a3b8"
          />
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={profile.email}
            onChangeText={(t) => setProfile({ ...profile, email: t })}
            placeholder="Email"
            placeholderTextColor="#94a3b8"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Text style={styles.label}>Mobile</Text>
          <TextInput
            style={styles.input}
            value={profile.mobile_number}
            onChangeText={(t) => setProfile({ ...profile, mobile_number: t })}
            placeholder="Mobile number"
            placeholderTextColor="#94a3b8"
            keyboardType="phone-pad"
          />
          <TouchableOpacity
            style={[styles.btn, updating && styles.btnDisabled]}
            onPress={updateProfile}
            disabled={updating}
          >
            {updating ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.btnText}>Update profile</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Change password</Text>
          <Text style={styles.label}>Current password</Text>
          <TextInput
            style={styles.input}
            value={passwords.currentPassword}
            onChangeText={(t) => setPasswords({ ...passwords, currentPassword: t })}
            placeholder="Current password"
            placeholderTextColor="#94a3b8"
            secureTextEntry
          />
          <Text style={styles.label}>New password</Text>
          <TextInput
            style={styles.input}
            value={passwords.newPassword}
            onChangeText={(t) => setPasswords({ ...passwords, newPassword: t })}
            placeholder="New password"
            placeholderTextColor="#94a3b8"
            secureTextEntry
          />
          <Text style={styles.label}>Confirm</Text>
          <TextInput
            style={styles.input}
            value={passwords.confirmPassword}
            onChangeText={(t) => setPasswords({ ...passwords, confirmPassword: t })}
            placeholder="Confirm password"
            placeholderTextColor="#94a3b8"
            secureTextEntry
          />
          <TouchableOpacity
            style={[styles.btn, styles.btnSecondary, changingPassword && styles.btnDisabled]}
            onPress={changePassword}
            disabled={changingPassword}
          >
            {changingPassword ? (
              <ActivityIndicator size="small" color="#0f172a" />
            ) : (
              <Text style={styles.btnSecondaryText}>Change password</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  content: { padding: 20, paddingBottom: 48 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' },
  title: { fontSize: 24, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#64748b', marginBottom: 24 },
  card: { marginBottom: 24, padding: 20, backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a', marginBottom: 12 },
  label: { fontSize: 12, color: '#64748b', marginBottom: 4, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#0f172a',
  },
  btn: { backgroundColor: '#0f172a', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 20 },
  btnSecondary: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#0f172a' },
  btnDisabled: { opacity: 0.7 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  btnSecondaryText: { color: '#0f172a', fontSize: 16, fontWeight: '600' },
});
