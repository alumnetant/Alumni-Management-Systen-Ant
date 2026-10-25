# Platform Hardening & UI/UX Upgrade: Unified Release Plan

A coordinated release implementing the top 3 high-impact upgrades across security, design, and usability:
1. **UI/UX Polish**: Shimmering skeleton loaders & fluid Framer Motion view transitions.
2. **Security Hardening**: Dynamic rolling cryptographic QR code on the Digital Alumni Pass (30s refresh with animated countdown ring).
3. **Power Search**: Universal fuzzy Command Palette (`Cmd+K`) indexing alumni, events, jobs, and campus circulars.

---

> [!IMPORTANT]
> **Summary of Confirmed User Decisions**
> - **Release Strategy**: Unified release bundling all three upgrades together.
> - **Digital ID Pass Security**: Rolling token refreshing every 30 seconds with an animated countdown ring and live security badge.
> - **Command Palette Indexing**: Multi-entity indexing covering Alumni Roster, Events & Reunions, Job Board, and Official Circulars.

---

## 1. Upgrade 1: Skeleton Loaders & Fluid View Transitions

### Problem & Objective
Currently, switching between modules (e.g. Dashboard to Directory or Events) exhibits abrupt DOM pop-ins when data or network state updates. We will introduce:
1. **Framer Motion View Transitions**:
   - Wrap the main workspace viewport in an `<AnimatePresence mode="wait">` transition with subtle vertical drift (`y: 6`, `opacity: 0` $\to$ `y: 0`, `opacity: 1`) and spring easing (`damping: 25`, `stiffness: 280`).
2. **Shimmering Skeleton Loaders**:
   - Create reusable skeleton components with subtle stone-to-parchment linear shimmer gradients:
     - `DirectorySkeleton`: Grid of 6 alumnus profile cards with avatar, batch tag, and bio wireframes.
     - `EventsSkeleton`: Hero event banner and date-card wireframes.
     - `JobsSkeleton`: Job posting list items with company logo, stipend, and badge wireframes.

---

## 2. Upgrade 2: Rolling Cryptographic QR Code on Digital Alumni Pass

### Problem & Objective
Static QR codes can be screenshotted and transferred to non-alumni for unauthorized physical campus gate or turnstile entry. We will upgrade `DigitalAlumniCard.tsx` with:
1. **Dynamic Time-Based Token Engine (30-Second Cadence)**:
   - Generate a cryptographic verification payload consisting of:
     - `alumnusUid` + `studentId` / `alumniId`
     - Epoch time bucket: `Math.floor(Date.now() / 30000)`
     - Anti-tamper hash verification signature
   - The QR code dynamically regenerates every 30 seconds.
2. **Animated Countdown Ring & Live Security Indicator**:
   - An SVG circular progress ring displaying seconds remaining (30s $\to$ 0s) in St. Cecilia crimson/gold.
   - A pulsing green dot labeled `LIVE VERIFICATION TOKEN` assuring security guards and turnstile scanners that the pass is actively running and not a static screenshot.

```
┌─────────────────────────────────────────────────────────────┐
│                   DIGITAL PASS QR BACK                      │
│                                                             │
│                    ┌──────────────────┐                     │
│                    │                  │                     │
│                    │   [ROLLING QR]   │                     │
│                    │                  │                     │
│                    └──────────────────┘                     │
│                                                             │
│            ( 24s )  ● LIVE VERIFICATION TOKEN               │
│         [==== circular countdown ring ====]                 │
│                                                             │
│       "Refreshes every 30s · Anti-Screenshot Guard"         │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Upgrade 3: Universal Fuzzy Global Search (`Cmd+K`)

### Problem & Objective
Currently, `GlobalCommandPalette.tsx` offers basic tab navigation. We will expand it into a true spotlight-style search index across all application entities:
1. **Multi-Domain Indexing**:
   - **Alumni Roster**: Search by alumnus name, graduation batch (e.g., "2023"), course/major (e.g., "BSIT", "BSBA"), and company/city.
   - **Campus Events**: Search by reunion title, date, venue, and organizer.
   - **Career Board**: Search by role title, hiring company, location, and job type.
   - **Official Circulars**: Search by advisory headline, memorandum subject, and priority.
2. **Categorized Results with Keyboard Navigation**:
   - Keyboard arrow navigation (`↑` / `↓`), category headers with distinct icons, and instant `Enter` key execution to navigate directly to the target record.

---

## 4. Implementation Steps & File Modifications

| File | Change Details |
| :--- | :--- |
| `src/components/common/LoadingSkeletons.tsx` | Create modular skeleton components (`DirectorySkeleton`, `EventsSkeleton`, `JobsSkeleton`). |
| `src/components/alumni/AlumniWorkspaceLayout.tsx` | Wrap active module rendering in `<AnimatePresence mode="wait">` with spring transitions. |
| `src/components/profile/DigitalAlumniCard.tsx` | Add 30s rolling QR token generator, SVG countdown ring, and live security status indicator. |
| `src/components/common/GlobalCommandPalette.tsx` | Ingest `users`, `events`, `opportunities`, `announcements` and perform real-time fuzzy search with categorized keyboard selection. |

---

## 5. Verification Plan

1. **Type & Lint Check**: Run `lint_applet` (`tsc --noEmit`) to verify zero type mismatches.
2. **Production Build**: Run `compile_applet` to confirm successful Vite bundling.
3. **Interactive Verification**:
   - **Digital ID Card**: Open the pass modal, observe the animated SVG countdown ring ticking down from 30s, and confirm QR code refreshes with a new token at 0s.
   - **Command Palette (`Cmd+K`)**: Press `Cmd+K` (or `Ctrl+K`), type query (e.g., "2023", "Alumni", "Career", or a student name), verify grouped results appear with proper icons and clicking opens the exact item.
   - **View Transitions**: Click across sidebar tabs on desktop and bottom bar on mobile to experience smooth spring view transitions.
