import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { StudentVerificationRecord, RegistrationConflictRecord, AppNotification } from '../types';
import {
  saveRegistryRecordsBatchToFirestore,
  getRegistryRecordsFromFirestore,
  markRegistryRecordRegisteredInFirestore,
  deleteRegistryRecordFromFirestore,
  saveConflictRecordToFirestore,
  getConflictRecordsFromFirestore,
  saveNotificationToFirestore
} from '../lib/firebase';
import { generateSecureNumericCode, generateSecureId } from '../lib/secureId';

/**
 * Storage Key for Registrar-uploaded masterlist
 */
const REGISTRY_STORAGE_KEY = 'st_cecilia_accredited_registry_records';
const REGISTRY_CONFLICTS_STORAGE_KEY = 'st_cecilia_registry_conflicts';

/**
 * Official St. Cecilia's College Registrar Archive
 * Preloaded with official accredited graduate records for registration verification.
 */
export const DEFAULT_REGISTRAR_RECORDS: StudentVerificationRecord[] = [];

export interface VerificationResult {
  isVerified: boolean;
  record?: StudentVerificationRecord;
  message: string;
  source: 'database_match' | 'algorithmic_registrar_format' | 'unverified';
}

export interface RegistryMatchResult {
  isMatched: boolean;
  record?: StudentVerificationRecord;
  confidence: number; // 0 - 100
  matchReasons: string[];
  message: string;
  canBypassVerification: boolean;
}

/**
 * Normalizes Student ID strings to standard St. Cecilia formats:
 * - New cohort format: SCC-YY-XXXXXXXX (e.g., SCC-22-00017358, SCC-17-0004402)
 * - Legacy format: SCC-YYYY-XXXX (e.g., SCC-2024-1001)
 */
export function normalizeStudentId(rawId?: any): string {
  if (!rawId || typeof rawId !== 'string') return '';
  const cleaned = rawId.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
  if (/^\d{4}-\d{3,5}$/.test(cleaned)) {
    return `SCC-${cleaned}`;
  }
  if (/^\d{2}-\d{6,9}$/.test(cleaned)) {
    return `SCC-${cleaned}`;
  }
  if (cleaned.startsWith('SC-') && !cleaned.startsWith('SCC-')) {
    return `SCC-${cleaned.slice(3)}`;
  }
  return cleaned;
}

/**
 * Derives a 4-digit cohort/batch year from a Student ID when no explicit batch column exists.
 * Examples: SCC-22-00017358 -> "2022", SCC-17-0004402 -> "2017", SCC-2024-1001 -> "2024"
 */
export function deriveBatchYearFromStudentId(studentId?: string, fallback: string = '2024'): string {
  const norm = normalizeStudentId(studentId);
  const fourDigitMatch = /^(?:SCC|SC)-(19[5-9]\d|20\d\d|21[0-5]\d)-\d{3,5}$/.exec(norm);
  if (fourDigitMatch) return fourDigitMatch[1];

  const twoDigitMatch = /^(?:SCC|SC)-(\d{2})-\d{6,9}$/.exec(norm);
  if (twoDigitMatch) {
    const yy = parseInt(twoDigitMatch[1], 10);
    return yy >= 50 ? `19${twoDigitMatch[1]}` : `20${twoDigitMatch[1]}`;
  }
  return fallback;
}

/**
 * Splits a full name stored either as "Last Name, First Name M." or "First Name M. Last Name"
 * into normalized components for accurate registration pre-fill & matching.
 */
export function splitFullNameParts(fullName: string = ''): {
  firstName: string;
  lastName: string;
  fullNameNatural: string;
} {
  const trimmed = fullName.trim();
  if (!trimmed) return { firstName: '', lastName: '', fullNameNatural: '' };

  if (trimmed.includes(',')) {
    const commaIdx = trimmed.indexOf(',');
    const lastPart = trimmed.slice(0, commaIdx).trim();
    const firstPart = trimmed.slice(commaIdx + 1).trim();
    return {
      firstName: firstPart,
      lastName: lastPart,
      fullNameNatural: `${firstPart} ${lastPart}`.replace(/\s+/g, ' ').trim()
    };
  }

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length > 1) {
    return {
      firstName: parts.slice(0, -1).join(' '),
      lastName: parts[parts.length - 1],
      fullNameNatural: trimmed
    };
  }

  return { firstName: trimmed, lastName: '', fullNameNatural: trimmed };
}

/**
 * Validates whether the student ID follows either official St. Cecilia's College format:
 * - Cohort format: SCC-YY-XXXXXXX[X] (e.g., SCC-22-00017358, SCC-17-0004402)
 * - Legacy centenary format: SCC-YYYY-XXXX (e.g., SCC-2024-1001)
 */
export function isValidStudentIdPattern(id: string): boolean {
  const norm = normalizeStudentId(id);
  const legacyRegex = /^(SCC|SC)-(19[5-9]\d|20\d\d|21[0-5]\d)-\d{3,5}$/;
  const cohortRegex = /^(SCC|SC)-\d{2}-\d{6,9}$/;
  return legacyRegex.test(norm) || cohortRegex.test(norm);
}

/**
 * Retrieves all registered records from localStorage or returns empty array
 */
export function getRegistrarRecords(): StudentVerificationRecord[] {
  try {
    const raw = localStorage.getItem(REGISTRY_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed: StudentVerificationRecord[] = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (err) {
    console.warn('Error reading registrar records from localStorage:', err);
    return [];
  }
}

/**
 * Saves current registrar masterlist to localStorage
 */
export function saveRegistrarRecords(records: StudentVerificationRecord[]): void {
  try {
    localStorage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify(records));
  } catch (err) {
    console.error('Failed to save registrar records:', err);
  }
}

/**
 * Syncs registrar masterlist with Firestore cloud database
 */
export async function syncRegistrarRecordsWithFirestore(): Promise<StudentVerificationRecord[]> {
  try {
    const cloudRecords = await getRegistryRecordsFromFirestore();
    if (cloudRecords && cloudRecords.length > 0) {
      saveRegistrarRecords(cloudRecords);
      return cloudRecords;
    } else {
      const local = getRegistrarRecords();
      return local;
    }
  } catch (err) {
    console.warn('Notice syncing registry with Firestore:', err);
    return getRegistrarRecords();
  }
}

/**
 * Adds or merges newly uploaded student records into the accredited registry and syncs to Firestore
 */
export function addRegistrarRecords(
  newRecords: StudentVerificationRecord[],
  uploadedBy?: string,
  sourceFile?: string
): { added: number; updated: number; total: number } {
  const existing = getRegistrarRecords();
  const existingMap = new Map<string, StudentVerificationRecord>();

  existing.forEach((r) => {
    existingMap.set(normalizeStudentId(r.studentId).toUpperCase(), r);
  });

  let added = 0;
  let updated = 0;
  const now = new Date().toISOString();
  const recordsToSyncToCloud: StudentVerificationRecord[] = [];

  newRecords.forEach((rec) => {
    const normId = normalizeStudentId(rec.studentId).toUpperCase();
    if (!normId) return;

    const recordToSave: StudentVerificationRecord = {
      ...rec,
      studentId: normId,
      fullName: rec.fullName.trim(),
      batchYear: rec.batchYear ? String(rec.batchYear).trim() : deriveBatchYearFromStudentId(normId),
      course: rec.course ? rec.course.trim() : 'BSIT',
      status: rec.status || 'Graduated',
      uploadedAt: rec.uploadedAt || now,
      uploadedBy: uploadedBy || rec.uploadedBy || 'Registrar Office',
      sourceFile: sourceFile || rec.sourceFile
    };

    recordsToSyncToCloud.push(recordToSave);

    if (existingMap.has(normId)) {
      const current = existingMap.get(normId)!;
      existingMap.set(normId, {
        ...current,
        ...recordToSave,
        // Retain registration link if already registered
        isRegistered: current.isRegistered || recordToSave.isRegistered,
        matchedUid: current.matchedUid || recordToSave.matchedUid,
        registeredAt: current.registeredAt || recordToSave.registeredAt
      });
      updated++;
    } else {
      existingMap.set(normId, recordToSave);
      added++;
    }
  });

  const merged = Array.from(existingMap.values());
  saveRegistrarRecords(merged);

  // Asynchronously commit records to Firestore database
  saveRegistryRecordsBatchToFirestore(recordsToSyncToCloud).catch((err) => {
    console.warn('Background Firestore registry sync notice:', err);
  });

  return { added, updated, total: merged.length };
}

/**
 * Deletes a record from the registry by Student ID (and removes from Firestore)
 */
export function deleteRegistrarRecord(studentId: string): boolean {
  const norm = normalizeStudentId(studentId).toUpperCase();
  const current = getRegistrarRecords();
  const filtered = current.filter((r) => normalizeStudentId(r.studentId).toUpperCase() !== norm);
  if (filtered.length !== current.length) {
    saveRegistrarRecords(filtered);
    deleteRegistryRecordFromFirestore(norm).catch(() => {});
    return true;
  }
  return false;
}

/**
 * Marks a student record as registered and links the user ID in local storage and Firestore
 */
export function markRegistryRecordAsRegistered(studentId: string, uid: string = ''): void {
  const norm = normalizeStudentId(studentId).toUpperCase();
  const current = getRegistrarRecords();
  const updated = current.map((r) => {
    if (normalizeStudentId(r.studentId).toUpperCase() === norm) {
      return {
        ...r,
        isRegistered: true,
        matchedUid: uid,
        registeredAt: new Date().toISOString()
      };
    }
    return r;
  });
  saveRegistrarRecords(updated);
  markRegistryRecordRegisteredInFirestore(norm, uid).catch(() => {});
}

/**
 * Clears and resets the registry back to initial accredited graduates
 */
export function resetRegistrarRecords(): void {
  saveRegistrarRecords(DEFAULT_REGISTRAR_RECORDS);
}

/**
 * Fuzzy normalization for names (removes punctuation, extra spaces, accents, lowercase)
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Generates an official St. Cecilia's College Alumni ID:
 * Format: SCC-ALUM-YYYY-XXXX (where YYYY is graduation batch, XXXX is 4-digit unique sequence)
 * This is permanently distinct from the pre-graduation Student ID.
 */
export function generateAlumniId(batchYear: string = '2024', studentId?: string, seed?: string): string {
  const cleanBatch = (batchYear || '2024').replace(/[^0-9]/g, '').slice(-4) || '2024';
  let seq = '';
  if (studentId) {
    const digits = studentId.replace(/[^0-9]/g, '');
    if (digits.length >= 4) {
      seq = digits.slice(-4);
    }
  }
  if (!seq && seed) {
    const seedDigits = seed.replace(/[^0-9]/g, '');
    if (seedDigits.length >= 4) {
      seq = seedDigits.slice(-4);
    }
  }
  if (!seq) {
    seq = generateSecureNumericCode(1000, 9999).toString();
  }
  return `SCC-ALUM-${cleanBatch}-${seq}`;
}

export interface StrictRegistrationValidationResult {
  isValid: boolean;
  errorCode?: 'MISSING_FIELDS' | 'ID_NOT_FOUND' | 'NAME_MISMATCH' | 'LAST_NAME_MISMATCH' | 'BATCH_MISMATCH' | 'COURSE_MISMATCH' | 'ALREADY_REGISTERED' | 'UNVERIFIED_STATUS';
  errorMessage?: string;
  matchedRecord?: StudentVerificationRecord;
}

/**
 * Strict Zero-Tolerance Registration Validator
 * Enforces that Student ID, full name (including any second/middle name),
 * last name, batch year, and degree program match the registrar record EXACTLY.
 * If even one field does not match, registration to Step 2 is strictly blocked.
 */
export function validateStudentRegistrationStrict(
  params: {
    studentId: string;
    firstName: string;
    lastName: string;
    batch: string;
    course: string;
  },
  existingUsers: any[] = []
): StrictRegistrationValidationResult {
  const normId = normalizeStudentId(params.studentId).toUpperCase();
  const trimmedFirst = params.firstName.trim();
  const trimmedLast = params.lastName.trim();
  const trimmedBatch = params.batch.trim();
  const trimmedCourse = params.course.trim();

  if (!normId || !trimmedFirst || !trimmedLast || !trimmedBatch || !trimmedCourse) {
    return {
      isValid: false,
      errorCode: 'MISSING_FIELDS',
      errorMessage: 'All verification fields are required: Student ID Number, First & Middle/Second Name, Last Name, Graduating Batch, and Degree Program.'
    };
  }

  const records = getRegistrarRecords();
  const record = records.find(
    (r) => normalizeStudentId(r.studentId).toUpperCase() === normId
  );

  if (!record) {
    return {
      isValid: false,
      errorCode: 'ID_NOT_FOUND',
      errorMessage: `Security Verification Failed: Student ID "${params.studentId}" was not found in the official St. Cecilia’s College registrar masterlist. Please check for typos or contact the Registrar.`
    };
  }

  // Check if unverified status in registry
  const isUnverified =
    (record.status as string)?.toLowerCase() === 'unverified' ||
    record.verification_status === 'unverified';
  if (isUnverified) {
    return {
      isValid: false,
      errorCode: 'UNVERIFIED_STATUS',
      errorMessage: `Student ID "${params.studentId}" has an unverified or withheld record in the registrar archive. Registration cannot proceed.`
    };
  }

  // Check if duplicate (already registered)
  const alreadyRegisteredInUsers = existingUsers.some(
    (u) =>
      u.studentId &&
      normalizeStudentId(u.studentId).toUpperCase() === normId
  );
  if (record.isRegistered || alreadyRegisteredInUsers) {
    return {
      isValid: false,
      errorCode: 'ALREADY_REGISTERED',
      errorMessage: `Student ID "${params.studentId}" is already registered and activated in the alumni network. Duplicate registrations are prohibited. Please sign in with your credentials.`
    };
  }

  // Strict Name Validation (supports both "Last, First M." and "First M. Last"):
  const enteredFullName = normalizeName(`${trimmedFirst} ${trimmedLast}`);
  const recordParts = splitFullNameParts(record.fullName);
  const recordFullName = normalizeName(record.fullName);
  const recordNaturalName = normalizeName(recordParts.fullNameNatural);

  if (enteredFullName !== recordFullName && enteredFullName !== recordNaturalName) {
    return {
      isValid: false,
      errorCode: 'NAME_MISMATCH',
      errorMessage: `Security Verification Failed: The student name provided does not match the official registrar record for Student ID "${record.studentId}". Every word (first name, second/middle name, and surname) must match the registrar masterlist record exactly.`
    };
  }

  // Strict Last Name Check:
  const enteredLastNorm = normalizeName(trimmedLast);
  const recordLastNorm = normalizeName(recordParts.lastName);
  if (!recordNaturalName.endsWith(enteredLastNorm) && recordLastNorm !== enteredLastNorm) {
    return {
      isValid: false,
      errorCode: 'LAST_NAME_MISMATCH',
      errorMessage: `Security Verification Failed: Last name "${trimmedLast}" does not match the official surname on file for Student ID "${record.studentId}".`
    };
  }

  // Strict Batch Validation:
  const recordBatch = (record.batchYear || '').trim();
  if (recordBatch !== trimmedBatch) {
    return {
      isValid: false,
      errorCode: 'BATCH_MISMATCH',
      errorMessage: `Security Verification Failed: Graduating batch (Class of ${trimmedBatch}) does not match the official registrar record for Student ID "${record.studentId}".`
    };
  }

  // Strict Degree Program Validation:
  const normRecordCourse = (record.course || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const normEnteredCourse = trimmedCourse.toLowerCase().replace(/[^a-z0-9]/g, '');

  if (normRecordCourse !== normEnteredCourse) {
    return {
      isValid: false,
      errorCode: 'COURSE_MISMATCH',
      errorMessage: `Security Verification Failed: Degree program "${trimmedCourse}" does not match the official registered program for Student ID "${record.studentId}".`
    };
  }

  return {
    isValid: true,
    matchedRecord: record
  };
}

/**
 * Fast School ID Lookup for Streamlined Registration:
 * Checks for duplicates against active users, verifies against registrar records,
 * and allows instant auto-population to minimize user clicks and errors.
 */
export function lookupStudentBySchoolId(
  studentId: string,
  existingUsers: any[] = []
): {
  isValid: boolean;
  isDuplicate: boolean;
  matchedRecord: StudentVerificationRecord | null;
  errorMessage?: string;
} {
  const normId = normalizeStudentId(studentId).toUpperCase();
  if (!normId) {
    return {
      isValid: false,
      isDuplicate: false,
      matchedRecord: null,
      errorMessage: 'Please enter your School ID Number (e.g. SCC-22-00017358 or SCC-2024-1001).'
    };
  }

  // 1. Check for duplicates in existing registered accounts
  const alreadyRegistered = existingUsers.some(
    (u) => u.studentId && normalizeStudentId(u.studentId).toUpperCase() === normId
  );
  if (alreadyRegistered) {
    return {
      isValid: false,
      isDuplicate: true,
      matchedRecord: null,
      errorMessage: `School ID "${studentId}" is already registered. Duplicate registration is prevented. Please sign in or reset your credentials.`
    };
  }

  // 2. Check registrar masterlist records
  const records = getRegistrarRecords();
  const record = records.find(
    (r) => normalizeStudentId(r.studentId).toUpperCase() === normId
  );

  if (!record) {
    return {
      isValid: false,
      isDuplicate: false,
      matchedRecord: null,
      errorMessage: `School ID "${studentId}" was not found in the registrar archive. Accepted formats: SCC-22-00017358 or SCC-2024-1001.`
    };
  }

  if (record.isRegistered) {
    return {
      isValid: false,
      isDuplicate: true,
      matchedRecord: null,
      errorMessage: `School ID "${studentId}" is already marked as registered in the alumni archive. Please sign in.`
    };
  }

  return {
    isValid: true,
    isDuplicate: false,
    matchedRecord: record
  };
}

/**
 * Registry Matcher Engine:
 * Compares applicant details against the uploaded CSV/Excel masterlist.
 * If details match the registrar dataset, returns a confirmed match allowing instant auto-registration.
 */
export function findRegistryMatch(query: {
  studentId?: string;
  fullName?: string;
  email?: string;
  batchYear?: string;
  course?: string;
}): RegistryMatchResult {
  const records = getRegistrarRecords();
  const normId = query.studentId ? normalizeStudentId(query.studentId).toUpperCase() : '';
  const queryName = query.fullName ? normalizeName(query.fullName) : '';
  const queryEmail = query.email ? query.email.trim().toLowerCase() : '';
  const queryBatch = query.batchYear ? query.batchYear.trim() : '';

  if (!normId && !queryName && !queryEmail) {
    return {
      isMatched: false,
      confidence: 0,
      matchReasons: [],
      message: 'Enter your Student ID or personal graduation details to check the registry.',
      canBypassVerification: false
    };
  }

  // 1. Direct Student ID Match with Security Ownership Challenge (Zero-Leak Policy)
  if (normId) {
    const idMatch = records.find(
      (r) => normalizeStudentId(r.studentId).toUpperCase() === normId
    );

    if (idMatch) {
      // Check for unverified status
      const isUnverified =
        (idMatch.status as string)?.toLowerCase() === 'unverified' ||
        idMatch.verification_status === 'unverified';

      if (isUnverified) {
        return {
          isMatched: false,
          confidence: 0,
          matchReasons: [],
          message: `Student ID '${normId}' could not be confirmed in St. Cecilia's College registrar records. Accepted formats: SCC-22-00017358 or SCC-2024-1001.`,
          canBypassVerification: false
        };
      }

      // Security Ownership Challenge:
      // An applicant claiming this ID MUST provide their matching details to prove rightful ownership
      // NEVER disclose the name, batch, or course stored in the record to an unverified claimant!
      const recordNameNorm = normalizeName(idMatch.fullName);
      const recordNaturalNorm = normalizeName(splitFullNameParts(idMatch.fullName).fullNameNatural);
      const qNameNorm = queryName ? normalizeName(queryName) : '';

      const hasName = Boolean(qNameNorm && qNameNorm.length >= 2);
      // Zero-tolerance exact match supporting both "Last, First M." and "First M. Last"
      const nameMatches = hasName && (recordNameNorm === qNameNorm || recordNaturalNorm === qNameNorm);

      const hasBatch = Boolean(queryBatch && queryBatch.trim().length >= 4);
      const batchMatches = hasBatch && idMatch.batchYear.trim() === queryBatch?.trim();

      // Normalize courses for comparison (exact match)
      const hasCourse = Boolean(query.course && query.course.trim().length >= 2);
      let courseMatches = true;
      if (hasCourse && idMatch.course) {
        const c1 = query.course!.toLowerCase().replace(/[^a-z0-9]/g, '');
        const c2 = idMatch.course.toLowerCase().replace(/[^a-z0-9]/g, '');
        courseMatches = c1 === c2;
      }

      // If user hasn't provided their name or batch yet, prompt them without disclosing the stored record
      if (!hasName || !hasBatch) {
        return {
          isMatched: false,
          confidence: 0,
          matchReasons: [],
          message: 'Security Notice: To protect student privacy and prevent unauthorized account claims, please enter the registered Full Name (including second/middle name) and Graduating Batch Year for this Student ID.',
          canBypassVerification: false
        };
      }

      // If claimant entered details, verify that Name, Batch, and Degree program match the stored record exactly
      if (!nameMatches || !batchMatches || !courseMatches) {
        return {
          isMatched: false,
          confidence: 0,
          matchReasons: [],
          // Strictly DO NOT reveal the actual name, batch, or degree
          message: 'Security Verification Failed: The Name (including second/middle name), Graduating Batch, or Degree Program you entered does not match the official registrar record for this Student ID.',
          canBypassVerification: false
        };
      }

      // Both ID and claimant's entered details match the registrar record!
      return {
        isMatched: true,
        record: idMatch,
        confidence: 100,
        matchReasons: [
          `Student ID authenticated: ${idMatch.studentId}`,
          'Identity ownership challenge verified (Name and Batch matched)',
          'Registrar archive confirmed'
        ],
        message: 'Identity & Academic Credentials Confirmed! Your details match the official registrar record on file for this Student ID.',
        canBypassVerification: true
      };
    }
  }

  // 2. Email Match (If registered in registrar masterlist)
  if (queryEmail) {
    const emailMatch = records.find(
      (r) => r.email && r.email.toLowerCase() === queryEmail
    );

    if (emailMatch) {
      return {
        isMatched: true,
        record: emailMatch,
        confidence: 95,
        matchReasons: [
          `Registrar email verified: ${emailMatch.email}`,
          `Student ID: ${emailMatch.studentId}`,
          `Class of ${emailMatch.batchYear}`
        ],
        message: `Institutional Record Found by Email for ${emailMatch.fullName} (ID: ${emailMatch.studentId}).`,
        canBypassVerification: true
      };
    }
  }

  // 3. Exact or High-Similarity Full Name Match + Batch Alignment
  if (queryName && queryName.length > 4) {
    const nameMatch = records.find((r) => {
      const recNorm = normalizeName(r.fullName);
      if (recNorm === queryName) return true;

      // Check all parts of name present
      const qParts = queryName.split(' ');
      const rParts = recNorm.split(' ');
      const matchingParts = qParts.filter((p) => p.length > 2 && rParts.includes(p));

      // At least 2 name components match (e.g. first and last name)
      if (matchingParts.length >= 2) {
        if (queryBatch) {
          return r.batchYear === queryBatch;
        }
        return true;
      }

      return false;
    });

    if (nameMatch) {
      const batchAligned = queryBatch ? nameMatch.batchYear === queryBatch : true;
      const confidence = batchAligned ? 90 : 75;

      return {
        isMatched: true,
        record: nameMatch,
        confidence,
        matchReasons: [
          `Full Name matched: ${nameMatch.fullName}`,
          `Class of ${nameMatch.batchYear}`,
          `Assigned ID: ${nameMatch.studentId}`
        ],
        message: `Masterlist Match: Graduate ${nameMatch.fullName} found under Student ID ${nameMatch.studentId}.`,
        canBypassVerification: true
      };
    }
  }

  return {
    isMatched: false,
    confidence: 0,
    matchReasons: [],
    message: 'No exact match found in the uploaded Registrar graduate masterlist. You may still register for manual registrar review.',
    canBypassVerification: false
  };
}

/**
 * Verifies if an applicant graduated from or attended St. Cecilia's College
 * (Updated to query the live dynamic masterlist)
 */
export async function verifyStudentRecord(params: {
  studentId: string;
  fullName?: string;
  batchYear?: string;
  course?: string;
}): Promise<VerificationResult> {
  // Simulate institutional database latency
  await new Promise((resolve) => setTimeout(resolve, 400));

  const normId = normalizeStudentId(params.studentId);

  if (!normId) {
    return {
      isVerified: false,
      message: 'Student ID number is required for graduate verification.',
      source: 'unverified'
    };
  }

  // 1. Check match in Accredited Registrar Records
  const records = getRegistrarRecords();
  const recordMatch = records.find(
    (r) => normalizeStudentId(r.studentId).toUpperCase() === normId.toUpperCase()
  );

  if (recordMatch) {
    // Explicit check for unverified records in registrar dataset (e.g., test unverified students)
    const isUnverified =
      recordMatch.status === 'unverified' ||
      recordMatch.verification_status === 'unverified';

    if (isUnverified) {
      return {
        isVerified: false,
        message: `Student ID '${params.studentId}' could not be confirmed in St. Cecilia's College registrar records. Accepted formats: SCC-22-00017358 or SCC-2024-1001.`,
        source: 'unverified'
      };
    }

    // Check if batch year aligns
    if (params.batchYear && recordMatch.batchYear !== params.batchYear.trim()) {
      return {
        isVerified: false,
        message: 'Security Verification Failed: The selected Batch does not match the registrar record for this Student ID. Details on file cannot be disclosed for identity protection.',
        source: 'unverified'
      };
    }

    // Check if name aligns if provided
    if (params.fullName) {
      const qNorm = normalizeName(params.fullName);
      const rNorm = normalizeName(recordMatch.fullName);
      const rNaturalNorm = normalizeName(splitFullNameParts(recordMatch.fullName).fullNameNatural);
      const qParts = qNorm.split(' ').filter((p) => p.length >= 2);
      const nameMatches =
        rNorm === qNorm ||
        rNaturalNorm === qNorm ||
        rNorm.includes(qNorm) ||
        rNaturalNorm.includes(qNorm) ||
        qNorm.includes(rNorm) ||
        qNorm.includes(rNaturalNorm) ||
        qParts.some((p) => rNorm.includes(p));

      if (!nameMatches) {
        return {
          isVerified: false,
          message: 'Security Verification Failed: The student name entered does not match the registrar record for this Student ID.',
          source: 'unverified'
        };
      }
    }

    return {
      isVerified: true,
      record: recordMatch,
      message: 'Identity & Academic Record Confirmed: Your credentials have been successfully authenticated against the official St. Cecilia’s College registrar archive.',
      source: 'database_match'
    };
  }

  // 2. Strict verification check: specifically rejects accounts where the academic record cannot be confirmed by the registrar
  return {
    isVerified: false,
    message: `Student ID '${params.studentId}' could not be confirmed in St. Cecilia's College registrar records. Accepted formats: SCC-22-00017358 or SCC-2024-1001.`,
    source: 'unverified'
  };
}

/**
 * Converts Excel serial date numbers or ISO date strings to MM/DD/YYYY
 */
function formatSpreadsheetDateValue(val: any): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'number' && val > 1000 && val < 90000) {
    const parsed = XLSX.SSF.parse_date_code(val);
    if (parsed && parsed.y && parsed.m && parsed.d) {
      const mm = String(parsed.m).padStart(2, '0');
      const dd = String(parsed.d).padStart(2, '0');
      return `${mm}/${dd}/${parsed.y}`;
    }
  }
  const str = String(val).trim().replace(/^["']|["']$/g, '').trim();
  if (!str) return '';

  // Numeric Excel serial passed as string
  if (/^\d{5}$/.test(str)) {
    const serial = parseInt(str, 10);
    if (serial > 1000 && serial < 90000) {
      const parsed = XLSX.SSF.parse_date_code(serial);
      if (parsed && parsed.y && parsed.m && parsed.d) {
        return `${String(parsed.m).padStart(2, '0')}/${String(parsed.d).padStart(2, '0')}/${parsed.y}`;
      }
    }
  }

  // YYYY-MM-DD -> MM/DD/YYYY
  const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(str);
  if (isoMatch) {
    return `${isoMatch[2].padStart(2, '0')}/${isoMatch[3].padStart(2, '0')}/${isoMatch[1]}`;
  }

  // M/D/YYYY or M/D/YY -> MM/DD/YYYY
  const slashMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(str);
  if (slashMatch) {
    const year = slashMatch[3].length === 2
      ? (parseInt(slashMatch[3], 10) >= 50 ? `19${slashMatch[3]}` : `20${slashMatch[3]}`)
      : slashMatch[3];
    return `${slashMatch[1].padStart(2, '0')}/${slashMatch[2].padStart(2, '0')}/${year}`;
  }

  return str;
}

/**
 * Parses CSV or Excel (.xlsx, .xls) file uploaded by the Registrar
 */
export async function parseRegistrarFile(file: File): Promise<StudentVerificationRecord[]> {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith('.csv') || fileName.endsWith('.txt')) {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
        complete: (results) => {
          try {
            const mapped = mapRowsToStudentRecords(results.data as any[]);
            resolve(mapped);
          } catch (err) {
            reject(err);
          }
        },
        error: (err) => reject(err)
      });
    });
  } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new Error('Excel workbook contains no sheets.');
    }
    const worksheet = workbook.Sheets[firstSheetName];

    // Read as 2D array of rows to intelligently find the true header row
    const rawMatrix: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false });
    if (!rawMatrix || rawMatrix.length === 0) {
      throw new Error('Excel sheet contains no data.');
    }

    // Identify header row index (scanning first 10 rows for known 7-column & legacy header indicators)
    let headerRowIndex = 0;
    const headerIndicators = [
      'id',
      'student',
      'fullname',
      'name',
      'course',
      'gname',
      'guardian',
      'homeno',
      'bdate',
      'homeadd',
      'address',
      'batch',
      'year',
      'program',
      'degree',
      'cohort',
      'status'
    ];

    for (let r = 0; r < Math.min(rawMatrix.length, 10); r++) {
      const rowValues = (rawMatrix[r] || []).map((c) => String(c || '').toLowerCase().replace(/[^a-z0-9]/g, ''));
      const matches = rowValues.filter((val) => headerIndicators.some((ind) => val.includes(ind)));
      if (matches.length >= 2) {
        headerRowIndex = r;
        break;
      }
    }

    // raw: false preserves formatted phone numbers (leading zero) and MM/DD/YYYY dates cleanly
    const rawData: any[] = XLSX.utils.sheet_to_json(worksheet, {
      range: headerRowIndex,
      defval: '',
      raw: false
    });

    return mapRowsToStudentRecords(rawData);
  } else {
    throw new Error('Unsupported file format. Please upload a CSV (.csv) or Excel (.xlsx, .xls) file.');
  }
}

/**
 * Flexible column mapper to handle the official 7-column Registrar format
 * (Student ID, FullName, Course, G_name, Home_No, B_date, Home_Add)
 * as well as legacy header variations.
 */
function mapRowsToStudentRecords(rows: any[]): StudentVerificationRecord[] {
  const records: StudentVerificationRecord[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || typeof row !== 'object') continue;

    let studentId = '';
    let fullName = '';
    let firstName = '';
    let middleName = '';
    let lastName = '';
    let suffix = '';
    let batchYear = '';
    let course = '';
    let guardianName = '';
    let phone = '';
    let birthDate = '';
    let homeAddress = '';
    let status: 'Graduated' | 'Enrolled' | 'Alumni' | 'unverified' = 'Graduated';
    let honors = '';
    let email = '';

    for (const [key, value] of Object.entries(row)) {
      const k = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      const rawV = String(value ?? '').trim();
      const v = rawV.replace(/^["']|["']$/g, '').trim();

      if (!v) continue;

      const isSheetParserEmptyKey = k.startsWith('empty') || k.startsWith('__empty');

      // 1. Student ID variations
      if (
        k.includes('studentid') ||
        k === 'id' ||
        k.includes('studentno') ||
        k.includes('idnumber') ||
        k.includes('studentnumber') ||
        k.includes('schoolid')
      ) {
        studentId = normalizeStudentId(v);
      }
      // 2. Guardian Name (G_name) - checked BEFORE general name matching
      else if (k === 'gname' || k.includes('guardian') || k.includes('parentname')) {
        guardianName = v;
      }
      // 3. Home Address (Home_Add)
      else if (k === 'homeadd' || k.includes('homeaddress') || k === 'address' || k.includes('permanentaddress')) {
        homeAddress = v;
      }
      // 4. Home / Contact Number (Home_No)
      else if (k === 'homeno' || k.includes('homenum') || k.includes('phone') || k.includes('contact') || k.includes('mobile') || k.includes('tel')) {
        phone = v;
      }
      // 5. Birthdate (B_date)
      else if (k === 'bdate' || k.includes('birthdate') || k === 'dob' || k.includes('birthday') || k.includes('dateofbirth')) {
        birthDate = formatSpreadsheetDateValue(value);
      }
      // 6. Split Name Columns
      else if (k.includes('firstname') || k === 'first' || k.includes('fname') || k.includes('givenname')) {
        firstName = v;
      } else if (k.includes('middlename') || k === 'middle' || k.includes('mname') || k === 'mi' || k.includes('middleinitial')) {
        middleName = v;
      } else if (k.includes('lastname') || k === 'last' || k.includes('lname') || k.includes('surname') || k.includes('familyname')) {
        lastName = v;
      } else if (k.includes('suffix') || k.includes('ext')) {
        suffix = v;
      }
      // 7. Combined Full Name (FullName)
      else if (
        k === 'fullname' ||
        (k.includes('name') &&
          !k.includes('course') &&
          !k.includes('program') &&
          !k.includes('school') &&
          !k.includes('college') &&
          !k.includes('university') &&
          !k.includes('company') &&
          !k.includes('dept') &&
          !k.includes('department') &&
          !k.includes('file')) ||
        k === 'graduate' ||
        k === 'student' ||
        k === 'alumni' ||
        k === 'alumnus' ||
        k === 'registrant' ||
        k === 'candidate'
      ) {
        fullName = v;
      }
      // 8. Batch / Graduation Year / Cohort
      else if (
        k.includes('batch') ||
        k.includes('gradyear') ||
        k.includes('year') ||
        k.includes('classof') ||
        k.includes('cohort')
      ) {
        const digits = v.replace(/[^0-9]/g, '');
        if (digits.length >= 4) {
          batchYear = digits.slice(-4);
        } else if (digits.length === 2) {
          batchYear = `20${digits}`;
        }
      }
      // 9. Course / Degree / Program / Major
      else if (
        k.includes('course') ||
        k.includes('degree') ||
        k.includes('program') ||
        k.includes('major') ||
        k.includes('curriculum')
      ) {
        course = v;
      }
      // 10. Honors / Remarks / Awards
      else if (k.includes('honor') || k.includes('award') || k.includes('remark') || k.includes('distinction')) {
        honors = v;
      }
      // 11. Email
      else if (k.includes('email') || k.includes('mail')) {
        email = v;
      }
      // 12. Status
      else if (k.includes('status')) {
        if (
          v.toLowerCase().includes('unverif') ||
          v.toLowerCase().includes('withheld') ||
          v.toLowerCase().includes('dispute') ||
          v.toLowerCase().includes('reject')
        ) {
          status = 'unverified';
        } else if (v.toLowerCase().includes('enroll')) {
          status = 'Enrolled';
        } else if (v.toLowerCase().includes('alumn')) {
          status = 'Alumni';
        } else {
          status = 'Graduated';
        }
      } else if (!isSheetParserEmptyKey) {
        // Keep unmapped non-empty cells ignored cleanly
      }
    }

    // Assemble split names if full name not explicitly provided
    if (!fullName && (firstName || lastName)) {
      fullName = [firstName, middleName, lastName, suffix].filter(Boolean).join(' ').trim();
    }

    // Fallback: If no explicit student ID was found, check if any column value matches ID pattern
    if (!studentId) {
      for (const val of Object.values(row)) {
        const str = String(val || '').trim();
        if (
          /^(SCC-|SC-)?\d{2}-\d{6,9}$/i.test(str) ||
          /^(SCC-|SC-)?\d{4}-\d{3,5}$/i.test(str)
        ) {
          studentId = normalizeStudentId(str);
          break;
        }
      }
    }

    // Intelligent Name Fallback
    if (!fullName) {
      for (const cellVal of Object.values(row)) {
        const str = String(cellVal || '').trim().replace(/^["']|["']$/g, '');
        if (
          str.length >= 3 &&
          str !== studentId &&
          str !== guardianName &&
          str !== homeAddress &&
          !/^\d+$/.test(str) &&
          !/^[A-Z0-9-]{6,}$/i.test(str) &&
          !/@/.test(str) &&
          !/^(https?:\/\/|\+?\d)/.test(str) &&
          !/^(bs|b\.s\.|bachelor|master|associate|diploma|college|university|graduated|enrolled|active|pending|none)/i.test(str) &&
          /^[a-zA-Z\s.,'-]+$/.test(str)
        ) {
          fullName = str;
          break;
        }
      }
    }

    if (studentId || fullName) {
      const resolvedId = studentId || `SCC-${batchYear || '2024'}-${generateSecureNumericCode(1000, 9999)}`;
      const derivedBatch = batchYear || deriveBatchYearFromStudentId(resolvedId);

      records.push({
        studentId: resolvedId,
        fullName: fullName || 'Accredited Graduate',
        batchYear: derivedBatch,
        course: course || 'BSIT',
        guardianName: guardianName || undefined,
        phone: phone || undefined,
        birthDate: birthDate || undefined,
        homeAddress: homeAddress || undefined,
        status,
        honors: honors || undefined,
        email: email || undefined,
        verifiedAt: new Date().toISOString().split('T')[0]
      });
    }
  }

  return records;
}

/**
 * Curated list of test student records matching the official 7-column institutional spreadsheet schema
 */
export const SAMPLE_TEST_STUDENTS: Array<{
  studentId: string;
  fullName: string;
  batchYear: string;
  course: string;
  guardianName: string;
  phone: string;
  birthDate: string;
  homeAddress: string;
  status: 'Graduated' | 'Enrolled' | 'Alumni';
  honors?: string;
  email?: string;
}> = [
  {
    studentId: 'SCC-22-00017358',
    fullName: 'Abellana, Vincent Anthony D.',
    batchYear: '2022',
    course: 'BSIT',
    guardianName: 'Andrea Q. Abellana',
    phone: '09608218788',
    birthDate: '07/08/2002',
    homeAddress: 'Pakigne, Minglanilla, Cebu',
    status: 'Graduated'
  },
  {
    studentId: 'SCC-20-00010846',
    fullName: 'Abendan, Christian James R.',
    batchYear: '2020',
    course: 'BSIT',
    guardianName: 'none',
    phone: '0919-362-2447',
    birthDate: '04/27/2004',
    homeAddress: 'Pob. Ward 2, Minglanilla, Cebu',
    status: 'Graduated'
  },
  {
    studentId: 'SCC-20-00010862',
    fullName: 'Adlawan, Eljohn Dave L.',
    batchYear: '2020',
    course: 'BSIT',
    guardianName: 'Merlin L. Adlawan',
    phone: '0963-900-8718',
    birthDate: '10/31/2003',
    homeAddress: 'Spring Village Pakigne Minglanilla Cebu',
    status: 'Graduated'
  },
  {
    studentId: 'SCC-22-00017264',
    fullName: 'Albarando, Romeo Jr. V.',
    batchYear: '2022',
    course: 'BSIT',
    guardianName: 'Romeo G. Albarando Sr.',
    phone: '09201358004',
    birthDate: '11/11/1997',
    homeAddress: 'Tubod Minglanilla Cebu',
    status: 'Graduated'
  },
  {
    studentId: 'SCC-17-0004402',
    fullName: 'ALBARICO, ARCHIE A.',
    batchYear: '2017',
    course: 'BSIT',
    guardianName: 'JESSIE A. ALBARICO',
    phone: '0949-185-3866',
    birthDate: '10/24/2000',
    homeAddress: 'TUNGHA-AN, MINGLANILLA, CEBU',
    status: 'Graduated'
  },
  {
    studentId: 'SCC-22-00014927',
    fullName: 'Almendras, Josh Vincent',
    batchYear: '2022',
    course: 'BSIT',
    guardianName: 'Lillian Konrad',
    phone: '09368437163',
    birthDate: '09/04/2003',
    homeAddress: '1823, Lawaan I, Talisay City, Cebu',
    status: 'Graduated'
  },
  {
    studentId: 'SCC-2024-1001',
    fullName: 'Morales, Alexander James',
    batchYear: '2024',
    course: 'BSIT',
    guardianName: 'Elena Morales',
    phone: '09171234567',
    birthDate: '05/14/2002',
    homeAddress: 'Linao, Minglanilla, Cebu',
    status: 'Graduated'
  }
];

const REGISTRAR_SEVEN_COLUMN_HEADERS = [
  'Student ID',
  'FullName',
  'Course',
  'G_name',
  'Home_No',
  'B_date',
  'Home_Add'
] as const;

/**
 * Downloads a pre-formatted 7-column CSV template populated with ready-to-test student records
 */
export function downloadSampleCsvTemplate(): void {
  const sampleRows = SAMPLE_TEST_STUDENTS.map((s) => [
    s.studentId,
    s.fullName,
    s.course,
    s.guardianName,
    s.phone,
    s.birthDate,
    s.homeAddress
  ]);

  const csvContent =
    '\uFEFF' +
    [
      REGISTRAR_SEVEN_COLUMN_HEADERS.join(','),
      ...sampleRows.map((row) => row.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(','))
    ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'st_cecilias_students_masterlist_template.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Downloads a pre-formatted 7-column Excel (.xlsx) file populated with ready-to-test student records
 */
export function downloadSampleExcelTemplate(): void {
  const data = SAMPLE_TEST_STUDENTS.map((s) => ({
    'Student ID': s.studentId,
    FullName: s.fullName,
    Course: s.course,
    G_name: s.guardianName,
    Home_No: s.phone,
    B_date: s.birthDate,
    Home_Add: s.homeAddress
  }));

  const worksheet = XLSX.utils.json_to_sheet(data, { header: [...REGISTRAR_SEVEN_COLUMN_HEADERS] });
  for (let r = 1; r <= data.length; r++) {
    const phoneRef = XLSX.utils.encode_cell({ r, c: 4 });
    if (worksheet[phoneRef]) {
      worksheet[phoneRef].t = 's';
      worksheet[phoneRef].z = '@';
    }
    const bdateRef = XLSX.utils.encode_cell({ r, c: 5 });
    if (worksheet[bdateRef]) {
      worksheet[bdateRef].t = 's';
      worksheet[bdateRef].z = '@';
    }
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Students Masterlist');

  worksheet['!cols'] = [
    { wch: 18 }, // Student ID
    { wch: 30 }, // FullName
    { wch: 12 }, // Course
    { wch: 24 }, // G_name
    { wch: 16 }, // Home_No
    { wch: 13 }, // B_date
    { wch: 38 }  // Home_Add
  ];

  XLSX.writeFile(workbook, 'st_cecilias_students_masterlist_template.xlsx');
}

export interface BulkImportOptions {
  deduplicationMode: 'merge' | 'skip_existing' | 'overwrite';
  uploadedBy?: string;
  sourceFile?: string;
  onProgress?: (processed: number, total: number) => void;
}

export interface BulkImportResult {
  totalParsed: number;
  importedToFirestore: number;
  updatedCount: number;
  skippedCount: number;
  invalidCount: number;
  readyStudentIds: Array<{ studentId: string; fullName: string; batchYear: string; course: string }>;
}

/**
 * Performs atomic bulk import of validated student records into Firestore database and local cache
 */
export async function bulkImportStudentsToFirestore(
  records: StudentVerificationRecord[],
  options: BulkImportOptions
): Promise<BulkImportResult> {
  const existing = getRegistrarRecords();
  const existingMap = new Map<string, StudentVerificationRecord>();
  existing.forEach((r) => {
    existingMap.set(normalizeStudentId(r.studentId).toUpperCase(), r);
  });

  const now = new Date().toISOString();
  const recordsToWriteToFirestore: StudentVerificationRecord[] = [];
  const readyStudentIds: Array<{ studentId: string; fullName: string; batchYear: string; course: string }> = [];

  let importedToFirestore = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let invalidCount = 0;

  for (const raw of records) {
    const normId = normalizeStudentId(raw.studentId).toUpperCase();
    if (!normId || !raw.fullName?.trim()) {
      invalidCount++;
      continue;
    }

    const exists = existingMap.has(normId);

    if (exists && options.deduplicationMode === 'skip_existing') {
      skippedCount++;
      continue;
    }

    const current = exists ? existingMap.get(normId)! : null;

    const consolidated: StudentVerificationRecord = {
      ...raw,
      studentId: normId,
      fullName: raw.fullName.trim(),
      batchYear: raw.batchYear ? String(raw.batchYear).trim() : (current?.batchYear || deriveBatchYearFromStudentId(normId)),
      course: raw.course ? raw.course.trim() : (current?.course || 'BSIT'),
      guardianName: raw.guardianName ?? current?.guardianName,
      phone: raw.phone ?? current?.phone,
      birthDate: raw.birthDate ?? current?.birthDate,
      homeAddress: raw.homeAddress ?? current?.homeAddress,
      status: raw.status || current?.status || 'Graduated',
      honors: raw.honors || current?.honors || undefined,
      email: raw.email || current?.email || undefined,
      isRegistered: current?.isRegistered ?? false,
      registeredAt: current?.registeredAt,
      matchedUid: current?.matchedUid,
      uploadedAt: now,
      uploadedBy: options.uploadedBy || 'Registrar Bulk CSV Utility',
      sourceFile: options.sourceFile || 'bulk_import.csv'
    };

    recordsToWriteToFirestore.push(consolidated);
    existingMap.set(normId, consolidated);

    if (exists) {
      updatedCount++;
    } else {
      importedToFirestore++;
    }

    if (readyStudentIds.length < 10) {
      readyStudentIds.push({
        studentId: consolidated.studentId,
        fullName: consolidated.fullName,
        batchYear: consolidated.batchYear,
        course: consolidated.course
      });
    }
  }

  // Update local storage cache immediately
  const finalLocalRecords = Array.from(existingMap.values());
  saveRegistrarRecords(finalLocalRecords);

  // Write batch into Firestore database with progress callback
  if (recordsToWriteToFirestore.length > 0) {
    await saveRegistryRecordsBatchToFirestore(recordsToWriteToFirestore, (processed, total) => {
      if (options.onProgress) {
        options.onProgress(processed, total);
      }
    });
  }

  return {
    totalParsed: records.length,
    importedToFirestore,
    updatedCount,
    skippedCount,
    invalidCount,
    readyStudentIds
  };
}

/**
 * Downloads the active registry records as a formatted 7-column CSV file:
 * Student ID | FullName | Course | G_name | Home_No | B_date | Home_Add
 */
export function exportRegistryRecordsToCsv(recordsToExport?: StudentVerificationRecord[]): void {
  const records = recordsToExport || getRegistrarRecords();

  const rows = records.map((r) => [
    r.studentId || '',
    r.fullName || '',
    r.course || '',
    r.guardianName || '',
    r.phone || '',
    r.birthDate || '',
    r.homeAddress || ''
  ]);

  const csvContent =
    '\uFEFF' +
    [
      REGISTRAR_SEVEN_COLUMN_HEADERS.map((h) => `"${h}"`).join(','),
      ...rows.map((row) => row.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(','))
    ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const dateStr = new Date().toISOString().split('T')[0];
  link.setAttribute('download', `st_cecilias_alumni_registry_audit_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Downloads the active registry records as a formatted 7-column Excel (.xlsx) file:
 * Student ID | FullName | Course | G_name | Home_No | B_date | Home_Add
 */
export function exportRegistryRecordsToExcel(recordsToExport?: StudentVerificationRecord[]): void {
  const records = recordsToExport || getRegistrarRecords();

  const data = records.map((r) => ({
    'Student ID': r.studentId || '',
    FullName: r.fullName || '',
    Course: r.course || '',
    G_name: r.guardianName || '',
    Home_No: r.phone || '',
    B_date: r.birthDate || '',
    Home_Add: r.homeAddress || ''
  }));

  const worksheet = XLSX.utils.json_to_sheet(data, { header: [...REGISTRAR_SEVEN_COLUMN_HEADERS] });
  for (let r = 1; r <= data.length; r++) {
    const phoneRef = XLSX.utils.encode_cell({ r, c: 4 });
    if (worksheet[phoneRef]) {
      worksheet[phoneRef].t = 's';
      worksheet[phoneRef].z = '@';
    }
    const bdateRef = XLSX.utils.encode_cell({ r, c: 5 });
    if (worksheet[bdateRef]) {
      worksheet[bdateRef].t = 's';
      worksheet[bdateRef].z = '@';
    }
  }

  worksheet['!cols'] = [
    { wch: 18 },
    { wch: 30 },
    { wch: 12 },
    { wch: 24 },
    { wch: 16 },
    { wch: 13 },
    { wch: 38 }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Registrar Registry');

  const dateStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(workbook, `st_cecilias_alumni_registry_audit_${dateStr}.xlsx`);
}

// =========================================================================
// CONFLICT RESOLUTION SYSTEM & REPOSITORY
// =========================================================================

export const INITIAL_REGISTRY_CONFLICTS: RegistrationConflictRecord[] = [];

/**
 * Retrieves all conflict records
 */
export function getRegistrationConflicts(): RegistrationConflictRecord[] {
  try {
    const raw = localStorage.getItem(REGISTRY_CONFLICTS_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Sanitize out old mock conflict records if previously stored in browser
    return parsed.filter((c) => c && !['conflict_01', 'conflict_02', 'conflict_03', 'conflict_04'].includes(c.id));
  } catch (err) {
    console.warn('Error reading registry conflicts from storage:', err);
    return [];
  }
}

/**
 * Saves conflict records
 */
export function saveRegistrationConflicts(conflicts: RegistrationConflictRecord[], silent: boolean = false): void {
  try {
    localStorage.setItem(REGISTRY_CONFLICTS_STORAGE_KEY, JSON.stringify(conflicts));
    if (!silent && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('conflicts-updated', { detail: conflicts }));
    }
  } catch (err) {
    console.error('Failed to save registration conflicts:', err);
  }
}

/**
 * Merges real-time cloud conflict snapshot with local cache and persists quietly
 */
export function mergeCloudConflictsWithLocal(cloudConflicts: RegistrationConflictRecord[]): RegistrationConflictRecord[] {
  const localConflicts = getRegistrationConflicts();
  const map = new Map<string, RegistrationConflictRecord>();

  localConflicts.forEach((c) => {
    if (c && c.id) map.set(c.id, c);
  });
  (cloudConflicts || []).forEach((c) => {
    if (c && c.id) map.set(c.id, c);
  });

  const merged = Array.from(map.values()).sort(
    (a, b) => new Date(b.flaggedAt || 0).getTime() - new Date(a.flaggedAt || 0).getTime()
  );

  saveRegistrationConflicts(merged, true);
  return merged;
}

/**
 * Adds a new conflict record to the queue and notifies Administrators & Moderators
 */
export function addRegistrationConflict(
  data: Omit<RegistrationConflictRecord, 'id' | 'flaggedAt' | 'status'>
): RegistrationConflictRecord {
  const current = getRegistrationConflicts();
  const newConflict: RegistrationConflictRecord = {
    ...data,
    id: generateSecureId('conflict'),
    flaggedAt: new Date().toISOString(),
    status: 'pending'
  };

  const updated = [newConflict, ...current.filter((c) => c.id !== newConflict.id)];
  saveRegistrationConflicts(updated);

  // Sync directly to Cloud Firestore so admins and moderators instantly see it
  saveConflictRecordToFirestore(newConflict).catch((err) => {
    console.warn('Failed to save conflict record to Firestore:', err);
  });

  // Notify Administrators & Moderators via Cloud Firestore notification queue
  const isManualAppeal =
    newConflict.conflictType === 'manual_verification_request' ||
    newConflict.conflictType === 'unlisted_record';
  const notif: AppNotification = {
    id: generateSecureId('notif_conflict'),
    toUid: 'admin',
    type: 'general',
    title: isManualAppeal
      ? 'New Manual Verification Appeal'
      : 'Student ID Dispute / Conflict Claim Filed',
    body: isManualAppeal
      ? `${newConflict.applicantName} (${newConflict.applicantEmail}) requested manual Registrar identity verification for ${newConflict.applicantCourse || 'Degree Program'}, Class of ${newConflict.applicantBatch || 'N/A'}.`
      : `${newConflict.applicantName} (${newConflict.applicantEmail}) submitted an ownership dispute for Student ID ${newConflict.applicantStudentId || 'N/A'}.`,
    refId: newConflict.id,
    read: false,
    createdAt: new Date().toISOString(),
    metadata: {
      targetRole: 'moderator',
      conflictId: newConflict.id,
      conflictType: newConflict.conflictType
    }
  };
  saveNotificationToFirestore(notif).catch((err) => {
    console.warn('Failed to dispatch conflict notification to Firestore:', err);
  });

  return newConflict;
}

/**
 * Syncs conflict records from Firestore with local storage
 */
export async function syncRegistrationConflictsWithFirestore(): Promise<RegistrationConflictRecord[]> {
  try {
    const cloudConflicts = await getConflictRecordsFromFirestore();
    const localConflicts = getRegistrationConflicts();
    const map = new Map<string, RegistrationConflictRecord>();

    // Merge cloud and local, giving cloud authority
    localConflicts.forEach((c) => {
      if (c && c.id) map.set(c.id, c);
    });
    cloudConflicts.forEach((c) => {
      if (c && c.id) map.set(c.id, c);
    });

    const merged = Array.from(map.values()).sort(
      (a, b) => new Date(b.flaggedAt || 0).getTime() - new Date(a.flaggedAt || 0).getTime()
    );

    saveRegistrationConflicts(merged);
    return merged;
  } catch (err) {
    console.warn('Notice syncing conflicts with Firestore:', err);
    return getRegistrationConflicts();
  }
}

/**
 * Resolves a conflict entry
 */
export function resolveConflictRecord(
  conflictId: string,
  decision: 'resolved_verified' | 'resolved_rejected' | 'dismissed',
  resolvedBy: string = 'Registrar Officer',
  resolutionNote?: string,
  conflictFallback?: RegistrationConflictRecord
): boolean {
  const current = getRegistrationConflicts();
  const index = current.findIndex((c) => c.id === conflictId);
  const existing = index !== -1 ? current[index] : conflictFallback;
  if (!existing) return false;

  const updatedConflict: RegistrationConflictRecord = {
    ...existing,
    status: decision,
    resolvedAt: new Date().toISOString(),
    resolvedBy,
    resolutionNote: resolutionNote || `Marked as ${decision} by ${resolvedBy}`
  };

  if (index !== -1) {
    current[index] = updatedConflict;
  } else {
    current.unshift(updatedConflict);
  }
  saveRegistrationConflicts(current);

  // Push update to Cloud Firestore
  saveConflictRecordToFirestore(updatedConflict).catch((err) => {
    console.warn('Failed to update conflict record in Firestore:', err);
  });

  // If verified by administrator, mark target student record as registered
  if (decision === 'resolved_verified' && existing.targetRegistryStudentId) {
    markRegistryRecordAsRegistered(existing.targetRegistryStudentId, existing.applicantUid || '');
  }

  return true;
}

// =========================================================================
// BACKEND SERVICE: INCOMING REGISTRATION EVALUATOR & MATCHING ENGINE
// =========================================================================

export interface RegistrationEvaluationResult {
  isAutoVerified: boolean;
  canBypassManualReview: boolean;
  status: 'AUTO_VERIFIED' | 'CONFLICT_FLAGGED' | 'MANUAL_REVIEW_REQUIRED';
  matchedRecord?: StudentVerificationRecord;
  confidenceScore: number;
  matchReasons: string[];
  conflictRecord?: RegistrationConflictRecord;
  message: string;
}

/**
 * Backend service function:
 * Compares incoming registration details against uploaded CSV records.
 * - If valid direct match: automatically flags valid registration for direct access, bypassing manual verification.
 * - If partial / suspicious match: creates a Conflict Resolution entry requiring registrar review to prevent duplicate accounts.
 * - If no record exists: routes to standard registration requiring manual approval.
 */
export function evaluateIncomingRegistration(
  applicant: {
    studentId?: string;
    name?: string;
    email?: string;
    batch?: string;
    course?: string;
    uid?: string;
  },
  existingUsers: any[] = []
): RegistrationEvaluationResult {
  const records = getRegistrarRecords();
  const normId = applicant.studentId ? normalizeStudentId(applicant.studentId).toUpperCase() : '';
  const applicantName = applicant.name ? applicant.name.trim() : '';
  const applicantEmail = applicant.email ? applicant.email.trim().toLowerCase() : '';
  const applicantBatch = applicant.batch ? applicant.batch.trim() : '';

  // 1. Check if the provided Student ID is already linked to another active account
  if (normId) {
    const existingAccountWithId = existingUsers.find(
      (u) =>
        u.studentId &&
        normalizeStudentId(u.studentId).toUpperCase() === normId &&
        (!applicant.uid || u.uid !== applicant.uid)
    );

    if (existingAccountWithId) {
      const conflict = addRegistrationConflict({
        applicantUid: applicant.uid,
        applicantName: applicantName || 'Unknown Applicant',
        applicantEmail: applicantEmail,
        applicantStudentId: normId,
        applicantBatch: applicantBatch,
        applicantCourse: applicant.course,
        targetRegistryStudentId: normId,
        conflictType: 'duplicate_id',
        severity: 'high',
        confidenceScore: 85,
        notes: `Student ID ${normId} is already associated with existing member "${existingAccountWithId.name}" (${existingAccountWithId.email}). Flagged to prevent account duplication or unauthorized takeover.`
      });

      return {
        isAutoVerified: false,
        canBypassManualReview: false,
        status: 'CONFLICT_FLAGGED',
        confidenceScore: 85,
        matchReasons: ['Duplicate Student ID detected'],
        conflictRecord: conflict,
        message: `Student ID ${normId} is already linked to an existing alumni account. Queued for Registrar conflict review.`
      };
    }
  }

  // 2. Check for Masterlist Match
  if (normId) {
    const recordMatch = records.find(
      (r) => normalizeStudentId(r.studentId).toUpperCase() === normId
    );

    if (recordMatch) {
      const recNameNorm = normalizeName(recordMatch.fullName);
      const appNameNorm = normalizeName(applicantName);

      // Evaluate Name Consistency
      const nameParts = appNameNorm.split(' ').filter((p) => p.length > 2);
      const hasNameOverlap = nameParts.some((part) => recNameNorm.includes(part));

      // Case A: Serious Name Mismatch
      if (applicantName && !hasNameOverlap) {
        const conflict = addRegistrationConflict({
          applicantUid: applicant.uid,
          applicantName,
          applicantEmail,
          applicantStudentId: normId,
          applicantBatch: applicantBatch,
          applicantCourse: applicant.course,
          targetRegistryStudentId: normId,
          registryRecord: recordMatch,
          conflictType: 'name_mismatch',
          severity: 'high',
          confidenceScore: 60,
          notes: `Applicant name "${applicantName}" does not correlate with official registry record "${recordMatch.fullName}" for Student ID ${normId}. Manual transcript verification required.`
        });

        return {
          isAutoVerified: false,
          canBypassManualReview: false,
          status: 'CONFLICT_FLAGGED',
          confidenceScore: 60,
          matchReasons: [`Student ID belongs to official graduate: ${recordMatch.fullName}`],
          conflictRecord: conflict,
          message: `Student ID matches ${recordMatch.fullName}, but registered name was "${applicantName}". Flagged for Registrar review.`
        };
      }

      // Case B: Batch Year Divergence
      if (
        applicantBatch &&
        recordMatch.batchYear &&
        Math.abs(parseInt(applicantBatch, 10) - parseInt(recordMatch.batchYear, 10)) >= 3
      ) {
        const conflict = addRegistrationConflict({
          applicantUid: applicant.uid,
          applicantName,
          applicantEmail,
          applicantStudentId: normId,
          applicantBatch: applicantBatch,
          applicantCourse: applicant.course,
          targetRegistryStudentId: normId,
          registryRecord: recordMatch,
          conflictType: 'batch_discrepancy',
          severity: 'medium',
          confidenceScore: 75,
          notes: `Batch year discrepancy: Applicant selected Class of ${applicantBatch}, but Registrar records specify Class of ${recordMatch.batchYear}.`
        });

        return {
          isAutoVerified: false,
          canBypassManualReview: false,
          status: 'CONFLICT_FLAGGED',
          confidenceScore: 75,
          matchReasons: [`Registry specifies Batch ${recordMatch.batchYear}`],
          conflictRecord: conflict,
          message: `Graduation cohort discrepancy detected (Batch ${applicantBatch} vs ${recordMatch.batchYear}). Queued for review.`
        };
      }

      // Case C: Valid High-Confidence Match -> AUTO-VERIFY & BYPASS MANUAL REVIEW
      const matchReasons = [
        `Accredited Student ID confirmed: ${recordMatch.studentId}`,
        `Graduate Name verified: ${recordMatch.fullName}`,
        `Degree: ${recordMatch.course} (Batch ${recordMatch.batchYear})`
      ];

      if (recordMatch.honors) {
        matchReasons.push(`Honors: ${recordMatch.honors}`);
      }

      // Automatically mark record as registered
      markRegistryRecordAsRegistered(normId, applicant.uid || '');

      return {
        isAutoVerified: true,
        canBypassManualReview: true,
        status: 'AUTO_VERIFIED',
        matchedRecord: recordMatch,
        confidenceScore: 100,
        matchReasons,
        message: `Official Registrar Masterlist Match! Verified Graduate: ${recordMatch.fullName} (${recordMatch.course}, Class of ${recordMatch.batchYear}). Instant auto-verification granted!`
      };
    }
  }

  // 3. Email Match against Registrar masterlist
  if (applicantEmail) {
    const emailMatch = records.find(
      (r) => r.email && r.email.toLowerCase() === applicantEmail
    );

    if (emailMatch) {
      markRegistryRecordAsRegistered(emailMatch.studentId, applicant.uid || '');
      return {
        isAutoVerified: true,
        canBypassManualReview: true,
        status: 'AUTO_VERIFIED',
        matchedRecord: emailMatch,
        confidenceScore: 95,
        matchReasons: [
          `Institutional email confirmed: ${emailMatch.email}`,
          `Graduate ID: ${emailMatch.studentId}`,
          `Class of ${emailMatch.batchYear}`
        ],
        message: `Institutional record confirmed via email for ${emailMatch.fullName}. Direct verified access granted.`
      };
    }
  }

  // 4. Default: No accredited record found
  return {
    isAutoVerified: false,
    canBypassManualReview: false,
    status: 'MANUAL_REVIEW_REQUIRED',
    confidenceScore: 0,
    matchReasons: [],
    message: 'No official Registrar masterlist match found. Account registered under pending status awaiting manual verification.'
  };
}

