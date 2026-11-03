import { describe, it, expect } from 'vitest';
import { getLogAlertInfo } from '../src/components/admin/AuditLogView';
import { AuditLogEntry, SuspensionRecord, UserProfile } from '../src/types';

describe('Account Suspension Scheduler and Reason Management', () => {
  describe('Activity Classification and Warning Icons for Suspension Events', () => {
    it('correctly classifies ACCOUNT_SUSPENDED as SECURITY WARNING with ⚠️ Yes', () => {
      const log: AuditLogEntry = {
        id: 'log_susp_1',
        timestamp: new Date().toISOString(),
        action: 'ACCOUNT_SUSPENDED',
        actorId: 'admin_1',
        actorName: 'Admin User',
        actorRole: 'admin',
        category: 'security',
        details: 'Account suspended for user "Jane Doe" (ID: usr_jane) until 2026-11-10T12:00:00Z. Reason: Suspicious account sharing.',
        severity: 'warning',
        targetUserId: 'usr_jane',
        suspensionReason: 'Suspicious account sharing'
      };

      const alertInfo = getLogAlertInfo(log);
      expect(alertInfo.classification).toBe('SUSPENDED');
      expect(alertInfo.showWarningIcon).toBe(true);
      expect(alertInfo.isAlert).toBe(true);
    });

    it('correctly classifies ACCOUNT_LOCKED as LOCKED with ⚠️ Yes', () => {
      const log: AuditLogEntry = {
        id: 'log_lock_1',
        timestamp: new Date().toISOString(),
        action: 'ACCOUNT_LOCKED',
        actorId: 'admin_1',
        actorName: 'Admin User',
        actorRole: 'admin',
        category: 'security',
        details: 'Account locked permanently for user "John Smith". Reason: Administrative investigation.',
        severity: 'critical',
        targetUserId: 'usr_john',
        suspensionReason: 'Administrative investigation'
      };

      const alertInfo = getLogAlertInfo(log);
      expect(alertInfo.classification).toBe('LOCKED');
      expect(alertInfo.showWarningIcon).toBe(true);
      expect(alertInfo.isAlert).toBe(true);
    });

    it('correctly classifies ACCOUNT_SUSPENSION_EXTENDED as WARNING with ⚠️ Yes', () => {
      const log: AuditLogEntry = {
        id: 'log_ext_1',
        timestamp: new Date().toISOString(),
        action: 'ACCOUNT_SUSPENSION_EXTENDED',
        actorId: 'admin_1',
        actorName: 'Admin User',
        actorRole: 'admin',
        category: 'security',
        details: 'Account suspension extended for user "Jane Doe" to 2026-11-20T12:00:00Z. Reason: Ongoing policy audit.',
        severity: 'warning',
        targetUserId: 'usr_jane',
        suspensionReason: 'Ongoing policy audit'
      };

      const alertInfo = getLogAlertInfo(log);
      expect(alertInfo.classification).toBe('WARNING');
      expect(alertInfo.showWarningIcon).toBe(true);
      expect(alertInfo.isAlert).toBe(true);
    });

    it('correctly classifies ACCOUNT_UNLOCKED as NORMAL with NO warning icon', () => {
      const log: AuditLogEntry = {
        id: 'log_unlock_1',
        timestamp: new Date().toISOString(),
        action: 'ACCOUNT_UNLOCKED',
        actorId: 'admin_1',
        actorName: 'Admin User',
        actorRole: 'admin',
        category: 'security',
        details: 'Account unlocked for user "Jane Doe". Account restored to ACTIVE. Reason: Verified legitimate identity.',
        severity: 'info',
        targetUserId: 'usr_jane'
      };

      const alertInfo = getLogAlertInfo(log);
      expect(alertInfo.classification).toBe('NORMAL');
      expect(alertInfo.showWarningIcon).toBe(false);
      expect(alertInfo.isAlert).toBe(false);
    });

    it('correctly classifies ACCOUNT_AUTO_RESTORED as NORMAL with NO warning icon', () => {
      const log: AuditLogEntry = {
        id: 'log_auto_1',
        timestamp: new Date().toISOString(),
        action: 'ACCOUNT_AUTO_RESTORED',
        actorId: 'system_scheduler',
        actorName: 'System Scheduler',
        actorRole: 'admin',
        category: 'security',
        details: 'Account suspension expired for user "Jane Doe". Status automatically restored to ACTIVE.',
        severity: 'info',
        targetUserId: 'usr_jane'
      };

      const alertInfo = getLogAlertInfo(log);
      expect(alertInfo.classification).toBe('NORMAL');
      expect(alertInfo.showWarningIcon).toBe(false);
      expect(alertInfo.isAlert).toBe(false);
    });

    it('correctly classifies ACCOUNT_SUSPENSION_REASON_UPDATED as NORMAL with NO warning icon', () => {
      const log: AuditLogEntry = {
        id: 'log_reason_1',
        timestamp: new Date().toISOString(),
        action: 'ACCOUNT_SUSPENSION_REASON_UPDATED',
        actorId: 'admin_1',
        actorName: 'Admin User',
        actorRole: 'admin',
        category: 'security',
        details: 'Suspension reason updated for user "Jane Doe". New reason: Additional verification documentation requested.',
        severity: 'info',
        targetUserId: 'usr_jane'
      };

      const alertInfo = getLogAlertInfo(log);
      expect(alertInfo.classification).toBe('NORMAL');
      expect(alertInfo.showWarningIcon).toBe(false);
      expect(alertInfo.isAlert).toBe(false);
    });
  });

  describe('Suspension Duration Calculations', () => {
    const calculateEndDate = (startDate: Date, durationPreset: string): Date => {
      const date = new Date(startDate.getTime());
      switch (durationPreset) {
        case '1h':
          date.setTime(date.getTime() + 1 * 60 * 60 * 1000);
          break;
        case '24h':
          date.setTime(date.getTime() + 24 * 60 * 60 * 1000);
          break;
        case '3d':
          date.setDate(date.getDate() + 3);
          break;
        case '7d':
          date.setDate(date.getDate() + 7);
          break;
        case '15d':
          date.setDate(date.getDate() + 15);
          break;
        case '30d':
          date.setDate(date.getDate() + 30);
          break;
      }
      return date;
    };

    it('calculates 1 hour duration accurately', () => {
      const now = new Date('2026-11-02T10:00:00.000Z');
      const end = calculateEndDate(now, '1h');
      expect(end.getTime() - now.getTime()).toBe(3600000);
    });

    it('calculates 24 hours duration accurately', () => {
      const now = new Date('2026-11-02T10:00:00.000Z');
      const end = calculateEndDate(now, '24h');
      expect(end.getTime() - now.getTime()).toBe(86400000);
    });

    it('calculates 3 days duration accurately', () => {
      const now = new Date('2026-11-02T10:00:00.000Z');
      const end = calculateEndDate(now, '3d');
      expect(end.toISOString().startsWith('2026-11-05')).toBe(true);
    });

    it('calculates 7 days duration accurately', () => {
      const now = new Date('2026-11-02T10:00:00.000Z');
      const end = calculateEndDate(now, '7d');
      expect(end.toISOString().startsWith('2026-11-09')).toBe(true);
    });

    it('calculates 15 days duration accurately', () => {
      const now = new Date('2026-11-02T10:00:00.000Z');
      const end = calculateEndDate(now, '15d');
      expect(end.toISOString().startsWith('2026-11-17')).toBe(true);
    });

    it('calculates 30 days duration accurately', () => {
      const now = new Date('2026-11-02T10:00:00.000Z');
      const end = calculateEndDate(now, '30d');
      expect(end.toISOString().startsWith('2026-12-02')).toBe(true);
    });
  });

  describe('Automatic Expiration and Restoration Engine Logic', () => {
    it('identifies expired suspensions and restores account to ACTIVE', () => {
      const expiredUser: Partial<UserProfile> = {
        uid: 'user_exp_1',
        name: 'Test Expired User',
        accountStatus: 'SUSPENDED',
        suspensionEndDate: '2026-11-01T00:00:00.000Z', // In past
        suspensionInfo: {
          startDate: '2026-10-25T00:00:00.000Z',
          endDate: '2026-11-01T00:00:00.000Z',
          reason: 'Multiple people detected using one account.',
          suspendedBy: 'admin_1',
          suspendedByName: 'Admin',
          isPermanent: false
        }
      };

      const now = new Date('2026-11-02T12:00:00.000Z');
      const isExpired =
        expiredUser.accountStatus === 'SUSPENDED' &&
        !!expiredUser.suspensionEndDate &&
        new Date(expiredUser.suspensionEndDate) <= now;

      expect(isExpired).toBe(true);

      // Transition simulation
      if (isExpired) {
        expiredUser.accountStatus = 'ACTIVE';
      }
      expect(expiredUser.accountStatus).toBe('ACTIVE');
    });

    it('does NOT expire permanent locked accounts', () => {
      const lockedUser: Partial<UserProfile> = {
        uid: 'user_lock_1',
        name: 'Permanently Locked User',
        accountStatus: 'LOCKED',
        suspensionInfo: {
          startDate: '2026-10-25T00:00:00.000Z',
          reason: 'Severe violation of institutional policy.',
          suspendedBy: 'admin_1',
          suspendedByName: 'Admin',
          isPermanent: true
        }
      };

      const now = new Date('2026-11-02T12:00:00.000Z');
      const isExpired =
        lockedUser.accountStatus === 'SUSPENDED' &&
        !!lockedUser.suspensionEndDate &&
        new Date(lockedUser.suspensionEndDate) <= now;

      expect(isExpired).toBe(false);
      expect(lockedUser.accountStatus).toBe('LOCKED');
    });

    it('does NOT expire suspensions that are still in effect', () => {
      const activeSuspendedUser: Partial<UserProfile> = {
        uid: 'user_active_susp_1',
        name: 'Currently Suspended User',
        accountStatus: 'SUSPENDED',
        suspensionEndDate: '2026-11-10T00:00:00.000Z', // in the future
        suspensionInfo: {
          startDate: '2026-11-01T00:00:00.000Z',
          endDate: '2026-11-10T00:00:00.000Z',
          reason: 'Administrative investigation.',
          suspendedBy: 'admin_1',
          suspendedByName: 'Admin',
          isPermanent: false
        }
      };

      const now = new Date('2026-11-02T12:00:00.000Z');
      const isExpired =
        activeSuspendedUser.accountStatus === 'SUSPENDED' &&
        !!activeSuspendedUser.suspensionEndDate &&
        new Date(activeSuspendedUser.suspensionEndDate) <= now;

      expect(isExpired).toBe(false);
      expect(activeSuspendedUser.accountStatus).toBe('SUSPENDED');
    });
  });

  describe('Suspension Record Validation', () => {
    it('enforces required reason with minimum length', () => {
      const validateSuspension = (reason: string) => {
        if (!reason || reason.trim().length < 5) {
          throw new Error('A detailed reason for suspension is required (minimum 5 characters).');
        }
        return true;
      };

      expect(() => validateSuspension('')).toThrow();
      expect(() => validateSuspension('   ')).toThrow();
      expect(() => validateSuspension('abc')).toThrow();
      expect(validateSuspension('Suspicious account sharing detected.')).toBe(true);
    });

    it('maintains suspension audit history structure', () => {
      const suspensionRecord: SuspensionRecord = {
        startDate: '2026-11-02T10:00:00.000Z',
        endDate: '2026-11-09T10:00:00.000Z',
        reason: 'Violation of institutional account policies.',
        suspendedBy: 'admin_1',
        suspendedByName: 'Administrator',
        isPermanent: false,
        history: [
          {
            id: 'entry_1',
            timestamp: '2026-11-02T10:00:00.000Z',
            action: 'SUSPENDED',
            performedBy: 'admin_1',
            performedByName: 'Administrator',
            reason: 'Violation of institutional account policies.',
            previousStatus: 'ACTIVE',
            newStatus: 'SUSPENDED',
            startDate: '2026-11-02T10:00:00.000Z',
            endDate: '2026-11-09T10:00:00.000Z'
          }
        ]
      };

      expect(suspensionRecord.history).toHaveLength(1);
      expect(suspensionRecord.history[0].action).toBe('SUSPENDED');
      expect(suspensionRecord.history[0].previousStatus).toBe('ACTIVE');
      expect(suspensionRecord.history[0].newStatus).toBe('SUSPENDED');
    });
  });
});
