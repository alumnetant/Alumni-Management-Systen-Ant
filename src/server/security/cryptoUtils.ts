import crypto from 'crypto';

const SERVER_CRYPTO_SECRET =
  process.env.SERVER_AUTH_SECRET ||
  (process.env.NODE_ENV === 'production'
    ? crypto.randomBytes(32).toString('hex')
    : 'scc_alumnet_dev_only_secret_key_do_not_use_in_prod');

const AES_KEY = crypto.createHash('sha256').update(SERVER_CRYPTO_SECRET).digest();
const ENC_PREFIX = 'enc:v1:';
const PII_FIELDS = ['email', 'phone', 'location'] as const;

export function hashTokenHmac(token: string): string {
  return crypto.createHmac('sha256', SERVER_CRYPTO_SECRET).update(String(token || '')).digest('hex');
}

export function verifyTokenHmac(providedToken: string, storedHash: string): boolean {
  if (!providedToken || !storedHash) return false;
  const expected = hashTokenHmac(providedToken);
  if (expected.length !== storedHash.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(storedHash, 'utf8'));
  } catch {
    return false;
  }
}

export function encryptUserPiiFields<T extends Record<string, any>>(record: T): T {
  if (!record || typeof record !== 'object') return record;
  const copy: Record<string, any> = { ...record };
  for (const field of PII_FIELDS) {
    const val = copy[field];
    if (typeof val === 'string' && val.length > 0 && !val.startsWith(ENC_PREFIX)) {
      try {
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', AES_KEY, iv);
        const encrypted = Buffer.concat([cipher.update(val, 'utf8'), cipher.final()]);
        const tag = cipher.getAuthTag();
        copy[field] = `${ENC_PREFIX}${iv.toString('base64url')}:${tag.toString('base64url')}:${encrypted.toString('base64url')}`;
      } catch {
        // Leave field untouched on unexpected cipher error
      }
    }
  }
  return copy as T;
}

export function decryptUserPiiFields<T extends Record<string, any>>(record: T): T {
  if (!record || typeof record !== 'object') return record;
  const copy: Record<string, any> = { ...record };
  for (const field of PII_FIELDS) {
    const val = copy[field];
    if (typeof val === 'string' && val.startsWith(ENC_PREFIX)) {
      try {
        const [ivB64, tagB64, cipherB64] = val.slice(ENC_PREFIX.length).split(':');
        if (ivB64 && tagB64 && cipherB64) {
          const decipher = crypto.createDecipheriv(
            'aes-256-gcm',
            AES_KEY,
            Buffer.from(ivB64, 'base64url')
          );
          decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
          const decrypted = Buffer.concat([
            decipher.update(Buffer.from(cipherB64, 'base64url')),
            decipher.final()
          ]);
          copy[field] = decrypted.toString('utf8');
        }
      } catch {
        // Gracefully keep value if encrypted under a rotated key
      }
    }
  }
  return copy as T;
}
