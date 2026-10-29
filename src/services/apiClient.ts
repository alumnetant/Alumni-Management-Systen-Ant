/**
 * St. Cecilia's College - Cecilian Alumnet
 * Centralized Resilient API Client
 *
 * Provides:
 * - Scoped 'Authorization: Bearer <token>' header injection
 * - Native Android APK (Capacitor) remote backend URL resolution
 * - Fast timeout & offline resilience to prevent UI hangs on startup
 */

import { Capacitor } from '@capacitor/core';

export const REMOTE_API_FALLBACK = 'https://ais-pre-js4yzqo7mj7uozlkhn6ayj-399985038754.asia-northeast1.run.app';

/**
 * Resolves the appropriate base URL for API endpoints.
 */
export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/+$/, '');
  }
  
  // On native Android APK (Capacitor), route to remote Cloud Run backend
  if (Capacitor.isNativePlatform()) {
    return REMOTE_API_FALLBACK.replace(/\/+$/, '');
  }
  
  // In standard web browser, relative URLs route to same origin
  return '';
}

/**
 * Resolves an API path (e.g. '/api/auth/session') to an absolute URL if running inside native APK.
 */
export function resolveApiUrl(path: string): string {
  if (!path || typeof path !== 'string') return '';
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const baseUrl = getApiBaseUrl();
  return baseUrl ? `${baseUrl}${normalizedPath}` : normalizedPath;
}

/**
 * Retrieve active authorization token from browser or app storage
 */
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return (
      localStorage.getItem('alumni_server_auth_token') ||
      sessionStorage.getItem('alumni_server_auth_token') ||
      localStorage.getItem('alumni_auth_token') ||
      null
    );
  } catch {
    return null;
  }
}

/**
 * Robust fetch wrapper that attaches Bearer authentication,
 * resolves remote backend URLs on native APK, and enforces a safety timeout
 * to prevent hanging requests from blocking the UI.
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs: number = 3500
): Promise<Response> {
  const urlString =
    typeof input === 'string'
      ? input
      : input instanceof URL
      ? input.toString()
      : (input as Request).url || '';

  const targetUrl = resolveApiUrl(urlString);
  const token = getAuthToken();
  const headers = new Headers(init?.headers || {});

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('X-Client-Platform')) {
    headers.set('X-Client-Platform', Capacitor.isNativePlatform() ? 'android-apk' : 'web');
  }

  // Set up safety timeout controller to avoid infinite hangs on cold starts
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(targetUrl, {
      ...init,
      headers,
      signal: init?.signal || controller.signal
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Safe fetch interceptor helper.
 * On native Android APK, intercepts relative /api/* string calls cleanly.
 * Leaves standard browser window.fetch untouched to prevent breaking Vite, React, or Service Workers.
 */
export function installFetchInterceptor(): void {
  if (typeof window === 'undefined') return;

  // Only apply scoped interceptor in native Capacitor environment where relative /api doesn't have a local server
  if (Capacitor.isNativePlatform()) {
    try {
      const originalFetch = window.fetch.bind(window);
      window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
        if (typeof input === 'string' && input.startsWith('/api')) {
          const resolvedUrl = resolveApiUrl(input);
          return originalFetch(resolvedUrl, init);
        }
        return originalFetch(input, init);
      };
      console.info('[Network] Native Android APK routing configured ->', REMOTE_API_FALLBACK);
    } catch (err) {
      console.warn('[Network] Native interceptor notice:', err);
    }
  }
}

// Re-export convenience apiClient object
export const apiClient = {
  get: (url: string, init?: RequestInit) => apiFetch(url, { ...init, method: 'GET' }),
  post: (url: string, body?: any, init?: RequestInit) =>
    apiFetch(url, {
      ...init,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers || {})
      },
      body: body ? JSON.stringify(body) : undefined
    }),
  put: (url: string, body?: any, init?: RequestInit) =>
    apiFetch(url, {
      ...init,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers || {})
      },
      body: body ? JSON.stringify(body) : undefined
    }),
  delete: (url: string, init?: RequestInit) => apiFetch(url, { ...init, method: 'DELETE' })
};
