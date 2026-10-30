# System Issues & Quality-of-Life Enhancements Plan

Comprehensive resolution plan addressing the 9 reported bugs and workflow improvements across Web and Mobile surfaces for St. Cecilia's College - Cebu Alumni Network (Cecilian Alumnet).

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following key decisions were confirmed during the interactive clarification phase:

- **Confirmed Decision 1 (Emergency PIN)**: Renamed all instances of "Campus Emergency PIN" to **"Emergency PIN"** across security settings, lock modals, and verification dialogs, maintaining accurate 4-to-6 digit credential validation and reset fallback.
- **Confirmed Decision 2 (Password Update Email)**: Upon changing the account password, an immediate institutional security confirmation email is dispatched to the user's registered email address with timestamp, IP/device snapshot, and security contact links.
- **Confirmed Decision 3 (Unsent Message Visibility)**: When a message is unsent, it is replaced with a discreet institutional notice reading *"This message was unsent"* with an italicized muted style for all participants, and the dropdown menu positioning is dynamically calculated (`top-full mt-1` vs `bottom-full mb-1`) so top messages are never clipped.

---

## 1. Overview & Core Concept

- **What It Does**: Resolves 9 functional and visual inconsistencies across Direct Messages, Alumni Directory, Member Profile, Job Applications, Notification Alerts, and Account Security.
- **Target Audience**: St. Cecilia's College alumni, faculty, and administrative members accessing the portal via modern web browsers and the Android APK.
- **Key Value**: Delivers seamless messaging ergonomics, reliable connection state feedback, strict local Philippine phone validation, unified action button alignment, full visibility into urgent alerts, and verifiable account security workflows.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Unsend Message & Menu Visibility (Web/Mobile)**
   - User hovers or taps the top-most message in a thread.
   - Menu opens downward (`top-full mt-1`) instead of getting clipped off the top screen boundary.
   - User taps "Unsend Message"; message body transitions smoothly to a quiet `This message was unsent` notice with a muted flag icon.

2. **Horizontal Prompt Sliding (Messages Bar)**
   - When viewing quick prompt chips in Direct Messages, left and right chevron navigation buttons appear when overflowing.
   - Touch drag, mouse wheel tilt, and click-to-slide smoothly scroll through all predefined conversation starters without clipping.

3. **Inspect Profile Streamlining**
   - In `PublicProfileModal`, the redundant standalone "Message" button is removed from the inspection header, keeping the focus clean on credentials, affiliations, and existing connection status.

4. **Instant Alumni Directory "Request Sent" Feedback**
   - User clicks "Connect" on any alumnus card in Browse Directory (`NetworkView`).
   - The button optimistically transitions instantly to a subdued, verified button state: `Request Sent` with a checkmark and subtle clock icon, persisting across grid, table, and list modes.

5. **Philippine Contact Number Validation**
   - In `EditProfileModal`, the phone input enforces standard Philippine mobile formats (`09XXXXXXXXX` or `+639XXXXXXXXX`).
   - Real-time feedback displays formatting guidance; invalid submissions trigger clear error state without submitting dirty state.

6. **My Applications Action Alignment**
   - In `OpportunitiesView` under "My Applications", the "Withdraw" action button is aligned vertically and horizontally with the application stage status pill (e.g., "Under Review", "Interview", "Offer"), preserving visual rhythm.

7. **Urgent Notification Deep-Dive Modal (Mobile/Web)**
   - Tapping an urgent or critical push/notification card opens `UrgentNotificationDetailModal`.
   - Displays full institutional alert copy, issuing department, priority badge, timestamp, and relevant action links (e.g., review security, view opportunity, campus emergency guidance).

8. **Password Update Security Alert Email**
   - In `SettingsView`, updating the account password triggers an immediate backend email dispatch via `/api/email/security-alert` confirming the credential change and providing immediate escalation links if unauthorized.

9. **Emergency PIN Verification & Renaming**
   - Replaced all "Campus Emergency PIN" text with "Emergency PIN".
   - Verified that PIN creation, numeric entry masking, and emergency bypass unlock function accurately across `SettingsView` and `BiometricAppLockModal`.

### Visual Identity & Theme (AGENTS.md Compliance)
- **Palette**: Deep Cecilian Crimson (`#8B181B`), warm institutional stone neutrals (`stone-50` to `stone-900`), verified emerald badges, and restrained amber warning indicators.
- **Typography**: Clean tracking (`tracking-tight` for display, `leading-relaxed` for copy) using Lucide SVG icons (`strokeWidth={1.75}`).
- **Zero-Pill Discipline**: Geometric, proportional rounded corners (`rounded-xl` for cards, `rounded-lg` for interactive buttons).

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Dynamic Dropdown Positioning for Chat Actions**
  - *Chosen Approach*: Inspect message index within the conversation thread; indices `< 2` anchor to `top-full mt-1`, while later messages anchor to `bottom-full mb-1`.
  - *Why*: Eliminates overflow clipping without requiring expensive floating UI libraries or portals.

- **Decision 2: Optimistic UI for Connection Requests**
  - *Chosen Approach*: Optimistically append target alumni ID to local `pendingConnections` set and update button copy to "Request Sent" immediately upon click.
  - *Why*: Eliminates network latency delays and gives instant tactile confirmation to users.

- **Decision 3: Non-Destructive Phone Number Sanitization**
  - *Chosen Approach*: Strip spaces, hyphens, and parenthesis before regex testing against `/^(09|\+639)\d{9}$/`.
  - *Why*: Accommodates common user entry styles (`0917-123-4567` or `+63 917 123 4567`) while strictly enforcing valid Philippine carrier prefixes.

---

## 4. Technical Architecture & Component Mapping

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Cecilian Alumnet Frontend                       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
    ┌───────────────────────────────┼──────────────────────────────┐
    ▼                               ▼                              ▼
┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│     MessagesView     │  │     NetworkView      │  │  OpportunitiesView   │
│ - Dynamic Menu Drop  │  │ - "Request Sent"     │  │ - Align "Withdraw"   │
│ - Prompt Scroll/Drag │  │   Optimistic State   │  │   with Stage Status  │
│ - "Unsent" notice    │  └──────────────────────┘  └──────────────────────┘
└──────────────────────┘
    │
    ├───────────────────────────────┬──────────────────────────────┐
    ▼                               ▼                              ▼
┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│  PublicProfileModal  │  │   EditProfileModal   │  │  NotificationsView   │
│ - Remove Redundant   │  │ - Philippine Mobile  │  │ - Urgent Notification│
│   "Message" button   │  │   Regex Validation   │  │   Detail Modal View  │
└──────────────────────┘  └──────────────────────┘  └──────────────────────┘
    │
    └───────────────────────────────┬──────────────────────────────┐
                                    ▼                              ▼
                          ┌──────────────────────┐  ┌──────────────────────┐
                          │     SettingsView     │  │ BiometricAppLockModal│
                          │ - "Emergency PIN"    │  │ - "Emergency PIN"    │
                          │ - Password Email API │  │ - Numeric PIN unlock │
                          └──────────┬───────────┘  └──────────────────────┘
                                     │
                                     ▼
                          ┌──────────────────────┐
                          │   Express Backend    │
                          │ - /api/email/        │
                          │   security-alert     │
                          └──────────────────────┘
```

---

## 5. Verification Plan

1. **Compilation & Linter**: Run `tsc --noEmit` and `npm run build` to verify 0 syntax or type errors.
2. **Messages**: Test top message unsend dropdown visibility; verify unsend replaces content with quiet indicator; test horizontal prompt scrolling with chevrons.
3. **Profile**: Verify removal of redundant message button in `PublicProfileModal`; test phone validation with invalid formats (`12345`) and valid Philippine formats (`09171234567`, `+639171234567`).
4. **Directory & Applications**: Verify clicking "Connect" renders "Request Sent"; verify "Withdraw" button alignment in My Applications.
5. **Notifications & Security**: Test tapping urgent notification opens detailed modal; test password change triggers security alert confirmation; verify "Emergency PIN" label and unlock workflow.
