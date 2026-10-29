# Implementation Plan: Professional Direct Messages Relayout & Vercel/APK Access Resolution

## Executive Summary
This plan delivers:
1. **Direct Messages UI Redesign**:
   - Eliminate the public directory card grid currently rendered in the front zero-state of the messaging view.
   - Replace it with a **minimalist, executive institutional welcome view** featuring the St. Cecilia collegiate insignia, security verification metrics, and a "Start New Conversation" prompt.
   - Polish active chat bubbles, recipient status indicators, and composer layout to institutional-grade craftsmanship.
2. **Vercel & Android APK Accessibility Fix**:
   - Build a centralized `apiClient` (`src/lib/apiClient.ts`) that correctly routes API calls to the live backend server when running inside the Capacitor Android APK (`Capacitor.isNativePlatform()`), preventing `Failed to fetch` on `https://localhost`.
   - Update `vercel.json` with framework metadata (`"framework": "vite"`, `"outputDirectory": "dist"`) and ensure `api/index.ts` works seamlessly as a Vercel serverless entry point.
   - Configure Android network security and cleartext permissions in `capacitor.config.ts` and `AndroidManifest.xml`.

---

## Proposed Changes

### 1. Direct Messages Relayout (`src/components/messages/MessagesView.tsx`)
- **Zero-State Redesign (No People Cards on Front)**:
  - Remove lines 1874–2000 (the directory grid dumping alumni cards on the front page).
  - Implement a clean, institutional welcome view:
    - St. Cecilia's crest & ShieldCheck icon in refined stone/crimson finish.
    - Title: "Cecilian Dispatch & Secure Direct Messaging".
    - Verified security badge ("End-to-End Institutional Encryption").
    - Action buttons: "Compose New Message" (opens search modal on demand) and "Filter Unread Threads".
    - Minimalist stats: Active channels count, average dispatch latency, verified status.
- **Enhanced Chat Experience**:
  - Tighter message bubble optical padding and timestamps.
  - Quick action bar for message search, unread toggle, and public profile inspection.

### 2. Unified API Client & Android APK Backend Resolution (`src/lib/apiClient.ts`)
- Create `src/lib/apiClient.ts`:
  - When in browser: routes to `/api/*` (relative).
  - When in native APK (`Capacitor.isNativePlatform()`): routes to the remote backend URL (`https://ais-pre-js4yzqo7mj7uozlkhn6ayj-399985038754.asia-northeast1.run.app` or `VITE_API_BASE_URL`).
  - Replaces hardcoded `fetch('/api/...')` in core authentication and messaging services.

### 3. Vercel Configuration & Serverless Handler (`vercel.json` & `api/index.ts`)
- Update `vercel.json` with `"outputDirectory": "dist"` and `"framework": "vite"` to guarantee Vercel deploys the SPA correctly without 404s.
- Update `api/index.ts` to export a robust Express serverless handler compatible with Vercel's Node.js runtime.

### 4. Capacitor Android Permissions (`capacitor.config.ts` & `AndroidManifest.xml`)
- Add `server.cleartext: true` and configure `android:usesCleartextTraffic="true"` to ensure Android WebView allows external communication to the backend.

---

## Verification Plan
1. Run `lint_applet` (`tsc --noEmit`) to verify zero TypeScript errors.
2. Run `compile_applet` (`npm run build`) to confirm compilation succeeds.
3. Test Direct Messages zero-state to verify no raw people cards appear on the front.
4. Verify API client routing on both web and native environments.
