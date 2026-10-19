# Unified Website & APK/App Typography Consistency Plan

This plan establishes absolute typographic consistency and offline rendering parity between the desktop Web Portal and the mobile Android APK/App. By bundling local **Plus Jakarta Sans** font assets directly within the application package (`@fontsource/plus-jakarta-sans`), both the website and the APK render identical collegiate typography regardless of network connectivity. All discordant serif classes are purged, while monospace typography is strictly reserved for technical IDs and security hashes.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> **Key Decisions Confirmed by User**:
> 1. **Bundled Local Font Delivery**: Package `@fontsource/plus-jakarta-sans` directly into the build pipeline so the APK has instant offline font access without relying on external Google Fonts CDN fetches.
> 2. **Mobile Typography Smoothing**: Enforce `-webkit-font-smoothing: antialiased`, `-moz-osx-font-smoothing: grayscale`, and `text-rendering: optimizeLegibility` across Android WebView and iOS Safari.
> 3. **Purge Serif Overrides**: Replace all `font-serif` classes across modals, greetings, landing pages, and admin consoles with clean `font-sans`.
> 4. **Strict Monospace Discipline**: Monospace typography (`font-mono`) is exclusively permitted for student IDs, alumni pass hashes, batch years, and cryptographic signatures.

---

## 1. Architectural Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│               Bundled Font Pipeline (Website & APK)                    │
├────────────────────────────────────────────────────────────────────────┤
│  @fontsource/plus-jakarta-sans (Weights: 300, 400, 500, 600, 700, 800)  │
│  ├── Embedded into Vite dist/assets (Offline parity for Android APK)   │
│  └── Eliminates external CDN network latency & FOUT in native app     │
│                                                                        │
│  src/index.css:                                                        │
│  - @theme mappings:                                                    │
│      --font-sans: "Plus Jakarta Sans", sans-serif                      │
│      --font-heading: "Plus Jakarta Sans", sans-serif                   │
│      --font-display: "Plus Jakarta Sans", sans-serif                   │
│      --font-serif: "Plus Jakarta Sans", sans-serif                     │
│      --font-mono: ui-monospace, SFMono-Regular, monospace              │
│  - Global rules: html, body, h1-h6, button, input inherit font-sans     │
│  - Mobile WebView smoothing & touch legibility rules                   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Component Refactoring & Clean-Up                     │
├────────────────────────────────────────────────────────────────────────┤
│  Replace stray `font-serif` classes across:                            │
│  - Modals (AuthModal, ForgotPasswordModal, ConfirmationModal, Gallery) │
│  - Admin Views (GovernancePolicies, RequestsAndConflicts, AuditLog)    │
│  - Landing Sections (AppDownloadModal, Landing3DPass, AnimatedStat)    │
│  - User Experience (CollegiateGreetingBanner, DigitalAlumniCard)       │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Proposed Implementation Steps

### Step 1: Install Bundled Font Assets Package
- Install `@fontsource/plus-jakarta-sans` via `install_applet_package`.
- Import the full weight suite in `src/main.tsx`:
  - `import '@fontsource/plus-jakarta-sans/300.css';`
  - `import '@fontsource/plus-jakarta-sans/400.css';`
  - `import '@fontsource/plus-jakarta-sans/500.css';`
  - `import '@fontsource/plus-jakarta-sans/600.css';`
  - `import '@fontsource/plus-jakarta-sans/700.css';`
  - `import '@fontsource/plus-jakarta-sans/800.css';`

### Step 2: Clean `index.html` CDN Links
- Remove the external `Cormorant Garamond` Google Fonts stylesheet link to prevent conflicting serif font downloads.

### Step 3: Global Typography & Mobile Smoothing (`src/index.css`)
- Configure `@theme` font variables to map all typography tokens (`--font-sans`, `--font-heading`, `--font-display`, `--font-serif`) to `"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`.
- Set mobile anti-aliasing and legibility properties for high-DPI phone displays and Android WebView:
  ```css
  html, body, #root, button, input, select, textarea {
    font-family: var(--font-sans);
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  ```

### Step 4: Purge Residual `font-serif` Overrides
- **Modals & Common**:
  - `src/components/auth/AuthModal.tsx`: replace `font-serif` with `font-sans font-bold`.
  - `src/components/auth/ForgotPasswordModal.tsx`: replace `font-serif` with `font-sans font-bold`.
  - `src/components/common/ConfirmationModal.tsx`: replace `font-serif` with `font-sans font-semibold`.
  - `src/components/common/GlobalCommandPalette.tsx`: replace `font-serif italic` with `font-sans italic`.
  - `src/components/gallery/CampusGalleryModal.tsx`: replace `font-serif` with `font-sans`.
- **Administrative Consoles**:
  - `src/components/admin/AdminGovernancePoliciesView.tsx`: replace `font-serif` with `font-sans`.
  - `src/components/admin/AdminRequestsAndConflictsView.tsx`: replace `font-serif` with `font-sans`.
  - `src/components/admin/AuditLogView.tsx`: replace `font-serif` with `font-sans`.
- **Landing & Marketing**:
  - `src/components/landing/Landing3DPass.tsx`: remove `font-serif`.
  - `src/components/landing/AppDownloadModal.tsx`: remove `font-serif`.
  - `src/components/landing/AppDownloadSection.tsx`: remove `font-serif`.
  - `src/components/landing/LandingPage.tsx`: remove `font-serif`.
  - `src/components/landing/CollegeHistorySection.tsx`: replace `font-serif` with `font-sans`.
  - `src/components/landing/OfflineLandingPage.tsx`: replace `font-serif` with `font-sans`.
  - `src/components/landing/AnimatedStat.tsx`: remove `font-serif`.
- **User Experience & Profile**:
  - `src/components/dashboard/CollegiateGreetingBanner.tsx`: replace `font-serif` with `font-sans`.
  - `src/components/profile/DigitalAlumniCard.tsx`: replace `font-serif italic` with `font-sans italic`.
  - `src/components/messages/EventEmailNotificationInbox.tsx`: replace `font-serif` with `font-sans`.

---

## 3. Verification Plan

1. **Grep Validation**:
   - Run `grep -rn "font-serif" src/` to verify zero residual serif classes across the codebase.
2. **Offline Font Asset Verification**:
   - Build with `npm run build` and inspect `dist/assets` to verify bundled Plus Jakarta Sans font files are included.
3. **Compilation & Lint Verification**:
   - Run `compile_applet` and `lint_applet` to confirm clean builds.
4. **Visual Consistency Check**:
   - Verify that headings, body text, buttons, modals, and navigation across both the web interface and mobile APK simulation render with uniform, crisp Plus Jakarta Sans typography.
