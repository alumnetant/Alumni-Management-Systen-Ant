/**
 * St. Cecilia's College - Cecilian Alumnet
 * Centralized API Client & Fetch Interceptor
 *
 * Injects:
 * - 'Authorization: Bearer <server_auth_token>'
 * - Resolves remote backend URL when running inside native Android APK
 *
 * Ensures all outbound API communication carries authenticated session context
 * and reaches the live server across all devices (desktop web, mobile web, tablet, PWA, and native Android APK).
 */

import { Capacitor } from '@capacitor/core';

export const REMOTE_API_FALLBACK = 'https://ais-pre-js4yzqo7mj7uozlkhn6ayj-399985038754.asia-northeast1.run.app';

export function getApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/+$/, '');
  }
  if (Capacitor.isNativePlatform()) {
    return REMOTE_API_FALLBACK.replace(/\/+$/, '');
  }
  return '';
}

export function resolveApiUrl(path: string): string {
  // If already absolute URL with http(s), return as is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const baseUrl = getApiBaseUrl();
  return baseUrl ? `${baseUrl}${normalizedPath}` : normalizedPath;
}

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
 * Enhanced fetch wrapper that automatically attaches the bearer auth header
 * and resolves absolute remote URLs when on native platforms.
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
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

  // Inject Authorization Bearer token if present and not provided
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(targetUrl, {
    ...init,
    headers
  });
}

let isInterceptorInstalled = false;

/**
 * Installs a safe fetch interceptor on window.fetch
 * All relative or local requests to /api/* automatically receive:
 * - 'Authorization: Bearer <token>'
 * - Remote URL resolution on native Android APK
 */
export function installFetchInterceptor(): void {
  if (typeof window === 'undefined' || isInterceptorInstalled) return;

  try {
    const originalFetch = typeof window.fetch === 'function' ? window.fetch.bind(window) : null;
    if (!originalFetch) return;

    const wrappedFetch = async function (
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> {
      try {
        const urlString =
          typeof input === 'string'
            ? input
            : input instanceof URL
            ? input.toString()
            : (input as Request).url || '';

        // Intercept local or relative /api/* endpoints
        const isApiRoute =
          urlString.startsWith('/api/') ||
          urlString.includes('/api/') ||
          (typeof window !== 'undefined' &&
            urlString.startsWith(window.location.origin) &&
            urlString.includes('/api/'));

        if (isApiRoute) {
          const rawPath = typeof window !== 'undefined' && urlString.startsWith(window.location.origin)
            ? urlString.slice(window.location.origin.length)
            : urlString;

          const resolvedTarget = resolveApiUrl(rawPath);
          const token = getAuthToken();
          const headers = new Headers(
            init?.headers || (input instanceof Request ? input.headers : {})
          );

          if (token && !headers.has('Authorization')) {
            headers.set('Authorization', `Bearer ${token}`);
          }

          if (input instanceof Request) {
            const modifiedRequest = new Request(resolvedTarget, {
              ...init,
              headers
            });
            return originalFetch(modifiedRequest);
          }

          return originalFetch(resolvedTarget, {
            ...init,
            headers
          });
        }
      } catch {
        // Fall through to original fetch on any error
      }

      return originalFetch(input, init);
    };

    // Safely assign without throwing if window.fetch only has a getter
    let assigned = false;
    try {
      window.fetch = wrappedFetch;
      assigned = true;
    } catch {}

    if (!assigned) {
      try {
        Object.defineProperty(window, 'fetch', {
          value: wrappedFetch,
          writable: true,
          configurable: true,
          enumerable: true
        });
        assigned = true;
      } catch {
        try {
          (globalThis as any).fetch = wrappedFetch;
          assigned = true;
        } catch {}
      }
    }

    isInterceptorInstalled = assigned;
  } catch (err) {
    console.warn(
      '[apiClient] Safe notice: Fetch interceptor could not be mounted on window.fetch; apiFetch and apiClient continue to function directly.',
      err
    );
  }
}

/**
 * Centralized API helper methods
 */
export const apiClient = {
  get: async <T = any>(url: string, headers?: Record<string, string>): Promise<T> => {
    const res = await apiFetch(url, { method: 'GET', headers });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(errData.error || `HTTP ${res.status}`);
    }
    return res.json();
  },

  post: async <T = any>(url: string, body?: any, headers?: Record<string, string>): Promise<T> => {
    const res = await apiFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(errData.error || `HTTP ${res.status}`);
    }
    return res.json();
  },

  put: async <T = any>(url: string, body?: any, headers?: Record<string, string>): Promise<T> => {
    const res = await apiFetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(errData.error || `HTTP ${res.status}`);
    }
    return res.json();
  },

  delete: async <T = any>(url: string, headers?: Record<string, string>): Promise<T> => {
    const res = await apiFetch(url, { method: 'DELETE', headers });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(errData.error || `HTTP ${res.status}`);
    }
    return res.json();
  }
};
