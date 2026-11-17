# Database Security, Verification Lifecycle & Account Deletion Reliability

Upgrade the Cecilian Alumnet platform so all credentials, PINs, and verification tokens are cryptographically hashed, sensitive personally identifiable information (PII) is encrypted at rest, rejected and stale pending verification records follow strict privacy-preserving retention lifecycles, and server-side account deletion succeeds reliably without error.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural decisions were confirmed during clarification and govern this implementation:

- **Confirmed Decision 1 — Full Cryptographic Hashing & PII Encryption**: Hash all passwords, emergency/campus PINs, and verification tokens using salted cryptographic algorithms, and encrypt sensitive PII fields at rest. No plaintext passwords or raw PINs will be written to client storage, server disk stores, or cloud database vaults.
- **Confirmed Decision 2 — Rejected Account & Verification Data Lifecycle**: Upon rejection (employer accreditation, alumni verification conflict, or registration review), immediately purge all submitted personal data, uploaded proof documents, and credentials, retaining only an anonymized cryptographic block record (hashed identifiers + rejection timestamp + administrative reason) to prevent spam or unauthorized re-application.
- **Confirmed Decision 3 — 30-Day Pending Verification Auto-Expiration**: Pending alumni registrations, pending employer applications, and unresolved verification conflicts automatically expire and purge their submitted personal data and proof artifacts after 30 days without approval, freeing unclaimed non-rejected identifiers for fresh verification.

---

## 1. Overview & Core Concept

- **What It Does**: Establishes defense-in-depth data protection across authentication vaults, user profiles, and institutional verification pipelines while enforcing automated data-minimization rules for unapproved accounts and resolving the server-side account deletion failure.
- **Target Audience / Persona**: Alumni members, corporate employer applicants, institutional registrars, and Super Administrators managing identity verification and account governance.
- **Key Value**: Eliminates plaintext secret exposure and indefinite retention of unverified personal data, enforces predictable institutional privacy compliance, and guarantees clean end-to-end account deletion across client, server API, and cloud database layers.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  - **Authentication & PIN Verification**: Users continue signing in with passwords or unlocking with their emergency PIN seamlessly; verification compares submitted secrets against salted hashes asynchronously without exposing plaintext values in browser vaults or cloud records.
  - **Rejected Verification Handling**: When an administrator declines an application with a mandatory reason, personal details and proof uploads are wiped while a lightweight anonymized block entry prevents duplicate spam submissions using the same email, company name, or claimed identifier, presenting a clear, informative notice if re-submission is attempted.
  - **Pending Verification Expiration**: Applicants waiting longer than 30 days see their stale request expire and purge cleanly; if they return later, they are guided to submit a fresh registration rather than leaving personal documents sitting indefinitely in review queues.
  - **Account Deletion Recovery**: Administrators and account owners trigger deletion cleanly from user management or settings, receiving an accurate single confirmation notice as the server, local caches, and cloud database remove authored content and tombstone the deleted identity without triggering `"Failed to delete account on server."`.
- **Visual Identity & Theme**: Preserves St. Cecilia's College institutional palette (`--primary` deep crimson, warm stone neutrals in light mode, balanced charcoal surfaces in dark mode) and clean typographic hierarchy with zero unrequested UI widgets or telemetry clutter.
- **Interactive Feedback & Motion**: Single concise status toasts confirm deletion, rejection purge, or expiration cleanup; server-side deletion errors surface specific diagnostic reasons if an actual permission or protection constraint blocks the action rather than a generic failure fallback.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1 — Dual-Layer Cryptography (Salted Hashing + Authenticated Encryption)**:
  - *Chosen Approach*: Use PBKDF2-SHA512 on the server and Web Crypto PBKDF2-SHA256 on the client for passwords and PINs; HMAC-SHA256 for single-use verification tokens and anonymized block fingerprints; and AES-256-GCM authenticated encryption for PII at rest (`phone`, `homeAddress`, `birthday`, `guardianName`, verification proof payloads).
  - *Why*: Hashing is irreversible for authentication secrets and deduplication fingerprints, whereas authorized profile views (`self`, `admin`, `superadmin`, `registrar`) require reversible decryption of PII without exposing readable fields in raw database snapshots.
  - *Alternatives Considered*: Hashing only passwords without PII encryption (rejected because user profiles and verification queues still store readable personal details at rest) or client-only obfuscation (rejected as cryptographically weak).
- **Decision 2 — Anonymized Block Fingerprint on Rejection vs. Soft-Flagged Profile**:
  - *Chosen Approach*: Strip PII and proof URLs immediately upon rejection and move enforcement into an indexed anonymized block record storing keyed HMAC digests of the rejected email, normalized company name, or claimed identifier alongside audit metadata.
  - *Why*: Enforces anti-abuse blocks while complying with data minimization so rejected applicants' personal files and contact details are never retained.
  - *Alternatives Considered*: Keeping full rejected profile rows hidden in the directory (rejected because sensitive registration documents remain stored indefinitely).
- **Decision 3 — Automated 30-Day Expiration Sweep (Server + Client Sync)**:
  - *Chosen Approach*: Attach a `verificationExpiresAt` timestamp (`submittedAt + 30 days`) to every pending alumni account, pending employer application, and pending conflict record, evaluated both on a periodic server sweep and during directory/login hydration.
  - *Why*: Ensures expired pending data is purged reliably even if an administrator has not opened the review panel recently.
  - *Alternatives Considered*: Manual-only cleanup by administrators (rejected because stale pending records accumulate silently).
- **Decision 4 — Hardening Server Account Deletion & CSRF/Session Alignment**:
  - *Chosen Approach*: Fix the server profile-deletion path so valid administrative and self-delete requests reconcile session authentication, CSRF token retrieval/retry, target profile lookup, and role authorization consistently, while wrapping persistence writes safely and exposing clear structured JSON responses.
  - *Why*: Prevents spurious 403/500/non-JSON responses between the client deletion helper and backend moderation router that trigger `"Failed to delete account on server."`.
  - *Alternatives Considered*: Ignoring non-401/404 server errors on the client (rejected because real server state and credentials store would go out of sync with Firestore).

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                     CLIENT & CLOUD PERSISTENCE LAYER                       │
│                                                                            │
│  Login / PIN / Profile Forms ──► Client Crypto Utility (Web Crypto API)   │
│                                   ├─ Passwords & PINs: PBKDF2-SHA256 Hash │
│                                   └─ No plaintext secrets in Vault / Cloud │
│                                                                            │
│  Account Lifecycle Coordinator ──► Authenticated API Client (CSRF + Token) │
└───────────────────────────────┬──────────────────────────┬─────────────────┘
                                │ HTTPS + Bearer + CSRF    │ Firestore SDK
                                ▼                          ▼
┌───────────────────────────────────────────┐   ┌────────────────────────────┐
│        BACKEND SECURITY & API LAYER       │   │   CLOUD FIRESTORE RULES    │
│                                           │   │                            │
│  Auth & CSRF Guard ──► Profile Router     │   │ • Reject plaintext secret  │
│        │                    │             │   │   fields in user vaults    │
│        ▼                    ▼             │   │ • Isolate private security │
│  Server Crypto Module   Lifecycle Engine  │   │   & anonymized block store │
│  • PBKDF2-SHA512        • Delete & Purge  │   └────────────────────────────┘
│  • HMAC Token Digests   • Rejection Purge │
│  • AES-256-GCM PII      • 30-Day Sweeper  │
└───────────────────────────────────────────┘
```

- **Account Lifecycle State Machine**:

```text
                    ┌──────────────────────────────┐
                    │     SUBMITTED / PENDING      │
                    │ (verificationExpiresAt: +30d)│
                    └───────┬──────────────┬───────┘
                            │              │
         Approved           │              │  30 Days Elapsed (Unreviewed)
    ┌───────────────────────┘              └────────────────────────┐
    ▼                                                               ▼
┌────────┐         Rejected w/ Reason         ┌──────────────────────────────┐
│ ACTIVE │ ◄──x─── (Employer / Verification)  │   EXPIRED & AUTO-PURGED      │
└────┬───┘                 │                  │ • Personal data & docs wiped │
     │                     ▼                  │ • Claim released for retry   │
     │      ┌──────────────────────────────┐  └──────────────────────────────┘
     │      │    REJECTED & ANONYMIZED     │
     │      │ • PII & proof URLs purged    │
     │      │ • Keyed hash block retained  │
     │      │   (email / company / claim)  │
     │      └──────────────────────────────┘
     │
     │ Self-Delete or Superadmin/Admin Delete
     ▼
┌──────────────────────────────────────────────────────────┐
│                SOFT-DELETED TOMBSTONE                    │
│ • Server & cloud credentials revoked and wiped           │
│ • All authored posts, comments, and reactions purged     │
│ • Registrar ID claim released for fresh re-verification  │
│ • Anonymized security audit entry preserved              │
└──────────────────────────────────────────────────────────┘
```

- **Data Model & State**:
  - **Hashed Credential & PIN Records**: Store `{ hash, salt, algorithm, iterations, version }` instead of plaintext passwords or PIN strings; transparent verification upgrades legacy records to salted hashes on login.
  - **Encrypted PII Envelope**: Sensitive user profile fields and verification metadata are wrapped as versioned AES-256-GCM ciphertexts (`{ iv, tag, ciphertext, v }`) with server-controlled key derivation and authorized decryption boundaries.
  - **Anonymized Rejection Block Records**: Minimal records containing `{ id, emailHash, companyHash, identifierHash, reason, rejectedAt, rejectedByRole, status: 'REJECTED' }` with zero plaintext personal data or uploaded files.
  - **Verification Expiration Metadata**: Pending accounts and verification conflict items store `verificationSubmittedAt` and `verificationExpiresAt` (`+30 days`), enabling deterministic expiration sweeps.
- **Interactive Component & State Mapping**:
  - *Delete Account Flow*: User or Superadmin confirms deletion -> API client ensures fresh session & CSRF token -> backend `DELETE` handler verifies authorization, gracefully resolves or creates missing target profile stubs before tombstoning, deletes credentials/sessions atomically, and returns structured JSON `{ success: true }` -> client updates Firestore tombstone, purges authored posts/comments, and shows a single confirmation toast.
  - *Rejection Flow*: Admin submits valid rejection reason -> server & client mark status `REJECTED`, purge PII/proof URLs/credentials, write anonymized HMAC block record, close related jobs/conflicts, and record an anonymized governance audit log.
  - *30-Day Expiration Sweep*: Scheduled server timer and startup/hydration pass scan pending records where `now >= verificationExpiresAt`, expire and wipe personal/proof payloads, release non-rejected registrar claims, and log an anonymized expiration audit event.
