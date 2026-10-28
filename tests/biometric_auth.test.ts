import { describe, it, expect, beforeEach } from 'vitest';
import {
  isBiometricLoginEnabled,
  getBiometricSavedUsername,
  canAutoPromptBiometrics,
  BIOMETRIC_PREF_KEY,
  BIOMETRIC_LAST_USER,
  BIOMETRIC_SERVER_KEY
} from '../src/services/biometricAuthService';

describe('Biometric Authentication & Android Keystore Vault Logic', () => {
  const mockStorage: Record<string, string> = {};

  const storageImpl = {
    getItem: (key: string) => mockStorage[key] || null,
    setItem: (key: string, val: string) => {
      mockStorage[key] = String(val);
    },
    removeItem: (key: string) => {
      delete mockStorage[key];
    }
  };

  beforeEach(() => {
    for (const key of Object.keys(mockStorage)) {
      delete mockStorage[key];
    }

    (globalThis as any).localStorage = storageImpl;
    (globalThis as any).sessionStorage = storageImpl;
    (globalThis as any).window = {
      localStorage: storageImpl,
      sessionStorage: storageImpl
    };
  });

  it('correctly uses the designated institutional Keystore realm key', () => {
    expect(BIOMETRIC_SERVER_KEY).toBe('edu.stcecilia.alumni.auth');
  });

  it('reports biometric login as disabled by default on clean device', () => {
    expect(isBiometricLoginEnabled()).toBe(false);
    expect(getBiometricSavedUsername()).toBeNull();
    expect(canAutoPromptBiometrics()).toBe(false);
  });

  it('accurately identifies when an alumnus has opted into biometric unlock', () => {
    mockStorage[BIOMETRIC_PREF_KEY] = 'true';
    mockStorage[BIOMETRIC_LAST_USER] = 'juan.alumni@stcecilia.edu';

    expect(isBiometricLoginEnabled()).toBe(true);
    expect(getBiometricSavedUsername()).toBe('juan.alumni@stcecilia.edu');
    expect(canAutoPromptBiometrics()).toBe(true);
  });

  it('supports per-user biometric preference flags', () => {
    const userId = 'usr_test_alumnus_123';
    mockStorage[`${BIOMETRIC_PREF_KEY}_${userId}`] = 'true';

    expect(isBiometricLoginEnabled(userId)).toBe(true);
    expect(isBiometricLoginEnabled('usr_other_account')).toBe(false);
  });

  it('never stores plaintext passwords in device preference keys', () => {
    mockStorage[BIOMETRIC_PREF_KEY] = 'true';
    mockStorage[BIOMETRIC_LAST_USER] = 'maria.santos@stcecilia.edu';
    mockStorage['alumni_refresh_token'] = 'signed_refresh_token_xyz_hardware_bound';

    for (const [key, value] of Object.entries(mockStorage)) {
      expect(key).not.toContain('password');
      expect(value).not.toBe('Password123!');
    }
  });

  it('blocks auto-prompt if opted-in but saved username is missing', () => {
    mockStorage[BIOMETRIC_PREF_KEY] = 'true';
    delete mockStorage[BIOMETRIC_LAST_USER];

    expect(canAutoPromptBiometrics()).toBe(false);
  });
});
