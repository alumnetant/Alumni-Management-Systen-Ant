/**
 * Automated Verification Decision Engine
 * Orchestrates email checks, domain matching, domain health, and registry lookups.
 * Produces explainable decisions: AUTO_VERIFIED, AUTO_REJECTED, NEEDS_REVIEW, or VERIFIED.
 */

import { isFreeOrDisposableEmail } from './emailCheck';
import { domainsMatch, extractEmailDomain, normalizeDomain } from './domainMatch';
import { evaluateDomainHealth, DomainHealthResult } from './domainHealth';
import { IRegistryProvider, RegistryQueryResult } from './registry/IRegistryProvider';
import { SecPhilippinesRegistryProvider } from './registry/SecPhilippinesRegistryProvider';

export type VerificationDecisionStatus = 'AUTO_VERIFIED' | 'AUTO_REJECTED' | 'NEEDS_REVIEW' | 'VERIFIED';
export type EmployerTier = 'email_verified' | 'verified' | 'pending';

export interface AutomatedChecksRun {
  emailConfirmed: boolean;
  isFreeOrDisposable: boolean;
  domainMatch: { matches: boolean; reason?: string; emailDomain: string; websiteDomain: string };
  domainHealth: DomainHealthResult;
  registryResult?: RegistryQueryResult;
}

export interface VerificationDecision {
  status: VerificationDecisionStatus;
  tier: EmployerTier;
  reasons: string[];
  checksRun: AutomatedChecksRun;
  limits: {
    maxActiveJobs: number;
    canPublishJobs: boolean;
    badgeLabel: string;
    hasVerifiedBadge: boolean;
  };
  decidedAt: string;
  decidedBy: string; // 'system' or admin ID
}

export interface CompanyRegistrationInput {
  fullName: string;
  workEmail: string;
  emailConfirmed: boolean;
  companyLegalName: string;
  tradeName?: string;
  websiteUrl: string;
  country?: string;
  registrationNumber?: string;
  documentUploaded?: boolean;
}

// Global registry provider catalog (keyed by country code)
const REGISTRY_PROVIDERS: Record<string, IRegistryProvider> = {
  PH: new SecPhilippinesRegistryProvider()
};

export function registerRegistryProvider(provider: IRegistryProvider) {
  REGISTRY_PROVIDERS[provider.countryCode.toUpperCase()] = provider;
}

export async function executeAutomatedVerification(
  input: CompanyRegistrationInput,
  options?: { skipProbe?: boolean; mockDomainAgeDays?: number }
): Promise<VerificationDecision> {
  const decidedAt = new Date().toISOString();
  const reasons: string[] = [];
  const decidedBy = 'system';

  // 1. Email check
  const isFreeDisposable = isFreeOrDisposableEmail(input.workEmail);
  const emailDomain = extractEmailDomain(input.workEmail);
  const websiteDomain = normalizeDomain(input.websiteUrl);

  if (isFreeDisposable) {
    reasons.push(`Rejected: Corporate email provider cannot be a free or disposable service (${emailDomain}).`);
  }

  if (!input.emailConfirmed) {
    reasons.push('Email address is unconfirmed. Verification token must be validated first.');
  }

  // 2. Domain match check
  const matchResult = domainsMatch(emailDomain, websiteDomain);
  if (!matchResult.matches) {
    reasons.push(matchResult.reason || 'Email domain does not match company website domain.');
  }

  // 3. Domain health check
  const healthResult = await evaluateDomainHealth(websiteDomain, {
    skipProbe: options?.skipProbe,
    mockAgeDays: options?.mockDomainAgeDays
  });

  if (healthResult.isBanned) {
    reasons.push(`Domain "${websiteDomain}" is flagged on the security blacklist.`);
  }

  if (healthResult.isLookalike) {
    reasons.push(
      `Domain "${websiteDomain}" is flagged for high visual similarity to protected brand "${healthResult.lookalikeTarget}".`
    );
  }

  if (healthResult.ageDays !== null && healthResult.ageDays < 90) {
    reasons.push(`Domain age (${healthResult.ageDays} days) is less than the required 90 days threshold.`);
  } else if (healthResult.ageDays === null) {
    reasons.push('Domain registration date could not be established via WHOIS/RDAP.');
  }

  if (!healthResult.siteReachable) {
    reasons.push('Website did not respond with a healthy HTTP 200 code.');
  }

  // 4. Registry check (optional boost or validation)
  let registryResult: RegistryQueryResult | undefined;
  const country = (input.country || 'PH').toUpperCase();
  const provider = REGISTRY_PROVIDERS[country];

  if (provider && (input.companyLegalName || input.registrationNumber)) {
    try {
      registryResult = await provider.queryCompany(input.companyLegalName, input.registrationNumber);
    } catch (regErr: any) {
      registryResult = {
        found: false,
        status: 'registry_unchecked',
        source: provider.providerName,
        queriedAt: decidedAt,
        error: regErr?.message || 'Registry query timed out'
      };
    }
  } else {
    registryResult = {
      found: false,
      status: 'registry_unchecked',
      source: 'none',
      queriedAt: decidedAt,
      error: 'No registry provider configured for country'
    };
  }

  if (registryResult.status === 'dissolved') {
    reasons.push(`Company entity "${input.companyLegalName}" is flagged as dissolved or defunct in the official registry.`);
  }

  const checksRun: AutomatedChecksRun = {
    emailConfirmed: input.emailConfirmed,
    isFreeOrDisposable: isFreeDisposable,
    domainMatch: {
      matches: matchResult.matches,
      reason: matchResult.reason,
      emailDomain,
      websiteDomain
    },
    domainHealth: healthResult,
    registryResult
  };

  // ==========================================
  // DECISION MATRIX
  // ==========================================
  let status: VerificationDecisionStatus;
  let tier: EmployerTier;

  // Case A: Hard Auto-Rejection
  // - Free or disposable email
  // - Banned domain
  // - Dissolved company
  if (isFreeDisposable || healthResult.isBanned || registryResult.status === 'dissolved') {
    status = 'AUTO_REJECTED';
    tier = 'pending';
    return {
      status,
      tier,
      reasons,
      checksRun,
      limits: {
        maxActiveJobs: 0,
        canPublishJobs: false,
        badgeLabel: 'Application Rejected',
        hasVerifiedBadge: false
      },
      decidedAt,
      decidedBy
    };
  }

  // Case B: Auto-Verification baseline criteria
  const passesBaseline =
    input.emailConfirmed &&
    matchResult.matches &&
    !isFreeDisposable &&
    healthResult.healthy;

  if (passesBaseline) {
    // Check if registry match upgrades to full "VERIFIED" badge
    const hasActiveRegistryMatch = registryResult.found && registryResult.status === 'active';

    if (hasActiveRegistryMatch) {
      status = 'VERIFIED';
      tier = 'verified';
      reasons.push('Automated checks passed and corporate registration confirmed in official government registry.');
      return {
        status,
        tier,
        reasons,
        checksRun,
        limits: {
          maxActiveJobs: 25,
          canPublishJobs: true,
          badgeLabel: 'Verified Employer',
          hasVerifiedBadge: true
        },
        decidedAt,
        decidedBy
      };
    }

    // Otherwise: AUTO_VERIFIED (Basic Email-Verified tier)
    status = 'AUTO_VERIFIED';
    tier = 'email_verified';
    reasons.push('Automated corporate domain and email checks passed successfully. Basic tier activated.');
    return {
      status,
      tier,
      reasons,
      checksRun,
      limits: {
        maxActiveJobs: 3,
        canPublishJobs: true,
        badgeLabel: 'Email-verified employer',
        hasVerifiedBadge: false
      },
      decidedAt,
      decidedBy
    };
  }

  // Case C: Needs human review (domain mismatch, new domain, lookalike suspicion, unreachable site, etc.)
  status = 'NEEDS_REVIEW';
  tier = 'pending';
  return {
    status,
    tier,
    reasons,
    checksRun,
    limits: {
      maxActiveJobs: 0,
      canPublishJobs: false,
      badgeLabel: 'Verification Pending Review',
      hasVerifiedBadge: false
    },
    decidedAt,
    decidedBy
  };
}

/**
 * Domain-based Company Multi-User Membership Routing
 */
export interface CompanyDomainMembership {
  domain: string;
  adminUserId: string;
  adminEmail: string;
  approvedMembers: string[]; // uids
  pendingJoinRequests: Array<{ uid: string; email: string; name: string; requestedAt: string }>;
}

const DOMAIN_MEMBERSHIP_STORE = new Map<string, CompanyDomainMembership>();

export function getCompanyMembershipByDomain(domain: string): CompanyDomainMembership | undefined {
  return DOMAIN_MEMBERSHIP_STORE.get(normalizeDomain(domain));
}

export function registerCompanyDomainUser(
  domainRaw: string,
  user: { uid: string; email: string; name: string }
): { role: 'company_admin' | 'pending_member'; message: string } {
  const domain = normalizeDomain(domainRaw);
  const existing = DOMAIN_MEMBERSHIP_STORE.get(domain);

  if (!existing) {
    // First verified user becomes company admin
    DOMAIN_MEMBERSHIP_STORE.set(domain, {
      domain,
      adminUserId: user.uid,
      adminEmail: user.email,
      approvedMembers: [user.uid],
      pendingJoinRequests: []
    });
    return {
      role: 'company_admin',
      message: `You are the primary verified administrator for ${domain}. You can manage team members and job postings.`
    };
  }

  // Secondary user -> queue join request
  if (existing.approvedMembers.includes(user.uid)) {
    return {
      role: 'company_admin',
      message: `You are an active approved team member for ${domain}.`
    };
  }

  if (!existing.pendingJoinRequests.some((r) => r.uid === user.uid)) {
    existing.pendingJoinRequests.push({
      uid: user.uid,
      email: user.email,
      name: user.name,
      requestedAt: new Date().toISOString()
    });
  }

  return {
    role: 'pending_member',
    message: `A company account for "${domain}" already exists under ${existing.adminEmail}. Your request to join has been sent to the company administrator for approval.`
  };
}
