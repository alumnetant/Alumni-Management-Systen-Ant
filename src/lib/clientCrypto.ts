/**
 * Client-side cryptographic utilities for secret hashing, identifier digests,
 * PII storage protection, and secret sanitization.
 */

export const PENDING_VERIFICATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const PBKDF2_PREFIX = 'pbkdf2_sha256$';
const PBKDF2_ITERATIONS = 100000;
const ENC_PREFIX = 'enc:v1:';
const CLIENT_PII_KEY_MATERIAL = 'scc_alumnet_client_pii_protection_v1_8b181b';
const PII_FIELDS = ['phone', 'address', 'birthDate', 'studentId', 'alumniId', 'employeeId'] as const;

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function getSubtle(): SubtleCrypto | null {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    return globalThis.crypto.subtle;
  }
  return null;
}

export function isSaltedSecretHash(value?: string | null): boolean {
  return typeof value === 'string' && value.startsWith(PBKDF2_PREFIX);
}

export async function hashSecretClient(secret: string): Promise<string> {
  const normalized = String(secret ?? '');
  if (isSaltedSecretHash(normalized)) return normalized;

  const subtle = getSubtle();
  const cryptoObj = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;

  if (subtle && cryptoObj?.getRandomValues) {
    const salt = cryptoObj.getRandomValues(new Uint8Array(16));
    const keyMaterial = await subtle.importKey(
      'raw',
      new TextEncoder().encode(normalized),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );
    const derivedBits = await subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt,
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-256'
      },
      keyMaterial,
      256
    );
    return `${PBKDF2_PREFIX}${PBKDF2_ITERATIONS}$${toBase64(salt)}$${toBase64(new Uint8Array(derivedBits))}`;
  }

  // Deterministic fallback when WebCrypto subtle is unavailable (e.g. non-HTTPS context)
  let h1 = 0x811c9dc5;
  for (let i = 0; i < normalized.length; i++) {
    h1 ^= normalized.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193);
  }
  return `${PBKDF2_PREFIX}1$fallback$${(h1 >>> 0).toString(16)}`;
}

export async function verifySecretClient(secret: string, stored: string): Promise<boolean> {
  if (!secret || !stored) return false;
  if (!isSaltedSecretHash(stored)) {
    return secret === stored;
  }

  const parts = stored.split('$');
  if (parts.length !== 4) return false;
  const [, iterStr, saltB64, hashB64] = parts;
  if (saltB64 === 'fallback') {
    const recomputed = await hashSecretClient(secret);
    return recomputed === stored;
  }

  const subtle = getSubtle();
  if (!subtle) return false;

  try {
    const iterations = Number(iterStr) || PBKDF2_ITERATIONS;
    const salt = fromBase64(saltB64);
    const keyMaterial = await subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );
    const derivedBits = await subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: salt as BufferSource,
        iterations,
        hash: 'SHA-256'
      },
      keyMaterial,
      256
    );
    const derivedB64 = toBase64(new Uint8Array(derivedBits));
    if (derivedB64.length !== hashB64.length) return false;
    let diff = 0;
    for (let i = 0; i < derivedB64.length; i++) {
      diff |= derivedB64.charCodeAt(i) ^ hashB64.charCodeAt(i);
    }
    return diff === 0;
  } catch {
    return false;
  }
}

export async function hashIdentifierDigest(value?: string | null): Promise<string | undefined> {
  if (!value || typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;

  const subtle = getSubtle();
  if (subtle) {
    const digest = await subtle.digest('SHA-256', new TextEncoder().encode(normalized));
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function stripPlaintextSecretsFromUser<T extends Record<string, any>>(user: T): T {
  if (!user || typeof user !== 'object') return user;
  const copy = { ...user };
  if ('password' in copy) {
    delete copy.password;
  }
  if ('pin' in copy) {
    delete copy.pin;
  }
  return copy;
}

async function getPiiAesKey(): Promise<CryptoKey | null> {
  const subtle = getSubtle();
  if (!subtle) return null;
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(CLIENT_PII_KEY_MATERIAL));
  return subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function encryptUserPiiForStorage<T extends Record<string, any>>(user: T): Promise<T> {
  if (!user || typeof user !== 'object') return user;
  const copy: Record<string, any> = stripPlaintextSecretsFromUser(user);
  const subtle = getSubtle();
  const cryptoObj = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (!subtle || !cryptoObj?.getRandomValues) return copy as T;

  try {
    const key = await getPiiAesKey();
    if (!key) return copy as T;
    for (const field of PII_FIELDS) {
      const val = copy[field];
      if (typeof val === 'string' && val.length > 0 && !val.startsWith(ENC_PREFIX)) {
        const iv = cryptoObj.getRandomValues(new Uint8Array(12));
        const cipher = await subtle.encrypt(
          { name: 'AES-GCM', iv },
          key,
          new TextEncoder().encode(val)
        );
        copy[field] = `${ENC_PREFIX}${toBase64(iv)}:${toBase64(new Uint8Array(cipher))}`;
      }
    }
  } catch {
    // Keep original field values if WebCrypto encryption fails
  }
  return copy as T;
}

export async function decryptUserPiiFromStorage<T extends Record<string, any>>(user: T): Promise<T> {
  if (!user || typeof user !== 'object') return user;
  const copy: Record<string, any> = { ...user };
  const subtle = getSubtle();
  if (!subtle) return copy as T;

  try {
    const key = await getPiiAesKey();
    if (!key) return copy as T;
    for (const field of PII_FIELDS) {
      const val = copy[field];
      if (typeof val === 'string' && val.startsWith(ENC_PREFIX)) {
        const rest = val.slice(ENC_PREFIX.length);
        const [ivB64, cipherB64] = rest.split(':');
        if (ivB64 && cipherB64) {
          const iv = fromBase64(ivB64);
          const cipher = fromBase64(cipherB64);
          const plain = await subtle.decrypt(
            { name: 'AES-GCM', iv: iv as BufferSource },
            key,
            cipher as BufferSource
          );
          copy[field] = new TextDecoder().decode(plain);
        }
      }
    }
  } catch {
    // Gracefully leave field unchanged if encrypted under a different key
  }
  return copy as T;
}
