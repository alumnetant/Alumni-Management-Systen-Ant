import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import http from 'http';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { saveRegistrationConflicts } from '../src/services/studentVerificationService';
import {
  actOnCasePrimary,
  claimOrReleaseCasePrimary,
  clearModerationSyncQueueForTests,
  getModerationCaseDetailPrimary,
  getModerationSyncStatus,
  loadModerationStatePrimary,
  queryModerationCases,
  retryQueuedModerationSync,
  setModerationPersistenceHooksForTests,
  submitPostReportPrimary
} from '../src/services/postModerationService';

describe('Vercel Serverless & Browser Storage Quota Resilience', () => {
  const bundleOut = path.resolve(process.cwd(), 'dist', `vercel-api-test-${process.pid}.cjs`);

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    setModerationPersistenceHooksForTests(null);
    clearModerationSyncQueueForTests();
    if (fs.existsSync(bundleOut)) {
      try {
        fs.unlinkSync(bundleOut);
      } catch {}
    }
  });

  it('bundles api/index.ts cleanly without Vite and serves moderation/auth endpoints consistently across Vercel cold starts', async () => {
    execSync(
      `npx esbuild api/index.ts --bundle --platform=node --format=cjs --packages=external --outfile="${bundleOut}"`,
      { stdio: 'pipe' }
    );
    expect(fs.existsSync(bundleOut)).toBe(true);

    // Ensure Vite dev server tooling is NOT eagerly required into the serverless function
    const bundledCode = fs.readFileSync(bundleOut, 'utf-8');
    expect(bundledCode).not.toMatch(/__require\(["']vite["']\)/);
    expect(bundledCode).not.toMatch(/\brequire\(["']vite["']\)/);

    const prevVercel = process.env.VERCEL;
    const prevNodeEnv = process.env.NODE_ENV;
    const prevProjectId = process.env.VERCEL_PROJECT_ID;

    try {
      process.env.VERCEL = '1';
      process.env.NODE_ENV = 'production';
      process.env.VERCEL_PROJECT_ID = 'prj_cecilian_test_stable';

      // Clear require cache and load Lambda A
      delete require.cache[require.resolve(bundleOut)];
      const modA = require(bundleOut);
      const handlerA = modA.default || modA;
      const srvA = http.createServer(handlerA);
      await new Promise<void>((resolve) => srvA.listen(0, '127.0.0.1', () => resolve()));
      const portA = (srvA.address() as any).port;

      const loginRes = await fetch(`http://127.0.0.1:${portA}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'superadmin@stcecilia.edu.ph',
          password: 'Password123!'
        })
      });
      expect(loginRes.status).toBe(200);
      const loginJson: any = await loginRes.json();
      expect(typeof loginJson.token).toBe('string');
      await new Promise<void>((resolve) => srvA.close(() => resolve()));

      // Simulate cold start on Lambda B with fresh require cache and verify Lambda A's token works
      delete require.cache[require.resolve(bundleOut)];
      const modB = require(bundleOut);
      const handlerB = modB.default || modB;
      const srvB = http.createServer(handlerB);
      await new Promise<void>((resolve) => srvB.listen(0, '127.0.0.1', () => resolve()));
      const portB = (srvB.address() as any).port;

      const casesRes = await fetch(
        `http://127.0.0.1:${portB}/api/moderation/cases?page=1&pageSize=10&status=pending`,
        { headers: { Authorization: `Bearer ${loginJson.token}` } }
      );
      expect(casesRes.status).toBe(200);
      const casesData: any = await casesRes.json();
      expect(Array.isArray(casesData.cases)).toBe(true);

      const unknownRes = await fetch(`http://127.0.0.1:${portB}/api/nonexistent-endpoint`);
      expect(unknownRes.status).toBe(404);
      const unknownJson: any = await unknownRes.json();
      expect(unknownJson.code).toBe('API_NOT_FOUND');

      await new Promise<void>((resolve) => srvB.close(() => resolve()));
    } finally {
      if (prevVercel === undefined) delete process.env.VERCEL;
      else process.env.VERCEL = prevVercel;
      if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = prevNodeEnv;
      if (prevProjectId === undefined) delete process.env.VERCEL_PROJECT_ID;
      else process.env.VERCEL_PROJECT_ID = prevProjectId;
    }
  });

  it('handles QuotaExceededError gracefully without throwing uncaught exceptions when saving conflicts', () => {
    const store = new Map<string, string>();
    const mockLocalStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        if (v.length > 1000) {
          const err = new Error("Failed to execute 'setItem' on 'Storage': exceeded the quota.");
          err.name = 'QuotaExceededError';
          throw err;
        }
        store.set(k, v);
      },
      removeItem: (k: string) => store.delete(k),
      clear: () => store.clear(),
      key: (i: number) => Array.from(store.keys())[i] ?? null,
      get length() {
        return store.size;
      }
    };

    vi.stubGlobal('localStorage', mockLocalStorage);
    store.set('alumni_gallery_v5', 'x'.repeat(60000));

    expect(() =>
      saveRegistrationConflicts(
        [
          {
            id: 'conf_quota_test',
            submissionSource: 'dispute_student_id_claim',
            requestType: 'student_id_dispute',
            studentId: 'SCC-2020-001',
            claimantName: 'Test Claimant',
            claimantEmail: 'claimant@stcecilia.edu.ph',
            status: 'pending',
            submittedAt: new Date().toISOString(),
            selfieWithIdUrl: 'data:image/png;base64,' + 'A'.repeat(30000)
          } as any
        ],
        true
      )
    ).not.toThrow();
    expect(store.has('alumni_gallery_v5')).toBe(false);
  });

  it('loads and mutates moderation cases from Cloud Firestore primary even when Express returns HTTP 500, debouncing sync warnings until retry fails', async () => {
    const store = new Map<string, string>();
    store.set('alumni_server_auth_token', 'mock-jwt-token');
    const mockLocalStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
      clear: () => store.clear(),
      key: (i: number) => Array.from(store.keys())[i] ?? null,
      get length() {
        return store.size;
      }
    };
    vi.stubGlobal('window', globalThis);
    vi.stubGlobal('localStorage', mockLocalStorage);
    clearModerationSyncQueueForTests();

    const dbCases = new Map<string, any>();
    const dbReports = new Map<string, any>();
    const dbWarnings = new Map<string, any>();
    const dbAudits = new Map<string, any>();
    const dbTrackers = new Map<string, any>();
    const dbPosts = new Map<string, any>();

    const alumniAuthor: any = {
      uid: 'alu_author_1',
      name: 'Cecilian Alumnus',
      email: 'alumnus@stcecilia.edu.ph',
      role: 'alumni',
      accountStatus: 'ACTIVE',
      isVerified: true
    };
    const alumniReporter: any = {
      uid: 'alu_rep_1',
      name: 'Cecilian Reporter',
      email: 'reporter@stcecilia.edu.ph',
      role: 'alumni',
      accountStatus: 'ACTIVE',
      isVerified: true
    };
    const adminActor: any = {
      uid: 'admin_1',
      name: 'Campus Admin',
      email: 'admin@stcecilia.edu.ph',
      role: 'admin',
      accountStatus: 'ACTIVE',
      isVerified: true
    };

    const alumniPost: any = {
      id: 'post_fs_1',
      authorId: alumniAuthor.uid,
      authorName: alumniAuthor.name,
      authorRole: 'alumni',
      authorAvatar: '',
      postType: 'update',
      title: 'Community Question',
      content: 'Looking for batchmates',
      likes: [],
      comments: [],
      sharesCount: 0,
      createdAt: new Date().toISOString(),
      status: 'published',
      visibility: 'alumni'
    };
    const adminPost: any = {
      ...alumniPost,
      id: 'post_admin_1',
      authorId: adminActor.uid,
      authorName: adminActor.name,
      authorRole: 'admin',
      postType: 'announcement',
      title: 'Admin Circular'
    };
    dbPosts.set(alumniPost.id, alumniPost);
    dbPosts.set(adminPost.id, adminPost);

    let apiMode: 'fail_500' | 'ok' = 'fail_500';
    const capturedOps: Array<{ url: string; idempotencyKey: string | null }> = [];

    setModerationPersistenceHooksForTests({
      loadCases: async () => Array.from(dbCases.values()),
      loadReports: async () => Array.from(dbReports.values()),
      loadWarnings: async () => Array.from(dbWarnings.values()),
      loadAuditLogs: async () => Array.from(dbAudits.values()),
      loadTrackers: async () => Array.from(dbTrackers.values()),
      loadAppeals: async () => [],
      loadPosts: async () => Array.from(dbPosts.values()),
      loadConfig: async () => null,
      saveCase: async (c) => { dbCases.set(c.id, c); return true; },
      saveReport: async (r) => { dbReports.set(r.id, r); return true; },
      saveWarning: async (w) => { dbWarnings.set(w.id, w); return true; },
      saveAudit: async (a) => { dbAudits.set(a.id, a); return true; },
      saveTracker: async (t) => { dbTrackers.set(t.userId, t); return true; },
      savePost: async (p) => { dbPosts.set(p.id, p); return true; },
      saveNotification: async () => {},
      saveUser: async () => true,
      apiRequest: async (url, init) => {
        const headers = new Headers(init?.headers || {});
        capturedOps.push({ url, idempotencyKey: headers.get('X-Idempotency-Key') });
        if (apiMode === 'fail_500') {
          return new Response(JSON.stringify({ error: 'Serverless 500' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    });

    // 1. Read loads cleanly from Firestore without showing any error or degraded banner
    const initialSnap = await loadModerationStatePrimary([alumniAuthor, alumniReporter, adminActor], [alumniPost, adminPost]);
    expect(initialSnap.cases.length).toBe(0);
    expect(getModerationSyncStatus().syncDegradedAfterRetry).toBe(false);

    // 2. Non-reportable Admin post is blocked client-side before Firestore write
    await expect(
      submitPostReportPrimary(
        alumniReporter,
        { targetType: 'post', targetId: adminPost.id, reason: 'Spam', postSnapshot: adminPost },
        { users: [alumniAuthor, alumniReporter, adminActor], feedPosts: [alumniPost, adminPost] }
      )
    ).rejects.toThrow(/Only posts created by alumni or employers/i);

    // 3. Report Alumni post -> persists to Firestore even when Express returns 500
    const repResult = await submitPostReportPrimary(
      alumniReporter,
      {
        targetType: 'post',
        targetId: alumniPost.id,
        reason: 'Spam',
        details: 'Suspicious link',
        postSnapshot: alumniPost
      },
      { users: [alumniAuthor, alumniReporter, adminActor], feedPosts: [alumniPost, adminPost] }
    );
    expect(repResult.firestoreSaved).toBe(true);
    expect(dbCases.size).toBe(1);
    expect(dbReports.size).toBe(1);

    // Wait briefly for initial fire-and-forget Express sync attempt (attempt #1 fails -> still NOT degraded!)
    await new Promise((r) => setTimeout(r, 30));
    expect(getModerationSyncStatus().pendingCount).toBe(1);
    expect(getModerationSyncStatus().syncDegradedAfterRetry).toBe(false);

    // 4. Retry #1 fails (attempts === 2) -> debounced sync warning becomes visible
    await retryQueuedModerationSync();
    const afterRetryStatus = getModerationSyncStatus();
    expect(afterRetryStatus.syncDegradedAfterRetry).toBe(true);
    expect(afterRetryStatus.failedOperations[0].label).toBe('Submit Post Report');

    // 5. Queue remains interactive & reloads cleanly from Firestore primary
    const reloadedSnap = await loadModerationStatePrimary([alumniAuthor, alumniReporter, adminActor], [alumniPost, adminPost]);
    const queued = queryModerationCases(reloadedSnap, adminActor, { status: 'open' });
    expect(queued.total).toBe(1);
    expect(queued.pendingCount).toBe(1);
    expect(queued.cases[0].reports[0].details).toBe('Suspicious link');

    const detail = getModerationCaseDetailPrimary(reloadedSnap, queued.cases[0].id, adminActor);
    expect(detail.canAct).toBe(true);

    // 6. Moderator claims and resolves directly in Firestore
    const claimed = await claimOrReleaseCasePrimary(adminActor, queued.cases[0].id, 'claim', reloadedSnap);
    expect(claimed.case.status).toBe('reviewed');

    const acted = await actOnCasePrimary(
      adminActor,
      queued.cases[0].id,
      { action: 'warn', reason: 'Spam', message: 'Please do not post suspicious links.' },
      claimed.snapshot,
      [alumniAuthor, alumniReporter, adminActor]
    );
    expect(acted.case.status).toBe('action_taken');
    expect(dbWarnings.size).toBe(1);

    // 7. When Express recovers, queued retries drain with the exact original idempotency key and clear the degraded banner
    apiMode = 'ok';
    await retryQueuedModerationSync();
    expect(getModerationSyncStatus().pendingCount).toBe(0);
    expect(getModerationSyncStatus().syncDegradedAfterRetry).toBe(false);

    const reportSyncKeys = capturedOps
      .filter((op) => op.url === '/api/reports')
      .map((op) => op.idempotencyKey);
    expect(reportSyncKeys.length).toBeGreaterThanOrEqual(2);
    expect(new Set(reportSyncKeys).size).toBe(1);
  });
});
