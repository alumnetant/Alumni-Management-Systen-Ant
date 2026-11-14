import crypto from 'crypto';
import express, { Request, Response, NextFunction, Router } from 'express';
import {
  ModerationActor,
  ModerationError,
  PostModerationEngine,
  postModerationEngine
} from './moderationEngine';

export interface ModerationRouterDependencies {
  requireServerAuth: (req: Request, res: Response, next: NextFunction) => void;
  requireRole: (roles: string[]) => (req: Request, res: Response, next: NextFunction) => void;
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

  // Issue CSRF token bound to authenticated user
  router.get('/security/csrf-token', deps.requireServerAuth, (req: Request, res: Response) => {
    const actor = toActor(req);
    const csrfToken = createCsrfTokenForUser(actor.uid, deps.csrfSecret);
    res.json({ csrfToken });
  });

  // -------------------------------------------------------------------------
  // FEED POSTS & PRIVACY-SAFE PROJECTION ENDPOINTS
  // -------------------------------------------------------------------------
  router.get('/posts', (req: Request, res: Response) => {
    try {
      const viewer = deps.verifyTokenOptional ? deps.verifyTokenOptional(req) : null;
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;
      const authorId = typeof req.query.authorId === 'string' ? req.query.authorId : undefined;
      const includeDeletedForMod = req.query.includeDeleted === 'true';
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

  router.post('/posts', deps.requireServerAuth, requireCsrf, (req: Request, res: Response) => {
    try {
      const actor = toActor(req);
      const body = req.body || {};
      const post = engine.upsertPost(
        {
          id: body.id || `post_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
          authorId: actor.uid,
          authorName: body.authorName || actor.name,
          authorRole: (actor.role as any) || 'alumni',
          authorAvatar: body.authorAvatar || '',
          postType: body.postType || 'milestone',
          title: body.title || 'Community Post',
          content: body.content || '',
          imageUrl: body.imageUrl,
          milestoneBadge: body.milestoneBadge,
          likes: Array.isArray(body.likes) ? body.likes : [],
          hearts: Array.isArray(body.hearts) ? body.hearts : [],
          comments: Array.isArray(body.comments) ? body.comments : [],
          sharesCount: Number(body.sharesCount) || 0,
          createdAt: body.createdAt || new Date().toISOString(),
          isPinned: !!body.isPinned,
          tags: Array.isArray(body.tags) ? body.tags : undefined
        },
        actor
      );
      res.status(201).json({ post: engine.projectPostForViewer(post, actor) });
    } catch (err) {
      handleError(err, res);
    }
  });

  // Sync existing client posts (used during initial feed load / optimistic sync without bypassing moderation flags)
  router.post('/posts/sync', deps.requireServerAuth, requireCsrf, (req: Request, res: Response) => {
    try {
      const actor = toActor(req);
      const incomingPosts = Array.isArray(req.body?.posts) ? req.body.posts : [];
      for (const p of incomingPosts.slice(0, 100)) {
        if (p?.id && p?.authorId) {
          engine.upsertPost(p);
        }
      }
      const visible = engine.getVisiblePosts(actor);
      res.json({ posts: visible });
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
        tags: req.body?.tags
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

  // Immutable Audit Logs (Read-only)
  router.get(
    '/moderation/audit-logs',
    deps.requireServerAuth,
    deps.requireRole(['moderator', 'admin', 'superadmin']),
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
  router.put('/moderation/audit-logs*', deps.requireServerAuth, blockAuditMutation);
  router.patch('/moderation/audit-logs*', deps.requireServerAuth, blockAuditMutation);
  router.delete('/moderation/audit-logs*', deps.requireServerAuth, blockAuditMutation);

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
