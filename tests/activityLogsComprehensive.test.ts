import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  ACTIVITY_CATEGORY_GROUPS,
  emitActivityLog,
  flushActivityLogSyncQueue,
  formatCategoryLabel,
  getActivitySyncState,
  loadActivityLogsPrimary,
  mapExpressServerLogToAuditEntry,
  mapModerationAuditToActivityLog,
  matchesCategoryFilter,
  normalizeActivityLogEntry,
  resetActivitySyncStateForTests,
  setActivityLogPersistenceHooksForTests
} from '../src/services/activityLogService';
import { getLogAlertInfo } from '../src/components/admin/AuditLogView';
import type { AuditLogEntry, ModerationAuditRecord } from '../src/types';

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    }
  };
}

describe('Comprehensive Activity & Audit Logging Service', () => {
  const originalWindow = (globalThis as any).window;
  const originalLocalStorage = (globalThis as any).localStorage;
  const originalSessionStorage = (globalThis as any).sessionStorage;

  beforeEach(() => {
    const ls = createMemoryStorage();
    const ss = createMemoryStorage();
    (globalThis as any).localStorage = ls;
    (globalThis as any).sessionStorage = ss;
    (globalThis as any).window = { localStorage: ls, sessionStorage: ss };
    resetActivitySyncStateForTests();
    setActivityLogPersistenceHooksForTests(null);
  });

  afterEach(() => {
    resetActivitySyncStateForTests();
    setActivityLogPersistenceHooksForTests(null);
    if (originalWindow === undefined) delete (globalThis as any).window;
    else (globalThis as any).window = originalWindow;
    if (originalLocalStorage === undefined) delete (globalThis as any).localStorage;
    else (globalThis as any).localStorage = originalLocalStorage;
    if (originalSessionStorage === undefined) delete (globalThis as any).sessionStorage;
    else (globalThis as any).sessionStorage = originalSessionStorage;
  });

  it('normalizes entries, sanitizes doc IDs, scrubs secret fields/tokens, and bounds strings', () => {
    const entry = normalizeActivityLogEntry({
      id: 'log/bad:id with spaces?#123',
      action: 'POST_CREATED',
      actorId: 'usr_alum_1',
      actorName: 'Maria Santos',
      actorRole: 'alumni',
      category: 'social_feed',
      details: 'Created post Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.secret password=supersecret123',
      severity: 'critical' as any,
      metadata: {
        postId: 'post_1',
        password: 'raw-password-leak',
        passwordHash: '$2a$10$hash',
        token: 'jwt-leak',
        refreshToken: 'refresh-leak',
        secret: 'topsecret',
        audience: 'public'
      }
    });

    expect(entry.id).toMatch(/^[a-zA-Z0-9_\-.]+$/);
    expect(entry.severity).toBe('alert');
    expect(entry.details).toContain('Bearer [REDACTED]');
    expect(entry.details).toContain('password=[REDACTED]');
    expect(entry.details).not.toContain('eyJhbGciOiJIUzI1NiJ9');
    expect(entry.details).not.toContain('supersecret123');
    expect(entry.metadata).toEqual({
      postId: 'post_1',
      audience: 'public'
    });
  });

  it('stays idle when Firestore primary and Express mirror both succeed', async () => {
    (globalThis as any).localStorage.setItem('alumni_server_auth_token', 'test-jwt-token');
    const savedFs: AuditLogEntry[] = [];
    const savedExp: AuditLogEntry[] = [];

    setActivityLogPersistenceHooksForTests({
      saveFirestore: async (entry) => {
        savedFs.push(entry);
        return true;
      },
      sendExpress: async (entry) => {
        savedExp.push(entry);
        return true;
      }
    });

    const result = await emitActivityLog({
      id: 'log_social_like_1',
      action: 'POST_LIKED',
      actorId: 'usr_alum_1',
      actorName: 'Maria Santos',
      actorRole: 'alumni',
      category: 'social_feed',
      details: 'Liked post by Juan Dela Cruz.',
      severity: 'info',
      targetRecordId: 'post_99'
    });

    expect(result.firestoreSaved).toBe(true);
    expect(result.expressSaved).toBe(true);
    expect(savedFs).toHaveLength(1);
    expect(savedExp).toHaveLength(1);
    expect(getActivitySyncState()).toMatchObject({
      status: 'idle',
      pendingCount: 0
    });
  });

  it('queues failed Express syncs while Firestore succeeds, transitions to delayed on failed retry, and clears when recovered', async () => {
    (globalThis as any).localStorage.setItem('alumni_server_auth_token', 'test-jwt-token');
    let expressShouldFail = true;
    const savedExpIds: string[] = [];

    setActivityLogPersistenceHooksForTests({
      saveFirestore: async () => true,
      sendExpress: async (entry) => {
        if (expressShouldFail) return false;
        savedExpIds.push(entry.id);
        return true;
      }
    });

    const emitRes = await emitActivityLog({
      id: 'log_dm_msg_1',
      action: 'DIRECT_MESSAGE_SENT',
      actorId: 'usr_alum_2',
      actorName: 'Juan Dela Cruz',
      actorRole: 'alumni',
      category: 'messaging',
      details: 'Sent a direct message in thread thr_12 (metadata only).',
      severity: 'info',
      targetRecordId: 'thr_12'
    });

    expect(emitRes.firestoreSaved).toBe(true);
    expect(emitRes.expressSaved).toBe(false);
    expect(getActivitySyncState().status).toBe('syncing');
    expect(getActivitySyncState().pendingCount).toBe(1);

    // First retry also fails -> attempts increments to 2 -> delayed status surfaces in UI
    const firstRetry = await flushActivityLogSyncQueue();
    expect(firstRetry).toEqual({ flushed: 0, remaining: 1 });
    expect(getActivitySyncState().status).toBe('delayed');
    expect(getActivitySyncState().pendingCount).toBe(1);

    // Express recovers -> second flush succeeds and clears queue
    expressShouldFail = false;
    const secondRetry = await flushActivityLogSyncQueue();
    expect(secondRetry).toEqual({ flushed: 1, remaining: 0 });
    expect(savedExpIds).toEqual(['log_dm_msg_1']);
    expect(getActivitySyncState().status).toBe('idle');
    expect(getActivitySyncState().pendingCount).toBe(0);
  });

  it('merges Firestore audit_logs, moderation_audit_logs, and Express fallback logs deduplicated & sorted newest-first', async () => {
    const fsLogs: AuditLogEntry[] = [
      normalizeActivityLogEntry({
        id: 'log_shared_1',
        timestamp: '2026-11-23T08:00:00.000Z',
        action: 'PROFILE_UPDATED',
        actorId: 'usr_alum_1',
        actorName: 'Maria Santos',
        actorRole: 'alumni',
        category: 'profile',
        details: 'Updated profile fields: headline, skills.',
        severity: 'info'
      })
    ];

    const modRecs: ModerationAuditRecord[] = [
      {
        id: 'case_audit_1',
        caseId: 'case_1',
        postId: 'post_5',
        action: 'CASE_APPROVED_POST_REMOVED',
        actorId: 'usr_admin_1',
        actorName: 'Mod Officer',
        actorRole: 'admin',
        note: 'Removed offending post.',
        createdAt: '2026-11-23T09:00:00.000Z'
      }
    ];

    const expLogs: AuditLogEntry[] = [
      // Duplicate ID should not overwrite Firestore primary
      normalizeActivityLogEntry({
        id: 'log_shared_1',
        timestamp: '2026-11-23T08:00:00.000Z',
        action: 'PROFILE_UPDATED',
        actorId: 'usr_alum_1',
        actorName: 'Duplicate Name',
        actorRole: 'alumni',
        category: 'profile',
        details: 'Duplicate from express',
        severity: 'info'
      }),
      normalizeActivityLogEntry({
        id: 'log_exp_2',
        timestamp: '2026-11-23T07:30:00.000Z',
        action: 'JOB_APPLICATION_SUBMITTED',
        actorId: 'usr_alum_3',
        actorName: 'Carlo Reyes',
        actorRole: 'alumni',
        category: 'career',
        details: 'Applied for Software Engineer.',
        severity: 'success'
      })
    ];

    setActivityLogPersistenceHooksForTests({
      loadFirestore: async () => fsLogs,
      loadModerationAudits: async () => modRecs,
      loadExpress: async () => ({ ok: true, logs: expLogs })
    });

    const loaded = await loadActivityLogsPrimary(500);
    expect(loaded.firestoreOk).toBe(true);
    expect(loaded.expressOk).toBe(true);
    expect(loaded.logs.map((l) => l.id)).toEqual([
      'mod_case_audit_1',
      'log_shared_1',
      'log_exp_2'
    ]);
    expect(loaded.logs.find((l) => l.id === 'log_shared_1')?.actorName).toBe('Maria Santos');
  });

  it('maps Express server audit payloads and ModerationAuditRecords cleanly', () => {
    const modMapped = mapModerationAuditToActivityLog({
      id: 'audit_99',
      caseId: 'case_99',
      postId: 'post_99',
      targetUserId: 'usr_target_9',
      action: 'USER_SANCTION_APPLIED',
      actorId: 'usr_admin_1',
      actorName: 'Admin Dean',
      actorRole: 'admin',
      note: 'Issued formal warning.',
      createdAt: '2026-11-23T06:00:00.000Z'
    });
    expect(modMapped.category).toBe('moderation');
    expect(modMapped.targetUserId).toBe('usr_target_9');

    const expMapped = mapExpressServerLogToAuditEntry({
      id: 'srv_1',
      timestamp: '2026-11-23T05:00:00.000Z',
      action: 'UNAUTHORIZED_SUPERADMIN_ACCESS',
      actor: 'Regular Admin',
      actorRole: 'admin',
      category: 'security',
      ip: '203.0.113.10',
      details: {
        actorUid: 'usr_admin_2',
        attemptedPath: '/portal/audit',
        reason: 'SUPERADMIN_REQUIRED'
      }
    });
    expect(expMapped.severity).toBe('alert');
    expect(expMapped.actorId).toBe('usr_admin_2');
    expect(expMapped.targetRecordId).toBe('/portal/audit');
    expect(expMapped.details).toContain('/portal/audit');
  });

  it('filters all category groups accurately and formats category labels cleanly', () => {
    expect(ACTIVITY_CATEGORY_GROUPS.length).toBeGreaterThanOrEqual(9);
    expect(matchesCategoryFilter('social_feed', 'all')).toBe(true);
    expect(matchesCategoryFilter('social_feed', 'social_feed')).toBe(true);
    expect(matchesCategoryFilter('messaging', 'messaging')).toBe(true);
    expect(matchesCategoryFilter('settings', 'profile')).toBe(true);
    expect(matchesCategoryFilter('communication', 'engagement')).toBe(true);
    expect(matchesCategoryFilter('registry_masterlist', 'administration')).toBe(true);
    expect(matchesCategoryFilter('gallery', 'gallery')).toBe(true);
    expect(matchesCategoryFilter('social_feed', 'moderation')).toBe(false);

    expect(formatCategoryLabel('social_feed')).toBe('Social Feed');
    expect(formatCategoryLabel('messaging')).toBe('Messaging & Network');
    expect(formatCategoryLabel('gallery')).toBe('Campus Gallery');
  });

  it('classifies normal new user activities without false positive alert warnings', () => {
    const normalActions: Array<{ action: string; category: AuditLogEntry['category'] }> = [
      { action: 'POST_CREATED', category: 'social_feed' },
      { action: 'POST_LIKED', category: 'social_feed' },
      { action: 'POST_COMMENT_ADDED', category: 'social_feed' },
      { action: 'DIRECT_MESSAGE_SENT', category: 'messaging' },
      { action: 'CONNECTION_REQUEST_ACCEPTED', category: 'messaging' },
      { action: 'PROFILE_UPDATED', category: 'profile' },
      { action: 'PROFILE_RESUME_PDF_EXPORTED', category: 'profile' },
      { action: 'MODERATION_APPEAL_SUBMITTED', category: 'moderation' },
      { action: 'GALLERY_MEDIA_UPLOADED', category: 'gallery' },
      { action: 'NOTIFICATION_SETTINGS_UPDATED', category: 'settings' }
    ];

    for (const item of normalActions) {
      const info = getLogAlertInfo({
        id: `log_${item.action}`,
        timestamp: '2026-11-23T10:00:00.000Z',
        action: item.action,
        actorId: 'usr_1',
        actorName: 'Cecilian Alumni',
        actorRole: 'alumni',
        category: item.category,
        details: 'Routine user mutation.',
        severity: 'info'
      });
      expect(info.classification).toBe('NORMAL');
      expect(info.showWarningIcon).toBe(false);
    }
  });
});
