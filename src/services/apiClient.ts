/**
 * St. Cecilia's College - Cecilian Alumnet
 * Centralized API Client & Fetch Interceptor
 *
 * Injects:
 * - 'X-Client-Platform: web | mobile'
 * - 'Authorization: Bearer <server_auth_token>'
 *
 * Ensures all outbound API communication carries the verified client platform
 * metadata and authenticated session context.
 */

import { Capacitor } from '@capacitor/core';
import { STORAGE_KEYS } from '../context/AlumniContext';

export type ClientPlatformType = 'web' | 'mobile';

/**
 * Resolves current client platform context with override support for local testing/dev
 */
export function getClientPlatform(): ClientPlatformType {
  if (typeof window === 'undefined') return 'web';

  // 1. Explicit user/dev override stored in sessionStorage or localStorage
  try {
    const override =
      sessionStorage.getItem('client_platform_override') ||
      localStorage.getItem('client_platform_override');
    if (override === 'mobile' || override === 'web') {
      return override;
    }
  } catch {}

  // 2. Native Capacitor mobile platform detection
  if (Capacitor.isNativePlatform()) {
    return 'mobile';
  }

  // 3. User agent / screen pointer heuristic fallback
  const isWidthUnder1024 = window.innerWidth < 1024;
  const isMobileUA =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Tablet|Silk/i.test(navigator.userAgent) ||
    (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches && isWidthUnder1024);

  return isMobileUA ? 'mobile' : 'web';
}

/**
 * Retrieves the current authenticated bearer session token
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
 * Enhanced fetch wrapper that automatically attaches platform and auth headers
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const platform = getClientPlatform();
  const token = getAuthToken();

  const headers = new Headers(init?.headers || {});

  // Inject client platform header if not explicitly overridden
  if (!headers.has('X-Client-Platform')) {
    headers.set('X-Client-Platform', platform);
  }

  // Inject Authorization Bearer token if present and not provided
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(input, {
    ...init,
    headers
  });
}

let isInterceptorInstalled = false;

/**
 * Installs a transparent fetch interceptor on window.fetch
 * All relative or local requests to /api/* automatically receive:
 * - 'X-Client-Platform: web | mobile'
 * - 'Authorization: Bearer <token>'
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
          const platform = getClientPlatform();
          const token = getAuthToken();

          const headers = new Headers(
            init?.headers || (input instanceof Request ? input.headers : {})
          );

          if (!headers.has('X-Client-Platform')) {
            headers.set('X-Client-Platform', platform);
          }

          if (token && !headers.has('Authorization')) {
            headers.set('Authorization', `Bearer ${token}`);
          }

          if (input instanceof Request) {
            const modifiedRequest = new Request(input, {
              ...init,
              headers
            });
            return originalFetch(modifiedRequest);
          }

          return originalFetch(input, {
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
    } catch {
      // Ignored: fallback to Object.defineProperty
    }

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
        } catch {
          // Non-blocking
        }
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
