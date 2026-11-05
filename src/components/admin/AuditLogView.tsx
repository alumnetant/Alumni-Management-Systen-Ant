/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Download,
  Search,
  Layers,
  Eye,
  X,
  Copy,
  Check,
  User,
  ArrowUpDown,
  Radio,
  Shield,
  Filter,
  LogIn,
  RotateCcw,
  Clock,
  Briefcase,
  GraduationCap,
  Users,
  ShieldQuestion,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAlumni } from '../../context/AlumniContext';
import { AuditLogEntry } from '../../types';

export type ActivityClassification =
  | 'NORMAL'
  | 'WARNING'
  | 'SUSPICIOUS'
  | 'LOCKED'
  | 'SUSPENDED';

export interface AlertInfo {
  isAlert: boolean;
  isSuspicious: boolean;
  showWarningIcon: boolean;
  classification: ActivityClassification;
  alertType:
    | 'user_login'
    | 'failed_login'
    | 'multiple_failed_logins'
    | 'account_locked'
    | 'multiple_users_same_account'
    | 'security_alert'
    | 'routine'
    | null;
  badgeLabel: string;
}

/**
 * Evaluates activity log classification and warning icon requirements.
 * 
 * Exact Classification & Warning Icon Matrix:
 * 1. USER_LOGIN (successful)        -> NORMAL     -> Warning: No
 * 2. FAILED_LOGIN_ATTEMPT           -> WARNING    -> Warning: Yes (⚠️)
 * 3. MULTIPLE_FAILED_LOGIN_ATTEMPTS -> SUSPICIOUS -> Warning: Yes (⚠️)
 * 4. MULTIPLE_USERS_SAME_ACCOUNT    -> SUSPICIOUS -> Warning: Yes (⚠️)
 * 5. ACCOUNT_LOCKED                 -> LOCKED     -> Warning: Yes (⚠️)
 * 6. ACCOUNT_SUSPENDED              -> SUSPENDED  -> Warning: Yes (⚠️)
 * 7. ADMIN_UNLOCKED_ACCOUNT         -> NORMAL     -> Warning: No
 * 8. ACCOUNT_AUTO_RESTORED          -> NORMAL     -> Warning: No
 * 
 * Discontinue generating USER_RELOGIN as a new event.
 */
export function getLogAlertInfo(log: AuditLogEntry): AlertInfo {
  const actionUpper = (log.action || '').toUpperCase();
  const detailsUpper = (log.details || '').toUpperCase();

  // 1. ACCOUNT_SUSPENDED (SUSPENDED status, ⚠️ Yes)
  if (
    actionUpper === 'ACCOUNT_SUSPENDED' ||
    actionUpper.includes('ACCOUNT_SUSPENDED') ||
    actionUpper.includes('ACCOUNT SUSPENDED') ||
    detailsUpper.includes('ACCOUNT SUSPENDED')
  ) {
    return {
      isAlert: true,
      isSuspicious: true,
      showWarningIcon: true,
      classification: 'SUSPENDED',
      alertType: 'account_locked',
      badgeLabel: 'Account Suspended'
    };
  }

  // 2. ACCOUNT_LOCKED (LOCKED status, ⚠️ Yes)
  if (
    actionUpper === 'ACCOUNT_LOCKED' ||
    actionUpper === 'ADMIN_LOCKED_ACCOUNT' ||
    actionUpper.includes('ACCOUNT_LOCKED') ||
    actionUpper.includes('ACCOUNT LOCKED') ||
    detailsUpper.includes('ACCOUNT LOCKED') ||
    detailsUpper.includes('TEMPORARY ACCOUNT LOCKOUT ENFORCED') ||
    detailsUpper.includes('ACCOUNT LOCKOUT ENFORCED')
  ) {
    return {
      isAlert: true,
      isSuspicious: true,
      showWarningIcon: true,
      classification: 'LOCKED',
      alertType: 'account_locked',
      badgeLabel: 'Account Locked'
    };
  }

  // 3. ACCOUNT_SUSPENSION_EXTENDED (WARNING status, ⚠️ Yes)
  if (
    actionUpper === 'ACCOUNT_SUSPENSION_EXTENDED' ||
    actionUpper.includes('SUSPENSION_EXTENDED') ||
    actionUpper.includes('SUSPENSION EXTENDED') ||
    detailsUpper.includes('SUSPENSION EXTENDED')
  ) {
    return {
      isAlert: true,
      isSuspicious: false,
      showWarningIcon: true,
      classification: 'WARNING',
      alertType: 'security_alert',
      badgeLabel: 'Suspension Extended'
    };
  }

  // 4. ADMIN_UNLOCKED_ACCOUNT / ACCOUNT_UNLOCKED (NORMAL status, No warning icon)
  if (
    actionUpper === 'ADMIN_UNLOCKED_ACCOUNT' ||
    actionUpper === 'ACCOUNT_UNLOCKED' ||
    actionUpper.includes('ADMIN_UNLOCKED_ACCOUNT') ||
    actionUpper.includes('ACCOUNT_UNLOCKED') ||
    actionUpper.includes('ACCOUNT UNLOCKED') ||
    detailsUpper.includes('ACCOUNT UNLOCKED') ||
    detailsUpper.includes('LOCKOUT LIFTED')
  ) {
    return {
      isAlert: false,
      isSuspicious: false,
      showWarningIcon: false,
      classification: 'NORMAL',
      alertType: 'routine',
      badgeLabel: 'Account Unlocked'
    };
  }

  // 1.4 ACCOUNT_AUTO_RESTORED (Normal - suspension expired automatically, NO warning icon)
  if (
    actionUpper === 'ACCOUNT_AUTO_RESTORED' ||
    actionUpper.includes('AUTO_RESTORED') ||
    actionUpper.includes('AUTO-RESTORED') ||
    actionUpper.includes('AUTO RESTORED') ||
    detailsUpper.includes('AUTOMATICALLY RESTORED') ||
    detailsUpper.includes('AUTO RESTORED')
  ) {
    return {
      isAlert: false,
      isSuspicious: false,
      showWarningIcon: false,
      classification: 'NORMAL',
      alertType: 'routine',
      badgeLabel: 'Account Auto-Restored'
    };
  }

  // 1.5 ACCOUNT_SUSPENSION_REASON_UPDATED (Normal - reason updated, NO warning icon)
  if (
    actionUpper === 'ACCOUNT_SUSPENSION_REASON_UPDATED' ||
    actionUpper.includes('SUSPENSION_REASON_UPDATED') ||
    detailsUpper.includes('SUSPENSION REASON UPDATED')
  ) {
    return {
      isAlert: false,
      isSuspicious: false,
      showWarningIcon: false,
      classification: 'NORMAL',
      alertType: 'routine',
      badgeLabel: 'Reason Updated'
    };
  }

  // 2. MULTIPLE_USERS_SAME_ACCOUNT (Suspicious - multiple people suspected on one account)
  if (
    actionUpper === 'MULTIPLE_USERS_SAME_ACCOUNT' ||
    actionUpper.includes('MULTIPLE_USERS') ||
    actionUpper.includes('MULTIPLE USERS') ||
    detailsUpper.includes('MULTIPLE USERS') ||
    detailsUpper.includes('CONCURRENT SESSION OVERRIDE')
  ) {
    return {
      isAlert: true,
      isSuspicious: true,
      showWarningIcon: true,
      classification: 'SUSPICIOUS',
      alertType: 'multiple_users_same_account',
      badgeLabel: 'Multiple Users on Account'
    };
  }

  // 3. MULTIPLE_FAILED_LOGIN_ATTEMPTS (Suspicious - repeated failed logins)
  if (
    actionUpper === 'MULTIPLE_FAILED_LOGIN_ATTEMPTS' ||
    actionUpper === 'SUSPICIOUS_MULTIPLE_FAILED_LOGINS' ||
    actionUpper.includes('MULTIPLE_FAILED') ||
    actionUpper.includes('MULTIPLE FAILED') ||
    detailsUpper.includes('MULTIPLE FAILED LOGIN ATTEMPTS') ||
    detailsUpper.includes('MULTIPLE FAILED ATTEMPTS')
  ) {
    return {
      isAlert: true,
      isSuspicious: true,
      showWarningIcon: true,
      classification: 'SUSPICIOUS',
      alertType: 'multiple_failed_logins',
      badgeLabel: 'Multiple Failed Attempts'
    };
  }

  // 4. FAILED_LOGIN_ATTEMPT (Failed / Warning - incorrect username or password)
  if (
    actionUpper === 'FAILED_LOGIN_ATTEMPT' ||
    actionUpper.includes('FAILED_LOGIN') ||
    actionUpper.includes('FAILED LOGIN') ||
    detailsUpper.includes('FAILED LOGIN ATTEMPT') ||
    detailsUpper.includes('FAILED AUTHENTICATION') ||
    detailsUpper.includes('INCORRECT PASSWORD')
  ) {
    return {
      isAlert: true,
      isSuspicious: false,
      showWarningIcon: true,
      classification: 'WARNING',
      alertType: 'failed_login',
      badgeLabel: 'Failed Login Attempt'
    };
  }

  // 5. USER_LOGIN (Successful Login -> NORMAL status, NO warning icon)
  if (
    actionUpper === 'USER_LOGIN' ||
    actionUpper === 'LOGIN' ||
    detailsUpper.includes('SIGNED IN SUCCESSFULLY') ||
    detailsUpper.includes('AUTHENTICATED INTO')
  ) {
    return {
      isAlert: false,
      isSuspicious: false,
      showWarningIcon: false,
      classification: 'NORMAL',
      alertType: 'user_login',
      badgeLabel: 'User Login'
    };
  }

  // 6. Historical USER_RELOGIN (Discontinued - preserved as read-only audit log, NO warning icon)
  if (
    actionUpper === 'USER_RELOGIN' ||
    actionUpper.includes('RELOGIN') ||
    actionUpper.includes('RE-LOGIN')
  ) {
    return {
      isAlert: false,
      isSuspicious: false,
      showWarningIcon: false,
      classification: 'NORMAL',
      alertType: 'routine',
      badgeLabel: 'Historical Re-login'
    };
  }

  // 7. Other general alert severity items
  if (log.severity === 'alert') {
    return {
      isAlert: true,
      isSuspicious: true,
      showWarningIcon: true,
      classification: 'SUSPICIOUS',
      alertType: 'security_alert',
      badgeLabel: 'Security Alert'
    };
  }

  // 8. Routine / standard administrative actions
  return {
    isAlert: false,
    isSuspicious: false,
    showWarningIcon: false,
    classification: 'NORMAL',
    alertType: 'routine',
    badgeLabel: 'Normal'
  };
}

export const AuditLogView: React.FC = () => {
  const { auditLogs, currentUser, showToast } = useAlumni();

  // Role permissions: Admins and superadmins have cross-role oversight.
  // Other roles view activity logs relevant to their assigned role.
  const currentUserRole = (currentUser?.role || 'alumni').toLowerCase().trim();
  const isAdmin = currentUserRole === 'admin' || currentUserRole === 'superadmin';

  // Interactive Filter Drawer / Panel Toggle
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);

  // View format for ledger: 'matrix' (data table) vs 'timeline' (incident stream)
  const [displayMode, setDisplayMode] = useState<'matrix' | 'timeline'>('matrix');

  // Search & Detailed Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [alertFilter, setAlertFilter] = useState<
    'all' | 'warnings_only' | 'suspicious_only' | 'security_warnings' | 'logins_only'
  >('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<'all' | '24h' | '7d' | '30d'>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  // Pagination Controls
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Inspector Drawer State
  const [inspectedLog, setInspectedLog] = useState<AuditLogEntry | null>(null);
  const [copiedPayload, setCopiedPayload] = useState(false);

  // Auto-scope role filter for non-admin users
  useEffect(() => {
    if (!isAdmin) {
      setRoleFilter(currentUserRole);
    }
  }, [isAdmin, currentUserRole]);

  // Reset to page 1 whenever any filter criteria changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, roleFilter, alertFilter, severityFilter, timeFilter, sortOrder]);

  // Telemetry Aggregation for active view
  const alertStats = useMemo(() => {
    let totalWarnings = 0;
    let suspiciousCount = 0;
    let loginCount = 0;

    for (const log of auditLogs) {
      const info = getLogAlertInfo(log);
      if (info.showWarningIcon) totalWarnings++;
      if (info.isSuspicious) suspiciousCount++;
      if (info.alertType === 'user_login' || (log.action || '').toUpperCase() === 'USER_LOGIN') loginCount++;
    }

    return { totalWarnings, suspiciousCount, loginCount };
  }, [auditLogs]);

  // Calculate active filter count for badge indicator on filter button
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (isAdmin && roleFilter !== 'all') count++;
    if (alertFilter !== 'all') count++;
    if (severityFilter !== 'all') count++;
    if (timeFilter !== 'all') count++;
    if (searchQuery.trim().length > 0) count++;
    return count;
  }, [isAdmin, roleFilter, alertFilter, severityFilter, timeFilter, searchQuery]);

  // Reset all filters helper
  const handleResetFilters = () => {
    setSearchQuery('');
    if (isAdmin) setRoleFilter('all');
    setAlertFilter('all');
    setSeverityFilter('all');
    setTimeFilter('all');
    setSortOrder('newest');
    setCurrentPage(1);
  };

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    const now = Date.now();
    return auditLogs
      .filter((log) => {
        // 1. Role Scoping & Role Filtering
        if (!isAdmin) {
          // Strict non-admin scoping: only show logs relevant to this user's assigned role
          if (currentUserRole === 'employer') {
            const isActorEmployer = (log.actorRole || '').toLowerCase() === 'employer';
            const isTargetEmployer = Boolean(
              log.targetRecordId &&
              (log.targetRecordId === currentUser?.email ||
                log.targetRecordId === currentUser?.uid ||
                log.targetRecordId === currentUser?.companyName)
            );
            const isCategoryCareer = log.category === 'career';
            if (!isActorEmployer && !isTargetEmployer && !isCategoryCareer) return false;
          } else if (currentUserRole === 'moderator') {
            const isActorMod = (log.actorRole || '').toLowerCase() === 'moderator' || (log.actorRole || '').toLowerCase() === 'staff' || (log.actorRole || '').toLowerCase() === 'registrar';
            const isModCategory = log.category === 'alumni_verification' || log.category === 'conflict_resolution' || log.category === 'registry_masterlist' || log.category === 'alumni_registration';
            if (!isActorMod && !isModCategory) return false;
          } else {
            // Alumni role: strictly personal interactions only (actions they initiated or were target of)
            const isSelf = log.actorId === currentUser?.uid || log.actorName === currentUser?.name;
            const isTargetSelf = Boolean(
              log.targetRecordId &&
              (log.targetRecordId === currentUser?.studentId || log.targetRecordId === currentUser?.email)
            );
            if (!isSelf && !isTargetSelf) return false;
          }
        } else {
          // Admin role: Can filter by any role or view all
          if (roleFilter !== 'all') {
            const logRole = (log.actorRole || '').toLowerCase();
            if (roleFilter === 'admin' && logRole !== 'admin' && logRole !== 'superadmin') return false;
            if (roleFilter === 'moderator' && logRole !== 'moderator' && logRole !== 'staff' && logRole !== 'registrar') return false;
            if (roleFilter === 'employer' && logRole !== 'employer') return false;
            if (roleFilter === 'alumni' && logRole !== 'alumni') return false;
          }
        }

        // 2. Alert & Security Filter
        const alertInfo = getLogAlertInfo(log);
        if (alertFilter === 'warnings_only' && !alertInfo.showWarningIcon) return false;
        if (alertFilter === 'suspicious_only' && alertInfo.classification !== 'SUSPICIOUS') return false;
        if (alertFilter === 'security_warnings' && alertInfo.classification !== 'LOCKED' && alertInfo.classification !== 'SUSPENDED') return false;
        if (alertFilter === 'logins_only' && (log.action || '').toUpperCase() !== 'USER_LOGIN') return false;

        // 3. Search Query
        const q = searchQuery.toLowerCase().trim();
        if (q) {
          const matchSearch =
            (log.action || '').toLowerCase().includes(q) ||
            (log.actorName || '').toLowerCase().includes(q) ||
            (log.actorRole || '').toLowerCase().includes(q) ||
            (log.details || '').toLowerCase().includes(q) ||
            (alertInfo.classification || '').toLowerCase().includes(q) ||
            Boolean(log.targetRecordId && log.targetRecordId.toLowerCase().includes(q)) ||
            Boolean(log.ipAddress && log.ipAddress.toLowerCase().includes(q));
          if (!matchSearch) return false;
        }

        // 4. Severity Filter
        if (severityFilter !== 'all' && log.severity !== severityFilter) return false;

        // 5. Time Horizon Filter
        if (timeFilter !== 'all') {
          const logTime = new Date(log.timestamp).getTime();
          const diffHours = (now - logTime) / (1000 * 60 * 60);
          if (timeFilter === '24h' && diffHours > 24) return false;
          if (timeFilter === '7d' && diffHours > 24 * 7) return false;
          if (timeFilter === '30d' && diffHours > 24 * 30) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return sortOrder === 'newest' ? timeB - timeA : timeA - timeB;
      });
  }, [auditLogs, isAdmin, currentUserRole, currentUser, roleFilter, alertFilter, searchQuery, severityFilter, timeFilter, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  // Export CSV Handler
  const handleExportCsv = () => {
    const headers = [
      'Timestamp',
      'Category',
      'Action',
      'Classification',
      'Warning Icon',
      'Actor Name',
      'Actor Role',
      'Target Record',
      'IP Address',
      'Severity',
      'Details'
    ];
    const rows = filteredLogs.map((l) => {
      const alertInfo = getLogAlertInfo(l);
      return [
        `"${new Date(l.timestamp).toISOString()}"`,
        `"${l.category || ''}"`,
        `"${(l.action || '').replace(/"/g, '""')}"`,
        `"${alertInfo.classification}"`,
        `"${alertInfo.showWarningIcon ? '⚠️ YES' : 'NO'}"`,
        `"${(l.actorName || '').replace(/"/g, '""')}"`,
        `"${l.actorRole || ''}"`,
        `"${l.targetRecordId || ''}"`,
        `"${l.ipAddress || ''}"`,
        `"${l.severity || ''}"`,
        `"${(l.details || '').replace(/"/g, '""')}"`
      ];
    });

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `cecilian_activity_logs_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Activity logs exported successfully.', 'success');
  };

  const handleCopyPayload = (payload: any) => {
    try {
      navigator.clipboard.writeText(typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2));
      setCopiedPayload(true);
      showToast('Payload copied to clipboard.', 'success');
      setTimeout(() => setCopiedPayload(false), 2000);
    } catch {
      showToast('Failed to copy payload.', 'error');
    }
  };

  return (
    <div className="w-full space-y-6 antialiased">
      {/* ========================================================================= */}
      {/* TOP HEADER SECTION (COMMAND CENTER & ACTIVITY OVERVIEW)                   */}
      {/* ========================================================================= */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 dark:text-stone-100 tracking-tight font-sans">
              {isAdmin ? 'System Activity & Audit Logs' : 'My Activity Logs'}
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-bold uppercase tracking-wider border border-stone-200 dark:border-stone-700">
              {isAdmin ? 'Full Oversight' : `${currentUserRole} View`}
            </span>
          </div>
          <p className="text-xs text-stone-500 dark:text-stone-400 font-medium mt-1">
            {isAdmin
              ? "St. Cecilia's College • Centralized forensic audit trail, authentication logs, and security telemetry."
              : `Activity logs, login telemetry, and operations scoped to your assigned ${currentUserRole} account.`}
          </p>
        </div>

        {/* Quick telemetry chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50 flex items-center gap-2 text-xs font-semibold text-amber-900 dark:text-amber-300">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>{alertStats.totalWarnings} Warnings & Alerts</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-900/50 flex items-center gap-2 text-xs font-semibold text-rose-900 dark:text-rose-300">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            <span>{alertStats.suspiciousCount} Suspicious</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 flex items-center gap-2 text-xs font-semibold text-stone-700 dark:text-stone-300">
            <LogIn className="w-3.5 h-3.5 text-stone-500" />
            <span>{alertStats.loginCount} Logins (Normal)</span>
          </div>
        </div>
      </div>

      {/* Non-Admin Scoped Notice */}
      {!isAdmin && (
        <div className="bg-stone-50 dark:bg-stone-800/60 rounded-2xl border border-stone-200/80 dark:border-stone-700 p-3.5 flex items-center justify-between gap-3 text-xs text-stone-700 dark:text-stone-300">
          <div className="flex items-center gap-2.5">
            <Shield className="w-4 h-4 text-[#8B181B] dark:text-rose-400 shrink-0" />
            <span>
              <strong>Role Scoped View:</strong> Showing audit logs pertinent to your assigned role ({currentUserRole}). Institutional administrative records remain restricted.
            </span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 font-semibold text-stone-600 dark:text-stone-400">
            ROLE: {currentUserRole.toUpperCase()}
          </span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CONTROLS RIBBON (SEARCH, FILTER BUTTON, FORMAT SELECTOR)                  */}
      {/* ========================================================================= */}
      <div className="space-y-3">
        <div className="bg-white dark:bg-[#181615] p-3.5 sm:p-4 rounded-2xl border border-stone-200/80 dark:border-stone-800 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_20px_rgba(0,0,0,0.02)] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search action signature, actor, target ID, IP, or details..."
              className="w-full pl-10 pr-9 py-2 bg-stone-50/80 dark:bg-stone-900 border border-stone-200/80 dark:border-stone-700 rounded-xl text-xs placeholder:text-stone-400 focus:bg-white dark:focus:bg-stone-900 focus:outline-hidden focus:border-[#8B181B] focus:ring-2 focus:ring-[#8B181B]/15 transition-all text-stone-800 dark:text-stone-200"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Action and Filter Controls */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {/* Primary Filter Icon Button */}
            <button
              type="button"
              onClick={() => setIsFilterPanelOpen((prev) => !prev)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 border shadow-2xs ${
                isFilterPanelOpen || activeFilterCount > 0
                  ? 'bg-[#8B181B] text-white border-[#721316]'
                  : 'bg-stone-50 dark:bg-stone-900 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-200 border-stone-200/80 dark:border-stone-700'
              }`}
              title="Filter activity logs by user roles, security alerts, and time horizon"
              aria-label="Filter activity logs"
              aria-expanded={isFilterPanelOpen}
            >
              <Filter className="w-3.5 h-3.5 stroke-[2]" />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-white text-[#8B181B] text-[10px] font-extrabold flex items-center justify-center font-mono">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Quick Alert Filter Toggle */}
            <button
              type="button"
              onClick={() => setAlertFilter(alertFilter === 'warnings_only' ? 'all' : 'warnings_only')}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 border shadow-2xs ${
                alertFilter === 'warnings_only'
                  ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                  : 'bg-stone-50 dark:bg-stone-900 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-200 border-stone-200/80 dark:border-stone-700'
              }`}
              title="Filter activities with ⚠️ warnings"
            >
              <AlertTriangle className={`w-3.5 h-3.5 ${alertFilter === 'warnings_only' ? 'text-white' : 'text-amber-600'}`} />
              <span>Warnings (⚠️)</span>
            </button>

            {/* View Format Selector (Data Grid vs Timeline) */}
            <div className="flex items-center p-1 bg-stone-100 dark:bg-stone-900 rounded-xl text-xs border border-stone-200/60 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setDisplayMode('matrix')}
                className={`px-2.5 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  displayMode === 'matrix'
                    ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 shadow-2xs font-bold'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
                }`}
                title="Data Grid Mode"
              >
                <Layers className="w-3.5 h-3.5 stroke-[1.75]" />
                <span className="hidden sm:inline">Grid</span>
              </button>
              <button
                type="button"
                onClick={() => setDisplayMode('timeline')}
                className={`px-2.5 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  displayMode === 'timeline'
                    ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 shadow-2xs font-bold'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
                }`}
                title="Timeline Stream Mode"
              >
                <Radio className="w-3.5 h-3.5 stroke-[1.75]" />
                <span className="hidden sm:inline">Timeline</span>
              </button>
            </div>

            {/* Chronological Sort Direction */}
            <button
              type="button"
              onClick={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
              className="p-2 bg-stone-50 dark:bg-stone-900 hover:bg-stone-100 dark:hover:bg-stone-800 border border-stone-200/80 dark:border-stone-700 rounded-xl text-xs font-semibold text-stone-700 dark:text-stone-200 transition-colors cursor-pointer"
              title={`Sort ${sortOrder === 'newest' ? 'Oldest First' : 'Newest First'}`}
            >
              <ArrowUpDown className="w-4 h-4 text-stone-500" />
            </button>

            {/* CSV Export Button */}
            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3 py-2 bg-stone-900 dark:bg-stone-800 hover:bg-stone-800 dark:hover:bg-stone-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5 shrink-0"
              title="Download filtered activity logs as CSV"
            >
              <Download className="w-3.5 h-3.5 stroke-[2]" />
              <span className="hidden sm:inline">CSV</span>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* EXPANDABLE FILTER DRAWER (ROLE-BASED & ADVANCED ALERT FILTERS)            */}
        {/* ========================================================================= */}
        <AnimatePresence>
          {isFilterPanelOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="overflow-hidden"
            >
              <div className="bg-white dark:bg-[#181615] rounded-2xl border border-stone-200/90 dark:border-stone-800 p-4 sm:p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-[#8B181B] dark:text-rose-400" />
                    <span className="text-xs font-bold text-stone-900 dark:text-stone-100 uppercase tracking-wider">
                      Role-Based & Security Filters
                    </span>
                  </div>
                  {activeFilterCount > 0 && (
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="text-xs text-[#8B181B] dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer font-semibold"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset All Filters</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                  {/* Filter 1: Role-Based Activity Logs Filter */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-stone-700 dark:text-stone-300 flex items-center justify-between">
                      <span>User Role View</span>
                      {isAdmin && (
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-normal">
                          Admin Wide Access
                        </span>
                      )}
                    </label>
                    {isAdmin ? (
                      <select
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                        className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200/80 dark:border-stone-700 rounded-xl text-xs font-semibold text-stone-800 dark:text-stone-200 cursor-pointer focus:outline-hidden focus:border-[#8B181B]"
                      >
                        <option value="all">All Roles (Admin Wide)</option>
                        <option value="admin">Administrator (Admin / Superadmin)</option>
                        <option value="moderator">Institutional Moderator</option>
                        <option value="employer">Employer Partner</option>
                        <option value="alumni">Alumni</option>
                      </select>
                    ) : (
                      <div className="px-3 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 font-semibold text-stone-700 dark:text-stone-300">
                        {currentUserRole.toUpperCase()} (Locked to your role)
                      </div>
                    )}
                  </div>

                  {/* Filter 2: Alert & Suspicious Filter */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-stone-700 dark:text-stone-300">
                      Alert & Security Classification
                    </label>
                    <select
                      value={alertFilter}
                      onChange={(e) => setAlertFilter(e.target.value as any)}
                      className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200/80 dark:border-stone-700 rounded-xl text-xs font-semibold text-stone-800 dark:text-stone-200 cursor-pointer focus:outline-hidden focus:border-[#8B181B]"
                    >
                      <option value="all">All Activities (Normal + Warnings)</option>
                      <option value="warnings_only">⚠️ All Warnings (Failed, Suspicious, Locked)</option>
                      <option value="suspicious_only">⚠️ Suspicious Activities Only</option>
                      <option value="security_warnings">⚠️ Security Warnings (Account Locked)</option>
                      <option value="logins_only">Normal User Logins (USER_LOGIN)</option>
                    </select>
                  </div>

                  {/* Filter 3: Severity Filter */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-stone-700 dark:text-stone-300">
                      Severity Level
                    </label>
                    <select
                      value={severityFilter}
                      onChange={(e) => setSeverityFilter(e.target.value)}
                      className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200/80 dark:border-stone-700 rounded-xl text-xs font-semibold text-stone-800 dark:text-stone-200 cursor-pointer focus:outline-hidden focus:border-[#8B181B]"
                    >
                      <option value="all">All Severities</option>
                      <option value="alert">Alert (High Priority)</option>
                      <option value="warning">Warning (Medium Priority)</option>
                      <option value="info">Informational</option>
                      <option value="success">Success / Verified</option>
                    </select>
                  </div>

                  {/* Filter 4: Time Horizon */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-stone-700 dark:text-stone-300">
                      Time Horizon
                    </label>
                    <select
                      value={timeFilter}
                      onChange={(e) => setTimeFilter(e.target.value as any)}
                      className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200/80 dark:border-stone-700 rounded-xl text-xs font-semibold text-stone-800 dark:text-stone-200 cursor-pointer focus:outline-hidden focus:border-[#8B181B]"
                    >
                      <option value="all">All Time</option>
                      <option value="24h">Past 24 Hours</option>
                      <option value="7d">Past 7 Days</option>
                      <option value="30d">Past 30 Days</option>
                    </select>
                  </div>
                </div>

                {/* Role quick filter tags (Admin only) */}
                {isAdmin && (
                  <div className="pt-2 border-t border-stone-100 dark:border-stone-800 flex items-center gap-2 flex-wrap text-xs">
                    <span className="text-[11px] text-stone-400 font-medium">Quick Role Views:</span>
                    {[
                      { id: 'all', label: 'All Roles', icon: Users },
                      { id: 'admin', label: 'Admin', icon: Shield },
                      { id: 'moderator', label: 'Moderator', icon: ShieldQuestion },
                      { id: 'employer', label: 'Employer', icon: Briefcase },
                      { id: 'alumni', label: 'Alumni', icon: User }
                    ].map((item) => {
                      const Icon = item.icon;
                      const isSelected = roleFilter === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setRoleFilter(item.id)}
                          className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[#8B181B] text-white shadow-2xs'
                              : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
                          }`}
                        >
                          <Icon className="w-3 h-3" />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Active Filters Summary Strip */}
        <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400 px-1 font-mono">
          <div className="flex items-center gap-2 flex-wrap">
            <span>Showing <strong className="text-stone-900 dark:text-stone-100">{filteredLogs.length}</strong> of {auditLogs.length} activity entries</span>
            {roleFilter !== 'all' && (
              <span className="bg-stone-100 dark:bg-stone-800 px-2 py-0.5 rounded text-[11px] font-semibold text-stone-700 dark:text-stone-300">
                Role: {roleFilter.toUpperCase()}
              </span>
            )}
            {alertFilter !== 'all' && (
              <span className="bg-amber-100 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-amber-600" />
                {alertFilter === 'warnings_only'
                  ? 'All Warnings (⚠️)'
                  : alertFilter === 'suspicious_only'
                  ? 'Suspicious Only (⚠️)'
                  : alertFilter === 'security_warnings'
                  ? 'Security Warnings (⚠️)'
                  : 'Logins Only (Normal)'}
              </span>
            )}
            {searchQuery && (
              <span className="bg-stone-100 dark:bg-stone-800 px-2 py-0.5 rounded text-[11px] font-semibold">
                Query: "{searchQuery}"
              </span>
            )}
          </div>
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs text-[#8B181B] dark:text-rose-400 hover:underline font-semibold cursor-pointer shrink-0"
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* ========================================================================= */}
        {/* MAIN CONTENT: DATA GRID (MATRIX) MODE                                     */}
        {/* ========================================================================= */}
        {displayMode === 'matrix' && (
          <div className="bg-white dark:bg-[#181615] rounded-2xl border border-stone-200/90 dark:border-stone-800 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF9F5] dark:bg-stone-900/90 text-stone-600 dark:text-stone-400 text-[11px] font-bold uppercase tracking-wider border-b border-stone-200/90 dark:border-stone-800">
                  <tr>
                    <th className="py-3.5 px-4 w-44 font-semibold">Timestamp</th>
                    <th className="py-3.5 px-4 w-36 font-semibold">Alert & Severity</th>
                    <th className="py-3.5 px-4 min-w-[240px] font-semibold">Activity Signature</th>
                    <th className="py-3.5 px-4 w-48 font-semibold">Actor Authority</th>
                    <th className="py-3.5 px-4 w-40 font-semibold">Target Record</th>
                    <th className="py-3.5 px-4 w-32 font-semibold">Origin IP</th>
                    <th className="py-3.5 px-4 w-24 text-right pr-5 font-semibold">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800/60 font-sans">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-16 text-center text-stone-400 dark:text-stone-500 italic">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Filter className="w-8 h-8 text-stone-300 dark:text-stone-700 stroke-[1.5]" />
                          <p className="text-sm font-semibold text-stone-700 dark:text-stone-300 not-italic">
                            No activity logs match the selected filters.
                          </p>
                          <p className="text-xs text-stone-400 max-w-sm">
                            Try resetting your role or alert filter to view standard telemetry events.
                          </p>
                          <button
                            type="button"
                            onClick={handleResetFilters}
                            className="mt-2 px-3.5 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 font-bold text-xs hover:bg-stone-200 dark:hover:bg-stone-700 cursor-pointer"
                          >
                            Reset Filters
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedLogs.map((log) => {
                      const isSelected = inspectedLog?.id === log.id;
                      const alertInfo = getLogAlertInfo(log);

                      // Distinct visual styling based on classification:
                      // - LOCKED, SUSPENDED: Red/Pink highlight (⚠️ Yes)
                      // - SUSPICIOUS (MULTIPLE_FAILED_LOGIN_ATTEMPTS, MULTIPLE_USERS_SAME_ACCOUNT): Rose/Red highlight (⚠️ Yes)
                      // - WARNING (FAILED_LOGIN_ATTEMPT, SUSPENSION_EXTENDED): Amber/Warning highlight (⚠️ Yes)
                      // - NORMAL (USER_LOGIN, ADMIN_UNLOCKED_ACCOUNT, ACCOUNT_AUTO_RESTORED): Normal dashboard styling, NO warning icon
                      let rowHighlightClass = 'hover:bg-stone-50/80 dark:hover:bg-stone-900/60';
                      if (alertInfo.classification === 'LOCKED' || alertInfo.classification === 'SUSPENDED') {
                        rowHighlightClass = 'bg-rose-50/85 hover:bg-rose-100/90 dark:bg-rose-950/35 dark:hover:bg-rose-950/45 border-l-4 border-l-rose-600';
                      } else if (alertInfo.classification === 'SUSPICIOUS') {
                        rowHighlightClass = 'bg-rose-50/60 hover:bg-rose-100/70 dark:bg-rose-950/20 dark:hover:bg-rose-950/30 border-l-4 border-l-rose-500';
                      } else if (alertInfo.classification === 'WARNING') {
                        rowHighlightClass = 'bg-amber-50/60 hover:bg-amber-100/70 dark:bg-amber-950/15 dark:hover:bg-amber-950/25 border-l-4 border-l-amber-500';
                      }

                      return (
                        <tr
                          key={log.id}
                          onClick={() => setInspectedLog(log)}
                          className={`transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-[#8B181B]/10 dark:bg-rose-950/40 border-l-4 border-l-[#8B181B]'
                              : rowHighlightClass
                          }`}
                        >
                          {/* Timestamp */}
                          <td className="py-3.5 px-4 whitespace-nowrap text-stone-600 dark:text-stone-400 font-mono text-[11px] tabular-nums">
                            <span className="font-semibold text-stone-900 dark:text-stone-100 block">
                              {new Date(log.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                            <span className="text-[10px] text-stone-400 dark:text-stone-500">
                              {new Date(log.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                          </td>

                          {/* Alert & Severity Column with ⚠️ icon strictly on warnings */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex flex-col gap-1 items-start">
                              {/* ⚠️ Warning Icon strictly for security events, NEVER on USER_LOGIN */}
                              {alertInfo.showWarningIcon ? (
                                <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border shadow-2xs ${
                                  alertInfo.classification === 'LOCKED' || alertInfo.classification === 'SUSPENDED'
                                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200 border-rose-300 dark:border-rose-800 animate-pulse'
                                    : alertInfo.classification === 'SUSPICIOUS'
                                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200 border-rose-300 dark:border-rose-800'
                                    : 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border-amber-300 dark:border-amber-800'
                                }`}>
                                  <AlertTriangle className={`w-3.5 h-3.5 shrink-0 ${
                                    alertInfo.classification === 'WARNING' ? 'text-amber-600' : 'text-rose-600'
                                  }`} />
                                  <span>⚠️ {alertInfo.classification}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-600 dark:text-stone-400 bg-stone-100 dark:bg-stone-800 border border-stone-200/70 dark:border-stone-700 px-2 py-0.5 rounded-full">
                                  <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
                                  NORMAL
                                </span>
                              )}

                              {/* Secondary Severity Tag */}
                              <span className="text-[10px] font-mono text-stone-400 dark:text-stone-500 uppercase tracking-tight pl-0.5">
                                {log.severity || 'info'}
                              </span>
                            </div>
                          </td>

                          {/* Action Signature */}
                          <td className="py-3.5 px-4 max-w-sm">
                            <div className="flex items-center gap-2">
                              {alertInfo.showWarningIcon && (
                                <span title={alertInfo.badgeLabel}>
                                  <AlertTriangle className={`w-4 h-4 shrink-0 ${
                                    alertInfo.classification === 'WARNING' ? 'text-amber-600' : 'text-rose-600'
                                  }`} />
                                </span>
                              )}
                              <span className="font-bold text-stone-900 dark:text-stone-100 text-xs truncate">
                                {log.action}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              {log.category && (
                                <span className="text-[10px] text-stone-400 dark:text-stone-500 uppercase tracking-wider font-mono">
                                  {log.category.replace('_', ' ')}
                                </span>
                              )}
                              {alertInfo.showWarningIcon && (
                                <span className={`text-[10px] font-semibold ${
                                  alertInfo.classification === 'WARNING' ? 'text-amber-700 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'
                                }`}>
                                  • {alertInfo.badgeLabel}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Actor Authority */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 flex items-center justify-center text-[10px] font-bold text-stone-700 dark:text-stone-300 shrink-0">
                                {(log.actorName || 'S').charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <span className="font-medium text-stone-900 dark:text-stone-100 text-xs block truncate">
                                  {log.actorName}
                                </span>
                                <span className={`text-[9.5px] px-1.5 py-0.2 rounded uppercase font-semibold font-mono ${
                                  log.actorRole === 'admin' || log.actorRole === 'superadmin'
                                    ? 'bg-rose-100 dark:bg-rose-950/50 text-[#8B181B] dark:text-rose-300'
                                    : log.actorRole === 'employer'
                                    ? 'bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300'
                                    : log.actorRole === 'moderator'
                                    ? 'bg-purple-100 dark:bg-purple-950/50 text-purple-800 dark:text-purple-300'
                                    : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
                                }`}>
                                  {log.actorRole}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Target Record */}
                          <td className="py-3.5 px-4 whitespace-nowrap font-mono text-xs">
                            {log.targetRecordId ? (
                              <span className="text-[#8B181B] dark:text-rose-400 bg-red-50/80 dark:bg-rose-950/30 border border-red-200/50 dark:border-rose-900/50 px-2 py-0.5 rounded font-semibold text-[11px]">
                                {log.targetRecordId}
                              </span>
                            ) : (
                              <span className="text-stone-300 dark:text-stone-600 italic text-[11px]">—</span>
                            )}
                          </td>

                          {/* Origin IP */}
                          <td className="py-3.5 px-4 whitespace-nowrap font-mono text-stone-500 dark:text-stone-400 text-[11px]">
                            <span className="bg-stone-50 dark:bg-stone-900 border border-stone-200/60 dark:border-stone-800 px-2 py-0.5 rounded-md inline-block">
                              {log.ipAddress || '127.0.0.1'}
                            </span>
                          </td>

                          {/* Inspect Action */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap pr-5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setInspectedLog(log);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-stone-100/90 dark:bg-stone-800 hover:bg-[#8B181B] hover:text-white dark:hover:bg-[#8B181B] text-stone-600 dark:text-stone-300 transition-all text-xs font-semibold inline-flex items-center gap-1 cursor-pointer group shadow-2xs"
                              title="Inspect activity payload"
                            >
                              <span>Inspect</span>
                              <Eye className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="px-4 py-3 bg-[#FAF9F5] dark:bg-stone-900 border-t border-stone-200/90 dark:border-stone-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-600 dark:text-stone-400">
                <span>
                  Showing{' '}
                  <strong className="text-stone-900 dark:text-stone-100 font-mono">
                    {(currentPage - 1) * pageSize + 1}
                  </strong>{' '}
                  to{' '}
                  <strong className="text-stone-900 dark:text-stone-100 font-mono">
                    {Math.min(currentPage * pageSize, filteredLogs.length)}
                  </strong>{' '}
                  of{' '}
                  <strong className="text-stone-900 dark:text-stone-100 font-mono">
                    {filteredLogs.length}
                  </strong>{' '}
                  entries
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-stone-100 dark:hover:bg-stone-750 transition-colors cursor-pointer"
                    title="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <span className="px-3 py-1 font-mono font-medium text-xs">
                    Page {currentPage} of {totalPages}
                  </span>

                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-stone-100 dark:hover:bg-stone-750 transition-colors cursor-pointer"
                    title="Next page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TIMELINE STREAM MODE                                                      */}
        {/* ========================================================================= */}
        {displayMode === 'timeline' && (
          <div className="bg-white dark:bg-[#181615] rounded-2xl border border-stone-200/90 dark:border-stone-800 shadow-2xs p-6 space-y-6">
            {filteredLogs.length === 0 ? (
              <div className="py-12 text-center text-stone-400 italic text-xs">
                No activity events found matching the active criteria.
              </div>
            ) : (
              <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-stone-200 dark:before:bg-stone-800">
                {paginatedLogs.map((log) => {
                  const alertInfo = getLogAlertInfo(log);

                  return (
                    <div
                      key={log.id}
                      onClick={() => setInspectedLog(log)}
                      className="relative group cursor-pointer"
                    >
                      {/* Timeline node */}
                      <div
                        className={`absolute -left-[27px] top-1.5 w-4 h-4 rounded-full border-2 bg-white dark:bg-stone-900 flex items-center justify-center ${
                          alertInfo.classification === 'LOCKED' || alertInfo.classification === 'SUSPENDED'
                            ? 'border-rose-600'
                            : alertInfo.classification === 'SUSPICIOUS'
                            ? 'border-rose-500'
                            : alertInfo.classification === 'WARNING'
                            ? 'border-amber-500'
                            : 'border-stone-300 dark:border-stone-700'
                        }`}
                      >
                        {alertInfo.showWarningIcon && (
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            alertInfo.classification === 'WARNING' ? 'bg-amber-500' : 'bg-rose-600'
                          }`} />
                        )}
                      </div>

                      <div className={`p-4 rounded-xl border transition-all space-y-2 ${
                        alertInfo.classification === 'LOCKED' || alertInfo.classification === 'SUSPENDED'
                          ? 'bg-rose-50/85 border-rose-300 dark:bg-rose-950/35 dark:border-rose-900/60'
                          : alertInfo.classification === 'SUSPICIOUS'
                          ? 'bg-rose-50/70 border-rose-300 dark:bg-rose-950/20 dark:border-rose-900/60'
                          : alertInfo.classification === 'WARNING'
                          ? 'bg-amber-50/60 border-amber-300 dark:bg-amber-950/20 dark:border-amber-900/60'
                          : 'bg-stone-50/50 hover:bg-stone-50 border-stone-200/80 dark:bg-stone-900/40 dark:border-stone-800'
                      }`}>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          <div className="flex items-center gap-2">
                            {alertInfo.showWarningIcon && (
                              <AlertTriangle className={`w-4 h-4 shrink-0 ${
                                alertInfo.classification === 'WARNING' ? 'text-amber-600' : 'text-rose-600'
                              }`} />
                            )}
                            <span className="font-bold text-xs text-stone-900 dark:text-stone-100">
                              {log.action}
                            </span>
                            {alertInfo.showWarningIcon ? (
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                alertInfo.classification === 'LOCKED' || alertInfo.classification === 'SUSPENDED' || alertInfo.classification === 'SUSPICIOUS'
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200 border-rose-300'
                                  : 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border-amber-300'
                              }`}>
                                ⚠️ {alertInfo.classification}
                              </span>
                            ) : (
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 border-stone-200 dark:border-stone-700">
                                NORMAL
                              </span>
                            )}
                            <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300">
                              {log.category}
                            </span>
                          </div>
                          <span className="text-[11px] font-mono text-stone-500 dark:text-stone-400 tabular-nums">
                            {new Date(log.timestamp).toLocaleString()}
                          </span>
                        </div>

                        <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed font-sans">
                          {log.details}
                        </p>

                        <div className="flex items-center gap-3 pt-1 text-[11px] text-stone-500 dark:text-stone-400 flex-wrap">
                          <span className="flex items-center gap-1 font-medium text-stone-800 dark:text-stone-200">
                            <User className="w-3 h-3 text-stone-400" />
                            {log.actorName} ({log.actorRole})
                          </span>
                          {log.targetRecordId && (
                            <span className="font-mono text-[#8B181B] dark:text-rose-400 font-semibold">
                              Target: {log.targetRecordId}
                            </span>
                          )}
                          <span className="font-mono text-stone-400">
                            IP: {log.ipAddress || '127.0.0.1'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination Controls in Timeline Mode */}
            {totalPages > 1 && (
              <div className="pt-4 border-t border-stone-200/90 dark:border-stone-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-600 dark:text-stone-400">
                <span>
                  Showing{' '}
                  <strong className="text-stone-900 dark:text-stone-100 font-mono">
                    {(currentPage - 1) * pageSize + 1}
                  </strong>{' '}
                  to{' '}
                  <strong className="text-stone-900 dark:text-stone-100 font-mono">
                    {Math.min(currentPage * pageSize, filteredLogs.length)}
                  </strong>{' '}
                  of{' '}
                  <strong className="text-stone-900 dark:text-stone-100 font-mono">
                    {filteredLogs.length}
                  </strong>{' '}
                  entries
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-stone-100 dark:hover:bg-stone-750 transition-colors cursor-pointer"
                    title="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <span className="px-3 py-1 font-mono font-medium text-xs">
                    Page {currentPage} of {totalPages}
                  </span>

                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-stone-100 dark:hover:bg-stone-750 transition-colors cursor-pointer"
                    title="Next page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* FORENSIC INSPECTOR MODAL                                                  */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {inspectedLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-[#181615] rounded-3xl border border-stone-200 dark:border-stone-800 max-w-xl w-full p-6 shadow-2xl space-y-5"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#8B181B]/10 dark:bg-rose-950/40 text-[#8B181B] dark:text-rose-300 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                      Activity Log Inspection
                    </h3>
                    <span className="text-[10px] font-mono text-stone-400">UUID: {inspectedLog.id}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectedLog(null)}
                  className="p-1 rounded-full text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Alert Callout if this log has a warning icon */}
              {(() => {
                const info = getLogAlertInfo(inspectedLog);
                if (!info.showWarningIcon) {
                  return (
                    <div className="p-3.5 rounded-2xl border text-xs space-y-1 bg-stone-50 dark:bg-stone-900/60 border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300">
                      <div className="flex items-center gap-2 font-bold text-stone-900 dark:text-stone-100">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span>Status: NORMAL</span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-stone-500 dark:text-stone-400">
                        Standard operational activity. No security warnings or warning icons apply.
                      </p>
                    </div>
                  );
                }
                return (
                  <div className={`p-3.5 rounded-2xl border text-xs space-y-1 ${
                    info.classification === 'LOCKED' || info.classification === 'SUSPENDED'
                      ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-900/70 text-rose-900 dark:text-rose-200'
                      : info.classification === 'SUSPICIOUS'
                      ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/60 text-rose-900 dark:text-rose-200'
                      : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200'
                  }`}>
                    <div className="flex items-center gap-2 font-bold">
                      <AlertTriangle className={`w-4 h-4 shrink-0 ${
                        info.classification === 'WARNING' ? 'text-amber-600' : 'text-rose-600'
                      }`} />
                      <span>⚠️ {info.classification} ({info.badgeLabel})</span>
                    </div>
                    <p className="text-[11px] leading-relaxed opacity-90">
                      {info.classification === 'LOCKED'
                        ? 'High-priority security warning: Account locked due to repeated failed login attempts or administrator action. Administrator notified.'
                        : info.classification === 'SUSPENDED'
                        ? 'Administrative suspension active: Account access suspended for the designated duration with logged reason.'
                        : info.classification === 'SUSPICIOUS'
                        ? 'Suspicious authentication activity flagged for administrative review.'
                        : 'Warning: Failed authentication attempt due to incorrect credentials or suspension extension.'}
                    </p>
                  </div>
                );
              })()}

              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3 bg-stone-50 dark:bg-stone-900 p-3.5 rounded-2xl border border-stone-200/80 dark:border-stone-800">
                  <div>
                    <span className="text-[10px] text-stone-400 block font-medium">Action Signature</span>
                    <span className="font-bold text-stone-900 dark:text-stone-100">{inspectedLog.action}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-stone-400 block font-medium">Timestamp</span>
                    <span className="font-mono text-stone-700 dark:text-stone-300">{new Date(inspectedLog.timestamp).toISOString()}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-stone-400 block font-medium">Actor Authority</span>
                    <span className="font-medium text-stone-800 dark:text-stone-200">{inspectedLog.actorName} ({inspectedLog.actorRole})</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-stone-400 block font-medium">Origin IP Address</span>
                    <span className="font-mono text-stone-700 dark:text-stone-300">{inspectedLog.ipAddress || '127.0.0.1'}</span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-stone-400 block font-medium mb-1">Event Narrative</span>
                  <div className="p-3 bg-stone-50 dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300 leading-relaxed font-sans">
                    {inspectedLog.details}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-stone-400 font-medium">Raw Payload</span>
                    <button
                      type="button"
                      onClick={() => handleCopyPayload(inspectedLog)}
                      className="text-[11px] text-[#8B181B] dark:text-rose-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      {copiedPayload ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedPayload ? 'Copied' : 'Copy JSON'}</span>
                    </button>
                  </div>
                  <pre className="p-3 bg-stone-900 text-amber-300 font-mono text-[11px] rounded-xl overflow-x-auto max-h-48 border border-stone-800">
                    {JSON.stringify(inspectedLog, null, 2)}
                  </pre>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setInspectedLog(null)}
                  className="px-4 py-2 bg-stone-900 dark:bg-stone-800 text-white rounded-xl text-xs font-semibold hover:bg-stone-800 dark:hover:bg-stone-700 transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
