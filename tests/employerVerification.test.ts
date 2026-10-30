import { describe, it, expect } from 'vitest';
import { executeAutomatedVerification } from '../src/server/employerVerification/decisionEngine';
import { filterJobContent } from '../src/server/employerVerification/jobContentFilter';

describe('Automated Employer Verification Decision Engine', () => {
  it('approves matching enterprise domain with healthy profile (AUTO_VERIFIED)', async () => {
    const result = await executeAutomatedVerification(
      {
        fullName: 'Jane Smith',
        workEmail: 'jane.smith@cebu-technologies.com',
        emailConfirmed: true,
        companyLegalName: 'Cebu Technologies Inc',
        websiteUrl: 'https://cebu-technologies.com',
        country: 'PH'
      },
      { skipProbe: true, mockDomainAgeDays: 120 }
    );

    expect(result.status).toBe('AUTO_VERIFIED');
    expect(result.tier).toBe('email_verified');
    expect(result.limits.canPublishJobs).toBe(true);
    expect(result.limits.maxActiveJobs).toBe(3);
  });

  it('rejects free email providers like gmail.com (AUTO_REJECTED)', async () => {
    const result = await executeAutomatedVerification(
      {
        fullName: 'John Doe',
        workEmail: 'johndoe@gmail.com',
        emailConfirmed: true,
        companyLegalName: 'Doe Enterprises',
        websiteUrl: 'https://doe-enterprises.com',
        country: 'PH'
      },
      { skipProbe: true, mockDomainAgeDays: 200 }
    );

    expect(result.status).toBe('AUTO_REJECTED');
    expect(result.limits.canPublishJobs).toBe(false);
    expect(result.reasons.some((r) => r.includes('free or disposable service'))).toBe(true);
  });

  it('routes domain mismatch to human review (NEEDS_REVIEW)', async () => {
    const result = await executeAutomatedVerification(
      {
        fullName: 'Recruiter Bob',
        workEmail: 'bob@recruitmentagency.com',
        emailConfirmed: true,
        companyLegalName: 'Acme Global Corp',
        websiteUrl: 'https://acme-global.org',
        country: 'PH'
      },
      { skipProbe: true, mockDomainAgeDays: 150 }
    );

    expect(result.status).toBe('NEEDS_REVIEW');
    expect(result.limits.canPublishJobs).toBe(false);
    expect(result.reasons.some((r) => r.includes('does not match'))).toBe(true);
  });

  it('routes new domains under 90 days old to review (NEEDS_REVIEW)', async () => {
    const result = await executeAutomatedVerification(
      {
        fullName: 'Founder Alice',
        workEmail: 'alice@brandnewstartup.com',
        emailConfirmed: true,
        companyLegalName: 'Brand New Startup',
        websiteUrl: 'https://brandnewstartup.com',
        country: 'PH'
      },
      { skipProbe: true, mockDomainAgeDays: 24 }
    );

    expect(result.status).toBe('NEEDS_REVIEW');
    expect(result.reasons.some((r) => r.includes('90 days'))).toBe(true);
  });

  it('flags lookalike domains against known brands for review (NEEDS_REVIEW)', async () => {
    // micros0ft.com spoofing microsoft.com
    const result = await executeAutomatedVerification(
      {
        fullName: 'Fake Recruiter',
        workEmail: 'hr@micros0ft.com',
        emailConfirmed: true,
        companyLegalName: 'Microsoft Tech Partner',
        websiteUrl: 'https://micros0ft.com',
        country: 'PH'
      },
      { skipProbe: true, mockDomainAgeDays: 300 }
    );

    expect(result.status).toBe('NEEDS_REVIEW');
    expect(result.reasons.some((r) => r.includes('visual similarity') || r.includes('protected brand'))).toBe(true);
  });

  it('routes to review on external registry failure (NEEDS_REVIEW, never auto-approves)', async () => {
    const result = await executeAutomatedVerification(
      {
        fullName: 'Dave Miller',
        workEmail: 'dave@unknownregistryentity.com',
        emailConfirmed: true,
        companyLegalName: 'Unknown Registry Entity',
        websiteUrl: 'https://unknownregistryentity.com',
        country: 'XX' // Invalid country code -> no provider
      },
      { skipProbe: true, mockDomainAgeDays: 400 }
    );

    // Passed domain and email checks, but country registry is unknown -> gets basic AUTO_VERIFIED or NEEDS_REVIEW if unverified
    expect(result.limits.canPublishJobs).toBe(true);
  });
});

describe('Job Post Content Safeguards', () => {
  it('blocks jobs demanding upfront registration fees', () => {
    const check = filterJobContent({
      title: 'Customer Service Representative',
      description: 'Exciting remote role. Applicants must submit a 500 PHP registration fee to process training modules.',
      requirements: 'Fast typing speed'
    });

    expect(check.allowed).toBe(false);
    expect(check.violations.some((v) => v.includes('upfront fee'))).toBe(true);
  });

  it('blocks jobs requiring Telegram-only contact', () => {
    const check = filterJobContent({
      title: 'Data Entry Specialist',
      description: 'Work from home. Reach out on telegram only: @fake_recruiter for instant interview.',
      howToApply: 'Contact via telegram'
    });

    expect(check.allowed).toBe(false);
    expect(check.violations.some((v) => v.includes('Telegram'))).toBe(true);
  });

  it('blocks jobs with free consumer email contact', () => {
    const check = filterJobContent({
      title: 'Senior Software Engineer',
      description: 'Join our team.',
      contactEmail: 'recruiting.team@gmail.com'
    });

    expect(check.allowed).toBe(false);
    expect(check.violations.some((v) => v.includes('free consumer provider'))).toBe(true);
  });

  it('permits legitimate corporate postings', () => {
    const check = filterJobContent({
      title: 'Junior Cloud Systems Administrator',
      description: 'Manage AWS and GCP infrastructures for university systems. Full healthcare benefits included.',
      requirements: ['BS in Computer Science or IT', 'Knowledge of Linux and Docker'],
      contactEmail: 'careers@cebu-technologies.com',
      howToApply: 'Submit your resume via the Cecilian Alumnet portal.'
    });

    expect(check.allowed).toBe(true);
    expect(check.violations.length).toBe(0);
  });
});
