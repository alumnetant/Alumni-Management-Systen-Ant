/**
 * Domain Health, RDAP Age, Lookalike Check, and Content Probe
 */

import http from 'http';
import https from 'https';
import configData from './config/verificationConfig.json';
import { normalizeDomain } from './domainMatch';

export interface DomainHealthResult {
  healthy: boolean;
  ageDays: number | null;
  siteReachable: boolean;
  isLookalike: boolean;
  lookalikeTarget?: string;
  isBanned: boolean;
  reasons: string[];
}

/**
 * Homoglyph replacement table for spoofing detection
 */
const HOMOGLYPHS: Record<string, string> = {
  '0': 'o',
  '1': 'l',
  '!': 'i',
  '|': 'l',
  'vv': 'w',
  'rn': 'm',
  '5': 's',
  '3': 'e',
  '@': 'a',
  '4': 'a'
};

export function normalizeHomoglyphs(str: string): string {
  let res = str.toLowerCase();
  for (const [key, value] of Object.entries(HOMOGLYPHS)) {
    res = res.split(key).join(value);
  }
  return res;
}

export function levenshteinDistance(a: string, b: string): number {
  const an = a.length;
  const bn = b.length;
  if (an === 0) return bn;
  if (bn === 0) return an;

  const matrix: number[][] = [];
  for (let i = 0; i <= bn; ++i) matrix[i] = [i];
  for (let i = 0; i <= an; ++i) matrix[0][i] = i;

  for (let i = 1; i <= bn; ++i) {
    for (let j = 1; j <= an; ++j) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[bn][an];
}

/**
 * Checks whether the domain is a close lookalike to any known brand.
 */
export function checkLookalike(domain: string): { isLookalike: boolean; target?: string; distance?: number } {
  const normDomain = normalizeDomain(domain);
  const brandList = configData.knownBrands || [];

  // Strip TLD for primary brand name comparison
  const domainParts = normDomain.split('.');
  const primaryName = domainParts[0];
  const homoNormalized = normalizeHomoglyphs(primaryName);

  for (const brand of brandList) {
    const brandPrimary = brand.split('.')[0];
    if (normDomain === brand) {
      // It's the actual brand domain, not a lookalike!
      return { isLookalike: false };
    }

    // Direct edit distance check on full domain
    const fullDist = levenshteinDistance(normDomain, brand);
    if (fullDist > 0 && fullDist <= 2) {
      return { isLookalike: true, target: brand, distance: fullDist };
    }

    // Homoglyph normalized check on primary name
    const homoDist = levenshteinDistance(homoNormalized, brandPrimary);
    if (homoDist <= 1 && homoNormalized !== brandPrimary) {
      return { isLookalike: true, target: brand, distance: homoDist };
    }
  }

  return { isLookalike: false };
}

/**
 * Checks if the domain is on the banned domain list.
 */
export function isBannedDomain(domain: string): boolean {
  const norm = normalizeDomain(domain);
  const banned = configData.bannedDomains || [];
  return banned.includes(norm);
}

/**
 * Probe website HTTP reachability and non-parked content with 5s timeout.
 */
export async function probeWebsiteContent(urlOrDomain: string): Promise<{ reachable: boolean; contentLength: number; hasContent: boolean }> {
  const norm = normalizeDomain(urlOrDomain);
  if (!norm) return { reachable: false, contentLength: 0, hasContent: false };

  const targetUrl = `https://${norm}`;

  return new Promise((resolve) => {
    let responded = false;
    const client = targetUrl.startsWith('https') ? https : http;

    const req = client.get(
      targetUrl,
      {
        headers: {
          'User-Agent': 'StCeciliaAlumniBot/1.0 (Employer Verification Health Probe; +https://alumni.stcecilia.edu)'
        },
        timeout: 5000
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
          if (body.length > 50000) {
            req.destroy(); // Limit probe size
          }
        });

        res.on('end', () => {
          if (responded) return;
          responded = true;
          const status = res.statusCode || 0;
          const isOk = status >= 200 && status < 400;
          const bodyLen = body.trim().length;

          // Check for parked/empty indicator phrases
          const parkedSignatures = ['domain for sale', 'buy this domain', 'parked domain', 'renew your domain'];
          const isParked = parkedSignatures.some((sig) => body.toLowerCase().includes(sig));

          resolve({
            reachable: isOk,
            contentLength: bodyLen,
            hasContent: isOk && bodyLen > 150 && !isParked
          });
        });
      }
    );

    req.on('timeout', () => {
      if (!responded) {
        responded = true;
        req.destroy();
        resolve({ reachable: false, contentLength: 0, hasContent: false });
      }
    });

    req.on('error', () => {
      if (!responded) {
        responded = true;
        resolve({ reachable: false, contentLength: 0, hasContent: false });
      }
    });
  });
}

/**
 * Query domain age in days via RDAP with timeout and graceful fallback.
 */
export async function queryDomainAgeDays(domain: string): Promise<number | null> {
  const norm = normalizeDomain(domain);
  if (!norm) return null;

  return new Promise((resolve) => {
    let responded = false;
    const req = https.get(
      `https://rdap.org/domain/${norm}`,
      {
        headers: { 'Accept': 'application/json', 'User-Agent': 'StCeciliaAlumniBot/1.0' },
        timeout: 4000
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (responded) return;
          responded = true;
          try {
            if (res.statusCode !== 200) {
              return resolve(null);
            }
            const json = JSON.parse(data);
            const events: Array<{ eventAction: string; eventDate: string }> = json.events || [];
            const regEvent = events.find((e) => e.eventAction === 'registration');
            if (regEvent && regEvent.eventDate) {
              const regDate = new Date(regEvent.eventDate);
              const ageMs = Date.now() - regDate.getTime();
              const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
              return resolve(ageDays >= 0 ? ageDays : null);
            }
            resolve(null);
          } catch {
            resolve(null);
          }
        });
      }
    );

    req.on('timeout', () => {
      if (!responded) {
        responded = true;
        req.destroy();
        resolve(null);
      }
    });

    req.on('error', () => {
      if (!responded) {
        responded = true;
        resolve(null);
      }
    });
  });
}

/**
 * Evaluates full domain health.
 */
export async function evaluateDomainHealth(
  domain: string,
  options?: { skipProbe?: boolean; mockAgeDays?: number }
): Promise<DomainHealthResult> {
  const norm = normalizeDomain(domain);
  const reasons: string[] = [];

  // 1. Banned domain check
  const isBanned = isBannedDomain(norm);
  if (isBanned) {
    reasons.push(`Domain "${norm}" is on the restricted/banned list.`);
  }

  // 2. Lookalike brand check
  const lookalike = checkLookalike(norm);
  if (lookalike.isLookalike && lookalike.target) {
    reasons.push(`Suspicious domain similarity detected: close to well-known brand "${lookalike.target}".`);
  }

  // 3. Domain age check
  let ageDays: number | null = options?.mockAgeDays !== undefined ? options.mockAgeDays : null;
  if (ageDays === null && !options?.skipProbe) {
    try {
      ageDays = await queryDomainAgeDays(norm);
    } catch {
      ageDays = null;
    }
  }

  if (ageDays === null) {
    reasons.push('Domain age could not be confirmed via RDAP/WHOIS (unverified registry).');
  } else if (ageDays < 90) {
    reasons.push(`Domain age is under 90 days (${ageDays} days old). Potential newly-minted entity.`);
  }

  // 4. Website reachability & real content probe
  let siteReachable = false;
  let hasRealContent = false;
  if (!options?.skipProbe) {
    const probe = await probeWebsiteContent(norm);
    siteReachable = probe.reachable;
    hasRealContent = probe.hasContent;
    if (!siteReachable) {
      reasons.push(`Company website at "${norm}" is unreachable or failed HTTP 200 check.`);
    } else if (!hasRealContent) {
      reasons.push(`Company website at "${norm}" appears blank, parked, or lacks substantive content.`);
    }
  } else {
    // For unit tests / mock mode
    siteReachable = true;
    hasRealContent = true;
  }

  const healthy =
    !isBanned &&
    !lookalike.isLookalike &&
    (ageDays !== null && ageDays >= 90) &&
    siteReachable &&
    hasRealContent;

  return {
    healthy,
    ageDays,
    siteReachable,
    isLookalike: lookalike.isLookalike,
    lookalikeTarget: lookalike.target,
    isBanned,
    reasons
  };
}
