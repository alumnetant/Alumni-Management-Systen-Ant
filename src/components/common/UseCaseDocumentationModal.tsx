import React, { useState } from 'react';
import {
  FileText,
  Copy,
  Check,
  Download,
  X,
  ExternalLink,
  Code2,
  ListTree,
  ShieldCheck,
  Network,
  Briefcase
} from 'lucide-react';

interface UseCaseDocumentationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UseCaseDocumentationModal: React.FC<UseCaseDocumentationModalProps> = ({
  isOpen,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'narratives' | 'plantuml' | 'ascii'>('narratives');
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(label);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const handleDownloadMarkdown = () => {
    const link = document.createElement('a');
    link.href = '/docs/USE_CASES.md';
    link.download = 'St_Cecilias_Alumnet_Use_Cases.md';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const plantUmlCode = `@startuml StCeciliasAlumnetCompleteUseCase
left to right direction
skinparam packageStyle rectangle
skinparam roundcorner 8
skinparam shadowing false
skinparam monochrome false

skinparam actorBorderColor #8B181B
skinparam actorBackgroundColor #FAF9F6
skinparam usecaseBorderColor #8B181B
skinparam usecaseBackgroundColor #FFFFFF

actor "Alumni Member" as Alumni
actor "Employer Partner" as Employer
actor "College Registrar" as Registrar
actor "Faculty / Staff" as Faculty
actor "Content Moderator" as Moderator
actor "System Administrator" as Admin
actor "Superadministrator" as Superadmin
actor "Automated Security Engine" as SystemEngine

rectangle "St. Cecilia's College - Cebu, Inc. Alumnet Platform" {

  package "Module 1: Identity, Authentication & Cryptographic Vault" {
    usecase "UC-01: Authenticate Session\\n(PBKDF2 & WebAuthn Biometrics)" as UC01
    usecase "UC-01a: Multi-Device Telemetry Registration" as UC01a
    usecase "UC-01b: Enforce Account Lockout\\n(5 Failed Attempts)" as UC01b
    usecase "UC-04: Cross-Verify Student ID & Degree\\n(Registrar Clearance)" as UC04
    usecase "UC-04a: Sync Masterlist Credentials" as UC04a
  }

  package "Module 2: Security Threat Intelligence & Governance" {
    usecase "UC-02: Inspect Activity & Audit Logs\\n(Standardized Statuses & ⚠️ Icons)" as UC02
    usecase "UC-02a: Detect MULTIPLE_USERS_SAME_ACCOUNT\\n(Evidence-Based Sharing)" as UC02a
    usecase "UC-03: Execute Account Suspension Scheduler\\n(Presets + Mandatory Reason)" as UC03
    usecase "UC-03a: Extend Suspension Duration" as UC03a
    usecase "UC-03b: Unlock & Restore Account" as UC03b
    usecase "UC-03c: Automatic Expiration & Restoration Engine" as UC03c
    usecase "UC-13: Manage Roles & Delete Staff Records\\n(Superadmin Protection)" as UC13
  }

  package "Module 3: Community, Digital ID & Social Network" {
    usecase "UC-05: Generate & Present Digital Alumni ID\\n(Crimson Palette, Gold Trim, QR Code)" as UC05
    usecase "UC-06: Publish, Edit & Delete Feed Posts\\n(Profile Synchronization)" as UC06
    usecase "UC-06a: React with Heart & View Reactor Modal\\n(No Self-Congratulations)" as UC06a
    usecase "UC-07: Search Approved Alumni Directory\\n(Exclude Unapproved & Admin Tiers)" as UC07
    usecase "UC-08: Gated Peer-to-Peer Direct Messaging\\n(Sticky Header & Connection Lock)" as UC08
  }

  package "Module 4: Career Services, Events & Bulletins" {
    usecase "UC-09: Register Employer Partner & Post Vacancies\\n(Desktop Only)" as UC09
    usecase "UC-10: Apply for Jobs & Generate PDF Resume\\n(Institutional Watermark)" as UC10
    usecase "UC-11: Organize Campus Events & Manage Attendees\\n(Confirmed RSVPs Only)" as UC11
    usecase "UC-12: Broadcast Bulletins & Push Alerts\\n(High Dark-Mode Contrast)" as UC12
  }

}

Alumni --> UC01
Alumni --> UC05
Alumni --> UC06
Alumni --> UC06a
Alumni --> UC07
Alumni --> UC08
Alumni --> UC10

Employer --> UC01
Employer --> UC09
Employer --> UC10

Registrar --> UC01
Registrar --> UC04
Registrar --> UC04a
Registrar --> UC02

Faculty --> UC01
Faculty --> UC06
Faculty --> UC11
Faculty --> UC12

Moderator --> UC01
Moderator --> UC06
Moderator --> UC02

Admin --> UC01
Admin --> UC02
Admin --> UC03
Admin --> UC03a
Admin --> UC03b
Admin --> UC11
Admin --> UC12

Superadmin --|> Admin
Superadmin --> UC13

SystemEngine --> UC02a
SystemEngine --> UC03c

UC01 <.. UC01a : <<include>>
UC01 <.. UC01b : <<extend>>
UC01b ..> UC02 : <<logs critical alert>>
UC02a ..> UC02 : <<persists warning log>>
UC06 <.. UC06a : <<extend>>
UC08 ..> UC07 : <<requires isConnected>>
UC03 <.. UC03a : <<extend>>
UC03 <.. UC03b : <<extend>>
UC04 <.. UC04a : <<include>>
@enduml`;

  const asciiDiagram = `┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                        ST. CECILIA'S COLLEGE - CEBU, INC. ALUMNET SYSTEM BOUNDARY                      │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                        │
│  [ ACTORS ]                                     [ USE CASES ]                                          │
│                                                                                                        │
│  Alumni Graduate ────────┬───► (UC-01: Authenticate via PBKDF2 / WebAuthn Biometrics)                 │
│                          ├───► (UC-05: Generate & Present Signature Digital Alumni ID)                │
│                          ├───► (UC-06: Publish & Manage Milestone Updates on Campus Feed)             │
│                          ├───► (UC-07: Search Verified Alumni Directory & Connect)                    │
│                          ├───► (UC-08: Initiate Gated Peer-to-Peer Chat)                              │
│                          └───► (UC-10: Apply for Jobs & Export Certified PDF Resume)                  │
│                                                                                                        │
│  Employer Partner ───────┬───► (UC-09: Submit Corporate Accreditation & Post Vacancies)               │
│                          └───► (UC-10b: Review Applications & Download Resumes)                       │
│                                                                                                        │
│  College Registrar ──────┬───► (UC-04: Cross-Verify Student ID & Certify Academic Degree)             │
│                          └───► (UC-04b: Sync Masterlist & Validate Graduation Clearance)               │
│                                                                                                        │
│  Staff / Faculty ────────────► (UC-11: Create & Manage Reunions & Official Events)                    │
│                                                                                                        │
│  System Administrator ───┬───► (UC-02: Inspect Activity Logs & Detect Suspicious Sharing)             │
│                          ├───► (UC-03: Execute Account Suspension Scheduler & Reason Vault)           │
│                          ├───► (UC-03b: Unlock & Restore Suspended Accounts)                          │
│                          └───► (UC-12: Broadcast Emergency Circulars & Push Alerts)                  │
│                                                                                                        │
│  Superadministrator ─────┴───► (UC-13: Manage Administrative Roles & Superadmin Deletion Guard)       │
│                                                                                                        │
│  Security Engine ────────┬───► (UC-02b: Flag MULTIPLE_USERS_SAME_ACCOUNT & Repeated Failures)         │
│  (System Daemon)         └───► (UC-03c: Auto-Restore Expired Suspended Accounts)                      │
│                                                                                                        │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘`;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-800 w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between gap-3 bg-stone-50/70 dark:bg-stone-850">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#8B181B] text-white flex items-center justify-center shrink-0 shadow-sm">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#8B181B] dark:text-red-400 bg-red-50 dark:bg-red-950/50 px-2 py-0.5 rounded border border-red-200/60 dark:border-red-900/40">
                  Institutional Specification
                </span>
                <span className="text-xs text-stone-400">• v2.5 Verified</span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-stone-900 dark:text-white truncate">
                System Use Case Architecture & Cockburn Narratives
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleDownloadMarkdown}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              title="Download USE_CASES.md Markdown File"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download .md</span>
            </button>
            <a
              href="/docs/USE_CASES.md"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#8B181B] hover:bg-[#721316] text-white rounded-xl text-xs font-bold transition-colors shadow-2xs cursor-pointer"
              title="Open raw file in browser tab"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Raw Link</span>
            </a>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="px-5 pt-3 pb-2 border-b border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1 bg-stone-100 dark:bg-stone-800 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('narratives')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'narratives'
                  ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-white shadow-2xs font-extrabold'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
              }`}
            >
              <ListTree className="w-3.5 h-3.5 text-[#8B181B] dark:text-red-400" />
              <span>Cockburn Narratives (UC-01 to UC-13)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('plantuml')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'plantuml'
                  ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-white shadow-2xs font-extrabold'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
              }`}
            >
              <Code2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>PlantUML Source</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('ascii')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'ascii'
                  ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-white shadow-2xs font-extrabold'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
              }`}
            >
              <Network className="w-3.5 h-3.5 text-amber-600" />
              <span>ASCII Boundary Diagram</span>
            </button>
          </div>

          <span className="text-xs text-stone-400 hidden sm:inline">
            Directly accessible at <code className="text-[#8B181B] font-mono">/docs/USE_CASES.md</code>
          </span>
        </div>

        {/* Scrollable Content Pane */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 text-stone-800 dark:text-stone-200">
          
          {activeTab === 'narratives' && (
            <div className="space-y-6 max-w-4xl mx-auto">
              
              {/* Quick Jump Index */}
              <div className="p-4 rounded-xl bg-stone-50 dark:bg-stone-850 border border-stone-200 dark:border-stone-800">
                <h4 className="text-xs font-bold text-stone-900 dark:text-white uppercase tracking-wider mb-2.5">
                  Index of Formal Use Case Specifications
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                  <a href="#uc01" className="text-[#8B181B] dark:text-red-400 hover:underline">UC-01: Multi-Factor Authentication</a>
                  <a href="#uc02" className="text-[#8B181B] dark:text-red-400 hover:underline">UC-02: Security Audit & Sharing Alert</a>
                  <a href="#uc03" className="text-[#8B181B] dark:text-red-400 hover:underline">UC-03: Suspension & Lock Scheduler</a>
                  <a href="#uc04" className="text-[#8B181B] dark:text-red-400 hover:underline">UC-04: Registrar Clearance & Degree</a>
                  <a href="#uc05" className="text-[#8B181B] dark:text-red-400 hover:underline">UC-05: Digital Alumni ID</a>
                  <a href="#uc06" className="text-[#8B181B] dark:text-red-400 hover:underline">UC-06: Interactive Social Feed</a>
                  <a href="#uc07" className="text-[#8B181B] dark:text-red-400 hover:underline">UC-07: Alumni Directory Search</a>
                  <a href="#uc08" className="text-[#8B181B] dark:text-red-400 hover:underline">UC-08: Gated Peer Direct Messaging</a>
                  <a href="#uc09" className="text-[#8B181B] dark:text-red-400 hover:underline">UC-09: Employer Partner Accreditation</a>
                  <a href="#uc10" className="text-[#8B181B] dark:text-red-400 hover:underline">UC-10: Job Applications & PDF Resume</a>
                  <a href="#uc11" className="text-[#8B181B] dark:text-red-400 hover:underline">UC-11: Reunions & Confirmed Guests</a>
                  <a href="#uc12" className="text-[#8B181B] dark:text-red-400 hover:underline">UC-12: Bulletins & Push Broadcasts</a>
                  <a href="#uc13" className="text-[#8B181B] dark:text-red-400 hover:underline">UC-13: Superadmin Staff Governance</a>
                </div>
              </div>

              {/* UC-01 */}
              <div id="uc01" className="p-5 rounded-2xl bg-white dark:bg-stone-850 border border-stone-200 dark:border-stone-800 shadow-2xs space-y-3">
                <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-2.5">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-900/50">
                      Identity & Security
                    </span>
                    <h3 className="text-base font-bold text-stone-900 dark:text-white mt-1">
                      UC-01: Multi-Factor & Biometric User Authentication
                    </h3>
                  </div>
                  <span className="text-xs text-stone-400 font-mono">User-Goal Level</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div><strong>Primary Actor:</strong> Registered User (All Roles)</div>
                  <div><strong>Scope:</strong> Authentication Subsystem</div>
                  <div><strong>Preconditions:</strong> Account status is ACTIVE; credentials exist.</div>
                  <div><strong>Trigger:</strong> User submits credentials or selects Biometrics.</div>
                </div>
                <div className="text-xs space-y-1.5 pt-2">
                  <p className="font-bold text-stone-900 dark:text-white">Main Success Scenario (MSS):</p>
                  <ol className="list-decimal pl-5 space-y-1 text-stone-600 dark:text-stone-300">
                    <li>User enters institutional username/email and password.</li>
                    <li>System derives 256-bit PBKDF2 key over 100,000 iterations (SHA-256).</li>
                    <li>System verifies password hash against encrypted vault.</li>
                    <li>System confirms account status is ACTIVE.</li>
                    <li>System records audit log <code className="text-[#8B181B]">USER_LOGIN</code> (Status: NORMAL, No warning icon).</li>
                    <li>System registers active device telemetry and session timestamp.</li>
                    <li>System issues signed session token and admits user.</li>
                  </ol>
                  <p className="font-bold text-stone-900 dark:text-white pt-2">Extensions / Alternative Flows:</p>
                  <ul className="list-disc pl-5 space-y-1 text-stone-600 dark:text-stone-300">
                    <li><strong>3a. Single failed attempt:</strong> System logs <code className="text-amber-600">FAILED_LOGIN_ATTEMPT</code> (Status: WARNING, ⚠️ Yes). Password never logged.</li>
                    <li><strong>3b. 3 consecutive failures:</strong> System logs <code className="text-amber-600">MULTIPLE_FAILED_LOGIN_ATTEMPTS</code> (Status: SUSPICIOUS, ⚠️ Yes).</li>
                    <li><strong>3c. 5 consecutive failures:</strong> System locks account; logs <code className="text-red-600">ACCOUNT_LOCKED</code> (Status: LOCKED, ⚠️ Yes). Admin notified.</li>
                    <li><strong>1b. WebAuthn:</strong> User presents fingerprint/Face ID; system validates assertion and logs user in immediately.</li>
                  </ul>
                </div>
              </div>

              {/* UC-02 */}
              <div id="uc02" className="p-5 rounded-2xl bg-white dark:bg-stone-850 border border-stone-200 dark:border-stone-800 shadow-2xs space-y-3">
                <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-2.5">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-900/50">
                      Threat Intelligence
                    </span>
                    <h3 className="text-base font-bold text-stone-900 dark:text-white mt-1">
                      UC-02: Security Audit Logging & Real-Time Suspicious Account Sharing Detection
                    </h3>
                  </div>
                  <span className="text-xs text-stone-400 font-mono">Automated Daemon</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div><strong>Primary Actor:</strong> Automated Security Daemon</div>
                  <div><strong>Secondary Actor:</strong> System Administrator</div>
                  <div><strong>Preconditions:</strong> Active multi-endpoint requests detected.</div>
                  <div><strong>Trigger:</strong> Concurrent session or velocity anomaly occurs.</div>
                </div>
                <div className="text-xs space-y-1.5 pt-2">
                  <p className="font-bold text-stone-900 dark:text-white">Policy & Main Success Scenario:</p>
                  <p className="text-stone-600 dark:text-stone-300">
                    System enforces: <em>Different devices or IP addresses alone do NOT trigger suspicious sharing</em> (normal phone + laptop usage). When genuine concurrent contradiction or impossible velocity occurs:
                  </p>
                  <ol className="list-decimal pl-5 space-y-1 text-stone-600 dark:text-stone-300">
                    <li>Security daemon detects conflicting concurrent interactions.</li>
                    <li>System records audit entry <code className="text-amber-600">MULTIPLE_USERS_SAME_ACCOUNT</code>.</li>
                    <li>Status marked <code className="font-bold">SUSPICIOUS</code> with warning icon (⚠️ Yes).</li>
                    <li>System records device signatures and session timestamps.</li>
                    <li>Real-time alert toast dispatched to administrators.</li>
                  </ol>
                </div>
              </div>

              {/* UC-03 */}
              <div id="uc03" className="p-5 rounded-2xl bg-white dark:bg-stone-850 border border-stone-200 dark:border-stone-800 shadow-2xs space-y-3">
                <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-2.5">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-red-700 bg-red-50 dark:bg-red-950/50 px-2 py-0.5 rounded border border-red-200 dark:border-red-900/50">
                      Governance Engine
                    </span>
                    <h3 className="text-base font-bold text-stone-900 dark:text-white mt-1">
                      UC-03: Administrative Account Suspension Scheduler & Reason Management
                    </h3>
                  </div>
                  <span className="text-xs text-stone-400 font-mono">User-Goal Level</span>
                </div>
                <div className="text-xs space-y-1.5">
                  <p className="font-bold text-stone-900 dark:text-white">Workflow:</p>
                  <ol className="list-decimal pl-5 space-y-1 text-stone-600 dark:text-stone-300">
                    <li>Admin selects "Suspend" on user (alumni, registrar, faculty, staff, employer).</li>
                    <li>Modal prompts for duration: 1 hour, 24 hours, 3 days, 7 days, 15 days, 30 days, or custom.</li>
                    <li>Admin enters <strong>mandatory Reason for Account Suspension</strong>.</li>
                    <li>System sets user status to <code className="font-bold">SUSPENDED</code>, saves start/end dates and reason.</li>
                    <li>System generates audit log <code className="text-red-700">ACCOUNT_SUSPENDED</code> (Status: SUSPENDED, ⚠️ Yes).</li>
                    <li>When expiration timestamp arrives, Security Engine auto-restores to ACTIVE (<code className="text-emerald-700">ACCOUNT_AUTO_RESTORED</code>, NORMAL, No icon).</li>
                    <li>If Admin manually restores early: <code className="text-emerald-700">ADMIN_UNLOCKED_ACCOUNT</code> (NORMAL, No icon).</li>
                  </ol>
                </div>
              </div>

              {/* UC-04 */}
              <div id="uc04" className="p-5 rounded-2xl bg-white dark:bg-stone-850 border border-stone-200 dark:border-stone-800 shadow-2xs space-y-3">
                <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-2.5">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-900/50">
                      Academic Registry
                    </span>
                    <h3 className="text-base font-bold text-stone-900 dark:text-white mt-1">
                      UC-04: Registrar Clearance & Academic Degree Verification
                    </h3>
                  </div>
                  <span className="text-xs text-stone-400 font-mono">Registrar Role</span>
                </div>
                <div className="text-xs space-y-1 text-stone-600 dark:text-stone-300">
                  <p>Registrar cross-verifies Student ID format (<code className="font-mono">YYYY-NNNNN</code>) against masterlist, verifies Latin honors, inspects department clearance, and clicks "Approve & Certify Graduate". Graduate profile receives verified badge (<code className="text-emerald-600">ShieldCheck</code>) and is admitted to the alumni directory.</p>
                </div>
              </div>

              {/* UC-05 to UC-13 summary cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-4 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700">
                  <h4 className="font-bold text-stone-900 dark:text-white">UC-05: Digital Alumni ID</h4>
                  <p className="text-stone-500 mt-1">Renders front and back 3D perspective flip with signature crimson gradient (#8B181B), gold trim, transparent seal, and turnstile QR code.</p>
                </div>
                <div className="p-4 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700">
                  <h4 className="font-bold text-stone-900 dark:text-white">UC-06: Interactive Social Feed</h4>
                  <p className="text-stone-500 mt-1">Single reaction ("Heart" only), reactor inspection modal, self-congratulations prevention, author edit/delete controls, and automatic profile feed sync.</p>
                </div>
                <div className="p-4 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700">
                  <h4 className="font-bold text-stone-900 dark:text-white">UC-07: Verified Alumni Directory</h4>
                  <p className="text-stone-500 mt-1">Excludes pending or suspended accounts; administrative accounts (admin, superadmin, moderator) hidden from public alumni view.</p>
                </div>
                <div className="p-4 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700">
                  <h4 className="font-bold text-stone-900 dark:text-white">UC-08: Gated Peer Direct Messaging</h4>
                  <p className="text-stone-500 mt-1">Features sticky header in chat view; requires mutual connection (isConnected === true) before message composer is unlocked.</p>
                </div>
                <div className="p-4 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700">
                  <h4 className="font-bold text-stone-900 dark:text-white">UC-09 & UC-10: Career Center</h4>
                  <p className="text-stone-500 mt-1">Desktop-only employer registration, corporate accreditation, alumni job applications, and automated two-column PDF resume generation.</p>
                </div>
                <div className="p-4 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700">
                  <h4 className="font-bold text-stone-900 dark:text-white">UC-11 & UC-12: Events & Bulletins</h4>
                  <p className="text-stone-500 mt-1">Confirmed guest roster filtering (status: 'going'), high dark-mode contrast for bulletins, and VAPID push notification alerts.</p>
                </div>
                <div className="p-4 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 md:col-span-2">
                  <h4 className="font-bold text-stone-900 dark:text-white">UC-13: Superadmin Protection Guardrail</h4>
                  <p className="text-stone-500 mt-1">Role switching allowed strictly between staff/moderator/admin tiers; delete button on administrator accounts is rendered exclusively to the Superadmin.</p>
                </div>
              </div>

            </div>
          )}

          {activeTab === 'plantuml' && (
            <div className="space-y-4 max-w-4xl mx-auto">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-stone-900 dark:text-white">PlantUML Source Specification</h3>
                  <p className="text-xs text-stone-500">Paste into PlantUML, VS Code, or PlantText to render the complete vector diagram.</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(plantUmlCode, 'plantuml')}
                  className="px-3.5 py-1.5 bg-[#8B181B] hover:bg-[#721316] text-white rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedSection === 'plantuml' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSection === 'plantuml' ? 'Copied!' : 'Copy PlantUML'}</span>
                </button>
              </div>

              <pre className="p-4 rounded-xl bg-stone-900 text-stone-100 font-mono text-xs overflow-x-auto leading-relaxed border border-stone-800 select-all">
                {plantUmlCode}
              </pre>
            </div>
          )}

          {activeTab === 'ascii' && (
            <div className="space-y-4 max-w-4xl mx-auto">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-stone-900 dark:text-white">ASCII Box System Boundary Diagram</h3>
                  <p className="text-xs text-stone-500">Fixed-width Unicode representation for markdown documents and terminals.</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(asciiDiagram, 'ascii')}
                  className="px-3.5 py-1.5 bg-stone-800 hover:bg-stone-700 text-white rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedSection === 'ascii' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSection === 'ascii' ? 'Copied!' : 'Copy ASCII'}</span>
                </button>
              </div>

              <pre className="p-4 rounded-xl bg-stone-900 text-stone-100 font-mono text-xs overflow-x-auto leading-relaxed border border-stone-800 select-all">
                {asciiDiagram}
              </pre>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 border-t border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-850 flex items-center justify-between gap-3 text-xs text-stone-500">
          <span className="truncate">St. Cecilia's College - Cebu, Inc. • Alumnet Engineering Documentation</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-stone-200 hover:bg-stone-300 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 rounded-xl font-bold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
