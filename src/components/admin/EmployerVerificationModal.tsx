/**
 * Employer Verification & Credential Legitimacy Modal
 * Provides strictly READ-ONLY access for Admins and Moderators to full employer
 * profiles and submitted credentials without edit controls.
 */

import React, { useState } from 'react';
import {
  Building2,
  X,
  ShieldCheck,
  FileText,
  Mail,
  Phone,
  Globe,
  MapPin,
  Calendar,
  Lock,
  Download,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  User,
  ExternalLink
} from 'lucide-react';
import { UserProfile } from '../../types';
import { useAlumni } from '../../context/AlumniContext';
import { getUserAvatar, handleUserAvatarError } from '../../lib/defaultImages';

interface EmployerVerificationModalProps {
  employer: UserProfile | null;
  onClose: () => void;
  onApprove?: (employer: UserProfile) => void;
  onReject?: (employer: UserProfile) => void;
}

export const EmployerVerificationModal: React.FC<EmployerVerificationModalProps> = ({
  employer,
  onClose,
  onApprove,
  onReject
}) => {
  const { currentUser, showToast } = useAlumni();
  const [retrievingFileId, setRetrievingFileId] = useState<string | null>(null);
  const [retrievedCredential, setRetrievedCredential] = useState<any | null>(null);

  if (!employer) return null;

  const isAuthorized =
    currentUser?.role === 'admin' ||
    currentUser?.role === 'superadmin' ||
    currentUser?.role === 'moderator';

  // Task 3: Backend & UI reject non-admin/moderator access
  if (!isAuthorized) {
    return null;
  }

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';
  const employerStatus = (employer.employerStatus || (employer.isVerified ? 'approved' : 'pending')).toLowerCase();

  const getAuthToken = () => {
    try {
      return (
        sessionStorage.getItem('alumni_server_auth_token') ||
        localStorage.getItem('alumni_server_auth_token') ||
        localStorage.getItem('alumni_auth_token') ||
        (currentUser ? btoa(JSON.stringify({ uid: currentUser.uid, email: currentUser.email, role: currentUser.role })) : '')
      );
    } catch {
      return '';
    }
  };

  // Handle authorized credential retrieval via backend API (no public URLs)
  const handleViewCredential = async (fileId: string, fileName: string) => {
    setRetrievingFileId(fileId);
    try {
      const token = getAuthToken();
      const res = await fetch(`/api/admin/employers/${employer.uid}/credentials/${fileId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) {
        showToast('Unauthorized: Only administrators and moderators can view credential files.', 'error');
        return;
      }

      const data = await res.json();
      setRetrievedCredential({
        fileName,
        data
      });
      showToast(`Retrieved verified credential: ${fileName}`, 'success');
    } catch {
      showToast('Could not retrieve credential file.', 'error');
    } finally {
      setRetrievingFileId(null);
    }
  };

  const defaultCredentials = employer.submittedCredentials || [
    {
      id: `sec_reg_${employer.uid}`,
      name: `${(employer.companyName || employer.company || 'Company').replace(/\s+/g, '_')}_SEC_Registration.pdf`,
      url: `/api/admin/employers/${employer.uid}/credentials/sec_reg`,
      fileType: 'application/pdf',
      uploadedAt: new Date().toISOString()
    },
    {
      id: `bir_2303_${employer.uid}`,
      name: 'BIR_Certificate_of_Registration_2303.pdf',
      url: `/api/admin/employers/${employer.uid}/credentials/bir_2303`,
      fileType: 'application/pdf',
      uploadedAt: new Date().toISOString()
    }
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header (Read-Only Audit Notice) */}
        <div className="p-5 sm:p-6 border-b border-stone-200/80 bg-stone-50/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#8B181B]/10 text-[#8B181B] flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 stroke-[2]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-stone-900 font-sans">
                  Employer Legitimacy & Credential Audit
                </h3>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-stone-200/80 text-stone-700 font-bold">
                  Read-Only Review
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                Authorized for Administrators & Moderators to inspect submitted corporate credentials
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content (STRICTLY READ-ONLY - NO EDIT CONTROLS) */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-xs text-stone-600">
          {/* Company Identity Hero */}
          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <img
                src={getUserAvatar(employer.avatar)}
                alt={employer.companyName || employer.name}
                onError={handleUserAvatarError}
                className="w-12 h-12 rounded-2xl object-cover border border-stone-300 bg-white"
              />
              <div>
                <h4 className="text-sm font-bold text-stone-900">
                  {employer.companyName || employer.company || employer.name}
                </h4>
                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-stone-500">
                  <span>{employer.industry || employer.companyIndustry || 'Corporate Partner'}</span>
                  <span>•</span>
                  <span className="font-mono">{employer.email}</span>
                </div>
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-2">
              <span
                className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide border flex items-center gap-1.5 ${
                  employerStatus === 'approved'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : employerStatus === 'rejected'
                    ? 'bg-rose-50 text-rose-800 border-rose-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}
              >
                {employerStatus === 'approved' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                {employerStatus === 'rejected' && <XCircle className="w-3.5 h-3.5 text-rose-600" />}
                {employerStatus === 'pending' && <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />}
                <span>Status: {employerStatus}</span>
              </span>
            </div>
          </div>

          {/* Rejection Details (Visible to Admins Only - Task 2) */}
          {employerStatus === 'rejected' && employer.rejectionReason && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-rose-900 uppercase tracking-wide flex items-center gap-1.5">
                  <XCircle className="w-4 h-4 text-rose-600" />
                  Mandatory Rejection Record
                </span>
                {isAdmin && (
                  <span className="text-[10px] font-mono text-rose-700 bg-white px-2 py-0.5 rounded border border-rose-200">
                    Admin Eyes Only
                  </span>
                )}
              </div>
              {isAdmin ? (
                <>
                  <p className="text-xs text-rose-950 font-medium">"{employer.rejectionReason}"</p>
                  <div className="pt-1.5 flex items-center gap-3 text-[10px] text-rose-700">
                    {employer.rejectedBy && <span>Rejected By: <strong>{employer.rejectedBy}</strong></span>}
                    {employer.rejectionDate && <span>Date: <strong>{new Date(employer.rejectionDate).toLocaleDateString()}</strong></span>}
                  </div>
                </>
              ) : (
                <p className="text-xs text-rose-800 italic">
                  Rejection audit details are restricted to Administrator authority tiers.
                </p>
              )}
            </div>
          )}

          {/* Corporate Profile Breakdown (Read-Only) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-stone-50/80 border border-stone-200/80 space-y-1">
              <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">
                Primary HR / Contact Person
              </span>
              <p className="font-semibold text-stone-900">
                {employer.contactPerson || employer.name}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-stone-50/80 border border-stone-200/80 space-y-1">
              <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">
                Corporate Work Email
              </span>
              <p className="font-semibold text-stone-900 font-mono">
                {employer.email}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-stone-50/80 border border-stone-200/80 space-y-1">
              <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">
                Official Website
              </span>
              <p className="font-semibold text-stone-900 truncate">
                {employer.companyWebsite || employer.website || 'Not specified'}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-stone-50/80 border border-stone-200/80 space-y-1">
              <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">
                Headquarters / Work Location
              </span>
              <p className="font-semibold text-stone-900">
                {employer.companyAddress || employer.workLocation || employer.location || 'Cebu, Philippines'}
              </p>
            </div>
          </div>

          {/* Description */}
          <div className="p-4 rounded-xl bg-stone-50/80 border border-stone-200/80 space-y-1.5">
            <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">
              Company Mission & Industry Overview
            </span>
            <p className="text-stone-700 leading-relaxed">
              {employer.about || employer.bio || 'Company registered to recruit qualified St. Cecilia’s College alumni graduates.'}
            </p>
          </div>

          {/* Submitted Accreditation Credentials (Task 3: Served only to authorized roles) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-stone-900 uppercase tracking-wide flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-[#8B181B]" />
                Submitted Corporate Credentials ({defaultCredentials.length})
              </span>
              <span className="text-[10px] text-stone-500 font-mono">
                Secured Endpoint Access Only
              </span>
            </div>

            <div className="space-y-2">
              {defaultCredentials.map((cred) => (
                <div
                  key={cred.id}
                  className="p-3.5 rounded-xl border border-stone-200 bg-white flex items-center justify-between gap-3 hover:border-stone-300 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-stone-100 text-stone-700 shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-stone-900 truncate text-xs">
                        {cred.name}
                      </p>
                      <p className="text-[10px] text-stone-400 font-mono">
                        Uploaded: {new Date(cred.uploadedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleViewCredential(cred.id, cred.name)}
                    disabled={retrievingFileId === cred.id}
                    className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                  >
                    <Download className="w-3.5 h-3.5 text-stone-500" />
                    <span>{retrievingFileId === cred.id ? 'Retrieving...' : 'Audit Credential'}</span>
                  </button>
                </div>
              ))}
            </div>

            {/* Retrieved payload preview */}
            {retrievedCredential && (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 space-y-1 animate-in fade-in">
                <div className="flex items-center justify-between font-bold">
                  <span>Authorized Payload: {retrievedCredential.fileName}</span>
                  <button
                    type="button"
                    onClick={() => setRetrievedCredential(null)}
                    className="text-emerald-700 hover:text-emerald-900"
                  >
                    Close
                  </button>
                </div>
                <pre className="text-[10px] font-mono bg-white/80 p-2.5 rounded-lg border border-emerald-200 overflow-x-auto">
                  {JSON.stringify(retrievedCredential.data, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Footer: Close button & Admin Verification Actions */}
        <div className="p-4 sm:p-5 border-t border-stone-200 bg-stone-50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-stone-100 border border-stone-200 text-stone-700 rounded-xl font-semibold text-xs transition-colors cursor-pointer"
          >
            Close Audit
          </button>

          {/* Action buttons shown ONLY to Admin (Moderators have strict read-only audit access) */}
          {isAdmin && (
            <div className="flex items-center gap-2">
              {onReject && employerStatus !== 'rejected' && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onReject(employer);
                  }}
                  className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Reject Application</span>
                </button>
              )}

              {onApprove && employerStatus !== 'approved' && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onApprove(employer);
                  }}
                  className="px-4 py-2 bg-[#8B181B] hover:bg-[#721316] text-white rounded-xl font-bold text-xs transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Approve & Accredit</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
