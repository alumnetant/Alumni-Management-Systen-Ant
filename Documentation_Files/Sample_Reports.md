# E.4 Sample Reports

**Institution:** St. Cecilia's College - Cebu, Inc.  
**System Title:** AlumNet: A Web and Mobile-Based Alumni Networking and Tracer System  
**Document Section:** Appendix E.4 — Proposed Sample Reports & System Generated Outputs  

---

## Overview

The proposed **AlumNet** platform replaces manual, paper-bound ledgers and fragmented spreadsheets with automated, verifiable, and real-time analytical reports. These reports serve institutional administrators, the College Registrar, the Alumni Relations Office, accreditation evaluators (such as CHED, DepEd, and PACUCOA), and accredited industry partners.

Below are the high-fidelity mockups, interface captures, and structured data outputs for the proposed system's four primary analytical modules:
1. **Figure 32.1. Proposed Sample Report – 1:** Live Graduate Tracer & Alumni Employment Demographics Analytics Dashboard
2. **Figure 32.2. Proposed Sample Report – 2:** Real-Time Event Attendance & Contactless QR Check-In Audit Log (with Scanner Verification Modal)
3. **Figure 32.3. Proposed Sample Report – 3:** Corporate Recruitment & In-App Applicant Tracking System (ATS) Pipeline Report
4. **Figure 32.4. Proposed Sample Report – 4:** Registrar Masterlist Cross-Matching & Identity Conflict Resolution Audit Log

---

## Figure 32.1. Proposed Sample Report – 1
### Live Graduate Tracer & Alumni Employment Demographics Analytics Dashboard

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  ST. CECILIA'S COLLEGE - CEBU, INC.  │  ALUMNET ADMIN PORTAL                        [ Admin: Dr. M. Abellana ]│
├─────────────────┬──────────────────────────────────────────────────────────────────────────────────────┤
│ NAVIGATION      │  GRADUATE TRACER & EMPLOYMENT DEMOGRAPHICS (LIVE REPOSITORY)                         │
│                 │  Reporting Period: Batches 2018 - 2025  •  Filter: All Academic Programs  •  Live    │
│ • Overview      ├──────────────────────────────────────────────────────────────────────────────────────┤
│ • Alumni Directory│  KEY EMPLOYMENT BENCHMARKS (N = 2,267 Traced Graduates / 91.41% Response Rate)     │
│ ► Graduate Tracer│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐│
│ • Events & Passes│  │ TOTAL VERIFIED    │  │ EMPLOYED RATE    │  │ FULL-TIME WORK   │  │ SEEKING WORK ││
│ • Career Hub/ATS │  │ 2,480             │  │ 91.44%           │  │ 1,742 (76.84%)   │  │ 116 (5.12%)  ││
│ • Disputes Queue │  │ Enrolled Alumni   │  │ CHED Standard    │  │ Permanent / Reg. │  │ Active Hunt  ││
│ • Security Logs  │  └──────────────────┘  └──────────────────┘  └──────────────────┘  └──────────────┘│
│                 ├──────────────────────────────────────────────────────────────────────────────────────┤
│                 │  EMPLOYMENT DISTRIBUTION BY ACADEMIC DEGREE PROGRAM                                  │
│                 │  ┌───────────────────────────────────┬────────┬──────────┬─────────────┬───────────┐│
│                 │  │ Program Title                     │ Traced │ Employed │ Placement % │ Avg Time  ││
│                 │  ├───────────────────────────────────┼────────┼──────────┼─────────────┼───────────┤│
│                 │  │ BS Information Technology         │  680   │   642    │   94.41%    │ 1.8 Mos   ││
│                 │  │ BS Computer Science               │  412   │   391    │   94.90%    │ 1.5 Mos   ││
│                 │  │ BS Business Administration        │  498   │   446    │   89.56%    │ 2.7 Mos   ││
│                 │  │ BS Hospitality Management         │  382   │   338    │   88.48%    │ 3.1 Mos   ││
│                 │  │ Bachelor of Secondary Education   │  295   │   256    │   86.78%    │ 2.9 Mos   ││
│                 │  └───────────────────────────────────┴────────┴──────────┴─────────────┴───────────┘│
│                 │                                                                                      │
│                 │  TOP EMPLOYING INDUSTRY SECTORS                      QUICK ACTION CONTROLS           │
│                 │  1. IT & Software Engineering    (38.2% - 866)       [ Export CHED Tracer PDF ]     │
│                 │  2. Business Process Outsourcing (22.1% - 501)       [ Download CSV Data Sheet]     │
│                 │  3. Banking, Finance & Corporate (14.6% - 331)       [ Generate PACUCOA Summary ]   │
└─────────────────┴──────────────────────────────────────────────────────────────────────────────────────┘
```
**Figure 32.1. Proposed Sample Report – 1**  
*Description:* The automated Graduate Tracer & Employment Analytics Dashboard aggregates continuous real-time alumni profile updates into institutional metrics, showing an overall employability rate of 91.44%, degree-to-career alignment indexes, and program-by-program placement benchmarks ready for CHED accreditation.

---

## Figure 32.2. Proposed Sample Report – 2
### Real-Time Event Attendance & Contactless QR Check-In Audit Log

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  ST. CECILIA'S COLLEGE - CEBU, INC.  │  EVENT ADMISSION & SCANNER CONTROL          [ Marshal: Prof. Cabarrubias ]│
├─────────────────┬──────────────────────────────────────────────────────────────────────────────────────┤
│ NAVIGATION      │  EVENT: CECILIAN GRAND ALUMNI HOMECOMING & EXCELLENCE AWARDS 2026                    │
│                 │  Venue: SCC Auditorium Complex • Date: Oct 24, 2026 • Real-Time Gate Sync: ACTIVE    │
│ • Overview      ├──────────────────────────────────────────────────────────────────────────────────────┤
│ • Alumni Directory│  ATTENDANCE RECONCILIATION SUMMARY                                                 │
│ • Graduate Tracer│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐│
│ ► Events & Passes│  │ TOTAL CAPACITY    │  │ CONFIRMED RSVPS  │  │ SCANNED CHECK-INS│  │ BLOCKED DUPES││
│ • Career Hub/ATS │  │ 600 Seats         │  │ 588 (98.0%)      │  │ 564 (95.9% Turn) │  │ 01 Intercept││
│ • Disputes Queue │  └──────────────────┘  └──────────────────┘  └──────────────────┘  └──────────────┘│
│ • Security Logs  ├──────────────────────────────────────────────────────────────────────────────────────┤
│                 │  CHRONOLOGICAL SCANNER LOG WITH TICKET VERIFICATION MODAL                            │
│                 │  ┌────────────────────────────────────────────────────────────────────────────────┐ │
│                 │  │                           TICKET VERIFICATION POPUP                            │ │
│                 │  │  ┌──────────────────────────────────────────────────────────────────────────┐  │ │
│                 │  │  │  STATUS: VALIDATED ENTRY (GREEN)      SCANNER GATE: GATE 1               │  │ │
│                 │  │  │  Ticket UUID: a71e-0192-bc-88          Timestamp: 05:12:04 PM PHT        │  │ │
│                 │  │  │  Attendee:    ABARCA, JOHN CHRISTIAN P.  Program: BSIT - Batch 2023     │  │ │
│                 │  │  │  Pass Type:   VIP Alumni Seat #42        Security Hash: SHA256-OK       │  │ │
│                 │  │  └──────────────────────────────────────────────────────────────────────────┘  │ │
│                 │  └────────────────────────────────────────────────────────────────────────────────┘ │
│                 │                                                                                      │
│                 │  RECENT SCAN ACTIVITY LOG:                                                           │
│                 │  • 05:14:19 PM - ALIMPOOS, MA. ANGELICA S.    [BSIT-2023]  GATE 2 - VALIDATED         │
│                 │  • 05:18:44 PM - CABALLERO, KEITH VINCENT T.  [BSIT-2023]  GATE 1 - VALIDATED         │
│                 │  • 05:25:30 PM - DELA CRUZ, MARK ANTHONY B.   [BSIT-2023]  GATE 1 - [DUPLICATE BLOCKED]│
│                 │  • 05:31:02 PM - ENRIQUEZ, PATRICIA MAE C.    [BSIT-2023]  GATE 2 - VALIDATED         │
└─────────────────┴──────────────────────────────────────────────────────────────────────────────────────┘
```
**Figure 32.2. Proposed Sample Report – 2**  
*Description:* The Contactless QR Check-In Audit Log monitors venue entries in real time, displaying scan timestamps, ticket validation statuses, and automatic duplicate scan prevention. The modal demonstrates instant ticket resolution with attendee credentials and cryptographic verification.

---

## Figure 32.3. Proposed Sample Report – 3
### Corporate Recruitment & In-App Applicant Tracking System (ATS) Pipeline Report

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  ST. CECILIA'S COLLEGE - CEBU, INC.  │  CAREER CENTER & EMPLOYER ATS              [ Corporate HR: Lexmark ]│
├─────────────────┬──────────────────────────────────────────────────────────────────────────────────────┤
│ NAVIGATION      │  RECRUITMENT PIPELINE & CANDIDATE EVALUATION DASHBOARD                               │
│                 │  Company: Lexmark R&D Corp. • Active Openings: 12 • Total Applications: 142         │
│ • Overview      ├──────────────────────────────────────────────────────────────────────────────────────┤
│ • Alumni Directory│  HIRING FUNNEL CONVERSION BENCHMARKS                                               │
│ • Graduate Tracer│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐│
│ • Events & Passes│  │ RECEIVED          │  │ UNDER REVIEW     │  │ SHORTLISTED      │  │ HIRED ALUMNI ││
│ ► Career Hub/ATS │  │ 142 Candidates    │  │ 98 Candidates    │  │ 34 Assessment    │  │ 18 Accepted  ││
│ • Disputes Queue │  │ 100% Verified Res.│  │ 69.0% Retention  │  │ 23.9% Conversion │  │ 12.7% Hire   ││
│ • Security Logs  │  └──────────────────┘  └──────────────────┘  └──────────────────┘  └──────────────┘│
│                 ├──────────────────────────────────────────────────────────────────────────────────────┤
│                 │  CANDIDATE DOSSIER INSPECTION MODAL                                                  │
│                 │  ┌────────────────────────────────────────────────────────────────────────────────┐ │
│                 │  │  CANDIDATE: ENRIQUEZ, PATRICIA MAE C.     MATCH ALGORITHM SCORE: 96% MATCH     │ │
│                 │  │  Degree: BS Information Technology (2023)  Target Role: Cloud Infrastructure   │ │
│                 │  │  Contact: 0917-882-9011                   Certified PDF Resume: Attached (PDF) │ │
│                 │  │  Skill Badges: React, TypeScript, Docker, Firebase, REST APIs, Git Governance  │ │
│                 │  │  Recruiter Action: [ Shortlist Candidate ]  [ Schedule Interview ]  [ Extend Offer ]│ │
│                 │  └────────────────────────────────────────────────────────────────────────────────┘ │
│                 │                                                                                      │
│                 │  PARTNER PERFORMANCE SUMMARY:                                                        │
│                 │  Average Time-to-Hire: 14.2 Days (vs. 45+ Days Manual Paper Placement)               │
│                 │  Candidate Status Notification: Automatic Real-Time Web Push Alerts Dispatched       │
└─────────────────┴──────────────────────────────────────────────────────────────────────────────────────┘
```
**Figure 32.3. Proposed Sample Report – 3**  
*Description:* The Corporate Recruitment & Applicant Tracking System (ATS) Dashboard gives accredited hiring partners direct visibility over job applications submitted by Cecilian graduates, featuring candidate scoring, resume inspection, and pipeline stage management.

---

## Figure 32.4. Proposed Sample Report – 4
### Registrar Masterlist Cross-Matching & Identity Conflict Resolution Audit Log

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  ST. CECILIA'S COLLEGE - CEBU, INC.  │  REGISTRAR TRIAGE & SECURITY AUDIT       [ Registrar: Mrs. Alensonorin ]│
├─────────────────┬──────────────────────────────────────────────────────────────────────────────────────┤
│ NAVIGATION      │  IDENTITY VERIFICATION & CONFLICT RESOLUTION DESK                                    │
│                 │  Masterlist Repository: 6,420 Enrolled Records • Registrations Evaluated: 2,514       │
│ • Overview      ├──────────────────────────────────────────────────────────────────────────────────────┤
│ • Alumni Directory│  VERIFICATION HEALTH & AUDIT METRICS                                               │
│ • Graduate Tracer│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐│
│ • Events & Passes│  │ AUTO-VERIFIED    │  │ NAME TYPOS       │  │ ID COLLISIONS    │  │ RESOLUTION % ││
│ • Career Hub/ATS │  │ 2,422 (96.34%)   │  │ 68 Flagged       │  │ 24 Disputed      │  │ 100% Resolved││
│ ► Disputes Queue │  │ Instant Match    │  │ Manual Review    │  │ Duplicate Claims │  │ Zero Backlog ││
│ • Security Logs  │  └──────────────────┘  └──────────────────┘  └──────────────────┘  └──────────────┘│
│                 ├──────────────────────────────────────────────────────────────────────────────────────┤
│                 │  TRIAGE QUEUE & IMMUTABLE RESOLUTION AUDIT TRAIL                                     │
│                 │  ┌────────────┬──────────────┬─────────────────────────┬───────────────────────────┐│
│                 │  │ Case ID    │ Student ID   │ Claimant & Contact      │ Action & Timestamp        ││
│                 │  ├────────────┼──────────────┼─────────────────────────┼───────────────────────────┤│
│                 │  │ DISP-26-01 │ SC-2019-0511 │ QUIJANO, JESSICA ANN B. │ APPROVED (M.I. Typo Fixed)││
│                 │  │            │              │ 0917-889-1120           │ Oct 12, 2026 09:14 AM PHT ││
│                 │  │ DISP-26-02 │ SC-2020-0192 │ TAN, GERALD EMMANUEL C. │ APPROVED (Duplicate Block)││
│                 │  │            │              │ 0922-334-9011           │ Oct 19, 2026 11:30 AM PHT ││
│                 │  │ DISP-26-03 │ SC-2018-0914 │ RAMOS, CATHERINE JOY M. │ APPROVED (Summer Term Rec)││
│                 │  │            │              │ 0918-552-3341           │ Oct 28, 2026 14:22 PM PHT ││
│                 │  │ DISP-26-04 │ SC-2021-9981 │ ALCANTARA, ROBERTO F.   │ REJECTED & DISABLED       ││
│                 │  │            │              │ 0998-112-4450           │ Nov 04, 2026 16:05 PM PHT ││
│                 │  └────────────┴──────────────┴─────────────────────────┴───────────────────────────┘│
│                 │  AUDIT ATTESTATION: Dual authorization required; all entries committed to Firestore │
└─────────────────┴──────────────────────────────────────────────────────────────────────────────────────┘
```
**Figure 32.4. Proposed Sample Report – 4**  
*Description:* The Registrar Dispute & Verification Audit Log provides an unalterable security audit trail of all student ID claims, registrar discrepancies, duplicate account collisions, and moderator resolutions in compliance with institutional data governance standards.
