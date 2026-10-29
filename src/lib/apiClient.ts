/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Capacitor } from '@capacitor/core';

/**
 * Default production backend fallback for Android APK and native builds.
 * When running inside a native Android APK WebView (origin: https://localhost),
 * relative calls like fetch('/api/...') fail because no server runs on the phone.
 * This resolves all API requests to the deployed institutional backend.
 */
export const REMOTE_API_FALLBACK = 'https://ais-pre-js4yzqo7mj7uozlkhn6ayj-399985038754.asia-northeast1.run.app';

/**
 * Resolves the appropriate base URL for API endpoints.
 */
export function getApiBaseUrl(): string {
  // Check if explicit override is provided in environment variables
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/+$/, '');
  }

  // On native mobile devices (Android APK / iOS), always route to remote production backend
  if (Capacitor.isNativePlatform()) {
    return REMOTE_API_FALLBACK.replace(/\/+$/, '');
  }

  // In web browser, relative path is optimal and preserves cookies / proxy
  return '';
}

/**
 * Resolves an API path (e.g. '/api/auth/login') to an absolute URL if on native mobile.
 */
export function resolveApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const baseUrl = getApiBaseUrl();
  return baseUrl ? `${baseUrl}${normalizedPath}` : normalizedPath;
}

/**
 * Enhanced fetch wrapper that automatically routes to the remote backend when running in APK.
 */
export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const resolvedUrl = resolveApiUrl(input);
  return fetch(resolvedUrl, init);
}

/**
 * Initializes global window.fetch interceptor for native APK environments
 * to seamlessly route all legacy fetch('/api/*') calls without breaking any existing components.
 */
export function initializeNativeNetworkRouting(): void {
  if (typeof window === 'undefined') return;

  if (Capacitor.isNativePlatform()) {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      if (typeof input === 'string' && input.startsWith('/api')) {
        const fullUrl = resolveApiUrl(input);
        return originalFetch(fullUrl, init);
      }
      return originalFetch(input, init);
    };
    console.info('[Network] Native Android APK API routing active -> Remote backend target:', REMOTE_API_FALLBACK);
  }
}
