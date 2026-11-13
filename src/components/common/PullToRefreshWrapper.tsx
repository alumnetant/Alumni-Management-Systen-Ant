import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ArrowDown, RefreshCw, CheckCircle2, WifiOff } from 'lucide-react';

interface PullToRefreshWrapperProps {
  onRefresh: () => Promise<void> | void;
  isOnline?: boolean;
  children: React.ReactNode;
  className?: string;
}

type PullPhase = 'idle' | 'pulling' | 'ready' | 'refreshing' | 'done' | 'offline';

const PULL_THRESHOLD = 64;
const MAX_PULL_DISTANCE = 96;
const RESISTANCE = 0.45;

export const PullToRefreshWrapper: React.FC<PullToRefreshWrapperProps> = ({
  onRefresh,
  isOnline = true,
  children,
  className = ''
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [phase, setPhase] = useState<PullPhase>('idle');

  const phaseRef = useRef<PullPhase>('idle');
  const pullDistanceRef = useRef(0);
  const isTrackingRef = useRef(false);
  const isPullingRef = useRef(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const onRefreshRef = useRef(onRefresh);
  const isOnlineRef = useRef(isOnline);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    isOnlineRef.current = isOnline;
  }, [isOnline]);

  const updatePhase = useCallback((next: PullPhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const updatePullDistance = useCallback((dist: number) => {
    pullDistanceRef.current = dist;
    setPullDistance(dist);
  }, []);

  // Verify the page and all inner scrollable ancestors under the touch target are at the top
  const canStartPullFromTarget = useCallback((target: EventTarget | null): boolean => {
    if (typeof window === 'undefined') return false;
    const windowScrollTop = Math.max(window.scrollY || 0, document.documentElement.scrollTop || 0);
    if (windowScrollTop > 2) return false;

    if (!(target instanceof HTMLElement)) return true;

    // Ignore form inputs, modals, and explicitly opted-out containers
    if (
      target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"], [aria-modal="true"], [data-no-ptr="true"]')
    ) {
      return false;
    }

    let node: HTMLElement | null = target;
    const boundary = containerRef.current;

    while (node && node !== document.body) {
      const style = window.getComputedStyle(node);
      const overflowY = style.overflowY;
      const isScrollableY =
        (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') &&
        node.scrollHeight > node.clientHeight + 2;

      if (isScrollableY && node.scrollTop > 2) {
        return false;
      }

      if (node === boundary) break;
      node = node.parentElement;
    }

    return true;
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (phaseRef.current === 'refreshing') return;
      if (e.touches.length !== 1) return;
      if (!canStartPullFromTarget(e.target)) {
        isTrackingRef.current = false;
        return;
      }

      const touch = e.touches[0];
      startXRef.current = touch.clientX;
      startYRef.current = touch.clientY;
      isTrackingRef.current = true;
      isPullingRef.current = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isTrackingRef.current || phaseRef.current === 'refreshing') return;
      if (e.touches.length !== 1) {
        isTrackingRef.current = false;
        return;
      }

      const touch = e.touches[0];
      const dx = touch.clientX - startXRef.current;
      const dy = touch.clientY - startYRef.current;

      if (!isPullingRef.current) {
        // Wait for clear intentional movement
        if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;

        // Abort if horizontal gesture or upward scroll
        if (dy <= 0 || Math.abs(dx) > Math.abs(dy) * 1.15) {
          isTrackingRef.current = false;
          return;
        }

        // Confirm window hasn't scrolled away from top
        const windowScrollTop = Math.max(window.scrollY || 0, document.documentElement.scrollTop || 0);
        if (windowScrollTop > 2) {
          isTrackingRef.current = false;
          return;
        }

        isPullingRef.current = true;
      }

      if (dy <= 0) {
        updatePullDistance(0);
        updatePhase('idle');
        return;
      }

      if (e.cancelable) {
        e.preventDefault();
      }

      const damped = Math.min(MAX_PULL_DISTANCE, Math.round(dy * RESISTANCE));
      updatePullDistance(damped);
      updatePhase(damped >= PULL_THRESHOLD ? 'ready' : 'pulling');
    };

    const executeRefresh = async () => {
      if (!isOnlineRef.current) {
        updatePhase('offline');
        updatePullDistance(48);
        setTimeout(() => {
          updatePullDistance(0);
          updatePhase('idle');
        }, 1200);
        return;
      }

      updatePhase('refreshing');
      updatePullDistance(52);
      const startedAt = Date.now();

      try {
        await Promise.resolve(onRefreshRef.current());
      } catch (err) {
        console.warn('Pull-to-refresh sync notice:', err);
      } finally {
        const elapsed = Date.now() - startedAt;
        const remaining = Math.max(0, 450 - elapsed);
        setTimeout(() => {
          updatePhase('done');
          setTimeout(() => {
            updatePullDistance(0);
            setTimeout(() => {
              updatePhase('idle');
            }, 220);
          }, 600);
        }, remaining);
      }
    };

    const handleTouchEnd = () => {
      if (!isTrackingRef.current) return;
      isTrackingRef.current = false;

      if (!isPullingRef.current) return;
      isPullingRef.current = false;

      if (pullDistanceRef.current >= PULL_THRESHOLD) {
        executeRefresh();
      } else {
        updatePullDistance(0);
        updatePhase('idle');
      }
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });
    el.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [canStartPullFromTarget, updatePhase, updatePullDistance]);

  const progress = Math.min(1, pullDistance / PULL_THRESHOLD);
  const showIndicator = pullDistance > 2 || phase === 'refreshing' || phase === 'done' || phase === 'offline';

  return (
    <div ref={containerRef} className={`relative overscroll-y-contain ${className}`}>
      {/* Revealable Pull-to-Refresh Indicator Tray */}
      <div
        aria-live="polite"
        className="overflow-hidden flex items-center justify-center select-none pointer-events-none"
        style={{
          height: `${pullDistance}px`,
          transition: isPullingRef.current ? 'none' : 'height 220ms cubic-bezier(0.22, 1, 0.36, 1)'
        }}
      >
        {showIndicator && (
          <div
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/95 dark:bg-stone-900/95 border border-stone-200/90 dark:border-stone-700/80 shadow-[0_2px_10px_rgba(0,0,0,0.06)] backdrop-blur-sm"
            style={{
              opacity: Math.max(0.25, Math.min(1, progress * 1.15)),
              transform: `scale(${0.92 + Math.min(0.08, progress * 0.08)})`
            }}
          >
            {phase === 'refreshing' ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 text-[#8B181B] dark:text-rose-400 animate-spin stroke-[2.2]" />
                <span className="text-[11px] font-semibold text-stone-700 dark:text-stone-200 tracking-tight">
                  Refreshing live data...
                </span>
              </>
            ) : phase === 'done' ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 stroke-[2.2]" />
                <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 tracking-tight">
                  Up to date
                </span>
              </>
            ) : phase === 'offline' ? (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 stroke-[2]" />
                <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 tracking-tight">
                  Offline — showing cached data
                </span>
              </>
            ) : (
              <>
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors duration-150 ${
                    phase === 'ready'
                      ? 'bg-[#8B181B] text-white'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300'
                  }`}
                >
                  <ArrowDown
                    className="w-3 h-3 stroke-[2.2] transition-transform duration-150"
                    style={{ transform: `rotate(${phase === 'ready' ? 180 : Math.round(progress * 150)}deg)` }}
                  />
                </span>
                <span className="text-[11px] font-semibold text-stone-600 dark:text-stone-300 tracking-tight">
                  {phase === 'ready' ? 'Release to refresh' : 'Pull down to refresh'}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {children}
    </div>
  );
};
