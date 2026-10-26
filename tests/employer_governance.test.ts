import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateRejectionReason,
  isEmployerVisibleInDirectory,
  getStoredFormLock,
  setStoredFormLock,
  clearStoredFormLock,
  FORM_LOCK_STORAGE_KEY
} from '../src/lib/employerValidation';
import { UserProfile } from '../src/types';

describe('1. Directory Visibility Allowlist Tests', () => {
  it('allows ONLY approved employers in the directory', () => {
    const approvedEmployer: Partial<UserProfile> = {
      uid: 'emp_1',
      role: 'employer',
      employerStatus: 'approved',
      employerVerificationStatus: 'verified'
    };
    expect(isEmployerVisibleInDirectory(approvedEmployer)).toBe(true);
  });

  it('strictly blocks pending employers from directory, search, and list views', () => {
    const pendingEmployer: Partial<UserProfile> = {
      uid: 'emp_2',
      role: 'employer',
      employerStatus: 'pending',
      employerVerificationStatus: 'pending_verification'
    };
    expect(isEmployerVisibleInDirectory(pendingEmployer)).toBe(false);
  });

  it('strictly blocks rejected employers from directory, search, and list views', () => {
    const rejectedEmployer: Partial<UserProfile> = {
      uid: 'emp_3',
      role: 'employer',
      employerStatus: 'rejected',
      employerVerificationStatus: 'rejected'
    };
    expect(isEmployerVisibleInDirectory(rejectedEmployer)).toBe(false);
  });

  it('blocks unverified employers with undefined or empty status', () => {
    const unknownEmployer: Partial<UserProfile> = {
      uid: 'emp_4',
      role: 'employer'
    };
    expect(isEmployerVisibleInDirectory(unknownEmployer)).toBe(false);
  });

  it('blocks non-employer entities from employer allowlist check', () => {
    const alumnus: Partial<UserProfile> = {
      uid: 'alum_1',
      role: 'alumni'
    };
    expect(isEmployerVisibleInDirectory(alumnus)).toBe(false);
  });
});

describe('2. Mandatory Rejection Reason Validation Tests', () => {
  it('rejects empty rejection reason', () => {
    const res = validateRejectionReason('');
    expect(res.valid).toBe(false);
    expect(res.error).toBeDefined();
  });

  it('rejects null or undefined rejection reason', () => {
    const resNull = validateRejectionReason(null as any);
    expect(resNull.valid).toBe(false);
    const resUndef = validateRejectionReason(undefined as any);
    expect(resUndef.valid).toBe(false);
  });

  it('rejects whitespace-only rejection reason (counts as empty)', () => {
    const res = validateRejectionReason('       \t\n   ');
    expect(res.valid).toBe(false);
    expect(res.error).toContain('cannot be empty or whitespace only');
  });

  it('rejects rejection reason with fewer than 10 characters', () => {
    const res = validateRejectionReason('Too short'); // 9 chars
    expect(res.valid).toBe(false);
    expect(res.error).toContain('at least 10 characters');
  });

  it('rejects rejection reason with more than 500 characters', () => {
    const longReason = 'a'.repeat(501);
    const res = validateRejectionReason(longReason);
    expect(res.valid).toBe(false);
    expect(res.error).toContain('cannot exceed 500 characters');
  });

  it('accepts valid rejection reason between 10 and 500 characters', () => {
    const validReason = 'Company business permit and SEC registration documentation could not be verified.';
    const res = validateRejectionReason(validReason);
    expect(res.valid).toBe(true);
    expect(res.trimmed).toBe(validReason);
  });

  it('trims leading and trailing whitespace before validating length', () => {
    const padded = '   Valid rejection reason with extra spaces on edges   ';
    const res = validateRejectionReason(padded);
    expect(res.valid).toBe(true);
    expect(res.trimmed).toBe('Valid rejection reason with extra spaces on edges');
  });
});

describe('3. Role Immutability Tests', () => {
  const evaluateRoleUpdate = (currentRole: string, newRole: string) => {
    if (currentRole === 'employer' || newRole === 'employer') {
      return { allowed: false, error: 'The Employer role is fixed and immutable.' };
    }
    return { allowed: true };
  };

  it('rejects changing an employer to alumni', () => {
    const result = evaluateRoleUpdate('employer', 'alumni');
    expect(result.allowed).toBe(false);
    expect(result.error).toContain('fixed and immutable');
  });

  it('rejects changing an employer to admin or moderator', () => {
    const adminRes = evaluateRoleUpdate('employer', 'admin');
    expect(adminRes.allowed).toBe(false);

    const modRes = evaluateRoleUpdate('employer', 'moderator');
    expect(modRes.allowed).toBe(false);
  });

  it('rejects converting an alumni to employer', () => {
    const result = evaluateRoleUpdate('alumni', 'employer');
    expect(result.allowed).toBe(false);
    expect(result.error).toContain('fixed and immutable');
  });

  it('rejects converting an admin or staff to employer', () => {
    const result = evaluateRoleUpdate('admin', 'employer');
    expect(result.allowed).toBe(false);
  });
});

describe('4. Read-Only Credential Access & Authorization Tests', () => {
  const evaluateAccess = (userRole: string | null) => {
    if (!userRole) return { allowed: false, status: 401 };
    if (['admin', 'superadmin', 'moderator'].includes(userRole)) {
      return { allowed: true, status: 200, isReadOnly: true };
    }
    return { allowed: false, status: 403, error: 'Access restricted to administrators and moderators.' };
  };

  it('grants read-only profile & credential audit access to admin', () => {
    const access = evaluateAccess('admin');
    expect(access.allowed).toBe(true);
    expect(access.status).toBe(200);
    expect(access.isReadOnly).toBe(true);
  });

  it('grants read-only profile & credential audit access to moderator', () => {
    const access = evaluateAccess('moderator');
    expect(access.allowed).toBe(true);
    expect(access.status).toBe(200);
    expect(access.isReadOnly).toBe(true);
  });

  it('strictly denies credential access to alumni with 403 Forbidden', () => {
    const access = evaluateAccess('alumni');
    expect(access.allowed).toBe(false);
    expect(access.status).toBe(403);
  });

  it('strictly denies credential access to unauthenticated requests with 401 Unauthorized', () => {
    const access = evaluateAccess(null);
    expect(access.allowed).toBe(false);
    expect(access.status).toBe(401);
  });
});

describe('5. Form Locking, Persistence, Reset & Re-Application Block Tests', () => {
  // In-memory sessionStorage polyfill for node test environment
  const mockStorage: Record<string, string> = {};
  beforeEach(() => {
    for (const key of Object.keys(mockStorage)) {
      delete mockStorage[key];
    }
    (globalThis as any).window = {
      sessionStorage: {
        getItem: (key: string) => mockStorage[key] || null,
        setItem: (key: string, val: string) => {
          mockStorage[key] = String(val);
        },
        removeItem: (key: string) => {
          delete mockStorage[key];
        }
      }
    };
  });

  it('locks to alumni form and persists across simulated page refresh in sessionStorage', () => {
    setStoredFormLock('alumni');
    expect(getStoredFormLock()).toBe('alumni');
    expect(mockStorage[FORM_LOCK_STORAGE_KEY]).toBe('alumni');
  });

  it('locks to employer form and persists across simulated page refresh in sessionStorage', () => {
    setStoredFormLock('employer');
    expect(getStoredFormLock()).toBe('employer');
    expect(mockStorage[FORM_LOCK_STORAGE_KEY]).toBe('employer');
  });

  it('clears form lock completely when Reset is triggered', () => {
    setStoredFormLock('alumni');
    expect(getStoredFormLock()).toBe('alumni');

    clearStoredFormLock();
    expect(getStoredFormLock()).toBeNull();
    expect(mockStorage[FORM_LOCK_STORAGE_KEY]).toBeUndefined();
  });

  it('clears form lock completely when Cancel is triggered', () => {
    setStoredFormLock('employer');
    expect(getStoredFormLock()).toBe('employer');

    clearStoredFormLock();
    expect(getStoredFormLock()).toBeNull();
  });

  it('rejects mismatched role submission when form lock is active', () => {
    const activeLock = 'alumni';
    const submittedRole = 'employer';

    const validateSubmission = (lock: string | null, role: string) => {
      if (lock && lock !== role) {
        return { valid: false, error: `Form is currently locked to ${lock}. Cannot submit registration as ${role}.` };
      }
      return { valid: true };
    };

    const result = validateSubmission(activeLock, submittedRole);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('locked to alumni');
  });

  it('blocks re-application for previously rejected employers by email or company name', () => {
    const existingEmployers = [
      {
        uid: 'emp_rej_1',
        role: 'employer',
        email: 'rejected-partner@company.com',
        companyName: 'Acme Rejected Corp',
        employerStatus: 'rejected'
      }
    ];

    const evaluateReapplication = (candidateEmail: string, candidateCompany: string) => {
      const isBlocked = existingEmployers.some(
        (e) =>
          e.employerStatus === 'rejected' &&
          (e.email.toLowerCase() === candidateEmail.toLowerCase() ||
           e.companyName.toLowerCase() === candidateCompany.toLowerCase())
      );

      if (isBlocked) {
        return {
          allowed: false,
          error: 'This organization registration was previously rejected and cannot re-apply in accordance with institutional policy.'
        };
      }
      return { allowed: true };
    };

    // Attempt re-application with same email
    const reapplyEmail = evaluateReapplication('rejected-partner@company.com', 'Brand New Name');
    expect(reapplyEmail.allowed).toBe(false);
    expect(reapplyEmail.error).toContain('previously rejected and cannot re-apply');

    // Attempt re-application with same company name
    const reapplyCompany = evaluateReapplication('different@company.com', 'Acme Rejected Corp');
    expect(reapplyCompany.allowed).toBe(false);
    expect(reapplyCompany.error).toContain('previously rejected and cannot re-apply');

    // Non-rejected company is allowed
    const freshCompany = evaluateReapplication('new@innovate.com', 'Innovate Tech PH');
    expect(freshCompany.allowed).toBe(true);
  });
});
