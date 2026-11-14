import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type {
  AbuseReporterTracking,
  AppNotification,
  InstitutionalFeedPost,
  ModerationActionType,
  ModerationAppeal,
  ModerationAuditRecord,
  ModerationCase,
  ModerationConfig,
  ModerationWarning,
  PostContentSnapshot,
  PostReport,
  ReportPriority,
  ReportReason,
  ReportTargetType,
  UserRole
} from '../../types';
import { POST_REPORT_REASONS } from '../../types';
import { sendRealEmail } from '../emailService';

export interface ModerationActor {
  uid: string;
  name: string;
  email: string;
  role: UserRole | string;
}

export interface UserAccountAdapter {
  getUserByUid: (uid: string) => any | undefined;
  updateUserSuspension: (
    uid: string,
    payload: {
      accountStatus: 'ACTIVE' | 'SUSPENDED' | 'LOCKED';
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
  maxReportsPerHour: 10
};

export interface ModerationStateSnapshot {
  posts: Record<string, InstitutionalFeedPost>;
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
}

const MODERATION_DB_FILE = path.join(process.cwd(), 'data', 'moderation_db.json');

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
  const norm = (role || '').toLowerCase().trim();
  return norm === 'moderator' || norm === 'admin' || norm === 'superadmin';
}

export function isAdminRole(role?: string): boolean {
  const norm = (role || '').toLowerCase().trim();
  return norm === 'admin' || norm === 'superadmin';
}

function createInitialState(): ModerationStateSnapshot {
  return {
    posts: {},
    reports: [],
    cases: [],
    warnings: [],
    appeals: [],
    auditLogs: [],
    reporterTracking: {},
    notifications: [],
    userRateWindows: {},
    flaggedForBanUsers: {},
    config: { ...DEFAULT_MODERATION_CONFIG }
  };
}

export class PostModerationEngine {
  private state: ModerationStateSnapshot;
  private persistenceEnabled: boolean;
  private accountAdapter: UserAccountAdapter | null = null;
  private emailEnabled: boolean;

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
  }

  public setEmailEnabled(enabled: boolean): void {
    this.emailEnabled = enabled;
  }

  public resetForTests(): void {
    this.state = createInitialState();
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(MODERATION_DB_FILE)) {
        const raw = fs.readFileSync(MODERATION_DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          this.state = {
            ...createInitialState(),
            ...parsed,
            config: { ...DEFAULT_MODERATION_CONFIG, ...(parsed.config || {}) }
          };
        }
      }
    } catch (err) {
      console.warn('[PostModeration] Failed to load state from disk, starting fresh:', err);
    }
  }

  private persist(): void {
    if (!this.persistenceEnabled) return;
    try {
      const dir = path.dirname(MODERATION_DB_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(MODERATION_DB_FILE, JSON.stringify(this.state, null, 2), 'utf-8');
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
    const full: AppNotification = {
      ...notif,
      id: `mod_notif_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      read: false,
      createdAt: new Date().toISOString()
    };
    this.state.notifications.unshift(full);
    return full;
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

  private buildSnapshot(post: InstitutionalFeedPost): PostContentSnapshot {
    return {
      title: post.title || '',
      content: post.content || '',
      imageUrl: post.imageUrl,
      tags: post.tags ? [...post.tags] : undefined,
      postType: post.postType,
      authorId: post.authorId,
      authorName: post.authorName,
      capturedAt: new Date().toISOString()
    };
  }

  private checkSnapshotDiffers(snapshot: PostContentSnapshot, post: InstitutionalFeedPost): boolean {
    if ((snapshot.title || '') !== (post.title || '')) return true;
    if ((snapshot.content || '') !== (post.content || '')) return true;
    if ((snapshot.imageUrl || '') !== (post.imageUrl || '')) return true;
    return false;
  }

  // ===========================================================================
  // 1. POST LIFECYCLE & PRIVACY-SAFE VIEW PROJECTION
  // ===========================================================================

  public upsertPost(post: InstitutionalFeedPost, actor?: ModerationActor): InstitutionalFeedPost {
    if (!post?.id || !post?.authorId) {
      throw new ModerationError(400, 'INVALID_POST', 'Post ID and author ID are required.');
    }

    const existing = this.state.posts[post.id];
    if (!existing && actor) {
      const blockCheck = this.checkUserBlockedFromPostingOrReporting(actor.uid);
      if (blockCheck.blocked && !blockCheck.reason?.includes('report')) {
        throw new ModerationError(403, 'USER_SUSPENDED', blockCheck.reason || 'Suspended users cannot publish posts.');
      }
    }

    const stored: InstitutionalFeedPost = {
      ...existing,
      ...post,
      title: sanitizeModerationText(post.title || '', 200),
      content: sanitizeModerationText(post.content || '', 5000),
      isSoftDeleted: existing?.isSoftDeleted ?? post.isSoftDeleted ?? false,
      flaggedByModerators: existing?.flaggedByModerators ?? post.flaggedByModerators ?? false,
      flaggedMessage: existing?.flaggedMessage ?? post.flaggedMessage,
      underReviewAutoHidden: existing?.underReviewAutoHidden ?? post.underReviewAutoHidden ?? false
    };
    this.state.posts[stored.id] = stored;

    // If post was updated and a case exists, keep original snapshot intact and flag diff
    const modCase = this.state.cases.find((c) => c.targetType === 'post' && c.targetId === stored.id);
    if (modCase) {
      modCase.currentContent = this.buildSnapshot(stored);
      modCase.contentEditedSinceSnapshot = this.checkSnapshotDiffers(modCase.contentSnapshot, stored);
      modCase.updatedAt = new Date().toISOString();
    }

    this.persist();
    return stored;
  }

  public editPostByAuthor(
    postId: string,
    actor: ModerationActor,
    updates: { title?: string; content?: string; imageUrl?: string; tags?: string[] }
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

    const updated: InstitutionalFeedPost = {
      ...post,
      title: updates.title !== undefined ? sanitizeModerationText(updates.title, 200) : post.title,
      content: updates.content !== undefined ? sanitizeModerationText(updates.content, 5000) : post.content,
      imageUrl: updates.imageUrl !== undefined ? updates.imageUrl : post.imageUrl,
      tags: updates.tags !== undefined ? updates.tags : post.tags,
      isEdited: true,
      updatedAt: new Date().toISOString()
    };

    this.state.posts[postId] = updated;

    // Preserve original contentSnapshot on any existing case and flag diff!
    for (const modCase of this.state.cases) {
      if (modCase.targetType === 'post' && modCase.targetId === postId) {
        modCase.currentContent = this.buildSnapshot(updated);
        modCase.contentEditedSinceSnapshot = this.checkSnapshotDiffers(modCase.contentSnapshot, updated);
        modCase.updatedAt = new Date().toISOString();
      }
    }

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
   * - Soft-deleted posts NEVER appear to alumni/public (only moderators/admins).
   * - Temporarily auto-hidden harassment posts disappear from public feed/search/profiles,
   *   remaining visible ONLY to moderators/admins and to the post author (who sees "Under review").
   * - "flaggedByModerators" & "flaggedMessage" are visible ONLY to the author and moderators/admins.
   * - Reporter identity is NEVER present on any post payload.
   */
  public projectPostForViewer(post: InstitutionalFeedPost, viewer?: ModerationActor | null): InstitutionalFeedPost {
    const isMod = viewer ? isModeratorRole(viewer.role) : false;
    const isAuthor = viewer ? post.authorId === viewer.uid : false;
    const viewerHasReported = viewer
      ? this.state.reports.some((r) => r.targetType === 'post' && r.targetId === post.id && r.reporterId === viewer.uid)
      : false;

    const clean: InstitutionalFeedPost = {
      ...post,
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

  public getVisiblePosts(viewer?: ModerationActor | null, options?: { search?: string; authorId?: string; includeDeletedForMod?: boolean }): InstitutionalFeedPost[] {
    const isMod = viewer ? isModeratorRole(viewer.role) : false;
    const search = (options?.search || '').toLowerCase().trim();

    return Object.values(this.state.posts)
      .filter((post) => {
        const isAuthor = viewer ? post.authorId === viewer.uid : false;

        // Soft-deleted posts disappear from feed, search, profile pages, notifications for non-moderators
        if (post.isSoftDeleted) {
          if (!(isMod && options?.includeDeletedForMod)) {
            return false;
          }
        }

        // Auto-hidden harassment posts disappear from public feeds/search/other profiles
        // Author sees it with "Under review" notice (on profile/author views), moderators see all
        if (post.underReviewAutoHidden && !isMod && !isAuthor) {
          return false;
        }

        if (options?.authorId && post.authorId !== options.authorId) {
          return false;
        }

        if (search) {
          const haystack = `${post.title} ${post.content} ${post.authorName} ${(post.tags || []).join(' ')}`.toLowerCase();
          if (!haystack.includes(search)) return false;
        }

        return true;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((p) => this.projectPostForViewer(p, viewer));
  }

  public getPostByIdForViewer(postId: string, viewer?: ModerationActor | null): InstitutionalFeedPost | null {
    const post = this.state.posts[postId];
    if (!post) return null;
    const isMod = viewer ? isModeratorRole(viewer.role) : false;
    const isAuthor = viewer ? post.authorId === viewer.uid : false;

    if (post.isSoftDeleted && !isMod) return null;
    if (post.underReviewAutoHidden && !isMod && !isAuthor) return null;

    return this.projectPostForViewer(post, viewer);
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
  ): { success: true; message: string; reportId: string; priority: ReportPriority } {
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
      post = {
        ...payload.postSnapshotFallback,
        title: sanitizeModerationText(payload.postSnapshotFallback.title || '', 200),
        content: sanitizeModerationText(payload.postSnapshotFallback.content || '', 5000)
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

    this.appendAudit({
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

    // Privacy check: Return minimal confirmation only—never return reporter lists or case internals
    return {
      success: true,
      message: 'Thanks, our moderators will review your report.',
      reportId: report.id,
      priority
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

    let filtered = this.state.cases.filter((c) => {
      // Conflict-of-interest protection: if a moderator authored the post or reported it,
      // route to another reviewer (exclude from their actionable list, or mark inaccessible to them;
      // admins also cannot act on their own post/report).
      const conflict = this.evaluateReviewerConflict(c, actor);
      if (!conflict.canAct && !isAdminRole(actor.role)) {
        return false;
      }

      if (query.status && query.status !== 'all') {
        if (c.status !== query.status) return false;
      }
      if (query.priority && query.priority !== 'all') {
        if (c.highestPriority !== query.priority) return false;
      }
      if (query.reason && query.reason !== 'all') {
        if (!c.reasonsSummary[query.reason]) return false;
      }
      if (query.dateFrom) {
        if (new Date(c.createdAt).getTime() < new Date(query.dateFrom).getTime()) return false;
      }
      if (query.dateTo) {
        const endOfDay = new Date(query.dateTo).getTime() + 24 * 60 * 60 * 1000 - 1;
        if (new Date(c.createdAt).getTime() > endOfDay) return false;
      }
      if (search) {
        const text = `${c.postAuthorName} ${c.contentSnapshot.title} ${c.contentSnapshot.content} ${c.id}`.toLowerCase();
        if (!text.includes(search)) return false;
      }
      return true;
    });

    const sortMode = query.sort || 'priority';
    filtered = [...filtered].sort((a, b) => {
      if (sortMode === 'priority') {
        const diff = priorityRank(b.highestPriority) - priorityRank(a.highestPriority);
        if (diff !== 0) return diff;
        if (b.reportCount !== a.reportCount) return b.reportCount - a.reportCount;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
      if (sortMode === 'most_reported') {
        if (b.reportCount !== a.reportCount) return b.reportCount - a.reportCount;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const sliced = filtered.slice((page - 1) * pageSize, page * pageSize);

    const enriched = sliced.map((c) => {
      const conflict = this.evaluateReviewerConflict(c, actor);
      const caseReports = this.state.reports.filter((r) => r.caseId === c.id);
      const livePost = this.state.posts[c.targetId] || null;
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

    const modCase = this.state.cases.find((c) => c.id === caseId);
    if (!modCase) {
      throw new ModerationError(404, 'CASE_NOT_FOUND', 'Moderation case not found.');
    }

    const conflict = this.evaluateReviewerConflict(modCase, actor);
    if (!conflict.canAct && !isAdminRole(actor.role)) {
      throw new ModerationError(403, 'CONFLICT_OF_INTEREST', conflict.reason || 'Conflict of interest.');
    }

    const reports = this.state.reports.filter((r) => r.caseId === caseId);
    const livePost = this.state.posts[modCase.targetId] || null;
    const authorWarnings = this.state.warnings.filter((w) => w.userId === modCase.postAuthorId);
    const appeals = this.state.appeals.filter((a) => a.caseId === caseId);
    const authorBanFlag = this.state.flaggedForBanUsers[modCase.postAuthorId] || null;

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
    warning?: ModerationWarning;
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
      const warningReason = sanitizedReason || Object.keys(modCase.reasonsSummary)[0] || 'Community policy violation';

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
      const deletionReason = sanitizedReason || sanitizedMessage || Object.keys(modCase.reasonsSummary)[0] || 'Policy violation';
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
      case: modCase,
      warning: createdWarning,
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
    if (!isModeratorRole(actor.role)) {
      throw new ModerationError(403, 'FORBIDDEN', 'Only moderators and administrators can read moderation audit logs.');
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
      maxReportsPerHour: clampInt(updates.maxReportsPerHour, this.state.config.maxReportsPerHour, 1, 100)
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
}

export const postModerationEngine = new PostModerationEngine();
