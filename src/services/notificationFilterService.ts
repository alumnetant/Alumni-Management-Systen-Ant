import { AppNotification, UserProfile } from '../types';

export interface UserPermissions {
  canManageJobModeration?: boolean;
  canAccessEmployerAccreditation?: boolean;
  canPostJobs?: boolean;
  canCreateEvents?: boolean;
  [key: string]: any;
}

/**
 * Validates whether a notification is relevant to the given user based strictly
 * on their assigned role, dashboard permissions, and target activity scope.
 *
 * User Roles & Dashboard Feature Mapping:
 * - Alumni:
 *     Features: Career Opportunities (Job Board), My Applications, Campus Events & Reunions,
 *     Official Bulletins, Cecilian Network, Direct Messages, Digital ID Pass, Registrar Verification.
 *     Excluded: Job Moderation Queue, Employer Accreditation, Student ID Importer/Matcher, System Governance.
 *
 * - Employer:
 *     Features: Employer Portal (Post Jobs, Manage Own Job Postings, Review Job Applications/Applicants Tracker,
 *     Update Candidate Statuses, Accreditation Status, Renewal Requests), Messages.
 *     Excluded: Alumni Job Board Opening alerts (as a candidate), Alumni Reunions/Homecoming RSVPs,
 *     Student Registry, Admin Conflict Resolution, Governance Audit Logs.
 *
 * - Registrar:
 *     Features: Academic Registry, CSV Bulk Student Importer, Registrar Matcher, Student ID Conflicts, Bulletins.
 *     Excluded: Employer candidate hiring, Job moderation.
 *
 * - Admin / Superadmin:
 *     Features: Command Center, User Management, Job Moderation Queue, Employer Accreditation,
 *     Governance Policies, System Audit Logs, Bulletins, Events.
 */
export function isNotificationRelevantToUser(
  notif: AppNotification,
  user: UserProfile | null | undefined,
  permissions?: UserPermissions | null
): boolean {
  if (!user) return false;

  const role = user.role || 'alumni';
  const isUserAlumni = role === 'alumni';
  const isUserEmployer = role === 'employer';
  const isUserRegistrar = role === 'registrar';
  const isUserAdmin = role === 'admin' || role === 'superadmin';
  const isUserStaffOrModerator = role === 'staff' || role === 'moderator';

  // 1. Direct User Targeting
  if (notif.toUid && notif.toUid !== 'all') {
    // Admin queue alias: notifications targeted to "admin" or "administrators"
    if (notif.toUid === 'admin' || notif.toUid === 'administrators') {
      return isUserAdmin || (permissions?.canManageJobModeration ?? false);
    }
    // Directly addressed to another specific user UID
    if (notif.toUid !== user.uid) {
      return false;
    }
    // Addressed to this user specifically
    return true;
  }

  // 2. Explicit Role Targeting in metadata
  if (notif.metadata?.targetRole) {
    const target = notif.metadata.targetRole;
    if (target === 'alumni' && !isUserAlumni) return false;
    if (target === 'employer' && !isUserEmployer) return false;
    if (target === 'registrar' && !isUserRegistrar && !isUserAdmin) return false;
    if (target === 'admin' && !isUserAdmin && !permissions?.canManageJobModeration) return false;
    if (target === 'moderator' && !isUserAdmin && role !== 'moderator') return false;
    if (target === 'staff' && !isUserAdmin && !isUserStaffOrModerator) return false;
  }

  if (Array.isArray(notif.metadata?.targetRoles)) {
    const targets = notif.metadata.targetRoles;
    if (!targets.includes(role)) {
      if (isUserAdmin && targets.includes('admin')) {
        // allowed for admin
      } else {
        return false;
      }
    }
  }

  // 3. Prevent non-admins from seeing internal administrative queues
  const titleLower = (notif.title || '').toLowerCase();
  const bodyLower = (notif.body || '').toLowerCase();

  const isAdminQueueNotice =
    notif.id.startsWith('notif_job_pend_') ||
    notif.id.startsWith('notif_emp_reg_') ||
    notif.id.startsWith('notif_renew_req_') ||
    titleLower.includes('awaiting approval') ||
    titleLower.includes('awaiting review') ||
    titleLower.includes('conflict detected') ||
    titleLower.includes('employer partner registered') ||
    titleLower.includes('renewal request submitted');

  if (isAdminQueueNotice) {
    return isUserAdmin || (permissions?.canManageJobModeration ?? false);
  }

  // 4. Employer-Specific Notices
  const isEmployerNotice =
    notif.id.startsWith('notif_emp_warn_') ||
    notif.id.startsWith('notif_emp_expired_') ||
    notif.id.startsWith('notif_renew_done_') ||
    notif.id.startsWith('notif_emp_ver_') ||
    titleLower.includes('accreditation') ||
    titleLower.includes('renewal reminder') ||
    titleLower.includes('subscription expiry');

  if (isEmployerNotice) {
    // Only the employer themselves or an admin managing accreditation should see this
    return isUserEmployer || isUserAdmin;
  }

  // 5. Job Openings Broadcast (Career Opportunities on Alumni Job Board)
  if (notif.type === 'job') {
    const isJobOpeningBroadcast =
      titleLower.includes('career opening') ||
      bodyLower.includes('is hiring') ||
      bodyLower.includes('career opportunity published') ||
      bodyLower.includes('check requirements & apply');

    if (isJobOpeningBroadcast) {
      // Employers are corporate recruiters posting jobs; they do not receive job seeker alerts
      if (isUserEmployer) return false;
      // Registrars manage student records, not job seeking
      if (isUserRegistrar) return false;
      // Admins manage the platform
      if (isUserAdmin) return false;
      // Only alumni receive career opening alerts
      return isUserAlumni;
    }

    const isApplicationReceived =
      titleLower.includes('new job application') ||
      bodyLower.includes('applied for') ||
      titleLower.includes('application withdrawn');

    if (isApplicationReceived) {
      // Only employers who posted or administrators should see application received
      return isUserEmployer || isUserAdmin;
    }
  }

  // 6. Campus Events & Reunions (Reunions, Alumni Homecomings)
  if (notif.type === 'event' || notif.type === 'event_broadcast') {
    // Corporate employers do not participate in alumni batch reunions / student events
    if (isUserEmployer) return false;
    return isUserAlumni || isUserAdmin || isUserStaffOrModerator || isUserRegistrar;
  }

  // 7. Profile Completion Reminders
  if (notif.type === 'profile_update' && titleLower.includes('alumni profile')) {
    // Only alumni have student academic profiles with graduation batches and degrees
    return isUserAlumni;
  }

  // 8. Campus Gallery
  if (notif.type === 'gallery') {
    if (isUserEmployer) return false;
    return true;
  }

  // 9. Friend Requests & Network Connections
  if (notif.type === 'friend_request' || notif.type === 'friend_accepted') {
    if (isUserEmployer) return false;
    return true;
  }

  return true;
}

/**
 * Deduplicates an array of notifications ensuring no identical notification
 * is shown multiple times.
 */
export function filterUniqueNotifications(notifications: AppNotification[]): AppNotification[] {
  const seenIds = new Set<string>();
  const seenSignatures = new Set<string>();
  const result: AppNotification[] = [];

  for (const notif of notifications) {
    if (!notif || !notif.id) continue;
    if (seenIds.has(notif.id)) continue;
    seenIds.add(notif.id);

    // Create a normalized content signature to detect redundant duplicate pushes
    const sig = `${notif.type || ''}|${(notif.title || '').trim().toLowerCase()}|${notif.refId || ''}|${notif.toUid || 'all'}`;
    if (seenSignatures.has(sig)) continue;
    seenSignatures.add(sig);

    result.push(notif);
  }

  return result;
}
