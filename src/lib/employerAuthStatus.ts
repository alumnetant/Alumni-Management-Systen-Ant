import { UserProfile } from '../types';

export interface StoredUserCredentialLike {
  uid?: string;
  name?: string;
  email?: string;
  role?: string;
  password?: string;
  isVerified?: boolean;
  employerStatus?: string;
  employerVerificationStatus?: string;
  verificationStatus?: string;
  accountStatus?: string;
  status?: string;
  rejectionReason?: string;
  rejectionDate?: string;
  [key: string]: any;
}

export type EmployerAuthStatus =
  | 'APPROVED'
  | 'PENDING_APPROVAL'
  | 'REJECTED'
  | 'SUSPENDED'
  | 'NOT_AN_EMPLOYER';

/**
 * Single source of truth for Employer verification and authorization status across
 * client and backend.
 */
export function getEmployerAuthStatus(
  user?: Partial<UserProfile> | Partial<StoredUserCredentialLike> | null
): EmployerAuthStatus {
  if (!user || user.role !== 'employer') {
    return 'NOT_AN_EMPLOYER';
  }

  // 1. Check for explicit suspension
  const accountStatus = (user.accountStatus || user.status || '').toUpperCase().trim();
  if (accountStatus === 'SUSPENDED') {
    return 'SUSPENDED';
  }

  // 2. Check for explicit rejection
  const empStatus = (user.employerStatus || '').toLowerCase().trim();
  const empVerifStatus = (user.employerVerificationStatus || '').toLowerCase().trim();
  const verifStatus = (user.verificationStatus || '').toLowerCase().trim();

  if (
    empStatus === 'rejected' ||
    empVerifStatus === 'rejected' ||
    verifStatus === 'rejected' ||
    accountStatus === 'REJECTED'
  ) {
    return 'REJECTED';
  }

  // 3. Check for pending approval explicitly
  if (
    empStatus === 'pending' ||
    empStatus === 'pending_verification' ||
    empVerifStatus === 'pending' ||
    empVerifStatus === 'pending_verification' ||
    accountStatus === 'PENDING_VERIFICATION' ||
    accountStatus === 'PENDING_APPROVAL'
  ) {
    return 'PENDING_APPROVAL';
  }

  // 4. Check for approved / active status
  const isApproved =
    empStatus === 'approved' ||
    empStatus === 'active' ||
    empVerifStatus === 'verified' ||
    verifStatus === 'verified' ||
    user.isVerified === true ||
    (user as any).verified === true;

  if (isApproved) {
    return 'APPROVED';
  }

  return 'PENDING_APPROVAL';
}

/**
 * Returns true if an employer account is permitted to authenticate and access employer tools.
 */
export function isEmployerApproved(
  user?: Partial<UserProfile> | Partial<StoredUserCredentialLike> | null
): boolean {
  return getEmployerAuthStatus(user) === 'APPROVED';
}
