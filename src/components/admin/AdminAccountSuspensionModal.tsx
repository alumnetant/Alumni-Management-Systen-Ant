/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  Clock,
  Calendar,
  Lock,
  UserX,
  X,
  Check,
  Info,
  CalendarClock,
  Sparkles,
  RotateCcw,
  ShieldCheck
} from 'lucide-react';
import { UserProfile, UserRole } from '../../types';

export interface AdminAccountSuspensionModalProps {
  isOpen: boolean;
  user: UserProfile | null;
  mode?: 'suspend' | 'lock' | 'extend';
  onClose: () => void;
  onConfirm: (data: {
    startDate: string;
    endDate?: string;
    reason: string;
    isPermanentLock?: boolean;
  }) => Promise<void> | void;
}

export type DurationPreset = '1h' | '24h' | '3d' | '7d' | '15d' | '30d' | 'custom';

const REASON_TEMPLATES = [
  'Suspicious account sharing',
  'Multiple people detected using one account',
  'Repeated incorrect login attempts',
  'Unauthorized access attempts',
  'Violation of institutional account policies',
  'Administrative investigation'
];

/**
 * Calculates local datetime-local string (YYYY-MM-DDTHH:mm) from a Date object
 */
function toLocalDatetimeString(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Add specified duration to a base date
 */
function calculateEndDate(base: Date, preset: DurationPreset): Date {
  const target = new Date(base.getTime());
  switch (preset) {
    case '1h':
      target.setHours(target.getHours() + 1);
      break;
    case '24h':
      target.setHours(target.getHours() + 24);
      break;
    case '3d':
      target.setDate(target.getDate() + 3);
      break;
    case '7d':
      target.setDate(target.getDate() + 7);
      break;
    case '15d':
      target.setDate(target.getDate() + 15);
      break;
    case '30d':
      target.setDate(target.getDate() + 30);
      break;
    case 'custom':
    default:
      target.setDate(target.getDate() + 7);
      break;
  }
  return target;
}

export const AdminAccountSuspensionModal: React.FC<AdminAccountSuspensionModalProps> = ({
  isOpen,
  user,
  mode = 'suspend',
  onClose,
  onConfirm
}) => {
  const [actionType, setActionType] = useState<'suspend' | 'lock'>(
    mode === 'lock' ? 'lock' : 'suspend'
  );
  const [durationPreset, setDurationPreset] = useState<DurationPreset>('7d');
  const [startDateStr, setStartDateStr] = useState<string>(() => toLocalDatetimeString(new Date()));
  const [endDateStr, setEndDateStr] = useState<string>(() => {
    return toLocalDatetimeString(calculateEndDate(new Date(), '7d'));
  });
  const [reason, setReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Synchronize modal state on open or user change
  useEffect(() => {
    if (isOpen && user) {
      const now = new Date();
      setStartDateStr(toLocalDatetimeString(now));
      if (mode === 'lock') {
        setActionType('lock');
        setDurationPreset('custom');
      } else if (mode === 'extend') {
        setActionType('suspend');
        setDurationPreset('7d');
        const existingEnd = user.suspensionInfo?.endDate || user.suspensionEndDate;
        const base = existingEnd ? new Date(existingEnd) : now;
        setEndDateStr(toLocalDatetimeString(calculateEndDate(base, '7d')));
        setReason(user.suspensionInfo?.reason || user.suspensionReason || '');
      } else {
        setActionType('suspend');
        setDurationPreset('7d');
        setEndDateStr(toLocalDatetimeString(calculateEndDate(now, '7d')));
        setReason('');
      }
      setErrorMsg(null);
      setIsSubmitting(false);
    }
  }, [isOpen, user, mode]);

  // Handle duration preset selection
  const handlePresetSelect = (preset: DurationPreset) => {
    setDurationPreset(preset);
    if (preset !== 'custom') {
      const base = startDateStr ? new Date(startDateStr) : new Date();
      const calculated = calculateEndDate(base, preset);
      setEndDateStr(toLocalDatetimeString(calculated));
    }
  };

  // Handle start date modification
  const handleStartDateChange = (val: string) => {
    setStartDateStr(val);
    if (durationPreset !== 'custom' && val) {
      const base = new Date(val);
      if (!isNaN(base.getTime())) {
        const calculated = calculateEndDate(base, durationPreset);
        setEndDateStr(toLocalDatetimeString(calculated));
      }
    }
  };

  // Quick reason click
  const handleSelectTemplate = (template: string) => {
    setReason((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return template;
      if (trimmed.includes(template)) return trimmed;
      return `${trimmed}. ${template}`;
    });
    setErrorMsg(null);
  };

  // Validation
  const isValid = useMemo(() => {
    if (!reason || reason.trim().length < 5) return false;
    if (actionType === 'suspend') {
      if (!startDateStr || !endDateStr) return false;
      const start = new Date(startDateStr).getTime();
      const end = new Date(endDateStr).getTime();
      if (isNaN(start) || isNaN(end) || end <= start) return false;
    }
    return true;
  }, [reason, actionType, startDateStr, endDateStr]);

  if (!isOpen || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) {
      if (!reason || reason.trim().length < 5) {
        setErrorMsg('Please provide a specific explanation of at least 5 characters.');
      } else if (actionType === 'suspend') {
        const start = new Date(startDateStr).getTime();
        const end = new Date(endDateStr).getTime();
        if (end <= start) {
          setErrorMsg('Suspension end time must be after the start time.');
        }
      }
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      const isLock = actionType === 'lock';
      const startIso = new Date(startDateStr).toISOString();
      const endIso = isLock ? undefined : new Date(endDateStr).toISOString();

      await onConfirm({
        startDate: startIso,
        endDate: endIso,
        reason: reason.trim(),
        isPermanentLock: isLock
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to apply suspension.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentStatus = (user.accountStatus || user.status || 'ACTIVE').toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-2xl bg-white dark:bg-stone-900 rounded-[28px] shadow-[0_20px_60px_rgba(0,0,0,0.3)] border border-stone-200/90 dark:border-stone-800 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Institutional St. Cecilia Crimson Top Trim */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#8B181B] via-rose-700 to-amber-600 shrink-0" />

        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-red-50 dark:bg-red-950/40 text-[#8B181B] dark:text-red-300 flex items-center justify-center ring-1 ring-red-200/80 dark:ring-red-900/60 shrink-0">
              {actionType === 'lock' ? (
                <Lock className="w-5 h-5 stroke-[2]" />
              ) : (
                <ShieldAlert className="w-5 h-5 stroke-[2]" />
              )}
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900 dark:text-white tracking-tight">
                {mode === 'extend'
                  ? 'Extend Account Suspension'
                  : actionType === 'lock'
                  ? 'Lock Account Confirmation'
                  : 'Suspend Account & Schedule Duration'}
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                St. Cecilia's College • Institutional Access Control
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

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-5 text-xs text-stone-700 dark:text-stone-300">
          {/* Target Account Summary Banner */}
          <div className="bg-stone-50 dark:bg-stone-800/60 rounded-2xl p-4 border border-stone-200/70 dark:border-stone-700/60 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Target Member</span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                  currentStatus === 'ACTIVE'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : currentStatus === 'SUSPENDED'
                    ? 'bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300'
                    : currentStatus === 'LOCKED'
                    ? 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300'
                    : 'bg-stone-100 text-stone-700 border-stone-200'
                }`}
              >
                Current Status: {currentStatus}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <p className="text-sm font-bold text-stone-900 dark:text-white truncate">{user.name}</p>
                <p className="text-xs text-stone-500 font-mono truncate">{user.email || user.uid}</p>
              </div>
              <div className="sm:text-right space-y-0.5">
                <p className="text-xs font-semibold text-stone-800 dark:text-stone-200">
                  Role: <span className="font-bold text-[#8B181B] dark:text-rose-400 uppercase">{user.role}</span>
                </p>
                {user.studentId && (
                  <p className="text-[11px] text-stone-500 font-mono">ID: {user.studentId}</p>
                )}
                {user.employeeId && (
                  <p className="text-[11px] text-stone-500 font-mono">Emp ID: {user.employeeId}</p>
                )}
              </div>
            </div>
          </div>

          {/* Action Type Toggle (Scheduled Suspension vs Permanent Lock) */}
          {mode !== 'extend' && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-stone-900 dark:text-white flex items-center gap-1.5">
                <span>Enforcement Action</span>
              </label>
              <div className="grid grid-cols-2 gap-2.5 p-1 bg-stone-100 dark:bg-stone-800 rounded-2xl border border-stone-200/80 dark:border-stone-700">
                <button
                  type="button"
                  onClick={() => setActionType('suspend')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    actionType === 'suspend'
                      ? 'bg-white dark:bg-stone-900 text-[#8B181B] dark:text-rose-400 shadow-2xs'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                  }`}
                >
                  <CalendarClock className="w-3.5 h-3.5" />
                  <span>Scheduled Suspension</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActionType('lock')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    actionType === 'lock'
                      ? 'bg-white dark:bg-stone-900 text-rose-700 dark:text-rose-400 shadow-2xs'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Permanent Lockout</span>
                </button>
              </div>
            </div>
          )}

          {/* Duration Options (for Scheduled Suspension) */}
          {actionType === 'suspend' && (
            <div className="space-y-3.5 p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/40">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-amber-950 dark:text-amber-200 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                  <span>Suspension Duration Options</span>
                </label>
                <span className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                  Auto-restores to ACTIVE at expiration
                </span>
              </div>

              {/* Preset Duration Buttons */}
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                {[
                  { id: '1h', label: '1 hour' },
                  { id: '24h', label: '24 hours' },
                  { id: '3d', label: '3 days' },
                  { id: '7d', label: '7 days' },
                  { id: '15d', label: '15 days' },
                  { id: '30d', label: '30 days' },
                  { id: 'custom', label: 'Custom' }
                ].map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handlePresetSelect(preset.id as DurationPreset)}
                    className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all border text-center cursor-pointer ${
                      durationPreset === preset.id
                        ? 'bg-[#8B181B] text-white border-[#8B181B] shadow-2xs ring-1 ring-[#8B181B]'
                        : 'bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 border-stone-200/80 dark:border-stone-700 hover:border-amber-400'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Start & End Date Pickers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-stone-600 dark:text-stone-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-stone-400" />
                    <span>Suspension Start Date & Time</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={startDateStr}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-white focus:ring-1 focus:ring-[#8B181B] focus:outline-hidden"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-stone-600 dark:text-stone-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-stone-400" />
                    <span>Suspension End Date & Time</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={endDateStr}
                    onChange={(e) => {
                      setEndDateStr(e.target.value);
                      setDurationPreset('custom');
                    }}
                    required
                    className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-white focus:ring-1 focus:ring-[#8B181B] focus:outline-hidden"
                  />
                </div>
              </div>

              {endDateStr && (
                <div className="text-[11px] text-amber-800 dark:text-amber-300 flex items-center gap-1.5 pt-1">
                  <Info className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Scheduled to auto-restore on:{' '}
                    <strong>
                      {new Date(endDateStr).toLocaleString('en-US', {
                        timeZone: 'Asia/Manila',
                        dateStyle: 'medium',
                        timeStyle: 'short'
                      })}
                    </strong>
                  </span>
                </div>
              )}
            </div>
          )}

          {actionType === 'lock' && (
            <div className="p-4 rounded-2xl bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/50 space-y-2">
              <div className="flex items-center gap-2 text-rose-900 dark:text-rose-200 font-bold text-xs">
                <AlertTriangle className="w-4 h-4 text-rose-700 dark:text-rose-400 shrink-0" />
                <span>Permanent Administrative Lockout Notice</span>
              </div>
              <p className="text-[11px] text-rose-800 dark:text-rose-300 leading-relaxed">
                This account will be disabled immediately with NO automatic expiration date. The account cannot log in until an authorized administrator manually unlocks it.
              </p>
            </div>
          )}

          {/* Required Reason for Account Suspension */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="suspension-reason" className="text-xs font-bold text-stone-900 dark:text-white flex items-center gap-1.5">
                <span>Reason for Account Suspension</span>
                <span className="text-rose-600 font-bold">*</span>
              </label>
              <span className="text-[10px] text-stone-400">Recorded in activity logs & user notice</span>
            </div>

            {/* Quick-Select Template Chips */}
            <div className="flex flex-wrap gap-1.5">
              {REASON_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl}
                  type="button"
                  onClick={() => handleSelectTemplate(tmpl)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-[#8B181B] hover:text-white border border-stone-200/80 dark:border-stone-700 transition-colors cursor-pointer text-left"
                >
                  + {tmpl}
                </button>
              ))}
            </div>

            {/* Textarea for Custom Explanation */}
            <textarea
              id="suspension-reason"
              rows={3}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setErrorMsg(null);
              }}
              placeholder="Enter explanation for suspending this account (e.g., Suspicious concurrent account access detected from distinct locations, pending registrar review)..."
              required
              className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-white placeholder:text-stone-400 focus:ring-1 focus:ring-[#8B181B] focus:outline-hidden"
            />
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 text-red-800 border border-red-200 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Security & Revocation Notice */}
          <div className="p-3.5 rounded-xl bg-stone-100/70 dark:bg-stone-800/40 border border-stone-200/60 dark:border-stone-700/60 flex items-start gap-2 text-[11px] text-stone-500 leading-relaxed">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              Upon confirmation, active session tokens for <strong>{user.name}</strong> will be revoked immediately and an audit log with warning notification will be recorded in the security ledger.
            </span>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 font-semibold text-xs hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={!isValid || isSubmitting}
              className={`px-5 py-2.5 rounded-xl text-white font-bold text-xs transition-all flex items-center gap-1.5 shadow-2xs ${
                actionType === 'lock'
                  ? 'bg-rose-700 hover:bg-rose-800 disabled:bg-rose-300'
                  : 'bg-[#8B181B] hover:bg-[#721316] disabled:bg-stone-300 dark:disabled:bg-stone-800'
              } cursor-pointer disabled:cursor-not-allowed`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>
                    {mode === 'extend'
                      ? 'Confirm Extension'
                      : actionType === 'lock'
                      ? 'Confirm Lock Account'
                      : 'Confirm Suspension'}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
