/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { getEmployerAuthStatus } from '../src/lib/employerAuthStatus';
import { UserProfile } from '../src/types';

describe('Pending Account Login & Lockout Suppression Logic', () => {
  it('correctly detects pending employer accounts awaiting accreditation review', () => {
    const pendingEmployer: Partial<UserProfile> = {
      uid: 'emp_pending_01',
      role: 'employer',
      email: 'hr@techcorp.com',
      isVerified: false,
      employerStatus: 'pending',
      employerVerificationStatus: 'pending_verification'
    };

    const status = getEmployerAuthStatus(pendingEmployer as UserProfile);
    expect(status).toBe('PENDING_APPROVAL');

    const isPending = Boolean(
      pendingEmployer.role === 'employer' &&
      (!pendingEmployer.isVerified ||
        pendingEmployer.employerVerificationStatus === 'pending_verification' ||
        pendingEmployer.employerStatus === 'pending' ||
        status === 'PENDING_APPROVAL')
    );

    expect(isPending).toBe(true);
  });

  it('correctly detects conflict or unverified alumni accounts awaiting registrar review', () => {
    const unverifiedAlumni: Partial<UserProfile> = {
      uid: 'alum_unverified_01',
      role: 'alumni',
      email: 'conflict.alumni@example.com',
      isVerified: false,
      verificationStatus: 'pending_review'
    };

    const isPendingOrConflict = Boolean(
      unverifiedAlumni.role === 'alumni' &&
      (!unverifiedAlumni.isVerified ||
        unverifiedAlumni.verificationStatus === 'pending_review' ||
        unverifiedAlumni.verificationStatus === 'flagged' ||
        unverifiedAlumni.verificationStatus === 'conflict' ||
        unverifiedAlumni.accountStatus === 'PENDING_VERIFICATION')
    );

    expect(isPendingOrConflict).toBe(true);
  });

  it('does not classify verified active alumni as pending or in conflict', () => {
    const verifiedAlumni: Partial<UserProfile> = {
      uid: 'alum_verified_01',
      role: 'alumni',
      email: 'maria.santos@alumni.stcecilia.edu',
      isVerified: true,
      verificationStatus: 'verified',
      accountStatus: 'ACTIVE'
    };

    const isPendingOrConflict = Boolean(
      verifiedAlumni.role === 'alumni' &&
      (!verifiedAlumni.isVerified ||
        verifiedAlumni.verificationStatus === 'pending_review' ||
        verifiedAlumni.verificationStatus === 'flagged' ||
        verifiedAlumni.verificationStatus === 'conflict' ||
        verifiedAlumni.accountStatus === 'PENDING_VERIFICATION')
    );

    expect(isPendingOrConflict).toBe(false);
  });

  it('does not classify verified accredited employer as pending', () => {
    const verifiedEmployer: Partial<UserProfile> = {
      uid: 'emp_verified_01',
      role: 'employer',
      email: 'careers@accenture.com',
      isVerified: true,
      employerStatus: 'active',
      employerVerificationStatus: 'verified'
    };

    const status = getEmployerAuthStatus(verifiedEmployer as UserProfile);
    expect(status).toBe('APPROVED');

    const isPending = Boolean(
      verifiedEmployer.role === 'employer' &&
      (!verifiedEmployer.isVerified ||
        verifiedEmployer.employerVerificationStatus === 'pending_verification' ||
        verifiedEmployer.employerStatus === 'pending' ||
        status === 'PENDING_APPROVAL')
    );

    expect(isPending).toBe(false);
  });
});
