# Platform Hardening, Connection-Gated Messaging, Profile Redesign & Admin Scaling

> **System**: St. Cecilia's College - Cebu, Inc. Alumni Network (AlumNet)  
> **Target Version**: v2.8.0  
> **Goals**: Enforce strict connection-gated direct messaging; harden employer onboarding with business verification to prevent student registration; activate device Web Push notifications & server dispatch logs; streamline registrar verification and conflict resolution logic; enhance post-application hiring pipeline tracking; paginate core administrator tables; filter activity logs strictly to user-involved actions; embed an Instagram/Facebook-style "My Posts" tab on alumni profiles; and clean up the profile header per user feedback and Zero-Pill design principles.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural parameters were confirmed during the interactive interview:
> 
> - **Connection-Gated Messaging**: When an alumnus visits an unconnected peer profile, the direct message button is hidden and replaced with a clear **"Send Connection Request"** action. Direct messaging (`chats` / `conversations`) will strictly reject sending messages between unconnected alumni.
> - **Profile Header Modernization**: The cluttered pill capsules and five-button cluster shown in the screenshot are streamlined into a single subtle verified badge beside the name, a primary action button (`Edit Profile` or `Connect`), and an overflow action dropdown menu (`...`) housing secondary utilities (PDF Resume, Digital Pass, Share).
> - **Device & Broadcast Notifications**: Push alerts are enabled using browser Web Push APIs (`Notification.requestPermission()`, `new Notification()`), synchronized with the real-time in-app notification center bell, and logged in server dispatch tables for audit transparency.

---

## 1. Overview & Core Concept

This release delivers deep functional hardening across 8 core operational areas:
1. **Network Security & Messaging Privacy**: Users can only direct-message confirmed connections (`connections`).
2. **Employer Onboarding & Student Isolation**: Corporate employer registration enforces business domain emails, SEC/DTI accreditation requirements, and mandatory administrator approval (`pending_verification`), strictly prohibiting student ID usage or student-to-employer role impersonation.
3. **Multi-Channel Notification Dispatch**: Publishing announcements or high-priority circulars triggers in-app notification bell counters, active device Web Push alerts, and persistent server dispatch audit logs.
4. **Registrar Verification & Conflict Resolution Logic**: Transparent automated matching against `registry_records` with fallback to a moderator review queue and side-by-side conflict arbitration for contested student IDs.
5. **Post-Application Career Lifecycle**: Real-time multi-stage status tracker (Submitted -> Under Review -> Shortlisted -> Interview Scheduled -> Offer / Closed) with recruiter notes, interview scheduling details, and application withdrawal options.
6. **Universal Admin Pagination**: Smooth, responsive pagination (10, 25, 50 rows per page) across all administrative management tables (Users, Registry Masterlist, Opportunities, Events, and Audit Logs).
7. **Personalized Activity Logs**: The user activity log view filters strictly to items the logged-in user actively engaged with (e.g., their own logins, updates, connection requests, and RSVP passes) rather than dumping global system-wide logs.
8. **Profile Posts Feed & Visual Cleanliness**: Alumni profile displays their authored community updates, milestone badges, and media in an Instagram/Facebook-style chronological feed tab, while the profile header adopts a clean, institutional Zero-Pill aesthetic.

---

## 2. User Experience & Visual Design

### Profile Header Clean-Up (Addressing User Screenshot)
- **Before (Current Clutter)**: 5 competing pill buttons (`Edit Profile` with heavy blurred glow, `Registrar Verified`, `PDF Resume`, `Digital Pass`, `Share`) plus 3 adjacent pill badges next to the name (`Verified Alum`, `ALUMNI`, `SCC-••••-1082`).
- **After (Institutional Zero-Pill Design)**:
  - **Header Nameplate**: Name rendered in bold display typography, flanked by a single subtle emerald verification badge icon (`ShieldCheck`) with tooltip.
  - **Quiet Unboxed Metadata**: Single typographic subtitle row: `Lead Full-Stack Cloud Engineer · Archipelagic Systems · Class of 2023`, followed by quiet bullet-separated contact metadata.
  - **Consolidated Action Cluster**:
    - Primary Button: `Edit Profile` (warm crimson `#8B181B`, crisp 1px shadow, zero neon glow).
    - Secondary Action: `Verify with Registrar` (only when unverified or pending).
    - Overflow Menu Button (`MoreHorizontal` icon): Clean dropdown card with `Download PDF Resume`, `View Digital Pass`, and `Share Profile`.

```
[ STREAMLINED PROFILE HEADER LAYOUT ]

┌────────────────────────────────────────────────────────────────────────┐
│ [ COVER BANNER PHOTO ]                                 [Upload Cover]  │
├────────────────────────────────────────────────────────────────────────┤
│  ┌──────────┐                                                          │
│  │  AVATAR  │                                 [Edit Profile]  [ ••• ]  │
│  └──────────┘                                                          │
│                                                                        │
│  Julian Marc S. Villareal  (✓ Verified)                                │
│  Lead Full-Stack Cloud Engineer · Archipelagic Systems · Class of 2023 │
│  B.S. Information Technology · Minglanilla, Cebu · julian@stcecilia.ph │
│                                                                        │
│  [ About & Career ]   [ My Shared Posts (12) ]   [ Digital Pass ]      │
└────────────────────────────────────────────────────────────────────────┘
```

### Profile Feed Tab ("My Posts" - Facebook / Instagram Style)
- Added alongside "About & Career" and "Digital Pass" tabs on user profiles.
- Chronological timeline of posts authored by this specific alumnus: career milestones, graduation photos, thoughts, and community updates with working like and comment counts.

---

## 3. Key Product Decisions & Architectural Logic

### A. Employer Registration Hardening vs. Student Fraud
- **Problem**: How to prevent a student from registering as an Employer to access candidate resumes or post unauthorized listings?
- **Enforced Security Logic**:
  1. **Strict Role Isolation**: Student ID validation (`SCC-YYYY-NNNNN`) is strictly bound to the `registry_records` collection and can **only** be claimed by the `alumni` role.
  2. **Corporate Domain Validation**: Employer registration blocks academic institutional domains (`@stcecilia.edu.ph`, `@cecilian.edu.ph`) and requires commercial corporate domains or verified business contact emails.
  3. **Mandatory Documentation Gate**: Employer accounts are created with `employerVerificationStatus: 'pending_verification'` and `canPostJobs: false`.
  4. **Administrator Vetting Queue**: The employer account remains in a sandbox mode until a Moderator or Administrator reviews the company profile (SEC/DTI registration, company website, authorized representative verification) and explicitly grants job-posting rights.

### B. Registrar Verification & Conflict Resolution Logic
```
[ VERIFICATION & CONFLICT RESOLUTION WORKFLOW ]

  Alumnus enters Student ID (e.g. SCC-2024-00125) + Full Name
                     │
                     ▼
       Query `registry_records` table
                     │
        ┌────────────┴────────────┐
        ▼                         ▼
   Record Found?             Record Not Found
        │                         │
   ┌────┴─────────────────┐       ▼
   │ Already claimed      │  Routed to Moderator Verification Queue
   │ by another account?  │  (`verificationStatus = 'pending_review'`)
   │                      │  Alumnus uploads TOR / Diploma scan
   │ YES:                 │       │
   │  [CONFLICT FLAGGED]  │       ▼
   │  Trigger Conflict    │  Moderator reviews document & manually
   │  Resolution Case     │  links or registers record in registry
   │                      │
   │ NO:                  │
   │  Check name match    │
   │  • Match >= 85%: Instant Verification
   │  • Mismatch: Routed to Conflict Queue
   └──────────────────────┘
```
- **Conflict Resolution Workspace**:
  - Located in Moderator/Admin Workspace (`ConflictResolutionView.tsx`).
  - Displays side-by-side comparison:
    1. **Contesting Account** (Email, Registered Name, IP, Uploaded Proof)
    2. **Masterlist Graduate Record** (Official Name, Degree, Batch)
    3. **Existing Linked Account** (Current claimant UID, Date claimed)
  - **Resolution Actions**:
    - *Reassign & Approve*: Transfers the student ID to the rightful graduate, revokes fraudulent claim, and writes to `audit_logs`.
    - *Reject Claim*: Dismisses contesting attempt with custom feedback notification sent to claimant.
    - *Flag for Registrar In-Person Verification*: Sets account to pending documentation review.

### C. Post-Application Alumni Candidate Experience
- **Immediate Feedback**: Instant application receipt banner, application ID (e.g., `APP-2026-0812`), and push notification.
- **Visual Hiring Pipeline**: Dedicated "My Applications" tab in Career Portal showing:
  - `Submitted` (Timestamped) -> `Under Review` (HR viewed resume) -> `Shortlisted` (Algorithmic match score & note) -> `Interview Stage` (Interview date/time, Google Meet/Zoom link) -> `Offer / Closed`.
- **Withdrawal & Notes**: Candidate can add supplementary portfolio notes or withdraw the application before interviews are scheduled.

### D. Activity Log Personalization
- **Regular Alumni / Employer View**: Queries `audit_logs` where `actorId == currentUser.uid` or `targetUserId == currentUser.uid`, displaying only their own actions (e.g., "Updated profile details", "Reserved ticket for Homecoming 2024", "Submitted application for Senior Engineer").
- **Admin Audit View**: Retains the comprehensive system-wide governance audit trail with role filtering and CSV export.

---

## 4. Technical Architecture & Component Mapping

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ALUMNET APPLICATION CLIENT                      │
│                                                                        │
│  ┌───────────────────────┐  ┌─────────────────┐  ┌──────────────────┐  │
│  │ ProfileView.tsx       │  │ ChatModal.tsx   │  │ AdminTables.tsx  │  │
│  │ • Clean Zero-Pill Top │  │ • Connection    │  │ • Pagination hook│  │
│  │ • "My Posts" Tab      │  │   Guard Check   │  │   (10/25/50 rows)│  │
│  └───────────────────────┘  └─────────────────┘  └──────────────────┘  │
│              │                       │                     │           │
│              ▼                       ▼                     ▼           │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                       AlumniContext.tsx                          │  │
│  │ • areUsersConnected(uidA, uidB) guard helper                     │  │
│  │ • Activity logs personalized filter (actorId === current.uid)    │  │
│  │ • Web Push notification dispatcher (fcmService + native Web Push)│  │
│  │ • Enhanced job application status transition dispatcher          │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      FIRESTORE PERSISTENT STORAGE                      │
│                                                                        │
│  connections ────► chats / messages (Connection-Gated Channel)         │
│  feed_posts  ────► Queried by authorId for Profile "My Posts" Tab      │
│  audit_logs  ────► Filtered by actorId / targetUserId for User Logs    │
│  job_apps    ────► Enhanced status history & recruiter interview notes │
│  registry    ────► Uncompromised masterlist with conflict flags        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Execution Steps

### Phase 1: Messaging & Connection Enforcement
1. In `src/context/AlumniContext.tsx` and `src/components/chat/ChatModal.tsx`, implement `areUsersConnected(userAId, userBId)` check.
2. In `ProfileView.tsx`, `PublicProfileModal.tsx`, and `NetworkView.tsx`: If the viewing user is not mutually connected with target alumnus, hide the message icon/button and render the primary `Connect` / `Send Connection Request` button.

### Phase 2: Profile Header Modernization & "My Posts" Feed Tab
1. Refactor `ProfileView.tsx` header:
   - Remove redundant pill enclosures and the blurred glow around `Edit Profile`.
   - Add single verification badge beside the name (`ShieldCheck`).
   - Group `PDF Resume`, `Digital Pass`, and `Share Profile` into an accessible dropdown menu (`...`).
2. Add a **"My Posts"** tab on `ProfileView.tsx` and `PublicProfileModal.tsx`, fetching posts from `feed_posts` matching `authorId === user.uid` with support for publishing new updates directly.

### Phase 3: Employer Hardening & Verification / Conflict Logic
1. Harden `src/components/auth/AuthModal.tsx`:
   - Disable student ID inputs during employer sign-up.
   - Enforce corporate email domain checks and set `employerVerificationStatus: 'pending_verification'` and `canPostJobs: false`.
2. Enhance `src/components/admin/ConflictResolutionView.tsx` with side-by-side claim comparison, resolution actions (Reassign & Approve, Reject Claim), and audit logging.

### Phase 4: Job Application Lifecycle & Activity Logs Filtering
1. Update `JobApplicationModal.tsx` and `OpportunityCard.tsx` to provide visual pipeline stages, interview coordination details, and candidate feedback notes.
2. Update activity log views so alumni see only actions they initiated or were targeted by.

### Phase 5: Administrator Core Tables Pagination & Device Notifications
1. Create a reusable pagination utility hook (`usePagination`) and integrate across `AdminUsersTable.tsx`, `RegistryMasterlistView.tsx`, `AdminEventsView.tsx`, `AdminJobsView.tsx`, and `AuditLogView.tsx`.
2. Integrate native browser Web Push dispatching (`Notification.requestPermission`) in `src/services/fcmService.ts` to trigger device notifications on new administrative bulletins.

### Phase 6: Verification & QA
1. Run `lint_applet` (`tsc --noEmit`) to verify complete type safety.
2. Run `vitest` to ensure all 91 tests pass without regression.
3. Run `compile_applet` to confirm successful build.
