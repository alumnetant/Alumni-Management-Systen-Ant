# Plan: Precision Multi-Factor Algorithm for "Matched For Me" Job Board

This plan upgrades the job board's matching engine from a loose heuristic with arbitrary base points into a **mathematically rigorous, multi-factor qualification engine**. It heavily weights verified skills and academic program alignment, provides transparent qualification breakdowns, and ensures exact parity between what the candidate sees and what employers evaluate.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> **Confirmed Specifications**:
> 1. **Core Weighting Distribution**:
>    - **45% Verified Skills Compatibility**: Semantic alias matching (e.g. React/React.js, Node/Node.js, Accounting/CPA) and overlap ratio against required job skills.
>    - **30% Academic Program & College Alignment**: Cluster matching across St. Cecilia's faculties (CCS, CBA, CTHM, COE, CCJ) or universal credit for roles open to all majors.
>    - **15% Experience Level & Seniority**: Graduation batch recency and work history alignment with job tier (Internship, Entry-Level, Associate, Mid/Senior).
>    - **10% Geographic & Work Arrangement**: Remote, hybrid, or Cebu regional location compatibility.
> 2. **Elimination of Arbitrary Base Floor**: Removes the `let score = 50` floor. Postings with zero matching qualifications will correctly score near 0% and will **never** appear in the "Matched For Me" view.
> 3. **Precision Filter Threshold**: "Matched For Me" filters exclusively for roles achieving **≥ 65% compatibility** with verified skill or academic alignment.
> 4. **Unified Parity**: The precision calculation is shared between `OpportunitiesView.tsx`, `AlumniContext.tsx` (`applyForJob`), and the employer applicant tracker (`JobApplicantsTrackerModal.tsx`).

---

## 1. Mathematical Scoring Formula

$$\text{Final Match Score} = \min(100, \text{SkillScore} + \text{ProgramScore} + \text{SeniorityScore} + \text{LocationScore})$$

```
  ┌──────────────────────────────────────────────────────────────┐
  │                 TOTAL MATCH SCORE (100%)                     │
  ├──────────────────────────────────────────────────────────────┤
  │ [45%] Skills Match                                           │
  │   - Matched Skills Ratio: (matched / required) * 35          │
  │   - Core Skill Bonus: +10 if at least 2 key skills match     │
  ├──────────────────────────────────────────────────────────────┤
  │ [30%] Academic Program Match                                 │
  │   - Exact Major Match: +30 (e.g., BSIT <-> BSIT)             │
  │   - Same College Cluster: +20 (e.g., BSCS <-> BSIT)          │
  │   - Open to All Majors: +30                                  │
  │   - Unrelated Major: 0                                       │
  ├──────────────────────────────────────────────────────────────┤
  │ [15%] Experience & Seniority Fit                             │
  │   - Entry/Associate <-> Batches 2021-2026: +15               │
  │   - Mid/Senior <-> Documented Experience >= 3 yrs: +15       │
  ├──────────────────────────────────────────────────────────────┤
  │ [10%] Location & Work Style                                  │
  │   - Remote / Anywhere: +10                                   │
  │   - Cebu Local (Minglanilla, Talisay, Cebu City): +10        │
  └──────────────────────────────────────────────────────────────┘
```

---

## 2. Proposed Changes by File

### Step 1: Create Centralized Precision Matching Utility (`src/services/jobMatchingService.ts`)
- Implement a dedicated, testable engine:
  - `computePreciseJobMatch(user: UserProfile, job: Opportunity): JobMatchResult`
  - Normalized skill aliases dictionary (frontend, backend, design, data, finance, administration, hospitality, education, law enforcement).
  - St. Cecilia's academic program clusters (CCS, CBA, CTHM, COE, CCJ).
  - Returns:
    ```ts
    interface JobMatchResult {
      score: number;             // 0 to 100
      isQualified: boolean;      // score >= 65%
      tier: 'high' | 'moderate' | 'low'; // high >= 80, mod >= 65
      matchedSkills: string[];
      missingSkills: string[];
      programMatchStatus: 'exact' | 'cluster' | 'open' | 'unrelated';
      programMatchLabel: string;
      experienceFit: boolean;
      locationFit: boolean;
      breakdown: {
        skillsScore: number;
        programScore: number;
        experienceScore: number;
        locationScore: number;
      };
    }
    ```

### Step 2: Upgrade "Matched For Me" in the Job Board (`src/components/opportunities/OpportunitiesView.tsx`)
- Replace the legacy `computeUserMatch` with the new `jobMatchingService`.
- Update `matchOnly` filter:
  - When "Matched For Me" is toggled ON, display only opportunities where `result.isQualified` (`score >= 65`).
  - Sort results by descending match score when the filter is active.
- Enhance job cards with precise, transparent visual feedback:
  - Compatibility percentage badge with color-coded confidence: Emerald (80–100%), Amber (65–79%).
  - Skill coverage indicator: e.g. "3 of 4 skills matched" with highlighted matching skill tags.
  - Program alignment tag: e.g. "BSIT Direct Match" or "Open to All Majors".
  - Interactive tooltip or modal popover detailing the exact score breakdown.

### Step 3: Synchronize with Application Store (`src/context/AlumniContext.tsx`)
- Update `applyForJob` to use `computePreciseJobMatch`.
- Persist the identical `matchScore` and detailed `matchBreakdown` to Firestore and the backend API, ensuring candidates and employers see synchronized numbers.

---

## 3. Verification Plan

1. **Compilation & Linting**:
   - Run `compile_applet` and `lint_applet` to guarantee clean builds.
2. **Precision Algorithm Unit Tests**:
   - Test a BSIT graduate with `['React', 'TypeScript', 'Tailwind']` against:
     - Frontend Dev job requiring `['React', 'Tailwind']` -> Expected: ~90–100% High Match.
     - Accounting / Finance role requiring `['QuickBooks', 'Tax Compliance']` -> Expected: 10–20% (strictly excluded from "Matched For Me").
     - General Customer Relations role open to all majors -> Expected: ~70–80% Moderate Match.
3. **UI & Filter Validation**:
   - Toggle "Matched For Me" and verify that only legitimately qualified postings remain.
   - Verify that matching skill tags render with checkmarks and that clicking a job displays the transparent breakdown.
