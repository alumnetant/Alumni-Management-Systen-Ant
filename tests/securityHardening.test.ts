import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import crypto from 'crypto';
import type { AddressInfo } from 'net';
import { app, createSignedSessionToken, credentialsDb, hashPassword } from '../server';
import { buildOtpEmailTemplate, buildEmployerStatusEmailTemplate } from '../src/server/emailService';

let server: http.Server;
let baseUrl = '';

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
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

function mintToken(overrides: {
  uid: string;
  email: string;
  role: string;
  name?: string;
  companyName?: string;
}) {
  return createSignedSessionToken({
    sessionId: `sess_sec_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    uid: overrides.uid,
    name: overrides.name || 'Security Test User',
    email: overrides.email,
    role: overrides.role,
    companyName: overrides.companyName,
    emailVerified: true,
    isVerified: true,
    iat: Date.now(),
    exp: Date.now() + 3600 * 1000
  });
}

describe('Application Security Hardening Verification Suite', () => {
  it('Item 1: rejects forged or tampered bearer tokens on /api/auth/terminate-session without killing victim session', async () => {
    const suffix = crypto.randomBytes(4).toString('hex');
    const victimEmail = `sec_victim_${suffix}@stcecilia.edu.ph`;
    const password = 'StrongPassword#2026';

    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Victim Alumnus',
        email: victimEmail,
        password,
        role: 'alumni'
      })
    });
    expect(regRes.status).toBe(201);
    const regData = await regRes.json();
    const victimUid = regData.uid as string;

    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: victimEmail, password })
    });
    expect(loginRes.status).toBe(200);
    const { token: victimToken } = await loginRes.json();

    // Attacker creates a forged unsigned JWT targeting victimUid
    const forgedPayload = Buffer.from(JSON.stringify({ uid: victimUid, email: victimEmail, role: 'alumni' })).toString('base64url');
    const forgedToken = `eyJhbGciOiJIUzI1NiJ9.${forgedPayload}.invalidsignature`;

    const attackRes = await fetch(`${baseUrl}/api/auth/terminate-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${forgedToken}`
      },
      body: JSON.stringify({})
    });
    expect(attackRes.status).toBe(401);

    // Victim's active session must remain completely intact
    const victimCheckRes = await fetch(`${baseUrl}/api/auth/security-notices`, {
      headers: { Authorization: `Bearer ${victimToken}` }
    });
    expect(victimCheckRes.status).toBe(200);

    // Cleanup synthetic credential entry
    credentialsDb.delete(victimUid);
    credentialsDb.delete(victimEmail);
  });

  it('Item 1 & 10: requires authentication on messaging, push, and sync routes and blocks cross-user/global abuse', async () => {
    const unauthMsg = await fetch(`${baseUrl}/api/messages/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: 'chat_01', message: { text: 'spoofed' } })
    });
    expect(unauthMsg.status).toBe(401);

    const unauthPush = await fetch(`${baseUrl}/api/push/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId: 'all', title: 'Phish', body: 'Click' })
    });
    expect(unauthPush.status).toBe(401);

    const unauthSync = await fetch(`${baseUrl}/api/sync/all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    expect(unauthSync.status).toBe(401);

    const alumniToken = mintToken({
      uid: 'usr_sec_alumni_only',
      email: 'sec.alumni@stcecilia.edu.ph',
      role: 'alumni'
    });

    // Alumni cannot send global push broadcast
    const alumniBroadcast = await fetch(`${baseUrl}/api/push/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${alumniToken}`
      },
      body: JSON.stringify({ targetUserId: 'all', title: 'Spam', body: 'All users' })
    });
    expect(alumniBroadcast.status).toBe(403);

    // Alumni cannot trigger admin dataset cloud sync
    const alumniSync = await fetch(`${baseUrl}/api/sync/all`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${alumniToken}`
      },
      body: JSON.stringify({})
    });
    expect(alumniSync.status).toBe(403);
  });

  it('Item 5 & 17: hashes employer passwords with PBKDF2-SHA512 and verifies HMAC email tokens single-use', async () => {
    const suffix = crypto.randomBytes(4).toString('hex');
    const workEmail = `hr_${suffix}@example.com`;
    const password = 'CorpPassword#2026';

    const weakRes = await fetch(`${baseUrl}/api/employer/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Short Pass Employer',
        workEmail,
        password: '123',
        companyLegalName: 'Example Corp',
        websiteUrl: 'https://example.com'
      })
    });
    expect(weakRes.status).toBe(400);

    const regRes = await fetch(`${baseUrl}/api/employer/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'HR Director',
        workEmail,
        password,
        companyLegalName: 'Example Corp Inc.',
        websiteUrl: 'https://example.com'
      })
    });
    expect(regRes.status).toBe(201);
    const regJson = await regRes.json();
    expect(regJson.verificationToken).toBeTruthy();

    // Verify email confirmation link succeeds (previously broken due to sha256 vs HMAC mismatch)
    const verifyRes = await fetch(`${baseUrl}/api/employer/verify-email?token=${encodeURIComponent(regJson.verificationToken)}`);
    expect(verifyRes.status).toBe(200);

    // Stored credential must use salted 128-hex PBKDF2-SHA512 hash (not 64-hex unsalted SHA-256)
    const savedEmp = credentialsDb.get(workEmail);
    expect(savedEmp).toBeTruthy();
    expect(savedEmp!.salt).toHaveLength(64);
    expect(savedEmp!.hash).toHaveLength(128);
    expect(savedEmp!.hash).not.toBe(crypto.createHash('sha256').update(password).digest('hex'));

    // Single-use token replay must fail with 404
    const replayRes = await fetch(`${baseUrl}/api/employer/verify-email?token=${encodeURIComponent(regJson.verificationToken)}`);
    expect(replayRes.status).toBe(404);

    if (savedEmp?.uid) credentialsDb.delete(savedEmp.uid);
    credentialsDb.delete(workEmail);
  });

  it('Item 10: prevents cross-employer job deletion and forged application ownership IDOR', async () => {
    const employerAToken = mintToken({
      uid: 'usr_emp_alpha',
      email: 'hr@alpha.example.com',
      role: 'employer',
      companyName: 'Alpha Corp'
    });
    const employerBToken = mintToken({
      uid: 'usr_emp_beta',
      email: 'hr@beta.example.com',
      role: 'employer',
      companyName: 'Beta Corp'
    });

    const jobId = `opp_sec_${Date.now()}`;
    const createRes = await fetch(`${baseUrl}/api/opportunities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${employerAToken}`
      },
      body: JSON.stringify({
        id: jobId,
        title: 'Security Analyst',
        company: 'Alpha Corp',
        location: 'Cebu',
        description: 'AppSec role'
      })
    });
    expect(createRes.status).toBe(201);

    // Employer B cannot delete Employer A's job
    const crossDeleteRes = await fetch(`${baseUrl}/api/opportunities/${jobId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${employerBToken}` }
    });
    expect(crossDeleteRes.status).toBe(403);

    // Non-existent opportunity returns 404
    const missingDeleteRes = await fetch(`${baseUrl}/api/opportunities/opp_does_not_exist`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${employerAToken}` }
    });
    expect(missingDeleteRes.status).toBe(404);

    // Employer B cannot spoof ownership via req.body.application when updating status on Alpha Corp's job
    const spoofAppRes = await fetch(`${baseUrl}/api/employer/applications/app_spoof_${Date.now()}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${employerBToken}`
      },
      body: JSON.stringify({
        status: 'Shortlisted',
        application: {
          jobId,
          employerUid: 'usr_emp_beta',
          companyName: 'Beta Corp'
        }
      })
    });
    expect(spoofAppRes.status).toBe(403);

    // Owner Employer A can delete its own job
    const ownerDeleteRes = await fetch(`${baseUrl}/api/opportunities/${jobId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${employerAToken}` }
    });
    expect(ownerDeleteRes.status).toBe(200);
  });

  it('Item 13, 14, 16: enforces strict CORS allowlist, security headers, and untrusted Origin CSRF blocking', async () => {
    const allowedRes = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: 'https://localhost' }
    });
    expect(allowedRes.status).toBe(200);
    expect(allowedRes.headers.get('access-control-allow-origin')).toBe('https://localhost');
    expect(allowedRes.headers.get('x-content-type-options')).toBe('nosniff');
    expect(allowedRes.headers.get('permissions-policy')).toContain('microphone=()');
    expect(allowedRes.headers.get('cross-origin-resource-policy')).toBe('same-site');
    expect(allowedRes.headers.get('content-security-policy')).toContain("frame-ancestors 'self' https://aistudio.google.com");

    const evilGetRes = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: 'https://evil.attacker.example' }
    });
    expect(evilGetRes.headers.get('access-control-allow-origin')).toBeNull();

    const evilPreflight = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://evil.attacker.example' }
    });
    expect(evilPreflight.status).toBe(403);

    const evilPost = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://evil.attacker.example'
      },
      body: JSON.stringify({ email: 'a@b.com', password: 'x' })
    });
    expect(evilPost.status).toBe(403);
  });

  it('Item 23: blocks access to private secrets, data dumps, source, and config files', async () => {
    const blockedPaths = [
      '/.vapid-keys.json',
      '/.env',
      '/package.json',
      '/firestore.rules',
      '/server.ts',
      '/data/credentials_db.json',
      '/dist/server.cjs.map',
      '/..%2fpackage.json'
    ];

    for (const p of blockedPaths) {
      const res = await fetch(`${baseUrl}${p}`);
      expect(res.status, `Expected 404 for ${p}`).toBe(404);
    }
  });

  it('Item 6 & 7: strips XSS payloads in profile updates and HTML-escapes email template variables', async () => {
    const token = mintToken({
      uid: 'usr_xss_test',
      email: 'xss@stcecilia.edu.ph',
      role: 'alumni'
    });

    const profRes = await fetch(`${baseUrl}/api/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        name: '<script>alert(1)</script>Jane Doe',
        headline: '<img src=x onerror=alert(1)>Engineer'
      })
    });
    expect(profRes.status).toBe(200);
    const profJson = await profRes.json();
    expect(profJson.updatedFields.name).not.toContain('<');
    expect(profJson.updatedFields.headline).not.toContain('>');

    const otpEmail = buildOtpEmailTemplate({
      otp: '123456',
      recipientName: '<script>alert("xss")</script>',
      recipientEmail: 'user@example.com',
      expiresInMinutes: 10
    });
    expect(otpEmail.html).not.toContain('<script>');
    expect(otpEmail.html).toContain('&lt;script&gt;');

    const empEmail = buildEmployerStatusEmailTemplate({
      companyName: '<b>Evil</b> Co',
      contactName: '<img src=x>',
      status: 'rejected',
      reason: '<svg onload=alert(1)>'
    });
    expect(empEmail.html).not.toContain('<svg');
    expect(empEmail.html).toContain('&lt;svg');
  });

  it('Item 12: enforces rate limiting on /api/auth/verify-otp with Retry-After and audit logging', async () => {
    let lastStatus = 0;
    let retryAfter: string | null = null;
    for (let i = 0; i < 6; i++) {
      const r = await fetch(`${baseUrl}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'ratelimit_probe@example.com', otp: '000000' })
      });
      lastStatus = r.status;
      retryAfter = r.headers.get('retry-after');
    }
    expect(lastStatus).toBe(429);
    expect(Number(retryAfter)).toBeGreaterThan(0);

    // Ensure hashPassword export remains salted PBKDF2-SHA512
    const hashed = hashPassword('CheckSalted#1');
    expect(hashed.salt).toHaveLength(64);
    expect(hashed.hash).toHaveLength(128);
  });
});
