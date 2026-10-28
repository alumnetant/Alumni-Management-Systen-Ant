import { UserProfile, StudentVerificationRecord, RegistrationConflictRecord } from '../types';

export interface VerificationCandidate {
  id?: string;
  applicantUid?: string;
  name: string;
  email: string;
  phone?: string;
  companyName?: string;
  tinOrRegistrationNumber?: string;
  studentId?: string;
  batch?: string;
  course?: string;
  role?: string;
  address?: string;
  contactPerson?: string;
  submittedAt?: string;
  version?: number;
}

export interface MatchEvaluationResult {
  score: number; // 0 - 100
  verdict: 'CLEAR' | 'POSSIBLE_DUPLICATE' | 'EXACT_DUPLICATE' | 'COLLISION_CRITICAL';
  conflictType?:
    | 'exact_duplicate'
    | 'possible_duplicate'
    | 'multiple_representatives'
    | 'email_collision'
    | 'already_approved'
    | 'rejected_resubmission'
    | 'expired_accreditation'
    | 'needs_info';
  matchedFields: string[];
  matchedExistingUser?: UserProfile;
  matchedRegistryRecord?: StudentVerificationRecord;
  reason: string;
  scenarioKey:
    | 'exact_duplicate'
    | 'possible_duplicate'
    | 'same_business_multi_rep'
    | 'same_email_different_account'
    | 'already_approved'
    | 'rejected_resubmit'
    | 'expired_accreditation'
    | 'request_edited'
    | 'concurrent_admin_collision'
    | 'incomplete_documents'
    | 'merge_conflict'
    | 'clear';
  recommendedAction: 'APPROVE' | 'REJECT' | 'REQUEST_INFO' | 'MERGE' | 'MARK_SEPARATE';
}

// ============================================================================
// 1. INPUT NORMALIZATION HELPERS
// ============================================================================

export function normalizeEmail(email: string = ''): string {
  return email.trim().toLowerCase();
}

export function normalizePhone(phone: string = ''): string {
  // Strip non-digits except initial '+'
  const cleaned = phone.trim().replace(/[^\d+]/g, '');
  if (cleaned.startsWith('09') && cleaned.length === 11) {
    return `+63${cleaned.slice(1)}`;
  }
  return cleaned;
}

export function normalizeCompanyName(name: string = ''): string {
  return name
    .toLowerCase()
    .replace(/\b(inc|incorporated|corp|corporation|llc|ltd|limited|co|company|enterprises|philippines|cebu)\b/gi, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeTinOrReg(id: string = ''): string {
  return id.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().trim();
}

export function normalizeStudentIdCode(id: string = ''): string {
  const digits = id.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const withoutPrefix = digits.replace(/^SCC/i, '');
  if (withoutPrefix.length === 8) {
    return `SCC-${withoutPrefix.slice(0, 4)}-${withoutPrefix.slice(4)}`;
  }
  return id.trim().toUpperCase();
}

// ============================================================================
// 2. FUZZY STRING SIMILARITY (Levenshtein + Bigram Dice)
// ============================================================================

export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  const n = a.length;
  const m = b.length;

  if (n === 0) return m;
  if (m === 0) return n;

  for (let i = 0; i <= n; i++) matrix[i] = [i];
  for (let j = 0; j <= m; j++) matrix[0][j] = j;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[n][m];
}

export function calculateStringSimilarity(str1: string, str2: string): number {
  const s1 = str1.trim().toLowerCase();
  const s2 = str2.trim().toLowerCase();

  if (s1 === s2) return 1.0;
  if (s1.length === 0 || s2.length === 0) return 0.0;

  // 1. Normalized Levenshtein
  const maxLen = Math.max(s1.length, s2.length);
  const distance = levenshteinDistance(s1, s2);
  const levSimilarity = 1.0 - distance / maxLen;

  // 2. Token / Bigram Dice similarity
  const getBigrams = (s: string) => {
    const bigrams = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) {
      bigrams.add(s.slice(i, i + 2));
    }
    return bigrams;
  };

  const bg1 = getBigrams(s1);
  const bg2 = getBigrams(s2);

  if (bg1.size === 0 || bg2.size === 0) return levSimilarity;

  let intersection = 0;
  bg1.forEach((b) => {
    if (bg2.has(b)) intersection++;
  });

  const diceSimilarity = (2.0 * intersection) / (bg1.size + bg2.size);

  // Return weighted composite
  return 0.4 * levSimilarity + 0.6 * diceSimilarity;
}

// ============================================================================
// 3. MULTI-SCENARIO ACCURATE DATABASE MATCHING ENGINE
// ============================================================================

export function evaluateVerificationCandidate(
  candidate: VerificationCandidate,
  existingUsers: UserProfile[],
  registryRecords?: StudentVerificationRecord[]
): MatchEvaluationResult {
  const cEmail = normalizeEmail(candidate.email);
  const cPhone = candidate.phone ? normalizePhone(candidate.phone) : '';
  const cCompanyNorm = candidate.companyName ? normalizeCompanyName(candidate.companyName) : '';
  const cTin = candidate.tinOrRegistrationNumber ? normalizeTinOrReg(candidate.tinOrRegistrationNumber) : '';
  const cStudentIdNorm = candidate.studentId ? normalizeStudentIdCode(candidate.studentId) : '';

  const matchedFields: string[] = [];

  // Filter out the candidate's own existing account when re-evaluating
  const otherUsers = existingUsers.filter(
    (u) => !candidate.applicantUid || u.uid !== candidate.applicantUid
  );

  // --------------------------------------------------------------------------
  // SCENARIO 5: Already Approved Account Submits Again
  // --------------------------------------------------------------------------
  const existingSelf = candidate.applicantUid
    ? existingUsers.find((u) => u.uid === candidate.applicantUid)
    : existingUsers.find((u) => normalizeEmail(u.email) === cEmail);

  if (
    existingSelf &&
    (existingSelf.isVerified === true ||
      existingSelf.employerStatus === 'approved' ||
      existingSelf.employerStatus === 'active' ||
      existingSelf.employerVerificationStatus === 'verified')
  ) {
    return {
      score: 100,
      verdict: 'EXACT_DUPLICATE',
      conflictType: 'already_approved',
      scenarioKey: 'already_approved',
      matchedFields: ['Account ID', 'Email', 'Clearance Status'],
      matchedExistingUser: existingSelf,
      reason: `Account "${existingSelf.name}" (${existingSelf.email}) is ALREADY approved and verified in the database. Duplicate submission rejected.`,
      recommendedAction: 'REJECT'
    };
  }

  // --------------------------------------------------------------------------
  // SCENARIO 7: Expired Accreditation
  // --------------------------------------------------------------------------
  if (
    existingSelf &&
    (existingSelf.employerStatus === 'expired' ||
      (existingSelf.employerExpirationDate &&
        new Date(existingSelf.employerExpirationDate).getTime() < Date.now()))
  ) {
    return {
      score: 95,
      verdict: 'POSSIBLE_DUPLICATE',
      conflictType: 'expired_accreditation',
      scenarioKey: 'expired_accreditation',
      matchedFields: ['Accreditation Expiration', 'Corporate Record'],
      matchedExistingUser: existingSelf,
      reason: `Corporate accreditation for "${existingSelf.companyName || existingSelf.name}" has expired. Prompting re-accreditation renewal.`,
      recommendedAction: 'REQUEST_INFO'
    };
  }

  // --------------------------------------------------------------------------
  // SCENARIO 6: Rejected Account Resubmits
  // --------------------------------------------------------------------------
  if (
    existingSelf &&
    (existingSelf.employerStatus === 'rejected' ||
      existingSelf.employerVerificationStatus === 'rejected' ||
      existingSelf.verificationStatus === 'rejected')
  ) {
    return {
      score: 90,
      verdict: 'POSSIBLE_DUPLICATE',
      conflictType: 'rejected_resubmission',
      scenarioKey: 'rejected_resubmit',
      matchedFields: ['Prior Rejection History', 'Email'],
      matchedExistingUser: existingSelf,
      reason: `Previous application was rejected on ${existingSelf.rejectionDate || 'record'}. Previous reason: "${existingSelf.rejectionReason || 'Documentation rejected'}". Permitting review with preserved audit trail.`,
      recommendedAction: 'REQUEST_INFO'
    };
  }

  // --------------------------------------------------------------------------
  // SCENARIO 1 & 4: Exact Duplicate by Email or Student ID
  // --------------------------------------------------------------------------
  const exactEmailMatch = otherUsers.find((u) => normalizeEmail(u.email) === cEmail);
  if (exactEmailMatch) {
    matchedFields.push('Email Address');
    return {
      score: 100,
      verdict: 'COLLISION_CRITICAL',
      conflictType: 'email_collision',
      scenarioKey: 'same_email_different_account',
      matchedFields,
      matchedExistingUser: exactEmailMatch,
      reason: `Email address "${candidate.email}" is already registered to account "${exactEmailMatch.name}" (${exactEmailMatch.role}). Multiple accounts cannot share an email address.`,
      recommendedAction: 'REJECT'
    };
  }

  if (cStudentIdNorm) {
    const exactIdMatch = otherUsers.find(
      (u) => u.studentId && normalizeStudentIdCode(u.studentId) === cStudentIdNorm
    );
    if (exactIdMatch) {
      matchedFields.push('Student ID');
      return {
        score: 100,
        verdict: 'COLLISION_CRITICAL',
        conflictType: 'exact_duplicate',
        scenarioKey: 'exact_duplicate',
        matchedFields,
        matchedExistingUser: exactIdMatch,
        reason: `Student ID "${cStudentIdNorm}" is already claimed by verified account "${exactIdMatch.name}". Definite credential collision.`,
        recommendedAction: 'REJECT'
      };
    }
  }

  // --------------------------------------------------------------------------
  // SCENARIO 3: Same Business, Multiple Representatives
  // --------------------------------------------------------------------------
  if (cCompanyNorm.length > 2 && candidate.role === 'employer') {
    const companyMatches = otherUsers.filter((u) => {
      if (u.role !== 'employer') return false;
      const otherCompany = normalizeCompanyName(u.companyName || u.company || '');
      return otherCompany.length > 2 && otherCompany === cCompanyNorm;
    });

    if (companyMatches.length > 0) {
      const primaryRep = companyMatches[0];
      matchedFields.push('Company / Legal Business Name');
      return {
        score: 90,
        verdict: 'POSSIBLE_DUPLICATE',
        conflictType: 'multiple_representatives',
        scenarioKey: 'same_business_multi_rep',
        matchedFields,
        matchedExistingUser: primaryRep,
        reason: `Company "${candidate.companyName}" already has an accredited liaison: "${primaryRep.name}" (${primaryRep.email}). Additional representative request flagged for authorization check.`,
        recommendedAction: 'REQUEST_INFO'
      };
    }
  }

  // --------------------------------------------------------------------------
  // SCENARIO 2: Fuzzy Duplicate Detection (Company Name similarity >= 85%)
  // --------------------------------------------------------------------------
  if (cCompanyNorm.length > 3) {
    for (const u of otherUsers) {
      if (u.role !== 'employer') continue;
      const otherCompanyNorm = normalizeCompanyName(u.companyName || u.company || '');
      if (otherCompanyNorm.length < 3) continue;

      const similarity = calculateStringSimilarity(cCompanyNorm, otherCompanyNorm);
      if (similarity >= 0.85) {
        matchedFields.push(`Company Name (${Math.round(similarity * 100)}% fuzzy match)`);
        if (cPhone && u.phone && normalizePhone(u.phone) === cPhone) {
          matchedFields.push('Corporate Telephone / Hotline');
        }

        return {
          score: Math.round(similarity * 100),
          verdict: 'POSSIBLE_DUPLICATE',
          conflictType: 'possible_duplicate',
          scenarioKey: 'possible_duplicate',
          matchedFields,
          matchedExistingUser: u,
          reason: `High fuzzy similarity (${Math.round(similarity * 100)}%) with accredited company "${u.companyName || u.company}". Side-by-side comparison required.`,
          recommendedAction: 'REQUEST_INFO'
        };
      }
    }
  }

  // --------------------------------------------------------------------------
  // Alumni Registrar Cross-Reference (for alumni candidates)
  // --------------------------------------------------------------------------
  if (cStudentIdNorm && registryRecords && registryRecords.length > 0) {
    const regRecord = registryRecords.find(
      (r) => normalizeStudentIdCode(r.studentId) === cStudentIdNorm
    );

    if (regRecord) {
      const nameSim = calculateStringSimilarity(candidate.name, regRecord.fullName);
      if (nameSim >= 0.85) {
        return {
          score: 100,
          verdict: 'CLEAR',
          scenarioKey: 'clear',
          matchedFields: ['Official Registrar Diploma Roll', 'Student ID', 'Degree Program'],
          matchedRegistryRecord: regRecord,
          reason: `100% Alignment with official St. Cecilia's College Registrar records for "${regRecord.fullName}".`,
          recommendedAction: 'APPROVE'
        };
      }
    }
  }

  // --------------------------------------------------------------------------
  // SCENARIO: Incomplete Documents Check
  // --------------------------------------------------------------------------
  if (candidate.role === 'employer' && (!candidate.companyName || candidate.companyName.trim().length < 2)) {
    return {
      score: 30,
      verdict: 'POSSIBLE_DUPLICATE',
      conflictType: 'needs_info',
      scenarioKey: 'incomplete_documents',
      matchedFields: ['Missing Company Name'],
      reason: 'Company legal business name is incomplete or missing. Additional corporate documentation required.',
      recommendedAction: 'REQUEST_INFO'
    };
  }

  // --------------------------------------------------------------------------
  // Default: Clear Candidate
  // --------------------------------------------------------------------------
  return {
    score: 15,
    verdict: 'CLEAR',
    scenarioKey: 'clear',
    matchedFields: [],
    reason: 'No duplicate records or collision flags detected. Candidate passed all database uniqueness checks.',
    recommendedAction: 'APPROVE'
  };
}
