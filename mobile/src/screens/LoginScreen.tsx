import React, { useState, useEffect } from 'react';
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
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { getBiometricStatus, hasStoredBiometricAuth } from '../utils/biometrics';

export default function LoginScreen({ onClockIn }: { onClockIn?: () => void }) {
  const insets = useSafeAreaInsets();
  const { login, loginWithBiometrics, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState('');
  const [showBiometric, setShowBiometric] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [status, hasStored] = await Promise.all([
        getBiometricStatus(),
        hasStoredBiometricAuth(),
      ]);
      if (!cancelled && status.available && hasStored) {
        setBiometricAvailable(true);
        setBiometricLabel(status.label || (status.type === 'facial' ? 'Face ID' : 'Fingerprint'));
        setShowBiometric(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleLogin = async () => {
    const e = email.trim();
    const p = password.trim();
    if (!e || !p) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }
    try {
      await login(e, p, { intent: 'full', usePassword: true });
    } catch (err: any) {
      Alert.alert('Login failed', err?.message || 'Invalid email or password');
    }
  };

  const handleBiometricLogin = async () => {
    setBiometricLoading(true);
    try {
      await loginWithBiometrics();
    } catch (err: any) {
      Alert.alert('Biometric login failed', err?.message || 'Please try again');
    } finally {
      setBiometricLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      {onClockIn && (
        <View style={[styles.headerRow, { paddingTop: Math.max(insets.top, 16) }]}>
          <View style={styles.headerSpacer} />
          <TouchableOpacity onPress={onClockIn} style={styles.clockInLink}>
            <Text style={styles.clockInLinkText}>Clock in</Text>
          </TouchableOpacity>
        </View>
      )}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.title}>Zeno Time Flow</Text>
          <Text style={styles.subtitle}>Sign in to Zeno Time Flow</Text>

          {showBiometric && (
            <>
              <TouchableOpacity
                style={[styles.biometricButton, (isLoading || biometricLoading) && styles.buttonDisabled]}
                onPress={handleBiometricLogin}
                disabled={isLoading || biometricLoading}
              >
                {biometricLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.biometricIcon}>{biometricLabel.includes('Face') ? '👤' : '👆'}</Text>
                    <Text style={styles.biometricText}>Use {biometricLabel}</Text>
                  </>
                )}
              </TouchableOpacity>
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or sign in with email & password</Text>
                <View style={styles.dividerLine} />
              </View>
            </>
          )}

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#94a3b8"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!isLoading}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#94a3b8"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            editable={!isLoading}
          />
          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Sign in with Email & Password</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  headerSpacer: { flex: 1 },
  clockInLink: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  clockInLinkText: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '600',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    paddingVertical: 24,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  title: {
    fontSize: 24,
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
  biometricButton: {
    backgroundColor: '#8b5cf6',
    borderRadius: 10,
    padding: 16,
    marginBottom: 20,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  biometricIcon: {
    fontSize: 22,
  },
  biometricText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#334155',
  },
  dividerText: {
    color: '#64748b',
    fontSize: 12,
    marginHorizontal: 12,
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
