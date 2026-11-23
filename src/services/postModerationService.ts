/**
 * Post Reporting & Content Moderation Service
 * Architecture: Cloud Firestore primary with localStorage mirror + idempotent Express sync fallback queue.
 * Ensures Vercel serverless cold starts or HTTP 500 responses never block reporting or moderation workflows.
 */

import {
  AbuseReporterTracking,
  AppNotification,
  InstitutionalFeedPost,
  ModerationActionType,
  ModerationAppeal,
  ModerationAuditRecord,
  ModerationCase,
  ModerationConfig,
  ModerationWarning,
  POST_REPORT_REASONS,
  PostContentSnapshot,
  PostReport,
  ReportPriority,
  ReportReason,
  ReportTargetType,
  UserProfile,
  UserRole,
  normalizeSystemRole
} from '../types';
import {
  getFeedPostsFromFirestore,
  loadModerationAppealsFromFirestore,
  loadModerationAuditRecordsFromFirestore,
  loadModerationCasesFromFirestore,
  loadModerationConfigFromFirestore,
  loadModerationWarningsFromFirestore,
  loadPostReportsFromFirestore,
  loadReporterTrackingFromFirestore,
  saveFeedPostToFirestore,
  saveModerationAuditRecordToFirestore,
  saveModerationCaseToFirestore,
  saveModerationWarningToFirestore,
  saveNotificationToFirestore,
  savePostReportToFirestore,
  saveReporterTrackingToFirestore,
  saveUserToFirestore
} from '../lib/firebase';
import {
  isAccountBannedOrLocked,
  isAccountSuspendedOrBanned,
  isReportableAuthorRole,
  resolvePostAuthorRole
} from '../lib/postVisibility';
import { createNotificationPayload } from '../lib/notificationDeepLink';
import { apiFetchWithCsrf, clearCsrfTokenCache, getAuthToken } from './apiClient';
import { generateSecureId } from '../lib/secureId';

const MODERATION_SNAPSHOT_KEY = 'alumni_moderation_state_v1';
const MODERATION_SYNC_QUEUE_KEY = 'alumni_moderation_sync_queue_v1';

export const DEFAULT_CLIENT_MODERATION_CONFIG: ModerationConfig = {
  warningSuspensionThreshold: 3,
  suspensionDurationDays: 7,
  banReviewThreshold: 4,
  dismissedReporterThreshold: 5,
  autoFlagReportThreshold: 5,
  autoHideHarassmentThreshold: 3,
  maxReportsPerHour: 10,
  profileTimelineEnabled: true
};

export interface ModerationBanFlagItem {
  userId: string;
  flaggedAt: string;
  activeWarnings: number;
  reason: string;
}

export type EnrichedModerationCase = ModerationCase & {
  reports: PostReport[];
  livePost: InstitutionalFeedPost | null;
  canAct: boolean;
  conflictReason?: string;
};

export interface ModerationCaseDetailPayload {
  case: ModerationCase;
  livePost: InstitutionalFeedPost | null;
  reports: PostReport[];
  authorWarningHistory: ModerationWarning[];
  activeWarningsCount: number;
  authorBanFlag: ModerationBanFlagItem | null;
  appeals: ModerationAppeal[];
  canAct: boolean;
  conflictReason?: string;
}

export interface ModerationStateCache {
  cases: ModerationCase[];
  reports: PostReport[];
  warnings: ModerationWarning[];
  auditLogs: ModerationAuditRecord[];
  appeals: ModerationAppeal[];
  reporterTracking: AbuseReporterTracking[];
  posts: Record<string, InstitutionalFeedPost>;
  config: ModerationConfig;
  banFlags: Record<string, ModerationBanFlagItem>;
  loadedAt: string;
}

export interface QueuedModerationSyncOp {
  operationId: string;
  endpoint: string;
  method: 'POST' | 'PUT' | 'PATCH';
  label: string;
  body: Record<string, any>;
  attempts: number;
  createdAt: string;
  lastAttemptAt?: string;
  nextRetryAtMs: number;
  lastError?: string;
}

export interface ModerationSyncStatus {
  pendingCount: number;
  syncDegradedAfterRetry: boolean;
  lastSyncedAt?: string;
  lastError?: string;
  failedOperations: Array<{
    operationId: string;
    endpoint: string;
    label: string;
    attempts: number;
    lastError?: string;
  }>;
}

export interface ModerationServiceActor {
  uid: string;
  name: string;
  email?: string;
  role: UserRole | string;
}

export interface ModerationPersistenceHooks {
  loadCases: typeof loadModerationCasesFromFirestore;
  loadReports: typeof loadPostReportsFromFirestore;
  loadWarnings: typeof loadModerationWarningsFromFirestore;
  loadAuditLogs: typeof loadModerationAuditRecordsFromFirestore;
  loadTrackers: typeof loadReporterTrackingFromFirestore;
  loadAppeals: typeof loadModerationAppealsFromFirestore;
  loadPosts: typeof getFeedPostsFromFirestore;
  loadConfig: typeof loadModerationConfigFromFirestore;
  saveCase: typeof saveModerationCaseToFirestore;
  saveReport: typeof savePostReportToFirestore;
  saveWarning: typeof saveModerationWarningToFirestore;
  saveAudit: typeof saveModerationAuditRecordToFirestore;
  saveTracker: typeof saveReporterTrackingToFirestore;
  savePost: typeof saveFeedPostToFirestore;
  saveNotification: typeof saveNotificationToFirestore;
  saveUser: typeof saveUserToFirestore;
  apiRequest: typeof apiFetchWithCsrf;
}

const defaultHooks: ModerationPersistenceHooks = {
  loadCases: loadModerationCasesFromFirestore,
  loadReports: loadPostReportsFromFirestore,
  loadWarnings: loadModerationWarningsFromFirestore,
  loadAuditLogs: loadModerationAuditRecordsFromFirestore,
  loadTrackers: loadReporterTrackingFromFirestore,
  loadAppeals: loadModerationAppealsFromFirestore,
  loadPosts: getFeedPostsFromFirestore,
  loadConfig: loadModerationConfigFromFirestore,
  saveCase: saveModerationCaseToFirestore,
  saveReport: savePostReportToFirestore,
  saveWarning: saveModerationWarningToFirestore,
  saveAudit: saveModerationAuditRecordToFirestore,
  saveTracker: saveReporterTrackingToFirestore,
  savePost: saveFeedPostToFirestore,
  saveNotification: saveNotificationToFirestore,
  saveUser: saveUserToFirestore,
  apiRequest: apiFetchWithCsrf
};

let activeHooks: ModerationPersistenceHooks = { ...defaultHooks };

export function setModerationPersistenceHooksForTests(
  overrides: Partial<ModerationPersistenceHooks> | null
): void {
  activeHooks = overrides ? { ...defaultHooks, ...overrides } : { ...defaultHooks };
}

function toMs(iso?: string): number {
  if (!iso) return 0;
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

function isResolvedStatus(status?: string): boolean {
  return status === 'dismissed' || status === 'action_taken' || status === 'post_removed';
}

export function getPriorityForReason(reason: ReportReason): ReportPriority {
  if (reason === 'Harassment or bullying' || reason === 'Fake profile/impersonation') {
    return 'high';
  }
  if (reason === 'Inappropriate content' || reason === 'Misinformation') {
    return 'medium';
  }
  return 'low';
}

export function priorityRank(priority: ReportPriority | string): number {
  if (priority === 'high') return 3;
  if (priority === 'medium') return 2;
  return 1;
}

export function maxPriority(a: ReportPriority, b: ReportPriority): ReportPriority {
  return priorityRank(a) >= priorityRank(b) ? a : b;
}

function sanitizeClientText(input: unknown, maxLength = 500): string {
  if (typeof input !== 'string') return '';
  let cleaned = input.trim();
  cleaned = cleaned
    .replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '')
    .replace(/<\s*iframe[^>]*>[\s\S]*?<\s*\/\s*iframe\s*>/gi, '')
    .replace(/<\s*object[^>]*>[\s\S]*?<\s*\/\s*object\s*>/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/data\s*:\s*text\/html/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/on\w+\s*=\s*[^\s>]+/gi, '');
  if (cleaned.length > maxLength) {
    cleaned = cleaned.slice(0, maxLength);
  }
  return cleaned;
}

function isModeratorRole(role?: string): boolean {
  const norm = normalizeSystemRole(role);
  return norm === 'moderator' || norm === 'admin' || norm === 'superadmin';
}

function isAdminRole(role?: string): boolean {
  const norm = normalizeSystemRole(role);
  return norm === 'admin' || norm === 'superadmin';
}

function buildContentSnapshot(post: Partial<InstitutionalFeedPost> | undefined | null): PostContentSnapshot {
  const safePost = post || {};
  const safeImg =
    typeof safePost.imageUrl === 'string' && safePost.imageUrl.startsWith('data:') && safePost.imageUrl.length > 25000
      ? undefined
      : safePost.imageUrl;
  return {
    title: safePost.title || '',
    content: safePost.content || '',
    imageUrl: safeImg,
    tags: Array.isArray(safePost.tags) ? [...safePost.tags] : undefined,
    postType: safePost.postType,
    authorId: safePost.authorId || 'unknown_author',
    authorName: safePost.authorName || 'Cecilian Member',
    capturedAt: new Date().toISOString()
  };
}

function checkSnapshotDiffers(
  snapshot?: PostContentSnapshot | null,
  post?: InstitutionalFeedPost | null
): boolean {
  if (!snapshot || !post) return false;
  if ((snapshot.title || '') !== (post.title || '')) return true;
  if ((snapshot.content || '') !== (post.content || '')) return true;
  if ((snapshot.imageUrl || '') !== (post.imageUrl || '')) return true;
  return false;
}

function compactPostForCache(post: InstitutionalFeedPost): InstitutionalFeedPost {
  const safeImageUrl =
    typeof post.imageUrl === 'string' && post.imageUrl.startsWith('data:') && post.imageUrl.length > 25000
      ? undefined
      : post.imageUrl;
  return {
    ...post,
    authorAvatar:
      typeof post.authorAvatar === 'string' && post.authorAvatar.startsWith('data:') && post.authorAvatar.length > 25000
        ? ''
        : post.authorAvatar,
    imageUrl: safeImageUrl,
    mediaUrl: safeImageUrl,
    comments: Array.isArray(post.comments)
      ? post.comments.slice(0, 15).map((c) => ({
          ...c,
          authorAvatar:
            typeof c.authorAvatar === 'string' && c.authorAvatar.startsWith('data:') && c.authorAvatar.length > 25000
              ? ''
              : c.authorAvatar
        }))
      : []
  };
}

function normalizeModCaseRecord(raw: any): ModerationCase {
  const nowIso = new Date().toISOString();
  const safeSnapshot: PostContentSnapshot = {
    title: raw?.contentSnapshot?.title || 'Alumni Post',
    content: raw?.contentSnapshot?.content || '',
    imageUrl: raw?.contentSnapshot?.imageUrl,
    tags: Array.isArray(raw?.contentSnapshot?.tags) ? raw.contentSnapshot.tags : undefined,
    postType: raw?.contentSnapshot?.postType,
    authorId: raw?.contentSnapshot?.authorId || raw?.postAuthorId || 'unknown_author',
    authorName: raw?.contentSnapshot?.authorName || raw?.postAuthorName || 'Cecilian Member',
    capturedAt: raw?.contentSnapshot?.capturedAt || raw?.createdAt || nowIso
  };
  const safeReportIds = Array.isArray(raw?.reportIds)
    ? raw.reportIds.filter((id: any) => typeof id === 'string')
    : [];
  const safeReasons =
    raw?.reasonsSummary && typeof raw.reasonsSummary === 'object' && !Array.isArray(raw.reasonsSummary)
      ? { ...raw.reasonsSummary }
      : {};
  return {
    ...raw,
    id: String(raw?.id || generateSecureId('case')),
    targetType: raw?.targetType === 'comment' ? 'comment' : 'post',
    targetId: String(raw?.targetId || ''),
    postAuthorId: String(raw?.postAuthorId || safeSnapshot.authorId || 'unknown_author'),
    postAuthorName: String(raw?.postAuthorName || safeSnapshot.authorName || 'Cecilian Member'),
    postAuthorRole: (raw?.postAuthorRole || 'alumni') as UserRole,
    status: raw?.status || 'pending',
    highestPriority:
      raw?.highestPriority === 'high' || raw?.highestPriority === 'medium' || raw?.highestPriority === 'low'
        ? raw.highestPriority
        : 'medium',
    reportCount: Math.max(0, Number(raw?.reportCount) || safeReportIds.length || 0),
    highPriorityReportCount: Math.max(0, Number(raw?.highPriorityReportCount) || 0),
    reasonsSummary: safeReasons,
    contentSnapshot: safeSnapshot,
    currentContent: raw?.currentContent ? { ...safeSnapshot, ...raw.currentContent } : safeSnapshot,
    contentEditedSinceSnapshot: Boolean(raw?.contentEditedSinceSnapshot),
    autoFlaggedForPriority: Boolean(raw?.autoFlaggedForPriority),
    autoHiddenPendingReview: Boolean(raw?.autoHiddenPendingReview),
    reportIds: safeReportIds,
    cycleNumber: Math.max(1, Number(raw?.cycleNumber) || 1),
    createdAt: raw?.createdAt || nowIso,
    updatedAt: raw?.updatedAt || raw?.createdAt || nowIso
  };
}

function safeWriteLocalJson(key: string, value: unknown): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err: any) {
    if (err?.name === 'QuotaExceededError' || err?.code === 22 || err?.code === 1014) {
      try {
        localStorage.removeItem(MODERATION_SNAPSHOT_KEY);
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // Ignore non-fatal localStorage quota errors
      }
    }
  }
}

function safeReadLocalJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadLocalModerationCache(): ModerationStateCache {
  const fallback: ModerationStateCache = {
    cases: [],
    reports: [],
    warnings: [],
    auditLogs: [],
    appeals: [],
    reporterTracking: [],
    posts: {},
    config: { ...DEFAULT_CLIENT_MODERATION_CONFIG },
    banFlags: {},
    loadedAt: ''
  };
  const parsed = safeReadLocalJson<Partial<ModerationStateCache> | null>(MODERATION_SNAPSHOT_KEY, null);
  if (!parsed || typeof parsed !== 'object') return fallback;
  return {
    cases: Array.isArray(parsed.cases) ? parsed.cases.map(normalizeModCaseRecord) : [],
    reports: Array.isArray(parsed.reports) ? parsed.reports : [],
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
    auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : [],
    appeals: Array.isArray(parsed.appeals) ? parsed.appeals : [],
    reporterTracking: Array.isArray(parsed.reporterTracking) ? parsed.reporterTracking : [],
    posts: parsed.posts && typeof parsed.posts === 'object' ? parsed.posts : {},
    config: { ...DEFAULT_CLIENT_MODERATION_CONFIG, ...(parsed.config || {}) },
    banFlags: parsed.banFlags && typeof parsed.banFlags === 'object' ? parsed.banFlags : {},
    loadedAt: parsed.loadedAt || ''
  };
}

export function saveLocalModerationCache(cache: ModerationStateCache): void {
  const compactPosts: Record<string, InstitutionalFeedPost> = {};
  Object.entries(cache.posts || {})
    .slice(0, 200)
    .forEach(([id, p]) => {
      if (p?.id) compactPosts[id] = compactPostForCache(p);
    });
  safeWriteLocalJson(MODERATION_SNAPSHOT_KEY, {
    ...cache,
    cases: (cache.cases || []).slice(0, 300),
    reports: (cache.reports || []).slice(0, 500),
    warnings: (cache.warnings || []).slice(0, 300),
    auditLogs: (cache.auditLogs || []).slice(0, 200),
    appeals: (cache.appeals || []).slice(0, 150),
    reporterTracking: (cache.reporterTracking || []).slice(0, 300),
    posts: compactPosts
  });
}

// =========================================================================
// IDEMPOTENT EXPRESS RETRY QUEUE & DEBOUNCED NON-BLOCKING SYNC INDICATOR
// =========================================================================

let retryTimerId: ReturnType<typeof setTimeout> | null = null;
let lastSuccessfulExpressSyncAt: string | undefined;
let lastExpressSyncError: string | undefined;
let activeFlushPromise: Promise<ModerationSyncStatus> | null = null;
let rerunRequested = false;
let rerunForceAll = false;
let rerunRetryDelayMs: number | undefined;
let queueEpoch = 0;
const syncListeners = new Set<(status: ModerationSyncStatus) => void>();

function readSyncQueue(): QueuedModerationSyncOp[] {
  const list = safeReadLocalJson<QueuedModerationSyncOp[]>(MODERATION_SYNC_QUEUE_KEY, []);
  return Array.isArray(list) ? list : [];
}

function writeSyncQueue(queue: QueuedModerationSyncOp[]): void {
  safeWriteLocalJson(MODERATION_SYNC_QUEUE_KEY, queue.slice(0, 100));
  notifySyncListeners();
}

export function getModerationSyncStatus(): ModerationSyncStatus {
  const queue = readSyncQueue();
  // Debounced indicator: only mark syncDegradedAfterRetry after at least 1 retry has failed (attempts >= 2)
  const retriedFailed = queue.filter((op) => op.attempts >= 2);
  return {
    pendingCount: queue.length,
    syncDegradedAfterRetry: retriedFailed.length > 0,
    lastSyncedAt: lastSuccessfulExpressSyncAt,
    lastError: retriedFailed.length > 0 ? retriedFailed[0].lastError || lastExpressSyncError : undefined,
    failedOperations: retriedFailed.map((op) => ({
      operationId: op.operationId,
      endpoint: op.endpoint,
      label: op.label,
      attempts: op.attempts,
      lastError: op.lastError
    }))
  };
}

function notifySyncListeners(): void {
  const status = getModerationSyncStatus();
  syncListeners.forEach((listener) => {
    try {
      listener(status);
    } catch {
      // Ignore subscriber errors
    }
  });
}

export function subscribeToModerationSyncStatus(
  listener: (status: ModerationSyncStatus) => void
): () => void {
  syncListeners.add(listener);
  listener(getModerationSyncStatus());
  return () => {
    syncListeners.delete(listener);
  };
}

export function clearModerationSyncQueueForTests(): void {
  if (retryTimerId) {
    clearTimeout(retryTimerId);
    retryTimerId = null;
  }
  queueEpoch += 1;
  lastSuccessfulExpressSyncAt = undefined;
  lastExpressSyncError = undefined;
  activeFlushPromise = null;
  rerunRequested = false;
  rerunForceAll = false;
  rerunRetryDelayMs = undefined;
  safeWriteLocalJson(MODERATION_SYNC_QUEUE_KEY, []);
}

async function executeSyncOperation(op: QueuedModerationSyncOp): Promise<{ done: boolean; error?: string }> {
  try {
    const res = await activeHooks.apiRequest(
      op.endpoint,
      {
        method: op.method,
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': op.operationId
        },
        body: JSON.stringify({
          ...op.body,
          operationId: op.operationId
        })
      },
      7000
    );

    if (res.ok) {
      return { done: true };
    }

    const body = await res.clone().json().catch(() => null);
    // Non-retryable conflict/duplicate states mean the server already resolved/recorded the entity
    if (
      res.status === 409 &&
      (body?.code === 'DUPLICATE_REPORT' || body?.code === 'ALREADY_HANDLED')
    ) {
      return { done: true };
    }

    if (res.status === 401) {
      clearCsrfTokenCache();
    }

    const msg = body?.error || `HTTP ${res.status}`;
    // Treat 4xx (other than 401/408/429) as non-retryable validation failure
    if (res.status >= 400 && res.status < 500 && res.status !== 401 && res.status !== 408 && res.status !== 429) {
      return { done: true, error: msg };
    }

    return { done: false, error: msg };
  } catch (err: any) {
    return { done: false, error: err?.message || 'Network or timeout error' };
  }
}

export async function processModerationSyncQueue(options?: {
  forceAll?: boolean;
  retryDelayMs?: number;
}): Promise<ModerationSyncStatus> {
  if (activeFlushPromise) {
    rerunRequested = true;
    rerunForceAll = rerunForceAll || Boolean(options?.forceAll);
    if (options?.retryDelayMs !== undefined) {
      rerunRetryDelayMs = options.retryDelayMs;
    }
    return activeFlushPromise;
  }

  if (readSyncQueue().length === 0) {
    return getModerationSyncStatus();
  }

  const startEpoch = queueEpoch;
  let currentForceAll = Boolean(options?.forceAll);
  let currentRetryDelayMs = options?.retryDelayMs;
  let finishedSync = false;

  const clearFlushState = () => {
    finishedSync = true;
    if (queueEpoch === startEpoch) {
      activeFlushPromise = null;
      rerunRequested = false;
      rerunForceAll = false;
      rerunRetryDelayMs = undefined;
    }
  };

  const runFlush = async (): Promise<ModerationSyncStatus> => {
    try {
      while (true) {
        if (queueEpoch !== startEpoch) {
          return getModerationSyncStatus();
        }

        const initialQueue = readSyncQueue();
        if (initialQueue.length === 0) {
          if (rerunRequested) {
            rerunRequested = false;
            currentForceAll = rerunForceAll;
            currentRetryDelayMs = rerunRetryDelayMs ?? currentRetryDelayMs;
            rerunForceAll = false;
            rerunRetryDelayMs = undefined;
            continue;
          }
          clearFlushState();
          return getModerationSyncStatus();
        }

        const now = Date.now();
        const processedIds = new Set(initialQueue.map((op) => op.operationId));
        const remaining: QueuedModerationSyncOp[] = [];
        const baseRetryMs = currentRetryDelayMs ?? 1200;

        for (const op of initialQueue) {
          if (queueEpoch !== startEpoch) {
            return getModerationSyncStatus();
          }

          if (!currentForceAll && op.nextRetryAtMs > now) {
            remaining.push(op);
            continue;
          }

          const result = await executeSyncOperation(op);
          if (queueEpoch !== startEpoch) {
            return getModerationSyncStatus();
          }

          if (result.done) {
            lastSuccessfulExpressSyncAt = new Date().toISOString();
            if (result.error) {
              lastExpressSyncError = result.error;
            }
            continue;
          }

          const nextAttempts = op.attempts + 1;
          lastExpressSyncError = result.error;
          if (nextAttempts < 6) {
            const backoff = Math.min(30000, baseRetryMs * Math.pow(2, Math.max(0, nextAttempts - 1)));
            remaining.push({
              ...op,
              attempts: nextAttempts,
              lastAttemptAt: new Date().toISOString(),
              nextRetryAtMs: Date.now() + backoff,
              lastError: result.error
            });
          }
        }

        // Merge any operations appended concurrently while this iteration was executing
        const latestQueue = readSyncQueue();
        const newlyAdded = latestQueue.filter((op) => !processedIds.has(op.operationId));
        const mergedRemaining = [...remaining, ...newlyAdded];

        writeSyncQueue(mergedRemaining);

        const shouldRunAnotherPass =
          rerunRequested || (newlyAdded.length > 0 && currentForceAll);

        if (shouldRunAnotherPass) {
          rerunRequested = false;
          currentForceAll = rerunForceAll || newlyAdded.length > 0;
          currentRetryDelayMs = rerunRetryDelayMs ?? currentRetryDelayMs;
          rerunForceAll = false;
          rerunRetryDelayMs = undefined;
          continue;
        }

        // Automatically schedule the next retry if anything remains pending
        if (mergedRemaining.length > 0 && typeof window !== 'undefined' && !retryTimerId) {
          const nextDueIn = Math.max(
            250,
            Math.min(...mergedRemaining.map((r) => r.nextRetryAtMs)) - Date.now()
          );
          retryTimerId = setTimeout(() => {
            retryTimerId = null;
            void processModerationSyncQueue({ retryDelayMs: baseRetryMs });
          }, nextDueIn);
        }

        clearFlushState();
        return getModerationSyncStatus();
      }
    } finally {
      clearFlushState();
    }
  };

  const p = runFlush();
  if (!finishedSync) {
    activeFlushPromise = p;
  }
  return p;
}

export async function enqueueModerationSyncOp(
  opInput: Omit<QueuedModerationSyncOp, 'attempts' | 'createdAt' | 'nextRetryAtMs'>,
  options?: { awaitInitialAttempt?: boolean; retryDelayMs?: number }
): Promise<void> {
  const queue = readSyncQueue();
  const op: QueuedModerationSyncOp = {
    ...opInput,
    attempts: 0,
    createdAt: new Date().toISOString(),
    nextRetryAtMs: Date.now()
  };
  writeSyncQueue([...queue.filter((q) => q.operationId !== op.operationId), op]);

  const flushPromise = processModerationSyncQueue({
    forceAll: true,
    retryDelayMs: options?.retryDelayMs
  });
  if (options?.awaitInitialAttempt) {
    await flushPromise;
  } else {
    void flushPromise;
  }
}

export async function retryQueuedModerationSync(): Promise<ModerationSyncStatus> {
  return processModerationSyncQueue({ forceAll: true });
}

// =========================================================================
// RECONCILIATION & CONFLICT EVALUATION (SHARED ENGINE PARITY)
// =========================================================================

export function evaluateReviewerConflict(
  modCase: ModerationCase,
  caseReports: PostReport[],
  actor: ModerationServiceActor
): { canAct: boolean; reason?: string } {
  if (!isModeratorRole(actor.role)) {
    return { canAct: false, reason: 'Only moderators and administrators can review reports.' };
  }
  if (modCase.postAuthorId === actor.uid) {
    return { canAct: false, reason: 'You cannot review reports filed against your own post.' };
  }
  if (isModeratorRole(modCase.postAuthorRole) && !isAdminRole(actor.role)) {
    return {
      canAct: false,
      reason: 'Posts authored by moderators or administrators can only be reviewed by an Administrator.'
    };
  }
  if (caseReports.some((r) => r.reporterId === actor.uid)) {
    return {
      canAct: false,
      reason: 'Conflict of interest: you cannot review a case containing a report you submitted.'
    };
  }
  return { canAct: true };
}

function mergeSnapshots(
  cloud: {
    cases: ModerationCase[];
    reports: PostReport[];
    warnings: ModerationWarning[];
    auditLogs: ModerationAuditRecord[];
    appeals: ModerationAppeal[];
    reporterTracking: AbuseReporterTracking[];
    posts: InstitutionalFeedPost[];
    config: ModerationConfig | null;
  },
  local: ModerationStateCache,
  contextPosts: InstitutionalFeedPost[] = [],
  currentUsers: UserProfile[] = []
): ModerationStateCache {
  const postsById: Record<string, InstitutionalFeedPost> = {};
  for (const p of [...Object.values(local.posts || {}), ...contextPosts, ...cloud.posts]) {
    if (!p?.id) continue;
    const prev = postsById[p.id];
    if (!prev) {
      postsById[p.id] = p;
    } else {
      const incomingScore = (p.isSoftDeleted ? 2 : 0) + (p.flaggedByModerators ? 1 : 0);
      const prevScore = (prev.isSoftDeleted ? 2 : 0) + (prev.flaggedByModerators ? 1 : 0);
      const pMs = toMs(p.updatedAt || p.softDeletedAt || p.createdAt);
      const prevMs = toMs(prev.updatedAt || prev.softDeletedAt || prev.createdAt);
      if (pMs > prevMs || (pMs === prevMs && incomingScore >= prevScore)) {
        postsById[p.id] = { ...prev, ...p };
      }
    }
  }

  const reportById = new Map<string, PostReport>();
  for (const r of [...local.reports, ...cloud.reports]) {
    if (!r?.id) continue;
    const existing = reportById.get(r.id);
    if (!existing) {
      reportById.set(r.id, r);
    } else {
      const existingScore = isResolvedStatus(existing.status) ? 10 : existing.status === 'reviewed' ? 5 : 0;
      const incomingScore = isResolvedStatus(r.status) ? 10 : r.status === 'reviewed' ? 5 : 0;
      if (incomingScore > existingScore || toMs(r.resolvedAt) > toMs(existing.resolvedAt)) {
        reportById.set(r.id, { ...existing, ...r });
      }
    }
  }
  const mergedReports = Array.from(reportById.values()).sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));

  const caseById = new Map<string, ModerationCase>();
  for (const rawCase of [...local.cases, ...cloud.cases]) {
    if (!rawCase?.id) continue;
    const incoming = normalizeModCaseRecord(rawCase);
    const existing = caseById.get(incoming.id);
    if (!existing) {
      caseById.set(incoming.id, incoming);
    } else {
      const incomingMs = toMs(incoming.updatedAt || incoming.resolvedAt || incoming.createdAt);
      const existingMs = toMs(existing.updatedAt || existing.resolvedAt || existing.createdAt);
      const mergedReportIds = Array.from(new Set([...(existing.reportIds || []), ...(incoming.reportIds || [])]));
      if (incomingMs > existingMs || (isResolvedStatus(incoming.status) && !isResolvedStatus(existing.status))) {
        caseById.set(
          incoming.id,
          normalizeModCaseRecord({
            ...existing,
            ...incoming,
            reportIds: mergedReportIds
          })
        );
      } else {
        caseById.set(
          existing.id,
          normalizeModCaseRecord({
            ...incoming,
            ...existing,
            reportIds: mergedReportIds
          })
        );
      }
    }
  }

  // Reconcile orphaned reports -> ensure every report is attached to a ModerationCase
  for (const rep of mergedReports) {
    let parent =
      (rep.caseId ? caseById.get(rep.caseId) : undefined) ||
      Array.from(caseById.values()).find((c) => c.targetType === rep.targetType && c.targetId === rep.targetId);
    if (!parent && rep.targetId) {
      const post = postsById[rep.targetId];
      const caseId = rep.caseId || generateSecureId('case');
      rep.caseId = caseId;
      parent = normalizeModCaseRecord({
        id: caseId,
        targetType: rep.targetType || 'post',
        targetId: rep.targetId,
        postAuthorId: post?.authorId || 'unknown_author',
        postAuthorName: post?.authorName || 'Cecilian Member',
        postAuthorRole: post?.authorRole || 'alumni',
        status: rep.status || 'pending',
        highestPriority: rep.priority || 'medium',
        reportCount: 1,
        highPriorityReportCount: rep.priority === 'high' ? 1 : 0,
        reasonsSummary: { [rep.reason]: 1 },
        contentSnapshot: buildContentSnapshot(post),
        currentContent: buildContentSnapshot(post),
        reportIds: [rep.id],
        cycleNumber: rep.cycleNumber || 1,
        createdAt: rep.createdAt,
        updatedAt: rep.resolvedAt || rep.createdAt
      });
      caseById.set(parent.id, parent);
    } else if (parent) {
      if (!rep.caseId) rep.caseId = parent.id;
      if (!parent.reportIds.includes(rep.id)) {
        parent.reportIds.push(rep.id);
      }
    }
  }

  // Recompute aggregate report stats cleanly for each case
  for (const modCase of caseById.values()) {
    const linkedReports = mergedReports.filter((r) => r.caseId === modCase.id);
    if (linkedReports.length > 0) {
      modCase.reportIds = linkedReports.map((r) => r.id);
      modCase.reportCount = Math.max(modCase.reportCount, linkedReports.length);
      let highCount = 0;
      const summary: Record<string, number> = {};
      let topPrio: ReportPriority = modCase.highestPriority || 'low';
      for (const r of linkedReports) {
        if (r.priority === 'high') highCount++;
        topPrio = maxPriority(topPrio, r.priority || 'low');
        summary[r.reason] = (summary[r.reason] || 0) + 1;
      }
      modCase.highPriorityReportCount = Math.max(modCase.highPriorityReportCount, highCount);
      modCase.highestPriority = topPrio;
      modCase.reasonsSummary = summary;
    }
    const livePost = postsById[modCase.targetId];
    if (livePost) {
      modCase.currentContent = buildContentSnapshot(livePost);
      modCase.contentEditedSinceSnapshot = checkSnapshotDiffers(modCase.contentSnapshot, livePost);
    }
  }

  const mergedCases = Array.from(caseById.values()).sort(
    (a, b) => toMs(b.updatedAt || b.createdAt) - toMs(a.updatedAt || a.createdAt)
  );

  const warningById = new Map<string, ModerationWarning>();
  for (const w of [...local.warnings, ...cloud.warnings]) {
    if (!w?.id) continue;
    const prev = warningById.get(w.id);
    if (!prev || (w.overturned && !prev.overturned)) {
      warningById.set(w.id, { ...(prev || {}), ...w });
    }
  }
  const mergedWarnings = Array.from(warningById.values()).sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));

  const auditById = new Map<string, ModerationAuditRecord>();
  for (const a of [...local.auditLogs, ...cloud.auditLogs]) {
    if (a?.id && !auditById.has(a.id)) {
      auditById.set(a.id, a);
    }
  }
  const mergedAudits = Array.from(auditById.values()).sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));

  const trackerByUid = new Map<string, AbuseReporterTracking>();
  for (const tr of [...local.reporterTracking, ...cloud.reporterTracking]) {
    if (!tr?.userId) continue;
    const existing = trackerByUid.get(tr.userId);
    if (!existing) {
      trackerByUid.set(tr.userId, { ...tr });
    } else {
      trackerByUid.set(tr.userId, {
        ...existing,
        ...tr,
        totalReportsCount: Math.max(existing.totalReportsCount || 0, Number(tr.totalReportsCount) || 0),
        totalDismissedCount: Math.max(existing.totalDismissedCount || 0, Number(tr.totalDismissedCount) || 0),
        consecutiveDismissedCount: Math.max(
          existing.consecutiveDismissedCount || 0,
          Number(tr.consecutiveDismissedCount) || 0
        ),
        flaggedAbusiveReporter: Boolean(existing.flaggedAbusiveReporter || tr.flaggedAbusiveReporter),
        reportingRestricted: Boolean(tr.reportingRestricted)
      });
    }
  }

  const appealsById = new Map<string, ModerationAppeal>();
  for (const ap of [...local.appeals, ...cloud.appeals]) {
    if (ap?.id) appealsById.set(ap.id, ap);
  }

  const config: ModerationConfig = {
    ...DEFAULT_CLIENT_MODERATION_CONFIG,
    ...(local.config || {}),
    ...(cloud.config || {})
  };

  // Compute escalated ban review flags dynamically from active warnings
  const banFlags: Record<string, ModerationBanFlagItem> = {};
  const warningsByUser = new Map<string, ModerationWarning[]>();
  for (const w of mergedWarnings) {
    if (!w.overturned && w.userId) {
      const arr = warningsByUser.get(w.userId) || [];
      arr.push(w);
      warningsByUser.set(w.userId, arr);
    }
  }
  for (const [uid, activeList] of warningsByUser.entries()) {
    if (activeList.length >= config.banReviewThreshold) {
      const targetUser = currentUsers.find((u) => u.uid === uid);
      if (targetUser && isAccountBannedOrLocked(targetUser)) {
        continue;
      }
      const st = String(targetUser?.accountStatus || targetUser?.status || '').toUpperCase().trim();
      if (targetUser && st === 'ACTIVE' && local.banFlags && !local.banFlags[uid]) {
        // Respect lifted sanctions if previously cleared
        continue;
      }
      const existingFlag = local.banFlags?.[uid];
      banFlags[uid] = existingFlag || {
        userId: uid,
        flaggedAt: activeList[0]?.createdAt || new Date().toISOString(),
        activeWarnings: activeList.length,
        reason: `User reached ${activeList.length} active warnings (post-suspension threshold). Admin review required for ban.`
      };
    }
  }

  return {
    cases: mergedCases,
    reports: mergedReports,
    warnings: mergedWarnings,
    auditLogs: mergedAudits,
    appeals: Array.from(appealsById.values()),
    reporterTracking: Array.from(trackerByUid.values()),
    posts: postsById,
    config,
    banFlags,
    loadedAt: new Date().toISOString()
  };
}

// =========================================================================
// PRIMARY FIRESTORE READ & QUERY FUNCTIONS
// =========================================================================

export async function loadModerationStatePrimary(
  currentUsers: UserProfile[] = [],
  contextPosts: InstitutionalFeedPost[] = []
): Promise<ModerationStateCache> {
  const localCache = loadLocalModerationCache();

  const [
    casesRes,
    reportsRes,
    warningsRes,
    auditsRes,
    trackersRes,
    appealsRes,
    postsRes,
    configRes
  ] = await Promise.allSettled([
    activeHooks.loadCases(),
    activeHooks.loadReports(),
    activeHooks.loadWarnings(),
    activeHooks.loadAuditLogs(),
    activeHooks.loadTrackers(),
    activeHooks.loadAppeals(),
    activeHooks.loadPosts(),
    activeHooks.loadConfig()
  ]);

  const merged = mergeSnapshots(
    {
      cases: casesRes.status === 'fulfilled' ? casesRes.value : [],
      reports: reportsRes.status === 'fulfilled' ? reportsRes.value : [],
      warnings: warningsRes.status === 'fulfilled' ? warningsRes.value : [],
      auditLogs: auditsRes.status === 'fulfilled' ? auditsRes.value : [],
      reporterTracking: trackersRes.status === 'fulfilled' ? trackersRes.value : [],
      appeals: appealsRes.status === 'fulfilled' ? appealsRes.value : [],
      posts: postsRes.status === 'fulfilled' ? postsRes.value : [],
      config: configRes.status === 'fulfilled' ? configRes.value : null
    },
    localCache,
    contextPosts,
    currentUsers
  );

  saveLocalModerationCache(merged);

  // Opportunistic silent background sync flush for any previously queued writes; never throws or degrades on initial read
  void processModerationSyncQueue();

  return merged;
}

export function getPendingCountPrimary(snapshot: ModerationStateCache, actor: ModerationServiceActor): number {
  if (!isModeratorRole(actor.role)) return 0;
  return snapshot.cases.filter((c) => {
    if (c.status !== 'pending' && c.status !== 'reviewed') return false;
    const caseReports = snapshot.reports.filter((r) => r.caseId === c.id);
    return evaluateReviewerConflict(c, caseReports, actor).canAct;
  }).length;
}

export function queryModerationCases(
  snapshot: ModerationStateCache,
  actor: ModerationServiceActor,
  query: {
    page?: number;
    pageSize?: number;
    status?: string;
    reason?: string;
    priority?: string;
    sort?: 'priority' | 'most_reported' | 'newest';
    search?: string;
  }
): {
  cases: EnrichedModerationCase[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  pendingCount: number;
} {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 10));
  const search = (query.search || '').toLowerCase().trim();

  let filtered = snapshot.cases.filter((c) => {
    const caseReports = snapshot.reports.filter((r) => r.caseId === c.id);
    const conflict = evaluateReviewerConflict(c, caseReports, actor);
    if (!conflict.canAct && !isAdminRole(actor.role)) {
      return false;
    }

    if (query.status && query.status !== 'all') {
      if (query.status === 'open') {
        if (c.status !== 'pending' && c.status !== 'reviewed') return false;
      } else if (c.status !== query.status) {
        return false;
      }
    }
    if (query.priority && query.priority !== 'all') {
      if (c.highestPriority !== query.priority) return false;
    }
    if (query.reason && query.reason !== 'all') {
      if (!c.reasonsSummary || !c.reasonsSummary[query.reason]) return false;
    }
    if (search) {
      const caseReportText = caseReports
        .map((r) => `${r.reporterName || ''} ${r.reason || ''} ${r.details || ''}`)
        .join(' ');
      const text = `${c.postAuthorName || ''} ${c.contentSnapshot?.title || ''} ${
        c.contentSnapshot?.content || ''
      } ${c.id || ''} ${caseReportText}`.toLowerCase();
      if (!text.includes(search)) return false;
    }
    return true;
  });

  const sortMode = query.sort || 'priority';
  filtered = [...filtered].sort((a, b) => {
    if (sortMode === 'priority') {
      const diff = priorityRank(b.highestPriority) - priorityRank(a.highestPriority);
      if (diff !== 0) return diff;
      if ((b.reportCount || 0) !== (a.reportCount || 0)) return (b.reportCount || 0) - (a.reportCount || 0);
      return toMs(b.updatedAt || b.createdAt) - toMs(a.updatedAt || a.createdAt);
    }
    if (sortMode === 'most_reported') {
      if ((b.reportCount || 0) !== (a.reportCount || 0)) return (b.reportCount || 0) - (a.reportCount || 0);
      return toMs(b.updatedAt || b.createdAt) - toMs(a.updatedAt || a.createdAt);
    }
    return toMs(b.createdAt) - toMs(a.createdAt);
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const sliced = filtered.slice((page - 1) * pageSize, page * pageSize);

  const enriched: EnrichedModerationCase[] = sliced.map((c) => {
    const caseReports = snapshot.reports.filter((r) => r.caseId === c.id);
    const conflict = evaluateReviewerConflict(c, caseReports, actor);
    const livePost = snapshot.posts[c.targetId] || null;
    return {
      ...c,
      reports: caseReports,
      livePost,
      canAct: conflict.canAct,
      conflictReason: conflict.reason
    };
  });

  return {
    cases: enriched,
    total,
    page,
    pageSize,
    totalPages,
    pendingCount: getPendingCountPrimary(snapshot, actor)
  };
}

export function getModerationCaseDetailPrimary(
  snapshot: ModerationStateCache,
  caseId: string,
  actor: ModerationServiceActor
): ModerationCaseDetailPayload {
  const modCase = snapshot.cases.find((c) => c.id === caseId);
  if (!modCase) {
    throw new Error('Moderation case not found.');
  }
  const caseReports = snapshot.reports.filter((r) => r.caseId === caseId);
  const conflict = evaluateReviewerConflict(modCase, caseReports, actor);
  if (!conflict.canAct && !isAdminRole(actor.role)) {
    throw new Error(conflict.reason || 'Conflict of interest: you cannot inspect this case.');
  }
  const livePost = snapshot.posts[modCase.targetId] || null;
  const authorWarnings = snapshot.warnings.filter((w) => w.userId === modCase.postAuthorId);
  const appeals = snapshot.appeals.filter((a) => a.caseId === caseId);
  const authorBanFlag = snapshot.banFlags[modCase.postAuthorId] || null;

  return {
    case: {
      ...modCase,
      contentEditedSinceSnapshot: livePost
        ? checkSnapshotDiffers(modCase.contentSnapshot, livePost)
        : modCase.contentEditedSinceSnapshot
    },
    livePost,
    reports: caseReports,
    authorWarningHistory: authorWarnings,
    activeWarningsCount: authorWarnings.filter((w) => !w.overturned).length,
    authorBanFlag,
    appeals,
    canAct: conflict.canAct,
    conflictReason: conflict.reason
  };
}

// =========================================================================
// PRIMARY FIRESTORE MUTATIONS WITH IDEMPOTENT EXPRESS FALLBACK SYNC
// =========================================================================

export async function submitPostReportPrimary(
  actor: UserProfile,
  payload: {
    targetType?: ReportTargetType;
    targetId: string;
    reason: ReportReason;
    details?: string;
    postSnapshot?: InstitutionalFeedPost;
  },
  context: {
    users?: UserProfile[];
    feedPosts?: InstitutionalFeedPost[];
  } = {}
): Promise<{
  success: true;
  message: string;
  operationId: string;
  report: PostReport;
  modCase: ModerationCase;
  auditRecord: ModerationAuditRecord;
  affectedPost: InstitutionalFeedPost;
  firestoreSaved: boolean;
}> {
  if (!actor?.uid) {
    throw new Error('Please sign in to report a post.');
  }
  const targetType: ReportTargetType = payload.targetType || 'post';
  if (targetType !== 'post') {
    throw new Error('Currently only post reporting is enabled.');
  }
  if (!POST_REPORT_REASONS.includes(payload.reason)) {
    throw new Error('Please select a valid report reason.');
  }
  if (isAccountSuspendedOrBanned(actor)) {
    throw new Error('Your account is currently suspended or restricted and cannot submit reports.');
  }

  const allUsers = context.users || [];
  const snapshot = await loadModerationStatePrimary(allUsers, context.feedPosts || []);

  const trackerExisting = snapshot.reporterTracking.find((t) => t.userId === actor.uid);
  if (trackerExisting?.reportingRestricted) {
    throw new Error(
      trackerExisting.restrictionReason ||
        'Your ability to report posts has been restricted due to repeated invalid reports.'
    );
  }

  const post = payload.postSnapshot || snapshot.posts[payload.targetId] || (context.feedPosts || []).find((p) => p.id === payload.targetId);
  if (!post) {
    throw new Error('The post you are trying to report no longer exists.');
  }
  if (post.isSoftDeleted) {
    throw new Error('Cannot report a deleted post.');
  }
  if (post.authorId === actor.uid && !post.authorDeleted) {
    throw new Error('You cannot report your own post.');
  }

  const liveAuthor =
    post.authorId && post.authorId !== 'anonymous' && post.authorId !== 'former_alumni'
      ? allUsers.find((u) => u.uid === post.authorId)
      : undefined;
  const resolvedAuthorRole = resolvePostAuthorRole(post, liveAuthor);
  if (!isReportableAuthorRole(resolvedAuthorRole)) {
    throw new Error('Only posts created by alumni or employers can be reported.');
  }

  const existingReport = snapshot.reports.find(
    (r) => r.targetType === targetType && r.targetId === payload.targetId && r.reporterId === actor.uid
  );
  if (existingReport) {
    throw new Error('You already reported this post');
  }

  const cleanDetails = sanitizeClientText(payload.details || '', 500) || undefined;
  const nowIso = new Date().toISOString();
  const priority = getPriorityForReason(payload.reason);
  const operationId = generateSecureId('op');

  let modCase = snapshot.cases.find((c) => c.targetType === targetType && c.targetId === payload.targetId);
  let wasReopened = false;

  if (!modCase) {
    const snap = buildContentSnapshot(post);
    modCase = {
      id: generateSecureId('case'),
      targetType,
      targetId: post.id,
      postAuthorId: post.authorId || 'unknown_author',
      postAuthorName: post.authorName || 'Cecilian Member',
      postAuthorRole: (resolvedAuthorRole || 'alumni') as UserRole,
      status: 'pending',
      highestPriority: priority,
      reportCount: 0,
      highPriorityReportCount: 0,
      reasonsSummary: {},
      contentSnapshot: snap,
      currentContent: snap,
      contentEditedSinceSnapshot: false,
      autoFlaggedForPriority: false,
      autoHiddenPendingReview: false,
      reportIds: [],
      cycleNumber: 1,
      createdAt: nowIso,
      updatedAt: nowIso
    };
  } else {
    modCase = normalizeModCaseRecord(modCase);
    if (modCase.status === 'dismissed') {
      wasReopened = true;
      modCase.status = 'pending';
      modCase.cycleNumber += 1;
      modCase.claimedBy = undefined;
      modCase.claimedByName = undefined;
      modCase.claimedAt = undefined;
      modCase.resolvedBy = undefined;
      modCase.resolvedByName = undefined;
      modCase.resolvedByRole = undefined;
      modCase.resolvedAt = undefined;
      modCase.resolvedAction = undefined;
      modCase.resolutionNote = undefined;
      modCase.updatedAt = nowIso;
    }
  }

  const report: PostReport = {
    id: generateSecureId('rep'),
    caseId: modCase.id,
    targetType,
    targetId: post.id,
    reason: payload.reason,
    priority,
    ...(cleanDetails ? { details: cleanDetails } : {}),
    reporterId: actor.uid,
    reporterName: actor.name || actor.email || 'Cecilian Member',
    reporterRole: actor.role || 'alumni',
    status: 'pending',
    cycleNumber: modCase.cycleNumber,
    createdAt: nowIso
  };

  modCase.reportIds = [...modCase.reportIds, report.id];
  modCase.reportCount += 1;
  if (priority === 'high') {
    modCase.highPriorityReportCount += 1;
  }
  modCase.highestPriority = maxPriority(modCase.highestPriority, priority);
  modCase.reasonsSummary = {
    ...(modCase.reasonsSummary || {}),
    [payload.reason]: (modCase.reasonsSummary?.[payload.reason] || 0) + 1
  };
  modCase.currentContent = buildContentSnapshot(post);
  modCase.contentEditedSinceSnapshot = checkSnapshotDiffers(modCase.contentSnapshot, post);
  modCase.updatedAt = nowIso;

  const updatedPost: InstitutionalFeedPost = { ...post };
  const auditsToSave: ModerationAuditRecord[] = [];
  const notificationsToSave: AppNotification[] = [];

  if (wasReopened) {
    auditsToSave.push({
      id: generateSecureId('mod_audit'),
      action: 'CASE_REOPENED',
      actorId: 'system',
      actorName: 'Moderation Lifecycle Engine',
      actorRole: 'system',
      targetType,
      postId: post.id,
      caseId: modCase.id,
      reportIds: [report.id],
      note: 'Previously dismissed case reopened due to new report.',
      createdAt: nowIso
    });
  }

  if (!modCase.autoFlaggedForPriority && modCase.reportCount >= snapshot.config.autoFlagReportThreshold) {
    modCase.autoFlaggedForPriority = true;
    modCase.highestPriority = 'high';
    auditsToSave.push({
      id: generateSecureId('mod_audit'),
      action: 'POST_AUTO_FLAGGED_PRIORITY',
      actorId: 'system',
      actorName: 'Abuse Prevention Engine',
      actorRole: 'system',
      targetType,
      postId: post.id,
      caseId: modCase.id,
      reportIds: [...modCase.reportIds],
      note: `Post reached ${modCase.reportCount} reports and was auto-flagged for priority review.`,
      createdAt: nowIso
    });
  }

  if (
    !modCase.autoHiddenPendingReview &&
    modCase.highPriorityReportCount >= snapshot.config.autoHideHarassmentThreshold
  ) {
    modCase.autoHiddenPendingReview = true;
    updatedPost.underReviewAutoHidden = true;
    updatedPost.autoHiddenAt = nowIso;
    auditsToSave.push({
      id: generateSecureId('mod_audit'),
      action: 'POST_AUTO_HIDDEN_HARASSMENT',
      actorId: 'system',
      actorName: 'Abuse Prevention Engine',
      actorRole: 'system',
      targetType,
      postId: post.id,
      caseId: modCase.id,
      reportIds: [...modCase.reportIds],
      note: `Post temporarily hidden from feeds after ${modCase.highPriorityReportCount} high-priority reports.`,
      createdAt: nowIso
    });
  }

  const reportAudit: ModerationAuditRecord = {
    id: generateSecureId('mod_audit'),
    action: 'REPORT_SUBMITTED',
    actorId: actor.uid,
    actorName: actor.name || actor.email || 'Cecilian Member',
    actorRole: actor.role || 'alumni',
    targetType,
    postId: post.id,
    caseId: modCase.id,
    reportIds: [report.id],
    note: `Reason: ${payload.reason} (Priority: ${priority})`,
    createdAt: nowIso
  };
  auditsToSave.push(reportAudit);

  const nextTracker: AbuseReporterTracking = {
    ...(trackerExisting || {
      userId: actor.uid,
      consecutiveDismissedCount: 0,
      totalDismissedCount: 0,
      totalReportsCount: 0,
      flaggedAbusiveReporter: false,
      reportingRestricted: false
    }),
    userName: actor.name || actor.email,
    userRole: actor.role,
    totalReportsCount: (trackerExisting?.totalReportsCount || 0) + 1
  };

  if (priority === 'high' || modCase.autoFlaggedForPriority) {
    allUsers
      .filter((u) => {
        const r = normalizeSystemRole(u.role);
        return ['moderator', 'admin', 'superadmin'].includes(r) && u.uid !== modCase!.postAuthorId;
      })
      .forEach((reviewer) => {
        notificationsToSave.push(
          createNotificationPayload(
            {
              id: generateSecureId('mod_notif'),
              toUid: reviewer.uid,
              type: 'moderation_high_priority',
              title: 'High-Priority Post Report',
              body: `A post by ${post.authorName} received a high-priority report (${modCase!.reportCount} total reports).`,
              refId: modCase!.id,
              read: false,
              createdAt: nowIso,
              metadata: {
                caseId: modCase!.id,
                postId: post.id,
                priority: modCase!.highestPriority,
                audience: 'moderators'
              }
            },
            reviewer.role
          )
        );
      });
  }

  // Persist to Cloud Firestore Primary
  const writeResults = await Promise.all([
    activeHooks.saveReport(report),
    activeHooks.saveCase(modCase),
    activeHooks.saveTracker(nextTracker),
    activeHooks.savePost(updatedPost),
    ...auditsToSave.map((a) => activeHooks.saveAudit(a)),
    ...notificationsToSave.map((n) => activeHooks.saveNotification(n).then(() => true, () => false))
  ]);
  const firestoreSaved = Boolean(writeResults[0] && writeResults[1]);

  // Update local cache immediately
  const updatedSnapshot: ModerationStateCache = {
    ...snapshot,
    reports: [report, ...snapshot.reports],
    cases: [modCase, ...snapshot.cases.filter((c) => c.id !== modCase!.id)],
    auditLogs: [...auditsToSave, ...snapshot.auditLogs],
    reporterTracking: [
      nextTracker,
      ...snapshot.reporterTracking.filter((t) => t.userId !== nextTracker.userId)
    ],
    posts: {
      ...snapshot.posts,
      [updatedPost.id]: updatedPost
    }
  };
  saveLocalModerationCache(updatedSnapshot);

  // Best-effort idempotent Express API sync in background (never blocks Firestore-backed submission)
  if (getAuthToken()) {
    void enqueueModerationSyncOp({
      operationId,
      endpoint: '/api/reports',
      method: 'POST',
      label: 'Submit Post Report',
      body: {
        targetType,
        targetId: post.id,
        reason: payload.reason,
        details: cleanDetails,
        postSnapshotFallback: compactPostForCache(post)
      }
    });
  }

  return {
    success: true,
    message: 'Thanks, our moderators will review your report.',
    operationId,
    report,
    modCase,
    auditRecord: reportAudit,
    affectedPost: updatedPost,
    firestoreSaved
  };
}

export async function claimOrReleaseCasePrimary(
  actor: ModerationServiceActor,
  caseId: string,
  mode: 'claim' | 'release',
  currentSnapshot: ModerationStateCache
): Promise<{
  case: ModerationCase;
  auditRecord: ModerationAuditRecord;
  snapshot: ModerationStateCache;
}> {
  if (!isModeratorRole(actor.role)) {
    throw new Error('Only moderators and administrators can update moderation locks.');
  }

  const modCaseRaw = currentSnapshot.cases.find((c) => c.id === caseId);
  if (!modCaseRaw) {
    throw new Error('Moderation case not found.');
  }
  const modCase = normalizeModCaseRecord({ ...modCaseRaw });
  if (isResolvedStatus(modCase.status)) {
    throw new Error('This report was already handled by another moderator.');
  }

  const caseReports = currentSnapshot.reports.filter((r) => r.caseId === caseId);
  const nowIso = new Date().toISOString();
  const operationId = generateSecureId('op');

  if (mode === 'claim') {
    const conflict = evaluateReviewerConflict(modCase, caseReports, actor);
    if (!conflict.canAct) {
      throw new Error(conflict.reason || 'Conflict of interest.');
    }
    if (modCase.claimedBy && modCase.claimedBy !== actor.uid) {
      throw new Error(`Being reviewed by ${modCase.claimedByName || 'another moderator'}.`);
    }
    modCase.claimedBy = actor.uid;
    modCase.claimedByName = actor.name;
    modCase.claimedAt = nowIso;
    if (modCase.status === 'pending') {
      modCase.status = 'reviewed';
    }
    modCase.updatedAt = nowIso;
  } else {
    if (modCase.claimedBy && modCase.claimedBy !== actor.uid && !isAdminRole(actor.role)) {
      throw new Error('Only the claiming moderator or an administrator can release this case.');
    }
    modCase.claimedBy = undefined;
    modCase.claimedByName = undefined;
    modCase.claimedAt = undefined;
    modCase.status = 'pending';
    modCase.updatedAt = nowIso;
  }

  const auditRecord: ModerationAuditRecord = {
    id: generateSecureId('mod_audit'),
    action: mode === 'claim' ? 'CASE_CLAIMED' : 'CASE_RELEASED',
    actorId: actor.uid,
    actorName: actor.name,
    actorRole: actor.role,
    targetType: modCase.targetType,
    postId: modCase.targetId,
    caseId: modCase.id,
    reportIds: [...modCase.reportIds],
    note: mode === 'claim' ? `Claimed for review by ${actor.name}` : 'Case claim released back to moderation queue.',
    createdAt: nowIso
  };

  await Promise.all([
    activeHooks.saveCase(modCase),
    activeHooks.saveAudit(auditRecord)
  ]);

  const nextSnapshot: ModerationStateCache = {
    ...currentSnapshot,
    cases: currentSnapshot.cases.map((c) => (c.id === modCase.id ? modCase : c)),
    auditLogs: [auditRecord, ...currentSnapshot.auditLogs]
  };
  saveLocalModerationCache(nextSnapshot);

  if (getAuthToken()) {
    void enqueueModerationSyncOp({
      operationId,
      endpoint: `/api/moderation/cases/${encodeURIComponent(caseId)}/${mode}`,
      method: 'POST',
      label: mode === 'claim' ? 'Claim Moderation Case' : 'Release Case Lock',
      body: {}
    });
  }

  return { case: modCase, auditRecord, snapshot: nextSnapshot };
}

export async function actOnCasePrimary(
  actor: ModerationServiceActor,
  caseId: string,
  payload: {
    action: ModerationActionType;
    reason?: string;
    message?: string;
    note?: string;
  },
  currentSnapshot: ModerationStateCache,
  allUsers: UserProfile[] = []
): Promise<{
  case: ModerationCase;
  updatedReports: PostReport[];
  warning?: ModerationWarning;
  auditRecord: ModerationAuditRecord;
  post?: InstitutionalFeedPost;
  autoSuspended: boolean;
  flaggedForBan: boolean;
  updatedUsers: UserProfile[];
  snapshot: ModerationStateCache;
}> {
  if (!isModeratorRole(actor.role)) {
    throw new Error('Only moderators and administrators can act on moderation cases.');
  }
  const modCaseRaw = currentSnapshot.cases.find((c) => c.id === caseId);
  if (!modCaseRaw) {
    throw new Error('Moderation case not found.');
  }
  const modCase = normalizeModCaseRecord({ ...modCaseRaw });
  if (isResolvedStatus(modCase.status)) {
    throw new Error('This report was already handled by another moderator.');
  }

  const caseReports = currentSnapshot.reports.filter((r) => r.caseId === modCase.id);
  const conflict = evaluateReviewerConflict(modCase, caseReports, actor);
  if (!conflict.canAct) {
    throw new Error(conflict.reason || 'Conflict of interest.');
  }
  if (modCase.claimedBy && modCase.claimedBy !== actor.uid && !isAdminRole(actor.role)) {
    throw new Error(`Being reviewed by ${modCase.claimedByName || 'another moderator'}.`);
  }

  const cleanNote = sanitizeClientText(payload.note || '', 500) || undefined;
  const cleanReason = sanitizeClientText(payload.reason || '', 200);
  const cleanMessage = sanitizeClientText(payload.message || '', 500);
  const nowIso = new Date().toISOString();
  const operationId = generateSecureId('op');

  const pendingReports = caseReports.filter((r) => r.status === 'pending' || r.status === 'reviewed');
  const existingPost = currentSnapshot.posts[modCase.targetId];
  const updatedPost: InstitutionalFeedPost | undefined = existingPost ? { ...existingPost } : undefined;
  const updatedTrackers = new Map<string, AbuseReporterTracking>();
  currentSnapshot.reporterTracking.forEach((t) => updatedTrackers.set(t.userId, { ...t }));

  const notificationsToSave: AppNotification[] = [];
  const auditsToSave: ModerationAuditRecord[] = [];
  const updatedUsers: UserProfile[] = [];
  let createdWarning: ModerationWarning | undefined;
  let autoSuspended = false;
  let flaggedForBan = false;
  const updatedBanFlags = { ...currentSnapshot.banFlags };

  if (payload.action === 'dismiss') {
    modCase.status = 'dismissed';
    modCase.resolvedAction = 'dismiss';
    modCase.resolvedBy = actor.uid;
    modCase.resolvedByName = actor.name;
    modCase.resolvedByRole = actor.role;
    modCase.resolvedAt = nowIso;
    modCase.resolutionNote = cleanNote;
    modCase.autoHiddenPendingReview = false;
    modCase.updatedAt = nowIso;

    if (updatedPost) {
      updatedPost.underReviewAutoHidden = false;
    }

    for (const r of pendingReports) {
      r.status = 'dismissed';
      r.resolvedAt = nowIso;
      r.resolvedBy = actor.uid;
      r.resolvedOutcome = 'no_violation';

      const prevTr = updatedTrackers.get(r.reporterId) || {
        userId: r.reporterId,
        userName: r.reporterName,
        userRole: r.reporterRole,
        consecutiveDismissedCount: 0,
        totalDismissedCount: 0,
        totalReportsCount: 1,
        flaggedAbusiveReporter: false,
        reportingRestricted: false
      };
      prevTr.consecutiveDismissedCount += 1;
      prevTr.totalDismissedCount += 1;
      if (
        !prevTr.flaggedAbusiveReporter &&
        prevTr.consecutiveDismissedCount >= currentSnapshot.config.dismissedReporterThreshold
      ) {
        prevTr.flaggedAbusiveReporter = true;
        prevTr.flaggedAt = nowIso;
        prevTr.warningIssuedAt = nowIso;
      }
      updatedTrackers.set(r.reporterId, prevTr);

      notificationsToSave.push(
        createNotificationPayload({
          id: generateSecureId('mod_notif'),
          toUid: r.reporterId,
          type: 'moderation_report_resolved',
          title: 'Report Reviewed',
          body: 'We reviewed your report and found no violation',
          refId: modCase.targetId,
          read: false,
          createdAt: nowIso,
          metadata: { outcome: 'no_violation', targetType: 'post' }
        })
      );
    }

    auditsToSave.push({
      id: generateSecureId('mod_audit'),
      action: 'CASE_DISMISSED',
      actorId: actor.uid,
      actorName: actor.name,
      actorRole: actor.role,
      targetType: modCase.targetType,
      postId: modCase.targetId,
      caseId: modCase.id,
      reportIds: pendingReports.map((r) => r.id),
      note: cleanNote || 'Reports dismissed with no policy violation.',
      createdAt: nowIso
    });
  } else if (payload.action === 'warn') {
    if (cleanMessage.length < 3) {
      throw new Error('A custom warning message for the author is required.');
    }
    const warningReason = cleanReason || Object.keys(modCase.reasonsSummary || {})[0] || 'Community policy violation';

    createdWarning = {
      id: generateSecureId('warn'),
      userId: modCase.postAuthorId,
      userName: modCase.postAuthorName,
      caseId: modCase.id,
      postId: modCase.targetId,
      targetType: modCase.targetType,
      issuedBy: actor.uid,
      issuedByName: actor.name,
      issuedByRole: actor.role,
      reason: warningReason,
      message: cleanMessage,
      note: cleanNote,
      overturned: false,
      createdAt: nowIso
    };

    if (updatedPost) {
      updatedPost.flaggedByModerators = true;
      updatedPost.flaggedMessage = cleanMessage;
      updatedPost.underReviewAutoHidden = false;
    }

    modCase.status = 'action_taken';
    modCase.resolvedAction = 'warn';
    modCase.resolvedBy = actor.uid;
    modCase.resolvedByName = actor.name;
    modCase.resolvedByRole = actor.role;
    modCase.resolvedAt = nowIso;
    modCase.resolutionNote = cleanNote;
    modCase.autoHiddenPendingReview = false;
    modCase.updatedAt = nowIso;

    for (const r of pendingReports) {
      r.status = 'action_taken';
      r.resolvedAt = nowIso;
      r.resolvedBy = actor.uid;
      r.resolvedOutcome = 'action_taken';

      const prevTr = updatedTrackers.get(r.reporterId);
      if (prevTr) {
        prevTr.consecutiveDismissedCount = 0;
        updatedTrackers.set(r.reporterId, prevTr);
      }

      notificationsToSave.push(
        createNotificationPayload({
          id: generateSecureId('mod_notif'),
          toUid: r.reporterId,
          type: 'moderation_report_resolved',
          title: 'Report Reviewed',
          body: 'We reviewed your report and took action',
          refId: modCase.targetId,
          read: false,
          createdAt: nowIso,
          metadata: { outcome: 'action_taken', targetType: 'post' }
        })
      );
    }

    auditsToSave.push({
      id: generateSecureId('mod_audit'),
      action: 'POST_WARNED',
      actorId: actor.uid,
      actorName: actor.name,
      actorRole: actor.role,
      targetType: modCase.targetType,
      postId: modCase.targetId,
      caseId: modCase.id,
      reportIds: pendingReports.map((r) => r.id),
      targetUserId: modCase.postAuthorId,
      note: cleanNote || cleanMessage,
      metadata: { warningId: createdWarning.id, reason: warningReason },
      createdAt: nowIso
    });

    notificationsToSave.push(
      createNotificationPayload({
        id: generateSecureId('mod_notif'),
        toUid: modCase.postAuthorId,
        type: 'moderation_warning',
        title: 'Post Moderation Warning',
        body: `Your post received a moderator warning (${warningReason}): "${cleanMessage}"`,
        refId: modCase.targetId,
        read: false,
        createdAt: nowIso,
        metadata: {
          caseId: modCase.id,
          postId: modCase.targetId,
          warningId: createdWarning.id,
          reason: warningReason,
          moderatorMessage: cleanMessage
        }
      })
    );

    // Warning Escalation check
    const activeWarnings =
      currentSnapshot.warnings.filter((w) => w.userId === modCase.postAuthorId && !w.overturned).length + 1;
    const authorProfile = allUsers.find((u) => u.uid === modCase.postAuthorId);
    const currentlySuspended =
      (authorProfile?.accountStatus || authorProfile?.status || '').toUpperCase() === 'SUSPENDED';

    if (
      activeWarnings >= currentSnapshot.config.warningSuspensionThreshold &&
      authorProfile &&
      !currentlySuspended
    ) {
      const endIso = new Date(
        Date.now() + currentSnapshot.config.suspensionDurationDays * 24 * 60 * 60 * 1000
      ).toISOString();
      const suspReason = `Automatic ${currentSnapshot.config.suspensionDurationDays}-day suspension triggered after ${activeWarnings} moderation warnings.`;
      const nextAuthor: UserProfile = {
        ...authorProfile,
        accountStatus: 'SUSPENDED',
        status: 'SUSPENDED',
        suspensionEndDate: endIso,
        suspensionReason: suspReason,
        suspensionInfo: {
          ...(authorProfile.suspensionInfo || {}),
          startDate: nowIso,
          endDate: endIso,
          reason: suspReason,
          suspendedBy: 'system_escalation',
          suspendedByName: 'Automated Escalation Policy',
          suspendedByRole: 'system',
          isPermanentLock: false
        }
      };
      updatedUsers.push(nextAuthor);
      autoSuspended = true;
      auditsToSave.push({
        id: generateSecureId('mod_audit'),
        action: 'USER_AUTO_SUSPENDED_WARNINGS',
        actorId: actor.uid,
        actorName: actor.name,
        actorRole: actor.role,
        targetType: 'user',
        targetUserId: modCase.postAuthorId,
        reportIds: [],
        note: suspReason,
        metadata: { activeWarnings },
        createdAt: nowIso
      });
    }

    if (activeWarnings >= currentSnapshot.config.banReviewThreshold) {
      flaggedForBan = true;
      updatedBanFlags[modCase.postAuthorId] = {
        userId: modCase.postAuthorId,
        flaggedAt: nowIso,
        activeWarnings,
        reason: `User reached ${activeWarnings} active warnings (post-suspension threshold). Admin review required for ban.`
      };
      auditsToSave.push({
        id: generateSecureId('mod_audit'),
        action: 'USER_FLAGGED_FOR_BAN',
        actorId: 'system',
        actorName: 'Automated Escalation Policy',
        actorRole: 'system',
        targetType: 'user',
        targetUserId: modCase.postAuthorId,
        reportIds: [],
        note: updatedBanFlags[modCase.postAuthorId].reason,
        createdAt: nowIso
      });
    }
  } else if (payload.action === 'delete_post') {
    const deletionReason =
      cleanReason || cleanMessage || Object.keys(modCase.reasonsSummary || {})[0] || 'Policy violation';
    if (deletionReason.length < 3) {
      throw new Error('A reason for removing this post is required.');
    }

    if (updatedPost) {
      updatedPost.isSoftDeleted = true;
      updatedPost.softDeletedAt = nowIso;
      updatedPost.softDeletedBy = actor.uid;
      updatedPost.softDeletionReason = deletionReason;
      updatedPost.underReviewAutoHidden = false;
    }

    modCase.status = 'action_taken';
    modCase.resolvedAction = 'delete_post';
    modCase.resolvedBy = actor.uid;
    modCase.resolvedByName = actor.name;
    modCase.resolvedByRole = actor.role;
    modCase.resolvedAt = nowIso;
    modCase.resolutionNote = cleanNote || deletionReason;
    modCase.autoHiddenPendingReview = false;
    modCase.updatedAt = nowIso;

    for (const r of pendingReports) {
      r.status = 'action_taken';
      r.resolvedAt = nowIso;
      r.resolvedBy = actor.uid;
      r.resolvedOutcome = 'action_taken';

      const prevTr = updatedTrackers.get(r.reporterId);
      if (prevTr) {
        prevTr.consecutiveDismissedCount = 0;
        updatedTrackers.set(r.reporterId, prevTr);
      }

      notificationsToSave.push(
        createNotificationPayload({
          id: generateSecureId('mod_notif'),
          toUid: r.reporterId,
          type: 'moderation_report_resolved',
          title: 'Report Reviewed',
          body: 'We reviewed your report and took action',
          refId: modCase.targetId,
          read: false,
          createdAt: nowIso,
          metadata: { outcome: 'action_taken', targetType: 'post' }
        })
      );
    }

    auditsToSave.push({
      id: generateSecureId('mod_audit'),
      action: 'POST_SOFT_DELETED',
      actorId: actor.uid,
      actorName: actor.name,
      actorRole: actor.role,
      targetType: modCase.targetType,
      postId: modCase.targetId,
      caseId: modCase.id,
      reportIds: pendingReports.map((r) => r.id),
      targetUserId: modCase.postAuthorId,
      note: cleanNote || deletionReason,
      metadata: { reason: deletionReason },
      createdAt: nowIso
    });

    const authorMsg = cleanMessage
      ? `Your post was removed (${deletionReason}). Moderator note: "${cleanMessage}"`
      : `Your post was removed for violating community standards (${deletionReason}).`;
    notificationsToSave.push(
      createNotificationPayload({
        id: generateSecureId('mod_notif'),
        toUid: modCase.postAuthorId,
        type: 'moderation_deletion',
        title: 'Post Removed by Moderation',
        body: authorMsg,
        refId: modCase.targetId,
        read: false,
        createdAt: nowIso,
        metadata: {
          caseId: modCase.id,
          postId: modCase.targetId,
          reason: deletionReason,
          moderatorMessage: cleanMessage || deletionReason
        }
      })
    );
  } else {
    throw new Error('Invalid moderation action.');
  }

  // Persist directly to Cloud Firestore Primary
  const writes: Promise<unknown>[] = [
    activeHooks.saveCase(modCase),
    ...pendingReports.map((r) => activeHooks.saveReport(r)),
    ...auditsToSave.map((a) => activeHooks.saveAudit(a)),
    ...notificationsToSave.map((n) => activeHooks.saveNotification(n)),
    ...Array.from(updatedTrackers.values()).map((tr) => activeHooks.saveTracker(tr)),
    ...updatedUsers.map((u) => activeHooks.saveUser(u))
  ];
  if (createdWarning) writes.push(activeHooks.saveWarning(createdWarning));
  if (updatedPost) writes.push(activeHooks.savePost(updatedPost));
  await Promise.allSettled(writes);

  const pendingReportById = new Map(pendingReports.map((r) => [r.id, r]));
  const nextSnapshot: ModerationStateCache = {
    ...currentSnapshot,
    cases: currentSnapshot.cases.map((c) => (c.id === modCase.id ? modCase : c)),
    reports: currentSnapshot.reports.map((r) => pendingReportById.get(r.id) || r),
    warnings: createdWarning ? [createdWarning, ...currentSnapshot.warnings] : currentSnapshot.warnings,
    auditLogs: [...auditsToSave, ...currentSnapshot.auditLogs],
    reporterTracking: Array.from(updatedTrackers.values()),
    posts: updatedPost ? { ...currentSnapshot.posts, [updatedPost.id]: updatedPost } : currentSnapshot.posts,
    banFlags: updatedBanFlags
  };
  saveLocalModerationCache(nextSnapshot);

  if (getAuthToken()) {
    void enqueueModerationSyncOp({
      operationId,
      endpoint: `/api/moderation/cases/${encodeURIComponent(modCase.id)}/act`,
      method: 'POST',
      label: `Moderation Action (${payload.action})`,
      body: {
        action: payload.action,
        reason: cleanReason,
        message: cleanMessage || undefined,
        note: cleanNote
      }
    });
  }

  return {
    case: modCase,
    updatedReports: pendingReports,
    warning: createdWarning,
    auditRecord: auditsToSave[auditsToSave.length - 1],
    post: updatedPost,
    autoSuspended,
    flaggedForBan,
    updatedUsers,
    snapshot: nextSnapshot
  };
}

export async function restorePostPrimary(
  actor: ModerationServiceActor,
  postId: string,
  note: string,
  adminApprovalGranted: boolean,
  currentSnapshot: ModerationStateCache
): Promise<{
  post: InstitutionalFeedPost;
  auditRecord: ModerationAuditRecord;
  snapshot: ModerationStateCache;
}> {
  if (!isAdminRole(actor.role) && !(isModeratorRole(actor.role) && adminApprovalGranted)) {
    throw new Error('Restoring a soft-deleted post requires Administrator approval.');
  }
  const existingPost = currentSnapshot.posts[postId];
  if (!existingPost) {
    throw new Error('Post not found.');
  }
  if (existingPost.authorId === actor.uid) {
    throw new Error('You cannot restore your own moderated post.');
  }

  const nowIso = new Date().toISOString();
  const cleanNote = sanitizeClientText(note || 'Post restored after moderation review.', 500);
  const restoredPost: InstitutionalFeedPost = {
    ...existingPost,
    isSoftDeleted: false,
    softDeletedAt: undefined,
    softDeletedBy: undefined,
    softDeletionReason: undefined,
    underReviewAutoHidden: false,
    updatedAt: nowIso
  };

  const auditRecord: ModerationAuditRecord = {
    id: generateSecureId('mod_audit'),
    action: 'POST_RESTORED',
    actorId: actor.uid,
    actorName: actor.name,
    actorRole: actor.role,
    targetType: 'post',
    postId,
    reportIds: [],
    targetUserId: restoredPost.authorId,
    note: cleanNote,
    createdAt: nowIso
  };

  await Promise.all([activeHooks.savePost(restoredPost), activeHooks.saveAudit(auditRecord)]);

  const nextSnapshot: ModerationStateCache = {
    ...currentSnapshot,
    posts: { ...currentSnapshot.posts, [postId]: restoredPost },
    auditLogs: [auditRecord, ...currentSnapshot.auditLogs]
  };
  saveLocalModerationCache(nextSnapshot);

  if (getAuthToken()) {
    void enqueueModerationSyncOp({
      operationId: generateSecureId('op'),
      endpoint: `/api/moderation/posts/${encodeURIComponent(postId)}/restore`,
      method: 'POST',
      label: 'Restore Soft-Deleted Post',
      body: { note: cleanNote, adminApprovalGranted }
    });
  }

  return { post: restoredPost, auditRecord, snapshot: nextSnapshot };
}

export async function sanctionUserPrimary(
  adminActor: ModerationServiceActor,
  targetUserId: string,
  payload: {
    action: 'suspend' | 'ban' | 'lift_sanction' | 'restrict_reporting' | 'unrestrict_reporting';
    reason?: string;
    durationDays?: number;
  },
  currentSnapshot: ModerationStateCache,
  targetUser?: UserProfile
): Promise<{
  success: true;
  updatedUser?: UserProfile;
  snapshot: ModerationStateCache;
}> {
  if (!isAdminRole(adminActor.role)) {
    throw new Error('Only Administrators can apply or lift suspensions, bans, or reporting restrictions.');
  }
  if (targetUserId === adminActor.uid) {
    throw new Error('Administrators cannot sanction their own account.');
  }

  const nowIso = new Date().toISOString();
  const cleanReason = sanitizeClientText(payload.reason || 'Administrative governance decision', 500);
  const nextBanFlags = { ...currentSnapshot.banFlags };
  let nextTrackers = [...currentSnapshot.reporterTracking];
  let updatedUser: UserProfile | undefined;
  let auditRecord: ModerationAuditRecord | undefined;

  if (payload.action === 'restrict_reporting' || payload.action === 'unrestrict_reporting') {
    const existingTr = nextTrackers.find((t) => t.userId === targetUserId) || {
      userId: targetUserId,
      userName: targetUser?.name,
      userRole: targetUser?.role,
      consecutiveDismissedCount: 0,
      totalDismissedCount: 0,
      totalReportsCount: 0,
      flaggedAbusiveReporter: false,
      reportingRestricted: false
    };
    const nextTr: AbuseReporterTracking =
      payload.action === 'restrict_reporting'
        ? {
            ...existingTr,
            flaggedAbusiveReporter: true,
            reportingRestricted: true,
            restrictedAt: nowIso,
            restrictedBy: adminActor.uid,
            restrictionReason: cleanReason
          }
        : {
            ...existingTr,
            flaggedAbusiveReporter: false,
            reportingRestricted: false,
            consecutiveDismissedCount: 0,
            restrictionReason: undefined
          };
    nextTrackers = [nextTr, ...nextTrackers.filter((t) => t.userId !== targetUserId)];
    auditRecord = {
      id: generateSecureId('mod_audit'),
      action: payload.action === 'restrict_reporting' ? 'REPORTER_RESTRICTED' : 'REPORTER_UNRESTRICTED',
      actorId: adminActor.uid,
      actorName: adminActor.name,
      actorRole: adminActor.role,
      targetType: 'user',
      targetUserId,
      reportIds: [],
      note: cleanReason,
      createdAt: nowIso
    };
    await Promise.all([activeHooks.saveTracker(nextTr), activeHooks.saveAudit(auditRecord)]);
  } else {
    if (payload.action === 'ban' || payload.action === 'lift_sanction') {
      delete nextBanFlags[targetUserId];
    }
    if (targetUser) {
      if (payload.action === 'ban') {
        updatedUser = {
          ...targetUser,
          accountStatus: 'LOCKED',
          status: 'LOCKED',
          isLocked: true,
          isBanned: true,
          suspensionReason: cleanReason,
          suspensionInfo: {
            ...(targetUser.suspensionInfo || {}),
            startDate: nowIso,
            reason: cleanReason,
            suspendedBy: adminActor.uid,
            suspendedByName: adminActor.name,
            suspendedByRole: adminActor.role,
            isPermanentLock: true
          }
        };
      } else if (payload.action === 'suspend') {
        const days = Math.max(1, Math.min(365, Number(payload.durationDays) || currentSnapshot.config.suspensionDurationDays));
        const endIso = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
        updatedUser = {
          ...targetUser,
          accountStatus: 'SUSPENDED',
          status: 'SUSPENDED',
          isLocked: false,
          suspensionEndDate: endIso,
          suspensionReason: cleanReason,
          suspensionInfo: {
            ...(targetUser.suspensionInfo || {}),
            startDate: nowIso,
            endDate: endIso,
            reason: cleanReason,
            suspendedBy: adminActor.uid,
            suspendedByName: adminActor.name,
            suspendedByRole: adminActor.role,
            isPermanentLock: false
          }
        };
      } else {
        updatedUser = {
          ...targetUser,
          accountStatus: 'ACTIVE',
          status: 'ACTIVE',
          isLocked: false,
          isBanned: false,
          suspensionEndDate: undefined,
          suspensionReason: undefined
        };
      }
      await activeHooks.saveUser(updatedUser);
    }

    auditRecord = {
      id: generateSecureId('mod_audit'),
      action:
        payload.action === 'ban'
          ? 'USER_BANNED'
          : payload.action === 'suspend'
          ? 'USER_SUSPENDED'
          : 'USER_SANCTION_LIFTED',
      actorId: adminActor.uid,
      actorName: adminActor.name,
      actorRole: adminActor.role,
      targetType: 'user',
      targetUserId,
      reportIds: [],
      note: cleanReason,
      createdAt: nowIso
    };
    await activeHooks.saveAudit(auditRecord);
  }

  const nextSnapshot: ModerationStateCache = {
    ...currentSnapshot,
    reporterTracking: nextTrackers,
    banFlags: nextBanFlags,
    auditLogs: auditRecord ? [auditRecord, ...currentSnapshot.auditLogs] : currentSnapshot.auditLogs
  };
  saveLocalModerationCache(nextSnapshot);

  if (getAuthToken()) {
    void enqueueModerationSyncOp({
      operationId: generateSecureId('op'),
      endpoint: `/api/moderation/users/${encodeURIComponent(targetUserId)}/sanction`,
      method: 'POST',
      label: `Account Sanction (${payload.action})`,
      body: {
        action: payload.action,
        reason: cleanReason,
        durationDays: payload.durationDays
      }
    });
  }

  return { success: true, updatedUser, snapshot: nextSnapshot };
}
