/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ShieldAlert, ArrowLeft, Lock } from 'lucide-react';

interface ForbiddenAccessViewProps {
  attemptedPath?: string;
  attemptedModule?: string;
  userRole?: string;
  auditLogged?: boolean;
  onReturnToOverview: () => void;
}

export const ForbiddenAccessView: React.FC<ForbiddenAccessViewProps> = ({
  attemptedPath = '/portal/restricted',
  attemptedModule,
  userRole = 'member',
  auditLogged = true,
  onReturnToOverview
}) => {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-10">
      <div
        role="alert"
        aria-live="assertive"
        className="w-full max-w-xl bg-white dark:bg-[#181615] rounded-2xl border border-stone-200/90 dark:border-stone-800 p-6 sm:p-8 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.03)] space-y-6"
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200/90 dark:border-red-900/60 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-6 h-6 text-[#8B181B] dark:text-rose-400 stroke-[1.75]" />
          </div>
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#8B181B] dark:text-rose-400">
              <span className="font-mono tabular-nums tracking-wide">HTTP 403</span>
              <span aria-hidden="true" className="text-stone-300 dark:text-stone-700">·</span>
              <span>Forbidden Access</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">
              Super Administrator Clearance Required
            </h1>
            <p className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
              Access to System Audit Logs, Database Configuration Management, and Index Administration routes is restricted exclusively to the <span className="font-semibold text-stone-900 dark:text-stone-100">Super Administrator</span> role.
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-stone-50 dark:bg-stone-900/80 border border-stone-200/80 dark:border-stone-800 p-4 space-y-2 text-xs">
          <div className="flex items-center justify-between gap-3">
            <span className="text-stone-500 dark:text-stone-400 font-medium">Requested Route</span>
            <span className="font-mono tabular-nums text-stone-900 dark:text-stone-100 truncate">
              {attemptedPath}
            </span>
          </div>
          {attemptedModule && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-stone-500 dark:text-stone-400 font-medium">Restricted Module</span>
              <span className="font-mono text-stone-800 dark:text-stone-200">{attemptedModule}</span>
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <span className="text-stone-500 dark:text-stone-400 font-medium">Active Session Role</span>
            <span className="font-mono text-stone-800 dark:text-stone-200">{userRole}</span>
          </div>
          {auditLogged && (
            <div className="pt-2 mt-2 border-t border-stone-200/70 dark:border-stone-800 flex items-center gap-2 text-stone-600 dark:text-stone-400">
              <Lock className="w-3.5 h-3.5 text-[#8B181B] dark:text-rose-400 shrink-0 stroke-[1.75]" />
              <span>This unauthorized access attempt has been recorded in the security audit trail.</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onReturnToOverview}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-[#8B181B] hover:bg-[#721316] text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 stroke-[1.75]" />
            <span>Return to Overview</span>
          </button>
        </div>
      </div>
    </div>
  );
};
