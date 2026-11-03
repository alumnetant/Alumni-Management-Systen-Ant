import { describe, it, expect } from 'vitest';
import { getLogAlertInfo } from '../src/components/admin/AuditLogView';
import { AuditLogEntry } from '../src/types';

describe('Activity Classification and Warning Icons Matrix', () => {
  it('correctly classifies successful USER_LOGIN as NORMAL with NO warning icon', () => {
    const loginLog: AuditLogEntry = {
      id: 'log_login_1',
      timestamp: new Date().toISOString(),
      action: 'USER_LOGIN',
      actorId: 'usr_admin_1',
      actorName: 'Admin User',
      actorRole: 'admin',
      category: 'security',
      details: 'User authenticated into Cecilian portal.',
      severity: 'info'
    };

    const alertInfo = getLogAlertInfo(loginLog);
    expect(alertInfo.classification).toBe('NORMAL');
    expect(alertInfo.showWarningIcon).toBe(false);
    expect(alertInfo.isAlert).toBe(false);
    expect(alertInfo.isSuspicious).toBe(false);
    expect(alertInfo.alertType).toBe('user_login');
  });

  it('correctly classifies FAILED_LOGIN_ATTEMPT as WARNING with warning icon (⚠️ Yes)', () => {
    const failedAttemptLog: AuditLogEntry = {
      id: 'log_fail_1',
      timestamp: new Date().toISOString(),
      action: 'FAILED_LOGIN_ATTEMPT',
      actorId: 'unknown_attempt',
      actorName: 'Unauthenticated Actor',
      actorRole: 'alumni',
      category: 'security',
      details: 'Failed authentication attempt (attempt 1 of 3) due to incorrect credentials for username "alumni@stcecilia.edu".',
      severity: 'warning',
      targetRecordId: 'alumni@stcecilia.edu'
    };

    const alertInfo = getLogAlertInfo(failedAttemptLog);
    expect(alertInfo.classification).toBe('WARNING');
    expect(alertInfo.showWarningIcon).toBe(true);
    expect(alertInfo.isAlert).toBe(true);
    expect(alertInfo.isSuspicious).toBe(false);
    expect(alertInfo.alertType).toBe('failed_login');
    expect(failedAttemptLog.details).not.toContain('Password');
    expect(failedAttemptLog.details).not.toContain('secret');
  });

  it('correctly classifies MULTIPLE_FAILED_LOGIN_ATTEMPTS as SUSPICIOUS with warning icon (⚠️ Yes)', () => {
    const multiFailedLog: AuditLogEntry = {
      id: 'log_multi_fail_1',
      timestamp: new Date().toISOString(),
      action: 'MULTIPLE_FAILED_LOGIN_ATTEMPTS',
      actorId: 'unknown_attempt',
      actorName: 'Unauthenticated Actor',
      actorRole: 'alumni',
      category: 'security',
      details: 'Multiple failed login attempts detected (3 consecutive failures) for username "admin@stcecilia.edu".',
      severity: 'alert',
      targetRecordId: 'admin@stcecilia.edu'
    };

    const alertInfo = getLogAlertInfo(multiFailedLog);
    expect(alertInfo.classification).toBe('SUSPICIOUS');
    expect(alertInfo.showWarningIcon).toBe(true);
    expect(alertInfo.isAlert).toBe(true);
    expect(alertInfo.isSuspicious).toBe(true);
    expect(alertInfo.alertType).toBe('multiple_failed_logins');
  });

  it('correctly classifies ACCOUNT_LOCKED as LOCKED with warning icon (⚠️ Yes)', () => {
    const lockedLog: AuditLogEntry = {
      id: 'log_locked_1',
      timestamp: new Date().toISOString(),
      action: 'ACCOUNT_LOCKED',
      actorId: 'system_security',
      actorName: 'Security Enforcer',
      actorRole: 'admin',
      category: 'security',
      details: 'ACCOUNT LOCKED for user "Juan Dela Cruz" (juan@stcecilia.edu). Reason: Repeated failed login attempts exceeding security threshold. Timestamp: ' + new Date().toISOString(),
      severity: 'alert',
      targetRecordId: 'juan@stcecilia.edu'
    };

    const alertInfo = getLogAlertInfo(lockedLog);
    expect(alertInfo.classification).toBe('LOCKED');
    expect(alertInfo.showWarningIcon).toBe(true);
    expect(alertInfo.isAlert).toBe(true);
    expect(alertInfo.isSuspicious).toBe(true);
    expect(alertInfo.alertType).toBe('account_locked');
  });

  it('correctly classifies ACCOUNT_SUSPENDED as SUSPENDED with warning icon (⚠️ Yes)', () => {
    const suspendedLog: AuditLogEntry = {
      id: 'log_susp_1',
      timestamp: new Date().toISOString(),
      action: 'ACCOUNT_SUSPENDED',
      actorId: 'usr_admin',
      actorName: 'Admin Officer',
      actorRole: 'admin',
      category: 'security',
      details: 'ACCOUNT SUSPENDED for user "Pedro" (pedro@stcecilia.edu). Reason: Policy violation.',
      severity: 'alert',
      targetRecordId: 'pedro@stcecilia.edu'
    };

    const alertInfo = getLogAlertInfo(suspendedLog);
    expect(alertInfo.classification).toBe('SUSPENDED');
    expect(alertInfo.showWarningIcon).toBe(true);
  });

  it('correctly classifies ADMIN_UNLOCKED_ACCOUNT and ACCOUNT_AUTO_RESTORED as NORMAL with NO warning icon', () => {
    const unlockLog: AuditLogEntry = {
      id: 'log_unlocked_1',
      timestamp: new Date().toISOString(),
      action: 'ADMIN_UNLOCKED_ACCOUNT',
      actorId: 'usr_admin',
      actorName: 'Admin Officer',
      actorRole: 'admin',
      category: 'security',
      details: 'Account unlocked by administrator.',
      severity: 'info'
    };
    expect(getLogAlertInfo(unlockLog).classification).toBe('NORMAL');
    expect(getLogAlertInfo(unlockLog).showWarningIcon).toBe(false);

    const autoRestoredLog: AuditLogEntry = {
      id: 'log_restored_1',
      timestamp: new Date().toISOString(),
      action: 'ACCOUNT_AUTO_RESTORED',
      actorId: 'system',
      actorName: 'System Scheduler',
      actorRole: 'admin',
      category: 'security',
      details: 'Account automatically restored after suspension expiration.',
      severity: 'info'
    };
    expect(getLogAlertInfo(autoRestoredLog).classification).toBe('NORMAL');
    expect(getLogAlertInfo(autoRestoredLog).showWarningIcon).toBe(false);
  });

  it('correctly classifies MULTIPLE_USERS_SAME_ACCOUNT as SUSPICIOUS with warning icon (⚠️ Yes)', () => {
    const multiUsersLog: AuditLogEntry = {
      id: 'log_multi_users_1',
      timestamp: new Date().toISOString(),
      action: 'MULTIPLE_USERS_SAME_ACCOUNT',
      actorId: 'usr_alumni_concurrent',
      actorName: 'Maria Santos',
      actorRole: 'alumni',
      category: 'security',
      details: 'Suspected multiple people using account "maria.santos@alumni.stcecilia.edu". Concurrent active session on Windows Desktop (Cebu IT Park) and Android Mobile (Mandaue City).',
      severity: 'alert',
      targetRecordId: 'maria.santos@alumni.stcecilia.edu'
    };

    const alertInfo = getLogAlertInfo(multiUsersLog);
    expect(alertInfo.classification).toBe('SUSPICIOUS');
    expect(alertInfo.showWarningIcon).toBe(true);
    expect(alertInfo.isAlert).toBe(true);
    expect(alertInfo.isSuspicious).toBe(true);
    expect(alertInfo.alertType).toBe('multiple_users_same_account');
  });

  it('discontinues USER_RELOGIN classification and does NOT show a warning icon for historical records', () => {
    const reloginLog: AuditLogEntry = {
      id: 'log_relogin_historical',
      timestamp: new Date().toISOString(),
      action: 'USER_RELOGIN',
      actorId: 'usr_alumni_1',
      actorName: 'Juan Dela Cruz',
      actorRole: 'alumni',
      category: 'security',
      details: 'Historical audit record: User initiated session takeover / re-login to terminate existing session.',
      severity: 'info'
    };

    const alertInfo = getLogAlertInfo(reloginLog);
    expect(alertInfo.classification).toBe('NORMAL');
    expect(alertInfo.showWarningIcon).toBe(false);
    expect(alertInfo.isAlert).toBe(false);
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
    expect(alertInfo.classification).toBe('NORMAL');
    expect(alertInfo.showWarningIcon).toBe(false);
    expect(alertInfo.isAlert).toBe(false);
    expect(alertInfo.isSuspicious).toBe(false);
  });

  it('correctly filters logs by role for non-admin scoping while admin has oversight', () => {
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
        severity: 'info'
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

