/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  Scale,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  RefreshCw,
  UserCheck,
  UserX,
  Sparkles,
  ArrowRight,
  Clock,
  User,
  Mail,
  GraduationCap,
  Calendar,
  FileText,
  FileDown,
  CheckSquare,
  Square,
  Copy,
  Check,
  ChevronRight,
  AlertCircle,
  Building2,
  Briefcase,
  ExternalLink,
  Eye,
  X,
  Download,
  Activity,
  Layers,
  Globe,
  Radio,
  Plus,
  KeyRound,
  Camera,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ShieldCheck,
  Loader2
} from 'lucide-react';
import { useAlumni, getStoredSessionToken } from '../../context/AlumniContext';
import {
  getRegistrationConflicts,
  resolveConflictRecord,
  getRegistrarRecords,
  normalizeStudentId,
  markRegistryRecordAsRegistered,
  syncRegistrationConflictsWithFirestore,
  mergeCloudConflictsWithLocal,
  resolveConflictSubmissionSource,
  isDisputeStudentIdClaim,
  isRequestVerificationAppeal
} from '../../services/studentVerificationService';
import { subscribeToConflictRecords } from '../../lib/firebase';
import {
  analyzeUserRegistryIntegrity,
  calculateGovernanceIntegrityMetrics,
  RegistryDiscrepancyAnalysis
} from '../../services/governanceLogicService';
import { generateConflictResolutionPdfReport } from '../../services/conflictReportPdfService';
import {
  RegistrationConflictRecord,
  UserProfile,
  StudentVerificationRecord,
  normalizeSystemRole
} from '../../types';

interface AdminRequestsAndConflictsViewProps {
  initialSubTab?: 'alumni' | 'conflicts' | 'employers' | 'jobs' | 'requests' | 'identity' | 'history';
}

export const AdminRequestsAndConflictsView: React.FC<AdminRequestsAndConflictsViewProps> = ({
  initialSubTab = 'alumni'
}) => {
  const {
    users,
    opportunities,
    currentUser,
    showToast,
    addAuditLog,
    setUserVerified,
    updateAlumniProfile,
    setSelectedUserIdForModal,
    verifyEmployer,
    approveOpportunity,
    rejectOpportunity,
    deepLinkTarget,
    clearDeepLinkTarget
  } = useAlumni();

  // Tab mapping
  const resolveInitialTab = (): 'alumni' | 'conflicts' | 'employers' | 'jobs' | 'history' => {
    if (initialSubTab === 'conflicts') return 'conflicts';
    if (initialSubTab === 'employers') return 'employers';
    if (initialSubTab === 'jobs') return 'jobs';
    if (initialSubTab === 'history') return 'history';
    return 'alumni';
  };

  const [activeTab, setActiveTab] = useState<'alumni' | 'conflicts' | 'employers' | 'jobs' | 'history'>(resolveInitialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'perfect' | 'discrepancy' | 'high_priority'>('all');
  const [claimsStatusFilter, setClaimsStatusFilter] = useState<'all' | 'pending' | 'resolved_verified' | 'resolved_rejected'>('pending');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'resolved_verified' | 'resolved_rejected'>('pending');
  const [selectedSpectrumIndex, setSelectedSpectrumIndex] = useState<number | null>(null);

  // Conflict state & selection
  const [conflicts, setConflicts] = useState<RegistrationConflictRecord[]>([]);
  const [selectedConflictIds, setSelectedConflictIds] = useState<string[]>([]);
  const [bulkNote, setBulkNote] = useState('');
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);
  const [singleNotesById, setSingleNotesById] = useState<Record<string, string>>({});

  // Auto-reconciliation loading state
  const [isReconciling, setIsReconciling] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Server-persisted verification requests (for Selfie with ID lookup & audit linkage)
  interface ServerVerificationRequestSummary {
    id: string;
    userId: string;
    submissionSource?: 'dispute_student_id_claim' | 'request_verification';
    requestType?: 'claimed_id_dispute' | 'manual_verification_request';
    conflictId?: string;
    name: string;
    email: string;
    phone?: string;
    studentId: string;
    batch: string;
    course: string;
    originalOwnerUid?: string;
    originalOwnerName?: string;
    originalOwnerEmail?: string;
    originalOwnerStudentId?: string;
    originalOwnerCourse?: string;
    originalOwnerBatch?: string;
    selfieFileName?: string;
    selfieStoragePath?: string;
    selfieUploadedAt?: string;
    hasSelfieWithId?: boolean;
    selfieEndpoint?: string;
    notes?: string;
    submittedAt: string;
    status: 'pending' | 'approved' | 'rejected';
    rejectionReason?: string;
    reviewedAt?: string;
    reviewedByName?: string;
    reviewedByRole?: string;
  }

  interface VerificationInspectionTarget {
    source: 'alumni' | 'conflict';
    user?: UserProfile;
    analysis?: RegistryDiscrepancyAnalysis;
    conflict?: RegistrationConflictRecord;
    registryRecord?: StudentVerificationRecord;
    applicantName: string;
    applicantEmail: string;
    applicantPhone?: string;
    studentId?: string;
    course?: string;
    batch?: string;
    notes?: string;
    submittedAt?: string;
    isPending: boolean;
    currentStatusLabel: string;
    syncTranscriptOnApprove?: boolean;
  }

  const [serverVerificationRequests, setServerVerificationRequests] = useState<ServerVerificationRequestSummary[]>([]);
  const [selfieViewerTarget, setSelfieViewerTarget] = useState<VerificationInspectionTarget | null>(null);
  const [selfieViewerImageUrl, setSelfieViewerImageUrl] = useState<string | null>(null);
  const [selfieViewerFileName, setSelfieViewerFileName] = useState<string>('');
  const [selfieViewerUploadedAt, setSelfieViewerUploadedAt] = useState<string>('');
  const [isLoadingSelfieImage, setIsLoadingSelfieImage] = useState(false);
  const [selfieZoom, setSelfieZoom] = useState<number>(1);
  const [approveConfirmTarget, setApproveConfirmTarget] = useState<VerificationInspectionTarget | null>(null);
  const [rejectConfirmTarget, setRejectConfirmTarget] = useState<VerificationInspectionTarget | null>(null);
  const [rejectReasonText, setRejectReasonText] = useState<string>('');
  const [rejectReasonError, setRejectReasonError] = useState<string | null>(null);
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);

  const loadServerVerificationRequests = useCallback(async () => {
    const token = getStoredSessionToken();
    if (!token) return;
    try {
      const res = await fetch('/api/admin/alumni-verification-requests', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      if (data?.success && Array.isArray(data.requests)) {
        setServerVerificationRequests(data.requests);
      }
    } catch {
      // Offline or fallback mode
    }
  }, []);

  // Sync conflicts from storage & cloud Firestore
  const loadConflicts = useCallback(() => {
    try {
      const data = getRegistrationConflicts();
      setConflicts(data);
    } catch {
      setConflicts([]);
    }
  }, []);

  useEffect(() => {
    loadConflicts();
    loadServerVerificationRequests();
    // Initial fetch from Cloud Firestore to merge any cross-browser requests
    syncRegistrationConflictsWithFirestore().then((merged) => {
      setConflicts(merged);
    });

    // Real-time Firestore listener: merge cloud snapshot into local cache & state
    const unsubscribeFirestore = subscribeToConflictRecords((cloudConflicts) => {
      const merged = mergeCloudConflictsWithLocal(cloudConflicts || []);
      setConflicts(merged);
    });

    const handleUpdate = () => {
      loadConflicts();
      loadServerVerificationRequests();
    };
    window.addEventListener('storage', handleUpdate);
    window.addEventListener('conflicts-updated', handleUpdate);
    return () => {
      unsubscribeFirestore();
      window.removeEventListener('storage', handleUpdate);
      window.removeEventListener('conflicts-updated', handleUpdate);
    };
  }, [loadConflicts, loadServerVerificationRequests]);

  // Sync if initialSubTab prop changes
  useEffect(() => {
    setActiveTab(resolveInitialTab());
  }, [initialSubTab]);

  // Deep-link target routing from notifications
  useEffect(() => {
    if (!deepLinkTarget || (deepLinkTarget.targetType !== 'conflict' && deepLinkTarget.targetType !== 'verification')) return;
    if (deepLinkTarget.subTab === 'conflicts') {
      setActiveTab('conflicts');
      setStatusFilter('pending');
    } else if (deepLinkTarget.subTab === 'employers') {
      setActiveTab('employers');
    } else if (deepLinkTarget.subTab === 'jobs') {
      setActiveTab('jobs');
    } else {
      setActiveTab('alumni');
    }
    if (deepLinkTarget.targetId) {
      const targetUser = users.find((u) => u.uid === deepLinkTarget.targetId);
      if (targetUser) {
        setSearchQuery(targetUser.name || targetUser.email || '');
      }
    }
    clearDeepLinkTarget();
  }, [deepLinkTarget, users, clearDeepLinkTarget]);

  // Derived datasets
  const registrarRecords = useMemo(() => getRegistrarRecords(), []);

  // Authoritative classification helpers based strictly on original submission source
  // (NEVER on displayed label, Alumni name, Student ID, or current status):
  // - Dispute Student ID Claim                    -> Alumni Claims tab ONLY
  // - Request Verification / Manual Verification  -> Collisions & Appeals tab ONLY
  const isStudentIdDisputeRecord = useCallback((record: RegistrationConflictRecord): boolean => {
    return isDisputeStudentIdClaim(record);
  }, []);

  const isRequestVerificationRecord = useCallback((record: RegistrationConflictRecord): boolean => {
    return isRequestVerificationAppeal(record);
  }, []);

  const extractDisputeExplanation = useCallback((record: RegistrationConflictRecord): string => {
    if (record.disputeExplanation && record.disputeExplanation.trim()) {
      return record.disputeExplanation.trim();
    }
    const rawNotes = (record.notes || '').trim();
    const statementMatch = /Statement:\s*"([^"]+)"/i.exec(rawNotes);
    if (statementMatch && statementMatch[1]) {
      return statementMatch[1].trim();
    }
    return rawNotes || 'No explanation provided.';
  }, []);

  // Resolve the original registered account owner holding the contested Student ID (strictly distinct from the claimant)
  const findOriginalOwnerForDispute = useCallback(
    (claim: RegistrationConflictRecord): {
      user?: UserProfile;
      name?: string;
      email?: string;
      studentId?: string;
      course?: string;
      batch?: string;
      isVerified?: boolean;
    } | null => {
      const contestedSid = normalizeStudentId(claim.targetRegistryStudentId || claim.applicantStudentId || '').toUpperCase();
      const claimantEmail = (claim.applicantEmail || '').trim().toLowerCase();

      let matchedOwner: UserProfile | undefined;
      if (claim.originalOwnerUid) {
        matchedOwner = users.find((u) => !u.isDeleted && u.uid === claim.originalOwnerUid);
      }
      if (!matchedOwner && contestedSid) {
        const candidates = users.filter(
          (u) =>
            !u.isDeleted &&
            u.studentId &&
            normalizeStudentId(u.studentId).toUpperCase() === contestedSid &&
            (!claim.applicantUid || u.uid !== claim.applicantUid) &&
            (!claimantEmail || u.email?.trim().toLowerCase() !== claimantEmail)
        );
        matchedOwner = candidates.find((u) => u.isVerified) || candidates[0];
      }

      if (matchedOwner) {
        return {
          user: matchedOwner,
          name: matchedOwner.name,
          email: matchedOwner.email,
          studentId: matchedOwner.studentId || contestedSid,
          course: matchedOwner.course,
          batch: matchedOwner.batch,
          isVerified: matchedOwner.isVerified
        };
      }

      if (claim.originalOwnerName || claim.originalOwnerEmail) {
        return {
          name: claim.originalOwnerName,
          email: claim.originalOwnerEmail,
          studentId: claim.originalOwnerStudentId || contestedSid,
          course: claim.originalOwnerCourse,
          batch: claim.originalOwnerBatch
        };
      }

      return null;
    },
    [users]
  );

  // Unified, refresh-safe dataset combining Firestore/local records with backend-persisted requests
  const unifiedConflicts = useMemo<RegistrationConflictRecord[]>(() => {
    const mapServerStatus = (status: ServerVerificationRequestSummary['status']): RegistrationConflictRecord['status'] => {
      if (status === 'approved') return 'resolved_verified';
      if (status === 'rejected') return 'resolved_rejected';
      return 'pending';
    };

    const resolveServerSource = (r: ServerVerificationRequestSummary): 'dispute_student_id_claim' | 'request_verification' => {
      if (r.submissionSource === 'dispute_student_id_claim') return 'dispute_student_id_claim';
      if (r.submissionSource === 'request_verification') return 'request_verification';
      if (r.requestType === 'claimed_id_dispute') return 'dispute_student_id_claim';
      if (typeof r.notes === 'string' && r.notes.trim().toUpperCase().startsWith('STUDENT ID CLAIM DISPUTE')) {
        return 'dispute_student_id_claim';
      }
      return 'request_verification';
    };

    const findRegistryMatch = (sid?: string): StudentVerificationRecord | undefined => {
      if (!sid) return undefined;
      const norm = normalizeStudentId(sid).toUpperCase();
      if (!norm) return undefined;
      return registrarRecords.find((r) => normalizeStudentId(r.studentId).toUpperCase() === norm);
    };

    const matchedServerIds = new Set<string>();

    const enrichedLocal: RegistrationConflictRecord[] = conflicts.map((c) => {
      const cSource = resolveConflictSubmissionSource(c);
      const cIsDispute = cSource === 'dispute_student_id_claim';
      const cEmail = c.applicantEmail?.trim().toLowerCase() || '';
      const cSid = normalizeStudentId(c.targetRegistryStudentId || c.applicantStudentId || '').toUpperCase();

      const matchingServer = serverVerificationRequests.find((r) => {
        if (c.verificationRequestId && r.id === c.verificationRequestId) return true;
        if (r.conflictId && r.conflictId === c.id) return true;
        const rSource = resolveServerSource(r);
        if (cSource && rSource !== cSource) return false;
        const rEmail = (r.email || '').trim().toLowerCase();
        const rSid = normalizeStudentId(r.studentId || '').toUpperCase();
        return Boolean(cEmail && rEmail === cEmail && (!cSid || !rSid || cSid === rSid));
      });

      if (matchingServer) {
        matchedServerIds.add(matchingServer.id);
      }

      const resolvedStatus =
        c.status === 'pending' && matchingServer && matchingServer.status !== 'pending'
          ? mapServerStatus(matchingServer.status)
          : c.status;

      const finalSource = cSource || (matchingServer ? resolveServerSource(matchingServer) : undefined);

      return {
        ...c,
        ...(finalSource ? { submissionSource: finalSource } : {}),
        requestType:
          finalSource === 'dispute_student_id_claim'
            ? 'claimed_id_dispute'
            : finalSource === 'request_verification'
            ? 'manual_verification_request'
            : c.requestType || 'registration_conflict',
        status: resolvedStatus,
        applicantPhone: c.applicantPhone || matchingServer?.phone,
        originalOwnerUid: c.originalOwnerUid || matchingServer?.originalOwnerUid,
        originalOwnerName: c.originalOwnerName || matchingServer?.originalOwnerName,
        originalOwnerEmail: c.originalOwnerEmail || matchingServer?.originalOwnerEmail,
        originalOwnerStudentId: c.originalOwnerStudentId || matchingServer?.originalOwnerStudentId,
        originalOwnerCourse: c.originalOwnerCourse || matchingServer?.originalOwnerCourse,
        originalOwnerBatch: c.originalOwnerBatch || matchingServer?.originalOwnerBatch,
        registryRecord: c.registryRecord || findRegistryMatch(c.targetRegistryStudentId || c.applicantStudentId),
        verificationRequestId: c.verificationRequestId || matchingServer?.id,
        selfieWithIdName: c.selfieWithIdName || matchingServer?.selfieFileName,
        selfieStoragePath: c.selfieStoragePath || matchingServer?.selfieStoragePath,
        selfieWithIdUploadedAt: c.selfieWithIdUploadedAt || matchingServer?.selfieUploadedAt,
        reviewedAt: c.reviewedAt || matchingServer?.reviewedAt,
        reviewedByName: c.reviewedByName || matchingServer?.reviewedByName,
        reviewedByRole: c.reviewedByRole || matchingServer?.reviewedByRole,
        rejectionReason: c.rejectionReason || matchingServer?.rejectionReason
      };
    });

    // Hydrate any server-persisted requests not present in local/Firestore cache (ensures persistence across refresh & devices)
    const serverOnlyRecords: RegistrationConflictRecord[] = [];
    serverVerificationRequests.forEach((r) => {
      if (matchedServerIds.has(r.id)) return;
      const rSource = resolveServerSource(r);
      const isDispute = rSource === 'dispute_student_id_claim';
      const sid = r.studentId || '';
      serverOnlyRecords.push({
        id: r.conflictId || `server_req_${r.id}`,
        applicantUid: r.userId,
        applicantName: r.name,
        applicantEmail: r.email,
        applicantPhone: r.phone,
        applicantStudentId: sid,
        targetRegistryStudentId: isDispute ? sid : undefined,
        originalOwnerUid: r.originalOwnerUid,
        originalOwnerName: r.originalOwnerName,
        originalOwnerEmail: r.originalOwnerEmail,
        originalOwnerStudentId: r.originalOwnerStudentId,
        originalOwnerCourse: r.originalOwnerCourse,
        originalOwnerBatch: r.originalOwnerBatch,
        applicantBatch: r.batch,
        applicantCourse: r.course,
        registryRecord: findRegistryMatch(sid),
        conflictType: isDispute ? 'claimed_id_dispute' : 'manual_verification_request',
        submissionSource: rSource,
        requestType: isDispute ? 'claimed_id_dispute' : 'manual_verification_request',
        severity: isDispute ? 'high' : 'medium',
        confidenceScore: isDispute ? 85 : 50,
        flaggedAt: r.submittedAt,
        status: mapServerStatus(r.status),
        notes: r.notes || '',
        disputeExplanation: isDispute ? r.notes || '' : undefined,
        selfieWithIdName: r.selfieFileName,
        selfieStoragePath: r.selfieStoragePath,
        selfieWithIdUploadedAt: r.selfieUploadedAt,
        verificationRequestId: r.id,
        reviewedAt: r.reviewedAt,
        reviewedByName: r.reviewedByName,
        reviewedByRole: r.reviewedByRole,
        rejectionReason: r.rejectionReason
      });
    });

    const combined = [...enrichedLocal, ...serverOnlyRecords];

    // Deduplicate by ID (keeping the richest record without ever collapsing different submission sources)
    const dedupMap = new Map<string, RegistrationConflictRecord>();
    combined.forEach((rec) => {
      if (!rec.id) return;
      if (!dedupMap.has(rec.id)) {
        dedupMap.set(rec.id, rec);
      }
    });

    return Array.from(dedupMap.values()).sort(
      (a, b) => new Date(b.flaggedAt || 0).getTime() - new Date(a.flaggedAt || 0).getTime()
    );
  }, [conflicts, serverVerificationRequests, registrarRecords]);

  // 1. ALUMNI CLAIMS — Strictly Dispute Student ID Claim submissions ONLY
  const alumniDisputeClaims = useMemo(() => {
    return unifiedConflicts.filter((c) => isStudentIdDisputeRecord(c));
  }, [unifiedConflicts, isStudentIdDisputeRecord]);

  const pendingDisputeClaims = useMemo(() => {
    return alumniDisputeClaims.filter((c) => c.status === 'pending');
  }, [alumniDisputeClaims]);

  // Helper to identify whether a legacy UserProfile without a conflict doc originated from Request Verification
  // (strictly excludes Dispute Student ID Claim accounts and NEVER matches across different people by Student ID)
  const isUserManualVerificationRequest = useCallback(
    (u: UserProfile): boolean => {
      if (u.verificationSubmissionSource === 'dispute_student_id_claim') return false;
      if (u.studentId && u.studentId.toUpperCase().startsWith('SCC-DISPUTE-')) return false;

      const cleanEmail = u.email?.trim().toLowerCase() || '';
      const hasDisputeConflict = alumniDisputeClaims.some(
        (c) =>
          (c.applicantUid && c.applicantUid === u.uid) ||
          (cleanEmail && c.applicantEmail?.trim().toLowerCase() === cleanEmail)
      );
      if (hasDisputeConflict) return false;

      if (u.verificationSubmissionSource === 'request_verification') return true;
      if (u.verificationStatus === 'pending_review') return true;
      if (u.studentId && u.studentId.toUpperCase().startsWith('SCC-PENDING-')) return true;
      if (u.verificationProofUrl || u.verificationSubmittedAt || u.verificationNotes) return true;
      return false;
    },
    [alumniDisputeClaims]
  );

  // 2. COLLISIONS & APPEALS — Strictly Request Verification / Manual Verification Appeal submissions ONLY
  //    (NEVER includes Dispute Student ID Claim records)
  const collisionAndAppealConflicts = useMemo<RegistrationConflictRecord[]>(() => {
    const baseRequestVerifications = unifiedConflicts.filter((c) => isRequestVerificationRecord(c));

    // Preserve any legacy unverified Request Verification users that do not yet have a conflict document
    const legacyManualUsers = users.filter((u) => {
      if (u.role !== 'alumni' || u.isVerified || u.isDeleted) return false;
      if (u.verificationStatus === 'rejected' || u.accountStatus === 'REJECTED') return false;
      if (!isUserManualVerificationRequest(u)) return false;

      const cleanEmail = u.email?.trim().toLowerCase() || '';
      const alreadyListed = baseRequestVerifications.some(
        (c) =>
          (c.applicantUid && c.applicantUid === u.uid) ||
          (cleanEmail && c.applicantEmail?.trim().toLowerCase() === cleanEmail)
      );
      return !alreadyListed;
    });

    const derivedLegacyRecords: RegistrationConflictRecord[] = legacyManualUsers.map((u) => ({
      id: `legacy_manual_${u.uid}`,
      applicantUid: u.uid,
      applicantName: u.name,
      applicantEmail: u.email,
      applicantPhone: u.phone,
      applicantStudentId: u.studentId,
      applicantBatch: u.batch,
      applicantCourse: u.course,
      registryRecord: u.studentId
        ? registrarRecords.find(
            (r) => normalizeStudentId(r.studentId).toUpperCase() === normalizeStudentId(u.studentId!).toUpperCase()
          )
        : undefined,
      conflictType: 'manual_verification_request',
      submissionSource: 'request_verification',
      requestType: 'manual_verification_request',
      severity: 'medium',
      confidenceScore: 50,
      flaggedAt: u.verificationSubmittedAt || u.selfieWithIdUploadedAt || u.createdAt || new Date().toISOString(),
      status: 'pending',
      notes: u.verificationNotes || 'Manual verification request pending registrar review.',
      selfieWithIdUrl: u.selfieWithIdUrl || u.verificationProofUrl,
      selfieWithIdName: u.selfieWithIdName || u.verificationProofName,
      selfieWithIdUploadedAt: u.selfieWithIdUploadedAt || u.verificationSubmittedAt,
      verificationRequestId: u.verificationRequestId
    }));

    return [...baseRequestVerifications, ...derivedLegacyRecords].sort(
      (a, b) => new Date(b.flaggedAt || 0).getTime() - new Date(a.flaggedAt || 0).getTime()
    );
  }, [unifiedConflicts, users, registrarRecords, isRequestVerificationRecord, isUserManualVerificationRequest]);

  // Standard pending alumni accounts (used only for integrity metrics; Alumni Claims tab displays strictly Dispute Student ID Claims)
  const pendingAlumniUsers = useMemo(() => {
    return users.filter((u) => {
      if (u.isVerified || u.role !== 'alumni' || u.isDeleted) return false;
      if (u.verificationStatus === 'rejected' || u.accountStatus === 'REJECTED') return false;
      if (isUserManualVerificationRequest(u)) return false;

      const cleanEmail = u.email?.trim().toLowerCase() || '';
      const alreadyInDisputeClaims = alumniDisputeClaims.some(
        (c) =>
          (c.applicantUid && c.applicantUid === u.uid) ||
          (cleanEmail && c.applicantEmail?.trim().toLowerCase() === cleanEmail)
      );
      if (alreadyInDisputeClaims) return false;
      if (u.verificationSubmissionSource === 'dispute_student_id_claim') return false;
      if (u.studentId && u.studentId.toUpperCase().startsWith('SCC-DISPUTE-')) return false;

      return true;
    });
  }, [users, alumniDisputeClaims, isUserManualVerificationRequest]);

  const pendingEmployers = useMemo(() => {
    return users.filter(
      (u) => u.role === 'employer' && u.employerVerificationStatus === 'pending_verification'
    );
  }, [users]);

  const pendingJobs = useMemo(() => {
    return (opportunities || []).filter((o) => o.approvalStatus === 'pending_approval');
  }, [opportunities]);

  // Deep integrity analysis across standard pending alumni
  const pendingAnalyses: RegistryDiscrepancyAnalysis[] = useMemo(() => {
    return pendingAlumniUsers.map((u) => analyzeUserRegistryIntegrity(u, users, registrarRecords));
  }, [pendingAlumniUsers, users, registrarRecords]);

  const perfectMatchAnalyses = useMemo(() => {
    return pendingAnalyses.filter((a) => a.status === 'PERFECT_MATCH');
  }, [pendingAnalyses]);

  const discrepancyAnalyses = useMemo(() => {
    return pendingAnalyses.filter((a) => a.status !== 'PERFECT_MATCH');
  }, [pendingAnalyses]);

  // Pending Collisions & Appeals (strictly Request Verification / Manual Verification Appeal)
  const pendingConflicts = useMemo(() => {
    return collisionAndAppealConflicts.filter((c) => c.status === 'pending');
  }, [collisionAndAppealConflicts]);

  const resolvedConflicts = useMemo(() => {
    return unifiedConflicts.filter((c) => c.status !== 'pending');
  }, [unifiedConflicts]);

  const integrityMetrics = useMemo(() => {
    return calculateGovernanceIntegrityMetrics(users, unifiedConflicts);
  }, [users, unifiedConflicts]);

  const totalAlumniClaimsPendingCount = pendingDisputeClaims.length;

  const totalWorkloadCount =
    totalAlumniClaimsPendingCount + pendingConflicts.length + pendingEmployers.length + pendingJobs.length;

  // Command Center Signature: Interactive 7-Segment Spectrum Data
  const dynamicHeroData = useMemo(() => {
    const categories = [
      { id: 'collisions', label: 'ID Clash', count: pendingConflicts.length, sub: 'Appeals & Collisions', isUrgent: pendingConflicts.length > 0 },
      { id: 'perfect', label: '100% Match', count: perfectMatchAnalyses.length, sub: 'Exact Archive Match', isUrgent: false },
      { id: 'degree', label: 'Curriculum', count: pendingAnalyses.filter((a) => a.status === 'DEGREE_DISCREPANCY').length, sub: 'Degree Variance', isUrgent: false },
      { id: 'name', label: 'Name Diff', count: pendingAnalyses.filter((a) => a.status === 'NAME_DISCREPANCY').length, sub: 'Spelling Variance', isUrgent: false },
      { id: 'unreg', label: 'Unlisted', count: pendingDisputeClaims.length, sub: 'ID Disputes', isUrgent: pendingDisputeClaims.length > 0 },
      { id: 'employers', label: 'Partners', count: pendingEmployers.length, sub: 'Employer Vetting', isUrgent: pendingEmployers.length > 0 },
      { id: 'jobs', label: 'Job Review', count: pendingJobs.length, sub: 'Career Quality Check', isUrgent: pendingJobs.length > 0 }
    ];

    const bars = categories.map((cat) => {
      const segments: ('crimson' | 'muted')[] = [];
      const segCount = Math.min(5, Math.max(1, cat.count || 1));
      for (let i = 0; i < segCount; i++) {
        segments.push(cat.count > 0 ? 'crimson' : 'muted');
      }

      return {
        id: cat.id,
        label: cat.label,
        count: cat.count,
        sub: cat.sub,
        segments,
        activeDot: cat.isUrgent
      };
    });

    return {
      badge: 'Zero-Trust Tribunal',
      subtitle: 'Dispute Hearing Docket',
      title: 'Governance & Claims Triage',
      description: `${totalWorkloadCount} total claims in compliance queue • ${integrityMetrics.purityScore}% Masterlist Purity Index`,
      chip1Title: 'Masterlist Integrity',
      chip1Sub: `${integrityMetrics.purityScore}% archival alignment with Registrar`,
      chip1Count: `${integrityMetrics.verifiedAlumniCount} verified`,
      chip2Title: '1-Click Auto Reconcile',
      chip2Sub: `${perfectMatchAnalyses.length} alumni match 100% with official diploma archives`,
      bars
    };
  }, [
    pendingConflicts.length,
    perfectMatchAnalyses.length,
    pendingAnalyses,
    pendingDisputeClaims.length,
    pendingEmployers.length,
    pendingJobs.length,
    totalWorkloadCount,
    integrityMetrics
  ]);

  // Filtered Dispute Student ID Claims (Alumni Claims Tab)
  const filteredDisputeClaims = useMemo(() => {
    return alumniDisputeClaims.filter((c) => {
      const q = searchQuery.toLowerCase().trim();
      const explanation = extractDisputeExplanation(c).toLowerCase();
      const owner = findOriginalOwnerForDispute(c);
      const matchesSearch =
        !q ||
        c.applicantName.toLowerCase().includes(q) ||
        c.applicantEmail.toLowerCase().includes(q) ||
        (c.applicantPhone && c.applicantPhone.toLowerCase().includes(q)) ||
        (c.targetRegistryStudentId && c.targetRegistryStudentId.toLowerCase().includes(q)) ||
        (c.applicantStudentId && c.applicantStudentId.toLowerCase().includes(q)) ||
        (c.applicantCourse && c.applicantCourse.toLowerCase().includes(q)) ||
        (c.applicantBatch && c.applicantBatch.toLowerCase().includes(q)) ||
        (owner?.name && owner.name.toLowerCase().includes(q)) ||
        (owner?.email && owner.email.toLowerCase().includes(q)) ||
        explanation.includes(q);

      const matchesStatus =
        claimsStatusFilter === 'all' ? true : c.status === claimsStatusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [alumniDisputeClaims, searchQuery, claimsStatusFilter, extractDisputeExplanation, findOriginalOwnerForDispute]);

  // Filtered Standard Alumni Applicants (Alumni Claims Tab)
  const filteredAlumniAnalyses = useMemo(() => {
    if (claimsStatusFilter !== 'all' && claimsStatusFilter !== 'pending') {
      return [];
    }
    return pendingAnalyses.filter((analysis) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        analysis.user.name.toLowerCase().includes(q) ||
        analysis.user.email.toLowerCase().includes(q) ||
        (analysis.user.studentId && analysis.user.studentId.toLowerCase().includes(q)) ||
        (analysis.user.course && analysis.user.course.toLowerCase().includes(q));

      let matchesFilter = true;
      if (filterType === 'perfect') {
        matchesFilter = analysis.status === 'PERFECT_MATCH';
      } else if (filterType === 'discrepancy') {
        matchesFilter = analysis.status !== 'PERFECT_MATCH';
      } else if (filterType === 'high_priority') {
        matchesFilter = analysis.status === 'COLLISION_RISK' || analysis.status === 'UNREGISTERED_ID';
      }

      if (selectedSpectrumIndex !== null) {
        const cat = dynamicHeroData.bars[selectedSpectrumIndex];
        if (cat) {
          if (cat.id === 'perfect') matchesFilter = analysis.status === 'PERFECT_MATCH';
          if (cat.id === 'degree') matchesFilter = analysis.status === 'DEGREE_DISCREPANCY';
          if (cat.id === 'name') matchesFilter = analysis.status === 'NAME_DISCREPANCY';
          if (cat.id === 'unreg') matchesFilter = analysis.status === 'UNREGISTERED_ID';
        }
      }

      return matchesSearch && matchesFilter;
    });
  }, [pendingAnalyses, searchQuery, filterType, claimsStatusFilter, selectedSpectrumIndex, dynamicHeroData]);

  // Filtered Collisions & Appeals (strictly Request Verification / Manual Verification Request & non-dispute collisions)
  const filteredConflicts = useMemo(() => {
    const sourceList = activeTab === 'history' ? unifiedConflicts : collisionAndAppealConflicts;
    return sourceList.filter((c) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        c.applicantName.toLowerCase().includes(q) ||
        c.applicantEmail.toLowerCase().includes(q) ||
        (c.applicantStudentId && c.applicantStudentId.toLowerCase().includes(q)) ||
        (c.applicantCourse && c.applicantCourse.toLowerCase().includes(q)) ||
        (c.applicantBatch && c.applicantBatch.toLowerCase().includes(q)) ||
        (c.registryRecord?.fullName && c.registryRecord.fullName.toLowerCase().includes(q));

      const matchesStatus =
        activeTab === 'history'
          ? c.status !== 'pending'
          : statusFilter === 'all'
          ? true
          : c.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [collisionAndAppealConflicts, unifiedConflicts, searchQuery, statusFilter, activeTab]);

  // Filtered Employers
  const filteredEmployers = useMemo(() => {
    return pendingEmployers.filter((e) => {
      const q = searchQuery.toLowerCase().trim();
      return (
        !q ||
        e.name.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        (e.companyName && e.companyName.toLowerCase().includes(q))
      );
    });
  }, [pendingEmployers, searchQuery]);

  // Filtered Jobs
  const filteredJobs = useMemo(() => {
    return pendingJobs.filter((j) => {
      const q = searchQuery.toLowerCase().trim();
      return (
        !q ||
        j.title.toLowerCase().includes(q) ||
        j.company.toLowerCase().includes(q) ||
        j.location.toLowerCase().includes(q)
      );
    });
  }, [pendingJobs, searchQuery]);

  // Clipboard copy helper
  const copyToClipboard = (text: string, label: string = 'Text') => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    showToast(`Copied ${label} to clipboard`, 'info');
    setTimeout(() => setCopiedText(null), 1800);
  };

  // Helper to locate linked Alumni account for a conflict record
  // Strictly matches by applicantUid or applicantEmail ONLY (never by Student ID, which on disputes belongs to the original account owner)
  const findLinkedUserForConflict = useCallback(
    (conflict: RegistrationConflictRecord): UserProfile | undefined => {
      const cleanEmail = conflict.applicantEmail?.trim().toLowerCase();
      return users.find(
        (u) =>
          (conflict.applicantUid && u.uid === conflict.applicantUid) ||
          (cleanEmail && u.email?.trim().toLowerCase() === cleanEmail)
      );
    },
    [users]
  );

  // Helper to locate linked conflict record for an Alumni account (strictly by UID or email)
  const findLinkedConflictForUser = useCallback(
    (user: UserProfile): RegistrationConflictRecord | undefined => {
      const cleanEmail = user.email?.trim().toLowerCase();
      return unifiedConflicts.find(
        (c) =>
          (c.applicantUid && c.applicantUid === user.uid) ||
          (cleanEmail && c.applicantEmail?.trim().toLowerCase() === cleanEmail)
      );
    },
    [unifiedConflicts]
  );

  // Helper to locate matching server verification request summary (strictly scoped by submissionSource / requestType)
  const findServerRequestMatch = useCallback(
    (params: {
      conflictId?: string;
      userId?: string;
      email?: string;
      submissionSource?: 'dispute_student_id_claim' | 'request_verification';
      requestType?: string;
    }) => {
      const cleanEmail = params.email?.trim().toLowerCase();
      // 1. Exact conflictId match first
      if (params.conflictId) {
        const byConflict = serverVerificationRequests.find((r) => r.conflictId === params.conflictId);
        if (byConflict) return byConflict;
      }
      const hasConstraint = Boolean(params.submissionSource || params.requestType);
      const candidates = hasConstraint
        ? serverVerificationRequests.filter((r) => {
            const rSource =
              r.submissionSource ||
              (r.requestType === 'claimed_id_dispute' ? 'dispute_student_id_claim' : 'request_verification');
            const rType = r.requestType || (rSource === 'dispute_student_id_claim' ? 'claimed_id_dispute' : 'manual_verification_request');
            if (params.submissionSource && rSource !== params.submissionSource) return false;
            if (params.requestType && rType !== params.requestType) return false;
            return true;
          })
        : serverVerificationRequests;
      return candidates.find(
        (r) =>
          (params.userId && r.userId === params.userId) ||
          (cleanEmail && r.email && r.email.trim().toLowerCase() === cleanEmail)
      );
    },
    [serverVerificationRequests]
  );

  // Check whether a request/user has an actual uploaded Selfie with ID available locally or on server
  const hasUploadedSelfieForTarget = useCallback(
    (params: { user?: UserProfile; conflict?: RegistrationConflictRecord }): boolean => {
      const { user, conflict } = params;
      if (conflict?.selfieWithIdUrl || conflict?.selfieStoragePath) return true;
      const linkedConflict = user && !conflict ? findLinkedConflictForUser(user) : conflict;
      const isDispute = linkedConflict ? isStudentIdDisputeRecord(linkedConflict) : false;
      if (linkedConflict?.selfieWithIdUrl || linkedConflict?.selfieStoragePath) return true;
      const linkedUser = conflict && !user ? findLinkedUserForConflict(conflict) : user;
      if (!isDispute && (linkedUser?.selfieWithIdUrl || linkedUser?.verificationProofUrl)) return true;
      if (isDispute && linkedUser?.verificationSubmissionSource === 'dispute_student_id_claim' && linkedUser?.selfieWithIdUrl) {
        return true;
      }
      const serverMatch = findServerRequestMatch({
        conflictId: linkedConflict?.id,
        userId: linkedUser?.uid || linkedConflict?.applicantUid,
        email: linkedConflict?.applicantEmail || linkedUser?.email,
        submissionSource: linkedConflict
          ? isDispute
            ? 'dispute_student_id_claim'
            : 'request_verification'
          : undefined,
        requestType: linkedConflict
          ? isDispute
            ? 'claimed_id_dispute'
            : 'manual_verification_request'
          : undefined
      });
      return Boolean(serverMatch?.hasSelfieWithId);
    },
    [findLinkedConflictForUser, findLinkedUserForConflict, findServerRequestMatch, isStudentIdDisputeRecord]
  );

  // Build unified inspection target from an Alumni Claims card
  const buildInspectionTargetFromAnalysis = useCallback(
    (analysis: RegistryDiscrepancyAnalysis, syncTranscriptOnApprove: boolean = false): VerificationInspectionTarget => {
      const linkedConflict = findLinkedConflictForUser(analysis.user);
      const isPending =
        !analysis.user.isVerified &&
        analysis.user.verificationStatus !== 'rejected' &&
        analysis.user.accountStatus !== 'REJECTED';
      return {
        source: 'alumni',
        user: analysis.user,
        analysis,
        conflict: linkedConflict,
        registryRecord: analysis.registryRecord || linkedConflict?.registryRecord,
        applicantName: analysis.user.name,
        applicantEmail: analysis.user.email,
        applicantPhone: analysis.user.phone,
        studentId: analysis.user.studentId || linkedConflict?.applicantStudentId,
        course: analysis.user.course || linkedConflict?.applicantCourse,
        batch: analysis.user.batch || linkedConflict?.applicantBatch,
        notes: analysis.user.verificationNotes || linkedConflict?.notes,
        submittedAt: analysis.user.verificationSubmittedAt || analysis.user.selfieWithIdUploadedAt || linkedConflict?.flaggedAt || analysis.user.createdAt,
        isPending,
        currentStatusLabel: analysis.user.isVerified
          ? 'Verified'
          : analysis.user.verificationStatus === 'rejected'
          ? 'Rejected'
          : 'Pending Review',
        syncTranscriptOnApprove
      };
    },
    [findLinkedConflictForUser]
  );

  // Build unified inspection target from a Dispute Claim or Collisions & Appeals card
  const buildInspectionTargetFromConflict = useCallback(
    (conflict: RegistrationConflictRecord): VerificationInspectionTarget => {
      const linkedUser = findLinkedUserForConflict(conflict);
      const isDispute = isStudentIdDisputeRecord(conflict);
      const effectiveSid = isDispute
        ? conflict.targetRegistryStudentId || conflict.applicantStudentId || linkedUser?.studentId
        : conflict.applicantStudentId || linkedUser?.studentId;
      const matchedRegistry =
        conflict.registryRecord ||
        (effectiveSid
          ? registrarRecords.find(
              (r) =>
                normalizeStudentId(r.studentId).toUpperCase() ===
                normalizeStudentId(effectiveSid).toUpperCase()
            )
          : undefined);
      return {
        source: isDispute ? 'alumni' : 'conflict',
        user: linkedUser,
        conflict,
        registryRecord: matchedRegistry,
        applicantName: conflict.applicantName,
        applicantEmail: conflict.applicantEmail,
        applicantPhone: linkedUser?.phone,
        studentId: effectiveSid,
        course: conflict.applicantCourse || linkedUser?.course,
        batch: conflict.applicantBatch || linkedUser?.batch,
        notes: isDispute ? extractDisputeExplanation(conflict) : conflict.notes || linkedUser?.verificationNotes,
        submittedAt: conflict.selfieWithIdUploadedAt || conflict.flaggedAt || linkedUser?.verificationSubmittedAt,
        isPending: conflict.status === 'pending',
        currentStatusLabel:
          conflict.status === 'pending'
            ? 'Pending Review'
            : conflict.status === 'resolved_verified'
            ? 'Approved & Verified'
            : conflict.status === 'resolved_rejected'
            ? 'Rejected'
            : conflict.status
      };
    },
    [findLinkedUserForConflict, registrarRecords, isStudentIdDisputeRecord, extractDisputeExplanation]
  );

  // Open Selfie with ID Viewer modal and securely resolve the ACTUAL uploaded image for this Alumni/request
  const openSelfieViewer = useCallback(
    async (target: VerificationInspectionTarget) => {
      setSelfieViewerTarget(target);
      setSelfieZoom(1);
      setSelfieViewerImageUrl(null);
      setSelfieViewerFileName('');
      setSelfieViewerUploadedAt('');

      const isDisputeTarget = target.conflict ? isStudentIdDisputeRecord(target.conflict) : false;
      const localImage = isDisputeTarget
        ? target.conflict?.selfieWithIdUrl ||
          (target.user?.verificationSubmissionSource === 'dispute_student_id_claim'
            ? target.user?.selfieWithIdUrl
            : null) ||
          null
        : target.conflict?.selfieWithIdUrl ||
          target.user?.selfieWithIdUrl ||
          target.user?.verificationProofUrl ||
          null;
      const localFileName =
        target.conflict?.selfieWithIdName ||
        target.user?.selfieWithIdName ||
        target.user?.verificationProofName ||
        'Selfie_with_ID.jpg';
      const localUploadedAt =
        target.conflict?.selfieWithIdUploadedAt ||
        target.user?.selfieWithIdUploadedAt ||
        target.user?.verificationSubmittedAt ||
        target.submittedAt ||
        '';

      if (localImage) {
        setSelfieViewerImageUrl(localImage);
        setSelfieViewerFileName(localFileName);
        setSelfieViewerUploadedAt(localUploadedAt);
        return;
      }

      // Otherwise fetch from the role-restricted backend endpoint using authenticated session token
      const token = getStoredSessionToken();
      if (!token) return;

      const desiredSubmissionSource: 'dispute_student_id_claim' | 'request_verification' | undefined = target.conflict
        ? isDisputeTarget
          ? 'dispute_student_id_claim'
          : 'request_verification'
        : undefined;
      const desiredRequestType = target.conflict
        ? isDisputeTarget
          ? 'claimed_id_dispute'
          : 'manual_verification_request'
        : undefined;

      const serverMatch = findServerRequestMatch({
        conflictId: target.conflict?.id,
        userId: target.user?.uid || target.conflict?.applicantUid,
        email: target.applicantEmail,
        submissionSource: desiredSubmissionSource,
        requestType: desiredRequestType
      });
      const lookupId =
        target.conflict?.verificationRequestId ||
        serverMatch?.id ||
        target.conflict?.id ||
        target.user?.verificationRequestId ||
        target.user?.uid ||
        '';

      if (!lookupId && !target.applicantEmail) return;

      setIsLoadingSelfieImage(true);
      try {
        const params = new URLSearchParams();
        if (target.applicantEmail) params.set('email', target.applicantEmail);
        if (target.user?.uid) params.set('userId', target.user.uid);
        if (target.conflict?.id) params.set('conflictId', target.conflict.id);
        if (desiredSubmissionSource) params.set('submissionSource', desiredSubmissionSource);
        if (desiredRequestType) params.set('requestType', desiredRequestType);
        const queryStr = params.toString() ? `?${params.toString()}` : '';
        const res = await fetch(
          `/api/admin/verification-requests/${encodeURIComponent(lookupId || 'lookup')}/selfie${queryStr}`,
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );
        if (res.ok) {
          const data = await res.json().catch(() => null);
          if (data?.success && data.imageDataUrl) {
            setSelfieViewerImageUrl(data.imageDataUrl);
            setSelfieViewerFileName(data.fileName || localFileName);
            setSelfieViewerUploadedAt(data.uploadedAt || localUploadedAt);
          }
        }
      } catch {
        // Leave image empty (never display placeholder/sample photos)
      } finally {
        setIsLoadingSelfieImage(false);
      }
    },
    [findServerRequestMatch, isStudentIdDisputeRecord]
  );

  const openApproveConfirmation = useCallback((target: VerificationInspectionTarget) => {
    if (!target.isPending) {
      showToast('This verification request has already been processed.', 'info');
      return;
    }
    setApproveConfirmTarget(target);
  }, [showToast]);

  const openRejectConfirmation = useCallback((target: VerificationInspectionTarget) => {
    if (!target.isPending) {
      showToast('This verification request has already been processed.', 'info');
      return;
    }
    const existingInlineNote = target.conflict?.id ? (singleNotesById[target.conflict.id] || '').trim() : '';
    setRejectReasonText(existingInlineNote);
    setRejectReasonError(null);
    setRejectConfirmTarget(target);
  }, [showToast, singleNotesById]);

  // Helper to resolve duplicate pending conflicts for the SAME applicant within the SAME submission source
  // (NEVER matches across different alumni via shared Student ID)
  const autoResolveMatchingConflicts = (
    userId: string,
    _studentId?: string,
    decision: 'resolved_verified' | 'resolved_rejected' = 'resolved_verified',
    noteText?: string,
    reviewerMeta?: {
      reviewedByUid?: string;
      reviewedByName?: string;
      reviewedByRole?: string;
      reviewedAt?: string;
      rejectionReason?: string;
    },
    onlyDisputeCategory?: boolean
  ) => {
    const matchedUser = users.find((u) => u.uid === userId);
    const emailLower = matchedUser?.email?.trim().toLowerCase();
    const actorName = reviewerMeta?.reviewedByName || currentUser?.name || 'Authorized Reviewer';

    conflicts
      .filter((c) => {
        if (c.status !== 'pending') return false;
        if (typeof onlyDisputeCategory === 'boolean' && isStudentIdDisputeRecord(c) !== onlyDisputeCategory) {
          return false;
        }
        return true;
      })
      .forEach((c) => {
        const matchesUid = Boolean(c.applicantUid && c.applicantUid === userId);
        const matchesEmail = Boolean(emailLower && c.applicantEmail?.trim().toLowerCase() === emailLower);

        if (matchesUid || matchesEmail) {
          resolveConflictRecord(
            c.id,
            decision,
            actorName,
            noteText ||
              (decision === 'resolved_verified'
                ? `Approved and verified by ${actorName}.`
                : `Rejected by ${actorName}.`),
            c,
            reviewerMeta
          );
        }
      });
  };

  // Confirm Approve & Verify execution (strictly atomic, duplicate-guarded, preserves Alumni role)
  const handleConfirmApproveAndVerify = async () => {
    if (!approveConfirmTarget || isSubmittingDecision) return;

    const target = approveConfirmTarget;
    const actorRole = normalizeSystemRole(currentUser?.role);
    if (!['moderator', 'admin', 'superadmin'].includes(actorRole)) {
      showToast('Permission denied: Moderator, Admin, or Superadmin clearance required.', 'error');
      return;
    }

    // Re-check live state to prevent duplicate approvals or conflicting status updates
    const latestConflict = target.conflict
      ? unifiedConflicts.find((c) => c.id === target.conflict!.id) || target.conflict
      : undefined;
    const latestUser = target.user
      ? users.find((u) => u.uid === target.user!.uid) || target.user
      : target.conflict
      ? findLinkedUserForConflict(target.conflict)
      : undefined;

    if (latestConflict && latestConflict.status !== 'pending') {
      showToast('This verification request has already been processed.', 'info');
      setApproveConfirmTarget(null);
      return;
    }
    if (!latestConflict && latestUser?.isVerified && latestUser.verificationStatus === 'verified') {
      showToast(`${latestUser.name} is already verified.`, 'info');
      setApproveConfirmTarget(null);
      return;
    }

    setIsSubmittingDecision(true);
    try {
      const nowIso = new Date().toISOString();
      const reviewerUid = currentUser?.uid || 'authorized_reviewer';
      const reviewerName = currentUser?.name || 'Authorized Reviewer';
      const reviewerMeta = {
        reviewedByUid: reviewerUid,
        reviewedByName: reviewerName,
        reviewedByRole: actorRole,
        reviewedAt: nowIso
      };

      const inlineNote = latestConflict?.id ? (singleNotesById[latestConflict.id] || '').trim() : '';
      const approvalNote =
        inlineNote || `Identity, Selfie with ID, and academic records approved by ${reviewerName} (${actorRole}).`;

      // Optional curriculum sync when approving a Curriculum Variance claim
      const syncedCourse = target.syncTranscriptOnApprove && target.registryRecord?.course
        ? target.registryRecord.course
        : undefined;
      const syncedBatch = target.syncTranscriptOnApprove && target.registryRecord?.batchYear
        ? target.registryRecord.batchYear
        : undefined;

      // 1. Update Conflict / Manual Verification Request status to Approved / Verified
      if (latestConflict) {
        const resolvedOk = resolveConflictRecord(
          latestConflict.id,
          'resolved_verified',
          reviewerName,
          approvalNote,
          latestConflict,
          reviewerMeta
        );
        if (!resolvedOk) {
          showToast('This verification request was already resolved.', 'info');
          setApproveConfirmTarget(null);
          return;
        }
      }

      // 2. Update Alumni account record: keep role as 'alumni', set Verified & Active, persist approval date & reviewer details
      if (latestUser) {
        if (syncedCourse || syncedBatch) {
          await updateAlumniProfile(latestUser.uid, {
            role: 'alumni',
            ...(syncedCourse ? { course: syncedCourse } : {}),
            ...(syncedBatch ? { batch: syncedBatch } : {})
          });
        }

        const studentIdToMark =
          target.registryRecord?.studentId ||
          (latestConflict && isStudentIdDisputeRecord(latestConflict)
            ? latestConflict.targetRegistryStudentId || latestConflict.applicantStudentId
            : undefined) ||
          latestUser.studentId ||
          target.studentId;

        const isDisputeDecision = Boolean(latestConflict && isStudentIdDisputeRecord(latestConflict));
        const decisionSubmissionSource = latestConflict
          ? isDisputeDecision
            ? 'dispute_student_id_claim'
            : 'request_verification'
          : undefined;
        const decisionRequestType = latestConflict
          ? isDisputeDecision
            ? 'claimed_id_dispute'
            : 'manual_verification_request'
          : undefined;

        setUserVerified(latestUser.uid, true, {
          ...reviewerMeta,
          silentToast: true,
          conflictId: latestConflict?.id,
          requestId: latestConflict?.verificationRequestId || latestUser.verificationRequestId,
          submissionSource: decisionSubmissionSource,
          requestType: decisionRequestType,
          studentId: studentIdToMark,
          course: syncedCourse || latestConflict?.applicantCourse || latestUser.course,
          batch: syncedBatch || latestConflict?.applicantBatch || latestUser.batch,
          notes: approvalNote
        });

        if (studentIdToMark) {
          markRegistryRecordAsRegistered(studentIdToMark, latestUser.uid);
        }

        autoResolveMatchingConflicts(
          latestUser.uid,
          studentIdToMark,
          'resolved_verified',
          approvalNote,
          reviewerMeta,
          latestConflict ? isDisputeDecision : undefined
        );
      } else if (latestConflict) {
        // Even if no local UserProfile matched, sync the decision to backend verification/credentials store
        const token = getStoredSessionToken();
        if (token) {
          const isDisputeDecision = isStudentIdDisputeRecord(latestConflict);
          await fetch('/api/admin/alumni-verification/decision', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              action: 'approve',
              userId: latestConflict.applicantUid,
              email: latestConflict.applicantEmail,
              studentId: latestConflict.targetRegistryStudentId || latestConflict.applicantStudentId,
              conflictId: latestConflict.id,
              requestId: latestConflict.verificationRequestId,
              submissionSource: isDisputeDecision ? 'dispute_student_id_claim' : 'request_verification',
              requestType: isDisputeDecision ? 'claimed_id_dispute' : 'manual_verification_request',
              notes: approvalNote
            })
          }).catch(() => {});
        }
      }

      addAuditLog({
        action: 'ALUMNI_VERIFICATION_APPROVED',
        actorId: reviewerUid,
        actorName: reviewerName,
        actorRole,
        category: 'alumni_verification',
        targetUserId: latestUser?.uid || latestConflict?.applicantUid,
        targetRecordId: latestConflict?.id,
        details: `Approved & verified Alumni ${target.applicantName} (${target.applicantEmail}, Student ID: ${target.studentId || 'N/A'}). Role maintained as Alumni. Reviewed by ${reviewerName} (${actorRole}).`,
        severity: 'success'
      });

      if (latestConflict?.id) {
        setSingleNotesById((prev) => {
          const copy = { ...prev };
          delete copy[latestConflict.id];
          return copy;
        });
      }

      loadConflicts();
      loadServerVerificationRequests();
      setTimeout(() => loadServerVerificationRequests(), 400);
      setApproveConfirmTarget(null);
      setSelfieViewerTarget(null);
      showToast('Alumni Successfully Verified.', 'success');
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  // Confirm Reject execution (requires rejection reason, duplicate-guarded, preserves Alumni role)
  const handleConfirmRejectRequest = async () => {
    if (!rejectConfirmTarget || isSubmittingDecision) return;

    const cleanReason = rejectReasonText.trim();
    if (!cleanReason) {
      setRejectReasonError('Please provide a clear rejection reason before confirming.');
      return;
    }

    const target = rejectConfirmTarget;
    const actorRole = normalizeSystemRole(currentUser?.role);
    if (!['moderator', 'admin', 'superadmin'].includes(actorRole)) {
      showToast('Permission denied: Moderator, Admin, or Superadmin clearance required.', 'error');
      return;
    }

    const latestConflict = target.conflict
      ? unifiedConflicts.find((c) => c.id === target.conflict!.id) || target.conflict
      : undefined;
    const latestUser = target.user
      ? users.find((u) => u.uid === target.user!.uid) || target.user
      : target.conflict
      ? findLinkedUserForConflict(target.conflict)
      : undefined;

    if (latestConflict && latestConflict.status !== 'pending') {
      showToast('This verification request has already been processed.', 'info');
      setRejectConfirmTarget(null);
      return;
    }
    if (!latestConflict && latestUser && (latestUser.verificationStatus === 'rejected' || latestUser.accountStatus === 'REJECTED')) {
      showToast('This alumni verification request has already been rejected.', 'info');
      setRejectConfirmTarget(null);
      return;
    }

    setIsSubmittingDecision(true);
    try {
      const nowIso = new Date().toISOString();
      const reviewerUid = currentUser?.uid || 'authorized_reviewer';
      const reviewerName = currentUser?.name || 'Authorized Reviewer';
      const reviewerMeta = {
        reviewedByUid: reviewerUid,
        reviewedByName: reviewerName,
        reviewedByRole: actorRole,
        reviewedAt: nowIso,
        rejectionReason: cleanReason
      };

      // 1. Update Conflict / Manual Verification Request status to Rejected with reason & reviewer metadata
      if (latestConflict) {
        const resolvedOk = resolveConflictRecord(
          latestConflict.id,
          'resolved_rejected',
          reviewerName,
          cleanReason,
          latestConflict,
          reviewerMeta
        );
        if (!resolvedOk) {
          showToast('This verification request was already resolved.', 'info');
          setRejectConfirmTarget(null);
          return;
        }
      }

      // 2. Update Alumni account record: keep role as 'alumni', set Rejected, save reason + date + reviewer details
      if (latestUser) {
        const isDisputeDecision = Boolean(latestConflict && isStudentIdDisputeRecord(latestConflict));
        setUserVerified(latestUser.uid, false, {
          ...reviewerMeta,
          silentToast: true,
          conflictId: latestConflict?.id,
          requestId: latestConflict?.verificationRequestId || latestUser.verificationRequestId,
          submissionSource: latestConflict
            ? isDisputeDecision
              ? 'dispute_student_id_claim'
              : 'request_verification'
            : undefined,
          requestType: latestConflict
            ? isDisputeDecision
              ? 'claimed_id_dispute'
              : 'manual_verification_request'
            : undefined,
          studentId: latestUser.studentId || target.studentId
        });

        autoResolveMatchingConflicts(
          latestUser.uid,
          latestUser.studentId || target.studentId,
          'resolved_rejected',
          cleanReason,
          reviewerMeta,
          latestConflict ? isDisputeDecision : undefined
        );
      } else if (latestConflict) {
        const token = getStoredSessionToken();
        if (token) {
          const isDisputeDecision = isStudentIdDisputeRecord(latestConflict);
          await fetch('/api/admin/alumni-verification/decision', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              action: 'reject',
              userId: latestConflict.applicantUid,
              email: latestConflict.applicantEmail,
              studentId: latestConflict.targetRegistryStudentId || latestConflict.applicantStudentId,
              conflictId: latestConflict.id,
              requestId: latestConflict.verificationRequestId,
              submissionSource: isDisputeDecision ? 'dispute_student_id_claim' : 'request_verification',
              requestType: isDisputeDecision ? 'claimed_id_dispute' : 'manual_verification_request',
              rejectionReason: cleanReason
            })
          }).catch(() => {});
        }
      }

      addAuditLog({
        action: 'ALUMNI_VERIFICATION_REJECTED',
        actorId: reviewerUid,
        actorName: reviewerName,
        actorRole,
        category: 'alumni_verification',
        targetUserId: latestUser?.uid || latestConflict?.applicantUid,
        targetRecordId: latestConflict?.id,
        details: `Rejected verification request for Alumni ${target.applicantName} (${target.applicantEmail}). Role maintained as Alumni. Reason: ${cleanReason}`,
        severity: 'warning'
      });

      if (latestConflict?.id) {
        setSingleNotesById((prev) => {
          const copy = { ...prev };
          delete copy[latestConflict.id];
          return copy;
        });
      }

      loadConflicts();
      loadServerVerificationRequests();
      setTimeout(() => loadServerVerificationRequests(), 400);
      setRejectConfirmTarget(null);
      setRejectReasonText('');
      setRejectReasonError(null);
      setSelfieViewerTarget(null);
      showToast(`Alumni verification request rejected for ${target.applicantName}.`, 'info');
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  // 1-Click Smart Auto-Reconcile for all 100% matched alumni
  const handleSmartAutoReconcile = async () => {
    if (perfectMatchAnalyses.length === 0) {
      showToast('No 100% Registrar-matched records found for auto-reconciliation.', 'info');
      return;
    }

    setIsReconciling(true);
    const count = perfectMatchAnalyses.length;
    const nowIso = new Date().toISOString();
    const reviewerMeta = {
      reviewedByUid: currentUser?.uid || 'authorized_reviewer',
      reviewedByName: currentUser?.name || 'Authorized Reviewer',
      reviewedByRole: normalizeSystemRole(currentUser?.role),
      reviewedAt: nowIso
    };

    try {
      for (const item of perfectMatchAnalyses) {
        setUserVerified(item.userId, true, { ...reviewerMeta, silentToast: true });
        if (item.registryRecord) {
          markRegistryRecordAsRegistered(item.registryRecord.studentId, item.userId);
        }
        autoResolveMatchingConflicts(
          item.userId,
          item.registryRecord?.studentId || item.user.studentId,
          'resolved_verified',
          `Auto-reconciled 100% Registrar match by ${reviewerMeta.reviewedByName}.`,
          reviewerMeta
        );
      }

      addAuditLog({
        action: 'SMART_GOVERNANCE_AUTO_RECONCILE',
        actorId: reviewerMeta.reviewedByUid,
        actorName: reviewerMeta.reviewedByName,
        actorRole: reviewerMeta.reviewedByRole,
        category: 'alumni_verification',
        details: `Smart Governance Auto-Reconciliation executed: Verified ${count} alumni claimants with 100% Registrar archive alignment.`,
        severity: 'success'
      });

      showToast('Alumni Successfully Verified.', 'success');
      loadConflicts();
      loadServerVerificationRequests();
    } finally {
      setIsReconciling(false);
    }
  };

  // Handle conflict dismiss (Approve & Verify and Reject route through confirmation dialogs)
  const handleResolveConflict = (
    conflict: RegistrationConflictRecord,
    action: 'resolved_verified' | 'resolved_rejected' | 'dismissed'
  ) => {
    if (action === 'resolved_verified') {
      openApproveConfirmation(buildInspectionTargetFromConflict(conflict));
      return;
    }
    if (action === 'resolved_rejected') {
      openRejectConfirmation(buildInspectionTargetFromConflict(conflict));
      return;
    }

    const actorName = currentUser?.name || 'Authorized Reviewer';
    const actorRole = normalizeSystemRole(currentUser?.role);
    const note = (singleNotesById[conflict.id] || '').trim() || undefined;

    const success = resolveConflictRecord(conflict.id, action, actorName, note, conflict, {
      reviewedByUid: currentUser?.uid,
      reviewedByName: actorName,
      reviewedByRole: actorRole,
      reviewedAt: new Date().toISOString()
    });

    if (success) {
      addAuditLog({
        action: 'CONFLICT_RESOLUTION_DISMISSED',
        actorId: currentUser?.uid || 'moderator',
        actorName,
        actorRole,
        category: 'conflict_resolution',
        details: `Dismissed registration dispute for ${conflict.applicantName} (Student ID: ${conflict.applicantStudentId || 'N/A'}). Note: ${note || 'Routine hearing deliberation'}.`,
        severity: 'warning'
      });

      showToast('Dispute flag dismissed.', 'info');
      loadConflicts();
      setSingleNotesById((prev) => {
        const copy = { ...prev };
        delete copy[conflict.id];
        return copy;
      });
    }
  };

  // Dedicated Duplicate Conflict Solution 1: Merge Accounts
  const handleMergeConflict = async (conflict: RegistrationConflictRecord) => {
    const actorName = currentUser?.name || 'Registrar Officer';
    const normId = conflict.applicantStudentId ? normalizeStudentId(conflict.applicantStudentId).toUpperCase() : '';
    const existingPrimary = users.find(
      (u) => u.studentId && normalizeStudentId(u.studentId).toUpperCase() === normId
    );

    if (!existingPrimary) {
      showToast('Could not locate primary verified account to merge into.', 'error');
      return;
    }

    const note = (singleNotesById[conflict.id] || '').trim() || `Merged duplicate applicant (${conflict.applicantEmail}) into primary verified account (${existingPrimary.email}).`;

    // 1. Update primary profile with note of alternate contact info
    const mergedUpdates: Partial<UserProfile> = {};
    if (conflict.applicantEmail && conflict.applicantEmail.toLowerCase() !== existingPrimary.email.toLowerCase()) {
      mergedUpdates.bio = `${existingPrimary.bio || ''}\n[Merged Record: Alt email ${conflict.applicantEmail}]`.trim();
    }
    if (Object.keys(mergedUpdates).length > 0) {
      await updateAlumniProfile(existingPrimary.uid, mergedUpdates);
    }

    // 2. Mark conflict resolved as rejected/merged
    resolveConflictRecord(conflict.id, 'resolved_rejected', actorName, note, conflict);

    addAuditLog({
      action: 'CONFLICT_RESOLUTION_MERGED',
      actorId: currentUser?.uid || 'moderator',
      actorName,
      actorRole: currentUser?.role || 'moderator',
      category: 'conflict_resolution',
      details: `Merged duplicate registration for ${conflict.applicantName} into verified member ${existingPrimary.name} (${existingPrimary.studentId}). Note: ${note}`,
      severity: 'success'
    });

    showToast(`✓ Accounts merged. ${existingPrimary.name} remains the verified primary account.`);
    loadConflicts();
    setSingleNotesById((prev) => {
      const copy = { ...prev };
      delete copy[conflict.id];
      return copy;
    });
  };

  // Dedicated Duplicate Conflict Solution 2: Reassign Student ID & Approve
  const [reassignModalConflict, setReassignModalConflict] = useState<RegistrationConflictRecord | null>(null);
  const [newReassignedId, setNewReassignedId] = useState<string>('');

  const executeReassignAndApprove = async () => {
    if (!reassignModalConflict || !newReassignedId.trim()) return;
    const actorName = currentUser?.name || 'Authorized Reviewer';
    const actorRole = normalizeSystemRole(currentUser?.role);
    const nowIso = new Date().toISOString();
    const reviewerMeta = {
      reviewedByUid: currentUser?.uid || 'authorized_reviewer',
      reviewedByName: actorName,
      reviewedByRole: actorRole,
      reviewedAt: nowIso
    };
    const cleanId = newReassignedId.trim().toUpperCase();
    const note = (singleNotesById[reassignModalConflict.id] || '').trim() || `Student ID corrected to ${cleanId} to resolve clerical collision with existing record.`;

    const resolvedOk = resolveConflictRecord(
      reassignModalConflict.id,
      'resolved_verified',
      actorName,
      note,
      reassignModalConflict,
      reviewerMeta
    );
    if (!resolvedOk) {
      showToast('This verification request has already been processed.', 'info');
      setReassignModalConflict(null);
      return;
    }

    const targetUser = users.find(
      (u) =>
        (reassignModalConflict.applicantUid && u.uid === reassignModalConflict.applicantUid) ||
        u.email.toLowerCase() === reassignModalConflict.applicantEmail.toLowerCase()
    );

    if (targetUser) {
      await updateAlumniProfile(targetUser.uid, {
        role: 'alumni',
        studentId: cleanId
      });
      setUserVerified(targetUser.uid, true, {
        ...reviewerMeta,
        silentToast: true,
        conflictId: reassignModalConflict.id,
        studentId: cleanId,
        notes: note
      });
    }

    addAuditLog({
      action: 'CONFLICT_RESOLUTION_REASSIGNED',
      actorId: reviewerMeta.reviewedByUid,
      actorName,
      actorRole,
      category: 'conflict_resolution',
      details: `Reassigned Student ID for ${reassignModalConflict.applicantName} to ${cleanId} and approved verification.`,
      severity: 'success'
    });

    showToast('Alumni Successfully Verified.', 'success');
    setReassignModalConflict(null);
    setNewReassignedId('');
    loadConflicts();
    loadServerVerificationRequests();
  };

  // Multi-select for conflicts
  const isAllPendingSelected =
    pendingConflicts.length > 0 &&
    pendingConflicts.every((c) => selectedConflictIds.includes(c.id));

  const handleToggleSelectConflict = (id: string) => {
    setSelectedConflictIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAllPending = () => {
    if (isAllPendingSelected) {
      setSelectedConflictIds([]);
    } else {
      setSelectedConflictIds(pendingConflicts.map((c) => c.id));
    }
  };

  // Bulk resolve conflicts
  const handleBulkResolveConflicts = (action: 'resolved_verified' | 'resolved_rejected') => {
    if (selectedConflictIds.length === 0) return;
    if (action === 'resolved_rejected' && !bulkNote.trim()) {
      showToast('Please enter a rejection reason before rejecting selected requests.', 'error');
      return;
    }
    setIsProcessingBulk(true);

    const actorName = currentUser?.name || 'Authorized Reviewer';
    const actorRole = normalizeSystemRole(currentUser?.role);
    const nowIso = new Date().toISOString();
    const cleanBulkReason = bulkNote.trim();
    const reviewerMeta = {
      reviewedByUid: currentUser?.uid || 'authorized_reviewer',
      reviewedByName: actorName,
      reviewedByRole: actorRole,
      reviewedAt: nowIso,
      rejectionReason: action === 'resolved_rejected' ? cleanBulkReason : undefined
    };
    let processed = 0;

    selectedConflictIds.forEach((id) => {
      const conflict = collisionAndAppealConflicts.find((c) => c.id === id);
      if (!conflict || conflict.status !== 'pending') return;

      const note = cleanBulkReason || `Bulk resolution (${action}) by ${actorName}`;
      const success = resolveConflictRecord(id, action, actorName, note, conflict, reviewerMeta);

      if (success) {
        processed++;
        const matched = conflict.applicantUid
          ? users.find((u) => u.uid === conflict.applicantUid)
          : users.find((u) => u.email.toLowerCase() === conflict.applicantEmail.toLowerCase());
        if (matched) {
          setUserVerified(matched.uid, action === 'resolved_verified', {
            ...reviewerMeta,
            silentToast: true,
            conflictId: conflict.id,
            notes: note
          });
        }
      }
    });

    addAuditLog({
      action: `BULK_CONFLICT_RESOLUTION_${action.toUpperCase()}`,
      actorId: reviewerMeta.reviewedByUid,
      actorName,
      actorRole,
      category: 'conflict_resolution',
      details: `Bulk ${action === 'resolved_verified' ? 'approved & verified' : 'rejected'} ${processed} student registration conflict records.`,
      severity: action === 'resolved_verified' ? 'success' : 'warning'
    });

    showToast(
      action === 'resolved_verified'
        ? 'Alumni Successfully Verified.'
        : `Rejected ${processed} alumni verification request${processed === 1 ? '' : 's'}.`,
      action === 'resolved_verified' ? 'success' : 'info'
    );

    setSelectedConflictIds([]);
    setBulkNote('');
    setIsProcessingBulk(false);
    loadConflicts();
    loadServerVerificationRequests();
  };

  // Official PDF audit download
  const handleGeneratePdfReport = () => {
    try {
      generateConflictResolutionPdfReport(conflicts, {
        officerName: currentUser?.name || 'Moderator Officer',
        officerRole: currentUser?.role === 'admin' ? 'System Administrator' : 'Moderator / Registry Administrator',
        institutionName: "St. Cecilia's College - Cebu, Inc."
      });

      addAuditLog({
        action: 'CONFLICT_REPORT_PDF_GENERATED',
        actorId: currentUser?.uid || 'moderator',
        actorName: currentUser?.name || 'Moderator Officer',
        actorRole: currentUser?.role || 'moderator',
        category: 'conflict_resolution',
        details: `Generated session Conflict Resolution & Manual Overrides PDF audit report for ${conflicts.length} incidents.`,
        severity: 'info'
      });

      showToast('Downloaded official PDF audit report of session resolutions', 'success');
    } catch (err: any) {
      showToast(`Failed to generate PDF: ${err?.message || 'Unknown error'}`, 'error');
    }
  };

  // Export full CSV of requests & conflicts
  const handleExportCsv = () => {
    try {
      const headers = [
        'Record Type',
        'Applicant Name',
        'Email Address',
        'Claimed Student ID',
        'Course / Degree',
        'Cohort Year',
        'Status / Integrity',
        'Conflict Severity',
        'Flagged / Submitted Date'
      ];

      const rows: string[][] = [];

      pendingAnalyses.forEach((a) => {
        rows.push([
          'Alumni Verification Request',
          `"${a.user.name}"`,
          a.user.email,
          a.user.studentId || 'N/A',
          `"${a.user.course || 'Not specified'}"`,
          a.user.batch || 'N/A',
          a.status,
          a.status === 'PERFECT_MATCH' ? 'NONE' : 'MEDIUM',
          a.user.createdAt || new Date().toISOString()
        ]);
      });

      conflicts.forEach((c) => {
        rows.push([
          'ID Collision Dispute',
          `"${c.applicantName}"`,
          c.applicantEmail,
          c.applicantStudentId || 'N/A',
          `"${c.applicantCourse || 'Not specified'}"`,
          c.applicantBatch || 'N/A',
          c.status,
          c.severity || 'HIGH',
          c.flaggedAt
        ]);
      });

      const csvContent = [
        headers.join(','),
        ...rows.map((row) => row.join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      const dateStr = new Date().toISOString().split('T')[0];
      link.setAttribute('download', `st_cecilias_requests_conflicts_triage_${dateStr}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast('Exported Requests & Conflicts triage ledger to CSV', 'success');
    } catch {
      showToast('Failed to export CSV report', 'error');
    }
  };



  // Strict RBAC Gate (Administrators, Super Administrators, and Moderators)
  const isAuthorizedTriage =
    currentUser?.role === 'admin' ||
    currentUser?.role === 'superadmin' ||
    currentUser?.role === 'moderator';

  if (!isAuthorizedTriage) {
    return (
      <div className="bg-white rounded-3xl border border-stone-200/90 p-10 text-center max-w-xl mx-auto shadow-2xs space-y-4 my-8">
        <div className="w-14 h-14 rounded-2xl bg-stone-100 text-stone-700 flex items-center justify-center mx-auto border border-stone-200">
          <ShieldAlert className="w-7 h-7 text-[#8B181B]" />
        </div>
        <h3 className="text-lg font-bold text-stone-900 font-sans">Administrative Clearance Required</h3>
        <p className="text-xs text-stone-600 leading-relaxed">
          The Requests & Conflict Resolution Tribunal is restricted to authorized St. Cecilia's College Administrators and Moderators.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 antialiased">
      {/* ========================================================
          1. TOP COMMAND CENTER-STYLE HEADER:
             Large title + Circular Metric Telemetry Pills + Round Pill Switcher + Export Circle
          ======================================================== */}
      <div className="pb-2 border-b border-stone-200/80">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight font-sans">
          Requests & Conflicts
        </h1>
        <p className="text-xs text-stone-500 font-medium mt-0.5">
          St. Cecilia's College • Governance, Identity & Dispute Tribunal
        </p>
      </div>

      {/* ========================================================
          2. MAIN TRIBUNAL WORKSPACE
          ======================================================== */}
      <div className="w-full space-y-4">
        {/* Category Switcher Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-stone-100/90 rounded-2xl border border-stone-200/80 w-fit flex-wrap">
          <button
            type="button"
            onClick={() => setActiveTab('alumni')}
            className={`px-3.5 py-1.5 min-h-[40px] sm:min-h-[34px] rounded-xl text-xs transition-all cursor-pointer flex items-center gap-2 border ${
              activeTab === 'alumni'
                ? 'bg-white text-[#8B181B] border-rose-200/80 shadow-2xs font-bold'
                : 'text-stone-600 border-transparent hover:text-stone-900 hover:bg-white/60 font-semibold'
            }`}
          >
            <span>Alumni Claims</span>
            <span className={`text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded-full font-bold ${
              activeTab === 'alumni' ? 'bg-rose-50 text-[#8B181B] border border-rose-200/70' : 'bg-stone-200/80 text-stone-600'
            }`}>
              {totalAlumniClaimsPendingCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('conflicts')}
            className={`px-3.5 py-1.5 min-h-[40px] sm:min-h-[34px] rounded-xl text-xs transition-all cursor-pointer flex items-center gap-2 border ${
              activeTab === 'conflicts'
                ? 'bg-white text-[#8B181B] border-rose-200/80 shadow-2xs font-bold'
                : 'text-stone-600 border-transparent hover:text-stone-900 hover:bg-white/60 font-semibold'
            }`}
          >
            <span>Collisions & Appeals</span>
            <span className={`text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded-full font-bold ${
              activeTab === 'conflicts'
                ? 'bg-rose-50 text-[#8B181B] border border-rose-200/70'
                : pendingConflicts.length > 0
                ? 'bg-rose-100 text-rose-800'
                : 'bg-stone-200/80 text-stone-600'
            }`}>
              {pendingConflicts.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('employers')}
            className={`px-3.5 py-1.5 min-h-[40px] sm:min-h-[34px] rounded-xl text-xs transition-all cursor-pointer flex items-center gap-2 border ${
              activeTab === 'employers'
                ? 'bg-white text-[#8B181B] border-rose-200/80 shadow-2xs font-bold'
                : 'text-stone-600 border-transparent hover:text-stone-900 hover:bg-white/60 font-semibold'
            }`}
          >
            <span>Employer Requests</span>
            <span className={`text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded-full font-bold ${
              activeTab === 'employers' ? 'bg-rose-50 text-[#8B181B] border border-rose-200/70' : 'bg-stone-200/80 text-stone-600'
            }`}>
              {pendingEmployers.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('jobs')}
            className={`px-3.5 py-1.5 min-h-[40px] sm:min-h-[34px] rounded-xl text-xs transition-all cursor-pointer flex items-center gap-2 border ${
              activeTab === 'jobs'
                ? 'bg-white text-[#8B181B] border-rose-200/80 shadow-2xs font-bold'
                : 'text-stone-600 border-transparent hover:text-stone-900 hover:bg-white/60 font-semibold'
            }`}
          >
            <span>Job Approvals</span>
            <span className={`text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded-full font-bold ${
              activeTab === 'jobs' ? 'bg-rose-50 text-[#8B181B] border border-rose-200/70' : 'bg-stone-200/80 text-stone-600'
            }`}>
              {pendingJobs.length}
            </span>
          </button>
        </div>

        {/* ----------------------------------------------------
            THE TRIBUNAL STREAM & FORENSIC CARDS
            ---------------------------------------------------- */}
        <div className="bg-white rounded-[32px] p-6 sm:p-7 border border-stone-200/90 shadow-2xs space-y-4">
            
            {/* Search & Action Filter Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by student ID, claimant legal name, email, or degree program..."
                  className="w-full pl-9 pr-9 py-2.5 text-xs bg-stone-50 border border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#8B181B]/20 transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 p-0.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {activeTab === 'alumni' && (
                <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                  <select
                    value={claimsStatusFilter}
                    onChange={(e) => setClaimsStatusFilter(e.target.value as any)}
                    className="bg-stone-50 border border-stone-200 text-xs text-stone-800 py-2 px-3 rounded-xl focus:outline-hidden font-semibold cursor-pointer"
                  >
                    <option value="pending">Pending Disputes ({pendingDisputeClaims.length})</option>
                    <option value="all">All Alumni Claims ({alumniDisputeClaims.length})</option>
                    <option value="resolved_verified">Approved & Verified</option>
                    <option value="resolved_rejected">Rejected Claims</option>
                  </select>
                </div>
              )}

              {activeTab === 'conflicts' && (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="bg-stone-50 border border-stone-200 text-xs text-stone-800 py-2 px-3 rounded-xl focus:outline-hidden font-semibold cursor-pointer"
                  >
                    <option value="pending">Pending Cases ({pendingConflicts.length})</option>
                    <option value="all">All Appeals & Collisions ({collisionAndAppealConflicts.length})</option>
                    <option value="resolved_verified">Approved Claims</option>
                    <option value="resolved_rejected">Rejected Duplicates</option>
                  </select>
                </div>
              )}
            </div>

            {/* Bulk Actions for Conflicts */}
            {activeTab === 'conflicts' && pendingConflicts.length > 0 && (
              <div className="bg-stone-50 border border-stone-200 rounded-2xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleToggleSelectAllPending}
                    className="flex items-center gap-2 text-xs font-bold text-stone-700 hover:text-stone-900 transition-colors cursor-pointer"
                  >
                    {isAllPendingSelected ? (
                      <CheckSquare className="w-4 h-4 text-[#8B181B]" />
                    ) : (
                      <Square className="w-4 h-4 text-stone-400" />
                    )}
                    <span>
                      {isAllPendingSelected
                        ? 'Deselect All'
                        : `Select All Pending (${pendingConflicts.length})`}
                    </span>
                  </button>

                  {selectedConflictIds.length > 0 && (
                    <span className="text-xs bg-red-100 text-red-900 font-bold px-2 py-0.5 rounded-md">
                      {selectedConflictIds.length} selected
                    </span>
                  )}
                </div>

                {selectedConflictIds.length > 0 && (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1 md:justify-end">
                    <input
                      type="text"
                      value={bulkNote}
                      onChange={(e) => setBulkNote(e.target.value)}
                      placeholder="Registrar justification note..."
                      className="text-xs px-3 py-1.5 bg-white border border-stone-200 rounded-lg w-full sm:w-64"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isProcessingBulk}
                        onClick={() => handleBulkResolveConflicts('resolved_verified')}
                        className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Approve Selected</span>
                      </button>
                      <button
                        type="button"
                        disabled={isProcessingBulk}
                        onClick={() => handleBulkResolveConflicts('resolved_rejected')}
                        className="ds-btn-secondary px-3.5 py-1.5 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <UserX className="w-3.5 h-3.5" />
                        <span>Reject Selected</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 1: ALUMNI CLAIMS — Exclusively Dispute Student ID Claim submissions */}
            {activeTab === 'alumni' && (
              <div className="space-y-3.5">
                {filteredDisputeClaims.length === 0 ? (
                  <div className="bg-stone-50/70 rounded-2xl border border-stone-200/80 p-12 text-center">
                    <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
                    <h3 className="text-sm font-bold text-stone-900">Alumni Claims Docket Clear</h3>
                    <p className="text-xs text-stone-500 max-w-sm mx-auto mt-1">
                      No Dispute Student ID Claim submissions match the active filter criteria.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Dispute Student ID Claim Submissions (Exclusively in Alumni Claims) */}
                    {filteredDisputeClaims.map((claim) => {
                      const contestedStudentId = claim.targetRegistryStudentId || claim.applicantStudentId || 'N/A';
                      const disputeExplanation = extractDisputeExplanation(claim);
                      const originalOwner = findOriginalOwnerForDispute(claim);
                      const claimantUser = findLinkedUserForConflict(claim);
                      const claimantPhone = claim.applicantPhone || claimantUser?.phone;
                      const hasSelfieRef = hasUploadedSelfieForTarget({ conflict: claim });
                      const selfieRefLabel =
                        claim.selfieWithIdName ||
                        claim.selfieStoragePath ||
                        (hasSelfieRef ? 'Uploaded Selfie with ID' : 'No Selfie with ID attached');

                      return (
                        <div
                          key={claim.id}
                          className={`rounded-2xl border transition-all overflow-hidden ${
                            claim.status === 'pending'
                              ? 'bg-white border-amber-300 ring-1 ring-amber-300/40'
                              : 'bg-stone-50/60 border-stone-200'
                          }`}
                        >
                          {/* Header Row */}
                          <div className="p-4 sm:p-4.5 bg-stone-50/70 border-b border-stone-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center shrink-0">
                                <Scale className="w-4 h-4" />
                              </div>

                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-sm text-stone-900">
                                    {claim.applicantName}
                                  </span>
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-[#8B181B] border border-red-200/80">
                                    Student ID Dispute Claim
                                  </span>
                                  {claim.status === 'pending' ? (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      Pending Review
                                    </span>
                                  ) : claim.status === 'resolved_verified' ? (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3" />
                                      Approved & Verified
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 border border-stone-200">
                                      {claim.status === 'dismissed' ? 'Dismissed' : 'Rejected Claim'}
                                    </span>
                                  )}
                                </div>

                                <div className="text-[11px] text-stone-500 mt-0.5 flex items-center gap-2 flex-wrap">
                                  <span className="flex items-center gap-1">
                                    <Mail className="w-3 h-3 text-stone-400" />
                                    <span className="font-mono">{claim.applicantEmail}</span>
                                  </span>
                                  <span className="text-stone-300">·</span>
                                  <span className="font-mono font-bold text-stone-700">
                                    {contestedStudentId}
                                  </span>
                                  <span className="text-stone-300">·</span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-stone-400" />
                                    <span>Submitted {new Date(claim.flaggedAt).toLocaleString()}</span>
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                              {contestedStudentId !== 'N/A' && (
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(contestedStudentId, 'Contested Student ID')}
                                  className="p-1.5 rounded-lg text-stone-500 hover:text-stone-800 hover:bg-stone-200/70 transition-colors cursor-pointer"
                                  title="Copy Contested Student ID"
                                >
                                  {copiedText === contestedStudentId ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => openSelfieViewer(buildInspectionTargetFromConflict(claim))}
                                className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                              >
                                <Camera className="w-3.5 h-3.5" strokeWidth={1.75} />
                                <span>View Selfie with ID</span>
                              </button>
                            </div>
                          </div>

                          {/* Dispute Details Body: Claimant vs Original Account Owner & Registrar Masterlist */}
                          <div className="p-4 sm:p-5 space-y-3.5">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
                              {/* Column 1: Claimant (Person Claiming the Student ID) */}
                              <div className="bg-stone-50 p-3.5 rounded-xl border border-stone-200/80 space-y-1.5">
                                <span className="text-[10px] font-bold text-[#8B181B] uppercase tracking-wider block pb-1 border-b border-stone-200">
                                  Claimant (Disputing ID Ownership)
                                </span>
                                <div className="space-y-1.5 text-xs">
                                  <div className="flex justify-between gap-2">
                                    <span className="text-stone-500">Claimant Name:</span>
                                    <span className="font-bold text-stone-900 text-right">{claim.applicantName}</span>
                                  </div>
                                  <div className="flex justify-between gap-2">
                                    <span className="text-stone-500">Contact Email:</span>
                                    <span className="font-mono text-stone-800 text-right break-all">{claim.applicantEmail}</span>
                                  </div>
                                  {claimantPhone && (
                                    <div className="flex justify-between gap-2">
                                      <span className="text-stone-500">Contact Phone:</span>
                                      <span className="font-mono text-stone-800 text-right">{claimantPhone}</span>
                                    </div>
                                  )}
                                  <div className="flex justify-between gap-2">
                                    <span className="text-stone-500">Contested Student ID:</span>
                                    <span className="font-mono font-bold text-[#8B181B]">{contestedStudentId}</span>
                                  </div>
                                  <div className="flex justify-between gap-2">
                                    <span className="text-stone-500">Degree Program:</span>
                                    <span className="font-semibold text-stone-800 text-right">{claim.applicantCourse || 'Not specified'}</span>
                                  </div>
                                  <div className="flex justify-between gap-2">
                                    <span className="text-stone-500">Graduation Year:</span>
                                    <span className="font-semibold text-stone-800">Class of {claim.applicantBatch || 'N/A'}</span>
                                  </div>
                                  <div className="flex justify-between gap-2 items-center pt-1 border-t border-stone-200/70">
                                    <span className="text-stone-500">Selfie with ID:</span>
                                    <span
                                      className={`font-mono text-[11px] font-semibold truncate max-w-[170px] ${
                                        hasSelfieRef ? 'text-emerald-700' : 'text-amber-700'
                                      }`}
                                      title={selfieRefLabel}
                                    >
                                      {selfieRefLabel}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Column 2: Original Account Owner (Currently Registered Holder) */}
                              <div className="bg-stone-50 p-3.5 rounded-xl border border-stone-200/80 space-y-1.5">
                                <div className="flex items-center justify-between gap-2 pb-1 border-b border-stone-200">
                                  <span className="text-[10px] font-bold text-stone-700 uppercase tracking-wider">
                                    Original Account Owner
                                  </span>
                                  {originalOwner?.user && (
                                    <button
                                      type="button"
                                      onClick={() => setSelectedUserIdForModal(originalOwner.user!.uid)}
                                      className="text-[10px] font-semibold text-[#8B181B] hover:underline flex items-center gap-1 cursor-pointer"
                                    >
                                      <Eye className="w-3 h-3" />
                                      <span>View Profile</span>
                                    </button>
                                  )}
                                </div>
                                {originalOwner ? (
                                  <div className="space-y-1.5 text-xs">
                                    <div className="flex justify-between gap-2">
                                      <span className="text-stone-500">Account Holder:</span>
                                      <span className="font-bold text-stone-900 text-right">{originalOwner.name || 'Registered Account'}</span>
                                    </div>
                                    <div className="flex justify-between gap-2">
                                      <span className="text-stone-500">Account Email:</span>
                                      <span className="font-mono text-stone-800 text-right break-all">{originalOwner.email || 'Not available'}</span>
                                    </div>
                                    <div className="flex justify-between gap-2">
                                      <span className="text-stone-500">Registered ID:</span>
                                      <span className="font-mono font-bold text-stone-900">{originalOwner.studentId || contestedStudentId}</span>
                                    </div>
                                    {originalOwner.course && (
                                      <div className="flex justify-between gap-2">
                                        <span className="text-stone-500">Degree Program:</span>
                                        <span className="font-semibold text-stone-800 text-right">{originalOwner.course}</span>
                                      </div>
                                    )}
                                    {originalOwner.batch && (
                                      <div className="flex justify-between gap-2">
                                        <span className="text-stone-500">Graduation Year:</span>
                                        <span className="font-semibold text-stone-800">Class of {originalOwner.batch}</span>
                                      </div>
                                    )}
                                    {typeof originalOwner.isVerified === 'boolean' && (
                                      <div className="flex justify-between gap-2 pt-1 border-t border-stone-200/70">
                                        <span className="text-stone-500">Account Status:</span>
                                        <span className={`font-bold text-[11px] ${originalOwner.isVerified ? 'text-emerald-700' : 'text-amber-700'}`}>
                                          {originalOwner.isVerified ? 'Verified Owner' : 'Unverified Holder'}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="text-stone-500 text-xs py-4 text-center">
                                    Student ID {contestedStudentId} is marked registered in the archive; no active local profile matched.
                                  </div>
                                )}
                              </div>

                              {/* Column 3: Official Registrar Masterlist */}
                              <div className="bg-stone-50 p-3.5 rounded-xl border border-stone-200/80 space-y-1.5">
                                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block pb-1 border-b border-stone-200">
                                  Official Registrar Masterlist
                                </span>
                                {claim.registryRecord ? (
                                  <div className="space-y-1.5 text-xs">
                                    <div className="flex justify-between gap-2">
                                      <span className="text-stone-500">Archive ID:</span>
                                      <span className="font-mono font-bold text-emerald-800">{claim.registryRecord.studentId}</span>
                                    </div>
                                    <div className="flex justify-between gap-2">
                                      <span className="text-stone-500">Archive Name:</span>
                                      <span className="font-bold text-stone-900 text-right">{claim.registryRecord.fullName}</span>
                                    </div>
                                    <div className="flex justify-between gap-2">
                                      <span className="text-stone-500">Accredited Degree:</span>
                                      <span className="font-semibold text-stone-800 text-right">{claim.registryRecord.course}</span>
                                    </div>
                                    <div className="flex justify-between gap-2">
                                      <span className="text-stone-500">Class of:</span>
                                      <span className="font-semibold text-stone-800">{claim.registryRecord.batchYear}</span>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-stone-500 text-xs py-4 text-center">
                                    No electronic archive record found for Student ID {contestedStudentId}. Inspect Selfie with ID and registrar archives.
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Dispute Explanation */}
                            <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs text-stone-800 leading-relaxed">
                              <span className="font-bold text-stone-900 block text-[11px] uppercase tracking-wider mb-1">
                                Dispute Explanation & Supporting Statement
                              </span>
                              <p className="text-stone-700 whitespace-pre-wrap">{disputeExplanation}</p>
                            </div>

                            {claim.status !== 'pending' && (claim.reviewedByName || claim.resolvedBy || claim.rejectionReason || claim.resolutionNote) && (
                              <div className={`p-3 rounded-xl border text-xs space-y-1 ${
                                claim.status === 'resolved_verified'
                                  ? 'bg-emerald-50/60 border-emerald-200/80 text-emerald-950'
                                  : 'bg-stone-100/80 border-stone-200 text-stone-800'
                              }`}>
                                <div className="flex items-center justify-between gap-2 flex-wrap text-[11px]">
                                  <span className="font-bold">
                                    Reviewed by {claim.reviewedByName || claim.resolvedBy || 'Authorized Reviewer'}
                                    {claim.reviewedByRole ? ` (${claim.reviewedByRole.toUpperCase()})` : ''}
                                  </span>
                                  {(claim.reviewedAt || claim.resolvedAt) && (
                                    <span className="text-stone-500 font-mono">
                                      {new Date(claim.reviewedAt || claim.resolvedAt!).toLocaleString()}
                                    </span>
                                  )}
                                </div>
                                {claim.status === 'resolved_rejected' && (claim.rejectionReason || claim.resolutionNote) && (
                                  <p className="text-stone-700">
                                    <span className="font-semibold text-stone-900">Rejection Reason: </span>
                                    {claim.rejectionReason || claim.resolutionNote}
                                  </p>
                                )}
                                {claim.status === 'resolved_verified' && claim.resolutionNote && (
                                  <p className="text-emerald-900/90">{claim.resolutionNote}</p>
                                )}
                              </div>
                            )}

                            {claim.status === 'pending' && (
                              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-stone-100">
                                <div className="flex-1">
                                  <input
                                    type="text"
                                    value={singleNotesById[claim.id] || ''}
                                    onChange={(e) =>
                                      setSingleNotesById((prev) => ({
                                        ...prev,
                                        [claim.id]: e.target.value
                                      }))
                                    }
                                    placeholder="Optional verification or dispute resolution note..."
                                    className="w-full px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#8B181B]/20"
                                  />
                                </div>

                                <div className="flex flex-wrap items-center gap-2 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleResolveConflict(claim, 'resolved_rejected')}
                                    className="ds-btn-secondary px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer"
                                  >
                                    Reject
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleResolveConflict(claim, 'dismissed')}
                                    className="ds-btn-ghost px-3 py-1.5 text-xs font-medium rounded-lg cursor-pointer"
                                  >
                                    Dismiss
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleResolveConflict(claim, 'resolved_verified')}
                                    className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-[#8B181B] border border-rose-200/80 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                                  >
                                    <UserCheck className="w-3.5 h-3.5" />
                                    <span>Approve & Verify</span>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            )}

            {/* TAB 2: COLLISIONS & APPEALS — Exclusively Request Verification / Manual Verification Appeal */}
            {activeTab === 'conflicts' && (
              <div className="space-y-3.5">
                {filteredConflicts.length === 0 ? (
                  <div className="bg-stone-50/70 rounded-2xl border border-stone-200/80 p-12 text-center">
                    <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
                    <h3 className="text-sm font-bold text-stone-900">Collisions & Appeals Docket Clear</h3>
                    <p className="text-xs text-stone-500 max-w-sm mx-auto mt-1">
                      No pending verification requests or manual verification appeals require registrar review.
                    </p>
                  </div>
                ) : (
                  filteredConflicts.map((conflict) => {
                    const linkedApplicantUser = findLinkedUserForConflict(conflict);
                    const hasSupportingDoc = hasUploadedSelfieForTarget({ conflict, user: linkedApplicantUser });
                    const supportingDocLabel =
                      conflict.selfieWithIdName ||
                      linkedApplicantUser?.verificationProofName ||
                      linkedApplicantUser?.selfieWithIdName ||
                      (hasSupportingDoc ? 'Supporting Document / Selfie Attached' : 'No supporting document attached');
                    return (
                    <div
                      key={conflict.id}
                      className={`rounded-2xl border transition-all overflow-hidden ${
                        conflict.status === 'pending'
                          ? selectedConflictIds.includes(conflict.id)
                            ? 'border-[#8B181B] ring-2 ring-[#8B181B]/20 bg-white'
                            : 'border-amber-300 ring-1 ring-amber-300/40 bg-white'
                          : 'border-stone-200 bg-stone-50/60'
                      }`}
                    >
                      <div className="p-4 sm:p-4.5 bg-stone-50/70 border-b border-stone-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          {conflict.status === 'pending' && (
                            <button
                              type="button"
                              onClick={() => handleToggleSelectConflict(conflict.id)}
                              className="text-stone-400 hover:text-stone-700 transition-colors p-0.5 cursor-pointer"
                            >
                              {selectedConflictIds.includes(conflict.id) ? (
                                <CheckSquare className="w-4 h-4 text-[#8B181B]" />
                              ) : (
                                <Square className="w-4 h-4 text-stone-400" />
                              )}
                            </button>
                          )}

                          <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center shrink-0">
                            <Scale className="w-4 h-4" />
                          </div>

                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm text-stone-900">{conflict.applicantName}</span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-800 border border-stone-200">
                                {conflict.conflictType === 'duplicate_id'
                                  ? 'Duplicate Student ID'
                                  : conflict.conflictType === 'claimed_id_dispute'
                                  ? 'ID Claim Dispute'
                                  : conflict.conflictType === 'manual_verification_request' || conflict.conflictType === 'unlisted_record'
                                  ? 'Manual Verification Appeal'
                                  : conflict.conflictType === 'name_mismatch'
                                  ? 'Name Discrepancy'
                                  : conflict.conflictType === 'batch_discrepancy'
                                  ? 'Batch Discrepancy'
                                  : conflict.conflictType}
                              </span>
                              <span className="text-[10px] font-semibold text-stone-500">
                                Severity: {(conflict.severity || 'medium').toUpperCase()}
                              </span>
                            </div>
                            <div className="text-[11px] text-stone-500 mt-0.5 flex items-center gap-2">
                              <Mail className="w-3 h-3 text-stone-400" />
                              <span className="font-mono">{conflict.applicantEmail}</span>
                              <span className="text-stone-300">·</span>
                              <Clock className="w-3 h-3 text-stone-400" />
                              <span>{new Date(conflict.flaggedAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                          {linkedApplicantUser && (
                            <button
                              type="button"
                              onClick={() => setSelectedUserIdForModal(linkedApplicantUser.uid)}
                              className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Profile</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => openSelfieViewer(buildInspectionTargetFromConflict(conflict))}
                            className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                          >
                            <Camera className="w-3.5 h-3.5" strokeWidth={1.75} />
                            <span>View Selfie with ID</span>
                          </button>

                          {conflict.status === 'pending' ? (
                            <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200/80 flex items-center gap-1.5">
                              <Clock className="w-3 h-3" />
                              Hearing Required
                            </span>
                          ) : conflict.status === 'resolved_verified' ? (
                            <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Approved & Verified
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-stone-100 text-stone-700 border border-stone-200">
                              Rejected Claim
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="p-4 sm:p-5 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 space-y-2">
                            <span className="text-[10px] font-semibold text-stone-500 uppercase block pb-1 border-b border-stone-200">
                              Requesting Alumni & Academic Details
                            </span>
                            <div className="space-y-1.5 text-xs">
                              <div className="flex justify-between gap-2">
                                <span className="text-stone-500">Student ID:</span>
                                <span className="font-mono font-bold text-stone-900">{conflict.applicantStudentId || 'N/A'}</span>
                              </div>
                              <div className="flex justify-between gap-2">
                                <span className="text-stone-500">Declared Name:</span>
                                <span className="font-bold text-stone-900 text-right">{conflict.applicantName}</span>
                              </div>
                              {(conflict.applicantPhone || linkedApplicantUser?.phone) && (
                                <div className="flex justify-between gap-2">
                                  <span className="text-stone-500">Contact Phone:</span>
                                  <span className="font-mono text-stone-800">{conflict.applicantPhone || linkedApplicantUser?.phone}</span>
                                </div>
                              )}
                              {conflict.applicantCourse && (
                                <div className="flex justify-between gap-2">
                                  <span className="text-stone-500">Program:</span>
                                  <span className="font-semibold text-stone-800 truncate max-w-[200px] text-right">{conflict.applicantCourse}</span>
                                </div>
                              )}
                              <div className="flex justify-between gap-2">
                                <span className="text-stone-500">Cohort:</span>
                                <span className="font-semibold text-stone-800">Class of {conflict.applicantBatch || 'N/A'}</span>
                              </div>
                              <div className="flex justify-between gap-2 pt-1 border-t border-stone-200/70">
                                <span className="text-stone-500">Supporting Document:</span>
                                <span className={`font-mono text-[11px] font-semibold truncate max-w-[180px] ${hasSupportingDoc ? 'text-emerald-700' : 'text-stone-500'}`} title={supportingDocLabel}>
                                  {supportingDocLabel}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 space-y-2">
                            <span className="text-[10px] font-bold text-emerald-700 uppercase block pb-1 border-b border-stone-200">
                              Registrar Masterlist
                            </span>
                            {conflict.registryRecord ? (
                              <div className="space-y-1.5 text-xs">
                                <div className="flex justify-between">
                                  <span className="text-stone-500">Archive ID:</span>
                                  <span className="font-mono font-bold text-emerald-800">{conflict.registryRecord.studentId}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-stone-500">Archive Name:</span>
                                  <span className="font-bold text-stone-900">{conflict.registryRecord.fullName}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-stone-500">Accredited:</span>
                                  <span className="font-semibold text-stone-800">{conflict.registryRecord.course}</span>
                                </div>
                              </div>
                            ) : (
                              <div className="text-stone-500 text-xs py-3 text-center">
                                No record found with Student ID {conflict.applicantStudentId}.
                              </div>
                            )}
                          </div>
                        </div>

                        {conflict.notes && (
                          <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs text-stone-800 leading-relaxed">
                            <span className="font-bold text-stone-900 block text-[11px] uppercase tracking-wider mb-1">
                              Claimant Statement & Details
                            </span>
                            <p className="text-stone-700 whitespace-pre-wrap">{conflict.notes}</p>
                          </div>
                        )}

                        {conflict.status !== 'pending' && (conflict.reviewedByName || conflict.resolvedBy || conflict.rejectionReason || conflict.resolutionNote) && (
                          <div className={`p-3 rounded-xl border text-xs space-y-1 ${
                            conflict.status === 'resolved_verified'
                              ? 'bg-emerald-50/60 border-emerald-200/80 text-emerald-950'
                              : 'bg-stone-100/80 border-stone-200 text-stone-800'
                          }`}>
                            <div className="flex items-center justify-between gap-2 flex-wrap text-[11px]">
                              <span className="font-bold">
                                Reviewed by {conflict.reviewedByName || conflict.resolvedBy || 'Authorized Reviewer'}
                                {conflict.reviewedByRole ? ` (${conflict.reviewedByRole.toUpperCase()})` : ''}
                              </span>
                              {(conflict.reviewedAt || conflict.resolvedAt) && (
                                <span className="text-stone-500 font-mono">
                                  {new Date(conflict.reviewedAt || conflict.resolvedAt!).toLocaleString()}
                                </span>
                              )}
                            </div>
                            {conflict.status === 'resolved_rejected' && (conflict.rejectionReason || conflict.resolutionNote) && (
                              <p className="text-stone-700">
                                <span className="font-semibold text-stone-900">Rejection Reason: </span>
                                {conflict.rejectionReason || conflict.resolutionNote}
                              </p>
                            )}
                            {conflict.status === 'resolved_verified' && conflict.resolutionNote && (
                              <p className="text-emerald-900/90">{conflict.resolutionNote}</p>
                            )}
                          </div>
                        )}

                        {conflict.status === 'pending' && (
                          <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-stone-100">
                            <div className="flex-1">
                              <input
                                type="text"
                                value={singleNotesById[conflict.id] || ''}
                                onChange={(e) =>
                                  setSingleNotesById((prev) => ({
                                    ...prev,
                                    [conflict.id]: e.target.value
                                  }))
                                }
                                placeholder="Optional hearing justification or verification note..."
                                className="w-full px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#8B181B]/20"
                              />
                            </div>

                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                              {conflict.conflictType === 'duplicate_id' ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleResolveConflict(conflict, 'resolved_rejected')}
                                    className="ds-btn-secondary px-2.5 py-1.5 text-xs font-bold rounded-lg cursor-pointer"
                                    title="Keep original account 1 and reject applicant 2"
                                  >
                                    Keep Original (Reject)
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleMergeConflict(conflict)}
                                    className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                                    title="Merge applicant contact data into primary verified account"
                                  >
                                    Merge Accounts
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setReassignModalConflict(conflict);
                                      setNewReassignedId(conflict.applicantStudentId || 'SCC-2024-');
                                    }}
                                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-[#8B181B] border border-rose-200/80 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                                    title="Fix clerical ID typo and verify applicant"
                                  >
                                    <KeyRound className="w-3.5 h-3.5" />
                                    <span>Reassign ID & Approve</span>
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleResolveConflict(conflict, 'resolved_rejected')}
                                    className="ds-btn-secondary px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer"
                                  >
                                    Reject
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleResolveConflict(conflict, 'dismissed')}
                                    className="ds-btn-ghost px-3 py-1.5 text-xs font-medium rounded-lg cursor-pointer"
                                  >
                                    Dismiss
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleResolveConflict(conflict, 'resolved_verified')}
                                    className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-[#8B181B] border border-rose-200/80 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                                  >
                                    <UserCheck className="w-3.5 h-3.5" />
                                    <span>Approve & Verify</span>
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    );
                  })
                )}
              </div>
            )}

            {/* TAB 3: EMPLOYERS */}
            {activeTab === 'employers' && (
              <div className="space-y-3.5">
                {filteredEmployers.length === 0 ? (
                  <div className="bg-stone-50/70 rounded-2xl border border-stone-200/80 p-12 text-center">
                    <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
                    <h3 className="text-sm font-bold text-stone-900">Employer Vetting Docket Clear</h3>
                    <p className="text-xs text-stone-500 max-w-sm mx-auto mt-1">
                      All corporate recruiters and industry hiring partners have been accredited.
                    </p>
                  </div>
                ) : (
                  filteredEmployers.map((emp) => (
                    <div
                      key={emp.uid}
                      className="bg-white rounded-2xl border border-stone-200/90 p-4 sm:p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-stone-100 text-stone-700 flex items-center justify-center font-bold text-sm shrink-0 border border-stone-200">
                          <Building2 className="w-5 h-5 text-[#8B181B]" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-stone-900">{emp.companyName || emp.name}</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                              Pending Accreditation
                            </span>
                          </div>
                          <div className="text-[11px] text-stone-500 mt-0.5 flex items-center gap-2">
                            <span>Contact: {emp.name}</span>
                            <span className="text-stone-300">·</span>
                            <span className="font-mono">{emp.email}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            verifyEmployer(emp.uid, false);
                            showToast(`Declined employer registration for ${emp.companyName || emp.name}`, 'info');
                          }}
                          className="ds-btn-secondary px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer"
                        >
                          Decline
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            verifyEmployer(emp.uid, true);
                            showToast(`Accredited ${emp.companyName || emp.name} as verified employer!`, 'success');
                          }}
                          className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5 stroke-[2.25]" />
                          <span>Accredit Partner</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB 4: JOBS */}
            {activeTab === 'jobs' && (
              <div className="space-y-3.5">
                {filteredJobs.length === 0 ? (
                  <div className="bg-stone-50/70 rounded-2xl border border-stone-200/80 p-12 text-center">
                    <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
                    <h3 className="text-sm font-bold text-stone-900">Career Moderation Docket Clear</h3>
                    <p className="text-xs text-stone-500 max-w-sm mx-auto mt-1">
                      All employment postings and internship openings have been vetted.
                    </p>
                  </div>
                ) : (
                  filteredJobs.map((job) => (
                    <div
                      key={job.id}
                      className="bg-white rounded-2xl border border-stone-200/90 p-4 sm:p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-stone-100 text-stone-700 flex items-center justify-center font-bold text-sm shrink-0 border border-stone-200">
                          <Briefcase className="w-5 h-5 text-[#8B181B]" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-stone-900">{job.title}</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 border border-stone-200">
                              {job.type}
                            </span>
                          </div>
                          <div className="text-[11px] text-stone-500 mt-0.5 flex items-center gap-2">
                            <span className="font-semibold text-stone-700">{job.company}</span>
                            <span className="text-stone-300">·</span>
                            <span>{job.location}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            rejectOpportunity(job.id, 'Does not meet career compliance guidelines');
                            showToast(`Rejected job listing: ${job.title}`, 'info');
                          }}
                          className="ds-btn-secondary px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer"
                        >
                          Decline
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            approveOpportunity(job.id);
                            showToast(`Published job opportunity to alumni: ${job.title}`, 'success');
                          }}
                          className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5 stroke-[2.25]" />
                          <span>Approve & Publish</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
        </div>
      </div>

      {/* Reassign Student ID Hearing Dialog */}
      {reassignModalConflict && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-5 py-4 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[#8B181B]" />
                <h3 className="font-bold text-sm text-stone-900">Reassign Student ID & Verify</h3>
              </div>
              <button
                type="button"
                onClick={() => setReassignModalConflict(null)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <p className="text-stone-600 leading-relaxed">
                If applicant <strong className="text-stone-900">{reassignModalConflict.applicantName}</strong> encountered an ID collision due to a clerical typo, assign their correct unique student identifier below. This will update their account profile and grant verified status.
              </p>

              <div>
                <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Corrected Student ID <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={newReassignedId}
                  onChange={(e) => setNewReassignedId(e.target.value)}
                  placeholder="e.g. SCC-2024-9876"
                  className="w-full px-3 py-2 font-mono font-semibold bg-stone-50 border border-stone-200 rounded-xl text-sm uppercase focus:bg-white focus:border-[#8B181B]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Hearing Deliberation Note
                </label>
                <input
                  type="text"
                  value={singleNotesById[reassignModalConflict.id] || ''}
                  onChange={(e) =>
                    setSingleNotesById((prev) => ({
                      ...prev,
                      [reassignModalConflict.id]: e.target.value
                    }))
                  }
                  placeholder="e.g. Verified official transcript; corrected typo in registration ID."
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:bg-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setReassignModalConflict(null)}
                  className="ds-btn-secondary px-3.5 py-2 min-h-[44px] sm:min-h-[38px] rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={executeReassignAndApprove}
                  className="ds-btn-primary px-4 py-2 min-h-[44px] sm:min-h-[38px] font-bold rounded-xl text-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Reassign & Approve</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          SELFIE WITH ID INSPECTION MODAL (ZOOMABLE VIEWER)
          ======================================================== */}
      {selfieViewerTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs"
          onClick={() => setSelfieViewerTarget(null)}
        >
          <div
            className="w-full max-w-5xl max-h-[92dvh] bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-4 bg-stone-50 border-b border-stone-200 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-red-50 text-[#8B181B] border border-red-200/70 flex items-center justify-center shrink-0">
                  <Camera className="w-4 h-4" strokeWidth={1.75} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-sm text-stone-900 truncate">
                    Selfie with ID — {selfieViewerTarget.applicantName}
                  </h3>
                  <p className="text-[11px] text-stone-500 truncate">
                    Identity & academic record verification viewer • Authorized role: {normalizeSystemRole(currentUser?.role).toUpperCase()}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelfieViewerTarget(null)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition-colors cursor-pointer"
                aria-label="Close Selfie with ID viewer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Split Content: Zoomable Image Viewer + Request Info */}
            <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12">
              {/* Left: Zoomable Image Stage */}
              <div className="lg:col-span-7 bg-stone-900/95 flex flex-col min-h-[320px] lg:min-h-[460px] border-b lg:border-b-0 lg:border-r border-stone-200">
                {/* Zoom Toolbar */}
                <div className="px-4 py-2.5 bg-stone-950/60 border-b border-white/10 flex items-center justify-between gap-2 text-xs text-stone-200 shrink-0">
                  <span className="text-[11px] text-stone-300 truncate max-w-[220px]">
                    {selfieViewerImageUrl ? (selfieViewerFileName || 'Uploaded Selfie with ID') : 'Verification Photo'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={!selfieViewerImageUrl || selfieZoom <= 1}
                      onClick={() => setSelfieZoom((z) => Math.max(1, Number((z - 0.25).toFixed(2))))}
                      className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white disabled:opacity-35 transition-colors cursor-pointer"
                      title="Zoom Out"
                    >
                      <ZoomOut className="w-3.5 h-3.5" strokeWidth={1.75} />
                    </button>
                    <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded bg-white/10 text-stone-100 min-w-[48px] text-center">
                      {Math.round(selfieZoom * 100)}%
                    </span>
                    <button
                      type="button"
                      disabled={!selfieViewerImageUrl || selfieZoom >= 3}
                      onClick={() => setSelfieZoom((z) => Math.min(3, Number((z + 0.25).toFixed(2))))}
                      className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white disabled:opacity-35 transition-colors cursor-pointer"
                      title="Zoom In"
                    >
                      <ZoomIn className="w-3.5 h-3.5" strokeWidth={1.75} />
                    </button>
                    <button
                      type="button"
                      disabled={!selfieViewerImageUrl || selfieZoom === 1}
                      onClick={() => setSelfieZoom(1)}
                      className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white disabled:opacity-35 transition-colors cursor-pointer"
                      title="Reset Zoom"
                    >
                      <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.75} />
                    </button>
                  </div>
                </div>

                {/* Image Viewport */}
                <div className="flex-1 overflow-auto flex items-center justify-center p-4">
                  {isLoadingSelfieImage ? (
                    <div className="text-center text-stone-300 space-y-2 py-12">
                      <Loader2 className="w-7 h-7 animate-spin mx-auto text-stone-400" />
                      <p className="text-xs">Loading uploaded Selfie with ID...</p>
                    </div>
                  ) : selfieViewerImageUrl ? (
                    <div className="inline-flex items-center justify-center">
                      <img
                        src={selfieViewerImageUrl}
                        alt={`Selfie with ID submitted by ${selfieViewerTarget.applicantName}`}
                        onClick={() => setSelfieZoom((z) => (z < 2 ? 2 : 1))}
                        style={{
                          width: `${selfieZoom * 100}%`,
                          maxWidth: selfieZoom === 1 ? '100%' : 'none'
                        }}
                        className={`rounded-xl shadow-lg object-contain transition-all duration-150 ${
                          selfieZoom > 1 ? 'cursor-zoom-out' : 'cursor-zoom-in max-h-[420px]'
                        }`}
                      />
                    </div>
                  ) : (
                    <div className="text-center max-w-xs mx-auto py-12 px-4 space-y-2">
                      <div className="w-12 h-12 rounded-2xl bg-white/10 text-stone-300 flex items-center justify-center mx-auto">
                        <Camera className="w-6 h-6" strokeWidth={1.75} />
                      </div>
                      <h4 className="text-sm font-bold text-white">No Selfie with ID Uploaded</h4>
                      <p className="text-xs text-stone-400 leading-relaxed">
                        No uploaded verification photo is attached to this alumni request record.
                      </p>
                    </div>
                  )}
                </div>

                {selfieViewerImageUrl && (
                  <div className="px-4 py-2 bg-stone-950/60 border-t border-white/10 text-[11px] text-stone-400 flex items-center justify-between gap-2 shrink-0">
                    <span>Click photo or use zoom controls to inspect face & ID details.</span>
                    {selfieViewerUploadedAt && (
                      <span className="font-mono">
                        Uploaded {new Date(selfieViewerUploadedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Right: Corresponding Alumni Request Information & Registrar Archive */}
              <div className="lg:col-span-5 p-5 space-y-4 text-xs bg-white">
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-stone-100">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                    Submitted Request Details
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    selfieViewerTarget.isPending
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : selfieViewerTarget.currentStatusLabel.includes('Verified')
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-stone-100 text-stone-700 border-stone-200'
                  }`}>
                    {selfieViewerTarget.currentStatusLabel}
                  </span>
                </div>

                <div className="bg-stone-50 rounded-xl border border-stone-200/80 p-3.5 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">
                    Personal & Academic Information
                  </span>
                  <div className="space-y-1.5">
                    <div className="flex justify-between gap-3">
                      <span className="text-stone-500">Full Name:</span>
                      <span className="font-bold text-stone-900 text-right">{selfieViewerTarget.applicantName}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-stone-500">Email:</span>
                      <span className="font-mono text-stone-800 text-right break-all">{selfieViewerTarget.applicantEmail || 'N/A'}</span>
                    </div>
                    {selfieViewerTarget.applicantPhone && (
                      <div className="flex justify-between gap-3">
                        <span className="text-stone-500">Phone:</span>
                        <span className="font-mono text-stone-800 text-right">{selfieViewerTarget.applicantPhone}</span>
                      </div>
                    )}
                    <div className="flex justify-between gap-3">
                      <span className="text-stone-500">Account Role:</span>
                      <span className="font-semibold text-stone-800">Alumni</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-stone-500">Student ID:</span>
                      <span className="font-mono font-bold text-stone-900">{selfieViewerTarget.studentId || 'Unlisted / Pending'}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-stone-500">Degree Program:</span>
                      <span className="font-semibold text-stone-800 text-right">{selfieViewerTarget.course || 'Not specified'}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-stone-500">Graduation Batch:</span>
                      <span className="font-semibold text-stone-800">Class of {selfieViewerTarget.batch || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-stone-50 rounded-xl border border-stone-200/80 p-3.5 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
                    Available Registrar Record
                  </span>
                  {selfieViewerTarget.registryRecord ? (
                    <div className="space-y-1.5">
                      <div className="flex justify-between gap-3">
                        <span className="text-stone-500">Archive ID:</span>
                        <span className="font-mono font-bold text-emerald-800">{selfieViewerTarget.registryRecord.studentId}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-stone-500">Archive Name:</span>
                        <span className="font-bold text-stone-900 text-right">{selfieViewerTarget.registryRecord.fullName}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-stone-500">Accredited Degree:</span>
                        <span className="font-semibold text-stone-800 text-right">{selfieViewerTarget.registryRecord.course}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-stone-500">Class of:</span>
                        <span className="font-semibold text-stone-800">{selfieViewerTarget.registryRecord.batchYear}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-stone-500">
                      No matching electronic record found in the Registrar masterlist. Manual verification against uploaded Selfie with ID and archive records required.
                    </p>
                  )}
                </div>

                {selfieViewerTarget.notes && (
                  <div className="bg-amber-50/70 rounded-xl border border-amber-200/80 p-3 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-stone-700 block">
                      {selfieViewerTarget.conflict && isStudentIdDisputeRecord(selfieViewerTarget.conflict)
                        ? 'Dispute Explanation & Supporting Statement'
                        : 'Academic Details & Remarks'}
                    </span>
                    <p className="text-[11px] text-stone-700 whitespace-pre-wrap leading-relaxed">
                      {selfieViewerTarget.notes}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3.5 bg-stone-50 border-t border-stone-200 flex items-center justify-between gap-2 flex-wrap shrink-0">
              <button
                type="button"
                onClick={() => setSelfieViewerTarget(null)}
                className="ds-btn-ghost px-4 py-2 min-h-[44px] sm:min-h-[38px] rounded-xl text-xs font-semibold cursor-pointer"
              >
                Close Viewer
              </button>

              {selfieViewerTarget.isPending && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openRejectConfirmation(selfieViewerTarget)}
                    className="ds-btn-secondary px-3.5 py-2 min-h-[44px] sm:min-h-[38px] text-xs font-bold rounded-xl cursor-pointer"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => openApproveConfirmation(selfieViewerTarget)}
                    className="ds-btn-primary px-4 py-2 min-h-[44px] sm:min-h-[38px] text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Approve & Verify</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          APPROVE & VERIFY CONFIRMATION DIALOG
          ======================================================== */}
      {approveConfirmTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-xs"
          onClick={() => !isSubmittingDecision && setApproveConfirmTarget(null)}
        >
          <div
            className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" strokeWidth={1.75} />
                </div>
                <h3 className="font-bold text-sm text-stone-900">Approve & Verify Alumni</h3>
              </div>
              <button
                type="button"
                disabled={isSubmittingDecision}
                onClick={() => setApproveConfirmTarget(null)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700 cursor-pointer disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <p className="text-sm font-semibold text-stone-900 leading-relaxed">
                Are you sure you want to approve and verify this Alumni's identity and academic records?
              </p>

              {/* Reviewer Verification Examination Summary */}
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-3.5 space-y-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">
                  Pre-Approval Verification Review
                </span>
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex justify-between gap-2">
                    <span className="text-stone-500">Personal Information:</span>
                    <span className="font-bold text-stone-900 text-right">
                      {approveConfirmTarget.applicantName} ({approveConfirmTarget.applicantEmail || 'No email'})
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-stone-500">Academic Details:</span>
                    <span className="font-semibold text-stone-800 text-right">
                      {approveConfirmTarget.course || 'N/A'} • Class of {approveConfirmTarget.batch || 'N/A'} ({approveConfirmTarget.studentId || 'Unlisted ID'})
                    </span>
                  </div>
                  <div className="flex justify-between gap-2 items-center">
                    <span className="text-stone-500">Uploaded Selfie with ID:</span>
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold ${
                        hasUploadedSelfieForTarget({ user: approveConfirmTarget.user, conflict: approveConfirmTarget.conflict })
                          ? 'text-emerald-700'
                          : 'text-amber-700'
                      }`}>
                        {hasUploadedSelfieForTarget({ user: approveConfirmTarget.user, conflict: approveConfirmTarget.conflict })
                          ? 'Attached'
                          : 'Not attached'}
                      </span>
                      <button
                        type="button"
                        onClick={() => openSelfieViewer(approveConfirmTarget)}
                        className="text-[11px] font-bold text-[#8B181B] hover:underline cursor-pointer"
                      >
                        Inspect Photo
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-stone-500">Registrar Archive:</span>
                    <span className="font-semibold text-stone-800 text-right">
                      {approveConfirmTarget.registryRecord
                        ? `Matched: ${approveConfirmTarget.registryRecord.fullName} (${approveConfirmTarget.registryRecord.studentId})`
                        : 'Manual archive review (no electronic match)'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-emerald-50/70 border border-emerald-200/80 p-3 text-[11px] text-emerald-900 leading-relaxed">
                Confirming will mark the verification request as <strong>Approved / Verified</strong>, keep the account role as <strong>Alumni</strong>, activate verified Alumni access, and record your reviewing details.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  disabled={isSubmittingDecision}
                  onClick={() => setApproveConfirmTarget(null)}
                  className="ds-btn-secondary px-4 py-2 min-h-[44px] sm:min-h-[38px] rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSubmittingDecision}
                  onClick={handleConfirmApproveAndVerify}
                  className="ds-btn-primary px-4 py-2 min-h-[44px] sm:min-h-[38px] font-bold rounded-xl text-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>{isSubmittingDecision ? 'Verifying...' : 'Confirm Approval'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          REJECT VERIFICATION REQUEST CONFIRMATION DIALOG
          ======================================================== */}
      {rejectConfirmTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-xs"
          onClick={() => !isSubmittingDecision && setRejectConfirmTarget(null)}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-red-50 text-[#8B181B] border border-red-200 flex items-center justify-center">
                  <UserX className="w-4 h-4" strokeWidth={1.75} />
                </div>
                <h3 className="font-bold text-sm text-stone-900">Reject Verification Request</h3>
              </div>
              <button
                type="button"
                disabled={isSubmittingDecision}
                onClick={() => setRejectConfirmTarget(null)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700 cursor-pointer disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <p className="text-stone-700 leading-relaxed">
                Are you sure you want to reject the verification request for{' '}
                <strong className="text-stone-900">{rejectConfirmTarget.applicantName}</strong>{' '}
                (<span className="font-mono">{rejectConfirmTarget.applicantEmail || 'N/A'}</span>)? Their account role will remain <strong>Alumni</strong> and their verification status will be updated to <strong>Rejected</strong>.
              </p>

              <div>
                <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  Rejection Reason <span className="text-red-600">*</span>
                </label>
                <textarea
                  rows={3}
                  value={rejectReasonText}
                  onChange={(e) => {
                    setRejectReasonText(e.target.value);
                    if (rejectReasonError && e.target.value.trim()) {
                      setRejectReasonError(null);
                    }
                  }}
                  placeholder="Specify why this verification request is being rejected (e.g., unreadable ID details, photo mismatch, or unconfirmed graduation record)..."
                  className={`w-full px-3 py-2 bg-stone-50 border rounded-xl text-xs text-stone-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#8B181B]/20 resize-none ${
                    rejectReasonError ? 'border-red-300' : 'border-stone-200'
                  }`}
                />
                {rejectReasonError && (
                  <p className="text-[11px] font-semibold text-red-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{rejectReasonError}</span>
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  disabled={isSubmittingDecision}
                  onClick={() => setRejectConfirmTarget(null)}
                  className="ds-btn-secondary px-4 py-2 min-h-[44px] sm:min-h-[38px] rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSubmittingDecision}
                  onClick={handleConfirmRejectRequest}
                  className="ds-btn-primary px-4 py-2 min-h-[44px] sm:min-h-[38px] font-bold rounded-xl text-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>{isSubmittingDecision ? 'Rejecting...' : 'Confirm Rejection'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Aliases for router compatibility
export const AdminGovernanceView = AdminRequestsAndConflictsView;
export const AdminVerificationAndIdentityView = AdminRequestsAndConflictsView;
