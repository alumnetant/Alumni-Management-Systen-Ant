import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import fs from 'fs';
import path from 'path';
import type { AddressInfo } from 'net';
import {
  INITIAL_USERS,
  INITIAL_JOB_APPLICATIONS,
  INITIAL_AUDIT_LOGS,
  INITIAL_AUTOMATION_JOBS,
  INITIAL_EVENTS,
  INITIAL_ANNOUNCEMENTS,
  INITIAL_OPPORTUNITIES,
  INITIAL_FEED_POSTS
} from '../src/data/initialData';
import { app, createSignedSessionToken } from '../server';

describe('Seeder Removal & Superadmin-Only Database Reset', () => {
  let server: http.Server;
  let baseUrl: string;

  const makeToken = (role: string, uid: string, email: string) =>
    createSignedSessionToken({
      sessionId: `sess_${uid}`,
      uid,
      email,
      name: `${role.toUpperCase()} User`,
      role,
      exp: Date.now() + 60 * 60 * 1000
    });

  beforeAll(async () => {
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as AddressInfo).port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('retains only the primary superadmin account in initialData and clears all seed datasets', () => {
    expect(INITIAL_USERS).toHaveLength(1);
    expect(INITIAL_USERS[0].uid).toBe('usr_superadmin_cecilia');
    expect(INITIAL_USERS[0].email).toBe('superadmin@stcecilia.edu.ph');
    expect(INITIAL_USERS[0].role).toBe('superadmin');

    expect(INITIAL_JOB_APPLICATIONS).toEqual([]);
    expect(INITIAL_AUDIT_LOGS).toEqual([]);
    expect(INITIAL_AUTOMATION_JOBS).toEqual([]);
    expect(INITIAL_EVENTS).toEqual([]);
    expect(INITIAL_ANNOUNCEMENTS).toEqual([]);
    expect(INITIAL_OPPORTUNITIES).toEqual([]);
    expect(INITIAL_FEED_POSTS).toEqual([]);
  });

  it('verifies seeder UI modal and service files are completely removed', () => {
    const seederModalPath = path.resolve(process.cwd(), 'src/components/admin/AdminDatabaseSeederModal.tsx');
    const seederServicePath = path.resolve(process.cwd(), 'src/services/databaseSampleSeederService.ts');
    expect(fs.existsSync(seederModalPath)).toBe(false);
    expect(fs.existsSync(seederServicePath)).toBe(false);
  });

  it('restricts POST /api/admin/database/reset-superadmin-only to superadmin and preserves only superadmin', async () => {
    for (const actor of [
      { role: 'admin', uid: 'non_super_admin', email: 'admin.test@stcecilia.edu.ph' },
      { role: 'moderator', uid: 'non_super_mod', email: 'mod.test@stcecilia.edu.ph' },
      { role: 'alumni', uid: 'non_super_alum', email: 'alum.test@stcecilia.edu.ph' },
      { role: 'employer', uid: 'non_super_emp', email: 'emp.test@company.com' }
    ]) {
      const token = makeToken(actor.role, actor.uid, actor.email);
      const res = await fetch(`${baseUrl}/api/admin/database/reset-superadmin-only`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.code).toBe('SUPERADMIN_REQUIRED');
      expect(body.auditLogged).toBe(true);
    }

    const superToken = makeToken('superadmin', 'usr_superadmin_cecilia', 'superadmin@stcecilia.edu.ph');
    const resetRes = await fetch(`${baseUrl}/api/admin/database/reset-superadmin-only`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${superToken}`,
        'Content-Type': 'application/json'
      }
    });
    expect(resetRes.status).toBe(200);
    const resetJson = await resetRes.json();
    expect(resetJson.success).toBe(true);
    expect(resetJson.retainedSuperadminUid).toBe('usr_superadmin_cecilia');
    expect(resetJson.retainedSuperadminEmail).toBe('superadmin@stcecilia.edu.ph');

    const auditRes = await fetch(`${baseUrl}/api/admin/audit-logs`, {
      headers: { Authorization: `Bearer ${superToken}` }
    });
    expect(auditRes.status).toBe(200);
    const auditJson = await auditRes.json();
    expect(auditJson.logs).toEqual([]);
  });
});
