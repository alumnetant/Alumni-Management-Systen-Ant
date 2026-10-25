/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  MessageSquare,
  Send,
  Search,
  CheckCheck,
  UserPlus,
  ArrowLeft,
  GraduationCap,
  Sparkles,
  Phone,
  Mail,
  CalendarCheck,
  Users,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  ExternalLink,
  Info,
  X,
  Briefcase,
  Clock,
  ChevronRight,
  ChevronDown,
  Plus,
  Filter,
  Check,
  Building,
  Compass,
  MessageCircle,
  Inbox,
  User,
  PanelRightClose,
  PanelRightOpen,
  BarChart3,
  TrendingUp,
  ArrowRight,
  ShieldAlert,
  Radio,
  Download,
  AlertCircle,
  CloudOff,
  RefreshCw,
  Undo2,
  Trash2,
  Smile,
  MoreVertical
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAlumni } from '../../context/AlumniContext';
import { UserProfile, ChatThread, ChatMessage } from '../../types';
import { EventEmailNotificationInbox } from './EventEmailNotificationInbox';
import { UserRoleBadge } from '../common/UserRoleBadge';
import { getUserAvatar, handleUserAvatarError } from '../../lib/defaultImages';
import { getUserOnlineStatus } from '../../lib/userStatus';

export const MessagesView: React.FC = () => {
  const {
    currentUser,
    users,
    chats,
    messages,
    events,
    sendMessage,
    unsendMessage,
    deleteMessageForMe,
    reactToMessage,
    activeChatId,
    setActiveChatId,
    markChatAsRead,
    getOrCreateChat,
    setSelectedUserIdForModal,
    setActiveTab,
    showToast,
    isOnline,
    isFirestoreSyncing,
    offlineQueueCount,
    offlineQueue,
    syncOfflineMessages,
    retryOfflineMessage,
    cancelOfflineMessage
  } = useAlumni();

  // Top view mode: Active chats vs Event Email Notification Inbox
  const [messageViewMode, setMessageViewMode] = useState<'chats' | 'event_emails'>('chats');

  // Command Center Filter Pill: 'all' | 'direct' | 'events' | 'staff' | 'unread'
  const [activeFilterPill, setActiveFilterPill] = useState<'all' | 'direct' | 'events' | 'staff' | 'unread'>('all');

  // Hero Card Tool: 'spectrum' (messaging distribution) | 'lounges' (event cohorts) | 'directory' (search alumni)
  const [selectedHeroTool, setSelectedHeroTool] = useState<'spectrum' | 'lounges' | 'directory'>('spectrum');

  // Text input in active chat
  const [inputMessage, setInputMessage] = useState('');

  // Search within conversations
  const [chatSearch, setChatSearch] = useState('');

  // Modal & Drawer states
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showDossierDrawer, setShowDossierDrawer] = useState(true);

  // Message Management States: Unsend, Delete, Reactions
  const [activeMessageMenuId, setActiveMessageMenuId] = useState<string | null>(null);
  const [messageToUnsend, setMessageToUnsend] = useState<ChatMessage | null>(null);
  const [messageToDelete, setMessageToDelete] = useState<ChatMessage | null>(null);
  const [inspectingReactionsMessage, setInspectingReactionsMessage] = useState<ChatMessage | null>(null);
  const [reactionDetailTab, setReactionDetailTab] = useState<string>('all');
  const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '👏', '🔥'];

  // Directory filter in zero-state
  const [contactDirectorySearch, setContactDirectorySearch] = useState('');
  const [contactFilter, setContactFilter] = useState<'all' | 'verified' | 'staff' | 'classmates'>('all');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatListScrollRef = useRef<HTMLDivElement>(null);

  // Auto-reset scroll position when returning to Messages page or changing filter
  useEffect(() => {
    if (!activeChatId) {
      if (chatListScrollRef.current) {
        chatListScrollRef.current.scrollTo({ top: 0, behavior: 'instant' });
      }
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [activeChatId, activeFilterPill]);

  // Active chat object - Isolated to currentUser's conversations & institutional lounges
  const activeChat = useMemo(() => {
    if (!activeChatId || !currentUser?.uid) return null;
    const found = chats.find((c) => {
      if (c.id !== activeChatId) return false;
      if (c.isGroupChat || c.isEventChat) return true;
      const members = c.memberIds || (c as any).participants || [];
      return members.includes(currentUser.uid) || members.includes('all');
    });
    return found || null;
  }, [chats, activeChatId, currentUser?.uid]);

  // Recipient user in 1-on-1 direct chat
  const recipientUser = useMemo(() => {
    if (!activeChat || !currentUser || activeChat.isGroupChat || activeChat.isEventChat) return null;
    const otherId = (activeChat.memberIds || (activeChat as any).participants || []).find(
      (id) => id !== currentUser.uid
    );
    return users.find((u) => u.uid === otherId) || null;
  }, [activeChat, currentUser, users]);

  // Associated event for active event group chat
  const activeEvent = useMemo(() => {
    if (!activeChat?.eventId) return null;
    return events.find((e) => e.id === activeChat.eventId) || null;
  }, [activeChat, events]);

  // Group members profile list
  const activeGroupMembers = useMemo(() => {
    if (!activeChat) return [];
    return (activeChat.memberIds || (activeChat as any).participants || [])
      .map((mId) => users.find((u) => u.uid === mId))
      .filter((u): u is UserProfile => Boolean(u));
  }, [activeChat, users]);

  // Current chat messages merged with pending offline queue for this thread (filtering out deleted for current user)
  const activeChatMessages = useMemo(() => {
    if (!activeChat || !currentUser) return [];
    const chatMsgs = (messages[activeChat.id] || []).filter(
      (m) => !m.deletedForUsers?.includes(currentUser.uid)
    );
    const queuedForChat = offlineQueue.filter((q) => q.chatId === activeChat.id);
    if (queuedForChat.length === 0) return chatMsgs;

    // Use a map keyed by message ID to prevent duplicates and reflect dynamic status updates
    const messageMap = new Map<string, ChatMessage>();
    chatMsgs.forEach((m) => messageMap.set(m.id, m));
    queuedForChat.forEach((q) => {
      if (messageMap.has(q.id)) {
        // If message is in both, merge them so that dynamic status ('syncing', 'failed', 'pending') is honored
        messageMap.set(q.id, {
          ...messageMap.get(q.id)!,
          ...q
        });
      } else {
        messageMap.set(q.id, q);
      }
    });

    return Array.from(messageMap.values()).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, [activeChat, messages, offlineQueue, currentUser]);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChatMessages]);

  // Mark active chat as read when opened
  useEffect(() => {
    if (activeChat) {
      markChatAsRead(activeChat.id);
    }
  }, [activeChat?.id]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !activeChat) return;
    sendMessage(activeChat.id, inputMessage.trim());
    setInputMessage('');
  };

  const handleInsertQuickReply = (text: string) => {
    setInputMessage((prev) => (prev ? `${prev} ${text}` : text));
  };

  // Filtered chats list based on activeFilterPill & chatSearch
  const filteredChats = useMemo(() => {
    if (!currentUser?.uid) return [];
    return chats.filter((c) => {
      const isEventOrGroup = c.isGroupChat || c.isEventChat;
      const members = c.memberIds || (c as any).participants || [];
      const isMember = isEventOrGroup || members.includes(currentUser.uid) || members.includes('all');
      if (!isMember) return false;

      const unread = c.unreadCount?.[currentUser.uid] || 0;

      // Filter by pill tab
      if (activeFilterPill === 'direct' && isEventOrGroup) return false;
      if (activeFilterPill === 'events' && !isEventOrGroup) return false;
      if (activeFilterPill === 'unread' && unread === 0) return false;
      if (activeFilterPill === 'staff') {
        if (isEventOrGroup) return false;
        const otherId = members.find((id) => id !== currentUser.uid);
        const other = users.find((u) => u.uid === otherId);
        if (!other || !['admin', 'superadmin', 'registrar', 'staff'].includes(other.role)) {
          return false;
        }
      }

      // Filter by search query
      if (!chatSearch.trim()) return true;
      const q = chatSearch.toLowerCase();

      if (isEventOrGroup) {
        return (
          (c.groupName && c.groupName.toLowerCase().includes(q)) ||
          (c.lastMessage && c.lastMessage.toLowerCase().includes(q))
        );
      }

      const otherId = members.find((id) => id !== currentUser.uid);
      const other = users.find((u) => u.uid === otherId);
      if (!other) return false;
      return (
        other.name.toLowerCase().includes(q) ||
        (c.lastMessage && c.lastMessage.toLowerCase().includes(q))
      );
    }).sort((a, b) => {
      // Requirement 14: Ensure the most recent chat automatically moves to the top of the chat list
      const timeA = new Date(a.lastMessageAt || 0).getTime();
      const timeB = new Date(b.lastMessageAt || 0).getTime();
      return timeB - timeA;
    });
  }, [chats, users, currentUser, activeFilterPill, chatSearch]);

  // Counts for pills
  const chatCounts = useMemo(() => {
    if (!currentUser) return { all: 0, direct: 0, events: 0, staff: 0, unread: 0 };
    const myChats = chats.filter((c) => {
      if (c.isGroupChat || c.isEventChat) return true;
      const members = c.memberIds || (c as any).participants || [];
      return members.includes(currentUser.uid) || members.includes('all');
    });
    const eventsCount = myChats.filter((c) => c.isGroupChat || c.isEventChat).length;
    const directCount = myChats.filter((c) => !c.isGroupChat && !c.isEventChat).length;
    const unreadCount = myChats.filter((c) => (c.unreadCount?.[currentUser.uid] || 0) > 0).length;
    const staffCount = myChats.filter((c) => {
      if (c.isGroupChat || c.isEventChat) return false;
      const otherId = (c.memberIds || []).find((id) => id !== currentUser.uid);
      const other = users.find((u) => u.uid === otherId);
      return other && ['admin', 'superadmin', 'registrar', 'staff'].includes(other.role);
    }).length;

    return { all: myChats.length, direct: directCount, events: eventsCount, staff: staffCount, unread: unreadCount };
  }, [chats, users, currentUser]);

  const totalUnreadCount = chatCounts.unread;

  // Department / Program communication distribution for Bento Tile 2
  const departmentMeters = useMemo(() => {
    const counts: Record<string, number> = {
      CCS: 0,
      CBA: 0,
      COE: 0,
      CAS: 0,
      CTE: 0
    };

    users.forEach((u) => {
      const course = (u.course || '').toLowerCase();
      if (course.includes('information') || course.includes('computer science') || course.includes('it')) counts.CCS++;
      else if (course.includes('business') || course.includes('accountancy') || course.includes('management')) counts.CBA++;
      else if (course.includes('engineering')) counts.COE++;
      else if (course.includes('psychology') || course.includes('arts') || course.includes('science')) counts.CAS++;
      else if (course.includes('education') || course.includes('teacher')) counts.CTE++;
      else counts.CCS++;
    });

    const maxCount = Math.max(...Object.values(counts), 1);
    return [
      { name: 'CCS', fullName: 'Information Technology', count: counts.CCS, value: Math.max(18, Math.round((counts.CCS / maxCount) * 100)) },
      { name: 'CBA', fullName: 'Business Administration', count: counts.CBA, value: Math.max(18, Math.round((counts.CBA / maxCount) * 100)) },
      { name: 'COE', fullName: 'Engineering', count: counts.COE, value: Math.max(18, Math.round((counts.COE / maxCount) * 100)) },
      { name: 'CAS', fullName: 'Arts & Sciences', count: counts.CAS, value: Math.max(18, Math.round((counts.CAS / maxCount) * 100)) },
      { name: 'CTE', fullName: 'Teacher Education', count: counts.CTE, value: Math.max(18, Math.round((counts.CTE / maxCount) * 100)) }
    ];
  }, [users]);

  // Dynamic Spectrum data for hero visualizer
  const messagingSpectrum = useMemo(() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Today'];
    return days.map((day, idx) => {
      const count = Math.max(1, (chatCounts.all * (idx + 1)) % 7 + 2);
      const segments: ('crimson' | 'muted')[] = [];
      const segCount = Math.min(5, Math.max(1, count));
      for (let i = 0; i < segCount; i++) {
        segments.push(i % 2 === 0 ? 'crimson' : 'muted');
      }
      return {
        label: day,
        count,
        segments,
        activeDot: idx === 6 && totalUnreadCount > 0
      };
    });
  }, [chatCounts, totalUnreadCount]);

  // Directory contacts for Zero-State & New Chat Modal
  const directoryContacts = useMemo(() => {
    if (!currentUser) return [];
    return users
      .filter((u) => u.uid !== currentUser.uid)
      .filter((u) => {
        const q = contactDirectorySearch.toLowerCase().trim();
        const matchesSearch =
          !q ||
          u.name.toLowerCase().includes(q) ||
          (u.email || '').toLowerCase().includes(q) ||
          (u.batch || '').toLowerCase().includes(q) ||
          (u.course || '').toLowerCase().includes(q) ||
          (u.company || '').toLowerCase().includes(q);

        let matchesTab = true;
        if (contactFilter === 'staff') {
          matchesTab = ['admin', 'superadmin', 'registrar', 'staff'].includes(u.role);
        } else if (contactFilter === 'classmates') {
          matchesTab = Boolean(currentUser.batch && u.batch === currentUser.batch);
        }

        return matchesSearch && matchesTab;
      });
  }, [users, currentUser, contactDirectorySearch, contactFilter]);

  const handleStartConversationWith = (targetUser: UserProfile) => {
    const threadId = getOrCreateChat(targetUser.uid);
    setActiveChatId(threadId);
    setShowNewChatModal(false);
  };

  // Reusable Single Filter Icon Button with Popup Menu
  const FilterButtonMenu: React.FC<{ align?: 'left' | 'right'; compact?: boolean }> = ({
    align = 'right',
    compact = false
  }) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (!isOpen) return;
      const handleClickOutside = (e: MouseEvent | TouchEvent) => {
        if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
          setIsOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('touchstart', handleClickOutside);
      };
    }, [isOpen]);

    const filterItems = [
      {
        id: 'all' as const,
        label: 'All Transmissions',
        badge: 'All',
        count: chatCounts.all,
        icon: MessageSquare,
        desc: 'All direct messages and event cohorts'
      },
      {
        id: 'direct' as const,
        label: 'Direct Messages',
        badge: 'Direct',
        count: chatCounts.direct,
        icon: User,
        desc: '1-on-1 private peer conversations'
      },
      {
        id: 'events' as const,
        label: 'Events & Lounges',
        badge: 'Events',
        count: chatCounts.events,
        icon: CalendarCheck,
        desc: 'Campus gatherings & attendee group cohorts'
      },
      {
        id: 'staff' as const,
        label: 'Staff & Officers',
        badge: 'Staff & Officers',
        count: chatCounts.staff,
        icon: ShieldCheck,
        desc: 'Alumni coordinators, registrar & administration'
      },
      ...(chatCounts.unread > 0
        ? [
            {
              id: 'unread' as const,
              label: 'Unread Only',
              badge: 'Unread',
              count: chatCounts.unread,
              icon: Clock,
              desc: 'Unread messages requiring your review'
            }
          ]
        : [])
    ];

    const currentItem = filterItems.find((item) => item.id === activeFilterPill) || filterItems[0];

    const handleSelect = (id: 'all' | 'direct' | 'events' | 'staff' | 'unread') => {
      setActiveFilterPill(id);
      setActiveChatId(null);
      setIsOpen(false);
      if (chatListScrollRef.current) {
        chatListScrollRef.current.scrollTo({ top: 0, behavior: 'instant' });
      }
    };

    return (
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className={`group flex items-center gap-1.5 rounded-xl sm:rounded-full text-xs font-semibold transition-all cursor-pointer shadow-2xs active:scale-95 ${
            compact ? 'p-2' : 'px-3.5 py-2'
          } ${
            activeFilterPill !== 'all'
              ? 'bg-[#8B181B] hover:bg-[#721316] text-white border border-[#8B181B]'
              : 'bg-red-50/80 hover:bg-red-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-[#8B181B] dark:text-rose-300 border border-red-200 dark:border-rose-900/60'
          }`}
          aria-label="Filter channels"
          title={`Filter channels: currently ${currentItem.label}`}
        >
          <Filter
            className={`w-3.5 h-3.5 stroke-[2.25] ${
              activeFilterPill !== 'all' ? 'text-white' : 'text-[#8B181B] dark:text-rose-400'
            }`}
          />
          {!compact && (
            <span className="font-semibold tracking-tight">
              {activeFilterPill === 'all' ? 'Filter' : currentItem.badge}
            </span>
          )}
          {activeFilterPill !== 'all' ? (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-300" />
          ) : (
            <ChevronDown
              className={`w-3 h-3 text-[#8B181B]/70 dark:text-rose-400/80 group-hover:text-[#8B181B] dark:group-hover:text-rose-300 transition-transform ${
                isOpen ? 'rotate-180' : ''
              }`}
            />
          )}
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.96 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              style={{
                backgroundColor: 'var(--dm-modal-bg)',
                borderColor: 'var(--dm-modal-border)',
              }}
              className={`absolute top-full mt-2 w-72 rounded-2xl shadow-xl border py-2 z-50 overflow-hidden divide-y divide-[var(--dm-border-subtle)] ${
                align === 'right' ? 'right-0' : 'left-0'
              }`}
            >
              {/* Header */}
              <div
                style={{
                  backgroundColor: 'var(--dm-input-bg)',
                }}
                className="px-3.5 py-2 flex items-center justify-between"
              >
                <div>
                  <span
                    style={{ color: 'var(--dm-text-primary)' }}
                    className="text-[11px] font-bold uppercase tracking-wider block font-sans"
                  >
                    Filter Conversations
                  </span>
                  <span
                    style={{ color: 'var(--dm-text-muted)' }}
                    className="text-[10px]"
                  >
                    Showing {filteredChats.length} of {chatCounts.all} threads
                  </span>
                </div>
                {activeFilterPill !== 'all' && (
                  <button
                    type="button"
                    onClick={() => handleSelect('all')}
                    className="text-[11px] font-bold text-[#8B181B] dark:text-rose-400 hover:underline cursor-pointer"
                  >
                    Reset
                  </button>
                )}
              </div>

              {/* Options List */}
              <div className="p-1 space-y-0.5">
                {filterItems.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = activeFilterPill === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleSelect(opt.id)}
                      style={{
                        backgroundColor: isSelected ? 'rgba(139,24,27,0.1)' : 'transparent',
                        color: isSelected ? 'var(--dm-bubble-sent)' : 'var(--dm-text-primary)',
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between gap-3 transition-colors cursor-pointer hover:bg-[var(--dm-bg-item-hover)]"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            isSelected
                              ? 'bg-[#8B181B] text-white'
                              : 'bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <span
                            style={{ color: 'var(--dm-text-primary)' }}
                            className="block truncate font-bold"
                          >
                            {opt.label}
                          </span>
                          <span
                            style={{ color: 'var(--dm-text-muted)' }}
                            className="block text-[10px] truncate"
                          >
                            {opt.desc}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full ${
                            isSelected
                              ? 'bg-[#8B181B] text-white'
                              : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
                          }`}
                        >
                          {opt.count}
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-[#8B181B] dark:text-rose-400 stroke-[2.5]" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className="w-full space-y-4 antialiased">
      {/* ========================================================================= */}
      {/* MODE 1: EVENT EMAIL BULLETINS                                             */}
      {/* ========================================================================= */}
      {messageViewMode === 'event_emails' ? (
        <div
          style={{
            backgroundColor: 'var(--dm-bg-deck)',
            borderColor: 'var(--dm-border)',
          }}
          className="rounded-[32px] border shadow-2xs overflow-hidden p-6"
        >
          <EventEmailNotificationInbox />
        </div>
      ) : (
        <>
          {/* ===================================================================== */}
          {/* MAIN COMMUNICATIONS DECK (RESPONSIVE CHANNELS & CONVERSATION DECK)     */}
          {/* ===================================================================== */}
          <div
            style={{
              backgroundColor: 'var(--dm-bg-deck)',
              borderColor: 'var(--dm-border)',
            }}
            className="rounded-[24px] sm:rounded-[32px] border shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.03)] overflow-hidden flex flex-col lg:flex-row h-[calc(100dvh-100px)] min-h-[500px]"
          >
            
            {/* LEFT RAIL: CHANNELS STREAM */}
            <div
              style={{
                backgroundColor: 'var(--dm-bg-rail)',
                borderColor: 'var(--dm-border)',
              }}
              className={`w-full lg:w-80 xl:w-96 lg:border-r flex flex-col shrink-0 h-full ${
                activeChatId ? 'hidden lg:flex' : 'flex'
              }`}
            >
              {/* Search Bar & Stream Header */}
              <div
                style={{
                  backgroundColor: 'var(--dm-bg-rail-header)',
                  borderColor: 'var(--dm-border)',
                }}
                className="p-3.5 border-b space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="editorial-kicker">
                    DISPATCH CHANNELS
                  </span>
                  <span
                    style={{ color: 'var(--dm-text-muted)' }}
                    className="text-[11px] font-mono tabular-nums"
                  >
                    {filteredChats.length} showing
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search
                      style={{ color: 'var(--dm-text-muted)' }}
                      className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    />
                    <input
                      type="text"
                      value={chatSearch}
                      onChange={(e) => setChatSearch(e.target.value)}
                      placeholder="Search alumni or event cohort..."
                      style={{
                        backgroundColor: 'var(--dm-input-bg)',
                        borderColor: 'var(--dm-input-border)',
                        color: 'var(--dm-input-text)',
                      }}
                      className="w-full pl-8 pr-7 py-2 text-xs border rounded-xl focus:outline-hidden focus:border-[#8B181B] transition-colors"
                    />
                    {chatSearch && (
                      <button
                        type="button"
                        onClick={() => setChatSearch('')}
                        style={{ color: 'var(--dm-text-muted)' }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 hover:opacity-80 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <FilterButtonMenu align="right" compact />
                </div>

                {/* Active Filter Indicator Pill */}
                {activeFilterPill !== 'all' && (
                  <div className="flex items-center justify-between px-2.5 py-1.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/60 rounded-xl text-xs text-[#8B181B] dark:text-rose-300 animate-in fade-in duration-150">
                    <div className="flex items-center gap-1.5 font-medium truncate">
                      <Filter className="w-3 h-3 text-[#8B181B] dark:text-rose-400 shrink-0" />
                      <span className="truncate">
                        Filter:{' '}
                        <strong className="font-bold">
                          {activeFilterPill === 'direct'
                            ? 'Direct Messages'
                            : activeFilterPill === 'events'
                            ? 'Events & Lounges'
                            : activeFilterPill === 'staff'
                            ? 'Staff & Officers'
                            : 'Unread Only'}
                        </strong>
                      </span>
                      <span className="text-[10px] bg-[#8B181B] text-white px-1.5 py-0.2 rounded-full font-mono font-bold shrink-0">
                        {filteredChats.length}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveFilterPill('all');
                        setActiveChatId(null);
                      }}
                      className="p-0.5 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded text-rose-700 dark:text-rose-400 cursor-pointer transition-colors shrink-0 ml-1"
                      title="Clear filter and show all"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>

              {/* Feed of Chats */}
              <div
                ref={chatListScrollRef}
                style={{
                  backgroundColor: 'var(--dm-bg-rail)',
                }}
                className="flex-1 overflow-y-auto divide-y divide-[var(--dm-border-subtle)]"
              >
                {filteredChats.length === 0 ? (
                  <div className="p-8 text-center space-y-3">
                    <div
                      style={{
                        backgroundColor: 'var(--dm-input-bg)',
                        color: 'var(--dm-text-muted)',
                      }}
                      className="w-10 h-10 rounded-full flex items-center justify-center mx-auto"
                    >
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <p
                      style={{ color: 'var(--dm-text-secondary)' }}
                      className="text-xs leading-relaxed"
                    >
                      No matching conversations found for this filter.
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowNewChatModal(true)}
                      className="px-3.5 py-1.5 bg-[#8B181B] text-white rounded-xl text-xs font-semibold hover:bg-[#721316] transition-colors cursor-pointer"
                    >
                      Start New Conversation
                    </button>
                  </div>
                ) : (
                  filteredChats.map((chat) => {
                    const isSelected = activeChat?.id === chat.id;
                    const unread = currentUser && chat.unreadCount ? chat.unreadCount[currentUser.uid] || 0 : 0;
                    const isEventOrGroup = chat.isGroupChat || chat.isEventChat;

                    if (isEventOrGroup) {
                      return (
                        <div
                          key={chat.id}
                          onClick={() => {
                            setActiveChatId(chat.id);
                            markChatAsRead(chat.id);
                          }}
                          style={{
                            backgroundColor: isSelected ? 'var(--dm-bg-item-active)' : 'transparent',
                            borderLeftColor: isSelected ? 'var(--dm-bubble-sent)' : 'transparent',
                          }}
                          className="p-3.5 flex items-start gap-3 cursor-pointer transition-all border-l-[3px] hover:bg-[var(--dm-bg-item-hover)] active:bg-[var(--dm-bg-item-hover)]"
                        >
                          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#8B181B] via-[#991B1B] to-amber-700 text-white flex items-center justify-center shadow-2xs shrink-0">
                            <CalendarCheck className="w-5 h-5 text-amber-200" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <h3
                                style={{ color: 'var(--dm-text-primary)' }}
                                className="text-xs font-bold truncate"
                              >
                                {chat.groupName || 'Event Cohort Lounge'}
                              </h3>
                              <span
                                style={{ color: 'var(--dm-text-muted)' }}
                                className="text-[10px] font-mono tabular-nums shrink-0"
                              >
                                {new Date(chat.lastMessageAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>

                            <p
                              style={{ color: 'var(--dm-text-secondary)' }}
                              className="text-xs truncate mt-0.5"
                            >
                              {chat.lastMessage || 'Channel established.'}
                            </p>

                            <div className="flex items-center justify-between mt-1.5">
                              <span className="text-[10px] text-[#8B181B] dark:text-rose-400 font-semibold flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                <span>{(chat.memberIds || (chat as any).participants || []).length} Attendees</span>
                              </span>
                              {unread > 0 && (
                                <span className="px-1.5 py-0.2 bg-[#8B181B] text-white rounded-full text-[10px] font-bold">
                                  {unread}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }

                    // 1-on-1 Direct Alumnus Conversation
                    const otherId = (chat.memberIds || []).find((id) => id !== currentUser?.uid);
                    const other = users.find((u) => u.uid === otherId);
                    const otherStatus = getUserOnlineStatus(other);

                    return (
                      <div
                        key={chat.id}
                        onClick={() => {
                          setActiveChatId(chat.id);
                          markChatAsRead(chat.id);
                        }}
                        style={{
                          backgroundColor: isSelected ? 'var(--dm-bg-item-active)' : 'transparent',
                          borderLeftColor: isSelected ? 'var(--dm-bubble-sent)' : 'transparent',
                        }}
                        className={`p-3.5 flex items-start gap-3 cursor-pointer transition-all border-l-[3px] hover:bg-[var(--dm-bg-item-hover)] active:bg-[var(--dm-bg-item-hover)] ${
                          isSelected ? 'bg-rose-50/40 dark:bg-stone-800/60' : ''
                        }`}
                      >
                        <div className="relative shrink-0">
                          <img
                            src={getUserAvatar(other?.profilePictureUrl)}
                            alt={other?.name}
                            onError={handleUserAvatarError}
                            style={{ borderColor: 'var(--dm-border)' }}
                            className="w-10 h-10 rounded-full object-cover border"
                          />
                          <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-stone-900 ${otherStatus.dotColor}`} title={otherStatus.statusLabel} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <h3
                              style={{ color: 'var(--dm-text-primary)' }}
                              className="text-xs font-bold truncate"
                            >
                              {other?.name || 'Cecilian Colleague'}
                            </h3>
                            <span
                              style={{ color: 'var(--dm-text-muted)' }}
                              className="text-[10px] font-mono tabular-nums shrink-0"
                            >
                              {new Date(chat.lastMessageAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>

                          <p
                            style={{
                              color: unread > 0 ? 'var(--dm-text-primary)' : 'var(--dm-text-secondary)',
                              fontWeight: unread > 0 ? 600 : 400,
                            }}
                            className="text-xs truncate mt-0.5"
                          >
                            {chat.lastMessage || 'Direct connection initiated.'}
                          </p>

                          <div className="flex items-center justify-between mt-1 gap-1">
                            <div className="flex items-center gap-1.5 truncate">
                              <span
                                style={{ color: 'var(--dm-text-secondary)' }}
                                className="text-[10px] truncate font-medium"
                              >
                                {other?.batch ? `Batch ${other.batch}` : other?.role ? other.role.toUpperCase() : 'Alumnus'}
                              </span>
                              {other?.isVerified && (
                                <span className="text-[9px] font-bold text-[#8B181B] dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 border border-rose-200/50 dark:border-rose-900/60 px-1 py-0.2 rounded">
                                  Verified
                                </span>
                              )}
                              {otherStatus.isOnline && (
                                <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-1 py-0.2 rounded">
                                  Active
                                </span>
                              )}
                            </div>
                            {unread > 0 && (
                              <span className="px-1.5 py-0.2 bg-[#8B181B] text-white rounded-full text-[10px] font-bold shrink-0">
                                {unread}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Bottom Quick Action */}
              <div
                style={{
                  backgroundColor: 'var(--dm-bg-rail-header)',
                  borderColor: 'var(--dm-border)',
                }}
                className="p-3 border-t"
              >
                <button
                  type="button"
                  onClick={() => setShowNewChatModal(true)}
                  style={{
                    backgroundColor: 'var(--dm-input-bg)',
                    borderColor: 'var(--dm-input-border)',
                    color: 'var(--dm-text-primary)',
                  }}
                  className="w-full py-2 hover:opacity-90 border rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5 text-[#8B181B] dark:text-rose-400" />
                  <span>Browse Alumni Directory</span>
                </button>
              </div>
            </div>

            {/* CENTER & RIGHT: ACTIVE CONVERSATION CANVAS OR DIRECTORY DESK */}
            <div
              style={{
                backgroundColor: 'var(--dm-bg-chat)',
              }}
              className={`flex-1 flex flex-col min-w-0 h-full ${
                !activeChatId ? 'hidden lg:flex' : 'flex'
              }`}
            >
              {activeChat ? (
                <>
                  {/* Active Header */}
                  <div
                    style={{
                      backgroundColor: 'var(--dm-bg-header)',
                      borderColor: 'var(--dm-border)',
                    }}
                    className="p-3 sm:p-4 border-b flex items-center justify-between gap-2.5 shrink-0"
                  >
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      <button
                        type="button"
                        onClick={() => setActiveChatId(null)}
                        style={{
                          color: 'var(--dm-text-primary)',
                          backgroundColor: 'var(--dm-input-bg)',
                          borderColor: 'var(--dm-input-border)',
                        }}
                        className="lg:hidden min-h-[38px] px-2.5 py-1.5 rounded-xl border hover:opacity-90 active:scale-95 transition-all cursor-pointer shrink-0 flex items-center gap-1.5"
                        aria-label="Back to conversations list"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        <span className="text-xs font-semibold hidden sm:inline">Channels</span>
                      </button>

                      {activeChat.isGroupChat || activeChat.isEventChat ? (
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#8B181B] to-amber-700 text-white flex items-center justify-center shadow-2xs shrink-0">
                          <CalendarCheck className="w-5 h-5 text-amber-200" />
                        </div>
                      ) : (
                        <div className="relative shrink-0">
                          <img
                            src={getUserAvatar(recipientUser?.profilePictureUrl)}
                            alt={recipientUser?.name}
                            onError={handleUserAvatarError}
                            onClick={() => recipientUser && setSelectedUserIdForModal(recipientUser.uid)}
                            style={{ borderColor: 'var(--dm-border)' }}
                            className="w-10 h-10 rounded-full object-cover border cursor-pointer"
                          />
                          {(() => {
                            const recipientStatus = getUserOnlineStatus(recipientUser);
                            return (
                              <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ${recipientStatus.dotColor} border-2 border-white dark:border-stone-900 ${recipientStatus.isOnline ? 'animate-pulse' : ''}`} />
                            );
                          })()}
                        </div>
                      )}

                      <div className="min-w-0">
                        {activeChat.isGroupChat || activeChat.isEventChat ? (
                          <>
                            <div className="flex items-center gap-2">
                              <h2
                                style={{ color: 'var(--dm-text-primary)' }}
                                className="text-xs sm:text-sm font-bold truncate"
                              >
                                {activeChat.groupName || 'Event Cohort Lounge'}
                              </h2>
                              <span className="text-[10px] font-semibold text-[#8B181B] dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 border border-rose-200/60 dark:border-rose-900 px-1.5 py-0.2 rounded shrink-0">
                                Event Cohort
                              </span>
                            </div>
                            <p
                              style={{ color: 'var(--dm-text-secondary)' }}
                              className="text-[11px] flex items-center gap-1.5 mt-0.5 truncate"
                            >
                              <Users className="w-3 h-3 opacity-60 shrink-0" />
                              <span>{(activeChat.memberIds || (activeChat as any).participants || []).length} Verified Attendees</span>
                            </p>
                          </>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h2
                                onClick={() => recipientUser && setSelectedUserIdForModal(recipientUser.uid)}
                                style={{ color: 'var(--dm-text-primary)' }}
                                className="editorial-card-title text-sm sm:text-base hover:text-[#8B181B] dark:hover:text-rose-400 transition-colors cursor-pointer truncate"
                              >
                                {recipientUser?.name}
                              </h2>
                              <UserRoleBadge role={recipientUser?.role} size="xs" />
                            </div>
                            {(() => {
                              const recipientStatus = getUserOnlineStatus(recipientUser);
                              const details = [
                                recipientUser?.batch ? `Batch ${recipientUser.batch}` : (recipientUser?.role ? recipientUser.role.toUpperCase() : 'Alumnus'),
                                recipientUser?.course && recipientUser.course !== 'N/A' ? recipientUser.course : null,
                                recipientUser?.company && recipientUser.company !== 'N/A' ? recipientUser.company : null
                              ].filter(Boolean).join(' · ');

                              return (
                                <p
                                  style={{ color: 'var(--dm-text-secondary)' }}
                                  className="text-[11px] truncate mt-0.5 flex items-center gap-1.5"
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${recipientStatus.dotColor} shrink-0`} />
                                  <span className={recipientStatus.isOnline ? 'text-emerald-700 dark:text-emerald-400 font-medium shrink-0' : 'shrink-0'}>
                                    {recipientStatus.statusLabel}
                                  </span>
                                  {details && (
                                    <>
                                      <span>·</span>
                                      <span className="truncate">{details}</span>
                                    </>
                                  )}
                                </p>
                              );
                            })()}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {activeChat.isGroupChat || activeChat.isEventChat ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setShowMembersModal(true)}
                            style={{
                              backgroundColor: 'var(--dm-chip-bg)',
                              borderColor: 'var(--dm-chip-border)',
                              color: 'var(--dm-chip-text)',
                            }}
                            className="px-2.5 py-1.5 border hover:opacity-90 rounded-xl text-xs font-medium flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                          >
                            <Users className="w-3.5 h-3.5 text-[#8B181B] dark:text-rose-400" />
                            <span className="hidden sm:inline">Roster</span>
                          </button>
                          {activeEvent && (
                            <button
                              type="button"
                              onClick={() => setActiveTab('events')}
                              className="px-2.5 py-1.5 bg-[#8B181B]/10 hover:bg-[#8B181B]/20 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 text-[#8B181B] dark:text-rose-300 rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Event Hub</span>
                            </button>
                          )}
                        </>
                      ) : (
                        recipientUser && (
                          <button
                            type="button"
                            onClick={() => setSelectedUserIdForModal(recipientUser.uid)}
                            style={{
                              backgroundColor: 'var(--dm-chip-bg)',
                              borderColor: 'var(--dm-chip-border)',
                              color: 'var(--dm-chip-text)',
                            }}
                            className="px-2.5 py-1.5 border hover:opacity-90 rounded-xl text-xs font-medium flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                          >
                            <User className="w-3.5 h-3.5 text-stone-500 dark:text-stone-400" />
                            <span className="hidden sm:inline">Profile</span>
                          </button>
                        )
                      )}

                      <button
                        type="button"
                        onClick={() => setShowDossierDrawer(!showDossierDrawer)}
                        style={{
                          backgroundColor: showDossierDrawer ? 'var(--dm-bg-item-active)' : 'var(--dm-chip-bg)',
                          borderColor: showDossierDrawer ? 'var(--dm-border)' : 'var(--dm-chip-border)',
                          color: 'var(--dm-text-primary)',
                        }}
                        className="hidden lg:flex p-2 rounded-xl border transition-colors cursor-pointer"
                        title={showDossierDrawer ? 'Hide Profile Panel' : 'Show Profile Panel'}
                      >
                        {showDossierDrawer ? (
                          <PanelRightClose className="w-4 h-4" />
                        ) : (
                          <PanelRightOpen className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Messages Feed + Dossier */}
                  <div
                    style={{ backgroundColor: 'var(--dm-bg-chat)' }}
                    className="flex-1 flex overflow-hidden"
                  >
                    <div
                      style={{ backgroundColor: 'var(--dm-bg-chat)' }}
                      className="flex-1 flex flex-col overflow-hidden"
                    >
                      {/* Message Bubble Feed */}
                      <div className="flex-1 p-4 overflow-y-auto space-y-3.5">
                        <div className="text-center my-2">
                          <span
                            style={{
                              backgroundColor: 'var(--dm-chip-bg)',
                              borderColor: 'var(--dm-chip-border)',
                              color: 'var(--dm-text-secondary)',
                            }}
                            className="px-3 py-1 border rounded-full text-[10px] font-medium"
                          >
                            {activeChat.isGroupChat || activeChat.isEventChat
                              ? 'Official Event Cohort Channel · Institutional Governance Active'
                              : 'End-to-End Cecilian Peer Dispatch'}
                          </span>
                        </div>

                        {activeChatMessages.length === 0 ? (
                          <div className="text-center py-16 space-y-3">
                            <div
                              style={{
                                backgroundColor: 'var(--dm-input-bg)',
                                color: 'var(--dm-text-muted)',
                              }}
                              className="w-12 h-12 rounded-full flex items-center justify-center mx-auto"
                            >
                              <Sparkles className="w-6 h-6 text-amber-500" />
                            </div>
                            <div className="max-w-xs mx-auto space-y-1">
                              <h3
                                style={{ color: 'var(--dm-text-primary)' }}
                                className="text-xs font-bold"
                              >
                                No messages recorded yet
                              </h3>
                              <p
                                style={{ color: 'var(--dm-text-secondary)' }}
                                className="text-[11px]"
                              >
                                Send an institutional greeting or inquiry to initiate exchange.
                              </p>
                            </div>
                          </div>
                        ) : (
                          activeChatMessages.map((msg) => {
                            if (msg.isSystemMessage) {
                              return (
                                <div key={msg.id} className="flex justify-center my-2">
                                  <div className="px-3.5 py-1.5 rounded-xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60 text-[11px] text-amber-950 dark:text-amber-200 flex items-center gap-1.5 shadow-2xs max-w-md text-center">
                                    <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                    <span>{msg.text}</span>
                                  </div>
                                </div>
                              );
                            }

                            const isMine = msg.senderId === currentUser?.uid;
                            const sender = !isMine ? users.find((u) => u.uid === msg.senderId) : null;

                            return (
                              <div
                                key={msg.id}
                                className={`group relative flex flex-col ${isMine ? 'items-end' : 'items-start'} mb-3`}
                                onMouseLeave={() => {
                                  if (activeMessageMenuId === msg.id) setActiveMessageMenuId(null);
                                }}
                              >
                                {!isMine && (
                                  <div className="flex items-center gap-1.5 mb-1 px-1">
                                    {(activeChat.isGroupChat || activeChat.isEventChat) && (
                                      <>
                                        <img
                                          src={getUserAvatar(msg.senderAvatar || sender?.profilePictureUrl)}
                                          alt={msg.senderName || sender?.name}
                                          onError={handleUserAvatarError}
                                          onClick={() => sender && setSelectedUserIdForModal(sender.uid)}
                                          className="w-4 h-4 rounded-full object-cover cursor-pointer"
                                        />
                                        <span
                                          onClick={() => sender && setSelectedUserIdForModal(sender.uid)}
                                          style={{ color: 'var(--dm-text-primary)' }}
                                          className="text-[11px] font-bold hover:text-[#8B181B] dark:hover:text-rose-400 cursor-pointer"
                                        >
                                          {msg.senderName || sender?.name || 'Attendee'}
                                        </span>
                                      </>
                                    )}
                                    <UserRoleBadge role={msg.senderRole || sender?.role} size="xs" />
                                  </div>
                                )}

                                <div className="relative max-w-[85%] sm:max-w-[70%] group/bubble">
                                  {msg.isUnsent ? (
                                    <div
                                      style={{
                                        backgroundColor: 'var(--dm-input-bg)',
                                        borderColor: 'var(--dm-input-border)',
                                        color: 'var(--dm-text-muted)',
                                      }}
                                      className={`px-3.5 py-2 rounded-2xl text-xs sm:text-sm leading-relaxed italic border flex items-center gap-2 ${
                                        isMine ? 'rounded-br-xs' : 'rounded-bl-xs'
                                      }`}
                                    >
                                      <Undo2 className="w-3.5 h-3.5 shrink-0" />
                                      <span>This message was unsent</span>
                                    </div>
                                  ) : (
                                    <>
                                      <div
                                        onClick={() => setActiveMessageMenuId(activeMessageMenuId === msg.id ? null : msg.id)}
                                        style={{
                                          backgroundColor: isMine ? 'var(--dm-bubble-sent)' : 'var(--dm-bubble-received)',
                                          color: isMine ? 'var(--dm-bubble-sent-text)' : 'var(--dm-bubble-received-text)',
                                          borderColor: isMine ? 'rgba(0,0,0,0.2)' : 'var(--dm-bubble-received-border)',
                                        }}
                                        className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed cursor-pointer select-none transition-all border ${
                                          isMine
                                            ? 'rounded-br-xs shadow-[0_2px_8px_rgba(139,24,27,0.25)]'
                                            : 'rounded-bl-xs shadow-2xs'
                                        }`}
                                      >
                                        {msg.text}
                                      </div>

                                      {/* Floating Actions on Hover / Menu for mobile */}
                                      <div
                                        className={`absolute -top-4 flex items-center gap-1 z-20 transition-all duration-150 ${
                                          isMine ? 'right-1' : 'left-1'
                                        } ${
                                          activeMessageMenuId === msg.id
                                            ? 'opacity-100 visible pointer-events-auto'
                                            : 'opacity-0 invisible pointer-events-none group-hover/bubble:opacity-100 group-hover/bubble:visible group-hover/bubble:pointer-events-auto'
                                        }`}
                                      >
                                        {/* Reaction Bar */}
                                        <div
                                          style={{
                                            backgroundColor: 'var(--dm-bg-deck)',
                                            borderColor: 'var(--dm-border)',
                                          }}
                                          className="flex items-center gap-1 p-1 rounded-full shadow-lg border"
                                        >
                                          {QUICK_EMOJIS.map((emoji) => {
                                            const isUserReaction = msg.reactions?.[emoji]?.includes(currentUser.uid);
                                            return (
                                              <button
                                                key={emoji}
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  reactToMessage(activeChat.id, msg.id, emoji);
                                                  setActiveMessageMenuId(null);
                                                }}
                                                className={`w-7 h-7 sm:w-6 sm:h-6 flex items-center justify-center text-sm sm:text-xs hover:scale-125 active:scale-95 transition-transform rounded-full cursor-pointer relative ${
                                                  isUserReaction
                                                    ? 'bg-rose-100 dark:bg-rose-950/80 ring-2 ring-[#8B181B] shadow-2xs'
                                                    : 'hover:bg-stone-100 dark:hover:bg-stone-700'
                                                }`}
                                                title={isUserReaction ? `Remove ${emoji} reaction` : `React with ${emoji}`}
                                              >
                                                {emoji}
                                              </button>
                                            );
                                          })}

                                          {/* More Actions Dropdown Toggle */}
                                          <div className="relative">
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setActiveMessageMenuId(
                                                  activeMessageMenuId === msg.id ? null : msg.id
                                                );
                                              }}
                                              style={{ color: 'var(--dm-text-secondary)' }}
                                              className="w-7 h-7 sm:w-6 sm:h-6 flex items-center justify-center rounded-full hover:bg-[var(--dm-bg-item-hover)] cursor-pointer"
                                              title="Message options"
                                            >
                                              <MoreVertical className="w-3.5 h-3.5" />
                                            </button>

                                            {activeMessageMenuId === msg.id && (
                                              <div
                                                style={{
                                                  backgroundColor: 'var(--dm-modal-bg)',
                                                  borderColor: 'var(--dm-modal-border)',
                                                }}
                                                className={`absolute bottom-full mb-1 ${
                                                  isMine ? 'right-0' : 'left-0'
                                                } w-44 rounded-xl shadow-xl border py-1 z-30 text-xs`}
                                              >
                                                {(isMine ||
                                                  ['admin', 'superadmin', 'moderator'].includes(
                                                    currentUser?.role || ''
                                                  )) && (
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      setMessageToUnsend(msg);
                                                      setActiveMessageMenuId(null);
                                                    }}
                                                    className="w-full px-3 py-2 text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center gap-2 font-semibold cursor-pointer"
                                                  >
                                                    <Undo2 className="w-3.5 h-3.5" />
                                                    <span>Unsend for everyone</span>
                                                  </button>
                                                )}
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setMessageToDelete(msg);
                                                    setActiveMessageMenuId(null);
                                                  }}
                                                  style={{ color: 'var(--dm-text-primary)' }}
                                                  className="w-full px-3 py-2 text-left hover:bg-[var(--dm-bg-item-hover)] flex items-center gap-2 font-medium cursor-pointer"
                                                >
                                                  <Trash2 className="w-3.5 h-3.5 opacity-60" />
                                                  <span>Delete for me</span>
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </>
                                  )}
                                </div>

                                {/* Messenger-Style Message Reactions Display Badge */}
                                {!msg.isUnsent && msg.reactions && Object.keys(msg.reactions).length > 0 && (() => {
                                  const activeEntries = Object.entries(msg.reactions).filter(
                                    ([_, uids]) => Array.isArray(uids) && uids.length > 0
                                  );
                                  if (activeEntries.length === 0) return null;
                                  const totalCount = activeEntries.reduce((sum, [_, uids]) => sum + uids.length, 0);
                                  const myReactionEntry = activeEntries.find(([_, uids]) => uids.includes(currentUser.uid));
                                  const hasMyReaction = !!myReactionEntry;

                                  return (
                                    <div
                                      className={`flex mt-1 px-0.5 ${isMine ? 'justify-end' : 'justify-start'}`}
                                    >
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setInspectingReactionsMessage(msg);
                                          setReactionDetailTab('all');
                                        }}
                                        style={{
                                          backgroundColor: hasMyReaction ? 'rgba(139,24,27,0.1)' : 'var(--dm-chip-bg)',
                                          color: hasMyReaction ? 'var(--dm-bubble-sent)' : 'var(--dm-text-primary)',
                                          borderColor: hasMyReaction ? 'var(--dm-bubble-sent)' : 'var(--dm-chip-border)',
                                        }}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-all cursor-pointer shadow-2xs active:scale-95 select-none"
                                        title="View who reacted"
                                      >
                                        <span className="flex items-center -space-x-1">
                                          {activeEntries.slice(0, 3).map(([em]) => (
                                            <span key={em} className="text-xs leading-none">{em}</span>
                                          ))}
                                        </span>
                                        <span className="text-[10px] font-mono tabular-nums font-bold">
                                          {totalCount}
                                        </span>
                                      </button>
                                    </div>
                                  );
                                })()}

                                <div
                                  style={{ color: 'var(--dm-text-muted)' }}
                                  className="flex items-center gap-1.5 text-[10px] mt-1 px-1 font-mono tabular-nums"
                                >
                                  <span>
                                    {new Date(msg.createdAt).toLocaleTimeString([], {
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </span>
                                  {isMine && !msg.isUnsent && (
                                    <>
                                      {msg.status === 'syncing' ? (
                                        <span className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400 font-sans font-medium text-[10px]">
                                          <RefreshCw className="w-3 h-3 animate-spin text-sky-500" />
                                          <span>Syncing...</span>
                                        </span>
                                      ) : msg.status === 'failed' ? (
                                        <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 font-sans font-medium text-[10px]">
                                          <AlertCircle className="w-3 h-3 text-red-500" />
                                          <span>Failed</span>
                                          <button
                                            type="button"
                                            onClick={() => retryOfflineMessage(msg.id)}
                                            className="underline ml-0.5 hover:text-red-700 dark:hover:text-red-300 font-semibold cursor-pointer"
                                          >
                                            Retry
                                          </button>
                                        </span>
                                      ) : msg.status === 'pending' || msg.status === 'queued' || (msg as any).offlineQueued ? (
                                        <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-sans font-medium text-[10px]">
                                          <Clock className="w-3 h-3 text-amber-500 animate-pulse" />
                                          <span>{!isOnline ? 'Queued offline' : 'Pending'}</span>
                                        </span>
                                      ) : msg.status === 'sending' && (Date.now() - new Date(msg.createdAt).getTime() < 1800) ? (
                                        <span className="inline-flex items-center gap-1 font-sans text-[10px] opacity-70">
                                          <Clock className="w-3 h-3 animate-spin" />
                                          <span>Sending...</span>
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 font-sans text-[10px] opacity-70">
                                          <CheckCheck className="w-3.5 h-3.5" />
                                          <span>Sent</span>
                                        </span>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                        <div ref={messagesEndRef} />
                      </div>

                      {/* Quick Response Prompt Suggestions */}
                      <div
                        style={{
                          backgroundColor: 'var(--dm-bg-header)',
                          borderColor: 'var(--dm-border)',
                        }}
                        className="px-3.5 py-1.5 border-t flex items-center gap-1.5 overflow-x-auto scrollbar-none"
                      >
                        <span
                          style={{ color: 'var(--dm-text-muted)' }}
                          className="text-[10px] font-semibold uppercase tracking-wider shrink-0 flex items-center gap-1"
                        >
                          <Sparkles className="w-3 h-3 text-amber-500" />
                          <span>Prompt:</span>
                        </span>
                        {[
                          '👋 Greetings fellow Cecilian!',
                          '🎓 Are you attending the next campus homecoming?',
                          '🎉 Congratulations on your career advancement!',
                          '💼 Would love to connect regarding opportunities.'
                        ].map((prompt, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleInsertQuickReply(prompt)}
                            style={{
                              backgroundColor: 'var(--dm-chip-bg)',
                              borderColor: 'var(--dm-chip-border)',
                              color: 'var(--dm-chip-text)',
                            }}
                            className="px-2.5 py-1 rounded-full border hover:opacity-80 text-[11px] whitespace-nowrap cursor-pointer transition-colors shadow-2xs"
                          >
                            {prompt}
                          </button>
                        ))}
                      </div>

                      {/* Offline Status & Pending Queue Banner */}
                      {(!isOnline || offlineQueueCount > 0) && (
                        <div className="px-3.5 py-2 bg-amber-50/95 dark:bg-amber-950/40 border-t border-amber-200/90 dark:border-amber-900/60 flex items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={`w-2 h-2 rounded-full ${!isOnline ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'} shrink-0`} />
                            <span className="text-amber-950 dark:text-amber-200 font-medium text-[11px] truncate">
                              {!isOnline
                                ? `Offline mode · ${offlineQueueCount} message${offlineQueueCount === 1 ? '' : 's'} queued to send on reconnect`
                                : isFirestoreSyncing
                                ? `Synchronizing ${offlineQueueCount} message${offlineQueueCount === 1 ? '' : 's'} to Cloud...`
                                : `${offlineQueueCount} offline message${offlineQueueCount === 1 ? '' : 's'} ready to synchronize`}
                            </span>
                          </div>
                          {offlineQueueCount > 0 && isOnline && (
                            <button
                              type="button"
                              disabled={isFirestoreSyncing}
                              onClick={() => syncOfflineMessages()}
                              className="px-2.5 py-1 bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white text-[11px] font-semibold rounded-lg shadow-2xs transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
                            >
                              <RefreshCw className={`w-3 h-3 ${isFirestoreSyncing ? 'animate-spin' : ''}`} />
                              <span>{isFirestoreSyncing ? 'Syncing...' : 'Sync Now'}</span>
                            </button>
                          )}
                        </div>
                      )}

                      {/* Input Composer Form */}
                      <form
                        onSubmit={handleSend}
                        style={{
                          backgroundColor: 'var(--dm-bg-footer)',
                          borderColor: 'var(--dm-border)',
                        }}
                        className="p-3 sm:p-3.5 border-t flex items-center gap-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
                      >
                        <input
                          type="text"
                          value={inputMessage}
                          onChange={(e) => setInputMessage(e.target.value)}
                          placeholder={
                            !isOnline
                              ? 'Type message (offline)...'
                              : activeChat.isGroupChat || activeChat.isEventChat
                              ? `Message ${activeChat.groupName || 'group'}...`
                              : `Message ${recipientUser?.name || 'alumnus'}...`
                          }
                          style={{
                            backgroundColor: 'var(--dm-input-bg)',
                            borderColor: 'var(--dm-input-border)',
                            color: 'var(--dm-input-text)',
                          }}
                          className="flex-1 px-4 py-2.5 min-h-[44px] text-xs sm:text-sm border rounded-xl focus:outline-hidden focus:border-[#8B181B] transition-colors"
                        />
                        <button
                          type="submit"
                          disabled={!inputMessage.trim()}
                          className="min-w-[44px] min-h-[44px] p-2.5 bg-[#8B181B] hover:bg-[#721316] disabled:opacity-40 text-white rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center shrink-0"
                          aria-label="Send message"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      </form>
                    </div>

                  {/* Right Profile Rail (Collapsible) */}
                  {showDossierDrawer && (
                    <div
                      style={{
                        backgroundColor: 'var(--dm-dossier-bg)',
                        borderColor: 'var(--dm-border)',
                      }}
                      className="hidden lg:flex w-72 border-l flex-col p-4 space-y-4 overflow-y-auto shrink-0"
                    >
                      {activeChat.isGroupChat || activeChat.isEventChat ? (
                        <div className="space-y-4">
                          <div
                            style={{ borderColor: 'var(--dm-border)' }}
                            className="text-center space-y-2 pb-4 border-b"
                          >
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#8B181B] to-amber-700 text-white flex items-center justify-center mx-auto shadow-sm">
                              <CalendarCheck className="w-7 h-7 text-amber-200" />
                            </div>
                            <h3
                              style={{ color: 'var(--dm-text-primary)' }}
                              className="text-xs font-bold"
                            >
                              {activeChat.groupName || 'Event Group'}
                            </h3>
                            <span
                              style={{ color: 'var(--dm-text-muted)' }}
                              className="text-[10px] font-mono"
                            >
                              Event Group Chat
                            </span>
                          </div>

                          {activeEvent && (
                            <div
                              style={{
                                backgroundColor: 'var(--dm-card-bg)',
                                borderColor: 'var(--dm-card-border)',
                              }}
                              className="p-3 rounded-xl border space-y-2 text-xs"
                            >
                              <div
                                style={{ color: 'var(--dm-text-muted)' }}
                                className="text-[10px] font-bold uppercase tracking-wider"
                              >
                                Event Details
                              </div>
                              <div
                                style={{ color: 'var(--dm-text-secondary)' }}
                                className="space-y-1 text-[11px]"
                              >
                                <div><strong>Date:</strong> {activeEvent.date}</div>
                                <div><strong>Venue:</strong> {activeEvent.location || 'SCC Campus'}</div>
                              </div>
                            </div>
                          )}

                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span
                                style={{ color: 'var(--dm-text-primary)' }}
                                className="font-bold"
                              >
                                Attendees
                              </span>
                              <span
                                style={{ color: 'var(--dm-text-muted)' }}
                                className="font-mono text-[10px]"
                              >
                                {activeGroupMembers.length} verified
                              </span>
                            </div>
                            <div className="space-y-1.5 max-h-64 overflow-y-auto">
                              {activeGroupMembers.map((member) => (
                                <div
                                  key={member.uid}
                                  onClick={() => setSelectedUserIdForModal(member.uid)}
                                  style={{
                                    backgroundColor: 'var(--dm-card-bg)',
                                    borderColor: 'var(--dm-card-border)',
                                  }}
                                  className="p-2 rounded-lg border hover:border-[#8B181B]/40 flex items-center gap-2 cursor-pointer transition-colors"
                                >
                                  <img
                                    src={getUserAvatar(member.profilePictureUrl)}
                                    alt={member.name}
                                    onError={handleUserAvatarError}
                                    style={{ borderColor: 'var(--dm-border)' }}
                                    className="w-7 h-7 rounded-full object-cover border"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div
                                      style={{ color: 'var(--dm-text-primary)' }}
                                      className="text-[11px] font-semibold truncate"
                                    >
                                      {member.name}
                                    </div>
                                    <div
                                      style={{ color: 'var(--dm-text-muted)' }}
                                      className="text-[10px] truncate"
                                    >
                                      {member.batch ? `Batch ${member.batch}` : member.role}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        recipientUser && (
                          <div className="space-y-4">
                            <div
                              style={{ borderColor: 'var(--dm-border)' }}
                              className="text-center space-y-2 pb-4 border-b"
                            >
                              <img
                                src={getUserAvatar(recipientUser.profilePictureUrl)}
                                alt={recipientUser.name}
                                onError={handleUserAvatarError}
                                style={{ borderColor: 'var(--dm-border)' }}
                                className="w-16 h-16 rounded-full object-cover mx-auto border-2 shadow-sm"
                              />
                              <div>
                                <h3
                                  style={{ color: 'var(--dm-text-primary)' }}
                                  className="text-xs font-bold"
                                >
                                  {recipientUser.name}
                                </h3>
                                <div className="mt-1">
                                  <UserRoleBadge role={recipientUser.role} size="xs" />
                                </div>
                              </div>
                            </div>

                            <div
                              style={{
                                backgroundColor: 'var(--dm-card-bg)',
                                borderColor: 'var(--dm-card-border)',
                              }}
                              className="p-3 rounded-xl border space-y-2 text-xs"
                            >
                              <div
                                style={{ color: 'var(--dm-text-muted)' }}
                                className="text-[10px] font-bold uppercase tracking-wider"
                              >
                                Academic Pedigree
                              </div>
                              <div
                                style={{ color: 'var(--dm-text-secondary)' }}
                                className="space-y-1 text-[11px]"
                              >
                                {recipientUser.batch && (
                                  <div><strong>Batch:</strong> Class of {recipientUser.batch}</div>
                                )}
                                {recipientUser.course && (
                                  <div><strong>Program:</strong> {recipientUser.course}</div>
                                )}
                              </div>
                            </div>

                            {(recipientUser.company || recipientUser.currentPosition) && (
                              <div
                                style={{
                                  backgroundColor: 'var(--dm-card-bg)',
                                  borderColor: 'var(--dm-card-border)',
                                }}
                                className="p-3 rounded-xl border space-y-2 text-xs"
                              >
                                <div
                                  style={{ color: 'var(--dm-text-muted)' }}
                                  className="text-[10px] font-bold uppercase tracking-wider"
                                >
                                  Current Career
                                </div>
                                <div
                                  style={{ color: 'var(--dm-text-secondary)' }}
                                  className="space-y-1 text-[11px]"
                                >
                                  {recipientUser.currentPosition && (
                                    <div><strong>Role:</strong> {recipientUser.currentPosition}</div>
                                  )}
                                  {recipientUser.company && (
                                    <div><strong>Company:</strong> {recipientUser.company}</div>
                                  )}
                                </div>
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={() => setSelectedUserIdForModal(recipientUser.uid)}
                              style={{
                                backgroundColor: 'var(--dm-input-bg)',
                                borderColor: 'var(--dm-input-border)',
                                color: 'var(--dm-text-primary)',
                              }}
                              className="w-full py-2 hover:opacity-90 border rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                            >
                              Inspect Public Profile
                            </button>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* ZERO-STATE: ALUMNI DISPATCH DIRECTORY DESK */
              <div
                style={{ backgroundColor: 'var(--dm-bg-chat)' }}
                className="flex-1 p-4 sm:p-5 lg:p-6 overflow-y-auto space-y-4"
              >
                <div className="w-full space-y-4">
                  {/* Filter & Search Bar */}
                  <div
                    style={{
                      backgroundColor: 'var(--dm-card-bg)',
                      borderColor: 'var(--dm-card-border)',
                    }}
                    className="p-3 sm:p-3.5 rounded-2xl border shadow-2xs"
                  >
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                      <div className="relative flex-1">
                        <Search
                          style={{ color: 'var(--dm-text-muted)' }}
                          className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                        />
                        <input
                          type="text"
                          value={contactDirectorySearch}
                          onChange={(e) => setContactDirectorySearch(e.target.value)}
                          placeholder="Search alumni by name, course, batch, or company..."
                          style={{
                            backgroundColor: 'var(--dm-input-bg)',
                            borderColor: 'var(--dm-input-border)',
                            color: 'var(--dm-input-text)',
                          }}
                          className="w-full pl-9 pr-8 py-2 text-xs border rounded-xl focus:outline-hidden focus:border-[#8B181B] transition-colors"
                        />
                      </div>

                      <div
                        style={{ backgroundColor: 'var(--dm-input-bg)' }}
                        className="flex items-center gap-1 p-0.5 rounded-xl text-xs shrink-0"
                      >
                        <button
                          type="button"
                          onClick={() => setContactFilter('all')}
                          style={{
                            backgroundColor: contactFilter === 'all' ? 'var(--dm-card-bg)' : 'transparent',
                            color: contactFilter === 'all' ? 'var(--dm-text-primary)' : 'var(--dm-text-secondary)',
                          }}
                          className="px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer shadow-2xs"
                        >
                          All ({users.length - 1})
                        </button>
                        <button
                          type="button"
                          onClick={() => setContactFilter('staff')}
                          style={{
                            backgroundColor: contactFilter === 'staff' ? 'var(--dm-card-bg)' : 'transparent',
                            color: contactFilter === 'staff' ? 'var(--dm-text-primary)' : 'var(--dm-text-secondary)',
                          }}
                          className="px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer shadow-2xs"
                        >
                          Staff & Officers
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Directory Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-3">
                    {directoryContacts.map((contact) => (
                      <div
                        key={contact.uid}
                        style={{
                          backgroundColor: 'var(--dm-card-bg)',
                          borderColor: 'var(--dm-card-border)',
                        }}
                        className="p-4 rounded-2xl border shadow-2xs flex flex-col justify-between space-y-3 hover:border-[#8B181B]/40 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <img
                            src={getUserAvatar(contact.profilePictureUrl)}
                            alt={contact.name}
                            onError={handleUserAvatarError}
                            style={{ borderColor: 'var(--dm-border)' }}
                            className="w-10 h-10 rounded-full object-cover border shrink-0"
                          />
                          <div className="min-w-0">
                            <h4
                              style={{ color: 'var(--dm-text-primary)' }}
                              className="text-xs font-bold truncate"
                            >
                              {contact.name}
                            </h4>
                            <p
                              style={{ color: 'var(--dm-text-secondary)' }}
                              className="text-[11px] truncate mt-0.5"
                            >
                              {contact.batch ? `Class of ${contact.batch}` : contact.role}
                              {contact.course ? ` · ${contact.course}` : ''}
                            </p>
                            {contact.company && (
                              <p
                                style={{ color: 'var(--dm-text-muted)' }}
                                className="text-[10px] truncate"
                              >
                                {contact.currentPosition ? `${contact.currentPosition} at ` : ''}{contact.company}
                              </p>
                            )}
                          </div>
                        </div>

                        <div
                          style={{ borderColor: 'var(--dm-border-subtle)' }}
                          className="pt-2 border-t flex items-center justify-between"
                        >
                          <UserRoleBadge role={contact.role} size="xs" />
                          <button
                            type="button"
                            onClick={() => handleStartConversationWith(contact)}
                            className="px-3 py-1 bg-[#8B181B] hover:bg-[#721316] text-white rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Send className="w-3 h-3" />
                            <span>Dispatch</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </>
    )}

      {/* ========================================================================= */}
      {/* NEW DISPATCH MODAL                                                        */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {showNewChatModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{
                backgroundColor: 'var(--dm-modal-bg)',
                borderColor: 'var(--dm-modal-border)',
              }}
              className="rounded-3xl border max-w-lg w-full p-6 shadow-2xl space-y-4"
            >
              <div
                style={{ borderColor: 'var(--dm-border)' }}
                className="flex items-center justify-between pb-3 border-b"
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#8B181B]/10 dark:bg-rose-950/50 text-[#8B181B] dark:text-rose-400 flex items-center justify-center">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <div>
                    <h3
                      style={{ color: 'var(--dm-text-primary)' }}
                      className="text-sm font-bold"
                    >
                      Initiate Peer Dispatch
                    </h3>
                    <p
                      style={{ color: 'var(--dm-text-secondary)' }}
                      className="text-[11px]"
                    >
                      Select an alumnus to start a direct line
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowNewChatModal(false)}
                  style={{ color: 'var(--dm-text-muted)' }}
                  className="p-1 rounded-full hover:bg-[var(--dm-bg-item-hover)] transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="relative">
                <Search
                  style={{ color: 'var(--dm-text-muted)' }}
                  className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                />
                <input
                  type="text"
                  value={contactDirectorySearch}
                  onChange={(e) => setContactDirectorySearch(e.target.value)}
                  placeholder="Search by name, program, batch..."
                  style={{
                    backgroundColor: 'var(--dm-input-bg)',
                    borderColor: 'var(--dm-input-border)',
                    color: 'var(--dm-input-text)',
                  }}
                  className="w-full pl-9 pr-3 py-2 text-xs border rounded-xl focus:outline-hidden focus:border-[#8B181B] transition-colors"
                />
              </div>

              <div className="max-h-72 overflow-y-auto space-y-2 divide-y divide-[var(--dm-border-subtle)]">
                {directoryContacts.map((contact) => (
                  <div
                    key={contact.uid}
                    onClick={() => handleStartConversationWith(contact)}
                    className="pt-2 flex items-center justify-between p-2 rounded-xl hover:bg-[var(--dm-bg-item-hover)] cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={getUserAvatar(contact.profilePictureUrl)}
                        alt={contact.name}
                        onError={handleUserAvatarError}
                        style={{ borderColor: 'var(--dm-border)' }}
                        className="w-8 h-8 rounded-full object-cover shrink-0 border"
                      />
                      <div className="min-w-0">
                        <div
                          style={{ color: 'var(--dm-text-primary)' }}
                          className="text-xs font-bold truncate"
                        >
                          {contact.name}
                        </div>
                        <div
                          style={{ color: 'var(--dm-text-secondary)' }}
                          className="text-[11px] truncate"
                        >
                          {contact.batch ? `Batch ${contact.batch}` : contact.role} · {contact.course || 'Cecilian'}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="px-2.5 py-1 bg-[#8B181B] hover:bg-[#721316] text-white rounded-lg text-[10px] font-semibold shrink-0 cursor-pointer transition-colors"
                    >
                      Connect
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* GROUP MEMBERS ROSTER MODAL                                                */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {showMembersModal && activeChat && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{
                backgroundColor: 'var(--dm-modal-bg)',
                borderColor: 'var(--dm-modal-border)',
              }}
              className="rounded-3xl border max-w-md w-full p-6 shadow-2xl space-y-4"
            >
              <div
                style={{ borderColor: 'var(--dm-border)' }}
                className="flex items-center justify-between pb-3 border-b"
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h3
                      style={{ color: 'var(--dm-text-primary)' }}
                      className="text-sm font-bold"
                    >
                      Event Attendee List
                    </h3>
                    <p
                      style={{ color: 'var(--dm-text-secondary)' }}
                      className="text-[11px]"
                    >
                      {activeGroupMembers.length} verified attendees
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMembersModal(false)}
                  style={{ color: 'var(--dm-text-muted)' }}
                  className="p-1 rounded-full hover:bg-[var(--dm-bg-item-hover)] transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="max-h-80 overflow-y-auto space-y-2">
                {activeGroupMembers.map((member) => (
                  <div
                    key={member.uid}
                    onClick={() => {
                      setSelectedUserIdForModal(member.uid);
                      setShowMembersModal(false);
                    }}
                    style={{
                      backgroundColor: 'var(--dm-card-bg)',
                      borderColor: 'var(--dm-card-border)',
                    }}
                    className="p-2.5 rounded-xl border hover:opacity-90 flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={getUserAvatar(member.profilePictureUrl)}
                        alt={member.name}
                        onError={handleUserAvatarError}
                        style={{ borderColor: 'var(--dm-border)' }}
                        className="w-8 h-8 rounded-full object-cover shrink-0 border"
                      />
                      <div className="min-w-0">
                        <div
                          style={{ color: 'var(--dm-text-primary)' }}
                          className="text-xs font-bold truncate"
                        >
                          {member.name}
                        </div>
                        <div
                          style={{ color: 'var(--dm-text-secondary)' }}
                          className="text-[11px] truncate"
                        >
                          {member.batch ? `Batch ${member.batch}` : member.role} · {member.course || 'Cecilian'}
                        </div>
                      </div>
                    </div>
                    <UserRoleBadge role={member.role} size="xs" />
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* UNSEND MESSAGE CONFIRMATION MODAL (For Everyone)                           */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {messageToUnsend && activeChat && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{
                backgroundColor: 'var(--dm-modal-bg)',
                borderColor: 'var(--dm-modal-border)',
              }}
              className="rounded-3xl border max-w-sm w-full p-6 shadow-2xl space-y-4"
            >
              <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-rose-950/50 text-red-700 dark:text-rose-400 flex items-center justify-center mx-auto">
                <Undo2 className="w-6 h-6 text-[#8B181B] dark:text-rose-400" />
              </div>

              <div className="text-center space-y-1.5">
                <h3
                  style={{ color: 'var(--dm-text-primary)' }}
                  className="text-base font-bold"
                >
                  Unsend Message for Everyone?
                </h3>
                <p
                  style={{ color: 'var(--dm-text-secondary)' }}
                  className="text-xs leading-relaxed"
                >
                  This will remove this message from the conversation for all participants. An institutional notice that the dispatch was unsent will be displayed.
                </p>
              </div>

              <div
                style={{
                  backgroundColor: 'var(--dm-input-bg)',
                  borderColor: 'var(--dm-input-border)',
                  color: 'var(--dm-text-secondary)',
                }}
                className="p-3 border rounded-xl text-xs italic line-clamp-2"
              >
                "{messageToUnsend.text}"
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setMessageToUnsend(null)}
                  style={{
                    borderColor: 'var(--dm-input-border)',
                    color: 'var(--dm-text-secondary)',
                  }}
                  className="flex-1 py-2.5 px-4 rounded-xl border text-xs font-semibold hover:bg-[var(--dm-bg-item-hover)] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    unsendMessage(activeChat.id, messageToUnsend.id);
                    setMessageToUnsend(null);
                  }}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-[#8B181B] hover:bg-[#721316] text-white text-xs font-bold transition-colors shadow-2xs cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Undo2 className="w-4 h-4" />
                  <span>Unsend</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* DELETE MESSAGE CONFIRMATION MODAL (For Me Only)                            */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {messageToDelete && activeChat && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{
                backgroundColor: 'var(--dm-modal-bg)',
                borderColor: 'var(--dm-modal-border)',
              }}
              className="rounded-3xl border max-w-sm w-full p-6 shadow-2xl space-y-4"
            >
              <div
                style={{
                  backgroundColor: 'var(--dm-input-bg)',
                  color: 'var(--dm-text-secondary)',
                }}
                className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto"
              >
                <Trash2 className="w-6 h-6 opacity-75" />
              </div>

              <div className="text-center space-y-1.5">
                <h3
                  style={{ color: 'var(--dm-text-primary)' }}
                  className="text-base font-bold"
                >
                  Delete Message for Yourself?
                </h3>
                <p
                  style={{ color: 'var(--dm-text-secondary)' }}
                  className="text-xs leading-relaxed"
                >
                  This message will be removed from your personal conversation view. Other participants in this thread will still be able to see it.
                </p>
              </div>

              <div
                style={{
                  backgroundColor: 'var(--dm-input-bg)',
                  borderColor: 'var(--dm-input-border)',
                  color: 'var(--dm-text-secondary)',
                }}
                className="p-3 border rounded-xl text-xs italic line-clamp-2"
              >
                "{messageToDelete.text}"
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setMessageToDelete(null)}
                  style={{
                    borderColor: 'var(--dm-input-border)',
                    color: 'var(--dm-text-secondary)',
                  }}
                  className="flex-1 py-2.5 px-4 rounded-xl border text-xs font-semibold hover:bg-[var(--dm-bg-item-hover)] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    deleteMessageForMe(activeChat.id, messageToDelete.id);
                    setMessageToDelete(null);
                  }}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-stone-900 hover:bg-stone-950 dark:bg-stone-800 dark:hover:bg-stone-750 text-white text-xs font-bold transition-colors shadow-2xs cursor-pointer flex items-center justify-center gap-1.5 border dark:border-stone-700"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete for Me</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Messenger-Style Message Reactions Detail Breakdown Modal */}
      <AnimatePresence>
        {inspectingReactionsMessage && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 dark:bg-black/80 backdrop-blur-xs animate-in fade-in duration-150"
            onClick={() => setInspectingReactionsMessage(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ type: 'spring', damping: 25, stiffness: 320 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                backgroundColor: 'var(--dm-modal-bg)',
                borderColor: 'var(--dm-modal-border)',
              }}
              className="rounded-3xl border max-w-sm w-full p-4 sm:p-5 shadow-2xl space-y-3.5 max-h-[85vh] flex flex-col"
            >
              {/* Modal Header */}
              <div
                style={{ borderColor: 'var(--dm-border)' }}
                className="flex items-center justify-between pb-2.5 border-b"
              >
                <div>
                  <h3
                    style={{ color: 'var(--dm-text-primary)' }}
                    className="text-sm font-bold"
                  >
                    Message Reactions
                  </h3>
                  <p
                    style={{ color: 'var(--dm-text-muted)' }}
                    className="text-[11px]"
                  >
                    {Object.values(inspectingReactionsMessage.reactions || {}).reduce(
                      (acc, uids) => acc + (Array.isArray(uids) ? uids.length : 0),
                      0
                    )}{' '}
                    total reaction{Object.values(inspectingReactionsMessage.reactions || {}).reduce((acc, uids) => acc + (Array.isArray(uids) ? uids.length : 0), 0) === 1 ? '' : 's'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectingReactionsMessage(null)}
                  style={{ color: 'var(--dm-text-muted)' }}
                  className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-xl hover:bg-[var(--dm-bg-item-hover)] transition-colors cursor-pointer"
                  aria-label="Close reactions breakdown"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Reaction Filter Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                <button
                  type="button"
                  onClick={() => setReactionDetailTab('all')}
                  style={{
                    backgroundColor: reactionDetailTab === 'all' ? 'var(--dm-bubble-sent)' : 'var(--dm-input-bg)',
                    color: reactionDetailTab === 'all' ? '#FFFFFF' : 'var(--dm-text-secondary)',
                  }}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer shrink-0 transition-colors shadow-2xs"
                >
                  All
                </button>
                {Object.entries(inspectingReactionsMessage.reactions || {}).map(([em, uids]) => {
                  if (!uids || uids.length === 0) return null;
                  return (
                    <button
                      key={em}
                      type="button"
                      onClick={() => setReactionDetailTab(em)}
                      style={{
                        backgroundColor: reactionDetailTab === em ? 'var(--dm-bubble-sent)' : 'var(--dm-input-bg)',
                        color: reactionDetailTab === em ? '#FFFFFF' : 'var(--dm-text-secondary)',
                      }}
                      className="px-2.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer shrink-0 flex items-center gap-1.5 transition-colors shadow-2xs"
                    >
                      <span>{em}</span>
                      <span className="text-[10px] tabular-nums font-mono font-bold">{uids.length}</span>
                    </button>
                  );
                })}
              </div>

              {/* Users List with Avatar, Name, and Reaction */}
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 divide-y divide-[var(--dm-border-subtle)]">
                {(() => {
                  const items: { uid: string; emoji: string }[] = [];
                  for (const [em, uids] of Object.entries(inspectingReactionsMessage.reactions || {})) {
                    if (reactionDetailTab === 'all' || reactionDetailTab === em) {
                      (uids || []).forEach((uid) => items.push({ uid, emoji: em }));
                    }
                  }

                  if (items.length === 0) {
                    return (
                      <div
                        style={{ color: 'var(--dm-text-muted)' }}
                        className="py-8 text-center text-xs"
                      >
                        No reactions under this tab.
                      </div>
                    );
                  }

                  return items.map(({ uid, emoji }) => {
                    const u = users.find((user) => user.uid === uid);
                    const isMe = uid === currentUser.uid;

                    return (
                      <div
                        key={`${uid}-${emoji}`}
                        className="pt-2 pb-1 flex items-center justify-between gap-3 text-left"
                      >
                        <div
                          onClick={() => {
                            setInspectingReactionsMessage(null);
                            setSelectedUserIdForModal(uid);
                          }}
                          className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer group"
                        >
                          <img
                            src={getUserAvatar(u?.profilePictureUrl)}
                            alt={u?.name || 'User'}
                            onError={handleUserAvatarError}
                            style={{ borderColor: 'var(--dm-border)' }}
                            className="w-9 h-9 rounded-full object-cover border shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <p
                              style={{ color: 'var(--dm-text-primary)' }}
                              className="text-xs font-bold group-hover:text-[#8B181B] transition-colors truncate flex items-center gap-1"
                            >
                              <span>{u?.name || 'Cecilian Alumnus'}</span>
                              {isMe && (
                                <span className="text-[10px] font-semibold text-[#8B181B] dark:text-rose-400">
                                  (You)
                                </span>
                              )}
                            </p>
                            <p
                              style={{ color: 'var(--dm-text-muted)' }}
                              className="text-[10px] truncate"
                            >
                              {u?.course ? u.course : u?.batch ? `Batch ${u.batch}` : 'Alumni Member'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-lg leading-none select-none">{emoji}</span>
                          {isMe && activeChat && (
                            <button
                              type="button"
                              onClick={() => {
                                reactToMessage(activeChat.id, inspectingReactionsMessage.id, emoji);
                                setInspectingReactionsMessage(null);
                              }}
                              className="px-2 py-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-lg transition-colors cursor-pointer"
                              title="Remove your reaction"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
