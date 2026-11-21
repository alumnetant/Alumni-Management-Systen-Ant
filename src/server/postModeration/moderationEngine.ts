import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type {
  AbuseReporterTracking,
  AppNotification,
  FeedComment,
  FeedPageResponse,
  FeedRankingConfig,
  FeedSortMode,
  InstitutionalFeedPost,
  ModerationActionType,
  ModerationAppeal,
  ModerationAuditRecord,
  ModerationCase,
  ModerationConfig,
  ModerationWarning,
  PaginatedTimelineResponse,
  PostContentSnapshot,
  PostReport,
  PublicProfileSummary,
  ReportPriority,
  ReportReason,
  ReportTargetType,
  UserRole
} from '../../types';
import { POST_REPORT_REASONS, normalizeSystemRole } from '../../types';
import { createNotificationPayload } from '../../lib/notificationDeepLink';
import {
  AuthorAccountLike,
  ViewerContext,
  areUsersBlocked,
  canUserViewPost,
  comparePostsCreatedDesc,
  generateUniqueUsername,
  hydratePostWithLiveAuthor,
  isAccountDeleted,
  isAccountUnavailable,
  isPinActive,
  normalizeLegacyPostAuthor,
  paginatePostsWithCursor,
  slugifyUsername
} from '../../lib/postVisibility';
import {
  DEFAULT_FEED_CONFIG,
  calculateFeedRelevanceScore,
  enforceMaxConsecutiveAuthor,
  validateAndMergeFeedConfig
} from '../../config/feedConfig';
import { sendRealEmail } from '../emailService';
import { decryptUserPiiFields, encryptUserPiiFields } from '../security/cryptoUtils';

export interface ModerationActor {
  uid: string;
  name: string;
  email: string;
  role: UserRole | string;
  batch?: string;
  course?: string;
  department?: string;
  groupIds?: string[];
}

export interface StoredProfileRecord extends AuthorAccountLike {
  uid: string;
  name: string;
  email: string;
  role: UserRole | string;
  username: string;
  previousUsernames: string[];
  batch?: string;
  course?: string;
  department?: string;
  location?: string;
  profilePictureUrl?: string;
  coverPhotoUrl?: string;
  headline?: string;
  about?: string;
  company?: string;
  currentPosition?: string;
  phone?: string;
  isVerified?: boolean;
  quickStatus?: string;
  followersCount?: number;
  followingCount?: number;
  connectionsCount?: number;
  pinnedPostId?: string;
  blockedUsers: string[];
  groupIds?: string[];
  show_email?: boolean;
  show_phone?: boolean;
  show_current_employer?: boolean;
  deletedAt?: string;
  createdAt?: string;
}

export interface UserAccountAdapter {
  getUserByUid: (uid: string) => any | undefined;
  updateUserSuspension: (
    uid: string,
    payload: {
      accountStatus: 'ACTIVE' | 'SUSPENDED' | 'LOCKED' | 'DEACTIVATED' | 'DELETED';
      reason?: string;
      startDate?: string;
      endDate?: string;
      isPermanentLock?: boolean;
      actorId: string;
      actorName: string;
      actorRole: string;
    }
  ) => void;
  getModeratorsAndAdmins: () => Array<{ uid: string; name: string; email: string; role: string }>;
  getAllUsers?: () => any[];
  deleteUserAccount?: (uid: string) => void;
}

export class ModerationError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const DEFAULT_MODERATION_CONFIG: ModerationConfig = {
  warningSuspensionThreshold: 3,
  suspensionDurationDays: 7,
  banReviewThreshold: 4,
  dismissedReporterThreshold: 5,
  autoFlagReportThreshold: 5,
  autoHideHarassmentThreshold: 3,
  maxReportsPerHour: 10,
  profileTimelineEnabled: true
};

export interface ModerationStateSnapshot {
  posts: Record<string, InstitutionalFeedPost>;
  profiles: Record<string, StoredProfileRecord>;
  slugRedirects: Record<string, string>;
  postMedia: Record<string, { postId: string; mimeType: string; data: string; updatedAt: string }>;
  reports: PostReport[];
  cases: ModerationCase[];
  warnings: ModerationWarning[];
  appeals: ModerationAppeal[];
  auditLogs: ModerationAuditRecord[];
  reporterTracking: Record<string, AbuseReporterTracking>;
  notifications: AppNotification[];
  userRateWindows: Record<string, number[]>;
  flaggedForBanUsers: Record<string, { userId: string; flaggedAt: string; activeWarnings: number; reason: string }>;
  config: ModerationConfig;
  feedConfig: FeedRankingConfig;
  legacyAuditReport: { checkedAt?: string; totalChecked: number; normalizedCount: number };
}

const BUNDLED_MODERATION_DB_FILE = path.join(process.cwd(), 'data', 'moderation_db.json');
const MODERATION_DB_FILE = process.env.VERCEL
  ? path.join('/tmp', 'moderation_db.json')
  : BUNDLED_MODERATION_DB_FILE;

export function getPriorityForReason(reason: ReportReason): ReportPriority {
  if (reason === 'Harassment or bullying' || reason === 'Fake profile/impersonation') {
    return 'high';
  }
  if (reason === 'Inappropriate content' || reason === 'Misinformation') {
    return 'medium';
  }
  return 'low';
}

export function priorityRank(priority: ReportPriority): number {
  if (priority === 'high') return 3;
  if (priority === 'medium') return 2;
  return 1;
}

export function maxPriority(a: ReportPriority, b: ReportPriority): ReportPriority {
  return priorityRank(a) >= priorityRank(b) ? a : b;
}

/**
 * Strict XSS sanitization & length enforcement for user-supplied text.
 */
export function sanitizeModerationText(input: unknown, maxLength = 500): string {
  if (typeof input !== 'string') return '';
  let cleaned = input.trim();
  // Strip script/iframe/object/svg/style tags and event handlers before escaping
  cleaned = cleaned
    .replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '')
    .replace(/<\s*iframe[^>]*>[\s\S]*?<\s*\/\s*iframe\s*>/gi, '')
    .replace(/<\s*object[^>]*>[\s\S]*?<\s*\/\s*object\s*>/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/data\s*:\s*text\/html/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/on\w+\s*=\s*[^\s>]+/gi, '');

  // Escape HTML entities so no active markup can ever execute
  cleaned = cleaned
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');

  if (cleaned.length > maxLength) {
    cleaned = cleaned.slice(0, maxLength);
  }
  return cleaned;
}

export function isModeratorRole(role?: string): boolean {
  const norm = normalizeSystemRole(role);
  return norm === 'moderator' || norm === 'admin' || norm === 'superadmin';
}

export function isAdminRole(role?: string): boolean {
  const norm = normalizeSystemRole(role);
  return norm === 'admin' || norm === 'superadmin';
}

export function isSuperAdminRole(role?: string): boolean {
  return normalizeSystemRole(role) === 'superadmin';
}

function createInitialState(): ModerationStateSnapshot {
  return {
    posts: {},
    profiles: {},
    slugRedirects: {},
    postMedia: {},
    reports: [],
    cases: [],
    warnings: [],
    appeals: [],
    auditLogs: [],
    reporterTracking: {},
    notifications: [],
    userRateWindows: {},
    flaggedForBanUsers: {},
    config: { ...DEFAULT_MODERATION_CONFIG },
    feedConfig: { ...DEFAULT_FEED_CONFIG },
    legacyAuditReport: { totalChecked: 0, normalizedCount: 0 }
  };
}

interface FeedSessionSnapshot {
  id: string;
  viewerUid: string;
  sortMode: FeedSortMode;
  orderedIds: string[];
  pinnedIds: string[];
  createdAtMs: number;
  createdAtIso: string;
}

function encodeFeedCursor(snapshotId: string, offset: number): string {
  return Buffer.from(JSON.stringify({ snapshotId, offset }), 'utf8').toString('base64url');
}

function decodeFeedCursor(cursor?: string | null): { snapshotId: string; offset: number } | null {
  if (!cursor || typeof cursor !== 'string') return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (typeof parsed?.snapshotId === 'string' && typeof parsed?.offset === 'number' && parsed.offset >= 0) {
      return { snapshotId: parsed.snapshotId, offset: Math.floor(parsed.offset) };
    }
    return null;
  } catch {
    return null;
  }
}

export class PostModerationEngine {
  private state: ModerationStateSnapshot;
  private persistenceEnabled: boolean;
  private accountAdapter: UserAccountAdapter | null = null;
  private emailEnabled: boolean;
  private timelineCache = new Map<string, { expiresAt: number; value: any }>();
  private feedSessionSnapshots = new Map<string, FeedSessionSnapshot>();

  constructor(options?: { persistToDisk?: boolean; emailEnabled?: boolean }) {
    this.persistenceEnabled = options?.persistToDisk ?? (process.env.NODE_ENV !== 'test' && !process.env.VITEST);
    this.emailEnabled = options?.emailEnabled ?? (process.env.NODE_ENV !== 'test' && !process.env.VITEST);
    this.state = createInitialState();
    if (this.persistenceEnabled) {
      this.loadFromDisk();
    }
  }

  public setUserAccountAdapter(adapter: UserAccountAdapter): void {
    this.accountAdapter = adapter;
    this.syncProfilesFromAdapter();
    this.auditAndNormalizeLegacyPosts();
  }

  public setEmailEnabled(enabled: boolean): void {
    this.emailEnabled = enabled;
  }

  public resetForTests(): void {
    this.state = createInitialState();
    this.timelineCache.clear();
    this.feedSessionSnapshots.clear();
  }

  public resetToSuperadminOnly(): void {
    this.state = createInitialState();
    this.timelineCache.clear();
    this.feedSessionSnapshots.clear();
    this.syncProfilesFromAdapter();
    this.persist();
  }

  private invalidateCaches(): void {
    this.timelineCache.clear();
  }

  private loadFromDisk(): void {
    try {
      const sourceFile = fs.existsSync(MODERATION_DB_FILE)
        ? MODERATION_DB_FILE
        : process.env.VERCEL && fs.existsSync(BUNDLED_MODERATION_DB_FILE)
        ? BUNDLED_MODERATION_DB_FILE
        : null;
      if (sourceFile) {
        const raw = fs.readFileSync(sourceFile, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          const loadedProfiles: Record<string, StoredProfileRecord> = {};
          for (const [uid, prof] of Object.entries(parsed.profiles || {})) {
            loadedProfiles[uid] = decryptUserPiiFields(prof as StoredProfileRecord);
          }
            this.state = {
            ...createInitialState(),
            ...parsed,
            posts: parsed.posts || {},
            profiles: loadedProfiles,
            slugRedirects: parsed.slugRedirects || {},
            postMedia: parsed.postMedia || {},
            reports: Array.isArray(parsed.reports) ? parsed.reports : [],
            cases: Array.isArray(parsed.cases)
              ? parsed.cases.map((c: any) => this.normalizeModCaseRecord(c))
              : [],
            warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
            appeals: Array.isArray(parsed.appeals) ? parsed.appeals : [],
            auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : [],
            reporterTracking: parsed.reporterTracking || {},
            notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [],
            userRateWindows: parsed.userRateWindows || {},
            flaggedForBanUsers: parsed.flaggedForBanUsers || {},
            config: { ...DEFAULT_MODERATION_CONFIG, ...(parsed.config || {}) },
            feedConfig: { ...DEFAULT_FEED_CONFIG, ...(parsed.feedConfig || {}) },
            legacyAuditReport: parsed.legacyAuditReport || { totalChecked: 0, normalizedCount: 0 }
          };
          this.auditAndNormalizeLegacyPosts();
        }
      }
    } catch (err) {
      console.warn('[PostModeration] Failed to load state from disk, starting fresh:', err);
    }
  }

  private persist(): void {
    this.invalidateCaches();
    if (!this.persistenceEnabled) return;
    try {
      const dir = path.dirname(MODERATION_DB_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const encryptedProfiles: Record<string, StoredProfileRecord> = {};
      for (const [uid, prof] of Object.entries(this.state.profiles || {})) {
        encryptedProfiles[uid] = encryptUserPiiFields(prof);
      }
      const snapshotToPersist = {
        ...this.state,
        profiles: encryptedProfiles
      };
      fs.writeFileSync(MODERATION_DB_FILE, JSON.stringify(snapshotToPersist, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[PostModeration] Failed to persist state:', err);
    }
  }

  private appendAudit(entry: Omit<ModerationAuditRecord, 'id' | 'createdAt'>): ModerationAuditRecord {
    const record: ModerationAuditRecord = {
      ...entry,
      id: `mod_audit_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      createdAt: new Date().toISOString()
    };
    this.state.auditLogs.unshift(record);
    return record;
  }

  private pushNotification(notif: Omit<AppNotification, 'id' | 'createdAt' | 'read'>): AppNotification {
    const recipientRole = notif.toUid ? this.accountAdapter?.getUserByUid(notif.toUid)?.role : undefined;
    const full = createNotificationPayload(
      {
        ...notif,
        id: `mod_notif_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
        read: false,
        createdAt: new Date().toISOString()
      },
      recipientRole
    );
    this.state.notifications.unshift(full);
    return full;
  }

  public recordExternalSecurityAudit(entry: {
    action: ModerationAuditRecord['action'];
    actorId: string;
    actorName: string;
    actorRole: string;
    note: string;
    metadata?: Record<string, unknown>;
  }): ModerationAuditRecord {
    const record = this.appendAudit({
      action: entry.action,
      actorId: entry.actorId,
      actorName: entry.actorName,
      actorRole: entry.actorRole,
      targetType: 'security',
      reportIds: [],
      note: entry.note,
      metadata: entry.metadata
    });
    this.persist();
    return record;
  }

  private async dispatchModerationEmail(toUid: string, subject: string, bodyText: string, badgeTitle: string): Promise<void> {
    if (!this.emailEnabled || !this.accountAdapter) return;
    const user = this.accountAdapter.getUserByUid(toUid);
    if (!user?.email) return;
    const html = `<!DOCTYPE html>
<html>
<body style="font-family: 'DM Sans', Arial, sans-serif; background-color: #f5f5f4; padding: 24px; color: #1c1917;">
  <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #e7e5e4; border-radius: 12px; overflow: hidden;">
    <div style="background-color: #8B181B; color: #ffffff; padding: 20px 24px;">
      <h2 style="margin: 0; font-size: 18px;">St. Cecilia's College Alumni Network</h2>
      <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.9;">${badgeTitle}</p>
    </div>
    <div style="padding: 24px; font-size: 14px; line-height: 1.6;">
      <p>Hello <strong>${sanitizeModerationText(user.name || 'Cecilian Member', 120)}</strong>,</p>
      <p>${sanitizeModerationText(bodyText, 1200)}</p>
      <p style="margin-top: 20px; font-size: 12px; color: #78716c;">
        If you believe this decision was made in error, you may submit a one-time appeal directly from your Alumni Portal notifications or profile.
      </p>
    </div>
  </div>
</body>
</html>`;
    try {
      await sendRealEmail({
        to: user.email,
        subject,
        text: `Hello ${user.name || 'Cecilian Member'},\n\n${bodyText}\n\nSt. Cecilia's College Alumni Moderation Team`,
        html
      });
    } catch (err) {
      console.warn('[PostModeration Email Notice]', err);
    }
  }

  private checkUserBlockedFromPostingOrReporting(uid: string): { blocked: boolean; reason?: string } {
    const user = this.accountAdapter?.getUserByUid(uid);
    if (user) {
      const status = (user.accountStatus || user.status || '').toUpperCase().trim();
      if (status === 'LOCKED' || status === 'BANNED' || user.isBanned) {
        return { blocked: true, reason: 'Your account has been banned from community participation.' };
      }
      if (status === 'SUSPENDED') {
        const end = user.suspensionInfo?.endDate || user.suspensionEndDate;
        if (!end || new Date(end).getTime() > Date.now()) {
          return {
            blocked: true,
            reason: 'Your account is temporarily suspended and cannot submit posts or reports.'
          };
        }
      }
    }
    const tracker = this.state.reporterTracking[uid];
    if (tracker?.reportingRestricted) {
      return {
        blocked: true,
        reason: tracker.restrictionReason || 'Your ability to report posts has been restricted due to repeated invalid reports.'
      };
    }
    return { blocked: false };
  }

  private buildSnapshot(post: Partial<InstitutionalFeedPost> | undefined | null): PostContentSnapshot {
    const safePost = post || {};
    return {
      title: safePost.title || '',
      content: safePost.content || '',
      imageUrl: safePost.imageUrl,
      tags: Array.isArray(safePost.tags) ? [...safePost.tags] : undefined,
      postType: safePost.postType,
      authorId: safePost.authorId || 'unknown_author',
      authorName: safePost.authorName || 'Cecilian Member',
      capturedAt: new Date().toISOString()
    };
  }

  private checkSnapshotDiffers(snapshot?: PostContentSnapshot | null, post?: InstitutionalFeedPost | null): boolean {
    if (!snapshot || !post) return false;
    if ((snapshot.title || '') !== (post.title || '')) return true;
    if ((snapshot.content || '') !== (post.content || '')) return true;
    if ((snapshot.imageUrl || '') !== (post.imageUrl || '')) return true;
    return false;
  }

  private normalizeModCaseRecord(raw: any): ModerationCase {
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
    const safeReportIds = Array.isArray(raw?.reportIds) ? raw.reportIds.filter((id: any) => typeof id === 'string') : [];
    const safeReasons =
      raw?.reasonsSummary && typeof raw.reasonsSummary === 'object' && !Array.isArray(raw.reasonsSummary)
        ? { ...raw.reasonsSummary }
        : {};
    return {
      ...raw,
      id: String(raw?.id || `case_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`),
      targetType: raw?.targetType === 'comment' ? 'comment' : 'post',
      targetId: String(raw?.targetId || ''),
      postAuthorId: String(raw?.postAuthorId || safeSnapshot.authorId || 'unknown_author'),
      postAuthorName: String(raw?.postAuthorName || safeSnapshot.authorName || 'Cecilian Member'),
      postAuthorRole: (raw?.postAuthorRole || 'alumni') as UserRole,
      status: raw?.status || 'pending',
      highestPriority: (raw?.highestPriority === 'high' || raw?.highestPriority === 'medium' || raw?.highestPriority === 'low')
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

  public getLatestAuditRecordForCase(caseId?: string, postId?: string): ModerationAuditRecord | null {
    if (!Array.isArray(this.state.auditLogs)) return null;
    const found = this.state.auditLogs.find(
      (a) => (caseId && a.caseId === caseId) || (!caseId && postId && a.postId === postId)
    );
    return found || null;
  }

  private getAllKnownHandlesSet(excludeUid?: string): Set<string> {
    const handles = new Set<string>();
    for (const prof of Object.values(this.state.profiles)) {
      if (excludeUid && prof.uid === excludeUid) continue;
      if (prof.username) handles.add(prof.username.toLowerCase());
    }
    for (const [oldSlug, targetUid] of Object.entries(this.state.slugRedirects)) {
      if (excludeUid && targetUid === excludeUid) continue;
      handles.add(oldSlug.toLowerCase());
    }
    return handles;
  }

  private resolveAuthorProfile(uid?: string): StoredProfileRecord | null {
    if (!uid) return null;
    const stored = this.state.profiles[uid];
    const cred = this.accountAdapter?.getUserByUid(uid);
    if (!stored && !cred) return null;

    const mergedName = stored?.name || cred?.name || cred?.email || 'Cecilian Member';
    const username =
      stored?.username ||
      cred?.username ||
      slugifyUsername(mergedName || uid);

    return {
      uid,
      name: mergedName,
      email: stored?.email || cred?.email || '',
      role: normalizeSystemRole(stored?.role || cred?.role),
      username,
      previousUsernames: stored?.previousUsernames || [],
      batch: stored?.batch || cred?.batch,
      course: stored?.course || cred?.course,
      department: stored?.department || cred?.department,
      location: stored?.location || cred?.location,
      profilePictureUrl: stored?.profilePictureUrl || stored?.avatar || cred?.profilePictureUrl || cred?.avatar || '',
      coverPhotoUrl: stored?.coverPhotoUrl || cred?.coverPhotoUrl || '',
      headline: stored?.headline || cred?.headline || '',
      about: stored?.about || cred?.about || '',
      company: stored?.company || cred?.company || cred?.companyName || '',
      currentPosition: stored?.currentPosition || cred?.currentPosition || '',
      phone: stored?.phone || cred?.phone || '',
      isVerified: stored?.isVerified ?? cred?.isVerified ?? false,
      quickStatus: stored?.quickStatus || cred?.quickStatus,
      followersCount: stored?.followersCount ?? cred?.followersCount ?? 0,
      followingCount: stored?.followingCount ?? cred?.followingCount ?? 0,
      connectionsCount: stored?.connectionsCount ?? cred?.connectionsCount ?? 0,
      pinnedPostId: stored?.pinnedPostId,
      blockedUsers: stored?.blockedUsers || [],
      groupIds: stored?.groupIds || cred?.groupIds || [],
      accountStatus: cred?.accountStatus || cred?.status || stored?.accountStatus || stored?.status || 'ACTIVE',
      status: cred?.status || cred?.accountStatus || stored?.status || 'ACTIVE',
      isDeactivated: stored?.isDeactivated ?? cred?.isDeactivated ?? false,
      isDeleted: stored?.isDeleted ?? cred?.isDeleted ?? false,
      isBanned: cred?.isBanned ?? stored?.isBanned ?? false,
      suspensionInfo: cred?.suspensionInfo || stored?.suspensionInfo,
      suspensionEndDate: cred?.suspensionEndDate || stored?.suspensionEndDate,
      show_email: stored?.show_email ?? cred?.show_email ?? false,
      show_phone: stored?.show_phone ?? cred?.show_phone ?? false,
      show_current_employer: stored?.show_current_employer ?? cred?.show_current_employer ?? true,
      deletedAt: stored?.deletedAt,
      createdAt: stored?.createdAt || cred?.createdAt
    };
  }

  private buildViewerContext(actor?: ModerationActor | null): ViewerContext | null {
    if (!actor?.uid) return null;
    const prof = this.resolveAuthorProfile(actor.uid);
    return {
      uid: actor.uid,
      role: actor.role || prof?.role || 'alumni',
      batch: actor.batch || prof?.batch,
      course: actor.course || prof?.course,
      department: actor.department || prof?.department,
      groupIds: actor.groupIds || prof?.groupIds || [],
      blockedUsers: prof?.blockedUsers || []
    };
  }

  public syncProfilesFromAdapter(): void {
    const adapterUsers = this.accountAdapter?.getAllUsers ? this.accountAdapter.getAllUsers() : [];
    for (const u of adapterUsers) {
      if (!u?.uid) continue;
      this.upsertProfileRecord(u, false);
    }
  }

  public upsertProfileRecord(input: Partial<StoredProfileRecord> & { uid: string }, persistChanges = true): StoredProfileRecord {
    const existing = this.state.profiles[input.uid];
    if (existing && isAccountDeleted(existing)) {
      return existing;
    }
    const handles = this.getAllKnownHandlesSet(input.uid);
    const desiredName = input.name || existing?.name || input.email || 'Cecilian Member';
    const rawSlug = input.username ? slugifyUsername(input.username) : existing?.username;
    const username = rawSlug && !handles.has(rawSlug)
      ? rawSlug
      : generateUniqueUsername(desiredName, input.uid, handles);

    const prevUsernames = Array.isArray(existing?.previousUsernames) ? [...existing!.previousUsernames] : [];
    if (existing?.username && existing.username !== username && !prevUsernames.includes(existing.username)) {
      prevUsernames.push(existing.username);
      this.state.slugRedirects[existing.username.toLowerCase()] = input.uid;
    }

    const record: StoredProfileRecord = {
      uid: input.uid,
      name: sanitizeModerationText(desiredName, 120) || 'Cecilian Member',
      email: input.email ?? existing?.email ?? '',
      role: normalizeSystemRole((input.role as string) || (existing?.role as string) || 'alumni'),
      username,
      previousUsernames: prevUsernames,
      batch: input.batch ?? existing?.batch,
      course: input.course ?? existing?.course,
      department: input.department ?? existing?.department,
      location: input.location ?? existing?.location,
      profilePictureUrl: input.profilePictureUrl ?? existing?.profilePictureUrl ?? '',
      coverPhotoUrl: input.coverPhotoUrl ?? existing?.coverPhotoUrl ?? '',
      headline: input.headline ?? existing?.headline,
      about: input.about ?? existing?.about,
      company: input.company ?? existing?.company,
      currentPosition: input.currentPosition ?? existing?.currentPosition,
      phone: input.phone ?? existing?.phone,
      isVerified: input.isVerified ?? existing?.isVerified,
      quickStatus: input.quickStatus ?? existing?.quickStatus,
      followersCount: input.followersCount ?? existing?.followersCount ?? 0,
      followingCount: input.followingCount ?? existing?.followingCount ?? 0,
      connectionsCount: input.connectionsCount ?? existing?.connectionsCount ?? 0,
      pinnedPostId: input.pinnedPostId ?? existing?.pinnedPostId,
      blockedUsers: Array.isArray(input.blockedUsers) ? input.blockedUsers : existing?.blockedUsers || [],
      groupIds: Array.isArray(input.groupIds) ? input.groupIds : existing?.groupIds || [],
      accountStatus: input.accountStatus ?? existing?.accountStatus ?? 'ACTIVE',
      status: input.status ?? existing?.status ?? 'ACTIVE',
      isDeactivated: input.isDeactivated ?? existing?.isDeactivated ?? false,
      isDeleted: input.isDeleted ?? existing?.isDeleted ?? false,
      isBanned: input.isBanned ?? existing?.isBanned ?? false,
      suspensionInfo: input.suspensionInfo ?? existing?.suspensionInfo,
      suspensionEndDate: input.suspensionEndDate ?? existing?.suspensionEndDate,
      show_email: input.show_email ?? existing?.show_email ?? false,
      show_phone: input.show_phone ?? existing?.show_phone ?? false,
      show_current_employer: input.show_current_employer ?? existing?.show_current_employer ?? true,
      deletedAt: input.deletedAt ?? existing?.deletedAt,
      createdAt: input.createdAt ?? existing?.createdAt
    };

    this.state.profiles[record.uid] = record;
    this.invalidateCaches();
    if (persistChanges) {
      this.persist();
    }
    return record;
  }

  public auditAndNormalizeLegacyPosts(): { totalChecked: number; normalizedCount: number } {
    const byUid = new Map<string, AuthorAccountLike>();
    const byName = new Map<string, AuthorAccountLike>();

    for (const uid of Object.keys(this.state.profiles)) {
      const p = this.resolveAuthorProfile(uid);
      if (p) {
        byUid.set(p.uid, p);
        if (p.name) byName.set(p.name.trim().toLowerCase(), p);
      }
    }
    if (this.accountAdapter?.getAllUsers) {
      for (const u of this.accountAdapter.getAllUsers()) {
        if (u?.uid) {
          byUid.set(u.uid, u);
          if (u.name) byName.set(String(u.name).trim().toLowerCase(), u);
        }
      }
    }

    let totalChecked = 0;
    let normalizedCount = 0;
    for (const [id, post] of Object.entries(this.state.posts)) {
      totalChecked++;
      const res = normalizeLegacyPostAuthor(post, byUid, byName);
      if (res.hadInvalidAuthor) {
        normalizedCount++;
      }
      if ((res.post.postType as string) === 'milestone') {
        res.post.postType = 'update';
        normalizedCount++;
      }
      this.state.posts[id] = res.post;
    }

    this.state.legacyAuditReport = {
      checkedAt: new Date().toISOString(),
      totalChecked,
      normalizedCount
    };
    return { totalChecked, normalizedCount };
  }

  // ===========================================================================
  // 1. POST LIFECYCLE, UNIFIED VISIBILITY & PRIVACY-SAFE VIEW PROJECTION
  // ===========================================================================

  public upsertPost(post: InstitutionalFeedPost, actor?: ModerationActor): InstitutionalFeedPost {
    if (!post?.id) {
      throw new ModerationError(400, 'INVALID_POST', 'Post ID is required.');
    }

    const existing = this.state.posts[post.id];
    if (actor && normalizeSystemRole(actor.role) === 'employer') {
      throw new ModerationError(403, 'EMPLOYER_POST_FORBIDDEN', 'Employer accounts cannot publish feed posts.');
    }
    if (!existing && actor) {
      const blockCheck = this.checkUserBlockedFromPostingOrReporting(actor.uid);
      if (blockCheck.blocked && !blockCheck.reason?.includes('report')) {
        throw new ModerationError(403, 'USER_SUSPENDED', blockCheck.reason || 'Suspended users cannot publish posts.');
      }
    }

    const byUid = new Map<string, AuthorAccountLike>();
    const byName = new Map<string, AuthorAccountLike>();
    for (const p of Object.values(this.state.profiles)) {
      byUid.set(p.uid, p);
      if (p.name) byName.set(p.name.trim().toLowerCase(), p);
    }

    const normalizedPinExpiresAt =
      post.pinExpiresAt !== undefined
        ? (post.pinExpiresAt && !Number.isNaN(new Date(post.pinExpiresAt).getTime()) ? new Date(post.pinExpiresAt).toISOString() : undefined)
        : existing?.pinExpiresAt;

    const rawPostType = (post.postType as string) || existing?.postType || 'update';
    const normalizedPostType: InstitutionalFeedPost['postType'] =
      rawPostType === 'gallery' || rawPostType === 'announcement' ? rawPostType : 'update';

    const candidate: InstitutionalFeedPost = {
      ...existing,
      ...post,
      postType: normalizedPostType,
      title: sanitizeModerationText(post.title || '', 200),
      content: sanitizeModerationText(post.content || '', 5000),
      status: post.status ?? existing?.status ?? 'published',
      visibility: post.visibility ?? existing?.visibility ?? 'alumni',
      isAnonymous: post.isAnonymous ?? existing?.isAnonymous ?? false,
      isPinned: post.isPinned ?? existing?.isPinned ?? false,
      pinExpiresAt: normalizedPinExpiresAt,
      isSoftDeleted: existing?.isSoftDeleted ?? post.isSoftDeleted ?? false,
      flaggedByModerators: existing?.flaggedByModerators ?? post.flaggedByModerators ?? false,
      flaggedMessage: existing?.flaggedMessage ?? post.flaggedMessage,
      underReviewAutoHidden: existing?.underReviewAutoHidden ?? post.underReviewAutoHidden ?? false
    };

    const { post: stored } = normalizeLegacyPostAuthor(candidate, byUid, byName);
    this.state.posts[stored.id] = stored;

    if (stored.imageUrl) {
      this.state.postMedia[stored.id] = {
        postId: stored.id,
        mimeType: stored.imageUrl.startsWith('data:image/png') ? 'image/png' : 'image/jpeg',
        data: stored.imageUrl,
        updatedAt: new Date().toISOString()
      };
    }

    // If post was updated and a case exists, keep original snapshot intact and flag diff
    const modCase = this.state.cases.find((c) => c.targetType === 'post' && c.targetId === stored.id);
    if (modCase) {
      modCase.currentContent = this.buildSnapshot(stored);
      modCase.contentEditedSinceSnapshot = this.checkSnapshotDiffers(modCase.contentSnapshot, stored);
      modCase.updatedAt = new Date().toISOString();
    }

    this.invalidateCaches();
    this.persist();
    return stored;
  }

  public editPostByAuthor(
    postId: string,
    actor: ModerationActor,
    updates: {
      title?: string;
      content?: string;
      imageUrl?: string;
      tags?: string[];
      visibility?: InstitutionalFeedPost['visibility'];
      status?: InstitutionalFeedPost['status'];
      isPinned?: boolean;
      pinExpiresAt?: string | null;
    }
  ): InstitutionalFeedPost {
    const post = this.state.posts[postId];
    if (!post) {
      throw new ModerationError(404, 'POST_NOT_FOUND', 'Post not found.');
    }
    if (post.authorId !== actor.uid && !isAdminRole(actor.role)) {
      throw new ModerationError(403, 'FORBIDDEN', 'Only the post author can edit this post.');
    }
    if (post.isSoftDeleted) {
      throw new ModerationError(400, 'POST_DELETED', 'Cannot edit a deleted post.');
    }

    const canManageFeedPins = isAdminRole(actor.role);
    const nextPinned = canManageFeedPins && updates.isPinned !== undefined ? Boolean(updates.isPinned) : post.isPinned;
    let nextPinExpiresAt = post.pinExpiresAt;
    if (canManageFeedPins && updates.pinExpiresAt !== undefined) {
      if (!updates.pinExpiresAt) {
        nextPinExpiresAt = undefined;
      } else {
        const ms = new Date(updates.pinExpiresAt).getTime();
        if (Number.isNaN(ms)) {
          throw new ModerationError(400, 'INVALID_PIN_EXPIRY', 'pinExpiresAt must be a valid ISO date.');
        }
        nextPinExpiresAt = new Date(ms).toISOString();
      }
    }

    // Preserve original createdAt so editing never changes timeline/feed position or age
    const updated: InstitutionalFeedPost = {
      ...post,
      title: updates.title !== undefined ? sanitizeModerationText(updates.title, 200) : post.title,
      content: updates.content !== undefined ? sanitizeModerationText(updates.content, 5000) : post.content,
      imageUrl: updates.imageUrl !== undefined ? updates.imageUrl : post.imageUrl,
      tags: updates.tags !== undefined ? updates.tags : post.tags,
      visibility: updates.visibility !== undefined ? updates.visibility : post.visibility,
      status: updates.status !== undefined ? updates.status : post.status,
      isPinned: nextPinned,
      pinExpiresAt: nextPinExpiresAt,
      createdAt: post.createdAt,
      isEdited: true,
      updatedAt: new Date().toISOString()
    };

    this.state.posts[postId] = updated;

    if (updates.imageUrl !== undefined && updates.imageUrl) {
      this.state.postMedia[postId] = {
        postId,
        mimeType: updates.imageUrl.startsWith('data:image/png') ? 'image/png' : 'image/jpeg',
        data: updates.imageUrl,
        updatedAt: new Date().toISOString()
      };
    }

    // Preserve original contentSnapshot on any existing case and flag diff!
    for (const modCase of this.state.cases) {
      if (modCase.targetType === 'post' && modCase.targetId === postId) {
        modCase.currentContent = this.buildSnapshot(updated);
        modCase.contentEditedSinceSnapshot = this.checkSnapshotDiffers(modCase.contentSnapshot, updated);
        modCase.updatedAt = new Date().toISOString();
      }
    }

    this.invalidateCaches();
    this.persist();
    return this.projectPostForViewer(updated, actor);
  }

  /**
   * Author or Moderator/Admin deletes a post directly (outside moderation resolution or by author).
   * - Removes "flagged by moderators" label if author deletes the post.
   * - Auto-closes any pending reports/case on that post as 'post_removed'.
   */
  public deletePostByUser(postId: string, actor: ModerationActor): { success: boolean; autoClosedCaseId?: string } {
    const post = this.state.posts[postId];
    if (!post) {
      throw new ModerationError(404, 'POST_NOT_FOUND', 'Post not found.');
    }
    const isAuthor = post.authorId === actor.uid;
    if (!isAuthor && !isModeratorRole(actor.role)) {
      throw new ModerationError(403, 'FORBIDDEN', 'You do not have permission to delete this post.');
    }

    const now = new Date().toISOString();
    post.isSoftDeleted = true;
    post.softDeletedAt = now;
    post.softDeletedBy = actor.uid;
    post.softDeletionReason = isAuthor ? 'Deleted by author' : 'Removed by moderation';
    post.underReviewAutoHidden = false;
    // Requirement 5: Remove the "flagged by moderators" label if the author deletes the post
    if (isAuthor) {
      post.flaggedByModerators = false;
      post.flaggedMessage = undefined;
    }
    this.state.posts[postId] = post;

    let autoClosedCaseId: string | undefined;
    const activeCase = this.state.cases.find(
      (c) => c.targetType === 'post' && c.targetId === postId && (c.status === 'pending' || c.status === 'reviewed')
    );

    if (activeCase) {
      autoClosedCaseId = activeCase.id;
      activeCase.status = 'post_removed';
      activeCase.resolvedAction = 'post_removed';
      activeCase.resolvedBy = actor.uid;
      activeCase.resolvedByName = actor.name;
      activeCase.resolvedByRole = actor.role;
      activeCase.resolvedAt = now;
      activeCase.resolutionNote = isAuthor
        ? 'Post deleted by author while reports were pending.'
        : 'Post deleted by staff while reports were pending.';
      activeCase.autoHiddenPendingReview = false;
      activeCase.updatedAt = now;

      const pendingReports = this.state.reports.filter(
        (r) => r.caseId === activeCase.id && (r.status === 'pending' || r.status === 'reviewed')
      );
      const closedIds: string[] = [];
      for (const r of pendingReports) {
        r.status = 'post_removed';
        r.resolvedAt = now;
        r.resolvedBy = actor.uid;
        r.resolvedOutcome = 'post_removed';
        closedIds.push(r.id);

        this.pushNotification({
          toUid: r.reporterId,
          type: 'moderation_report_resolved',
          title: 'Report Update',
          body: 'We reviewed your report and took action',
          refId: postId,
          metadata: { outcome: 'action_taken', targetType: 'post' }
        });
      }

      this.appendAudit({
        action: 'POST_AUTO_CLOSED_ON_DELETE',
        actorId: actor.uid,
        actorName: actor.name,
        actorRole: actor.role,
        targetType: 'post',
        postId,
        caseId: activeCase.id,
        reportIds: closedIds,
        note: activeCase.resolutionNote
      });
    }

    this.persist();
    return { success: true, autoClosedCaseId };
  }

  /**
   * Projects a post strictly for the viewing user:
   * - Dynamically hydrates live author info (name, avatar, username) or "Former alumni" if account deleted.
   * - "flaggedByModerators" & "flaggedMessage" are visible ONLY to the author and moderators/admins.
   * - Reporter identity is NEVER present on any post payload.
   */
  public projectPostForViewer(post: InstitutionalFeedPost, viewer?: ModerationActor | null): InstitutionalFeedPost {
    const isMod = viewer ? isModeratorRole(viewer.role) : false;
    const isAuthor = viewer ? post.authorId === viewer.uid : false;
    const viewerHasReported = viewer
      ? this.state.reports.some((r) => r.targetType === 'post' && r.targetId === post.id && r.reporterId === viewer.uid)
      : false;

    const viewerCtx = this.buildViewerContext(viewer);
    const authorProfile = this.resolveAuthorProfile(post.authorId);
    const hydrated = hydratePostWithLiveAuthor(post, authorProfile, viewerCtx);

    const clean: InstitutionalFeedPost = {
      ...hydrated,
      viewerHasReported
    };

    if (!isMod && !isAuthor) {
      delete clean.flaggedByModerators;
      delete clean.flaggedMessage;
      delete clean.softDeletionReason;
      delete clean.softDeletedBy;
      delete clean.softDeletedAt;
    }

    return clean;
  }

  private deriveInteractedAuthorIds(viewerUid?: string, explicitIds?: string[]): Set<string> {
    const set = new Set<string>(Array.isArray(explicitIds) ? explicitIds.filter(Boolean) : []);
    if (!viewerUid) return set;

    for (const p of Object.values(this.state.posts)) {
      if (p.isAnonymous || !p.authorId || p.authorId === viewerUid) continue;
      const hasLiked = Array.isArray(p.likes) && p.likes.includes(viewerUid);
      const hasHearted = Array.isArray(p.hearts) && p.hearts.includes(viewerUid);
      const hasCommented = Array.isArray(p.comments) && p.comments.some((c) => c.authorId === viewerUid);
      if (hasLiked || hasHearted || hasCommented) {
        set.add(p.authorId);
      }
    }
    return set;
  }

  public getFeedConfig(): FeedRankingConfig {
    return { ...(this.state.feedConfig || DEFAULT_FEED_CONFIG) };
  }

  public updateFeedConfig(actor: ModerationActor, updates: Partial<FeedRankingConfig>): FeedRankingConfig {
    if (!isAdminRole(actor.role)) {
      throw new ModerationError(403, 'ADMIN_REQUIRED', 'Only Administrators can modify main feed ranking configuration.');
    }

    let merged: FeedRankingConfig;
    try {
      merged = validateAndMergeFeedConfig(this.state.feedConfig || DEFAULT_FEED_CONFIG, updates);
    } catch (err: any) {
      throw new ModerationError(400, 'INVALID_FEED_CONFIG', err?.message || 'Invalid feed configuration.');
    }

    this.state.feedConfig = merged;
    this.appendAudit({
      action: 'MODERATION_CONFIG_UPDATED',
      actorId: actor.uid,
      actorName: actor.name,
      actorRole: actor.role,
      targetType: 'config',
      reportIds: [],
      note: `Main feed ranking configuration updated (sortMode=${merged.sortMode}).`,
      metadata: { feedConfig: merged }
    });

    this.persist();
    return { ...merged };
  }

  public getNewFeedPostsCount(
    viewer?: ModerationActor | null,
    options?: { since?: string; postType?: string }
  ): { count: number; latestPostAt: string | null } {
    const viewerCtx = this.buildViewerContext(viewer);
    const sinceMs = options?.since ? new Date(options.since).getTime() : NaN;
    const postType = options?.postType;

    let count = 0;
    let latestMs = -1;
    let latestPostAt: string | null = null;

    for (const post of Object.values(this.state.posts)) {
      if (postType && postType !== 'all' && post.postType !== postType) continue;
      const authorProfile = this.resolveAuthorProfile(post.authorId);
      if (!canUserViewPost(post, { surface: 'feed', viewer: viewerCtx, authorAccount: authorProfile })) {
        continue;
      }
      const createdMs = new Date(post.createdAt || 0).getTime();
      if (!Number.isNaN(createdMs) && createdMs > latestMs) {
        latestMs = createdMs;
        latestPostAt = post.createdAt;
      }
      if (!Number.isNaN(sinceMs) && createdMs > sinceMs) {
        if (!viewer?.uid || post.authorId !== viewer.uid) {
          count++;
        }
      }
    }

    return { count, latestPostAt };
  }

  /**
   * 4-Step Main Social Feed Builder:
   *   Step 1: Collect candidate published posts (all alumni & institutional posts)
   *   Step 2: Filter via ONE shared `canUserViewPost` policy (no duplicate logic)
   *   Step 3: Sort (Mode A: Chronological createdAt+id, Mode B: Simple Relevance Score)
   *   Step 4: Final adjustments (up to 3 active pinned announcements, max 3 consecutive same-author, no duplicates)
   *   Plus session snapshot cursor pagination so mid-scroll inserts/edits/deletes remain consistent.
   */
  public getMainFeed(
    viewer?: ModerationActor | null,
    options?: {
      cursor?: string;
      limit?: number;
      postType?: string;
      search?: string;
      sortMode?: FeedSortMode;
      interactedAuthorIds?: string[];
      seenIds?: string[];
    }
  ): FeedPageResponse {
    const nowMs = Date.now();
    const feedConfig = this.state.feedConfig || DEFAULT_FEED_CONFIG;
    const requestedSortMode =
      options?.sortMode === 'chronological' || options?.sortMode === 'relevance'
        ? options.sortMode
        : feedConfig.sortMode;
    const limit = Math.min(50, Math.max(1, Math.floor(Number(options?.limit) || feedConfig.pageSize || 10)));
    const viewerCtx = this.buildViewerContext(viewer);
    const search = (options?.search || '').toLowerCase().trim();
    const surface = search ? 'search' : 'feed';
    const postType = options?.postType;
    const externalSeen = new Set<string>(Array.isArray(options?.seenIds) ? options.seenIds : []);

    // Resume existing session snapshot when cursor is provided
    const decodedCursor = decodeFeedCursor(options?.cursor);
    if (decodedCursor) {
      const snap = this.feedSessionSnapshots.get(decodedCursor.snapshotId);
      if (snap && snap.viewerUid === (viewer?.uid || '')) {
        const previouslyEmitted = new Set<string>([
          ...snap.pinnedIds,
          ...snap.orderedIds.slice(0, decodedCursor.offset),
          ...externalSeen
        ]);

        const pagePosts: InstitutionalFeedPost[] = [];
        let cursorOffset = decodedCursor.offset;

        while (cursorOffset < snap.orderedIds.length && pagePosts.length < limit) {
          const postId = snap.orderedIds[cursorOffset];
          cursorOffset++;
          if (previouslyEmitted.has(postId)) continue;

          const post = this.state.posts[postId];
          if (!post) continue;
          if (postType && postType !== 'all' && post.postType !== postType) continue;

          const authorProfile = this.resolveAuthorProfile(post.authorId);
          if (!canUserViewPost(post, { surface, viewer: viewerCtx, authorAccount: authorProfile })) {
            continue;
          }

          if (search) {
            const hydrated = hydratePostWithLiveAuthor(post, authorProfile, viewerCtx);
            const haystack = `${hydrated.title} ${hydrated.content} ${hydrated.authorName} ${(hydrated.tags || []).join(' ')}`.toLowerCase();
            if (!haystack.includes(search)) continue;
          }

          previouslyEmitted.add(postId);
          const projected = this.projectPostForViewer(
            { ...post, isPinned: false },
            viewer
          );
          pagePosts.push(projected);
        }

        // Check whether at least one more visible, unseen post remains in the snapshot
        let hasMore = false;
        for (let i = cursorOffset; i < snap.orderedIds.length; i++) {
          const nextId = snap.orderedIds[i];
          if (previouslyEmitted.has(nextId)) continue;
          const candidate = this.state.posts[nextId];
          if (!candidate) continue;
          if (postType && postType !== 'all' && candidate.postType !== postType) continue;
          const authorProfile = this.resolveAuthorProfile(candidate.authorId);
          if (canUserViewPost(candidate, { surface, viewer: viewerCtx, authorAccount: authorProfile })) {
            hasMore = true;
            break;
          }
        }

        return {
          posts: pagePosts,
          pinnedPosts: [],
          nextCursor: hasMore ? encodeFeedCursor(snap.id, cursorOffset) : null,
          hasMore,
          totalCount: snap.pinnedIds.length + snap.orderedIds.length,
          sortMode: snap.sortMode,
          sessionSnapshotId: snap.id,
          latestPostAt: snap.createdAtIso
        };
      }
    }

    // --- Step 1: Collect Candidate Posts ---
    const allCandidates = Object.values(this.state.posts);
    const interacted = this.deriveInteractedAuthorIds(viewer?.uid, options?.interactedAuthorIds);

    // --- Step 2: Filter via ONE shared visibility policy (`canUserViewPost`) ---
    const eligibleCandidates: Array<{ post: InstitutionalFeedPost; authorProfile: StoredProfileRecord | null }> = [];
    for (const post of allCandidates) {
      if (postType && postType !== 'all' && post.postType !== postType) {
        continue;
      }
      const authorProfile = this.resolveAuthorProfile(post.authorId);
      const visible = canUserViewPost(post, {
        surface,
        viewer: viewerCtx,
        authorAccount: authorProfile
      });
      if (!visible) continue;

      if (search) {
        const hydrated = hydratePostWithLiveAuthor(post, authorProfile, viewerCtx);
        const haystack = `${hydrated.title} ${hydrated.content} ${hydrated.authorName} ${(hydrated.tags || []).join(' ')}`.toLowerCase();
        if (!haystack.includes(search)) continue;
      }

      eligibleCandidates.push({ post, authorProfile });
    }

    // --- Step 3: Partition Pinned Admin Announcements & Sort Regular Pool ---
    const maxPinned = Math.min(3, Math.max(1, feedConfig.maxPinnedAnnouncements || 3));
    const activeAdminPinned = eligibleCandidates
      .filter(({ post, authorProfile }) => {
        if (!isPinActive(post, nowMs)) return false;
        const authorIsAdmin = isAdminRole(post.authorRole) || isAdminRole(authorProfile?.role as string | undefined);
        return authorIsAdmin;
      })
      .sort((a, b) => {
        const typeA = a.post.postType === 'announcement' ? 0 : 1;
        const typeB = b.post.postType === 'announcement' ? 0 : 1;
        if (typeA !== typeB) return typeA - typeB;
        return comparePostsCreatedDesc(a.post, b.post);
      });

    const selectedPinned = activeAdminPinned.slice(0, maxPinned).map((item) => item.post);
    const pinnedIds = new Set<string>(selectedPinned.map((p) => p.id));

    const regularCandidates = eligibleCandidates.filter(
      ({ post }) => !pinnedIds.has(post.id) && !externalSeen.has(post.id)
    );

    if (requestedSortMode === 'relevance') {
      const scored = regularCandidates.map((entry) => ({
        ...entry,
        score: calculateFeedRelevanceScore(
          entry.post,
          viewerCtx,
          feedConfig,
          interacted,
          nowMs,
          entry.authorProfile
        )
      }));
      scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return comparePostsCreatedDesc(a.post, b.post);
      });
      regularCandidates.splice(0, regularCandidates.length, ...scored.map((s) => ({ post: s.post, authorProfile: s.authorProfile })));
    } else {
      regularCandidates.sort((a, b) => comparePostsCreatedDesc(a.post, b.post));
    }

    // --- Step 4: Final Adjustments (max 3 consecutive same-author + deduplicate) ---
    const spaced = enforceMaxConsecutiveAuthor(
      regularCandidates.map((entry) => entry.post),
      feedConfig.maxConsecutiveSameAuthor
    );

    const seenInSession = new Set<string>(pinnedIds);
    const deduplicatedRegular: InstitutionalFeedPost[] = [];
    for (const p of spaced) {
      if (seenInSession.has(p.id) || externalSeen.has(p.id)) continue;
      seenInSession.add(p.id);
      deduplicatedRegular.push(p);
    }

    // Determine latest visible post timestamp for the "New posts available" banner
    let latestPostAt: string | null = null;
    let latestMs = -1;
    for (const { post } of eligibleCandidates) {
      const ms = new Date(post.createdAt || 0).getTime();
      if (!Number.isNaN(ms) && ms > latestMs) {
        latestMs = ms;
        latestPostAt = post.createdAt;
      }
    }

    // Store short-lived session snapshot so page 2+ never skips or duplicates items
    if (this.feedSessionSnapshots.size > 250) {
      const cutoff = nowMs - 2 * 60 * 60 * 1000;
      for (const [k, v] of this.feedSessionSnapshots.entries()) {
        if (v.createdAtMs < cutoff) this.feedSessionSnapshots.delete(k);
      }
    }
    const snapshotId = `fsnap_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const snapshot: FeedSessionSnapshot = {
      id: snapshotId,
      viewerUid: viewer?.uid || '',
      sortMode: requestedSortMode,
      orderedIds: deduplicatedRegular.map((p) => p.id),
      pinnedIds: Array.from(pinnedIds),
      createdAtMs: nowMs,
      createdAtIso: latestPostAt || new Date(nowMs).toISOString()
    };
    this.feedSessionSnapshots.set(snapshotId, snapshot);

    const firstPageRaw = deduplicatedRegular.slice(0, limit);
    const hasMore = deduplicatedRegular.length > limit;
    const nextCursor = hasMore ? encodeFeedCursor(snapshotId, limit) : null;

    const projectedPinned = selectedPinned.map((p) =>
      this.projectPostForViewer({ ...p, isPinned: true }, viewer)
    );
    const projectedPage = firstPageRaw.map((p) =>
      this.projectPostForViewer({ ...p, isPinned: false }, viewer)
    );

    return {
      posts: projectedPage,
      pinnedPosts: projectedPinned,
      nextCursor,
      hasMore,
      totalCount: projectedPinned.length + deduplicatedRegular.length,
      sortMode: requestedSortMode,
      sessionSnapshotId: snapshotId,
      latestPostAt: snapshot.createdAtIso
    };
  }

  public togglePostReaction(
    postId: string,
    actor: ModerationActor,
    reactionType: 'heart' | 'like' = 'heart'
  ): { post: InstitutionalFeedPost } {
    const blockCheck = this.checkUserBlockedFromPostingOrReporting(actor.uid);
    if (blockCheck.blocked && !blockCheck.reason?.includes('report')) {
      throw new ModerationError(403, 'USER_SUSPENDED', blockCheck.reason || 'Suspended users cannot react to posts.');
    }
    const post = this.state.posts[postId];
    if (!post) {
      throw new ModerationError(404, 'POST_NOT_FOUND', 'Post not found.');
    }
    const viewerCtx = this.buildViewerContext(actor);
    const authorProfile = this.resolveAuthorProfile(post.authorId);
    if (!canUserViewPost(post, { surface: 'permalink', viewer: viewerCtx, authorAccount: authorProfile })) {
      throw new ModerationError(403, 'FORBIDDEN', 'You do not have permission to interact with this post.');
    }

    if (post.authorId === actor.uid && !post.isAnonymous) {
      throw new ModerationError(
        400,
        'SELF_CONGRATULATION_NOT_ALLOWED',
        'You cannot congratulate or react to your own post.'
      );
    }

    if (reactionType === 'like') {
      const current = new Set(Array.isArray(post.likes) ? post.likes : []);
      if (current.has(actor.uid)) current.delete(actor.uid);
      else current.add(actor.uid);
      post.likes = Array.from(current);
    } else {
      const current = new Set(Array.isArray(post.hearts) ? post.hearts : []);
      if (current.has(actor.uid)) current.delete(actor.uid);
      else current.add(actor.uid);
      post.hearts = Array.from(current);
    }

    this.state.posts[postId] = post;
    this.invalidateCaches();
    this.persist();
    return { post: this.projectPostForViewer(post, actor) };
  }

  public addPostComment(
    postId: string,
    actor: ModerationActor,
    rawText: string
  ): { post: InstitutionalFeedPost; comment: FeedComment } {
    const blockCheck = this.checkUserBlockedFromPostingOrReporting(actor.uid);
    if (blockCheck.blocked && !blockCheck.reason?.includes('report')) {
      throw new ModerationError(403, 'USER_SUSPENDED', blockCheck.reason || 'Suspended users cannot comment on posts.');
    }
    const post = this.state.posts[postId];
    if (!post) {
      throw new ModerationError(404, 'POST_NOT_FOUND', 'Post not found.');
    }
    const viewerCtx = this.buildViewerContext(actor);
    const authorProfile = this.resolveAuthorProfile(post.authorId);
    if (!canUserViewPost(post, { surface: 'permalink', viewer: viewerCtx, authorAccount: authorProfile })) {
      throw new ModerationError(403, 'FORBIDDEN', 'You do not have permission to comment on this post.');
    }

    const cleanText = sanitizeModerationText(rawText, 1000);
    if (!cleanText) {
      throw new ModerationError(400, 'EMPTY_COMMENT', 'Comment cannot be empty.');
    }

    const actorProfile = this.resolveAuthorProfile(actor.uid);
    const comment: FeedComment = {
      id: `cmt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      authorId: actor.uid,
      authorName: actorProfile?.name || actor.name || 'Cecilian Member',
      authorAvatar: actorProfile?.profilePictureUrl || '',
      authorRole: normalizeSystemRole(actor.role),
      text: cleanText,
      createdAt: new Date().toISOString()
    };

    post.comments = [...(Array.isArray(post.comments) ? post.comments : []), comment];
    this.state.posts[postId] = post;
    this.invalidateCaches();
    this.persist();
    return { post: this.projectPostForViewer(post, actor), comment };
  }

  public getVisiblePosts(
    viewer?: ModerationActor | null,
    options?: { search?: string; authorId?: string; includeDeletedForMod?: boolean; cursor?: string; limit?: number }
  ): InstitutionalFeedPost[] {
    const search = (options?.search || '').toLowerCase().trim();
    const viewerCtx = this.buildViewerContext(viewer);
    const surface = search ? 'search' : 'feed';

    const matching = Object.values(this.state.posts)
      .filter((post) => {
        const authorProfile = this.resolveAuthorProfile(post.authorId);
        const visible = canUserViewPost(post, {
          surface,
          viewer: viewerCtx,
          authorAccount: authorProfile,
          includeDeletedForMod: options?.includeDeletedForMod
        });
        if (!visible) return false;

        if (options?.authorId) {
          // If filtering feed by authorId, still never expose anonymous posts!
          if (post.isAnonymous || post.authorId !== options.authorId) {
            return false;
          }
        }

        if (search) {
          const hydrated = hydratePostWithLiveAuthor(post, authorProfile, viewerCtx);
          const haystack = `${hydrated.title} ${hydrated.content} ${hydrated.authorName} ${(hydrated.tags || []).join(' ')}`.toLowerCase();
          if (!haystack.includes(search)) return false;
        }

        return true;
      })
      .sort(comparePostsCreatedDesc)
      .map((p) => this.projectPostForViewer(p, viewer));

    if (options?.cursor !== undefined || options?.limit !== undefined) {
      return paginatePostsWithCursor(matching, options.cursor, options.limit || 10).items;
    }
    return matching;
  }

  public getVisiblePostsPaginated(
    viewer?: ModerationActor | null,
    options?: { search?: string; cursor?: string; limit?: number; postType?: string }
  ): { posts: InstitutionalFeedPost[]; nextCursor: string | null; hasMore: boolean; totalCount: number } {
    let all = this.getVisiblePosts(viewer, { search: options?.search });
    if (options?.postType && options.postType !== 'all') {
      all = all.filter((p) => p.postType === options.postType);
    }
    const page = paginatePostsWithCursor(all, options?.cursor, options?.limit || 10);
    return {
      posts: page.items,
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
      totalCount: all.length
    };
  }

  public getPostByIdForViewer(postId: string, viewer?: ModerationActor | null): InstitutionalFeedPost | null {
    const post = this.state.posts[postId];
    if (!post) return null;
    const viewerCtx = this.buildViewerContext(viewer);
    const authorProfile = this.resolveAuthorProfile(post.authorId);
    const allowed = canUserViewPost(post, {
      surface: 'permalink',
      viewer: viewerCtx,
      authorAccount: authorProfile
    });
    if (!allowed) return null;

    return this.projectPostForViewer(post, viewer);
  }

  public getPostMediaForViewer(
    postId: string,
    viewer?: ModerationActor | null
  ): { allowed: boolean; status: number; error?: string; imageUrl?: string; mimeType?: string } {
    const post = this.state.posts[postId];
    if (!post) {
      return { allowed: false, status: 404, error: 'Media not found.' };
    }
    const viewerCtx = this.buildViewerContext(viewer);
    const authorProfile = this.resolveAuthorProfile(post.authorId);
    const allowed = canUserViewPost(post, {
      surface: 'media',
      viewer: viewerCtx,
      authorAccount: authorProfile
    });
    if (!allowed) {
      return {
        allowed: false,
        status: viewer?.uid ? 403 : 401,
        error: viewer?.uid ? 'You do not have permission to access media for this post.' : 'Authentication required.'
      };
    }
    const url = post.imageUrl || post.mediaUrl || this.state.postMedia[postId]?.data;
    if (!url) {
      return { allowed: false, status: 404, error: 'No media attached to this post.' };
    }
    return {
      allowed: true,
      status: 200,
      imageUrl: url,
      mimeType: this.state.postMedia[postId]?.mimeType || 'image/jpeg'
    };
  }

  // ===========================================================================
  // 1B. PERSONAL PROFILE ACCESS, SLUG REDIRECTS & CURSOR TIMELINE
  // ===========================================================================

  private resolveProfileIdentifierInternal(identifier: string): {
    profile: StoredProfileRecord | null;
    redirectToSlug?: string;
  } {
    const raw = (identifier || '').trim();
    if (!raw) return { profile: null };

    // 1. Direct UID lookup
    const byUid = this.resolveAuthorProfile(raw);
    if (byUid) {
      return { profile: byUid };
    }

    const slugLower = raw.toLowerCase();

    // 2. Current username / slug lookup
    for (const prof of Object.values(this.state.profiles)) {
      if ((prof.username || '').toLowerCase() === slugLower) {
        return { profile: this.resolveAuthorProfile(prof.uid) };
      }
    }

    // 3. Slug history lookup (301/canonical redirect to current handle)
    const redirectedUid = this.state.slugRedirects[slugLower];
    if (redirectedUid) {
      const target = this.resolveAuthorProfile(redirectedUid);
      if (target) {
        return { profile: target, redirectToSlug: target.username };
      }
    }

    // 4. Fallback check across previousUsernames arrays
    for (const prof of Object.values(this.state.profiles)) {
      if (Array.isArray(prof.previousUsernames) && prof.previousUsernames.some((u) => u.toLowerCase() === slugLower)) {
        const target = this.resolveAuthorProfile(prof.uid);
        if (target) {
          return { profile: target, redirectToSlug: target.username };
        }
      }
    }

    // 5. Fallback scan of adapter users by generated slug
    const adapterUsers = this.accountAdapter?.getAllUsers ? this.accountAdapter.getAllUsers() : [];
    for (const u of adapterUsers) {
      if (!u?.uid) continue;
      if ((u.username || '').toLowerCase() === slugLower || slugifyUsername(u.name || '') === slugLower) {
        const synced = this.upsertProfileRecord(u, false);
        return { profile: synced };
      }
    }

    return { profile: null };
  }

  private getVisibleTimelinePostsForProfile(
    targetUid: string,
    viewerCtx: ViewerContext | null,
    targetProfile: StoredProfileRecord
  ): InstitutionalFeedPost[] {
    return Object.values(this.state.posts)
      .filter((post) =>
        canUserViewPost(post, {
          surface: 'profile',
          viewer: viewerCtx,
          targetProfileUid: targetUid,
          authorAccount: targetProfile
        })
      )
      .sort(comparePostsCreatedDesc);
  }

  public getPublicProfileForViewer(
    identifier: string,
    actor: ModerationActor
  ): {
    profile: PublicProfileSummary;
    redirectToSlug?: string;
    unavailable: boolean;
  } {
    if (!actor?.uid) {
      throw new ModerationError(401, 'AUTH_REQUIRED', 'Please sign in to view alumni profiles.');
    }

    const { profile: resolved, redirectToSlug } = this.resolveProfileIdentifierInternal(identifier);
    if (!resolved) {
      throw new ModerationError(404, 'PROFILE_NOT_FOUND', 'Profile not found.');
    }

    const viewerCtx = this.buildViewerContext(actor);
    const isSelf = actor.uid === resolved.uid;
    const isMod = isModeratorRole(actor.role);
    const viewerProfile = this.resolveAuthorProfile(actor.uid);
    const blocked = areUsersBlocked(actor.uid, resolved.uid, viewerProfile, resolved);
    const unavailable = !isSelf && (blocked || isAccountUnavailable(resolved));

    if (unavailable && !isMod) {
      return {
        redirectToSlug,
        unavailable: true,
        profile: {
          uid: resolved.uid,
          username: resolved.username,
          name: isAccountDeleted(resolved) ? 'Former alumni' : 'Unavailable Account',
          role: 'alumni',
          unavailable: true,
          unavailableReason: 'This account is unavailable',
          postsCount: 0,
          isBlockedByViewer: Boolean(viewerProfile?.blockedUsers?.includes(resolved.uid))
        }
      };
    }

    if (isAccountDeleted(resolved)) {
      return {
        redirectToSlug,
        unavailable: true,
        profile: {
          uid: resolved.uid,
          username: resolved.username,
          name: 'Former alumni',
          role: 'alumni',
          unavailable: true,
          unavailableReason: 'This account is unavailable',
          postsCount: 0
        }
      };
    }

    const visibleTimelinePosts = this.getVisibleTimelinePostsForProfile(resolved.uid, viewerCtx, resolved);
    const showEmail = isSelf || isMod || Boolean(resolved.show_email);
    const showPhone = isSelf || isMod || Boolean(resolved.show_phone);
    const showEmployer = isSelf || isMod || (resolved.show_current_employer ?? true);

    return {
      redirectToSlug,
      unavailable: false,
      profile: {
        uid: resolved.uid,
        username: resolved.username,
        name: resolved.name,
        role: normalizeSystemRole(resolved.role as string),
        batch: resolved.batch,
        course: resolved.course,
        department: resolved.department,
        location: resolved.location,
        profilePictureUrl: resolved.profilePictureUrl,
        coverPhotoUrl: resolved.coverPhotoUrl,
        headline: resolved.headline,
        about: resolved.about,
        company: showEmployer ? resolved.company : undefined,
        currentPosition: showEmployer ? resolved.currentPosition : undefined,
        email: showEmail ? resolved.email : undefined,
        phone: showPhone ? resolved.phone : undefined,
        isVerified: resolved.isVerified,
        quickStatus: resolved.quickStatus,
        followersCount: resolved.followersCount,
        followingCount: resolved.followingCount,
        connectionsCount: resolved.connectionsCount,
        pinnedPostId: resolved.pinnedPostId,
        postsCount: visibleTimelinePosts.length,
        unavailable: false,
        isBlockedByViewer: Boolean(viewerProfile?.blockedUsers?.includes(resolved.uid)),
        show_email: resolved.show_email,
        show_phone: resolved.show_phone,
        show_current_employer: resolved.show_current_employer,
        createdAt: resolved.createdAt
      }
    };
  }

  public getProfileTimeline(
    identifier: string,
    actor: ModerationActor,
    options?: {
      cursor?: string;
      limit?: number;
      tab?: 'posts' | 'media' | 'about';
      postType?: string;
      year?: string;
    }
  ): PaginatedTimelineResponse {
    if (!actor?.uid) {
      throw new ModerationError(401, 'AUTH_REQUIRED', 'Please sign in to view alumni profiles.');
    }
    if (this.state.config.profileTimelineEnabled === false) {
      throw new ModerationError(403, 'FEATURE_DISABLED', 'Profile timelines are currently disabled by administrator configuration.');
    }

    const { profile: resolved, redirectToSlug } = this.resolveProfileIdentifierInternal(identifier);
    if (!resolved) {
      throw new ModerationError(404, 'PROFILE_NOT_FOUND', 'Profile not found.');
    }

    const viewerCtx = this.buildViewerContext(actor);
    const viewerProfile = this.resolveAuthorProfile(actor.uid);
    const isSelf = actor.uid === resolved.uid;
    const isMod = isModeratorRole(actor.role);
    const blocked = areUsersBlocked(actor.uid, resolved.uid, viewerProfile, resolved);

    if ((!isSelf && blocked) || isAccountUnavailable(resolved)) {
      if (!isMod || blocked || isAccountDeleted(resolved)) {
        return {
          posts: [],
          pinnedPost: null,
          nextCursor: null,
          hasMore: false,
          totalCount: 0,
          redirectToSlug,
          unavailable: true,
          unavailableReason: 'This account is unavailable'
        };
      }
    }

    const cacheKey = `${resolved.uid}:${actor.uid}:${options?.cursor || ''}:${options?.limit || 10}:${options?.tab || 'posts'}:${options?.postType || 'all'}:${options?.year || 'all'}`;
    const cached = this.timelineCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const allVisible = this.getVisibleTimelinePostsForProfile(resolved.uid, viewerCtx, resolved);
    const totalCount = allVisible.length;

    let filtered = allVisible;
    if (options?.tab === 'media') {
      filtered = filtered.filter((p) => Boolean(p.imageUrl || p.mediaUrl));
    }
    if (options?.postType && options.postType !== 'all') {
      filtered = filtered.filter((p) => p.postType === options.postType);
    }
    if (options?.year && options.year !== 'all') {
      filtered = filtered.filter((p) => String(new Date(p.createdAt).getFullYear()) === options.year);
    }

    let pinnedPost: InstitutionalFeedPost | null = null;
    if (resolved.pinnedPostId && options?.tab !== 'media') {
      const pinnedMatch = filtered.find((p) => p.id === resolved.pinnedPostId);
      if (pinnedMatch) {
        pinnedPost = this.projectPostForViewer({ ...pinnedMatch, isPinned: true }, actor);
        filtered = filtered.filter((p) => p.id !== pinnedMatch.id);
      }
    }

    const page = paginatePostsWithCursor(filtered, options?.cursor, options?.limit || 10);
    const projectedItems = page.items.map((p) => this.projectPostForViewer(p, actor));

    const result: PaginatedTimelineResponse = {
      posts: projectedItems,
      pinnedPost: !options?.cursor ? pinnedPost : null,
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
      totalCount,
      redirectToSlug,
      unavailable: false
    };

    this.timelineCache.set(cacheKey, { expiresAt: Date.now() + 15000, value: result });
    return result;
  }

  public setPinnedPostForUser(actor: ModerationActor, postId: string | null): { pinnedPostId: string | null } {
    const profile = this.resolveAuthorProfile(actor.uid) || this.upsertProfileRecord({ uid: actor.uid, name: actor.name, email: actor.email, role: actor.role }, false);
    if (!postId) {
      profile.pinnedPostId = undefined;
      this.state.profiles[actor.uid] = profile;
      this.invalidateCaches();
      this.persist();
      return { pinnedPostId: null };
    }

    const post = this.state.posts[postId];
    if (!post) {
      throw new ModerationError(404, 'POST_NOT_FOUND', 'Post not found.');
    }
    if (post.authorId !== actor.uid) {
      throw new ModerationError(403, 'FORBIDDEN', 'You can only pin your own posts.');
    }
    if (post.isSoftDeleted || post.isAnonymous || (post.status || 'published') !== 'published') {
      throw new ModerationError(400, 'PIN_NOT_ALLOWED', 'Only your own published non-anonymous posts can be pinned.');
    }

    profile.pinnedPostId = post.id;
    this.state.profiles[actor.uid] = profile;
    this.invalidateCaches();
    this.persist();
    return { pinnedPostId: post.id };
  }

  public updateMyProfile(
    actor: ModerationActor,
    updates: {
      name?: string;
      username?: string;
      headline?: string;
      about?: string;
      location?: string;
      company?: string;
      currentPosition?: string;
      profilePictureUrl?: string;
      coverPhotoUrl?: string;
      phone?: string;
      show_email?: boolean;
      show_phone?: boolean;
      show_current_employer?: boolean;
    }
  ): { profile: PublicProfileSummary; slugChanged: boolean } {
    const existing = this.resolveAuthorProfile(actor.uid) || this.upsertProfileRecord({
      uid: actor.uid,
      name: actor.name,
      email: actor.email,
      role: actor.role
    }, false);

    let nextUsername = existing.username;
    let slugChanged = false;
    if (typeof updates.username === 'string' && updates.username.trim()) {
      const requestedSlug = slugifyUsername(updates.username);
      if (requestedSlug !== existing.username) {
        const taken = this.getAllKnownHandlesSet(actor.uid);
        if (taken.has(requestedSlug.toLowerCase())) {
          throw new ModerationError(409, 'USERNAME_TAKEN', 'That profile username is already in use.');
        }
        nextUsername = requestedSlug;
        slugChanged = true;
      }
    }

    const updated = this.upsertProfileRecord(
      {
        ...existing,
        name: updates.name !== undefined ? sanitizeModerationText(updates.name, 120) : existing.name,
        username: nextUsername,
        headline: updates.headline !== undefined ? sanitizeModerationText(updates.headline, 160) : existing.headline,
        about: updates.about !== undefined ? sanitizeModerationText(updates.about, 2000) : existing.about,
        location: updates.location !== undefined ? sanitizeModerationText(updates.location, 120) : existing.location,
        company: updates.company !== undefined ? sanitizeModerationText(updates.company, 120) : existing.company,
        currentPosition: updates.currentPosition !== undefined ? sanitizeModerationText(updates.currentPosition, 120) : existing.currentPosition,
        profilePictureUrl: updates.profilePictureUrl !== undefined ? updates.profilePictureUrl : existing.profilePictureUrl,
        coverPhotoUrl: updates.coverPhotoUrl !== undefined ? updates.coverPhotoUrl : existing.coverPhotoUrl,
        phone: updates.phone !== undefined ? sanitizeModerationText(updates.phone, 40) : existing.phone,
        show_email: updates.show_email !== undefined ? Boolean(updates.show_email) : existing.show_email,
        show_phone: updates.show_phone !== undefined ? Boolean(updates.show_phone) : existing.show_phone,
        show_current_employer: updates.show_current_employer !== undefined ? Boolean(updates.show_current_employer) : existing.show_current_employer
      },
      true
    );

    const view = this.getPublicProfileForViewer(updated.uid, actor);
    return { profile: view.profile, slugChanged };
  }

  public setUserBlock(actor: ModerationActor, targetUid: string, shouldBlock: boolean): { blockedUsers: string[] } {
    if (actor.uid === targetUid) {
      throw new ModerationError(400, 'SELF_BLOCK_INVALID', 'You cannot block your own account.');
    }
    const target = this.resolveAuthorProfile(targetUid);
    if (!target) {
      throw new ModerationError(404, 'PROFILE_NOT_FOUND', 'Target user not found.');
    }
    const selfProfile = this.resolveAuthorProfile(actor.uid) || this.upsertProfileRecord({
      uid: actor.uid,
      name: actor.name,
      email: actor.email,
      role: actor.role
    }, false);

    const currentBlocks = new Set(selfProfile.blockedUsers || []);
    if (shouldBlock) {
      currentBlocks.add(targetUid);
    } else {
      currentBlocks.delete(targetUid);
    }
    selfProfile.blockedUsers = Array.from(currentBlocks);
    this.state.profiles[actor.uid] = selfProfile;
    this.invalidateCaches();
    this.persist();
    return { blockedUsers: selfProfile.blockedUsers };
  }

  public deleteAndAnonymizeAccount(
    targetUid: string,
    actor: ModerationActor
  ): { success: boolean; deletedPosts: number; deletedComments: number; anonymizedPosts: number } {
    if (actor.uid !== targetUid && !isAdminRole(actor.role)) {
      throw new ModerationError(403, 'FORBIDDEN', 'Only the account owner or an Administrator can delete this account.');
    }
    if (targetUid === 'usr_superadmin_cecilia') {
      throw new ModerationError(403, 'PROTECTED_ACCOUNT', 'The primary Super Administrator account cannot be deleted.');
    }
    const resolved = this.resolveAuthorProfile(targetUid);
    const existing: StoredProfileRecord = resolved || {
      uid: targetUid,
      name: 'Former Member (Deleted)',
      email: '',
      role: 'alumni',
      username: `deleted.${targetUid.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(-8) || 'user'}`,
      previousUsernames: [],
      blockedUsers: []
    };
    const targetRole = normalizeSystemRole(existing.role as string);
    if ((targetRole === 'admin' || targetRole === 'superadmin') && !isSuperAdminRole(actor.role)) {
      throw new ModerationError(403, 'FORBIDDEN', 'Only Super Administrators can delete administrative accounts.');
    }

    const now = new Date().toISOString();

    // Release any old username / slug redirects so future registrations are unaffected
    for (const [slug, mappedUid] of Object.entries(this.state.slugRedirects)) {
      if (mappedUid === targetUid) {
        delete this.state.slugRedirects[slug];
      }
    }

    // Soft-delete profile tombstone: strip all personal app profile data & release identity identifiers
    existing.isDeleted = true;
    existing.accountStatus = 'DELETED';
    existing.status = 'DELETED';
    existing.deletedAt = now;
    existing.name = 'Former Member (Deleted)';
    existing.username = `deleted.${targetUid.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(-8) || 'user'}`;
    existing.previousUsernames = [];
    existing.profilePictureUrl = '';
    existing.coverPhotoUrl = '';
    existing.phone = '';
    existing.email = '';
    existing.headline = '';
    existing.about = '';
    existing.location = '';
    existing.company = '';
    existing.currentPosition = '';
    existing.batch = undefined;
    existing.course = undefined;
    existing.department = undefined;
    existing.quickStatus = undefined;
    existing.blockedUsers = [];
    existing.groupIds = [];
    existing.pinnedPostId = undefined;
    this.state.profiles[targetUid] = existing;

    // Permanently delete all posts authored by the deleted account and strip all comments/reactions by this user
    let deletedPosts = 0;
    let deletedComments = 0;
    const deletedPostIds = new Set<string>();

    for (const [postId, post] of Object.entries(this.state.posts)) {
      if (post.authorId === targetUid) {
        deletedPostIds.add(postId);
        delete this.state.posts[postId];
        delete this.state.postMedia[postId];
        deletedPosts++;
      } else {
        let modified = false;
        if (Array.isArray(post.comments)) {
          const remainingComments = post.comments.filter((c) => c.authorId !== targetUid);
          if (remainingComments.length !== post.comments.length) {
            deletedComments += post.comments.length - remainingComments.length;
            post.comments = remainingComments;
            modified = true;
          }
        }
        if (Array.isArray(post.likes) && post.likes.includes(targetUid)) {
          post.likes = post.likes.filter((id) => id !== targetUid);
          modified = true;
        }
        if (Array.isArray(post.hearts) && post.hearts.includes(targetUid)) {
          post.hearts = post.hearts.filter((id) => id !== targetUid);
          modified = true;
        }
        if (modified) {
          this.state.posts[postId] = post;
        }
      }
    }

    // Close open moderation cases/reports referencing permanently deleted posts cleanly
    if (deletedPostIds.size > 0) {
      for (const modCase of this.state.cases) {
        if (modCase.targetType === 'post' && deletedPostIds.has(modCase.targetId)) {
          if (modCase.status === 'pending' || modCase.status === 'reviewed') {
            modCase.status = 'post_removed';
            modCase.resolvedAction = 'post_removed';
            modCase.resolvedBy = actor.uid;
            modCase.resolvedByName = actor.name;
            modCase.resolvedByRole = actor.role;
            modCase.resolvedAt = now;
            modCase.resolutionNote = 'Post permanently deleted during account removal.';
            modCase.autoHiddenPendingReview = false;
            modCase.updatedAt = now;
          }
          modCase.postAuthorName = 'Former Member (Deleted)';
          if (modCase.contentSnapshot) {
            modCase.contentSnapshot.authorName = 'Former Member (Deleted)';
          }
        }
      }
      for (const report of this.state.reports) {
        if (report.targetType === 'post' && deletedPostIds.has(report.targetId) && (report.status === 'pending' || report.status === 'reviewed')) {
          report.status = 'post_removed';
          report.resolvedAt = now;
          report.resolvedBy = actor.uid;
          report.resolvedOutcome = 'post_removed';
        }
      }
    }

    // Preserve anonymized audit record without linking to any future registered profile
    this.appendAudit({
      action: 'ACCOUNT_SOFT_DELETED',
      actorId: actor.uid,
      actorName: actor.name,
      actorRole: actor.role,
      targetType: 'user',
      targetUserId: targetUid,
      reportIds: [],
      note: `Account soft-deleted and anonymized; permanently removed ${deletedPosts} post(s) and ${deletedComments} comment(s).`,
      metadata: {
        deletedPosts,
        deletedComments,
        anonymized: true
      }
    });

    this.accountAdapter?.deleteUserAccount?.(targetUid);

    this.feedSessionSnapshots.clear();
    this.invalidateCaches();
    this.persist();
    return { success: true, deletedPosts, deletedComments, anonymizedPosts: 0 };
  }

  public sharePost(actor: ModerationActor, sourcePostId: string, commentary?: string): InstitutionalFeedPost {
    if (normalizeSystemRole(actor.role) === 'employer') {
      throw new ModerationError(403, 'EMPLOYER_POST_FORBIDDEN', 'Employer accounts cannot share or publish feed posts.');
    }
    const blockCheck = this.checkUserBlockedFromPostingOrReporting(actor.uid);
    if (blockCheck.blocked && !blockCheck.reason?.includes('report')) {
      throw new ModerationError(403, 'USER_SUSPENDED', blockCheck.reason || 'Suspended users cannot share posts.');
    }

    const source = this.state.posts[sourcePostId];
    if (!source) {
      throw new ModerationError(404, 'POST_NOT_FOUND', 'Source post not found.');
    }

    const viewerCtx = this.buildViewerContext(actor);
    const sourceAuthor = this.resolveAuthorProfile(source.authorId);
    const canView = canUserViewPost(source, {
      surface: 'permalink',
      viewer: viewerCtx,
      authorAccount: sourceAuthor
    });
    if (!canView || source.visibility === 'private') {
      throw new ModerationError(403, 'FORBIDDEN', 'You cannot share this post.');
    }

    const hydratedSource = hydratePostWithLiveAuthor(source, sourceAuthor, viewerCtx);
    const cleanComment = commentary ? sanitizeModerationText(commentary, 1000) : '';
    const sharedPost: InstitutionalFeedPost = {
      id: `post_share_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      authorId: actor.uid,
      authorName: actor.name,
      authorRole: normalizeSystemRole(actor.role),
      authorAvatar: this.resolveAuthorProfile(actor.uid)?.profilePictureUrl || '',
      postType: (source.postType as string) === 'milestone' ? 'update' : (source.postType || 'update'),
      title: hydratedSource.title,
      content: cleanComment ? `${cleanComment}\n\n— Shared from ${hydratedSource.authorName}: ${hydratedSource.content}` : hydratedSource.content,
      imageUrl: hydratedSource.imageUrl,
      likes: [],
      hearts: [],
      comments: [],
      sharesCount: 0,
      createdAt: new Date().toISOString(),
      status: 'published',
      visibility: source.visibility === 'group' || source.visibility === 'batch' || source.visibility === 'department' ? source.visibility : 'alumni',
      groupId: source.groupId,
      targetBatch: source.targetBatch,
      targetDepartment: source.targetDepartment,
      isAnonymous: false,
      sharedFromPostId: source.id,
      sharedFromAuthorId: source.isAnonymous ? undefined : source.authorId,
      sharedFromAuthorName: hydratedSource.authorName,
      sharedLabel: 'Shared'
    };

    source.sharesCount = (source.sharesCount || 0) + 1;
    this.state.posts[source.id] = source;
    const saved = this.upsertPost(sharedPost, actor);
    return this.projectPostForViewer(saved, actor);
  }

  // ===========================================================================
  // 2. ALUMNI: REPORT A POST
  // ===========================================================================

  public submitPostReport(
    actor: ModerationActor,
    payload: {
      targetType?: ReportTargetType;
      targetId: string;
      reason: ReportReason;
      details?: string;
      postSnapshotFallback?: InstitutionalFeedPost;
    }
  ): {
    success: true;
    message: string;
    reportId: string;
    caseId: string;
    priority: ReportPriority;
    report: PostReport;
    modCase: ModerationCase;
    auditRecord: ModerationAuditRecord;
    affectedPost: InstitutionalFeedPost;
  } {
    const targetType: ReportTargetType = payload.targetType || 'post';
    if (targetType !== 'post') {
      throw new ModerationError(400, 'UNSUPPORTED_TARGET_TYPE', 'Currently only post reporting is enabled.');
    }

    // Check suspended / banned / restricted reporter
    const userBlock = this.checkUserBlockedFromPostingOrReporting(actor.uid);
    if (userBlock.blocked) {
      throw new ModerationError(403, 'REPORTER_BLOCKED', userBlock.reason || 'You are not permitted to report posts.');
    }

    // Validate reason
    if (!POST_REPORT_REASONS.includes(payload.reason)) {
      throw new ModerationError(400, 'INVALID_REASON', 'Please select a valid report reason.');
    }

    // Ensure post exists (or hydrate if synced from client state on first reference)
    let post = this.state.posts[payload.targetId];
    if (!post && payload.postSnapshotFallback && payload.postSnapshotFallback.id === payload.targetId) {
      const fallback = payload.postSnapshotFallback;
      const nowFallback = new Date().toISOString();
      post = {
        ...fallback,
        id: fallback.id,
        authorId: fallback.authorId || 'unknown_author',
        authorName: sanitizeModerationText(fallback.authorName || 'Cecilian Member', 120) || 'Cecilian Member',
        authorRole: fallback.authorRole || 'alumni',
        postType: fallback.postType || 'update',
        title: sanitizeModerationText(fallback.title || '', 200),
        content: sanitizeModerationText(fallback.content || '', 5000),
        createdAt: fallback.createdAt || nowFallback,
        updatedAt: fallback.updatedAt || fallback.createdAt || nowFallback,
        visibility: fallback.visibility || 'public',
        hearts: Array.isArray(fallback.hearts) ? fallback.hearts : [],
        likes: Array.isArray(fallback.likes) ? fallback.likes : [],
        comments: Array.isArray(fallback.comments) ? fallback.comments : []
      };
      this.state.posts[post.id] = post;
    }

    if (!post) {
      throw new ModerationError(404, 'POST_NOT_FOUND', 'The post you are trying to report no longer exists.');
    }
    if (post.isSoftDeleted) {
      throw new ModerationError(400, 'POST_DELETED', 'Cannot report a deleted post.');
    }
    if (post.authorId === actor.uid) {
      throw new ModerationError(403, 'OWN_POST_REPORT_BLOCKED', 'You cannot report your own post.');
    }

    // Duplicate check: user can only report the same post once
    const existingReport = this.state.reports.find(
      (r) => r.targetType === targetType && r.targetId === payload.targetId && r.reporterId === actor.uid
    );
    if (existingReport) {
      throw new ModerationError(409, 'DUPLICATE_REPORT', 'You already reported this post');
    }

    // Rate limit: max N reports per hour per user (default 10)
    const nowMs = Date.now();
    const oneHourAgo = nowMs - 60 * 60 * 1000;
    const recentTimestamps = (this.state.userRateWindows[actor.uid] || []).filter((t) => t > oneHourAgo);
    if (recentTimestamps.length >= this.state.config.maxReportsPerHour) {
      throw new ModerationError(
        429,
        'REPORT_RATE_LIMIT',
        `Rate limit exceeded. Maximum ${this.state.config.maxReportsPerHour} reports per hour allowed.`
      );
    }

    // Validate & sanitize additional details (max 500 chars)
    const rawDetails = typeof payload.details === 'string' ? payload.details.trim() : '';
    if (rawDetails.length > 500) {
      throw new ModerationError(400, 'DETAILS_TOO_LONG', 'Additional details cannot exceed 500 characters.');
    }
    const sanitizedDetails = rawDetails ? sanitizeModerationText(rawDetails, 500) : undefined;

    // Record rate timestamp
    recentTimestamps.push(nowMs);
    this.state.userRateWindows[actor.uid] = recentTimestamps;

    const nowIso = new Date(nowMs).toISOString();
    const priority = getPriorityForReason(payload.reason);

    // Find or create grouped ModerationCase
    let modCase = this.state.cases.find((c) => c.targetType === targetType && c.targetId === payload.targetId);
    let wasReopened = false;

    if (!modCase) {
      const snapshot = this.buildSnapshot(post);
      modCase = {
        id: `case_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
        targetType,
        targetId: post.id,
        postAuthorId: post.authorId,
        postAuthorName: post.authorName,
        postAuthorRole: post.authorRole || 'alumni',
        status: 'pending',
        highestPriority: priority,
        reportCount: 0,
        highPriorityReportCount: 0,
        reasonsSummary: {},
        contentSnapshot: snapshot,
        currentContent: snapshot,
        contentEditedSinceSnapshot: false,
        autoFlaggedForPriority: false,
        autoHiddenPendingReview: false,
        reportIds: [],
        cycleNumber: 1,
        createdAt: nowIso,
        updatedAt: nowIso
      };
      this.state.cases.unshift(modCase);
    } else if (modCase.status === 'dismissed') {
      // Lifecycle rule: If a post was dismissed and later receives new reports, reopen as pending
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

    const report: PostReport = {
      id: `rep_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      caseId: modCase.id,
      targetType,
      targetId: post.id,
      reason: payload.reason,
      priority,
      details: sanitizedDetails,
      reporterId: actor.uid,
      reporterName: actor.name,
      reporterRole: actor.role,
      status: 'pending',
      cycleNumber: modCase.cycleNumber,
      createdAt: nowIso
    };

    this.state.reports.unshift(report);

    modCase.reportIds.push(report.id);
    modCase.reportCount += 1;
    if (priority === 'high') {
      modCase.highPriorityReportCount += 1;
    }
    modCase.highestPriority = maxPriority(modCase.highestPriority, priority);
    modCase.reasonsSummary[payload.reason] = (modCase.reasonsSummary[payload.reason] || 0) + 1;
    modCase.currentContent = this.buildSnapshot(post);
    modCase.contentEditedSinceSnapshot = this.checkSnapshotDiffers(modCase.contentSnapshot, post);
    modCase.updatedAt = nowIso;

    // Update reporter stats
    const tracker = this.state.reporterTracking[actor.uid] || {
      userId: actor.uid,
      userName: actor.name,
      userRole: actor.role,
      consecutiveDismissedCount: 0,
      totalDismissedCount: 0,
      totalReportsCount: 0,
      flaggedAbusiveReporter: false,
      reportingRestricted: false
    };
    tracker.totalReportsCount += 1;
    tracker.userName = actor.name;
    tracker.userRole = actor.role;
    this.state.reporterTracking[actor.uid] = tracker;

    if (wasReopened) {
      this.appendAudit({
        action: 'CASE_REOPENED',
        actorId: 'system',
        actorName: 'Moderation Lifecycle Engine',
        actorRole: 'system',
        targetType,
        postId: post.id,
        caseId: modCase.id,
        reportIds: [report.id],
        note: 'Previously dismissed case reopened due to new report.'
      });
    }

    // Abuse Prevention 1: Auto-flag post for priority review at X reports (default 5)
    if (!modCase.autoFlaggedForPriority && modCase.reportCount >= this.state.config.autoFlagReportThreshold) {
      modCase.autoFlaggedForPriority = true;
      modCase.highestPriority = 'high';
      this.appendAudit({
        action: 'POST_AUTO_FLAGGED_PRIORITY',
        actorId: 'system',
        actorName: 'Abuse Prevention Engine',
        actorRole: 'system',
        targetType,
        postId: post.id,
        caseId: modCase.id,
        reportIds: [...modCase.reportIds],
        note: `Post reached ${modCase.reportCount} reports and was auto-flagged for priority review.`
      });
    }

    // Abuse Prevention 2: Auto-hide post temporarily from feeds at Y high-priority reports (default 3)
    if (
      !modCase.autoHiddenPendingReview &&
      modCase.highPriorityReportCount >= this.state.config.autoHideHarassmentThreshold
    ) {
      modCase.autoHiddenPendingReview = true;
      post.underReviewAutoHidden = true;
      post.autoHiddenAt = nowIso;
      this.state.posts[post.id] = post;
      this.appendAudit({
        action: 'POST_AUTO_HIDDEN_HARASSMENT',
        actorId: 'system',
        actorName: 'Abuse Prevention Engine',
        actorRole: 'system',
        targetType,
        postId: post.id,
        caseId: modCase.id,
        reportIds: [...modCase.reportIds],
        note: `Post temporarily hidden from feeds after ${modCase.highPriorityReportCount} high-priority reports.`
      });
    }

    const reportAudit = this.appendAudit({
      action: 'REPORT_SUBMITTED',
      actorId: actor.uid,
      actorName: actor.name,
      actorRole: actor.role,
      targetType,
      postId: post.id,
      caseId: modCase.id,
      reportIds: [report.id],
      note: `Reason: ${payload.reason} (Priority: ${priority})`
    });

    // Notify moderators of new high-priority reports (never revealing reporter identity to author/alumni)
    if (priority === 'high' || modCase.autoFlaggedForPriority) {
      this.notifyModeratorsHighPriority(modCase, post);
    }

    this.persist();

    // Return caller's own report and grouped case summary (without other reporters' PII) for Firestore sync
    return {
      success: true,
      message: 'Thanks, our moderators will review your report.',
      reportId: report.id,
      caseId: modCase.id,
      priority,
      report,
      modCase: this.normalizeModCaseRecord(modCase),
      auditRecord: reportAudit,
      affectedPost: post
    };
  }

  private notifyModeratorsHighPriority(modCase: ModerationCase, post: InstitutionalFeedPost): void {
    const reviewers = this.accountAdapter?.getModeratorsAndAdmins() || [];
    const notifiedUids = new Set<string>();

    for (const reviewer of reviewers) {
      // Conflict-of-interest: don't send review alert to the post author
      if (reviewer.uid === modCase.postAuthorId) continue;
      // If post author is mod/admin, only route to admins
      if (isModeratorRole(modCase.postAuthorRole) && !isAdminRole(reviewer.role)) continue;
      if (notifiedUids.has(reviewer.uid)) continue;
      notifiedUids.add(reviewer.uid);

      this.pushNotification({
        toUid: reviewer.uid,
        type: 'moderation_high_priority',
        title: 'High-Priority Post Report',
        body: `A post by ${post.authorName} received a high-priority report (${modCase.reportCount} total reports).`,
        refId: modCase.id,
        metadata: {
          caseId: modCase.id,
          postId: post.id,
          priority: modCase.highestPriority,
          audience: 'moderators'
        }
      });
    }
  }

  // ===========================================================================
  // 3. MODERATOR QUEUE, ACCESS CONTROL & CONCURRENCY
  // ===========================================================================

  private evaluateReviewerConflict(modCase: ModerationCase, actor: ModerationActor): { canAct: boolean; reason?: string } {
    if (!isModeratorRole(actor.role)) {
      return { canAct: false, reason: 'Only moderators and administrators can review reports.' };
    }
    // 1. A moderator/admin cannot act on reports about their own post
    if (modCase.postAuthorId === actor.uid) {
      return { canAct: false, reason: 'You cannot review reports filed against your own post.' };
    }
    // 2. If post author is a moderator or admin, ONLY an admin (other than the author) can handle it
    if (isModeratorRole(modCase.postAuthorRole) && !isAdminRole(actor.role)) {
      return {
        canAct: false,
        reason: 'Posts authored by moderators or administrators can only be reviewed by an Administrator.'
      };
    }
    // 3. Moderators can report posts like alumni, but they cannot review their own reports
    const caseReports = this.state.reports.filter((r) => r.caseId === modCase.id);
    if (caseReports.some((r) => r.reporterId === actor.uid)) {
      return {
        canAct: false,
        reason: 'Conflict of interest: you cannot review a case containing a report you submitted.'
      };
    }
    return { canAct: true };
  }

  public getPendingCountForModerator(actor: ModerationActor): number {
    if (!isModeratorRole(actor.role)) {
      throw new ModerationError(403, 'FORBIDDEN', 'Unauthorized role.');
    }
    return this.state.cases.filter((c) => {
      if (c.status !== 'pending' && c.status !== 'reviewed') return false;
      return this.evaluateReviewerConflict(c, actor).canAct;
    }).length;
  }

  public listModerationCases(
    actor: ModerationActor,
    query: {
      page?: number;
      pageSize?: number;
      status?: string;
      reason?: string;
      priority?: string;
      dateFrom?: string;
      dateTo?: string;
      sort?: 'priority' | 'most_reported' | 'newest';
      search?: string;
    }
  ): {
    cases: Array<
      ModerationCase & {
        reports: PostReport[];
        livePost: InstitutionalFeedPost | null;
        canAct: boolean;
        conflictReason?: string;
      }
    >;
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    pendingCount: number;
  } {
    if (!isModeratorRole(actor.role)) {
      throw new ModerationError(403, 'FORBIDDEN', 'Only moderators and administrators can view the moderation queue.');
    }

    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 10));
    const search = (query.search || '').toLowerCase().trim();

    const safeCases = (Array.isArray(this.state.cases) ? this.state.cases : []).map((rawCase) =>
      this.normalizeModCaseRecord(rawCase)
    );
    const safeReports = Array.isArray(this.state.reports) ? this.state.reports : [];

    let filtered = safeCases.filter((c) => {
      // Conflict-of-interest protection: if a moderator authored the post or reported it,
      // route to another reviewer (exclude from their actionable list, or mark inaccessible to them;
      // admins also cannot act on their own post/report).
      const conflict = this.evaluateReviewerConflict(c, actor);
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
      if (query.dateFrom) {
        const fromMs = new Date(query.dateFrom).getTime();
        const createdMs = new Date(c.createdAt || 0).getTime();
        if (Number.isFinite(fromMs) && createdMs < fromMs) return false;
      }
      if (query.dateTo) {
        const toMs = new Date(query.dateTo).getTime();
        const createdMs = new Date(c.createdAt || 0).getTime();
        if (Number.isFinite(toMs)) {
          const endOfDay = toMs + 24 * 60 * 60 * 1000 - 1;
          if (createdMs > endOfDay) return false;
        }
      }
      if (search) {
        const caseReportText = safeReports
          .filter((r) => r.caseId === c.id)
          .map((r) => `${r.reporterName || ''} ${r.reason || ''} ${r.details || ''}`)
          .join(' ');
        const text = `${c.postAuthorName || ''} ${c.contentSnapshot?.title || ''} ${c.contentSnapshot?.content || ''} ${c.id || ''} ${caseReportText}`.toLowerCase();
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
        return (new Date(b.updatedAt || b.createdAt || 0).getTime() || 0) - (new Date(a.updatedAt || a.createdAt || 0).getTime() || 0);
      }
      if (sortMode === 'most_reported') {
        if ((b.reportCount || 0) !== (a.reportCount || 0)) return (b.reportCount || 0) - (a.reportCount || 0);
        return (new Date(b.updatedAt || b.createdAt || 0).getTime() || 0) - (new Date(a.updatedAt || a.createdAt || 0).getTime() || 0);
      }
      return (new Date(b.createdAt || 0).getTime() || 0) - (new Date(a.createdAt || 0).getTime() || 0);
    });

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const sliced = filtered.slice((page - 1) * pageSize, page * pageSize);

    const enriched = sliced.map((c) => {
      const conflict = this.evaluateReviewerConflict(c, actor);
      const caseReports = safeReports.filter((r) => r.caseId === c.id);
      const livePost = (this.state.posts && this.state.posts[c.targetId]) || null;
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
      pendingCount: this.getPendingCountForModerator(actor)
    };
  }

  public getModerationCaseDetail(caseId: string, actor: ModerationActor) {
    if (!isModeratorRole(actor.role)) {
      throw new ModerationError(403, 'FORBIDDEN', 'Only moderators and administrators can inspect report cases.');
    }

    const rawCase = (Array.isArray(this.state.cases) ? this.state.cases : []).find((c) => c.id === caseId);
    if (!rawCase) {
      throw new ModerationError(404, 'CASE_NOT_FOUND', 'Moderation case not found.');
    }
    const modCase = this.normalizeModCaseRecord(rawCase);

    const conflict = this.evaluateReviewerConflict(modCase, actor);
    if (!conflict.canAct && !isAdminRole(actor.role)) {
      throw new ModerationError(403, 'CONFLICT_OF_INTEREST', conflict.reason || 'Conflict of interest.');
    }

    const reports = (Array.isArray(this.state.reports) ? this.state.reports : []).filter((r) => r.caseId === caseId);
    const livePost = (this.state.posts && this.state.posts[modCase.targetId]) || null;
    const authorWarnings = (Array.isArray(this.state.warnings) ? this.state.warnings : []).filter((w) => w.userId === modCase.postAuthorId);
    const appeals = (Array.isArray(this.state.appeals) ? this.state.appeals : []).filter((a) => a.caseId === caseId);
    const authorBanFlag = (this.state.flaggedForBanUsers && this.state.flaggedForBanUsers[modCase.postAuthorId]) || null;

    return {
      case: {
        ...modCase,
        contentEditedSinceSnapshot: livePost
          ? this.checkSnapshotDiffers(modCase.contentSnapshot, livePost)
          : modCase.contentEditedSinceSnapshot
      },
      livePost,
      reports,
      authorWarningHistory: authorWarnings,
      activeWarningsCount: authorWarnings.filter((w) => !w.overturned).length,
      authorBanFlag,
      appeals,
      canAct: conflict.canAct,
      conflictReason: conflict.reason
    };
  }

  public claimModerationCase(caseId: string, actor: ModerationActor): ModerationCase {
    if (!isModeratorRole(actor.role)) {
      throw new ModerationError(403, 'FORBIDDEN', 'Only moderators and administrators can claim cases.');
    }
    const modCase = this.state.cases.find((c) => c.id === caseId);
    if (!modCase) {
      throw new ModerationError(404, 'CASE_NOT_FOUND', 'Moderation case not found.');
    }
    if (['dismissed', 'action_taken', 'post_removed'].includes(modCase.status)) {
      throw new ModerationError(409, 'ALREADY_HANDLED', 'This report was already handled by another moderator.');
    }

    const conflict = this.evaluateReviewerConflict(modCase, actor);
    if (!conflict.canAct) {
      throw new ModerationError(403, 'CONFLICT_OF_INTEREST', conflict.reason || 'Conflict of interest.');
    }

    if (modCase.claimedBy && modCase.claimedBy !== actor.uid) {
      throw new ModerationError(409, 'CASE_CLAIMED', `Being reviewed by ${modCase.claimedByName || 'another moderator'}.`);
    }

    const now = new Date().toISOString();
    modCase.claimedBy = actor.uid;
    modCase.claimedByName = actor.name;
    modCase.claimedAt = now;
    if (modCase.status === 'pending') {
      modCase.status = 'reviewed';
    }
    modCase.updatedAt = now;

    this.appendAudit({
      action: 'CASE_CLAIMED',
      actorId: actor.uid,
      actorName: actor.name,
      actorRole: actor.role,
      targetType: modCase.targetType,
      postId: modCase.targetId,
      caseId: modCase.id,
      reportIds: [...modCase.reportIds],
      note: `Claimed for review by ${actor.name}`
    });

    this.persist();
    return modCase;
  }

  public releaseModerationCase(caseId: string, actor: ModerationActor): ModerationCase {
    if (!isModeratorRole(actor.role)) {
      throw new ModerationError(403, 'FORBIDDEN', 'Unauthorized.');
    }
    const modCase = this.state.cases.find((c) => c.id === caseId);
    if (!modCase) {
      throw new ModerationError(404, 'CASE_NOT_FOUND', 'Moderation case not found.');
    }
    if (['dismissed', 'action_taken', 'post_removed'].includes(modCase.status)) {
      throw new ModerationError(409, 'ALREADY_HANDLED', 'This report was already handled by another moderator.');
    }
    if (modCase.claimedBy && modCase.claimedBy !== actor.uid && !isAdminRole(actor.role)) {
      throw new ModerationError(403, 'NOT_CASE_OWNER', 'Only the claiming moderator or an administrator can release this case.');
    }

    modCase.claimedBy = undefined;
    modCase.claimedByName = undefined;
    modCase.claimedAt = undefined;
    modCase.status = 'pending';
    modCase.updatedAt = new Date().toISOString();

    this.appendAudit({
      action: 'CASE_RELEASED',
      actorId: actor.uid,
      actorName: actor.name,
      actorRole: actor.role,
      targetType: modCase.targetType,
      postId: modCase.targetId,
      caseId: modCase.id,
      reportIds: [...modCase.reportIds],
      note: 'Case claim released back to moderation queue.'
    });

    this.persist();
    return modCase;
  }

  // ===========================================================================
  // 4. MODERATOR ACTIONS, ESCALATION & ABUSE TRACKING
  // ===========================================================================

  public actOnModerationCase(
    caseId: string,
    actor: ModerationActor,
    payload: {
      action: ModerationActionType;
      message?: string;
      reason?: string;
      note?: string;
    }
  ): {
    case: ModerationCase;
    updatedReports: PostReport[];
    warning?: ModerationWarning;
    auditRecord?: ModerationAuditRecord | null;
    post?: InstitutionalFeedPost;
    autoSuspended?: boolean;
    flaggedForBan?: boolean;
  } {
    if (!isModeratorRole(actor.role)) {
      throw new ModerationError(403, 'FORBIDDEN', 'Only moderators and administrators can act on moderation cases.');
    }

    const modCase = this.state.cases.find((c) => c.id === caseId);
    if (!modCase) {
      throw new ModerationError(404, 'CASE_NOT_FOUND', 'Moderation case not found.');
    }

    // Strict Concurrency Control: reject any action on an already-resolved case
    if (['dismissed', 'action_taken', 'post_removed'].includes(modCase.status)) {
      throw new ModerationError(409, 'ALREADY_HANDLED', 'This report was already handled by another moderator.');
    }

    // Conflict-of-interest checks
    const conflict = this.evaluateReviewerConflict(modCase, actor);
    if (!conflict.canAct) {
      throw new ModerationError(403, 'CONFLICT_OF_INTEREST', conflict.reason || 'Conflict of interest.');
    }

    // If claimed by another moderator, block unless admin
    if (modCase.claimedBy && modCase.claimedBy !== actor.uid && !isAdminRole(actor.role)) {
      throw new ModerationError(
        409,
        'CASE_CLAIMED_BY_OTHER',
        `Being reviewed by ${modCase.claimedByName || 'another moderator'}.`
      );
    }

    const { action } = payload;
    if (!['dismiss', 'warn', 'delete_post'].includes(action)) {
      throw new ModerationError(400, 'INVALID_ACTION', 'Invalid moderation action.');
    }

    const sanitizedNote = payload.note ? sanitizeModerationText(payload.note, 500) : undefined;
    const sanitizedReason = payload.reason ? sanitizeModerationText(payload.reason, 200) : '';
    const sanitizedMessage = payload.message ? sanitizeModerationText(payload.message, 500) : '';
    const now = new Date().toISOString();

    const post = this.state.posts[modCase.targetId];
    const pendingReports = this.state.reports.filter(
      (r) => r.caseId === modCase.id && (r.status === 'pending' || r.status === 'reviewed')
    );
    const affectedReportIds = pendingReports.map((r) => r.id);

    let createdWarning: ModerationWarning | undefined;
    let autoSuspended = false;
    let flaggedForBan = false;

    if (action === 'dismiss') {
      modCase.status = 'dismissed';
      modCase.resolvedAction = 'dismiss';
      modCase.resolvedBy = actor.uid;
      modCase.resolvedByName = actor.name;
      modCase.resolvedByRole = actor.role;
      modCase.resolvedAt = now;
      modCase.resolutionNote = sanitizedNote;
      modCase.autoHiddenPendingReview = false;
      modCase.updatedAt = now;

      if (post) {
        post.underReviewAutoHidden = false;
        this.state.posts[post.id] = post;
      }

      for (const report of pendingReports) {
        report.status = 'dismissed';
        report.resolvedAt = now;
        report.resolvedBy = actor.uid;
        report.resolvedOutcome = 'no_violation';

        // Track dismissed reports per user for abuse prevention
        this.recordDismissedReportForAbuse(report.reporterId, report.reporterName);

        // Privacy-safe generic reporter feedback
        this.pushNotification({
          toUid: report.reporterId,
          type: 'moderation_report_resolved',
          title: 'Report Reviewed',
          body: 'We reviewed your report and found no violation',
          refId: modCase.targetId,
          metadata: { outcome: 'no_violation', targetType: 'post' }
        });
      }

      this.appendAudit({
        action: 'CASE_DISMISSED',
        actorId: actor.uid,
        actorName: actor.name,
        actorRole: actor.role,
        targetType: modCase.targetType,
        postId: modCase.targetId,
        caseId: modCase.id,
        reportIds: affectedReportIds,
        note: sanitizedNote || 'Reports dismissed with no policy violation.'
      });
    } else if (action === 'warn') {
      if (!sanitizedMessage || sanitizedMessage.length < 3) {
        throw new ModerationError(400, 'WARNING_MESSAGE_REQUIRED', 'A custom warning message for the author is required.');
      }
      const warningReason = sanitizedReason || Object.keys(modCase.reasonsSummary || {})[0] || 'Community policy violation';

      createdWarning = {
        id: `warn_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
        userId: modCase.postAuthorId,
        userName: modCase.postAuthorName,
        caseId: modCase.id,
        postId: modCase.targetId,
        targetType: modCase.targetType,
        issuedBy: actor.uid,
        issuedByName: actor.name,
        issuedByRole: actor.role,
        reason: warningReason,
        message: sanitizedMessage,
        note: sanitizedNote,
        overturned: false,
        createdAt: now
      };
      this.state.warnings.unshift(createdWarning);

      if (post) {
        post.flaggedByModerators = true;
        post.flaggedMessage = sanitizedMessage;
        post.underReviewAutoHidden = false;
        this.state.posts[post.id] = post;
      }

      modCase.status = 'action_taken';
      modCase.resolvedAction = 'warn';
      modCase.resolvedBy = actor.uid;
      modCase.resolvedByName = actor.name;
      modCase.resolvedByRole = actor.role;
      modCase.resolvedAt = now;
      modCase.resolutionNote = sanitizedNote;
      modCase.autoHiddenPendingReview = false;
      modCase.updatedAt = now;

      for (const report of pendingReports) {
        report.status = 'action_taken';
        report.resolvedAt = now;
        report.resolvedBy = actor.uid;
        report.resolvedOutcome = 'action_taken';

        this.resetConsecutiveDismissedCount(report.reporterId);

        this.pushNotification({
          toUid: report.reporterId,
          type: 'moderation_report_resolved',
          title: 'Report Reviewed',
          body: 'We reviewed your report and took action',
          refId: modCase.targetId,
          metadata: { outcome: 'action_taken', targetType: 'post' }
        });
      }

      this.appendAudit({
        action: 'POST_WARNED',
        actorId: actor.uid,
        actorName: actor.name,
        actorRole: actor.role,
        targetType: modCase.targetType,
        postId: modCase.targetId,
        caseId: modCase.id,
        reportIds: affectedReportIds,
        targetUserId: modCase.postAuthorId,
        note: sanitizedNote || sanitizedMessage,
        metadata: { warningId: createdWarning.id, reason: warningReason }
      });

      // Notify post author (NEVER include reporter identity)
      this.pushNotification({
        toUid: modCase.postAuthorId,
        type: 'moderation_warning',
        title: 'Post Moderation Warning',
        body: `Your post received a moderator warning (${warningReason}): "${sanitizedMessage}"`,
        refId: modCase.targetId,
        metadata: {
          caseId: modCase.id,
          postId: modCase.targetId,
          warningId: createdWarning.id,
          reason: warningReason,
          moderatorMessage: sanitizedMessage
        }
      });

      void this.dispatchModerationEmail(
        modCase.postAuthorId,
        "St. Cecilia's Alumni Network — Post Moderation Warning",
        `Your post "${post?.title || 'Alumni Post'}" received a warning for: ${warningReason}. Moderator message: ${sanitizedMessage}`,
        'Community Moderation Notice'
      );

      // Evaluate escalation thresholds
      const escalation = this.evaluateWarningEscalation(modCase.postAuthorId, actor);
      autoSuspended = escalation.autoSuspended;
      flaggedForBan = escalation.flaggedForBan;
    } else if (action === 'delete_post') {
      const deletionReason = sanitizedReason || sanitizedMessage || Object.keys(modCase.reasonsSummary || {})[0] || 'Policy violation';
      if (deletionReason.length < 3) {
        throw new ModerationError(400, 'DELETION_REASON_REQUIRED', 'A reason for removing this post is required.');
      }

      if (post) {
        post.isSoftDeleted = true;
        post.softDeletedAt = now;
        post.softDeletedBy = actor.uid;
        post.softDeletionReason = deletionReason;
        post.underReviewAutoHidden = false;
        this.state.posts[post.id] = post;
      }

      modCase.status = 'action_taken';
      modCase.resolvedAction = 'delete_post';
      modCase.resolvedBy = actor.uid;
      modCase.resolvedByName = actor.name;
      modCase.resolvedByRole = actor.role;
      modCase.resolvedAt = now;
      modCase.resolutionNote = sanitizedNote || deletionReason;
      modCase.autoHiddenPendingReview = false;
      modCase.updatedAt = now;

      for (const report of pendingReports) {
        report.status = 'action_taken';
        report.resolvedAt = now;
        report.resolvedBy = actor.uid;
        report.resolvedOutcome = 'action_taken';

        this.resetConsecutiveDismissedCount(report.reporterId);

        this.pushNotification({
          toUid: report.reporterId,
          type: 'moderation_report_resolved',
          title: 'Report Reviewed',
          body: 'We reviewed your report and took action',
          refId: modCase.targetId,
          metadata: { outcome: 'action_taken', targetType: 'post' }
        });
      }

      this.appendAudit({
        action: 'POST_SOFT_DELETED',
        actorId: actor.uid,
        actorName: actor.name,
        actorRole: actor.role,
        targetType: modCase.targetType,
        postId: modCase.targetId,
        caseId: modCase.id,
        reportIds: affectedReportIds,
        targetUserId: modCase.postAuthorId,
        note: sanitizedNote || deletionReason,
        metadata: { reason: deletionReason }
      });

      const authorMsg = sanitizedMessage
        ? `Your post was removed (${deletionReason}). Moderator note: "${sanitizedMessage}"`
        : `Your post was removed for violating community standards (${deletionReason}).`;

      this.pushNotification({
        toUid: modCase.postAuthorId,
        type: 'moderation_deletion',
        title: 'Post Removed by Moderation',
        body: authorMsg,
        refId: modCase.targetId,
        metadata: {
          caseId: modCase.id,
          postId: modCase.targetId,
          reason: deletionReason,
          moderatorMessage: sanitizedMessage || deletionReason
        }
      });

      void this.dispatchModerationEmail(
        modCase.postAuthorId,
        "St. Cecilia's Alumni Network — Post Removed",
        authorMsg,
        'Post Removal Notice'
      );
    }

    this.persist();
    return {
      case: this.normalizeModCaseRecord(modCase),
      updatedReports: pendingReports.map((r) => ({ ...r })),
      warning: createdWarning,
      auditRecord: this.getLatestAuditRecordForCase(modCase.id, modCase.targetId),
      post: this.state.posts[modCase.targetId],
      autoSuspended,
      flaggedForBan
    };
  }

  private evaluateWarningEscalation(userId: string, actor: ModerationActor): { autoSuspended: boolean; flaggedForBan: boolean } {
    const activeWarnings = this.state.warnings.filter((w) => w.userId === userId && !w.overturned).length;
    let autoSuspended = false;
    let flaggedForBan = false;

    const targetUser = this.accountAdapter?.getUserByUid(userId);
    const currentlySuspended = (targetUser?.accountStatus || '').toUpperCase() === 'SUSPENDED';

    if (activeWarnings >= this.state.config.warningSuspensionThreshold && !currentlySuspended) {
      const start = new Date();
      const end = new Date(start.getTime() + this.state.config.suspensionDurationDays * 24 * 60 * 60 * 1000);
      const reason = `Automatic ${this.state.config.suspensionDurationDays}-day suspension triggered after ${activeWarnings} moderation warnings.`;

      this.accountAdapter?.updateUserSuspension(userId, {
        accountStatus: 'SUSPENDED',
        reason,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        isPermanentLock: false,
        actorId: 'system_escalation',
        actorName: 'Automated Escalation Policy',
        actorRole: 'system'
      });

      this.appendAudit({
        action: 'USER_AUTO_SUSPENDED_WARNINGS',
        actorId: actor.uid,
        actorName: actor.name,
        actorRole: actor.role,
        targetType: 'user',
        targetUserId: userId,
        reportIds: [],
        note: reason,
        metadata: { activeWarnings, durationDays: this.state.config.suspensionDurationDays }
      });

      this.pushNotification({
        toUid: userId,
        type: 'security',
        title: 'Temporary Suspension Applied',
        body: reason,
        metadata: { suspensionEndDate: end.toISOString(), activeWarnings }
      });

      autoSuspended = true;
    }

    if (activeWarnings >= this.state.config.banReviewThreshold) {
      this.state.flaggedForBanUsers[userId] = {
        userId,
        flaggedAt: new Date().toISOString(),
        activeWarnings,
        reason: `User reached ${activeWarnings} active warnings (post-suspension threshold). Admin review required for ban.`
      };
      this.appendAudit({
        action: 'USER_FLAGGED_FOR_BAN',
        actorId: 'system',
        actorName: 'Automated Escalation Policy',
        actorRole: 'system',
        targetType: 'user',
        targetUserId: userId,
        reportIds: [],
        note: this.state.flaggedForBanUsers[userId].reason
      });

      // Alert Admins
      const admins = (this.accountAdapter?.getModeratorsAndAdmins() || []).filter((u) => isAdminRole(u.role));
      for (const admin of admins) {
        this.pushNotification({
          toUid: admin.uid,
          type: 'moderation_abuse_alert',
          title: 'Account Flagged for Ban Review',
          body: `User ${userId} reached ${activeWarnings} warnings and requires Admin review for permanent ban.`,
          refId: userId,
          metadata: { targetUserId: userId, activeWarnings }
        });
      }
      flaggedForBan = true;
    }

    return { autoSuspended, flaggedForBan };
  }

  private resetConsecutiveDismissedCount(reporterId: string): void {
    const tracker = this.state.reporterTracking[reporterId];
    if (tracker) {
      tracker.consecutiveDismissedCount = 0;
    }
  }

  private recordDismissedReportForAbuse(reporterId: string, reporterName?: string): void {
    const tracker = this.state.reporterTracking[reporterId] || {
      userId: reporterId,
      userName: reporterName,
      consecutiveDismissedCount: 0,
      totalDismissedCount: 0,
      totalReportsCount: 1,
      flaggedAbusiveReporter: false,
      reportingRestricted: false
    };
    tracker.consecutiveDismissedCount += 1;
    tracker.totalDismissedCount += 1;

    if (
      !tracker.flaggedAbusiveReporter &&
      tracker.consecutiveDismissedCount >= this.state.config.dismissedReporterThreshold
    ) {
      const now = new Date().toISOString();
      tracker.flaggedAbusiveReporter = true;
      tracker.flaggedAt = now;
      tracker.warningIssuedAt = now;

      this.pushNotification({
        toUid: reporterId,
        type: 'moderation_abuse_alert',
        title: 'Reporting Policy Reminder',
        body: `Your last ${tracker.consecutiveDismissedCount} post reports were dismissed with no violation found. Continued misuse of the reporting system may result in reporting restrictions.`,
        metadata: { consecutiveDismissedCount: tracker.consecutiveDismissedCount }
      });

      this.appendAudit({
        action: 'REPORTER_FLAGGED_ABUSIVE',
        actorId: 'system',
        actorName: 'Abuse Prevention Engine',
        actorRole: 'system',
        targetType: 'user',
        targetUserId: reporterId,
        reportIds: [],
        note: `Reporter flagged after ${tracker.consecutiveDismissedCount} consecutive dismissed reports.`
      });

      const reviewers = this.accountAdapter?.getModeratorsAndAdmins() || [];
      for (const rev of reviewers) {
        this.pushNotification({
          toUid: rev.uid,
          type: 'moderation_abuse_alert',
          title: 'Abusive Reporting Pattern Flagged',
          body: `${reporterName || reporterId} has ${tracker.consecutiveDismissedCount} consecutive dismissed reports.`,
          refId: reporterId,
          metadata: { reporterId, consecutiveDismissedCount: tracker.consecutiveDismissedCount }
        });
      }
    }

    this.state.reporterTracking[reporterId] = tracker;
  }

  // ===========================================================================
  // 5. ADMIN OVERRIDE, RESTORE & SANCTION CONTROLS
  // ===========================================================================

  public overrideModerationDecision(
    caseId: string,
    adminActor: ModerationActor,
    payload: { newDecision: 'dismiss' | 'restore_post' | 'overturn_warning' | 'delete_post'; note: string }
  ): ModerationCase {
    if (!isAdminRole(adminActor.role)) {
      throw new ModerationError(403, 'ADMIN_REQUIRED', 'Only Administrators can override a moderator decision.');
    }
    const cleanNote = sanitizeModerationText(payload.note || '', 500);
    if (!cleanNote || cleanNote.length < 5) {
      throw new ModerationError(400, 'OVERRIDE_NOTE_REQUIRED', 'An administrative note (min 5 characters) is required to override a decision.');
    }

    const modCase = this.state.cases.find((c) => c.id === caseId);
    if (!modCase) {
      throw new ModerationError(404, 'CASE_NOT_FOUND', 'Moderation case not found.');
    }
    if (modCase.postAuthorId === adminActor.uid) {
      throw new ModerationError(403, 'CONFLICT_OF_INTEREST', 'Administrators cannot override cases involving their own posts.');
    }

    const now = new Date().toISOString();
    const post = this.state.posts[modCase.targetId];

    if (payload.newDecision === 'restore_post' || payload.newDecision === 'dismiss' || payload.newDecision === 'overturn_warning') {
      if (post) {
        post.isSoftDeleted = false;
        post.softDeletedAt = undefined;
        post.softDeletedBy = undefined;
        post.softDeletionReason = undefined;
        post.flaggedByModerators = false;
        post.flaggedMessage = undefined;
        post.underReviewAutoHidden = false;
        this.state.posts[post.id] = post;
      }

      // Overturn any warnings linked to this case so they do not count toward escalation
      for (const warning of this.state.warnings) {
        if (warning.caseId === modCase.id && !warning.overturned) {
          warning.overturned = true;
          warning.overturnedAt = now;
          warning.overturnedBy = adminActor.uid;
          warning.overturnedByName = adminActor.name;
          warning.overturnedNote = cleanNote;
        }
      }

      modCase.status = 'dismissed';
      modCase.resolvedAction = 'admin_override';
    } else if (payload.newDecision === 'delete_post') {
      if (post) {
        post.isSoftDeleted = true;
        post.softDeletedAt = now;
        post.softDeletedBy = adminActor.uid;
        post.softDeletionReason = cleanNote;
        post.underReviewAutoHidden = false;
        this.state.posts[post.id] = post;
      }
      modCase.status = 'action_taken';
      modCase.resolvedAction = 'admin_override';
    }

    modCase.overriddenBy = adminActor.uid;
    modCase.overriddenByName = adminActor.name;
    modCase.overriddenAt = now;
    modCase.overrideNote = cleanNote;
    modCase.updatedAt = now;

    this.appendAudit({
      action: 'ADMIN_DECISION_OVERRIDE',
      actorId: adminActor.uid,
      actorName: adminActor.name,
      actorRole: adminActor.role,
      targetType: modCase.targetType,
      postId: modCase.targetId,
      caseId: modCase.id,
      reportIds: [...modCase.reportIds],
      targetUserId: modCase.postAuthorId,
      note: cleanNote,
      metadata: { newDecision: payload.newDecision }
    });

    this.pushNotification({
      toUid: modCase.postAuthorId,
      type: 'moderation_appeal',
      title: 'Administrative Moderation Review Update',
      body: `An Administrator reviewed your post moderation case: ${cleanNote}`,
      refId: modCase.targetId,
      metadata: { caseId: modCase.id, decision: payload.newDecision }
    });

    this.persist();
    return modCase;
  }

  public restoreSoftDeletedPost(postId: string, actor: ModerationActor, note: string, adminApprovalGranted = false): InstitutionalFeedPost {
    if (!isAdminRole(actor.role) && !(isModeratorRole(actor.role) && adminApprovalGranted)) {
      throw new ModerationError(
        403,
        'ADMIN_APPROVAL_REQUIRED',
        'Restoring a soft-deleted post requires Administrator approval.'
      );
    }
    const post = this.state.posts[postId];
    if (!post) {
      throw new ModerationError(404, 'POST_NOT_FOUND', 'Post not found.');
    }
    if (post.authorId === actor.uid) {
      throw new ModerationError(403, 'CONFLICT_OF_INTEREST', 'You cannot restore your own moderated post.');
    }

    const cleanNote = sanitizeModerationText(note || 'Post restored after moderation reversal.', 500);
    post.isSoftDeleted = false;
    post.softDeletedAt = undefined;
    post.softDeletedBy = undefined;
    post.softDeletionReason = undefined;
    post.underReviewAutoHidden = false;
    this.state.posts[postId] = post;

    this.appendAudit({
      action: 'POST_RESTORED',
      actorId: actor.uid,
      actorName: actor.name,
      actorRole: actor.role,
      targetType: 'post',
      postId,
      reportIds: [],
      targetUserId: post.authorId,
      note: cleanNote
    });

    this.persist();
    return this.projectPostForViewer(post, actor);
  }

  public applyOrLiftSanction(
    adminActor: ModerationActor,
    targetUserId: string,
    payload: {
      action: 'suspend' | 'ban' | 'lift_sanction' | 'restrict_reporting' | 'unrestrict_reporting';
      reason?: string;
      durationDays?: number;
    }
  ) {
    if (!isAdminRole(adminActor.role)) {
      throw new ModerationError(403, 'ADMIN_REQUIRED', 'Only Administrators can apply or lift suspensions, bans, or reporting restrictions.');
    }
    if (targetUserId === adminActor.uid) {
      throw new ModerationError(400, 'SELF_ACTION_BLOCKED', 'Administrators cannot sanction their own account.');
    }

    const cleanReason = sanitizeModerationText(payload.reason || 'Administrative governance decision', 500);
    const now = new Date().toISOString();

    if (payload.action === 'suspend') {
      const days = Math.max(1, Math.min(365, Number(payload.durationDays) || this.state.config.suspensionDurationDays));
      const end = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
      this.accountAdapter?.updateUserSuspension(targetUserId, {
        accountStatus: 'SUSPENDED',
        reason: cleanReason,
        startDate: now,
        endDate: end,
        isPermanentLock: false,
        actorId: adminActor.uid,
        actorName: adminActor.name,
        actorRole: adminActor.role
      });
      this.appendAudit({
        action: 'USER_SUSPENDED',
        actorId: adminActor.uid,
        actorName: adminActor.name,
        actorRole: adminActor.role,
        targetType: 'user',
        targetUserId,
        reportIds: [],
        note: `${cleanReason} (${days} days)`
      });
    } else if (payload.action === 'ban') {
      this.accountAdapter?.updateUserSuspension(targetUserId, {
        accountStatus: 'LOCKED',
        reason: cleanReason,
        startDate: now,
        isPermanentLock: true,
        actorId: adminActor.uid,
        actorName: adminActor.name,
        actorRole: adminActor.role
      });
      delete this.state.flaggedForBanUsers[targetUserId];
      this.appendAudit({
        action: 'USER_BANNED',
        actorId: adminActor.uid,
        actorName: adminActor.name,
        actorRole: adminActor.role,
        targetType: 'user',
        targetUserId,
        reportIds: [],
        note: cleanReason
      });
    } else if (payload.action === 'lift_sanction') {
      this.accountAdapter?.updateUserSuspension(targetUserId, {
        accountStatus: 'ACTIVE',
        reason: cleanReason,
        actorId: adminActor.uid,
        actorName: adminActor.name,
        actorRole: adminActor.role
      });
      delete this.state.flaggedForBanUsers[targetUserId];
      this.appendAudit({
        action: 'USER_SANCTION_LIFTED',
        actorId: adminActor.uid,
        actorName: adminActor.name,
        actorRole: adminActor.role,
        targetType: 'user',
        targetUserId,
        reportIds: [],
        note: cleanReason
      });
    } else if (payload.action === 'restrict_reporting') {
      const tracker = this.state.reporterTracking[targetUserId] || {
        userId: targetUserId,
        consecutiveDismissedCount: 0,
        totalDismissedCount: 0,
        totalReportsCount: 0,
        flaggedAbusiveReporter: true,
        reportingRestricted: true
      };
      tracker.reportingRestricted = true;
      tracker.restrictedAt = now;
      tracker.restrictedBy = adminActor.uid;
      tracker.restrictionReason = cleanReason;
      this.state.reporterTracking[targetUserId] = tracker;

      this.appendAudit({
        action: 'REPORTER_RESTRICTED',
        actorId: adminActor.uid,
        actorName: adminActor.name,
        actorRole: adminActor.role,
        targetType: 'user',
        targetUserId,
        reportIds: [],
        note: cleanReason
      });
    } else if (payload.action === 'unrestrict_reporting') {
      const tracker = this.state.reporterTracking[targetUserId];
      if (tracker) {
        tracker.reportingRestricted = false;
        tracker.consecutiveDismissedCount = 0;
        tracker.flaggedAbusiveReporter = false;
        tracker.restrictionReason = undefined;
      }
      this.appendAudit({
        action: 'REPORTER_UNRESTRICTED',
        actorId: adminActor.uid,
        actorName: adminActor.name,
        actorRole: adminActor.role,
        targetType: 'user',
        targetUserId,
        reportIds: [],
        note: cleanReason
      });
    }

    this.persist();
    return { success: true };
  }

  // ===========================================================================
  // 6. APPEALS WORKFLOW
  // ===========================================================================

  public submitAppeal(
    actor: ModerationActor,
    payload: { postId: string; explanation: string }
  ): ModerationAppeal {
    const post = this.state.posts[payload.postId];
    if (!post) {
      throw new ModerationError(404, 'POST_NOT_FOUND', 'Post not found.');
    }
    if (post.authorId !== actor.uid) {
      throw new ModerationError(403, 'FORBIDDEN', 'Only the post author can appeal a moderation decision.');
    }

    const explanation = sanitizeModerationText(payload.explanation || '', 500);
    if (!explanation || explanation.length < 5) {
      throw new ModerationError(400, 'EXPLANATION_REQUIRED', 'Please provide an explanation (5–500 characters) for your appeal.');
    }

    // Determine eligible action (warning or soft-deletion)
    const modCase = this.state.cases.find(
      (c) =>
        c.targetType === 'post' &&
        c.targetId === payload.postId &&
        (c.resolvedAction === 'warn' || c.resolvedAction === 'delete_post')
    );

    if (!modCase || !modCase.resolvedBy) {
      throw new ModerationError(400, 'NOT_APPEALABLE', 'This post does not have a warning or deletion eligible for appeal.');
    }

    // One-time appeal limit per post
    const existingAppeal = this.state.appeals.find((a) => a.postId === payload.postId && a.authorId === actor.uid);
    if (existingAppeal) {
      throw new ModerationError(409, 'APPEAL_ALREADY_SUBMITTED', 'You have already submitted an appeal for this post.');
    }

    const linkedWarning = this.state.warnings.find((w) => w.caseId === modCase.id && w.postId === payload.postId);

    const appeal: ModerationAppeal = {
      id: `app_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      postId: payload.postId,
      caseId: modCase.id,
      warningId: linkedWarning?.id,
      actionType: modCase.resolvedAction === 'delete_post' ? 'deletion' : 'warning',
      authorId: actor.uid,
      authorName: actor.name,
      postAuthorRole: post.authorRole || 'alumni',
      explanation,
      originalModeratorId: modCase.resolvedBy,
      originalModeratorName: modCase.resolvedByName || 'Moderator',
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    this.state.appeals.unshift(appeal);

    this.appendAudit({
      action: 'APPEAL_SUBMITTED',
      actorId: actor.uid,
      actorName: actor.name,
      actorRole: actor.role,
      targetType: 'post',
      postId: payload.postId,
      caseId: modCase.id,
      reportIds: [],
      note: explanation
    });

    // Notify eligible reviewers (NOT the original moderator!)
    const reviewers = this.accountAdapter?.getModeratorsAndAdmins() || [];
    for (const rev of reviewers) {
      if (rev.uid === appeal.originalModeratorId || rev.uid === appeal.authorId) continue;
      if (isModeratorRole(appeal.postAuthorRole) && !isAdminRole(rev.role)) continue;
      this.pushNotification({
        toUid: rev.uid,
        type: 'moderation_appeal',
        title: 'New Moderation Appeal Submitted',
        body: `${actor.name} appealed a ${appeal.actionType} decision.`,
        refId: appeal.id,
        metadata: { appealId: appeal.id, postId: payload.postId }
      });
    }

    this.persist();
    return appeal;
  }

  public listAppeals(actor: ModerationActor) {
    if (isModeratorRole(actor.role)) {
      return this.state.appeals.map((appeal) => {
        const canReview =
          appeal.authorId !== actor.uid &&
          appeal.originalModeratorId !== actor.uid &&
          (!isModeratorRole(appeal.postAuthorRole) || isAdminRole(actor.role));
        return {
          ...appeal,
          canReview,
          conflictReason: !canReview
            ? appeal.originalModeratorId === actor.uid
              ? 'Appeals must be reviewed by a different moderator or administrator.'
              : 'Requires another eligible administrator.'
            : undefined
        };
      });
    }
    return this.state.appeals.filter((a) => a.authorId === actor.uid);
  }

  public resolveAppeal(
    appealId: string,
    reviewer: ModerationActor,
    payload: { outcome: 'uphold' | 'reverse'; note?: string }
  ): ModerationAppeal {
    if (!isModeratorRole(reviewer.role)) {
      throw new ModerationError(403, 'FORBIDDEN', 'Only moderators and administrators can resolve appeals.');
    }

    const appeal = this.state.appeals.find((a) => a.id === appealId);
    if (!appeal) {
      throw new ModerationError(404, 'APPEAL_NOT_FOUND', 'Appeal not found.');
    }
    if (appeal.status !== 'pending') {
      throw new ModerationError(409, 'APPEAL_ALREADY_RESOLVED', 'This appeal has already been resolved.');
    }
    if (appeal.authorId === reviewer.uid) {
      throw new ModerationError(403, 'CONFLICT_OF_INTEREST', 'You cannot resolve your own appeal.');
    }
    if (appeal.originalModeratorId === reviewer.uid) {
      throw new ModerationError(
        403,
        'SAME_MODERATOR_BLOCKED',
        'Appeals must be reviewed by a different moderator or administrator than the original decision-maker.'
      );
    }
    if (isModeratorRole(appeal.postAuthorRole) && !isAdminRole(reviewer.role)) {
      throw new ModerationError(403, 'ADMIN_REQUIRED', 'Appeals by moderators or admins must be resolved by another Administrator.');
    }
    if (!['uphold', 'reverse'].includes(payload.outcome)) {
      throw new ModerationError(400, 'INVALID_OUTCOME', 'Outcome must be either uphold or reverse.');
    }

    const now = new Date().toISOString();
    const cleanNote = payload.note ? sanitizeModerationText(payload.note, 500) : undefined;

    appeal.status = payload.outcome === 'reverse' ? 'reversed' : 'upheld';
    appeal.reviewedBy = reviewer.uid;
    appeal.reviewedByName = reviewer.name;
    appeal.reviewedByRole = reviewer.role;
    appeal.decisionNote = cleanNote;
    appeal.resolvedAt = now;

    if (payload.outcome === 'reverse') {
      const post = this.state.posts[appeal.postId];
      if (post) {
        post.isSoftDeleted = false;
        post.softDeletedAt = undefined;
        post.softDeletedBy = undefined;
        post.softDeletionReason = undefined;
        post.flaggedByModerators = false;
        post.flaggedMessage = undefined;
        post.underReviewAutoHidden = false;
        this.state.posts[post.id] = post;
      }

      // Overturn linked warning so it no longer counts toward escalation
      for (const w of this.state.warnings) {
        if ((appeal.warningId && w.id === appeal.warningId) || (w.caseId === appeal.caseId && w.postId === appeal.postId)) {
          w.overturned = true;
          w.overturnedAt = now;
          w.overturnedBy = reviewer.uid;
          w.overturnedByName = reviewer.name;
          w.overturnedNote = cleanNote || 'Overturned on appeal';
        }
      }

      const modCase = this.state.cases.find((c) => c.id === appeal.caseId);
      if (modCase) {
        modCase.status = 'dismissed';
        modCase.updatedAt = now;
      }

      this.appendAudit({
        action: 'APPEAL_REVERSED',
        actorId: reviewer.uid,
        actorName: reviewer.name,
        actorRole: reviewer.role,
        targetType: 'post',
        postId: appeal.postId,
        caseId: appeal.caseId,
        reportIds: [],
        targetUserId: appeal.authorId,
        note: cleanNote || 'Appeal granted and original moderation decision reversed.'
      });

      const msg = 'Your appeal was approved. Your post has been restored and the moderation action has been overturned.';
      this.pushNotification({
        toUid: appeal.authorId,
        type: 'moderation_appeal',
        title: 'Appeal Approved — Decision Reversed',
        body: cleanNote ? `${msg} Note: "${cleanNote}"` : msg,
        refId: appeal.postId,
        metadata: { appealId: appeal.id, outcome: 'reversed' }
      });

      void this.dispatchModerationEmail(
        appeal.authorId,
        "St. Cecilia's Alumni Network — Appeal Approved",
        msg,
        'Appeal Decision'
      );
    } else {
      this.appendAudit({
        action: 'APPEAL_UPHELD',
        actorId: reviewer.uid,
        actorName: reviewer.name,
        actorRole: reviewer.role,
        targetType: 'post',
        postId: appeal.postId,
        caseId: appeal.caseId,
        reportIds: [],
        targetUserId: appeal.authorId,
        note: cleanNote || 'Original moderation decision upheld on appeal.'
      });

      const msg = 'Your appeal was reviewed and the original moderation decision was upheld.';
      this.pushNotification({
        toUid: appeal.authorId,
        type: 'moderation_appeal',
        title: 'Appeal Reviewed — Decision Upheld',
        body: cleanNote ? `${msg} Note: "${cleanNote}"` : msg,
        refId: appeal.postId,
        metadata: { appealId: appeal.id, outcome: 'upheld' }
      });

      void this.dispatchModerationEmail(
        appeal.authorId,
        "St. Cecilia's Alumni Network — Appeal Decision",
        msg,
        'Appeal Decision'
      );
    }

    this.persist();
    return appeal;
  }

  // ===========================================================================
  // 7. AUDIT LOGS, ABUSE REPORTS, CONFIG & NOTIFICATIONS
  // ===========================================================================

  public getAuditLogs(actor: ModerationActor): ModerationAuditRecord[] {
    if (!isSuperAdminRole(actor.role)) {
      throw new ModerationError(403, 'SUPERADMIN_REQUIRED', 'System audit logs are restricted to the Super Administrator.');
    }
    return [...this.state.auditLogs];
  }

  public getReporterTrackingList(actor: ModerationActor): AbuseReporterTracking[] {
    if (!isModeratorRole(actor.role)) {
      throw new ModerationError(403, 'FORBIDDEN', 'Unauthorized.');
    }
    return Object.values(this.state.reporterTracking).sort((a, b) => b.consecutiveDismissedCount - a.consecutiveDismissedCount);
  }

  public getFlaggedBanUsers(actor: ModerationActor) {
    if (!isAdminRole(actor.role)) {
      throw new ModerationError(403, 'FORBIDDEN', 'Only administrators can view ban review flags.');
    }
    return Object.values(this.state.flaggedForBanUsers);
  }

  public getConfig(actor: ModerationActor): ModerationConfig {
    if (!isModeratorRole(actor.role)) {
      throw new ModerationError(403, 'FORBIDDEN', 'Unauthorized.');
    }
    return { ...this.state.config };
  }

  public updateConfig(actor: ModerationActor, updates: Partial<ModerationConfig>): ModerationConfig {
    if (!isAdminRole(actor.role)) {
      throw new ModerationError(403, 'ADMIN_REQUIRED', 'Only Administrators can modify moderation policy thresholds.');
    }

    const clampInt = (val: unknown, fallback: number, min: number, max: number) => {
      if (val === undefined) return fallback;
      const num = Math.floor(Number(val));
      if (!Number.isFinite(num) || num < min || num > max) {
        throw new ModerationError(400, 'INVALID_CONFIG_VALUE', `Configuration values must be integers between ${min} and ${max}.`);
      }
      return num;
    };

    const next: ModerationConfig = {
      warningSuspensionThreshold: clampInt(updates.warningSuspensionThreshold, this.state.config.warningSuspensionThreshold, 1, 20),
      suspensionDurationDays: clampInt(updates.suspensionDurationDays, this.state.config.suspensionDurationDays, 1, 365),
      banReviewThreshold: clampInt(updates.banReviewThreshold, this.state.config.banReviewThreshold, 2, 30),
      dismissedReporterThreshold: clampInt(updates.dismissedReporterThreshold, this.state.config.dismissedReporterThreshold, 2, 50),
      autoFlagReportThreshold: clampInt(updates.autoFlagReportThreshold, this.state.config.autoFlagReportThreshold, 2, 50),
      autoHideHarassmentThreshold: clampInt(updates.autoHideHarassmentThreshold, this.state.config.autoHideHarassmentThreshold, 2, 25),
      maxReportsPerHour: clampInt(updates.maxReportsPerHour, this.state.config.maxReportsPerHour, 1, 100),
      profileTimelineEnabled:
        updates.profileTimelineEnabled !== undefined
          ? Boolean(updates.profileTimelineEnabled)
          : this.state.config.profileTimelineEnabled ?? true
    };

    this.state.config = next;

    this.appendAudit({
      action: 'MODERATION_CONFIG_UPDATED',
      actorId: actor.uid,
      actorName: actor.name,
      actorRole: actor.role,
      targetType: 'config',
      reportIds: [],
      note: 'Moderation escalation & abuse prevention thresholds updated.',
      metadata: { ...next }
    });

    this.persist();
    return { ...next };
  }

  public getPublicFeatureConfig(): { profileTimelineEnabled: boolean; feedSortMode: FeedSortMode } {
    return {
      profileTimelineEnabled: this.state.config.profileTimelineEnabled ?? true,
      feedSortMode: this.state.feedConfig?.sortMode || DEFAULT_FEED_CONFIG.sortMode
    };
  }

  public getLegacyAuditReport() {
    return { ...this.state.legacyAuditReport };
  }

  public getNotificationsForUser(actor: ModerationActor): AppNotification[] {
    // Strict privacy: Only return notifications explicitly addressed to this user!
    // Never include any reporterId or reporterName inside author notifications.
    return this.state.notifications
      .filter((n) => n.toUid === actor.uid)
      .map((n) => ({ ...n }));
  }

  public markNotificationRead(actor: ModerationActor, notificationId: string): boolean {
    const found = this.state.notifications.find((n) => n.id === notificationId && n.toUid === actor.uid);
    if (!found) return false;
    found.read = true;
    this.persist();
    return true;
  }

  public getMyWarnings(actor: ModerationActor): ModerationWarning[] {
    return this.state.warnings
      .filter((w) => w.userId === actor.uid)
      .map((w) => ({
        ...w,
        // Never leak internal moderator notes to the author
        note: undefined
      }));
  }

  public syncModerationStateFromCloud(
    actor: ModerationActor,
    payload: {
      cases?: Partial<ModerationCase>[];
      reports?: Partial<PostReport>[];
      warnings?: Partial<ModerationWarning>[];
      auditLogs?: Partial<ModerationAuditRecord>[];
      reporterTracking?: Partial<AbuseReporterTracking>[];
      posts?: Partial<InstitutionalFeedPost>[];
    }
  ): {
    casesCount: number;
    reportsCount: number;
    warningsCount: number;
    auditLogsCount: number;
    syncedAt: string;
    cases: ModerationCase[];
    reports: PostReport[];
    warnings: ModerationWarning[];
    auditLogs: ModerationAuditRecord[];
    reporterTracking: AbuseReporterTracking[];
  } {
    if (!isModeratorRole(actor.role)) {
      throw new ModerationError(403, 'FORBIDDEN', 'Only moderators and administrators can synchronize moderation state.');
    }

    const toMs = (iso?: string) => {
      if (!iso) return 0;
      const t = new Date(iso).getTime();
      return Number.isFinite(t) ? t : 0;
    };
    const isResolvedStatus = (st?: string) =>
      st === 'dismissed' || st === 'action_taken' || st === 'post_removed';

    // 1. Merge Posts first so cases can enrich snapshots
    if (Array.isArray(payload.posts)) {
      for (const rawPost of payload.posts.slice(0, 300)) {
        if (!rawPost?.id) continue;
        const existingPost = this.state.posts[rawPost.id];
        if (!existingPost) {
          this.state.posts[rawPost.id] = {
            ...(rawPost as InstitutionalFeedPost),
            id: rawPost.id,
            authorId: rawPost.authorId || 'unknown_author',
            authorName: rawPost.authorName || 'Cecilian Member',
            authorRole: (rawPost.authorRole as UserRole) || 'alumni',
            authorAvatar: rawPost.authorAvatar || '',
            postType: (rawPost.postType as InstitutionalFeedPost['postType']) || 'update',
            title: rawPost.title || '',
            content: rawPost.content || '',
            likes: Array.isArray(rawPost.likes) ? rawPost.likes : [],
            hearts: Array.isArray(rawPost.hearts) ? rawPost.hearts : [],
            comments: Array.isArray(rawPost.comments) ? rawPost.comments : [],
            sharesCount: Number(rawPost.sharesCount) || 0,
            createdAt: rawPost.createdAt || new Date().toISOString()
          };
        } else {
          const incomingNewer =
            toMs(rawPost.updatedAt || rawPost.softDeletedAt || rawPost.createdAt) >=
            toMs(existingPost.updatedAt || existingPost.softDeletedAt || existingPost.createdAt);
          if (incomingNewer) {
            this.state.posts[rawPost.id] = {
              ...existingPost,
              ...(rawPost as InstitutionalFeedPost),
              likes: Array.isArray(rawPost.likes) ? rawPost.likes : existingPost.likes,
              hearts: Array.isArray(rawPost.hearts) ? rawPost.hearts : existingPost.hearts,
              comments: Array.isArray(rawPost.comments) ? rawPost.comments : existingPost.comments
            };
          }
        }
      }
    }

    // 2. Merge Reports
    const reportById = new Map<string, PostReport>();
    for (const existing of this.state.reports) {
      if (existing?.id) reportById.set(existing.id, existing);
    }
    if (Array.isArray(payload.reports)) {
      for (const rawRep of payload.reports.slice(0, 500)) {
        if (!rawRep?.id) continue;
        const incoming: PostReport = {
          id: String(rawRep.id),
          caseId: String(rawRep.caseId || ''),
          targetType: rawRep.targetType === 'comment' ? 'comment' : 'post',
          targetId: String(rawRep.targetId || ''),
          reason: (rawRep.reason as ReportReason) || 'Inappropriate content',
          priority: rawRep.priority || getPriorityForReason((rawRep.reason as ReportReason) || 'Inappropriate content'),
          details: typeof rawRep.details === 'string' ? rawRep.details : undefined,
          reporterId: String(rawRep.reporterId || 'unknown_reporter'),
          reporterName: String(rawRep.reporterName || 'Community Member'),
          reporterRole: (rawRep.reporterRole as UserRole) || 'alumni',
          status: rawRep.status || 'pending',
          cycleNumber: Math.max(1, Number(rawRep.cycleNumber) || 1),
          createdAt: rawRep.createdAt || new Date().toISOString(),
          resolvedAt: rawRep.resolvedAt,
          resolvedBy: rawRep.resolvedBy,
          resolvedOutcome: rawRep.resolvedOutcome
        };
        const existing = reportById.get(incoming.id);
        if (!existing) {
          reportById.set(incoming.id, incoming);
        } else {
          const existingScore = (isResolvedStatus(existing.status) ? 10 : existing.status === 'reviewed' ? 5 : 0);
          const incomingScore = (isResolvedStatus(incoming.status) ? 10 : incoming.status === 'reviewed' ? 5 : 0);
          if (incomingScore > existingScore || toMs(incoming.resolvedAt) > toMs(existing.resolvedAt)) {
            reportById.set(incoming.id, { ...existing, ...incoming });
          }
        }
      }
    }
    this.state.reports = Array.from(reportById.values()).sort(
      (a, b) => toMs(b.createdAt) - toMs(a.createdAt)
    );

    // 3. Merge Cases
    const caseById = new Map<string, ModerationCase>();
    for (const existing of this.state.cases) {
      if (existing?.id) {
        caseById.set(existing.id, this.normalizeModCaseRecord(existing));
      }
    }
    if (Array.isArray(payload.cases)) {
      for (const rawCase of payload.cases.slice(0, 500)) {
        if (!rawCase?.id) continue;
        const incoming = this.normalizeModCaseRecord(rawCase);
        const existing = caseById.get(incoming.id);
        if (!existing) {
          caseById.set(incoming.id, incoming);
        } else {
          const incomingMs = toMs(incoming.updatedAt || incoming.resolvedAt || incoming.createdAt);
          const existingMs = toMs(existing.updatedAt || existing.resolvedAt || existing.createdAt);
          const mergedReportIds = Array.from(new Set([...(existing.reportIds || []), ...(incoming.reportIds || [])]));
          if (incomingMs > existingMs || (isResolvedStatus(incoming.status) && !isResolvedStatus(existing.status))) {
            caseById.set(incoming.id, this.normalizeModCaseRecord({
              ...existing,
              ...incoming,
              reportIds: mergedReportIds
            }));
          } else {
            caseById.set(existing.id, this.normalizeModCaseRecord({
              ...incoming,
              ...existing,
              reportIds: mergedReportIds
            }));
          }
        }
      }
    }

    // Ensure every orphaned report has a valid ModerationCase so reports are never invisible
    for (const rep of this.state.reports) {
      let parent = (rep.caseId ? caseById.get(rep.caseId) : undefined) ||
        Array.from(caseById.values()).find((c) => c.targetType === rep.targetType && c.targetId === rep.targetId);
      if (!parent && rep.targetId) {
        const post = this.state.posts[rep.targetId];
        const caseId = rep.caseId || `case_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
        rep.caseId = caseId;
        parent = this.normalizeModCaseRecord({
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
          contentSnapshot: this.buildSnapshot(post),
          currentContent: this.buildSnapshot(post),
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

    // Recompute aggregate report stats cleanly for each case from reconciled reports
    for (const modCase of caseById.values()) {
      const linkedReports = this.state.reports.filter((r) => r.caseId === modCase.id);
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
      const livePost = this.state.posts[modCase.targetId];
      if (livePost) {
        modCase.currentContent = this.buildSnapshot(livePost);
        modCase.contentEditedSinceSnapshot = this.checkSnapshotDiffers(modCase.contentSnapshot, livePost);
      }
    }

    this.state.cases = Array.from(caseById.values()).sort(
      (a, b) => toMs(b.updatedAt || b.createdAt) - toMs(a.updatedAt || a.createdAt)
    );

    // 4. Merge Warnings
    const warningById = new Map<string, ModerationWarning>();
    for (const w of this.state.warnings) {
      if (w?.id) warningById.set(w.id, w);
    }
    if (Array.isArray(payload.warnings)) {
      for (const w of payload.warnings.slice(0, 500)) {
        if (!w?.id) continue;
        const prev = warningById.get(w.id);
        if (!prev || (w.overturned && !prev.overturned)) {
          warningById.set(w.id, { ...(prev || {}), ...(w as ModerationWarning) });
        }
      }
    }
    this.state.warnings = Array.from(warningById.values()).sort(
      (a, b) => toMs(b.createdAt) - toMs(a.createdAt)
    );

    // 5. Merge Immutable Audit Logs
    const auditById = new Map<string, ModerationAuditRecord>();
    for (const a of this.state.auditLogs) {
      if (a?.id) auditById.set(a.id, a);
    }
    if (Array.isArray(payload.auditLogs)) {
      for (const a of payload.auditLogs.slice(0, 500)) {
        if (a?.id && !auditById.has(a.id)) {
          auditById.set(a.id, a as ModerationAuditRecord);
        }
      }
    }
    this.state.auditLogs = Array.from(auditById.values()).sort(
      (a, b) => toMs(b.createdAt) - toMs(a.createdAt)
    );

    // 6. Merge Reporter Tracking
    if (Array.isArray(payload.reporterTracking)) {
      for (const tr of payload.reporterTracking.slice(0, 300)) {
        if (!tr?.userId) continue;
        const existing = this.state.reporterTracking[tr.userId];
        if (!existing) {
          this.state.reporterTracking[tr.userId] = {
            userId: tr.userId,
            userName: tr.userName,
            userRole: tr.userRole,
            consecutiveDismissedCount: Number(tr.consecutiveDismissedCount) || 0,
            totalDismissedCount: Number(tr.totalDismissedCount) || 0,
            totalReportsCount: Number(tr.totalReportsCount) || 0,
            flaggedAbusiveReporter: Boolean(tr.flaggedAbusiveReporter),
            reportingRestricted: Boolean(tr.reportingRestricted),
            restrictionReason: tr.restrictionReason,
            restrictedAt: tr.restrictedAt,
            restrictedBy: tr.restrictedBy,
            flaggedAt: tr.flaggedAt,
            warningIssuedAt: tr.warningIssuedAt
          };
        } else {
          existing.totalReportsCount = Math.max(existing.totalReportsCount || 0, Number(tr.totalReportsCount) || 0);
          existing.totalDismissedCount = Math.max(existing.totalDismissedCount || 0, Number(tr.totalDismissedCount) || 0);
          existing.consecutiveDismissedCount = Math.max(existing.consecutiveDismissedCount || 0, Number(tr.consecutiveDismissedCount) || 0);
          if (tr.flaggedAbusiveReporter) existing.flaggedAbusiveReporter = true;
          if (tr.reportingRestricted) {
            existing.reportingRestricted = true;
            existing.restrictionReason = existing.restrictionReason || tr.restrictionReason;
          }
        }
      }
    }

    this.persist();
    return {
      casesCount: this.state.cases.length,
      reportsCount: this.state.reports.length,
      warningsCount: this.state.warnings.length,
      auditLogsCount: this.state.auditLogs.length,
      syncedAt: new Date().toISOString(),
      cases: this.state.cases,
      reports: this.state.reports,
      warnings: this.state.warnings,
      auditLogs: isSuperAdminRole(actor.role) ? this.state.auditLogs : [],
      reporterTracking: Object.values(this.state.reporterTracking)
    };
  }
}

export const postModerationEngine = new PostModerationEngine();
