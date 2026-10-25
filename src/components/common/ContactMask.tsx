import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { triggerHaptic } from '../../services/hapticsService';

interface ContactMaskProps {
  value?: string | null;
  type?: 'phone' | 'studentId' | 'email' | 'generic';
  label?: string;
  className?: string;
  autoRemaskTimeout?: number; // in milliseconds (defaults to 10s)
}

/**
 * ContactMask Component
 * Privacy protection component that masks sensitive identifiers
 * (telephone numbers, student/member IDs, email prefixes) by default.
 * Provides tap-to-reveal toggle with automatic re-masking.
 */
export const ContactMask: React.FC<ContactMaskProps> = ({
  value,
  type = 'generic',
  label,
  className = '',
  autoRemaskTimeout = 10000
}) => {
  const [isRevealed, setIsRevealed] = useState(false);

  useEffect(() => {
    if (!isRevealed) return;
    const timer = setTimeout(() => {
      setIsRevealed(false);
    }, autoRemaskTimeout);
    return () => clearTimeout(timer);
  }, [isRevealed, autoRemaskTimeout]);

  if (!value) {
    return <span className="text-stone-400 dark:text-stone-500 italic text-xs">Not specified</span>;
  }

  const getMaskedValue = (val: string): string => {
    const trimmed = val.trim();
    if (type === 'phone') {
      // E.g. +63 917 123 4567 -> +63 9•• ••• •567
      if (trimmed.length > 7) {
        const start = trimmed.slice(0, 5);
        const end = trimmed.slice(-3);
        return `${start} ••• ••• •${end}`;
      }
      return '••••••••••';
    }

    if (type === 'studentId') {
      // E.g. SCC-2020-0192 -> SCC-••••-0192
      const parts = trimmed.split('-');
      if (parts.length >= 3) {
        return `${parts[0]}-••••-${parts[parts.length - 1]}`;
      }
      if (trimmed.length > 4) {
        return `${trimmed.slice(0, 3)}••••${trimmed.slice(-3)}`;
      }
      return '••••••••';
    }

    if (type === 'email') {
      // E.g. alumnus@gmail.com -> a••••••@gmail.com
      const [local, domain] = trimmed.split('@');
      if (domain && local.length > 2) {
        return `${local[0]}${'•'.repeat(Math.min(local.length - 1, 6))}@${domain}`;
      }
      return trimmed;
    }

    // Generic masking
    if (trimmed.length > 6) {
      return `${trimmed.slice(0, 2)}${'•'.repeat(Math.min(trimmed.length - 4, 6))}${trimmed.slice(-2)}`;
    }
    return '••••••••';
  };

  const toggleReveal = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic?.('light');
    setIsRevealed((prev) => !prev);
  };

  return (
    <span className={`inline-flex items-center gap-1.5 font-mono select-none ${className}`}>
      <span className={isRevealed ? 'text-stone-900 dark:text-stone-100 font-semibold' : 'text-stone-600 dark:text-stone-300'}>
        {isRevealed ? value : getMaskedValue(value)}
      </span>

      <button
        type="button"
        onClick={toggleReveal}
        className="p-1 rounded-md text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer shrink-0"
        title={isRevealed ? 'Mask sensitive data' : 'Tap to reveal (auto-masks in 10s)'}
        aria-label={isRevealed ? 'Mask' : 'Reveal'}
      >
        {isRevealed ? (
          <EyeOff className="w-3.5 h-3.5 stroke-[1.75]" />
        ) : (
          <Eye className="w-3.5 h-3.5 stroke-[1.75]" />
        )}
      </button>

      {isRevealed && (
        <span className="text-[9px] font-sans font-medium text-amber-600 dark:text-amber-400 animate-in fade-in">
          (auto-masks)
        </span>
      )}
    </span>
  );
};
