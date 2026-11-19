/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppNotification, DeepLinkTarget } from '../types';

export interface ParsedPortalRoute {
  isPortalPath: boolean;
  tab: string;
  subTab?: string;
  targetType: DeepLinkTarget['targetType'];
  targetId?: string;
  targetPath: string;
  targetRoute: string;
  requiresSuperAdmin: boolean;
  requestedSection: string;
}

const SUPERADMIN_RESTRICTED_SECTIONS = new Set(['audit', 'database', 'indexes']);

/**
 * Checks if a tab name or browser pathname targets a strictly superadmin-only section
 * (System Audit Logs, Database Configuration Management, or Index Administration).
 */
export function isSuperAdminRestrictedTarget(tabOrPath?: string | null): boolean {
  if (!tabOrPath) return false;
  const cleaned = String(tabOrPath).trim().toLowerCase();
  if (SUPERADMIN_RESTRICTED_SECTIONS.has(cleaned)) return true;
  if (/^\/?portal\/(audit|database|indexes)(?:\/|$)/i.test(cleaned)) return true;
  if (/^\/?admin\/(audit|database|indexes)(?:\/|$)/i.test(cleaned)) return true;
  return false;
}

/**
 * Maps internal tab + optional subTab + optional targetId to a clean canonical /portal/... URL.
 */
export function buildPortalUrlForTab(
  tab: string,
  subTab?: string,
  targetId?: string
): string {
  const safeEncode = (v: string) => encodeURIComponent(v.trim());
  const normalizedTab = (tab || 'dashboard').toLowerCase().trim();
  const idPart = targetId ? `/${safeEncode(targetId)}` : '';

  if (normalizedTab === 'dashboard') {
    return targetId ? `/portal/feed/${safeEncode(targetId)}` : '/portal/dashboard';
  }
  if (normalizedTab === 'employer_portal') {
    return `/portal/employer-portal${idPart}`;
  }
  if (normalizedTab === 'jobs' && subTab === 'employers') {
    return `/portal/jobs/employers${idPart}`;
  }
  if (normalizedTab === 'opportunities' && subTab === 'my_applications') {
    return `/portal/opportunities/applications${idPart}`;
  }
  if (normalizedTab === 'network' && (subTab === 'requests' || subTab === 'connections')) {
    return `/portal/network/${subTab}${idPart}`;
  }
  if (normalizedTab === 'moderation' && subTab === 'appeals') {
    return `/portal/moderation/appeals${idPart}`;
  }
  if (normalizedTab === 'profile' && subTab === 'moderation') {
    return `/portal/profile/moderation${idPart}`;
  }
  if (normalizedTab === 'conflicts' && (subTab === 'requests' || subTab === 'conflicts')) {
    return `/portal/conflicts/${subTab}${idPart}`;
  }
  return `/portal/${normalizedTab}${idPart}`;
}

/**
 * Resolves any notification into an exact DeepLinkTarget (tab, subTab, targetType, targetId, targetPath, targetRoute)
 * tailored to the viewer's role so clicking a notification in either the Header Bell, Notifications tab,
 * or In-App Push Toast navigates directly to the relevant tab and highlights the target item.
 */
export function resolveNotificationDeepLink(
  notif: AppNotification,
  userRole?: string
): DeepLinkTarget {
  const role = (userRole || 'alumni').toLowerCase().trim();
  const isUserAdminOrMod = ['admin', 'superadmin', 'moderator'].includes(role);
  const isUserEmployer = role === 'employer';
  const meta = notif.metadata || {};
  const titleLower = (notif.title || '').toLowerCase();
  const bodyLower = (notif.body || '').toLowerCase();
  const now = Date.now();

  const buildTarget = (
    tab: string,
    targetType: DeepLinkTarget['targetType'],
    targetId?: string,
    subTab?: string,
    explicitPath?: string
  ): DeepLinkTarget => {
    const computedPath = explicitPath || buildPortalUrlForTab(tab, subTab, targetId);
    return {
      tab,
      targetType,
      targetId,
      subTab,
      targetPath: computedPath,
      targetRoute: computedPath,
      fromUid: notif.fromUid,
      notificationId: notif.id,
      timestamp: now
    };
  };

  // Honor explicit /portal/... targetPath/targetRoute when role context matches
  const existingPath = notif.targetPath || notif.targetRoute;
  if (existingPath && existingPath.startsWith('/portal/')) {
    const parsed = parsePortalUrlPath(existingPath, role);
    if (parsed.isPortalPath && (!parsed.requiresSuperAdmin || role === 'superadmin')) {
      return buildTarget(
        parsed.tab,
        parsed.targetType,
        parsed.targetId || notif.refId,
        parsed.subTab,
        parsed.targetPath
      );
    }
  }

  // 1. Direct Messages / Event Chats
  if (notif.type === 'message') {
    const chatId = notif.refId || meta.chatId || meta.conversationId;
    return buildTarget('messages', 'message', chatId);
  }

  // 2. Social Feed Interactions (Posts, Comments, Reactions, Shares)
  if (
    notif.type === 'feed_post' ||
    notif.type === 'post_comment' ||
    notif.type === 'post_reaction' ||
    notif.type === 'post_share'
  ) {
    const postId = notif.refId || meta.postId;
    const subTab = notif.type === 'post_comment' ? 'comments' : undefined;
    return buildTarget('dashboard', 'feed_post', postId, subTab);
  }

  // 3. Events & RSVPs
  if (notif.type === 'event' || notif.type === 'event_broadcast') {
    const eventId = notif.refId || meta.eventId;
    return buildTarget('events', 'event', eventId, meta.subTab);
  }

  // 4. Institutional Announcements
  if (notif.type === 'announcement' || notif.type === 'announcement_broadcast') {
    const announcementId = notif.refId || meta.announcementId;
    return buildTarget('announcements', 'announcement', announcementId);
  }

  // 5. Campus Gallery
  if (notif.type === 'gallery') {
    return buildTarget(
      isUserAdminOrMod ? 'gallery' : 'dashboard',
      'gallery',
      notif.refId || meta.galleryId
    );
  }

  // 6. Network Connections & Friend Requests
  if (notif.type === 'friend_request') {
    return buildTarget('network', 'network_request', notif.refId || notif.fromUid, 'requests');
  }

  if (notif.type === 'friend_accepted') {
    return buildTarget('network', 'network_profile', notif.fromUid || notif.refId, 'connections');
  }

  // 8. Moderation Alerts, Warnings, Deletions & Appeals
  if (
    notif.type === 'moderation_high_priority' ||
    notif.type === 'moderation_abuse_alert'
  ) {
    const targetId = notif.refId || meta.reportId || meta.postId;
    if (isUserAdminOrMod) {
      return buildTarget('moderation', 'moderation_queue', targetId, 'queue');
    }
    return buildTarget('dashboard', 'feed_post', meta.postId || targetId);
  }

  if (notif.type === 'moderation_appeal') {
    const targetId = notif.refId || meta.appealId || meta.postId;
    if (isUserAdminOrMod) {
      return buildTarget('moderation', 'moderation_appeal', targetId, 'appeals');
    }
    return buildTarget('profile', 'profile_moderation', meta.postId || targetId, 'moderation');
  }

  if (
    notif.type === 'moderation_warning' ||
    notif.type === 'moderation_deletion' ||
    notif.type === 'moderation_report_resolved'
  ) {
    const targetId = notif.refId || meta.postId || meta.reportId;
    if (isUserAdminOrMod && notif.type === 'moderation_report_resolved') {
      return buildTarget('moderation', 'moderation_queue', targetId, 'resolved');
    }
    return buildTarget('profile', 'profile_moderation', targetId, 'moderation');
  }

  // 9. Jobs, Applications & Employer Accreditation
  if (notif.type === 'job') {
    const jobId = notif.refId || meta.jobId || meta.applicationId;
    const isEmployerReview =
      meta.targetSubTab === 'employers' ||
      notif.id.startsWith('notif_emp_') ||
      titleLower.includes('employer') ||
      titleLower.includes('accreditation') ||
      titleLower.includes('renewal');

    const isApplicationEvent =
      Boolean(meta.applicationId) ||
      titleLower.includes('application') ||
      bodyLower.includes('applied for') ||
      titleLower.includes('shortlisted') ||
      titleLower.includes('interview') ||
      titleLower.includes('hired');

    if (isUserAdminOrMod) {
      if (isEmployerReview) {
        return buildTarget('jobs', 'employer', meta.employerUid || notif.refId, 'employers');
      }
      return buildTarget(
        'jobs',
        'job',
        jobId,
        titleLower.includes('awaiting approval') ? 'moderation' : 'jobs'
      );
    }

    if (isUserEmployer) {
      return buildTarget(
        'employer_portal',
        'job',
        jobId,
        isApplicationEvent ? 'applicants' : 'jobs'
      );
    }

    return buildTarget(
      'opportunities',
      'job',
      jobId,
      isApplicationEvent ? 'my_applications' : 'explore'
    );
  }

  // 10. Profile Updates
  if (notif.type === 'profile_update') {
    return buildTarget('profile', 'verification', notif.refId);
  }

  // 11. General & Security Notifications
  if (notif.type === 'general' || notif.type === 'security') {
    if (meta.targetTab) {
      return buildTarget(
        String(meta.targetTab),
        (meta.targetType as DeepLinkTarget['targetType']) || 'dashboard',
        notif.refId || meta.targetId || meta.jobId || meta.eventId || meta.postId,
        meta.targetSubTab
      );
    }

    if (
      titleLower.includes('employer') ||
      titleLower.includes('accreditation') ||
      titleLower.includes('renewal') ||
      notif.id.startsWith('notif_emp_') ||
      notif.id.startsWith('notif_renew_')
    ) {
      if (isUserAdminOrMod) {
        return buildTarget('jobs', 'employer', notif.refId || meta.employerUid, 'employers');
      }
      if (isUserEmployer) {
        return buildTarget('employer_portal', 'employer', notif.refId || meta.employerUid);
      }
      return buildTarget('opportunities', 'job', notif.refId);
    }

    if (titleLower.includes('job') || bodyLower.includes('job posting') || Boolean(meta.jobId)) {
      const jobId = notif.refId || meta.jobId;
      if (isUserAdminOrMod) {
        return buildTarget('jobs', 'job', jobId, titleLower.includes('awaiting') ? 'moderation' : 'jobs');
      }
      if (isUserEmployer) {
        return buildTarget('employer_portal', 'job', jobId, 'jobs');
      }
      return buildTarget('opportunities', 'job', jobId, 'explore');
    }

    if (
      titleLower.includes('conflict') ||
      titleLower.includes('dispute') ||
      titleLower.includes('appeal') ||
      titleLower.includes('verification') ||
      titleLower.includes('registrar') ||
      bodyLower.includes('conflict')
    ) {
      if (isUserAdminOrMod) {
        const isDisputeClaim =
          titleLower.includes('dispute') ||
          bodyLower.includes('dispute student id') ||
          titleLower.includes('id claim');
        const subTab = isDisputeClaim ? 'requests' : 'conflicts';
        return buildTarget('conflicts', 'conflict', notif.refId || meta.conflictId, subTab);
      }
      return buildTarget('profile', 'verification', notif.refId);
    }

    if (
      titleLower.includes('post') ||
      titleLower.includes('moderation') ||
      titleLower.includes('report') ||
      Boolean(meta.postId)
    ) {
      if (isUserAdminOrMod) {
        return buildTarget('moderation', 'moderation_queue', notif.refId || meta.postId, 'queue');
      }
      return buildTarget('dashboard', 'feed_post', notif.refId || meta.postId);
    }

    if (
      notif.type === 'security' ||
      titleLower.includes('password') ||
      titleLower.includes('login') ||
      titleLower.includes('security') ||
      titleLower.includes('locked') ||
      titleLower.includes('2fa') ||
      titleLower.includes('unauthorized')
    ) {
      if (role === 'superadmin' && titleLower.includes('unauthorized')) {
        return buildTarget('audit', 'audit', notif.refId);
      }
      return buildTarget('settings', 'security', notif.refId);
    }
  }

  return buildTarget('dashboard', 'dashboard', notif.refId);
}

/**
 * Ensures any notification payload (new or legacy) contains valid targetPath and targetRoute fields.
 */
export function normalizeNotificationPayload(
  notif: AppNotification,
  userRole?: string
): AppNotification {
  const resolved = resolveNotificationDeepLink(notif, userRole);
  const path = notif.targetPath || notif.targetRoute || resolved.targetPath;
  return {
    ...notif,
    targetPath: path,
    targetRoute: notif.targetRoute || path
  };
}

/**
 * Global notification builder used across client and server emitters to enforce targetPath & targetRoute.
 */
export function createNotificationPayload(
  input: Omit<AppNotification, 'id' | 'createdAt' | 'read'> & {
    id?: string;
    createdAt?: string;
    read?: boolean;
  },
  userRole?: string
): AppNotification {
  const base: AppNotification = {
    ...input,
    id: input.id || `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    read: input.read ?? false,
    createdAt: input.createdAt || new Date().toISOString()
  };
  return normalizeNotificationPayload(base, userRole);
}

/**
 * Parses clean /portal/... pathnames (e.g. /portal/events/123, /portal/audit) into active tab,
 * sub-tab, targetType, highlighted item ID, and superadmin gate metadata.
 */
export function parsePortalUrlPath(pathname: string, userRole?: string): ParsedPortalRoute {
  const cleanPath = (pathname || '/').split('?')[0].split('#')[0];
  const segments = cleanPath.split('/').filter(Boolean);
  const role = (userRole || 'alumni').toLowerCase().trim();
  const isUserAdminOrMod = ['admin', 'superadmin', 'moderator'].includes(role);

  if (segments[0]?.toLowerCase() !== 'portal') {
    return {
      isPortalPath: false,
      tab: 'dashboard',
      targetType: 'dashboard',
      targetPath: '/portal/dashboard',
      targetRoute: '/portal/dashboard',
      requiresSuperAdmin: false,
      requestedSection: 'dashboard'
    };
  }

  const section = decodeURIComponent(segments[1] || 'dashboard').toLowerCase().trim();
  const seg2 = segments[2] ? decodeURIComponent(segments[2]) : undefined;
  const seg3 = segments[3] ? decodeURIComponent(segments[3]) : undefined;

  if (section === 'audit' || section === 'audit-logs') {
    return {
      isPortalPath: true,
      tab: 'audit',
      targetType: 'audit',
      targetId: seg2,
      targetPath: cleanPath,
      targetRoute: cleanPath,
      requiresSuperAdmin: true,
      requestedSection: 'audit'
    };
  }

  if (section === 'database') {
    return {
      isPortalPath: true,
      tab: 'database',
      targetType: 'database',
      targetId: seg2,
      targetPath: cleanPath,
      targetRoute: cleanPath,
      requiresSuperAdmin: true,
      requestedSection: 'database'
    };
  }

  if (section === 'indexes') {
    return {
      isPortalPath: true,
      tab: 'indexes',
      targetType: 'indexes',
      targetId: seg2,
      targetPath: cleanPath,
      targetRoute: cleanPath,
      requiresSuperAdmin: true,
      requestedSection: 'indexes'
    };
  }

  if (section === 'feed' || section === 'dashboard') {
    return {
      isPortalPath: true,
      tab: 'dashboard',
      targetType: seg2 ? 'feed_post' : 'dashboard',
      targetId: seg2,
      targetPath: cleanPath,
      targetRoute: cleanPath,
      requiresSuperAdmin: false,
      requestedSection: section
    };
  }

  if (section === 'events') {
    return {
      isPortalPath: true,
      tab: 'events',
      targetType: 'event',
      targetId: seg2,
      targetPath: cleanPath,
      targetRoute: cleanPath,
      requiresSuperAdmin: false,
      requestedSection: 'events'
    };
  }

  if (section === 'announcements') {
    return {
      isPortalPath: true,
      tab: 'announcements',
      targetType: 'announcement',
      targetId: seg2,
      targetPath: cleanPath,
      targetRoute: cleanPath,
      requiresSuperAdmin: false,
      requestedSection: 'announcements'
    };
  }

  if (section === 'messages') {
    return {
      isPortalPath: true,
      tab: 'messages',
      targetType: 'message',
      targetId: seg2,
      targetPath: cleanPath,
      targetRoute: cleanPath,
      requiresSuperAdmin: false,
      requestedSection: 'messages'
    };
  }

  if (section === 'opportunities') {
    const isApps = seg2 === 'applications';
    return {
      isPortalPath: true,
      tab: isUserAdminOrMod ? 'jobs' : 'opportunities',
      subTab: isApps ? 'my_applications' : 'explore',
      targetType: 'job',
      targetId: isApps ? seg3 : seg2,
      targetPath: cleanPath,
      targetRoute: cleanPath,
      requiresSuperAdmin: false,
      requestedSection: 'opportunities'
    };
  }

  if (section === 'employer-portal' || section === 'employer_portal') {
    return {
      isPortalPath: true,
      tab: 'employer_portal',
      subTab: seg2 === 'applicants' ? 'applicants' : 'jobs',
      targetType: 'job',
      targetId: seg2 === 'applicants' ? seg3 : seg2,
      targetPath: cleanPath,
      targetRoute: cleanPath,
      requiresSuperAdmin: false,
      requestedSection: 'employer_portal'
    };
  }

  if (section === 'jobs') {
    const isEmployers = seg2 === 'employers';
    return {
      isPortalPath: true,
      tab: isUserAdminOrMod ? 'jobs' : role === 'employer' ? 'employer_portal' : 'opportunities',
      subTab: isEmployers ? 'employers' : 'jobs',
      targetType: isEmployers ? 'employer' : 'job',
      targetId: isEmployers ? seg3 : seg2,
      targetPath: cleanPath,
      targetRoute: cleanPath,
      requiresSuperAdmin: false,
      requestedSection: 'jobs'
    };
  }

  if (section === 'network') {
    const subTab = seg2 === 'requests' || seg2 === 'connections' ? seg2 : undefined;
    return {
      isPortalPath: true,
      tab: 'network',
      subTab,
      targetType: subTab === 'requests' ? 'network_request' : 'network_profile',
      targetId: subTab ? seg3 : seg2,
      targetPath: cleanPath,
      targetRoute: cleanPath,
      requiresSuperAdmin: false,
      requestedSection: 'network'
    };
  }

  if (section === 'moderation') {
    const isAppeals = seg2 === 'appeals';
    return {
      isPortalPath: true,
      tab: isUserAdminOrMod ? 'moderation' : 'profile',
      subTab: isAppeals ? 'appeals' : 'queue',
      targetType: isAppeals ? 'moderation_appeal' : 'moderation_queue',
      targetId: isAppeals ? seg3 : seg2,
      targetPath: cleanPath,
      targetRoute: cleanPath,
      requiresSuperAdmin: false,
      requestedSection: 'moderation'
    };
  }

  if (section === 'profile') {
    const isMod = seg2 === 'moderation';
    return {
      isPortalPath: true,
      tab: 'profile',
      subTab: isMod ? 'moderation' : undefined,
      targetType: isMod ? 'profile_moderation' : 'verification',
      targetId: isMod ? seg3 : seg2,
      targetPath: cleanPath,
      targetRoute: cleanPath,
      requiresSuperAdmin: false,
      requestedSection: 'profile'
    };
  }

  if (section === 'conflicts') {
    const subTab = seg2 === 'requests' || seg2 === 'conflicts' ? seg2 : undefined;
    return {
      isPortalPath: true,
      tab: 'conflicts',
      subTab,
      targetType: 'conflict',
      targetId: subTab ? seg3 : seg2,
      targetPath: cleanPath,
      targetRoute: cleanPath,
      requiresSuperAdmin: false,
      requestedSection: 'conflicts'
    };
  }

  if (section === 'gallery') {
    return {
      isPortalPath: true,
      tab: isUserAdminOrMod ? 'gallery' : 'dashboard',
      targetType: 'gallery',
      targetId: seg2,
      targetPath: cleanPath,
      targetRoute: cleanPath,
      requiresSuperAdmin: false,
      requestedSection: 'gallery'
    };
  }

  if (section === 'settings') {
    return {
      isPortalPath: true,
      tab: 'settings',
      targetType: 'security',
      targetId: seg2,
      targetPath: cleanPath,
      targetRoute: cleanPath,
      requiresSuperAdmin: false,
      requestedSection: 'settings'
    };
  }

  return {
    isPortalPath: true,
    tab: section || 'dashboard',
    targetType: 'dashboard',
    targetId: seg2,
    targetPath: cleanPath,
    targetRoute: cleanPath,
    requiresSuperAdmin: false,
    requestedSection: section
  };
}
