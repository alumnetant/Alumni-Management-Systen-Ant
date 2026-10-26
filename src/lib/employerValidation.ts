/**
 * Employer Governance & Verification Utilities
 * Enforces strict validation, directory allowlisting, and session locking rules.
 */

import { UserProfile } from '../types';

export const REJECTION_REASON_MIN_LENGTH = 10;
export const REJECTION_REASON_MAX_LENGTH = 500;
export const FORM_LOCK_STORAGE_KEY = 'registration_form_lock';

export interface RejectionValidationResult {
  valid: boolean;
  error?: string;
  trimmed: string;
}

/**
 * Validates mandatory employer rejection reason.
 * Rules:
 * - Trim whitespace; whitespace-only counts as empty.
 * - Minimum 10 characters, maximum 500 characters.
 */
export function validateRejectionReason(reason: string | null | undefined): RejectionValidationResult {
  if (reason === null || reason === undefined) {
    return {
      valid: false,
      error: 'Rejection reason is mandatory.',
      trimmed: ''
    };
  }

  const trimmed = reason.trim();
  if (trimmed.length === 0) {
    return {
      valid: false,
      error: 'Rejection reason cannot be empty or whitespace only.',
      trimmed: ''
    };
  }

  if (trimmed.length < REJECTION_REASON_MIN_LENGTH) {
    return {
      valid: false,
      error: `Rejection reason must be at least ${REJECTION_REASON_MIN_LENGTH} characters (currently ${trimmed.length}).`,
      trimmed
    };
  }

  if (trimmed.length > REJECTION_REASON_MAX_LENGTH) {
    return {
      valid: false,
      error: `Rejection reason cannot exceed ${REJECTION_REASON_MAX_LENGTH} characters (currently ${trimmed.length}).`,
      trimmed
    };
  }

  return {
    valid: true,
    trimmed
  };
}

/**
 * Explicit directory visibility allowlist rule:
 * The alumni directory shows ONLY employers with status 'approved'.
 * 'pending' and 'rejected' employers must never appear in the directory.
 */
export function isEmployerVisibleInDirectory(user: Partial<UserProfile> | null | undefined): boolean {
  if (!user || user.role !== 'employer') {
    return false;
  }
  // Block any rejected or pending verification employers
  if (
    user.employerStatus === 'rejected' ||
    user.employerVerificationStatus === 'rejected' ||
    user.verificationStatus === 'rejected'
  ) {
    return false;
  }
  // Allowlist: strictly approved only
  const status = (user.employerStatus || (user.employerVerificationStatus === 'verified' ? 'approved' : user.employerVerificationStatus) || '').toLowerCase().trim();
  return status === 'approved';
}

/**
 * Registration form lock session helpers (persists across page refresh for the current browser session).
 */
export function getStoredFormLock(): 'alumni' | 'employer' | null {
  if (typeof window === 'undefined' || !window.sessionStorage) return null;
  try {
    const val = window.sessionStorage.getItem(FORM_LOCK_STORAGE_KEY);
    if (val === 'alumni' || val === 'employer') return val;
    return null;
  } catch {
    return null;
  }
}

export function setStoredFormLock(role: 'alumni' | 'employer'): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    window.sessionStorage.setItem(FORM_LOCK_STORAGE_KEY, role);
  } catch {}
}

export function clearStoredFormLock(): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    window.sessionStorage.removeItem(FORM_LOCK_STORAGE_KEY);
  } catch {}
}
