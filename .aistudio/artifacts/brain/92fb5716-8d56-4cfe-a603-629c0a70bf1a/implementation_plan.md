# Fix 'currentUser' Undefined Exception in AlumniContext & Firebase

Resolves the `TypeError: Cannot read properties of undefined (reading 'currentUser')` caught by the Session Recovery Shield on application startup.

## User Review & Critical Decisions

> [!IMPORTANT]
> The diagnostic error in the uploaded screenshot explicitly identifies:
> `TypeError: Cannot read properties of undefined (reading 'currentUser')`
> 
> This error occurred during the initial mounting of `AlumniProvider` when accessing `auth.currentUser` while the Firebase Auth instance was null/undefined (e.g., during offline startup or before Firebase initializes).

- **Confirmed Decision 1**: Apply optional chaining `auth?.currentUser ?? null` in `src/context/AlumniContext.tsx` on line 1269 so `firebaseUser` safely defaults to `null` if Firebase Auth is uninitialized.
- **Confirmed Decision 2**: Guard all references in `src/lib/firebase.ts` (lines 169–178) with `auth?.currentUser?.uid`, `auth?.currentUser?.email`, etc., so Firestore error handling never throws an unhandled exception.
- **Confirmed Decision 3**: Ensure `JobApplicationModal.tsx` and all modal components safely handle `...(currentUser || {})` spreads when `currentUser` is null or in transitional state.

---

## 1. Overview & Root Cause Analysis

- **Root Cause**: In `src/context/AlumniContext.tsx` line 1269:
  ```typescript
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(() => auth.currentUser);
  ```
  `auth` is exported as `authInstance` from `src/lib/firebase.ts`. When the app loads in a sandbox, offline, or before the Firebase SDK completes initialization, `auth` is `undefined`. Accessing `auth.currentUser` throws `TypeError: Cannot read properties of undefined (reading 'currentUser')` on the initial React render pass.
- **Solution**: Safely resolve `auth?.currentUser ?? null` with full null-safety across all auth references.

---

## 2. Technical Architecture & File Changes

```
┌────────────────────────────────────────────────────────┐
│                   AlumniProvider Mount                 │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
          [Initial State Evaluation (Line 1269)]
                           │
       ┌───────────────────┴───────────────────┐
       ▼                                       ▼
  (Before Fix: CRASH)                     (After Fix: SAFE)
  auth.currentUser                        auth?.currentUser ?? null
  ❌ TypeError: Cannot read               ✅ Returns null safely,
     properties of undefined                 renders landing/portal
```

### Files to Modify:
1. `src/context/AlumniContext.tsx`:
   - Change line 1269 to `const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(() => auth?.currentUser || null);`.
   - Ensure `auth` null checks guard all Firebase Auth event listeners.
2. `src/lib/firebase.ts`:
   - Update `handleFirestoreError` lines 168–178 to use `auth?.currentUser?.` optional chaining.
3. `src/components/opportunities/JobApplicationModal.tsx`:
   - Safely guard candidate object spread `...(currentUser || {})`.
