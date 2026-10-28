import React, { useState } from 'react';
import {
  GraduationCap,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Search,
  Sparkles,
  X,
  Upload,
  FileText,
  Clock,
  ArrowRight,
  FileCheck
} from 'lucide-react';
import { useAlumni } from '../../context/AlumniContext';
import { compressImage } from '../../lib/utils';
import { normalizeStudentId } from '../../services/studentVerificationService';

interface RegistrarSelfVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const RegistrarSelfVerificationModalContent: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { currentUser, selfVerifyAlumniWithRegistry, updateProfile, updateUserProfile, showToast, addAuditLog } = useAlumni();
  const [activeTab, setActiveTab] = useState<'instant' | 'request'>(
    currentUser?.verificationStatus === 'pending_review' ? 'request' : 'instant'
  );

  // Instant Check State
  const [studentIdInput, setStudentIdInput] = useState(currentUser?.studentId || '');
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    details?: string;
  } | null>(null);

  // Manual Verification Request with Proof Form State
  const [reqStudentId, setReqStudentId] = useState(currentUser?.studentId || '');
  const [reqBatch, setReqBatch] = useState(currentUser?.batch || '2024');
  const [reqCourse, setReqCourse] = useState(currentUser?.course || 'B.S. Information Technology');
  const [reqNotes, setReqNotes] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofFileName, setProofFileName] = useState<string>('');
  const [proofDataUrl, setProofDataUrl] = useState<string>('');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [requestSubmitted, setRequestSubmitted] = useState(
    currentUser?.verificationStatus === 'pending_review'
  );

  if (!currentUser) return null;

  // 1. Instant Automated Check
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentIdInput.trim()) return;

    setIsVerifying(true);
    setResult(null);

    try {
      const res = await selfVerifyAlumniWithRegistry(studentIdInput.trim());
      setResult(res);
      if (res.success) {
        showToast('Degree verified successfully! Verified Alum badge awarded.', 'success');
      }
    } catch (err: any) {
      setResult({
        success: false,
        message: err?.message || 'Verification process encountered an unexpected error. Please try again.'
      });
    } finally {
      setIsVerifying(false);
    }
  };

  // 2. Handle Document Proof File Upload
  const handleProofChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      showToast('Please upload an image (JPG, PNG, WebP) or PDF document of your credentials.', 'error');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showToast('File size must be under 10MB.', 'error');
      return;
    }

    setProofFile(file);
    setProofFileName(file.name);

    if (file.type.startsWith('image/')) {
      try {
        const compressed = await compressImage(file, 1200, 1200, 0.85);
        setProofDataUrl(compressed);
      } catch {
        const reader = new FileReader();
        reader.onload = () => setProofDataUrl(reader.result as string);
        reader.readAsDataURL(file);
      }
    } else {
      const reader = new FileReader();
      reader.onload = () => setProofDataUrl(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  // 3. Submit Formal Verification Request for Registrar Inspection
  const handleSubmitVerificationRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = normalizeStudentId(reqStudentId).toUpperCase();
    if (!cleanId) {
      showToast('Please enter your Student ID number.', 'error');
      return;
    }

    setIsSubmittingRequest(true);
    const updater = updateProfile || updateUserProfile;

    const requestPayload = {
      verificationStatus: 'pending_review' as const,
      studentId: cleanId,
      batch: reqBatch.trim(),
      course: reqCourse.trim(),
      verificationProofUrl: proofDataUrl || undefined,
      verificationProofName: proofFileName || undefined,
      verificationNotes: reqNotes.trim() || undefined,
      verificationSubmittedAt: new Date().toISOString()
    };

    try {
      if (typeof updater === 'function') {
        updater(requestPayload);
      }

      // Synchronize with backend verification queue
      await fetch('/api/alumni/verification-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.uid,
          name: currentUser.name,
          email: currentUser.email,
          studentId: cleanId,
          batch: reqBatch.trim(),
          course: reqCourse.trim(),
          proofName: proofFileName || undefined,
          proofUrl: proofDataUrl || undefined,
          notes: reqNotes.trim() || undefined
        })
      }).catch(() => {});

      addAuditLog({
        action: 'ALUMNI_VERIFICATION_REQUEST_SUBMITTED',
        actorId: currentUser.uid,
        actorName: currentUser.name,
        actorRole: 'alumni',
        category: 'alumni_verification',
        details: `Alumnus ${currentUser.name} (${cleanId}) submitted proof for institutional degree verification.`,
        severity: 'info'
      });

      setRequestSubmitted(true);
      showToast('Verification request submitted! Office of the Registrar will review within 24–48 hours.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to submit verification request.', 'error');
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  return (
    <div
      id="registrar-self-verification-modal-overlay"
      className="fixed inset-0 z-50 bg-black/70 dark:bg-black/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in"
      onClick={onClose}
    >
      <div
        id="registrar-self-verification-modal-container"
        className="relative my-auto bg-white dark:bg-stone-900 rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 max-w-xl w-full p-5 sm:p-7 text-stone-900 dark:text-stone-100 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-stone-100 dark:border-stone-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-red-50 dark:bg-red-950/40 text-[#8B181B] dark:text-red-400 border border-red-100 dark:border-red-900/60 shrink-0">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-sans text-lg font-bold text-stone-900 dark:text-white leading-tight">
                Degree Accreditation & Verification
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                Office of the Registrar • St. Cecilia's College Official Archives
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-xl text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="mt-4 flex items-center p-1 bg-stone-100 dark:bg-stone-800 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('instant')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'instant'
                ? 'bg-white dark:bg-stone-900 text-[#8B181B] dark:text-red-300 shadow-2xs'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
            }`}
          >
            Instant Registry Match
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('request')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'request'
                ? 'bg-white dark:bg-stone-900 text-[#8B181B] dark:text-red-300 shadow-2xs'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
            }`}
          >
            <span>Submit Proof for Review</span>
            {currentUser?.verificationStatus === 'pending_review' && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            )}
          </button>
        </div>

        {/* ========================================================
            TAB 1: INSTANT REGISTRY MATCH
            ======================================================== */}
        {activeTab === 'instant' && (
          <div className="mt-4 space-y-4">
            <div className="p-3.5 bg-stone-50 dark:bg-stone-800/60 border border-stone-200/80 dark:border-stone-700/60 rounded-2xl text-xs text-stone-600 dark:text-stone-300 space-y-1">
              <p className="font-semibold text-stone-900 dark:text-white flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Instant Pre-Accreditation Match</span>
              </p>
              <p className="text-[11px] leading-relaxed text-stone-500 dark:text-stone-400">
                Enter your student ID below to instantly cross-reference against the uploaded registrar masterlist and claim your Verified Alum credential.
              </p>
            </div>

            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                  Institutional Student ID Number *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={studentIdInput}
                    onChange={(e) => setStudentIdInput(e.target.value)}
                    placeholder="e.g. SC-2020-0192, SCC-2024-0001, or GALSCC001"
                    className="w-full px-3.5 py-2.5 text-xs bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-stone-900 dark:text-stone-100 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#8B181B] font-mono uppercase tracking-wider"
                  />
                  <Search className="w-4 h-4 text-stone-400 dark:text-stone-500 absolute right-3 top-3 pointer-events-none" />
                </div>
              </div>

              {/* Feedback Display */}
              {result && (
                <div
                  className={`p-4 rounded-2xl border text-xs leading-relaxed animate-in fade-in ${
                    result.success
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                      : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {result.success ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <h4 className="font-bold text-xs">
                        {result.success ? 'Verification Confirmed!' : 'Not Found in Instant Masterlist'}
                      </h4>
                      <p className="mt-0.5 text-[11px]">{result.message}</p>

                      {!result.success && (
                        <div className="mt-3 pt-3 border-t border-amber-200 dark:border-amber-800/60">
                          <p className="text-[11px] font-semibold text-stone-700 dark:text-stone-200 mb-1.5">
                            Graduated earlier or record not yet digitized?
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setReqStudentId(studentIdInput);
                              setActiveTab('request');
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#8B181B] hover:bg-[#721316] text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs"
                          >
                            <span>Submit Proof for Registrar Review</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-colors cursor-pointer"
                >
                  {result?.success ? 'Done' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isVerifying || !studentIdInput.trim()}
                  className="px-5 py-2.5 bg-[#8B181B] hover:bg-[#721316] disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  {isVerifying ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Matching Registrar Archives...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{currentUser.isVerified ? 'Re-verify with Registrar' : 'Verify My Degree'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ========================================================
            TAB 2: SUBMIT VERIFICATION REQUEST WITH PROOF
            ======================================================== */}
        {activeTab === 'request' && (
          <div className="mt-4 space-y-4">
            {requestSubmitted || currentUser.verificationStatus === 'pending_review' ? (
              <div className="p-5 rounded-2xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-950 dark:text-blue-200 text-xs space-y-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">Verification Request Active</h4>
                    <p className="text-xs text-blue-800 dark:text-blue-300/90 mt-1 leading-relaxed">
                      Your verification request and proof documentation have been submitted to the Office of the Registrar.
                    </p>
                    <div className="mt-2 text-[11px] text-blue-700 dark:text-blue-300 space-y-0.5">
                      <p>• Student ID: <strong>{currentUser.studentId || reqStudentId}</strong></p>
                      <p>• Batch: <strong>Class of {currentUser.batch || reqBatch}</strong></p>
                      <p>• Program: <strong>{currentUser.course || reqCourse}</strong></p>
                      {currentUser.verificationProofName && (
                        <p>• Attached Proof: <strong>{currentUser.verificationProofName}</strong></p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-blue-200 dark:border-blue-800 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setRequestSubmitted(false)}
                    className="text-xs font-bold text-blue-800 dark:text-blue-300 hover:underline cursor-pointer"
                  >
                    Update submitted details / upload new document
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitVerificationRequest} className="space-y-4">
                <div className="p-3 bg-stone-50 dark:bg-stone-800/60 border border-stone-200/80 dark:border-stone-700/60 rounded-2xl text-xs text-stone-600 dark:text-stone-300">
                  <p className="font-semibold text-stone-900 dark:text-white">
                    Submit Graduation Proof for Registrar Audit
                  </p>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                    Upload a clear photo or PDF scan of your Diploma, Official Transcript of Records (TOR), or former Student ID card.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                      Student ID Number *
                    </label>
                    <input
                      type="text"
                      required
                      value={reqStudentId}
                      onChange={(e) => setReqStudentId(e.target.value)}
                      placeholder="e.g. SCC-2022-0142"
                      className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl font-mono uppercase"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                      Graduation Batch Year *
                    </label>
                    <input
                      type="text"
                      required
                      value={reqBatch}
                      onChange={(e) => setReqBatch(e.target.value)}
                      placeholder="e.g. 2024"
                      className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Degree / Academic Program *
                  </label>
                  <input
                    type="text"
                    required
                    value={reqCourse}
                    onChange={(e) => setReqCourse(e.target.value)}
                    placeholder="e.g. Bachelor of Science in Information Technology"
                    className="w-full px-3 py-2 text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl"
                  />
                </div>

                {/* Proof Document Upload */}
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Proof of Graduation Document (Photo or PDF) *
                  </label>
                  <div className="border-2 border-dashed border-stone-200 dark:border-stone-700 rounded-2xl p-4 text-center bg-stone-50 dark:bg-stone-800/40 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors">
                    <input
                      type="file"
                      id="proof-upload-input"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      onChange={handleProofChange}
                      className="hidden"
                    />
                    <label htmlFor="proof-upload-input" className="cursor-pointer block">
                      <Upload className="w-6 h-6 text-stone-400 mx-auto mb-1" />
                      {proofFileName ? (
                        <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                          <FileCheck className="w-4 h-4" />
                          <span>{proofFileName}</span>
                        </div>
                      ) : (
                        <>
                          <span className="text-xs font-bold text-[#8B181B] dark:text-red-400 block">
                            Click to upload diploma or ID photo
                          </span>
                          <span className="text-[11px] text-stone-400 block mt-0.5">
                            JPG, PNG, WebP, or PDF up to 10MB
                          </span>
                        </>
                      )}
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Additional Remarks / Notes for Registrar
                  </label>
                  <textarea
                    rows={2}
                    value={reqNotes}
                    onChange={(e) => setReqNotes(e.target.value)}
                    placeholder="e.g. Graduated Centennial Batch 2024, honor student, etc."
                    className="w-full px-3 py-2 text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-xs font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingRequest || !reqStudentId.trim()}
                    className="px-5 py-2.5 bg-[#8B181B] hover:bg-[#721316] disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    {isSubmittingRequest ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Submitting to Registrar...</span>
                      </>
                    ) : (
                      <>
                        <FileText className="w-3.5 h-3.5" />
                        <span>Submit Verification Request</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export const RegistrarSelfVerificationModal: React.FC<RegistrarSelfVerificationModalProps> = ({
  isOpen,
  onClose
}) => {
  if (!isOpen) return null;
  return <RegistrarSelfVerificationModalContent onClose={onClose} />;
};
