import crypto from 'crypto';
import express, { Request, Response, NextFunction, Router } from 'express';
import {
  ModerationActor,
  ModerationError,
  PostModerationEngine,
  isAdminRole,
  isSuperAdminRole,
  postModerationEngine
} from './moderationEngine';

export interface ModerationRouterDependencies {
  requireServerAuth: (req: Request, res: Response, next: NextFunction) => void;
  requireRole: (roles: string[]) => (req: Request, res: Response, next: NextFunction) => void;
  requireSuperAdmin?: (req: Request, res: Response, next: NextFunction) => void;
  onUnauthorizedSuperAdmin?: (req: Request, reason: string, details?: Record<string, unknown>) => void;
  verifyTokenOptional?: (req: Request) => ModerationActor | null;
  csrfSecret: string;
  engine?: PostModerationEngine;
}

export function createCsrfTokenForUser(uid: string, csrfSecret: string): string {
  const payload = {
    uid,
    nonce: crypto.randomBytes(16).toString('hex'),
    exp: Date.now() + 2 * 60 * 60 * 1000 // 2 hours
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', csrfSecret).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifyCsrfTokenForUser(token: string | undefined, uid: string, csrfSecret: string): boolean {
  if (!token || typeof token !== 'string' || !uid) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [encoded, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', csrfSecret).update(encoded).digest('base64url');
  if (sig.length !== expectedSig.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return false;
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8'));
    if (parsed.uid !== uid) return false;
    if (typeof parsed.exp !== 'number' || parsed.exp < Date.now()) return false;
    return true;
  } catch {
    return false;
  }
}

function toActor(req: Request): ModerationActor {
  const u = (req as any).user;
  return {
    uid: u?.uid || '',
    name: u?.name || u?.email || 'Member',
    email: u?.email || '',
    role: u?.role || 'alumni'
  };
}

function handleError(err: unknown, res: Response) {
  if (err instanceof ModerationError) {
    return res.status(err.status).json({ error: err.message, code: err.code });
  }
  console.error('[PostModeration API Error]', err);
  return res.status(500).json({ error: 'An unexpected moderation error occurred.', code: 'INTERNAL_ERROR' });
}

export function createPostModerationRouter(deps: ModerationRouterDependencies): Router {
  const router = express.Router();
  const engine = deps.engine || postModerationEngine;

  const requireCsrf = (req: Request, res: Response, next: NextFunction) => {
    const actor = toActor(req);
    const headerToken = req.headers['x-csrf-token'] as string | undefined;
    if (!verifyCsrfTokenForUser(headerToken, actor.uid, deps.csrfSecret)) {
      return res.status(403).json({
        error: 'Forbidden: Missing or invalid CSRF security token.',
        code: 'CSRF_INVALID'
      });
    }
    next();
  };

  const strictSuperAdminGuard =
    deps.requireSuperAdmin ||
    ((req: Request, res: Response, next: NextFunction) => {
      const actor = toActor(req);
      if (!isSuperAdminRole(actor.role)) {
        if (deps.onUnauthorizedSuperAdmin) {
          deps.onUnauthorizedSuperAdmin(req, 'SUPERADMIN_ROUTE_FORBIDDEN', {
            attemptedPath: req.originalUrl || req.path,
            method: req.method
          });
        } else {
          engine.recordExternalSecurityAudit({
            action: 'UNAUTHORIZED_SUPERADMIN_ACCESS',
            actorId: actor.uid || 'anonymous',
            actorName: actor.name || 'Unknown',
            actorRole: actor.role || 'guest',
            note: `Blocked unauthorized access to ${req.method} ${req.originalUrl || req.path}`,
            metadata: { attemptedPath: req.originalUrl || req.path, method: req.method }
          });
        }
        return res.status(403).json({
          error: 'Forbidden: Super Administrator role required.',
          code: 'SUPERADMIN_REQUIRED',
          auditLogged: true
        });
      }
      next();
    });

  // Issue CSRF token bound to authenticated user
  router.get('/security/csrf-token', deps.requireServerAuth, (req: Request, res: Response) => {
    const actor = toActor(req);
    const csrfToken = createCsrfTokenForUser(actor.uid, deps.csrfSecret);
    res.json({ csrfToken });
  });

  // -------------------------------------------------------------------------
  // 4-STEP MAIN SOCIAL FEED, CONFIG, GATED MEDIA & AUTHORITATIVE POST ACTIONS
  // -------------------------------------------------------------------------
  router.get('/config/features', (_req: Request, res: Response) => {
    try {
      res.json(engine.getPublicFeatureConfig());
    } catch (err) {
      handleError(err, res);
    }
  });

  router.get('/feed', (req: Request, res: Response) => {
    try {
      const viewer = deps.verifyTokenOptional ? deps.verifyTokenOptional(req) : null;
      const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
      const limit = req.query.limit !== undefined ? Number(req.query.limit) : undefined;
      const postType = typeof req.query.postType === 'string' ? req.query.postType : undefined;
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;
      const sortMode =
        req.query.sortMode === 'chronological' || req.query.sortMode === 'relevance'
          ? req.query.sortMode
          : undefined;
      const seenIds =
        typeof req.query.seenIds === 'string'
          ? req.query.seenIds.split(',').map((s) => s.trim()).filter(Boolean)
          : undefined;
      const interactedAuthorIds =
        typeof req.query.interactedAuthorIds === 'string'
          ? req.query.interactedAuthorIds.split(',').map((s) => s.trim()).filter(Boolean)
          : undefined;

      const result = engine.getMainFeed(viewer, {
        cursor,
        limit,
        postType,
        search,
        sortMode,
        seenIds,
        interactedAuthorIds
      });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  });

  router.get('/feed/new-count', (req: Request, res: Response) => {
    try {
      const viewer = deps.verifyTokenOptional ? deps.verifyTokenOptional(req) : null;
      const since = typeof req.query.since === 'string' ? req.query.since : undefined;
      const postType = typeof req.query.postType === 'string' ? req.query.postType : undefined;
      res.json(engine.getNewFeedPostsCount(viewer, { since, postType }));
    } catch (err) {
      handleError(err, res);
    }
  });

  router.get('/feed/config', (_req: Request, res: Response) => {
    try {
      res.json({ config: engine.getFeedConfig() });
    } catch (err) {
      handleError(err, res);
    }
  });

  router.put(
    '/feed/config',
    deps.requireServerAuth,
    deps.requireRole(['admin', 'superadmin']),
    requireCsrf,
    (req: Request, res: Response) => {
      try {
        const actor = toActor(req);
        const config = engine.updateFeedConfig(actor, req.body || {});
        res.json({ config });
      } catch (err) {
        handleError(err, res);
      }
    }
  );

  router.get('/posts', (req: Request, res: Response) => {
    try {
      const viewer = deps.verifyTokenOptional ? deps.verifyTokenOptional(req) : null;
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;
      const authorId = typeof req.query.authorId === 'string' ? req.query.authorId : undefined;
      const includeDeletedForMod = req.query.includeDeleted === 'true';
      const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
      const limit = req.query.limit !== undefined ? Number(req.query.limit) : undefined;
      const postType = typeof req.query.postType === 'string' ? req.query.postType : undefined;

      if (cursor !== undefined || limit !== undefined || postType !== undefined) {
        const paged = engine.getVisiblePostsPaginated(viewer, { search, cursor, limit, postType });
        return res.json(paged);
      }

      const posts = engine.getVisiblePosts(viewer, { search, authorId, includeDeletedForMod });
      res.json({ posts });
    } catch (err) {
      handleError(err, res);
    }
  });

  router.get('/posts/:postId', (req: Request, res: Response) => {
    try {
      const viewer = deps.verifyTokenOptional ? deps.verifyTokenOptional(req) : null;
      const post = engine.getPostByIdForViewer(req.params.postId, viewer);
      if (!post) {
        return res.status(404).json({ error: 'Post not found.' });
      }
      res.json({ post });
    } catch (err) {
      handleError(err, res);
    }
  });

  router.get('/posts/:postId/media', (req: Request, res: Response) => {
    try {
      const viewer = deps.verifyTokenOptional ? deps.verifyTokenOptional(req) : null;
      const mediaResult = engine.getPostMediaForViewer(req.params.postId, viewer);
      if (!mediaResult.allowed) {
        return res.status(mediaResult.status).json({ error: mediaResult.error || 'Media unavailable.' });
      }
      if (req.query.format === 'json') {
        return res.json({ imageUrl: mediaResult.imageUrl, mimeType: mediaResult.mimeType });
      }
      if (mediaResult.imageUrl?.startsWith('data:')) {
        const match = /^data:([^;]+);base64,(.+)$/.exec(mediaResult.imageUrl);
        if (match) {
          res.setHeader('Content-Type', match[1]);
          return res.send(Buffer.from(match[2], 'base64'));
        }
      }
      return res.json({ imageUrl: mediaResult.imageUrl, mimeType: mediaResult.mimeType });
    } catch (err) {
      handleError(err, res);
    }
  });

  router.post('/posts', deps.requireServerAuth, requireCsrf, (req: Request, res: Response) => {
    try {
      const actor = toActor(req);
      if (String(actor.role || '').toLowerCase().trim() === 'employer') {
        return res.status(403).json({ error: 'Employer accounts cannot publish feed posts.' });
      }
      const body = req.body || {};
      const actorIsAdmin = isAdminRole(actor.role);
      const normalizedPostType =
        body.postType === 'gallery' || body.postType === 'announcement' ? body.postType : 'update';
      const post = engine.upsertPost(
        {
          id: body.id || `post_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
          authorId: actor.uid,
          authorName: body.authorName || actor.name,
          authorRole: (actor.role as any) || 'alumni',
          authorAvatar: body.authorAvatar || '',
          postType: normalizedPostType,
          title: body.title || 'Community Post',
          content: body.content || '',
          imageUrl: body.imageUrl,
          mediaUrl: body.mediaUrl,
          likes: Array.isArray(body.likes) ? body.likes : [],
          hearts: Array.isArray(body.hearts) ? body.hearts : [],
          comments: Array.isArray(body.comments) ? body.comments : [],
          sharesCount: Number(body.sharesCount) || 0,
          createdAt: body.createdAt || new Date().toISOString(),
          isPinned: actorIsAdmin ? !!body.isPinned : false,
          pinExpiresAt: actorIsAdmin ? body.pinExpiresAt : undefined,
          tags: Array.isArray(body.tags) ? body.tags : undefined,
          status: body.status || 'published',
          visibility: body.visibility || 'alumni',
          groupId: body.groupId,
          groupName: body.groupName,
          targetBatch: body.targetBatch,
          targetDepartment: body.targetDepartment,
          isAnonymous: !!body.isAnonymous,
          taggedUserIds: Array.isArray(body.taggedUserIds) ? body.taggedUserIds : undefined,
          scheduledFor: body.scheduledFor
        },
        actor
      );
      res.status(201).json({ post: engine.projectPostForViewer(post, actor) });
    } catch (err) {
      handleError(err, res);
    }
  });

  router.post('/posts/:postId/share', deps.requireServerAuth, requireCsrf, (req: Request, res: Response) => {
    try {
      const actor = toActor(req);
      if (String(actor.role || '').toLowerCase().trim() === 'employer') {
        return res.status(403).json({ error: 'Employer accounts cannot share or publish feed posts.' });
      }
      const shared = engine.sharePost(actor, req.params.postId, req.body?.commentary);
      res.status(201).json({ post: shared });
    } catch (err) {
      handleError(err, res);
    }
  });

  router.post('/posts/:postId/react', deps.requireServerAuth, requireCsrf, (req: Request, res: Response) => {
    try {
      const actor = toActor(req);
      const reactionType = req.body?.reactionType === 'like' ? 'like' : 'heart';
      const result = engine.togglePostReaction(req.params.postId, actor, reactionType);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  });

  router.post('/posts/:postId/comments', deps.requireServerAuth, requireCsrf, (req: Request, res: Response) => {
    try {
      const actor = toActor(req);
      const result = engine.addPostComment(req.params.postId, actor, req.body?.text);
      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  });

  // Sync existing client posts & profiles (without bypassing moderation flags)
  router.post('/posts/sync', deps.requireServerAuth, requireCsrf, (req: Request, res: Response) => {
    try {
      const actor = toActor(req);
      const incomingProfiles = Array.isArray(req.body?.profiles) ? req.body.profiles : [];
      for (const prof of incomingProfiles.slice(0, 200)) {
        if (prof?.uid) {
          engine.upsertProfileRecord(prof, false);
        }
      }
      const incomingPosts = Array.isArray(req.body?.posts) ? req.body.posts : [];
      for (const p of incomingPosts.slice(0, 200)) {
        if (p?.id) {
          engine.upsertPost(p);
        }
      }
      const legacyAudit = engine.auditAndNormalizeLegacyPosts();
      const visible = engine.getVisiblePosts(actor);
      res.json({ posts: visible, legacyAudit });
    } catch (err) {
      handleError(err, res);
    }
  });

  router.patch('/posts/:postId', deps.requireServerAuth, requireCsrf, (req: Request, res: Response) => {
    try {
      const actor = toActor(req);
      const updated = engine.editPostByAuthor(req.params.postId, actor, {
        title: req.body?.title,
        content: req.body?.content,
        imageUrl: req.body?.imageUrl,
        tags: req.body?.tags,
        visibility: req.body?.visibility,
        status: req.body?.status,
        isPinned: req.body?.isPinned,
        pinExpiresAt: req.body?.pinExpiresAt
      });
      res.json({ post: updated });
    } catch (err) {
      handleError(err, res);
    }
  });

  router.delete('/posts/:postId', deps.requireServerAuth, requireCsrf, (req: Request, res: Response) => {
    try {
      const actor = toActor(req);
      const result = engine.deletePostByUser(req.params.postId, actor);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  });

  // -------------------------------------------------------------------------
  // PERSONAL PROFILE TIMELINE, ACCESS CONTROL, PINNING & BLOCKING
  // -------------------------------------------------------------------------
  router.get('/profiles/:identifier', deps.requireServerAuth, (req: Request, res: Response) => {
    try {
      const actor = toActor(req);
      const id = req.params.identifier === 'me' ? actor.uid : req.params.identifier;
      const result = engine.getPublicProfileForViewer(id, actor);
      if (result.redirectToSlug && req.query.noRedirect !== 'true') {
        const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
        return res.redirect(301, `/api/profiles/${encodeURIComponent(result.redirectToSlug)}${qs}`);
      }
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  });

  router.get('/profiles/:identifier/posts', deps.requireServerAuth, (req: Request, res: Response) => {
    try {
      const actor = toActor(req);
      const id = req.params.identifier === 'me' ? actor.uid : req.params.identifier;
      const result = engine.getProfileTimeline(id, actor, {
        cursor: typeof req.query.cursor === 'string' ? req.query.cursor : undefined,
        limit: req.query.limit !== undefined ? Number(req.query.limit) : 10,
        tab: (req.query.tab as any) || 'posts',
        postType: typeof req.query.postType === 'string' ? req.query.postType : undefined,
        year: typeof req.query.year === 'string' ? req.query.year : undefined
      });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  });

  router.patch('/profiles/me', deps.requireServerAuth, requireCsrf, (req: Request, res: Response) => {
    try {
      const actor = toActor(req);
      const result = engine.updateMyProfile(actor, req.body || {});
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  });

  router.post('/profiles/me/pin', deps.requireServerAuth, requireCsrf, (req: Request, res: Response) => {
    try {
      const actor = toActor(req);
      const result = engine.setPinnedPostForUser(actor, req.body?.postId || null);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  });

  router.delete('/profiles/me/pin', deps.requireServerAuth, requireCsrf, (req: Request, res: Response) => {
    try {
      const actor = toActor(req);
      const result = engine.setPinnedPostForUser(actor, null);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  });

  router.post('/profiles/:targetUid/block', deps.requireServerAuth, requireCsrf, (req: Request, res: Response) => {
    try {
      const actor = toActor(req);
      const result = engine.setUserBlock(actor, req.params.targetUid, true);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  });

  router.delete('/profiles/:targetUid/block', deps.requireServerAuth, requireCsrf, (req: Request, res: Response) => {
    try {
      const actor = toActor(req);
      const result = engine.setUserBlock(actor, req.params.targetUid, false);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  });

  router.delete('/profiles/me', deps.requireServerAuth, requireCsrf, (req: Request, res: Response) => {
    try {
      const actor = toActor(req);
      const result = engine.deleteAndAnonymizeAccount(actor.uid, actor);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  });

  router.delete(
    '/profiles/:targetUid',
    deps.requireServerAuth,
    deps.requireRole(['admin', 'superadmin']),
    requireCsrf,
    (req: Request, res: Response) => {
      try {
        const actor = toActor(req);
        const result = engine.deleteAndAnonymizeAccount(req.params.targetUid, actor);
        res.json(result);
      } catch (err) {
        handleError(err, res);
      }
    }
  );

  // -------------------------------------------------------------------------
  // ALUMNI: REPORT A POST
  // -------------------------------------------------------------------------
  router.post('/reports', deps.requireServerAuth, requireCsrf, (req: Request, res: Response) => {
    try {
      const actor = toActor(req);
      const { targetType, targetId, reason, details, postSnapshotFallback } = req.body || {};
      const result = engine.submitPostReport(actor, {
        targetType,
        targetId,
        reason,
        details,
        postSnapshotFallback
      });
      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  });

  // -------------------------------------------------------------------------
  // MODERATOR & ADMIN DASHBOARD ENDPOINTS
  // -------------------------------------------------------------------------
  router.get(
    '/moderation/pending-count',
    deps.requireServerAuth,
    deps.requireRole(['moderator', 'admin', 'superadmin']),
    (req: Request, res: Response) => {
      try {
        const actor = toActor(req);
        res.json({ pendingCount: engine.getPendingCountForModerator(actor) });
      } catch (err) {
        handleError(err, res);
      }
    }
  );

  router.get(
    '/moderation/cases',
    deps.requireServerAuth,
    deps.requireRole(['moderator', 'admin', 'superadmin']),
    (req: Request, res: Response) => {
      try {
        const actor = toActor(req);
        const result = engine.listModerationCases(actor, {
          page: Number(req.query.page) || 1,
          pageSize: Number(req.query.pageSize) || 10,
          status: typeof req.query.status === 'string' ? req.query.status : undefined,
          reason: typeof req.query.reason === 'string' ? req.query.reason : undefined,
          priority: typeof req.query.priority === 'string' ? req.query.priority : undefined,
          dateFrom: typeof req.query.dateFrom === 'string' ? req.query.dateFrom : undefined,
          dateTo: typeof req.query.dateTo === 'string' ? req.query.dateTo : undefined,
          sort: (req.query.sort as any) || 'priority',
          search: typeof req.query.search === 'string' ? req.query.search : undefined
        });
        res.json(result);
      } catch (err) {
        handleError(err, res);
      }
    }
  );

  router.get(
    '/moderation/cases/:caseId',
    deps.requireServerAuth,
    deps.requireRole(['moderator', 'admin', 'superadmin']),
    (req: Request, res: Response) => {
      try {
        const actor = toActor(req);
        const detail = engine.getModerationCaseDetail(req.params.caseId, actor);
        res.json(detail);
      } catch (err) {
        handleError(err, res);
      }
    }
  );

  router.post(
    '/moderation/cases/:caseId/claim',
    deps.requireServerAuth,
    deps.requireRole(['moderator', 'admin', 'superadmin']),
    requireCsrf,
    (req: Request, res: Response) => {
      try {
        const actor = toActor(req);
        const updated = engine.claimModerationCase(req.params.caseId, actor);
        res.json({ case: updated });
      } catch (err) {
        handleError(err, res);
      }
    }
  );

  router.post(
    '/moderation/cases/:caseId/release',
    deps.requireServerAuth,
    deps.requireRole(['moderator', 'admin', 'superadmin']),
    requireCsrf,
    (req: Request, res: Response) => {
      try {
        const actor = toActor(req);
        const updated = engine.releaseModerationCase(req.params.caseId, actor);
        res.json({ case: updated });
      } catch (err) {
        handleError(err, res);
      }
    }
  );

  router.post(
    '/moderation/cases/:caseId/act',
    deps.requireServerAuth,
    deps.requireRole(['moderator', 'admin', 'superadmin']),
    requireCsrf,
    (req: Request, res: Response) => {
      try {
        const actor = toActor(req);
        const { action, message, reason, note } = req.body || {};
        const result = engine.actOnModerationCase(req.params.caseId, actor, {
          action,
          message,
          reason,
          note
        });
        res.json(result);
      } catch (err) {
        handleError(err, res);
      }
    }
  );

  router.post(
    '/moderation/cases/:caseId/override',
    deps.requireServerAuth,
    deps.requireRole(['admin', 'superadmin']),
    requireCsrf,
    (req: Request, res: Response) => {
      try {
        const actor = toActor(req);
        const { newDecision, note } = req.body || {};
        const updated = engine.overrideModerationDecision(req.params.caseId, actor, {
          newDecision,
          note
        });
        res.json({ case: updated });
      } catch (err) {
        handleError(err, res);
      }
    }
  );

  router.post(
    '/moderation/posts/:postId/restore',
    deps.requireServerAuth,
    deps.requireRole(['moderator', 'admin', 'superadmin']),
    requireCsrf,
    (req: Request, res: Response) => {
      try {
        const actor = toActor(req);
        const { note, adminApprovalGranted } = req.body || {};
        const post = engine.restoreSoftDeletedPost(req.params.postId, actor, note, !!adminApprovalGranted);
        res.json({ post });
      } catch (err) {
        handleError(err, res);
      }
    }
  );

  router.post(
    '/moderation/users/:userId/sanction',
    deps.requireServerAuth,
    deps.requireRole(['admin', 'superadmin']),
    requireCsrf,
    (req: Request, res: Response) => {
      try {
        const actor = toActor(req);
        const { action, reason, durationDays } = req.body || {};
        const result = engine.applyOrLiftSanction(actor, req.params.userId, {
          action,
          reason,
          durationDays
        });
        res.json(result);
      } catch (err) {
        handleError(err, res);
      }
    }
  );

  router.get(
    '/moderation/abuse/reporters',
    deps.requireServerAuth,
    deps.requireRole(['moderator', 'admin', 'superadmin']),
    (req: Request, res: Response) => {
      try {
        const actor = toActor(req);
        res.json({ reporters: engine.getReporterTrackingList(actor) });
      } catch (err) {
        handleError(err, res);
      }
    }
  );

  router.get(
    '/moderation/abuse/ban-flags',
    deps.requireServerAuth,
    deps.requireRole(['admin', 'superadmin']),
    (req: Request, res: Response) => {
      try {
        const actor = toActor(req);
        res.json({ banFlags: engine.getFlaggedBanUsers(actor) });
      } catch (err) {
        handleError(err, res);
      }
    }
  );

  // Immutable Audit Logs (Read-only, strictly Superadmin only)
  router.get(
    '/moderation/audit-logs',
    deps.requireServerAuth,
    strictSuperAdminGuard,
    (req: Request, res: Response) => {
      try {
        const actor = toActor(req);
        res.json({ auditLogs: engine.getAuditLogs(actor) });
      } catch (err) {
        handleError(err, res);
      }
    }
  );

  const blockAuditMutation = (_req: Request, res: Response) => {
    res.status(403).json({
      error: 'Audit records are permanent and cannot be edited or deleted.',
      code: 'AUDIT_LOG_IMMUTABLE'
    });
  };
  router.put('/moderation/audit-logs*', deps.requireServerAuth, strictSuperAdminGuard, blockAuditMutation);
  router.patch('/moderation/audit-logs*', deps.requireServerAuth, strictSuperAdminGuard, blockAuditMutation);
  router.delete('/moderation/audit-logs*', deps.requireServerAuth, strictSuperAdminGuard, blockAuditMutation);

  // Admin-configurable policy thresholds
  router.get(
    '/moderation/config',
    deps.requireServerAuth,
    deps.requireRole(['moderator', 'admin', 'superadmin']),
    (req: Request, res: Response) => {
      try {
        const actor = toActor(req);
        res.json({ config: engine.getConfig(actor) });
      } catch (err) {
        handleError(err, res);
      }
    }
  );

  router.put(
    '/moderation/config',
    deps.requireServerAuth,
    deps.requireRole(['admin', 'superadmin']),
    requireCsrf,
    (req: Request, res: Response) => {
      try {
        const actor = toActor(req);
        const config = engine.updateConfig(actor, req.body || {});
        res.json({ config });
      } catch (err) {
        handleError(err, res);
      }
    }
  );

  router.get(
    '/moderation/legacy-audit',
    deps.requireServerAuth,
    strictSuperAdminGuard,
    (_req: Request, res: Response) => {
      try {
        res.json({ legacyAuditReport: engine.getLegacyAuditReport() });
      } catch (err) {
        handleError(err, res);
      }
    }
  );

  // -------------------------------------------------------------------------
  // APPEALS WORKFLOW
  // -------------------------------------------------------------------------
  router.post('/appeals', deps.requireServerAuth, requireCsrf, (req: Request, res: Response) => {
    try {
      const actor = toActor(req);
      const { postId, explanation } = req.body || {};
      const appeal = engine.submitAppeal(actor, { postId, explanation });
      res.status(201).json({ appeal });
    } catch (err) {
      handleError(err, res);
    }
  });

  router.get('/appeals', deps.requireServerAuth, (req: Request, res: Response) => {
    try {
      const actor = toActor(req);
      res.json({ appeals: engine.listAppeals(actor) });
    } catch (err) {
      handleError(err, res);
    }
  });

  router.post(
    '/appeals/:appealId/resolve',
    deps.requireServerAuth,
    deps.requireRole(['moderator', 'admin', 'superadmin']),
    requireCsrf,
    (req: Request, res: Response) => {
      try {
        const actor = toActor(req);
        const { outcome, note } = req.body || {};
        const appeal = engine.resolveAppeal(req.params.appealId, actor, { outcome, note });
        res.json({ appeal });
      } catch (err) {
        handleError(err, res);
      }
    }
  );

  // -------------------------------------------------------------------------
  // PRIVACY-SAFE NOTIFICATIONS & AUTHOR WARNINGS
  // -------------------------------------------------------------------------
  router.get('/moderation/notifications', deps.requireServerAuth, (req: Request, res: Response) => {
    try {
      const actor = toActor(req);
      res.json({ notifications: engine.getNotificationsForUser(actor) });
    } catch (err) {
      handleError(err, res);
    }
  });

  router.post('/moderation/notifications/:id/read', deps.requireServerAuth, requireCsrf, (req: Request, res: Response) => {
    try {
      const actor = toActor(req);
      const updated = engine.markNotificationRead(actor, req.params.id);
      res.json({ success: updated });
    } catch (err) {
      handleError(err, res);
    }
  });

  router.get('/moderation/my-warnings', deps.requireServerAuth, (req: Request, res: Response) => {
    try {
      const actor = toActor(req);
      res.json({ warnings: engine.getMyWarnings(actor) });
    } catch (err) {
      handleError(err, res);
    }
  });

  return router;
}
