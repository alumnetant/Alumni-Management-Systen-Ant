# St. Cecilia's College Alumni Network: Profile Verification, Employer Auth & Registry System

A targeted enhancement to resolve profile badge scoping, fix accredited employer authentication, streamline alumni role immutability, enable real OTP email delivery, fix Excel/CSV alumni registry name mapping, and introduce institutional graduation verification tracking.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following decisions were confirmed based on your requirements and clarification answers:
> - **Excel/CSV Graduate Name Extraction**: Flexible auto-detection across all common name columns (`Name`, `Full Name`, `Graduate Full Name`, `Student Name`, or split `First Name` + `Last Name`) to eliminate the "Cecilian Graduate" fallback shown in the registry screenshot.
> - **Password Reset OTP Email Delivery**: Real outbound email dispatch using server SMTP / Webhook with instant onscreen copy fallback and toast confirmation.
> - **Alumni Verification Flow**: Self-service verification request modal for alumni to submit proof of graduation, backed by registrar/admin review queue and real-time status badges.
> - **Verified Badge Scoping**: Strictly reserved for verified alumni; hidden completely from employers, students, and administrators.
> - **Employer Login**: Fix session minting and credential checks so approved partner employers log in directly to their employer dashboard.

---

### 1. Overview & Core Concept

- **What It Does**:
  1. Restricts the "Verified Alumni" badge strictly to alumni users with confirmed institutional records, removing any badges from employers or other roles.
  2. Resolves employer login blockers so verified/approved employers authenticate immediately into the employer job board and candidate portal.
  3. Displays the alumni role cleanly without an artificial "Fixed" tag, while keeping the role immutable across profile and administrative views.
  4. Delivers real password reset OTP codes via email (SMTP/Webhook) with an instantaneous onscreen code fallback so users are never blocked.
  5. Corrects alumni registry file imports to detect and display the graduate's actual full name instead of falling back to default placeholder text.
  6. Implements an institutional graduation verification pipeline: unverified alumni submit student credentials and proof for admin/registrar approval.

- **Target Audience / Persona**:
  - **Alumni**: Submit verification proof, track accreditation status, securely reset passwords via OTP email.
  - **Partner Employers**: Register company profile, get approved by administration, and reliably log in to publish opportunities.
  - **Institutional Administrators & Registrars**: Audit uploaded graduate registries with accurate names and review alumni verification queues with one-click approval.

- **Key Value**:
  Guarantees credential integrity, seamless employer onboarding, and trustworthy alumni recognition for St. Cecilia's College - Cebu, Inc.

---

### 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Alumni Profile & Badge**:
     - Alumnus views profile: if verified, shows deep crimson & gold "Verified Alumni" shield badge.
     - Employer or non-alumni views profile: no alumni badge is shown; role is presented with clean institutional typography.
     - Role field is read-only without cluttering labels like "[Fixed]".
  2. **Employer Sign-In**:
     - Verified employer submits credentials on login screen.
     - Backend confirms password and verification state (`approved` / `verified`), issuing a session token and redirecting straight to the Partnered Companies / Postings workspace.
  3. **Forgot Password with Real OTP**:
     - User enters email on login dialog.
     - System dispatches OTP email with institutional header ("St. Cecilia's College - Account Verification").
     - Onscreen feedback displays delivery confirmation along with a direct copyable OTP fallback for testing/local environments.
     - User inputs 6-digit OTP code, sets new password, and logs in.
  4. **Excel/CSV Alumni Registry Import**:
     - Registrar navigates to Admin Alumni Registry and drops Excel (`.xlsx`, `.xls`) or `.csv`.
     - Parser dynamically detects candidate name columns: `Name`, `Full Name`, `Graduate Full Name`, `Student Name`, or concatenates `First Name` + `Last Name`.
     - The table immediately populates with real student names (e.g. "Maria Santos", "John Rey Del Rosario") instead of "Cecilian Graduate".
  5. **Alumni Verification Request Flow**:
     - Unverified alumni click "Request Verification" on their profile banner.
     - Modal requests Student ID Number, Degree Program, Cohort Year, and optional document attachment (diploma / ID photo).
     - Status updates to "Pending Institutional Review".
     - Administrator opens Verification Queue, reviews submitted credentials, and selects "Approve" (instantly granting Verified Alumni badge) or "Reject" (with explanation).

- **Visual Identity & Theme (`AGENTS.md`)**:
  - **Colors**: St. Cecilia's deep crimson (`#8B181B`), warm stone backgrounds (`bg-stone-50`), rich charcoal text (`#1c1917`), and emerald accents for verified accreditation.
  - **Typography**: Clean tabular numbers for Student IDs (`font-mono text-xs`), crisp semi-bold display headers, balanced leading.
  - **Icons**: Lucide icons (`CheckCircle2`, `ShieldCheck`, `FileSpreadsheet`, `Mail`, `KeyRound`) with uniform `strokeWidth={1.75}`. Zero raw emojis.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Flexible Column Header Normalization for Registry Uploads**
  - *Chosen Approach*: Auto-detect normalized column variations (`name`, `fullname`, `graduatefullname`, `studentname`, `alumniname`) plus split first/last name detection.
  - *Why*: User-uploaded spreadsheets from campus departments frequently use different column headers. Flexible normalization ensures student names appear accurately without requiring manual file formatting.
  - *Alternatives Considered*: Rigid schema requirement (rejected: fails on varied Excel column naming).

- **Decision 2: Dual OTP Delivery (Real Email + Onscreen Fallback)**
  - *Chosen Approach*: Server dispatches via SMTP / Webhook if configured, while returning the code in dev/preview mode with an onscreen toast.
  - *Why*: Ensures production-grade email delivery while guaranteeing that users and developers in sandbox preview environments can always reset passwords without getting trapped by spam filters or unconfigured mail relays.

- **Decision 3: Dedicated Verification Queue vs. Direct Profile Overrides**
  - *Chosen Approach*: Structured `VerificationRequest` records linked to alumni profiles, enabling registrar inspection and historical status tracking.
  - *Why*: Provides auditing accountability for institutional degree verification.

---

### 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        St. Cecilia's College UI                        │
├─────────────────────┬───────────────────────┬──────────────────────────┤
│    ProfileView      │  ForgotPasswordModal  │  AdminAlumniRegistryView │
│  - Alumni Badge     │  - OTP Input          │  - Multi-column Parser   │
│  - Request Modal    │  - Onscreen Fallback  │  - Accurate Name Display │
└──────────┬──────────┴───────────┬───────────┴─────────────┬────────────┘
           │                      │                         │
           ▼                      ▼                         ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      AlumniContext & State Engine                      │
│ - user.role === 'alumni' badge guard                                   │
│ - verifyEmployer() & login() auth synchronization                      │
│ - submitVerificationRequest() & reviewQueue state                      │
└─────────────────────────────────┬──────────────────────────────────────┘
                                  │
                                  ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    Express Backend API (server.ts)                     │
├────────────────────────────────────────────────────────────────────────┤
│ POST /api/auth/login            -> Authenticate approved employers     │
│ POST /api/auth/send-otp         -> Send OTP via SMTP / Webhook         │
│ POST /api/auth/verify-otp       -> Validate code & update password     │
│ POST /api/alumni/verify-request -> Store verification request record   │
│ GET  /api/admin/verify-queue    -> Fetch pending alumni reviews        │
└────────────────────────────────────────────────────────────────────────┘
```

- **Interactive Component & State Mapping**:
  - `ProfileView.tsx`: Displays "Verified Alumni" shield only when `user.role === 'alumni' && user.isVerified`. Unverified alumni see interactive "Request Verification" CTA.
  - `AlumniContext.tsx`: Aligns client login logic to accept `employerStatus === 'approved'` or `isVerified === true`, and eliminates false rejection gates.
  - `ForgotPasswordModal.tsx`: Communicates with `/api/auth/send-otp` and `/api/auth/verify-otp` with clear countdown timers and fallback displays.
  - `AdminAlumniRegistryView.tsx`: Enhanced Excel reader inspecting `Object.keys(row)` with fuzzy matching for first, last, and full name keys.
  - `AdminVerificationQueueView.tsx`: Administrative interface for reviewing alumni graduation verification applications.
