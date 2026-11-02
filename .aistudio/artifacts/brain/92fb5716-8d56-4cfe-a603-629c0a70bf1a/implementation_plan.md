# Implementation Plan: Activity Logs Warning Icons & Login Security Corrections

## 1. Executive Summary & Objective
Implement the required security classification and alert rules for St. Cecilia’s College Activity Logs without rebuilding the dashboard or disrupting existing views, filters, and role-based permissions. 

### Key Rule Matrix
| Activity Action | Classification | Warning Icon (⚠️) | Visual Styling |
| :--- | :--- | :---: | :--- |
| `USER_LOGIN` (successful) | **NORMAL** | **No** | Normal dashboard row styling, neutral badge |
| `FAILED_LOGIN_ATTEMPT` | **FAILED / WARNING** | **⚠️ Yes** | Warning highlight (amber/amber-orange), records timestamp & username, NO passwords |
| `MULTIPLE_FAILED_LOGIN_ATTEMPTS` | **SUSPICIOUS** | **⚠️ Yes** | Suspicious highlight (rose/red border & badge) |
| `ACCOUNT_LOCKED` | **SECURITY WARNING** | **⚠️ Yes** | Red/pink highlight, administrator notified, lock reason & timestamp |
| `MULTIPLE_USERS_SAME_ACCOUNT` | **SUSPICIOUS** | **⚠️ Yes** | Suspicious highlight, administrator notified, concurrent session & device details |

---

## 2. Proposed Architectural Changes

### A. Classification & Warning Icon Engine (`src/components/admin/AuditLogView.tsx`)
1. **Refactor `getLogAlertInfo(log: AuditLogEntry)`**:
   - `showWarningIcon`: Returns `true` **strictly** for `FAILED_LOGIN_ATTEMPT`, `MULTIPLE_FAILED_LOGIN_ATTEMPTS`, `ACCOUNT_LOCKED`, and `MULTIPLE_USERS_SAME_ACCOUNT`.
   - `USER_LOGIN`: Explicitly returns `showWarningIcon: false`, `isAlert: false`, `isSuspicious: false`, and `classification: 'NORMAL'`.
   - Remove `USER_RELOGIN` from active classification logic. Map historical `USER_RELOGIN` records as read-only legacy logs without alert icons.
   - Update `classification` string property to match the exact requirement: `'NORMAL'`, `'FAILED / WARNING'`, `'SUSPICIOUS'`, `'SECURITY WARNING'`.
2. **Update Filter & Metric Telemetry**:
   - Update quick stats chips and filter dropdowns: remove references to `relogin`.
   - Filter dropdowns:
     - "All Activities (Normal + Alerts)"
     - "⚠️ Security Alerts Only"
     - "⚠️ Suspicious Activities Only"
     - "User Logins (Normal)"
   - Support filtering directly by security classifications: `FAILED / WARNING`, `SUSPICIOUS`, `SECURITY WARNING`.
3. **Preserve All Existing Features**:
   - Keep Role-based Activity Logs and Admin-wide monitoring.
   - Keep Matrix (Data Table) and Timeline stream views.
   - Keep CSV export (including the new classification and warning flag).
   - Keep Forensic Inspect Modal with raw JSON payload inspection.

### B. Authentication & Activity Generation (`src/context/AlumniContext.tsx` & `server.ts`)
1. **Failed Login Logging**:
   - When login fails (incorrect username or password):
     - Record `FAILED_LOGIN_ATTEMPT` with `severity: 'warning'`.
     - Record timestamp and attempted username/identifier (`targetRecordId`).
     - **Security Guarantee**: Never include password strings in log details, payloads, or storage.
   - Maintain a failed attempt counter per account identifier.
2. **Multiple Failed Attempts & Account Lockout**:
   - If failed attempts reach threshold (3 attempts within window):
     - Log `MULTIPLE_FAILED_LOGIN_ATTEMPTS` (`severity: 'alert'`).
     - Trigger account lockout and log `ACCOUNT_LOCKED` with lock reason, timestamp, and duration.
     - Dispatch notification to administrators in-app via notification dispatch system.
3. **Multiple People Using One Account Detection**:
   - When concurrent sessions from disparate geographical locations or opposing devices/user agents are detected:
     - Generate `MULTIPLE_USERS_SAME_ACCOUNT` with device details and concurrent session metadata.
     - Dispatch high-priority administrator notification.
4. **Complete Discontinuation of `USER_RELOGIN`**:
   - Remove `USER_RELOGIN` from `terminateOtherSessionAndLogin` and server session termination handlers.
   - Use standard `USER_LOGIN` or `MULTIPLE_USERS_SAME_ACCOUNT` depending on context.

### C. Initial Data & Baseline Logs (`src/data/initialData.ts`)
- Update `INITIAL_AUDIT_LOGS` sample dataset to reflect the new classification schema:
  - Add explicit sample records for `FAILED_LOGIN_ATTEMPT`, `MULTIPLE_FAILED_LOGIN_ATTEMPTS`, `ACCOUNT_LOCKED`, and `MULTIPLE_USERS_SAME_ACCOUNT`.
  - Ensure sample `USER_LOGIN` records have normal status without warning icons.
  - Keep historical `USER_RELOGIN` entries as read-only legacy records without warning icons.

---

## 3. Verification & Testing Plan

### Automated Vitest Suite (`tests/activityLogsRoleAlerts.test.ts`)
1. **Successful Login Test**: Verify `USER_LOGIN` has `showWarningIcon === false`, `isAlert === false`, `classification === 'NORMAL'`.
2. **Failed Login Attempt Test**: Verify `FAILED_LOGIN_ATTEMPT` has `showWarningIcon === true`, `classification === 'FAILED / WARNING'`, and contains no passwords.
3. **Multiple Failed Login Attempts Test**: Verify `MULTIPLE_FAILED_LOGIN_ATTEMPTS` has `showWarningIcon === true` and `classification === 'SUSPICIOUS'`.
4. **Account Locked Test**: Verify `ACCOUNT_LOCKED` has `showWarningIcon === true`, `classification === 'SECURITY WARNING'`, and highlights in red/pink.
5. **Multiple Users Same Account Test**: Verify `MULTIPLE_USERS_SAME_ACCOUNT` has `showWarningIcon === true` and `classification === 'SUSPICIOUS'`.
6. **Discontinuation of USER_RELOGIN**: Verify `USER_RELOGIN` is omitted from active generation and classification logic.
7. **Role-Based Scoping & Admin Wide Test**: Verify non-admin roles remain scoped to their role while admin retains global visibility.

### Build & Typecheck Verification
- Execute `npx vitest run` across all test suites.
- Execute `lint_applet` to ensure zero syntax or lint errors.
- Execute `compile_applet` to ensure clean build output.
