/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Camera,
  Globe,
  Megaphone,
  RefreshCw,
  Search,
  Users,
  AlertTriangle,
  ArrowUp
} from 'lucide-react';
import { useAlumni } from '../../context/AlumniContext';
import { FeedPageResponse, InstitutionalFeedPost } from '../../types';
import { apiFetch, getAuthToken } from '../../services/apiClient';
import { Skeleton } from '../common/BentoSkeleton';
import { ImageViewerModal } from '../common/ImageViewerModal';
import { PostCard } from '../social/PostCard';
import { UnifiedPostComposer } from '../social/UnifiedPostComposer';
import { useDeepLinkHighlight } from '../../hooks/useDeepLinkHighlight';
import { getUserAvatar, handleUserAvatarError } from '../../lib/defaultImages';
import { MobileEmptyState, MobileInput, MobileSkeleton } from '../mobile/MobilePrimitives';
import {
  canUserViewPost,
  comparePostsCreatedDesc,
  dedupePostsById,
  hydratePostWithLiveAuthor,
  isPinActive,
  paginatePostsWithCursor
} from '../../lib/postVisibility';

interface InstitutionalSocialFeedProps {
  alumniOnly?: boolean;
  isLoading?: boolean;
}

export const InstitutionalSocialFeed: React.FC<InstitutionalSocialFeedProps> = ({
  alumniOnly,
  isLoading: propIsLoading
}) => {
  const {
    currentUser,
    users,
    feedPosts,
    showToast,
    isLoadingData,
    deepLinkTarget,
    clearDeepLinkTarget,
    clearHighlightedItem
  } = useAlumni();

  const [activeFilter, setActiveFilter] = useState<'all' | 'update' | 'gallery' | 'announcement'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [pinnedPosts, setPinnedPosts] = useState<InstitutionalFeedPost[]>([]);
  const [streamPosts, setStreamPosts] = useState<InstitutionalFeedPost[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [latestPostAt, setLatestPostAt] = useState<string | null>(null);
  const [newPostsAvailableCount, setNewPostsAvailableCount] = useState(0);

  const [isFetchingFirst, setIsFetchingFirst] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [viewerImage, setViewerImage] = useState<{ url: string; title: string } | null>(null);
  const missingPostNotifiedRef = useRef<string | null>(null);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const deletedIdsRef = useRef<Set<string>>(new Set());

  const canPublishPost = Boolean(
    currentUser &&
      currentUser.role !== 'employer' &&
      (currentUser.role !== 'alumni' ||
        currentUser.isVerified ||
        (currentUser as any).verified ||
        currentUser.verificationStatus === 'verified')
  );

  // Build local fallback page using the shared single visibility evaluator
  const buildLocalFeedPage = useCallback(
    (cursorStr?: string | null): FeedPageResponse => {
      const viewerCtx = currentUser
        ? {
            uid: currentUser.uid,
            role: currentUser.role,
            batch: currentUser.batch,
            course: currentUser.course,
            department: currentUser.department,
            groupIds: currentUser.groupIds,
            blockedUsers: currentUser.blockedUsers
          }
        : null;

      const usersMap = new Map(users.map((u) => [u.uid, u]));
      const filtered = (feedPosts || [])
        .filter((p) => {
          if (alumniOnly && p.authorRole !== 'alumni') return false;
          if (activeFilter !== 'all' && p.postType !== activeFilter) return false;
          if (searchQuery.trim()) {
            const q = searchQuery.trim().toLowerCase();
            const hay = `${p.title} ${p.content} ${p.authorName} ${(p.tags || []).join(' ')}`.toLowerCase();
            if (!hay.includes(q)) return false;
          }
          const authorAcc = usersMap.get(p.authorId);
          return canUserViewPost(p, {
            surface: 'feed',
            viewer: viewerCtx,
            authorAccount: authorAcc
          });
        })
        .map((p) => hydratePostWithLiveAuthor(p, usersMap.get(p.authorId), viewerCtx));

      const activePinned = filtered
        .filter(
          (p) =>
            (p.authorRole === 'admin' || p.authorRole === 'superadmin') &&
            isPinActive(p)
        )
        .sort(comparePostsCreatedDesc)
        .slice(0, 3);

      const pinnedSet = new Set(activePinned.map((p) => p.id));
      const nonPinned = filtered
        .filter((p) => !pinnedSet.has(p.id))
        .sort(comparePostsCreatedDesc);

      const page = paginatePostsWithCursor(nonPinned, cursorStr, 10);
      return {
        posts: page.items,
        pinnedPosts: cursorStr ? [] : activePinned,
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
        totalCount: nonPinned.length,
        sortMode: 'chronological',
        latestPostAt: filtered.length > 0 ? [...filtered].sort(comparePostsCreatedDesc)[0].createdAt : null
      };
    },
    [feedPosts, users, currentUser, alumniOnly, activeFilter, searchQuery]
  );

  // Fetch page 1 or next cursor page
  const loadFeedPage = useCallback(
    async (cursorStr: string | null = null, append = false) => {
      if (append) {
        setIsFetchingMore(true);
      } else {
        setIsFetchingFirst(true);
        setLoadError(null);
        seenIdsRef.current = new Set();
      }

      const token = getAuthToken();
      if (token && !alumniOnly) {
        try {
          const params = new URLSearchParams();
          params.set('limit', '10');
          if (activeFilter !== 'all') params.set('postType', activeFilter);
          if (searchQuery.trim()) params.set('search', searchQuery.trim());
          if (cursorStr) params.set('cursor', cursorStr);
          if (append && seenIdsRef.current.size > 0) {
            params.set('seenIds', Array.from(seenIdsRef.current).join(','));
          }

          const res = await apiFetch(`/api/feed?${params.toString()}`);
          if (!res.ok) {
            throw new Error('Failed to load feed');
          }
          const data: FeedPageResponse = await res.json();

          if (!append) {
            const pinned = dedupePostsById(data.pinnedPosts || []);
            const pinnedSet = new Set(pinned.map((p) => p.id));
            const regular = dedupePostsById(
              (data.posts || []).filter((p) => !pinnedSet.has(p.id))
            );
            pinned.forEach((p) => seenIdsRef.current.add(p.id));
            regular.forEach((p) => seenIdsRef.current.add(p.id));

            setPinnedPosts(pinned);
            setStreamPosts(regular);
            setLatestPostAt(data.latestPostAt || regular[0]?.createdAt || null);
            setNewPostsAvailableCount(0);
          } else {
            const incoming = dedupePostsById(
              (data.posts || []).filter((p) => !seenIdsRef.current.has(p.id))
            );
            incoming.forEach((p) => seenIdsRef.current.add(p.id));
            setStreamPosts((prev) => {
              const existingIds = new Set(prev.map((p) => p.id));
              return dedupePostsById([...prev, ...incoming.filter((p) => !existingIds.has(p.id))]);
            });
          }

          setNextCursor(data.nextCursor || null);
          setHasMore(Boolean(data.hasMore));
          setIsFetchingFirst(false);
          setIsFetchingMore(false);
          return;
        } catch {
          if (feedPosts.length === 0) {
            setLoadError('Failed to load, retry');
            setIsFetchingFirst(false);
            setIsFetchingMore(false);
            return;
          }
        }
      }

      // Offline / local fallback using shared visibility rule
      const localPage = buildLocalFeedPage(cursorStr);
      if (!append) {
        const pinned = dedupePostsById(localPage.pinnedPosts || []);
        const pinnedSet = new Set(pinned.map((p) => p.id));
        const regular = dedupePostsById(
          (localPage.posts || []).filter((p) => !pinnedSet.has(p.id))
        );
        pinned.forEach((p) => seenIdsRef.current.add(p.id));
        regular.forEach((p) => seenIdsRef.current.add(p.id));
        setPinnedPosts(pinned);
        setStreamPosts(regular);
        setLatestPostAt(localPage.latestPostAt || null);
        setNewPostsAvailableCount(0);
      } else {
        const incoming = dedupePostsById(
          (localPage.posts || []).filter((p) => !seenIdsRef.current.has(p.id))
        );
        incoming.forEach((p) => seenIdsRef.current.add(p.id));
        setStreamPosts((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          return dedupePostsById([...prev, ...incoming.filter((p) => !existingIds.has(p.id))]);
        });
      }
      setNextCursor(localPage.nextCursor);
      setHasMore(localPage.hasMore);
      setIsFetchingFirst(false);
      setIsFetchingMore(false);
    },
    [activeFilter, searchQuery, alumniOnly, buildLocalFeedPage, feedPosts.length]
  );

  // Initial load & filter reload
  useEffect(() => {
    void loadFeedPage(null, false);
  }, [activeFilter, searchQuery, currentUser?.uid, currentUser?.blockedUsers?.length]);

  // Synchronize optimistic context mutations (creations, reactions, comments, edits, deletes) into stream
  useEffect(() => {
    if (!feedPosts) return;
    const dedupedContext = dedupePostsById(feedPosts);
    const contextMap = new Map(dedupedContext.map((p) => [p.id, p]));
    const usersMap = new Map(users.map((u) => [u.uid, u]));
    const viewerCtx = currentUser
      ? {
          uid: currentUser.uid,
          role: currentUser.role,
          batch: currentUser.batch,
          course: currentUser.course,
          department: currentUser.department,
          groupIds: currentUser.groupIds,
          blockedUsers: currentUser.blockedUsers
        }
      : null;

    const matchesFilter = (p: InstitutionalFeedPost) => {
      if (alumniOnly && p.authorRole !== 'alumni') return false;
      if (activeFilter !== 'all' && p.postType !== activeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const hay = `${p.title} ${p.content} ${p.authorName} ${(p.tags || []).join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return canUserViewPost(p, {
        surface: 'feed',
        viewer: viewerCtx,
        authorAccount: usersMap.get(p.authorId)
      });
    };

    const hydratedContext = dedupedContext
      .filter(matchesFilter)
      .map((p) => hydratePostWithLiveAuthor(p, usersMap.get(p.authorId), viewerCtx));

    const contextPinned = hydratedContext
      .filter((p) => (p.authorRole === 'admin' || p.authorRole === 'superadmin') && isPinActive(p))
      .sort(comparePostsCreatedDesc);
    const contextPinnedIds = new Set(contextPinned.map((p) => p.id));

    setPinnedPosts((prevPinned) => {
      const updatedPrevPinned = prevPinned
        .filter((item) => {
          if (deletedIdsRef.current.has(item.id)) return false;
          const ctxItem = contextMap.get(item.id);
          if (!ctxItem) return isPinActive(item);
          return (
            matchesFilter(ctxItem) &&
            (ctxItem.authorRole === 'admin' || ctxItem.authorRole === 'superadmin') &&
            isPinActive(ctxItem)
          );
        })
        .map((item) => {
          const ctxItem = contextMap.get(item.id);
          if (!ctxItem) return item;
          return hydratePostWithLiveAuthor(
            {
              ...item,
              ...ctxItem,
              viewerHasReported: item.viewerHasReported || ctxItem.viewerHasReported
            },
            usersMap.get(ctxItem.authorId),
            viewerCtx
          );
        });
      const mergedPinned = dedupePostsById([...contextPinned, ...updatedPrevPinned])
        .sort(comparePostsCreatedDesc)
        .slice(0, 3);
      mergedPinned.forEach((p) => seenIdsRef.current.add(p.id));
      return mergedPinned;
    });

    setStreamPosts((prev) => {
      const updatedExisting = dedupePostsById(
        prev
          .filter((item) => {
            if (deletedIdsRef.current.has(item.id)) return false;
            if (contextPinnedIds.has(item.id)) return false;
            const ctxItem = contextMap.get(item.id);
            if (!ctxItem) return true;
            return matchesFilter(ctxItem);
          })
          .map((item) => {
            const ctxItem = contextMap.get(item.id);
            if (!ctxItem) return item;
            return hydratePostWithLiveAuthor(
              {
                ...item,
                ...ctxItem,
                viewerHasReported: item.viewerHasReported || ctxItem.viewerHasReported
              },
              usersMap.get(ctxItem.authorId),
              viewerCtx
            );
          })
      );

      const existingIds = new Set(updatedExisting.map((p) => p.id));
      const newAdditions = dedupePostsById(
        hydratedContext.filter(
          (p) =>
            !deletedIdsRef.current.has(p.id) &&
            !contextPinnedIds.has(p.id) &&
            !existingIds.has(p.id)
        )
      ).sort(comparePostsCreatedDesc);

      newAdditions.forEach((p) => seenIdsRef.current.add(p.id));
      return dedupePostsById([...newAdditions, ...updatedExisting]);
    });
  }, [feedPosts, users, currentUser, alumniOnly, activeFilter, searchQuery]);

  // Poll for new posts arriving while scrolling (banner instead of pushing scroll down)
  useEffect(() => {
    if (!latestPostAt || !getAuthToken()) return;
    const timer = setInterval(async () => {
      try {
        const params = new URLSearchParams({ since: latestPostAt });
        if (activeFilter !== 'all') params.set('postType', activeFilter);
        const res = await apiFetch(`/api/feed/new-count?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          if (typeof data?.newCount === 'number' && data.newCount > 0) {
            setNewPostsAvailableCount(data.newCount);
          }
        }
      } catch {
        // Silent background check
      }
    }, 20000);
    return () => clearInterval(timer);
  }, [latestPostAt, activeFilter]);

  // Infinite scroll observer
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isFetchingMore && !isFetchingFirst) {
          void loadFeedPage(nextCursor, true);
        }
      },
      { rootMargin: '250px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isFetchingMore, isFetchingFirst, nextCursor, loadFeedPage]);

  // Reset dashboard listener
  useEffect(() => {
    const handleReset = () => {
      setActiveFilter('all');
      setSearchQuery('');
      clearHighlightedItem();
      setViewerImage(null);
    };
    window.addEventListener('applet:reset-dashboard', handleReset);
    return () => window.removeEventListener('applet:reset-dashboard', handleReset);
  }, [clearHighlightedItem]);

  const combinedVisibleIds = useMemo(() => {
    const pinned = dedupePostsById(pinnedPosts);
    const pinnedSet = new Set(pinned.map((p) => p.id));
    const regular = dedupePostsById(streamPosts.filter((p) => !pinnedSet.has(p.id)));
    return {
      pinned,
      regular
    };
  }, [pinnedPosts, streamPosts]);

  const handlePostUpdated = useCallback((updated: InstitutionalFeedPost) => {
    if (!updated?.id) return;
    setPinnedPosts((prev) =>
      dedupePostsById(prev.map((item) => (item.id === updated.id ? updated : item)))
    );
    setStreamPosts((prev) =>
      dedupePostsById(prev.map((item) => (item.id === updated.id ? updated : item)))
    );
  }, []);

  const handlePostDeleted = useCallback((pid: string) => {
    deletedIdsRef.current.add(pid);
    setPinnedPosts((prev) => prev.filter((item) => item.id !== pid));
    setStreamPosts((prev) => prev.filter((item) => item.id !== pid));
  }, []);

  const handlePostShared = useCallback((shared: InstitutionalFeedPost) => {
    if (!shared?.id) return;
    seenIdsRef.current.add(shared.id);
    setStreamPosts((prev) =>
      dedupePostsById([shared, ...prev.filter((p) => p.id !== shared.id)])
    );
  }, []);

  const handlePostReported = useCallback((pid: string) => {
    setPinnedPosts((prev) =>
      prev.map((item) => (item.id === pid ? { ...item, viewerHasReported: true } : item))
    );
    setStreamPosts((prev) =>
      prev.map((item) => (item.id === pid ? { ...item, viewerHasReported: true } : item))
    );
  }, []);

  const renderedPostIds = useMemo(
    () => [
      ...combinedVisibleIds.pinned.map((p) => p.id),
      ...combinedVisibleIds.regular.map((p) => p.id)
    ],
    [combinedVisibleIds]
  );

  const { highlightedItemId, isHighlighted } = useDeepLinkHighlight(renderedPostIds, [
    isFetchingFirst,
    activeFilter
  ]);

  // Deep-link focus for feed post notifications (supports both deepLinkTarget and direct URL reload)
  useEffect(() => {
    const isFeedDeepLink = deepLinkTarget?.targetType === 'feed_post';
    const targetId = isFeedDeepLink ? deepLinkTarget.targetId : highlightedItemId;
    if (!targetId) return;

    if (isFeedDeepLink) {
      setActiveFilter('all');
      setSearchQuery('');
      clearDeepLinkTarget();
    }

    if (isFetchingFirst) return;

    const alreadyRendered = renderedPostIds.includes(targetId);
    if (alreadyRendered) return;

    // Try finding in context feedPosts first using shared visibility policy
    const fromContext = (feedPosts || []).find((p) => p.id === targetId);
    if (fromContext) {
      const usersMap = new Map(users.map((u) => [u.uid, u]));
      const viewerCtx = currentUser
        ? {
            uid: currentUser.uid,
            role: currentUser.role,
            batch: currentUser.batch,
            course: currentUser.course,
            department: currentUser.department,
            groupIds: currentUser.groupIds,
            blockedUsers: currentUser.blockedUsers
          }
        : null;
      if (
        canUserViewPost(fromContext, {
          surface: 'feed',
          viewer: viewerCtx,
          authorAccount: usersMap.get(fromContext.authorId)
        })
      ) {
        const hydrated = hydratePostWithLiveAuthor(
          fromContext,
          usersMap.get(fromContext.authorId),
          viewerCtx
        );
        seenIdsRef.current.add(hydrated.id);
        setStreamPosts((prev) =>
          prev.some((item) => item.id === hydrated.id) ? prev : [hydrated, ...prev]
        );
        return;
      }
    }

    const token = getAuthToken();
    if (token) {
      let cancelled = false;
      (async () => {
        try {
          const res = await apiFetch(`/api/posts/${encodeURIComponent(targetId)}`);
          if (!res.ok) throw new Error('Post unavailable');
          const data = await res.json();
          const fetched: InstitutionalFeedPost | undefined = data?.post || (data?.id ? data : undefined);
          if (!cancelled && fetched) {
            seenIdsRef.current.add(fetched.id);
            setStreamPosts((prev) =>
              prev.some((item) => item.id === fetched.id) ? prev : [fetched, ...prev]
            );
          }
        } catch {
          if (!cancelled && missingPostNotifiedRef.current !== targetId) {
            missingPostNotifiedRef.current = targetId;
            showToast('This post is no longer available or restricted.', 'info');
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    if (missingPostNotifiedRef.current !== targetId) {
      missingPostNotifiedRef.current = targetId;
      showToast('This post is no longer available or restricted.', 'info');
    }
  }, [
    deepLinkTarget,
    highlightedItemId,
    isFetchingFirst,
    renderedPostIds,
    feedPosts,
    users,
    currentUser,
    clearDeepLinkTarget,
    showToast
  ]);

  const handleComposerPostCreated = useCallback((created: InstitutionalFeedPost) => {
    seenIdsRef.current.add(created.id);
    if (created.isPinned && isPinActive(created)) {
      setPinnedPosts((prev) =>
        dedupePostsById([created, ...prev.filter((p) => p.id !== created.id)]).slice(0, 3)
      );
    } else {
      setStreamPosts((prev) =>
        dedupePostsById([created, ...prev.filter((p) => p.id !== created.id)])
      );
    }
    setLatestPostAt(created.createdAt);
  }, []);

  const showSkeleton = (propIsLoading ?? isLoadingData) || (isFetchingFirst && streamPosts.length === 0 && pinnedPosts.length === 0);

  return (
    <div id="institutional-feed-container" className="w-full max-w-full space-y-0 lg:space-y-5">
      {/* MOBILE (<1024px) COMPACT QUICK-CREATE & FILTER BAR */}
      <div className="lg:hidden bg-white dark:bg-[#000000] border-b border-[#E5E7EB] dark:border-[#27272A] px-4 py-3 space-y-2.5">
        {canPublishPost && (
          <div className="flex items-center gap-3">
            <img
              src={getUserAvatar(currentUser?.profilePictureUrl)}
              onError={handleUserAvatarError}
              alt={currentUser?.name || 'Alumnus'}
              referrerPolicy="no-referrer"
              className="w-9 h-9 rounded-full object-cover border border-[#E5E7EB] dark:border-[#27272A] shrink-0"
            />
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('applet:open-mobile-create'))}
              className="flex-1 min-h-[44px] px-4 rounded-full bg-[#F3F4F6] dark:bg-[#262626] text-left text-[14px] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#E5E7EB] dark:hover:bg-[#323232] transition-colors cursor-pointer"
            >
              Share a campus update...
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
            {[
              { id: 'all', label: 'All' },
              { id: 'update', label: 'Updates' },
              { id: 'gallery', label: 'Photos' },
              { id: 'announcement', label: 'Notices' }
            ].map((tab) => {
              const active = activeFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveFilter(tab.id as any)}
                  className={`min-h-[34px] px-3.5 rounded-full text-[12px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                    active
                      ? 'bg-[#8B181B] dark:bg-[#E11D48] text-white'
                      : 'bg-[#F3F4F6] dark:bg-[#262626] text-[#111827] dark:text-[#FAFAFA]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <MobileInput
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onClear={() => setSearchQuery('')}
          placeholder="Search posts or alumni..."
          leftIcon={<Search className="w-4 h-4" />}
        />
      </div>

      {/* DESKTOP (>=1024px) HEADER, FILTERS & COMPOSER INTACT */}
      <div className="hidden lg:block bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/80 dark:border-stone-800 p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.03)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-stone-900 dark:text-white tracking-tight">
              Alumni & Campus Feed
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
              Community updates, campus gallery photos, and official announcements
            </p>
          </div>

          {/* Search box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search posts or authors..."
              className="w-full pl-8 pr-3 py-2 text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-900 dark:text-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#8B181B]/20 focus:border-[#8B181B] min-h-[38px]"
            />
          </div>
        </div>

        {/* Segmented Category Filter */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-stone-100 dark:border-stone-800/80">
          {[
            { id: 'all', label: 'All Posts', icon: Globe },
            { id: 'update', label: 'Updates', icon: Users },
            { id: 'gallery', label: 'Campus Gallery', icon: Camera },
            { id: 'announcement', label: 'Announcements', icon: Megaphone }
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFilter(tab.id as any)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer min-h-[36px] ${
                  active
                    ? 'bg-[#8B181B] text-white shadow-2xs'
                    : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Unified Post Composer */}
        {canPublishPost ? (
          <UnifiedPostComposer mode="feed" onPostCreated={handleComposerPostCreated} />
        ) : (
          <div className="pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
            <span className="inline-flex items-center gap-1.5">
              <Users className="w-4 h-4 text-stone-400" />
              <span>Verified alumni and campus staff can publish posts directly to this feed.</span>
            </span>
          </div>
        )}
      </div>

      {/* New Posts Available Banner (does not push user's scroll position automatically) */}
      {newPostsAvailableCount > 0 && (
        <div className="sticky top-20 z-20 flex justify-center">
          <button
            type="button"
            onClick={() => {
              setNewPostsAvailableCount(0);
              void loadFeedPage(null, false);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#8B181B] hover:bg-[#721316] text-white text-xs font-bold shadow-lg transition-transform active:scale-95 cursor-pointer min-h-[40px]"
          >
            <ArrowUp className="w-3.5 h-3.5" />
            <span>New posts available ({newPostsAvailableCount})</span>
          </button>
        </div>
      )}

      {/* Feed States: Loading / Error / Empty / Posts */}
      {showSkeleton ? (
        <>
          <div className="lg:hidden">
            <MobileSkeleton variant="feed" count={3} />
          </div>
          <div className="hidden lg:block space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/80 dark:border-stone-800 p-5 space-y-3"
              >
                <div className="flex items-center gap-3">
                  <Skeleton className="w-11 h-11 rounded-2xl shrink-0" />
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-3.5 w-36 rounded" />
                    <Skeleton className="h-2.5 w-48 rounded" />
                  </div>
                </div>
                <Skeleton className="h-4 w-3/4 rounded" />
                <Skeleton className="h-3 w-full rounded" />
                {i === 1 && <Skeleton className="w-full h-48 rounded-xl" />}
              </div>
            ))}
          </div>
        </>
      ) : loadError ? (
        <div className="bg-white dark:bg-[#000000] lg:dark:bg-stone-900 lg:rounded-2xl border-b lg:border border-[#E5E7EB] dark:border-[#27272A] lg:border-stone-200 lg:dark:border-stone-800 p-8 text-center space-y-3">
          <AlertTriangle className="w-8 h-8 mx-auto text-amber-600" />
          <p className="text-sm font-bold text-stone-900 dark:text-white">Failed to load, retry</p>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Could not fetch the latest feed updates right now.
          </p>
          <button
            type="button"
            onClick={() => void loadFeedPage(null, false)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#8B181B] hover:bg-[#721316] text-white text-xs font-bold cursor-pointer min-h-[44px]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      ) : combinedVisibleIds.pinned.length === 0 && combinedVisibleIds.regular.length === 0 ? (
        <>
          <div className="lg:hidden">
            <MobileEmptyState
              icon={<Globe className="w-6 h-6" />}
              title="No posts yet"
              description="Share a career milestone or campus photo to start the alumni timeline."
              actionLabel={canPublishPost ? 'Create Post' : undefined}
              onAction={
                canPublishPost
                  ? () => window.dispatchEvent(new CustomEvent('applet:open-mobile-create'))
                  : undefined
              }
            />
          </div>
          <div className="hidden lg:block bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-10 text-center space-y-2">
            <Globe className="w-8 h-8 text-stone-300 dark:text-stone-600 mx-auto" />
            <p className="text-sm font-bold text-stone-800 dark:text-stone-200">
              Nothing to show yet, be the first to post
            </p>
            <p className="text-xs text-stone-400 dark:text-stone-500">
              Share a career update or campus photo above to start the timeline.
            </p>
          </div>
        </>
      ) : (
        <div className="space-y-0 lg:space-y-4">
          {/* Pinned Admin Announcements (up to 3) */}
          {combinedVisibleIds.pinned.map((post) => (
            <PostCard
              key={`pinned-${post.id}`}
              post={post}
              highlighted={isHighlighted(post.id)}
              onImageClick={(url, title) => setViewerImage({ url, title })}
              onPostUpdated={handlePostUpdated}
              onPostDeleted={handlePostDeleted}
              onPostShared={handlePostShared}
              onPostReported={handlePostReported}
            />
          ))}

          {/* Regular Feed Stream */}
          {combinedVisibleIds.regular.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              highlighted={isHighlighted(post.id)}
              onImageClick={(url, title) => setViewerImage({ url, title })}
              onPostUpdated={handlePostUpdated}
              onPostDeleted={handlePostDeleted}
              onPostShared={handlePostShared}
              onPostReported={handlePostReported}
            />
          ))}

          {/* Load More & Infinite Scroll Sentinel */}
          {isFetchingMore && (
            <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-5 space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-xl" />
                <Skeleton className="h-3.5 w-40 rounded" />
              </div>
              <Skeleton className="h-3 w-full rounded" />
            </div>
          )}

          {hasMore && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                disabled={isFetchingMore}
                onClick={() => void loadFeedPage(nextCursor, true)}
                className="px-5 py-2.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs font-bold text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors cursor-pointer min-h-[42px]"
              >
                {isFetchingMore ? 'Loading...' : 'Load more'}
              </button>
            </div>
          )}

          <div ref={sentinelRef} className="h-4 w-full pointer-events-none" />
        </div>
      )}

      <ImageViewerModal
        isOpen={Boolean(viewerImage)}
        imageUrl={viewerImage?.url || ''}
        title={viewerImage?.title || 'Post Image'}
        onClose={() => setViewerImage(null)}
      />
    </div>
  );
};
