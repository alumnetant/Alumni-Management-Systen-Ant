/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { isMobileOrTabletUserAgent, isMobilePlatformToken } from './platformPolicy';

export { isMobileOrTabletUserAgent, isMobilePlatformToken };

/**
 * Detects mobile phones, tablets (including iPadOS Safari desktop-mode touch screens),
 * native Capacitor builds, and responsive viewports below 1024px.
 */
export function isMobileOrTabletDevice(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (Capacitor.isNativePlatform()) return true;
  } catch {
    // Ignore when Capacitor bridge is unavailable
  }

  if (window.innerWidth < 1024) return true;

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  const maxTouchPoints =
    typeof navigator !== 'undefined' && typeof navigator.maxTouchPoints === 'number'
      ? navigator.maxTouchPoints
      : 0;

  return isMobileOrTabletUserAgent(ua, maxTouchPoints);
}

/**
 * Reactive viewport/device hook that updates immediately across 1024px breakpoints
 * and device orientation changes.
 */
export function useIsMobileOrTablet(): boolean {
  const [isMobileOrTablet, setIsMobileOrTablet] = useState<boolean>(() =>
    isMobileOrTabletDevice()
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sync = () => {
      setIsMobileOrTablet(isMobileOrTabletDevice());
    };
    sync();
    window.addEventListener('resize', sync);
    window.addEventListener('orientationchange', sync);
    return () => {
      window.removeEventListener('resize', sync);
      window.removeEventListener('orientationchange', sync);
    };
  }, []);

  return isMobileOrTablet;
}
