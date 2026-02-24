/**
 * Biometric (Face ID / Fingerprint) authentication for login.
 * Uses expo-local-authentication + expo-secure-store.
 */
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const BIOMETRIC_AUTH_KEY = 'zeno_biometric_auth';

export type BiometricType = 'fingerprint' | 'facial' | 'iris' | 'none';

export interface BiometricStatus {
  available: boolean;
  type: BiometricType;
  label: string;
}

export async function getBiometricStatus(): Promise<BiometricStatus> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) {
      return { available: false, type: 'none', label: '' };
    }
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!enrolled) {
      return { available: false, type: 'none', label: '' };
    }
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      return { available: true, type: 'facial', label: 'Face ID' };
    }
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      return { available: true, type: 'fingerprint', label: 'Fingerprint' };
    }
    if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
      return { available: true, type: 'iris', label: 'Iris' };
    }
    return { available: false, type: 'none', label: '' };
  } catch {
    return { available: false, type: 'none', label: '' };
  }
}

export async function authenticateWithBiometrics(reason?: string): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason ?? 'Authenticate to sign in',
      cancelLabel: 'Cancel',
      fallbackLabel: 'Use password',
    });
    return result.success;
  } catch {
    return false;
  }
}

/** Store auth data for biometric unlock (call after successful email+PIN login). */
export async function storeAuthForBiometrics(data: {
  access: string;
  refresh?: string;
  authData: any;
}): Promise<void> {
  try {
    await SecureStore.setItemAsync(BIOMETRIC_AUTH_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Could not store auth for biometrics:', e);
  }
}

/** Check if we have stored auth that biometrics can unlock. */
export async function hasStoredBiometricAuth(): Promise<boolean> {
  try {
    const raw = await SecureStore.getItemAsync(BIOMETRIC_AUTH_KEY);
    return !!raw;
  } catch {
    return false;
  }
}

/** Retrieve stored auth after successful biometric auth. Returns null if none or failed. */
export async function getStoredBiometricAuth(): Promise<{
  access: string;
  refresh?: string;
  authData: any;
} | null> {
  try {
    const raw = await SecureStore.getItemAsync(BIOMETRIC_AUTH_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Clear stored biometric auth (call on logout). */
export async function clearBiometricAuth(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(BIOMETRIC_AUTH_KEY);
  } catch {
    // ignore
  }
}
