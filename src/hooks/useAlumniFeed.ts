/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Unified Feed Aggregation Hook for Alumni Social Timeline (FYP)
 * Interleaves Announcements, Events, and Career Opportunities
 * with relevance scoring, multi-tab filtering, infinite scroll pagination,
 * and REAL-TIME BI-DIRECTIONAL SYNCHRONIZATION with core application entities.
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useAlumni } from '../context/AlumniContext';
import {
  FeedItem,
  FeedTab,
  FeedReactionType,
  FeedComment
} from '../types/feed';
import { shareEventViaCapacitor } from '../services/nativeShareService';
import { triggerHaptic } from '../services/hapticsService';

const SOCIAL_STORAGE_KEY_PREFIX = 'scc_feed_social_interactions_v4';
const BATCH_SIZE = 10;

interface LocalSocialMap {
  opportunityReactions: Record<string, { userReaction?: FeedReactionType; counts: Record<FeedReactionType, number> }>;
  customComments: Record<string, FeedComment[]>;
  bookmarks: string[];
  interactedEventIds: string[];
}

function getStorageKey(uid?: string) {
  return `${SOCIAL_STORAGE_KEY_PREFIX}_${uid || 'guest'}`;
}

function readLocalSocial(uid?: string): LocalSocialMap {
  try {
    const stored = localStorage.getItem(getStorageKey(uid));
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        opportunityReactions: parsed.opportunityReactions || {},
        customComments: parsed.customComments || {},
        bookmarks: Array.isArray(parsed.bookmarks) ? parsed.bookmarks : [],
        interactedEventIds: Array.isArray(parsed.interactedEventIds) ? parsed.interactedEventIds : []
      };
    }
  } catch (e) {
    console.warn('Failed to parse feed social interactions:', e);
  }
  return { opportunityReactions: {}, customComments: {}, bookmarks: [], interactedEventIds: [] };
}

export function useAlumniFeed() {
  const {
    currentUser,
    announcements,
    events,
    opportunities,
    rsvpEvent,
    toggleLikeEvent,
    addCommentToEvent,
    toggleHeartAnnouncement,
    showToast
  } = useAlumni();

  const [activeTab, setActiveTab] = useState<FeedTab>('foryou');
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState<number>(BATCH_SIZE);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);

  // Local storage for bookmark tracking, interacted event rotation, and opportunities social state
  const [localSocial, setLocalSocial] = useState<LocalSocialMap>(() => readLocalSocial(currentUser?.uid));

  useEffect(() => {
    setLocalSocial(readLocalSocial(currentUser?.uid));
  }, [currentUser?.uid]);

  useEffect(() => {
    try {
      localStorage.setItem(getStorageKey(currentUser?.uid), JSON.stringify(localSocial));
    } catch (e) {
      console.warn('Failed to save feed social interactions:', e);
    }
  }, [localSocial, currentUser?.uid]);

  // Reset pagination batch when tab or search changes
  useEffect(() => {
    setVisibleCount(BATCH_SIZE);
  }, [activeTab, searchQuery]);

  // Aggregate and normalize all collections into FeedItem[]
  const rawFeedItems = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = [];
    const currentUid = currentUser?.uid;

    // 1. Map Announcements & Circulars
    (announcements || []).forEach((a) => {
      const id = `announcement_${a.id}`;
      const hearts = a.hearts || [];
      const hasHearted = currentUid ? hearts.includes(currentUid) : false;
      const heartsCount = hearts.length;

      const customComments = localSocial.customComments[id] || [];

      items.push({
        id,
        type: 'announcement',
        timestamp: a.publishedAt || a.createdAt || new Date().toISOString(),
        title: a.title,
        body: a.content,
        author: {
          uid: a.authorId || a.createdBy || 'admin_presidency',
          name: a.authorName || 'Office of the College President',
          role: a.authorRole || 'Presidential Directorate',
          avatarUrl: '/assets/cecilians-seal.jpg',
          isVerified: true
        },
        mediaUrl: a.imageUrl,
        categoryTag: a.category ? `Circular · ${a.category.toUpperCase()}` : 'Official Announcement',
        badgeLabel: a.urgent ? 'URGENT CIRCULAR' : a.isPinned ? 'PINNED' : undefined,
        reactions: {
          count: heartsCount,
          userReaction: hasHearted ? 'love' : undefined,
          reactionCounts: {
            like: 0,
            love: heartsCount,
            celebrate: 0,
            insightful: 0
          }
        },
        comments: customComments,
        commentsCount: customComments.length,
        relevanceScore: 0,
        metadata: {
          isUrgent: a.urgent,
          isPinned: a.isPinned,
          attachmentsCount: a.attachments?.length || 0
        },
        rawItem: a
      });
    });

    // 2. Map Campus Events & Gatherings
    (events || []).forEach((e) => {
      const id = `event_${e.id}`;
      const eventLikes = e.likes || [];
      const hasLiked = currentUid ? eventLikes.includes(currentUid) : false;
      const isAttending = (e.attendees || []).some((att) => att.uid === currentUid);

      // Map event comments directly from real-time events store
      const eventComments: FeedComment[] = (e.comments || []).map((c: any) => ({
        id: c.id || `evt_comm_${Math.random()}`,
        authorUid: c.userId || c.authorId || '',
        authorName: c.userName || c.authorName || 'Alumnus',
        authorAvatar: c.userAvatar || c.authorAvatar,
        authorBatch: c.batch,
        content: c.text || c.content || '',
        createdAt: c.createdAt || new Date().toISOString()
      }));

      items.push({
        id,
        type: 'event',
        timestamp: e.startDate || e.date || new Date().toISOString(),
        title: e.title,
        body: e.description,
        author: {
          uid: e.createdBy || 'alumni_directorate',
          name: e.createdByName || e.organizerName || 'Alumni Relations & Campus Affairs',
          role: 'Event Committee',
          avatarUrl: '/assets/cecilians-seal.jpg',
          isVerified: true
        },
        mediaUrl: e.heroImageUrl || (e.eventImages && e.eventImages[0]),
        categoryTag: e.type ? `Event · ${e.type.toUpperCase()}` : 'Campus Event',
        badgeLabel: e.isImportant ? 'OFFICIAL GATHERING' : undefined,
        reactions: {
          count: eventLikes.length,
          userReaction: hasLiked ? 'love' : undefined,
          reactionCounts: {
            like: eventLikes.length,
            love: eventLikes.length,
            celebrate: 0,
            insightful: 0
          }
        },
        comments: eventComments,
        commentsCount: eventComments.length,
        relevanceScore: 0,
        metadata: {
          eventDate: e.startDate,
          eventEndDate: e.endDate,
          eventLocation: e.location,
          isVirtual: e.isVirtual,
          attendeesCount: e.attendees?.length || 0,
          isAttending
        },
        rawItem: e
      });
    });

    // 3. Map Curated Job Opportunities
    (opportunities || []).slice(0, 12).forEach((o) => {
      if (o.status === 'closed' || (o.approvalStatus && o.approvalStatus !== 'approved')) return;

      const id = `opportunity_${o.id}`;
      const savedReaction = localSocial.opportunityReactions[id];
      const customComments = localSocial.customComments[id] || [];

      const baseLikes = savedReaction?.counts?.like || 0;

      items.push({
        id,
        type: 'opportunity',
        timestamp: o.postedAt || o.createdAt || new Date().toISOString(),
        title: o.title,
        body: o.description,
        author: {
          uid: o.postedBy || o.postedByUid || 'corp_partner',
          name: o.company || 'Corporate Partner Company',
          role: 'Accredited Employer',
          avatarUrl: '/assets/cecilians-seal.jpg',
          isVerified: true
        },
        categoryTag: o.type ? `Career · ${o.type.toUpperCase()}` : 'Opportunity',
        badgeLabel: o.requiredCourse ? `Preferred: ${o.requiredCourse}` : 'Hiring Cecilians',
        reactions: {
          count: baseLikes,
          userReaction: savedReaction?.userReaction,
          reactionCounts: {
            like: baseLikes,
            love: 0,
            celebrate: 0,
            insightful: savedReaction?.counts?.insightful || 0
          }
        },
        comments: customComments,
        commentsCount: customComments.length,
        relevanceScore: 0,
        metadata: {
          opportunityCompany: o.company,
          opportunitySalary: o.salaryOrStipend,
          opportunityLocation: o.location,
          opportunityType: o.type,
          matchScore: o.requiredCourse && currentUser?.course && o.requiredCourse.toLowerCase().includes(currentUser.course.toLowerCase()) ? 95 : 80
        },
        rawItem: o
      });
    });

    return items;
  }, [announcements, events, opportunities, currentUser, localSocial]);

  // Compute Personalized Relevance Score for "For You" (FYP) Algorithm
  const scoredFeedItems = useMemo(() => {
    const userBatch = currentUser?.batch;
    const userCourse = (currentUser?.course || '').toLowerCase().trim();
    const now = Date.now();

    return rawFeedItems.map((item) => {
      let score = 0;

      // Base time decay
      const itemTime = new Date(item.timestamp).getTime();
      const ageHours = Math.max(1, (now - itemTime) / (1000 * 60 * 60));
      const recencyBoost = Math.max(0, 100 - ageHours * 0.8);
      score += recencyBoost;

      // Urgency & Pinned Items
      if (item.metadata?.isUrgent) score += 120;
      if (item.metadata?.isPinned) score += 80;

      // Cohort & Program Affinity
      if (item.author.batch && userBatch && item.author.batch === userBatch) {
        score += 65;
      }
      if (item.author.course && userCourse && item.author.course.toLowerCase().includes(userCourse)) {
        score += 55;
      }

      // Upcoming Events within 14 days
      if (item.type === 'event' && item.metadata?.eventDate) {
        const eventTime = new Date(item.metadata.eventDate).getTime();
        const daysUntilEvent = (eventTime - now) / (1000 * 60 * 60 * 24);
        if (daysUntilEvent >= 0 && daysUntilEvent <= 14) {
          score += 70;
        }
      }

      // Job Match Score
      if (item.type === 'opportunity' && item.metadata?.matchScore) {
        score += item.metadata.matchScore * 0.4;
      }

      return {
        ...item,
        relevanceScore: Math.round(score)
      };
    });
  }, [rawFeedItems, currentUser]);

  // Filter and Sort by Selected Stream Tab and Search Query
  const filteredFeed = useMemo(() => {
    const interactedSet = new Set(localSocial.interactedEventIds || []);
    let result = scoredFeedItems.filter((item) => {
      if (item.type === 'event') {
        const rawEventId = item.id.replace('event_', '');
        if (interactedSet.has(rawEventId) || interactedSet.has(item.id)) {
          return false;
        }
      }
      return true;
    });

    // Search query matching
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.body.toLowerCase().includes(q) ||
          item.author.name.toLowerCase().includes(q) ||
          item.categoryTag.toLowerCase().includes(q) ||
          (item.metadata?.opportunityCompany || '').toLowerCase().includes(q)
      );
    }

    // Stream tab logic
    if (activeTab === 'foryou') {
      return [...result].sort((a, b) => b.relevanceScore - a.relevanceScore);
    } else if (activeTab === 'recent') {
      return [...result].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    } else if (activeTab === 'official') {
      return result
        .filter((item) => item.type === 'announcement' || item.type === 'event')
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }

    return result;
  }, [scoredFeedItems, activeTab, searchQuery, localSocial.interactedEventIds]);

  // Infinite Scroll Paginated Slice
  const visibleFeed = useMemo(() => {
    return filteredFeed.slice(0, visibleCount);
  }, [filteredFeed, visibleCount]);

  const hasMore = visibleCount < filteredFeed.length;

  const loadMore = useCallback(() => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    setTimeout(() => {
      setVisibleCount((prev) => prev + BATCH_SIZE);
      setIsLoadingMore(false);
    }, 400);
  }, [isLoadingMore, hasMore]);

  const markEventInteracted = useCallback((rawEventId: string) => {
    if (!rawEventId) return;
    setLocalSocial((prev) => {
      const existing = prev.interactedEventIds || [];
      if (existing.includes(rawEventId)) return prev;
      return {
        ...prev,
        interactedEventIds: [...existing, rawEventId]
      };
    });
  }, []);

  const rsvpFeedEvent = useCallback(
    (eventId: string, status: 'going' | 'interested' | 'not_going') => {
      rsvpEvent(eventId, status);
      markEventInteracted(eventId);
    },
    [rsvpEvent, markEventInteracted]
  );

  // Social Interaction: DIRECT BI-DIRECTIONAL REAL-TIME REACTION SYNC
  const toggleReaction = useCallback((itemId: string, reaction: FeedReactionType) => {
    triggerHaptic('light');

    // 1. Events -> directly invoke toggleLikeEvent(eventId) and rotate out of feed
    if (itemId.startsWith('event_')) {
      const rawEventId = itemId.replace('event_', '');
      toggleLikeEvent(rawEventId);
      markEventInteracted(rawEventId);
      return;
    }

    // 2. Announcements -> directly invoke toggleHeartAnnouncement(announcementId)
    if (itemId.startsWith('announcement_')) {
      const rawAnnId = itemId.replace('announcement_', '');
      toggleHeartAnnouncement(rawAnnId);
      return;
    }

    // 3. Opportunities fallback in local storage
    if (itemId.startsWith('opportunity_')) {
      setLocalSocial((prev) => {
        const current = prev.opportunityReactions[itemId] || { counts: { like: 0, love: 0, celebrate: 0, insightful: 0 } };
        const isCurrentReaction = current.userReaction === reaction;
        const newCounts = { ...current.counts };
        if (current.userReaction) newCounts[current.userReaction] = Math.max(0, (newCounts[current.userReaction] || 1) - 1);
        if (!isCurrentReaction) newCounts[reaction] = (newCounts[reaction] || 0) + 1;

        return {
          ...prev,
          opportunityReactions: {
            ...prev.opportunityReactions,
            [itemId]: {
              userReaction: isCurrentReaction ? undefined : reaction,
              counts: newCounts
            }
          }
        };
      });
    }
  }, [toggleLikeEvent, toggleHeartAnnouncement, markEventInteracted]);

  // Social Interaction: DIRECT REAL-TIME COMMENT SYNC
  const addComment = useCallback((itemId: string, text: string) => {
    if (!text.trim() || !currentUser) return;
    triggerHaptic('medium');

    // 1. Events -> directly invoke addCommentToEvent(eventId, text) and rotate out of feed
    if (itemId.startsWith('event_')) {
      const rawEventId = itemId.replace('event_', '');
      addCommentToEvent(rawEventId, text.trim());
      markEventInteracted(rawEventId);
      showToast('Comment posted to event.', 'success');
      return;
    }

    // 2. Announcements & Social Updates
    const newComment: FeedComment = {
      id: `comm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      authorUid: currentUser.uid,
      authorName: currentUser.name,
      authorAvatar: currentUser.profilePictureUrl,
      authorBatch: currentUser.batch,
      content: text.trim(),
      createdAt: new Date().toISOString()
    };

    setLocalSocial((prev) => ({
      ...prev,
      customComments: {
        ...prev.customComments,
        [itemId]: [...(prev.customComments[itemId] || []), newComment]
      }
    }));

    showToast('Your comment was posted to the timeline.', 'success');
  }, [currentUser, addCommentToEvent, markEventInteracted, showToast]);

  // Social Interaction: Bookmark/Save
  const toggleBookmark = useCallback((itemId: string) => {
    triggerHaptic('light');
    setLocalSocial((prev) => {
      const exists = prev.bookmarks.includes(itemId);
      const newBookmarks = exists
        ? prev.bookmarks.filter((id) => id !== itemId)
        : [...prev.bookmarks, itemId];

      let nextInteracted = prev.interactedEventIds || [];
      if (itemId.startsWith('event_')) {
        const rawEventId = itemId.replace('event_', '');
        if (!nextInteracted.includes(rawEventId)) {
          nextInteracted = [...nextInteracted, rawEventId];
        }
      }

      showToast(exists ? 'Removed from saved items' : 'Saved to your bookmarks', 'info');
      return { ...prev, bookmarks: newBookmarks, interactedEventIds: nextInteracted };
    });
  }, [showToast]);

  // Social Interaction: Native Share
  const shareFeedItem = useCallback(async (item: FeedItem) => {
    triggerHaptic('light');
    const shareData = {
      title: item.title,
      text: `${item.title} — Cecilian Alumnet Timeline`,
      url: window.location.href
    };

    if (item.type === 'event' && item.rawItem) {
      await shareEventViaCapacitor(item.rawItem);
      markEventInteracted(item.id.replace('event_', ''));
      return;
    }

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        // User cancelled or unsupported
      }
    } else {
      navigator.clipboard.writeText(`${item.title}\n\n${item.body.slice(0, 160)}...\n\nRead more on St. Cecilia's College Alumnet`);
      showToast('Timeline link copied to clipboard!', 'success');
    }
  }, [showToast, markEventInteracted]);

  return {
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    visibleFeed,
    totalCount: filteredFeed.length,
    hasMore,
    loadMore,
    isLoadingMore,
    toggleReaction,
    addComment,
    toggleBookmark,
    isBookmarked: (id: string) => localSocial.bookmarks.includes(id),
    shareFeedItem,
    rsvpEvent: rsvpFeedEvent,
    markEventInteracted
  };
}
