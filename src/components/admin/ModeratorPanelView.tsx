/**
 * Moderator Panel View — Unified Post & Content Moderation Desk and
 * Employer Accreditation Review Queue.
 *
 * Strict RBAC Isolation: Never renders system audit logs, database metrics, or indexes
 * (those are strictly restricted to Superadmin views).
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Building2,
  Globe,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Search,
  RefreshCw,
  ExternalLink,
  BadgeCheck,
  Ban,
  Flag,
  Eye,
  Trash2,
  RotateCcw,
  Lock,
  Unlock,
  X,
  MessageSquareWarning
} from 'lucide-react';
import { useAlumni } from '../../context/AlumniContext';
import {
  AbuseReporterTracking,
  InstitutionalFeedPost,
  ModerationAppeal,
  ModerationCase,
  ModerationWarning,
  POST_REPORT_REASONS,
  PostReport,
  UserProfile,
  normalizeSystemRole
} from '../../types';
import { apiFetch, apiFetchWithCsrf } from '../../services/apiClient';
import { formatFullLocalDateTime, formatRelativeTime } from '../../lib/dateUtils';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { ForbiddenAccessView } from '../common/ForbiddenAccessView';
import { PaginationControl } from '../common/PaginationControl';
import { HIGHLIGHT_RING_CLASS, useDeepLinkHighlight } from '../../hooks/useDeepLinkHighlight';

export type ModeratorSubTab = 'cases' | 'employers';

export interface ModeratorPanelViewProps {
  initialSubTab?: ModeratorSubTab;
}

type EnrichedModerationCase = ModerationCase & {
  reports: PostReport[];
  livePost: InstitutionalFeedPost | null;
  canAct: boolean;
  conflictReason?: string;
};

type CaseDetailPayload = {
  case: ModerationCase;
  livePost: InstitutionalFeedPost | null;
  reports: PostReport[];
  authorWarningHistory: ModerationWarning[];
  activeWarningsCount: number;
  authorBanFlag: { userId: string; flaggedAt: string; activeWarnings: number; reason: string } | null;
  appeals: ModerationAppeal[];
  canAct: boolean;
  conflictReason?: string;
};

type BanFlagItem = {
  userId: string;
  flaggedAt: string;
  activeWarnings: number;
  reason: string;
};

export const ModeratorPanelView: React.FC<ModeratorPanelViewProps> = ({
  initialSubTab = 'cases'
}) => {
  const {
    users,
    currentUser,
    verifyEmployer,
    showToast,
    addAuditLog,
    deepLinkTarget,
    clearDeepLinkTarget,
    openProfile,
    refreshData,
    highlightedItemId,
    setActiveTab
  } = useAlumni();

  const normalizedRole = normalizeSystemRole(currentUser?.role);
  const hasModerationAccess = ['moderator', 'admin', 'superadmin'].includes(normalizedRole);
  const isAdmin = normalizedRole === 'admin' || normalizedRole === 'superadmin';

  const [activeSubTab, setActiveSubTab] = useState<ModeratorSubTab>(initialSubTab);

  useEffect(() => {
    setActiveSubTab(initialSubTab);
  }, [initialSubTab]);

  // ---------------------------------------------------------------------------
  // TAB 1: REPORTED POSTS QUEUE & ABUSE TRACKING
  // ---------------------------------------------------------------------------
  const [cases, setCases] = useState<EnrichedModerationCase[]>([]);
  const [casesTotal, setCasesTotal] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [casesPage, setCasesPage] = useState(1);
  const [casesStatus, setCasesStatus] = useState<string>('pending');
  const [casesPriority, setCasesPriority] = useState<string>('all');
  const [casesReason, setCasesReason] = useState<string>('all');
  const [casesSort, setCasesSort] = useState<'priority' | 'most_reported' | 'newest'>('priority');
  const [casesSearch, setCasesSearch] = useState('');
  const [casesLoading, setCasesLoading] = useState(false);
  const [casesError, setCasesError] = useState<string | null>(null);

  const [reporters, setReporters] = useState<AbuseReporterTracking[]>([]);
  const [banFlags, setBanFlags] = useState<BanFlagItem[]>([]);

  // Case inspection drawer/modal state
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [caseDetail, setCaseDetail] = useState<CaseDetailPayload | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Action inputs inside Case Detail Modal
  const [actionReason, setActionReason] = useState<string>(POST_REPORT_REASONS[0]);
  const [actionMessage, setActionMessage] = useState('');
  const [actionNote, setActionNote] = useState('');
  const [isMutatingCase, setIsMutatingCase] = useState(false);
  const [pendingClaimCaseId, setPendingClaimCaseId] = useState<string | null>(null);

  const fetchCasesAndAbuse = useCallback(async () => {
    if (!hasModerationAccess) return;
    setCasesLoading(true);
    setCasesError(null);
    try {
      const params = new URLSearchParams({
        page: String(casesPage),
        pageSize: '10',
        status: casesStatus,
        priority: casesPriority,
        reason: casesReason,
        sort: casesSort
      });
      if (casesSearch.trim()) {
        params.set('search', casesSearch.trim());
      }

      const [casesRes, reportersRes, banFlagsRes] = await Promise.all([
        apiFetch(`/api/moderation/cases?${params.toString()}`, { method: 'GET' }, 6000),
        apiFetch('/api/moderation/abuse/reporters', { method: 'GET' }, 5000).catch(() => null),
        isAdmin
          ? apiFetch('/api/moderation/abuse/ban-flags', { method: 'GET' }, 5000).catch(() => null)
          : Promise.resolve(null)
      ]);

      if (!casesRes.ok) {
        const errBody = await casesRes.json().catch(() => null);
        if (casesRes.status === 401 || casesRes.status === 403) {
          throw new Error(errBody?.error || 'Your session expired or lacks moderation permissions. Please sign in again.');
        }
        throw new Error(errBody?.error || `Failed to load moderation cases (HTTP ${casesRes.status}).`);
      }

      const data = await casesRes.json();
      setCases(Array.isArray(data.cases) ? data.cases : []);
      setCasesTotal(Number(data.total) || 0);
      setPendingCount(Number(data.pendingCount) || 0);

      if (reportersRes && reportersRes.ok) {
        const repData = await reportersRes.json();
        setReporters(Array.isArray(repData.reporters) ? repData.reporters : []);
      } else {
        setReporters([]);
      }
      if (banFlagsRes && banFlagsRes.ok) {
        const banData = await banFlagsRes.json();
        setBanFlags(Array.isArray(banData.banFlags) ? banData.banFlags : []);
      } else if (!isAdmin) {
        setBanFlags([]);
      }
    } catch (err: any) {
      setCasesError(err?.message || 'Failed to load moderation queue.');
    } finally {
      setCasesLoading(false);
    }
  }, [hasModerationAccess, casesPage, casesStatus, casesPriority, casesReason, casesSort, casesSearch, isAdmin]);

  const loadCaseDetail = useCallback(async (caseId: string) => {
    setSelectedCaseId(caseId);
    setDetailLoading(true);
    setDetailError(null);
    setActionMessage('');
    setActionNote('');
    try {
      const res = await apiFetch(`/api/moderation/cases/${encodeURIComponent(caseId)}`, { method: 'GET' }, 6000);
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.error || 'Unable to load case details.');
      }
      const data: CaseDetailPayload = await res.json();
      setCaseDetail(data);
      const topReason = Object.keys(data.case.reasonsSummary || {})[0];
      if (topReason && (POST_REPORT_REASONS as readonly string[]).includes(topReason)) {
        setActionReason(topReason);
      }
    } catch (err: any) {
      setDetailError(err?.message || 'Failed to load case inspection details.');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const [employerQueue, setEmployerQueue] = useState<UserProfile[]>([]);
  const [employersLoading, setEmployersLoading] = useState(false);
  const [employersError, setEmployersError] = useState<string | null>(null);
  const [isMutatingEmployer, setIsMutatingEmployer] = useState(false);

  const fetchEmployerQueue = useCallback(async () => {
    if (!hasModerationAccess) return;
    setEmployersLoading(true);
    setEmployersError(null);
    try {
      const res = await apiFetch('/api/employer/review-queue', { method: 'GET' }, 6000);
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        if (res.status === 401 || res.status === 403) {
          throw new Error(errBody?.error || 'Your session expired or lacks moderation permissions. Please sign in again.');
        }
        throw new Error(errBody?.error || `Failed to load employer accreditation queue (HTTP ${res.status}).`);
      }
      const data = await res.json();
      setEmployerQueue(Array.isArray(data.queue) ? data.queue : []);
    } catch (err: any) {
      setEmployersError(err?.message || 'Failed to load employer accreditation queue.');
    } finally {
      setEmployersLoading(false);
    }
  }, [hasModerationAccess]);

  // Load data for active sub-tab
  useEffect(() => {
    if (!hasModerationAccess) return;
    if (activeSubTab === 'cases') {
      void fetchCasesAndAbuse();
    } else if (activeSubTab === 'employers') {
      void fetchEmployerQueue();
    }
  }, [hasModerationAccess, activeSubTab, fetchCasesAndAbuse, fetchEmployerQueue]);

  const missingTargetNotifiedRef = React.useRef<string | null>(null);

  // Handle incoming deep links from Notifications (Moderation Queue, Employer review)
  useEffect(() => {
    if (!deepLinkTarget) return;
    if (deepLinkTarget.targetType === 'moderation_queue' || deepLinkTarget.targetType === 'moderation_appeal') {
      setActiveSubTab('cases');
      if (deepLinkTarget.subTab === 'resolved' || deepLinkTarget.targetId) {
        setCasesStatus('all');
        setCasesPriority('all');
        setCasesReason('all');
        setCasesSearch('');
        setCasesPage(1);
      }
      clearDeepLinkTarget();
    } else if (deepLinkTarget.targetType === 'employer') {
      setActiveSubTab('employers');
      setStatusFilter('all');
      setSearchQuery('');
      clearDeepLinkTarget();
    }
  }, [deepLinkTarget, clearDeepLinkTarget]);

  // ---------------------------------------------------------------------------
  // CASE MUTATION HANDLERS
  // ---------------------------------------------------------------------------
  const handleClaimOrRelease = async (caseId: string, mode: 'claim' | 'release') => {
    if (isMutatingCase) return;
    setIsMutatingCase(true);
    try {
      const res = await apiFetchWithCsrf(
        `/api/moderation/cases/${encodeURIComponent(caseId)}/${mode}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) },
        6000
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        if (res.status === 409) {
          await fetchCasesAndAbuse();
          if (selectedCaseId === caseId) {
            await loadCaseDetail(caseId);
          }
        }
        throw new Error(data?.error || `Failed to ${mode} case.`);
      }
      if (data?.case) {
        const updatedCase = data.case as ModerationCase;
        setCases((prev) =>
          prev.map((item) =>
            item.id === caseId
              ? {
                  ...item,
                  status: updatedCase.status,
                  claimedBy: updatedCase.claimedBy,
                  claimedByName: updatedCase.claimedByName,
                  claimedAt: updatedCase.claimedAt,
                  updatedAt: updatedCase.updatedAt
                }
              : item
          )
        );
        if (selectedCaseId === caseId) {
          setCaseDetail((prev) =>
            prev && prev.case.id === caseId
              ? {
                  ...prev,
                  case: {
                    ...prev.case,
                    status: updatedCase.status,
                    claimedBy: updatedCase.claimedBy,
                    claimedByName: updatedCase.claimedByName,
                    claimedAt: updatedCase.claimedAt,
                    updatedAt: updatedCase.updatedAt
                  }
                }
              : prev
          );
        }
      }
      showToast(mode === 'claim' ? 'Case claimed for review.' : 'Case released back to queue.', 'success');
      await fetchCasesAndAbuse();
      if (selectedCaseId === caseId) {
        await loadCaseDetail(caseId);
      }
    } catch (err: any) {
      showToast(err?.message || 'Unable to update case lock.', 'error');
    } finally {
      setIsMutatingCase(false);
    }
  };

  const handleConfirmClaim = async () => {
    if (!pendingClaimCaseId || isMutatingCase) return;
    const targetCaseId = pendingClaimCaseId;
    await handleClaimOrRelease(targetCaseId, 'claim');
    setPendingClaimCaseId(null);
  };

  const handleActOnCase = async (action: 'dismiss' | 'warn' | 'delete_post') => {
    if (!caseDetail) return;
    if (action === 'warn' && actionMessage.trim().length < 3) {
      showToast('Please enter a warning message for the author (at least 3 characters).', 'warning');
      return;
    }
    if (action === 'delete_post' && actionReason.trim().length < 3 && actionMessage.trim().length < 3) {
      showToast('Please select or enter a removal reason.', 'warning');
      return;
    }

    setIsMutatingCase(true);
    try {
      const res = await apiFetchWithCsrf(
        `/api/moderation/cases/${encodeURIComponent(caseDetail.case.id)}/act`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action,
            reason: actionReason,
            message: actionMessage.trim() || undefined,
            note: actionNote.trim() || undefined
          })
        },
        6000
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || 'Moderation action failed.');
      }
      if (data?.autoSuspended) {
        showToast('Action recorded. Author reached warning threshold and was automatically suspended.', 'warning');
      } else if (data?.flaggedForBan) {
        showToast('Action recorded. Author account flagged for Administrator ban review.', 'warning');
      } else {
        showToast(
          action === 'dismiss'
            ? 'Case dismissed with no violation.'
            : action === 'warn'
            ? 'Author warning issued.'
            : 'Post soft-deleted and removed from public feeds.',
          'success'
        );
      }
      setSelectedCaseId(null);
      setCaseDetail(null);
      await fetchCasesAndAbuse();
      await refreshData().catch(() => {});
    } catch (err: any) {
      showToast(err?.message || 'Unable to execute moderation action.', 'error');
    } finally {
      setIsMutatingCase(false);
    }
  };

  const handleRestorePost = async () => {
    if (!caseDetail?.livePost) return;
    setIsMutatingCase(true);
    try {
      const res = await apiFetchWithCsrf(
        `/api/moderation/posts/${encodeURIComponent(caseDetail.livePost.id)}/restore`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            note: actionNote.trim() || 'Post restored after moderation review.',
            adminApprovalGranted: isAdmin
          })
        },
        6000
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to restore post.');
      }
      showToast('Post restored to feeds.', 'success');
      await loadCaseDetail(caseDetail.case.id);
      await fetchCasesAndAbuse();
      await refreshData().catch(() => {});
    } catch (err: any) {
      showToast(err?.message || 'Unable to restore post.', 'error');
    } finally {
      setIsMutatingCase(false);
    }
  };

  const handleSanctionUser = async (
    targetUserId: string,
    action: 'suspend' | 'ban' | 'lift_sanction' | 'restrict_reporting' | 'unrestrict_reporting',
    customReason?: string
  ) => {
    if (!isAdmin) return;
    setIsMutatingCase(true);
    try {
      const res = await apiFetchWithCsrf(
        `/api/moderation/users/${encodeURIComponent(targetUserId)}/sanction`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action,
            reason: customReason || 'Administrative governance decision'
          })
        },
        6000
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to update account sanction.');
      }
      showToast(`Account action (${action.replace(/_/g, ' ')}) applied.`, 'success');
      if (selectedCaseId) {
        await loadCaseDetail(selectedCaseId);
      }
      await fetchCasesAndAbuse();
    } catch (err: any) {
      showToast(err?.message || 'Unable to apply sanction.', 'error');
    } finally {
      setIsMutatingCase(false);
    }
  };

  // ---------------------------------------------------------------------------
  // TAB 2: EMPLOYER ACCREDITATION QUEUE (PRESERVED WITHOUT AUDIT LOG VIEWER)
  // ---------------------------------------------------------------------------
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'needs_review' | 'verified' | 'rejected'>('needs_review');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const [actionModal, setActionModal] = useState<{
    type: 'approve' | 'reject' | 'request_docs';
    employer: UserProfile;
  } | null>(null);

  const [presetRejectReason, setPresetRejectReason] = useState(
    'Corporate legal name could not be validated against official SEC Philippines registry.'
  );
  const [docRequestNote, setDocRequestNote] = useState(
    'Please upload your current SEC Certificate of Incorporation or DTI Business Name Certificate.'
  );

  const employers = useMemo(() => {
    const byUid = new Map<string, UserProfile>();
    users
      .filter((u) => normalizeSystemRole(u.role) === 'employer')
      .forEach((u) => byUid.set(u.uid, u));
    employerQueue.forEach((srvEmp) => {
      const existing = byUid.get(srvEmp.uid);
      byUid.set(srvEmp.uid, existing ? { ...existing, ...srvEmp } : srvEmp);
    });
    return Array.from(byUid.values());
  }, [users, employerQueue]);

  const filteredEmployers = useMemo(() => {
    return employers.filter((emp) => {
      const name = (emp.companyName || emp.company || emp.name || '').toLowerCase();
      const email = (emp.email || '').toLowerCase();
      const website = (emp.companyWebsite || '').toLowerCase();
      const matchesSearch =
        name.includes(searchQuery.toLowerCase()) ||
        email.includes(searchQuery.toLowerCase()) ||
        website.includes(searchQuery.toLowerCase());

      const isRejected =
        emp.employerStatus === 'rejected' || emp.employerVerificationStatus === 'rejected';
      const isApproved =
        !isRejected &&
        (emp.employerStatus === 'approved' ||
          (emp.employerVerificationStatus as string) === 'approved' ||
          emp.isVerified);
      const isPending =
        !isApproved &&
        !isRejected &&
        (emp.employerStatus === 'pending' ||
          (emp.employerVerificationStatus as string) === 'pending_review' ||
          emp.employerVerificationStatus === 'pending_verification' ||
          !emp.isVerified);

      if (!matchesSearch) return false;
      if (statusFilter === 'needs_review') return isPending;
      if (statusFilter === 'verified') return isApproved;
      if (statusFilter === 'rejected') return isRejected;
      return true;
    });
  }, [employers, searchQuery, statusFilter]);

  const employerTotalPages = Math.ceil(filteredEmployers.length / pageSize) || 1;
  const paginatedEmployers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredEmployers.slice(start, start + pageSize);
  }, [filteredEmployers, currentPage, pageSize]);

  useEffect(() => {
    if (!highlightedItemId || deepLinkTarget) return;
    if (activeSubTab === 'cases' && !casesLoading) {
      const caseMatch = cases.some((c) => c.id === highlightedItemId || c.targetId === highlightedItemId);
      if (!caseMatch && casesStatus !== 'all') {
        setCasesStatus('all');
        setCasesPriority('all');
        setCasesReason('all');
        setCasesSearch('');
        setCasesPage(1);
      } else if (!caseMatch && cases.length > 0 && missingTargetNotifiedRef.current !== highlightedItemId) {
        missingTargetNotifiedRef.current = highlightedItemId;
        showToast('This moderation case may have been resolved or archived.', 'info');
      }
    } else if (activeSubTab === 'employers') {
      const idx = filteredEmployers.findIndex((e) => e.uid === highlightedItemId);
      if (idx >= 0) {
        const targetPage = Math.floor(idx / pageSize) + 1;
        if (currentPage !== targetPage) setCurrentPage(targetPage);
      } else if (employers.some((e) => e.uid === highlightedItemId)) {
        setStatusFilter('all');
        setSearchQuery('');
      } else if (employers.length > 0 && missingTargetNotifiedRef.current !== highlightedItemId) {
        missingTargetNotifiedRef.current = highlightedItemId;
        showToast('This employer verification record is no longer available.', 'info');
      }
    }
  }, [
    highlightedItemId,
    deepLinkTarget,
    activeSubTab,
    casesLoading,
    cases,
    casesStatus,
    filteredEmployers,
    employers,
    currentPage,
    pageSize,
    showToast
  ]);

  const { isHighlighted } = useDeepLinkHighlight(undefined, [
    activeSubTab,
    cases.length,
    paginatedEmployers.length,
    currentPage,
    casesLoading
  ]);

  const submitEmployerDecision = async (
    emp: UserProfile,
    decision: 'approve' | 'reject' | 'request_docs',
    reason?: string
  ): Promise<UserProfile | null> => {
    setIsMutatingEmployer(true);
    try {
      const res = await apiFetchWithCsrf(
        `/api/employer/review-queue/${encodeURIComponent(emp.uid)}/decision`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ decision, reason })
        },
        6000
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to record employer accreditation decision.');
      }
      if (data?.employer) {
        setEmployerQueue((prev) => {
          const exists = prev.some((item) => item.uid === emp.uid);
          if (!exists) return [data.employer, ...prev];
          return prev.map((item) => (item.uid === emp.uid ? { ...item, ...data.employer } : item));
        });
      }
      return data?.employer || null;
    } catch (err: any) {
      showToast(err?.message || 'Failed to update employer status.', 'error');
      return null;
    } finally {
      setIsMutatingEmployer(false);
    }
  };

  const handleApproveEmployer = async (emp: UserProfile) => {
    const updated = await submitEmployerDecision(emp, 'approve');
    if (!updated) return;
    verifyEmployer(emp.uid, 'verified');
    addAuditLog({
      action: 'APPROVE_EMPLOYER',
      actorId: currentUser?.uid || 'moderator',
      actorName: currentUser?.name || 'Moderator',
      actorRole: currentUser?.role || 'moderator',
      category: 'career',
      details: `Employer "${emp.companyName || emp.name}" approved and accredited after review.`,
      severity: 'success'
    });
    showToast(`Accredited "${emp.companyName || emp.name}" successfully.`, 'success');
    setActionModal(null);
  };

  const handleRejectEmployer = async (emp: UserProfile) => {
    const updated = await submitEmployerDecision(emp, 'reject', presetRejectReason);
    if (!updated) return;
    verifyEmployer(emp.uid, 'rejected', presetRejectReason);
    addAuditLog({
      action: 'REJECT_EMPLOYER',
      actorId: currentUser?.uid || 'moderator',
      actorName: currentUser?.name || 'Moderator',
      actorRole: currentUser?.role || 'moderator',
      category: 'career',
      details: `Employer "${emp.companyName || emp.name}" rejected. Reason: ${presetRejectReason}`,
      severity: 'warning'
    });
    showToast(`Employer application for "${emp.companyName || emp.name}" rejected.`, 'info');
    setActionModal(null);
  };

  const handleRequestDocs = async (emp: UserProfile) => {
    const updated = await submitEmployerDecision(emp, 'request_docs', docRequestNote);
    if (!updated) return;
    addAuditLog({
      action: 'REQUEST_EMPLOYER_DOCUMENTS',
      actorId: currentUser?.uid || 'moderator',
      actorName: currentUser?.name || 'Moderator',
      actorRole: currentUser?.role || 'moderator',
      category: 'career',
      details: `Requested supplemental documents from "${emp.companyName || emp.name}": ${docRequestNote}`,
      severity: 'info'
    });
    showToast(`Document request notice dispatched to ${emp.email}.`, 'success');
    setActionModal(null);
  };

  const flaggedReporters = useMemo(
    () => reporters.filter((r) => r.flaggedAbusiveReporter || r.reportingRestricted || r.consecutiveDismissedCount > 0),
    [reporters]
  );

  const formatStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'reviewed':
        return 'In Review';
      case 'action_taken':
        return 'Action Taken';
      case 'dismissed':
        return 'Dismissed';
      case 'post_removed':
        return 'Post Removed';
      default:
        return status;
    }
  };

  const renderPriorityBadge = (priority: string) => {
    if (priority === 'high') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#8B181B] dark:text-red-400">
          <AlertTriangle className="w-3.5 h-3.5" strokeWidth={1.75} />
          <span>High</span>
        </span>
      );
    }
    if (priority === 'medium') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
          <Clock className="w-3.5 h-3.5" strokeWidth={1.75} />
          <span>Medium</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-stone-600 dark:text-stone-400">
        <Flag className="w-3.5 h-3.5" strokeWidth={1.75} />
        <span>Low</span>
      </span>
    );
  };

  if (!hasModerationAccess) {
    return (
      <ForbiddenAccessView
        attemptedPath="/portal/moderation"
        attemptedModule="Post & Content Moderation"
        userRole={currentUser?.role}
        onReturnToOverview={() => setActiveTab('dashboard')}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Workspace Header + Segmented Navigation */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.03)]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-[#8B181B]/10 dark:bg-red-950/50 text-[#8B181B] dark:text-red-300 border border-[#8B181B]/20 dark:border-red-900/50 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5" strokeWidth={1.75} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-stone-900 dark:text-white tracking-tight">
                Moderation & Content Governance Desk
              </h1>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                Review reported alumni posts, inspect content snapshots, and accredit corporate partners.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (activeSubTab === 'cases') void fetchCasesAndAbuse();
                else void fetchEmployerQueue();
              }}
              className="inline-flex items-center justify-center gap-1.5 min-h-[44px] sm:min-h-[38px] px-4 py-2 rounded-xl text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-700 dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-200 border border-stone-200/80 dark:border-stone-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Sub-tab Switcher */}
        <div className="flex flex-wrap items-center gap-1.5 mt-5 pt-4 border-t border-stone-100 dark:border-stone-800">
          <button
            type="button"
            onClick={() => setActiveSubTab('cases')}
            className={`inline-flex items-center gap-2 min-h-[44px] sm:min-h-[36px] px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              activeSubTab === 'cases'
                ? 'bg-[#8B181B] text-white'
                : 'bg-stone-100 text-stone-700 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700'
            }`}
          >
            <Flag className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span>Reported Posts</span>
            <span className="tabular-nums font-mono text-[11px] opacity-90">({pendingCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('employers')}
            className={`inline-flex items-center gap-2 min-h-[44px] sm:min-h-[36px] px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              activeSubTab === 'employers'
                ? 'bg-[#8B181B] text-white'
                : 'bg-stone-100 text-stone-700 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span>Employer Accreditation</span>
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* SUB-TAB 1: REPORTED POSTS QUEUE                                       */}
      {/* ===================================================================== */}
      {activeSubTab === 'cases' && (
        <div className="space-y-6">
          {/* Compact Metrics Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 rounded-xl p-4">
              <div className="text-xs font-medium text-stone-500 dark:text-stone-400">Open Moderation Cases</div>
              <div className="text-2xl font-bold text-stone-900 dark:text-white tabular-nums mt-1">{pendingCount}</div>
            </div>
            <div className="bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 rounded-xl p-4">
              <div className="text-xs font-medium text-stone-500 dark:text-stone-400">Matching Filter</div>
              <div className="text-2xl font-bold text-stone-900 dark:text-white tabular-nums mt-1">{casesTotal}</div>
            </div>
            <div className="bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 rounded-xl p-4">
              <div className="text-xs font-medium text-stone-500 dark:text-stone-400">Reporter Abuse Watch</div>
              <div className="text-2xl font-bold text-stone-900 dark:text-white tabular-nums mt-1">
                {reporters.filter((r) => r.flaggedAbusiveReporter || r.reportingRestricted).length}
              </div>
            </div>
            <div className="bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 rounded-xl p-4">
              <div className="text-xs font-medium text-stone-500 dark:text-stone-400">
                {isAdmin ? 'Escalated Ban Flags' : 'Reviewer Conflict Policy'}
              </div>
              <div className="text-2xl font-bold text-stone-900 dark:text-white tabular-nums mt-1">
                {isAdmin ? banFlags.length : 'Active'}
              </div>
            </div>
          </div>

          {/* Filter & Search Toolbar */}
          <div className="bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 rounded-2xl p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-stone-500 dark:text-stone-400 mb-1">
                  Case Status
                </label>
                <select
                  value={casesStatus}
                  onChange={(e) => { setCasesStatus(e.target.value); setCasesPage(1); }}
                  className="w-full min-h-[44px] sm:min-h-[38px] px-3 py-2 text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100"
                >
                  <option value="pending">Pending Review</option>
                  <option value="reviewed">Claimed / In Review</option>
                  <option value="action_taken">Action Taken</option>
                  <option value="dismissed">Dismissed</option>
                  <option value="post_removed">Post Removed</option>
                  <option value="all">All Statuses</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-500 dark:text-stone-400 mb-1">
                  Priority
                </label>
                <select
                  value={casesPriority}
                  onChange={(e) => { setCasesPriority(e.target.value); setCasesPage(1); }}
                  className="w-full min-h-[44px] sm:min-h-[38px] px-3 py-2 text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100"
                >
                  <option value="all">All Priorities</option>
                  <option value="high">High Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="low">Low Priority</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-500 dark:text-stone-400 mb-1">
                  Report Reason
                </label>
                <select
                  value={casesReason}
                  onChange={(e) => { setCasesReason(e.target.value); setCasesPage(1); }}
                  className="w-full min-h-[44px] sm:min-h-[38px] px-3 py-2 text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100"
                >
                  <option value="all">All Reasons</option>
                  {POST_REPORT_REASONS.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-500 dark:text-stone-400 mb-1">
                  Sort Order
                </label>
                <select
                  value={casesSort}
                  onChange={(e) => { setCasesSort(e.target.value as any); setCasesPage(1); }}
                  className="w-full min-h-[44px] sm:min-h-[38px] px-3 py-2 text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100"
                >
                  <option value="priority">Highest Priority First</option>
                  <option value="most_reported">Most Reported</option>
                  <option value="newest">Newest Reported</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-500 dark:text-stone-400 mb-1">
                  Search Queue
                </label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    type="text"
                    value={casesSearch}
                    onChange={(e) => { setCasesSearch(e.target.value); setCasesPage(1); }}
                    placeholder="Author, post text, case ID..."
                    className="w-full min-h-[44px] sm:min-h-[38px] pl-9 pr-3 py-2 text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 placeholder:text-stone-400"
                  />
                </div>
              </div>
            </div>

            {/* Cases List / States */}
            {casesLoading ? (
              <div className="space-y-3 pt-2">
                {[1, 2, 3].map((idx) => (
                  <div
                    key={idx}
                    className="h-20 rounded-xl bg-stone-100 dark:bg-stone-800/60 animate-pulse border border-stone-200/60 dark:border-stone-800"
                  />
                ))}
              </div>
            ) : casesError ? (
              <div className="p-8 text-center border border-red-200 dark:border-red-900/50 bg-red-50/60 dark:bg-red-950/20 rounded-xl space-y-3">
                <p className="text-xs font-medium text-[#8B181B] dark:text-red-300">
                  Failed to load, retry — {casesError}
                </p>
                <button
                  type="button"
                  onClick={() => void fetchCasesAndAbuse()}
                  className="inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 rounded-xl text-xs font-semibold bg-[#8B181B] hover:bg-[#721316] text-white cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry</span>
                </button>
              </div>
            ) : cases.length === 0 ? (
              <div className="p-12 text-center text-xs text-stone-500 dark:text-stone-400 border border-dashed border-stone-200 dark:border-stone-800 rounded-xl">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-600 opacity-70" strokeWidth={1.75} />
                No moderation cases match the selected filters.
              </div>
            ) : (
              <div className="overflow-x-auto border border-stone-200/80 dark:border-stone-800 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-stone-50 dark:bg-stone-850 border-b border-stone-200/80 dark:border-stone-800 text-stone-500 dark:text-stone-400 font-semibold text-[11px]">
                      <th className="py-3 px-4">Reported Post & Author</th>
                      <th className="py-3 px-4">Priority & Reasons</th>
                      <th className="py-3 px-4">Reports</th>
                      <th className="py-3 px-4">Status & Lock</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                    {cases.map((modCase) => {
                      const reasonsText = Object.entries(modCase.reasonsSummary || {})
                        .map(([r, n]) => `${r} (${n})`)
                        .join(' · ');
                      const isOpen = modCase.status === 'pending' || modCase.status === 'reviewed';
                      const isClaimedByMe = modCase.claimedBy === currentUser?.uid;

                      const caseHighlighted = isHighlighted(modCase.id) || isHighlighted(modCase.targetId);
                      const caseNotifyId =
                        isHighlighted(modCase.targetId) && !isHighlighted(modCase.id)
                          ? modCase.targetId
                          : modCase.id;

                      return (
                        <tr
                          key={modCase.id}
                          data-notify-target-id={caseNotifyId}
                          className={`transition-colors ${
                            caseHighlighted
                              ? 'bg-red-50/70 dark:bg-red-950/30 ring-2 ring-inset ring-[#8B181B] dark:ring-rose-500'
                              : 'hover:bg-stone-50/70 dark:hover:bg-stone-800/40'
                          }`}
                        >
                          <td className="py-3.5 px-4 max-w-sm">
                            <div className="font-semibold text-stone-900 dark:text-white truncate">
                              {modCase.contentSnapshot.title || 'Alumni Post'}
                            </div>
                            <p className="text-stone-600 dark:text-stone-300 line-clamp-2 mt-0.5 leading-relaxed">
                              {modCase.contentSnapshot.content}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-stone-500 dark:text-stone-400 mt-1.5">
                              <button
                                type="button"
                                onClick={() => openProfile(modCase.postAuthorId)}
                                className="font-medium text-[#8B181B] dark:text-red-300 hover:underline cursor-pointer"
                              >
                                {modCase.postAuthorName}
                              </button>
                              <span aria-hidden="true">·</span>
                              <span title={formatFullLocalDateTime(modCase.createdAt)}>
                                {formatRelativeTime(modCase.createdAt)}
                              </span>
                              {modCase.contentEditedSinceSnapshot && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="font-semibold text-amber-700 dark:text-amber-400">
                                    Edited after report
                                  </span>
                                </>
                              )}
                              {modCase.autoHiddenPendingReview && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="font-semibold text-[#8B181B] dark:text-red-400">
                                    Auto-hidden
                                  </span>
                                </>
                              )}
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div>{renderPriorityBadge(modCase.highestPriority)}</div>
                            <div className="text-[11px] text-stone-500 dark:text-stone-400 mt-1">
                              {reasonsText || 'Community report'}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 tabular-nums font-mono font-semibold text-stone-800 dark:text-stone-200">
                            {modCase.reportCount}
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-stone-800 dark:text-stone-200">
                              {formatStatusLabel(modCase.status)}
                            </div>
                            {modCase.claimedByName && isOpen && (
                              <div className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                                Claimed by {modCase.claimedByName}
                              </div>
                            )}
                            {!modCase.canAct && modCase.conflictReason && (
                              <div className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
                                Conflict: read-only
                              </div>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                              {isOpen && modCase.canAct && !modCase.claimedBy && (
                                <button
                                  type="button"
                                  disabled={isMutatingCase}
                                  onClick={() => setPendingClaimCaseId(modCase.id)}
                                  className="inline-flex items-center gap-1 min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-800 dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-200 cursor-pointer whitespace-nowrap shrink-0"
                                >
                                  <Lock className="w-3 h-3" />
                                  <span>Claim</span>
                                </button>
                              )}
                              {isOpen && (isClaimedByMe || (isAdmin && modCase.claimedBy)) && (
                                <button
                                  type="button"
                                  disabled={isMutatingCase}
                                  onClick={() => void handleClaimOrRelease(modCase.id, 'release')}
                                  className="inline-flex items-center gap-1 min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-700 dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-300 cursor-pointer whitespace-nowrap shrink-0"
                                >
                                  <Unlock className="w-3 h-3" />
                                  <span>Release</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => void loadCaseDetail(modCase.id)}
                                className="inline-flex items-center gap-1 min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#8B181B] hover:bg-[#721316] text-white cursor-pointer whitespace-nowrap shrink-0"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Inspect</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <PaginationControl
              currentPage={casesPage}
              totalItems={casesTotal}
              pageSize={10}
              onPageChange={setCasesPage}
              itemLabel="cases"
            />
          </div>

          {/* Abuse Prevention: Abusive Reporters & Ban Review Flags */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-stone-900 dark:text-white">
                  Abusive Reporter Watchlist
                </h2>
                <span className="text-xs text-stone-500 dark:text-stone-400 tabular-nums">
                  {flaggedReporters.length} tracked
                </span>
              </div>

              {flaggedReporters.length === 0 ? (
                <p className="text-xs text-stone-500 dark:text-stone-400 py-4">
                  No reporters with consecutive dismissed reports or restrictions.
                </p>
              ) : (
                <div className="divide-y divide-stone-100 dark:divide-stone-800">
                  {flaggedReporters.slice(0, 8).map((rep) => (
                    <div key={rep.userId} className="py-3 flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <div className="font-semibold text-stone-900 dark:text-white truncate">
                          {rep.userName || rep.userId}
                        </div>
                        <div className="text-[11px] text-stone-500 dark:text-stone-400 tabular-nums mt-0.5">
                          {rep.consecutiveDismissedCount} consecutive dismissed · {rep.totalDismissedCount} total dismissed · {rep.totalReportsCount} reports
                          {rep.reportingRestricted && (
                            <span className="text-[#8B181B] dark:text-red-400 font-semibold"> · Reporting Restricted</span>
                          )}
                        </div>
                      </div>
                      {isAdmin && (
                        <button
                          type="button"
                          disabled={isMutatingCase}
                          onClick={() =>
                            void handleSanctionUser(
                              rep.userId,
                              rep.reportingRestricted ? 'unrestrict_reporting' : 'restrict_reporting',
                              rep.reportingRestricted
                                ? 'Reporting privilege restored by Administrator.'
                                : 'Restricted due to repeated unfounded reports.'
                            )
                          }
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
                            rep.reportingRestricted
                              ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                              : 'bg-stone-100 hover:bg-stone-200 text-stone-800 dark:bg-stone-800 dark:text-stone-200'
                          }`}
                        >
                          {rep.reportingRestricted ? 'Unrestrict' : 'Restrict Reporting'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {isAdmin && (
              <div className="bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-stone-900 dark:text-white">
                    Accounts Flagged for Ban Review
                  </h2>
                  <span className="text-xs text-stone-500 dark:text-stone-400 tabular-nums">
                    {banFlags.length} flagged
                  </span>
                </div>

                {banFlags.length === 0 ? (
                  <p className="text-xs text-stone-500 dark:text-stone-400 py-4">
                    No alumni accounts currently exceed the post-suspension warning ban threshold.
                  </p>
                ) : (
                  <div className="divide-y divide-stone-100 dark:divide-stone-800">
                    {banFlags.map((flag) => {
                      const matchedUser = users.find((u) => u.uid === flag.userId);
                      return (
                        <div key={flag.userId} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                          <div className="min-w-0">
                            <div className="font-semibold text-stone-900 dark:text-white">
                              {matchedUser?.name || flag.userId}
                            </div>
                            <div className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                              {flag.activeWarnings} active warnings · Flagged {formatRelativeTime(flag.flaggedAt)}
                            </div>
                            <p className="text-[11px] text-stone-600 dark:text-stone-300 mt-0.5">{flag.reason}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              disabled={isMutatingCase}
                              onClick={() => void handleSanctionUser(flag.userId, 'lift_sanction', 'Ban flag cleared by Administrator.')}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-800 dark:bg-stone-800 dark:text-stone-200 cursor-pointer whitespace-nowrap"
                            >
                              Lift Sanction
                            </button>
                            <button
                              type="button"
                              disabled={isMutatingCase}
                              onClick={() => void handleSanctionUser(flag.userId, 'ban', flag.reason)}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#8B181B] hover:bg-[#721316] text-white cursor-pointer whitespace-nowrap"
                            >
                              Permanent Ban
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 2: EMPLOYER ACCREDITATION QUEUE                               */}
      {/* ===================================================================== */}
      {activeSubTab === 'employers' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 rounded-2xl p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-400 border border-amber-200/70 dark:border-amber-900/50 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" strokeWidth={1.75} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-stone-900 dark:text-white tracking-tight">
                    Corporate Partner Accreditation Queue
                  </h2>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                    Automated domain health, WHOIS age, lookalike detection, and SEC Philippines registry diagnostics.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-stone-100 dark:border-stone-800">
              <button
                type="button"
                onClick={() => { setStatusFilter('needs_review'); setCurrentPage(1); }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer tabular-nums ${
                  statusFilter === 'needs_review'
                    ? 'bg-amber-600 text-white'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300'
                }`}
              >
                Needs Review ({employers.filter((e) => {
                  const rej = e.employerStatus === 'rejected' || e.employerVerificationStatus === 'rejected';
                  const app = !rej && (e.employerStatus === 'approved' || (e.employerVerificationStatus as string) === 'approved' || e.isVerified);
                  return !rej && !app;
                }).length})
              </button>
              <button
                type="button"
                onClick={() => { setStatusFilter('verified'); setCurrentPage(1); }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer tabular-nums ${
                  statusFilter === 'verified'
                    ? 'bg-emerald-700 text-white'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300'
                }`}
              >
                Accredited ({employers.filter((e) => {
                  const rej = e.employerStatus === 'rejected' || e.employerVerificationStatus === 'rejected';
                  return !rej && (e.isVerified || e.employerStatus === 'approved' || (e.employerVerificationStatus as string) === 'approved');
                }).length})
              </button>
              <button
                type="button"
                onClick={() => { setStatusFilter('rejected'); setCurrentPage(1); }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer tabular-nums ${
                  statusFilter === 'rejected'
                    ? 'bg-[#8B181B] text-white'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300'
                }`}
              >
                Rejected ({employers.filter((e) => e.employerStatus === 'rejected' || e.employerVerificationStatus === 'rejected').length})
              </button>
              <button
                type="button"
                onClick={() => { setStatusFilter('all'); setCurrentPage(1); }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer tabular-nums ${
                  statusFilter === 'all'
                    ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300'
                }`}
              >
                All ({employers.length})
              </button>

              <div className="relative flex-1 min-w-[200px] ml-auto">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  placeholder="Search legal name, domain, email..."
                  className="w-full pl-9 pr-3 py-2 text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 placeholder:text-stone-400"
                />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-stone-500" />
                <h3 className="text-sm font-bold text-stone-900 dark:text-white">
                  Employer Verification Applications ({filteredEmployers.length})
                </h3>
              </div>
              <span className="text-xs text-stone-500 tabular-nums">
                Page {currentPage} of {employerTotalPages}
              </span>
            </div>

            {employersLoading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 rounded-xl bg-stone-100 dark:bg-stone-800 animate-pulse" />
                ))}
              </div>
            ) : employersError ? (
              <div className="p-8 text-center space-y-3">
                <p className="text-xs text-[#8B181B] dark:text-red-300 font-medium">
                  Failed to load, retry — {employersError}
                </p>
                <button
                  type="button"
                  onClick={() => void fetchEmployerQueue()}
                  className="inline-flex items-center gap-1.5 min-h-[38px] px-4 py-2 rounded-xl text-xs font-semibold bg-[#8B181B] hover:bg-[#721316] text-white cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry</span>
                </button>
              </div>
            ) : paginatedEmployers.length === 0 ? (
              <div className="p-12 text-center text-xs text-stone-500 dark:text-stone-400">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500 opacity-60" />
                No employer applications matching the selected filter.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-stone-50 dark:bg-stone-850 border-b border-stone-200/80 dark:border-stone-800 text-stone-500 font-semibold text-[11px]">
                      <th className="py-3 px-4">Company Details</th>
                      <th className="py-3 px-4">Work Email & Domain</th>
                      <th className="py-3 px-4">Automated Diagnostic</th>
                      <th className="py-3 px-4">Registry Status</th>
                      <th className="py-3 px-4 text-right">Moderator Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                    {paginatedEmployers.map((emp) => {
                      const isRejected =
                        emp.employerStatus === 'rejected' || emp.employerVerificationStatus === 'rejected';
                      const isApproved =
                        !isRejected &&
                        (emp.employerStatus === 'approved' ||
                          (emp.employerVerificationStatus as string) === 'approved' ||
                          emp.isVerified);
                      const domain = (emp.companyWebsite || '').replace(/^[a-z]+:\/\//, '').split('/')[0];
                      const emailDomain = (emp.email || '').split('@')[1] || '';
                      const domainMatches =
                        domain && emailDomain && (domain.includes(emailDomain) || emailDomain.includes(domain));

                      return (
                        <tr
                          key={emp.uid}
                          data-notify-target-id={emp.uid}
                          className={`transition-colors ${
                            isHighlighted(emp.uid)
                              ? 'bg-red-50/70 dark:bg-red-950/30 ring-2 ring-inset ring-[#8B181B] dark:ring-rose-500'
                              : 'hover:bg-stone-50/70 dark:hover:bg-stone-800/40'
                          }`}
                        >
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-stone-900 dark:text-white">
                              {emp.companyName || emp.company || emp.name}
                            </div>
                            <div className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center gap-1.5 mt-0.5">
                              <span>Contact: {emp.name}</span>
                              <span aria-hidden="true">·</span>
                              <span>{emp.companyIndustry || 'Corporate Partner'}</span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="font-medium text-stone-800 dark:text-stone-200">{emp.email}</div>
                            <div className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center gap-1 mt-0.5">
                              <Globe className="w-3 h-3 text-stone-400" />
                              <a
                                href={emp.companyWebsite?.startsWith('http') ? emp.companyWebsite : `https://${emp.companyWebsite}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-[#8B181B] hover:underline flex items-center gap-0.5"
                              >
                                <span>{domain || 'No website provided'}</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1.5 text-[11px]">
                                {domainMatches ? (
                                  <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Domain Match
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 font-semibold">
                                    <AlertTriangle className="w-3 h-3" />
                                    Domain Discrepancy
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-stone-500 dark:text-stone-400">
                                RDAP Age: &gt; 90 days · HTTP 200 OK
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            {isApproved ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                                <BadgeCheck className="w-3.5 h-3.5" />
                                Accredited
                              </span>
                            ) : isRejected ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#8B181B] dark:text-red-400">
                                <Ban className="w-3.5 h-3.5" />
                                Rejected
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
                                <Clock className="w-3.5 h-3.5" />
                                Needs Review
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              {!isApproved && (
                                <button
                                  type="button"
                                  onClick={() => setActionModal({ type: 'approve', employer: emp })}
                                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer"
                                >
                                  Approve
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setActionModal({ type: 'request_docs', employer: emp })}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300 transition-colors cursor-pointer"
                              >
                                Request Docs
                              </button>
                              {!isRejected && (
                                <button
                                  type="button"
                                  onClick={() => setActionModal({ type: 'reject', employer: emp })}
                                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-red-50 hover:bg-red-100 text-[#8B181B] border border-red-200 dark:bg-red-950/30 dark:border-red-900/40 dark:text-red-300 transition-colors cursor-pointer"
                                >
                                  Reject
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="p-4 border-t border-stone-100 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-850/40">
              <PaginationControl
                currentPage={currentPage}
                totalItems={filteredEmployers.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
              />
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* CASE DETAIL INSPECTION & ACTION MODAL                                 */}
      {/* ===================================================================== */}
      {selectedCaseId && (
        <div className="fixed inset-0 z-[75] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 z-10 bg-white/95 dark:bg-stone-900/95 backdrop-blur-sm px-6 py-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-stone-900 dark:text-white">
                  Moderation Case Inspection
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 font-mono">
                  {selectedCaseId}
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setSelectedCaseId(null); setCaseDetail(null); }}
                aria-label="Close case inspection"
                className="p-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {detailLoading ? (
                <div className="space-y-4">
                  <div className="h-32 rounded-xl bg-stone-100 dark:bg-stone-800 animate-pulse" />
                  <div className="h-24 rounded-xl bg-stone-100 dark:bg-stone-800 animate-pulse" />
                </div>
              ) : detailError ? (
                <div className="p-6 text-center border border-red-200 dark:border-red-900/50 rounded-xl space-y-3">
                  <p className="text-xs text-[#8B181B] dark:text-red-300">Failed to load, retry — {detailError}</p>
                  <button
                    type="button"
                    onClick={() => void loadCaseDetail(selectedCaseId)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#8B181B] text-white cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              ) : caseDetail ? (
                <>
                  {/* Conflict-of-Interest Banner */}
                  {!caseDetail.canAct && (
                    <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{caseDetail.conflictReason || 'Conflict of interest: you cannot act on this case.'}</span>
                    </div>
                  )}

                  {/* Author Summary & Active Warnings */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200/80 dark:border-stone-800 text-xs">
                    <div>
                      <div className="font-bold text-stone-900 dark:text-white flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openProfile(caseDetail.case.postAuthorId)}
                          className="hover:text-[#8B181B] hover:underline cursor-pointer"
                        >
                          {caseDetail.case.postAuthorName}
                        </button>
                        <span className="text-stone-400">·</span>
                        <span className="font-medium text-stone-500 capitalize">{caseDetail.case.postAuthorRole}</span>
                      </div>
                      <div className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5 tabular-nums">
                        {caseDetail.activeWarningsCount} active warnings · {caseDetail.authorWarningHistory.length} total warnings · Case status: {formatStatusLabel(caseDetail.case.status)}
                        {caseDetail.case.claimedByName && (caseDetail.case.status === 'pending' || caseDetail.case.status === 'reviewed') && (
                          <> · Claimed by {caseDetail.case.claimedByName}</>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {caseDetail.canAct && (caseDetail.case.status === 'pending' || caseDetail.case.status === 'reviewed') && !caseDetail.case.claimedBy && (
                        <button
                          type="button"
                          disabled={isMutatingCase}
                          onClick={() => setPendingClaimCaseId(caseDetail.case.id)}
                          className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-stone-200 hover:bg-stone-300 text-stone-800 dark:bg-stone-700 dark:text-stone-100 cursor-pointer"
                        >
                          Claim Case
                        </button>
                      )}
                      {(caseDetail.case.status === 'pending' || caseDetail.case.status === 'reviewed') &&
                        (caseDetail.case.claimedBy === currentUser?.uid || (isAdmin && Boolean(caseDetail.case.claimedBy))) && (
                          <button
                            type="button"
                            disabled={isMutatingCase}
                            onClick={() => void handleClaimOrRelease(caseDetail.case.id, 'release')}
                            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-stone-200 hover:bg-stone-300 text-stone-800 dark:bg-stone-700 dark:text-stone-100 cursor-pointer"
                          >
                            Release Lock
                          </button>
                        )}
                      {caseDetail.livePost?.isSoftDeleted && (isAdmin || caseDetail.canAct) && (
                        <button
                          type="button"
                          disabled={isMutatingCase}
                          onClick={() => void handleRestorePost()}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Restore Post</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Snapshot vs Current Live Content Diff */}
                  <div className={`grid gap-4 ${caseDetail.case.contentEditedSinceSnapshot ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                    <div className="border border-stone-200 dark:border-stone-800 rounded-xl p-4 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-stone-900 dark:text-white">
                          Original Reported Snapshot
                        </span>
                        <span className="text-[11px] text-stone-500">
                          Captured {formatRelativeTime(caseDetail.case.contentSnapshot.capturedAt)}
                        </span>
                      </div>
                      <div className="text-sm font-semibold text-stone-900 dark:text-white">
                        {caseDetail.case.contentSnapshot.title}
                      </div>
                      <p className="text-xs text-stone-700 dark:text-stone-300 whitespace-pre-wrap leading-relaxed">
                        {caseDetail.case.contentSnapshot.content}
                      </p>
                    </div>

                    {caseDetail.case.contentEditedSinceSnapshot && (
                      <div className="border border-amber-300 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20 rounded-xl p-4 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-amber-800 dark:text-amber-300">
                            Current Post (Edited After Report)
                          </span>
                          <span className="text-[11px] text-amber-700 dark:text-amber-400">
                            {caseDetail.livePost?.updatedAt ? `Edited ${formatRelativeTime(caseDetail.livePost.updatedAt)}` : 'Modified'}
                          </span>
                        </div>
                        <div className="text-sm font-semibold text-stone-900 dark:text-white">
                          {caseDetail.livePost?.title || caseDetail.case.currentContent?.title}
                        </div>
                        <p className="text-xs text-stone-700 dark:text-stone-300 whitespace-pre-wrap leading-relaxed">
                          {caseDetail.livePost?.content || caseDetail.case.currentContent?.content}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Individual Reports (Moderator/Admin Confidential) */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-stone-900 dark:text-white">
                      Submitted Reports ({caseDetail.reports.length})
                    </h4>
                    <div className="divide-y divide-stone-100 dark:divide-stone-800 border border-stone-200 dark:border-stone-800 rounded-xl">
                      {caseDetail.reports.map((rep) => (
                        <div key={rep.id} className="p-3.5 text-xs space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-stone-900 dark:text-white">
                              {rep.reporterName} <span className="font-normal text-stone-500">({rep.reporterRole})</span>
                            </span>
                            <span className="text-[11px] text-stone-500">
                              {rep.reason} · {formatRelativeTime(rep.createdAt)}
                            </span>
                          </div>
                          {rep.details && (
                            <p className="text-stone-600 dark:text-stone-300">{rep.details}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Moderator Decision Controls */}
                  {caseDetail.canAct && (caseDetail.case.status === 'pending' || caseDetail.case.status === 'reviewed') && (
                    <div className="border border-stone-200 dark:border-stone-800 rounded-xl p-5 space-y-4">
                      <h4 className="text-xs font-bold text-stone-900 dark:text-white">
                        Moderator Action
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="block font-semibold text-stone-700 dark:text-stone-300 mb-1">
                            Policy Reason
                          </label>
                          <select
                            value={actionReason}
                            onChange={(e) => setActionReason(e.target.value)}
                            className="w-full min-h-[40px] px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100"
                          >
                            {POST_REPORT_REASONS.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold text-stone-700 dark:text-stone-300 mb-1">
                            Internal Moderator Note (Optional)
                          </label>
                          <input
                            type="text"
                            value={actionNote}
                            onChange={(e) => setActionNote(e.target.value)}
                            placeholder="Internal context (never shown to alumni)..."
                            className="w-full min-h-[40px] px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block font-semibold text-stone-700 dark:text-stone-300 mb-1">
                            Message to Author (Required for Warnings)
                          </label>
                          <textarea
                            rows={2}
                            value={actionMessage}
                            onChange={(e) => setActionMessage(e.target.value)}
                            placeholder="Explain clearly why the post violates community standards..."
                            className="w-full p-3 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100"
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          disabled={isMutatingCase}
                          onClick={() => void handleActOnCase('dismiss')}
                          className="inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 rounded-xl text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-800 dark:bg-stone-800 dark:text-stone-200 cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Dismiss (No Violation)</span>
                        </button>
                        <button
                          type="button"
                          disabled={isMutatingCase}
                          onClick={() => void handleActOnCase('warn')}
                          className="inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
                        >
                          <MessageSquareWarning className="w-3.5 h-3.5" />
                          <span>Warn Author</span>
                        </button>
                        <button
                          type="button"
                          disabled={isMutatingCase}
                          onClick={() => void handleActOnCase('delete_post')}
                          className="inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 rounded-xl text-xs font-semibold bg-[#8B181B] hover:bg-[#721316] text-white cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove Post</span>
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* EMPLOYER CONFIRMATION & ACTION MODALS                                 */}
      {/* ===================================================================== */}
      {actionModal?.type === 'approve' && (
        <ConfirmationModal
          isOpen={true}
          onClose={() => !isMutatingEmployer && setActionModal(null)}
          onConfirm={() => void handleApproveEmployer(actionModal.employer)}
          title="Accredit Corporate Partner"
          message={`Are you sure you want to approve "${actionModal.employer.companyName || actionModal.employer.name}"? This activates their employer posting tier and dispatches an official institutional accreditation email.`}
          confirmLabel={isMutatingEmployer ? 'Accrediting...' : 'Accredit & Dispatch Email'}
          cancelLabel="Cancel"
          variant="info"
        />
      )}

      {actionModal?.type === 'reject' && (
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-stone-900 dark:text-white">
              Reject Application with Preset Reason
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Select or customize the explainable reason template sent to the employer:
            </p>
            <select
              value={presetRejectReason}
              onChange={(e) => setPresetRejectReason(e.target.value)}
              className="w-full p-2.5 text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100"
            >
              <option value="Corporate legal name could not be validated against official SEC Philippines registry.">
                SEC Registry Mismatch / Not Found
              </option>
              <option value="Work email domain does not match or belong to the registered company website.">
                Email & Website Domain Discrepancy
              </option>
              <option value="Organization website domain is newly registered (<90 days) and lacks verifiable enterprise presence.">
                New Domain (&lt;90 days) / Unverifiable Presence
              </option>
              <option value="Application flagged for prohibited recruitment practices or upfront fee solicitations.">
                Policy Violation / Prohibited Practice
              </option>
            </select>
            <textarea
              rows={3}
              value={presetRejectReason}
              onChange={(e) => setPresetRejectReason(e.target.value)}
              className="w-full p-2.5 text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isMutatingEmployer}
                onClick={() => setActionModal(null)}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isMutatingEmployer}
                onClick={() => void handleRejectEmployer(actionModal.employer)}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-[#8B181B] hover:bg-[#721316] text-white cursor-pointer disabled:opacity-50"
              >
                {isMutatingEmployer ? 'Submitting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {actionModal?.type === 'request_docs' && (
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-stone-900 dark:text-white">
              Request Supplemental Corporate Documents
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Dispatches an institutional notice to the applicant requesting official business verification files:
            </p>
            <textarea
              rows={3}
              value={docRequestNote}
              onChange={(e) => setDocRequestNote(e.target.value)}
              className="w-full p-2.5 text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isMutatingEmployer}
                onClick={() => setActionModal(null)}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isMutatingEmployer}
                onClick={() => void handleRequestDocs(actionModal.employer)}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-amber-600 hover:bg-amber-700 text-white cursor-pointer disabled:opacity-50"
              >
                {isMutatingEmployer ? 'Sending...' : 'Send Document Request'}
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmationModal
        isOpen={Boolean(pendingClaimCaseId)}
        onClose={() => {
          if (!isMutatingCase) {
            setPendingClaimCaseId(null);
          }
        }}
        onConfirm={() => void handleConfirmClaim()}
        title="Claim Moderation Case"
        message="Are you sure you want to claim this moderation case?"
        confirmLabel="Yes, Claim"
        cancelLabel="No, Cancel"
        variant="warning"
        isProcessing={isMutatingCase}
      />
    </div>
  );
};
