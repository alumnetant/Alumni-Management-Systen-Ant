/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Clock,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Calendar,
  X,
  History,
  Lock,
  Unlock,
  RotateCcw,
  User,
  AlertTriangle,
  Info
} from 'lucide-react';
import { UserProfile, SuspensionHistoryEntry } from '../../types';
import { useAlumni } from '../../context/AlumniContext';

export interface SuspensionHistoryModalProps {
  isOpen: boolean;
  user: UserProfile | null;
  onClose: () => void;
  onUnlockClick?: () => void;
  onExtendClick?: () => void;
}

export const SuspensionHistoryModal: React.FC<SuspensionHistoryModalProps> = ({
  isOpen,
  user,
  onClose,
  onUnlockClick,
  onExtendClick
}) => {
  const { getSuspensionHistory } = useAlumni();
  const [history, setHistory] = useState<SuspensionHistoryEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let active = true;
    if (isOpen && user) {
      setLoading(true);
      getSuspensionHistory(user.uid)
        .then((entries) => {
          if (active) {
            setHistory(entries || []);
            setLoading(false);
          }
        })
        .catch(() => {
          if (active) {
            setHistory(user.suspensionInfo?.history || []);
            setLoading(false);
          }
        });
    }
    return () => {
      active = false;
    };
  }, [isOpen, user, getSuspensionHistory]);

  if (!isOpen || !user) return null;

  const currentStatus = (user.accountStatus || user.status || 'ACTIVE').toUpperCase();
  const suspension = user.suspensionInfo;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-2xl bg-white dark:bg-stone-900 rounded-[28px] shadow-[0_20px_60px_rgba(0,0,0,0.3)] border border-stone-200/90 dark:border-stone-800 overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Institutional Top Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#8B181B] via-amber-600 to-stone-800 shrink-0" />

        {/* Header */}
        <div className="px-6 py-5 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 flex items-center justify-center ring-1 ring-stone-200 shrink-0">
              <History className="w-5 h-5 stroke-[2]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900 dark:text-white tracking-tight">
                Account Suspension & Security History
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Audit trail for {user.name} ({user.role})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4 stroke-[2]" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-6 space-y-6 text-xs">
          {/* Current State Card */}
          <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200/80 dark:border-stone-700/60 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Current Status</span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                  currentStatus === 'ACTIVE'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : currentStatus === 'SUSPENDED'
                    ? 'bg-amber-50 text-amber-900 border-amber-200'
                    : currentStatus === 'LOCKED'
                    ? 'bg-rose-50 text-rose-800 border-rose-200'
                    : 'bg-stone-100 text-stone-700 border-stone-200'
                }`}
              >
                {currentStatus}
              </span>
            </div>

            {suspension && (
              <div className="space-y-1.5 text-xs text-stone-700 dark:text-stone-300">
                <p>
                  <strong>Recorded Reason:</strong> {suspension.reason}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-stone-500 pt-1">
                  <div>
                    <span>Start: </span>
                    <span className="font-mono text-stone-800 dark:text-stone-200">
                      {new Date(suspension.startDate).toLocaleString('en-US', { timeZone: 'Asia/Manila' })}
                    </span>
                  </div>
                  {suspension.endDate ? (
                    <div>
                      <span>Expires: </span>
                      <span className="font-mono text-stone-800 dark:text-stone-200">
                        {new Date(suspension.endDate).toLocaleString('en-US', { timeZone: 'Asia/Manila' })}
                      </span>
                    </div>
                  ) : (
                    <div>
                      <span>Duration: </span>
                      <span className="font-semibold text-rose-600">Permanent Lockout (Manual Unlock Required)</span>
                    </div>
                  )}
                </div>
                {suspension.suspendedByName && (
                  <p className="text-[11px] text-stone-500">
                    Enforced by: <strong>{suspension.suspendedByName}</strong>
                  </p>
                )}
              </div>
            )}

            {/* Quick Actions if Suspended or Locked */}
            {(currentStatus === 'SUSPENDED' || currentStatus === 'LOCKED') && (
              <div className="pt-2 flex items-center gap-2 border-t border-stone-200/60 dark:border-stone-700/60">
                {onUnlockClick && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onUnlockClick();
                    }}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    <span>Unlock Account Now</span>
                  </button>
                )}
                {currentStatus === 'SUSPENDED' && onExtendClick && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onExtendClick();
                    }}
                    className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Extend Suspension</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Timeline of History Entries */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400">
              Audit Event Timeline ({history.length})
            </h3>

            {loading ? (
              <div className="py-8 text-center text-stone-400 text-xs">
                Loading audit trail...
              </div>
            ) : history.length === 0 ? (
              <div className="p-6 rounded-2xl bg-stone-50 dark:bg-stone-800/40 text-center text-stone-500 text-xs">
                No past suspension or lockout events recorded for this account.
              </div>
            ) : (
              <div className="relative pl-6 space-y-5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-stone-200 dark:before:bg-stone-700">
                {history
                  .slice()
                  .reverse()
                  .map((entry) => {
                    const isLock = entry.action === 'ACCOUNT_LOCKED';
                    const isSusp = entry.action === 'ACCOUNT_SUSPENDED';
                    const isUnlock = entry.action === 'ACCOUNT_UNLOCKED';
                    const isAuto = entry.action === 'ACCOUNT_AUTO_RESTORED';
                    const isExt = entry.action === 'ACCOUNT_SUSPENSION_EXTENDED';

                    return (
                      <div key={entry.id} className="relative group">
                        {/* Dot indicator */}
                        <div
                          className={`absolute -left-[27px] top-1 w-4 h-4 rounded-full border-2 border-white dark:border-stone-900 flex items-center justify-center ${
                            isLock || isSusp
                              ? 'bg-rose-600 text-white'
                              : isUnlock || isAuto
                              ? 'bg-emerald-600 text-white'
                              : 'bg-amber-600 text-white'
                          }`}
                        >
                          <div className="w-1.5 h-1.5 bg-white rounded-full" />
                        </div>

                        {/* Card */}
                        <div className="p-3.5 rounded-2xl bg-white dark:bg-stone-800 border border-stone-200/80 dark:border-stone-700/80 space-y-1.5 shadow-2xs">
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`px-2 py-0.5 rounded-md font-bold text-[10px] uppercase tracking-wider ${
                                isLock
                                  ? 'bg-rose-100 text-rose-800'
                                  : isSusp
                                  ? 'bg-amber-100 text-amber-900'
                                  : isUnlock
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : isAuto
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-stone-100 text-stone-800'
                              }`}
                            >
                              {entry.action.replace(/_/g, ' ')}
                            </span>
                            <span className="text-[10px] text-stone-400 font-mono">
                              {new Date(entry.timestamp).toLocaleString('en-US', {
                                timeZone: 'Asia/Manila',
                                dateStyle: 'short',
                                timeStyle: 'short'
                              })}
                            </span>
                          </div>

                          <p className="text-xs text-stone-800 dark:text-stone-200">
                            <strong>Reason:</strong> {entry.reason}
                          </p>

                          {entry.endDate && (
                            <p className="text-[11px] text-stone-500">
                              Duration: until{' '}
                              <span className="font-mono">
                                {new Date(entry.endDate).toLocaleString('en-US', { timeZone: 'Asia/Manila' })}
                              </span>
                            </p>
                          )}

                          <div className="pt-1 text-[10px] text-stone-400 flex items-center gap-1.5">
                            <span>Actor:</span>
                            <span className="font-semibold text-stone-600 dark:text-stone-300">
                              {entry.adminName || 'System'}
                            </span>
                            {entry.adminRole && (
                              <span className="uppercase text-[9px] px-1 bg-stone-100 dark:bg-stone-700 rounded">
                                {entry.adminRole}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-stone-50 dark:bg-stone-800/60 border-t border-stone-100 dark:border-stone-800 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-stone-200 dark:bg-stone-700 text-stone-800 dark:text-stone-200 font-semibold text-xs hover:bg-stone-300 dark:hover:bg-stone-600 transition-colors cursor-pointer"
          >
            Close History
          </button>
        </div>
      </div>
    </div>
  );
};
