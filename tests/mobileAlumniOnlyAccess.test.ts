/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import http from 'http';
import crypto from 'crypto';
import type { AddressInfo } from 'net';
import { isMobilePlatformToken, isMobileOrTabletUserAgent } from '../src/lib/platformPolicy';
import { isMobileOrTabletDevice } from '../src/lib/platform';
import { app, createSignedSessionToken, credentialsDb, hashPassword } from '../server';

describe('Mobile & Tablet Platform Detection Policy', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('recognizes all mobile and tablet platform tokens and boolean flags', () => {
    for (const token of ['mobile', 'MOBILE', 'native_apk', 'apk', 'tablet', 'mobile_web', 'ipad', ' Tablet ']) {
      expect(isMobilePlatformToken(token)).toBe(true);
    }
    expect(isMobilePlatformToken('web', true)).toBe(true);
    expect(isMobilePlatformToken('web', false)).toBe(false);
    expect(isMobilePlatformToken('desktop')).toBe(false);
    expect(isMobilePlatformToken(undefined)).toBe(false);
  });

  it('detects mobile, tablet, and iPadOS Safari desktop-mode user agents accurately', () => {
    expect(isMobileOrTabletUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe(true);
    expect(isMobileOrTabletUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8)')).toBe(true);
    expect(isMobileOrTabletUserAgent('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)')).toBe(true);
    expect(isMobileOrTabletUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe(true);

    expect(isMobileOrTabletUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe(false);
    expect(isMobileOrTabletUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 0)).toBe(false);
  });

  it('enforces <1024px breakpoint and touch-tablet checks in isMobileOrTabletDevice', () => {
    vi.stubGlobal('window', { innerWidth: 390 });
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)', maxTouchPoints: 5 });
    expect(isMobileOrTabletDevice()).toBe(true);

    vi.stubGlobal('window', { innerWidth: 1023 });
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', maxTouchPoints: 0 });
    expect(isMobileOrTabletDevice()).toBe(true);

    vi.stubGlobal('window', { innerWidth: 1180 });
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', maxTouchPoints: 5 });
    expect(isMobileOrTabletDevice()).toBe(true);

    vi.stubGlobal('window', { innerWidth: 1280 });
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', maxTouchPoints: 0 });
    expect(isMobileOrTabletDevice()).toBe(false);
  });
});

describe('Server Enforcement: Alumni-Only Login, Registration & Refresh on Mobile/Tablet', () => {
  let server: http.Server;
  let baseUrl = '';
  const createdKeys: string[] = [];
  const password = 'SecurePassword#2026';

  function seedAccount(role: string, tag: string) {
    const uid = `usr_mobgate_${role}_${tag}_${crypto.randomBytes(3).toString('hex')}`;
    const email = `mobgate.${role}.${tag}.${crypto.randomBytes(3).toString('hex')}@stcecilia.edu.ph`.toLowerCase();
    const { salt, hash } = hashPassword(password);

    const record: any = {
      uid,
      email,
      name: `Test ${role.toUpperCase()}`,
      role,
      salt,
      hash,
      isVerified: true,
      emailVerified: true,
      verificationStatus: 'verified',
      accountStatus: 'ACTIVE',
      status: 'active'
    };

    if (role === 'employer') {
      record.employerStatus = 'approved';
      record.employerVerificationStatus = 'verified';
      record.companyName = 'Accredited Partner Corp';
    }

    credentialsDb.set(email, record);
    credentialsDb.set(uid, record);
    createdKeys.push(email, uid);
    return { uid, email, role };
  }

  beforeAll(async () => {
    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    for (const k of createdKeys) {
      credentialsDb.delete(k);
    }
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it('blocks non-alumni roles (admin, superadmin, moderator, employer) on mobile & tablet login with 403 while allowing desktop web', async () => {
    const admin = seedAccount('admin', 'login');
    const superadmin = seedAccount('superadmin', 'login');
    const moderator = seedAccount('moderator', 'login');
    const employer = seedAccount('employer', 'login');

    const blockedCases = [
      {
        acct: admin,
        headers: { 'Content-Type': 'application/json' },
        body: { email: admin.email, password, platform: 'mobile', isMobileOrTablet: true }
      },
      {
        acct: superadmin,
        headers: { 'Content-Type': 'application/json' },
        body: { email: superadmin.email, password, platform: 'tablet', isMobileOrTablet: true }
      },
      {
        acct: moderator,
        headers: {
          'Content-Type': 'application/json',
          'x-client-platform': 'tablet',
          'x-mobile-or-tablet': 'true'
        },
        body: { email: moderator.email, password, platform: 'web' }
      },
      {
        acct: employer,
        headers: { 'Content-Type': 'application/json' },
        body: { email: employer.email, password, platform: 'mobile_web', isMobileOrTablet: true }
      }
    ];

    for (const item of blockedCases) {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: item.headers,
        body: JSON.stringify(item.body)
      });
      expect(res.status, `Mobile/tablet login should block ${item.acct.role}`).toBe(403);
      const json = await res.json();
      expect(json.code).toBe('ADMIN_WEB_ONLY_RESTRICTION');
    }

    const webRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: admin.email,
        password,
        platform: 'web',
        isMobileOrTablet: false
      })
    });
    expect(webRes.status).toBe(200);
  });

  it('allows verified alumni login across mobile and tablet clients', async () => {
    const mobileAlumni = seedAccount('alumni', 'allow_mobile');
    const tabletAlumni = seedAccount('alumni', 'allow_tablet');

    for (const [acct, payload] of [
      [mobileAlumni, { platform: 'mobile', isMobileOrTablet: true }],
      [tabletAlumni, { platform: 'tablet', isMobileOrTablet: true }]
    ] as const) {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: acct.email,
          password,
          ...payload
        })
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.user?.role).toBe('alumni');
      expect(json.token).toBeTruthy();
    }
  });

  it('blocks employer and staff registration from mobile or tablet clients with 403', async () => {
    const suffix = crypto.randomBytes(4).toString('hex');
    const empRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Mobile Employer Attempt',
        email: `mob_emp_${suffix}@company.com`,
        password,
        role: 'employer',
        accountType: 'employer',
        platform: 'mobile',
        isMobileOrTablet: true
      })
    });
    expect(empRes.status).toBe(403);
    const empJson = await empRes.json();
    expect(empJson.code).toBe('ADMIN_WEB_ONLY_RESTRICTION');
  });

  it('blocks non-alumni refresh token exchange on mobile/tablet while permitting alumni refresh', async () => {
    const admin = seedAccount('admin', 'refresh');
    const alumni = seedAccount('alumni', 'refresh');

    const adminRefreshToken = createSignedSessionToken({
      uid: admin.uid,
      email: admin.email,
      role: 'admin',
      exp: Date.now() + 3600 * 1000
    });

    const blockedRefresh = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refreshToken: adminRefreshToken,
        platform: 'tablet',
        isMobileOrTablet: true
      })
    });
    expect(blockedRefresh.status).toBe(403);
    const blockedJson = await blockedRefresh.json();
    expect(blockedJson.code).toBe('ADMIN_WEB_ONLY_RESTRICTION');

    const alumniRefreshToken = createSignedSessionToken({
      uid: alumni.uid,
      email: alumni.email,
      role: 'alumni',
      exp: Date.now() + 3600 * 1000
    });

    const okRefresh = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refreshToken: alumniRefreshToken,
        platform: 'mobile',
        isMobileOrTablet: true
      })
    });
    expect(okRefresh.status).toBe(200);
    const okJson = await okRefresh.json();
    expect(okJson.user?.role).toBe('alumni');
  });
});
