/**
 * Theme Management Service
 * Controls Light, Dark, and System theme modes and updates CSS root variables.
 */
import { useState, useEffect } from 'react';
import { syncStatusBar } from '../services/mobileAppService';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeColors {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  border: string;
  input: string;
  muted: string;
  mutedForeground: string;
  darkText: string;
  mutedText: string;
  borderSubtle: string;
  cardWhite: string;
  softWhite: string;
  appBg: string;
  appText: string;
  // Direct Messaging Semantic Theme Variables
  dmBgCanvas: string;
  dmBgDeck: string;
  dmBgRail: string;
  dmBgRailHeader: string;
  dmBgItemHover: string;
  dmBgItemActive: string;
  dmBgChat: string;
  dmBgHeader: string;
  dmBgFooter: string;
  dmBorder: string;
  dmBorderSubtle: string;
  dmTextPrimary: string;
  dmTextSecondary: string;
  dmTextMuted: string;
  dmBubbleSent: string;
  dmBubbleSentText: string;
  dmBubbleReceived: string;
  dmBubbleReceivedText: string;
  dmBubbleReceivedBorder: string;
  dmInputBg: string;
  dmInputBorder: string;
  dmInputText: string;
  dmInputPlaceholder: string;
  dmChipBg: string;
  dmChipBorder: string;
  dmChipText: string;
  dmDossierBg: string;
  dmCardBg: string;
  dmCardBorder: string;
  dmModalBg: string;
  dmModalBorder: string;
}

export const LIGHT_THEME_VARIABLES: ThemeColors = {
  background: '#F9FAFB',
  foreground: '#111827',
  card: '#FFFFFF',
  cardForeground: '#111827',
  popover: '#FFFFFF',
  popoverForeground: '#111827',
  border: '#E5E7EB',
  input: '#E5E7EB',
  muted: '#F3F4F6',
  mutedForeground: '#6B7280',
  darkText: '#111827',
  mutedText: '#6B7280',
  borderSubtle: '#E5E7EB',
  cardWhite: '#FFFFFF',
  softWhite: '#F9FAFB',
  appBg: '#F9FAFB',
  appText: '#111827',
  dmBgCanvas: '#F9FAFB',
  dmBgDeck: '#FFFFFF',
  dmBgRail: '#FAF9F6',
  dmBgRailHeader: '#FFFFFF',
  dmBgItemHover: '#F5F5F4',
  dmBgItemActive: '#FAF6EC',
  dmBgChat: '#FAF9F6',
  dmBgHeader: '#FFFFFF',
  dmBgFooter: '#FFFFFF',
  dmBorder: '#E5E7EB',
  dmBorderSubtle: '#F3F4F6',
  dmTextPrimary: '#111827',
  dmTextSecondary: '#4B5563',
  dmTextMuted: '#9CA3AF',
  dmBubbleSent: '#8B181B',
  dmBubbleSentText: '#FFFFFF',
  dmBubbleReceived: '#FFFFFF',
  dmBubbleReceivedText: '#111827',
  dmBubbleReceivedBorder: '#E5E7EB',
  dmInputBg: '#F3F4F6',
  dmInputBorder: '#E5E7EB',
  dmInputText: '#111827',
  dmInputPlaceholder: '#9CA3AF',
  dmChipBg: '#FFFFFF',
  dmChipBorder: '#E5E7EB',
  dmChipText: '#374151',
  dmDossierBg: '#FAF9F6',
  dmCardBg: '#FFFFFF',
  dmCardBorder: '#E5E7EB',
  dmModalBg: '#FFFFFF',
  dmModalBorder: '#E5E7EB'
};

export const DARK_THEME_VARIABLES: ThemeColors = {
  background: '#121316',
  foreground: '#F5F5F4',
  card: '#1C1917',
  cardForeground: '#F5F5F4',
  popover: '#1C1917',
  popoverForeground: '#F5F5F4',
  border: 'rgba(255, 255, 255, 0.1)',
  input: 'rgba(255, 255, 255, 0.12)',
  muted: '#292524',
  mutedForeground: '#A8A29E',
  darkText: '#F5F5F4',
  mutedText: '#A8A29E',
  borderSubtle: '#292524',
  cardWhite: '#1C1917',
  softWhite: '#121316',
  appBg: '#121316',
  appText: '#F5F5F4',
  dmBgCanvas: '#121316',
  dmBgDeck: '#1C1917',
  dmBgRail: '#171513',
  dmBgRailHeader: '#1C1917',
  dmBgItemHover: '#242220',
  dmBgItemActive: '#292524',
  dmBgChat: '#121316',
  dmBgHeader: '#1C1917',
  dmBgFooter: '#1C1917',
  dmBorder: 'rgba(255, 255, 255, 0.08)',
  dmBorderSubtle: 'rgba(255, 255, 255, 0.05)',
  dmTextPrimary: '#F5F5F4',
  dmTextSecondary: '#D6D3D1',
  dmTextMuted: '#A8A29E',
  dmBubbleSent: '#8B181B',
  dmBubbleSentText: '#FFFFFF',
  dmBubbleReceived: '#242220',
  dmBubbleReceivedText: '#F5F5F4',
  dmBubbleReceivedBorder: 'rgba(255, 255, 255, 0.08)',
  dmInputBg: '#242220',
  dmInputBorder: 'rgba(255, 255, 255, 0.1)',
  dmInputText: '#F5F5F4',
  dmInputPlaceholder: '#78716c',
  dmChipBg: '#242220',
  dmChipBorder: 'rgba(255, 255, 255, 0.08)',
  dmChipText: '#D6D3D1',
  dmDossierBg: '#171513',
  dmCardBg: '#242220',
  dmCardBorder: 'rgba(255, 255, 255, 0.08)',
  dmModalBg: '#1C1917',
  dmModalBorder: 'rgba(255, 255, 255, 0.1)'
};

const THEME_STORAGE_KEY = 'cecilian_theme_mode';

export function getStoredTheme(): ThemeMode {
  try {
    const val = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
    if (val === 'light' || val === 'dark' || val === 'system') {
      return val;
    }
  } catch {
    // ignore
  }
  return 'light';
}

export function isDarkModeActive(mode: ThemeMode): boolean {
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function applyTheme(mode: ThemeMode) {
  const isDark = isDarkModeActive(mode);
  const root = document.documentElement;

  // 1. Toggle Tailwind dark class
  if (isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  // 2. Select variables
  const vars = isDark ? DARK_THEME_VARIABLES : LIGHT_THEME_VARIABLES;

  // 3. Update CSS root variables
  root.style.setProperty('--background', vars.background);
  root.style.setProperty('--foreground', vars.foreground);
  root.style.setProperty('--card', vars.card);
  root.style.setProperty('--card-foreground', vars.cardForeground);
  root.style.setProperty('--popover', vars.popover);
  root.style.setProperty('--popover-foreground', vars.popoverForeground);
  root.style.setProperty('--border', vars.border);
  root.style.setProperty('--input', vars.input);
  root.style.setProperty('--muted', vars.muted);
  root.style.setProperty('--muted-foreground', vars.mutedForeground);
  root.style.setProperty('--color-dark-text', vars.darkText);
  root.style.setProperty('--color-muted-text', vars.mutedText);
  root.style.setProperty('--color-border-subtle', vars.borderSubtle);
  root.style.setProperty('--color-card-white', vars.cardWhite);
  root.style.setProperty('--color-soft-white', vars.softWhite);
  root.style.setProperty('--bg-app', vars.appBg);
  root.style.setProperty('--text-app', vars.appText);

  // Direct Messaging variables
  root.style.setProperty('--dm-bg-canvas', vars.dmBgCanvas);
  root.style.setProperty('--dm-bg-deck', vars.dmBgDeck);
  root.style.setProperty('--dm-bg-rail', vars.dmBgRail);
  root.style.setProperty('--dm-bg-rail-header', vars.dmBgRailHeader);
  root.style.setProperty('--dm-bg-item-hover', vars.dmBgItemHover);
  root.style.setProperty('--dm-bg-item-active', vars.dmBgItemActive);
  root.style.setProperty('--dm-bg-chat', vars.dmBgChat);
  root.style.setProperty('--dm-bg-header', vars.dmBgHeader);
  root.style.setProperty('--dm-bg-footer', vars.dmBgFooter);
  root.style.setProperty('--dm-border', vars.dmBorder);
  root.style.setProperty('--dm-border-subtle', vars.dmBorderSubtle);
  root.style.setProperty('--dm-text-primary', vars.dmTextPrimary);
  root.style.setProperty('--dm-text-secondary', vars.dmTextSecondary);
  root.style.setProperty('--dm-text-muted', vars.dmTextMuted);
  root.style.setProperty('--dm-bubble-sent', vars.dmBubbleSent);
  root.style.setProperty('--dm-bubble-sent-text', vars.dmBubbleSentText);
  root.style.setProperty('--dm-bubble-received', vars.dmBubbleReceived);
  root.style.setProperty('--dm-bubble-received-text', vars.dmBubbleReceivedText);
  root.style.setProperty('--dm-bubble-received-border', vars.dmBubbleReceivedBorder);
  root.style.setProperty('--dm-input-bg', vars.dmInputBg);
  root.style.setProperty('--dm-input-border', vars.dmInputBorder);
  root.style.setProperty('--dm-input-text', vars.dmInputText);
  root.style.setProperty('--dm-input-placeholder', vars.dmInputPlaceholder);
  root.style.setProperty('--dm-chip-bg', vars.dmChipBg);
  root.style.setProperty('--dm-chip-border', vars.dmChipBorder);
  root.style.setProperty('--dm-chip-text', vars.dmChipText);
  root.style.setProperty('--dm-dossier-bg', vars.dmDossierBg);
  root.style.setProperty('--dm-card-bg', vars.dmCardBg);
  root.style.setProperty('--dm-card-border', vars.dmCardBorder);
  root.style.setProperty('--dm-modal-bg', vars.dmModalBg);
  root.style.setProperty('--dm-modal-border', vars.dmModalBorder);

  // 4. Update body background and color directly for immediate repaint
  document.body.style.backgroundColor = vars.appBg;
  document.body.style.color = vars.appText;

  // 5. Store in localStorage
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // ignore
  }

  // 6. Dispatch custom event for immediate reactive re-renders
  window.dispatchEvent(new CustomEvent('cecilian:theme-change', { detail: { mode, isDark } }));

  // 7. Sync native Capacitor mobile status bar
  try {
    syncStatusBar(isDark).catch(() => {});
  } catch {
    // ignore in environments where capacitor is not initialized
  }
}

// Auto-initialize theme on import / script evaluation
if (typeof window !== 'undefined') {
  const initialMode = getStoredTheme();
  applyTheme(initialMode);

  // Listen to system preference changes if in 'system' mode
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getStoredTheme() === 'system') {
      applyTheme('system');
    }
  });
}

/**
 * Universal React Hook for Theme state and reactive toggling
 */
export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>(() => getStoredTheme());
  const [isDark, setIsDark] = useState<boolean>(() => isDarkModeActive(getStoredTheme()));

  useEffect(() => {
    const handleThemeChange = (e: any) => {
      if (e.detail?.mode) {
        setTheme(e.detail.mode);
        setIsDark(e.detail.isDark ?? isDarkModeActive(e.detail.mode));
      }
    };
    window.addEventListener('cecilian:theme-change', handleThemeChange);
    return () => window.removeEventListener('cecilian:theme-change', handleThemeChange);
  }, []);

  const toggleTheme = () => {
    const nextMode: ThemeMode = isDark ? 'light' : 'dark';
    applyTheme(nextMode);
    setTheme(nextMode);
    setIsDark(!isDark);
  };

  const setThemeMode = (mode: ThemeMode) => {
    applyTheme(mode);
    setTheme(mode);
    setIsDark(isDarkModeActive(mode));
  };

  return { theme, isDark, toggleTheme, setThemeMode };
}

