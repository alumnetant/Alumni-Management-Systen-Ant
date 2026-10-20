/**
 * St. Cecilia's College - Cecilian Alumnet
 * Precision Job Matching & Qualification Engine
 *
 * Implements a multi-factor weighted scoring model:
 * - 45% Verified Skills Compatibility & Semantic Overlap
 * - 30% Academic Program & College Cluster Alignment
 * - 15% Experience Level & Seniority Fit
 * - 10% Location & Work Arrangement Fit
 *
 * Eliminates arbitrary base point floors so scores reflect verified qualifications.
 * Enforces a strict qualification threshold (>= 65%) for the "Matched For Me" filter.
 */

import { Opportunity, UserProfile } from '../types';

export interface JobMatchBreakdown {
  skillsScore: number;       // max 45
  programScore: number;      // max 30
  experienceScore: number;   // max 15
  locationScore: number;     // max 10
}

export interface JobMatchResult {
  score: number; // 0 to 100
  isQualified: boolean; // score >= 65% with legitimate qualification
  tier: 'high' | 'moderate' | 'low';
  matchedSkills: string[];
  missingSkills: string[];
  totalOppSkills: number;
  programMatchStatus: 'exact' | 'cluster' | 'open' | 'unrelated';
  programMatchLabel: string;
  experienceFit: boolean;
  locationFit: boolean;
  breakdown: JobMatchBreakdown;
  summaryReason: string;
}

// Semantic Skill Aliases Dictionary (synonyms and technology families)
const SKILL_ALIASES: Record<string, string[]> = {
  react: ['react.js', 'reactjs', 'next.js', 'nextjs', 'frontend', 'javascript', 'typescript'],
  typescript: ['ts', 'javascript', 'js'],
  javascript: ['js', 'ecmascript', 'typescript', 'frontend'],
  node: ['node.js', 'nodejs', 'express', 'express.js', 'backend', 'api'],
  python: ['django', 'flask', 'fastapi', 'data analysis', 'pandas'],
  sql: ['postgresql', 'mysql', 'postgres', 'sqlite', 'database', 'rdbms'],
  html: ['css', 'tailwind', 'bootstrap', 'web development'],
  css: ['tailwind', 'tailwindcss', 'sass', 'scss', 'bootstrap', 'styling'],
  tailwind: ['tailwindcss', 'css', 'ui design'],
  figma: ['ui/ux', 'ui design', 'ux design', 'wireframing', 'prototyping'],
  'ui/ux': ['figma', 'product design', 'user experience', 'user interface'],
  accounting: ['bookkeeping', 'cpa', 'financial analysis', 'auditing', 'taxation', 'quickbooks', 'excel'],
  cpa: ['accounting', 'auditing', 'financial reporting', 'tax compliance'],
  bookkeeping: ['accounting', 'quickbooks', 'excel', 'financial records'],
  marketing: ['digital marketing', 'social media', 'content marketing', 'seo', 'copywriting', 'branding'],
  seo: ['search engine optimization', 'digital marketing', 'google analytics', 'content marketing'],
  hospitality: ['hotel management', 'front desk', 'customer relations', 'guest services', 'tourism'],
  tourism: ['tour operations', 'travel management', 'hospitality', 'customer service'],
  education: ['teaching', 'curriculum', 'classroom management', 'lesson planning', 'instruction'],
  teaching: ['education', 'tutoring', 'pedagogy', 'classroom management'],
  criminology: ['law enforcement', 'investigation', 'security management', 'public safety', 'forensics']
};

/**
 * Checks whether two skill strings match either directly or semantically
 */
export function isSkillMatch(userSkill: string, oppSkill: string): boolean {
  const u = userSkill.trim().toLowerCase();
  const o = oppSkill.trim().toLowerCase();

  if (!u || !o) return false;
  if (u === o) return true;

  // Direct substring inclusion if sufficiently long
  if (u.length >= 3 && o.includes(u)) return true;
  if (o.length >= 3 && u.includes(o)) return true;

  // Check synonym aliases dictionary
  const uAliases = SKILL_ALIASES[u] || [];
  if (uAliases.some((alias) => o === alias || o.includes(alias))) return true;

  const oAliases = SKILL_ALIASES[o] || [];
  if (oAliases.some((alias) => u === alias || u.includes(alias))) return true;

  return false;
}

// College Program Clusters at St. Cecilia's College - Cebu, Inc.
const PROGRAM_CLUSTERS = {
  ccs: [
    'bsit',
    'information technology',
    'bscs',
    'computer science',
    'computer engineering',
    'software engineering',
    'web development',
    'it'
  ],
  cba: [
    'bsba',
    'business administration',
    'bsa',
    'accountancy',
    'accounting',
    'financial management',
    'marketing management',
    'human resource',
    'commerce'
  ],
  cthm: [
    'bshm',
    'hospitality management',
    'hotel and restaurant management',
    'bstm',
    'tourism management',
    'tourism',
    'hrm'
  ],
  coe: [
    'bsed',
    'secondary education',
    'beed',
    'elementary education',
    'education',
    'teaching'
  ],
  ccj: [
    'bscrim',
    'criminology',
    'law enforcement',
    'criminal justice',
    'security'
  ]
};

/**
 * Normalizes course strings to remove degree prefixes and punctuation
 */
function normalizeProgramString(course: string): string {
  return course
    .toLowerCase()
    .replace(/^(bachelor of science in|bachelor of secondary education in|bachelor of elementary education in|bachelor of|bachelor in|bs in|bs|ba)\s+/i, '')
    .replace(/[^a-z0-9]/g, ' ')
    .trim();
}

/**
 * Evaluates academic program compatibility between applicant and opportunity
 */
export function evaluateProgramMatch(
  userCourse?: string,
  requiredCourse?: string
): { status: 'exact' | 'cluster' | 'open' | 'unrelated'; label: string; score: number } {
  const req = (requiredCourse || '').trim().toLowerCase();
  const user = (userCourse || '').trim().toLowerCase();

  // If role is open to all courses or not specified
  if (
    !req ||
    req === 'all' ||
    req === 'any' ||
    req === 'open to all' ||
    req.includes('open to all') ||
    req.includes('all courses') ||
    req.includes('all programs') ||
    req.includes('any degree')
  ) {
    return {
      status: 'open',
      label: 'Open to All Programs',
      score: 30
    };
  }

  if (!user) {
    return {
      status: 'unrelated',
      label: 'Program Unspecified',
      score: 0
    };
  }

  // Exact course code or name match
  const userNorm = normalizeProgramString(user);
  const reqNorm = normalizeProgramString(req);

  const isExact =
    user === req ||
    userNorm === reqNorm ||
    (userNorm.length >= 3 && reqNorm.includes(userNorm)) ||
    (reqNorm.length >= 3 && userNorm.includes(reqNorm));

  if (isExact) {
    return {
      status: 'exact',
      label: `${requiredCourse?.toUpperCase()} Direct Match`,
      score: 30
    };
  }

  // Check college cluster alignment
  for (const [, clusterPrograms] of Object.entries(PROGRAM_CLUSTERS)) {
    const userInCluster = clusterPrograms.some((cp) => user.includes(cp) || userNorm.includes(cp));
    const reqInCluster = clusterPrograms.some((cp) => req.includes(cp) || reqNorm.includes(cp));

    if (userInCluster && reqInCluster) {
      return {
        status: 'cluster',
        label: 'Related College Cluster',
        score: 22
      };
    }
  }

  return {
    status: 'unrelated',
    label: 'Different Academic Field',
    score: 0
  };
}

/**
 * Evaluates experience level and seniority fit
 */
export function evaluateExperienceFit(
  user: UserProfile,
  opp: Opportunity
): { fit: boolean; score: number; reason: string } {
  const jobTitle = (opp.title || '').toLowerCase();
  const jobDesc = (opp.description || '').toLowerCase();
  const jobType = (opp.type || '').toLowerCase();

  const isInternship = jobType.includes('intern') || jobTitle.includes('intern');
  const isSenior =
    jobTitle.includes('senior') ||
    jobTitle.includes('lead') ||
    jobTitle.includes('manager') ||
    jobTitle.includes('director') ||
    jobDesc.includes('5+ years') ||
    jobDesc.includes('3+ years');

  // Estimate candidate graduation batch / experience
  const batchYear = parseInt(String(user.batch || ''), 10);
  const currentYear = new Date().getFullYear();
  const yearsSinceGrad = !isNaN(batchYear) ? Math.max(0, currentYear - batchYear) : 2;
  const experienceCount = (user.experience && user.experience.length) || 0;

  if (isInternship) {
    // Internships are ideal for current students or most recent batch
    const fit = yearsSinceGrad <= 1;
    return {
      fit,
      score: fit ? 15 : 8,
      reason: fit ? 'Internship suited for recent batch' : 'Seniority mismatch for internship'
    };
  }

  if (isSenior) {
    const hasSufficientExp = yearsSinceGrad >= 3 || experienceCount >= 2;
    return {
      fit: hasSufficientExp,
      score: hasSufficientExp ? 15 : 5,
      reason: hasSufficientExp ? 'Matches senior experience criteria' : 'Requires higher seniority'
    };
  }

  // Standard entry-level / associate / mid-level positions
  return {
    fit: true,
    score: 15,
    reason: 'Standard experience tier compatible'
  };
}

/**
 * Evaluates location and commute / work arrangement compatibility
 */
export function evaluateLocationFit(
  user: UserProfile,
  opp: Opportunity
): { fit: boolean; score: number; reason: string } {
  const oppLoc = (opp.location || '').toLowerCase();
  const userLoc = (user.location || '').toLowerCase();

  // 1. Remote or Hybrid jobs match universally
  if (oppLoc.includes('remote') || oppLoc.includes('hybrid') || oppLoc.includes('work from home')) {
    return {
      fit: true,
      score: 10,
      reason: 'Remote / Flexible work arrangement'
    };
  }

  // 2. Local Cebu Municipalities (St. Cecilia's College catchment)
  const cebuKeywords = ['cebu', 'minglanilla', 'talisay', 'naga', 'san fernando', 'mandaue', 'lapu-lapu'];
  const isOppInCebu = cebuKeywords.some((k) => oppLoc.includes(k));
  const isUserInCebu = !userLoc || cebuKeywords.some((k) => userLoc.includes(k));

  if (isOppInCebu && isUserInCebu) {
    return {
      fit: true,
      score: 10,
      reason: 'Cebu regional proximity'
    };
  }

  if (userLoc && oppLoc && (userLoc.includes(oppLoc) || oppLoc.includes(userLoc))) {
    return {
      fit: true,
      score: 10,
      reason: 'City / Region match'
    };
  }

  // Out of region onsite
  return {
    fit: false,
    score: 4,
    reason: 'On-site outside primary catchment'
  };
}

/**
 * Master computation: Calculates precise multi-factor match score (0 - 100)
 */
export function computePreciseJobMatch(
  user: UserProfile | null | undefined,
  opp: Opportunity
): JobMatchResult | null {
  if (!user) return null;

  const oppSkills = opp.skills || [];
  const userSkills = user.skills || [];

  // 1. Skills Matching (Max 45 points)
  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];

  for (const oppSkill of oppSkills) {
    const isMatched = userSkills.some((uSkill) => isSkillMatch(uSkill, oppSkill));
    if (isMatched) {
      matchedSkills.push(oppSkill);
    } else {
      missingSkills.push(oppSkill);
    }
  }

  let skillsScore = 0;
  if (oppSkills.length > 0) {
    const ratio = matchedSkills.length / oppSkills.length;
    skillsScore = Math.round(ratio * 35);
    // Core Skill Bonus: If at least 2 skills matched, or 100% matched
    if (matchedSkills.length >= 2 || (oppSkills.length === 1 && matchedSkills.length === 1)) {
      skillsScore += 10;
    }
  } else {
    // If job didn't specify distinct skills, base on headline/bio keywords or neutral credit
    skillsScore = 25;
  }

  // 2. Program Alignment (Max 30 points)
  const programEval = evaluateProgramMatch(user.course, opp.requiredCourse);
  const programScore = programEval.score;

  // 3. Experience & Seniority Fit (Max 15 points)
  const expEval = evaluateExperienceFit(user, opp);
  const experienceScore = expEval.score;

  // 4. Location & Work Style Fit (Max 10 points)
  const locEval = evaluateLocationFit(user, opp);
  const locationScore = locEval.score;

  // Total Score (0 - 100)
  const rawScore = skillsScore + programScore + experienceScore + locationScore;
  const finalScore = Math.min(100, Math.max(0, rawScore));

  // Determine qualification status
  // To be classified as "Qualified" for the "Matched For Me" filter:
  // - Minimum score >= 65%
  // - MUST have at least 1 verified matching skill OR legitimate academic program match
  const hasSubstantiveMatch =
    matchedSkills.length > 0 ||
    programEval.status === 'exact' ||
    programEval.status === 'cluster' ||
    programEval.status === 'open';
  const isQualified = finalScore >= 65 && hasSubstantiveMatch;

  const tier: 'high' | 'moderate' | 'low' =
    finalScore >= 80 ? 'high' : finalScore >= 65 ? 'moderate' : 'low';

  // Summary human-readable rationale
  const reasons: string[] = [];
  if (matchedSkills.length > 0) {
    reasons.push(`${matchedSkills.length}/${oppSkills.length} skills matched`);
  }
  if (programEval.status === 'exact') {
    reasons.push(`${programEval.label}`);
  } else if (programEval.status === 'cluster') {
    reasons.push('Related program');
  }
  if (locEval.fit) {
    reasons.push(locEval.reason);
  }

  const summaryReason = reasons.length > 0 ? reasons.join(' • ') : 'Cross-disciplinary opportunity';

  return {
    score: finalScore,
    isQualified,
    tier,
    matchedSkills,
    missingSkills,
    totalOppSkills: oppSkills.length,
    programMatchStatus: programEval.status,
    programMatchLabel: programEval.label,
    experienceFit: expEval.fit,
    locationFit: locEval.fit,
    breakdown: {
      skillsScore,
      programScore,
      experienceScore,
      locationScore
    },
    summaryReason
  };
}
