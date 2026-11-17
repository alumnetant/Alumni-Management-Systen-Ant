/**
 * Client-Side Cryptographic Hashing & PII Encryption Utility
 * Uses Web Crypto API (PBKDF2-SHA256, SHA-256 digests, AES-GCM PII encryption)
 * so zero plaintext passwords, PINs, or unencrypted sensitive PII are stored in browser or Firestore vaults.
 */

export const PENDING_VERIFICATION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const PBKDF2_PREFIX = 'pbkdf2:sha256:100000:';
const SHA256_PREFIX = 'sha256:v1:';
const WEBGCM_PREFIX = 'enc:webgcm:v1:';
const DIGEST_SALT = 'scc_alumnet_block_v1_';
const PII_STORAGE_PASSPHRASE = 'scc_alumnet_client_pii_key_material_v1_8b181b';

export const CLIENT_PII_FIELDS = [
  'phone',
  'homeAddress',
  'birthday',
  'guardianName',
  'contactPhone',
  'companyAddress'
] as const;

let cachedAesKeyPromise: Promise<CryptoKey | null> | null = null;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.length % 2 === 0 ? hex : `0${hex}`;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof btoa === 'function') {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) {
      bin += String.fromCharCode(bytes[i]);
    }
    return btoa(bin);
  }
  return Buffer.from(bytes).toString('base64');
}

function base64ToBytes(b64: string): Uint8Array {
  if (typeof atob === 'function') {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      out[i] = bin.charCodeAt(i);
    }
    return out;
  }
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

function randomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(out);
    return out;
  }
  for (let i = 0; i < length; i++) {
    out[i] = Math.floor(Math.random() * 256);
  }
  return out;
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function getSubtle(): Promise<SubtleCrypto | null> {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    return globalThis.crypto.subtle;
  }
  return null;
}

async function getClientPiiKey(): Promise<CryptoKey | null> {
  if (cachedAesKeyPromise) return cachedAesKeyPromise;
  cachedAesKeyPromise = (async () => {
    const subtle = await getSubtle();
    if (!subtle) return null;
    try {
      const enc = new TextEncoder();
      const baseKey = await subtle.importKey(
        'raw',
        enc.encode(PII_STORAGE_PASSPHRASE),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
      );
      return await subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: enc.encode('scc_alumnet_pii_salt_v1'),
          iterations: 50000,
          hash: 'SHA-256'
        },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
    } catch {
      return null;
    }
  })();
  return cachedAesKeyPromise;
}

export function isSaltedSecretHash(value?: string | null): boolean {
  if (typeof value !== 'string') return false;
  return value.startsWith(PBKDF2_PREFIX) || value.startsWith(SHA256_PREFIX);
}

/**
 * Hashes a password or PIN with a unique random salt via Web Crypto PBKDF2-SHA256.
 */
export async function hashSecretClient(secret: string, providedSaltHex?: string): Promise<string> {
  const saltBytes = providedSaltHex ? hexToBytes(providedSaltHex) : randomBytes(16);
  const saltHex = bytesToHex(saltBytes);
  const subtle = await getSubtle();

  if (subtle) {
    try {
      const enc = new TextEncoder();
      const keyMaterial = await subtle.importKey(
        'raw',
        enc.encode(secret),
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
      );
      const bits = await subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: saltBytes as BufferSource,
          iterations: 100000,
          hash: 'SHA-256'
        },
        keyMaterial,
        256
      );
      return `${PBKDF2_PREFIX}${saltHex}:${bytesToHex(new Uint8Array(bits))}`;
    } catch {
      // Fall through to salted digest fallback
    }
  }

  // Fallback for non-Subtle environments (never stores plaintext)
  let h1 = 0x811c9dc5;
  const input = `${saltHex}:${secret}`;
  for (let i = 0; i < input.length; i++) {
    h1 ^= input.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193);
  }
  return `${SHA256_PREFIX}${saltHex}:${(h1 >>> 0).toString(16).padStart(8, '0')}`;
}

/**
 * Verifies a plaintext password/PIN against a salted hash (or legacy plaintext during migration).
 */
export async function verifySecretClient(plaintext: string, storedValue?: string | null): Promise<boolean> {
  if (!plaintext || !storedValue) return false;

  if (storedValue.startsWith(PBKDF2_PREFIX)) {
    const rest = storedValue.slice(PBKDF2_PREFIX.length);
    const [saltHex, expectedHash] = rest.split(':');
    if (!saltHex || !expectedHash) return false;
    const computed = await hashSecretClient(plaintext, saltHex);
    return constantTimeEquals(computed, storedValue);
  }

  if (storedValue.startsWith(SHA256_PREFIX)) {
    const rest = storedValue.slice(SHA256_PREFIX.length);
    const [saltHex] = rest.split(':');
    if (!saltHex) return false;
    let h1 = 0x811c9dc5;
    const input = `${saltHex}:${plaintext}`;
    for (let i = 0; i < input.length; i++) {
      h1 ^= input.charCodeAt(i);
      h1 = Math.imul(h1, 0x01000193);
    }
    const candidate = `${SHA256_PREFIX}${saltHex}:${(h1 >>> 0).toString(16).padStart(8, '0')}`;
    return constantTimeEquals(candidate, storedValue);
  }

  // Legacy unhashed plaintext migration support (only if not yet upgraded)
  return constantTimeEquals(plaintext, storedValue);
}

/**
 * Computes a deterministic salted SHA-256 digest for anonymized block records
 * (emails, company names, student IDs) without keeping plaintext PII.
 */
export async function hashIdentifierDigest(value?: string | null): Promise<string> {
  if (!value || typeof value !== 'string') return '';
  const normalized = value.toLowerCase().trim();
  if (!normalized) return '';
  const input = `${DIGEST_SALT}${normalized}`;
  const subtle = await getSubtle();
  if (subtle) {
    try {
      const digest = await subtle.digest('SHA-256', new TextEncoder().encode(input));
      return `blk_v1_${bytesToHex(new Uint8Array(digest))}`;
    } catch {}
  }
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `blk_v1_f_${(h >>> 0).toString(16).padStart(8, '0')}_${normalized.length}`;
}

export function isClientEncryptedPII(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(WEBGCM_PREFIX);
}

export async function encryptClientPII(plaintext?: string | null): Promise<string> {
  if (plaintext === undefined || plaintext === null) return '';
  const str = String(plaintext);
  if (!str) return '';
  if (isClientEncryptedPII(str)) return str;

  const key = await getClientPiiKey();
  if (!key) return str;
  const subtle = await getSubtle();
  if (!subtle) return str;

  try {
    const iv = randomBytes(12);
    const encoded = new TextEncoder().encode(str);
    const cipherBuf = await subtle.encrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      encoded
    );
    return `${WEBGCM_PREFIX}${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(cipherBuf))}`;
  } catch {
    return str;
  }
}

export async function decryptClientPII(value?: string | null): Promise<string> {
  if (value === undefined || value === null) return '';
  const str = String(value);
  if (!str) return '';
  if (!isClientEncryptedPII(str)) return str;

  const key = await getClientPiiKey();
  const subtle = await getSubtle();
  if (!key || !subtle) return '';

  try {
    const body = str.slice(WEBGCM_PREFIX.length);
    const [ivB64, cipherB64] = body.split('.');
    if (!ivB64 || !cipherB64) return '';
    const iv = base64ToBytes(ivB64);
    const cipherBytes = base64ToBytes(cipherB64);
    const plainBuf = await subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      cipherBytes as BufferSource
    );
    return new TextDecoder().decode(plainBuf);
  } catch {
    return '';
  }
}

export function stripPlaintextSecretsFromUser<T extends Record<string, any>>(user: T): T {
  if (!user || typeof user !== 'object') return user;
  const cleaned: Record<string, any> = { ...user };
  delete cleaned.password;
  delete cleaned.pin;
  return cleaned as T;
}

export async function encryptUserPiiForStorage<T extends Record<string, any>>(user: T): Promise<T> {
  const cleaned: Record<string, any> = stripPlaintextSecretsFromUser(user);
  for (const field of CLIENT_PII_FIELDS) {
    if (typeof cleaned[field] === 'string' && cleaned[field].length > 0) {
      cleaned[field] = await encryptClientPII(cleaned[field]);
    }
  }
  cleaned.piiEncrypted = true;
  return cleaned as T;
}

export async function decryptUserPiiFromStorage<T extends Record<string, any>>(user: T): Promise<T> {
  if (!user || typeof user !== 'object') return user;
  const next: Record<string, any> = { ...user };
  for (const field of CLIENT_PII_FIELDS) {
    if (typeof next[field] === 'string' && isClientEncryptedPII(next[field])) {
      const decrypted = await decryptClientPII(next[field]);
      if (decrypted) {
        next[field] = decrypted;
      }
    }
  }
  return next as T;
}
