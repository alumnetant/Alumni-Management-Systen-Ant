# Font Consistency: Unified Editorial Typography System

Establishing complete typographical harmony across St. Cecilia's College - Cebu, Inc. Alumnet by bringing the distinctive editorial typography, refined weights, wide-spaced kickers, and italic display accents from the landing page to all portal views, modals, and authentication screens.

---

> [!IMPORTANT]
> **Summary of Confirmed User Decisions**
> - **Typographic Treatment**: Full editorial typography with wide-spaced uppercase eyebrows (`tracking-[0.2em]` to `tracking-[0.25em]`), optical leading, and refined typography weights.
> - **Page & Section Headings**: Refined display titles with tight tracking (`tracking-tight`), balanced optical presence, and curated italic emphasis on signature collegiate terms.
> - **Scope of Application**: Full application coverage encompassing Member Dashboard, Alumni Directory, Events & Reunions, Career Opportunities, Direct Messages, Member Profile, Authentication pages, and all interactive Dialog Modals.

---

## 1. Overview & Core Concept

### What It Does
Unifies the typography across every screen in the Cecilian Alumnet web and mobile applet. Previously, while the landing page showcased an editorial collegiate presentation with high-impact display titles, wide-spaced tracking eyebrows, and italicized accents, internal pages (Dashboard, Directory, Events, Jobs, Messages, Modals, and Auth) relied on more conventional UI text treatments. This initiative propagates the landing page's signature typography language across the entire application ecosystem.

### Target Audience & Persona
- **Cecilian Alumni & Batches**: Experiencing a unified, prestigious collegiate publication aesthetic from the first public landing impression through authenticated daily networking.
- **Institutional Administrators & Employers**: Working in an academic environment reflecting institutional heritage, virtue (*Virtus*), knowledge (*Scientia*), and service (*Charitas*).

### Key Value
- **Zero Disconnect**: Eliminates visual friction when transitioning from the public landing page into the member workspace.
- **Institutional Gravitas**: Elevates the platform from a generic web app to an authentic collegiate society portal.

---

## 2. User Experience & Visual Design

### Editorial Typography Scale & Tokens
The application typography system will be codified into reusable class tokens and direct element styling:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       COLLEGIATE TYPOGRAPHIC HIERARCHY                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. SECTION EYEBROW / KICKER                                                 │
│    text-xs font-bold uppercase tracking-[0.22em] text-[#8B181B]             │
│    "CAMPUS DISPATCHES · OFFICIAL NOTICES"                                   │
│                                                                             │
│ 2. EDITORIAL DISPLAY HEADLINE                                               │
│    font-display text-2xl sm:text-3xl text-stone-900 tracking-tight           │
│    "Where Legacy Meets Tomorrow" (with italic accent on signature word)     │
│                                                                             │
│ 3. CURATORIAL SUB-HEADLINE                                                  │
│    text-sm sm:text-base text-stone-500 font-light leading-relaxed           │
│    "A curated network linking Cecilian graduates across industries..."       │
│                                                                             │
│ 4. METADATA & CHRONOLOGY LINE                                               │
│    text-[11px] font-mono tracking-wide text-stone-400 uppercase             │
│    "CLASS OF 2023 · B.S. INFORMATION TECHNOLOGY · VERIFIED"                 │
│                                                                             │
│ 5. BODY PROSE & NOTICES                                                     │
│    text-sm leading-relaxed text-stone-600 dark:text-stone-300 font-sans     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Visual Identity & Theme Alignment
- **Aesthetic Direction**: Archival collegiate editorial. Combines crisp modern typography (`Plus Jakarta Sans`) with classical editorial proportions: generous whitespace, wide tracking uppercase tags, light-to-regular heading weights, and italic emphasis.
- **Colors**:
  - Primary Institutional Crimson: `#8B181B` (light mode) / `#fca5a5` / `#fb7185` (dark mode accent).
  - Background Neutral: `#F9FAFB` (light) / `#121316` (charcoal dark).
  - Surfaces: `#FFFFFF` (light) / `#1c1917` (warm stone dark).
  - Eyebrows & Dividers: Muted stone (`border-stone-200/80` dark: `rgba(255,255,255,0.08)`).
- **Typography Tokens in `index.css`**:
  - Define utility classes `.editorial-kicker`, `.editorial-title`, `.editorial-subtitle`, and `.editorial-card-title` to guarantee absolute styling consistency across all components.

---

## 3. Key Product Decisions & Implementation Scope

### Decision 1: Shared Editorial Typography Utility Classes
- **Approach**: Define standardized Tailwind `@utility` / CSS helper classes in `src/index.css` so all views inherit identical tracking, weights, leading, and font smoothing without repeated inline duplication.
- **Why**: Prevents styling drift between different pages (e.g. Directory vs. Events vs. Messages).

### Decision 2: Page-by-Page Transformation
- **Dashboard (`DashboardView.tsx`)**:
  - Masthead: Greeting converted to refined display title with italicized name/welcome accent.
  - Section headers: "Campus Bulletins & Dispatches", "Reunions & Official Gatherings", "Batchmates Spotlight", and "Career Placement" styled with wide uppercase kickers (`tracking-[0.22em] text-[#8B181B]`) and editorial titles.
- **Alumni Directory (`DirectoryView.tsx` / `AlumniDirectory.tsx`)**:
  - Page header: Institutional search banner with uppercase kicker `ALUMNI ROSTER & DIRECTORY` and display title with italic emphasis.
  - Batch cards & roster profiles: Refined batch tracking and alumnus card titles.
- **Events & Gatherings (`EventsView.tsx`)**:
  - Hero event card: Styled in full editorial poster format matching the landing page's `LandingEventsSection.tsx`.
  - Event list cards: Clear date kickers and editorial typography.
- **Careers & Opportunities (`OpportunitiesView.tsx`)**:
  - Header & job cards: Styled with collegiate employer badges and editorial role titles.
- **Direct Messaging (`MessagesView.tsx`)**:
  - Header & chat room headings: Refined contact headers with subtle tracking and verified typography.
- **Authentication Screens (`AuthPage.tsx`)**:
  - Login & registration mastheads: Styled with St. Cecilia seal, wide-spaced `OFFICIAL ALUMNI PORTAL` kickers, and editorial welcome headers with italic accents.
- **Dialog Modals (`CampusGalleryModal.tsx`, `RegistrarRequestModal.tsx`, `AlumniChaptersModal.tsx`, `InstitutionalGovernanceModal.tsx`, `EditProfileModal.tsx`)**:
  - Modal headers: Updated with consistent uppercase tracking kickers and refined display titles.

---

## 4. Technical Architecture & Component Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          GLOBAL CSS ARCHITECTURE                            │
│  src/index.css                                                              │
│  ├── @theme font variables (Plus Jakarta Sans display/heading/sans)         │
│  ├── .editorial-kicker  (text-xs uppercase tracking-[0.22em] font-bold)     │
│  ├── .editorial-title   (font-display text-2xl/3xl tracking-tight)         │
│  └── .editorial-sub     (text-sm sm:text-base leading-relaxed font-light)   │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Inherited By
       ┌───────────────────────────────┼───────────────────────────────┐
       ▼                               ▼                               ▼
┌──────────────┐               ┌──────────────┐               ┌──────────────┐
│ PORTAL VIEWS │               │ AUTH SCREENS │               │ DIALOG MODALS│
│ • Dashboard  │               │ • Sign In    │               │ • Registrar  │
│ • Directory  │               │ • Register   │               │ • Chapters   │
│ • Events     │               │ • Role Gate  │               │ • Governance │
│ • Careers    │               │ • Biometric  │               │ • Gallery    │
│ • Messages   │               └──────────────┘               │ • Profile    │
│ • Profile    │                                              └──────────────┘
└──────────────┘
```

---

## 5. Verification Plan

1. **Static Type & Lint Validation**: Run `lint_applet` (`tsc --noEmit`) to ensure zero TypeScript errors.
2. **Compilation Verification**: Run `compile_applet` to confirm Vite production bundle builds cleanly.
3. **Typography Audit**:
   - Check landing page alongside Dashboard, Directory, Events, Jobs, Messages, and Auth screens to confirm consistent font family, letter tracking, weights, and kicker styling.
   - Verify dark mode contrast and mobile responsiveness (ensuring wide letter-spacing doesn't wrap awkwardly on narrow mobile viewports).
