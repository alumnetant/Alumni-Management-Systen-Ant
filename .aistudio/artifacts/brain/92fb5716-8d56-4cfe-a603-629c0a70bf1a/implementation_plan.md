# Implementation Plan: Native App-Like Transitions, Data Security Hardening & Comfy UX

A comprehensive upgrade bringing native app fluidity, privacy defense, and tactile comfort to St. Cecilia's College Alumnet:
1. **Framer Motion Transitions**: Native-feeling directional horizontal slide & gentle fade between views based on tab index, plus animated active tab pills.
2. **Data Security Hardening**: Sensitive contact masking (phone numbers & student IDs with tap-to-reveal) and encrypted local pass caching.
3. **Comfy UX Ergonomics**: Floating quick-action bar (smooth scroll-to-top, quick pass, ⌘K search) and padded 44px touch targets with spring tap physics.

---

> [!IMPORTANT]
> **Summary of Confirmed User Decisions**
> - **Transition Style**: Subtle directional slide with gentle fade based on tab index direction (+1 / -1).
> - **Security Hardening**: Both sensitive contact masking (tap-to-reveal) and encrypted offline local pass cache.
> - **Comfy UX**: Both floating quick actions (scroll-to-top, pass trigger) and enhanced touch ergonomics.

---

## 1. Upgrade Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ALUMNI WORKSPACE ROUTER                         │
│             Framer Motion Directional Slider [x: -18px ↔ +18px]        │
├────────────────────────────────────────────────────────────────────────┤
│ • Module Index Mapping:                                                │
│   Home(0) ↔ Directory(1) ↔ Events(2) ↔ Jobs(3) ↔ Messages(4) ↔ ...    │
│ • Custom Directional Variant:                                          │
│   Moving Forward:  Enters from +18px, exits to -18px                   │
│   Moving Backward: Enters from -18px, exits to +18px                   │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌───────────────────────────────────┬────────────────────────────────────┐
│      DATA SECURITY HARDENING      │           COMFY UX PILL            │
├───────────────────────────────────┼────────────────────────────────────┤
│ • Tap-to-Reveal Contact Masking   │ • Floating Quick Action Dock       │
│   Phone: +63 9•• ••• •892         │   - Smooth "Back to Top"           │
│   ID:    SCC-••••-0192            │   - One-tap Digital Pass launcher  │
│ • Encrypted Offline Pass Storage  │   - Quick Search (⌘K) trigger      │
│   Salted device-bound ciphertext  │ • 44px+ Padded Touch Ergonomics    │
│   in localStorage                 │ • Spring Tap Feedback (active:0.98)│
└───────────────────────────────────┴────────────────────────────────────┘
```

---

## 2. Detailed Implementation Plan

### A. Framer Motion Directional Page & Tab Transitions
- In `src/components/alumni/AlumniWorkspaceLayout.tsx`:
  - Define an ordered module index map:
    `['dashboard', 'network', 'events', 'opportunities', 'messages', 'announcements', 'profile', 'settings']`.
  - Maintain `[currentModule, prevModule]` state to determine `direction = currentIndex > prevIndex ? 1 : -1`.
  - Wrap the content viewport in `<AnimatePresence mode="wait" custom={direction}>` with smooth cubic-bezier easing (`[0.25, 1, 0.5, 1]`) and 0.22s duration.
  - Add Framer Motion `layoutId="active-tab-pill"` on the active navigation items for seamless indicator sliding.

### B. Data Security: Contact Masking & Encrypted Offline Pass
1. **Sensitive Contact Masking (`ContactMask.tsx` & `ProfileView.tsx` / `NetworkView.tsx`)**:
   - Mask telephone numbers by default (e.g., `+63 9•• ••• •392`) and student IDs (e.g., `SCC-••••-0821`).
   - Provide an inline, eye-icon toggle button to temporarily unmask/reveal with a 10-second auto-remasking timer.
2. **Encrypted Offline Pass Storage (`src/services/secureStorageService.ts`)**:
   - Provide a lightweight, zero-dependency device-salted obfuscation/encryption wrapper for offline pass tokens stored in `localStorage`.
   - Update `DigitalAlumniCard.tsx` to serialize through `secureStorageService.setSecureItem()`.

### C. Comfy UX: Floating Quick-Action Dock & Touch Ergonomics
1. **Floating Quick-Action Dock (`src/components/common/FloatingQuickDock.tsx`)**:
   - Unobtrusive floating pill anchored at the bottom-right with subtle glassmorphic backdrop (`backdrop-blur-md`).
   - Automatically slides in when the user scrolls down $> 240\text{px}$.
   - Contains:
     - **Back to Top**: Smooth scroll to the top of the viewport.
     - **Digital Pass**: Opens the 3D rotating alumni card instantly.
     - **Search (`⌘K`)**: Opens the universal Command Palette.
2. **Touch Ergonomics**:
   - Ensure all interactive buttons strictly satisfy $\ge 44\text{px}$ touch target standards with `active:scale-[0.98]` tactile press physics.

---

## 3. Verification & Testing

1. **Type & Lint Validation**: Run `lint_applet` (`tsc --noEmit`).
2. **Build Validation**: Run `compile_applet` for production Vite build.
3. **Interactive Verification**:
   - **Directional Transitions**: Switch between Home, Directory, Events, Jobs, Messages—observe the silky forward/backward slide transitions.
   - **Security Masking**: Inspect telephone numbers and student IDs on the profile and directory; tap to reveal and observe auto-remasking.
   - **Offline Storage**: Inspect `localStorage` to verify pass data is stored in encrypted format rather than plain JSON.
   - **Floating Dock**: Scroll down on any long view; verify the floating quick-action pill slides in smoothly, and test the "Back to Top" and "Pass" triggers.
