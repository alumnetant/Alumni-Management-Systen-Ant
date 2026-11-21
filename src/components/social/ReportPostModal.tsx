/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { Flag, X, AlertTriangle, Loader2, ShieldAlert } from 'lucide-react';
import { InstitutionalFeedPost, POST_REPORT_REASONS, ReportReason } from '../../types';
import { apiFetchWithCsrf, clearCsrfTokenCache } from '../../services/apiClient';
import { saveActiveSession, useAlumni } from '../../context/AlumniContext';
import {
  saveFeedPostToFirestore,
  saveModerationAuditRecordToFirestore,
  saveModerationCaseToFirestore,
  savePostReportToFirestore
} from '../../lib/firebase';

interface ReportPostModalProps {
  isOpen: boolean;
  targetType?: 'post' | 'comment';
  targetId: string;
  targetTitle?: string;
  postSnapshot?: InstitutionalFeedPost;
  onClose: () => void;
  onReported?: (targetId: string) => void;
}

function stripLargeDataUri(val?: string): string | undefined {
  if (typeof val !== 'string') return undefined;
  if (val.startsWith('data:') && val.length > 25000) return undefined;
  return val;
}

function buildCompactPostSnapshot(post?: InstitutionalFeedPost): InstitutionalFeedPost | undefined {
  if (!post || !post.id) return undefined;
  const safeImageUrl = stripLargeDataUri(post.imageUrl || post.mediaUrl);
  return {
    ...post,
    authorAvatar: stripLargeDataUri(post.authorAvatar) || '',
    imageUrl: safeImageUrl,
    mediaUrl: safeImageUrl,
    comments: Array.isArray(post.comments)
      ? post.comments.slice(0, 20).map((c) => ({
          ...c,
          authorAvatar: stripLargeDataUri(c.authorAvatar) || ''
        }))
      : []
  };
}

export const ReportPostModal: React.FC<ReportPostModalProps> = ({
  isOpen,
  targetType = 'post',
  targetId,
  targetTitle,
  postSnapshot,
  onClose,
  onReported
}) => {
  const { currentUser, showToast } = useAlumni();
  const [reason, setReason] = useState<ReportReason>('Inappropriate content');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
    }
  }, [isOpen, targetId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current || isSubmitting) return;

    submittingRef.current = true;
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      const payload = JSON.stringify({
        targetType,
        targetId,
        reason,
        details: details.trim().slice(0, 500) || undefined,
        postSnapshotFallback: buildCompactPostSnapshot(postSnapshot)
      });

      let res = await apiFetchWithCsrf(
        '/api/reports',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload
        },
        10000
      );

      if (res.status === 401 && currentUser) {
        const errBody = await res.clone().json().catch(() => null);
        if (errBody?.code !== 'SESSION_TERMINATED') {
          saveActiveSession(currentUser, undefined, true);
          clearCsrfTokenCache();
          res = await apiFetchWithCsrf(
            '/api/reports',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: payload
            },
            10000
          );
        }
      }

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const message = data?.error || 'Could not submit report. Please try again.';
        setErrorMsg(message);
        showToast(message, 'error');
        return;
      }

      // Sync submitted report, grouped case, audit record, and snapshot post to Cloud Firestore
      const firestoreWrites: Promise<unknown>[] = [];
      if (data?.report) {
        firestoreWrites.push(savePostReportToFirestore(data.report));
      }
      if (data?.modCase) {
        firestoreWrites.push(saveModerationCaseToFirestore(data.modCase));
      }
      if (data?.auditRecord) {
        firestoreWrites.push(saveModerationAuditRecordToFirestore(data.auditRecord));
      }
      if (data?.affectedPost) {
        firestoreWrites.push(saveFeedPostToFirestore(data.affectedPost));
      }
      if (firestoreWrites.length > 0) {
        await Promise.allSettled(firestoreWrites);
      }

      showToast(
        data?.message || 'Report submitted to the Moderation Desk for review.',
        'success'
      );
      setDetails('');
      if (onReported) onReported(targetId);
      onClose();
    } catch {
      setErrorMsg('Network error while submitting report. Please try again.');
      showToast('Failed to submit report.', 'error');
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92dvh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-stone-100 dark:border-stone-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-950/50 text-[#8B181B] dark:text-red-400 border border-red-200/70 dark:border-red-900/60 flex items-center justify-center shrink-0">
              <Flag className="w-4 h-4 stroke-[2]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900 dark:text-white">
                Report {targetType === 'comment' ? 'Comment' : 'Post'}
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 truncate max-w-[240px]">
                {targetTitle ? `"${targetTitle}"` : 'Submit for moderator review'}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
            aria-label="Close report dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-2">
              Select a reason *
            </label>
            <div className="space-y-1.5">
              {POST_REPORT_REASONS.map((r) => (
                <label
                  key={r}
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                    reason === r
                      ? 'bg-red-50/70 dark:bg-red-950/30 border-[#8B181B] text-stone-900 dark:text-white font-semibold'
                      : 'bg-stone-50 dark:bg-stone-800/60 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
                  }`}
                >
                  <input
                    type="radio"
                    name="reportReason"
                    value={r}
                    checked={reason === r}
                    onChange={() => setReason(r)}
                    className="accent-[#8B181B]"
                  />
                  <span>{r}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-stone-700 dark:text-stone-300">
                Additional context (optional)
              </label>
              <span className="text-[11px] text-stone-400 font-mono">
                {details.length}/500
              </span>
            </div>
            <textarea
              rows={3}
              maxLength={500}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Provide details that help our moderation team review this report..."
              className="w-full px-3 py-2 text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#8B181B]/20 focus:border-[#8B181B] resize-none"
            />
          </div>

          <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200/70 dark:border-stone-700/60 flex items-start gap-2 text-[11px] text-stone-500 dark:text-stone-400">
            <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <span>
              Reports are confidential. Repeated false or abusive reports may restrict reporting privileges.
            </span>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100 dark:border-stone-800">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 dark:text-stone-300 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 cursor-pointer min-h-[40px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#8B181B] hover:bg-[#721316] disabled:opacity-60 cursor-pointer inline-flex items-center gap-1.5 min-h-[40px]"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Submit Report</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
