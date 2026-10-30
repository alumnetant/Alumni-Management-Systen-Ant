/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * St. Cecilia's College - Official PDF Resume Preview & Review Modal
 * Provides an inspect step before exporting the official verified PDF resume.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Download,
  X,
  Building2,
  Calendar,
  GraduationCap,
  MapPin,
  Mail,
  Phone,
  ShieldCheck,
  CheckCircle2,
  Edit3,
  Loader2,
  Sparkles,
  Award
} from 'lucide-react';
import { UserProfile } from '../../types';
import { exportProfileToPdfResume } from '../../services/pdfResumeService';
import { useAlumni } from '../../context/AlumniContext';
import { getUserAvatar, handleUserAvatarError } from '../../lib/defaultImages';

export interface PdfResumePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: UserProfile | null;
  onOpenEditProfile?: () => void;
}

export const PdfResumePreviewModal: React.FC<PdfResumePreviewModalProps> = ({
  isOpen,
  onClose,
  targetUser,
  onOpenEditProfile
}) => {
  const { currentUser, showToast } = useAlumni();
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen || !targetUser) return null;

  const isSelf = currentUser?.uid === targetUser.uid;
  const fullName = targetUser.name || 'Cecilian Alumnus';
  const roleHeadline = targetUser.headline || `${targetUser.course || 'Alumni'} Graduate`;

  const handleConfirmDownload = async () => {
    setIsExporting(true);
    try {
      await exportProfileToPdfResume(targetUser, currentUser);
      if (showToast) {
        showToast('Official PDF Resume downloaded successfully!', 'success');
      }
      setTimeout(() => {
        onClose();
      }, 600);
    } catch (err: any) {
      if (showToast) {
        showToast(err?.message || 'Could not export PDF resume.', 'error');
      }
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200/90 dark:border-stone-800 shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden text-stone-900 dark:text-stone-100 antialiased font-sans"
        >
          {/* Modal Header */}
          <div className="px-6 py-4 border-b border-stone-200/80 dark:border-stone-800 flex items-center justify-between gap-4 bg-stone-50/70 dark:bg-stone-850/60 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200/80 dark:border-rose-900/60 flex items-center justify-center text-[#8B181B] dark:text-rose-400 shrink-0">
                <FileText className="w-5 h-5 stroke-[1.75]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#8B181B] dark:text-rose-400">
                    St. Cecilia's College
                  </span>
                  <span className="text-stone-300 dark:text-stone-600">·</span>
                  <span className="text-[10px] font-mono text-stone-500 dark:text-stone-400">
                    CV / Resume Review Step
                  </span>
                </div>
                <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 truncate">
                  Inspect & Verify Document Before Download
                </h3>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-200/60 dark:hover:bg-stone-800 transition-colors cursor-pointer shrink-0"
              title="Close Preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Document Body (Simulated Printable A4 Sheet) */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-stone-100/50 dark:bg-stone-950/40">
            <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6 sm:p-8 shadow-xs space-y-6 max-w-2xl mx-auto">
              {/* Institutional Header Banner */}
              <div className="border-b border-stone-200/90 dark:border-stone-800 pb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <img
                    src={getUserAvatar(targetUser.profilePictureUrl || targetUser.avatar)}
                    alt={fullName}
                    onError={handleUserAvatarError}
                    className="w-16 h-16 rounded-2xl object-cover border border-stone-200 dark:border-stone-700 shadow-2xs"
                  />
                  <div>
                    <h1 className="text-xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
                      {fullName}
                    </h1>
                    <p className="text-xs font-semibold text-[#8B181B] dark:text-rose-400 mt-0.5">
                      {roleHeadline}
                    </p>
                    <div className="flex items-center gap-2 text-[11px] text-stone-500 dark:text-stone-400 mt-1 flex-wrap">
                      {targetUser.batch && <span>Batch {targetUser.batch}</span>}
                      {targetUser.course && (
                        <>
                          <span>·</span>
                          <span>{targetUser.course}</span>
                        </>
                      )}
                      {targetUser.alumniId && (
                        <>
                          <span>·</span>
                          <span className="font-mono text-stone-600 dark:text-stone-300">
                            {targetUser.alumniId}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-start sm:items-end text-[11px] text-stone-500 dark:text-stone-400 space-y-1">
                  {targetUser.email && (
                    <div className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-stone-400" />
                      <span>{targetUser.email}</span>
                    </div>
                  )}
                  {targetUser.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-stone-400" />
                      <span>{targetUser.phone}</span>
                    </div>
                  )}
                  {targetUser.location && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-stone-400" />
                      <span>{targetUser.location}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Profile Summary */}
              {targetUser.about && (
                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500">
                    Professional Profile
                  </h4>
                  <p className="text-xs leading-relaxed text-stone-700 dark:text-stone-300">
                    {targetUser.about}
                  </p>
                </div>
              )}

              {/* Verified Skills */}
              {targetUser.skills && targetUser.skills.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500">
                    Core Technical & Domain Competencies
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {targetUser.skills.map((skill, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 text-xs font-medium border border-stone-200/80 dark:border-stone-700"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Experience Timeline */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500 flex items-center justify-between">
                  <span>Professional Career History</span>
                  <span className="text-[10px] text-stone-400 font-mono">
                    {(targetUser.experience || []).length} Recorded
                  </span>
                </h4>

                {(!targetUser.experience || targetUser.experience.length === 0) ? (
                  <p className="text-xs text-stone-400 italic">No formal career history entered yet.</p>
                ) : (
                  <div className="space-y-3.5">
                    {targetUser.experience.map((exp) => (
                      <div
                        key={exp.id}
                        className="p-3.5 rounded-xl bg-stone-50/80 dark:bg-stone-850/60 border border-stone-200/80 dark:border-stone-800 space-y-1"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h5 className="text-xs font-bold text-stone-900 dark:text-stone-100">
                            {exp.title}
                          </h5>
                          <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-stone-200/60 dark:bg-stone-800 text-stone-700 dark:text-stone-300 shrink-0">
                            {exp.startDate} – {exp.current ? 'Present' : exp.endDate || 'Past'}
                          </span>
                        </div>
                        <div className="text-[11px] font-semibold text-[#8B181B] dark:text-rose-400">
                          {exp.company} {exp.location ? `• ${exp.location}` : ''}
                        </div>
                        {exp.description && (
                          <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed pt-1">
                            {exp.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Academic Credentials */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500 flex items-center justify-between">
                  <span>Academic Qualifications & Degrees</span>
                  <span className="text-[10px] text-stone-400 font-mono">
                    {(targetUser.education || []).length} Verified
                  </span>
                </h4>

                {(!targetUser.education || targetUser.education.length === 0) ? (
                  <div className="p-3 rounded-xl bg-stone-50/80 dark:bg-stone-850/60 border border-stone-200/80 dark:border-stone-800 text-xs text-stone-700 dark:text-stone-300">
                    <p className="font-bold text-stone-900 dark:text-stone-100">
                      {targetUser.course || 'Bachelor of Science'}
                    </p>
                    <p className="text-[11px] text-[#8B181B] dark:text-rose-400">
                      St. Cecilia’s College - Cebu, Inc. {targetUser.batch ? `• Class of ${targetUser.batch}` : ''}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {targetUser.education.map((edu) => (
                      <div
                        key={edu.id}
                        className="p-3.5 rounded-xl bg-stone-50/80 dark:bg-stone-850/60 border border-stone-200/80 dark:border-stone-800 space-y-1"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h5 className="text-xs font-bold text-stone-900 dark:text-stone-100">
                            {edu.degree}
                          </h5>
                          <span className="text-[10px] font-mono text-stone-500 dark:text-stone-400 shrink-0">
                            {edu.startYear} – {edu.endYear}
                          </span>
                        </div>
                        <div className="text-[11px] font-semibold text-[#8B181B] dark:text-rose-400">
                          {edu.institution}
                        </div>
                        {edu.honors && (
                          <div className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-900/60 mt-1">
                            <Award className="w-3 h-3" />
                            <span>{edu.honors}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Watermark & Verification Shield */}
              <div className="pt-4 border-t border-stone-200/80 dark:border-stone-800 flex items-center justify-between text-[11px] text-stone-400">
                <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold">
                  <ShieldCheck className="w-4 h-4" />
                  <span>St. Cecilia's College Verified Alumni Credential</span>
                </div>
                <span>Formatted to ISO A4 Document Standard</span>
              </div>
            </div>
          </div>

          {/* Modal Footer Controls */}
          <div className="px-6 py-4 border-t border-stone-200/80 dark:border-stone-800 bg-white dark:bg-stone-900 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <div className="text-xs text-stone-500 dark:text-stone-400 text-center sm:text-left">
              {isSelf ? (
                <span>Need to update details? You can edit your profile anytime.</span>
              ) : (
                <span>Reviewing {fullName}'s verified alumni credentials.</span>
              )}
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              {isSelf && onOpenEditProfile && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenEditProfile();
                  }}
                  className="px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-bold text-xs hover:bg-stone-100 dark:hover:bg-stone-750 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Profile</span>
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-bold text-xs hover:bg-stone-100 dark:hover:bg-stone-750 transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isExporting}
                onClick={handleConfirmDownload}
                className="px-5 py-2.5 rounded-xl bg-[#8B181B] hover:bg-[#721316] text-white font-bold text-xs shadow-2xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Rendering PDF...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>Confirm & Download PDF</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
