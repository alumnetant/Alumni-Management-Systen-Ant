/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Scale, X, AlertTriangle, Loader2 } from 'lucide-react';
import { apiFetchWithCsrf } from '../../services/apiClient';
import { useAlumni } from '../../context/AlumniContext';

interface AppealPostModalProps {
  isOpen: boolean;
  postId: string;
  warningId?: string;
  actionType: 'warning' | 'deletion';
  reasonSummary?: string;
  onClose: () => void;
  onSubmitted?: () => void;
}

export const AppealPostModal: React.FC<AppealPostModalProps> = ({
  isOpen,
  postId,
  warningId,
  actionType,
  reasonSummary,
  onClose,
  onSubmitted
}) => {
  const { currentUser, addAuditLog, showToast } = useAlumni();
  const [explanation, setExplanation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (explanation.trim().length < 10) {
      setErrorMsg('Please explain why this moderation decision should be reviewed (at least 10 characters).');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiFetchWithCsrf('/api/appeals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId,
          warningId,
          actionType,
          explanation: explanation.trim()
        })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = data?.error || 'Could not submit appeal.';
        setErrorMsg(msg);
        showToast(msg, 'error');
        return;
      }
      addAuditLog({
        action: 'MODERATION_APPEAL_SUBMITTED',
        actorId: currentUser?.uid || 'alumni',
        actorName: currentUser?.name || 'Portal Member',
        actorRole: currentUser?.role || 'alumni',
        category: 'moderation',
        details: `Submitted moderation appeal for ${actionType} on post ${postId}.`,
        severity: 'info',
        targetRecordId: postId,
        metadata: { actionType, ...(warningId ? { warningId } : {}) }
      });
      showToast('Appeal submitted to an independent Admin/Moderator for review.', 'success');
      setExplanation('');
      if (onSubmitted) onSubmitted();
      onClose();
    } catch {
      setErrorMsg('Network error submitting appeal. Please try again.');
    } finally {
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
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4">
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-stone-100 dark:border-stone-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200/70 dark:border-amber-900/60 flex items-center justify-center shrink-0">
              <Scale className="w-4 h-4 stroke-[2]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900 dark:text-white">
                Appeal Moderation {actionType === 'deletion' ? 'Removal' : 'Warning'}
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Reviewed by a different administrator or moderator
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {reasonSummary && (
            <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/70 border border-stone-200/80 dark:border-stone-700 text-xs text-stone-600 dark:text-stone-300">
              <span className="font-bold text-stone-800 dark:text-stone-200 block mb-0.5">
                Original Moderation Notice:
              </span>
              {reasonSummary}
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
              Your Appeal Explanation *
            </label>
            <textarea
              rows={4}
              required
              maxLength={1000}
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Explain why your post complies with St. Cecilia's College community guidelines..."
              className="w-full px-3 py-2.5 text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-[#8B181B]/20 focus:border-[#8B181B]"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100 dark:border-stone-800">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 dark:text-stone-300 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 cursor-pointer min-h-[40px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#8B181B] hover:bg-[#721316] disabled:opacity-60 cursor-pointer inline-flex items-center gap-1.5 min-h-[40px]"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Submit Appeal</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
