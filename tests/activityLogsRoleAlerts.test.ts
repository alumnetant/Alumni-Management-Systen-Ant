import { describe, it, expect } from 'vitest';
import { getLogAlertInfo } from '../src/components/admin/AuditLogView';
import { AuditLogEntry } from '../src/types';

describe('Activity Logs & Role-Based Security Alerts', () => {
  it('correctly flags USER_LOGIN as an active authentication alert', () => {
    const loginLog: AuditLogEntry = {
      id: 'log_login_1',
      timestamp: new Date().toISOString(),
      action: 'USER_LOGIN',
      actorId: 'usr_admin_1',
      actorName: 'Admin User',
      actorRole: 'admin',
      category: 'security',
      details: 'User authenticated into Cecilian portal.',
      severity: 'alert'
    };

    const alertInfo = getLogAlertInfo(loginLog);
    expect(alertInfo.isAlert).toBe(true);
    expect(alertInfo.isSuspicious).toBe(false);
    expect(alertInfo.alertType).toBe('login');
    expect(alertInfo.badgeLabel).toContain('User Login');
  });

  it('correctly flags USER_RELOGIN as an active authentication alert', () => {
    const reloginLog: AuditLogEntry = {
      id: 'log_relogin_1',
      timestamp: new Date().toISOString(),
      action: 'USER_RELOGIN',
      actorId: 'usr_alumni_1',
      actorName: 'Juan Dela Cruz',
      actorRole: 'alumni',
      category: 'security',
      details: 'User initiated session takeover / re-login to terminate existing session.',
      severity: 'alert'
    };

    const alertInfo = getLogAlertInfo(reloginLog);
    expect(alertInfo.isAlert).toBe(true);
    expect(alertInfo.isSuspicious).toBe(false);
    expect(alertInfo.alertType).toBe('relogin');
    expect(alertInfo.badgeLabel).toContain('User Re-login');
  });

  it('correctly identifies single failed login attempts as suspicious activity', () => {
    const failedAttemptLog: AuditLogEntry = {
      id: 'log_fail_1',
      timestamp: new Date().toISOString(),
      action: 'FAILED_LOGIN_ATTEMPT',
      actorId: 'unknown_attempt',
      actorName: 'Unauthenticated Actor',
      actorRole: 'alumni',
      category: 'security',
      details: 'Failed authentication attempt (attempt 1 of 3) due to incorrect password.',
      severity: 'warning',
      targetRecordId: 'test@stcecilia.edu'
    };

    const alertInfo = getLogAlertInfo(failedAttemptLog);
    expect(alertInfo.isAlert).toBe(true);
    expect(alertInfo.isSuspicious).toBe(true);
    expect(alertInfo.alertType).toBe('failed_login');
    expect(alertInfo.badgeLabel).toContain('Failed Login Attempt');
  });

  it('correctly flags multiple failed attempts / lockout as high-priority suspicious activity', () => {
    const lockoutLog: AuditLogEntry = {
      id: 'log_lockout_1',
      timestamp: new Date().toISOString(),
      action: 'SUSPICIOUS_MULTIPLE_FAILED_LOGINS',
      actorId: 'unauthenticated_actor',
      actorName: 'Unauthenticated Actor',
      actorRole: 'alumni',
      category: 'security',
      details: 'Multiple failed login attempts detected (3 of 3 attempts). Temporary account lockout enforced.',
      severity: 'alert',
      targetRecordId: 'admin@stcecilia.edu'
    };

    const alertInfo = getLogAlertInfo(lockoutLog);
    expect(alertInfo.isAlert).toBe(true);
    expect(alertInfo.isSuspicious).toBe(true);
    expect(alertInfo.alertType).toBe('suspicious_lockout');
    expect(alertInfo.badgeLabel).toContain('Multiple Failed Attempts');
  });

  it('keeps normal administrative operations unflagged from suspicious alerts', () => {
    const routineLog: AuditLogEntry = {
      id: 'log_routine_1',
      timestamp: new Date().toISOString(),
      action: 'REGISTRY_BACKUP_SNAPSHOT',
      actorId: 'usr_admin_1',
      actorName: 'Registrar Staff',
      actorRole: 'staff',
      category: 'registry_masterlist',
      details: 'Archival snapshot of 2026 graduate records created.',
      severity: 'info'
    };

    const alertInfo = getLogAlertInfo(routineLog);
    expect(alertInfo.isAlert).toBe(false);
    expect(alertInfo.isSuspicious).toBe(false);
    expect(alertInfo.alertType).toBeNull();
  });

  it('correctly filters logs by role for non-admin scoping', () => {
    const logs: AuditLogEntry[] = [
      {
        id: '1',
        timestamp: new Date().toISOString(),
        action: 'JOB_OPPORTUNITY_POSTED',
        actorId: 'emp_1',
        actorName: 'Tech Corp HR',
        actorRole: 'employer',
        category: 'career',
        details: 'Posted software job.',
        severity: 'info'
      },
      {
        id: '2',
        timestamp: new Date().toISOString(),
        action: 'REGISTRAR_MANUAL_VERIFY',
        actorId: 'staff_1',
        actorName: 'Staff Records',
        actorRole: 'staff',
        category: 'registry_masterlist',
        details: 'Verified student record.',
        severity: 'info'
      },
      {
        id: '3',
        timestamp: new Date().toISOString(),
        action: 'USER_LOGIN',
        actorId: 'alum_1',
        actorName: 'Maria Santos',
        actorRole: 'alumni',
        category: 'security',
        details: 'User logged in.',
        severity: 'alert'
      }
    ];

    // Employer scoped view
    const employerLogs = logs.filter(l => l.actorRole === 'employer' || l.category === 'career');
    expect(employerLogs.length).toBe(1);
    expect(employerLogs[0].action).toBe('JOB_OPPORTUNITY_POSTED');

    // Admin view has all 3
    expect(logs.length).toBe(3);
  });
});
