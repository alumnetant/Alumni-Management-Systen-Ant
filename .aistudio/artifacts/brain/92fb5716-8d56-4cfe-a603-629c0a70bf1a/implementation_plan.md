# Implementation Plan: GitHub Security Alerts & Vulnerability Remediation

## Executive Summary
This plan addresses the two categories of security alerts reported by GitHub:
1. **Secret Scanning Alerts (3 Open Alerts)**: Public leak warnings on Google API keys in `firebase-applet-config.json`, Android `strings.xml`, and built iOS web bundle `ios/.../assets/index-Cm0BVnYY.js`.
2. **Dependabot Vulnerability Alerts (45 Open Alerts)**: Transitive and direct dependency vulnerabilities including DOMPurify template bypass, SheetJS prototype pollution & ReDoS, proxy-addr IP spoofing, Zod memory exhaustion, Vite launch-editor, and body-parser DoS.

---

## Part 1: Resolving Secret Scanning Alerts (Google API Key Leaks)

### Understanding the Alert
- The flagged strings (`AIzaSy...`) are Firebase client-side identifiers used to route requests to your Firebase project. In Firebase architecture, web and mobile client keys are technically public client identifiers, but GitHub Secret Scanning alerts on any string matching the Google API key pattern.
- Committing these in plaintext directly to a public GitHub repo triggers automated alerts and exposes your Firebase project quota if keys lack API restrictions.

### Proposed Changes:
1. **Update `.gitignore` to Exclude Sensitive Configurations & Built Assets**:
   - Add `firebase-applet-config.json` to `.gitignore`.
   - Add built web assets copied into mobile platforms (`ios/App/App/public/`, `android/app/src/main/assets/public/`, `dist/`) to `.gitignore` so minified JS files (like `index-Cm0BVnYY.js`) are never committed.
   - Provide a sanitized `firebase-applet-config.example.json` for template reference without real keys.

2. **Move Keys to Environment Variables in `firebase.ts`**:
   - Ensure `src/lib/firebase.ts` reads `import.meta.env.VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID`, etc., falling back gracefully.
   - Update `.env.example` with clear documentation for all `VITE_FIREBASE_*` variables.

3. **Sanitize Android `strings.xml`**:
   - Replace the hardcoded `google_api_key` in `android/app/src/main/res/values/strings.xml` with placeholder text or extract to untracked `res/values/secrets.xml` / environment variables.

4. **Security Advisory & Key Restriction Guidance**:
   - Provide step-by-step instructions for Google Cloud Console:
     - Restrict the Web API key by HTTP referrers (e.g., your app's domain).
     - Restrict the Android API key by Package Name (`com.aistudio.applet.cnztsm`) and SHA-1 fingerprint.
     - Guide the user on closing/resolving the 3 alerts in GitHub's "Security and quality" tab.

---

## Part 2: Remediating Dependabot Vulnerability Alerts (45 Dependencies)

### Targeted Vulnerability Fixes:
1. **DOMPurify (`SAFE_FOR_TEMPLATES` & `IN_PLACE` bypasses)**:
   - Upgrade `dompurify` and `@types/dompurify` to `^3.2.4` (or latest patched release).
2. **SheetJS `xlsx` (Prototype Pollution & ReDoS)**:
   - Add package override or upgrade `xlsx` to a patched release, or wrap ingestion with strict prototype sanitization.
3. **Zod (Memory Exhaustion on Oversized Collections)**:
   - Upgrade `zod` to `>= 3.23.8` (or `^3.24.0`).
4. **Express / Body-Parser / Proxy-Addr (DoS & IP Spoofing)**:
   - Upgrade `body-parser` (`>= 1.20.3`), `express` (`>= 4.21.1`), and `proxy-addr` (`>= 2.0.7`) in `package.json` and via npm `overrides`.
5. **Vite / launch-editor (Windows path existence bypass)**:
   - Upgrade `vite` to latest compatible patch version.
6. **Execute Automated Fix**:
   - Run `npm audit fix` to automatically resolve non-breaking transitive dependency vulnerabilities.
   - Add targeted `overrides` in `package.json` for transitive dependencies that require specific minimum secure versions.

---

## Part 3: Verification & Quality Assurance

1. **Type Checking & Linting**:
   - Run `lint_applet` (`tsc --noEmit`) to verify zero TypeScript compilation issues.
2. **Build Validation**:
   - Run `compile_applet` (`npm run build`) to confirm the Vite bundle builds cleanly with upgraded packages.
3. **Dependency Audit Re-check**:
   - Run `npm audit` to verify the drop in critical and high vulnerabilities.
4. **Deliverables Summary**:
   - Provide summary of updated files, `.gitignore` entries, `.env.example` keys, and the exact steps to close the alerts on GitHub.
