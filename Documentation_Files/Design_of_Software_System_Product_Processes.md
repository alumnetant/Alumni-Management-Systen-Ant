# Design of Software, System Product Processes

**Institution:** St. Cecilia's College - Cebu, Inc.  
**System Title:** AlumNet: A Web and Mobile-Based Alumni Networking and Tracer System  
**Document Section:** Chapter / Section — Design of Software, System Product Processes  

---

## Design of Software, System Product Processes

The design of **AlumNet** focuses on providing an organized, efficient, verifiable, and user-friendly platform for alumni, institutional administrators, alumni relations officers (moderators), and accredited corporate employers. The software design serves as a comprehensive blueprint to ensure that the system meets essential functional requirements such as instant registrar-cross matching and graduate verification, digital alumni ID generation, real-time messaging, continuous graduate employment tracer surveys, institutional event management with QR-code ticketing, corporate vacancy posting, and applicant tracking (ATS), while strictly maintaining data security, role-based access control (RBAC), and high availability:

*   **High-Level Design (Architecture):** Defines the main functional modules and operational boundaries of AlumNet, including the Authentication & Verification Engine, Alumni Directory & Network Discovery Hub, Direct Messaging & Discussion Lounges, Digital Alumni ID & Credential Vault, Event Management & QR Attendance Scanner, Corporate Job Board & Applicant Tracking System (ATS), and the Administrative Analytics & Conflict Triage Dashboard. It establishes how these modules communicate securely through REST API proxy routes, real-time Firestore database listeners, and role-based policies, delivering tailored services and dashboards across all four system user roles.

*   **Low-Level Design (Detailed Design):** Specifies the internal workings, data schemas, and algorithmic execution of each subsystem. This includes structured database schemas for user profiles, registrar masterlists, digital event tickets, job postings, candidate applications, and system audit logs; algorithmic logic for instantaneous student ID matching and collision dispute handling; HMAC-SHA256 encrypted payload structures for offline-scannable QR codes; reactive frontend components styled with St. Cecilia's signature deep crimson (`#8B181B`) visual hierarchy; and multi-channel communication pipelines for Web Push notifications, time-based OTP security, and activity audit logging.

---

## System Product Processes for AlumNet

The development of **AlumNet** follows structured software engineering and product lifecycle processes to ensure quality, security, institutional compliance, and usability:

1.  **Requirements Analysis:** Gathering and validating functional and non-functional requirements from St. Cecilia's College administration, the Registrar's Office, the Alumni Relations Office, graduating seniors, alumni across diverse batches, and partner corporate recruiters. Key priorities identified include eliminating manual paper-based graduate verification, capturing real-time graduate tracer data, automating event entry via QR tickets, and connecting alumni directly with accredited career opportunities.

2.  **System Design:** Converting verified institutional requirements into comprehensive system architecture, database blueprints (`firebase-blueprint.json`), API endpoint specifications, and user interface mockups. This phase establishes granular Role-Based Access Control (RBAC), database security rules (`firestore.rules`), collision/dispute resolution workflows for duplicate student IDs, and responsive UI layouts tailored for desktop browsers and mobile touchpoints.

3.  **Implementation:** Developing the complete multi-tier system utilizing modern web and mobile technologies. This incorporates a responsive React and TypeScript single-page application (SPA), an Express backend proxy server for secure administrative operations, Firebase Cloud Firestore for real-time document synchronization, Tailwind CSS for consistent institutional branding, and Capacitor for cross-platform Android and iOS device deployment.

4.  **Testing:** Conducting rigorous multi-layered testing to guarantee operational stability and data integrity. This involves automated unit and integration testing via Vitest (covering authentication policies, account suspension schedulers, biometric and OTP verification, digital ID cryptography, and employer recruitment governance), security rule auditing, cross-browser responsiveness testing, and User Acceptance Testing (UAT) conducted with institutional stakeholders.

5.  **Deployment and Maintenance:** Releasing AlumNet into the live production environment with continuous cloud hosting, automated data backup routines, and administrative staff onboarding. This phase encompasses ongoing registrar masterlist synchronization, proactive security audits, periodic database performance tuning, bug fixing, and continuous feature enhancements to keep the platform aligned with St. Cecilia's College accreditation standards and alumni community needs.
