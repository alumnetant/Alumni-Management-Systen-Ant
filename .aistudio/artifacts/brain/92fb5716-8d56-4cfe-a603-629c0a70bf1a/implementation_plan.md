# Implementation Plan: Header Declutter & Sidebar Minimalism

## 1. Overview
Based on user feedback, we will strip away clutter from the top header and refine the sidebar into a minimalist, modern collegiate interface:
- **Header**: Remove "My Alumni Pass", "Sync Cloud", and the profile dropdown from the top bar. Keep only the collegiate brand lockup on the left, and the **Notification bell** and **Theme toggle** on the right.
- **Sidebar & Mobile Drawer**: Apply an elegant, minimalist aesthetic with a clean muted list, subtle iconography, compact spacing, and a streamlined identity badge.

---

## 2. Proposed Changes

### Top Header (`src/components/alumni/AlumniWorkspaceLayout.tsx`)
1. **Remove Unwanted Actions**:
   - Remove `My Alumni Pass` quick button.
   - Remove `Sync Cloud` loader button.
   - Remove the profile avatar & header profile dropdown (`data-profile-dropdown`).
   - Remove the central desktop search omnibar so the top header becomes razor-sharp and uncluttered.
2. **Retained Controls**:
   - Left: Menu toggle (hamburger/sidebar collapse) + St. Cecilia's seal and brand title.
   - Right: Theme toggle button (Sun/Moon) + Notifications bell with unread counter popover.

---

### Sidebar & Mobile Drawer Minimalism (`src/components/alumni/AlumniWorkspaceLayout.tsx`)
1. **Streamlined Alumnus Identity**:
   - Replace bulky containers with a sleek, compact horizontal lockup (small 28px avatar, alumnus name, verified badge).
   - Compact "Digital Pass" action button with subtle styling.
2. **Clean Muted List Presentation**:
   - Compact vertical rhythm (`py-2 px-2.5`, `gap-2`).
   - Muted neutral typography (`text-stone-600 dark:text-stone-400` with subtle hover contrast).
   - Minimalist, thin-stroke Lucide icons (`strokeWidth={1.75}`) without loud multi-colored backgrounds.
   - Clean group labels with subtle uppercase tracking.
3. **Session & Security Utilities**:
   - Compact bottom actions for Alumni Profile, Settings, Face ID Lock, and Sign Out.

---

## 3. Verification & Quality Assurance
1. **Compilation Check**: Run `lint_applet` (`tsc --noEmit`) and `compile_applet` to verify clean build.
2. **Visual & Responsive Testing**: Ensure the simplified header looks balanced on both mobile (375px–430px), tablet (768px–1024px), and desktop viewports, with seamless access to profile and pass via the minimalist sidebar.
