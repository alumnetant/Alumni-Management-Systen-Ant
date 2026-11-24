/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Bell,
  Briefcase,
  Compass,
  Home,
  Loader2,
  MessageCircle,
  Plus,
  PlusSquare,
  QrCode,
  Search,
  Settings,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { registerBackAction, triggerHaptic } from '../../services/mobileAppService';
import { getUserAvatar, handleUserAvatarError } from '../../lib/defaultImages';

/* ============================================================================
 * 1. MobileButton — Single unified crimson CTA, monochrome secondary, ghost
 * ============================================================================ */
export interface MobileButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
}

export const MobileButton: React.FC<MobileButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  icon,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const variantStyles: Record<NonNullable<MobileButtonProps['variant']>, string> = {
    primary:
      'bg-[#8B181B] hover:bg-[#721316] dark:bg-[#E11D48] dark:hover:bg-[#BE123C] text-white font-semibold border border-transparent',
    secondary:
      'bg-[#F3F4F6] hover:bg-[#E5E7EB] dark:bg-[#262626] dark:hover:bg-[#323232] text-[#111827] dark:text-[#FAFAFA] font-semibold border border-transparent',
    outline:
      'bg-transparent hover:bg-[#F9FAFB] dark:hover:bg-[#1C1C1E] text-[#111827] dark:text-[#FAFAFA] font-semibold border border-[#E5E7EB] dark:border-[#27272A]',
    ghost:
      'bg-transparent hover:bg-[#F3F4F6] dark:hover:bg-[#1C1C1E] text-[#111827] dark:text-[#FAFAFA] font-medium border border-transparent',
    destructive:
      'bg-[#DC2626] hover:bg-[#B91C1C] text-white font-semibold border border-transparent'
  };

  const sizeStyles: Record<NonNullable<MobileButtonProps['size']>, string> = {
    sm: 'min-h-[44px] px-3.5 text-[14px] rounded-xl',
    md: 'min-h-[44px] px-4 text-[14px] rounded-xl',
    lg: 'min-h-[48px] px-5 text-[16px] rounded-xl'
  };

  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 transition-all duration-150 ease-out active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer select-none ${
        variantStyles[variant]
      } ${sizeStyles[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : icon}
      {children}
    </button>
  );
};

/* ============================================================================
 * 2. MobileInput — 16px anti-zoom input with crisp monochrome fill & helper
 * ============================================================================ */
export interface MobileInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightSlot?: React.ReactNode;
  onClear?: () => void;
}

export const MobileInput: React.FC<MobileInputProps> = ({
  label,
  error,
  leftIcon,
  rightSlot,
  onClear,
  className = '',
  value,
  ...props
}) => {
  const hasValue = typeof value === 'string' ? value.length > 0 : Boolean(value);

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label className="block text-[14px] font-semibold text-[#111827] dark:text-[#FAFAFA]">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {leftIcon && (
          <div className="absolute left-3.5 text-[#6B7280] dark:text-[#A1A1AA] pointer-events-none flex items-center">
            {leftIcon}
          </div>
        )}
        <input
          value={value}
          className={`w-full min-h-[46px] rounded-xl bg-[#F3F4F6] dark:bg-[#262626] text-[16px] text-[#111827] dark:text-[#FAFAFA] placeholder:text-[#6B7280] dark:placeholder:text-[#A1A1AA] border transition-colors duration-150 focus:outline-none focus:bg-white dark:focus:bg-[#1C1C1E] ${
            error
              ? 'border-[#DC2626] dark:border-[#F87171]'
              : 'border-transparent focus:border-[#8B181B] dark:focus:border-[#FB7185]'
          } ${leftIcon ? 'pl-10' : 'pl-3.5'} ${rightSlot || onClear ? 'pr-11' : 'pr-3.5'} ${className}`}
          {...props}
        />
        {onClear && hasValue && !rightSlot && (
          <button
            type="button"
            onClick={onClear}
            aria-label="Clear search"
            className="absolute right-0.5 w-[44px] h-[44px] flex items-center justify-center rounded-full text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#111827] dark:hover:text-[#FAFAFA] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        {rightSlot && (
          <div className="absolute right-1 flex items-center">{rightSlot}</div>
        )}
      </div>
      {error && (
        <p className="text-[12px] font-medium text-[#DC2626] dark:text-[#F87171]">
          {error}
        </p>
      )}
    </div>
  );
};

/* ============================================================================
 * 3. MobileCard & MobileListItem — Minimal hairline, 12px radius, zero bloat
 * ============================================================================ */
export const MobileCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}> = ({ children, className = '', onClick }) => (
  <div
    onClick={onClick}
    className={`rounded-xl bg-white dark:bg-[#121212] border border-[#E5E7EB] dark:border-[#27272A] ${
      onClick ? 'cursor-pointer active:bg-[#F9FAFB] dark:active:bg-[#1C1C1E] transition-colors' : ''
    } ${className}`}
  >
    {children}
  </div>
);

export const MobileListItem: React.FC<{
  leading?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  trailing?: React.ReactNode;
  onClick?: () => void;
  unread?: boolean;
  className?: string;
}> = ({ leading, title, subtitle, trailing, onClick, unread = false, className = '' }) => (
  <div
    role={onClick ? 'button' : undefined}
    tabIndex={onClick ? 0 : undefined}
    onClick={onClick}
    onKeyDown={
      onClick
        ? (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onClick();
            }
          }
        : undefined
    }
    className={`w-full min-h-[58px] px-4 py-3 flex items-center gap-3 transition-colors duration-150 ${
      unread ? 'bg-[#FEF2F2]/60 dark:bg-[#E11D48]/10' : 'bg-white dark:bg-[#000000]'
    } ${
      onClick
        ? 'cursor-pointer hover:bg-[#F9FAFB] dark:hover:bg-[#121212] active:bg-[#F3F4F6] dark:active:bg-[#1C1C1E]'
        : ''
    } ${className}`}
  >
    {leading && <div className="shrink-0">{leading}</div>}
    <div className="flex-1 min-w-0">
      <div className="text-[14px] font-semibold text-[#111827] dark:text-[#FAFAFA] truncate">
        {title}
      </div>
      {subtitle && (
        <div className="text-[12px] text-[#6B7280] dark:text-[#A1A1AA] mt-0.5 line-clamp-2">
          {subtitle}
        </div>
      )}
    </div>
    {trailing && <div className="shrink-0 flex items-center gap-2">{trailing}</div>}
  </div>
);

/* ============================================================================
 * 4. MobileSegmentedTabs — Instagram-clean underline switcher
 * ============================================================================ */
export interface MobileSegmentOption<T extends string> {
  id: T;
  label: string;
  badge?: number;
}

export function MobileSegmentedTabs<T extends string>({
  options,
  value,
  onChange,
  className = ''
}: {
  options: MobileSegmentOption<T>[];
  value: T;
  onChange: (next: T) => void;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center border-b border-[#E5E7EB] dark:border-[#27272A] bg-white dark:bg-[#000000] ${className}`}
      role="tablist"
    >
      {options.map((opt) => {
        const isActive = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => {
              triggerHaptic('light');
              onChange(opt.id);
            }}
            className={`relative flex-1 min-h-[44px] px-2 flex items-center justify-center gap-1.5 text-[14px] font-semibold transition-colors duration-150 cursor-pointer whitespace-nowrap ${
              isActive
                ? 'text-[#111827] dark:text-[#FAFAFA]'
                : 'text-[#6B7280] dark:text-[#A1A1AA]'
            }`}
          >
            <span>{opt.label}</span>
            {typeof opt.badge === 'number' && opt.badge > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[11px] font-bold bg-[#8B181B] dark:bg-[#E11D48] text-white tabular-nums leading-none">
                {opt.badge > 99 ? '99+' : opt.badge}
              </span>
            )}
            {isActive && (
              <span
                aria-hidden="true"
                className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-[#8B181B] dark:bg-[#FB7185]"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ============================================================================
 * 5. MobileTopBar — Sticky 52px IG Header (Main: Title + 2 actions | Inner: Back)
 * ============================================================================ */
export interface MobileTopBarProps {
  title: React.ReactNode;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  leadingVisual?: React.ReactNode;
  rightActions?: React.ReactNode;
  className?: string;
}

export const MobileTopBar: React.FC<MobileTopBarProps> = ({
  title,
  subtitle,
  showBack = false,
  onBack,
  leadingVisual,
  rightActions,
  className = ''
}) => (
  <header
    className={`lg:hidden sticky top-0 z-40 w-full bg-white/95 dark:bg-[#000000]/95 backdrop-blur-md border-b border-[#E5E7EB] dark:border-[#27272A] pt-safe ${className}`}
  >
    <div className="h-[52px] px-3 flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        {showBack && onBack && (
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              onBack();
            }}
            aria-label="Go back"
            className="w-[44px] h-[44px] -ml-1.5 flex items-center justify-center rounded-full text-[#111827] dark:text-[#FAFAFA] hover:bg-[#F3F4F6] dark:hover:bg-[#1C1C1E] transition-colors cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-5 h-5 stroke-[2]" />
          </button>
        )}
        {leadingVisual && <div className="shrink-0 mr-1">{leadingVisual}</div>}
        <div className="min-w-0">
          <div className="text-[20px] font-bold tracking-tight text-[#111827] dark:text-[#FAFAFA] truncate leading-tight">
            {title}
          </div>
          {subtitle && (
            <p className="text-[12px] text-[#6B7280] dark:text-[#A1A1AA] truncate leading-tight">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {rightActions && (
        <div className="flex items-center gap-0.5 shrink-0">{rightActions}</div>
      )}
    </div>
  </header>
);

/* ============================================================================
 * 6. MobileTabBar — Enhanced 5-Tab Lower Bar (Home | Explore | + | Jobs | Me)
 *    Features: spring-animated active pill, filled vs outline icons, elevated
 *    center Create CTA, tabular badges, and mobile keyboard auto-hide.
 * ============================================================================ */
export type MobilePrimaryTab = 'home' | 'explore' | 'create' | 'jobs' | 'profile';

const FilledHomeIcon: React.FC<{ className?: string }> = ({ className = 'w-[22px] h-[22px]' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
    <path d="M11.35 2.43a1 1 0 0 1 1.3 0l8 6.86A1.5 1.5 0 0 1 21 10.43V19.5A2.5 2.5 0 0 1 18.5 22h-3.75a.75.75 0 0 1-.75-.75v-5.5a1.25 1.25 0 0 0-1.25-1.25h-1.5A1.25 1.25 0 0 0 10 15.75v5.5a.75.75 0 0 1-.75.75H5.5A2.5 2.5 0 0 1 3 19.5v-9.07a1.5 1.5 0 0 1 .65-1.24l7.7-6.76Z" />
  </svg>
);

const FilledCompassIcon: React.FC<{ className?: string }> = ({ className = 'w-[22px] h-[22px]' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2Zm4.09 5.91a.75.75 0 0 1 .166.814l-2.02 4.847a1.5 1.5 0 0 1-.815.815l-4.847 2.02a.75.75 0 0 1-.98-.98l2.02-4.847a1.5 1.5 0 0 1 .815-.815l4.847-2.02a.75.75 0 0 1 .814.166Zm-5.15 4.03 2.12 2.12 1.06-2.54-2.54 1.06-.64-.64Z"
    />
  </svg>
);

const FilledBriefcaseIcon: React.FC<{ className?: string }> = ({ className = 'w-[22px] h-[22px]' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M9 3.5A1.5 1.5 0 0 1 10.5 2h3A1.5 1.5 0 0 1 15 3.5V5h3.5A2.5 2.5 0 0 1 21 7.5v3.08a18.6 18.6 0 0 1-9 2.17 18.6 18.6 0 0 1-9-2.17V7.5A2.5 2.5 0 0 1 5.5 5H9V3.5Zm1.5 0V5h3V3.5h-3ZM3 12.24v6.26A2.5 2.5 0 0 0 5.5 21h13a2.5 2.5 0 0 0 2.5-2.5v-6.26a20.1 20.1 0 0 1-8.25 1.98v.78a.75.75 0 0 1-1.5 0v-.78A20.1 20.1 0 0 1 3 12.24Z"
    />
  </svg>
);

export const MobileTabBar: React.FC<{
  activeTab: MobilePrimaryTab;
  onSelectTab: (tab: MobilePrimaryTab) => void;
  avatarUrl?: string;
  userName?: string;
  jobsBadgeCount?: number;
  exploreBadgeCount?: number;
}> = ({ activeTab, onSelectTab, avatarUrl, userName, jobsBadgeCount = 0, exploreBadgeCount = 0 }) => {
  const [isInputFocused, setIsInputFocused] = useState(false);

  // Auto-hide lower navigation when typing in mobile text inputs so keyboard & composer stay unobstructed
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let blurTimer: number | undefined;

    const isEditableElement = (el: EventTarget | null) => {
      if (!(el instanceof HTMLElement)) return false;
      if (el.isContentEditable) return true;
      if (el.tagName === 'TEXTAREA') return true;
      if (el.tagName === 'INPUT') {
        const input = el as HTMLInputElement;
        return !['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'range', 'color'].includes(input.type);
      }
      return false;
    };

    const handleFocusIn = (e: FocusEvent) => {
      if (window.innerWidth >= 1024) return;
      if (isEditableElement(e.target)) {
        if (blurTimer) window.clearTimeout(blurTimer);
        setIsInputFocused(true);
      }
    };

    const handleFocusOut = () => {
      if (blurTimer) window.clearTimeout(blurTimer);
      blurTimer = window.setTimeout(() => {
        if (!isEditableElement(document.activeElement)) {
          setIsInputFocused(false);
        }
      }, 120);
    };

    window.addEventListener('focusin', handleFocusIn, { passive: true });
    window.addEventListener('focusout', handleFocusOut, { passive: true });
    return () => {
      if (blurTimer) window.clearTimeout(blurTimer);
      window.removeEventListener('focusin', handleFocusIn);
      window.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  const handlePress = (tab: MobilePrimaryTab) => {
    triggerHaptic('light');
    if (tab === activeTab && tab !== 'create' && typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    onSelectTab(tab);
  };

  return (
    <nav
      aria-label="Primary Mobile Navigation"
      aria-hidden={isInputFocused}
      className={`mobile-bottom-nav lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/92 dark:bg-[#09090B]/92 backdrop-blur-xl border-t border-[#E5E7EB]/90 dark:border-[#27272A]/90 shadow-[0_-6px_24px_rgba(0,0,0,0.05)] dark:shadow-[0_-8px_28px_rgba(0,0,0,0.5)] pb-safe transition-[transform,opacity] duration-200 ease-out ${
        isInputFocused ? 'translate-y-full opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'
      }`}
    >
      <div className="h-[62px] max-w-lg mx-auto px-1.5 flex items-center justify-around">
        {/* 1. Home */}
        <button
          type="button"
          onClick={() => handlePress('home')}
          aria-label="Home Feed"
          aria-current={activeTab === 'home' ? 'page' : undefined}
          className={`relative flex-1 min-h-[48px] flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors active:scale-95 ${
            activeTab === 'home'
              ? 'text-[#8B181B] dark:text-[#FB7185]'
              : 'text-[#6B7280] dark:text-[#A1A1AA]'
          }`}
        >
          <div className="relative w-12 h-7 flex items-center justify-center">
            {activeTab === 'home' && (
              <motion.span
                layoutId="mobile-nav-active-pill"
                transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                className="absolute inset-0 rounded-full bg-[#FEF2F2] dark:bg-[#E11D48]/18"
              />
            )}
            <span className="relative z-10 flex items-center justify-center">
              {activeTab === 'home' ? (
                <FilledHomeIcon className="w-[21px] h-[21px]" />
              ) : (
                <Home className="w-[21px] h-[21px] stroke-[1.75]" />
              )}
            </span>
          </div>
          <span className={`text-[11px] leading-none whitespace-nowrap ${activeTab === 'home' ? 'font-bold' : 'font-medium'}`}>
            Home
          </span>
        </button>

        {/* 2. Explore (People + Events + Bulletins) */}
        <button
          type="button"
          onClick={() => handlePress('explore')}
          aria-label={exploreBadgeCount > 0 ? `Explore, ${exploreBadgeCount} active` : 'Explore Alumni, Events, and Bulletins'}
          aria-current={activeTab === 'explore' ? 'page' : undefined}
          className={`relative flex-1 min-h-[48px] flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors active:scale-95 ${
            activeTab === 'explore'
              ? 'text-[#8B181B] dark:text-[#FB7185]'
              : 'text-[#6B7280] dark:text-[#A1A1AA]'
          }`}
        >
          <div className="relative w-12 h-7 flex items-center justify-center">
            {activeTab === 'explore' && (
              <motion.span
                layoutId="mobile-nav-active-pill"
                transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                className="absolute inset-0 rounded-full bg-[#FEF2F2] dark:bg-[#E11D48]/18"
              />
            )}
            <span className="relative z-10 flex items-center justify-center">
              {activeTab === 'explore' ? (
                <FilledCompassIcon className="w-[21px] h-[21px]" />
              ) : (
                <Compass className="w-[21px] h-[21px] stroke-[1.75]" />
              )}
            </span>
            {exploreBadgeCount > 0 && activeTab !== 'explore' && (
              <span
                aria-hidden="true"
                className="absolute top-0.5 right-2.5 w-2 h-2 rounded-full bg-[#8B181B] dark:bg-[#E11D48] ring-2 ring-white dark:ring-[#09090B] z-20"
              />
            )}
          </div>
          <span className={`text-[11px] leading-none whitespace-nowrap ${activeTab === 'explore' ? 'font-bold' : 'font-medium'}`}>
            Explore
          </span>
        </button>

        {/* 3. Elevated Thumb-Reachable Create (+) */}
        <button
          type="button"
          onClick={() => handlePress('create')}
          aria-label="Create Post"
          className="flex-1 min-h-[48px] flex flex-col items-center justify-center gap-1 cursor-pointer active:scale-95 transition-transform"
        >
          <div className="w-11 h-7 rounded-[11px] bg-[#8B181B] hover:bg-[#721316] dark:bg-[#E11D48] dark:hover:bg-[#BE123C] text-white shadow-[0_2px_10px_rgba(139,24,27,0.28)] dark:shadow-[0_2px_12px_rgba(225,29,72,0.34)] flex items-center justify-center">
            <Plus className="w-[20px] h-[20px] stroke-[2.5]" />
          </div>
          <span className="text-[11px] leading-none font-semibold text-[#8B181B] dark:text-[#FB7185] whitespace-nowrap">
            Create
          </span>
        </button>

        {/* 4. Jobs */}
        <button
          type="button"
          onClick={() => handlePress('jobs')}
          aria-label={jobsBadgeCount > 0 ? `Jobs Board, ${jobsBadgeCount} new` : 'Jobs Board'}
          aria-current={activeTab === 'jobs' ? 'page' : undefined}
          className={`relative flex-1 min-h-[48px] flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors active:scale-95 ${
            activeTab === 'jobs'
              ? 'text-[#8B181B] dark:text-[#FB7185]'
              : 'text-[#6B7280] dark:text-[#A1A1AA]'
          }`}
        >
          <div className="relative w-12 h-7 flex items-center justify-center">
            {activeTab === 'jobs' && (
              <motion.span
                layoutId="mobile-nav-active-pill"
                transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                className="absolute inset-0 rounded-full bg-[#FEF2F2] dark:bg-[#E11D48]/18"
              />
            )}
            <span className="relative z-10 flex items-center justify-center">
              {activeTab === 'jobs' ? (
                <FilledBriefcaseIcon className="w-[21px] h-[21px]" />
              ) : (
                <Briefcase className="w-[21px] h-[21px] stroke-[1.75]" />
              )}
            </span>
            {jobsBadgeCount > 0 && (
              <span
                aria-hidden="true"
                className="absolute -top-0.5 right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-[#8B181B] dark:bg-[#E11D48] text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white dark:ring-[#09090B] tabular-nums leading-none z-20"
              >
                {jobsBadgeCount > 9 ? '9+' : jobsBadgeCount}
              </span>
            )}
          </div>
          <span className={`text-[11px] leading-none whitespace-nowrap ${activeTab === 'jobs' ? 'font-bold' : 'font-medium'}`}>
            Jobs
          </span>
        </button>

        {/* 5. Profile */}
        <button
          type="button"
          onClick={() => handlePress('profile')}
          aria-label="Profile"
          aria-current={activeTab === 'profile' ? 'page' : undefined}
          className={`relative flex-1 min-h-[48px] flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors active:scale-95 ${
            activeTab === 'profile'
              ? 'text-[#8B181B] dark:text-[#FB7185]'
              : 'text-[#6B7280] dark:text-[#A1A1AA]'
          }`}
        >
          <div className="relative w-12 h-7 flex items-center justify-center">
            {activeTab === 'profile' && (
              <motion.span
                layoutId="mobile-nav-active-pill"
                transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                className="absolute inset-0 rounded-full bg-[#FEF2F2] dark:bg-[#E11D48]/18"
              />
            )}
            <img
              src={getUserAvatar(avatarUrl)}
              onError={handleUserAvatarError}
              alt={userName || 'Profile'}
              referrerPolicy="no-referrer"
              className={`relative z-10 w-[23px] h-[23px] rounded-full object-cover transition-all ${
                activeTab === 'profile'
                  ? 'ring-2 ring-[#8B181B] dark:ring-[#FB7185] ring-offset-1 ring-offset-[#FEF2F2] dark:ring-offset-[#09090B]'
                  : 'border border-[#E5E7EB] dark:border-[#27272A]'
              }`}
            />
          </div>
          <span className={`text-[11px] leading-none whitespace-nowrap ${activeTab === 'profile' ? 'font-bold' : 'font-medium'}`}>
            Profile
          </span>
        </button>
      </div>
    </nav>
  );
};

/* ============================================================================
 * 7. MobileTopBarActionIcon — Standard 44x44pt header icon with optional count
 * ============================================================================ */
export const MobileTopBarActionIcon: React.FC<{
  icon: React.ReactNode;
  label: string;
  badgeCount?: number;
  onClick: () => void;
  active?: boolean;
}> = ({ icon, label, badgeCount = 0, onClick, active = false }) => (
  <button
    type="button"
    onClick={() => {
      triggerHaptic('light');
      onClick();
    }}
    aria-label={label}
    className={`relative w-[44px] h-[44px] flex items-center justify-center rounded-full transition-colors cursor-pointer ${
      active
        ? 'text-[#8B181B] dark:text-[#FB7185] bg-[#FEF2F2] dark:bg-[#E11D48]/15'
        : 'text-[#111827] dark:text-[#FAFAFA] hover:bg-[#F3F4F6] dark:hover:bg-[#1C1C1E]'
    }`}
  >
    {icon}
    {badgeCount > 0 && (
      <span className="absolute top-1.5 right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-[#8B181B] dark:bg-[#E11D48] text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white dark:ring-black tabular-nums leading-none">
        {badgeCount > 9 ? '9+' : badgeCount}
      </span>
    )}
  </button>
);

/* ============================================================================
 * 8. MobileBottomSheet — Hardware-back synced, safe-area sheet (<240ms)
 * ============================================================================ */
export const MobileBottomSheet: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  headerRight?: React.ReactNode;
  fullHeight?: boolean;
  children: React.ReactNode;
}> = ({ isOpen, onClose, title, headerRight, fullHeight = false, children }) => {
  useEffect(() => {
    if (!isOpen) return;
    return registerBackAction(() => {
      onClose();
      return true;
    });
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/55 backdrop-blur-[2px]"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title || 'Sheet dialog'}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className={`relative z-10 w-full lg:max-w-lg bg-white dark:bg-[#121212] border-t lg:border border-[#E5E7EB] dark:border-[#27272A] rounded-t-2xl lg:rounded-2xl flex flex-col overflow-hidden pb-safe ${
              fullHeight ? 'h-[92dvh] lg:h-auto lg:max-h-[85vh]' : 'max-h-[88dvh]'
            }`}
          >
            {/* Drag Handle */}
            <div className="flex justify-center pt-2.5 pb-1 lg:hidden shrink-0">
              <div className="w-9 h-1 rounded-full bg-[#D1D5DB] dark:bg-[#3F3F46]" />
            </div>

            {(title || headerRight) && (
              <div className="px-4 py-2.5 border-b border-[#E5E7EB] dark:border-[#27272A] flex items-center justify-between gap-2 shrink-0">
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="w-[44px] h-[44px] -ml-2 flex items-center justify-center rounded-full text-[#111827] dark:text-[#FAFAFA] hover:bg-[#F3F4F6] dark:hover:bg-[#1C1C1E] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
                <h2 className="text-[16px] font-bold text-[#111827] dark:text-[#FAFAFA] truncate text-center flex-1">
                  {title}
                </h2>
                <div className="min-w-[44px] flex items-center justify-end">
                  {headerRight}
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto overscroll-contain">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

/* ============================================================================
 * 9. MobileEmptyState — Clean monochrome circle + headline + 1 CTA
 * ============================================================================ */
export const MobileEmptyState: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}> = ({ icon, title, description, actionLabel, onAction, className = '' }) => (
  <div className={`px-6 py-12 flex flex-col items-center justify-center text-center ${className}`}>
    <div className="w-12 h-12 rounded-full bg-[#F3F4F6] dark:bg-[#262626] text-[#6B7280] dark:text-[#A1A1AA] flex items-center justify-center mb-3">
      {icon}
    </div>
    <h3 className="text-[16px] font-bold text-[#111827] dark:text-[#FAFAFA]">{title}</h3>
    <p className="text-[14px] text-[#6B7280] dark:text-[#A1A1AA] mt-1 max-w-xs leading-relaxed">
      {description}
    </p>
    {actionLabel && onAction && (
      <div className="mt-4">
        <MobileButton variant="primary" size="md" onClick={onAction}>
          {actionLabel}
        </MobileButton>
      </div>
    )}
  </div>
);

/* ============================================================================
 * 10. MobileSkeleton — Feed / List / Profile / Job loading placeholders
 * ============================================================================ */
export const MobileSkeleton: React.FC<{
  variant: 'feed' | 'list' | 'profile';
  count?: number;
}> = ({ variant, count = 3 }) => {
  if (variant === 'profile') {
    return (
      <div className="p-4 space-y-5 animate-pulse bg-white dark:bg-[#000000]">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 rounded-full bg-[#E5E7EB] dark:bg-[#27272A] shrink-0" />
          <div className="flex-1 grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-1.5 flex flex-col items-center">
                <div className="h-4 w-10 rounded bg-[#E5E7EB] dark:bg-[#27272A]" />
                <div className="h-3 w-14 rounded bg-[#F3F4F6] dark:bg-[#1C1C1E]" />
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-4 w-40 rounded bg-[#E5E7EB] dark:bg-[#27272A]" />
          <div className="h-3.5 w-60 rounded bg-[#F3F4F6] dark:bg-[#1C1C1E]" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="h-11 rounded-xl bg-[#F3F4F6] dark:bg-[#1C1C1E]" />
          <div className="h-11 rounded-xl bg-[#F3F4F6] dark:bg-[#1C1C1E]" />
        </div>
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <div className="divide-y divide-[#E5E7EB] dark:divide-[#27272A] bg-white dark:bg-[#000000]">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="px-4 py-3.5 flex items-center gap-3 animate-pulse">
            <div className="w-11 h-11 rounded-full bg-[#E5E7EB] dark:bg-[#27272A] shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-2/3 rounded bg-[#E5E7EB] dark:bg-[#27272A]" />
              <div className="h-3 w-1/2 rounded bg-[#F3F4F6] dark:bg-[#1C1C1E]" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="divide-y divide-[#E5E7EB] dark:divide-[#27272A] bg-white dark:bg-[#000000]">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="py-4 space-y-3 animate-pulse">
          <div className="px-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#E5E7EB] dark:bg-[#27272A]" />
            <div className="space-y-1.5 flex-1">
              <div className="h-3.5 w-32 rounded bg-[#E5E7EB] dark:bg-[#27272A]" />
              <div className="h-2.5 w-20 rounded bg-[#F3F4F6] dark:bg-[#1C1C1E]" />
            </div>
          </div>
          <div className="w-full aspect-[4/3] bg-[#F3F4F6] dark:bg-[#1C1C1E]" />
          <div className="px-4 space-y-2">
            <div className="h-3.5 w-5/6 rounded bg-[#E5E7EB] dark:bg-[#27272A]" />
            <div className="h-3.5 w-2/3 rounded bg-[#F3F4F6] dark:bg-[#1C1C1E]" />
          </div>
        </div>
      ))}
    </div>
  );
};

export {
  ArrowLeft,
  Bell,
  Briefcase,
  Compass,
  Home,
  MessageCircle,
  PlusSquare,
  QrCode,
  Search,
  Settings,
  X
};
