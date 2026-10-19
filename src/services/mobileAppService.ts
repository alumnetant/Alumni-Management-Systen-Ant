/**
 * St. Cecilia's College - Cecilian Alumnet
 * Dedicated Mobile & Capacitor Application Service
 *
 * Provides:
 * - Native StatusBar styling and theme integration (iOS & Android)
 * - Native Keyboard visibility and intelligent input auto-scroll
 * - Safe area & orientation change coordination
 * - Device notch, status bar, and home indicator ergonomics
 * - Android Hardware Back Button navigation stack & exit handling
 * - Tactile Haptic Feedback integration (Capacitor & Web Vibration)
 */

import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Keyboard } from '@capacitor/keyboard';
import { App as CapApp } from '@capacitor/app';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

let isMobileServiceInitialized = false;

// Hardware back button action stack (LIFO: topmost modal/drawer handles first)
type BackActionHandler = () => boolean; // returns true if action was consumed
const backActionStack: BackActionHandler[] = [];
let lastBackPressTime = 0;

/**
 * Registers a dismiss action onto the mobile back button stack (e.g., when a modal opens).
 * Returns an unregister cleanup function.
 */
export function registerBackAction(handler: BackActionHandler): () => void {
  backActionStack.push(handler);
  return () => {
    const idx = backActionStack.lastIndexOf(handler);
    if (idx !== -1) {
      backActionStack.splice(idx, 1);
    }
  };
}

import { triggerHaptic } from './hapticsService';
export { triggerHaptic };

/**
 * Sets up the Android Hardware Back Button listener
 */
export function initHardwareBackButton(
  onNavigateHome?: () => boolean | void,
  onShowToast?: (msg: string, type: 'info' | 'success' | 'error') => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  const backListenerPromise = CapApp.addListener('backButton', () => {
    // 1. Check if an active modal or drawer registered a back action
    if (backActionStack.length > 0) {
      const topAction = backActionStack[backActionStack.length - 1];
      const consumed = topAction();
      if (consumed) {
        triggerHaptic('light');
        return;
      }
    }

    // 2. If no modal is open, attempt to navigate back to dashboard/home if provided
    if (onNavigateHome) {
      const consumed = onNavigateHome();
      if (consumed) {
        triggerHaptic('light');
        return;
      }
    }

    // 3. At root view: prevent accidental exit, require double-tap within 2.2 seconds
    const now = Date.now();
    if (now - lastBackPressTime < 2200) {
      CapApp.exitApp();
    } else {
      lastBackPressTime = now;
      triggerHaptic('medium');
      if (onShowToast) {
        onShowToast('Press back again to exit Cecilian Alumnet', 'info');
      }
    }
  });

  return () => {
    backListenerPromise.then((handle) => handle.remove()).catch(() => {});
  };
}

/**
 * Initializes mobile native plugins, keyboard management, and status bar
 */
export async function initMobileApp(isDark: boolean = false): Promise<void> {
  if (typeof window === 'undefined') return;

  // 1. Synchronize Status Bar
  await syncStatusBar(isDark);

  // 2. Set up Keyboard handling if on native platform
  if (Capacitor.isNativePlatform()) {
    try {
      // Show accessory bar with done/close on iOS
      await Keyboard.setAccessoryBarVisible({ isVisible: true });
      await Keyboard.setScroll({ isDisabled: false });

      // Listen for keyboard will show
      Keyboard.addListener('keyboardWillShow', (info) => {
        document.body.classList.add('keyboard-visible');
        document.documentElement.style.setProperty(
          '--keyboard-height',
          `${info.keyboardHeight}px`
        );

        // Auto-scroll the currently focused element into view
        scrollActiveInputIntoView(info.keyboardHeight);
      });

      // Listen for keyboard will/did hide
      Keyboard.addListener('keyboardDidHide', () => {
        document.body.classList.remove('keyboard-visible');
        document.documentElement.style.setProperty('--keyboard-height', '0px');
      });
    } catch (err) {
      console.warn('[Mobile] Keyboard listener setup notice:', err);
    }
  }

  // 3. Setup web/PWA focus auto-scroll fallback
  if (!isMobileServiceInitialized) {
    setupInputFocusAutoScroll();
    setupOrientationListener();
    isMobileServiceInitialized = true;
  }
}

/**
 * Synchronizes native status bar colors and styles with light/dark theme
 */
export async function syncStatusBar(isDark: boolean): Promise<void> {
  // Update HTML meta theme-color tag for mobile browsers & PWAs
  if (typeof document !== 'undefined') {
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    const color = isDark ? '#121316' : '#8B181B'; // Deep St. Cecilia Crimson
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', color);
    }
  }

  if (!Capacitor.isNativePlatform()) return;

  try {
    if (isDark) {
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color: '#121316' });
    } else {
      // In light mode, light text on St. Cecilia deep crimson header
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color: '#8B181B' });
    }
  } catch (err) {
    // Non-blocking for platforms without native statusbar support
  }
}

/**
 * Ensures active focused input is visible above the virtual keyboard
 */
function scrollActiveInputIntoView(keyboardHeight: number = 280): void {
  setTimeout(() => {
    const active = document.activeElement as HTMLElement | null;
    if (
      active &&
      (active.tagName === 'INPUT' ||
        active.tagName === 'TEXTAREA' ||
        active.isContentEditable)
    ) {
      const rect = active.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const visibleHeight = viewportHeight - keyboardHeight;

      if (rect.bottom > visibleHeight - 20) {
        // Element is covered by keyboard, smoothly scroll it into center
        active.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest'
        });
      }
    }
  }, 100);
}

/**
 * Global input focus listener to ensure comfortable viewing on touch devices
 */
function setupInputFocusAutoScroll(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener(
    'focusin',
    (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        setTimeout(() => {
          try {
            target.scrollIntoView({
              behavior: 'smooth',
              block: 'nearest',
              inline: 'nearest'
            });
          } catch {}
        }, 300);
      }
    },
    { passive: true }
  );
}

/**
 * Handles orientation change cleanly without layout shift or broken heights
 */
function setupOrientationListener(): void {
  if (typeof window === 'undefined') return;

  const handleOrientationChange = () => {
    // Force a small reflow timeout so dvh / innerHeight recalculates accurately
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('applet:orientation-recalculated'));
      // Scroll to current position safely
      window.scrollBy(0, 0);
    }, 200);
  };

  window.addEventListener('orientationchange', handleOrientationChange);
  window.addEventListener('resize', () => {
    // Throttled viewport height update for mobile address bar collapse
    document.documentElement.style.setProperty(
      '--app-height',
      `${window.innerHeight}px`
    );
  });
}
