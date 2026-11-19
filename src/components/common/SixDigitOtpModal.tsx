/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ShieldCheck,
  X,
  Copy,
  Check,
  RotateCw,
  AlertCircle,
  Mail,
  Lock,
  WifiOff
} from 'lucide-react';
import { motion } from 'framer-motion';
import { apiFetch, getAuthToken } from '../../services/apiClient';
import { generateSecureNumericCode } from '../../lib/secureId';

interface SixDigitOtpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
  title: string;
  subtitle?: string;
  targetDestination?: string; // e.g. new email address or registered account email
  actionType: 'email' | 'password';
}

export const SixDigitOtpModal: React.FC<SixDigitOtpModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  title,
  subtitle,
  targetDestination,
  actionType
}) => {
  const [offlineFallbackCode, setOfflineFallbackCode] = useState<string | null>(null);
  const [deliveryStatus, setDeliveryStatus] = useState<'sending' | 'email' | 'offline_fallback' | 'error'>('sending');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const dispatchVerificationCode = useCallback(async () => {
    const target = (targetDestination || '').trim().toLowerCase();
    setDigits(['', '', '', '', '', '']);
    setErrorMsg(null);
    setCopied(false);

    if (!target) {
      setDeliveryStatus('error');
      setErrorMsg('Target email address is missing.');
      return;
    }

    setIsSending(true);
    setDeliveryStatus('sending');
    setOfflineFallbackCode(null);
    setStatusMessage('Sending 6-digit verification code...');

    const createLocalOfflineFallback = () => {
      const code = generateSecureNumericCode(100000, 999999).toString();
      setOfflineFallbackCode(code);
      setDeliveryStatus('offline_fallback');
      setStatusMessage(
        `Offline mode detected. Use this local preview code to verify ${target}:`
      );
      setResendCooldown(60);
    };

    try {
      const hasToken = Boolean(getAuthToken());
      const isOnline = typeof navigator === 'undefined' ? true : navigator.onLine;

      if (!isOnline || (actionType === 'email' && !hasToken)) {
        createLocalOfflineFallback();
        return;
      }

      const endpoint =
        actionType === 'email' ? '/api/auth/email-change/send-otp' : '/api/auth/send-otp';
      const bodyPayload =
        actionType === 'email' ? { newEmail: target } : { email: target };

      const res = await apiFetch(
        endpoint,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyPayload)
        },
        8000
      );

      if (res.status === 401 && !hasToken) {
        createLocalOfflineFallback();
        return;
      }

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 429 && typeof data?.retryAfter === 'number') {
          setResendCooldown(data.retryAfter);
        }
        setDeliveryStatus('error');
        setErrorMsg(data?.error || 'Could not dispatch verification code. Please try again.');
        return;
      }

      setResendCooldown(60);
      if (data?.deliveryMode === 'offline_fallback' && data?.offlineFallbackCode) {
        setOfflineFallbackCode(String(data.offlineFallbackCode));
        setDeliveryStatus('offline_fallback');
        setStatusMessage(
          data?.message ||
            `Mail server is offline. Use this preview code for ${target}:`
        );
      } else {
        setOfflineFallbackCode(null);
        setDeliveryStatus('email');
        setStatusMessage(
          data?.message ||
            `A 6-digit verification code has been emailed to ${target}. Check your inbox and spam folder.`
        );
      }
    } catch {
      createLocalOfflineFallback();
    } finally {
      setIsSending(false);
    }
  }, [actionType, targetDestination]);

  useEffect(() => {
    if (isOpen) {
      void dispatchVerificationCode();
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 120);
    }
  }, [isOpen, dispatchVerificationCode]);

  useEffect(() => {
    if (!isOpen || resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, resendCooldown]);

  if (!isOpen) return null;

  const handleCopyFallbackCode = () => {
    if (!offlineFallbackCode) return;
    navigator.clipboard?.writeText(offlineFallbackCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    setDigits(offlineFallbackCode.split(''));
    setErrorMsg(null);
    inputRefs.current[5]?.focus();
  };

  const handleDigitChange = (index: number, value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (!cleaned && value !== '') return;

    const newDigits = [...digits];

    if (cleaned.length > 1) {
      const chars = cleaned.slice(0, 6).split('');
      for (let i = 0; i < 6; i++) {
        newDigits[i] = chars[i] || '';
      }
      setDigits(newDigits);
      const nextIndex = Math.min(chars.length, 5);
      inputRefs.current[nextIndex]?.focus();
    } else {
      newDigits[index] = cleaned;
      setDigits(newDigits);
      if (cleaned && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    }
    setErrorMsg(null);
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const entered = digits.join('');
    if (entered.length < 6) {
      setErrorMsg('Please enter all 6 digits of the verification code.');
      return;
    }

    const target = (targetDestination || '').trim().toLowerCase();
    setIsVerifying(true);
    setErrorMsg(null);

    try {
      const isOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
      const hasToken = Boolean(getAuthToken());

      if (!isOnline || (!hasToken && offlineFallbackCode)) {
        if (!offlineFallbackCode || entered !== offlineFallbackCode) {
          setErrorMsg('Invalid verification code. Please check the code and try again.');
          return;
        }
        await onSuccess();
        return;
      }

      const verifyEndpoint =
        actionType === 'email' ? '/api/auth/email-change/confirm' : '/api/auth/verify-otp';
      const verifyBody =
        actionType === 'email'
          ? { newEmail: target, otp: entered }
          : { email: target, otp: entered };

      const res = await apiFetch(
        verifyEndpoint,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(verifyBody)
        },
        8000
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(data?.error || 'Invalid or expired verification code.');
        return;
      }

      await onSuccess();
    } catch {
      if (offlineFallbackCode && entered === offlineFallbackCode) {
        await onSuccess();
        return;
      }
      setErrorMsg('Unable to verify code right now. Please check your connection and try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-stone-950/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-[#1c1917] rounded-3xl border border-stone-200 dark:border-stone-800 shadow-2xl max-w-md w-full p-6 sm:p-7 relative overflow-hidden text-stone-900 dark:text-stone-100"
      >
        <div className="h-1.5 absolute top-0 left-0 right-0 bg-[#8B181B]" />

        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-stone-100 dark:border-stone-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-red-50 dark:bg-red-950/40 text-[#8B181B] dark:text-red-400 flex items-center justify-center border border-red-200/70 dark:border-red-900/50 shadow-2xs shrink-0">
              {actionType === 'email' ? <Mail className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold font-sans tracking-tight text-stone-900 dark:text-stone-100">
                {title}
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                {subtitle || 'Security Identity Verification Required'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="mt-5 space-y-5">
          {/* Email Dispatch Status Banner (with fallback preview ONLY when offline/unconfigured) */}
          {deliveryStatus === 'offline_fallback' && offlineFallbackCode ? (
            <div className="p-3.5 bg-amber-50/80 dark:bg-amber-950/30 rounded-2xl border border-amber-200/80 dark:border-amber-900/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                  <WifiOff className="w-3.5 h-3.5" />
                  <span>Offline Preview Code</span>
                </span>
                <button
                  type="button"
                  onClick={handleCopyFallbackCode}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-700 text-xs font-semibold text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-stone-700 shadow-2xs transition-colors cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-emerald-700 dark:text-emerald-400">Filled</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 text-stone-500" />
                      <span>Use Code</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-stone-700 dark:text-stone-300 leading-snug">
                  {statusMessage}
                </p>
                <span className="font-mono text-sm font-extrabold text-[#8B181B] dark:text-red-300 tracking-widest bg-white dark:bg-black/40 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-800/50 shrink-0">
                  {offlineFallbackCode}
                </span>
              </div>
            </div>
          ) : (
            <div className="p-3.5 bg-stone-50 dark:bg-stone-900/70 rounded-2xl border border-stone-200/80 dark:border-stone-800 space-y-1">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#8B181B] dark:text-red-400">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{isSending ? 'Dispatching Email...' : 'Verification Email Sent'}</span>
              </div>
              <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                {statusMessage || (
                  <>
                    Code dispatched to <span className="font-semibold text-stone-900 dark:text-white">{targetDestination}</span>.
                  </>
                )}
              </p>
            </div>
          )}

          {/* 6 Digit Input Boxes */}
          <div>
            <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-2 text-center">
              ENTER 6-DIGIT VERIFICATION CODE
            </label>
            <div className="flex items-center justify-center gap-2 sm:gap-2.5">
              {digits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => {
                    inputRefs.current[idx] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={digit}
                  onChange={(e) => handleDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  className={`w-11 h-13 sm:w-12 sm:h-14 text-center text-xl font-bold font-mono rounded-xl border bg-stone-50 dark:bg-stone-900 text-stone-900 dark:text-stone-100 focus:bg-white dark:focus:bg-stone-850 focus:outline-hidden transition-all ${
                    digit
                      ? 'border-[#8B181B] dark:border-red-500 shadow-xs ring-1 ring-[#8B181B]/20'
                      : 'border-stone-200 dark:border-stone-700'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 rounded-xl border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 flex items-center gap-2 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Resend Link */}
          <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400 pt-1">
            <span>Didn't receive the code?</span>
            {resendCooldown > 0 ? (
              <span className="font-mono text-[11px] text-stone-400">Resend in {resendCooldown}s</span>
            ) : (
              <button
                type="button"
                disabled={isSending}
                onClick={() => void dispatchVerificationCode()}
                className="text-[#8B181B] dark:text-red-400 font-bold hover:underline cursor-pointer inline-flex items-center gap-1 disabled:opacity-50"
              >
                <RotateCw className={`w-3 h-3 ${isSending ? 'animate-spin' : ''}`} />
                <span>Resend Code</span>
              </button>
            )}
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 text-xs font-semibold hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={digits.join('').length < 6 || isVerifying || isSending}
              onClick={() => void handleVerify()}
              className="px-5 py-2.5 bg-[#8B181B] hover:bg-[#721316] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isVerifying ? (
                <>
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <span>Verify & Confirm</span>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
