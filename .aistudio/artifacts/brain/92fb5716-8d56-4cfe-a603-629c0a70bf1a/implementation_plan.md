# Cross-Platform Security, Directory Segregation & Institutional Experience Plan

This implementation plan addresses the comprehensive update request across the St. Cecilia's College Alumni Network (Web and Mobile builds). It establishes the reusable `PlatformRestrictedGuard`, introduces email-based Two-Step Verification, separates Alumni and Employer onboarding with a pre-submission review step and approval notices, segregates the Directory into Alumni and Partnered Companies, removes feed IDs and landing redirect arrows, resolves chat ordering and delivery status indicators, integrates an institutional User Satisfaction Survey, and mandates confirmation dialogs on all sensitive administrative actions.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> **Confirmed Specifications from Clarification Phase**:
> 1. **Two-Step Verification (2FA)**: Delivers a secure 6-digit one-time security code to the user's registered institutional email, complete with countdown expiration and a "Resend Code" control.
> 2. **Pending Approval Window**: Registration completion notices explicitly inform new registrants that their credentials and documents are undergoing verification by the Registrar/Administration and will be reviewed within **24 to 48 business hours**.
> 3. **User Satisfaction Survey Placement**: Accessible via a prominent, dignified institutional banner and modal within the user profile menu and header, allowing Cecilian alumni and staff to evaluate their experience without interrupting primary workflows.
> 4. **Administrative Web-Only Guard**: A reusable `PlatformRestrictedGuard` component programmatically intercepts administrative dashboard routes when accessed via native APK environments, rendering an institutional restriction message with a web launcher.

---

## 1. Architecture & Component Blueprint

```
┌────────────────────────────────────────────────────────────────────────┐
│                      PLATFORMRESTRICTEDGUARD                           │
│                                                                        │
│   Detects: Capacitor.isNativePlatform() === true                       │
│   ├─ If Native APK & Admin Route:                                      │
│   │  Renders "Web-Only Access" Notice + "Launch Official Web Portal"   │
│   └─ If Web Browser (Desktop / Mobile / Tablet):                       │
│      Renders full administrative children (AdminPanelView, etc.)       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        AUTHENTICATION & ACCESS                         │
│                                                                        │
│  [Two-Step Verification]       [Separate Registration Hub]             │
│  • 6-digit email OTP modal      • Choice: Alumni vs. Partner Employer   │
│  • Expiration timer & resend   • Back button to re-select path         │
│  • Cloud-synced 2FA state      • Step 3: Information Review & Edit     │
│                                • Employer completes -> Sign In route   │
│                                • 24–48hr Pending Notice Banner         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         DIRECTORY SEGREGATION                          │
│                                                                        │
│  Sidebar: "Directory" (renamed from "Alumni Directory")                │
│  Main View Tabs:                                                       │
│  ┌───────────────────────────────────┬───────────────────────────────┐ │
│  │ 🎓 Alumni Directory               │ 🏢 Partnered Companies        │ │
│  │ • Unapproved/pending hidden       │ • Approved active partners    │ │
│  │ • Verified Cecilian roster        │ • Real-time available slots   │ │
│  │ • Batch/Course/Industry filters   │ • Declined companies removed  │ │
│  └───────────────────────────────────┴───────────────────────────────┘ │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   UX, CHAT & ADMINISTRATIVE SAFETY                     │
│                                                                        │
│  • Social Feed: ID numbers stripped from post cards and avatars        │
│  • Landing Page: Redirection arrow button removed                      │
│  • Messaging: Latest active chat floats to top; message states "Sent"  │
│  • Survey: User Satisfaction Survey in profile menu (ratings + notes)  │
│  • Admin Safety: ConfirmationModal on role changes, deletions & bans   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Detailed Work Breakdown by Section

### Phase 1: PlatformRestrictedGuard Component
- **Location**: `src/components/common/PlatformRestrictedGuard.tsx`
- **Behavior**:
  - Checks `clientPlatform === 'mobile'` or `Capacitor.isNativePlatform()`.
  - If user is in an administrative role (`admin`, `superadmin`, `staff`, `moderator`, `registrar`) and running within the native APK environment, displays a full-card institutional notice:
    - Title: **Administrative Access Restricted**
    - Message: *"Administrative access is restricted to the web portal. To manage registry records, verification queues, and institutional settings, please log in through your desktop or mobile web browser."*
    - Actions: **"Launch Web Portal"** (`window.location.origin`) and **"Return to Alumni Dashboard"**.
  - If in web browser, renders children normally without interference.
- **Integration**: Wraps `AdminPanelView`, `AdminWorkspaceLayout`, `EmployerManagementModule`, and privileged sub-dashboards in `App.tsx`.

### Phase 2: Two-Step Verification (2FA) & Security
- **Location**: `src/components/auth/TwoFactorVerificationModal.tsx`, `src/context/AlumniContext.tsx`, `server.ts`
- **Features**:
  - Generates secure 6-digit numeric OTP linked to the authenticating user session.
  - Simulates/dispatches code to the user's registered institutional email (with demo preview toast/code display for friction-free testing).
  - 10-minute expiration countdown with one-click **"Resend Security Code"**.
  - Secure entry input with automated auto-focus and clipboard paste support.
  - Verification succeeds -> establishes persistent active session.

### Phase 3: Registration Redesign, Pre-Submission Review & Pending Notices
- **Location**: `src/components/auth/AuthPage.tsx`
- **Updates**:
  1. **Dual Registration Entry**:
     - Top navigation segment or card selection allowing users to pick between **Alumni Registration** and **Employer / Industry Partner Registration**.
     - Clear **"Back to Role Selection"** and **"Back to Sign In"** navigation buttons on all registration sub-steps.
  2. **Information Validation / Review Step**:
     - Before final registration commit, insert a dedicated **"Review & Confirm Details"** summary step.
     - Displays formatted cards of all input details (Full Name, Student ID / Company Name, Degree / Industry, Contact Email, Employment Status).
     - Allows quick inline editing before final submission to eliminate typing mistakes.
  3. **Employer Flow Redirection**:
     - Once employer registration is submitted, smoothly transitions the view to the **Sign In tab** with a success message (instead of looping back to Alumni registration).
  4. **Pending Approval Notification**:
     - Prominent status card informing the newly registered user:
       *"Your account has been submitted successfully and is currently pending institutional verification. Account credentials and student/company records are reviewed within **24 to 48 business hours**. You will receive an email confirmation once approved."*

### Phase 4: Directory Segregation & Visibility Restrictions
- **Location**: `src/components/layout/Navigation.tsx`, `src/components/network/NetworkView.tsx`, `src/components/network/PartneredCompaniesView.tsx`
- **Updates**:
  1. **Navigation Rename**: Rename sidebar and mobile drawer item from "Alumni Directory" / "Alumni Network" to **"Directory"**.
  2. **Strict Visibility Filter**: Filter out any user with `accountStatus === 'PENDING_VERIFICATION'` or `accountStatus === 'SUSPENDED'` or unverified employers (`employerVerificationStatus !== 'approved'`).
  3. **Segregated Sub-Views**:
     - Tab 1: **Alumni Directory**: Verified alumni cards, batch filters, course search.
     - Tab 2: **Partnered Companies**: Dedicated grid/list of approved industry partner organizations.
  4. **Available Slots & Opportunities Display**:
     - Each company card shows their active job/internship counts and slots available (e.g., *"3 Active Openings · 8 Available Slots"*).
  5. **Auto-Removal of Declined Partners**:
     - If an employer/company partnership is rejected or declined in administrative management, they are automatically purged from the directory display.

### Phase 5: Social Feed, Landing Page & Responsive Web Polish
- **Location**: `src/components/dashboard/InstitutionalSocialFeed.tsx`, `src/components/landing/LandingPage.tsx`
- **Updates**:
  1. **Feed Cleanup**: Remove student ID / user ID displays from feed post author headers and badges, showing only verified full names, degree, and graduation batch.
  2. **Landing Page Arrow Removal**: Remove the redirection arrow button from hero CTAs and redirection link triggers.
  3. **Responsive Web UI Audit**: Verify layouts across mobile (<640px), tablet (640-1024px), desktop (1024-1440px), and ultrawide (>1440px), ensuring no horizontal overflow and adhering to standard padding/radius formulas.

### Phase 6: Messaging & Chat Order Fixes
- **Location**: `src/components/messages/MessagesView.tsx`, `src/context/AlumniContext.tsx`
- **Updates**:
  1. **Recent Chat Float-to-Top**: Ensure `chats` array is strictly sorted by `lastMessageAt` timestamp descending, so sending or receiving a message immediately bubbles that conversation to index 0.
  2. **Message Status Indicator**: Fix message bubble ticks so sent/delivered messages display **"Sent"** (or double checkmark) with timestamp, resolving any stuck "Sending..." status on rendered messages.

### Phase 7: User Satisfaction Survey & Admin Confirmation Dialogs
- **Location**: `src/components/survey/UserSatisfactionModal.tsx`, `src/components/layout/Header.tsx`, `src/components/admin/AdminPanelView.tsx`
- **Updates**:
  1. **Satisfaction Survey**:
     - Institutional survey evaluating: Platform Usability (1-5 stars), Directory Relevance, Networking & Chat, Event Management, and open qualitative feedback.
     - Accessible via profile dropdown menu ("Rate Portal Experience") and a non-intrusive survey banner in settings/profile.
     - Submissions saved to Firestore (`surveys` collection) and local storage with feedback confirmation.
  2. **Mandatory Administrative Confirmation Dialogs**:
     - Ensure every critical admin action triggers `ConfirmationModal`:
       - User role promotion / demotion.
       - Account suspension / ban / unban.
       - Employer partnership approval / decline.
       - Announcement / event deletions.
       - Database purge / synchronization actions.

---

## 3. Verification & Testing Strategy

1. **Guard Test**:
   - Access admin panel on native APK override -> Verify `PlatformRestrictedGuard` halts page and provides Web Portal launcher.
   - Access admin panel on standard web -> Verify smooth dashboard load.
2. **2FA Test**:
   - Initiate login -> Verify 6-digit OTP prompt appears, test code submission and resend timer.
3. **Registration Flow Test**:
   - Select Employer -> Fill details -> Check Review Step -> Submit -> Verify immediate redirect to Sign In page with 24-48hr review banner.
4. **Directory Segregation Test**:
   - Verify sidebar says "Directory". Switch between Alumni and Partnered Companies tabs. Check slots badge on companies. Verify unapproved users/employers do not appear.
5. **Feed & Landing Polish**:
   - Verify zero user IDs visible in feed cards. Verify landing page has no redirect arrow button.
6. **Chat Test**:
   - Send message -> Confirm chat moves to the very top and displays "Sent" status.
7. **Confirmation Dialogs & Survey Test**:
   - Perform admin role change -> Verify confirmation modal intercepts before committing.
   - Open User Satisfaction Survey from header menu -> Fill answers -> Submit -> Verify success confirmation.
8. **TypeScript & Build**:
   - Run `lint_applet` (`tsc --noEmit`) and `compile_applet`. Ensure 0 errors.
