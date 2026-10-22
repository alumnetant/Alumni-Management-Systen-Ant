# Plan: Alumni Portal Navigation, Access Control, Notifications, & UI Polish

This plan addresses all requested portal updates: bottom icon dashboard reset, menu reorganization, removal of extra platform options, alumni-exclusive login enforcement with custom notice, confirmed logout logic, accurate online status indicators, a header notification popover with unread counter badge, direct navigation for connection requests, fixed messaging layout containers, "Already Applied / Submitted" job indicators, and dark mode contrast fixes.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> **Confirmed Specifications**:
> 1. **Bottom Icon Dashboard Reset**: Tapping the bottom dashboard icon scrolls to top and dispatches an event to reset active search queries, sub-tabs, filters, and expanded cards back to the main overview.
> 2. **Header Notification Icon & Popover**: Convert the notification section into a header bell icon with an unread badge that opens a dropdown popover menu anchored to the bell.
> 3. **Connection Request Direct Navigation**: Clicking a connection request notification navigates directly to the Network directory with the "Pending Requests" tab pre-selected for instant review and acceptance.
> 4. **Alumni-Exclusive Access Enforcement**: Restrict login exclusively to alumni (`role === 'alumni'`). Non-alumni roles attempting login will be blocked with the exact note: `"Mobile Application is Exclusive for Alumni."`
> 5. **Logout Confirmation**: Provide an explicit confirmation modal before terminating the session and clearing stored tokens.
> 6. **Messaging Layout Fix**: Wrap the active conversation thread in a dedicated container with proper z-index and fixed positioning so header elements and the back button are never obscured.
> 7. **Job Application State**: Display a prominent `"Submitted"` or `"Already Applied"` status on jobs the alumnus has applied to.
> 8. **Dark Mode Contrast**: Fix rogue white-background panels and hardcoded dark text for complete dark-mode legibility.

---

## 1. Architectural Changes by Module

```
  ┌────────────────────────────────────────────────────────┐
  │                        HEADER                          │
  │  [Logo / Title]              [Bell + Badge] [Messages] │ <── Add Bell Popover
  └──────────────────────────┬─────────────────────────────┘
                             │
     ┌───────────────────────┴───────────────────────┐
     │                                               │
     ▼                                               ▼
[Notification Popover]                      [Navigation Drawer / Breadcrumbs]
 - Unread counter badge                      - Remove "Profile" (in bottom nav)
 - Direct "Confirm Request" link             - Remove "Alumni Mobile App" / "Web Portal"
 - Direct event / announcement link          - Clean breadcrumbs

  ┌────────────────────────────────────────────────────────┐
  │                      PORTAL MAIN                       │
  │  [Dashboard / Network / Messages / Jobs / Settings]    │
  │                                                        │
  │  • Messages: Fixed container prevents cutoffs          │
  │  • Jobs: "Already Applied / Submitted" badges          │
  │  • Online Status: 5-minute accurate heartbeat          │
  │  • Dark Mode: Full dark:bg-stone-900 / dark:text-stone │
  └──────────────────────────┬─────────────────────────────┘
                             │
                             ▼
  ┌────────────────────────────────────────────────────────┐
  │                  BOTTOM GLASS DOCK                     │
  │  [Home]  [Network]  [Pass]  [Messages]  [Profile]      │
  │    ▲                                                   │
  │    └─ Clicking resets dashboard back to main overview  │
  └────────────────────────────────────────────────────────┘
```

---

## 2. Proposed Changes by File

### Module 1: Alumni Portal & Navigation Updates
- **`src/components/layout/Navigation.tsx`**:
  - Update `handleMobileNavClick('dashboard')`: When clicked (or already on dashboard), dispatch `applet:reset-dashboard` and execute smooth scroll to top `(0, 0)`.
  - Remove `"profile"` from the mobile burger drawer and breadcrumbs (it is prominently placed in the bottom glass dock).
  - Remove any legacy `"Alumni Mobile App"` and `"Web Portal"` menu options.
- **`src/components/alumni/AlumniWorkspaceLayout.tsx`**:
  - Remove `"profile"` from `secondaryNavItems` in the sidebar and breadcrumb path calculation.
  - Clean up breadcrumb trail so it cleanly renders the current active section.
  - Add listener for `applet:reset-dashboard` to clear active search queries and restore default overview.

### Module 2: Access Control & Login
- **`src/components/auth/AuthPage.tsx` & `src/context/AlumniContext.tsx`**:
  - In `login` function, verify that `user.role === 'alumni'`.
  - If a non-alumni user (e.g. `admin`, `staff`, `registrar`, `employer`) attempts to log in, block authentication and set the error message:
    `"Mobile Application is Exclusive for Alumni."`
  - Implement a Confirmation Modal for the Log Out action in `AlumniWorkspaceLayout.tsx`, `Header.tsx`, and `SettingsView.tsx` with clear Cancel and Confirm options.

### Module 3: Status, Notifications, & Connection Requests
- **`src/context/AlumniContext.tsx`**:
  - Implement a precise active status calculation: Users with a `lastActiveAt` timestamp within the past 5 minutes are rendered as "Active Now" (green dot); otherwise, render formatted relative activity (e.g., "Active 12m ago").
  - Update notification click routing: When an alert of type `friend_request` or `connection_request` is clicked, navigate to `network` with `{ subTab: 'requests' }`.
- **`src/components/layout/Header.tsx` & `src/components/alumni/AlumniWorkspaceLayout.tsx`**:
  - Add a styled Notification Bell button beside the Messages icon in the top header bar.
  - Render a red unread badge pill showing `unreadNotificationsCount`.
  - Render an anchored dropdown popover menu displaying recent notifications, quick actions, "Mark All as Read", and direct deep-linking to connection requests.

### Module 4: Messaging, Job Applications, & Dark Mode UI Fixes
- **`src/components/messages/MessagesView.tsx`**:
  - Wrap the active thread conversation view in a fixed/absolute positioned container (`fixed inset-0 z-50 md:relative md:inset-auto md:z-auto h-full flex flex-col`) with explicit safe-area padding so that the back button, header avatar, and input bar are never clipped or hidden on mobile screens.
- **`src/components/opportunities/OpportunitiesView.tsx`**:
  - Check whether `jobApplications.some(app => app.jobId === opp.id && app.applicantUid === currentUser.uid)`.
  - If applied, replace the "Apply Now" button with a disabled, clear `"✓ Submitted"` or `"Already Applied"` badge button.
- **Dark Mode Contrast Audit**:
  - Inspect and fix contrast in `OpportunitiesView.tsx`, `MessagesView.tsx`, `NetworkView.tsx`, `DashboardOverview.tsx`, and `CollegiatePushBanner.tsx`. Replace remaining hardcoded `bg-white` and `text-stone-900` with `dark:bg-stone-900` and `dark:text-stone-100`.

---

## 3. Verification Plan

1. **Compilation & Linting**:
   - Run `compile_applet` and `lint_applet` to confirm zero TypeScript or build errors.
2. **Access Control Testing**:
   - Attempt login with `admin@stcecilia.edu.ph` -> Expect message: `"Mobile Application is Exclusive for Alumni."`
   - Attempt login with `alumni@stcecilia.edu.ph` -> Expect successful login.
3. **Navigation & Dashboard Reset Testing**:
   - Scroll down in Dashboard and tap bottom Home icon -> Expect viewport scrolls to top and resets view.
   - Verify breadcrumb and drawer do not contain duplicate "Profile" or "Alumni Mobile App" / "Web Portal" items.
4. **Header Notification & Connection Request Direct Routing**:
   - Click bell icon in header -> Expect dropdown popover with unread counter.
   - Click a connection request notification -> Expect instant navigation to Network directory with the Pending Requests view active.
5. **Messaging Layout & Job Application Badging**:
   - Open a chat on mobile viewport -> Verify back button and input box are fully visible and clickable without obstruction.
   - View jobs that have an existing application -> Verify badge displays "✓ Submitted" / "Already Applied".
6. **Dark Mode Verification**:
   - Toggle to dark mode and verify readability across all updated surfaces.
