/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  Lock,
  Server,
  Hash,
  Database,
  Download,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Layers,
  Eye,
  X,
  Copy,
  Check,
  ExternalLink,
  User,
  Building,
  ChevronRight,
  ArrowUpDown,
  Radio,
  FileSpreadsheet,
  Sparkles,
  ScanFace,
  Key,
  Globe,
  Shield,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAlumni } from '../../context/AlumniContext';
import { AuditLogEntry } from '../../types';

interface ServerAuditLogItem {
  id: string;
  timestamp: string;
  action: string;
  actor: string;
  actorRole: string;
  ip: string;
  details: Record<string, any>;
}

export const AuditLogView: React.FC = () => {
  const { auditLogs, currentUser, showToast, users } = useAlumni();

  // Strict RBAC: Audit section is strictly restricted to Administrators & Superadmins
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';

  // Primary active filter pill (Command Center style)
  const [activeFilterPill, setActiveFilterPill] = useState<'all' | 'alerts' | 'masterlist' | 'security' | 'cloud'>('all');

  // View format for ledger: 'matrix' (data table) vs 'timeline' (incident stream)
  const [displayMode, setDisplayMode] = useState<'matrix' | 'timeline'>('matrix');

  // Search & Detailed Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<'all' | '24h' | '7d' | '30d'>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  // Inspector Drawer State
  const [inspectedLog, setInspectedLog] = useState<AuditLogEntry | null>(null);
  const [inspectedServerLog, setInspectedServerLog] = useState<ServerAuditLogItem | null>(null);
  const [copiedPayload, setCopiedPayload] = useState(false);

  // Server-Authoritative Logs
  const [serverLogs, setServerLogs] = useState<ServerAuditLogItem[]>([]);
  const [isLoadingServerLogs, setIsLoadingServerLogs] = useState(false);

  // Fetch Server-Authoritative Audit Logs from backend API
  const fetchServerAuditLogs = async () => {
    setIsLoadingServerLogs(true);
    try {
      const token = localStorage.getItem('alumni_auth_token') || sessionStorage.getItem('alumni_auth_token');
      const res = await fetch('/api/admin/audit-logs', {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      if (res.ok) {
        const data = await res.json();
        setServerLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Failed to fetch server audit logs:', err);
    } finally {
      setIsLoadingServerLogs(false);
    }
  };

  useEffect(() => {
    if (activeFilterPill === 'cloud') {
      if (serverLogs.length === 0) {
        fetchServerAuditLogs();
      }
    }
  }, [activeFilterPill]);

  // Telemetry Aggregation
  const alertCount = useMemo(() => auditLogs.filter((l) => l.severity === 'alert').length, [auditLogs]);
  const warningCount = useMemo(() => auditLogs.filter((l) => l.severity === 'warning').length, [auditLogs]);
  const masterlistCount = useMemo(() => auditLogs.filter((l) => l.category === 'registry_masterlist').length, [auditLogs]);
  const securityCount = useMemo(() => auditLogs.filter((l) => l.category === 'security' || l.severity === 'alert').length, [auditLogs]);

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    const now = Date.now();
    return auditLogs
      .filter((log) => {
        // Pill filter
        if (activeFilterPill === 'alerts' && log.severity !== 'alert') return false;
        if (activeFilterPill === 'masterlist' && log.category !== 'registry_masterlist') return false;
        if (activeFilterPill === 'security' && log.category !== 'security' && log.severity !== 'alert') return false;

        // Search Query
        const q = searchQuery.toLowerCase().trim();
        if (q) {
          const matchSearch =
            (log.action || '').toLowerCase().includes(q) ||
            (log.actorName || '').toLowerCase().includes(q) ||
            (log.details || '').toLowerCase().includes(q) ||
            Boolean(log.targetRecordId && log.targetRecordId.toLowerCase().includes(q)) ||
            Boolean(log.ipAddress && log.ipAddress.toLowerCase().includes(q));
          if (!matchSearch) return false;
        }

        // Severity
        if (severityFilter !== 'all' && log.severity !== severityFilter) return false;

        // Role
        if (roleFilter !== 'all' && log.actorRole !== roleFilter) return false;

        // Time horizon
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
  }, [auditLogs, activeFilterPill, searchQuery, severityFilter, roleFilter, timeFilter, sortOrder]);


  // Export functions
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
      'Details'
    ];
    const rows = filteredLogs.map((l) => [
      `"${new Date(l.timestamp).toISOString()}"`,
      `"${l.category || ''}"`,
      `"${(l.action || '').replace(/"/g, '""')}"`,
      `"${(l.actorName || '').replace(/"/g, '""')}"`,
      `"${l.actorRole || ''}"`,
      `"${l.targetRecordId || ''}"`,
      `"${l.ipAddress || ''}"`,
      `"${l.severity || ''}"`,
      `"${(l.details || '').replace(/"/g, '""')}"`
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `cecilian_audit_trail_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Audit trail exported successfully.', 'success');
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

  if (!isAdmin) {
    return (
      <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center max-w-lg mx-auto shadow-2xs space-y-3 my-8">
        <div className="w-12 h-12 rounded-full bg-stone-100 text-stone-700 flex items-center justify-center mx-auto border border-stone-200">
          <ShieldAlert className="w-6 h-6 text-amber-600" />
        </div>
        <h3 className="text-base font-bold text-stone-900 font-sans">Administrative Desk Restricted</h3>
        <p className="text-xs text-stone-600 leading-relaxed">
          Forensic audit logs and cryptographic ledgers are restricted to authorized System Administrators.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 antialiased">
      {/* ========================================================================= */}
      {/* TOP HEADER SECTION (COMMAND CENTER AESTHETIC)                             */}
      {/* ========================================================================= */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-2">
        <div className="flex flex-wrap items-center gap-6 sm:gap-10">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-stone-900 tracking-tight font-sans">
              System Audit Logs
            </h1>
            <p className="text-xs text-stone-500 font-medium mt-0.5">
              St. Cecilia's College • Cryptographic Forensic & Accountability Ledger
            </p>
          </div>
        </div>
      </div>

      {/* BENTO TILE 3: "Audit Action Queue & Diagnostic Desk" */}
      <div className="w-full">
        <div className="bg-white rounded-2xl border border-stone-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_20px_rgba(0,0,0,0.02)] p-4 sm:px-6 sm:py-4.5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200/60 flex items-center justify-center text-[#8B181B] shrink-0">
              <Shield className="w-5 h-5 stroke-[1.75]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-stone-900 tracking-tight">
                  Audit Action Queue
                </h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                  alertCount > 0 
                    ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${alertCount > 0 ? 'bg-rose-500 animate-pulse' : 'bg-emerald-600'}`} />
                  {alertCount > 0 ? `${alertCount} require review` : 'All nominal'}
                </span>
              </div>
              <p className="text-xs text-stone-500 font-normal mt-0.5">
                {auditLogs.length} total forensic transactions recorded • Rapid security triage and audit ledger export
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={() => {
                if (activeFilterPill === 'alerts') {
                  setActiveFilterPill('all');
                  setSeverityFilter('all');
                } else {
                  setActiveFilterPill('alerts');
                  setSeverityFilter('alert');
                }
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 border ${
                activeFilterPill === 'alerts'
                  ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                  : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200/80'
              }`}
            >
              <span>Security Alerts</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                activeFilterPill === 'alerts' ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-700'
              }`}>
                {alertCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (activeFilterPill === 'masterlist') {
                  setActiveFilterPill('all');
                  setSearchQuery('');
                } else {
                  setActiveFilterPill('masterlist');
                  setSearchQuery('masterlist');
                }
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 border ${
                activeFilterPill === 'masterlist'
                  ? 'bg-[#8B181B] text-white border-[#721316] shadow-xs'
                  : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200/80'
              }`}
            >
              <span>Masterlist Mutations</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                activeFilterPill === 'masterlist' ? 'bg-white/20 text-white' : 'bg-stone-200 text-stone-700'
              }`}>
                {masterlistCount}
              </span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3.5 py-1.5 bg-[#8B181B] hover:bg-[#721316] active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5 shrink-0"
            >
              <Download className="w-3.5 h-3.5 stroke-[2]" />
              <span>Download CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* FORENSIC STREAM & AUDIT LEDGER WORKSPACE                                  */}
      {/* ========================================================================= */}
      <div className="space-y-4 pt-2">
        {/* Controls Ribbon */}
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-stone-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_20px_rgba(0,0,0,0.02)] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search action signature, actor name, student record ID, IP, or details..."
              className="w-full pl-10 pr-9 py-2 bg-stone-50/80 border border-stone-200/80 rounded-xl text-xs placeholder:text-stone-400 focus:bg-white focus:outline-hidden focus:border-[#8B181B] focus:ring-2 focus:ring-[#8B181B]/15 transition-all text-stone-800"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Format & Sort Controls */}
          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            {/* View Format Selector */}
            <div className="flex items-center p-1 bg-stone-100 rounded-xl text-xs border border-stone-200/60">
              <button
                type="button"
                onClick={() => setDisplayMode('matrix')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  displayMode === 'matrix'
                    ? 'bg-white text-stone-900 shadow-2xs font-bold'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5 stroke-[1.75]" />
                <span>Data Grid</span>
              </button>
              <button
                type="button"
                onClick={() => setDisplayMode('timeline')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  displayMode === 'timeline'
                    ? 'bg-white text-stone-900 shadow-2xs font-bold'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Radio className="w-3.5 h-3.5 stroke-[1.75]" />
                <span>Timeline</span>
              </button>
            </div>

            {/* Time Horizon Filter */}
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value as any)}
              className="px-3 py-1.5 bg-stone-50 border border-stone-200/80 rounded-xl text-xs font-medium text-stone-700 cursor-pointer focus:outline-hidden hover:bg-stone-100 transition-colors"
            >
              <option value="all">All Horizons</option>
              <option value="24h">Past 24 Hours</option>
              <option value="7d">Past 7 Days</option>
              <option value="30d">Past 30 Days</option>
            </select>

            {/* Chronological Direction */}
            <button
              type="button"
              onClick={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
              className="px-3 py-1.5 bg-stone-50 hover:bg-stone-100 border border-stone-200/80 rounded-xl text-xs font-semibold text-stone-700 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-stone-500" />
              <span>{sortOrder === 'newest' ? 'Newest' : 'Oldest'}</span>
            </button>

            <span className="text-xs text-stone-500 font-mono tabular-nums pl-1 font-semibold">
              {filteredLogs.length} entries
            </span>
          </div>
        </div>

        {/* Main Content: Data Grid Mode */}
        {displayMode === 'matrix' && (
          <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF9F5] text-stone-600 text-[11px] font-bold uppercase tracking-wider border-b border-stone-200/90">
                  <tr>
                    <th className="py-3.5 px-4 w-44 font-semibold text-stone-600">Timestamp</th>
                    <th className="py-3.5 px-4 w-32 font-semibold text-stone-600">Severity</th>
                    <th className="py-3.5 px-4 min-w-[220px] font-semibold text-stone-600">Action Signature</th>
                    <th className="py-3.5 px-4 w-48 font-semibold text-stone-600">Actor Authority</th>
                    <th className="py-3.5 px-4 w-36 font-semibold text-stone-600">Target Record</th>
                    <th className="py-3.5 px-4 w-32 font-semibold text-stone-600">Origin IP</th>
                    <th className="py-3.5 px-4 w-24 text-right pr-5 font-semibold text-stone-600">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 font-sans">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-stone-400 italic">
                        No audit ledger records match the active criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => {
                      const isSelected = inspectedLog?.id === log.id;
                      return (
                        <tr
                          key={log.id}
                          onClick={() => setInspectedLog(log)}
                          className={`transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-[#8B181B]/5 border-l-2 border-l-[#8B181B]'
                              : 'hover:bg-stone-50/80'
                          }`}
                        >
                          <td className="py-3.5 px-4 whitespace-nowrap text-stone-600 font-mono text-[11px] tabular-nums">
                            <span className="font-semibold text-stone-900 block">
                              {new Date(log.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                            <span className="text-[10px] text-stone-400">
                              {new Date(log.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {log.severity === 'alert' ? (
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200/70 px-2.5 py-1 rounded-full">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />
                                Alert
                              </span>
                            ) : log.severity === 'warning' ? (
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200/70 px-2.5 py-1 rounded-full">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                Warning
                              </span>
                            ) : log.severity === 'success' ? (
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200/70 px-2.5 py-1 rounded-full">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                                Success
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-600 bg-stone-100 border border-stone-200/70 px-2.5 py-1 rounded-full">
                                <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
                                Info
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 max-w-sm">
                            <div className="font-semibold text-stone-900 text-xs truncate">
                              {log.action}
                            </div>
                            {log.category && (
                              <span className="text-[10px] text-stone-400 uppercase tracking-wider font-mono">
                                {log.category.replace('_', ' ')}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-stone-100 border border-stone-200 flex items-center justify-center text-[10px] font-bold text-stone-700 shrink-0">
                                {(log.actorName || 'S').charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <span className="font-medium text-stone-900 text-xs block truncate">{log.actorName}</span>
                                <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-stone-100 text-stone-600 uppercase font-semibold font-mono">
                                  {log.actorRole}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap font-mono text-xs">
                            {log.targetRecordId ? (
                              <span className="text-[#8B181B] bg-red-50/70 border border-red-200/50 px-2 py-0.5 rounded font-semibold text-[11px]">
                                {log.targetRecordId}
                              </span>
                            ) : (
                              <span className="text-stone-300 italic text-[11px]">—</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap font-mono text-stone-500 text-[11px]">
                            <span className="bg-stone-50 border border-stone-200/60 px-2 py-0.5 rounded-md inline-block">
                              {log.ipAddress || '127.0.0.1'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap pr-5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setInspectedLog(log);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-stone-100/90 hover:bg-[#8B181B] hover:text-white text-stone-600 transition-all text-xs font-semibold inline-flex items-center gap-1 cursor-pointer group shadow-2xs"
                              title="Inspect Forensic Payload"
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

        {/* Timeline Incident Stream Mode */}
        {displayMode === 'timeline' && (
          <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs p-6 space-y-6">
            {filteredLogs.length === 0 ? (
              <div className="py-12 text-center text-stone-400 italic text-xs">
                No audit events found.
              </div>
            ) : (
              <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-stone-200">
                {filteredLogs.map((log) => (
                  <div
                    key={log.id}
                    onClick={() => setInspectedLog(log)}
                    className="relative group cursor-pointer"
                  >
                    <div
                      className={`absolute -left-[27px] top-1.5 w-3.5 h-3.5 rounded-full border-2 bg-white ${
                        log.severity === 'alert'
                          ? 'border-rose-600'
                          : log.severity === 'warning'
                          ? 'border-amber-500'
                          : 'border-[#8B181B]'
                      }`}
                    />

                    <div className="p-4 rounded-xl border border-stone-200/80 bg-stone-50/50 hover:bg-stone-50 hover:border-stone-300 transition-all space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-stone-900">{log.action}</span>
                          <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-stone-200 text-stone-700">
                            {log.category}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-stone-500 tabular-nums">
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                      </div>

                      <p className="text-xs text-stone-600 leading-relaxed">
                        {log.details}
                      </p>

                      <div className="flex items-center gap-3 pt-1 text-[11px] text-stone-500 flex-wrap">
                        <span className="flex items-center gap-1 font-medium text-stone-800">
                          <User className="w-3 h-3 text-stone-400" />
                          {log.actorName} ({log.actorRole})
                        </span>
                        {log.targetRecordId && (
                          <span className="font-mono text-[#8B181B]">
                            Target: {log.targetRecordId}
                          </span>
                        )}
                        <span className="font-mono text-stone-400">
                          IP: {log.ipAddress || '127.0.0.1'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* FORENSIC INSPECTOR MODAL / SLIDE-OVER                                     */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {inspectedLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl border border-stone-200 max-w-xl w-full p-6 shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#8B181B]/10 text-[#8B181B] flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-stone-900">Forensic Event Record</h3>
                    <span className="text-[10px] font-mono text-stone-400">UUID: {inspectedLog.id}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectedLog(null)}
                  className="p-1 rounded-full text-stone-400 hover:bg-stone-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3 bg-stone-50 p-3 rounded-2xl border border-stone-200/80">
                  <div>
                    <span className="text-[10px] text-stone-400 block font-medium">Action Signature</span>
                    <span className="font-bold text-stone-900">{inspectedLog.action}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-stone-400 block font-medium">Timestamp</span>
                    <span className="font-mono text-stone-700">{new Date(inspectedLog.timestamp).toISOString()}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-stone-400 block font-medium">Actor Authority</span>
                    <span className="font-medium text-stone-800">{inspectedLog.actorName} ({inspectedLog.actorRole})</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-stone-400 block font-medium">Origin IP Address</span>
                    <span className="font-mono text-stone-700">{inspectedLog.ipAddress || '127.0.0.1'}</span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-stone-400 block font-medium mb-1">Event Narrative</span>
                  <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-stone-700 leading-relaxed font-sans">
                    {inspectedLog.details}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-stone-400 font-medium">Raw Payload Inspector</span>
                    <button
                      type="button"
                      onClick={() => handleCopyPayload(inspectedLog)}
                      className="text-[11px] text-[#8B181B] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
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
                  className="px-4 py-2 bg-stone-900 text-white rounded-xl text-xs font-semibold hover:bg-stone-800 transition-colors cursor-pointer"
                >
                  Close Inspector
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
