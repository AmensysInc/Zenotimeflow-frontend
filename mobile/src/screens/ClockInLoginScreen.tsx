import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { useAuth } from '../context/AuthContext';

const MAIN_LOGIN_PATH = '/auth';

function goToMainLogin() {
  if (Platform.OS === 'web' && typeof globalThis !== 'undefined') {
    const w = (globalThis as any).window;
    if (w?.location) {
      w.location.href = MAIN_LOGIN_PATH;
      return;
    }
  }
  Linking.openURL(MAIN_LOGIN_PATH).catch(() => {});
}

export default function ClockInLoginScreen({ onBack }: { onBack: () => void }) {
  const { login, isLoading } = useAuth();
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');

  const handleClockInLogin = async () => {
    const u = username.trim();
    const p = pin.trim();
    if (!u || !p) {
      Alert.alert('Error', 'Please enter username and PIN');
      return;
    }
    try {
      await login(u, p, { intent: 'clockin' });
    } catch (err: any) {
      Alert.alert('Login failed', err?.message || 'Invalid username or PIN');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={goToMainLogin} style={styles.backButton}>
          <Text style={styles.backText}>← Main login</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.card}>
        <Text style={styles.title}>Welcome to Zeno Time Flow</Text>
        <Text style={styles.subtitle}>Sign in to clock in and manage your time</Text>

        <TextInput
          style={styles.input}
          placeholder="Username"
          placeholderTextColor="#94a3b8"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isLoading}
        />
        <TextInput
          style={styles.input}
          placeholder="PIN"
          placeholderTextColor="#94a3b8"
          value={pin}
          onChangeText={setPin}
          secureTextEntry
          keyboardType="number-pad"
          maxLength={8}
          editable={!isLoading}
        />
        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleClockInLogin}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Sign In</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 48,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  backButton: {
    alignSelf: 'flex-start',
  },
  backText: {
    color: '#64748b',
    fontSize: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 24,
  },
  input: {
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    padding: 14,
    color: '#0f172a',
    fontSize: 16,
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 16,
    marginTop: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
