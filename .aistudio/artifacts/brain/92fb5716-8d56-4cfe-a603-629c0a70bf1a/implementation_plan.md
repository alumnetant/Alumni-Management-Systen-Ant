# Implementation Plan: Native Capacitor Biometric Authentication (Android Keystore Vault & BiometricPrompt)

Implement secure, production-grade biometric authentication (Fingerprint and Face Unlock) for the St. Cecilia's College - Cebu Alumni Management System Android APK using `@capgo/capacitor-native-biometric`.

---

## 1. Architecture & Security Flow

```
                      +---------------------------------------+
                      | Alumnus Enters Email & Password Form  |
                      +---------------------------------------+
                                          |
                                          v
                      +---------------------------------------+
                      | POST /api/auth/login                  |
                      | Receives Access Token + Refresh Token |
                      +---------------------------------------+
                                          |
                      +---------------------------------------+
                      | Is Native Android? (Capacitor Native) |
                      +---------------------------------------+
                             /                         \
                     [YES]  /                           \  [NO - Web]
                           v                             v
           +-------------------------------+    +------------------------+
           | Prompt Modal:                 |    | Standard Web Session   |
           | "Enable Biometric Login?"     |    | (No Native Storage)    |
           +-------------------------------+    +------------------------+
                   /               \
           [Accept]                 [Skip]
              |                        \
              v                         v
+-------------------------------+   +-----------------------------+
| NativeBiometric.setCredentials|   | Continue to Dashboard       |
| Hardware Android Keystore     |   +-----------------------------+
| Refresh Token Encrypted Vault |
+-------------------------------+
```

### Subsequent Native Launch Flow:
1. **Hardware & Enrollment Check:** When the mobile app initializes on native Android (`Capacitor.isNativePlatform()`), check `NativeBiometric.isAvailable()`.
2. **Opt-in Status Check:** Verify if the user previously enabled biometric login for their account.
3. **Auto-Trigger BiometricPrompt:**
   - Display Android OS native `BiometricPrompt` with title `"Cecilian Biometric Access"`, subtitle `"Verify Fingerprint or Face"`, and `"Sign in with Password"` fallback button.
4. **Token Exchange:**
   - On success, decrypt the refresh token from Android Keystore via `NativeBiometric.getCredentials()`.
   - Call backend `POST /api/auth/refresh` to validate the refresh token and exchange it for a fresh access token and verified user profile.
   - Navigate directly to the Alumni Dashboard without asking for password entry.
5. **Fallback:** If canceled, failed, or device locked, smoothly present the standard email/password form with instant access.

---

## 2. Proposed File Changes & Implementations

### A. Backend Route & Token Infrastructure (`server.ts`)
- **Dual-Token Issuance in `/api/auth/login`:**
  - In addition to standard session tokens, generate a secure, cryptographically signed refresh token (`refreshToken`) with 30-day longevity and specific refresh token scope.
  - Return `{ token, accessToken, refreshToken, sessionId, user }`.
- **New Token Refresh Endpoint (`POST /api/auth/refresh`):**
  - Validates cryptographically signed refresh token.
  - Ensures the user account is active, non-suspended, and alumni-authorized.
  - Issues a fresh access token and returns updated session details.
- **Token Invalidation in `/api/auth/logout` & `/api/auth/revoke-biometrics`:**
  - Revokes both active session and associated refresh token on explicit user logout or biometric disabling.

### B. Biometric & Vault Utility Helper (`src/services/biometricAuthService.ts`)
- **Native Android Keystore Vault Management:**
  - `vaultBiometricRefreshToken(userId: string, email: string, refreshToken: string): Promise<boolean>`:
    Uses `NativeBiometric.setCredentials({ server: 'edu.stcecilia.alumni.auth', username: email, password: refreshToken })` guarded by `Capacitor.isNativePlatform()`.
  - `retrieveVaultedRefreshToken(): Promise<{ email: string; refreshToken: string } | null>`:
    Retrieves vaulted credentials safely from native Keystore.
  - `wipeVaultedBiometricCredentials(userId?: string): Promise<boolean>`:
    Calls `NativeBiometric.deleteCredentials()` and removes local device opt-in flags.
- **Hardware & Enrollment Verification:**
  - `isNativeBiometricAvailable(): Promise<{ available: boolean; biometryType: string; error?: string }>`:
    Accurately detects whether biometric hardware is present and enrolled in Android system settings.
- **Native Biometric Prompt Helper:**
  - `promptNativeBiometricUnlock(reason?: string): Promise<{ success: boolean; canceled?: boolean; error?: string }>`:
    Triggers native Android `BiometricPrompt` with localized Cecilian branding and clean fallback.

### C. Alumni Authentication Component (`src/components/auth/AuthPage.tsx`)
- **Post-Login Biometric Opt-in Modal:**
  - When an alumnus successfully signs in on native Android and biometric unlock is not yet active, present an elegant bottom sheet/dialog:
    *"Enable Biometric Quick Sign-in? Touch your fingerprint sensor or use Face Unlock for instant access next time."*
  - If enabled: encrypt and vault the refresh token in Keystore.
  - If skipped: remember choice gracefully without re-nagging.
- **Auto-Prompt on Native Launch:**
  - `useEffect` hook detecting `Capacitor.isNativePlatform() && isBiometricLoginEnabled()`.
  - Auto-triggers native `BiometricPrompt`. On success, automatically invokes the refresh token exchange and logs in directly.
  - "Sign in with Password" button cancels the prompt and exposes the standard login form.
- **Platform Guard (Web Safety):**
  - Pure web browsers bypass native calls completely with zero console errors or missing plugin exceptions.

### D. Settings & User Profile (`src/components/settings/SettingsView.tsx` & `src/context/AlumniContext.tsx`)
- **Profile / Security Toggle:**
  - "Enable Biometric Unlock" toggle in Security & Access settings.
  - Toggling on prompts the user to verify biometrics and stores credentials.
  - Toggling off immediately executes `wipeVaultedBiometricCredentials()`.
- **Session Logout Synchronization:**
  - When user clicks "Log Out" in `AlumniContext.tsx` or `SettingsView.tsx`, also trigger `wipeVaultedBiometricCredentials()` to purge Keystore tokens and prevent unauthorized access if the device is handed off.

---

## 3. Key Design Decisions

1. **Hardware-Backed Android Keystore via Capgo Plugin:**
   `@capgo/capacitor-native-biometric` delegates token storage directly to Android's `KeyStore` and iOS `Keychain`. Plaintext passwords are never stored in `localStorage` or `Preferences`.
2. **Platform Segmentation:**
   Strict isolation via `Capacitor.isNativePlatform()` ensures web users, mobile PWA users, and desktop users enjoy an identical responsive experience without native plugin stub crashes.
3. **Institutional Taste & Micro-Interactions (AGENTS.md):**
   The opt-in modal and biometric trigger UI adhere to St. Cecilia's deep crimson (`#8B181B`) and warm stone aesthetic, featuring Lucide icons (`Fingerprint`, `ScanFace`, `ShieldCheck`), crisp typography, and fluid micro-transitions.

---

## 4. Potential Risks & Mitigations

| Risk | Mitigation |
| :--- | :--- |
| **Plugin call in Web Browser** | Every call to `NativeBiometric` is wrapped in `if (Capacitor.isNativePlatform())` with safe web fallbacks. |
| **Biometrics changed/wiped in OS** | If fingerprint is removed or modified in OS settings, `NativeBiometric.getCredentials()` will throw an invalid key error. The app catches this, purges the invalid vault, and asks for standard password login. |
| **Revoked refresh token** | If refresh token fails validation on the backend (e.g. session terminated on another device), clear device vault and route user to password login with informative toast. |

---

## 5. Verification Plan

1. **Static Analysis & Linting:**
   Run `lint_applet` to verify TypeScript typing across `biometricAuthService.ts`, `server.ts`, `AuthPage.tsx`, and `SettingsView.tsx`.
2. **Build Compilation:**
   Execute `compile_applet` to ensure Vite bundle and Express server compile cleanly.
3. **Functional Workflow Testing:**
   - Web mode verification: sign in with password, ensure no native errors appear.
   - Dual-token exchange: verify `/api/auth/login` returns `accessToken` and `refreshToken`.
   - Refresh flow: verify `/api/auth/refresh` responds with fresh tokens.
   - Settings toggle: verify turning off biometrics cleans up stored state.
