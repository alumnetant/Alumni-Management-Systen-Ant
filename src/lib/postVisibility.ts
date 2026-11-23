import type { InstitutionalFeedPost, UserProfile, UserRole } from '../types';
import { normalizeSystemRole } from '../types';

export type VisibilitySurface = 'feed' | 'profile' | 'search' | 'permalink' | 'media';

export interface ViewerContext {
  uid: string;
  role: UserRole | string;
  batch?: string;
  course?: string;
  department?: string;
  groupIds?: string[];
  blockedUsers?: string[];
}

export interface AuthorAccountLike {
  uid: string;
  name?: string;
  role?: UserRole | string;
  username?: string;
  profilePictureUrl?: string;
  avatar?: string;
  accountStatus?: string;
  status?: string;
  isDeactivated?: boolean;
  isDeleted?: boolean;
  isBanned?: boolean;
  blockedUsers?: string[];
  suspensionInfo?: {
    endDate?: string;
    isPermanentLock?: boolean;
  };
  suspensionEndDate?: string;
}

export function isStaffOrModeratorRole(role?: string): boolean {
  const canonical = normalizeSystemRole(role);
  return canonical === 'moderator' || canonical === 'admin' || canonical === 'superadmin';
}

/**
 * Only posts published by Alumni or Employers can be reported.
 * Any post by Admin, Superadmin, Moderator (including legacy registrar/staff/faculty),
 * or missing/unverified author roles cannot be reported.
 */
export function isReportableAuthorRole(role?: string | null): boolean {
  if (!role || typeof role !== 'string') return false;
  const raw = role.toLowerCase().trim();
  if (!raw) return false;
  return raw === 'alumni' || raw === 'employer';
}

export function resolvePostAuthorRole(
  post: Pick<InstitutionalFeedPost, 'authorId' | 'authorRole'>,
  authorAccount?: Pick<AuthorAccountLike, 'role'> | null
): string | undefined {
  if (authorAccount?.role && typeof authorAccount.role === 'string' && authorAccount.role.trim()) {
    return authorAccount.role.trim();
  }
  if (post.authorRole && typeof post.authorRole === 'string' && post.authorRole.trim()) {
    return post.authorRole.trim();
  }
  return undefined;
}

export function canReportPost(
  post: Pick<InstitutionalFeedPost, 'authorId' | 'authorRole' | 'authorDeleted' | 'isSoftDeleted'>,
  currentUser?: { uid?: string } | null,
  authorAccount?: Pick<AuthorAccountLike, 'role'> | null
): boolean {
  if (!currentUser?.uid) return false;
  if (post.isSoftDeleted) return false;
  const isOwner = Boolean(post.authorId && post.authorId === currentUser.uid && !post.authorDeleted);
  if (isOwner) return false;
  const resolvedRole = resolvePostAuthorRole(post, authorAccount);
  return isReportableAuthorRole(resolvedRole);
}

export function slugifyUsername(raw: string): string {
  const cleaned = (raw || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9._-]+/g, '.')
    .replace(/\.{2,}/g, '.')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, 48);
  return cleaned || 'cecilian.member';
}

export function generateUniqueUsername(name: string, uid: string, existingHandles: Set<string>): string {
  const base = slugifyUsername(name || uid || 'alumni');
  if (!existingHandles.has(base)) {
    return base;
  }
  const suffixSeed = (uid || '').replace(/[^a-z0-9]/gi, '').toLowerCase().slice(-4) || '01';
  let candidate = `${base}.${suffixSeed}`;
  let counter = 2;
  while (existingHandles.has(candidate)) {
    candidate = `${base}.${suffixSeed}${counter}`;
    counter++;
  }
  return candidate;
}

export function isAccountDeleted(account?: AuthorAccountLike | Partial<UserProfile> | null): boolean {
  if (!account) return false;
  const st = (account.accountStatus || account.status || '').toUpperCase().trim();
  return account.isDeleted === true || st === 'DELETED';
}

export function isAccountDeactivated(account?: AuthorAccountLike | Partial<UserProfile> | null): boolean {
  if (!account) return false;
  const st = (account.accountStatus || account.status || '').toUpperCase().trim();
  return account.isDeactivated === true || st === 'DEACTIVATED';
}

export function isAccountSuspendedOrBanned(account?: AuthorAccountLike | Partial<UserProfile> | null): boolean {
  if (!account) return false;
  const st = (account.accountStatus || account.status || '').toUpperCase().trim();
  if (st === 'LOCKED' || st === 'BANNED' || account.isBanned) {
    return true;
  }
  if (st === 'SUSPENDED') {
    if (account.suspensionInfo?.isPermanentLock) return true;
    const endDate = account.suspensionInfo?.endDate || account.suspensionEndDate;
    if (!endDate) return true;
    const endMs = new Date(endDate).getTime();
    return Number.isNaN(endMs) || endMs > Date.now();
  }
  return false;
}

export function isAccountBannedOrLocked(account?: AuthorAccountLike | Partial<UserProfile> | null): boolean {
  if (!account) return false;
  const st = (account.accountStatus || account.status || '').toUpperCase().trim();
  if (st === 'LOCKED' || st === 'BANNED' || account.isBanned) {
    return true;
  }
  if (st === 'SUSPENDED' && account.suspensionInfo?.isPermanentLock) {
    return true;
  }
  return false;
}

export function isAccountUnavailable(account?: AuthorAccountLike | Partial<UserProfile> | null): boolean {
  if (!account) return false;
  return isAccountDeleted(account) || isAccountDeactivated(account) || isAccountSuspendedOrBanned(account);
}

export function areUsersBlocked(
  uidA: string | undefined,
  uidB: string | undefined,
  accountA?: { blockedUsers?: string[] } | null,
  accountB?: { blockedUsers?: string[] } | null
): boolean {
  if (!uidA || !uidB || uidA === uidB) return false;
  const aBlocksB = Array.isArray(accountA?.blockedUsers) && accountA!.blockedUsers.includes(uidB);
  const bBlocksA = Array.isArray(accountB?.blockedUsers) && accountB!.blockedUsers.includes(uidA);
  return aBlocksB || bBlocksA;
}

/**
 * Normalizes legacy post author references so old posts created before this feature
 * have a valid canonical user UID (e.g. fixing legacy 'admin' literal fallbacks).
 */
export function normalizeLegacyPostAuthor(
  post: InstitutionalFeedPost,
  usersByUid?: Map<string, AuthorAccountLike>,
  usersByName?: Map<string, AuthorAccountLike>
): { post: InstitutionalFeedPost; hadInvalidAuthor: boolean } {
  let resolvedAuthorId = (post.authorId || '').trim();
  let hadInvalidAuthor = false;
  let normalized = !!post.legacyAuthorNormalized;

  const isKnownUid = (id: string) => Boolean(usersByUid && usersByUid.has(id));

  if (!resolvedAuthorId || resolvedAuthorId === 'admin') {
    hadInvalidAuthor = true;
    normalized = true;
    const byName = post.authorName && usersByName ? usersByName.get(post.authorName.trim().toLowerCase()) : undefined;
    if (byName) {
      resolvedAuthorId = byName.uid;
    } else {
      resolvedAuthorId = 'usr_admin_cecilia';
    }
  } else if (usersByUid && usersByUid.size > 0 && !isKnownUid(resolvedAuthorId) && !post.authorDeleted) {
    const byName = post.authorName && usersByName ? usersByName.get(post.authorName.trim().toLowerCase()) : undefined;
    if (byName) {
      hadInvalidAuthor = true;
      normalized = true;
      resolvedAuthorId = byName.uid;
    }
  }

  return {
    hadInvalidAuthor,
    post: {
      ...post,
      authorId: resolvedAuthorId,
      authorRole: normalizeSystemRole(post.authorRole),
      status: post.status || 'published',
      visibility: post.visibility || 'alumni',
      isAnonymous: Boolean(post.isAnonymous),
      legacyAuthorNormalized: normalized
    }
  };
}

/**
 * Single authoritative post visibility evaluator shared across:
 * - Main Feed
 * - Personal Profile Timeline
 * - Global Search
 * - Single-post Permalinks
 * - Gated Post Media endpoints
 */
export function canUserViewPost(
  rawPost: InstitutionalFeedPost,
  options: {
    surface: VisibilitySurface;
    viewer?: ViewerContext | null;
    targetProfileUid?: string;
    authorAccount?: AuthorAccountLike | null;
    isBlocked?: boolean;
    includeDeletedForMod?: boolean;
  }
): boolean {
  const { surface, viewer, targetProfileUid, authorAccount, isBlocked, includeDeletedForMod } = options;
  const post = rawPost;
  const isMod = viewer ? isStaffOrModeratorRole(viewer.role) : false;
  const isAuthor = Boolean(viewer?.uid && viewer.uid === post.authorId);

  // 1. Login required on personal profile timeline surfaces
  if (surface === 'profile' && !viewer?.uid) {
    return false;
  }

  // 2. Publication status: Drafts, scheduled, and pending-approval posts NEVER appear on timelines, feed, search, or shared URLs
  const pubStatus = post.status || 'published';
  if (pubStatus !== 'published') {
    return false;
  }

  // 3. Soft-deleted posts disappear everywhere except moderator-authorized audit/review views
  if (post.isSoftDeleted) {
    if (!(isMod && includeDeletedForMod)) {
      return false;
    }
  }

  // 4. Harassment auto-hidden posts are visible only to moderators/admins and the post author
  if (post.underReviewAutoHidden && !isMod && !isAuthor) {
    return false;
  }

  // 5. Bidirectional block enforcement (neither blocked party sees the other's posts anywhere)
  if (isBlocked || (viewer && authorAccount && areUsersBlocked(viewer.uid, post.authorId, viewer, authorAccount))) {
    return false;
  }

  // 6. Account states:
  //    - Suspended / Banned / Deactivated -> hide posts across feeds/timelines/search/permalinks (except mod review)
  //    - Deleted -> keep published non-anonymous posts anonymized as "Former alumni" on feed/search/permalink
  if (authorAccount) {
    if ((isAccountSuspendedOrBanned(authorAccount) || isAccountDeactivated(authorAccount)) && !isMod) {
      return false;
    }
    if (isAccountDeleted(authorAccount) && surface === 'profile') {
      return false;
    }
  }

  // 7. Personal Profile Timeline specific strict rules
  if (surface === 'profile') {
    // Anonymous posts must NEVER appear on the author's profile, counts, or profile APIs
    if (post.isAnonymous) {
      return false;
    }
    // Must strictly belong to the profile owner (tagged/mentioned posts NEVER appear on tagged person's timeline)
    if (targetProfileUid && post.authorId !== targetProfileUid) {
      return false;
    }
  }

  // 8. Scoped visibility rules (group, batch, department, private)
  const vis = post.visibility || 'alumni';
  if (vis === 'private') {
    return isAuthor;
  }
  if (vis === 'alumni' && !viewer?.uid) {
    return false;
  }
  if (vis === 'batch' && post.targetBatch) {
    if (!isAuthor && !isMod && (viewer?.batch || '').trim() !== post.targetBatch.trim()) {
      return false;
    }
  }
  if (vis === 'department' && post.targetDepartment) {
    const targetDept = post.targetDepartment.trim().toLowerCase();
    const viewerDept = (viewer?.department || '').trim().toLowerCase();
    const viewerCourse = (viewer?.course || '').trim().toLowerCase();
    if (!isAuthor && !isMod && viewerDept !== targetDept && viewerCourse !== targetDept) {
      return false;
    }
  }
  if (vis === 'group' && post.groupId) {
    const groups = viewer?.groupIds || [];
    if (!isAuthor && !isMod && !groups.includes(post.groupId)) {
      return false;
    }
  }

  return true;
}

export function isPinActive(post: InstitutionalFeedPost, nowMs = Date.now()): boolean {
  if (!post.isPinned) return false;
  if (!post.pinExpiresAt) return true;
  const expiresMs = new Date(post.pinExpiresAt).getTime();
  return Number.isNaN(expiresMs) ? true : expiresMs > nowMs;
}

/**
 * Dynamically hydrates live author details (name, avatar, username) on read
 * so profile edits immediately reflect across all historical posts,
 * while consistently anonymizing deleted accounts as "Former alumni".
 */
export function hydratePostWithLiveAuthor(
  post: InstitutionalFeedPost,
  authorAccount?: AuthorAccountLike | null,
  viewer?: ViewerContext | null
): InstitutionalFeedPost {
  const isMod = viewer ? isStaffOrModeratorRole(viewer.role) : false;
  const isAuthor = Boolean(viewer?.uid && viewer.uid === post.authorId);

  if (post.isAnonymous) {
    const resolvedAnonRole = authorAccount?.role
      ? normalizeSystemRole(authorAccount.role)
      : post.authorRole
      ? normalizeSystemRole(post.authorRole)
      : undefined;
    return {
      ...post,
      authorId: isMod || isAuthor ? post.authorId : 'anonymous',
      authorName: 'Anonymous Alumnus',
      authorAvatar: '',
      authorUsername: undefined,
      authorRole: resolvedAnonRole as UserRole
    };
  }

  if (isAccountDeleted(authorAccount) || post.authorDeleted) {
    return {
      ...post,
      authorName: 'Former alumni',
      authorAvatar: '',
      authorUsername: undefined,
      authorDeleted: true
    };
  }

  if (authorAccount) {
    return {
      ...post,
      authorName: authorAccount.name || post.authorName || 'Cecilian Alumnus',
      authorAvatar: authorAccount.profilePictureUrl || authorAccount.avatar || post.authorAvatar || '',
      authorRole: normalizeSystemRole((authorAccount.role as string) || post.authorRole),
      authorUsername: authorAccount.username || post.authorUsername
    };
  }

  return post;
}

export function comparePostsCreatedDesc(a: InstitutionalFeedPost, b: InstitutionalFeedPost): number {
  const timeA = new Date(a.createdAt || 0).getTime();
  const timeB = new Date(b.createdAt || 0).getTime();
  if (timeB !== timeA) {
    return timeB - timeA;
  }
  return String(b.id).localeCompare(String(a.id));
}

export interface DecodedTimelineCursor {
  createdAtMs: number;
  id: string;
}

export function encodeTimelineCursor(createdAt: string, id: string): string {
  const ms = new Date(createdAt || 0).getTime();
  const payload = JSON.stringify({ createdAtMs: ms, id });
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(payload, 'utf8').toString('base64url');
  }
  const bytes = new TextEncoder().encode(payload);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function decodeTimelineCursor(cursor?: string | null): DecodedTimelineCursor | null {
  if (!cursor || typeof cursor !== 'string') return null;
  try {
    // Support browser and Node base64url decoding
    const base64 = cursor.replace(/-/g, '+').replace(/_/g, '/');
    const json =
      typeof Buffer !== 'undefined'
        ? Buffer.from(cursor, 'base64url').toString('utf8')
        : atob(base64);
    const parsed = JSON.parse(json);
    if (typeof parsed?.createdAtMs === 'number' && typeof parsed?.id === 'string') {
      return { createdAtMs: parsed.createdAtMs, id: parsed.id };
    }
    return null;
  } catch {
    return null;
  }
}

export function paginatePostsWithCursor(
  sortedPostsDesc: InstitutionalFeedPost[],
  cursorStr?: string | null,
  limitCount = 10
): { items: InstitutionalFeedPost[]; nextCursor: string | null; hasMore: boolean } {
  const limit = Math.min(50, Math.max(1, Math.floor(limitCount) || 10));
  const cursor = decodeTimelineCursor(cursorStr);

  const afterCursor = cursor
    ? sortedPostsDesc.filter((p) => {
        const ms = new Date(p.createdAt || 0).getTime();
        if (ms < cursor.createdAtMs) return true;
        if (ms === cursor.createdAtMs && String(p.id).localeCompare(cursor.id) < 0) return true;
        return false;
      })
    : sortedPostsDesc;

  const pageItems = afterCursor.slice(0, limit);
  const hasMore = afterCursor.length > limit;
  const last = pageItems[pageItems.length - 1];
  const nextCursor = hasMore && last ? encodeTimelineCursor(last.createdAt, last.id) : null;

  return { items: pageItems, nextCursor, hasMore };
}

export function dedupePostsById(posts: InstitutionalFeedPost[]): InstitutionalFeedPost[] {
  const seen = new Set<string>();
  const result: InstitutionalFeedPost[] = [];
  for (const post of posts) {
    if (!post || !post.id || seen.has(post.id)) continue;
    seen.add(post.id);
    result.push(post);
  }
  return result;
}

