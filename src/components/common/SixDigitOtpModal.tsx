/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  KeyRound,
  X,
  Copy,
  Check,
  RotateCw,
  AlertCircle,
  Mail,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SixDigitOtpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title: string;
  subtitle?: string;
  targetDestination?: string; // e.g. "email update" or "password change"
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
  // Generate a random 6-digit code upon modal open
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60);
  const [isVerifying, setIsVerifying] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Regenerate 6-digit code when opened
  const generateNewCode = () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedCode(code);
    setDigits(['', '', '', '', '', '']);
    setErrorMsg(null);
    setResendCooldown(60);
    return code;
  };

  useEffect(() => {
    if (isOpen) {
      generateNewCode();
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Resend countdown timer
  useEffect(() => {
    if (!isOpen || resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, resendCooldown]);

  if (!isOpen) return null;

  const handleCopyCode = () => {
    if (!generatedCode) return;
    navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    // Autofill the digits on copy for extreme ease of use
    setDigits(generatedCode.split(''));
    setErrorMsg(null);
    inputRefs.current[5]?.focus();
  };

  const handleDigitChange = (index: number, value: string) => {
    // Only accept numeric character
    const cleaned = value.replace(/\D/g, '');
    if (!cleaned && value !== '') return;

    const newDigits = [...digits];

    if (cleaned.length > 1) {
      // Pasted string
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

  const handleVerify = () => {
    const entered = digits.join('');
    if (entered.length < 6) {
      setErrorMsg('Please enter all 6 digits of the verification code.');
      return;
    }

    if (entered !== generatedCode) {
      setErrorMsg('Invalid verification code. Please check the code and try again.');
      return;
    }

    setIsVerifying(true);
    setErrorMsg(null);

    setTimeout(() => {
      setIsVerifying(false);
      onSuccess();
    }, 600);
  };

  return (
    <div className="fixed inset-0 bg-stone-950/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-[#1c1917] rounded-3xl border border-stone-200 dark:border-stone-800 shadow-2xl max-w-md w-full p-6 sm:p-7 relative overflow-hidden text-stone-900 dark:text-stone-100"
      >
        {/* Institutional St. Cecilia Deep Crimson Top Line */}
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
          {/* Target Notice & Simulated Code Box */}
          <div className="p-3.5 bg-red-50/60 dark:bg-red-950/30 rounded-2xl border border-red-200/60 dark:border-red-900/40 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#8B181B] dark:text-red-400 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Simulated Security Code</span>
              </span>
              <button
                type="button"
                onClick={handleCopyCode}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-700 text-xs font-semibold text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-stone-700 shadow-2xs transition-colors cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-emerald-700 dark:text-emerald-400">Copied & Filled!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 text-stone-500" />
                    <span>Copy Code</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-stone-600 dark:text-stone-300">
                Code dispatched to: <span className="font-semibold text-stone-900 dark:text-white">{targetDestination}</span>
              </p>
              <span className="font-mono text-sm font-extrabold text-[#8B181B] dark:text-red-300 tracking-widest bg-white/80 dark:bg-black/40 px-2 py-0.5 rounded border border-red-200/50 dark:border-red-900/40">
                {generatedCode}
              </span>
            </div>
          </div>

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
                onClick={generateNewCode}
                className="text-[#8B181B] dark:text-red-400 font-bold hover:underline cursor-pointer inline-flex items-center gap-1"
              >
                <RotateCw className="w-3 h-3" />
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
              disabled={digits.join('').length < 6 || isVerifying}
              onClick={handleVerify}
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
