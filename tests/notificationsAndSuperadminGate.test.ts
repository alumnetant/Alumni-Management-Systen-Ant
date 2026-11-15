import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import type { AddressInfo } from 'net';
import {
  buildPortalUrlForTab,
  createNotificationPayload,
  isSuperAdminRestrictedTarget,
  normalizeNotificationPayload,
  parsePortalUrlPath,
  resolveNotificationDeepLink
} from '../src/lib/notificationDeepLink';
import type { AppNotification } from '../src/types';
import { app, createSignedSessionToken } from '../server';

describe('Notification targetPath/targetRoute Deep-Linking & Clean /portal URL Parsing', () => {
  it('enforces targetPath and targetRoute on createNotificationPayload and normalizeNotificationPayload across all core modules', () => {
    const cases: Array<{
      input: Omit<AppNotification, 'id' | 'createdAt' | 'read'>;
      role?: string;
      expectedPath: string;
      expectedTab: string;
      expectedType: string;
    }> = [
      {
        input: {
          toUid: 'usr_alumni_1',
          type: 'event',
          title: 'Alumni Homecoming',
          body: 'New event scheduled.',
          refId: '123'
        },
        role: 'alumni',
        expectedPath: '/portal/events/123',
        expectedTab: 'events',
        expectedType: 'event'
      },
      {
        input: {
          toUid: 'usr_alumni_1',
          type: 'post_comment',
          title: 'New comment',
          body: 'Someone commented on your post.',
          refId: 'post_42'
        },
        role: 'alumni',
        expectedPath: '/portal/feed/post_42',
        expectedTab: 'dashboard',
        expectedType: 'feed_post'
      },
      {
        input: {
          toUid: 'usr_alumni_1',
          type: 'announcement',
          title: 'Registrar Notice',
          body: 'Updated schedule.',
          refId: 'ann_9'
        },
        role: 'alumni',
        expectedPath: '/portal/announcements/ann_9',
        expectedTab: 'announcements',
        expectedType: 'announcement'
      },
      {
        input: {
          toUid: 'usr_alumni_1',
          type: 'message',
          title: 'New Message',
          body: 'Hello!',
          refId: 'chat_77'
        },
        role: 'alumni',
        expectedPath: '/portal/messages/chat_77',
        expectedTab: 'messages',
        expectedType: 'message'
      },
      {
        input: {
          toUid: 'usr_alumni_1',
          type: 'friend_request',
          fromUid: 'usr_alumni_2',
          title: 'Connection Request',
          body: 'Wants to connect.',
          refId: 'req_15'
        },
        role: 'alumni',
        expectedPath: '/portal/network/requests/req_15',
        expectedTab: 'network',
        expectedType: 'network_request'
      },
      {
        input: {
          toUid: 'usr_alumni_1',
          type: 'friend_accepted',
          fromUid: 'usr_alumni_2',
          title: 'Request Accepted',
          body: 'Accepted your request.',
          refId: 'usr_alumni_2'
        },
        role: 'alumni',
        expectedPath: '/portal/network/connections/usr_alumni_2',
        expectedTab: 'network',
        expectedType: 'network_profile'
      },
      {
        input: {
          toUid: 'usr_alumni_1',
          type: 'job',
          title: 'Application Shortlisted',
          body: 'You were shortlisted for Backend Engineer.',
          refId: 'app_501',
          metadata: { applicationId: 'app_501', jobId: 'job_22' }
        },
        role: 'alumni',
        expectedPath: '/portal/opportunities/applications/app_501',
        expectedTab: 'opportunities',
        expectedType: 'job'
      },
      {
        input: {
          toUid: 'usr_employer_1',
          type: 'job',
          title: 'New Candidate Application',
          body: 'Maria Clara applied for your job.',
          refId: 'job_22',
          metadata: { applicationId: 'app_501', jobId: 'job_22' }
        },
        role: 'employer',
        expectedPath: '/portal/employer-portal/job_22',
        expectedTab: 'employer_portal',
        expectedType: 'job'
      },
      {
        input: {
          toUid: 'usr_admin',
          type: 'job',
          title: 'Employer Accreditation Pending',
          body: 'Acme Corp awaiting review.',
          refId: 'emp_88',
          metadata: { targetSubTab: 'employers', employerUid: 'emp_88' }
        },
        role: 'admin',
        expectedPath: '/portal/jobs/employers/emp_88',
        expectedTab: 'jobs',
        expectedType: 'employer'
      },
      {
        input: {
          toUid: 'usr_mod_1',
          type: 'moderation_high_priority',
          title: 'High Priority Report',
          body: 'Harassment report threshold reached.',
          refId: 'case_99'
        },
        role: 'moderator',
        expectedPath: '/portal/moderation/case_99',
        expectedTab: 'moderation',
        expectedType: 'moderation_queue'
      },
      {
        input: {
          toUid: 'usr_mod_1',
          type: 'moderation_appeal',
          title: 'Appeal Submitted',
          body: 'Author appealed decision.',
          refId: 'appeal_11'
        },
        role: 'moderator',
        expectedPath: '/portal/moderation/appeals/appeal_11',
        expectedTab: 'moderation',
        expectedType: 'moderation_appeal'
      },
      {
        input: {
          toUid: 'usr_alumni_1',
          type: 'moderation_warning',
          title: 'Moderation Warning',
          body: 'Please review community guidelines.',
          refId: 'post_9'
        },
        role: 'alumni',
        expectedPath: '/portal/profile/moderation/post_9',
        expectedTab: 'profile',
        expectedType: 'profile_moderation'
      }
    ];

    for (const c of cases) {
      const created = createNotificationPayload(c.input, c.role);
      expect(created.targetPath).toBe(c.expectedPath);
      expect(created.targetRoute).toBe(c.expectedPath);

      // Verify legacy notifications without targetPath/targetRoute get normalized seamlessly
      const legacy = { ...created, targetPath: undefined, targetRoute: undefined };
      const normalized = normalizeNotificationPayload(legacy, c.role);
      expect(normalized.targetPath).toBe(c.expectedPath);
      expect(normalized.targetRoute).toBe(c.expectedPath);

      const resolved = resolveNotificationDeepLink(created, c.role);
      expect(resolved.tab).toBe(c.expectedTab);
      expect(resolved.targetType).toBe(c.expectedType);
      expect(resolved.targetPath).toBe(c.expectedPath);
      expect(resolved.targetRoute).toBe(c.expectedPath);
    }
  });

  it('parses clean /portal/... browser routes and enforces superadmin flags strictly on audit, database, and indexes', () => {
    const evtRoute = parsePortalUrlPath('/portal/events/123', 'alumni');
    expect(evtRoute.isPortalPath).toBe(true);
    expect(evtRoute.tab).toBe('events');
    expect(evtRoute.targetType).toBe('event');
    expect(evtRoute.targetId).toBe('123');
    expect(evtRoute.requiresSuperAdmin).toBe(false);

    const feedRoute = parsePortalUrlPath('/portal/feed/post_abc', 'alumni');
    expect(feedRoute.tab).toBe('dashboard');
    expect(feedRoute.targetType).toBe('feed_post');
    expect(feedRoute.targetId).toBe('post_abc');

    const appsRoute = parsePortalUrlPath('/portal/opportunities/applications/app_12', 'alumni');
    expect(appsRoute.tab).toBe('opportunities');
    expect(appsRoute.subTab).toBe('my_applications');
    expect(appsRoute.targetId).toBe('app_12');

    const appealsRoute = parsePortalUrlPath('/portal/moderation/appeals/appeal_5', 'moderator');
    expect(appealsRoute.tab).toBe('moderation');
    expect(appealsRoute.subTab).toBe('appeals');
    expect(appealsRoute.targetType).toBe('moderation_appeal');
    expect(appealsRoute.targetId).toBe('appeal_5');

    for (const restrictedPath of ['/portal/audit', '/portal/audit/entry_1', '/portal/database', '/portal/indexes']) {
      const parsed = parsePortalUrlPath(restrictedPath, 'admin');
      expect(parsed.requiresSuperAdmin).toBe(true);
      expect(isSuperAdminRestrictedTarget(restrictedPath)).toBe(true);
    }

    expect(isSuperAdminRestrictedTarget('audit')).toBe(true);
    expect(isSuperAdminRestrictedTarget('database')).toBe(true);
    expect(isSuperAdminRestrictedTarget('indexes')).toBe(true);
    expect(isSuperAdminRestrictedTarget('/portal/events/123')).toBe(false);
    expect(isSuperAdminRestrictedTarget('moderation')).toBe(false);

    expect(buildPortalUrlForTab('events', undefined, '123')).toBe('/portal/events/123');
    expect(buildPortalUrlForTab('dashboard', undefined, 'post_5')).toBe('/portal/feed/post_5');
  });
});

describe('Strict Superadmin Middleware & Unauthorized Access Audit Logging (Express Integration)', () => {
  let server: http.Server;
  let baseUrl: string;

  const makeToken = (role: string, uid: string, email: string) =>
    createSignedSessionToken({
      uid,
      email,
      name: `${role.toUpperCase()} User`,
      role,
      exp: Date.now() + 60 * 60 * 1000
    });

  const authedFetch = async (
    path: string,
    token: string,
    options: { method?: string; body?: unknown } = {}
  ) => {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`
    };
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    const res = await fetch(`${baseUrl}${path}`, {
      method: options.method || 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined
    });
    const json = await res.json().catch(() => null);
    return { status: res.status, json };
  };

  beforeAll(async () => {
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as AddressInfo).port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('returns 403 Forbidden and logs unauthorized attempts for admin, moderator, employer, and alumni on all superadmin endpoints', async () => {
    const nonSuperAdmins = [
      { role: 'admin', uid: 'test_admin_1', email: 'test.admin@scc.edu.ph' },
      { role: 'moderator', uid: 'test_mod_1', email: 'test.mod@scc.edu.ph' },
      { role: 'alumni', uid: 'test_alum_1', email: 'test.alum@scc.edu.ph' },
      { role: 'employer', uid: 'test_emp_1', email: 'test.emp@company.com' }
    ];

    const restrictedRequests: Array<{ path: string; method: string; body?: unknown }> = [
      { path: '/api/admin/audit-logs', method: 'GET' },
      { path: '/api/admin/audit', method: 'GET' },
      { path: '/api/admin/database/config', method: 'GET' },
      { path: '/api/admin/database/config', method: 'PUT', body: { syncMode: 'manual' } },
      { path: '/api/admin/database/health', method: 'GET' },
      { path: '/api/admin/indexes', method: 'GET' },
      { path: '/api/admin/indexes/verify', method: 'POST', body: {} },
      { path: '/api/admin/indexes/idx_feed_pinned_created', method: 'PUT', body: { status: 'needs_rebuild' } },
      { path: '/api/moderation/audit-logs', method: 'GET' },
      { path: '/api/moderation/legacy-audit', method: 'GET' }
    ];

    for (const actor of nonSuperAdmins) {
      const token = makeToken(actor.role, actor.uid, actor.email);
      for (const reqSpec of restrictedRequests) {
        const res = await authedFetch(reqSpec.path, token, {
          method: reqSpec.method,
          body: reqSpec.body
        });
        expect(res.status).toBe(403);
        expect(res.json?.code).toBe('SUPERADMIN_REQUIRED');
        expect(res.json?.auditLogged).toBe(true);
      }

      // Frontend guard reporting endpoint also returns 403 and logs audit entry
      const uiAttemptRes = await authedFetch('/api/security/unauthorized-access', token, {
        method: 'POST',
        body: {
          attemptedPath: '/portal/database',
          attemptedModule: 'database',
          reason: 'DIRECT_PORTAL_URL_NAVIGATION'
        }
      });
      expect(uiAttemptRes.status).toBe(403);
      expect(uiAttemptRes.json?.code).toBe('SUPERADMIN_REQUIRED');
      expect(uiAttemptRes.json?.auditLogged).toBe(true);
      expect(typeof uiAttemptRes.json?.auditId).toBe('string');
    }

    // Verify superadmin has full access and sees logged unauthorized access attempts
    const superToken = makeToken('superadmin', 'test_super_1', 'test.super@scc.edu.ph');

    const auditLogsRes = await authedFetch('/api/admin/audit-logs', superToken);
    expect(auditLogsRes.status).toBe(200);
    expect(Array.isArray(auditLogsRes.json?.logs)).toBe(true);
    const adminAttemptInServerLog = auditLogsRes.json.logs.find(
      (entry: any) =>
        entry.action === 'UNAUTHORIZED_SUPERADMIN_ACCESS' &&
        entry.actor === 'test.admin@scc.edu.ph'
    );
    expect(adminAttemptInServerLog).toBeDefined();
    expect(adminAttemptInServerLog.actorRole).toBe('admin');

    const modAuditLogsRes = await authedFetch('/api/moderation/audit-logs', superToken);
    expect(modAuditLogsRes.status).toBe(200);
    expect(Array.isArray(modAuditLogsRes.json?.auditLogs)).toBe(true);
    const attemptInModerationLog = modAuditLogsRes.json.auditLogs.find(
      (entry: any) =>
        entry.action === 'UNAUTHORIZED_SUPERADMIN_ACCESS' &&
        entry.actorId === 'test_admin_1'
    );
    expect(attemptInModerationLog).toBeDefined();

    const dbConfigRes = await authedFetch('/api/admin/database/config', superToken);
    expect(dbConfigRes.status).toBe(200);
    expect(dbConfigRes.json?.config?.databaseId).toBe('cecilian-alumni-prod');

    const dbHealthRes = await authedFetch('/api/admin/database/health', superToken);
    expect(dbHealthRes.status).toBe(200);
    expect(dbHealthRes.json?.status).toBe('healthy');

    const indexesRes = await authedFetch('/api/admin/indexes', superToken);
    expect(indexesRes.status).toBe(200);
    expect(Array.isArray(indexesRes.json?.indexes)).toBe(true);
    expect(indexesRes.json.indexes.length).toBeGreaterThan(0);

    const verifyIdxRes = await authedFetch('/api/admin/indexes/verify', superToken, {
      method: 'POST',
      body: {}
    });
    expect(verifyIdxRes.status).toBe(200);
    expect(verifyIdxRes.json?.success).toBe(true);
  });
});
