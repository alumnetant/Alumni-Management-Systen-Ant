import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  Calendar,
  Award,
  Sparkles,
  ArrowRight,
  X,
  Megaphone
} from 'lucide-react';

export interface CollegiatePopupPayload {
  id?: string;
  title: string;
  body: string;
  category?: 'announcement' | 'event' | 'milestone' | 'message' | 'general' | string;
  data?: Record<string, any>;
  timestamp?: string;
}

interface CollegiatePushBannerProps {
  onNavigateTab?: (tab: string, contextId?: string) => void;
}

export const CollegiatePushBanner: React.FC<CollegiatePushBannerProps> = ({ onNavigateTab }) => {
  const [currentPopup, setCurrentPopup] = useState<CollegiatePopupPayload | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(100);

  const durationMs = 7500;
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const remainingTimeRef = useRef<number>(durationMs);

  useEffect(() => {
    const handlePopupEvent = (e: Event) => {
      const customEvent = e as CustomEvent<CollegiatePopupPayload>;
      if (!customEvent.detail || !customEvent.detail.title) return;

      const payload = customEvent.detail;
      setCurrentPopup(payload);
      setProgress(100);
      remainingTimeRef.current = durationMs;
      startTimeRef.current = Date.now();
    };

    window.addEventListener('applet:collegiate-popup', handlePopupEvent);
    return () => {
      window.removeEventListener('applet:collegiate-popup', handlePopupEvent);
    };
  }, []);

  // Timer & progress countdown
  useEffect(() => {
    if (!currentPopup) return;

    if (isPaused) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const interval = 50; // update every 50ms
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const left = Math.max(0, remainingTimeRef.current - elapsed);
      const pct = (left / durationMs) * 100;
      setProgress(pct);

      if (left <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        setCurrentPopup(null);
      }
    }, interval);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentPopup, isPaused]);

  const handleMouseEnter = () => {
    setIsPaused(true);
    const elapsed = Date.now() - startTimeRef.current;
    remainingTimeRef.current = Math.max(0, remainingTimeRef.current - elapsed);
  };

  const handleMouseLeave = () => {
    startTimeRef.current = Date.now();
    setIsPaused(false);
  };

  const handleActionClick = () => {
    if (!currentPopup) return;

    const data = currentPopup.data || {};
    const category = (currentPopup.category || data.category || '').toLowerCase();

    if (onNavigateTab) {
      if (category.includes('event') || data.eventId) {
        onNavigateTab('events', data.eventId);
      } else if (category.includes('announcement') || data.announcementId) {
        onNavigateTab('announcements', data.announcementId);
      } else if (category.includes('message') || data.chatId) {
        onNavigateTab('messages', data.chatId);
      } else if (category.includes('milestone') || data.milestoneId) {
        onNavigateTab('dashboard', data.milestoneId);
      } else {
        onNavigateTab('dashboard');
      }
    }

    // Dismiss banner
    setCurrentPopup(null);
  };

  const handleDismiss = () => {
    setCurrentPopup(null);
  };

  if (!currentPopup) return null;

  const category = (currentPopup.category || currentPopup.data?.category || 'general').toLowerCase();

  const getCategoryConfig = () => {
    if (category.includes('announcement')) {
      return {
        label: 'Official Announcement',
        badgeBg: 'bg-red-500/15 text-[#8B181B] dark:text-rose-300 border-red-500/20',
        icon: Megaphone,
        accentColor: '#8B181B'
      };
    }
    if (category.includes('event')) {
      return {
        label: 'Campus & Alumni Event',
        badgeBg: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/20',
        icon: Calendar,
        accentColor: '#D97706'
      };
    }
    if (category.includes('milestone')) {
      return {
        label: 'Alumni Milestone Spotlight',
        badgeBg: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/20',
        icon: Award,
        accentColor: '#059669'
      };
    }
    return {
      label: 'Institutional Broadcast',
      badgeBg: 'bg-stone-500/15 text-stone-800 dark:text-stone-300 border-stone-500/20',
      icon: Bell,
      accentColor: '#8B181B'
    };
  };

  const catConfig = getCategoryConfig();
  const IconComponent = catConfig.icon;

  return (
    <AnimatePresence>
      <div
        className="fixed z-[100] left-0 right-0 pointer-events-none px-3 sm:px-4 flex justify-center"
        style={{ top: 'max(env(safe-area-inset-top, 0px), 12px)' }}
      >
        <motion.div
          initial={{ opacity: 0, y: -24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onTouchStart={handleMouseEnter}
          onTouchEnd={handleMouseLeave}
          className="pointer-events-auto w-full max-w-lg bg-white/95 dark:bg-stone-900/95 backdrop-blur-md rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.12),0_1px_3px_rgba(0,0,0,0.06)] border border-stone-200/90 dark:border-stone-800 overflow-hidden"
        >
          <div className="p-3.5 sm:p-4">
            <div className="flex items-start gap-3">
              {/* College Seal & Category Icon */}
              <div className="relative shrink-0 mt-0.5">
                <div className="w-10 h-10 rounded-xl overflow-hidden ring-1 ring-black/5 dark:ring-white/10 bg-stone-100 dark:bg-stone-800 flex items-center justify-center">
                  <img
                    src="/assets/cecilians-seal.jpg"
                    alt="St. Cecilia Seal"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
                <div
                  className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full text-white flex items-center justify-center shadow-xs"
                  style={{ backgroundColor: catConfig.accentColor }}
                >
                  <IconComponent className="w-2.5 h-2.5" />
                </div>
              </div>

              {/* Notification Content */}
              <div className="flex-1 min-w-0 pr-1">
                <div className="flex items-center gap-1.5 mb-1">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase border ${catConfig.badgeBg}`}
                  >
                    {catConfig.label}
                  </span>
                  <span className="text-[10px] text-stone-400 font-medium">Just now</span>
                </div>

                <h4 className="text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100 tracking-tight leading-snug truncate">
                  {currentPopup.title}
                </h4>

                <p className="text-[11px] sm:text-xs text-stone-600 dark:text-stone-400 mt-0.5 line-clamp-2 leading-relaxed">
                  {currentPopup.body}
                </p>

                {/* Direct Action Links */}
                <div className="mt-2.5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleActionClick}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold text-white bg-[#8B181B] hover:bg-[#721316] transition-all shadow-xs cursor-pointer active:scale-95"
                  >
                    <span>View Now</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>

                  <button
                    type="button"
                    onClick={handleDismiss}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={handleDismiss}
                aria-label="Dismiss notification"
                className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded-lg transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Progress Countdown Bar */}
          <div className="h-0.5 w-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
            <motion.div
              className="h-full bg-[#8B181B] dark:bg-rose-500"
              style={{ width: `${progress}%` }}
              transition={{ ease: 'linear', duration: 0.05 }}
            />
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
