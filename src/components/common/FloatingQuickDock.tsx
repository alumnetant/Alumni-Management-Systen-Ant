import React, { useState, useEffect } from 'react';
import { ArrowUp, QrCode, Search, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { triggerHaptic } from '../../services/hapticsService';

interface FloatingQuickDockProps {
  onOpenPass?: () => void;
  onOpenSearch?: () => void;
}

export const FloatingQuickDock: React.FC<FloatingQuickDockProps> = ({
  onOpenPass,
  onOpenSearch
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const windowScrolled = window.scrollY > 200;
      const mainEl = document.querySelector('main');
      const mainScrolled = (mainEl?.scrollTop || 0) > 200;
      setIsVisible(windowScrolled || mainScrolled);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    const mainEl = document.querySelector('main');
    if (mainEl) {
      mainEl.addEventListener('scroll', handleScroll, { passive: true });
    }

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (mainEl) {
        mainEl.removeEventListener('scroll', handleScroll);
      }
    };
  }, []);

  const handleScrollToTop = () => {
    triggerHaptic?.('light');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const mainEl = document.querySelector('main');
    if (mainEl) {
      mainEl.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleTriggerPass = () => {
    triggerHaptic?.('light');
    if (onOpenPass) {
      onOpenPass();
    } else {
      window.dispatchEvent(new CustomEvent('applet:open-alumni-pass'));
    }
  };

  const handleTriggerSearch = () => {
    triggerHaptic?.('light');
    if (onOpenSearch) {
      onOpenSearch();
    } else {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
          className="fixed right-4 sm:right-6 bottom-20 lg:bottom-6 z-40 select-none"
        >
          <div className="flex items-center gap-1 p-1.5 rounded-full bg-white/95 dark:bg-[#1c1917]/95 backdrop-blur-md border border-stone-200/90 dark:border-stone-800 shadow-[0_8px_30px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.06)]">
            {/* Quick Digital Pass */}
            <button
              type="button"
              onClick={handleTriggerPass}
              className="p-2 sm:px-3 sm:py-2 rounded-full text-stone-700 dark:text-stone-300 hover:text-[#8B181B] dark:hover:text-rose-400 hover:bg-rose-50/80 dark:hover:bg-rose-950/40 transition-colors flex items-center gap-1.5 cursor-pointer active:scale-95"
              title="Show Digital Alumni ID Pass"
              aria-label="Digital Alumni Pass"
            >
              <QrCode className="w-4 h-4 stroke-[1.8]" />
              <span className="hidden sm:inline text-xs font-semibold">Pass</span>
            </button>

            <span className="w-px h-4 bg-stone-200 dark:bg-stone-800" />

            {/* Quick Global Command Palette Search */}
            <button
              type="button"
              onClick={handleTriggerSearch}
              className="p-2 sm:px-3 sm:py-2 rounded-full text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors flex items-center gap-1.5 cursor-pointer active:scale-95"
              title="Quick Search (⌘K)"
              aria-label="Search"
            >
              <Search className="w-4 h-4 stroke-[1.8]" />
              <span className="hidden sm:inline text-xs font-medium text-stone-500 font-mono">⌘K</span>
            </button>

            <span className="w-px h-4 bg-stone-200 dark:bg-stone-800" />

            {/* Smooth Scroll to Top */}
            <button
              type="button"
              onClick={handleScrollToTop}
              className="p-2 rounded-full bg-[#8B181B] text-white hover:bg-[#721316] transition-colors shadow-xs flex items-center justify-center cursor-pointer active:scale-90"
              title="Back to Top"
              aria-label="Back to top"
            >
              <ArrowUp className="w-4 h-4 stroke-[2.2]" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
