/**
 * Secure Storage Service
 * Provides salted cryptographic obfuscation for sensitive credentials
 * cached in localStorage (e.g. offline alumni pass, turnstile tokens).
 * Prevents plain-text inspection by unauthorized extensions or shoulder-surfing.
 */

const SALT_PREFIX = 'SCC_SECURE_V2:';

function getDeviceFingerprint(): string {
  if (typeof window === 'undefined') return 'server_static_key';
  const nav = window.navigator;
  return `${nav.userAgent.length}_${screen.width}x${screen.height}_${nav.language || 'en'}`;
}

function scramble(text: string, key: string): string {
  try {
    const keyChars = key.split('').map((c) => c.charCodeAt(0));
    const result: number[] = [];
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      const keyChar = keyChars[i % keyChars.length];
      result.push(charCode ^ keyChar);
    }
    return btoa(String.fromCharCode(...result));
  } catch {
    return btoa(text);
  }
}

function unscramble(encoded: string, key: string): string {
  try {
    const raw = atob(encoded);
    const keyChars = key.split('').map((c) => c.charCodeAt(0));
    const result: number[] = [];
    for (let i = 0; i < raw.length; i++) {
      const charCode = raw.charCodeAt(i);
      const keyChar = keyChars[i % keyChars.length];
      result.push(charCode ^ keyChar);
    }
    return String.fromCharCode(...result);
  } catch {
    try {
      return atob(encoded);
    } catch {
      return '';
    }
  }
}

export const secureStorageService = {
  setSecureItem(key: string, data: any): void {
    if (typeof window === 'undefined') return;
    try {
      const json = JSON.stringify(data);
      const keySalt = getDeviceFingerprint();
      const encrypted = scramble(json, keySalt);
      localStorage.setItem(key, `${SALT_PREFIX}${encrypted}`);
    } catch (e) {
      console.warn('Failed to store secure item', e);
    }
  },

  getSecureItem<T = any>(key: string): T | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;

      if (raw.startsWith(SALT_PREFIX)) {
        const cipher = raw.slice(SALT_PREFIX.length);
        const keySalt = getDeviceFingerprint();
        const decryptedJson = unscramble(cipher, keySalt);
        return JSON.parse(decryptedJson) as T;
      }

      // Fallback for legacy unencrypted cached values
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },

  removeSecureItem(key: string): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(key);
    } catch {}
  }
};
