import crypto from 'crypto';

export const PENDING_VERIFICATION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const SERVER_DATA_SECRET =
  process.env.SERVER_AUTH_SECRET ||
  'scc_alumnet_secret_key_8b181b_sec_v1_tamperproof_institutional';

const PII_ENCRYPTION_KEY = crypto.scryptSync(
  SERVER_DATA_SECRET,
  'scc_alumnet_pii_aes256gcm_v1',
  32
);

const PII_TAG_PREFIX = 'enc:gcm:v1:';
const PBKDF2_PREFIX = 'pbkdf2:sha512:100000:';

export const PII_FIELDS = [
  'phone',
  'homeAddress',
  'birthday',
  'guardianName',
  'companyAddress',
  'contactPhone',
  'contactPerson'
] as const;

export function hashPassword(password: string, saltHex?: string): { hash: string; salt: string } {
  const salt = saltHex || crypto.randomBytes(32).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

export function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  if (!password || !salt || !expectedHash) return false;
  try {
    const { hash } = hashPassword(password, salt);
    if (hash.length !== expectedHash.length) return false;
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(expectedHash, 'hex'));
  } catch {
    return false;
  }
}

export function hashPin(pin: string, saltHex?: string): string {
  const salt = saltHex || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(String(pin), salt, 100000, 32, 'sha512').toString('hex');
  return `${PBKDF2_PREFIX}${salt}:${hash}`;
}

export function verifyPin(pin: string, storedPinHash: string): boolean {
  if (!pin || !storedPinHash) return false;
  if (!storedPinHash.startsWith(PBKDF2_PREFIX)) return false;
  const rest = storedPinHash.slice(PBKDF2_PREFIX.length);
  const parts = rest.split(':');
  if (parts.length !== 2) return false;
  const [salt, expectedHash] = parts;
  if (!salt || !expectedHash) return false;
  try {
    const derived = crypto.pbkdf2Sync(String(pin), salt, 100000, 32, 'sha512').toString('hex');
    if (derived.length !== expectedHash.length) return false;
    return crypto.timingSafeEqual(Buffer.from(derived, 'hex'), Buffer.from(expectedHash, 'hex'));
  } catch {
    return false;
  }
}

export function hashTokenHmac(token: string): string {
  return crypto
    .createHmac('sha256', SERVER_DATA_SECRET)
    .update(String(token))
    .digest('hex');
}

export function verifyTokenHmac(providedToken: string, expectedHash: string): boolean {
  if (!providedToken || !expectedHash) return false;
  try {
    const computed = hashTokenHmac(providedToken);
    if (computed.length !== expectedHash.length) return false;
    return crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(expectedHash, 'hex'));
  } catch {
    return false;
  }
}

export function hmacIdentifierDigest(value?: string | null): string {
  if (!value || typeof value !== 'string') return '';
  const normalized = value.toLowerCase().trim();
  if (!normalized) return '';
  return crypto
    .createHmac('sha256', `${SERVER_DATA_SECRET}:block_registry_v1`)
    .update(normalized)
    .digest('hex');
}

export function isEncryptedPII(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(PII_TAG_PREFIX);
}

export function encryptPII(plaintext?: string | null): string {
  if (plaintext === undefined || plaintext === null) return '';
  const str = String(plaintext);
  if (!str) return '';
  if (isEncryptedPII(str)) return str;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', PII_ENCRYPTION_KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(str, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${PII_TAG_PREFIX}${iv.toString('base64url')}.${tag.toString('base64url')}.${ciphertext.toString('base64url')}`;
}

export function decryptPII(value?: string | null): string {
  if (value === undefined || value === null) return '';
  const str = String(value);
  if (!str) return '';
  if (!isEncryptedPII(str)) return str;

  try {
    const payload = str.slice(PII_TAG_PREFIX.length);
    const parts = payload.split('.');
    if (parts.length !== 3) return '';
    const [ivB64, tagB64, cipherB64] = parts;
    const iv = Buffer.from(ivB64, 'base64url');
    const tag = Buffer.from(tagB64, 'base64url');
    const ciphertext = Buffer.from(cipherB64, 'base64url');

    const decipher = crypto.createDecipheriv('aes-256-gcm', PII_ENCRYPTION_KEY, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plain.toString('utf8');
  } catch {
    return '';
  }
}

export function encryptUserPiiFields<T extends Record<string, any>>(record: T): T {
  if (!record || typeof record !== 'object') return record;
  const next: Record<string, any> = { ...record };
  for (const field of PII_FIELDS) {
    if (typeof next[field] === 'string' && next[field].length > 0) {
      next[field] = encryptPII(next[field]);
    }
  }
  return next as T;
}

export function decryptUserPiiFields<T extends Record<string, any>>(record: T): T {
  if (!record || typeof record !== 'object') return record;
  const next: Record<string, any> = { ...record };
  for (const field of PII_FIELDS) {
    if (typeof next[field] === 'string' && isEncryptedPII(next[field])) {
      next[field] = decryptPII(next[field]);
    }
  }
  return next as T;
}

export interface AnonymizedRejectedBlockRecord {
  id: string;
  emailHash?: string;
  companyHash?: string;
  identifierHash?: string;
  category: 'employer' | 'alumni_verification' | 'conflict';
  reason: string;
  rejectedAt: string;
  rejectedByRole: string;
  status: 'REJECTED';
  piiPurged: true;
}

export function createAnonymizedBlockRecord(input: {
  id?: string;
  email?: string;
  companyName?: string;
  identifier?: string;
  category: AnonymizedRejectedBlockRecord['category'];
  reason: string;
  rejectedByRole?: string;
}): AnonymizedRejectedBlockRecord {
  const emailHash = hmacIdentifierDigest(input.email);
  const companyHash = hmacIdentifierDigest(input.companyName);
  const identifierHash = hmacIdentifierDigest(input.identifier);
  return {
    id: input.id || `blk_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    ...(emailHash ? { emailHash } : {}),
    ...(companyHash ? { companyHash } : {}),
    ...(identifierHash ? { identifierHash } : {}),
    category: input.category,
    reason: String(input.reason || 'Application rejected by institutional administrator.').slice(0, 300),
    rejectedAt: new Date().toISOString(),
    rejectedByRole: String(input.rejectedByRole || 'admin'),
    status: 'REJECTED',
    piiPurged: true
  };
}

export function matchesAnonymizedBlock(
  record: AnonymizedRejectedBlockRecord,
  query: { email?: string; companyName?: string; identifier?: string }
): boolean {
  const qEmail = hmacIdentifierDigest(query.email);
  const qCompany = hmacIdentifierDigest(query.companyName);
  const qId = hmacIdentifierDigest(query.identifier);

  if (qEmail && record.emailHash && qEmail === record.emailHash) return true;
  if (qCompany && record.companyHash && qCompany === record.companyHash) return true;
  if (qId && record.identifierHash && qId === record.identifierHash) return true;
  return false;
}
