# Implementation Plan: Vercel Build, CodeQL Code Scanning & Security Remediation

## Executive Summary
This plan resolves all 4 issues identified across the user's dashboard images:
1. **Vercel & GitHub Actions Build Failures** (`All checks have failed`):
   - **Root Cause**: `src/lib/firebase.ts` had a hard static import `import rawFirebaseConfig from '../../firebase-applet-config.json'`. When `firebase-applet-config.json` was gitignored, remote CI environments (Vercel and GitHub Actions) failed to resolve the module and aborted the build. Additionally, an obsolete `shadcn/tailwind.css` import in `src/index.css` failed Vite styling transformation.
   - **Fix**: Replace static file import with `import.meta.glob` safe loader so builds never fail when config files are absent in CI, and configure environment variable fallbacks for Vercel.
2. **CodeQL Code Scanning Alerts (117 Open Alerts)**:
   - **ReDoS in `server.ts`**: High-severity polynomial regular expression alerts (#114, #115, #116, #117) caused by uncontrolled `/<[^>]*>/g` replaces in endpoints. Replace with safe, linear sanitizers.
   - **Insecure Randomness (`Math.random()`)**: High-severity alerts (#110, #111, #112, #113) across `AlumniContext.tsx`, `studentVerificationService.ts`, and `AdminQuickActionBar.tsx`. Replace with cryptographically secure `crypto.randomUUID()` and `crypto.getRandomValues()` utilities in `src/lib/secureId.ts`.
3. **Dependabot Vulnerability Alerts (4 Remaining Open Alerts)**:
   - Patch `qs` (DoS via Attacker Controlled isBuffer & arrayFormat), `deepmerge` (prototype poisoning), and `zod` by locking overrides and updating the dependency tree.
4. **Google API Key Secret Scanning Alerts (3 Open Alerts)**:
   - Provide exact verification and GitHub UI steps to mark false-positive/revoked and configure Google Cloud Console API restrictions.

---

## User Review Required

> [!IMPORTANT]
> - In Vercel Project Settings > **Environment Variables**, ensure you add `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID`, and `VITE_FIREBASE_APP_ID` if your production deployment relies on client-side Firebase.
> - For the 3 Secret Scanning alerts on GitHub, because GitHub maintains historical commit scan records, navigate to **Security and quality** > **Secret scanning** and click **Close alert** > **Revoked / False positive**.

---

## Proposed Changes

### Phase 1: Vercel & CI Build Resiliency (`src/lib/firebase.ts`)
- Replace the direct static import `import rawFirebaseConfig from '../../firebase-applet-config.json'` with Vite's safe glob loader:
  ```ts
  const localConfigModules = import.meta.glob('../../firebase-applet-config.json', { eager: true });
  ```
- If the file is gitignored or absent on Vercel/GitHub Actions, it defaults gracefully to empty object `{}` and consumes `import.meta.env.VITE_FIREBASE_*` without failing the Vite build.

### Phase 2: CodeQL ReDoS Regular Expression Remediation (`server.ts`)
- In `server.ts` lines 3123–3125 and line 3738, replace the polynomial regex `/<[^>]*>/g` with a safe, non-backtracking text sanitization utility:
  ```ts
  function sanitizePlainText(input: unknown, maxLength: number): string {
    if (!input) return '';
    return String(input)
      .replace(/&[a-z0-9]+;/gi, ' ')
      .replace(/[<>]/g, '')
      .trim()
      .slice(0, maxLength);
  }
  ```
- This eliminates CodeQL alerts #114, #115, #116, #117.

### Phase 3: Cryptographic Randomness Remediation (`src/lib/secureId.ts`)
- Create `src/lib/secureId.ts`:
  - `generateSecureId(prefix)`: Uses `crypto.randomUUID()` or `crypto.getRandomValues()`.
  - `generateSecureNumericCode(digits)`: Generates cryptographically secure numeric codes.
- Replace `Math.random()` in:
  - `src/context/AlumniContext.tsx` (lines 1399, 3585, 3651, 4342, 4384, 4872, 5499, 5599)
  - `src/services/studentVerificationService.ts` (lines 197, 971)
  - `src/components/admin/AdminQuickActionBar.tsx` (line 46)
  - `server.ts` (lines 3742, etc.)

### Phase 4: Finalize Dependabot Overrides (`package.json`)
- Add root overrides for `qs: "^6.14.0"` and `deepmerge: "^4.3.1"`.
- Run `npm install` and verify `npm audit` shows 0 high/critical application vulnerabilities.

---

## Verification Plan

### Automated Verification
1. Run `lint_applet` (`tsc --noEmit`) to verify zero TypeScript errors.
2. Run `compile_applet` (`npm run build`) with and without `firebase-applet-config.json` to prove Vercel and GitHub Actions will succeed.
3. Run `npm audit` to verify vulnerabilities are cleared.
