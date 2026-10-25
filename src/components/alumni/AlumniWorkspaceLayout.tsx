/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  LayoutDashboard,
  Users,
  Calendar,
  Megaphone,
  Briefcase,
  ImageIcon,
  MessageSquare,
  Settings as SettingsIcon,
  LogOut,
  User as UserIcon,
  Search,
  Menu,
  X,
  QrCode,
  ShieldCheck,
  Loader2,
  Moon,
  Sun,
  Bell,
  Check,
  Sparkles,
  ChevronRight,
  ExternalLink,
  Award,
  BookOpen,
  ScanFace,
  Grid,
  MoreHorizontal,
  WifiOff,
  Globe,
  FileText,
  Landmark,
  GraduationCap,
  Building2,
  Compass
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAlumni } from '../../context/AlumniContext';
import { useTheme } from '../../lib/theme';
import { DashboardView } from '../dashboard/DashboardView';
import { NetworkView } from '../network/NetworkView';
import { MessagesView } from '../messages/MessagesView';
import { EventsView } from '../events/EventsView';
import { AnnouncementsView } from '../announcements/AnnouncementsView';
import { OpportunitiesView } from '../opportunities/OpportunitiesView';
import { ProfileView } from '../profile/ProfileView';
import { SettingsView } from '../settings/SettingsView';
import { CampusGalleryModal } from '../gallery/CampusGalleryModal';
import { AlumniChaptersModal } from '../common/AlumniChaptersModal';
import { DigitalAlumniCard } from '../profile/DigitalAlumniCard';
import { VerificationGate } from '../common/VerificationGate';
import { getUserAvatar, handleUserAvatarError } from '../../lib/defaultImages';
import { exportAlumniRosterCsv } from '../../services/adminExportService';
import { GlobalCommandPalette } from '../common/GlobalCommandPalette';
import { NotificationsView } from '../notifications/NotificationsView';
import { registerBackAction, triggerHaptic } from '../../services/mobileAppService';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { ConfirmationModal } from '../common/ConfirmationModal';

export type AlumniModuleId =
  | 'dashboard'
  | 'notifications'
  | 'network'
  | 'messages'
  | 'events'
  | 'announcements'
  | 'opportunities'
  | 'gallery'
  | 'profile'
  | 'settings';

interface AlumniWorkspaceLayoutProps {
  onOpenAuth?: (mode: 'login' | 'register') => void;
  onGoToLanding?: () => void;
}

export const AlumniWorkspaceLayout: React.FC<AlumniWorkspaceLayoutProps> = ({
  onOpenAuth,
  onGoToLanding
}) => {
  const {
    currentUser,
    users,
    activeTab,
    setActiveTab,
    chats,
    events,
    announcements,
    opportunities,
    syncAllDataToCloud,
    isFirestoreSyncing,
    logout,
    notifications,
    userNotifications,
    unreadNotificationsCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    acceptFriendRequest,
    isConnected,
    getConnectionStatus,
    showToast
  } = useAlumni();

  const { isDark, toggleTheme } = useTheme();

  // Active module synced with context activeTab
  const currentModule = useMemo<AlumniModuleId>(() => {
    const validModules: AlumniModuleId[] = [
      'dashboard',
      'notifications',
      'network',
      'messages',
      'events',
      'announcements',
      'opportunities',
      'gallery',
      'profile',
      'settings'
    ];
    if (validModules.includes(activeTab as AlumniModuleId)) {
      return activeTab as AlumniModuleId;
    }
    return 'dashboard';
  }, [activeTab]);

  const { isOnline } = useNetworkStatus();

  const handleSelectModule = (mod: AlumniModuleId) => {
    triggerHaptic('light');
    setActiveTab(mod as any);
  };

  // Sidebar expanded state: visible by default as requested
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const isSidebarCollapsed = !isSidebarExpanded;

  // Listen for global custom events to open alumni pass modal directly
  useEffect(() => {
    const handleOpenPass = () => setShowDigitalPassModal(true);
    window.addEventListener('applet:open-alumni-pass', handleOpenPass);
    return () => window.removeEventListener('applet:open-alumni-pass', handleOpenPass);
  }, []);

  // Keyboard shortcut listener: [ or Cmd+B / Ctrl+B toggles sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement as HTMLElement)?.tagName;
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeTag) || (document.activeElement as HTMLElement)?.isContentEditable;
      if (isInput) return;
      if (((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') || e.key === '[') {
        e.preventDefault();
        setIsSidebarExpanded((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Modals state
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showDigitalPassModal, setShowDigitalPassModal] = useState(false);
  const [showGalleryModal, setShowGalleryModal] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showChaptersModal, setShowChaptersModal] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  // Hardware Back Button action stack: Closes topmost modals/drawers first, then navigates back to dashboard
  useEffect(() => {
    if (showDigitalPassModal) {
      return registerBackAction(() => {
        setShowDigitalPassModal(false);
        return true;
      });
    }
  }, [showDigitalPassModal]);

  useEffect(() => {
    if (showMobileNav) {
      return registerBackAction(() => {
        setShowMobileNav(false);
        return true;
      });
    }
  }, [showMobileNav]);

  useEffect(() => {
    if (showGalleryModal) {
      return registerBackAction(() => {
        setShowGalleryModal(false);
        return true;
      });
    }
  }, [showGalleryModal]);

  useEffect(() => {
    if (showChaptersModal) {
      return registerBackAction(() => {
        setShowChaptersModal(false);
        return true;
      });
    }
  }, [showChaptersModal]);

  useEffect(() => {
    if (showCommandPalette) {
      return registerBackAction(() => {
        setShowCommandPalette(false);
        return true;
      });
    }
  }, [showCommandPalette]);

  useEffect(() => {
    if (showProfileMenu) {
      return registerBackAction(() => {
        setShowProfileMenu(false);
        return true;
      });
    }
  }, [showProfileMenu]);

  useEffect(() => {
    if (currentModule !== 'dashboard') {
      return registerBackAction(() => {
        setActiveTab('dashboard' as any);
        return true;
      });
    }
  }, [currentModule, setActiveTab]);

  // Unread messages count
  const unreadMessagesCount = useMemo(() => {
    if (!currentUser || !chats) return 0;
    return chats.reduce((acc, chat) => {
      if (!chat || !chat.unreadCount) return acc;
      return acc + (chat.unreadCount[currentUser.uid] || 0);
    }, 0);
  }, [chats, currentUser]);

  // Active opportunities count
  const activeJobsCount = useMemo(() => {
    return (opportunities || []).filter((o) => o.status === 'active' || o.approvalStatus === 'approved').length;
  }, [opportunities]);

  // Job Board notification badge dismissal tracking (Requirement 3: Clear on Visit)
  const [hasDismissedJobsBadge, setHasDismissedJobsBadge] = useState<boolean>(() => {
    try {
      return localStorage.getItem('scc_jobs_badge_dismissed_v1') === 'true';
    } catch {
      return false;
    }
  });

  // Automatically clear and dismiss jobs notification badge as soon as the user navigates to the Job Board view
  useEffect(() => {
    if (currentModule === 'opportunities' || activeTab === 'opportunities') {
      setHasDismissedJobsBadge(true);
      try {
        localStorage.setItem('scc_jobs_badge_dismissed_v1', 'true');
      } catch {}
    }
  }, [currentModule, activeTab]);

  useEffect(() => {
    const handleJobsViewed = () => {
      setHasDismissedJobsBadge(true);
      try {
        localStorage.setItem('scc_jobs_badge_dismissed_v1', 'true');
      } catch {}
    };
    window.addEventListener('applet:jobs-viewed', handleJobsViewed);
    return () => window.removeEventListener('applet:jobs-viewed', handleJobsViewed);
  }, []);

  const displayJobsBadgeCount = useMemo(() => {
    if (hasDismissedJobsBadge || currentModule === 'opportunities' || activeTab === 'opportunities') {
      return 0;
    }
    return activeJobsCount;
  }, [hasDismissedJobsBadge, currentModule, activeTab, activeJobsCount]);

  // Upcoming events count
  const upcomingEventsCount = useMemo(() => {
    const now = new Date();
    return (events || []).filter((e) => new Date(e.startDate || e.endDate || 0) >= now).length;
  }, [events]);

  // Keyboard shortcut listener: Cmd+K / Ctrl+K opens the global command palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowCommandPalette((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Clean, responsive navigation items (Excludes Alumni Directory for employers per Section 2.5)
  const isEmployer = currentUser?.role === 'employer';
  const mainNavItems = useMemo(() => [
    {
      id: 'dashboard' as AlumniModuleId,
      label: 'Home',
      icon: LayoutDashboard,
      badge: null
    },
    ...(!isEmployer ? [{
      id: 'network' as AlumniModuleId,
      label: 'Alumni Directory',
      icon: Users,
      badge: null
    }] : []),
    {
      id: 'messages' as AlumniModuleId,
      label: 'Messages',
      icon: MessageSquare,
      badge: unreadMessagesCount > 0 ? unreadMessagesCount : null
    },
    {
      id: 'events' as AlumniModuleId,
      label: 'Events & Reunions',
      icon: Calendar,
      badge: upcomingEventsCount > 0 ? upcomingEventsCount : null
    },
    {
      id: 'announcements' as AlumniModuleId,
      label: 'Announcements',
      icon: Megaphone,
      badge: announcements.length > 0 ? announcements.length : null
    },
    {
      id: 'opportunities' as AlumniModuleId,
      label: 'Job Board',
      icon: Briefcase,
      badge: displayJobsBadgeCount > 0 ? displayJobsBadgeCount : null
    },
    {
      id: 'gallery' as AlumniModuleId,
      label: 'Campus Gallery',
      icon: ImageIcon,
      badge: null
    }
  ], [unreadMessagesCount, upcomingEventsCount, announcements.length, displayJobsBadgeCount]);

  const secondaryNavItems = useMemo(() => [
    {
      id: 'settings' as AlumniModuleId,
      label: 'Settings',
      icon: SettingsIcon,
      badge: null
    }
  ], []);

  // Current module label for breadcrumbs
  const currentSectionName = useMemo(() => {
    const all = [...mainNavItems, ...secondaryNavItems];
    const match = all.find((item) => item.id === currentModule);
    return match ? match.label : 'Home';
  }, [currentModule, mainNavItems, secondaryNavItems]);

  // Check if current active module belongs to the secondary/extended set
  const isSecondaryModuleActive = useMemo(() => {
    return ['opportunities', 'announcements', 'gallery', 'profile', 'settings'].includes(currentModule);
  }, [currentModule]);

  // Click-outside listener for profile menu
  useEffect(() => {
    const handleDismiss = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest('[data-profile-dropdown]')) return;
      setShowProfileMenu(false);
    };
    const handleCustomDismiss = () => {
      setShowProfileMenu(false);
    };
    window.addEventListener('click', handleDismiss);
    window.addEventListener('applet:dismiss-hover', handleCustomDismiss);
    return () => {
      window.removeEventListener('click', handleDismiss);
      window.removeEventListener('applet:dismiss-hover', handleCustomDismiss);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#F9FAFB] dark:bg-[#121316] flex flex-col font-sans text-stone-900 dark:text-stone-100 antialiased selection:bg-[#8B181B] selection:text-white">
      {/* ========================================================
          ALUMNI TOP BAR (Matching Admin Workspace Specification)
          ======================================================== */}
      <header className="sticky top-0 z-40 w-full bg-white/95 dark:bg-[#181615]/95 backdrop-blur-md border-b border-stone-200/90 dark:border-stone-800 shadow-2xs pt-safe">
        {/* Institutional St. Cecilia Crimson Accent Line */}
        <div className="h-[2px] w-full bg-[#8B181B] absolute bottom-0 left-0 right-0 pointer-events-none" />

        <div className="w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Zone 1: Institutional Brand Lockup */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Hamburger menu button: toggles mobile drawer on phones & tablets (< lg), toggles sidebar expansion on desktop (>= lg) */}
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                  setShowMobileNav((prev) => !prev);
                } else {
                  setIsSidebarExpanded((prev) => !prev);
                }
              }}
              className="p-2 -ml-1 text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
              aria-label="Toggle navigation"
              title={isSidebarExpanded ? 'Hide sidebar (⌘B)' : 'Show sidebar (⌘B)'}
            >
              <Menu className="w-5 h-5 stroke-[1.75]" />
            </button>

            <div
              onClick={() => handleSelectModule('dashboard')}
              className="flex items-center gap-3 cursor-pointer group"
            >
              <img
                src="/assets/cecilians-seal.jpg"
                alt="St. Cecilia's College Official Seal"
                referrerPolicy="no-referrer"
                className="w-9 h-9 rounded-full object-cover border border-stone-200/80 dark:border-stone-700 shadow-2xs shrink-0 group-hover:scale-105 transition-transform"
              />
              <div className="hidden sm:block">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-sm sm:text-base text-stone-900 dark:text-stone-100 tracking-tight font-sans">
                    St. Cecilia's College
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/60 text-[#8B181B] dark:text-rose-400 border border-rose-200 dark:border-rose-900/60">
                    Alumni Hub
                  </span>
                </div>
                <p className="text-[11px] text-stone-500 dark:text-stone-400 font-medium -mt-0.5">
                  Official Global Alumni Network • Class of {currentUser?.batch || '2023'}
                </p>
              </div>
            </div>
          </div>

          {/* Zone 2: Theme Toggle & Notifications Only */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {/* Universal Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-xl text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer border border-stone-200/80 dark:border-stone-700 shadow-2xs"
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle Theme"
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-amber-400 stroke-[1.75]" />
              ) : (
                <Moon className="w-4 h-4 text-stone-600 dark:text-stone-300 stroke-[1.75]" />
              )}
            </button>

            {/* Notifications Bell with Popover (Header Icon with Unread Counter) */}
            <div className="relative" data-header-dropdown="true">
              <button
                type="button"
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  setShowProfileMenu(false);
                }}
                className={`relative p-2 rounded-xl transition-colors cursor-pointer border ${
                  showNotifications
                    ? 'text-[#8B181B] dark:text-rose-400 bg-red-50 dark:bg-rose-950/50 border-red-200 dark:border-rose-900/60 shadow-2xs'
                    : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 border border-stone-200/80 dark:border-stone-700 shadow-2xs'
                }`}
                aria-label="Notifications"
                title="Notifications"
              >
                <Bell className="w-4 h-4 stroke-[1.75]" />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#8B181B] text-white text-[10px] font-extrabold flex items-center justify-center ring-2 ring-white dark:ring-[#181615] shadow-xs">
                    {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div
                  className="fixed left-3 right-3 top-15 max-h-[calc(100dvh-5rem)] sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96 sm:max-w-none bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-stone-200/90 dark:border-stone-800 z-50 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 dark:border-stone-800 bg-stone-50 dark:bg-stone-850 shrink-0">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-[#8B181B] dark:text-rose-400" />
                      <span className="text-sm font-semibold text-stone-900 dark:text-stone-100">Notifications</span>
                      {unreadNotificationsCount > 0 && (
                        <span className="px-1.5 py-0.5 text-[10px] bg-red-100 dark:bg-rose-950 text-red-700 dark:text-rose-400 font-bold rounded-full">
                          {unreadNotificationsCount} new
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {unreadNotificationsCount > 0 && (
                        <button
                          type="button"
                          onClick={() => markAllNotificationsAsRead()}
                          className="text-xs text-[#8B181B] dark:text-rose-400 hover:underline font-semibold cursor-pointer"
                        >
                          Mark all as read
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowNotifications(false)}
                        className="sm:hidden p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded-lg hover:bg-stone-200/60 dark:hover:bg-stone-700 transition-colors cursor-pointer"
                        aria-label="Close notifications"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="max-h-96 overflow-y-auto divide-y divide-stone-100 dark:divide-stone-800">
                    {userNotifications.length === 0 ? (
                      <div className="p-8 text-center text-stone-400 dark:text-stone-500 text-xs">
                        No notifications yet
                      </div>
                    ) : (
                      userNotifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => {
                            markNotificationAsRead(n.id);
                            setShowNotifications(false);
                            if (n.type === 'message') {
                              handleSelectModule('messages');
                            } else if (n.type === 'announcement' || n.type === 'announcement_broadcast') {
                              handleSelectModule('announcements');
                            } else if (n.type === 'event' || n.type === 'event_broadcast') {
                              handleSelectModule('events');
                            } else if (n.type === 'gallery') {
                              setShowGalleryModal(true);
                            } else if (n.type === 'job') {
                              handleSelectModule('opportunities');
                            } else if (n.type === 'friend_request' || n.type === 'friend_accepted') {
                              handleSelectModule('network');
                              window.dispatchEvent(new CustomEvent('applet:open-network-requests'));
                            }
                          }}
                          className={`p-3.5 transition-colors cursor-pointer ${
                            !n.read ? 'bg-rose-50/40 dark:bg-rose-950/20' : 'hover:bg-stone-50 dark:hover:bg-stone-800/50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="text-xs font-semibold text-stone-900 dark:text-stone-100">{n.title}</div>
                            <span className="text-[10px] text-stone-400 dark:text-stone-500 shrink-0">
                              {new Date(n.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                          <p className="text-xs text-stone-600 dark:text-stone-300 mt-1 leading-relaxed">{n.body}</p>
                          {n.type === 'friend_request' && (
                            <div className="mt-2.5 flex items-center gap-2">
                              {n.actionStatus === 'accepted' || isConnected(n.fromUid || '') || getConnectionStatus(n.fromUid || '') === 'accepted' ? (
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 rounded-md border border-emerald-200 dark:border-emerald-800">
                                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                  <span>Connection Accepted</span>
                                </div>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (n.refId) acceptFriendRequest(n.refId);
                                      markNotificationAsRead(n.id);
                                      showToast('Connection request accepted!');
                                    }}
                                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-white bg-[#8B181B] hover:bg-[#721316] rounded-lg shadow-2xs transition-colors cursor-pointer"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Confirm Request</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSelectModule('network');
                                      window.dispatchEvent(new CustomEvent('applet:open-network-requests'));
                                      setShowNotifications(false);
                                    }}
                                    className="px-2.5 py-1 text-xs font-semibold text-stone-700 dark:text-stone-300 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 rounded-lg transition-colors cursor-pointer"
                                  >
                                    View in Network
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ========================================================
          MAIN WORKSPACE LAYOUT (Collegiate Left Sidebar + Viewport)
          ======================================================== */}
      <div className="flex-1 flex w-full items-start">
        {/* ======================================================
            DESKTOP & TABLET ALUMNI SIDEBAR (VISIBLE BY DEFAULT, TOGGLABLE)
            ====================================================== */}
        <aside
          className={`hidden lg:flex shrink-0 sticky top-16 h-[calc(100dvh-4rem)] flex-col bg-white dark:bg-[#181615] transition-all duration-200 ease-in-out select-none z-30 shadow-[0_1px_3px_rgba(0,0,0,0.02)] ${
            isSidebarExpanded
              ? 'w-60 border-r border-stone-200/80 dark:border-stone-800 opacity-100'
              : 'w-0 overflow-hidden border-r-0 opacity-0 pointer-events-none'
          }`}
        >
          {/* Minimalist Alumnus Identity */}
          <div className="px-3.5 py-3 border-b border-stone-100 dark:border-stone-800/80 flex items-center justify-between gap-2.5">
            <div className="flex items-center min-w-0 gap-2.5">
              <img
                src={getUserAvatar(currentUser?.profilePictureUrl)}
                onError={handleUserAvatarError}
                alt={currentUser?.name}
                referrerPolicy="no-referrer"
                className="w-7 h-7 rounded-full object-cover border border-stone-200 dark:border-stone-700 shrink-0"
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-stone-900 dark:text-stone-100 truncate">{currentUser?.name}</p>
                <div className="flex items-center gap-1.5 -mt-0.5">
                  <span className="text-[10px] text-stone-400 dark:text-stone-500">
                    Batch {currentUser?.batch || '2023'}
                  </span>
                  <span className="w-1 h-1 rounded-full bg-emerald-500" />
                  <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">Verified</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowDigitalPassModal(true)}
              className="p-1.5 rounded-lg text-stone-500 hover:text-[#8B181B] dark:text-stone-400 dark:hover:text-rose-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer shrink-0"
              title="Show Digital Alumni QR Pass"
              aria-label="Digital Pass"
            >
              <QrCode className="w-4 h-4 stroke-[1.75]" />
            </button>
          </div>

          {/* Clean Muted List Scroll Container */}
          <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4 scrollbar-none">
            {/* Group 1: Core Navigation Modules */}
            <div>
              <div className="text-[10px] font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider px-2.5 mb-1.5">
                Core Features
              </div>
              <div className="space-y-0.5">
                {/* 1. Home / Dashboard */}
                <button
                  type="button"
                  onClick={() => handleSelectModule('dashboard')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer group ${
                    currentModule === 'dashboard'
                      ? 'bg-rose-50 dark:bg-rose-950/60 text-[#8B181B] dark:text-rose-400 font-semibold shadow-2xs'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100/70 dark:hover:bg-stone-800/50 font-normal'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <LayoutDashboard className={`w-4 h-4 shrink-0 stroke-[1.6] transition-colors ${
                      currentModule === 'dashboard' ? 'text-[#8B181B] dark:text-rose-400' : 'text-stone-400 group-hover:text-stone-700 dark:group-hover:text-stone-200'
                    }`} />
                    <span className="truncate">Home</span>
                  </div>
                </button>

                {/* 2. Alumni Directory */}
                <button
                  type="button"
                  onClick={() => handleSelectModule('network')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer group ${
                    currentModule === 'network'
                      ? 'bg-rose-50 dark:bg-rose-950/60 text-[#8B181B] dark:text-rose-400 font-semibold shadow-2xs'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100/70 dark:hover:bg-stone-800/50 font-normal'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Users className={`w-4 h-4 shrink-0 stroke-[1.6] transition-colors ${
                      currentModule === 'network' ? 'text-[#8B181B] dark:text-rose-400' : 'text-stone-400 group-hover:text-stone-700 dark:group-hover:text-stone-200'
                    }`} />
                    <span className="truncate">Alumni Directory</span>
                  </div>
                </button>

                {/* 3. Events & Reunions */}
                <button
                  type="button"
                  onClick={() => handleSelectModule('events')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer group ${
                    currentModule === 'events'
                      ? 'bg-rose-50 dark:bg-rose-950/60 text-[#8B181B] dark:text-rose-400 font-semibold shadow-2xs'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100/70 dark:hover:bg-stone-800/50 font-normal'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Calendar className={`w-4 h-4 shrink-0 stroke-[1.6] transition-colors ${
                      currentModule === 'events' ? 'text-[#8B181B] dark:text-rose-400' : 'text-stone-400 group-hover:text-stone-700 dark:group-hover:text-stone-200'
                    }`} />
                    <span className="truncate">Events & Reunions</span>
                  </div>
                  {upcomingEventsCount > 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-mono font-bold">
                      {upcomingEventsCount}
                    </span>
                  )}
                </button>

                {/* 4. Job Board */}
                <button
                  type="button"
                  onClick={() => {
                    setHasDismissedJobsBadge(true);
                    try {
                      localStorage.setItem('scc_jobs_badge_dismissed_v1', 'true');
                    } catch {}
                    handleSelectModule('opportunities');
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer group ${
                    currentModule === 'opportunities'
                      ? 'bg-rose-50 dark:bg-rose-950/60 text-[#8B181B] dark:text-rose-400 font-semibold shadow-2xs'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100/70 dark:hover:bg-stone-800/50 font-normal'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Briefcase className={`w-4 h-4 shrink-0 stroke-[1.6] transition-colors ${
                      currentModule === 'opportunities' ? 'text-[#8B181B] dark:text-rose-400' : 'text-stone-400 group-hover:text-stone-700 dark:group-hover:text-stone-200'
                    }`} />
                    <span className="truncate">Job Board</span>
                  </div>
                  {displayJobsBadgeCount > 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-mono font-bold">
                      {displayJobsBadgeCount}
                    </span>
                  )}
                </button>

                {/* 5. Messages */}
                <button
                  type="button"
                  onClick={() => handleSelectModule('messages')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer group ${
                    currentModule === 'messages'
                      ? 'bg-rose-50 dark:bg-rose-950/60 text-[#8B181B] dark:text-rose-400 font-semibold shadow-2xs'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100/70 dark:hover:bg-stone-800/50 font-normal'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <MessageSquare className={`w-4 h-4 shrink-0 stroke-[1.6] transition-colors ${
                      currentModule === 'messages' ? 'text-[#8B181B] dark:text-rose-400' : 'text-stone-400 group-hover:text-stone-700 dark:group-hover:text-stone-200'
                    }`} />
                    <span className="truncate">Messages</span>
                  </div>
                  {unreadMessagesCount > 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#8B181B] text-white font-mono font-bold">
                      {unreadMessagesCount}
                    </span>
                  )}
                </button>

                {/* 6. Circulars & Memoranda */}
                <button
                  type="button"
                  onClick={() => handleSelectModule('announcements')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer group ${
                    currentModule === 'announcements'
                      ? 'bg-rose-50 dark:bg-rose-950/60 text-[#8B181B] dark:text-rose-400 font-semibold shadow-2xs'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100/70 dark:hover:bg-stone-800/50 font-normal'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Megaphone className={`w-4 h-4 shrink-0 stroke-[1.6] transition-colors ${
                      currentModule === 'announcements' ? 'text-[#8B181B] dark:text-rose-400' : 'text-stone-400 group-hover:text-stone-700 dark:group-hover:text-stone-200'
                    }`} />
                    <span className="truncate">Announcements</span>
                  </div>
                  {announcements.length > 0 && (
                    <span className="text-[10px] text-stone-400 dark:text-stone-500 font-mono">
                      {announcements.length}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Group 2: Institutional Community */}
            <div>
              <div className="text-[10px] font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider px-2.5 mb-1.5">
                Community & Heritage
              </div>
              <div className="space-y-0.5">
                {/* Regional Chapters */}
                <button
                  type="button"
                  onClick={() => setShowChaptersModal(true)}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-normal text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100/70 dark:hover:bg-stone-800/50 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Globe className="w-4 h-4 text-stone-400 group-hover:text-sky-600 dark:group-hover:text-sky-400 shrink-0 stroke-[1.5] transition-colors" />
                    <span className="truncate">Regional Chapters</span>
                  </div>
                  <span className="text-[10px] text-stone-400 dark:text-stone-500 group-hover:text-stone-600 dark:group-hover:text-stone-300">
                    Hub
                  </span>
                </button>

                {/* Campus Archival Gallery */}
                <button
                  type="button"
                  onClick={() => setShowGalleryModal(true)}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-normal text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100/70 dark:hover:bg-stone-800/50 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <ImageIcon className="w-4 h-4 text-stone-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 shrink-0 stroke-[1.5] transition-colors" />
                    <span className="truncate">Campus Life & Gallery</span>
                  </div>
                  <span className="text-[10px] text-stone-400 dark:text-stone-500 group-hover:text-stone-600 dark:group-hover:text-stone-300">
                    Heritage
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Minimalist Footer: Account & Session */}
          <div className="p-2 border-t border-stone-100 dark:border-stone-800/80 space-y-0.5">
            <button
              type="button"
              onClick={() => handleSelectModule('profile')}
              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                currentModule === 'profile'
                  ? 'bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-medium'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100/70 dark:hover:bg-stone-800/50'
              }`}
            >
              <UserIcon className="w-3.5 h-3.5 text-stone-400 stroke-[1.5]" />
              <span className="truncate">Alumni Profile</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectModule('settings')}
              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                currentModule === 'settings'
                  ? 'bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-medium'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100/70 dark:hover:bg-stone-800/50'
              }`}
            >
              <SettingsIcon className="w-3.5 h-3.5 text-stone-400 stroke-[1.5]" />
              <span className="truncate">Settings & Privacy</span>
            </button>

            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('applet:lock-dashboard'))}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs text-stone-600 dark:text-stone-400 hover:text-amber-800 dark:hover:text-amber-300 hover:bg-amber-50/60 dark:hover:bg-amber-950/30 transition-colors cursor-pointer"
              title="Lock dashboard with Face ID"
            >
              <ScanFace className="w-3.5 h-3.5 text-stone-400 stroke-[1.5]" />
              <span className="truncate">Face ID Lock</span>
            </button>

            <button
              type="button"
              onClick={() => setShowLogoutConfirm(true)}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs text-stone-500 dark:text-stone-400 hover:text-red-600 dark:hover:text-rose-400 hover:bg-red-50/60 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 stroke-[1.5]" />
              <span className="truncate">Sign Out</span>
            </button>
          </div>
        </aside>

        {/* ======================================================
            MOBILE NAVIGATION DRAWER & FULL MODULE DIRECTORY
            ====================================================== */}
        <AnimatePresence>
          {showMobileNav && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowMobileNav(false)}
                className="fixed inset-0 bg-stone-950/50 backdrop-blur-xs z-50 md:hidden"
              />
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                className="fixed inset-y-0 left-0 w-80 max-w-[85vw] bg-white dark:bg-[#181615] z-50 md:hidden flex flex-col shadow-2xl border-r border-stone-200/90 dark:border-stone-800"
              >
                {/* Header with College Brand */}
                <div className="p-3.5 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <img
                      src="/assets/cecilians-seal.jpg"
                      alt="St. Cecilia's Seal"
                      referrerPolicy="no-referrer"
                      className="w-7 h-7 rounded-full object-cover ring-1 ring-stone-200 dark:ring-stone-700"
                    />
                    <div>
                      <div className="font-bold text-xs text-stone-900 dark:text-stone-100">St. Cecilia's College</div>
                      <div className="text-[10px] font-semibold text-[#8B181B] dark:text-rose-400">Institutional Services</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowMobileNav(false)}
                    className="p-1 rounded-lg text-stone-400 dark:text-stone-500 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4 stroke-[1.75]" />
                  </button>
                </div>

                {/* Compact Alumnus Identity */}
                <div className="px-3.5 py-3 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between gap-2.5 bg-stone-50/50 dark:bg-stone-900/40">
                  <div className="flex items-center min-w-0 gap-2.5">
                    <img
                      src={getUserAvatar(currentUser?.profilePictureUrl)}
                      onError={handleUserAvatarError}
                      alt={currentUser?.name || 'Alumnus'}
                      referrerPolicy="no-referrer"
                      className="w-8 h-8 rounded-full object-cover border border-stone-200 dark:border-stone-700 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-stone-900 dark:text-stone-100 truncate">{currentUser?.name || 'Alumnus'}</p>
                      <div className="flex items-center gap-1.5 -mt-0.5">
                        <span className="text-[10px] text-stone-400 dark:text-stone-500">
                          Class {currentUser?.batch || '2023'}
                        </span>
                        <span className="w-1 h-1 rounded-full bg-emerald-500" />
                        <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">Verified</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setShowDigitalPassModal(true);
                      setShowMobileNav(false);
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 text-[#8B181B] dark:text-rose-400 text-xs font-semibold hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors cursor-pointer shrink-0"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>Pass</span>
                  </button>
                </div>

                {/* Institutional Services Clean Muted List */}
                <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4">
                  {/* Category: Academic & Diaspora Services */}
                  <div>
                    <div className="text-[10px] font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider px-2 mb-1">
                      Institutional Services
                    </div>
                    <div className="space-y-0.5">
                      {/* 1. Regional Chapters Hub */}
                      <button
                        type="button"
                        onClick={() => {
                          setShowChaptersModal(true);
                          setShowMobileNav(false);
                        }}
                        className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-normal text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100/70 dark:hover:bg-stone-800/50 transition-colors cursor-pointer group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Globe className="w-4 h-4 text-stone-400 group-hover:text-sky-600 dark:group-hover:text-sky-400 shrink-0 stroke-[1.5] transition-colors" />
                          <span className="truncate">Regional Chapters</span>
                        </div>
                        <span className="text-[10px] text-stone-400 dark:text-stone-500 group-hover:text-stone-600 dark:group-hover:text-stone-300">
                          Hub
                        </span>
                      </button>

                      {/* 2. Campus Memory Gallery */}
                      <button
                        type="button"
                        onClick={() => {
                          setShowGalleryModal(true);
                          setShowMobileNav(false);
                        }}
                        className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-normal text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100/70 dark:hover:bg-stone-800/50 transition-colors cursor-pointer group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <ImageIcon className="w-4 h-4 text-stone-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 shrink-0 stroke-[1.5] transition-colors" />
                          <span className="truncate">Campus Life & Gallery</span>
                        </div>
                        <span className="text-[10px] text-stone-400 dark:text-stone-500 group-hover:text-stone-600 dark:group-hover:text-stone-300">
                          Heritage
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Category: Institutional Bulletins */}
                  <div>
                    <div className="text-[10px] font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider px-2 mb-1">
                      Official Bulletins
                    </div>
                    <div className="space-y-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          handleSelectModule('announcements');
                          setShowMobileNav(false);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer group ${
                          currentModule === 'announcements'
                            ? 'bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-medium'
                            : 'text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100/70 dark:hover:bg-stone-800/50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Megaphone className="w-4 h-4 text-stone-400 group-hover:text-stone-700 dark:group-hover:text-stone-200 shrink-0 stroke-[1.5] transition-colors" />
                          <span className="truncate">Circulars & Memoranda</span>
                        </div>
                        {announcements.length > 0 && (
                          <span className="text-[10px] text-stone-400 dark:text-stone-500 font-mono">
                            {announcements.length}
                          </span>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Category: Account & Preferences */}
                  <div>
                    <div className="text-[10px] font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider px-2 mb-1">
                      Account & Security
                    </div>
                    <div className="space-y-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          handleSelectModule('profile');
                          setShowMobileNav(false);
                        }}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
                          currentModule === 'profile'
                            ? 'bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-medium'
                            : 'text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100/70 dark:hover:bg-stone-800/50'
                        }`}
                      >
                        <UserIcon className="w-3.5 h-3.5 text-stone-400 stroke-[1.5]" />
                        <span>Alumni Profile</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          handleSelectModule('settings');
                          setShowMobileNav(false);
                        }}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
                          currentModule === 'settings'
                            ? 'bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-medium'
                            : 'text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100/70 dark:hover:bg-stone-800/50'
                        }`}
                      >
                        <SettingsIcon className="w-3.5 h-3.5 text-stone-400 stroke-[1.5]" />
                        <span>Settings & Privacy</span>
                      </button>

                      {/* Lock App (Face Detection) */}
                      <button
                        type="button"
                        onClick={() => {
                          setShowMobileNav(false);
                          window.dispatchEvent(new CustomEvent('applet:lock-dashboard'));
                        }}
                        className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-stone-700 dark:text-stone-300 hover:text-amber-800 dark:hover:text-amber-300 hover:bg-amber-50/60 dark:hover:bg-amber-950/30 transition-colors cursor-pointer"
                        title="Lock dashboard with Face Detection protection"
                      >
                        <ScanFace className="w-3.5 h-3.5 text-stone-400 stroke-[1.5]" />
                        <span>Lock Dashboard (Face ID)</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Footer with Sign Out */}
                <div className="p-2.5 border-t border-stone-100 dark:border-stone-800">
                  <button
                    type="button"
                    onClick={() => {
                      setShowMobileNav(false);
                      setShowLogoutConfirm(true);
                    }}
                    className="w-full py-2 px-3 text-stone-500 dark:text-stone-400 hover:text-red-600 dark:hover:text-rose-400 hover:bg-red-50/60 dark:hover:bg-rose-950/30 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5 stroke-[1.5]" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Offline Cache Status Pill */}
        {!isOnline && (
          <div className="bg-amber-600/95 text-white text-[11px] font-semibold px-4 py-1.5 flex items-center justify-center gap-2 shadow-xs sticky top-16 z-30 backdrop-blur-xs">
            <WifiOff className="w-3.5 h-3.5 shrink-0" />
            <span>Offline Mode • Viewing Cached Alumni Pass, Directory & Events</span>
          </div>
        )}

        {/* ======================================================
            PRIMARY ALUMNI CONTENT VIEWPORT
            ====================================================== */}
        <main className="flex-1 min-w-0 w-full max-w-full px-3 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-8">
          <div className="w-full max-w-[1760px] 2xl:max-w-[1920px] mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentModule}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.16, ease: 'easeOut' }}
              >
                {/* MODULE: Dashboard Overview (Alumni Hub) */}
                {currentModule === 'dashboard' && <DashboardView />}

                {/* MODULE: Dedicated Notifications Page */}
                {currentModule === 'notifications' && <NotificationsView />}

                {/* MODULE: Alumni Directory & Network */}
                {currentModule === 'network' && (
                  <VerificationGate routeName="Alumni Directory & Networking">
                    <NetworkView />
                  </VerificationGate>
                )}

                {/* MODULE: Direct Peer Messaging */}
                {currentModule === 'messages' && (
                  <VerificationGate routeName="Direct Peer Messaging">
                    <MessagesView />
                  </VerificationGate>
                )}

                {/* MODULE: Campus Reunions & Events */}
                {currentModule === 'events' && (
                  <VerificationGate routeName="Campus Reunions & Official Events">
                    <EventsView />
                  </VerificationGate>
                )}

                {/* MODULE: Institutional Bulletins */}
                {currentModule === 'announcements' && (
                  <VerificationGate routeName="Institutional Announcements">
                    <AnnouncementsView />
                  </VerificationGate>
                )}

                {/* MODULE: Career Opportunities & Jobs */}
                {currentModule === 'opportunities' && (
                  <VerificationGate routeName="Career Opportunities & Job Board">
                    <OpportunitiesView />
                  </VerificationGate>
                )}

                {/* MODULE: Profile & Card */}
                {currentModule === 'profile' && <ProfileView />}

                {/* MODULE: Account Settings */}
                {currentModule === 'settings' && <SettingsView />}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* ======================================================
          CLEAN, BALANCED MOBILE & TABLET BOTTOM BAR NAVIGATION
          - No "More" Button (Requirement 1)
          - Centered "Events" Tab (Requirement 1)
          - Jobs Notification Badge Clears on Visit (Requirement 3)
          ====================================================== */}
      <nav
        aria-label="Mobile Navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#181615]/95 backdrop-blur-md border-t border-stone-200/90 dark:border-stone-800 shadow-[0_-4px_20px_rgba(0,0,0,0.06),0_-1px_3px_rgba(0,0,0,0.02)] px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] transition-colors"
      >
        <div className="flex items-center justify-around max-w-lg mx-auto">
          {/* 1. Home */}
          <button
            type="button"
            onClick={() => {
              handleSelectModule('dashboard');
              window.dispatchEvent(new CustomEvent('applet:reset-dashboard'));
              window.scrollTo({ top: 0, behavior: 'smooth' });
              const mainElem = document.querySelector('main');
              if (mainElem) mainElem.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all duration-200 cursor-pointer min-h-[46px] select-none ${
              currentModule === 'dashboard'
                ? 'text-[#8B181B] dark:text-rose-400 font-bold'
                : 'text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
            }`}
          >
            <div className={`p-1 rounded-lg transition-colors ${currentModule === 'dashboard' ? 'bg-rose-50 dark:bg-rose-950/60 text-[#8B181B] dark:text-rose-400' : ''}`}>
              <LayoutDashboard className="w-5 h-5 stroke-[1.8]" />
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight font-medium">Home</span>
          </button>

          {/* 2. Alumni Directory */}
          <button
            type="button"
            onClick={() => handleSelectModule('network')}
            className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all duration-200 cursor-pointer min-h-[46px] select-none ${
              currentModule === 'network'
                ? 'text-[#8B181B] dark:text-rose-400 font-bold'
                : 'text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
            }`}
          >
            <div className={`p-1 rounded-lg transition-colors ${currentModule === 'network' ? 'bg-rose-50 dark:bg-rose-950/60 text-[#8B181B] dark:text-rose-400' : ''}`}>
              <Users className="w-5 h-5 stroke-[1.8]" />
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight font-medium">Directory</span>
          </button>

          {/* 3. Events (CENTERED TAB IN PRIMARY NAVIGATION BAR) */}
          <button
            type="button"
            onClick={() => handleSelectModule('events')}
            className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all duration-200 cursor-pointer min-h-[46px] select-none relative ${
              currentModule === 'events'
                ? 'text-[#8B181B] dark:text-rose-400 font-bold'
                : 'text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
            }`}
          >
            <div className={`relative p-1 rounded-lg transition-colors ${currentModule === 'events' ? 'bg-rose-50 dark:bg-rose-950/60 text-[#8B181B] dark:text-rose-400' : ''}`}>
              <Calendar className="w-5 h-5 stroke-[1.8]" />
              {upcomingEventsCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-amber-600 text-white text-[9px] font-extrabold flex items-center justify-center ring-2 ring-white dark:ring-[#181615]">
                  {upcomingEventsCount}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight font-bold">Events</span>
          </button>

          {/* 4. Job Board (Notification badge automatically clears on visit) */}
          <button
            type="button"
            onClick={() => {
              setHasDismissedJobsBadge(true);
              try {
                localStorage.setItem('scc_jobs_badge_dismissed_v1', 'true');
              } catch {}
              handleSelectModule('opportunities');
            }}
            className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all duration-200 cursor-pointer min-h-[46px] select-none relative ${
              currentModule === 'opportunities'
                ? 'text-[#8B181B] dark:text-rose-400 font-bold'
                : 'text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
            }`}
          >
            <div className={`relative p-1 rounded-lg transition-colors ${currentModule === 'opportunities' ? 'bg-rose-50 dark:bg-rose-950/60 text-[#8B181B] dark:text-rose-400' : ''}`}>
              <Briefcase className="w-5 h-5 stroke-[1.8]" />
              {displayJobsBadgeCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-emerald-600 text-white text-[9px] font-extrabold flex items-center justify-center ring-2 ring-white dark:ring-[#181615]">
                  {displayJobsBadgeCount}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight font-medium">Jobs</span>
          </button>

          {/* 5. Messages */}
          <button
            type="button"
            onClick={() => handleSelectModule('messages')}
            className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all duration-200 cursor-pointer min-h-[46px] select-none relative ${
              currentModule === 'messages'
                ? 'text-[#8B181B] dark:text-rose-400 font-bold'
                : 'text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
            }`}
          >
            <div className={`relative p-1 rounded-lg transition-colors ${currentModule === 'messages' ? 'bg-rose-50 dark:bg-rose-950/60 text-[#8B181B] dark:text-rose-400' : ''}`}>
              <MessageSquare className="w-5 h-5 stroke-[1.8]" />
              {unreadMessagesCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#8B181B] text-white text-[9px] font-extrabold flex items-center justify-center ring-2 ring-white dark:ring-[#181615]">
                  {unreadMessagesCount > 9 ? '9+' : unreadMessagesCount}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight font-medium">Messages</span>
          </button>
        </div>
      </nav>

      {/* Digital Alumni Pass Modal */}
      {showDigitalPassModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setShowDigitalPassModal(false)}
        >
          <div
            className="max-w-2xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-end mb-2">
              <button
                type="button"
                onClick={() => setShowDigitalPassModal(false)}
                className="p-1.5 rounded-full bg-white/20 text-white hover:bg-white/40 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <DigitalAlumniCard user={currentUser || undefined} />
          </div>
        </div>
      )}

      {/* Campus Heritage Gallery Modal */}
      <CampusGalleryModal
        isOpen={showGalleryModal}
        onClose={() => setShowGalleryModal(false)}
      />

      {/* Regional Alumni Chapters & Diaspora Hub Modal */}
      <AlumniChaptersModal
        isOpen={showChaptersModal}
        onClose={() => setShowChaptersModal(false)}
      />

      {/* Global Command Palette (Cmd+K / Ctrl+K) */}
      <GlobalCommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        onSelectTab={(tab) => handleSelectModule(tab as AlumniModuleId)}
      />

      {/* Log Out Confirmation Dialog */}
      <ConfirmationModal
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={() => {
          setShowLogoutConfirm(false);
          logout();
          if (onOpenAuth) onOpenAuth('login');
        }}
        title="Confirm Log Out"
        message="Are you sure you want to log out of your Cecilian Alumni session? You can sign back in at any time."
        confirmLabel="Log Out"
        variant="danger"
      />
    </div>
  );
};
