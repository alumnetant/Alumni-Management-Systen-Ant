# Resilient Startup & Hybrid Network Architecture Plan

Eliminates the blank white screen on web and Android APK startup, establishes instant offline-first session restoration, and deploys a fault-tolerant hybrid API network client with full CORS and Error Boundary safeguards.

## User Review & Critical Decisions

> [!IMPORTANT]
> The user confirmed the following architectural selections in Phase 1:
> - **Issue Scope**: Affects both the Web preview/production browser and the installed Android APK.
> - **Session Strategy**: **Offline-first with instant local session restore**. The app must never block initial UI rendering or freeze on a loading logo while awaiting remote network validation.
> - **APK Network Architecture**: **Hybrid network routing with resilient local fallback**. Native requests will target remote services with a strict 3-second timeout and instant fallback to cached offline storage.

- **Confirmed Decision 1**: Implement offline-first instant authentication initialization in `AlumniContext.tsx` so `authReady` immediately resolves to `true` synchronously or within 50ms using locally verified credentials vault data.
- **Confirmed Decision 2**: Replace fragile global `window.fetch` monkey-patching with a safe, native-only, non-interfering API routing utility with strict abort timeouts (3s) and silent failure recovery.
- **Confirmed Decision 3**: Mount a top-level institutional React `ErrorBoundary` in `main.tsx` and `App.tsx` that catches any runtime exceptions, displays a Cecilian recovery console with a "Reset & Reload" button, and completely prevents white-screen unmounts.
- **Confirmed Decision 4**: Add permissive CORS (`Access-Control-Allow-Origin: *`) and comprehensive CSP `connect-src` directives in `server.ts` to ensure Android WebView and external clients are never rejected or blocked.

---

## 1. Overview & Core Concept

- **What It Does**: Resolves the root cause of the blank white screen on web and the indefinite loading logo spinner in the Android APK. Guarantees that whether a user opens the application on desktop web, mobile browser, PWA, or native Android APK, the interface loads in <200ms into the authenticated portal or landing page without network stalling.
- **Target Audience / Persona**: St. Cecilia's College alumni, administrators, faculty, and student users across web and Android devices.
- **Key Value**: 100% startup reliability, zero white-screen crashes, seamless offline access, and robust remote API routing.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  - **Launch Flow**: User opens the app (Web or APK). The app immediately reads local session credentials and mounts the home workspace or landing page in <150ms. No indefinite "Restoring your Cecilian session..." logo hang.
  - **Background Verification Flow**: Session validity and fresh cloud updates are verified quietly in the background. If the device is offline or the backend is cold-booting, the user experiences zero UI interruption.
  - **Error Shield Flow**: In the rare event of an unexpected component failure, a refined institutional Error Boundary dialog rendered in Cecilian style (`#8B181B` deep crimson badge, stone-100 card, clear diagnostic details, and a 1-click "Reload Portal" button) appears instead of an empty white void.

- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Institutional Collegiate, St. Cecilia's College branding.
  - *Palette*: Deep crimson (`#8B181B`), warm stone neutrals (`#FAF9F6`, `bg-stone-50`), rich charcoal (`#1C1917`), subtle 1px hairline borders (`border-stone-200/80`).
  - *Typography*: Plus Jakarta Sans with clean tabular numerals (`font-mono tabular-nums`) and natural editorial headers.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Offline-First Synchronous Auth Resolution**
  - *Chosen Approach*: `AlumniContext.tsx` immediately initializes `currentUserId` and sets `authReady = true` using local storage / credentials vault. Network validation against `/api/auth/session` occurs asynchronously in the background.
  - *Why*: Eliminates the network bottleneck that causes the spinning logo freeze in the APK and the white screen when `currentView === 'portal'` before the user is resolved.
  - *Alternatives Considered*: Waiting for network with a spinner — rejected because mobile networks and cold-start backends cause multi-second freezes.

- **Decision 2: Safe Scoped API Client Instead of Invasive Monkey-Patching**
  - *Chosen Approach*: Maintain a dedicated, safe `apiFetch` and `resolveApiUrl` helper. When running in web browsers, use standard relative URLs natively. Only inside native Capacitor APK (`Capacitor.isNativePlatform()`), resolve relative `/api/*` to the remote URL with an automatic 3000ms `AbortController` timeout.
  - *Why*: Modifying `window.fetch` globally in `main.tsx` broke browser streaming and threw constructor errors on certain Request objects, which unmounted React and created the white screen.
  - *Alternatives Considered*: Leaving `window.fetch` globally patched — rejected because it interferes with Vite HMR, Firebase internal transport, and service worker caching.

- **Decision 3: Backend CORS & CSP Hardening in `server.ts`**
  - *Chosen Approach*: Explicitly handle pre-flight `OPTIONS` requests and send standard CORS headers (`Access-Control-Allow-Origin: *`, `Access-Control-Allow-Headers: Authorization, Content-Type, X-Client-Platform`). Add `https://*.run.app` and `https://localhost` to CSP `connect-src`.
  - *Why*: Android WebView in Capacitor executes from `https://localhost` and blocks cross-origin requests unless the server sends appropriate CORS headers.

---

## 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Runtime                         │
│  (Desktop Web / Mobile Web / PWA / Android APK WebView)     │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
               ▼                               ▼
    ┌────────────────────┐          ┌───────────────────────┐
    │  Local Storage &   │          │ React Error Boundary  │
    │  Credentials Vault │          │ (Catches unhandled    │
    │  (Instant Session) │          │  render exceptions)   │
    └──────────┬─────────┘          └──────────┬────────────┘
               │                               │
               ▼                               ▼
    ┌────────────────────────────────────────────────────────┐
    │     AlumniContext: authReady = true immediately         │
    │     Background sync via AbortController (3s timeout)   │
    └──────────────────────────┬─────────────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
   [Web Browser: Same-Origin]            [Android APK: Remote Fallback]
   Fetch: /api/* -> local server         Fetch: resolveApiUrl -> Cloud Run
   CORS & CSP compliant                  CORS: Access-Control-Allow-Origin: *
```

### File Changes Required:
1. `src/services/apiClient.ts`: Remove fragile `window.fetch` prototype overwrite that breaks in WebViews; implement clean `apiFetch` with 3-second timeout and graceful fallback to offline cache.
2. `src/main.tsx`: Wrap the root application in an institutional `ErrorBoundary` component with error logging and instant retry.
3. `src/components/common/ErrorBoundary.tsx`: Create a polished, institutional fallback UI conforming to `AGENTS.md` and `frontend-design`.
4. `src/context/AlumniContext.tsx`: Ensure `restoreActiveSession` synchronously loads cached credentials, sets `authReady = true` immediately, and performs server validation non-blockingly with an `AbortController`.
5. `src/App.tsx`: Prevent rendering `null` when `currentView === 'portal'`; provide smooth fallback to `auth` or `landing` without flashing white.
6. `server.ts`: Add standard CORS middleware (`Access-Control-Allow-Origin: *`) and update CSP `connect-src` to include `https://*.run.app` and `https://localhost`.
