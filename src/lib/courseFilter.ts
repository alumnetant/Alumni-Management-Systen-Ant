/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type CourseFilterValue =
  | 'all'
  | 'BSED | BEED'
  | 'BSIT | ACT'
  | 'BSCrim'
  | 'BSNURSING'
  | 'BSHM | BSTM'
  | 'BSBA | BSMA';

export interface CourseFilterOption {
  value: CourseFilterValue;
  label: string;
  description: string;
}

export const COURSE_FILTER_OPTIONS: readonly CourseFilterOption[] = [
  {
    value: 'all',
    label: 'All Courses',
    description: 'Show all available courses'
  },
  {
    value: 'BSED | BEED',
    label: 'BSED | BEED',
    description: 'Secondary & Elementary Education'
  },
  {
    value: 'BSIT | ACT',
    label: 'BSIT | ACT',
    description: 'Information & Computer Technology'
  },
  {
    value: 'BSCrim',
    label: 'BSCrim',
    description: 'Bachelor of Science in Criminology'
  },
  {
    value: 'BSNURSING',
    label: 'BSNURSING',
    description: 'Bachelor of Science in Nursing'
  },
  {
    value: 'BSHM | BSTM',
    label: 'BSHM | BSTM',
    description: 'Hospitality & Tourism Management'
  },
  {
    value: 'BSBA | BSMA',
    label: 'BSBA | BSMA',
    description: 'Business Administration & Management Accounting'
  }
] as const;

interface CourseMatcherRule {
  patterns: RegExp[];
  phrases: string[];
}

const COURSE_GROUP_MATCHERS: Record<Exclude<CourseFilterValue, 'all'>, CourseMatcherRule> = {
  'BSED | BEED': {
    patterns: [
      /\bbsed\b/i,
      /\bbeed\b/i,
      /\bb\.?\s*s\.?\s*ed\b/i,
      /\bb\.?\s*e\.?\s*ed\b/i
    ],
    phrases: [
      'bsed | beed',
      'secondary education',
      'elementary education',
      'teacher education',
      'b.s. education',
      'bs education',
      'bachelor of secondary education',
      'bachelor of elementary education',
      'bachelor of science in education',
      'education'
    ]
  },
  'BSIT | ACT': {
    patterns: [
      /\bbsit\b/i,
      /\bact\b/i,
      /\bb\.?\s*s\.?\s*it\b/i
    ],
    phrases: [
      'bsit | act',
      'information technology',
      'computer technology',
      'associate in computer'
    ]
  },
  BSCrim: {
    patterns: [
      /\bbscrim\b/i,
      /\bb\.?\s*s\.?\s*crim\b/i
    ],
    phrases: [
      'bscrim',
      'criminology'
    ]
  },
  BSNURSING: {
    patterns: [
      /\bbsnursing\b/i,
      /\bbsn\b/i,
      /\bb\.?\s*s\.?\s*n\b/i
    ],
    phrases: [
      'bsnursing',
      'nursing'
    ]
  },
  'BSHM | BSTM': {
    patterns: [
      /\bbshm\b/i,
      /\bbstm\b/i,
      /\bb\.?\s*s\.?\s*hm\b/i,
      /\bb\.?\s*s\.?\s*tm\b/i,
      /\bbshrm\b/i
    ],
    phrases: [
      'bshm | bstm',
      'hospitality management',
      'tourism management',
      'hospitality',
      'tourism',
      'hotel and restaurant'
    ]
  },
  'BSBA | BSMA': {
    patterns: [
      /\bbsba\b/i,
      /\bbsma\b/i,
      /\bbsa\b/i,
      /\bb\.?\s*s\.?\s*ba\b/i,
      /\bb\.?\s*s\.?\s*ma\b/i
    ],
    phrases: [
      'bsba | bsma',
      'business administration',
      'management accounting',
      'accountancy'
    ]
  }
};

/**
 * Checks whether a record's course string matches the currently selected course filter.
 * When `selectedCourse` is `'all'` or empty, every record matches.
 */
export function matchesCourseFilter(
  courseValue: string | null | undefined,
  selectedCourse: string
): boolean {
  if (!selectedCourse || selectedCourse === 'all') {
    return true;
  }

  const normalizedCourse = (courseValue || '').trim().toLowerCase();
  if (!normalizedCourse) {
    return false;
  }

  const rule = COURSE_GROUP_MATCHERS[selectedCourse as Exclude<CourseFilterValue, 'all'>];
  if (rule) {
    if (rule.phrases.some((phrase) => normalizedCourse.includes(phrase))) {
      return true;
    }
    if (rule.patterns.some((pattern) => pattern.test(normalizedCourse))) {
      return true;
    }
    return false;
  }

  // Fallback for any custom/legacy filter string
  const normalizedSelected = selectedCourse.trim().toLowerCase();
  return normalizedCourse === normalizedSelected || normalizedCourse.includes(normalizedSelected);
}
