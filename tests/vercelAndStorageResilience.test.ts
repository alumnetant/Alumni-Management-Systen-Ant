import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import http from 'http';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { saveRegistrationConflicts } from '../src/services/studentVerificationService';

describe('Vercel Serverless & Browser Storage Quota Resilience', () => {
  const bundleOut = path.resolve(process.cwd(), 'dist', `vercel-api-test-${process.pid}.cjs`);

  afterEach(() => {
    vi.restoreAllMocks();
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
});
