/**
 * Job Post Safeguards & Content Filter
 * Blocks suspicious job postings (upfront fees, Telegram/WhatsApp only, free email contacts)
 * Manages job reports and 3-report employer auto-suspension.
 */

import { isFreeOrDisposableEmail } from './emailCheck';

export interface JobFilterResult {
  allowed: boolean;
  violations: string[];
}

export function filterJobContent(params: {
  title: string;
  description: string;
  requirements?: string | string[];
  contactEmail?: string;
  howToApply?: string;
}): JobFilterResult {
  const violations: string[] = [];
  const fullText = [
    params.title || '',
    params.description || '',
    Array.isArray(params.requirements) ? params.requirements.join(' ') : params.requirements || '',
    params.howToApply || ''
  ].join(' ').toLowerCase();

  // 1. Upfront fee or payment demands
  const feePatterns = [
    /registration\s+fee/i,
    /pay\s+for\s+training/i,
    /training\s+fee/i,
    /equipment\s+fee/i,
    /purchase\s+equipment/i,
    /processing\s+fee/i,
    /cash\s+deposit/i,
    /security\s+deposit/i,
    /money\s+transfer/i,
    /wire\s+funds/i
  ];

  for (const pattern of feePatterns) {
    if (pattern.test(fullText)) {
      violations.push('Job post contains upfront fee, payment, or equipment purchase solicitation.');
      break;
    }
  }

  // 2. Telegram / WhatsApp only contact
  const messagingPatterns = [
    /telegram\s+only/i,
    /whatsapp\s+only/i,
    /contact\s+via\s+telegram/i,
    /contact\s+via\s+whatsapp/i,
    /t\.me\//i,
    /wa\.me\//i
  ];

  for (const pattern of messagingPatterns) {
    if (pattern.test(fullText)) {
      violations.push('Off-platform messaging channel only (Telegram / WhatsApp) is prohibited for verified opportunities.');
      break;
    }
  }

  // 3. Contact email on free/disposable provider
  if (params.contactEmail && isFreeOrDisposableEmail(params.contactEmail)) {
    violations.push(`Official contact email cannot be on a free consumer provider (${params.contactEmail}).`);
  }

  // Also scan text for embedded free emails
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  const matches = fullText.match(emailRegex) || [];
  for (const match of matches) {
    if (isFreeOrDisposableEmail(match)) {
      violations.push(`Job description contains personal free consumer email address: ${match}`);
      break;
    }
  }

  return {
    allowed: violations.length === 0,
    violations
  };
}

/**
 * In-memory job report and auto-suspension tracker
 */
interface JobReportRecord {
  jobId: string;
  employerId: string;
  reporterUids: Set<string>;
  reasons: string[];
}

const JOB_REPORTS_STORE = new Map<string, JobReportRecord>();

export function recordJobReport(params: {
  jobId: string;
  employerId: string;
  reporterUid: string;
  reason: string;
}): { totalReports: number; shouldAutoSuspend: boolean } {
  let record = JOB_REPORTS_STORE.get(params.jobId);
  if (!record) {
    record = {
      jobId: params.jobId,
      employerId: params.employerId,
      reporterUids: new Set<string>(),
      reasons: []
    };
    JOB_REPORTS_STORE.set(params.jobId, record);
  }

  record.reporterUids.add(params.reporterUid);
  record.reasons.push(params.reason);

  const uniqueReporters = record.reporterUids.size;
  // 3 reports from distinct users triggers auto-suspension
  const shouldAutoSuspend = uniqueReporters >= 3;

  return {
    totalReports: uniqueReporters,
    shouldAutoSuspend
  };
}
