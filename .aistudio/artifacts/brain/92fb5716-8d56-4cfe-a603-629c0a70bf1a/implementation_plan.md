# Actual Campus Building Photography Integration

Seamless integration of the authentic, user-provided photographs of St. Cecilia's College - Cebu, Inc. across the public Landing Page slideshow, hero sections, and the Login/Authentication portal.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following user preferences were confirmed during Turn 1 clarification:
> - **Display Placement**: Prominently featured on the public Landing Page and Login hero.
> - **Primary Hero Choice**: High-rise angled architectural facade with the signature red entrance canopy (`IMG_5525_20785d43.HEIC` -> `landing-building-2.jpg`).

- **Confirmed Decision 1**: The primary hero background on the Login and Registration screens (`AuthPage.tsx`) uses the authentic high-rise facade with the red entrance canopy.
- **Confirmed Decision 2**: The Landing Page hero slideshow (`CAMPUS_SLIDES`) is updated to feature all three user-provided photographs:
  1. **Slide 1 (Hero)**: High-rise tower facade with the red entrance canopy and glass curtain walls.
  2. **Slide 2 (Collegiate Grounds)**: Full frontal facade of St. Cecilia's College featuring the grand entrance and institutional school bus.
  3. **Slide 3 (Aerial Panorama)**: Drone aerial view of the campus tower and surrounding Minglanilla collegiate community.
- **Confirmed Decision 3**: Presets in `InstitutionalSocialFeed.tsx` and campus heritage reference points are aligned with these authentic photographs.

---

## 1. Overview & Core Concept

Currently, the landing page and authentication portals utilized placeholder / generic campus architectural assets. The user has supplied high-resolution authentic photographs of the actual St. Cecilia's College - Cebu, Inc. campus:
1. **Architectural High-Rise Facade (`IMG_5525`)**: Capturing the modern multi-story academic building, distinct red structural column, and prominent red covered canopy entrance.
2. **Campus Front View (`IMG_5518`)**: Ground-level perspective showing the full wide facade, campus grounds, and official Cecilian school bus.
3. **Aerial Drone Overview (`scc4`)**: High-altitude perspective showing the building's rooftop canopy, surrounding urban campus neighborhood, and Cebu mountain horizon.

All uploaded HEIC and WebP assets have been converted into production-grade, web-optimized JPEG assets in `public/assets/` (`landing-building-1.jpg`, `landing-building-2.jpg`, `landing-building-3.jpg`, and `landing-building.jpg`) to ensure universal rendering compatibility across all mobile and desktop web browsers.

---

## 2. Visual Design & Aesthetic Direction

In strict alignment with the St. Cecilia's College design taste guidelines (`AGENTS.md`) and Museum/Institutional Editorial guidelines (`9_museum_editorial_institutional.md`):

- **Authenticity & School Pride**: Real photography reinforces institutional pride and trust for returning alumni, prospective employers, and graduating seniors.
- **Measured Scrim & Contrast**: The login portal applies a measured dark vignette (`bg-gradient-to-t from-black via-black/75 to-black/50`) over the authentic building photo to maintain WCAG AA contrast for headline and body typography.
- **Slideshow Presentation**: High-contrast, clean unboxed metadata with tight tracking (`tracking-tight font-bold`) and descriptive badges:
  - `CAMPUS ARCHITECTURE • TOWER FACADE`
  - `COLLEGIATE FACADE • MAIN ENTRANCE`
  - `AERIAL VISTA • CAMPUS COMPLEX`
- **Zero Distortions**: `object-cover` with appropriate focal center-positioning to prevent image warping across viewport sizes.

---

## 3. System Architecture & Asset Mapping

```
┌────────────────────────────────────────────────────────┐
│               User Uploaded Campus Assets              │
│  • IMG_5525 (Angled Facade)   -> landing-building-2.jpg│
│  • IMG_5518 (Frontal Pavilion)-> landing-building-1.jpg│
│  • scc4     (Aerial Drone)    -> landing-building-3.jpg│
└───────────────────────────┬────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            ▼                               ▼
┌───────────────────────────┐   ┌───────────────────────────┐
│     LandingPage.tsx       │   │       AuthPage.tsx        │
│  • 3-Slide Hero Carousel  │   │  • Primary Hero Backdrop  │
│  • Heritage Story Section │   │  • Institutional Vignette │
│  • College History Modal  │   │  • "Welcome Back" Portal  │
└───────────────────────────┘   └───────────────────────────┘
```

---

## 4. Implementation Steps & Workflows

### Step 1: Update Landing Page Carousel Slides (`LandingPage.tsx`)
- Update `CAMPUS_SLIDES` with the authentic building photos:
  - Lead with Slide 1 as `/assets/landing-building-2.jpg` (High-rise facade with red entrance canopy).
  - Slide 2 as `/assets/landing-building-1.jpg` (Frontal campus facade and grounds).
  - Slide 3 as `/assets/landing-building-3.jpg` (Aerial drone panorama).
- Calibrate badge kickers and captions to accurately describe St. Cecilia's College facilities in Minglanilla, Cebu.

### Step 2: Update Authentication Portal Hero (`AuthPage.tsx`)
- Ensure the desktop hero backdrop references `/assets/landing-building-2.jpg` with high-clarity contrast filters and dark vignette gradient.
- Verify image scaling (`scale-100` to `scale-105` subtle focus transition).

### Step 3: Update Preset Campus Gallery Photos (`InstitutionalSocialFeed.tsx`)
- Update `PRESET_CAMPUS_PHOTOS` metadata in `InstitutionalSocialFeed.tsx` to match the authentic building assets:
  - Modern Academic Tower Facade
  - Main Campus Academic Grounds & Entrance
  - Aerial Drone Perspective of St. Cecilia's Tower

---

## 5. Verification & Testing Criteria

1. **Landing Page Visual Inspection**: The hero slideshow on `LandingPage.tsx` renders all 3 real photographs of St. Cecilia's College with crisp clarity and correct slide transitions.
2. **Login Page Visual Inspection**: The desktop split-screen hero on `AuthPage.tsx` displays the real high-rise facade with the red canopy entrance under the vignette scrim.
3. **Cross-Browser Asset Loading**: All images load from standard web paths (`/assets/landing-building-*.jpg`) without broken image frames or format errors.
4. **Codebase Compilation & Tests**: Verify with `compile_applet`, `lint_applet`, and `vitest run`.
