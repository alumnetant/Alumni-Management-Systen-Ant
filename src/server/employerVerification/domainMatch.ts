/**
 * Domain Matching & Normalization Module
 * Normalizes email and website domains, detects subdomains, and rejects shared/hosted domains.
 */

import configData from './config/verificationConfig.json';

export function normalizeDomain(input: string): string {
  if (!input) return '';
  let cleaned = input.toLowerCase().trim();

  // Strip protocol (http://, https://, ftp://)
  cleaned = cleaned.replace(/^[a-z]+:\/\//, '');

  // Strip path, query params, hash
  cleaned = cleaned.split('/')[0].split('?')[0].split('#')[0];

  // Strip port if present (:8080)
  cleaned = cleaned.split(':')[0];

  // Strip leading "www."
  if (cleaned.startsWith('www.')) {
    cleaned = cleaned.slice(4);
  }

  return cleaned.trim();
}

export function extractEmailDomain(email: string): string {
  if (!email || !email.includes('@')) return '';
  const parts = email.toLowerCase().trim().split('@');
  return normalizeDomain(parts[parts.length - 1]);
}

export function isSharedDomain(domain: string): boolean {
  const norm = normalizeDomain(domain);
  const sharedList = configData.sharedHostingDomains || [];

  for (const shared of sharedList) {
    if (norm === shared || norm.endsWith('.' + shared)) {
      return true;
    }
  }
  return false;
}

export function domainsMatch(emailDomainRaw: string, websiteDomainRaw: string): { matches: boolean; reason?: string } {
  const emailDomain = normalizeDomain(emailDomainRaw);
  const websiteDomain = normalizeDomain(websiteDomainRaw);

  if (!emailDomain || !websiteDomain) {
    return { matches: false, reason: 'Missing email or website domain' };
  }

  if (isSharedDomain(websiteDomain)) {
    return { matches: false, reason: `Shared or hosted domain rejected: ${websiteDomain}` };
  }

  // Exact match
  if (emailDomain === websiteDomain) {
    return { matches: true };
  }

  // Subdomain match (e.g., hr.company.com matches company.com, or user@company.com matches jobs.company.com)
  if (emailDomain.endsWith('.' + websiteDomain) || websiteDomain.endsWith('.' + emailDomain)) {
    return { matches: true };
  }

  return {
    matches: false,
    reason: `Email domain "${emailDomain}" does not match company website domain "${websiteDomain}"`
  };
}
