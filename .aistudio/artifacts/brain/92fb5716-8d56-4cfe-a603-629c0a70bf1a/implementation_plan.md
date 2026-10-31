# Partnered Companies Interactive Postings Showcase

An interactive drawer and modal experience in the Alumni Directory that allows alumni to click any accredited partner company and instantly inspect all career opportunities, internships, and postings published by that employer, complete with instant application workflows and match scoring.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following user preferences were confirmed during Turn 1 clarification:
> - **Display Presentation**: Interactive slide-over drawer modal displaying company credentials and all their posted listings.
> - **Featured Content & Action**: All active job and internship postings published by the company, featuring live candidate skill match scoring and instant "Quick Apply" modal integration.

- **Confirmed Decision 1**: Clicking anywhere on a partnered company card opens the interactive postings showcase modal.
- **Confirmed Decision 2**: Each posting in the company drawer displays full job details (role, stipend/salary, required course, skills) and an instant "Apply Now" button hooked into the existing `JobApplicationModal`.
- **Confirmed Decision 3**: If an alumnus has already applied to a position, the listing displays their real-time application status (`Submitted`, `Under Review`, `Shortlisted`).

---

## 1. Overview & Core Concept

Currently, in the Alumni Directory (`Alumni Roster & Directory`), the **Partnered Companies** tab displays accredited corporate recruiting partners in cards, but clicking them only navigates to the generic Opportunities tab or requires manually searching.

This feature transforms the interaction:
1. **Direct Exploration**: Alumni can click any company card or its "View Postings" button to open a focused, institutional drawer modal.
2. **Comprehensive Postings Aggregator**: The modal dynamically queries and filters all opportunities created by that employer or matching the company name.
3. **Candidate Match & Quick Apply**: Alumni instantly see how their degree program and verified skills match each opening, with a one-click "Apply Now" modal to submit their CV and cover letter directly to that employer.

---

## 2. Visual Design & Aesthetic Direction

In strict alignment with the St. Cecilia's College design guidelines (`AGENTS.md`) and Institutional Editorial standards (`9_museum_editorial_institutional.md`):

- **Surface & Elevation**:
  - Modal overlay with soft backdrop blur (`bg-black/60 backdrop-blur-xs`).
  - Drawer container in crisp white (`dark:bg-stone-900`) with subtle hairline dividers (`border-stone-200/90 dark:border-stone-800`).
  - Institutional crimson accent (`#8B181B`) for primary actions and verified partner badges.
- **Header Banner**:
  - Company avatar/monogram, verified accreditation badge (`Accredited Recruitment Partner`), company sector, location, and official website URL.
  - Quick summary metric: `X Active Postings` and `Talent Pool Acceptance`.
- **Postings List Rhythm**:
  - Breathable cards with generous padding (`p-4 sm:p-5`) and clear optical hierarchy.
  - Job title leading with high-contrast text (`text-stone-900 dark:text-stone-100 font-bold`).
  - Clean unboxed metadata separated by typographic dots (`Full-Time · Cebu City · ₱35,000 - ₱45,000/mo`).
  - Skill tag chips matching candidate profile skills.
- **Anti-Slop Discipline**:
  - No synthetic neon gradients or decorative mock statistics.
  - Clean SVG iconography from `lucide-react` with standardized stroke widths (`strokeWidth={1.75}`).

---

## 3. Technical Architecture & System Flow

```
┌────────────────────────────────────────────────────────┐
│             Alumni Directory (NetworkView)             │
│               [ Partnered Companies Tab ]              │
└───────────────────────────┬────────────────────────────┘
                            │
              User clicks any company card
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│         PartneredCompanyPostingsModal (Drawer)         │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Employer Header: Name, Logo, Address, Industry   │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Active Postings Query Filter:                    │  │
│  │ opportunities.filter(c => c.company === name)    │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Postings List:                                   │  │
│  │ • Job Card 1: Senior Software Eng [Apply Now]   │  │
│  │ • Job Card 2: QA Specialist [Applied: Under Rev] │  │
│  └──────────────────────────────────────────────────┘  │
└───────────────────────────┬────────────────────────────┘
                            │
               User clicks "Apply Now"
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│                 JobApplicationModal                    │
│    (Submits direct application to AlumniContext)      │
└────────────────────────────────────────────────────────┘
```

### Data Synchronization:
- Retrieves opportunities from `useAlumni().opportunities`.
- Matches opportunities by employer user ID (`postedBy === company.uid`) or normalized company name (`opp.company.toLowerCase() === company.companyName.toLowerCase()`).
- Matches existing user applications from `useAlumni().jobApplications` to display real-time application status tags.

---

## 4. Implementation Steps & Workflows

### Step 1: Create `PartneredCompanyPostingsModal.tsx`
- Build a dedicated modal component displaying:
  - Employer profile banner (name, description, contact person, industry, headquarters, website).
  - Search/filter bar within the modal if the company has multiple postings.
  - Active postings feed with salary, required degree, skills tags, and job description.
  - Live candidate qualification preview (skills match percentage).
  - Empty state when the company has no current active listings, offering a "Join Talent Pool" or direct message contact affordance.
  - "Apply Now" button that triggers `JobApplicationModal` with the selected opportunity.

### Step 2: Integrate into `PartneredCompaniesView.tsx`
- Add `selectedCompanyForPostings: UserProfile | null` state.
- Make the entire company card interactive (with hover state and accessible keyboard focus).
- Update the "View Career Opportunities" button to open the postings modal directly instead of navigating away.
- Mount `PartneredCompanyPostingsModal` and wire state transitions.

### Step 3: Connect Job Application & Tracking Flow
- When an alumnus clicks "Apply Now" inside the company postings modal, open `JobApplicationModal` for that specific opportunity.
- Upon successful submission, refresh the posting card to show "Application Submitted" with date and status indicator.

---

## 5. Verification & Testing Criteria

1. **Card Click Interaction**: Clicking on any company card or its primary CTA in the Partnered Companies view opens the company postings drawer immediately.
2. **Accurate Content Query**: All approved postings for that specific company are rendered correctly with accurate details (salary, skills, role type).
3. **Application Handlers**: Clicking "Apply Now" opens the standard application modal with pre-filled alumnus information and submits cleanly to Firestore/Context.
4. **Already-Applied State**: If the logged-in user has already applied to a job from this company, the button reflects their application status (`Applied`).
5. **Quality & Compilation**: Clean build with `tsc --noEmit` and passing vitest test suite.
