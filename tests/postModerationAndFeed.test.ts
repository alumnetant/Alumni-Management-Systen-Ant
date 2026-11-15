import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import http from 'http';
import type { AddressInfo } from 'net';
import {
  PostModerationEngine,
  ModerationActor
} from '../src/server/postModeration/moderationEngine';
import {
  createPostModerationRouter,
  createCsrfTokenForUser
} from '../src/server/postModeration/moderationRouter';
import { calculateFeedRelevanceScore, DEFAULT_FEED_CONFIG } from '../src/config/feedConfig';
import { resolveNotificationDeepLink } from '../src/lib/notificationDeepLink';
import type { AppNotification, InstitutionalFeedPost } from '../src/types';

const TEST_CSRF_SECRET = 'test-csrf-secret-key-for-vitest';

function createTestServer(engine: PostModerationEngine, usersMap: Map<string, any>) {
  const app = express();
  app.use(express.json());

  const resolveActor = (req: express.Request): ModerationActor | null => {
    const uid = req.headers['x-test-uid'] as string | undefined;
    if (!uid) return null;
    const u = usersMap.get(uid);
    if (!u) return null;
    return {
      uid: u.uid,
      name: u.name,
      email: u.email,
      role: u.role,
      batch: u.batch,
      course: u.course,
      department: u.department,
      groupIds: u.groupIds
    };
  };

  const requireServerAuth: express.RequestHandler = (req, res, next) => {
    const actor = resolveActor(req);
    if (!actor) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    (req as any).user = actor;
    next();
  };

  const requireRole = (roles: string[]): express.RequestHandler => (req, res, next) => {
    const user = (req as any).user;
    const norm = (user?.role || '').toLowerCase().trim();
    if (!roles.includes(norm)) {
      return res.status(403).json({ error: 'Forbidden: insufficient role' });
    }
    next();
  };

  const router = createPostModerationRouter({
    requireServerAuth,
    requireRole,
    verifyTokenOptional: (req) => resolveActor(req),
    csrfSecret: TEST_CSRF_SECRET,
    engine
  });

  app.use('/api', router);
  return app;
}

describe('Alumni Feed, Profile Timeline, Moderation, Superadmin RBAC & Deep-Linked Notifications', () => {
  let engine: PostModerationEngine;
  let usersMap: Map<string, any>;
  let server: http.Server;
  let baseUrl: string;

  const seedUser = (u: any) => {
    const full = {
      accountStatus: 'ACTIVE',
      isVerified: true,
      blockedUsers: [],
      ...u
    };
    usersMap.set(full.uid, full);
    engine.upsertProfileRecord(full, false);
    return full;
  };

  const apiCall = async (
    path: string,
    options: { method?: string; uid?: string; body?: any } = {}
  ) => {
    const headers: Record<string, string> = {};
    if (options.uid) {
      headers['x-test-uid'] = options.uid;
      if (options.method && options.method !== 'GET') {
        headers['x-csrf-token'] = createCsrfTokenForUser(options.uid, TEST_CSRF_SECRET);
      }
    }
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(`${baseUrl}${path}`, {
      method: options.method || 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      redirect: 'manual'
    });
    const json = await res.json().catch(() => null);
    return { status: res.status, headers: res.headers, json };
  };

  beforeEach(async () => {
    engine = new PostModerationEngine({ persistToDisk: false, emailEnabled: false });
    usersMap = new Map();

    engine.setUserAccountAdapter({
      getUserByUid: (uid) => usersMap.get(uid),
      getAllUsers: () => Array.from(usersMap.values()),
      getModeratorsAndAdmins: () =>
        Array.from(usersMap.values()).filter((u) =>
          ['moderator', 'admin', 'superadmin'].includes(String(u.role).toLowerCase())
        ),
      updateUserSuspension: (uid, payload) => {
        const u = usersMap.get(uid);
        if (!u) return;
        u.accountStatus = payload.accountStatus;
        u.suspensionInfo =
          payload.accountStatus === 'SUSPENDED' || payload.accountStatus === 'LOCKED'
            ? { endDate: payload.endDate, isPermanentLock: payload.isPermanentLock }
            : undefined;
        engine.upsertProfileRecord(u, false);
      }
    });

    seedUser({
      uid: 'usr_super',
      name: 'Super Admin',
      email: 'super@scc.edu.ph',
      role: 'superadmin'
    });
    seedUser({
      uid: 'usr_admin',
      name: 'Campus Admin',
      email: 'admin@scc.edu.ph',
      role: 'admin'
    });
    seedUser({
      uid: 'usr_mod_1',
      name: 'Moderator One',
      email: 'mod1@scc.edu.ph',
      role: 'moderator'
    });
    seedUser({
      uid: 'usr_mod_2',
      name: 'Moderator Two',
      email: 'mod2@scc.edu.ph',
      role: 'moderator'
    });
    seedUser({
      uid: 'usr_alumni_1',
      name: 'Maria Clara',
      email: 'maria@scc.edu.ph',
      phone: '+63 917 000 1111',
      role: 'alumni',
      batch: '2020',
      department: 'BSIT',
      course: 'BS Information Technology',
      company: 'Cebu Tech Labs',
      currentPosition: 'Software Engineer',
      groupIds: ['grp_it_club'],
      show_email: false,
      show_phone: false,
      show_current_employer: false
    });
    seedUser({
      uid: 'usr_alumni_2',
      name: 'Jose Rizal',
      email: 'jose@scc.edu.ph',
      role: 'alumni',
      batch: '2021',
      department: 'BSBA',
      course: 'BS Business Administration',
      groupIds: []
    });
    seedUser({
      uid: 'usr_alumni_3',
      name: 'Andres Bonifacio',
      email: 'andres@scc.edu.ph',
      role: 'alumni',
      batch: '2020',
      department: 'BSIT',
      groupIds: ['grp_it_club']
    });

    const app = createTestServer(engine, usersMap);
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as AddressInfo).port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  // =========================================================================
  // 1. SUPERADMIN-ONLY RBAC & AUDIT LOG IMMUTABILITY
  // =========================================================================
  it('strictly restricts audit logs and legacy audit APIs to superadmin only and blocks mutations', async () => {
    for (const uid of ['usr_alumni_1', 'usr_mod_1', 'usr_admin']) {
      const auditRes = await apiCall('/api/moderation/audit-logs', { uid });
      expect(auditRes.status).toBe(403);

      const legacyRes = await apiCall('/api/moderation/legacy-audit', { uid });
      expect(legacyRes.status).toBe(403);
    }

    const superAudit = await apiCall('/api/moderation/audit-logs', { uid: 'usr_super' });
    expect(superAudit.status).toBe(200);
    expect(Array.isArray(superAudit.json.auditLogs)).toBe(true);

    const superLegacy = await apiCall('/api/moderation/legacy-audit', { uid: 'usr_super' });
    expect(superLegacy.status).toBe(200);

    for (const method of ['PUT', 'PATCH', 'DELETE'] as const) {
      const mut = await apiCall('/api/moderation/audit-logs/mod_audit_1', {
        method,
        uid: 'usr_super',
        body: { note: 'tamper' }
      });
      expect(mut.status).toBe(403);
      expect(mut.json.code).toBe('AUDIT_LOG_IMMUTABLE');
    }
  });

  // =========================================================================
  // 2. 4-STEP MAIN SOCIAL FEED PIPELINE & PAGINATION
  // =========================================================================
  it('filters drafts, scheduled, soft-deleted, blocked, scoped visibility, and preserves anonymous feed masking', async () => {
    const now = Date.now();
    // Published alumni post
    engine.upsertPost({
      id: 'p_pub',
      authorId: 'usr_alumni_1',
      authorName: 'Maria Clara',
      authorRole: 'alumni',
      authorAvatar: '',
      postType: 'milestone',
      title: 'Public Alumni Milestone',
      content: 'Excited to share this milestone.',
      likes: [],
      comments: [],
      sharesCount: 0,
      createdAt: new Date(now - 10000).toISOString(),
      status: 'published',
      visibility: 'alumni'
    });
    // Draft, scheduled, pending_approval -> excluded
    engine.upsertPost({
      id: 'p_draft',
      authorId: 'usr_alumni_1',
      authorName: 'Maria Clara',
      authorRole: 'alumni',
      authorAvatar: '',
      postType: 'milestone',
      title: 'Draft Post',
      content: 'Should not appear',
      likes: [],
      comments: [],
      sharesCount: 0,
      createdAt: new Date(now - 9000).toISOString(),
      status: 'draft',
      visibility: 'alumni'
    });
    engine.upsertPost({
      id: 'p_sched',
      authorId: 'usr_alumni_1',
      authorName: 'Maria Clara',
      authorRole: 'alumni',
      authorAvatar: '',
      postType: 'milestone',
      title: 'Scheduled Post',
      content: 'Future post',
      likes: [],
      comments: [],
      sharesCount: 0,
      createdAt: new Date(now - 8000).toISOString(),
      status: 'scheduled',
      visibility: 'alumni'
    });
    // Batch-only (2020) -> visible to alumni_3 (2020), hidden from alumni_2 (2021)
    engine.upsertPost({
      id: 'p_batch_2020',
      authorId: 'usr_alumni_1',
      authorName: 'Maria Clara',
      authorRole: 'alumni',
      authorAvatar: '',
      postType: 'milestone',
      title: 'Batch 2020 Reunion',
      content: 'Batch 2020 only',
      likes: [],
      comments: [],
      sharesCount: 0,
      createdAt: new Date(now - 7000).toISOString(),
      status: 'published',
      visibility: 'batch',
      targetBatch: '2020'
    });
    // Group-only -> visible to alumni_3 (grp_it_club), hidden from alumni_2
    engine.upsertPost({
      id: 'p_group',
      authorId: 'usr_alumni_1',
      authorName: 'Maria Clara',
      authorRole: 'alumni',
      authorAvatar: '',
      postType: 'milestone',
      title: 'IT Club Update',
      content: 'Members only',
      likes: [],
      comments: [],
      sharesCount: 0,
      createdAt: new Date(now - 6000).toISOString(),
      status: 'published',
      visibility: 'group',
      groupId: 'grp_it_club'
    });
    // Anonymous post -> visible on main feed WITHOUT author identity
    engine.upsertPost({
      id: 'p_anon',
      authorId: 'usr_alumni_1',
      authorName: 'Maria Clara',
      authorRole: 'alumni',
      authorAvatar: '',
      postType: 'milestone',
      title: 'Anonymous Feedback',
      content: 'Confession text',
      likes: [],
      comments: [],
      sharesCount: 0,
      createdAt: new Date(now - 5000).toISOString(),
      status: 'published',
      visibility: 'alumni',
      isAnonymous: true
    });

    const feedForJose = await apiCall('/api/feed', { uid: 'usr_alumni_2' });
    expect(feedForJose.status).toBe(200);
    const joseIds = feedForJose.json.posts.map((p: InstitutionalFeedPost) => p.id);
    expect(joseIds).toContain('p_pub');
    expect(joseIds).toContain('p_anon');
    expect(joseIds).not.toContain('p_draft');
    expect(joseIds).not.toContain('p_sched');
    expect(joseIds).not.toContain('p_batch_2020');
    expect(joseIds).not.toContain('p_group');

    const anonInFeed = feedForJose.json.posts.find((p: InstitutionalFeedPost) => p.id === 'p_anon');
    expect(anonInFeed.authorId).toBe('anonymous');
    expect(anonInFeed.authorName).toBe('Anonymous Alumnus');
    expect(anonInFeed.authorUsername).toBeUndefined();

    const feedForAndres = await apiCall('/api/feed', { uid: 'usr_alumni_3' });
    const andresIds = feedForAndres.json.posts.map((p: InstitutionalFeedPost) => p.id);
    expect(andresIds).toContain('p_batch_2020');
    expect(andresIds).toContain('p_group');

    // Blocking Maria hides Maria's non-anonymous posts and her profile from Jose
    const blkRes = await apiCall('/api/profiles/usr_alumni_1/block', {
      method: 'POST',
      uid: 'usr_alumni_2'
    });
    expect(blkRes.status).toBe(200);
    const feedAfterBlock = await apiCall('/api/feed', { uid: 'usr_alumni_2' });
    expect(feedAfterBlock.json.posts.some((p: InstitutionalFeedPost) => p.id === 'p_pub')).toBe(false);
  });

  it('enforces Step 3 relevance score, edit position stability, and Step 4 pinned caps, max consecutive author, and cursor stability', async () => {
    const baseMs = Date.now() - 3 * 60 * 60 * 1000;

    // 4 pinned announcements (1 expired, 3 active -> cap at 3 active)
    for (let i = 1; i <= 3; i++) {
      engine.upsertPost({
        id: `pin_active_${i}`,
        authorId: 'usr_admin',
        authorName: 'Campus Admin',
        authorRole: 'admin',
        authorAvatar: '',
        postType: 'announcement',
        title: `Active Pinned ${i}`,
        content: 'Important circular',
        likes: [],
        comments: [],
        sharesCount: 0,
        createdAt: new Date(baseMs + i * 1000).toISOString(),
        isPinned: true,
        pinExpiresAt: new Date(Date.now() + 86400000).toISOString(),
        status: 'published',
        visibility: 'alumni'
      });
    }
    engine.upsertPost({
      id: 'pin_expired',
      authorId: 'usr_admin',
      authorName: 'Campus Admin',
      authorRole: 'admin',
      authorAvatar: '',
      postType: 'announcement',
      title: 'Expired Pin',
      content: 'Old announcement',
      likes: [],
      comments: [],
      sharesCount: 0,
      createdAt: new Date(baseMs).toISOString(),
      isPinned: true,
      pinExpiresAt: new Date(Date.now() - 60000).toISOString(),
      status: 'published',
      visibility: 'alumni'
    });

    // 5 consecutive posts by alumni_1 + 2 by alumni_2
    for (let i = 1; i <= 5; i++) {
      engine.upsertPost({
        id: `m_${i}`,
        authorId: 'usr_alumni_1',
        authorName: 'Maria Clara',
        authorRole: 'alumni',
        authorAvatar: '',
        postType: 'milestone',
        title: `Maria Post ${i}`,
        content: 'Content',
        likes: [],
        comments: [],
        sharesCount: 0,
        createdAt: new Date(baseMs + 100000 + i * 1000).toISOString(),
        status: 'published',
        visibility: 'alumni'
      });
    }
    for (let i = 1; i <= 2; i++) {
      engine.upsertPost({
        id: `j_${i}`,
        authorId: 'usr_alumni_2',
        authorName: 'Jose Rizal',
        authorRole: 'alumni',
        authorAvatar: '',
        postType: 'milestone',
        title: `Jose Post ${i}`,
        content: 'Content',
        likes: i === 2 ? ['usr_alumni_3', 'usr_admin'] : [],
        comments: [],
        sharesCount: 0,
        createdAt: new Date(baseMs + 50000 + i * 1000).toISOString(),
        status: 'published',
        visibility: 'alumni'
      });
    }

    // Page 1 of 4 posts
    const p1 = await apiCall('/api/feed?limit=4', { uid: 'usr_alumni_3' });
    expect(p1.status).toBe(200);
    expect(p1.json.pinnedPosts.length).toBe(3);
    expect(p1.json.pinnedPosts.some((p: InstitutionalFeedPost) => p.id === 'pin_expired')).toBe(false);
    expect(p1.json.posts.length).toBe(4);
    expect(p1.json.hasMore).toBe(true);

    // Check max 3 consecutive posts by same author across combined page 1 + page 2
    // Even if a new post is inserted between page 1 and page 2, cursor snapshot prevents duplicates/skips!
    engine.upsertPost({
      id: 'm_newest_inserted',
      authorId: 'usr_alumni_2',
      authorName: 'Jose Rizal',
      authorRole: 'alumni',
      authorAvatar: '',
      postType: 'milestone',
      title: 'Inserted Mid-Scroll',
      content: 'Should appear in new-count banner, not shift page 2',
      likes: [],
      comments: [],
      sharesCount: 0,
      createdAt: new Date().toISOString(),
      status: 'published',
      visibility: 'alumni'
    });

    const p2 = await apiCall(`/api/feed?limit=4&cursor=${encodeURIComponent(p1.json.nextCursor)}`, {
      uid: 'usr_alumni_3'
    });
    expect(p2.status).toBe(200);
    const combinedIds = [...p1.json.posts, ...p2.json.posts].map((p: InstitutionalFeedPost) => p.id);
    expect(new Set(combinedIds).size).toBe(combinedIds.length); // Zero duplicates
    expect(combinedIds).not.toContain('m_newest_inserted');

    // Verify no >3 consecutive posts from same author in full sequence
    const full = await apiCall('/api/feed?limit=20', { uid: 'usr_alumni_3' });
    let run = 0;
    let lastAuthor = '';
    for (const post of full.json.posts as InstitutionalFeedPost[]) {
      if (post.authorId === lastAuthor) run++;
      else {
        lastAuthor = post.authorId;
        run = 1;
      }
      expect(run).toBeLessThanOrEqual(3);
    }

    // Verify editing a post does NOT change its createdAt or position
    const editRes = await apiCall('/api/posts/m_2', {
      method: 'PATCH',
      uid: 'usr_alumni_1',
      body: { content: 'Updated milestone content' }
    });
    expect(editRes.status).toBe(200);
    expect(editRes.json.post.isEdited).toBe(true);
    expect(editRes.json.post.createdAt).toBe(new Date(baseMs + 102000).toISOString());

    const relScore = calculateFeedRelevanceScore(
      {
        id: 'rel_1',
        authorId: 'usr_alumni_1',
        authorName: 'Maria Clara',
        authorRole: 'alumni',
        authorAvatar: '',
        postType: 'milestone',
        title: 'Rel',
        content: 'Rel',
        likes: ['u1', 'u2'],
        hearts: [],
        comments: [
          { id: 'c1', authorId: 'u3', authorName: 'U3', authorAvatar: '', authorRole: 'alumni', text: 'Hi', createdAt: new Date().toISOString() }
        ],
        sharesCount: 0,
        createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString()
      },
      { uid: 'usr_alumni_3', role: 'alumni', batch: '2020', department: 'BSIT' },
      DEFAULT_FEED_CONFIG,
      new Set(['usr_alumni_1']),
      Date.now(),
      { batch: '2020', department: 'BSIT' }
    );
    // (2*1 + 1*2) / (2 + 2)^1.5 = 4 / 8 = 0.5, boosted by 1.3 * 1.3 * 1.25 = 1.05625
    expect(relScore).toBeCloseTo(1.05625, 4);

    const relFeed = await apiCall('/api/feed?sortMode=relevance&limit=10', { uid: 'usr_alumni_3' });
    expect(relFeed.status).toBe(200);
    expect(relFeed.json.sortMode).toBe('relevance');
  });

  // =========================================================================
  // 3. PERSONAL PROFILE TIMELINE, ACCESS, PRIVACY & ACCOUNT DELETION
  // =========================================================================
  it('enforces login-required profiles, field privacy, anonymous exclusion, shared label, tagged exclusion, pinning & account deletion anonymization', async () => {
    // 1. Logged-out visitor blocked from profile endpoints
    const anonProfileRes = await apiCall('/api/profiles/usr_alumni_1');
    expect(anonProfileRes.status).toBe(401);
    const anonTimelineRes = await apiCall('/api/profiles/usr_alumni_1/posts');
    expect(anonTimelineRes.status).toBe(401);

    // 2. Any logged-in alumni can view another profile, with field-level privacy enforced
    const otherProfileRes = await apiCall('/api/profiles/usr_alumni_1', { uid: 'usr_alumni_2' });
    expect(otherProfileRes.status).toBe(200);
    expect(otherProfileRes.json.profile.email).toBeUndefined();
    expect(otherProfileRes.json.profile.phone).toBeUndefined();
    expect(otherProfileRes.json.profile.company).toBeUndefined();

    // Owner sees their own hidden fields
    const selfProfileRes = await apiCall('/api/profiles/usr_alumni_1', { uid: 'usr_alumni_1' });
    expect(selfProfileRes.status).toBe(200);
    expect(selfProfileRes.json.profile.email).toBe('maria@scc.edu.ph');
    expect(selfProfileRes.json.profile.phone).toBe('+63 917 000 1111');
    expect(selfProfileRes.json.profile.company).toBe('Cebu Tech Labs');

    // Create published, anonymous, and tagged posts
    await apiCall('/api/posts', {
      method: 'POST',
      uid: 'usr_alumni_1',
      body: { id: 'tp_1', title: 'First Published', content: 'Hello alumni', visibility: 'alumni' }
    });
    await apiCall('/api/posts', {
      method: 'POST',
      uid: 'usr_alumni_1',
      body: { id: 'tp_anon', title: 'Secret Post', content: 'Anonymous', isAnonymous: true, visibility: 'alumni' }
    });
    await apiCall('/api/posts', {
      method: 'POST',
      uid: 'usr_alumni_2',
      body: {
        id: 'tp_tagged',
        title: 'Tagging Maria',
        content: 'Congrats Maria!',
        taggedUserIds: ['usr_alumni_1'],
        visibility: 'alumni'
      }
    });

    // Alumni 2 shares tp_1 -> gets 'Shared' label on Alumni 2's timeline
    const shareRes = await apiCall('/api/posts/tp_1/share', {
      method: 'POST',
      uid: 'usr_alumni_2',
      body: { commentary: 'Proud of Batch 2020!' }
    });
    expect(shareRes.status).toBe(201);
    expect(shareRes.json.post.sharedLabel).toBe('Shared');

    // Pin tp_1 on Maria's own profile
    const pinRes = await apiCall('/api/profiles/me/pin', {
      method: 'POST',
      uid: 'usr_alumni_1',
      body: { postId: 'tp_1' }
    });
    expect(pinRes.status).toBe(200);

    // Maria's timeline: includes tp_1 (as pinnedPost), EXCLUDES tp_anon (even to Maria!), EXCLUDES tp_tagged!
    const mariaSelfTimeline = await apiCall('/api/profiles/usr_alumni_1/posts', { uid: 'usr_alumni_1' });
    expect(mariaSelfTimeline.status).toBe(200);
    expect(mariaSelfTimeline.json.totalCount).toBe(1);
    expect(mariaSelfTimeline.json.pinnedPost?.id).toBe('tp_1');
    const allMariaTimelineIds = [
      ...(mariaSelfTimeline.json.pinnedPost ? [mariaSelfTimeline.json.pinnedPost.id] : []),
      ...mariaSelfTimeline.json.posts.map((p: InstitutionalFeedPost) => p.id)
    ];
    expect(allMariaTimelineIds).not.toContain('tp_anon');
    expect(allMariaTimelineIds).not.toContain('tp_tagged');

    // Jose's timeline includes his shared post with sharedLabel === 'Shared'
    const joseTimeline = await apiCall('/api/profiles/usr_alumni_2/posts', { uid: 'usr_alumni_3' });
    const sharedEntry = joseTimeline.json.posts.find((p: InstitutionalFeedPost) => p.sharedFromPostId === 'tp_1');
    expect(sharedEntry?.sharedLabel).toBe('Shared');

    // Delete Maria's account -> anonymizes existing posts as 'Former alumni'
    const delAccRes = await apiCall('/api/profiles/me', { method: 'DELETE', uid: 'usr_alumni_1' });
    expect(delAccRes.status).toBe(200);
    expect(delAccRes.json.anonymizedPosts).toBeGreaterThanOrEqual(1);

    const postAfterDel = await apiCall('/api/posts/tp_1', { uid: 'usr_alumni_3' });
    expect(postAfterDel.status).toBe(200);
    expect(postAfterDel.json.post.authorName).toBe('Former alumni');
    expect(postAfterDel.json.post.authorDeleted).toBe(true);

    const deletedProfileView = await apiCall('/api/profiles/usr_alumni_1', { uid: 'usr_alumni_3' });
    expect(deletedProfileView.status).toBe(200);
    expect(deletedProfileView.json.unavailable).toBe(true);
    expect(deletedProfileView.json.profile.name).toBe('Former alumni');
  });

  // =========================================================================
  // 4. MODERATION WORKFLOW, PRIVACY & DEEP-LINK NOTIFICATIONS
  // =========================================================================
  it('enforces post reporting guardrails, snapshot preservation, conflict-of-interest, appeals reversal, and reporter privacy', async () => {
    await apiCall('/api/posts', {
      method: 'POST',
      uid: 'usr_alumni_1',
      body: { id: 'mod_post_1', title: 'Controversial Claim', content: 'Original offensive text' }
    });

    // Self-report blocked
    const selfRep = await apiCall('/api/reports', {
      method: 'POST',
      uid: 'usr_alumni_1',
      body: { targetType: 'post', targetId: 'mod_post_1', reason: 'Spam' }
    });
    expect(selfRep.status).toBe(403);

    // Valid report by alumni_2 (Harassment -> high priority)
    const rep1 = await apiCall('/api/reports', {
      method: 'POST',
      uid: 'usr_alumni_2',
      body: {
        targetType: 'post',
        targetId: 'mod_post_1',
        reason: 'Harassment or bullying',
        details: 'Contains personal attacks'
      }
    });
    expect(rep1.status).toBe(201);
    expect(rep1.json.priority).toBe('high');

    // Duplicate report blocked
    const dupRep = await apiCall('/api/reports', {
      method: 'POST',
      uid: 'usr_alumni_2',
      body: { targetType: 'post', targetId: 'mod_post_1', reason: 'Spam' }
    });
    expect(dupRep.status).toBe(409);

    // Author edits post after report -> snapshot preserved and flagged!
    await apiCall('/api/posts/mod_post_1', {
      method: 'PATCH',
      uid: 'usr_alumni_1',
      body: { content: 'Edited harmless text' }
    });

    const queueRes = await apiCall('/api/moderation/cases?status=pending', { uid: 'usr_mod_1' });
    expect(queueRes.status).toBe(200);
    expect(queueRes.json.cases.length).toBe(1);
    const modCase = queueRes.json.cases[0];
    expect(modCase.contentSnapshot.content).toBe('Original offensive text');
    expect(modCase.contentEditedSinceSnapshot).toBe(true);

    // Mod 1 claims & deletes post
    const claimRes = await apiCall(`/api/moderation/cases/${modCase.id}/claim`, {
      method: 'POST',
      uid: 'usr_mod_1',
      body: {}
    });
    expect(claimRes.status).toBe(200);

    const actRes = await apiCall(`/api/moderation/cases/${modCase.id}/act`, {
      method: 'POST',
      uid: 'usr_mod_1',
      body: {
        action: 'delete_post',
        reason: 'Harassment or bullying',
        message: 'Removed for targeting another alumnus.'
      }
    });
    expect(actRes.status).toBe(200);

    // Feed no longer shows deleted post
    const feedAfterDelete = await apiCall('/api/feed', { uid: 'usr_alumni_3' });
    expect(feedAfterDelete.json.posts.some((p: InstitutionalFeedPost) => p.id === 'mod_post_1')).toBe(false);

    // Privacy check: author notifications never expose reporter identity
    const authorNotifs = await apiCall('/api/moderation/notifications', { uid: 'usr_alumni_1' });
    const serialized = JSON.stringify(authorNotifs.json);
    expect(serialized).not.toContain('usr_alumni_2');
    expect(serialized).not.toContain('Jose Rizal');

    // Author submits one-time appeal
    const appealRes = await apiCall('/api/appeals', {
      method: 'POST',
      uid: 'usr_alumni_1',
      body: { postId: 'mod_post_1', explanation: 'I edited the wording immediately and meant no harm.' }
    });
    expect(appealRes.status).toBe(201);
    const appealId = appealRes.json.appeal.id;

    // Original moderator (usr_mod_1) is BLOCKED from resolving the appeal
    const selfAppealResolve = await apiCall(`/api/appeals/${appealId}/resolve`, {
      method: 'POST',
      uid: 'usr_mod_1',
      body: { outcome: 'uphold', note: 'Trying to review my own action' }
    });
    expect(selfAppealResolve.status).toBe(403);
    expect(selfAppealResolve.json.code).toBe('SAME_MODERATOR_BLOCKED');

    // Different moderator (usr_mod_2) reverses decision -> post restored
    const reverseRes = await apiCall(`/api/appeals/${appealId}/resolve`, {
      method: 'POST',
      uid: 'usr_mod_2',
      body: { outcome: 'reverse', note: 'Approved upon context review' }
    });
    expect(reverseRes.status).toBe(200);
    expect(reverseRes.json.appeal.status).toBe('reversed');

    const restoredPost = await apiCall('/api/posts/mod_post_1', { uid: 'usr_alumni_3' });
    expect(restoredPost.status).toBe(200);
  });

  it('deep-links notifications accurately across all core features and roles', () => {
    const baseNotif = (partial: Partial<AppNotification>): AppNotification => ({
      id: 'n_1',
      toUid: 'u_1',
      type: 'general',
      title: 'Notice',
      body: 'Body',
      read: false,
      createdAt: new Date().toISOString(),
      ...partial
    });

    expect(
      resolveNotificationDeepLink(baseNotif({ type: 'post_comment', refId: 'post_99' }), 'alumni')
    ).toMatchObject({ tab: 'dashboard', targetType: 'feed_post', targetId: 'post_99', subTab: 'comments' });

    expect(
      resolveNotificationDeepLink(baseNotif({ type: 'event', refId: 'evt_5' }), 'alumni')
    ).toMatchObject({ tab: 'events', targetType: 'event', targetId: 'evt_5' });

    expect(
      resolveNotificationDeepLink(
        baseNotif({ type: 'job', refId: 'job_12', title: 'Application Shortlisted', metadata: { applicationId: 'app_1', jobId: 'job_12' } }),
        'alumni'
      )
    ).toMatchObject({ tab: 'opportunities', targetType: 'job', targetId: 'job_12', subTab: 'my_applications' });

    expect(
      resolveNotificationDeepLink(
        baseNotif({ type: 'job', refId: 'emp_1', title: 'Employer Accreditation Pending', metadata: { targetSubTab: 'employers', employerUid: 'emp_1' } }),
        'admin'
      )
    ).toMatchObject({ tab: 'jobs', targetType: 'employer', targetId: 'emp_1', subTab: 'employers' });

    expect(
      resolveNotificationDeepLink(
        baseNotif({ type: 'moderation_high_priority', refId: 'case_88' }),
        'moderator'
      )
    ).toMatchObject({ tab: 'moderation', targetType: 'moderation_queue', targetId: 'case_88', subTab: 'queue' });

    expect(
      resolveNotificationDeepLink(
        baseNotif({ type: 'moderation_appeal', refId: 'app_44' }),
        'moderator'
      )
    ).toMatchObject({ tab: 'moderation', targetType: 'moderation_appeal', targetId: 'app_44', subTab: 'appeals' });

    expect(
      resolveNotificationDeepLink(
        baseNotif({ type: 'friend_request', refId: 'usr_2', fromUid: 'usr_2' }),
        'alumni'
      )
    ).toMatchObject({ tab: 'network', targetType: 'network_request', targetId: 'usr_2', subTab: 'requests' });

    expect(
      resolveNotificationDeepLink(
        baseNotif({ type: 'general', refId: 'conf_7', title: 'Registrar Identity Conflict' }),
        'admin'
      )
    ).toMatchObject({ tab: 'conflicts', targetType: 'conflict', targetId: 'conf_7', subTab: 'conflicts' });
  });

  it('blocks users from congratulating or reacting to their own milestone posts while allowing peers', async () => {
    await apiCall('/api/posts', {
      method: 'POST',
      uid: 'usr_alumni_1',
      body: {
        id: 'ms_own_1',
        postType: 'milestone',
        milestoneBadge: 'Promotion',
        title: 'Promoted to Lead Engineer',
        content: 'Excited for the next chapter!',
        visibility: 'alumni'
      }
    });

    const selfHeart = await apiCall('/api/posts/ms_own_1/react', {
      method: 'POST',
      uid: 'usr_alumni_1',
      body: { reactionType: 'heart' }
    });
    expect(selfHeart.status).toBe(400);
    expect(selfHeart.json.code).toBe('SELF_CONGRATULATION_NOT_ALLOWED');

    const selfLike = await apiCall('/api/posts/ms_own_1/react', {
      method: 'POST',
      uid: 'usr_alumni_1',
      body: { reactionType: 'like' }
    });
    expect(selfLike.status).toBe(400);
    expect(selfLike.json.code).toBe('SELF_CONGRATULATION_NOT_ALLOWED');

    const peerHeart = await apiCall('/api/posts/ms_own_1/react', {
      method: 'POST',
      uid: 'usr_alumni_2',
      body: { reactionType: 'heart' }
    });
    expect(peerHeart.status).toBe(200);
    expect(peerHeart.json.post.hearts).toContain('usr_alumni_2');
  });
});
