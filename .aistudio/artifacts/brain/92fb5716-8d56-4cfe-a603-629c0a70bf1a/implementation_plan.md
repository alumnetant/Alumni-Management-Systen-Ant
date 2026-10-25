# Implementation Plan: Web Digital Alumni ID Access & Landing Features Clean-Up

## 1. Overview & Core Intent
1. **Digital Alumni ID on the Website**: Remove the artificial `PlatformOnly` mobile-exclusive restriction that was blocking website users from seeing their real interactive Digital Alumni Pass. Enable alumni on the website to view and flip their actual, scannable **Digital Alumni ID Card** directly via the header/sidebar pass modal and embedded directly in their Alumni Profile page.
2. **Landing Page Features Clean-Up**: Under "FEATURES & NETWORK CAPABILITIES" on the institutional landing page, remove the interactive action buttons (`Explore`, `Preview Pass`, `Browse Jobs`, `Read Feed`, `Find Chapter`, `View Hall of Fame`) while retaining the clean, subtle feature status metadata.

---

> [!IMPORTANT]
> **Summary of Confirmed User Decisions**
> - **Web Digital Alumni ID Access**: Rendered directly in the **modal popup** (accessible from the sidebar pass button, dashboard pass button, and mobile drawer) AND embedded directly inside the **Alumni Profile** page on web desktop.
> - **Landing Page Feature Footers**: Remove the 6 action buttons (`Explore`, `Preview Pass`, `Browse Jobs`, `Read Feed`, `Find Chapter`, `View Hall of Fame`) and preserve the subtle feature status text (e.g. *Verified Match Records*, *Instant QR Verification*, *For Employers & Alumni*, *Admin Broadcasts*, *12 Active Hubs*, *Cecilian Pride*).

---

## 2. Proposed Changes

### A. Digital Alumni ID Access on Web (`AlumniWorkspaceLayout.tsx` & `ProfileView.tsx`)
1. **Pass Modal (`src/components/alumni/AlumniWorkspaceLayout.tsx`)**:
   - Replace `<PlatformOnly client="mobile" fallback={<WebDigitalPassCard user={currentUser} />}><DigitalAlumniCard /></PlatformOnly>` with direct `<DigitalAlumniCard user={currentUser} />`.
   - On desktop website and mobile alike, clicking the "Digital Alumni Pass" button (in the sidebar, masthead greeting, or mobile drawer) will open the full interactive, metallic, 3D flippable digital ID card with real QR verification and card flip animations.
2. **Embedded Profile Pass (`src/components/profile/ProfileView.tsx`)**:
   - Remove the `PlatformOnly` wrapper around `#digital-id-section` that previously swapped the real card with the download prompt.
   - Render `<DigitalAlumniCard user={currentUser} />` directly in the Alumni Profile view for all desktop and mobile web sessions.

### B. Clean-Up Landing Page Feature Cards (`src/components/landing/LandingPage.tsx`)
- In the 6-grid feature cards under "FEATURES & NETWORK CAPABILITIES":
  - **Card 1 (Alumni Network)**: Keep `<span>Verified Match Records</span>`, remove `<span className="text-[#8B181B] font-semibold">Explore</span>`.
  - **Card 2 (Digital Alumni Card)**: Keep `<span>Instant QR Verification</span>`, remove `<span className="text-[#B45309] font-semibold">Preview Pass</span>`.
  - **Card 3 (Career Placement Board)**: Keep `<span>For Employers & Alumni</span>`, remove `<span className="text-emerald-800 font-semibold">Browse Jobs</span>`.
  - **Card 4 (Institutional Announcements)**: Keep `<span>Admin Broadcasts</span>`, remove `<span className="text-stone-700 font-semibold">Read Feed</span>`.
  - **Card 5 (Global Batch Chapters)**: Keep `<span>12 Active Hubs</span>`, remove `<span className="text-[#8B181B] font-semibold">Find Chapter</span>`.
  - **Card 6 (Milestones & Honors)**: Keep `<span>Cecilian Pride</span>`, remove `<span className="text-[#B45309] font-semibold">View Hall of Fame</span>`.

---

## 3. Verification & Testing
1. **Type & Lint Check**: Run `lint_applet` (`tsc --noEmit`) to verify clean TypeScript compilation.
2. **Build Check**: Run `compile_applet` to verify production Vite build.
3. **Visual Verification**:
   - Verify on desktop web (`>= 1024px`) that clicking "Digital Alumni Pass" displays the interactive metallic card with QR code, flip capability, and full details.
   - Verify on the profile page that the digital card renders cleanly and interactively.
   - Verify on the landing page that the 6 feature cards under "FEATURES & NETWORK CAPABILITIES" display clean status text without the removed action buttons.
