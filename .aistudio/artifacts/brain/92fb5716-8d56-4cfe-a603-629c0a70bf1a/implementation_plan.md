# Platform-Based Role Access Control: Universal Alumni Access & Web-Only Admin Portal

This plan establishes platform-specific authentication and runtime access boundaries for the St. Cecilia's College Alumni Network. It enables alumni members to use both the Web Portal and the native Android APK mobile application, while strictly restricting administrators, super administrators, and institutional staff (Registrar, Staff, Moderator, Employer) to the Web Portal.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> **Confirmed Specifications from Clarification Phase**:
> 1. **Alumni Universal Clearance**: Alumni accounts (`role === 'alumni'`) can sign in and access the platform from **both** the Web Portal (desktop, tablet, mobile web browsers) and the native APK mobile application.
> 2. **Administrative Web-Only Restriction**: Administrators (`admin`, `superadmin`) and all institutional staff roles (`registrar`, `staff`, `moderator`, `employer`) can **only** access the Web Portal. They are blocked from signing in on the native mobile APK package.
> 3. **Native APK Environment Detection**: The mobile application environment is distinguished strictly by native runtime detection (`Capacitor.isNativePlatform()`), eliminating the previous viewport width check (`< 1024px`) that inadvertently treated mobile web browsers as the mobile APK.
> 4. **User Guidance Notice**: When an administrator or non-alumni account attempts to log in on the mobile APK package, authentication is blocked with the exact institutional advisory: `"Administrative access is restricted to the web portal"`.

---

## 1. Overview & Core Concept

- **What It Does**: Enforces platform-specific security boundaries between collegiate stakeholders. Mobile alumni members access dedicated features (digital alumni ID pass, real-time push alerts, messaging, and networking) on both their phones and web browsers, while administration, registrar records verification, user role assignment, and management desks are secured strictly within the full-featured Web Portal.
- **Target Audience**:
  - Alumni accessing the network via the downloaded Android APK or any web browser.
  - School Administrators, Superadmins, Registrars, and Staff accessing console desks via web browsers on desktop, laptop, tablet, or mobile.
- **Key Value**: Prevents unauthorized administrative access attempts on personal mobile devices via the APK binary, guarantees a stable full-screen workstation experience for administrative tasks, and delivers universal access for alumni.

---

## 2. User Experience & Visual Design

- **Alumni Login Flow (Web & Mobile APK)**:
  - An alumnus enters their Student ID, Alumni ID, or email and password.
  - Authentication succeeds seamlessly across both platforms.
  - On the mobile APK, the alumnus experiences the touch-optimized mobile interface with bottom glass dock, push notifications, and campus pass.
  - On the Web Portal, the alumnus enjoys the spacious desktop dashboard.

- **Administrator Login Flow on Web Portal**:
  - An administrator signs in via any standard web browser (Chrome, Safari, Firefox, Edge on desktop, tablet, or mobile).
  - The Web Portal validates the administrative credentials and loads the console dashboard with full management capabilities.

- **Administrator Login Attempt on Mobile APK**:
  - If an administrator enters administrative credentials into the native Android APK package:
    - Login is halted immediately before creating an active session.
    - A crisp, styled modal or inline banner in St. Cecilia's deep crimson (`#8B181B`) displays:
      `"Administrative access is restricted to the web portal"`.
    - An action button provides a direct browser launch option (`"Open Web Portal"`), seamlessly directing the administrator to the web URL.
    - No administrative data or tokens are stored in the mobile APK storage.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Native Runtime Inspection Over Viewport Width**
  - *Chosen Approach*: Identify the APK strictly through `Capacitor.isNativePlatform()` and native Capacitor bridge headers.
  - *Why*: Viewport width detection (`innerWidth < 1024px`) previously misidentified mobile web browsers as APK binaries, erroneously blocking administrators inspecting the portal on smartphones or responsive displays.
  - *Alternatives Considered*: User-Agent sniffing (fragile and easily spoofed); Screen size checks (blocks mobile web testing).

- **Decision 2: Dual Client & Server Enforcement**
  - *Chosen Approach*: Enforce platform clearance both in the client authentication state and inside the backend Express API (`/api/auth/login`).
  - *Why*: Client validation gives instant, responsive feedback, while server-side validation guarantees that requests directly sent to the API cannot bypass the platform check.

- **Decision 3: Non-Alumni Institutional Roles Alignment**
  - *Chosen Approach*: Align Registrars, Staff, Moderators, and Employers with Administrators (Web Portal only).
  - *Why*: Maintains high security across all privileged institutional roles and avoids exposing departmental tools in consumer mobile packages.

---

## 4. Technical Architecture & Data Strategy

### Authentication & Platform Gate Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CLIENT RUNTIME DETECTION                        │
│                                                                        │
│   ┌────────────────────────────────┐  ┌────────────────────────────┐   │
│   │   Native Android APK Package   │  │   Web Portal (Any Browser) │   │
│   │   Capacitor.isNativePlatform() │  │   Desktop / Tablet / Phone │   │
│   │   platform: "native_apk"       │  │   platform: "web"          │   │
│   └───────────────┬────────────────┘  └─────────────┬──────────────┘   │
└───────────────────┼─────────────────────────────────┼──────────────────┘
                    │                                 │
                    ▼                                 ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      AUTHENTICATION PLATFORM GATE                      │
│                                                                        │
│   • Alumni (role === 'alumni'):                                        │
│     Allowed on "native_apk" AND "web"                                  │
│                                                                        │
│   • Administrators & Staff (admin, superadmin, registrar, staff...):   │
│     Allowed ONLY on "web"                                              │
│     Blocked on "native_apk" with:                                      │
│     "Administrative access is restricted to the web portal"            │
└───────────────────┬─────────────────────────────────┬──────────────────┘
                    │                                 │
                    ▼                                 ▼
┌───────────────────────────────────────┐ ┌──────────────────────────────┐
│ Express API /api/auth/login           │ │ Client Auth State            │
│ Verify platform & role constraints    │ │ Display advisory modal &     │
│ Return HTTP 403 on APK admin attempt  │ │ "Open Web Portal" link       │
└───────────────────────────────────────┘ └──────────────────────────────┘
```

### Component & State Mapping

- **Platform State (`AlumniContext.tsx`)**:
  - `isNativeApk`: Boolean flag checking `Capacitor.isNativePlatform()`.
  - `clientPlatform`: Evaluates to `'native_apk'` when running within the compiled Capacitor binary; otherwise evaluates to `'web'`.
  - `setClientPlatformOverride`: Retains developer debugging capability for testing native APK posture in preview environments.
- **Login Validation (`AlumniContext.tsx` & `server.ts`)**:
  - In `login(identifier, password)`:
    - Sends `{ identifier, password, platform: clientPlatform }` to `/api/auth/login`.
    - If `platform === 'native_apk'` and `user.role !== 'alumni'`:
      - Abort session creation.
      - Return `{ success: false, error: 'Administrative access is restricted to the web portal' }`.
  - In `server.ts` line 1105 (`/api/auth/login`):
    - Replace the unconditional non-alumni block with platform-aware validation:
      `if (platform === 'native_apk' && userRole !== 'alumni')` -> return 403 with `Administrative access is restricted to the web portal`.
      `if (platform !== 'native_apk')` -> permit both alumni and administrators to log in!

---

## 5. Verification Plan

1. **Automated Verification**:
   - Run `lint_applet` and `compile_applet` to confirm zero TypeScript compilation errors.
2. **Alumni Login Verification**:
   - Web Browser: Sign in as `alumni@stcecilia.edu.ph` -> Expect successful login.
   - Native APK simulation: Set platform to APK -> Sign in as `alumni@stcecilia.edu.ph` -> Expect successful login.
3. **Administrator Login Verification**:
   - Web Browser: Sign in as `admin@stcecilia.edu.ph` or `superadmin@stcecilia.edu.ph` -> Expect successful login and access to administrative desks.
   - Native APK simulation: Set platform to APK -> Attempt sign in as `admin@stcecilia.edu.ph` -> Expect blocked login with notice: `"Administrative access is restricted to the web portal"`.
4. **Staff Roles Verification**:
   - Web Browser: Sign in as `registrar@stcecilia.edu.ph` or `employer@stcecilia.edu.ph` -> Expect successful login.
   - Native APK simulation: Attempt sign in -> Expect blocked login with the same web-only advisory.
