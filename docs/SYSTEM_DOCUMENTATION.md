# St. Cecilia's College - Cebu, Inc.
## Alumnet Platform: System Documentation, ERD, and Formal Use Case Narratives
**Document Version:** 2.6.0  
**Classification:** Enterprise Academic & Alumni Governance System  
**Institution:** St. Cecilia's College - Cebu, Inc. (Poblacion Ward II, Minglanilla, Cebu, Philippines)  
**System Architecture:** React 19 SPA • TypeScript • Tailwind CSS • Node.js/Express • Firestore NoSQL / Web Crypto Vault

---

## Table of Contents
1. [Executive Summary & System Boundary](#1-executive-summary--system-boundary)
2. [Actors, Features, and Task Matrix](#2-actors-features-and-task-matrix)
3. [Entity-Relationship Diagram (ERD) in Draw.io XML](#3-entity-relationship-diagram-erd-in-drawio-xml)
4. [System Use Case Diagram (SVG & Draw.io XML)](#4-system-use-case-diagram-svg--drawio-xml)
5. [Formal Cockburn Use Case Narratives](#5-formal-cockburn-use-case-narratives)
   - [UC-01: Authenticate Session via PBKDF2 Vault & WebAuthn Biometrics](#uc-01-authenticate-session-via-pbkdf2-vault--webauthn-biometrics)
   - [UC-02: Security Audit Logging & Suspicious Multi-User Detection](#uc-02-security-audit-logging--suspicious-multi-user-detection)
   - [UC-03: Administrative Account Suspension & Lock Scheduler](#uc-03-administrative-account-suspension--lock-scheduler)
   - [UC-04: Student Academic Record Clearance & Degree Certification](#uc-04-student-academic-record-clearance--degree-certification)
   - [UC-05: Generate & Flip Signature Digital Alumni ID](#uc-05-generate--flip-signature-digital-alumni-id)
   - [UC-06: Publish, React, Edit, and Moderate Campus Feed Posts](#uc-06-publish-react-edit-and-moderate-campus-feed-posts)
   - [UC-07: Search Verified Alumni Directory & Connect](#uc-07-search-verified-alumni-directory--connect)
   - [UC-08: Initiate Gated Direct Messaging with Sticky Header](#uc-08-initiate-gated-direct-messaging-with-sticky-header)
   - [UC-09: Corporate Employer Accreditation & Opportunity Posting](#uc-09-corporate-employer-accreditation--opportunity-posting)
   - [UC-10: Apply for Job Vacancy & Generate Verified PDF Resume](#uc-10-apply-for-job-vacancy--generate-verified-pdf-resume)
   - [UC-11: Schedule Campus Homecoming Events & Confirm RSVPs](#uc-11-schedule-campus-homecoming-events--confirm-rsvps)
   - [UC-12: Broadcast Bulletins & Dispatch Web Push Alerts](#uc-12-broadcast-bulletins--dispatch-web-push-alerts)
   - [UC-13: Superadministrator Governance & Administrator Protection](#uc-13-superadministrator-governance--administrator-protection)
   - [UC-14: Automated Account Restoration Daemon](#uc-14-automated-account-restoration-daemon)

---

## 1. Executive Summary & System Boundary

**St. Cecilia's College - Cebu, Inc. Alumnet** is an institutional digital ecosystem that unifies alumni engagement, career placement, registrar clearance verification, institutional bulletins, event coordination, and administrative security governance.

Following institutional governance optimization, **all academic registrar, logistics, and staff responsibilities are consolidated under the Institutional Moderator (`moderator`)**. The five official human user roles are:
1. **Alumni (`alumni`)**
2. **Employer Partner (`employer`)**
3. **Institutional Moderator (`moderator`)** (Consolidates Registrar, Faculty, and Staff duties)
4. **System Administrator (`admin`)**
5. **Superadministrator (`superadmin`)**

In addition, an **Automated Security Engine (`System Daemon`)** continuously evaluates session telemetry, enforces concurrent login detection, and executes scheduled suspension expirations.

---

## 2. Actors, Features, and Task Matrix

| Actor | Functional Scope | Key Tasks & Operations | Permissions & Governance |
| :--- | :--- | :--- | :--- |
| **Alumni Member** (`alumni`) | Community, Career, Identity | • Authenticate via PBKDF2 password or WebAuthn Biometrics<br>• Access and flip Digital Alumni ID with security QR code<br>• Query verified alumni directory by course, batch, and name<br>• Send connection requests and chat with connected peers<br>• Publish milestones to feed, heart posts, edit/delete own posts<br>• Browse verified jobs and export official institutional PDF resume<br>• RSVP to campus homecoming events and subscribe to circulars | • Profile creation & update<br>• Restricted to connected peer messaging<br>• Mobile app access enabled<br>• Strictly prohibited from posting jobs or administrative circulars |
| **Employer Partner** (`employer`) | Career Placement & Recruitment | • Submit corporate accreditation credentials (Web only)<br>• Manage company profile and industry affiliations<br>• Post, edit, and close job vacancies and internships<br>• Review alumni applicant dossiers and download certified PDF resumes<br>• Message verified applicants directly | • Access to Employer Dashboard<br>• Job posting enabled upon accreditation approval<br>• Mobile employer registration disabled to preserve accreditation vetting |
| **Institutional Moderator** (`moderator`) | Academic Clearance, Events, Circulars, Moderation | • Audit graduation masterlists and verify Student IDs (`YYYY-NNNNN`)<br>• Approve or reject alumni degree verification requests<br>• Issue digital alumni verification clearance badges<br>• Publish official collegiate bulletins and emergency circulars<br>• Create and coordinate campus homecoming and webinar events<br>• Moderate alumni feed contributions and delete inappropriate comments<br>• Manage regional chapter listings and heritage gallery | • Inherits all previous Registrar & Staff operational authorities<br>• Access to Academic Registry & Verification queues<br>• Announcement & Event publication permissions<br>• Feed moderation powers |
| **System Administrator** (`admin`) | Security & Account Lifecycle | • Inspect real-time Security & Audit Logs with status badges<br>• Investigate `MULTIPLE_USERS_SAME_ACCOUNT` alerts<br>• Execute temporary account suspensions with mandatory reasons<br>• Apply permanent locks to compromised accounts<br>• Extend suspensions or restore accounts with audit trail notes<br>• Review employer accreditation requests<br>• Manage user accounts (except deleting peer administrators) | • Access to Security & Audit Log views<br>• Full Account Suspension Scheduler<br>• Cannot delete `admin` or `superadmin` accounts<br>• Cannot modify superadmin records |
| **Superadministrator** (`superadmin`) | Root Institutional Authority | • All Administrator and Moderator capabilities<br>• Promote or demote users between Moderator, Admin, and Superadmin<br>• Permanently delete administrative member accounts<br>• Configure system-wide governance, data retention, and backup policies<br>• Audit root security logs and system credentials | • Supreme system authority<br>• Exclusive permission to delete administrator accounts<br>• Full cryptographic vault access |
| **Security Engine** (`System Daemon`) | Automated Threat & Scheduler Engine | • Evaluate concurrent active sessions for account sharing<br>• Flag `MULTIPLE_USERS_SAME_ACCOUNT` when conflicting telemetry arrives<br>• Monitor failed login counts and trigger lockouts on 5 attempts<br>• Evaluate scheduled suspension end dates and auto-restore accounts | • Automated autonomous execution<br>• Writes immutable security audit records<br>• Dispatches Web Push alerts to administrators |

---

## 3. Entity-Relationship Diagram (ERD) in Draw.io XML

### 3.1 Relational Architecture Specification

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                   ST. CECILIA'S COLLEGE ALUMNET - ENTITY ARCHITECTURE                  │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│  [USERS] 1 ────< (1:N) >──── [AUDIT_LOGS]                                              │
│     │  1                                                                               │
│     ├──────< (1:N) >──── [SUSPENSION_HISTORY]                                          │
│     ├──────< (1:N) >──── [FEED_POSTS] 1 ────< (1:N) >──── [FEED_HEARTS]                │
│     │                       │  1                                                       │
│     │                       └───────< (1:N) >──── [FEED_COMMENTS]                      │
│     ├──────< (1:N) >──── [ANNOUNCEMENTS] 1 ──< (1:N) >─── [ANNOUNCEMENT_HEARTS]        │
│     ├──────< (1:N) >──── [EVENTS] 1 ────────< (1:N) >──── [EVENT_RSVPS]                │
│     ├──────< (1:N) >──── [JOB_POSTINGS] 1 ──< (1:N) >──── [JOB_APPLICATIONS]          │
│     ├──────< (1:N) >──── [CONNECTIONS] (Bidirectional Alumnus-to-Alumnus)              │
│     ├──────< (1:N) >──── [DIRECT_MESSAGES]                                             │
│     └──────< (1:1) >──── [REGISTRAR_MASTERLIST] (Cross-referenced on Student ID)       │
│                                                                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Complete Draw.io / diagrams.net XML

*Copy and paste the XML code below directly into [diagrams.net](https://app.diagrams.net) via **File > Import from > XML...** to view and edit the visual diagram.*

```xml
<mxfile host="app.diagrams.net" modified="2026-11-04T08:00:00.000Z" agent="Mozilla/5.0" version="24.0.0" type="device">
  <diagram id="StCeciliasAlumnetERD" name="St. Cecilia's College Alumnet ERD">
    <mxGraphModel dx="1422" dy="850" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1600" pageHeight="1100" background="#FFFFFF">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>

        <!-- ENTITY: USERS -->
        <mxCell id="ent_users" value="&lt;b&gt;USERS&lt;/b&gt;&lt;hr&gt;+ uid: VARCHAR [PK]&lt;br&gt;+ email: VARCHAR [UNIQUE]&lt;br&gt;+ name: VARCHAR&lt;br&gt;+ password_hash: VARCHAR&lt;br&gt;+ password_salt: VARCHAR&lt;br&gt;+ role: VARCHAR [ENUM]&lt;br&gt;+ account_status: VARCHAR [ENUM]&lt;br&gt;+ student_id: VARCHAR [FK]&lt;br&gt;+ batch: VARCHAR&lt;br&gt;+ course: VARCHAR&lt;br&gt;+ is_verified: BOOLEAN&lt;br&gt;+ company: VARCHAR&lt;br&gt;+ current_position: VARCHAR&lt;br&gt;+ suspension_start: TIMESTAMP&lt;br&gt;+ suspension_end: TIMESTAMP&lt;br&gt;+ suspension_reason: TEXT&lt;br&gt;+ created_at: TIMESTAMP" style="swimlane;fontStyle=0;childLayout=stackLayout;horizontal=1;startSize=26;fillColor=#8B181B;fontColor=#FFFFFF;strokeColor=#5B0F11;rounded=1;arcSize=8;fontSize=11;" vertex="1" parent="1">
          <mxGeometry x="60" y="80" width="230" height="300" as="geometry"/>
        </mxCell>

        <!-- ENTITY: REGISTRAR_MASTERLIST -->
        <mxCell id="ent_masterlist" value="&lt;b&gt;REGISTRAR_MASTERLIST&lt;/b&gt;&lt;hr&gt;+ student_id: VARCHAR [PK]&lt;br&gt;+ full_name: VARCHAR&lt;br&gt;+ degree_program: VARCHAR&lt;br&gt;+ graduation_year: VARCHAR&lt;br&gt;+ latin_honors: VARCHAR&lt;br&gt;+ clearance_status: VARCHAR&lt;br&gt;+ is_claimed: BOOLEAN&lt;br&gt;+ verified_at: TIMESTAMP" style="swimlane;fontStyle=0;childLayout=stackLayout;horizontal=1;startSize=26;fillColor=#2B0709;fontColor=#FFFFFF;strokeColor=#180405;rounded=1;arcSize=8;fontSize=11;" vertex="1" parent="1">
          <mxGeometry x="380" y="80" width="220" height="170" as="geometry"/>
        </mxCell>

        <!-- ENTITY: AUDIT_LOGS -->
        <mxCell id="ent_audit_logs" value="&lt;b&gt;AUDIT_LOGS&lt;/b&gt;&lt;hr&gt;+ id: VARCHAR [PK]&lt;br&gt;+ action: VARCHAR [ENUM]&lt;br&gt;+ actor_id: VARCHAR [FK]&lt;br&gt;+ actor_name: VARCHAR&lt;br&gt;+ actor_role: VARCHAR&lt;br&gt;+ target_user_id: VARCHAR [FK]&lt;br&gt;+ category: VARCHAR&lt;br&gt;+ severity: VARCHAR&lt;br&gt;+ details: TEXT&lt;br&gt;+ suspension_reason: TEXT&lt;br&gt;+ ip_address: VARCHAR&lt;br&gt;+ timestamp: TIMESTAMP" style="swimlane;fontStyle=0;childLayout=stackLayout;horizontal=1;startSize=26;fillColor=#1C1917;fontColor=#FFFFFF;strokeColor=#0C0A09;rounded=1;arcSize=8;fontSize=11;" vertex="1" parent="1">
          <mxGeometry x="60" y="460" width="230" height="230" as="geometry"/>
        </mxCell>

        <!-- ENTITY: SUSPENSION_HISTORY -->
        <mxCell id="ent_suspension_history" value="&lt;b&gt;SUSPENSION_HISTORY&lt;/b&gt;&lt;hr&gt;+ id: VARCHAR [PK]&lt;br&gt;+ user_id: VARCHAR [FK]&lt;br&gt;+ admin_id: VARCHAR [FK]&lt;br&gt;+ admin_name: VARCHAR&lt;br&gt;+ action: VARCHAR&lt;br&gt;+ reason: TEXT&lt;br&gt;+ start_date: TIMESTAMP&lt;br&gt;+ end_date: TIMESTAMP&lt;br&gt;+ notes: TEXT&lt;br&gt;+ created_at: TIMESTAMP" style="swimlane;fontStyle=0;childLayout=stackLayout;horizontal=1;startSize=26;fillColor=#44403C;fontColor=#FFFFFF;strokeColor=#292524;rounded=1;arcSize=8;fontSize=11;" vertex="1" parent="1">
          <mxGeometry x="380" y="320" width="220" height="200" as="geometry"/>
        </mxCell>

        <!-- ENTITY: FEED_POSTS -->
        <mxCell id="ent_feed_posts" value="&lt;b&gt;FEED_POSTS&lt;/b&gt;&lt;hr&gt;+ id: VARCHAR [PK]&lt;br&gt;+ author_id: VARCHAR [FK]&lt;br&gt;+ author_name: VARCHAR&lt;br&gt;+ author_role: VARCHAR&lt;br&gt;+ title: VARCHAR&lt;br&gt;+ content: TEXT&lt;br&gt;+ post_type: VARCHAR&lt;br&gt;+ image_url: VARCHAR&lt;br&gt;+ created_at: TIMESTAMP&lt;br&gt;+ updated_at: TIMESTAMP" style="swimlane;fontStyle=0;childLayout=stackLayout;horizontal=1;startSize=26;fillColor=#8B181B;fontColor=#FFFFFF;strokeColor=#5B0F11;rounded=1;arcSize=8;fontSize=11;" vertex="1" parent="1">
          <mxGeometry x="690" y="80" width="220" height="200" as="geometry"/>
        </mxCell>

        <!-- ENTITY: FEED_COMMENTS -->
        <mxCell id="ent_feed_comments" value="&lt;b&gt;FEED_COMMENTS&lt;/b&gt;&lt;hr&gt;+ id: VARCHAR [PK]&lt;br&gt;+ post_id: VARCHAR [FK]&lt;br&gt;+ author_id: VARCHAR [FK]&lt;br&gt;+ author_name: VARCHAR&lt;br&gt;+ content: TEXT&lt;br&gt;+ created_at: TIMESTAMP" style="swimlane;fontStyle=0;childLayout=stackLayout;horizontal=1;startSize=26;fillColor=#A82024;fontColor=#FFFFFF;strokeColor=#731417;rounded=1;arcSize=8;fontSize=11;" vertex="1" parent="1">
          <mxGeometry x="690" y="350" width="220" height="150" as="geometry"/>
        </mxCell>

        <!-- ENTITY: FEED_HEARTS -->
        <mxCell id="ent_feed_hearts" value="&lt;b&gt;FEED_HEARTS&lt;/b&gt;&lt;hr&gt;+ post_id: VARCHAR [PK, FK]&lt;br&gt;+ user_id: VARCHAR [PK, FK]&lt;br&gt;+ reacted_at: TIMESTAMP" style="swimlane;fontStyle=0;childLayout=stackLayout;horizontal=1;startSize=26;fillColor=#D97706;fontColor=#FFFFFF;strokeColor=#92400E;rounded=1;arcSize=8;fontSize=11;" vertex="1" parent="1">
          <mxGeometry x="690" y="550" width="220" height="90" as="geometry"/>
        </mxCell>

        <!-- ENTITY: ANNOUNCEMENTS -->
        <mxCell id="ent_announcements" value="&lt;b&gt;ANNOUNCEMENTS&lt;/b&gt;&lt;hr&gt;+ id: VARCHAR [PK]&lt;br&gt;+ author_id: VARCHAR [FK]&lt;br&gt;+ author_name: VARCHAR&lt;br&gt;+ title: VARCHAR&lt;br&gt;+ content: TEXT&lt;br&gt;+ category: VARCHAR&lt;br&gt;+ is_pinned: BOOLEAN&lt;br&gt;+ urgent: BOOLEAN&lt;br&gt;+ image_url: VARCHAR&lt;br&gt;+ published_at: TIMESTAMP" style="swimlane;fontStyle=0;childLayout=stackLayout;horizontal=1;startSize=26;fillColor=#1E293B;fontColor=#FFFFFF;strokeColor=#0F172A;rounded=1;arcSize=8;fontSize=11;" vertex="1" parent="1">
          <mxGeometry x="1000" y="80" width="220" height="200" as="geometry"/>
        </mxCell>

        <!-- ENTITY: EVENTS -->
        <mxCell id="ent_events" value="&lt;b&gt;EVENTS&lt;/b&gt;&lt;hr&gt;+ id: VARCHAR [PK]&lt;br&gt;+ organizer_id: VARCHAR [FK]&lt;br&gt;+ title: VARCHAR&lt;br&gt;+ description: TEXT&lt;br&gt;+ event_date: TIMESTAMP&lt;br&gt;+ location: VARCHAR&lt;br&gt;+ capacity: INTEGER&lt;br&gt;+ image_url: VARCHAR&lt;br&gt;+ created_at: TIMESTAMP" style="swimlane;fontStyle=0;childLayout=stackLayout;horizontal=1;startSize=26;fillColor=#0F766E;fontColor=#FFFFFF;strokeColor=#115E59;rounded=1;arcSize=8;fontSize=11;" vertex="1" parent="1">
          <mxGeometry x="1000" y="340" width="220" height="190" as="geometry"/>
        </mxCell>

        <!-- ENTITY: EVENT_RSVPS -->
        <mxCell id="ent_event_rsvps" value="&lt;b&gt;EVENT_RSVPS&lt;/b&gt;&lt;hr&gt;+ event_id: VARCHAR [PK, FK]&lt;br&gt;+ user_id: VARCHAR [PK, FK]&lt;br&gt;+ status: VARCHAR [ENUM]&lt;br&gt;+ rsvp_date: TIMESTAMP" style="swimlane;fontStyle=0;childLayout=stackLayout;horizontal=1;startSize=26;fillColor=#0D9488;fontColor=#FFFFFF;strokeColor=#115E59;rounded=1;arcSize=8;fontSize=11;" vertex="1" parent="1">
          <mxGeometry x="1000" y="580" width="220" height="110" as="geometry"/>
        </mxCell>

        <!-- ENTITY: JOB_POSTINGS -->
        <mxCell id="ent_jobs" value="&lt;b&gt;JOB_POSTINGS&lt;/b&gt;&lt;hr&gt;+ id: VARCHAR [PK]&lt;br&gt;+ employer_id: VARCHAR [FK]&lt;br&gt;+ company_name: VARCHAR&lt;br&gt;+ title: VARCHAR&lt;br&gt;+ description: TEXT&lt;br&gt;+ location: VARCHAR&lt;br&gt;+ salary_range: VARCHAR&lt;br&gt;+ job_type: VARCHAR [ENUM]&lt;br&gt;+ status: VARCHAR [ACTIVE/CLOSED]&lt;br&gt;+ created_at: TIMESTAMP" style="swimlane;fontStyle=0;childLayout=stackLayout;horizontal=1;startSize=26;fillColor=#1D4ED8;fontColor=#FFFFFF;strokeColor=#1E40AF;rounded=1;arcSize=8;fontSize=11;" vertex="1" parent="1">
          <mxGeometry x="1300" y="80" width="230" height="210" as="geometry"/>
        </mxCell>

        <!-- ENTITY: JOB_APPLICATIONS -->
        <mxCell id="ent_job_apps" value="&lt;b&gt;JOB_APPLICATIONS&lt;/b&gt;&lt;hr&gt;+ id: VARCHAR [PK]&lt;br&gt;+ job_id: VARCHAR [FK]&lt;br&gt;+ applicant_id: VARCHAR [FK]&lt;br&gt;+ resume_url: VARCHAR&lt;br&gt;+ cover_letter: TEXT&lt;br&gt;+ status: VARCHAR [PENDING/REVIEW]&lt;br&gt;+ submitted_at: TIMESTAMP" style="swimlane;fontStyle=0;childLayout=stackLayout;horizontal=1;startSize=26;fillColor=#2563EB;fontColor=#FFFFFF;strokeColor=#1D4ED8;rounded=1;arcSize=8;fontSize=11;" vertex="1" parent="1">
          <mxGeometry x="1300" y="350" width="230" height="160" as="geometry"/>
        </mxCell>

        <!-- ENTITY: CONNECTIONS -->
        <mxCell id="ent_connections" value="&lt;b&gt;CONNECTIONS&lt;/b&gt;&lt;hr&gt;+ id: VARCHAR [PK]&lt;br&gt;+ requester_id: VARCHAR [FK]&lt;br&gt;+ addressee_id: VARCHAR [FK]&lt;br&gt;+ status: VARCHAR [ACCEPTED/PENDING]&lt;br&gt;+ connected_at: TIMESTAMP" style="swimlane;fontStyle=0;childLayout=stackLayout;horizontal=1;startSize=26;fillColor=#475569;fontColor=#FFFFFF;strokeColor=#334155;rounded=1;arcSize=8;fontSize=11;" vertex="1" parent="1">
          <mxGeometry x="380" y="580" width="220" height="130" as="geometry"/>
        </mxCell>

        <!-- ENTITY: DIRECT_MESSAGES -->
        <mxCell id="ent_messages" value="&lt;b&gt;DIRECT_MESSAGES&lt;/b&gt;&lt;hr&gt;+ id: VARCHAR [PK]&lt;br&gt;+ sender_id: VARCHAR [FK]&lt;br&gt;+ receiver_id: VARCHAR [FK]&lt;br&gt;+ message_body: TEXT&lt;br&gt;+ is_read: BOOLEAN&lt;br&gt;+ sent_at: TIMESTAMP" style="swimlane;fontStyle=0;childLayout=stackLayout;horizontal=1;startSize=26;fillColor=#334155;fontColor=#FFFFFF;strokeColor=#1E293B;rounded=1;arcSize=8;fontSize=11;" vertex="1" parent="1">
          <mxGeometry x="380" y="760" width="220" height="150" as="geometry"/>
        </mxCell>

        <!-- RELATIONSHIPS -->
        <!-- Users to Registrar Masterlist (1:1) -->
        <mxCell id="rel_users_masterlist" value="1 : 1" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;exitX=1;exitY=0.25;entryX=0;entryY=0.25;strokeColor=#8B181B;strokeWidth=2;" edge="1" parent="1" source="ent_users" target="ent_masterlist">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>

        <!-- Users to Audit Logs (1:N) -->
        <mxCell id="rel_users_audit" value="1 : N" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;exitX=0.5;exitY=1;entryX=0.5;entryY=0;strokeColor=#1C1917;strokeWidth=2;" edge="1" parent="1" source="ent_users" target="ent_audit_logs">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>

        <!-- Users to Suspension History (1:N) -->
        <mxCell id="rel_users_suspension" value="1 : N" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;exitX=1;exitY=0.7;entryX=0;entryY=0.3;strokeColor=#44403C;strokeWidth=2;" edge="1" parent="1" source="ent_users" target="ent_suspension_history">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>

        <!-- Users to Feed Posts (1:N) -->
        <mxCell id="rel_users_posts" value="1 : N" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;exitX=1;exitY=0.1;entryX=0;entryY=0.2;strokeColor=#8B181B;strokeWidth=2;" edge="1" parent="1" source="ent_users" target="ent_feed_posts">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>

        <!-- Feed Posts to Feed Comments (1:N) -->
        <mxCell id="rel_posts_comments" value="1 : N" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;exitX=0.5;exitY=1;entryX=0.5;entryY=0;strokeColor=#A82024;strokeWidth=2;" edge="1" parent="1" source="ent_feed_posts" target="ent_feed_comments">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>

        <!-- Feed Posts to Feed Hearts (1:N) -->
        <mxCell id="rel_posts_hearts" value="1 : N" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;exitX=0.5;exitY=1;entryX=0.5;entryY=0;strokeColor=#D97706;strokeWidth=2;" edge="1" parent="1" source="ent_feed_comments" target="ent_feed_hearts">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>

        <!-- Users to Announcements (1:N) -->
        <mxCell id="rel_users_announcements" value="1 : N" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;exitX=1;exitY=0.05;entryX=0;entryY=0.2;strokeColor=#1E293B;strokeWidth=2;" edge="1" parent="1" source="ent_users" target="ent_announcements">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>

        <!-- Users to Events (1:N) -->
        <mxCell id="rel_users_events" value="1 : N" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;exitX=1;exitY=0.5;entryX=0;entryY=0.2;strokeColor=#0F766E;strokeWidth=2;" edge="1" parent="1" source="ent_users" target="ent_events">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>

        <!-- Events to Event RSVPs (1:N) -->
        <mxCell id="rel_events_rsvps" value="1 : N" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;exitX=0.5;exitY=1;entryX=0.5;entryY=0;strokeColor=#0D9488;strokeWidth=2;" edge="1" parent="1" source="ent_events" target="ent_event_rsvps">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>

        <!-- Users to Job Postings (1:N) -->
        <mxCell id="rel_users_jobs" value="1 : N" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;exitX=1;exitY=0.02;entryX=0;entryY=0.1;strokeColor=#1D4ED8;strokeWidth=2;" edge="1" parent="1" source="ent_users" target="ent_jobs">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>

        <!-- Job Postings to Job Applications (1:N) -->
        <mxCell id="rel_jobs_apps" value="1 : N" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;exitX=0.5;exitY=1;entryX=0.5;entryY=0;strokeColor=#2563EB;strokeWidth=2;" edge="1" parent="1" source="ent_jobs" target="ent_job_apps">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>

        <!-- Users to Connections (1:N) -->
        <mxCell id="rel_users_connections" value="1 : N" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;exitX=1;exitY=0.9;entryX=0;entryY=0.5;strokeColor=#475569;strokeWidth=2;" edge="1" parent="1" source="ent_users" target="ent_connections">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>

        <!-- Connections to Direct Messages (1:N) -->
        <mxCell id="rel_conn_messages" value="Gated 1 : N" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;exitX=0.5;exitY=1;entryX=0.5;entryY=0;strokeColor=#334155;strokeWidth=2;" edge="1" parent="1" source="ent_connections" target="ent_messages">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>

      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
```

---

## 4. System Use Case Diagram (SVG & Draw.io XML)

### 4.1 Use Case Diagram (Scalable Vector Graphics - SVG)

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1350 960" width="100%" height="100%" style="background:#FAF9F6; font-family:system-ui,-apple-system,sans-serif;">
  <defs>
    <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.06"/>
    </filter>
    <linearGradient id="primaryGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#8B181B"/>
      <stop offset="100%" stop-color="#6B1215"/>
    </linearGradient>
  </defs>

  <!-- SYSTEM BOUNDARY -->
  <rect x="260" y="40" width="830" height="880" rx="20" fill="#FFFFFF" stroke="#8B181B" stroke-width="2.5" filter="url(#shadow)"/>
  <rect x="260" y="40" width="830" height="42" rx="20" fill="url(#primaryGrad)"/>
  <text x="675" y="68" fill="#FFFFFF" font-size="15" font-weight="bold" text-anchor="middle" letter-spacing="0.5">ST. CECILIA'S COLLEGE - CEBU, INC. ALUMNET SYSTEM BOUNDARY</text>

  <!-- ACTORS (LEFT SIDE) -->
  <!-- Actor 1: Alumni -->
  <g transform="translate(60, 180)">
    <circle cx="50" cy="30" r="16" fill="#FAF9F6" stroke="#8B181B" stroke-width="2.5"/>
    <line x1="50" y1="46" x2="50" y2="90" stroke="#8B181B" stroke-width="2.5"/>
    <line x1="20" y1="62" x2="80" y2="62" stroke="#8B181B" stroke-width="2.5"/>
    <line x1="50" y1="90" x2="25" y2="130" stroke="#8B181B" stroke-width="2.5"/>
    <line x1="50" y1="90" x2="75" y2="130" stroke="#8B181B" stroke-width="2.5"/>
    <text x="50" y="152" font-size="12" font-weight="bold" fill="#1C1917" text-anchor="middle">Alumni Member</text>
    <text x="50" y="167" font-size="10" fill="#78716C" text-anchor="middle">Verified Graduate</text>
  </g>

  <!-- Actor 2: Employer -->
  <g transform="translate(60, 520)">
    <circle cx="50" cy="30" r="16" fill="#FAF9F6" stroke="#8B181B" stroke-width="2.5"/>
    <line x1="50" y1="46" x2="50" y2="90" stroke="#8B181B" stroke-width="2.5"/>
    <line x1="20" y1="62" x2="80" y2="62" stroke="#8B181B" stroke-width="2.5"/>
    <line x1="50" y1="90" x2="25" y2="130" stroke="#8B181B" stroke-width="2.5"/>
    <line x1="50" y1="90" x2="75" y2="130" stroke="#8B181B" stroke-width="2.5"/>
    <text x="50" y="152" font-size="12" font-weight="bold" fill="#1C1917" text-anchor="middle">Employer Partner</text>
    <text x="50" y="167" font-size="10" fill="#78716C" text-anchor="middle">Corporate Recruiter</text>
  </g>

  <!-- ACTORS (RIGHT SIDE) -->
  <!-- Actor 3: Institutional Moderator -->
  <g transform="translate(1190, 160)">
    <circle cx="50" cy="30" r="16" fill="#FAF9F6" stroke="#8B181B" stroke-width="2.5"/>
    <line x1="50" y1="46" x2="50" y2="90" stroke="#8B181B" stroke-width="2.5"/>
    <line x1="20" y1="62" x2="80" y2="62" stroke="#8B181B" stroke-width="2.5"/>
    <line x1="50" y1="90" x2="25" y2="130" stroke="#8B181B" stroke-width="2.5"/>
    <line x1="50" y1="90" x2="75" y2="130" stroke="#8B181B" stroke-width="2.5"/>
    <text x="50" y="152" font-size="12" font-weight="bold" fill="#1C1917" text-anchor="middle">Institutional Moderator</text>
    <text x="50" y="167" font-size="10" fill="#78716C" text-anchor="middle">Registrar / Staff / Events</text>
  </g>

  <!-- Actor 4: Administrator -->
  <g transform="translate(1190, 430)">
    <circle cx="50" cy="30" r="16" fill="#FAF9F6" stroke="#8B181B" stroke-width="2.5"/>
    <line x1="50" y1="46" x2="50" y2="90" stroke="#8B181B" stroke-width="2.5"/>
    <line x1="20" y1="62" x2="80" y2="62" stroke="#8B181B" stroke-width="2.5"/>
    <line x1="50" y1="90" x2="25" y2="130" stroke="#8B181B" stroke-width="2.5"/>
    <line x1="50" y1="90" x2="75" y2="130" stroke="#8B181B" stroke-width="2.5"/>
    <text x="50" y="152" font-size="12" font-weight="bold" fill="#1C1917" text-anchor="middle">System Administrator</text>
    <text x="50" y="167" font-size="10" fill="#78716C" text-anchor="middle">Security & Suspensions</text>
  </g>

  <!-- Actor 5: Superadmin (Inherits Admin) -->
  <g transform="translate(1190, 700)">
    <circle cx="50" cy="30" r="16" fill="#FAF9F6" stroke="#8B181B" stroke-width="2.5"/>
    <line x1="50" y1="46" x2="50" y2="90" stroke="#8B181B" stroke-width="2.5"/>
    <line x1="20" y1="62" x2="80" y2="62" stroke="#8B181B" stroke-width="2.5"/>
    <line x1="50" y1="90" x2="25" y2="130" stroke="#8B181B" stroke-width="2.5"/>
    <line x1="50" y1="90" x2="75" y2="130" stroke="#8B181B" stroke-width="2.5"/>
    <text x="50" y="152" font-size="12" font-weight="bold" fill="#1C1917" text-anchor="middle">Superadministrator</text>
    <text x="50" y="167" font-size="10" fill="#78716C" text-anchor="middle">Root Governance</text>
  </g>

  <!-- USE CASES (OVALS INSIDE BOUNDARY) -->
  <!-- Column 1: Identity & Community -->
  <g id="uc01">
    <ellipse cx="430" cy="120" rx="130" ry="26" fill="#FAF9F6" stroke="#8B181B" stroke-width="1.8"/>
    <text x="430" y="124" font-size="11" font-weight="600" fill="#1C1917" text-anchor="middle">UC-01: Authenticate via PBKDF2/Biometrics</text>
  </g>

  <g id="uc05">
    <ellipse cx="430" cy="200" rx="130" ry="26" fill="#FAF9F6" stroke="#8B181B" stroke-width="1.8"/>
    <text x="430" y="204" font-size="11" font-weight="600" fill="#1C1917" text-anchor="middle">UC-05: Generate & Flip Digital Alumni ID</text>
  </g>

  <g id="uc06">
    <ellipse cx="430" cy="280" rx="130" ry="26" fill="#FAF9F6" stroke="#8B181B" stroke-width="1.8"/>
    <text x="430" y="284" font-size="11" font-weight="600" fill="#1C1917" text-anchor="middle">UC-06: Publish & Heart Campus Feed Posts</text>
  </g>

  <g id="uc07">
    <ellipse cx="430" cy="360" rx="130" ry="26" fill="#FAF9F6" stroke="#8B181B" stroke-width="1.8"/>
    <text x="430" y="364" font-size="11" font-weight="600" fill="#1C1917" text-anchor="middle">UC-07: Search Verified Alumni Directory</text>
  </g>

  <g id="uc08">
    <ellipse cx="430" cy="440" rx="130" ry="26" fill="#FAF9F6" stroke="#8B181B" stroke-width="1.8"/>
    <text x="430" y="444" font-size="11" font-weight="600" fill="#1C1917" text-anchor="middle">UC-08: Gated Direct Messaging with Peer</text>
  </g>

  <g id="uc10">
    <ellipse cx="430" cy="520" rx="130" ry="26" fill="#FAF9F6" stroke="#8B181B" stroke-width="1.8"/>
    <text x="430" y="524" font-size="11" font-weight="600" fill="#1C1917" text-anchor="middle">UC-10: Apply for Job & Export PDF Resume</text>
  </g>

  <!-- Column 2: Governance, Moderator & Administration -->
  <g id="uc04">
    <ellipse cx="880" cy="120" rx="140" ry="26" fill="#FAF9F6" stroke="#8B181B" stroke-width="1.8"/>
    <text x="880" y="124" font-size="11" font-weight="600" fill="#1C1917" text-anchor="middle">UC-04: Student Clearance & Degree Verification</text>
  </g>

  <g id="uc11">
    <ellipse cx="880" cy="200" rx="140" ry="26" fill="#FAF9F6" stroke="#8B181B" stroke-width="1.8"/>
    <text x="880" y="204" font-size="11" font-weight="600" fill="#1C1917" text-anchor="middle">UC-11: Schedule Events & Confirm RSVPs</text>
  </g>

  <g id="uc12">
    <ellipse cx="880" cy="280" rx="140" ry="26" fill="#FAF9F6" stroke="#8B181B" stroke-width="1.8"/>
    <text x="880" y="284" font-size="11" font-weight="600" fill="#1C1917" text-anchor="middle">UC-12: Broadcast Bulletins & Push Alerts</text>
  </g>

  <g id="uc09">
    <ellipse cx="880" cy="360" rx="140" ry="26" fill="#FAF9F6" stroke="#8B181B" stroke-width="1.8"/>
    <text x="880" y="364" font-size="11" font-weight="600" fill="#1C1917" text-anchor="middle">UC-09: Corporate Accreditation & Job Posting</text>
  </g>

  <g id="uc02">
    <ellipse cx="880" cy="450" rx="140" ry="26" fill="#FAF9F6" stroke="#8B181B" stroke-width="1.8"/>
    <text x="880" y="454" font-size="11" font-weight="600" fill="#1C1917" text-anchor="middle">UC-02: Security Audit Logs & Threat Detection</text>
  </g>

  <g id="uc03">
    <ellipse cx="880" cy="540" rx="140" ry="26" fill="#FAF9F6" stroke="#8B181B" stroke-width="1.8"/>
    <text x="880" y="544" font-size="11" font-weight="600" fill="#1C1917" text-anchor="middle">UC-03: Account Suspension & Lock Scheduler</text>
  </g>

  <g id="uc13">
    <ellipse cx="880" cy="630" rx="140" ry="26" fill="#FAF9F6" stroke="#8B181B" stroke-width="1.8"/>
    <text x="880" y="634" font-size="11" font-weight="600" fill="#1C1917" text-anchor="middle">UC-13: Superadmin Role & Deletion Guard</text>
  </g>

  <g id="uc14">
    <ellipse cx="880" cy="720" rx="140" ry="26" fill="#FAF9F6" stroke="#8B181B" stroke-width="1.8"/>
    <text x="880" y="724" font-size="11" font-weight="600" fill="#1C1917" text-anchor="middle">UC-14: Automated Account Restoration Daemon</text>
  </g>

  <!-- CONNECTORS -->
  <!-- Alumni Connections -->
  <line x1="130" y1="210" x2="305" y2="125" stroke="#78716C" stroke-width="1.2"/>
  <line x1="130" y1="220" x2="300" y2="200" stroke="#78716C" stroke-width="1.2"/>
  <line x1="130" y1="230" x2="300" y2="280" stroke="#78716C" stroke-width="1.2"/>
  <line x1="130" y1="240" x2="300" y2="360" stroke="#78716C" stroke-width="1.2"/>
  <line x1="130" y1="250" x2="300" y2="440" stroke="#78716C" stroke-width="1.2"/>
  <line x1="130" y1="260" x2="305" y2="515" stroke="#78716C" stroke-width="1.2"/>

  <!-- Employer Connections -->
  <line x1="130" y1="560" x2="745" y2="370" stroke="#78716C" stroke-width="1.2"/>
  <line x1="130" y1="580" x2="560" y2="525" stroke="#78716C" stroke-width="1.2"/>

  <!-- Moderator Connections -->
  <line x1="1200" y1="210" x2="1020" y2="125" stroke="#78716C" stroke-width="1.2"/>
  <line x1="1200" y1="220" x2="1020" y2="200" stroke="#78716C" stroke-width="1.2"/>
  <line x1="1200" y1="230" x2="1020" y2="280" stroke="#78716C" stroke-width="1.2"/>
  <line x1="1200" y1="240" x2="560" y2="280" stroke="#78716C" stroke-width="1.2"/>

  <!-- Administrator Connections -->
  <line x1="1200" y1="480" x2="1020" y2="455" stroke="#78716C" stroke-width="1.2"/>
  <line x1="1200" y1="490" x2="1020" y2="540" stroke="#78716C" stroke-width="1.2"/>

  <!-- Superadmin Connections -->
  <line x1="1200" y1="750" x2="1020" y2="635" stroke="#78716C" stroke-width="1.2"/>
  <!-- Superadmin inheritance to Admin -->
  <path d="M 1240 690 L 1240 590" stroke="#8B181B" stroke-width="1.8" stroke-dasharray="4,4"/>
  <polygon points="1240,580 1234,592 1246,592" fill="#8B181B"/>

  <!-- <<extend>> and <<include>> labels -->
  <!-- UC-07 requires UC-08 -->
  <path d="M 430 414 L 430 386" stroke="#D97706" stroke-width="1.5" stroke-dasharray="3,3"/>
  <text x="445" y="405" font-size="9" fill="#B45309" font-weight="bold">&lt;&lt;requires connection&gt;&gt;</text>

  <!-- Footer Brand -->
  <text x="675" y="900" font-size="11" fill="#A8A29E" text-anchor="middle">St. Cecilia's College - Cebu, Inc. • Lasallian Affiliate Member • Minglanilla, Cebu</text>
</svg>
```

### 4.2 Use Case Diagram in Draw.io / diagrams.net XML

*Copy and paste the XML code below directly into [diagrams.net](https://app.diagrams.net) to view and edit.*

```xml
<mxfile host="app.diagrams.net" modified="2026-11-04T08:00:00.000Z" agent="Mozilla/5.0" version="24.0.0" type="device">
  <diagram id="StCeciliasAlumnetUseCase" name="St. Cecilia's College Use Case Diagram">
    <mxGraphModel dx="1422" dy="850" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1500" pageHeight="1050" background="#FAF9F6">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>

        <!-- SYSTEM BOUNDARY BOX -->
        <mxCell id="sys_boundary" value="ST. CECILIA'S COLLEGE - CEBU, INC. ALUMNET SYSTEM BOUNDARY" style="swimlane;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#8B181B;strokeWidth=2.5;fontColor=#8B181B;fontStyle=1;fontSize=13;startSize=30;rounded=1;arcSize=4;" vertex="1" parent="1">
          <mxGeometry x="240" y="40" width="840" height="920" as="geometry"/>
        </mxCell>

        <!-- USE CASES INSIDE BOUNDARY -->
        <mxCell id="uc_01" value="UC-01: Authenticate Session via&#xa;PBKDF2 &amp; Biometrics" style="ellipse;whiteSpace=wrap;html=1;fillColor=#FAF9F6;strokeColor=#8B181B;strokeWidth=1.8;fontSize=11;fontStyle=1;" vertex="1" parent="sys_boundary">
          <mxGeometry x="60" y="60" width="230" height="55" as="geometry"/>
        </mxCell>

        <mxCell id="uc_05" value="UC-05: Generate &amp; Flip&#xa;Digital Alumni ID Card" style="ellipse;whiteSpace=wrap;html=1;fillColor=#FAF9F6;strokeColor=#8B181B;strokeWidth=1.8;fontSize=11;fontStyle=1;" vertex="1" parent="sys_boundary">
          <mxGeometry x="60" y="145" width="230" height="55" as="geometry"/>
        </mxCell>

        <mxCell id="uc_06" value="UC-06: Publish, React &amp; Moderate&#xa;Campus Social Feed" style="ellipse;whiteSpace=wrap;html=1;fillColor=#FAF9F6;strokeColor=#8B181B;strokeWidth=1.8;fontSize=11;fontStyle=1;" vertex="1" parent="sys_boundary">
          <mxGeometry x="60" y="230" width="230" height="55" as="geometry"/>
        </mxCell>

        <mxCell id="uc_07" value="UC-07: Search Verified Alumni&#xa;Directory &amp; Connect" style="ellipse;whiteSpace=wrap;html=1;fillColor=#FAF9F6;strokeColor=#8B181B;strokeWidth=1.8;fontSize=11;fontStyle=1;" vertex="1" parent="sys_boundary">
          <mxGeometry x="60" y="315" width="230" height="55" as="geometry"/>
        </mxCell>

        <mxCell id="uc_08" value="UC-08: Gated Direct Messaging&#xa;with Connected Peer" style="ellipse;whiteSpace=wrap;html=1;fillColor=#FAF9F6;strokeColor=#8B181B;strokeWidth=1.8;fontSize=11;fontStyle=1;" vertex="1" parent="sys_boundary">
          <mxGeometry x="60" y="405" width="230" height="55" as="geometry"/>
        </mxCell>

        <mxCell id="uc_10" value="UC-10: Apply for Job Vacancy &amp;&#xa;Export Certified PDF Resume" style="ellipse;whiteSpace=wrap;html=1;fillColor=#FAF9F6;strokeColor=#8B181B;strokeWidth=1.8;fontSize=11;fontStyle=1;" vertex="1" parent="sys_boundary">
          <mxGeometry x="60" y="495" width="230" height="55" as="geometry"/>
        </mxCell>

        <mxCell id="uc_04" value="UC-04: Student Clearance &amp;&#xa;Degree Verification" style="ellipse;whiteSpace=wrap;html=1;fillColor=#FAF9F6;strokeColor=#8B181B;strokeWidth=1.8;fontSize=11;fontStyle=1;" vertex="1" parent="sys_boundary">
          <mxGeometry x="540" y="60" width="240" height="55" as="geometry"/>
        </mxCell>

        <mxCell id="uc_11" value="UC-11: Schedule Campus Events&#xa;&amp; Confirm RSVPs" style="ellipse;whiteSpace=wrap;html=1;fillColor=#FAF9F6;strokeColor=#8B181B;strokeWidth=1.8;fontSize=11;fontStyle=1;" vertex="1" parent="sys_boundary">
          <mxGeometry x="540" y="145" width="240" height="55" as="geometry"/>
        </mxCell>

        <mxCell id="uc_12" value="UC-12: Broadcast Bulletins&#xa;&amp; Dispatch Push Alerts" style="ellipse;whiteSpace=wrap;html=1;fillColor=#FAF9F6;strokeColor=#8B181B;strokeWidth=1.8;fontSize=11;fontStyle=1;" vertex="1" parent="sys_boundary">
          <mxGeometry x="540" y="230" width="240" height="55" as="geometry"/>
        </mxCell>

        <mxCell id="uc_09" value="UC-09: Corporate Accreditation&#xa;&amp; Job Posting Management" style="ellipse;whiteSpace=wrap;html=1;fillColor=#FAF9F6;strokeColor=#8B181B;strokeWidth=1.8;fontSize=11;fontStyle=1;" vertex="1" parent="sys_boundary">
          <mxGeometry x="540" y="320" width="240" height="55" as="geometry"/>
        </mxCell>

        <mxCell id="uc_02" value="UC-02: Security Audit Logs &amp;&#xa;Threat Intelligence" style="ellipse;whiteSpace=wrap;html=1;fillColor=#FAF9F6;strokeColor=#8B181B;strokeWidth=1.8;fontSize=11;fontStyle=1;" vertex="1" parent="sys_boundary">
          <mxGeometry x="540" y="415" width="240" height="55" as="geometry"/>
        </mxCell>

        <mxCell id="uc_03" value="UC-03: Account Suspension &amp;&#xa;Lock Scheduler" style="ellipse;whiteSpace=wrap;html=1;fillColor=#FAF9F6;strokeColor=#8B181B;strokeWidth=1.8;fontSize=11;fontStyle=1;" vertex="1" parent="sys_boundary">
          <mxGeometry x="540" y="510" width="240" height="55" as="geometry"/>
        </mxCell>

        <mxCell id="uc_13" value="UC-13: Superadmin Governance&#xa;&amp; Deletion Guardrail" style="ellipse;whiteSpace=wrap;html=1;fillColor=#FAF9F6;strokeColor=#8B181B;strokeWidth=1.8;fontSize=11;fontStyle=1;" vertex="1" parent="sys_boundary">
          <mxGeometry x="540" y="605" width="240" height="55" as="geometry"/>
        </mxCell>

        <mxCell id="uc_14" value="UC-14: Automated Account&#xa;Restoration Daemon" style="ellipse;whiteSpace=wrap;html=1;fillColor=#FAF9F6;strokeColor=#8B181B;strokeWidth=1.8;fontSize=11;fontStyle=1;" vertex="1" parent="sys_boundary">
          <mxGeometry x="540" y="700" width="240" height="55" as="geometry"/>
        </mxCell>

        <!-- ACTORS -->
        <mxCell id="act_alumni" value="Alumni Member&#xa;(Verified Graduate)" style="shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;outlineConnect=0;strokeColor=#8B181B;strokeWidth=2;fillColor=#FAF9F6;fontStyle=1;fontSize=11;" vertex="1" parent="1">
          <mxGeometry x="70" y="240" width="45" height="90" as="geometry"/>
        </mxCell>

        <mxCell id="act_employer" value="Employer Partner&#xa;(Corporate Recruiter)" style="shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;outlineConnect=0;strokeColor=#8B181B;strokeWidth=2;fillColor=#FAF9F6;fontStyle=1;fontSize=11;" vertex="1" parent="1">
          <mxGeometry x="70" y="560" width="45" height="90" as="geometry"/>
        </mxCell>

        <mxCell id="act_moderator" value="Institutional Moderator&#xa;(Registrar / Events / Circulars)" style="shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;outlineConnect=0;strokeColor=#8B181B;strokeWidth=2;fillColor=#FAF9F6;fontStyle=1;fontSize=11;" vertex="1" parent="1">
          <mxGeometry x="1190" y="160" width="45" height="90" as="geometry"/>
        </mxCell>

        <mxCell id="act_admin" value="System Administrator&#xa;(Security &amp; Suspensions)" style="shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;outlineConnect=0;strokeColor=#8B181B;strokeWidth=2;fillColor=#FAF9F6;fontStyle=1;fontSize=11;" vertex="1" parent="1">
          <mxGeometry x="1190" y="460" width="45" height="90" as="geometry"/>
        </mxCell>

        <mxCell id="act_superadmin" value="Superadministrator&#xa;(Root Authority)" style="shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;outlineConnect=0;strokeColor=#8B181B;strokeWidth=2;fillColor=#FAF9F6;fontStyle=1;fontSize=11;" vertex="1" parent="1">
          <mxGeometry x="1190" y="720" width="45" height="90" as="geometry"/>
        </mxCell>

        <!-- CONNECTOR LINES -->
        <mxCell id="conn_alumni_01" style="endArrow=none;html=1;entryX=0;entryY=0.5;strokeColor=#78716C;strokeWidth=1.5;" edge="1" parent="1" source="act_alumni" target="uc_01">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="conn_alumni_05" style="endArrow=none;html=1;entryX=0;entryY=0.5;strokeColor=#78716C;strokeWidth=1.5;" edge="1" parent="1" source="act_alumni" target="uc_05">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="conn_alumni_06" style="endArrow=none;html=1;entryX=0;entryY=0.5;strokeColor=#78716C;strokeWidth=1.5;" edge="1" parent="1" source="act_alumni" target="uc_06">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="conn_alumni_07" style="endArrow=none;html=1;entryX=0;entryY=0.5;strokeColor=#78716C;strokeWidth=1.5;" edge="1" parent="1" source="act_alumni" target="uc_07">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="conn_alumni_08" style="endArrow=none;html=1;entryX=0;entryY=0.5;strokeColor=#78716C;strokeWidth=1.5;" edge="1" parent="1" source="act_alumni" target="uc_08">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="conn_alumni_10" style="endArrow=none;html=1;entryX=0;entryY=0.5;strokeColor=#78716C;strokeWidth=1.5;" edge="1" parent="1" source="act_alumni" target="uc_10">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>

        <mxCell id="conn_employer_09" style="endArrow=none;html=1;entryX=0.5;entryY=1;strokeColor=#78716C;strokeWidth=1.5;" edge="1" parent="1" source="act_employer" target="uc_09">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="conn_employer_10" style="endArrow=none;html=1;entryX=0.5;entryY=1;strokeColor=#78716C;strokeWidth=1.5;" edge="1" parent="1" source="act_employer" target="uc_10">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>

        <mxCell id="conn_mod_04" style="endArrow=none;html=1;entryX=1;entryY=0.5;strokeColor=#78716C;strokeWidth=1.5;" edge="1" parent="1" source="act_moderator" target="uc_04">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="conn_mod_11" style="endArrow=none;html=1;entryX=1;entryY=0.5;strokeColor=#78716C;strokeWidth=1.5;" edge="1" parent="1" source="act_moderator" target="uc_11">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="conn_mod_12" style="endArrow=none;html=1;entryX=1;entryY=0.5;strokeColor=#78716C;strokeWidth=1.5;" edge="1" parent="1" source="act_moderator" target="uc_12">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="conn_mod_06" style="endArrow=none;html=1;entryX=1;entryY=0.5;strokeColor=#78716C;strokeWidth=1.5;" edge="1" parent="1" source="act_moderator" target="uc_06">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>

        <mxCell id="conn_admin_02" style="endArrow=none;html=1;entryX=1;entryY=0.5;strokeColor=#78716C;strokeWidth=1.5;" edge="1" parent="1" source="act_admin" target="uc_02">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="conn_admin_03" style="endArrow=none;html=1;entryX=1;entryY=0.5;strokeColor=#78716C;strokeWidth=1.5;" edge="1" parent="1" source="act_admin" target="uc_03">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>

        <mxCell id="conn_super_13" style="endArrow=none;html=1;entryX=1;entryY=0.5;strokeColor=#78716C;strokeWidth=1.5;" edge="1" parent="1" source="act_superadmin" target="uc_13">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>

        <!-- Generalization: Superadmin -> Admin -->
        <mxCell id="gen_super_admin" style="endArrow=block;endSize=12;dashed=1;html=1;strokeColor=#8B181B;strokeWidth=2;fillColor=#8B181B;" edge="1" parent="1" source="act_superadmin" target="act_admin">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>

      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
```

---

## 5. Formal Cockburn Use Case Narratives

---

### UC-01: Authenticate Session via PBKDF2 Vault & WebAuthn Biometrics

| Field | Specification |
| :--- | :--- |
| **Use Case ID** | **UC-01** |
| **Use Case Name** | **Authenticate User Session** |
| **Primary Actor** | Registered User (`alumni`, `employer`, `moderator`, `admin`, `superadmin`) |
| **Secondary Actors** | WebAuthn Platform Authenticator, PBKDF2 Cryptographic Vault, Audit Log Engine |
| **Stakeholders & Interests** | • **Alumni/Staff**: Seamless, secure authentication into portal records.<br>• **Institution**: Prevent credential stuffing and brute-force intrusions.<br>• **Security Officer**: Full traceability of all login attempts. |
| **Scope** | Authentication & Security Subsystem |
| **Level** | User-Goal Level |
| **Preconditions** | 1. User holds an existing account.<br>2. Account lifecycle status is `ACTIVE` (not `SUSPENDED` or `LOCKED`). |
| **Trigger** | User navigates to portal entry point and submits login form or touches biometric prompt. |
| **Main Success Scenario (Normal Flow)** | **1.** User accesses the portal login interface.<br>**2.** User enters institutional email or username, and secret password.<br>**3.** System retrieves stored salt and executes PBKDF2 key derivation over 100,000 SHA-256 iterations.<br>**4.** System compares derived hash with stored credential.<br>**5.** System verifies `account_status === 'ACTIVE'`.<br>**6.** System registers active session timestamp and client telemetry.<br>**7.** System records audit entry `USER_LOGIN` with classification `NORMAL` and no warning icon.<br>**8.** System issues secure session token and redirects user to their role workspace. |
| **Extensions (Alternative Flows)** | **4a. Password does not match (single attempt)**:<br>&nbsp;&nbsp;&nbsp;&nbsp;1. System increments failed counter.<br>&nbsp;&nbsp;&nbsp;&nbsp;2. System logs `FAILED_LOGIN_ATTEMPT` with status `WARNING` and warning icon (⚠️).<br>&nbsp;&nbsp;&nbsp;&nbsp;3. Password text is strictly redacted from logs.<br>&nbsp;&nbsp;&nbsp;&nbsp;4. System renders error: "Invalid credentials."<br>**4b. Three consecutive failed attempts**:<br>&nbsp;&nbsp;&nbsp;&nbsp;1. System records `MULTIPLE_FAILED_LOGIN_ATTEMPTS` with status `SUSPICIOUS` and warning icon (⚠️).<br>&nbsp;&nbsp;&nbsp;&nbsp;2. System alerts the administrator.<br>**4c. Five consecutive failed attempts (Lockout)**:<br>&nbsp;&nbsp;&nbsp;&nbsp;1. System transitions user state to `LOCKED`.<br>&nbsp;&nbsp;&nbsp;&nbsp;2. System records `ACCOUNT_LOCKED` with status `LOCKED` and warning icon (⚠️).<br>&nbsp;&nbsp;&nbsp;&nbsp;3. System displays lockout modal directing user to Institutional Moderator for clearance.<br>**5a. Account is SUSPENDED**:<br>&nbsp;&nbsp;&nbsp;&nbsp;1. System blocks session creation.<br>&nbsp;&nbsp;&nbsp;&nbsp;2. System renders suspension modal displaying exact reason, start date, and scheduled restoration date.<br>**2b. User selects WebAuthn Biometric Authentication**:<br>&nbsp;&nbsp;&nbsp;&nbsp;1. System issues cryptographic challenge via `navigator.credentials.get()`.<br>&nbsp;&nbsp;&nbsp;&nbsp;2. User validates fingerprint/Face ID on device authenticator.<br>&nbsp;&nbsp;&nbsp;&nbsp;3. Signature verified; system completes login without password entry. |
| **Postconditions** | • **Success Guarantee**: User gains authenticated session; `USER_LOGIN` logged as `NORMAL`.<br>• **Minimal Guarantee**: System records all failed attempts without exposing plaintext passwords. |
| **Special Requirements** | Mobile viewports enforce exclusive Alumni role access policy. |

---

### UC-02: Security Audit Logging & Suspicious Multi-User Detection

| Field | Specification |
| :--- | :--- |
| **Use Case ID** | **UC-02** |
| **Use Case Name** | **Evaluate Session Telemetry & Detect Multi-User Account Sharing** |
| **Primary Actor** | Automated Security Engine (`System Daemon`) |
| **Secondary Actors** | System Administrator (`admin`), Superadministrator (`superadmin`) |
| **Stakeholders & Interests** | • **College Administration**: Enforce one-account, one-individual integrity policy.<br>• **Account Holder**: Protection against account hijacking. |
| **Scope** | Security Threat Intelligence Engine |
| **Level** | Sub-function / Institutional Guardrail |
| **Preconditions** | A user account has an active session and receives incoming requests from concurrent network signatures. |
| **Trigger** | Ingestion of concurrent session telemetry from disparate locations or devices. |
| **Main Success Scenario (Normal Flow)** | **1.** Security daemon intercepts incoming telemetry (client signature, IP, user-agent).<br>**2.** Daemon checks if an existing session is currently active for the same user.<br>**3.** Daemon evaluates location velocity, conflicting simultaneous interactions, and credentials.<br>**4.** If legitimate multi-device usage (e.g. mobile app + desktop web browser by same user), session is allowed.<br>**5.** If telemetry demonstrates conflicting concurrent operations or geographical impossibility:<br>&nbsp;&nbsp;&nbsp;&nbsp;a. System logs `MULTIPLE_USERS_SAME_ACCOUNT`.<br>&nbsp;&nbsp;&nbsp;&nbsp;b. Classification set to `SUSPICIOUS`.<br>&nbsp;&nbsp;&nbsp;&nbsp;c. Warning icon rendered: Yes (⚠️).<br>&nbsp;&nbsp;&nbsp;&nbsp;d. Details include concurrent session metrics and timestamps.<br>**6.** Real-time security alert dispatched to Administrator workspace. |
| **Extensions (Alternative Flows)** | **6a. Administrator investigates alert in Audit Log view**:<br>&nbsp;&nbsp;&nbsp;&nbsp;1. Admin clicks entry with `⚠️ SUSPICIOUS` badge.<br>&nbsp;&nbsp;&nbsp;&nbsp;2. Inspector drawer reveals timeline, hardware hashes, and concurrent IP logs.<br>&nbsp;&nbsp;&nbsp;&nbsp;3. Admin triggers temporary suspension (UC-03) directly from drawer. |
| **Postconditions** | Threat incident recorded with complete tamper-proof payload. Passwords remain unlogged. |

---

### UC-03: Administrative Account Suspension & Lock Scheduler

| Field | Specification |
| :--- | :--- |
| **Use Case ID** | **UC-03** |
| **Use Case Name** | **Schedule Account Suspension or Lock with Mandatory Reason** |
| **Primary Actor** | System Administrator (`admin` or `superadmin`) |
| **Secondary Actors** | Target User, Security Audit Engine |
| **Stakeholders & Interests** | • **Administrator**: Rapidly contain compromised or policy-violating accounts.<br>• **User**: Receive clear notification of suspension duration and administrative explanation. |
| **Scope** | Administrative Governance Subsystem |
| **Level** | User-Goal Level |
| **Preconditions** | Actor possesses `canAccessAdminPanel` privileges. Target account is registered. |
| **Trigger** | Admin clicks "Suspend" or "Lock" in administrative table or audit drawer. |
| **Main Success Scenario (Normal Flow)** | **1.** Admin selects "Suspend Account" on target user.<br>**2.** System opens Account Suspension & Lock Scheduler Modal.<br>**3.** Modal renders user identity, current status, and role.<br>**4.** Admin selects duration preset (`1 hour`, `24 hours`, `3 days`, `7 days`, `15 days`, `30 days`) or custom date.<br>**5.** System computes `suspensionStartDate` and `suspensionEndDate`.<br>**6.** Admin enters or selects required **Suspension Reason**.<br>**7.** Admin confirms suspension.<br>**8.** System validates non-empty reason and updates user state to `SUSPENDED`.<br>**9.** Active tokens terminated; user session terminated.<br>**10.** Audit log generated: `ACCOUNT_SUSPENDED`, status `SUSPENDED`, warning icon: Yes (⚠️).<br>**11.** Confirmation toast displayed to Admin. |
| **Extensions (Alternative Flows)** | **6a. Admin leaves suspension reason blank**:<br>&nbsp;&nbsp;&nbsp;&nbsp;1. Form blocks submission with error: "Reason for account suspension is mandatory."<br>**4a. Admin selects Permanent Account Lock**:<br>&nbsp;&nbsp;&nbsp;&nbsp;1. End date marked `null` (indefinite).<br>&nbsp;&nbsp;&nbsp;&nbsp;2. State set to `LOCKED`.<br>&nbsp;&nbsp;&nbsp;&nbsp;3. Logged as `ACCOUNT_LOCKED` (`LOCKED`, ⚠️ Yes).<br>**7a. Admin extends active suspension**:<br>&nbsp;&nbsp;&nbsp;&nbsp;1. Admin inputs new future end date.<br>&nbsp;&nbsp;&nbsp;&nbsp;2. Logged as `ACCOUNT_SUSPENSION_EXTENDED` (`WARNING`, ⚠️ Yes).<br>**7b. Admin manually restores account**:<br>&nbsp;&nbsp;&nbsp;&nbsp;1. Admin clicks "Unlock Account" and enters restoration note.<br>&nbsp;&nbsp;&nbsp;&nbsp;2. State set to `ACTIVE`.<br>&nbsp;&nbsp;&nbsp;&nbsp;3. Logged as `ADMIN_UNLOCKED_ACCOUNT` (`NORMAL`, No warning icon). |
| **Postconditions** | Target account locked out; suspension timeline and explanation recorded in profile history. |

---

### UC-04: Student Academic Record Clearance & Degree Certification

| Field | Specification |
| :--- | :--- |
| **Use Case ID** | **UC-04** |
| **Use Case Name** | **Verify Student Academic Clearance & Certify Degree Standing** |
| **Primary Actor** | Institutional Moderator (`moderator`) *(Consolidated Registrar Function)* |
| **Secondary Actors** | Alumni Applicant, Student Masterlist Registry |
| **Stakeholders & Interests** | • **Alumni**: Obtain verified graduate status, unlocking Digital ID and Directory.<br>• **Institution**: Guarantee that only legitimate alumni hold verified accreditation. |
| **Scope** | Academic Registry & Accreditation Module |
| **Level** | User-Goal Level |
| **Preconditions** | Graduate submitted Student ID (`YYYY-NNNNN`) or uploaded academic diploma proof. |
| **Trigger** | Moderator opens Academic Clearance queue or alumni clicks Instant Match. |
| **Main Success Scenario (Normal Flow)** | **1.** Moderator reviews graduate's Student ID and program in clearance queue.<br>**2.** System cross-references official registrar masterlist.<br>**3.** System retrieves matched degree program, graduation year, and Latin honors.<br>**4.** Moderator verifies graduation clearance.<br>**5.** Moderator clicks "Approve & Certify Graduate".<br>**6.** System transitions alumni state to `isVerified: true`.<br>**7.** System generates cryptographic Alumni ID serial number.<br>**8.** System logs `REGISTRAR_VERIFIED_STUDENT` (`NORMAL`, no warning icon).<br>**9.** Alumnus receives verified badge (`ShieldCheck`) and directory listing. |
| **Extensions (Alternative Flows)** | **2a. Student ID not in masterlist (Unlisted Record)**:<br>&nbsp;&nbsp;&nbsp;&nbsp;1. Alumnus uploads scanned diploma/TOR in verification modal.<br>&nbsp;&nbsp;&nbsp;&nbsp;2. Moderator manually inspects attached document and approves or declines with feedback. |
| **Postconditions** | Alumnus credential authenticated; digital card activated. |

---

### UC-05: Generate & Flip Signature Digital Alumni ID

| Field | Specification |
| :--- | :--- |
| **Use Case ID** | **UC-05** |
| **Use Case Name** | **Generate and Flip Signature Digital Alumni ID Card** |
| **Primary Actor** | Verified Alumni Member (`alumni`) |
| **Secondary Actors** | QR Code Generator, Campus Turnstile Verification Scanner |
| **Stakeholders & Interests** | • **Alumni**: Pocket credential for campus entry and alumni privileges.<br>• **Campus Security**: Rapid scanning and tamper-proof verification. |
| **Scope** | Digital Credential Subsystem |
| **Level** | User-Goal Level |
| **Preconditions** | User is an authenticated, verified alumni graduate. |
| **Trigger** | Alumni navigates to Profile and selects "Digital Alumni Card". |
| **Main Success Scenario (Normal Flow)** | **1.** System retrieves graduate's verified credentials.<br>**2.** System renders the front of the ID card:<br>&nbsp;&nbsp;&nbsp;&nbsp;• Transparent College Seal (`/assets/st-cecilias-seal-transparent.svg`).<br>&nbsp;&nbsp;&nbsp;&nbsp;• Institutional deep crimson gradient (`#8B181B` to `#2b0709`) with gold foil trim.<br>&nbsp;&nbsp;&nbsp;&nbsp;• Graduate photo, full name, student ID, degree program, and batch year.<br>&nbsp;&nbsp;&nbsp;&nbsp;• Gold Verified Graduate emblem.<br>**3.** Alumni clicks the card or the "Flip ID" button.<br>**4.** Card animates a 3D perspective flip (`rotateY(180deg)`).<br>**5.** Reverse side renders dynamic QR code encoding cryptographic verification link, campus clearance badge, and college motto.<br>**6.** Alumni presents card to security or downloads image to wallet. |
| **Extensions (Alternative Flows)** | **1a. Account unverified or suspended**:<br>&nbsp;&nbsp;&nbsp;&nbsp;1. QR code replaced with "Accreditation Required" or "Suspended" overlay. |
| **Postconditions** | Digital credential rendered in full institutional compliance. |

---

### UC-06: Publish, React, Edit, and Moderate Campus Feed Posts

| Field | Specification |
| :--- | :--- |
| **Use Case ID** | **UC-06** |
| **Use Case Name** | **Publish, React, Edit, and Moderate Campus Social Feed** |
| **Primary Actor** | Alumni Member, Institutional Moderator, Administrator |
| **Secondary Actors** | Alumni Network Peers |
| **Stakeholders & Interests** | • **Alumni**: Share career milestones and interact with fellow Cecilians.<br>• **Moderator**: Maintain collegiate decorum. |
| **Scope** | Community Social Feed Module |
| **Level** | User-Goal Level |
| **Preconditions** | User holds an active account. |
| **Trigger** | User publishes a milestone or interacts on the feed. |
| **Main Success Scenario (Normal Flow)** | **1.** User writes milestone title, category, and text description with optional photo.<br>**2.** User clicks "Publish to Feed".<br>**3.** System attaches user profile and broadcasts post in real-time.<br>**4.** Post automatically syncs to author's profile view under "My Feed Posts & Updates".<br>**5.** Fellow Cecilians view the post and click the **Heart** button to react.<br>**6.** Heart counter increments; user ID appended to hearts array.<br>**7.** Clicking the heart counter opens the **Reactor Modal** displaying who reacted.<br>**8.** Author can edit or delete their post at any time using the card controls. |
| **Extensions (Alternative Flows)** | **5a. Author attempts to heart their own post**:<br>&nbsp;&nbsp;&nbsp;&nbsp;1. System prevents self-congratulations per institutional policy.<br>&nbsp;&nbsp;&nbsp;&nbsp;2. Toast displayed: "You cannot heart your own post."<br>**8a. Inappropriate content reported**:<br>&nbsp;&nbsp;&nbsp;&nbsp;1. Institutional Moderator clicks "Delete Post".<br>&nbsp;&nbsp;&nbsp;&nbsp;2. Post purged from feed; logged in audit trails. |
| **Postconditions** | Feed updated in real-time; interactions stored. |

---

### UC-07: Search Verified Alumni Directory & Connect

| Field | Specification |
| :--- | :--- |
| **Use Case ID** | **UC-07** |
| **Use Case Name** | **Query Directory and Establish Mutual Peer Connection** |
| **Primary Actor** | Verified Alumni Member (`alumni`) |
| **Secondary Actors** | Target Alumni, Directory Privacy Filter |
| **Stakeholders & Interests** | • **Alumni**: Network with alumni across programs and graduating batches.<br>• **Staff/Admin**: Privacy protection (staff accounts hidden from public alumni view). |
| **Scope** | Directory & Networking Subsystem |
| **Level** | User-Goal Level |
| **Preconditions** | User holds verified alumni status. |
| **Trigger** | User opens the Alumni Network directory. |
| **Main Success Scenario (Normal Flow)** | **1.** System loads directory with privacy filters applied:<br>&nbsp;&nbsp;&nbsp;&nbsp;• Unverified and pending accounts are strictly excluded.<br>&nbsp;&nbsp;&nbsp;&nbsp;• Administrative and moderator accounts are hidden from public alumni view.<br>**2.** User enters search keywords, batch year, or degree program.<br>**3.** Matching alumni cards display degree, company, and location.<br>**4.** User clicks "Connect" on peer card.<br>**5.** System records connection request and notifies peer.<br>**6.** Target peer accepts request; mutual connection established (`isConnected = true`). |
| **Extensions (Alternative Flows)** | **1a. Unverified member attempts directory access**:<br>&nbsp;&nbsp;&nbsp;&nbsp;1. Access gated; modal prompts for degree verification. |
| **Postconditions** | Mutual connection stored; direct messaging unlocked. |

---

### UC-08: Initiate Gated Direct Messaging with Sticky Header

| Field | Specification |
| :--- | :--- |
| **Use Case ID** | **UC-08** |
| **Use Case Name** | **Send Direct Messages with Responsive Sticky Chat Header** |
| **Primary Actor** | Connected Alumni Member |
| **Secondary Actors** | Recipient Alumni, Push Notification Service |
| **Stakeholders & Interests** | • **Alumni**: Safe, private direct communications with verified peers. |
| **Scope** | Communications Subsystem |
| **Level** | User-Goal Level |
| **Preconditions** | Users are active and hold a mutual connection (`isConnected === true`). |
| **Trigger** | User clicks "Message" on connected peer card or in Messages tab. |
| **Main Success Scenario (Normal Flow)** | **1.** Chat pane opens with **sticky top header** displaying peer avatar, name, and degree.<br>**2.** System loads chronological message thread.<br>**3.** User composes message and clicks Send.<br>**4.** System validates mutual connection.<br>**5.** Message appended in real-time; push alert sent to recipient.<br>**6.** Recipient replies within the same thread. |
| **Extensions (Alternative Flows)** | **4a. Users are not mutually connected**:<br>&nbsp;&nbsp;&nbsp;&nbsp;1. Message composer is locked.<br>&nbsp;&nbsp;&nbsp;&nbsp;2. Card displays: "Direct messaging is gated to connected alumni. Send connection request to begin chat." |
| **Postconditions** | Encrypted message thread preserved; sticky header maintains conversation context during scroll. |

---

### UC-09: Corporate Employer Accreditation & Opportunity Posting

| Field | Specification |
| :--- | :--- |
| **Use Case ID** | **UC-09** |
| **Use Case Name** | **Accredit Corporate Partner and Post Employment Opportunity** |
| **Primary Actor** | Employer Partner (`employer`) |
| **Secondary Actors** | System Administrator (`admin`), Alumni Applicants |
| **Stakeholders & Interests** | • **Employer**: Hire qualified St. Cecilia's graduates.<br>• **College**: Protect students from fraudulent or unaccredited job postings. |
| **Scope** | Career Placement Subsystem |
| **Level** | User-Goal Level |
| **Preconditions** | Employer registers on desktop web portal. |
| **Trigger** | Corporate recruiter applies for partner accreditation. |
| **Main Success Scenario (Normal Flow)** | **1.** Recruiter inputs corporate profile, business permit, and hiring fields.<br>**2.** Administrator reviews accreditation submission and clicks "Approve".<br>**3.** Employer gains verified partner status and accesses the Job Posting Studio.<br>**4.** Employer inputs job title, qualifications, employment type, and salary range.<br>**5.** Employer submits job posting.<br>**6.** Listing published to Alumni Career Center with verified partner emblem. |
| **Extensions (Alternative Flows)** | **1a. Recruiter attempts mobile registration**:<br>&nbsp;&nbsp;&nbsp;&nbsp;1. CTA disabled with guidance to complete accreditation on desktop web. |
| **Postconditions** | Listing indexed; alumni notified of new career opening. |

---

### UC-10: Apply for Job Vacancy & Generate Verified PDF Resume

| Field | Specification |
| :--- | :--- |
| **Use Case ID** | **UC-10** |
| **Use Case Name** | **Apply for Vacancy and Export Certified Collegiate PDF Resume** |
| **Primary Actor** | Alumni Jobseeker |
| **Secondary Actors** | Hiring Employer, PDF Resume Generation Engine |
| **Stakeholders & Interests** | • **Alumni**: Professional, institutionally verified resume export.<br>• **Employer**: Verified academic credentials on candidate submissions. |
| **Scope** | Career Services & Resume Export Engine |
| **Level** | User-Goal Level |
| **Preconditions** | Alumnus holds verified degree and completed profile. |
| **Trigger** | Alumnus clicks "Export Official Resume" or "Apply Now". |
| **Main Success Scenario (Normal Flow)** | **1.** Alumnus reviews job qualifications.<br>**2.** Alumnus clicks "Generate Certified PDF Resume".<br>**3.** System compiles verified degree from registrar masterlist, career history, skills, and contact data.<br>**4.** Engine formats a collegiate two-column PDF resume bearing St. Cecilia's crest and verified watermark.<br>**5.** Modal displays full-fidelity in-browser PDF preview.<br>**6.** Alumnus confirms submission to employer.<br>**7.** Employer dashboard receives applicant dossier. |
| **Postconditions** | Application logged; verified PDF resume delivered to employer. |

---

### UC-11: Schedule Campus Homecoming Events & Confirm RSVPs

| Field | Specification |
| :--- | :--- |
| **Use Case ID** | **UC-11** |
| **Use Case Name** | **Schedule Campus Events and Manage Confirmed Guest RSVPs** |
| **Primary Actor** | Institutional Moderator (`moderator`) *(Consolidated Staff Function)* |
| **Secondary Actors** | Alumni Attendees |
| **Stakeholders & Interests** | • **Moderator**: Manage event logistics and accurate attendee counts.<br>• **Alumni**: Join reunions and institutional gatherings. |
| **Scope** | Events & Reunions Subsystem |
| **Level** | User-Goal Level |
| **Preconditions** | Actor has moderator or administrative privileges. |
| **Trigger** | Moderator creates a new campus event or reunion. |
| **Main Success Scenario (Normal Flow)** | **1.** Moderator inputs event title, date, location/link, and attendee cap.<br>**2.** Event published to campus calendar.<br>**3.** Alumni view listing and click "RSVP: Going".<br>**4.** System records reservation and increments confirmed count.<br>**5.** Attendee roster displays strictly confirmed Cecilians (`status: 'going'`).<br>**6.** 24-hour reminder email and push alerts automatically dispatched to confirmed guests. |
| **Postconditions** | Event attendance accurately verified; reminders scheduled. |

---

### UC-12: Broadcast Bulletins & Dispatch Web Push Alerts

| Field | Specification |
| :--- | :--- |
| **Use Case ID** | **UC-12** |
| **Use Case Name** | **Publish Official Circular with High Dark-Mode Contrast & Push Broadcast** |
| **Primary Actor** | Institutional Moderator (`moderator`) *(Consolidated Communications Function)* |
| **Secondary Actors** | Alumni Subscribers, Web Push Service Worker |
| **Stakeholders & Interests** | • **College**: Disseminate urgent advisories rapidly.<br>• **Alumni**: Stay informed with legible, accessible notices. |
| **Scope** | Public Communications Subsystem |
| **Level** | User-Goal Level |
| **Preconditions** | Actor possesses announcement creation privileges. |
| **Trigger** | Moderator publishes an institutional announcement or emergency bulletin. |
| **Main Success Scenario (Normal Flow)** | **1.** Moderator drafts title, category, rich text, and optional photo banner.<br>**2.** Moderator flags notice as "Urgent" or "Pinned" if critical.<br>**3.** System saves announcement with enhanced dark-mode contrast tokens.<br>**4.** System dispatches VAPID Web Push broadcast to registered device service workers.<br>**5.** Subscribed alumni receive push notification chimes.<br>**6.** Clicking notification opens the detail advisory modal. |
| **Postconditions** | Notice archived in campus bulletin; push metrics updated. |

---

### UC-13: Superadministrator Governance & Administrator Protection

| Field | Specification |
| :--- | :--- |
| **Use Case ID** | **UC-13** |
| **Use Case Name** | **Superadministrator Role Management and Administrative Deletion Protection** |
| **Primary Actor** | Superadministrator (`superadmin`) |
| **Secondary Actors** | Target Administrator, User Management Service |
| **Stakeholders & Interests** | • **Superadmin**: Exercise supreme institutional governance.<br>• **System**: Prevent peer administrators from rogue-deleting administrative peers. |
| **Scope** | Enterprise Identity & Access Governance |
| **Level** | Strategic Governance Level |
| **Preconditions** | Current authenticated actor holds role `superadmin`. |
| **Trigger** | Superadmin opens Administrative Users table. |
| **Main Success Scenario (Normal Flow)** | **1.** Superadmin views user directory.<br>**2.** For institutional users, Superadmin can adjust roles between `moderator`, `admin`, and `superadmin` (alumni and employer roles remain fixed).<br>**3.** On administrative accounts (`admin`), the delete button is rendered **exclusively** to the Superadmin.<br>**4.** Standard administrators cannot view or trigger delete buttons on administrative accounts.<br>**5.** Superadmin confirms deletion in destructive dialog.<br>**6.** Account and credentials permanently removed; audit log recorded. |
| **Extensions (Alternative Flows)** | **4a. Standard Admin attempts API deletion on another Admin**:<br>&nbsp;&nbsp;&nbsp;&nbsp;1. Backend guards reject request with: "Only Superadmin accounts can delete institutional administrators." |
| **Postconditions** | Separation of powers enforced across administrative tiers. |

---

### UC-14: Automated Account Restoration Daemon

| Field | Specification |
| :--- | :--- |
| **Use Case ID** | **UC-14** |
| **Use Case Name** | **Automatically Restore Expired Account Suspensions** |
| **Primary Actor** | Automated Security Engine (`System Daemon`) |
| **Secondary Actors** | Target User, Audit Logger |
| **Stakeholders & Interests** | • **User**: Fair, timely restoration of portal privileges once penalty expires.<br>• **Administration**: Zero-touch automated policy enforcement. |
| **Scope** | Security Scheduler Subsystem |
| **Level** | Automated Sub-function |
| **Preconditions** | A user account is currently `SUSPENDED` with a defined `suspensionEndDate`. |
| **Trigger** | Background scheduler executes hourly evaluation. |
| **Main Success Scenario (Normal Flow)** | **1.** Daemon queries accounts where `accountStatus === 'SUSPENDED'`.<br>**2.** Daemon compares current UTC timestamp with `suspensionEndDate`.<br>**3.** If `currentTime >= suspensionEndDate` and account is not permanently locked:<br>&nbsp;&nbsp;&nbsp;&nbsp;a. Status updated to `ACTIVE`.<br>&nbsp;&nbsp;&nbsp;&nbsp;b. Restoration flag set: `autoRestored = true`.<br>&nbsp;&nbsp;&nbsp;&nbsp;c. System logs `ACCOUNT_AUTO_RESTORED` (`NORMAL`, no warning icon).<br>**4.** User can immediately sign in on next attempt. |
| **Extensions (Alternative Flows)** | **2a. Account is marked Permanent Lock (`isPermanentLock === true`)**:<br>&nbsp;&nbsp;&nbsp;&nbsp;1. Daemon skips restoration; manual admin unlock required. |
| **Postconditions** | Account privileges restored without manual administrative intervention. |

---

*End of St. Cecilia's College - Cebu, Inc. Alumnet System Documentation & Use Case Specification.*
