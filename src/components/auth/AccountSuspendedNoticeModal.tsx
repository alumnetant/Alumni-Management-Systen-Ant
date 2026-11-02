/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  ShieldAlert,
  Lock,
  Clock,
  Calendar,
  AlertTriangle,
  Mail,
  HelpCircle,
  X,
  Phone
} from 'lucide-react';
import { SuspensionNoticeInfo } from '../../types';

export interface AccountSuspendedNoticeModalProps {
  notice: SuspensionNoticeInfo | null;
  onClose: () => void;
}

export const AccountSuspendedNoticeModal: React.FC<AccountSuspendedNoticeModalProps> = ({
  notice,
  onClose
}) => {
  if (!notice) return null;

  const isLock = notice.status === 'LOCKED';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg bg-white dark:bg-stone-900 rounded-[28px] shadow-[0_20px_60px_rgba(0,0,0,0.3)] border border-stone-200/90 dark:border-stone-800 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Institutional Color Trim */}
        <div
          className={`h-1.5 w-full ${
            isLock
              ? 'bg-gradient-to-r from-rose-700 via-red-600 to-rose-900'
              : 'bg-gradient-to-r from-[#8B181B] via-amber-600 to-orange-700'
          }`}
        />

        <div className="p-6 sm:p-8 space-y-6">
          {/* Header Icon & Title */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ring-1 ${
                  isLock
                    ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 ring-rose-200 dark:ring-rose-900/60'
                    : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 ring-amber-200 dark:ring-amber-900/60'
                }`}
              >
                {isLock ? (
                  <Lock className="w-6 h-6 stroke-[2]" />
                ) : (
                  <ShieldAlert className="w-6 h-6 stroke-[2]" />
                )}
              </div>
              <div>
                <span
                  className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider mb-1 ${
                    isLock
                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  }`}
                >
                  {isLock ? 'Account Locked' : 'Temporary Suspension'}
                </span>
                <h2 className="text-base sm:text-lg font-bold text-stone-900 dark:text-white tracking-tight leading-snug">
                  {isLock
                    ? 'Your account has been locked by an administrator.'
                    : 'Your account has been temporarily suspended.'}
                </h2>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
              aria-label="Close notice"
            >
              <X className="w-4 h-4 stroke-[2]" />
            </button>
          </div>

          {/* Details Card */}
          <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200/80 dark:border-stone-700/60 space-y-3 text-xs">
            {/* Official Reason */}
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                Official Explanation / Reason
              </span>
              <p className="mt-1 text-xs font-semibold text-stone-900 dark:text-white leading-relaxed">
                {notice.reason || 'Account disabled due to institutional administrative review.'}
              </p>
            </div>

            {/* Timeline */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-stone-200/60 dark:border-stone-700/60 text-[11px]">
              {notice.startDate && (
                <div className="space-y-0.5">
                  <span className="text-stone-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-stone-400" />
                    <span>Suspension Start</span>
                  </span>
                  <p className="font-mono text-stone-800 dark:text-stone-200 font-semibold">
                    {new Date(notice.startDate).toLocaleString('en-US', {
                      timeZone: 'Asia/Manila',
                      dateStyle: 'medium',
                      timeStyle: 'short'
                    })}
                  </p>
                </div>
              )}

              {notice.endDate ? (
                <div className="space-y-0.5">
                  <span className="text-stone-400 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-600" />
                    <span>Expected Expiration</span>
                  </span>
                  <p className="font-mono text-amber-900 dark:text-amber-300 font-bold">
                    {new Date(notice.endDate).toLocaleString('en-US', {
                      timeZone: 'Asia/Manila',
                      dateStyle: 'medium',
                      timeStyle: 'short'
                    })}
                  </p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  <span className="text-stone-400 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-rose-600" />
                    <span>Restoration Policy</span>
                  </span>
                  <p className="font-semibold text-rose-700 dark:text-rose-400">
                    Manual administrator unlock required
                  </p>
                </div>
              )}
            </div>

            {notice.suspendedByName && (
              <div className="pt-2 border-t border-stone-200/60 dark:border-stone-700/60 text-[11px] text-stone-500">
                Authorized Officer: <strong>{notice.suspendedByName}</strong>
              </div>
            )}
          </div>

          {/* Contact & Appeal Instructions */}
          <div className="p-4 rounded-2xl bg-stone-100/70 dark:bg-stone-800/40 border border-stone-200/70 dark:border-stone-700/70 space-y-2 text-xs">
            <div className="flex items-center gap-2 font-bold text-stone-800 dark:text-stone-200">
              <HelpCircle className="w-4 h-4 text-[#8B181B] shrink-0" />
              <span>Institutional Support & Dispute Resolution</span>
            </div>
            <p className="text-[11px] text-stone-600 dark:text-stone-400 leading-relaxed">
              {notice.contactInstructions ||
                "If you believe this suspension was made in error or wish to request an account review, please contact the St. Cecilia's College Registrar Office or System Administration."}
            </p>
            <div className="pt-2 flex flex-wrap gap-3 text-[11px] font-mono text-stone-700 dark:text-stone-300">
              <a
                href="mailto:admin@stcecilia.edu.ph"
                className="flex items-center gap-1 hover:text-[#8B181B] transition-colors"
              >
                <Mail className="w-3.5 h-3.5 text-stone-400" />
                <span>admin@stcecilia.edu.ph</span>
              </a>
              <span className="flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-stone-400" />
                <span>+63 (032) 268-4746</span>
              </span>
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs transition-colors cursor-pointer shadow-2xs"
            >
              I Understand
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
