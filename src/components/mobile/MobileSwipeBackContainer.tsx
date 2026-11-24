/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { triggerHaptic } from '../../services/mobileAppService';

interface MobileSwipeBackContainerProps {
  /** Enables left-edge swipe-to-go-back when a previous screen exists */
  enabled: boolean;
  /** Short label displayed inside the edge indicator when pulling back */
  backLabel?: string;
  /** Callback invoked when the user completes the swipe-back gesture */
  onBack: () => void;
  children: React.ReactNode;
  className?: string;
}

const EDGE_ACTIVATION_PX = 36;
const LOCK_DISTANCE_PX = 10;
const COMMIT_DISTANCE_PX = 84;
const FLICK_MIN_DISTANCE_PX = 42;
const FLICK_VELOCITY_PX_MS = 0.45;
const MAX_TRANSLATE_PX = 110;

export const MobileSwipeBackContainer: React.FC<MobileSwipeBackContainerProps> = ({
  enabled,
  backLabel = 'Back',
  onBack,
  children,
  className = ''
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const [dragPx, setDragPx] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const enabledRef = useRef(enabled);
  const onBackRef = useRef(onBack);

  const trackingRef = useRef(false);
  const lockedRef = useRef(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const lastXRef = useRef(0);
  const lastTimeRef = useRef(0);
  const velocityRef = useRef(0);
  const dragPxRef = useRef(0);
  const wasReadyRef = useRef(false);

  useEffect(() => {
    enabledRef.current = enabled;
    if (!enabled) {
      trackingRef.current = false;
      lockedRef.current = false;
      wasReadyRef.current = false;
      dragPxRef.current = 0;
      setDragPx(0);
      setIsDragging(false);
      setIsReady(false);
    }
  }, [enabled]);

  useEffect(() => {
    onBackRef.current = onBack;
  }, [onBack]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof window === 'undefined') return;

    const resetGesture = () => {
      trackingRef.current = false;
      lockedRef.current = false;
      wasReadyRef.current = false;
      dragPxRef.current = 0;
      velocityRef.current = 0;
      setDragPx(0);
      setIsDragging(false);
      setIsReady(false);
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (!enabledRef.current) return;
      if (window.innerWidth >= 1024) return;
      if (e.touches.length !== 1) {
        resetGesture();
        return;
      }

      const touch = e.touches[0];
      if (touch.clientX > EDGE_ACTIVATION_PX) {
        trackingRef.current = false;
        return;
      }

      const target = e.target as HTMLElement | null;
      if (
        target &&
        target.closest(
          'input, textarea, select, [contenteditable="true"], [role="dialog"], [aria-modal="true"], [data-no-swipe-back="true"]'
        )
      ) {
        trackingRef.current = false;
        return;
      }

      trackingRef.current = true;
      lockedRef.current = false;
      wasReadyRef.current = false;
      startXRef.current = touch.clientX;
      startYRef.current = touch.clientY;
      lastXRef.current = touch.clientX;
      lastTimeRef.current = performance.now();
      velocityRef.current = 0;
      dragPxRef.current = 0;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!trackingRef.current) return;
      if (e.touches.length !== 1) {
        resetGesture();
        return;
      }

      const touch = e.touches[0];
      const dx = touch.clientX - startXRef.current;
      const dy = touch.clientY - startYRef.current;

      if (!lockedRef.current) {
        if (Math.abs(dx) < LOCK_DISTANCE_PX && Math.abs(dy) < LOCK_DISTANCE_PX) {
          return;
        }
        // Abort if moving vertically or leftward so scroll & pull-to-refresh are unaffected
        if (dx <= 0 || Math.abs(dy) >= Math.abs(dx) * 0.85) {
          trackingRef.current = false;
          return;
        }
        lockedRef.current = true;
        setIsDragging(true);
      }

      if (e.cancelable) {
        e.preventDefault();
      }

      const now = performance.now();
      const dt = Math.max(1, now - lastTimeRef.current);
      velocityRef.current = (touch.clientX - lastXRef.current) / dt;
      lastXRef.current = touch.clientX;
      lastTimeRef.current = now;

      const clampedDx = Math.max(0, Math.min(dx, 240));
      dragPxRef.current = clampedDx;
      setDragPx(clampedDx);

      const ready = clampedDx >= COMMIT_DISTANCE_PX;
      if (ready !== wasReadyRef.current) {
        wasReadyRef.current = ready;
        setIsReady(ready);
        if (ready) {
          triggerHaptic('light');
        }
      }
    };

    const handleTouchEnd = () => {
      if (!trackingRef.current) return;
      const wasLocked = lockedRef.current;
      const finalDx = dragPxRef.current;
      const finalVx = velocityRef.current;

      resetGesture();

      if (!wasLocked) return;

      const shouldCommit =
        finalDx >= COMMIT_DISTANCE_PX ||
        (finalDx >= FLICK_MIN_DISTANCE_PX && finalVx >= FLICK_VELOCITY_PX_MS);

      if (shouldCommit) {
        triggerHaptic('light');
        onBackRef.current();
      }
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });
    el.addEventListener('touchcancel', resetGesture, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('touchcancel', resetGesture);
    };
  }, []);

  const progress = Math.min(1, dragPx / COMMIT_DISTANCE_PX);
  const contentShift = Math.min(MAX_TRANSLATE_PX, Math.round(dragPx * 0.32));
  const showIndicator = isDragging && dragPx > 6;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Subtle left-edge depth scrim during active swipe */}
      {showIndicator && (
        <div
          aria-hidden="true"
          className="lg:hidden fixed inset-0 z-40 pointer-events-none bg-black"
          style={{
            opacity: progress * 0.12,
            transition: isDragging ? 'none' : 'opacity 180ms ease-out'
          }}
        />
      )}

      {/* Predictive Left-Edge Back Pill */}
      {showIndicator && (
        <div
          aria-hidden="true"
          className="lg:hidden fixed left-0 top-1/2 z-50 pointer-events-none flex items-center"
          style={{
            transform: `translate3d(${Math.round(-32 + progress * 44)}px, -50%, 0) scale(${
              isReady ? 1.06 : 0.92 + progress * 0.1
            })`,
            opacity: Math.min(1, progress * 1.4),
            transition: isDragging
              ? 'background-color 140ms ease, color 140ms ease'
              : 'transform 180ms cubic-bezier(0.16, 1, 0.3, 1), opacity 180ms ease'
          }}
        >
          <div
            className={`h-11 pl-2.5 pr-3.5 rounded-full shadow-lg border flex items-center gap-1.5 backdrop-blur-md transition-colors duration-150 ${
              isReady
                ? 'bg-[#8B181B] dark:bg-[#E11D48] text-white border-transparent'
                : 'bg-white/95 dark:bg-[#1C1C1E]/95 text-[#111827] dark:text-[#FAFAFA] border-[#E5E7EB] dark:border-[#27272A]'
            }`}
          >
            <ChevronLeft className="w-5 h-5 stroke-[2.4] shrink-0" />
            <span className="text-[12px] font-bold tracking-tight whitespace-nowrap">
              {backLabel}
            </span>
          </div>
        </div>
      )}

      {/* Content surface with subtle compositor-only parallax shift */}
      <div
        style={{
          transform: contentShift > 0 ? `translate3d(${contentShift}px, 0, 0)` : undefined,
          transition: isDragging ? 'none' : 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1)',
          willChange: isDragging ? 'transform' : 'auto'
        }}
      >
        {children}
      </div>
    </div>
  );
};
