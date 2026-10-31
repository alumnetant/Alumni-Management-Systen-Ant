import { describe, it, expect } from 'vitest';
import { Opportunity, UserProfile } from '../src/types';
import { computePreciseJobMatch } from '../src/services/jobMatchingService';

describe('Partnered Company Postings Logic', () => {
  const mockCompany: UserProfile = {
    uid: 'emp_archipelago_01',
    name: 'Archipelagic Systems Inc.',
    companyName: 'Archipelagic Systems Inc.',
    email: 'careers@archipelago.ph',
    role: 'employer',
    location: 'Cebu IT Park, Cebu City',
    profilePictureUrl: '',
    coverPhotoUrl: '',
    headline: 'Corporate Recruiting Partner',
    about: 'Enterprise cloud systems provider.',
    phone: '+63 917 123 4567',
    followersCount: 10,
    followingCount: 0,
    connectionsCount: 0,
    experience: [],
    education: [],
    createdAt: new Date().toISOString()
  };

  const mockOpportunities: Opportunity[] = [
    {
      id: 'job_01',
      title: 'Junior Full Stack Engineer',
      type: 'Full-time',
      company: 'Archipelagic Systems Inc.',
      location: 'Cebu IT Park',
      description: 'Build enterprise React and Node.js solutions.',
      requiredCourse: 'B.S. Information Technology',
      skills: ['React', 'TypeScript', 'Node.js', 'PostgreSQL'],
      salaryOrStipend: '₱35,000 - ₱45,000/mo',
      postedBy: 'emp_archipelago_01',
      status: 'active',
      approvalStatus: 'approved'
    },
    {
      id: 'job_02',
      title: 'Cloud Infrastructure Intern',
      type: 'Internship',
      company: 'Archipelagic Systems Inc.',
      location: 'Remote (PH)',
      description: 'Hands-on cloud architecture internship.',
      requiredCourse: 'B.S. Computer Science',
      skills: ['Docker', 'AWS', 'Linux'],
      salaryOrStipend: '₱15,000 stipend/mo',
      postedBy: 'emp_archipelago_01',
      status: 'active',
      approvalStatus: 'approved'
    },
    {
      id: 'job_03',
      title: 'Closed Position',
      type: 'Full-time',
      company: 'Archipelagic Systems Inc.',
      location: 'Cebu City',
      description: 'Old role that has closed.',
      postedBy: 'emp_archipelago_01',
      status: 'closed',
      approvalStatus: 'approved'
    },
    {
      id: 'job_04',
      title: 'Unrelated Company Job',
      type: 'Full-time',
      company: 'Other Global Tech',
      location: 'Manila',
      description: 'Different company posting.',
      postedBy: 'other_emp_uid',
      status: 'active',
      approvalStatus: 'approved'
    }
  ];

  it('filters only active approved postings for the selected partnered company', () => {
    const compKey = (mockCompany.companyName || '').toLowerCase().trim();

    const companyJobs = mockOpportunities.filter((opp) => {
      if (opp.status === 'closed') return false;
      if (opp.approvalStatus && opp.approvalStatus !== 'approved') return false;

      const oppComp = (opp.company || '').toLowerCase().trim();
      const isNameMatch = oppComp === compKey || (oppComp && oppComp.includes(compKey));
      const isUidMatch = Boolean(opp.postedBy && opp.postedBy === mockCompany.uid);

      return isNameMatch || isUidMatch;
    });

    expect(companyJobs.length).toBe(2);
    expect(companyJobs.map((j) => j.id)).toEqual(['job_01', 'job_02']);
    expect(companyJobs.some((j) => j.id === 'job_03')).toBe(false);
    expect(companyJobs.some((j) => j.id === 'job_04')).toBe(false);
  });

  it('computes positive candidate match score for matching program and verified skills', () => {
    const mockAlumnus: Partial<UserProfile> = {
      uid: 'alum_001',
      name: 'Maria Santos',
      course: 'B.S. Information Technology',
      skills: ['React', 'TypeScript', 'Node.js', 'Teamwork']
    };

    const targetJob = mockOpportunities[0];
    const match = computePreciseJobMatch(mockAlumnus as UserProfile, targetJob);

    expect(match.score).toBeGreaterThanOrEqual(60);
    expect(match.programMatchStatus).toBe('exact');
    expect(match.matchedSkills).toContain('React');
    expect(match.matchedSkills).toContain('TypeScript');
  });
});
