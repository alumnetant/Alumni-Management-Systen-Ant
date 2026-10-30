# Implementation Plan: Automated Employer Verification Engine & Multi-Module System Updates

## 1. Executive Summary & Architectural Overview
This plan outlines the architecture, database schema, backend services, and frontend UI/UX enhancements required to implement the **Automated Employer Verification Module** alongside the core web application updates across the Alumni, Employer, Admin, and Moderator modules for **St. Cecilia's College - Cebu, Inc.**

The solution combines:
- A full-stack Express verification engine running domain health, WHOIS/RDAP age checks, lookalike brand detection, and pluggable corporate registry lookups (e.g., SEC Philippines).
- Zero-lockout employer registration validation with OTP-styled approval emails.
- Standardized numbered pagination (10 items/page) replacing all "Show More" triggers.
- An interactive in-app PDF Resume Review modal before downloading.
- An Awards & Recognitions milestone section with auto-populated company names.
- Complete relocation of Partner Accreditation to the Moderator Dashboard and deprecation of Partner Digital IDs.

---

## 2. General & System-Wide Updates

### Task 1: Fix Memoranda Search Bar Text Visibility
- **Root Cause**: The search input in `AnnouncementsView.tsx` lacks explicit dark/light mode font color classes and sits under layered glassmorphism overlays without explicit z-index/opacity hierarchy, making typed text invisible in certain viewports and themes.
- **Frontend Changes**:
  - Update `AnnouncementsView.tsx` search input container with `relative z-10`, `text-stone-900 dark:text-stone-100`, `bg-white dark:bg-stone-850`, and high-contrast placeholder styling.
  - Add explicit clear (`X`) button and keypress handlers.

### Task 2: Standard Pagination Across Core Features (Replace "Show More")
- **Architecture**: Create a reusable, accessible `PaginationControl.tsx` component supporting:
  - 10 items per page default (configured via user preference).
  - Numbered page pills with smart truncation ellipses (`1, 2, ... 5, 6`), previous/next arrow buttons, and item count indicator (`Showing 1–10 of 48 items`).
- **Integration Points**:
  1. **Alumni Directory** (`NetworkView.tsx`): Replace infinite scroll / show more with `PaginationControl`.
  2. **Job Board / Opportunities** (`OpportunitiesView.tsx`): Replace 6-item "Show More" with 10-item pagination.
  3. **Memoranda & Announcements** (`AnnouncementsView.tsx`): Paginate active, important, and archived circulars.
  4. **Campus Events & Reunions** (`EventsView.tsx`): Paginate upcoming and past event catalogs.
  5. **Admin / Moderator Roster & Audit Tables** (`AdminPanelView.tsx`): Standardize registry record tables.

### Task 3: Multi-Module Batch Year Filtering System
- **Frontend Changes**:
  - Update `NetworkView.tsx` and `AdminPanelView.tsx` filter drawers with a dedicated Centenary Batch Year selector (1968 to present).
  - Add multi-batch selection and "All Batches" quick toggle.
  - Connect batch filtering to server-side query parameters (`/api/alumni?batch=2024`).

---

## 3. Alumni Module Updates

### Task 4: Sample Profile Seeding (Reference & Test Data)
- **Data Schema & Seeding**:
  - Add a comprehensive reference alumnus profile (`Alumnus Laureate - Engr. Rafael D. Villanueva`, Batch 2020, BSIT, Senior Cloud Architect at Accenture Philippines) with verified status, employment history, awards, skills, and portfolio links in `src/data/initialData.ts` and `src/services/databaseSampleSeederService.ts`.

### Task 5: PDF Resume Review / Preview Modal Before Download
- **Frontend Changes**:
  - Create `src/components/profile/PdfResumePreviewModal.tsx`:
    - Renders a high-fidelity visual layout preview of the generated resume (Personal Bio, Contact, Verified Batch/Course, Work Experience timeline, Education, and Skills).
    - Includes an explicit **"Confirm & Download PDF"** primary button and **"Edit Profile"** secondary jump button.
  - Update `ProfileView.tsx` and `PublicProfileModal.tsx` so clicking "PDF Resume" opens `PdfResumePreviewModal` rather than immediately executing document download.

### Task 6: Student Awards & Recognitions Milestones with Auto-Company Detection
- **Frontend Changes**:
  - In `src/types.ts`, extend `CareerMilestone` to support `awardLevel` (`National`, `Regional`, `Collegiate`, `Corporate`), `issuingOrganization`, and `awardDate`.
  - In Milestone creation dialogs (`AdminWorkspaceLayout.tsx`, `InstitutionalSocialFeed.tsx`), add a dedicated **"Awards & Recognitions"** category.
  - Implement auto-lookup logic: When an alumnus selects or creates an Award milestone, automatically inspect `user.experience` for the `current === true` employer or fallback to `user.company` to prefill the awarding organization.

---

## 4. Automated Employer Verification Module & Employer Overhaul

### Task 7: Registration Validation Fix (Zero Accidental Account Lockouts)
- **Problem**: Input validation errors during employer registration (e.g. typing mismatched corporate emails or URLs) were incorrectly registered as failed authentication attempts, triggering the security lockout countdown.
- **Frontend & Logic Fixes**:
  - Decouple registration form field validation from login brute-force trackers (`LOCKOUT_STORAGE_KEYS`).
  - Provide inline, non-destructive validation hints without locking inputs or setting global lockout states.

### Task 8: Automated Verification Engine Architecture (`src/server/employerVerification/`)
- **Backend Verification Pipeline**:
  1. **Work Email Verification (`emailCheck.ts`)**:
     - Reject free email domains (`gmail.com`, `yahoo.com`, `outlook.com`, `hotmail.com`, `icloud.com`, `proton.me`, etc.) and disposable email domains from editable JSON config lists (`config/disposableEmails.json`).
     - Generate secure 24-hour single-use verification tokens hashed via SHA-256 at rest (`/api/employer/verify-email?token=...`).
  2. **Domain Matching & Normalization (`domainMatch.ts`)**:
     - Normalize email domain and company website URL: lowercase, strip protocol (`https://`), strip `www.`, remove path and port.
     - Validate that email domain strictly equals the website domain or is a valid subdomain (e.g. `careers.company.com`).
     - Reject shared hosting domains (`wixsite.com`, `blogspot.com`, `github.io`, `weebly.com`, `wordpress.com`).
  3. **Domain Health & Lookalike Checks (`domainHealth.ts`)**:
     - RDAP / WHOIS domain age inspection: Domain registered `< 90 days` or unknown flagged for human review (`NEEDS_REVIEW`).
     - Reachability probe: HTTP/HTTPS GET request verifying HTTP 200 with non-empty HTML content (reject parked or empty pages).
     - Homoglyph & Levenshtein lookalike check against top tech/corporate brands list (`config/knownBrands.json`). Matches within edit distance $\le 2$ or homoglyphs flagged for review.
     - Banned domain / IP blacklist lookup.
  4. **Pluggable Corporate Registry Interface (`registry/`)**:
     - Define `IRegistryProvider` interface:
       ```ts
       export interface IRegistryProvider {
         countryCode: string;
         queryCompany(legalName: string, regNumber?: string): Promise<RegistryQueryResult>;
       }
       ```
     - Implement `SecPhilippinesRegistryProvider` (handling SEC/DTI business name normalization, stripping `Inc.`, `Corp.`, `Ltd.`, fuzzy Levenshtein match, and status validation).
     - Fallback graceful handling: If timeout or provider missing, mark `registry_unchecked` and route to `NEEDS_REVIEW` (never auto-approve on failure).
  5. **Decision Engine & Status Matrix**:
     - `AUTO_VERIFIED`: Email confirmed + domain matches + not free/shared + age $\ge$ 90d + site healthy + no lookalike + not banned. (Tier: Basic Email-Verified Employer, max 3 active jobs, daily cap).
     - `VERIFIED`: Basic criteria + verified active registry record (or 30 days without user reports, or admin approval). Full badges & normal limits.
     - `AUTO_REJECTED`: Disposable/free email, banned domain/email, or dissolved entity in registry.
     - `NEEDS_REVIEW`: Everything else (new domain, site unreachable, lookalike suspicion, registry discrepancy).
  6. **Multiple Users per Domain**:
     - First verified user for a domain is granted `Company Admin` rights.
     - Subsequent signups under the same domain are queued as `join_requests` requiring approval from the existing company admin.
  7. **Job Post Safeguards & Content Filter**:
     - Pre-publish regex filter scanning for:
       - Upfront fee/payment demands ("registration fee", "pay for training", "cash deposit").
       - Telegram/WhatsApp-only contact details.
       - Personal contact emails on free email providers.
     - "Report Job" feature: 3 unique user reports automatically suspend the employer and return them to the review queue.

### Task 9: Email Notifications for Approved & Accredited Employers
- **Service Integration**:
  - Format approval and accreditation emails using the exact institutional brand template as OTP emails (`buildEmployerStatusEmailTemplate` in `src/server/emailService.ts`).
  - Includes official institutional crest, deep crimson branding (`#8B181B`), accreditation expiration date, and immediate "Access Employer Portal" call-to-action.

---

## 5. Admin & Moderator Module Realignment

### Task 10: Rebuild & Route Partner Accreditation into Moderator Dashboard
- **Changes**:
  - Remove Partner Accreditation Desk controls from the main Admin dashboard (`AdminEmployersAndJobsView.tsx`).
  - Embed the Partner Accreditation Desk and Employer Verification Queue into the **Moderator Dashboard** (`src/components/admin/ModeratorPanelView.tsx`), allowing moderators to audit company registration documents, review automated check logs, and grant accreditation.
  - Create the **Admin Review Queue UI** displaying:
    - Company legal name, trade name, domain age, website probe status, lookalike flags, registry match score, and reason breakdown.
    - One-click actions: "Approve & Accredit", "Request Additional Documents", "Reject with Preset Template".
    - Decision audit logs (`adminId`, `timestamp`, `reason`).

---

## 6. Deprecating Partner Digital ID

### Task 11: Removal of Digital ID for Partner Companies
- **UI & Controller Changes**:
  - In `ProfileView.tsx` and `DigitalAlumniCard.tsx`, restrict digital pass rendering exclusively to `role === 'alumni' | 'student' | 'staff'`.
  - For `role === 'employer'`, completely remove Digital Pass buttons, jump anchors, and QR pass generators.
  - In `server.ts`, remove or disable any endpoint generating partner digital IDs.

---

## 7. Verification & Testing Strategy
1. **Automated Unit Tests (`tests/employerVerification.test.ts`)**:
   - Matching domain & enterprise email -> `AUTO_VERIFIED`.
   - Free provider email (`@gmail.com`) -> `AUTO_REJECTED`.
   - Domain mismatch (`user@tech.com` vs `https://company.org`) -> `NEEDS_REVIEW`.
   - Brand lookalike spoofing (`micros0ft.com`) -> `NEEDS_REVIEW`.
   - Domain $< 90$ days old -> `NEEDS_REVIEW`.
   - External registry timeout/failure -> `NEEDS_REVIEW` (failsafe).
   - Content filter blocks job posts requesting upfront fees.
2. **Build Verification**:
   - Run `lint_applet` (`tsc --noEmit`) to verify zero type or import errors.
   - Run `compile_applet` (`npm run build`) to confirm production bundle integrity.
