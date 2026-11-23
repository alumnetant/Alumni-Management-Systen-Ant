/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Unified Activity & Audit Logging Service
 * - Cloud Firestore primary storage (`audit_logs`)
 * - Authenticated Express API sync & fallback (`POST /api/activity-logs` & `GET /api/admin/audit-logs`)
 * - Persistent idempotent retry queue with exponential backoff
 * - Secret/credential scrubbing & strict field bounds matching `firestore.rules`
 */

import { AuditLogCategory, AuditLogEntry, ModerationAuditRecord } from '../types';
import {
  saveAuditLogToFirestore,
  loadAuditLogsFromFirestore,
  loadModerationAuditRecordsFromFirestore
} from '../lib/firebase';
import { apiFetch, apiFetchWithCsrf, getAuthToken } from './apiClient';
import { generateSecureToken } from '../lib/security';

const createActivityLogId = (prefix = 'log') => `${prefix}_${Date.now()}_${generateSecureToken(4)}`;

export interface ActivityLogInput extends Omit<AuditLogEntry, 'id' | 'timestamp'> {
  id?: string;
  timestamp?: string;
}

export interface ActivitySyncState {
  status: 'idle' | 'syncing' | 'delayed';
  pendingCount: number;
  lastError?: string;
  lastSyncedAt?: string;
}

export interface ActivityCategoryGroup {
  id: string;
  label: string;
  categories: AuditLogCategory[];
}

export const ACTIVITY_CATEGORY_GROUPS: ActivityCategoryGroup[] = [
  {
    id: 'all',
    label: 'All Categories',
    categories: []
  },
  {
    id: 'security',
    label: 'Authentication & Security',
    categories: ['security']
  },
  {
    id: 'social_feed',
    label: 'Social Feed & Interactions',
    categories: ['social_feed']
  },
  {
    id: 'messaging',
    label: 'Messaging & Networking',
    categories: ['messaging']
  },
  {
    id: 'profile',
    label: 'Profile & Preferences',
    categories: ['profile', 'settings']
  },
  {
    id: 'engagement',
    label: 'Events & Communications',
    categories: ['engagement', 'communication']
  },
  {
    id: 'career',
    label: 'Careers & Tracer Surveys',
    categories: ['career']
  },
  {
    id: 'moderation',
    label: 'Moderation & Reports',
    categories: ['moderation']
  },
  {
    id: 'gallery',
    label: 'Campus Gallery',
    categories: ['gallery']
  },
  {
    id: 'administration',
    label: 'Registry, Verification & Admin',
    categories: [
      'alumni_registration',
      'alumni_verification',
      'registry_masterlist',
      'conflict_resolution',
      'user_management',
      'admin'
    ]
  }
];

export function matchesCategoryFilter(logCategory: string | undefined, selectedGroupOrCategory: string): boolean {
  if (!selectedGroupOrCategory || selectedGroupOrCategory === 'all') return true;
  const normLogCat = (logCategory || '').toLowerCase().trim();
  const group = ACTIVITY_CATEGORY_GROUPS.find((g) => g.id === selectedGroupOrCategory);
  if (group) {
    if (group.categories.length === 0) return true;
    return group.categories.some((c) => c === normLogCat);
  }
  return normLogCat === selectedGroupOrCategory.toLowerCase().trim();
}

export function formatCategoryLabel(category?: string): string {
  const norm = (category || 'admin').toLowerCase().trim();
  switch (norm) {
    case 'security':
      return 'Security & Auth';
    case 'social_feed':
      return 'Social Feed';
    case 'messaging':
      return 'Messaging & Network';
    case 'profile':
      return 'Profile';
    case 'settings':
      return 'Preferences';
    case 'engagement':
      return 'Events & Engagement';
    case 'communication':
      return 'Communications';
    case 'career':
      return 'Careers & Surveys';
    case 'moderation':
      return 'Moderation';
    case 'gallery':
      return 'Campus Gallery';
    case 'alumni_registration':
      return 'Registration';
    case 'alumni_verification':
      return 'Verification';
    case 'registry_masterlist':
      return 'Registrar Registry';
    case 'conflict_resolution':
      return 'ID Conflicts';
    case 'user_management':
      return 'User Management';
    case 'admin':
      return 'Administration';
    default:
      return norm.replace(/_/g, ' ');
  }
}

const VALID_CATEGORIES = new Set<string>([
  'alumni_registration',
  'career',
  'communication',
  'engagement',
  'security',
  'admin',
  'registry_masterlist',
  'conflict_resolution',
  'settings',
  'alumni_verification',
  'user_management',
  'social_feed',
  'messaging',
  'profile',
  'moderation',
  'gallery'
]);

const VALID_SEVERITIES = new Set(['info', 'warning', 'alert', 'success']);

const FORBIDDEN_SECRET_KEYS = new Set([
  'password',
  'passwordhash',
  'token',
  'refreshtoken',
  'secret',
  'pin',
  'otp',
  'authorization'
]);

function scrubMetadata(raw?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const result: Record<string, unknown> = {};
  const entries = Object.entries(raw).slice(0, 20);
  for (const [k, v] of entries) {
    if (FORBIDDEN_SECRET_KEYS.has(k.toLowerCase())) continue;
    if (typeof v === 'string') {
      result[k] = v.slice(0, 300);
    } else if (typeof v === 'number' || typeof v === 'boolean' || v === null) {
      result[k] = v;
    } else if (Array.isArray(v)) {
      result[k] = v.slice(0, 20).map((item) => (typeof item === 'string' ? item.slice(0, 100) : item));
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function scrubDetailsText(text: string): string {
  return String(text || '')
    .replace(/Bearer\s+[A-Za-z0-9\-_.]+/gi, 'Bearer [REDACTED]')
    .replace(/(password|token|secret|pin)\s*[:=]\s*\S+/gi, '$1=[REDACTED]')
    .trim()
    .slice(0, 1500);
}

export function normalizeActivityLogEntry(input: ActivityLogInput): AuditLogEntry {
  const rawCategory = String(input.category || 'admin').toLowerCase().trim();
  const category = (VALID_CATEGORIES.has(rawCategory) ? rawCategory : 'admin') as AuditLogCategory;
  const rawSeverity = String(input.severity || 'info').toLowerCase().trim();
  const severity = (
    rawSeverity === 'critical'
      ? 'alert'
      : VALID_SEVERITIES.has(rawSeverity)
      ? rawSeverity
      : 'info'
  ) as AuditLogEntry['severity'];

  const sanitizedId = String(input.id || createActivityLogId('log'))
    .replace(/[^a-zA-Z0-9_\-.]/g, '_')
    .slice(0, 128);

  const normalized: AuditLogEntry = {
    id: sanitizedId || createActivityLogId('log'),
    timestamp: String(input.timestamp || new Date().toISOString()).slice(0, 64),
    action: String(input.action || 'USER_ACTIVITY').trim().slice(0, 160),
    actorId: String(input.actorId || 'system').trim().slice(0, 128) || 'system',
    actorName: String(input.actorName || 'Portal User').trim().slice(0, 160),
    actorRole: String(input.actorRole || 'alumni').trim().slice(0, 40) || 'alumni',
    category,
    details: scrubDetailsText(input.details || ''),
    severity,
    ...(input.ipAddress ? { ipAddress: String(input.ipAddress).slice(0, 80) } : {}),
    ...(input.targetRecordId ? { targetRecordId: String(input.targetRecordId).slice(0, 160) } : {}),
    ...(input.targetUserId ? { targetUserId: String(input.targetUserId).slice(0, 128) } : {}),
    ...(input.targetUserName ? { targetUserName: String(input.targetUserName).slice(0, 160) } : {}),
    ...(input.targetUserRole ? { targetUserRole: String(input.targetUserRole).slice(0, 40) } : {}),
    ...(input.suspensionReason ? { suspensionReason: String(input.suspensionReason).slice(0, 500) } : {}),
    ...(input.suspensionStartDate ? { suspensionStartDate: String(input.suspensionStartDate).slice(0, 64) } : {}),
    ...(input.suspensionEndDate ? { suspensionEndDate: String(input.suspensionEndDate).slice(0, 64) } : {}),
    ...(typeof input.isSuspicious === 'boolean' ? { isSuspicious: input.isSuspicious } : {}),
    ...(typeof input.requiresAlertIcon === 'boolean' ? { requiresAlertIcon: input.requiresAlertIcon } : {}),
    ...(input.metadata ? { metadata: scrubMetadata(input.metadata) } : {})
  };

  return normalized;
}

export function mapModerationAuditToActivityLog(rec: ModerationAuditRecord): AuditLogEntry {
  const upperAction = (rec.action || '').toUpperCase();
  const severity: AuditLogEntry['severity'] =
    upperAction.includes('BAN') || upperAction.includes('SUSPENDED') || upperAction.includes('UNAUTHORIZED')
      ? 'alert'
      : upperAction.includes('WARN') || upperAction.includes('DELETED') || upperAction.includes('RESTRICT')
      ? 'warning'
      : upperAction.includes('RESTORE') || upperAction.includes('DISMISSED') || upperAction.includes('UNRESTRICT')
      ? 'success'
      : 'info';

  return normalizeActivityLogEntry({
    id: rec.id.startsWith('mod_') ? rec.id : `mod_${rec.id}`,
    timestamp: rec.createdAt || new Date().toISOString(),
    action: rec.action,
    actorId: rec.actorId || 'system',
    actorName: rec.actorName || rec.actorRole || 'Moderator',
    actorRole: rec.actorRole || 'moderator',
    category: 'moderation',
    details: rec.note || `Moderation event: ${rec.action}`,
    severity,
    targetRecordId: rec.caseId || rec.postId || rec.targetUserId,
    targetUserId: rec.targetUserId,
    metadata: rec.metadata
  });
}

// =========================================================================
// PERSISTENCE HOOKS (OVERRIDABLE IN VITEST)
// =========================================================================

export interface ActivityLogPersistenceHooks {
  saveFirestore: (entry: AuditLogEntry) => Promise<boolean>;
  loadFirestore: (maxLimit: number) => Promise<AuditLogEntry[]>;
  loadModerationAudits: () => Promise<ModerationAuditRecord[]>;
  sendExpress: (entry: AuditLogEntry) => Promise<boolean>;
  loadExpress: () => Promise<{ ok: boolean; logs: AuditLogEntry[] }>;
}

const defaultHooks: ActivityLogPersistenceHooks = {
  saveFirestore: (entry) => saveAuditLogToFirestore(entry),
  loadFirestore: (maxLimit) => loadAuditLogsFromFirestore(maxLimit),
  loadModerationAudits: () => loadModerationAuditRecordsFromFirestore(),
  sendExpress: async (entry) => {
    if (!getAuthToken()) return false;
    try {
      const res = await apiFetchWithCsrf('/api/activity-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
      });
      return res.ok;
    } catch {
      return false;
    }
  },
  loadExpress: async () => {
    if (!getAuthToken()) return { ok: false, logs: [] };
    try {
      const res = await apiFetch('/api/admin/audit-logs');
      if (!res.ok) return { ok: false, logs: [] };
      const data = await res.json().catch(() => null);
      if (!Array.isArray(data?.logs)) return { ok: true, logs: [] };
      const mapped = data.logs.map((item: any) => mapExpressServerLogToAuditEntry(item));
      return { ok: true, logs: mapped };
    } catch {
      return { ok: false, logs: [] };
    }
  }
};

let activeHooks: ActivityLogPersistenceHooks = { ...defaultHooks };

export function setActivityLogPersistenceHooksForTests(overrides: Partial<ActivityLogPersistenceHooks> | null): void {
  activeHooks = overrides ? { ...defaultHooks, ...overrides } : { ...defaultHooks };
}

export function mapExpressServerLogToAuditEntry(item: any): AuditLogEntry {
  const detailsObj = typeof item?.details === 'object' && item?.details !== null ? item.details : null;
  const actionStr = String(item?.action || 'SERVER_AUDIT_EVENT');
  const detailsText =
    typeof item?.details === 'string'
      ? item.details
      : typeof detailsObj?.message === 'string'
      ? detailsObj.message
      : detailsObj?.attemptedPath
      ? `Blocked unauthorized access to ${detailsObj.attemptedPath} (${detailsObj.reason || 'SUPERADMIN_REQUIRED'}) from IP ${item?.ip || 'internal'}`
      : JSON.stringify(item?.details || {});

  const inferredSeverity =
    item?.severity ||
    (actionStr.toUpperCase().includes('UNAUTHORIZED') ||
    actionStr.toUpperCase().includes('LOCKED') ||
    actionStr.toUpperCase().includes('SUSPENDED')
      ? 'alert'
      : 'info');

  return normalizeActivityLogEntry({
    id: String(item?.id || createActivityLogId('srv_log')),
    timestamp: String(item?.timestamp || new Date().toISOString()),
    action: actionStr,
    actorId: String(item?.actorId || detailsObj?.actorUid || item?.actor || 'system'),
    actorName: String(item?.actorName || item?.actor || 'System'),
    actorRole: String(item?.actorRole || 'system'),
    category: (item?.category || 'security') as AuditLogCategory,
    details: detailsText,
    severity: inferredSeverity,
    ipAddress: item?.ip ? String(item.ip) : item?.ipAddress ? String(item.ipAddress) : undefined,
    targetRecordId:
      item?.targetRecordId ||
      (detailsObj?.attemptedPath
        ? String(detailsObj.attemptedPath)
        : detailsObj?.targetUserId
        ? String(detailsObj.targetUserId)
        : undefined),
    targetUserId: item?.targetUserId || (detailsObj?.targetUserId ? String(detailsObj.targetUserId) : undefined),
    targetUserName: item?.targetUserName || (detailsObj?.targetUserName ? String(detailsObj.targetUserName) : undefined),
    targetUserRole: item?.targetUserRole || (detailsObj?.targetUserRole ? String(detailsObj.targetUserRole) : undefined),
    isSuspicious: typeof item?.isSuspicious === 'boolean' ? item.isSuspicious : undefined,
    requiresAlertIcon: typeof item?.requiresAlertIcon === 'boolean' ? item.requiresAlertIcon : undefined,
    metadata: item?.metadata || (detailsObj && !detailsObj.message ? detailsObj : undefined)
  });
}

// =========================================================================
// BACKGROUND RETRY QUEUE & SYNC STATUS TRACKING
// =========================================================================

const ACTIVITY_SYNC_QUEUE_KEY = 'alumni_activity_log_sync_queue_v1';

interface QueuedActivityOp {
  id: string;
  entry: AuditLogEntry;
  needsFirestore: boolean;
  needsExpress: boolean;
  attempts: number;
  nextRetryAt: number;
  lastError?: string;
}

let syncState: ActivitySyncState = {
  status: 'idle',
  pendingCount: 0
};

const syncListeners = new Set<(state: ActivitySyncState) => void>();
let retryTimer: ReturnType<typeof setTimeout> | null = null;

function notifySyncListeners() {
  const snapshot = { ...syncState };
  syncListeners.forEach((cb) => {
    try {
      cb(snapshot);
    } catch {}
  });
}

function loadSyncQueue(): QueuedActivityOp[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(ACTIVITY_SYNC_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSyncQueue(queue: QueuedActivityOp[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(ACTIVITY_SYNC_QUEUE_KEY, JSON.stringify(queue.slice(-100)));
  } catch {}
}

function updateSyncStateFromQueue(queue: QueuedActivityOp[], lastError?: string, synced = false) {
  const hasDelayedItem = queue.some((op) => op.attempts >= 2);
  syncState = {
    status: queue.length === 0 ? 'idle' : hasDelayedItem ? 'delayed' : 'syncing',
    pendingCount: queue.length,
    lastError: queue.length === 0 ? undefined : lastError || syncState.lastError,
    lastSyncedAt: synced ? new Date().toISOString() : syncState.lastSyncedAt
  };
  notifySyncListeners();
}

export function subscribeActivitySyncStatus(listener: (state: ActivitySyncState) => void): () => void {
  syncListeners.add(listener);
  listener({ ...syncState });
  return () => {
    syncListeners.delete(listener);
  };
}

export function getActivitySyncState(): ActivitySyncState {
  return { ...syncState };
}

export function resetActivitySyncStateForTests(): void {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(ACTIVITY_SYNC_QUEUE_KEY);
    } catch {}
  }
  syncState = { status: 'idle', pendingCount: 0 };
  notifySyncListeners();
}

function scheduleQueueRetry(delayMs: number) {
  if (typeof window === 'undefined' || process.env.VITEST) return;
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void flushActivityLogSyncQueue();
  }, delayMs);
}

function enqueueFailedTargets(entry: AuditLogEntry, needsFirestore: boolean, needsExpress: boolean) {
  if (!needsFirestore && !needsExpress) return;
  const queue = loadSyncQueue();
  const existingIdx = queue.findIndex((q) => q.id === entry.id);
  const backoffMs = 2000;
  if (existingIdx >= 0) {
    queue[existingIdx] = {
      ...queue[existingIdx],
      needsFirestore: queue[existingIdx].needsFirestore || needsFirestore,
      needsExpress: queue[existingIdx].needsExpress || needsExpress,
      attempts: queue[existingIdx].attempts + 1,
      nextRetryAt: Date.now() + backoffMs * Math.pow(2, Math.min(3, queue[existingIdx].attempts))
    };
  } else {
    queue.push({
      id: entry.id,
      entry,
      needsFirestore,
      needsExpress,
      attempts: 1,
      nextRetryAt: Date.now() + backoffMs,
      lastError: needsFirestore ? 'Firestore write retry queued' : 'Background Express sync retry queued'
    });
  }
  saveSyncQueue(queue);
  updateSyncStateFromQueue(queue, queue[queue.length - 1]?.lastError);
  scheduleQueueRetry(backoffMs);
}

export async function flushActivityLogSyncQueue(): Promise<{ flushed: number; remaining: number }> {
  const queue = loadSyncQueue();
  if (queue.length === 0) {
    updateSyncStateFromQueue([], undefined, true);
    return { flushed: 0, remaining: 0 };
  }

  let flushed = 0;
  const remaining: QueuedActivityOp[] = [];
  const hasToken = Boolean(getAuthToken());

  for (const op of queue) {
    let stillNeedsFs = op.needsFirestore;
    let stillNeedsExp = op.needsExpress;

    if (stillNeedsFs) {
      const ok = await activeHooks.saveFirestore(op.entry).catch(() => false);
      if (ok) stillNeedsFs = false;
    }

    if (stillNeedsExp) {
      if (hasToken) {
        const ok = await activeHooks.sendExpress(op.entry).catch(() => false);
        if (ok) stillNeedsExp = false;
      } else if (!stillNeedsFs) {
        // Without a backend session token, Firestore alone already satisfied persistence
        stillNeedsExp = false;
      }
    }

    if (!stillNeedsFs && !stillNeedsExp) {
      flushed++;
    } else if (op.attempts < 5) {
      remaining.push({
        ...op,
        needsFirestore: stillNeedsFs,
        needsExpress: stillNeedsExp,
        attempts: op.attempts + 1,
        nextRetryAt: Date.now() + 2000 * Math.pow(2, Math.min(4, op.attempts))
      });
    } else {
      remaining.push({
        ...op,
        needsFirestore: stillNeedsFs,
        needsExpress: stillNeedsExp,
        lastError: 'Background sync delayed — entries preserved locally for retry'
      });
    }
  }

  saveSyncQueue(remaining);
  updateSyncStateFromQueue(remaining, remaining[0]?.lastError, flushed > 0 && remaining.length === 0);

  if (remaining.length > 0) {
    scheduleQueueRetry(8000);
  }

  return { flushed, remaining: remaining.length };
}

/**
 * Emits an explicit user activity log entry to Cloud Firestore primary,
 * mirrors to the authenticated Express API, and queues background retries on transient failures.
 */
export async function emitActivityLog(input: ActivityLogInput): Promise<{
  entry: AuditLogEntry;
  firestoreSaved: boolean;
  expressSaved: boolean;
}> {
  const entry = normalizeActivityLogEntry(input);

  const hasToken = Boolean(getAuthToken());

  const [fsOutcome, expOutcome] = await Promise.all([
    activeHooks.saveFirestore(entry).catch(() => false),
    hasToken ? activeHooks.sendExpress(entry).catch(() => false) : Promise.resolve(false)
  ]);

  const firestoreSaved = Boolean(fsOutcome);
  const expressSaved = Boolean(expOutcome);

  if (!firestoreSaved || (hasToken && !expressSaved)) {
    enqueueFailedTargets(entry, !firestoreSaved, hasToken && !expressSaved);
  }

  return {
    entry,
    firestoreSaved,
    expressSaved
  };
}

/**
 * Loads recent and historical activity logs primarily from Cloud Firestore,
 * enriched with Moderation Audit Logs and merged with Express fallback logs.
 */
export async function loadActivityLogsPrimary(limitCount = 500): Promise<{
  logs: AuditLogEntry[];
  firestoreOk: boolean;
  expressOk: boolean;
}> {
  const [fsResult, modResult, expResult] = await Promise.allSettled([
    activeHooks.loadFirestore(limitCount),
    activeHooks.loadModerationAudits(),
    activeHooks.loadExpress()
  ]);

  const firestoreLogs = fsResult.status === 'fulfilled' ? fsResult.value : [];
  const modAudits =
    modResult.status === 'fulfilled'
      ? modResult.value.map((rec) => mapModerationAuditToActivityLog(rec))
      : [];
  const expressPayload =
    expResult.status === 'fulfilled' ? expResult.value : { ok: false, logs: [] };

  const firestoreOk = fsResult.status === 'fulfilled';
  const expressOk = expressPayload.ok;

  const byId = new Map<string, AuditLogEntry>();
  for (const item of [...firestoreLogs, ...expressPayload.logs, ...modAudits]) {
    if (!item?.id) continue;
    if (!byId.has(item.id)) {
      byId.set(item.id, normalizeActivityLogEntry(item));
    }
  }

  const merged = Array.from(byId.values())
    .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())
    .slice(0, limitCount);

  return {
    logs: merged,
    firestoreOk,
    expressOk
  };
}
