# Automated Employer Verification Module — St. Cecilia's College

## Overview
An automated verification engine designed for St. Cecilia's College corporate industry relations. Verification is automatic when the applicant's work email and company website domain are legitimate and match. Humans only review edge cases.

---

## Architecture & Verification Pipeline

```
[Employer Registration]
        ↓
[Email Token Confirmation] (Single-use, 24h, SHA-256 hashed at rest)
        ↓
[Automated Verification Pipeline]
  1. Work Email Check (rejection of free/disposable providers from config)
  2. Domain Match & Normalization (domain equality or subdomain match; rejection of shared hosting)
  3. Domain Health (RDAP/WHOIS age >= 90 days; HTTP 200 content probe; homoglyph lookalike spoof detection; banned list)
  4. Pluggable Registry Provider (SEC Philippines / DTI fuzzy matching & active entity validation)
        ↓
[Decision Engine]
  - AUTO_VERIFIED: Passes email, domain match, age >= 90d, site reachable, no lookalike, not banned. (Basic tier: max 3 active jobs, daily cap)
  - VERIFIED: Passes baseline + official SEC active registry record match or moderator accreditation. (Full tier: 25 jobs, Verified badge)
  - AUTO_REJECTED: Free/disposable email, banned domain/IP, or dissolved corporate entity.
  - NEEDS_REVIEW: Domain mismatch, new domain (<90d), lookalike suspicion, unreachable site, or registry discrepancy.
```

---

## Configuration Lists
Editable lists are located in `src/server/employerVerification/config/verificationConfig.json`:
- `freeAndDisposableDomains`: Consumer and temporary email providers (`gmail.com`, `yahoo.com`, `mailinator.com`, etc.)
- `sharedHostingDomains`: Shared hosting subdomains (`wixsite.com`, `blogspot.com`, `github.io`, etc.)
- `knownBrands`: Protected brand names used for homoglyph and Levenshtein edit distance spoof detection.
- `bannedDomains`: Blacklisted malicious or fraudulent domains.

---

## Pluggable Registry Providers
New registry providers implement the `IRegistryProvider` interface:
```typescript
export interface IRegistryProvider {
  readonly providerName: string;
  readonly countryCode: string; // ISO 3166-1 alpha-2, e.g. "PH", "US", "GB"
  queryCompany(legalName: string, registrationNumber?: string): Promise<RegistryQueryResult>;
}
```
The active provider for the Philippines is `SecPhilippinesRegistryProvider`.

---

## Safeguards & Content Filters
- **Job Post Filter**: Automatically blocks upfront payment requests, Telegram/WhatsApp-only contact details, and personal free emails (`POST /api/jobs/validate`).
- **Auto-Suspension**: Any job receiving 3 reports from distinct verified accounts automatically suspends the employer and moves it back to `NEEDS_REVIEW` (`POST /api/jobs/:id/report`).
- **Domain Multi-User Routing**: The first verified user under a corporate domain becomes the `Company Admin`. Subsequent signups are queued as join requests requiring approval from that company admin.

---

## Running Automated Tests
```bash
npx vitest run tests/employerVerification.test.ts
```
