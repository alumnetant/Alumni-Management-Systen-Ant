/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  AlertTriangle,
  Users,
  Building2,
  Briefcase,
  Check,
  X,
  Eye,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Sparkles,
  RefreshCw,
  ArrowRight,
  ShieldAlert,
  FileCheck2,
  HelpCircle,
  ExternalLink,
  Search,
  School,
  User,
  GraduationCap,
  MapPin,
  DollarSign,
  FileText
} from 'lucide-react';
import { useAlumni } from '../../context/AlumniContext';
import { UserProfile } from '../../types';
import { validateRejectionReason } from '../../lib/employerValidation';
import { EmployerVerificationModal } from './EmployerVerificationModal';
import {
  analyzeUserRegistryIntegrity,
  RegistryDiscrepancyAnalysis
} from '../../services/governanceLogicService';

interface AdminRequestsInboxProps {
  onSwitchToConflicts?: () => void;
  viewMode?: 'alumni' | 'employers' | 'jobs' | 'all';
  showHeader?: boolean;
}

export const AdminRequestsInbox: React.FC<AdminRequestsInboxProps> = ({
  onSwitchToConflicts,
  viewMode = 'all',
  showHeader = false
}) => {
  const {
    users,
    opportunities,
    setUserVerified,
    updateAlumniProfile,
    approveOpportunity,
    rejectOpportunity,
    verifyEmployer,
    setSelectedUserIdForModal,
    showToast,
    addAuditLog
  } = useAlumni();

  const [activeFilter, setActiveFilter] = useState<'all' | 'perfect' | 'discrepancies' | 'employers' | 'jobs'>('all');
  const [reconciling, setReconciling] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleAlumniCount, setVisibleAlumniCount] = useState<number>(10);

  // Employer rejection and audit states
  const [rejectingEmployer, setRejectingEmployer] = useState<UserProfile | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');
  const [rejectionError, setRejectionError] = useState<string | null>(null);
  const [auditEmployer, setAuditEmployer] = useState<UserProfile | null>(null);

  const handleOpenRejectModal = (emp: UserProfile) => {
    setRejectingEmployer(emp);
    setRejectionReasonInput('Corporate verification failed: registration documentation could not be validated with regulatory authorities.');
    setRejectionError(null);
  };

  const handleConfirmEmployerReject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingEmployer) return;
    const validation = validateRejectionReason(rejectionReasonInput);
    if (!validation.valid) {
      setRejectionError(validation.error || 'Rejection reason is invalid.');
      return;
    }
    verifyEmployer(rejectingEmployer.uid, 'rejected', validation.trimmed);
    showToast(`Rejected accreditation for ${rejectingEmployer.company || rejectingEmployer.name}`, 'info');
    setRejectingEmployer(null);
    setRejectionReasonInput('');
    setRejectionError(null);
  };

  // Alumni proof inspection & decline states
  const [viewingProof, setViewingProof] = useState<{
    uid: string;
    userName: string;
    name: string;
    url: string;
    notes?: string;
  } | null>(null);
  const [decliningAlumni, setDecliningAlumni] = useState<UserProfile | null>(null);
  const [declineReason, setDeclineReason] = useState('');

  const handleConfirmDeclineAlumni = (e: React.FormEvent) => {
    e.preventDefault();
    if (!decliningAlumni) return;
    const reason =
      declineReason.trim() ||
      'Submitted documentation was insufficient or could not be validated with registrar archives.';
    updateAlumniProfile(decliningAlumni.uid, {
      verificationStatus: 'rejected',
      verificationFlagReason: reason
    });
    showToast(`Verification declined for ${decliningAlumni.name}.`, 'info');
    setDecliningAlumni(null);
    setDeclineReason('');
  };

  // Sync activeFilter with viewMode prop when viewMode changes
  useEffect(() => {
    setVisibleAlumniCount(10);
    if (viewMode === 'alumni') setActiveFilter('all');
    else if (viewMode === 'employers') setActiveFilter('employers');
    else if (viewMode === 'jobs') setActiveFilter('jobs');
    else setActiveFilter('all');
  }, [viewMode]);

  // Compute pending items
  const pendingUsers = useMemo(() => users.filter((u) => !u.isVerified && u.role === 'alumni'), [users]);
  const pendingEmployers = useMemo(
    () => users.filter((u) => u.role === 'employer' && u.employerVerificationStatus === 'pending_verification'),
    [users]
  );
  const pendingJobs = useMemo(
    () => (opportunities || []).filter((o) => o.approvalStatus === 'pending_approval'),
    [opportunities]
  );

  // Run high-logic registry analysis across all pending alumni
  const userAnalyses: RegistryDiscrepancyAnalysis[] = useMemo(() => {
    return pendingUsers.map((u) => analyzeUserRegistryIntegrity(u, users));
  }, [pendingUsers, users]);

  const perfectMatchAnalyses = useMemo(
    () => userAnalyses.filter((a) => a.status === 'PERFECT_MATCH'),
    [userAnalyses]
  );

  const discrepancyAnalyses = useMemo(
    () => userAnalyses.filter((a) => a.status !== 'PERFECT_MATCH'),
    [userAnalyses]
  );

  const totalPending = pendingUsers.length + pendingEmployers.length + pendingJobs.length;

  // High-Logic Smart Auto-Reconciliation Engine
  const handleSmartAutoReconcile = async () => {
    if (perfectMatchAnalyses.length === 0) {
      showToast('No 100% Registrar-matched records found for auto-reconciliation.', 'info');
      return;
    }

    setReconciling(true);
    const approvedCount = perfectMatchAnalyses.length;
    const quarantinedCount = discrepancyAnalyses.length;

    try {
      for (const item of perfectMatchAnalyses) {
        setUserVerified(item.userId, true);
      }

      addAuditLog({
        action: 'SMART_GOVERNANCE_AUTO_RECONCILE',
        actorId: 'governance_intelligence_engine',
        actorName: 'Registrar Governance Engine',
        actorRole: 'admin',
        category: 'alumni_verification',
        details: `Smart Governance Auto-Reconciliation: Verified ${approvedCount} alumni with 100% Registrar archive alignment. Quarantined ${quarantinedCount} discrepancies for manual inspection.`,
        severity: 'success'
      });

      showToast(
        `Auto-reconciled ${approvedCount} verified graduates! ${quarantinedCount} accounts with discrepancies kept in review.`,
        'success'
      );
    } finally {
      setReconciling(false);
    }
  };

  // 1-Click Sync to Registrar Transcript & Verify
  const handleSyncToRegistrarAndVerify = (analysis: RegistryDiscrepancyAnalysis) => {
    const reg = analysis.registryRecord;
    if (!reg) {
      setUserVerified(analysis.userId, true);
      return;
    }

    // Synchronize degree & batch to official registrar records
    updateAlumniProfile(analysis.userId, {
      course: reg.course,
      batch: reg.batchYear || analysis.user.batch
    });

    setUserVerified(analysis.userId, true);

    addAuditLog({
      action: 'REGISTRAR_TRANSCRIPT_SYNC_VERIFY',
      actorId: 'governance_officer',
      actorName: 'Registrar Governance Officer',
      actorRole: 'admin',
      category: 'alumni_verification',
      details: `Corrected declared course for ${analysis.user.name} to official Registrar record (${reg.course}, Batch ${reg.batchYear}) and granted verified status.`,
      severity: 'info'
    });

    showToast(`Synced ${analysis.user.name}'s records with Registrar archive and verified!`, 'success');
  };

  const showAlumniList = viewMode === 'all' || viewMode === 'alumni';
  const showEmployerList = viewMode === 'all' || viewMode === 'employers';
  const showJobList = viewMode === 'all' || viewMode === 'jobs';

  return (
    <div className="space-y-4">
      {/* Sub-Header & Controls Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200/90 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-stone-900">
                {viewMode === 'alumni'
                  ? 'Alumni Identity Verification & Discrepancies'
                  : viewMode === 'employers'
                  ? 'Corporate Partner Accreditations'
                  : viewMode === 'jobs'
                  ? 'Career Opportunity Moderation'
                  : 'Intake & Moderation Queue'}
              </h3>
              <span className="font-mono tabular-nums text-xs text-stone-500">
                {viewMode === 'alumni'
                  ? `${pendingUsers.length} in queue`
                  : viewMode === 'employers'
                  ? `${pendingEmployers.length} in queue`
                  : viewMode === 'jobs'
                  ? `${pendingJobs.length} in queue`
                  : `${totalPending} total`}
              </span>
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              {viewMode === 'alumni'
                ? 'Automated comparison against St. Cecilia\'s College Registrar archives. Highlights name, degree, and Student ID variances.'
                : viewMode === 'employers'
                ? 'Review corporate partner registrations, corporate liaisons, and industry hiring accreditations.'
                : viewMode === 'jobs'
                ? 'Review and moderate job opportunities before publication to the student & alumni career exchange.'
                : 'Centralized intake queue for alumni, corporate partners, and career opportunities.'}
            </p>
          </div>

          {/* High-Logic Auto-Reconcile Action (When viewing alumni) */}
          {showAlumniList && perfectMatchAnalyses.length > 0 && (
            <button
              type="button"
              onClick={handleSmartAutoReconcile}
              disabled={reconciling}
              className="px-3.5 py-2 bg-[#8B181B] hover:bg-[#721316] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5 self-start sm:self-auto disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>
                {reconciling
                  ? 'Reconciling...'
                  : `1-Click Auto-Reconcile (${perfectMatchAnalyses.length} Flawless Matches)`}
              </span>
            </button>
          )}
        </div>

        {/* Filter Navigation Tabs (Only when in alumni or all mode) */}
        {showAlumniList && viewMode === 'alumni' && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-stone-100">
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeFilter === 'all'
                    ? 'bg-stone-900 text-white'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
                }`}
              >
                All Alumni ({pendingUsers.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveFilter('perfect')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeFilter === 'perfect'
                    ? 'bg-emerald-700 text-white'
                    : 'text-stone-600 hover:text-emerald-700 hover:bg-emerald-50'
                }`}
              >
                <CheckCircle2 className="w-3 h-3" />
                <span>100% Matches ({perfectMatchAnalyses.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveFilter('discrepancies')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeFilter === 'discrepancies'
                    ? 'bg-amber-700 text-white'
                    : 'text-stone-600 hover:text-amber-700 hover:bg-amber-50'
                }`}
              >
                <AlertTriangle className="w-3 h-3" />
                <span>Quarantined Discrepancies ({discrepancyAnalyses.length})</span>
              </button>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search pending applicant..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-lg text-stone-900 placeholder:text-stone-400 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-[#8B181B]/30"
              />
            </div>
          </div>
        )}
      </div>

      {/* Main Content List */}
      <div className="space-y-3.5">
        {/* Empty States */}
        {((viewMode === 'alumni' && pendingUsers.length === 0) ||
          (viewMode === 'employers' && pendingEmployers.length === 0) ||
          (viewMode === 'jobs' && pendingJobs.length === 0) ||
          (viewMode === 'all' && totalPending === 0)) ? (
          <div className="bg-white rounded-2xl border border-stone-200/90 p-12 text-center shadow-2xs">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-stone-900">Queue Completely Cleared</h3>
            <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
              No items currently require administrator review in this department.
            </p>
          </div>
        ) : (
          <>
            {/* 1. Alumni Registrations with Forensic Discrepancy Cards */}
            {showAlumniList && (() => {
              const filteredList = userAnalyses.filter((analysis) => {
                if (activeFilter === 'perfect') return analysis.status === 'PERFECT_MATCH';
                if (activeFilter === 'discrepancies') return analysis.status !== 'PERFECT_MATCH';
                if (searchQuery.trim()) {
                  const q = searchQuery.toLowerCase().trim();
                  return (
                    analysis.user.name.toLowerCase().includes(q) ||
                    analysis.user.email.toLowerCase().includes(q) ||
                    (analysis.user.studentId && analysis.user.studentId.toLowerCase().includes(q))
                  );
                }
                return true;
              });

              if (filteredList.length === 0) {
                return (
                  <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center text-xs text-stone-500">
                    No alumni records match the active filter or search query.
                  </div>
                );
              }

              return (
                <div className="space-y-3">
                  {filteredList.slice(0, visibleAlumniCount).map((analysis) => {
                    const u = analysis.user;
                    const reg = analysis.registryRecord;
                    const isPerfect = analysis.status === 'PERFECT_MATCH';
                    const isDegreeDiscrepancy = analysis.status === 'DEGREE_DISCREPANCY';
                    const isCollision = analysis.status === 'COLLISION_RISK';

                    return (
                      <div
                        key={u.uid}
                        className={`bg-white rounded-2xl border transition-all shadow-2xs overflow-hidden ${
                          isPerfect
                            ? 'border-emerald-200 hover:border-emerald-300'
                            : isCollision
                            ? 'border-red-200 hover:border-red-300'
                            : 'border-amber-200 hover:border-amber-300'
                        }`}
                      >
                        {/* Header Bar */}
                        <div className="p-4 sm:p-4.5 bg-stone-50/70 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                isPerfect
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {isPerfect ? <FileCheck2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                            </div>

                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-sm text-stone-900">{u.name}</span>
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                    isPerfect
                                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                      : 'bg-amber-50 text-amber-800 border-amber-200'
                                  }`}
                                >
                                  {isPerfect
                                    ? '100% Registrar Archive Match'
                                    : isDegreeDiscrepancy
                                    ? 'Degree Title Discrepancy'
                                    : 'Quarantined Discrepancy'}
                                </span>
                              </div>

                              <div className="text-[11px] text-stone-500 mt-0.5 flex items-center gap-2">
                                <span className="font-mono">{u.email}</span>
                                <span className="text-stone-300">·</span>
                                <span className="font-mono tabular-nums font-semibold text-stone-700">
                                  ID: {u.studentId || 'None'}
                                </span>
                                <span className="text-stone-300">·</span>
                                <span>Cohort: Class of {u.batch || 'N/A'}</span>
                              </div>
                            </div>
                          </div>

                          {/* Quick Actions */}
                          <div className="flex items-center gap-2 self-start sm:self-auto">
                            {isPerfect ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setUserVerified(u.uid, true);
                                  showToast(`✓ Verified ${u.name}!`, 'success');
                                }}
                                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Approve Verified</span>
                              </button>
                            ) : reg ? (
                              <button
                                type="button"
                                onClick={() => handleSyncToRegistrarAndVerify(analysis)}
                                className="px-3.5 py-1.5 bg-[#8B181B] hover:bg-[#721316] text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                                title="Align degree with official transcript and approve"
                              >
                                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                                <span>Sync to Transcript & Approve</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setUserVerified(u.uid, true);
                                  showToast(`Approved ${u.name} via manual override`, 'info');
                                }}
                                className="px-3.5 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                              >
                                Manual Approve
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => setSelectedUserIdForModal(u.uid)}
                              className="px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                            >
                              Profile
                            </button>
                          </div>
                        </div>

                        {/* Side-by-Side Comparison */}
                        <div className="p-4 sm:p-5 space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
                            {/* Left: Applicant Self-Declared */}
                            <div className="bg-stone-50 p-3.5 rounded-xl border border-stone-200 space-y-1.5">
                              <div className="flex items-center justify-between pb-1.5 border-b border-stone-200">
                                <span className="font-bold text-stone-900 text-[11px] uppercase tracking-wider">
                                  Applicant Claim
                                </span>
                                <span className="text-[10px] text-stone-500">Declared at Sign-Up</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-stone-500">Student ID:</span>
                                <span className="font-mono font-bold text-stone-900">{u.studentId || 'None'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-stone-500">Full Name:</span>
                                <span className="font-medium text-stone-900">{u.name}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-stone-500">Degree Claim:</span>
                                <span className={`font-medium text-right ${isDegreeDiscrepancy ? 'text-amber-800 font-bold' : 'text-stone-800'}`}>
                                  {u.course || 'Unspecified'}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-stone-500">Cohort:</span>
                                <span className="font-medium text-stone-900">Class of {u.batch || 'N/A'}</span>
                              </div>
                            </div>

                            {/* Right: Official Registrar Master Archive */}
                            <div
                              className={`p-3.5 rounded-xl border space-y-1.5 ${
                                isPerfect
                                  ? 'bg-emerald-50/50 border-emerald-200'
                                  : reg
                                  ? 'bg-amber-50/50 border-amber-200'
                                  : 'bg-red-50/50 border-red-200'
                              }`}
                            >
                              <div className="flex items-center justify-between pb-1.5 border-b border-stone-200/60">
                                <span className="font-bold text-stone-900 text-[11px] uppercase tracking-wider">
                                  Official Registrar Archive
                                </span>
                                <span className="text-[10px] font-bold text-emerald-700">Official Diploma Roll</span>
                              </div>

                              {reg ? (
                                <>
                                  <div className="flex justify-between">
                                    <span className="text-stone-500">Official Student ID:</span>
                                    <span className="font-mono font-bold text-emerald-800">{reg.studentId}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-stone-500">Archived Name:</span>
                                    <span className="font-bold text-stone-900">{reg.fullName}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-stone-500">Accredited Program:</span>
                                    <span className="font-bold text-emerald-900 text-right">{reg.course}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-stone-500">Accredited Batch:</span>
                                    <span className="font-medium text-stone-900">Class of {reg.batchYear}</span>
                                  </div>
                                </>
                              ) : (
                                <div className="py-3 text-center">
                                  <ShieldAlert className="w-5 h-5 text-red-600 mx-auto mb-1" />
                                  <p className="font-bold text-red-900 text-xs">No Registrar Record Found</p>
                                  <p className="text-[11px] text-red-700">
                                    Student ID '{u.studentId}' was not located in the masterlist archive.
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Discrepancy details callout if present */}
                          {!isPerfect && analysis.discrepancyDetails.length > 0 && (
                            <div className="bg-amber-50 p-2.5 rounded-lg border border-amber-200/80 text-[11px] text-amber-900 flex items-center gap-2">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                              <span>{analysis.discrepancyDetails[0]}</span>
                            </div>
                          )}

                          {/* Formal Proof & Verification Request Banner */}
                          {(u.verificationProofUrl || u.verificationStatus === 'pending_review' || u.verificationNotes) && (
                            <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 text-xs font-bold text-stone-900">
                                  <FileText className="w-3.5 h-3.5 text-[#8B181B]" />
                                  <span>Submitted Proof of Graduation</span>
                                </div>
                                <span className="text-[10px] font-semibold text-stone-500">
                                  {u.verificationSubmittedAt
                                    ? new Date(u.verificationSubmittedAt).toLocaleDateString()
                                    : 'Awaiting Inspection'}
                                </span>
                              </div>
                              {u.verificationNotes && (
                                <p className="text-xs text-stone-600 bg-white p-2 rounded-lg border border-stone-100 italic">
                                  "{u.verificationNotes}"
                                </p>
                              )}
                              <div className="flex items-center gap-2 pt-0.5">
                                {u.verificationProofUrl && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setViewingProof({
                                        uid: u.uid,
                                        userName: u.name,
                                        name: u.verificationProofName || 'Graduation Proof Document',
                                        url: u.verificationProofUrl!,
                                        notes: u.verificationNotes
                                      })
                                    }
                                    className="px-2.5 py-1 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                                  >
                                    <Eye className="w-3 h-3" />
                                    <span>Inspect Proof Document</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setDecliningAlumni(u)}
                                  className="px-2.5 py-1 bg-white hover:bg-stone-100 text-stone-700 border border-stone-200 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                                >
                                  Decline / Clarify
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Progressive Pagination */}
                  {filteredList.length > visibleAlumniCount && (
                    <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-center">
                      <button
                        type="button"
                        onClick={() => setVisibleAlumniCount((prev) => prev + 15)}
                        className="text-xs font-bold text-[#8B181B] hover:underline cursor-pointer"
                      >
                        Load More Applicants (+15)
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* 2. Employer Accreditations */}
            {showEmployerList && (
              <div className="space-y-3">
                {pendingEmployers.map((emp) => (
                  <div
                    key={emp.uid}
                    className="bg-white rounded-2xl border border-stone-200/90 p-4 sm:p-5 shadow-2xs space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center shrink-0">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-stone-900">
                              {emp.company || emp.name}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
                              Corporate Partner Accreditation
                            </span>
                          </div>
                          <div className="text-[11px] text-stone-500 mt-0.5 flex items-center gap-2">
                            <span>Liaison: {emp.name}</span>
                            <span className="text-stone-300">·</span>
                            <span className="font-mono">{emp.email}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setAuditEmployer(emp)}
                          className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold cursor-pointer flex items-center gap-1.5"
                          title="Audit credentials (read-only)"
                        >
                          <FileText className="w-3.5 h-3.5 text-stone-500" />
                          <span>Audit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            verifyEmployer(emp.uid, 'verified');
                            showToast(`Accredited corporate partner ${emp.company || emp.name}!`, 'success');
                          }}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenRejectModal(emp)}
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-semibold cursor-pointer"
                        >
                          Reject
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-stone-50 p-3 rounded-xl border border-stone-200/80">
                      <div>
                        <span className="text-stone-400 block text-[10px] uppercase">Industry Sector</span>
                        <span className="font-semibold text-stone-800">{emp.industry || 'Technology & Services'}</span>
                      </div>
                      <div>
                        <span className="text-stone-400 block text-[10px] uppercase">Headquarters</span>
                        <span className="font-semibold text-stone-800">{emp.location || 'Cebu, Philippines'}</span>
                      </div>
                      <div>
                        <span className="text-stone-400 block text-[10px] uppercase">Recruiter Role</span>
                        <span className="font-semibold text-stone-800">{emp.currentPosition || 'Talent Acquisition'}</span>
                      </div>
                      <div>
                        <span className="text-stone-400 block text-[10px] uppercase">Corporate Domain</span>
                        <span className="font-mono text-stone-800 truncate block">{emp.companyWebsite || (emp as any).website || emp.email.split('@')[1] || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 3. Job Moderation Queue */}
            {showJobList && (
              <div className="space-y-3">
                {pendingJobs.map((job) => (
                  <div
                    key={job.id}
                    className="bg-white rounded-2xl border border-stone-200/90 p-4 sm:p-5 shadow-2xs space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center shrink-0">
                          <Briefcase className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-stone-900">{job.title}</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                              Pending Publication
                            </span>
                          </div>
                          <div className="text-[11px] text-stone-500 mt-0.5 flex items-center gap-2">
                            <span className="font-semibold text-stone-700">{job.company}</span>
                            <span className="text-stone-300">·</span>
                            <span>{job.location}</span>
                            <span className="text-stone-300">·</span>
                            <span className="capitalize">{job.type}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            approveOpportunity(job.id);
                            showToast(`Approved and published job "${job.title}"!`, 'success');
                          }}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve Posting</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            rejectOpportunity(job.id, 'Declined by Administrator during routine moderation');
                            showToast(`Declined job posting "${job.title}"`, 'info');
                          }}
                          className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-medium cursor-pointer"
                        >
                          Decline
                        </button>
                      </div>
                    </div>

                    <div className="bg-stone-50 p-3 rounded-xl border border-stone-200/80 text-xs text-stone-600 leading-relaxed line-clamp-2">
                      {job.description}
                    </div>

                    {(job.salaryOrStipend || (job as any).salary) && (
                      <div className="text-[11px] text-stone-500 flex items-center gap-1 font-mono">
                        <DollarSign className="w-3 h-3 text-stone-400" />
                        <span>Compensation: {job.salaryOrStipend || (job as any).salary}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Read-Only Credentials Audit Modal */}
      {auditEmployer && (
        <EmployerVerificationModal
          employer={auditEmployer}
          onClose={() => setAuditEmployer(null)}
        />
      )}

      {/* Mandatory Rejection Reason Modal */}
      {rejectingEmployer && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div
            className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-stone-200 text-stone-900 my-auto animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-rose-100 text-rose-700">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-stone-900">
                    Reject Employer Accreditation
                  </h4>
                  <p className="text-xs text-stone-500">
                    {rejectingEmployer.company || rejectingEmployer.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRejectingEmployer(null);
                  setRejectionError(null);
                }}
                className="text-stone-400 hover:text-stone-600 p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmEmployerReject} className="mt-4 space-y-3.5">
              <p className="text-xs text-stone-600 leading-relaxed">
                Rejection requires an administrative rationale (10–500 characters). This will be recorded in the audit trail and is restricted to administrators.
              </p>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  Rejection Reason * (10–500 characters)
                </label>
                <textarea
                  rows={3}
                  value={rejectionReasonInput}
                  onChange={(e) => {
                    setRejectionReasonInput(e.target.value);
                    if (rejectionError) setRejectionError(null);
                  }}
                  placeholder="State the reason for rejecting this employer (e.g. invalid SEC registration, unverifiable corporate presence)..."
                  className={`w-full px-3 py-2 text-xs bg-stone-50 border rounded-xl focus:outline-hidden focus:ring-2 ${
                    rejectionError
                      ? 'border-rose-400 focus:ring-rose-400'
                      : 'border-stone-300 focus:ring-rose-500'
                  }`}
                />
                <div className="flex justify-between items-center mt-1 text-[11px]">
                  <span className={rejectionError ? 'text-rose-600 font-semibold' : 'text-stone-400'}>
                    {rejectionError || `${rejectionReasonInput.trim().length}/500 characters`}
                  </span>
                  <span className="text-stone-400">Min 10 characters</span>
                </div>
              </div>

              <div className="pt-2 border-t border-stone-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRejectingEmployer(null);
                    setRejectionError(null);
                  }}
                  className="px-3.5 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Proof Document Inspection Modal */}
      {viewingProof && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-xl border border-stone-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-stone-100 flex items-center justify-center text-stone-700">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-stone-900">{viewingProof.name}</h4>
                  <p className="text-xs text-stone-500">Submitted by {viewingProof.userName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingProof(null)}
                className="p-1 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {viewingProof.notes && (
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs text-stone-700 space-y-1">
                <span className="font-bold uppercase tracking-wider text-[10px] text-stone-400 block">
                  Applicant Registrar Notes
                </span>
                <p className="italic">"{viewingProof.notes}"</p>
              </div>
            )}

            <div className="bg-stone-100 rounded-xl overflow-hidden flex items-center justify-center min-h-[300px] max-h-[500px] p-2 border border-stone-200">
              {viewingProof.url.startsWith('data:image/') || viewingProof.url.includes('.png') || viewingProof.url.includes('.jpg') || viewingProof.url.includes('.webp') ? (
                <img
                  src={viewingProof.url}
                  alt={viewingProof.name}
                  className="max-h-[480px] max-w-full object-contain rounded-lg shadow-2xs"
                />
              ) : (
                <div className="text-center p-8 space-y-3">
                  <FileText className="w-12 h-12 text-stone-400 mx-auto" />
                  <p className="text-xs font-semibold text-stone-700">{viewingProof.name}</p>
                  <a
                    href={viewingProof.url}
                    download={viewingProof.name}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-stone-900 text-white rounded-xl text-xs font-bold hover:bg-stone-800 transition-colors cursor-pointer"
                  >
                    <span>Download / Open PDF Document</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setViewingProof(null)}
                className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-xl cursor-pointer"
              >
                Close
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const targetU = users.find((u) => u.uid === viewingProof.uid);
                    setViewingProof(null);
                    if (targetU) setDecliningAlumni(targetU);
                  }}
                  className="px-3.5 py-2 text-xs font-bold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl cursor-pointer"
                >
                  Decline / Clarify
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUserVerified(viewingProof.uid, true);
                    showToast(`✓ Verified ${viewingProof.userName} with submitted documentation!`, 'success');
                    setViewingProof(null);
                  }}
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Approve Verification</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Decline Alumni Verification Request Modal */}
      {decliningAlumni && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl border border-stone-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2 text-stone-900 font-bold text-sm">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Decline Verification Request</span>
              </div>
              <button
                type="button"
                onClick={() => setDecliningAlumni(null)}
                className="p-1 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmDeclineAlumni} className="space-y-3.5">
              <p className="text-xs text-stone-600">
                Provide feedback to <strong className="text-stone-900">{decliningAlumni.name}</strong> regarding why their verification request could not be validated. They will see this note and may resubmit with additional documentation.
              </p>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  Reason / Registrar Feedback
                </label>
                <textarea
                  rows={3}
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  placeholder="e.g. Student ID does not match records, or diploma image was illegible. Please re-upload a clear copy of your Official Transcript of Records (TOR) or Diploma."
                  className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-[#8B181B]"
                />
              </div>

              <div className="pt-2 border-t border-stone-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDecliningAlumni(null)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold text-white bg-amber-700 hover:bg-amber-800 rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  Confirm Decline
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
