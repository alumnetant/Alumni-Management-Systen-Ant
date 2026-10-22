/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Users,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Eye,
  Trash2,
  UserPlus,
  Lock,
  Check,
  X,
  Shield,
  ShieldCheck,
  AlertCircle,
  GraduationCap,
  Briefcase,
  LayoutGrid,
  List,
  Sparkles,
  TrendingUp,
  Mail,
  Building2,
  Globe,
  Layers,
  Download,
  MapPin,
  Clock,
  ArrowUpDown,
  RotateCcw,
  SlidersHorizontal,
  ChevronDown,
  CheckSquare,
  Loader2
} from 'lucide-react';
import { useAlumni } from '../../context/AlumniContext';
import { UserProfile, UserRole, isAdministrativeOrStaffRole } from '../../types';
import { getUserAvatar, handleUserAvatarError } from '../../lib/defaultImages';
import { exportAlumniRosterCsv } from '../../services/adminExportService';

interface AdminUsersTableProps {
  onOpenCreateUser: () => void;
}

export const AdminUsersTable: React.FC<AdminUsersTableProps> = ({ onOpenCreateUser }) => {
  const {
    users,
    currentUser,
    setUserVerified,
    updateUserRole,
    deleteAlumni,
    setSelectedUserIdForModal,
    permissions,
    showToast
  } = useAlumni();

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [batchFilter, setBatchFilter] = useState<string>('all');
  const [employmentFilter, setEmploymentFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name_asc' | 'name_desc' | 'batch_desc' | 'batch_asc' | 'recent' | 'verified_first'>('name_asc');
  const [selectedUids, setSelectedUids] = useState<string[]>([]);
  const [userToDelete, setUserToDelete] = useState<{ uid: string; name: string } | null>(null);
  const [visibleUserCount, setVisibleUserCount] = useState<number>(12);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);
  const [updatingRoleUid, setUpdatingRoleUid] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut listener: Cmd+K / Ctrl+K / '/' focuses search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      const isInput = activeTag === 'input' || activeTag === 'textarea';

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === '/' && !isInput) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    setVisibleUserCount(12);
  }, [searchQuery, roleFilter, batchFilter, employmentFilter, sortBy]);

  // Aggregate counts for quick tabs and options
  const totalVerified = useMemo(() => users.filter((u) => u.isVerified).length, [users]);
  const totalPending = useMemo(() => users.filter((u) => !u.isVerified).length, [users]);
  const totalAlumniOnly = useMemo(() => users.filter((u) => u.role === 'alumni').length, [users]);
  const totalStaffAdmin = useMemo(
    () => users.filter((u) => isAdministrativeOrStaffRole(u.role) || u.role !== 'alumni').length,
    [users]
  );
  const totalEmployers = useMemo(() => users.filter((u) => u.role === 'employer').length, [users]);

  // Distinct batches with user counts
  const batchCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    users.forEach((u) => {
      if (u.batch) counts[u.batch] = (counts[u.batch] || 0) + 1;
    });
    return counts;
  }, [users]);

  const allBatches = useMemo(() => {
    const batches = Object.keys(batchCounts);
    return ['all', ...batches.sort().reverse()];
  }, [batchCounts]);

  const roleBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    users.forEach((u) => {
      counts[u.role] = (counts[u.role] || 0) + 1;
    });
    return counts;
  }, [users]);

  // Active filter counter
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchQuery.trim()) count++;
    if (roleFilter !== 'all') count++;
    if (batchFilter !== 'all') count++;
    if (employmentFilter !== 'all') count++;
    return count;
  }, [searchQuery, roleFilter, batchFilter, employmentFilter]);

  const secondaryFiltersCount = useMemo(() => {
    let count = 0;
    if (roleFilter !== 'all') count++;
    if (batchFilter !== 'all') count++;
    if (employmentFilter !== 'all') count++;
    return count;
  }, [roleFilter, batchFilter, employmentFilter]);

  const handleClearAllFilters = () => {
    setSearchQuery('');
    setRoleFilter('all');
    setBatchFilter('all');
    setEmploymentFilter('all');
    setSortBy('name_asc');
  };

  // Filtered and sorted users list
  const filteredUsers = useMemo(() => {
    const tokens = searchQuery.toLowerCase().trim().split(/\s+/).filter(Boolean);

    const matches = users.filter((u) => {
      // Tokenized multi-term search across all key attributes
      const matchesSearch =
        tokens.length === 0 ||
        tokens.every((token) => {
          return (
            (u.name || '').toLowerCase().includes(token) ||
            (u.email || '').toLowerCase().includes(token) ||
            (u.course || '').toLowerCase().includes(token) ||
            (u.batch || '').includes(token) ||
            (u.studentId || '').toLowerCase().includes(token) ||
            (u.alumniId || '').toLowerCase().includes(token) ||
            (u.company || '').toLowerCase().includes(token) ||
            (u.companyName || '').toLowerCase().includes(token) ||
            (u.currentPosition || '').toLowerCase().includes(token) ||
            (u.headline || '').toLowerCase().includes(token) ||
            (u.department || '').toLowerCase().includes(token) ||
            (u.location || '').toLowerCase().includes(token) ||
            (u.role || '').toLowerCase().includes(token) ||
            (u.employmentStatus || '').toLowerCase().includes(token) ||
            (u.skills || []).some((s) => s.toLowerCase().includes(token))
          );
        });

      // Role filter
      let matchesRole = true;
      if (roleFilter === 'staff_admin') {
        matchesRole = isAdministrativeOrStaffRole(u.role) || u.role !== 'alumni';
      } else if (roleFilter !== 'all') {
        matchesRole = u.role === roleFilter;
      }

      // Batch filter
      const matchesBatch = batchFilter === 'all' || u.batch === batchFilter;

      // Employment filter
      const matchesEmployment =
        employmentFilter === 'all'
          ? true
          : employmentFilter === 'Employed'
          ? u.employmentStatus === 'Employed' || (!!u.currentPosition && !!u.company)
          : employmentFilter === 'Self-employed'
          ? u.employmentStatus === 'Self-employed'
          : u.employmentStatus === employmentFilter;

      return matchesSearch && matchesRole && matchesBatch && matchesEmployment;
    });

    // Precision sorting
    return [...matches].sort((a, b) => {
      if (sortBy === 'name_asc') {
        return (a.name || '').localeCompare(b.name || '');
      }
      if (sortBy === 'name_desc') {
        return (b.name || '').localeCompare(a.name || '');
      }
      if (sortBy === 'batch_desc') {
        return (b.batch || '').localeCompare(a.batch || '');
      }
      if (sortBy === 'batch_asc') {
        return (a.batch || '').localeCompare(b.batch || '');
      }
      if (sortBy === 'recent') {
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      }
      if (sortBy === 'verified_first') {
        const aV = a.isVerified ? 1 : 0;
        const bV = b.isVerified ? 1 : 0;
        return bV - aV;
      }
      return 0;
    });
  }, [users, searchQuery, roleFilter, batchFilter, employmentFilter, sortBy]);

  // Bulk selection handlers
  const handleSelectAll = () => {
    if (selectedUids.length === filteredUsers.length) {
      setSelectedUids([]);
    } else {
      setSelectedUids(filteredUsers.map((u) => u.uid));
    }
  };

  const handleToggleSelect = (uid: string) => {
    setSelectedUids((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const handleBulkVerify = () => {
    if (selectedUids.length === 0) return;
    selectedUids.forEach((uid) => {
      setUserVerified(uid, true);
    });
    showToast(`Successfully verified ${selectedUids.length} selected users!`, 'success');
    setSelectedUids([]);
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;
    await deleteAlumni(userToDelete.uid);
    setUserToDelete(null);
  };

  return (
    <div className="space-y-6 pb-12 antialiased">

      {/* ========================================================
          SIMPLIFIED ALUMNI DIRECTORY TOOLBAR & FILTERS
          Clean, modern, single-line aesthetic with expandable filters
          ======================================================== */}
      <div className="sticky top-14 sm:top-16 md:top-24 z-20 bg-white/95 dark:bg-stone-900/95 backdrop-blur-md p-3 sm:p-3.5 rounded-2xl border border-stone-200/90 dark:border-stone-800 shadow-[0_4px_20px_rgba(0,0,0,0.03),0_1px_3px_rgba(0,0,0,0.02)] space-y-2.5">
        {/* MAIN ROW: Search + Filters Toggle + View Switcher */}
        <div className="flex items-center gap-2.5">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={searchInputRef}
              id="admin-directory-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, ID, course, company, or skills..."
              className="w-full pl-9 pr-14 py-2 text-xs sm:text-sm bg-stone-50 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#8B181B]/20 focus:border-[#8B181B] text-stone-900 dark:text-white placeholder:text-stone-400 transition-all font-sans cursor-text"
            />
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-200/60 dark:hover:bg-stone-700 rounded-md transition-colors cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <kbd className="hidden sm:inline-flex px-1.5 py-0.5 text-[10px] font-mono text-stone-400 dark:text-stone-500 bg-white dark:bg-stone-700/60 border border-stone-200 dark:border-stone-600 rounded pointer-events-none">
                ⌘K
              </kbd>
            </div>
          </div>

          {/* Minimal Controls: Filters Drawer Toggle + View Mode Switcher */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Toggle Filters Button */}
            <button
              type="button"
              onClick={() => setShowAdvancedFilters((prev) => !prev)}
              className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                showAdvancedFilters || secondaryFiltersCount > 0
                  ? 'bg-[#8B181B]/10 border-[#8B181B]/40 text-[#8B181B] dark:text-red-400'
                  : 'bg-stone-50 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700/70'
              }`}
              title="Toggle filter criteria"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Filters</span>
              {secondaryFiltersCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-[#8B181B] text-white text-[10px] flex items-center justify-center font-mono font-bold">
                  {secondaryFiltersCount}
                </span>
              )}
            </button>

            {/* View Mode Switcher: Cards vs Table */}
            <div className="inline-flex items-center p-0.5 bg-stone-100 dark:bg-stone-800 rounded-xl border border-stone-200 dark:border-stone-700">
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                title="Bento Cards View"
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'cards'
                    ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-white shadow-2xs'
                    : 'text-stone-500 hover:text-stone-800 dark:text-stone-400'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                title="Table View"
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-white shadow-2xs'
                    : 'text-stone-500 hover:text-stone-800 dark:text-stone-400'
                }`}
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* EXPANDABLE FILTER ROW (Role, Batch, Employment) */}
        {showAdvancedFilters && (
          <div className="pt-2.5 border-t border-stone-100 dark:border-stone-800 space-y-2 animate-in fade-in slide-in-from-top-1 duration-150">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
              {/* Role Filter */}
              <div className="relative">
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  aria-label="Filter by Institutional Role"
                  className="w-full pl-3 pr-7 py-1.5 text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-stone-800 dark:text-stone-200 font-medium focus:outline-hidden focus:border-[#8B181B] cursor-pointer appearance-none truncate"
                >
                  <option value="all">All Roles</option>
                  <option value="alumni">Alumni Network</option>
                  <option value="staff_admin">Staff & Administration</option>
                  <option value="employer">Corporate Partners</option>
                </select>
                <ChevronDown className="w-3 h-3 text-stone-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Batch Filter */}
              <div className="relative">
                <select
                  value={batchFilter}
                  onChange={(e) => setBatchFilter(e.target.value)}
                  aria-label="Filter by Graduation Batch"
                  className="w-full pl-3 pr-7 py-1.5 text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-stone-800 dark:text-stone-200 font-medium focus:outline-hidden focus:border-[#8B181B] cursor-pointer appearance-none truncate"
                >
                  <option value="all">All Batches</option>
                  {allBatches.filter((b) => b !== 'all').map((b) => (
                    <option key={b} value={b}>
                      Batch {b} ({batchCounts[b] || 0})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 text-stone-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Career / Employment Status */}
              <div className="relative">
                <select
                  value={employmentFilter}
                  onChange={(e) => setEmploymentFilter(e.target.value)}
                  aria-label="Filter by Employment Status"
                  className="w-full pl-3 pr-7 py-1.5 text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-stone-800 dark:text-stone-200 font-medium focus:outline-hidden focus:border-[#8B181B] cursor-pointer appearance-none truncate"
                >
                  <option value="all">All Employment</option>
                  <option value="Employed">Employed</option>
                  <option value="Self-employed">Self-employed</option>
                  <option value="Unemployed">Seeking Work</option>
                </select>
                <ChevronDown className="w-3 h-3 text-stone-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {secondaryFiltersCount > 0 && (
              <div className="flex items-center justify-end pt-1">
                <button
                  type="button"
                  onClick={handleClearAllFilters}
                  className="text-xs font-semibold text-[#8B181B] hover:underline cursor-pointer"
                >
                  Reset all filters
                </button>
              </div>
            )}
          </div>
        )}

        {/* Bulk Selection Bar */}
        {selectedUids.length > 0 && (
          <div className="p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200/80 dark:border-red-900/60 rounded-xl flex items-center justify-between gap-3 animate-in fade-in duration-150">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#8B181B] animate-pulse" />
              <p className="text-xs font-bold text-red-950 dark:text-red-200">
                {selectedUids.length} member{selectedUids.length > 1 ? 's' : ''} selected
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleBulkVerify}
                className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Verify Selected</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedUids([])}
                className="px-2.5 py-1 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-50 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================
          DIRECTORY CONTENT: BENTO CARDS VIEW OR STRUCTURED TABLE VIEW
          ======================================================== */}
      {filteredUsers.length === 0 ? (
        <div className="bg-white dark:bg-stone-900 rounded-[28px] border border-stone-200/90 dark:border-stone-800 p-12 text-center shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <Users className="w-10 h-10 text-stone-300 dark:text-stone-600 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-stone-900 dark:text-white">No Members Found</h3>
          <p className="text-xs text-stone-500 mt-1 max-w-md mx-auto leading-relaxed">
            No alumni or staff members found. Try clearing your search or changing filters.
          </p>
          <button
            type="button"
            onClick={handleClearAllFilters}
            className="mt-4 px-4 py-2 bg-[#8B181B] hover:bg-[#721316] text-white rounded-xl text-xs font-semibold transition-colors shadow-2xs cursor-pointer inline-flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5 stroke-[2]" />
            <span>Clear Filters</span>
          </button>
        </div>
      ) : viewMode === 'cards' ? (
        /* ========================================================
           HIGH-DENSITY BENTO CARDS VIEW
           ======================================================== */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredUsers.slice(0, visibleUserCount).map((u) => {
            const isSelected = selectedUids.includes(u.uid);

            return (
              <div
                key={u.uid}
                className={`relative overflow-hidden bg-white dark:bg-stone-900 rounded-[28px] border transition-all duration-200 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02),0_8px_24px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.07)] flex flex-col justify-between group ${
                  isSelected ? 'border-[#8B181B] bg-red-50/20 ring-1 ring-[#8B181B]' : 'border-stone-200/90 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700'
                }`}
              >
                {/* Institutional St. Cecilia Crimson Top Trim */}
                <div className="h-0.5 w-full bg-[#8B181B]/40 group-hover:bg-[#8B181B] transition-colors absolute top-0 left-0 right-0" />

                <div>
                  {/* Top Action & Selection */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="relative shrink-0">
                        <img
                          src={getUserAvatar(u.profilePictureUrl || u.avatar)}
                          alt={u.name}
                          onError={handleUserAvatarError}
                          onClick={() => setSelectedUserIdForModal(u.uid)}
                          className="w-12 h-12 rounded-2xl object-cover ring-1 ring-stone-200 dark:ring-stone-700 cursor-pointer hover:opacity-90 transition-opacity shadow-2xs"
                        />
                        {u.isVerified && (
                          <div className="absolute -bottom-1 -right-1 bg-emerald-600 text-white rounded-full p-0.5 border-2 border-white dark:border-stone-900 shadow-2xs" title="Verified Graduate">
                            <ShieldCheck className="w-3 h-3" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <h3
                          onClick={() => setSelectedUserIdForModal(u.uid)}
                          className="text-sm font-bold text-stone-900 dark:text-white hover:text-[#8B181B] cursor-pointer tracking-tight truncate transition-colors"
                        >
                          {u.name}
                        </h3>
                        <p className="text-[11px] text-stone-500 truncate mt-0.5">{u.email}</p>
                      </div>
                    </div>

                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelect(u.uid)}
                      aria-label={`Select ${u.name}`}
                      className="rounded border-stone-300 text-[#8B181B] focus:ring-[#8B181B] cursor-pointer mt-1"
                    />
                  </div>

                  {/* Credentials & Program Details */}
                  <div className="mt-3.5 space-y-1.5 pt-3 border-t border-stone-100 dark:border-stone-800 text-xs">
                    <div className="flex items-center justify-between text-stone-600 dark:text-stone-400">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Role</span>
                      {permissions.canAccessAdminPanel && u.uid !== currentUser?.uid ? (
                        <div className="flex items-center gap-1.5">
                          {updatingRoleUid === u.uid && (
                            <Loader2 className="w-3 h-3 animate-spin text-[#8B181B]" />
                          )}
                          <select
                            value={u.role}
                            disabled={updatingRoleUid === u.uid}
                            onChange={async (e) => {
                              const newRole = e.target.value as UserRole;
                              setUpdatingRoleUid(u.uid);
                              try {
                                await updateUserRole(u.uid, newRole);
                              } finally {
                                setUpdatingRoleUid(null);
                              }
                            }}
                            className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200 hover:border-stone-400 focus:outline-hidden cursor-pointer disabled:opacity-60"
                          >
                            <option value="alumni">Alumni</option>
                            <option value="moderator">Moderator</option>
                            <option value="staff">Staff</option>
                            <option value="registrar">Registrar</option>
                            <option value="admin">Admin</option>
                            {currentUser?.role === 'superadmin' && (
                              <option value="superadmin">Superadmin</option>
                            )}
                            <option value="employer">Employer</option>
                          </select>
                        </div>
                      ) : (
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                          u.role === 'admin' || u.role === 'superadmin'
                            ? 'bg-red-50 text-[#8B181B] border-red-200/80 dark:bg-red-950/40 dark:text-red-300'
                            : u.role === 'registrar'
                            ? 'bg-amber-50 text-amber-900 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300'
                            : u.role === 'employer'
                            ? 'bg-blue-50 text-blue-800 border-blue-200/80 dark:bg-blue-950/40 dark:text-blue-300'
                            : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700'
                        }`}>
                          {u.role}
                        </span>
                      )}
                    </div>

                    {u.studentId && (
                      <div className="flex items-center justify-between text-stone-600 dark:text-stone-400">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Student ID</span>
                        <span className="font-mono text-xs text-stone-800 dark:text-stone-200 font-semibold">{u.studentId}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-stone-600 dark:text-stone-400">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Discipline / Class</span>
                      <span className="font-semibold text-stone-800 dark:text-stone-200 text-right truncate max-w-[170px]">
                        {u.course ? `${u.course} • ` : ''}Batch {u.batch || '—'}
                      </span>
                    </div>

                    {(u.company || u.currentPosition) && (
                      <div className="flex items-center justify-between text-stone-600 dark:text-stone-400">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Affiliation</span>
                        <span className="font-medium text-stone-700 dark:text-stone-300 truncate max-w-[170px]">
                          {u.currentPosition ? `${u.currentPosition} ` : ''}{u.company ? `@ ${u.company}` : ''}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Action Footer */}
                <div className="mt-4 pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between gap-2">
                  {/* Verified Status Display vs Verify Clearance Button */}
                  {u.isVerified ? (
                    <div
                      className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5 select-none"
                      title="Verified institutional member record"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Verified</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setUserVerified(u.uid, true);
                        showToast(`${u.name} has been verified!`, 'success');
                      }}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-emerald-50 hover:text-emerald-800 border border-amber-200 hover:border-emerald-200"
                      title="Verify academic or institutional clearance"
                    >
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>Verify Clearance</span>
                    </button>
                  )}

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedUserIdForModal(u.uid)}
                      className="px-3 py-1.5 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Profile
                    </button>

                    {permissions.canAccessAdminPanel && u.uid !== currentUser?.uid && (
                      <button
                        type="button"
                        onClick={() => setUserToDelete({ uid: u.uid, name: u.name })}
                        className="p-1.5 text-stone-400 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors cursor-pointer"
                        title="Delete member record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ========================================================
           COMMAND ROSTER STRUCTURED TABLE VIEW
           ======================================================== */
        <div className="bg-white dark:bg-stone-900 rounded-[28px] border border-stone-200/90 dark:border-stone-800 shadow-[0_1px_3px_rgba(0,0,0,0.02)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-stone-200/80 dark:border-stone-800 bg-stone-50/80 dark:bg-stone-800/60 text-[11px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                  <th className="py-3 px-4 text-center w-10">
                    <input
                      type="checkbox"
                      checked={filteredUsers.length > 0 && selectedUids.length === filteredUsers.length}
                      onChange={handleSelectAll}
                      aria-label="Select all members"
                      className="rounded border-stone-300 text-[#8B181B] focus:ring-[#8B181B] cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-4 sm:px-6">Member Profile</th>
                  <th className="py-3 px-4">Academic Program</th>
                  <th className="py-3 px-3">Batch</th>
                  <th className="py-3 px-4">Clearance Status</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800 text-xs">
                {filteredUsers.slice(0, visibleUserCount).map((u) => {
                  const isSelected = selectedUids.includes(u.uid);

                  return (
                    <tr
                      key={u.uid}
                      className={`hover:bg-stone-50/70 dark:hover:bg-stone-800/50 transition-colors group ${
                        isSelected ? 'bg-red-50/20 dark:bg-red-950/20' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(u.uid)}
                          aria-label={`Select ${u.name}`}
                          className="rounded border-stone-300 text-[#8B181B] focus:ring-[#8B181B] cursor-pointer"
                        />
                      </td>

                      {/* Member Column */}
                      <td className="py-3.5 px-4 sm:px-6">
                        <div className="flex items-center gap-3">
                          <div className="relative shrink-0">
                            <img
                              src={getUserAvatar(u.profilePictureUrl || u.avatar)}
                              alt={u.name}
                              onError={handleUserAvatarError}
                              onClick={() => setSelectedUserIdForModal(u.uid)}
                              className="w-10 h-10 rounded-xl object-cover ring-1 ring-stone-200 dark:ring-stone-700 cursor-pointer shadow-2xs"
                            />
                            {u.isVerified && (
                              <div className="absolute -bottom-1 -right-1 bg-emerald-600 text-white rounded-full p-0.5 border border-white dark:border-stone-900" title="Verified Graduate">
                                <ShieldCheck className="w-2.5 h-2.5" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span
                                onClick={() => setSelectedUserIdForModal(u.uid)}
                                className="font-bold text-stone-900 dark:text-white hover:text-[#8B181B] cursor-pointer truncate text-sm"
                              >
                                {u.name}
                              </span>
                            </div>
                            <div className="text-[11px] text-stone-500 truncate max-w-xs">{u.email}</div>
                            {u.studentId && (
                              <div className="text-[10px] font-mono text-stone-400">ID: {u.studentId}</div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Academic Program Column */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-stone-800 dark:text-stone-200 truncate max-w-xs">
                          {u.course || 'Degree Program'}
                        </div>
                        <div className="text-[10px] text-stone-400">
                          {u.department || 'Undergraduate Division'}
                        </div>
                      </td>

                      {/* Batch Column */}
                      <td className="py-3.5 px-3">
                        <span className="font-mono font-bold text-stone-700 dark:text-stone-300 bg-stone-100 dark:bg-stone-800 px-2 py-0.5 rounded-md text-[11px]">
                          {u.batch ? `'${u.batch.slice(-2)}` : '—'}
                        </span>
                      </td>

                      {/* Clearance Status Column */}
                      <td className="py-3.5 px-4">
                        {u.isVerified ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-bold text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Verified</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setUserVerified(u.uid, true);
                              showToast(`${u.name} has been verified!`, 'success');
                            }}
                            className="px-2.5 py-1 rounded-full text-[11px] font-bold border border-amber-200 bg-amber-50 text-amber-800 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-200 transition-colors cursor-pointer flex items-center gap-1"
                            title="Verify member clearance"
                          >
                            <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
                            <span>Pending • Verify</span>
                          </button>
                        )}
                      </td>

                      {/* Role Column */}
                      <td className="py-3.5 px-4">
                        {permissions.canAccessAdminPanel && u.uid !== currentUser?.uid ? (
                          <div className="flex items-center gap-1.5">
                            {updatingRoleUid === u.uid && (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#8B181B]" />
                            )}
                            <select
                              value={u.role}
                              disabled={updatingRoleUid === u.uid}
                              onChange={async (e) => {
                                const newRole = e.target.value as UserRole;
                                setUpdatingRoleUid(u.uid);
                                try {
                                  await updateUserRole(u.uid, newRole);
                                } finally {
                                  setUpdatingRoleUid(null);
                                }
                              }}
                              className="px-2 py-1 rounded-lg text-[11px] font-bold uppercase bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-stone-700 hover:border-stone-400 focus:outline-hidden cursor-pointer disabled:opacity-60"
                            >
                              <option value="alumni">Alumni</option>
                              <option value="moderator">Moderator</option>
                              <option value="staff">Staff</option>
                              <option value="registrar">Registrar</option>
                              <option value="admin">Admin</option>
                              {currentUser?.role === 'superadmin' && (
                                <option value="superadmin">Superadmin</option>
                              )}
                              <option value="employer">Employer</option>
                            </select>
                          </div>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700">
                            {u.role}
                          </span>
                        )}
                      </td>

                      {/* Action Buttons Column */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedUserIdForModal(u.uid)}
                            className="px-2.5 py-1 text-[11px] font-semibold text-stone-700 dark:text-stone-300 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 rounded-lg transition-colors cursor-pointer"
                          >
                            Profile
                          </button>

                          {permissions.canAccessAdminPanel && u.uid !== currentUser?.uid && (
                            <button
                              type="button"
                              onClick={() => setUserToDelete({ uid: u.uid, name: u.name })}
                              title="Delete member record"
                              className="p-1.5 text-stone-400 hover:text-red-700 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================
          PROGRESSIVE "SEE MORE" PAGINATION CONTROLS
          ======================================================== */}
      {filteredUsers.length > visibleUserCount && (
        <div className="mt-8 pt-6 border-t border-stone-200/80 dark:border-stone-800 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-stone-900 p-5 rounded-[28px] border border-stone-200/90 shadow-2xs">
          <div className="text-xs text-stone-600 dark:text-stone-400 text-center sm:text-left">
            Showing <strong className="text-stone-900 dark:text-white font-bold">{Math.min(visibleUserCount, filteredUsers.length)}</strong> of{' '}
            <strong className="text-stone-900 dark:text-white font-bold">{filteredUsers.length}</strong> Cecilians
            <div className="w-48 sm:w-64 bg-stone-200 dark:bg-stone-700 rounded-full h-1.5 mt-1.5 overflow-hidden mx-auto sm:mx-0">
              <div
                className="bg-[#8B181B] h-full rounded-full transition-all duration-300"
                style={{
                  width: `${(Math.min(visibleUserCount, filteredUsers.length) / filteredUsers.length) * 100}%`
                }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap justify-center">
            <button
              type="button"
              onClick={() => setVisibleUserCount((prev) => prev + 12)}
              className="px-5 py-2.5 bg-[#8B181B] hover:bg-[#721316] text-white font-bold text-xs rounded-xl shadow-2xs transition-all cursor-pointer active:scale-95"
            >
              Load Next 12 (+{Math.min(12, filteredUsers.length - visibleUserCount)})
            </button>
            <button
              type="button"
              onClick={() => setVisibleUserCount(filteredUsers.length)}
              className="px-4 py-2.5 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 font-semibold text-xs rounded-xl transition-all cursor-pointer"
            >
              Display Complete Directory
            </button>
          </div>
        </div>
      )}

      {visibleUserCount > 12 && filteredUsers.length > 12 && (
        <div className="text-center pt-1">
          <button
            type="button"
            onClick={() => setVisibleUserCount(12)}
            className="text-xs text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 font-semibold underline cursor-pointer"
          >
            Show Less (Reset to 12)
          </button>
        </div>
      )}

      {/* ========================================================
          DELETE CONFIRMATION MODAL
          ======================================================== */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-xl border border-stone-200 dark:border-stone-800 max-w-sm w-full p-5 space-y-4">
            <div className="flex items-center gap-3 text-[#8B181B]">
              <div className="p-2 bg-red-50 dark:bg-red-950/40 rounded-xl">
                <Trash2 className="w-5 h-5 text-[#8B181B]" />
              </div>
              <h3 className="text-sm font-bold text-stone-900 dark:text-white font-sans">Delete Member Record</h3>
            </div>
            <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
              Are you sure you want to permanently remove <span className="font-bold text-stone-900 dark:text-white">{userToDelete.name}</span>? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="px-3 py-1.5 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-3.5 py-1.5 bg-[#8B181B] hover:bg-[#721316] text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
