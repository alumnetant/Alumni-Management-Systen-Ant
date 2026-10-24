# Implementation Plan — 50 Authentic Items Across All Core Alumni Features

Populate the St. Cecilia's College - Cebu (SCC) Alumni Network with 50 high-fidelity, culturally authentic, and academically grounded items across all six core alumni pillars: **Events**, **Notifications**, **News (Announcements)**, **Jobs (Opportunities)**, **Campus Gallery**, and **Institutional Feed**.

---

### User Review & Critical Specifications
> [!IMPORTANT]
> **Confirmed Choices from Clarification**:
> 1. **Feature Scope**: All 6 core modules will be seeded with exactly 50 items each (300 total comprehensive records):
>    - 50 Alumni Events & Summits
>    - 50 System & Activity Notifications
>    - 50 Institutional Announcements & News Bulletins
>    - 50 Career Opportunities & Placements
>    - 50 Campus & Alumni Gallery Photographs
>    - 50 Institutional Feed Posts with community interactions
> 2. **Theme & Context**: Authentic St. Cecilia's College - Cebu identity across all colleges:
>    - College of Computer Studies (BSIT, CS)
>    - College of Nursing & Allied Health Sciences (BSN)
>    - College of Criminal Justice Education (BS Criminology)
>    - College of Business & Accountancy (BSA, BSBA)
>    - College of Teacher Education (BSEd, BEEd)
>    - College of Hospitality & Tourism Management (BSHM, BSTM)
>    - SCC Campus Ministry, Alumni Association Chapters (Metro Cebu, Overseas Cecilians, Mandaue, Talisay, Minglanilla).
> 3. **Bundling & Delivery**: Bundled into production seed data arrays in `src/data/` with automatic local storage upgrade hooks in `AlumniContext.tsx` so all web and mobile visitors receive the full 50-item dataset on launch without manual resets.

---

## Architecture & Data Organization

```
src/data/
├── initialData.ts               # Primary export hub & existing schema contracts
├── seeds/
│   ├── seedEvents.ts            # 50 Authentic SCC Alumni Events (Galas, Webinars, Sports Fests, Homecomings)
│   ├── seedNotifications.ts     # 50 Granular Notifications (RSVPs, job alerts, system bulletins, mentions)
│   ├── seedAnnouncements.ts     # 50 Institutional News Bulletins (Board exam topnotchers, research, accreditations)
│   ├── seedOpportunities.ts     # 50 Cebu & Regional Job Openings (IT Park, Cebu Doctors, BPO, Corporate, Gov)
│   ├── seedGallery.ts           # 50 High-res Gallery Captions (Centennial rites, pinning, hackathons, sports)
│   └── seedFeedPosts.ts         # 50 Social Timeline Feed Posts (Cecilian milestones, alumni shoutouts, photos)
└── index.ts                     # Aggregated clean imports

src/context/
└── AlumniContext.tsx            # Seed version upgrade migration & fallback initial state loader
```

---

## Detailed Item Breakdown by Pillar

### 1. Events Module (50 Items)
- **Categories**: Grand Alumni Homecoming, Departmental Jubilees, Tech Hackathons, Nursing Pinning Ceremonies, Criminology Licensure Rallies, Business Forums, Charity Golf Tournaments, Career Expos, and Cecilian Choral Concerts.
- **Data Properties**:
  - `id`: `evt_scc_01` to `evt_scc_50`
  - `title`, `description`, `date`, `time`, `location` (e.g., *SCC Centennial Auditorium*, *Minglanilla Sports Complex*, *Cebu Trade Hall*, *Virtual Zoom Room*), `category`, `capacity`, `registeredCount`, `bannerUrl` (authentic Unsplash collegiate imagery), `organizerRole`, `organizerName`, `isFeatured`.

### 2. Notifications Module (50 Items)
- **Types**: `event_broadcast`, `announcement_broadcast`, `job`, `general`, and `message`.
- **Content**:
  - Board exam congratulations from the Registrar.
  - Job application status updates from MetroCebu InnovateCorp and Cebu healthcare institutions.
  - Alumni Chapter RSVP confirmations and reminder notices.
  - Security audit notifications and verified profile badge issuances.

### 3. News & Announcements Module (50 Items)
- **Categories**: `academic`, `administrative`, `alumni`, `career`, `urgent`, `board_exam_results`.
- **Content**:
  - PRC Licensure Examination Topnotchers announcements (Criminologist, Nurse, CPA, Professional Teacher).
  - PACUCOA Level III & IV Accreditation milestones for SCC.
  - Commission on Higher Education (CHED) grants and SCC Innovation Hub inaugurations.
  - Alumni scholarship endowment fundraisers and homecoming assembly schedules.

### 4. Opportunities Module (50 Items)
- **Roles & Sectors**:
  - *Tech & IT*: Full-Stack Developers, Cloud Engineers, QA Analysts, Cybersecurity Associates at Cebu IT Park / Cebu Business Park.
  - *Healthcare*: Clinical Instructors, Staff Nurses, Medical Records Officers for Vicente Sotto Memorial & Chong Hua.
  - *Law Enforcement & Security*: Corporate Investigators, Industrial Security Directors, Forensic Analysts.
  - *Finance & Accountancy*: Senior Audit Associates, Tax Consultants, Financial Analysts in Cebu banking institutions.
  - *Hospitality & Education*: College Instructors, Resort Front Office Managers, Tourism Officers.
- **Attributes**: Accurate Philippine Peso salary ranges (`salaryOrStipend`), required degrees matching SCC course offerings, full skill arrays, and application routing.

### 5. Campus Gallery Module (50 Items)
- **Categories**: `Centennial`, `Commencement`, `Campus Life`, `Athletics`, `Accreditation`, `Alumni Chapter`.
- **Content**:
  - High-definition photographs depicting collegiate architecture, graduation processions, clinical pinning, robotics competitions, SCC Sinulog contingents, and alumni banquets.
  - `year`: 2015 to 2025.
  - `likesCount`, `tags`, and descriptive Cecilian heritage captions.

### 6. Institutional Feed Posts (50 Items)
- **Features**:
  - Authentic Cecilian graduates celebrating milestones: passing the Philippine Bar/PRC exams, promotions, founding startups in Cebu, launching medical missions, and batch memories.
  - Pre-populated likes, heartfelt reactions (`hearts`), and realistic alumni comments from verified Cecilians.
  - Time distribution spanning recent hours to past weeks for organic timeline density.

---

## Seamless State Migration & Upgrade Mechanism

To guarantee that active users and test accounts see the 50 items immediately without requiring manual `localStorage.clear()`:
1. Define a persistent seed version identifier: `SCC_SEED_DATASET_VERSION = 'scc_50_dataset_v1'`.
2. In `AlumniContext.tsx`, implement a smart loader that checks:
   - If the current stored dataset in `localStorage` has fewer than 10 items or lacks the version key, it automatically seeds the initial 50-item dataset into state and updates `localStorage`.
   - Preserves any user-created items by prepending them ahead of the seed baseline.
3. Provide an Administrative "Reset to Official 50-Item Baseline" action within the Developer / Admin workspace for testing.

---

## Verification Plan

1. **Verification & Build**:
   - Run `lint_applet` (`npx tsc --noEmit`) to verify zero TypeScript compilation issues across all 300 data objects.
   - Run `compile_applet` to confirm a clean Vite production build.
2. **Visual & Behavioral Audits**:
   - **Events View**: Verify 50 events render with working filter pills, search, and RSVP interactions.
   - **Notifications View**: Verify 50 notifications with time stamps and category badges.
   - **News View**: Verify 50 announcements display with search, category filtering, and reading dialogs.
   - **Jobs View**: Verify 50 career opportunities with accurate salary badges and skills tags.
   - **Gallery View**: Verify 50 campus gallery cards with lightbox and filter tags.
   - **Feed View**: Verify 50 timeline posts with comment sections and interaction buttons.
