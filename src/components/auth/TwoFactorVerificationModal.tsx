import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, Mail, RefreshCw, ArrowLeft, KeyRound, AlertCircle, CheckCircle2 } from 'lucide-react';

interface TwoFactorVerificationModalProps {
  isOpen: boolean;
  userEmail: string;
  userName?: string;
  onVerifySuccess: () => void;
  onCancel: () => void;
}

export const TwoFactorVerificationModal: React.FC<TwoFactorVerificationModalProps> = ({
  isOpen,
  userEmail,
  userName = 'Member',
  onVerifySuccess,
  onCancel
}) => {
  const [codeDigits, setCodeDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState<number>(60);
  const [codeNotification, setCodeNotification] = useState<string | null>(null);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Generate a cryptographically styled 6-digit OTP
  const generateNewCode = () => {
    const freshCode = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedCode(freshCode);
    setCodeDigits(['', '', '', '', '', '']);
    setErrorMessage('');
    setResendCooldown(60);

    // Show institutional email dispatch simulation notification
    const masked = maskEmail(userEmail);
    setCodeNotification(`One-time security code: ${freshCode} (Dispatched to ${masked})`);

    // Auto-focus first input
    setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 150);
  };

  useEffect(() => {
    if (isOpen) {
      generateNewCode();
    }
  }, [isOpen]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const maskEmail = (email: string) => {
    if (!email || !email.includes('@')) return email || 'your registered email';
    const [name, domain] = email.split('@');
    if (name.length <= 2) return `${name}***@${domain}`;
    return `${name[0]}***${name[name.length - 1]}@${domain}`;
  };

  const handleDigitChange = (index: number, value: string) => {
    // Only accept numeric inputs
    const cleanVal = value.replace(/\D/g, '');
    if (!cleanVal && value !== '') return;

    const newDigits = [...codeDigits];

    if (cleanVal.length > 1) {
      // User pasted full code or multiple digits
      const pastedDigits = cleanVal.slice(0, 6).split('');
      pastedDigits.forEach((digit, i) => {
        if (i < 6) newDigits[i] = digit;
      });
      setCodeDigits(newDigits);
      const nextFocus = Math.min(pastedDigits.length, 5);
      inputRefs.current[nextFocus]?.focus();

      // If full 6 digits filled by paste, auto verify
      if (pastedDigits.length >= 6) {
        verifyEnteredCode(newDigits.join(''));
      }
      return;
    }

    newDigits[index] = cleanVal;
    setCodeDigits(newDigits);
    setErrorMessage('');

    // Move to next input if filled
    if (cleanVal && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-verify if all 6 digits are provided
    if (cleanVal && index === 5 && newDigits.every((d) => d.length === 1)) {
      verifyEnteredCode(newDigits.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !codeDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const verifyEnteredCode = (enteredCode: string) => {
    setIsVerifying(true);
    setErrorMessage('');

    setTimeout(() => {
      if (enteredCode === generatedCode) {
        setIsVerifying(false);
        onVerifySuccess();
      } else {
        setIsVerifying(false);
        setErrorMessage('The 6-digit security code entered is incorrect. Please check the code and try again.');
      }
    }, 350);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const fullCode = codeDigits.join('');
    if (fullCode.length < 6) {
      setErrorMessage('Please enter all 6 digits of your security code.');
      return;
    }
    verifyEnteredCode(fullCode);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 dark:bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.03)] overflow-hidden">
        {/* Accent Bar */}
        <div className="h-1.5 w-full bg-[#8B181B]" />

        <div className="p-6 sm:p-8">
          {/* Header */}
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/60 flex items-center justify-center text-[#8B181B] dark:text-red-400 shrink-0">
              <KeyRound className="w-5 h-5 stroke-[1.75]" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#8B181B] dark:text-red-400">
                Two-Step Verification
              </span>
              <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100 tracking-tight">
                Enter Security Code
              </h3>
            </div>
          </div>

          <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed mb-4">
            Hello <strong className="text-stone-800 dark:text-stone-200">{userName}</strong>, for your security, we have dispatched a 6-digit one-time verification code to{' '}
            <strong className="text-stone-900 dark:text-stone-100 font-mono">{maskEmail(userEmail)}</strong>.
          </p>

          {/* Institutional Simulation Dispatch Banner */}
          {codeNotification && (
            <div className="mb-5 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-emerald-800 dark:text-emerald-300">
                  Institutional Email Dispatched
                </p>
                <p className="font-mono font-bold text-sm tracking-wider mt-0.5 text-[#8B181B] dark:text-red-400">
                  {codeNotification}
                </p>
                <p className="text-[10px] text-emerald-700 dark:text-emerald-400/80 mt-1">
                  Code expires in 10 minutes. Enter the code below or click resend if needed.
                </p>
              </div>
            </div>
          )}

          {/* 6-Digit Code Input Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="flex justify-between gap-2 sm:gap-2.5">
              {codeDigits.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => { inputRefs.current[index] = el; }}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleDigitChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className="w-12 h-13 text-center text-xl font-bold font-mono bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl focus:bg-white dark:focus:bg-stone-900 focus:outline-hidden focus:ring-2 focus:ring-[#8B181B]/20 focus:border-[#8B181B] transition-all"
                  aria-label={`Digit ${index + 1}`}
                />
              ))}
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-800 dark:text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span className="font-medium">{errorMessage}</span>
              </div>
            )}

            {/* Resend & Action Buttons */}
            <div className="pt-2 flex items-center justify-between text-xs">
              <span className="text-stone-500 dark:text-stone-400">
                Didn't receive the code?
              </span>
              <button
                type="button"
                disabled={resendCooldown > 0}
                onClick={generateNewCode}
                className="font-semibold text-[#8B181B] hover:text-[#721316] dark:text-red-400 dark:hover:text-red-300 disabled:text-stone-400 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${resendCooldown > 0 ? '' : 'group-hover:rotate-180 transition-transform'}`} />
                <span>
                  {resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : 'Resend Code'}
                </span>
              </button>
            </div>

            <div className="pt-4 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>

              <button
                type="submit"
                disabled={isVerifying || codeDigits.join('').length < 6}
                className="flex-1 px-5 py-2.5 rounded-xl bg-[#8B181B] hover:bg-[#721316] text-white text-xs font-semibold shadow-xs disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{isVerifying ? 'Verifying Code...' : 'Verify & Sign In'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
