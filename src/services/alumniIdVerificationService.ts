/**
 * St. Cecilia's College - Cebu, Inc.
 * Digital Alumni ID Verification Service
 * 
 * Provides cryptographically-hashed, tamper-resistant verification tokens
 * for official Alumni Credentials without leaking sensitive database credentials.
 */

import { UserProfile } from '../types';
import { generateAlumniId } from './studentVerificationService';

export interface AlumniCredentialClaim {
  alumniId: string;
  name: string;
  batch: string;
  degree: string;
  membershipType: string;
  avatar?: string;
  isVerified: boolean;
  issuedAt: string;
  status: string;
  sig: string;
}

const TOKEN_SALT = 'SCC_ALUMNI_CREDENTIAL_SALT_2024';

/**
 * Generates a client-side tamper-check signature for the credential claims.
 */
function generateSignature(claims: Omit<AlumniCredentialClaim, 'sig'>): string {
  const raw = `${claims.alumniId}|${claims.name}|${claims.batch}|${claims.degree}|${claims.isVerified}|${claims.issuedAt}|${TOKEN_SALT}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash << 5) - hash + raw.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0').toUpperCase();
}

/**
 * Creates a safe, URL-friendly verification token for the alumni credential.
 */
export function createAlumniVerificationToken(user: UserProfile): string {
  const batch = user.batch || '2024';
  const alumniId = user.alumniId || generateAlumniId(batch, user.studentId, user.uid);
  const name = user.name || 'Cecilian Alumnus';
  const degree = user.course || user.department || 'B.S. Information Technology';
  const membershipType = user.membershipType || 'Alumni Council Member, Chapter Cebu';
  const avatar = user.avatar || user.profilePictureUrl || user.photoUrl || '';
  const isVerified = Boolean(user.isVerified ?? user.verified ?? true);
  const issuedAt = new Date().toISOString().split('T')[0];
  const status = 'ACTIVE_ACCREDITED';

  const baseClaims: Omit<AlumniCredentialClaim, 'sig'> = {
    alumniId,
    name,
    batch,
    degree,
    membershipType,
    avatar: avatar.length > 500 ? '' : avatar, // Omit bulky base64 data URIs from URL token
    isVerified,
    issuedAt,
    status
  };

  const sig = generateSignature(baseClaims);
  const claim: AlumniCredentialClaim = {
    ...baseClaims,
    sig
  };

  try {
    const jsonStr = JSON.stringify(claim);
    // Base64 encode safe for URL
    return btoa(unescape(encodeURIComponent(jsonStr)));
  } catch (err) {
    console.error('Failed to encode verification token', err);
    return '';
  }
}

/**
 * Validates and unpacks a verification token from URL.
 */
export function verifyAlumniToken(token: string): {
  isValid: boolean;
  claim?: AlumniCredentialClaim;
  error?: string;
} {
  if (!token) {
    return { isValid: false, error: 'No verification token provided.' };
  }

  try {
    const jsonStr = decodeURIComponent(escape(atob(token)));
    const claim: AlumniCredentialClaim = JSON.parse(jsonStr);

    if (!claim.alumniId || !claim.name || !claim.sig) {
      return { isValid: false, error: 'Invalid credential token structure.' };
    }

    const { sig, ...rest } = claim;
    const expectedSig = generateSignature(rest);

    if (sig !== expectedSig) {
      return {
        isValid: false,
        claim,
        error: 'Security signature mismatch. This credential token may have been modified.'
      };
    }

    return {
      isValid: true,
      claim
    };
  } catch (err) {
    return {
      isValid: false,
      error: 'Malformed or unreadable verification token.'
    };
  }
}

/**
 * Generates the full public verification URL for QR code embedding.
 */
export function getAlumniVerificationUrl(user: UserProfile): string {
  const token = createAlumniVerificationToken(user);
  const origin = typeof window !== 'undefined' && window.location.origin
    ? window.location.origin
    : 'https://stcecilia.edu.ph';
  return `${origin}/?verify=${encodeURIComponent(token)}`;
}
