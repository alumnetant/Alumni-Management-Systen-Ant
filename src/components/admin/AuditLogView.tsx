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
  ShieldQuestion
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAlumni } from '../../context/AlumniContext';
import { AuditLogEntry } from '../../types';

export interface AlertInfo {
  isAlert: boolean;
  isSuspicious: boolean;
  alertType: 'login' | 'relogin' | 'failed_login' | 'suspicious_lockout' | 'security_alert' | 'general_warning' | null;
  badgeLabel: string;
}

/**
 * Evaluates whether an audit log entry represents an important or suspicious activity
 * that warrants an alert icon (⚠️) and high-visibility styling.
 * 
 * Events flagged with ⚠️:
 * 1. User Login (authentication milestone)
 * 2. User Re-login (session refresh / conflict override)
 * 3. Multiple failed login attempts (suspicious rate-limit lockout)
 * 4. Failed login attempts (incorrect credentials)
 * 5. Other alert-severity security incidents
 */
export function getLogAlertInfo(log: AuditLogEntry): AlertInfo {
  const actionUpper = (log.action || '').toUpperCase();
  const detailsUpper = (log.details || '').toUpperCase();

  // 1. Multiple failed attempts / Lockout (Suspicious activity)
  if (
    actionUpper.includes('SUSPICIOUS') ||
    actionUpper.includes('LOCKOUT') ||
    detailsUpper.includes('LOCKOUT') ||
    detailsUpper.includes('MULTIPLE FAILED')
  ) {
    return {
      isAlert: true,
      isSuspicious: true,
      alertType: 'suspicious_lockout',
      badgeLabel: 'Suspicious: Multiple Failed Attempts'
    };
  }

  // 2. Failed login attempt (Suspicious / Incorrect credentials)
  if (
    actionUpper.includes('FAILED_LOGIN') ||
    actionUpper.includes('FAILED LOGIN') ||
    detailsUpper.includes('FAILED LOGIN') ||
    detailsUpper.includes('FAILED AUTHENTICATION') ||
    detailsUpper.includes('INCORRECT PASSWORD')
  ) {
    return {
      isAlert: true,
      isSuspicious: true,
      alertType: 'failed_login',
      badgeLabel: 'Suspicious: Failed Login Attempt'
    };
  }

  // 3. User Re-login (Important authentication milestone)
  if (
    actionUpper === 'USER_RELOGIN' ||
    actionUpper.includes('RELOGIN') ||
    actionUpper.includes('RE-LOGIN') ||
    detailsUpper.includes('RE-LOGIN') ||
    detailsUpper.includes('RELOGIN')
  ) {
    return {
      isAlert: true,
      isSuspicious: false,
      alertType: 'relogin',
      badgeLabel: 'Auth Alert: User Re-login'
    };
  }

  // 4. User Login (Important authentication milestone)
  if (
    actionUpper === 'USER_LOGIN' ||
    actionUpper === 'LOGIN' ||
    actionUpper.includes('USER_LOGIN') ||
    detailsUpper.includes('SIGNED IN SUCCESSFULLY') ||
    detailsUpper.includes('AUTHENTICATED INTO')
  ) {
    return {
      isAlert: true,
      isSuspicious: false,
      alertType: 'login',
      badgeLabel: 'Auth Alert: User Login'
    };
  }

  // 5. Explicit high-severity alert
  if (log.severity === 'alert') {
    return {
      isAlert: true,
      isSuspicious: true,
      alertType: 'security_alert',
      badgeLabel: 'Security Alert'
    };
  }

  // 6. Explicit warning
  if (log.severity === 'warning') {
    return {
      isAlert: true,
      isSuspicious: false,
      alertType: 'general_warning',
      badgeLabel: 'Warning'
    };
  }

  return {
    isAlert: false,
    isSuspicious: false,
    alertType: null,
    badgeLabel: ''
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
  const [alertFilter, setAlertFilter] = useState<'all' | 'alerts_only' | 'suspicious_only' | 'logins_only'>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<'all' | '24h' | '7d' | '30d'>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  // Inspector Drawer State
  const [inspectedLog, setInspectedLog] = useState<AuditLogEntry | null>(null);
  const [copiedPayload, setCopiedPayload] = useState(false);

  // Auto-scope role filter for non-admin users
  useEffect(() => {
    if (!isAdmin) {
      setRoleFilter(currentUserRole);
    }
  }, [isAdmin, currentUserRole]);

  // Telemetry Aggregation for active view
  const alertStats = useMemo(() => {
    let totalAlerts = 0;
    let suspiciousCount = 0;
    let loginCount = 0;

    for (const log of auditLogs) {
      const info = getLogAlertInfo(log);
      if (info.isAlert) totalAlerts++;
      if (info.isSuspicious) suspiciousCount++;
      if (info.alertType === 'login' || info.alertType === 'relogin') loginCount++;
    }

    return { totalAlerts, suspiciousCount, loginCount };
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
            const isActorMod = (log.actorRole || '').toLowerCase() === 'moderator';
            const isModCategory = log.category === 'alumni_verification' || log.category === 'conflict_resolution';
            if (!isActorMod && !isModCategory) return false;
          } else if (currentUserRole === 'staff' || currentUserRole === 'registrar') {
            const isActorStaff = (log.actorRole || '').toLowerCase() === 'staff' || (log.actorRole || '').toLowerCase() === 'registrar';
            const isStaffCategory = log.category === 'registry_masterlist' || log.category === 'alumni_registration';
            if (!isActorStaff && !isStaffCategory) return false;
          } else {
            // Alumni role: personal logs only
            const isSelf = log.actorId === currentUser?.uid || log.actorName === currentUser?.name;
            const isTargetSelf = Boolean(
              log.targetRecordId &&
              (log.targetRecordId === currentUser?.studentId || log.targetRecordId === currentUser?.email)
            );
            const isAlumniRole = (log.actorRole || '').toLowerCase() === 'alumni';
            if (!isSelf && !isTargetSelf && !isAlumniRole) return false;
          }
        } else {
          // Admin role: Can filter by any role or view all
          if (roleFilter !== 'all') {
            const logRole = (log.actorRole || '').toLowerCase();
            if (roleFilter === 'admin' && logRole !== 'admin' && logRole !== 'superadmin') return false;
            if (roleFilter === 'staff' && logRole !== 'staff' && logRole !== 'registrar') return false;
            if (roleFilter === 'moderator' && logRole !== 'moderator') return false;
            if (roleFilter === 'employer' && logRole !== 'employer') return false;
            if (roleFilter === 'alumni' && logRole !== 'alumni') return false;
          }
        }

        // 2. Alert & Suspicious Filter
        const alertInfo = getLogAlertInfo(log);
        if (alertFilter === 'alerts_only' && !alertInfo.isAlert) return false;
        if (alertFilter === 'suspicious_only' && !alertInfo.isSuspicious) return false;
        if (alertFilter === 'logins_only' && alertInfo.alertType !== 'login' && alertInfo.alertType !== 'relogin') return false;

        // 3. Search Query
        const q = searchQuery.toLowerCase().trim();
        if (q) {
          const matchSearch =
            (log.action || '').toLowerCase().includes(q) ||
            (log.actorName || '').toLowerCase().includes(q) ||
            (log.actorRole || '').toLowerCase().includes(q) ||
            (log.details || '').toLowerCase().includes(q) ||
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

  // Export CSV Handler
  const handleExportCsv = () => {
    const headers = [
      'Timestamp',
      'Category',
      'Action',
      'Actor Name',
      'Actor Role',
      'Target Record',
      'IP Address',
      'Severity',
      'Is Alert',
      'Details'
    ];
    const rows = filteredLogs.map((l) => {
      const alertInfo = getLogAlertInfo(l);
      return [
        `"${new Date(l.timestamp).toISOString()}"`,
        `"${l.category || ''}"`,
        `"${(l.action || '').replace(/"/g, '""')}"`,
        `"${(l.actorName || '').replace(/"/g, '""')}"`,
        `"${l.actorRole || ''}"`,
        `"${l.targetRecordId || ''}"`,
        `"${l.ipAddress || ''}"`,
        `"${l.severity || ''}"`,
        `"${alertInfo.isAlert ? 'YES' : 'NO'}"`,
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
            <span>{alertStats.totalAlerts} Total Alerts</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-900/50 flex items-center gap-2 text-xs font-semibold text-rose-900 dark:text-rose-300">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            <span>{alertStats.suspiciousCount} Suspicious</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 flex items-center gap-2 text-xs font-semibold text-stone-700 dark:text-stone-300">
            <LogIn className="w-3.5 h-3.5 text-stone-500" />
            <span>{alertStats.loginCount} Logins</span>
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
              onClick={() => setAlertFilter(alertFilter === 'alerts_only' ? 'all' : 'alerts_only')}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 border shadow-2xs ${
                alertFilter === 'alerts_only'
                  ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                  : 'bg-stone-50 dark:bg-stone-900 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-200 border-stone-200/80 dark:border-stone-700'
              }`}
              title="Filter activities with ⚠️ alerts"
            >
              <AlertTriangle className={`w-3.5 h-3.5 ${alertFilter === 'alerts_only' ? 'text-white' : 'text-amber-600'}`} />
              <span>Alerts (⚠️)</span>
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
                        <option value="staff">Staff & Registrar</option>
                        <option value="moderator">Moderator</option>
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
                      Alert & Security Type
                    </label>
                    <select
                      value={alertFilter}
                      onChange={(e) => setAlertFilter(e.target.value as any)}
                      className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200/80 dark:border-stone-700 rounded-xl text-xs font-semibold text-stone-800 dark:text-stone-200 cursor-pointer focus:outline-hidden focus:border-[#8B181B]"
                    >
                      <option value="all">All Activities (Normal + Alerts)</option>
                      <option value="alerts_only">⚠️ All Alerts (Logins & Suspicious)</option>
                      <option value="suspicious_only">⚠️ Suspicious Activities Only</option>
                      <option value="logins_only">⚠️ Logins & Re-logins Only</option>
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
                      { id: 'staff', label: 'Staff', icon: GraduationCap },
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
                {alertFilter === 'alerts_only' ? 'Alerts Only' : alertFilter === 'suspicious_only' ? 'Suspicious Only' : 'Logins Only'}
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
                    filteredLogs.map((log) => {
                      const isSelected = inspectedLog?.id === log.id;
                      const alertInfo = getLogAlertInfo(log);

                      // Distinct visual styling based on alert type and suspicious behavior
                      let rowHighlightClass = 'hover:bg-stone-50/80 dark:hover:bg-stone-900/60';
                      if (alertInfo.isSuspicious) {
                        rowHighlightClass = 'bg-rose-50/60 hover:bg-rose-100/70 dark:bg-rose-950/20 dark:hover:bg-rose-950/30 border-l-4 border-l-rose-500';
                      } else if (alertInfo.isAlert) {
                        rowHighlightClass = 'bg-amber-50/50 hover:bg-amber-100/60 dark:bg-amber-950/15 dark:hover:bg-amber-950/25 border-l-4 border-l-amber-500';
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

                          {/* Alert & Severity Column with ⚠️ icon */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex flex-col gap-1 items-start">
                              {/* Prominent ⚠️ Alert Badge if Login, Re-login, Failed, or Suspicious */}
                              {alertInfo.isAlert ? (
                                <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border shadow-2xs ${
                                  alertInfo.isSuspicious
                                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200 border-rose-300 dark:border-rose-800 animate-pulse'
                                    : 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border-amber-300 dark:border-amber-800'
                                }`}>
                                  <AlertTriangle className={`w-3.5 h-3.5 shrink-0 ${alertInfo.isSuspicious ? 'text-rose-600' : 'text-amber-600'}`} />
                                  <span>{alertInfo.isSuspicious ? '⚠️ Suspicious' : '⚠️ Alert'}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-600 dark:text-stone-400 bg-stone-100 dark:bg-stone-800 border border-stone-200/70 dark:border-stone-700 px-2 py-0.5 rounded-full">
                                  <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
                                  Normal
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
                              {alertInfo.isAlert && (
                                <span title={alertInfo.badgeLabel}>
                                  <AlertTriangle className={`w-4 h-4 shrink-0 ${alertInfo.isSuspicious ? 'text-rose-600' : 'text-amber-600'}`} />
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
                              {alertInfo.isAlert && (
                                <span className={`text-[10px] font-semibold ${alertInfo.isSuspicious ? 'text-rose-600 dark:text-rose-400' : 'text-amber-700 dark:text-amber-400'}`}>
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
                                    : log.actorRole === 'staff'
                                    ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300'
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
                {filteredLogs.map((log) => {
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
                          alertInfo.isSuspicious
                            ? 'border-rose-600'
                            : alertInfo.isAlert
                            ? 'border-amber-500'
                            : 'border-[#8B181B]'
                        }`}
                      >
                        {alertInfo.isAlert && (
                          <span className={`w-1.5 h-1.5 rounded-full ${alertInfo.isSuspicious ? 'bg-rose-600' : 'bg-amber-500'}`} />
                        )}
                      </div>

                      <div className={`p-4 rounded-xl border transition-all space-y-2 ${
                        alertInfo.isSuspicious
                          ? 'bg-rose-50/70 border-rose-300 dark:bg-rose-950/20 dark:border-rose-900/60'
                          : alertInfo.isAlert
                          ? 'bg-amber-50/60 border-amber-300 dark:bg-amber-950/20 dark:border-amber-900/60'
                          : 'bg-stone-50/50 hover:bg-stone-50 border-stone-200/80 dark:bg-stone-900/40 dark:border-stone-800'
                      }`}>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          <div className="flex items-center gap-2">
                            {alertInfo.isAlert && (
                              <AlertTriangle className={`w-4 h-4 shrink-0 ${alertInfo.isSuspicious ? 'text-rose-600' : 'text-amber-600'}`} />
                            )}
                            <span className="font-bold text-xs text-stone-900 dark:text-stone-100">
                              {log.action}
                            </span>
                            {alertInfo.isAlert && (
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                alertInfo.isSuspicious
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200 border-rose-300'
                                  : 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border-amber-300'
                              }`}>
                                ⚠️ {alertInfo.badgeLabel}
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

              {/* Alert Callout if this log is flagged */}
              {(() => {
                const info = getLogAlertInfo(inspectedLog);
                if (!info.isAlert) return null;
                return (
                  <div className={`p-3.5 rounded-2xl border text-xs space-y-1 ${
                    info.isSuspicious
                      ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/60 text-rose-900 dark:text-rose-200'
                      : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200'
                  }`}>
                    <div className="flex items-center gap-2 font-bold">
                      <AlertTriangle className={`w-4 h-4 shrink-0 ${info.isSuspicious ? 'text-rose-600' : 'text-amber-600'}`} />
                      <span>⚠️ {info.badgeLabel}</span>
                    </div>
                    <p className="text-[11px] leading-relaxed opacity-90">
                      {info.isSuspicious
                        ? 'This event involves failed credentials or repeated unsuccessful login attempts and is flagged for administrator review.'
                        : 'This event represents an active authentication action (login or re-login session takeover).'}
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
