/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Camera,
  EyeOff,
  Globe,
  Image as ImageIcon,
  Megaphone,
  Pin,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Upload,
  Users,
  X,
  AlertTriangle,
  ArrowUp,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useAlumni } from '../../context/AlumniContext';
import { FeedPageResponse, InstitutionalFeedPost } from '../../types';
import { apiFetch, getAuthToken } from '../../services/apiClient';
import { validateUploadedFile } from '../../lib/security';
import { getUserAvatar, handleUserAvatarError } from '../../lib/defaultImages';
import { Skeleton } from '../common/BentoSkeleton';
import { ImageViewerModal } from '../common/ImageViewerModal';
import { PostCard } from '../social/PostCard';
import { useDeepLinkHighlight } from '../../hooks/useDeepLinkHighlight';
import {
  canUserViewPost,
  comparePostsCreatedDesc,
  hydratePostWithLiveAuthor,
  isPinActive,
  paginatePostsWithCursor
} from '../../lib/postVisibility';

const PRESET_CAMPUS_PHOTOS = [
  { name: "Academic Tower", url: '/assets/landing-building-2.jpg' },
  { name: 'Campus Entrance', url: '/assets/landing-building-1.jpg' },
  { name: 'Aerial Campus', url: '/assets/landing-building-3.jpg' },
  { name: 'College Seal', url: '/assets/cecilians-seal.jpg' }
];

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
    createSocialPost,
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
  const [sortMode, setSortMode] = useState<'chronological' | 'relevance'>('chronological');
  const [latestPostAt, setLatestPostAt] = useState<string | null>(null);
  const [newPostsAvailableCount, setNewPostsAvailableCount] = useState(0);

  const [isFetchingFirst, setIsFetchingFirst] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [viewerImage, setViewerImage] = useState<{ url: string; title: string } | null>(null);
  const missingPostNotifiedRef = useRef<string | null>(null);

  // Inline Composer States
  const [composerExpanded, setComposerExpanded] = useState(false);
  const [composerType, setComposerType] = useState<'update' | 'gallery' | 'announcement'>('update');
  const [postTitle, setPostTitle] = useState('');
  const [postContent, setPostContent] = useState('');
  const [postImageUrl, setPostImageUrl] = useState('');
  const [postTags, setPostTags] = useState('');
  const [visibility, setVisibility] = useState<'alumni' | 'public' | 'batch' | 'department' | 'private'>('alumni');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [pinExpiresAt, setPinExpiresAt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());

  const isAdminOrSuperAdmin =
    currentUser?.role === 'admin' || currentUser?.role === 'superadmin';
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
            const pinned = data.pinnedPosts || [];
            const regular = (data.posts || []).filter(
              (p) => !pinned.some((pin) => pin.id === p.id)
            );
            pinned.forEach((p) => seenIdsRef.current.add(p.id));
            regular.forEach((p) => seenIdsRef.current.add(p.id));

            setPinnedPosts(pinned);
            setStreamPosts(regular);
            setSortMode(data.sortMode || 'chronological');
            setLatestPostAt(data.latestPostAt || regular[0]?.createdAt || null);
            setNewPostsAvailableCount(0);
          } else {
            const incoming = (data.posts || []).filter((p) => !seenIdsRef.current.has(p.id));
            incoming.forEach((p) => seenIdsRef.current.add(p.id));
            setStreamPosts((prev) => [...prev, ...incoming]);
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
        const pinned = localPage.pinnedPosts || [];
        const regular = localPage.posts || [];
        pinned.forEach((p) => seenIdsRef.current.add(p.id));
        regular.forEach((p) => seenIdsRef.current.add(p.id));
        setPinnedPosts(pinned);
        setStreamPosts(regular);
        setSortMode(localPage.sortMode);
        setLatestPostAt(localPage.latestPostAt || null);
        setNewPostsAvailableCount(0);
      } else {
        const incoming = (localPage.posts || []).filter((p) => !seenIdsRef.current.has(p.id));
        incoming.forEach((p) => seenIdsRef.current.add(p.id));
        setStreamPosts((prev) => [...prev, ...incoming]);
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
    const contextMap = new Map(feedPosts.map((p) => [p.id, p]));
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

    const hydratedContext = feedPosts
      .filter(matchesFilter)
      .map((p) => hydratePostWithLiveAuthor(p, usersMap.get(p.authorId), viewerCtx));

    const pinnedList = hydratedContext
      .filter((p) => (p.authorRole === 'admin' || p.authorRole === 'superadmin') && isPinActive(p))
      .sort(comparePostsCreatedDesc)
      .slice(0, 3);
    const pinnedSet = new Set(pinnedList.map((p) => p.id));

    setPinnedPosts(pinnedList);
    setStreamPosts((prev) => {
      const updatedExisting = prev
        .filter((item) => {
          if (pinnedSet.has(item.id)) return false;
          const ctxItem = contextMap.get(item.id);
          if (!ctxItem) return feedPosts.length === 0;
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
        });

      const existingIds = new Set(updatedExisting.map((p) => p.id));
      const newAdditions = hydratedContext
        .filter((p) => !pinnedSet.has(p.id) && !existingIds.has(p.id))
        .sort(comparePostsCreatedDesc);

      return [...newAdditions, ...updatedExisting];
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
    const pinnedSet = new Set(pinnedPosts.map((p) => p.id));
    return {
      pinned: pinnedPosts,
      regular: streamPosts.filter((p) => !pinnedSet.has(p.id))
    };
  }, [pinnedPosts, streamPosts]);

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

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validation = await validateUploadedFile(file, 'images');
    if (!validation.valid) {
      showToast(validation.error || 'Invalid photo format.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      setPostImageUrl(event.target?.result as string);
      showToast('Photo attached to your post.', 'success');
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postContent.trim()) {
      showToast('Please write something to share with the community.', 'warning');
      return;
    }
    setIsSubmitting(true);
    try {
      const tagsArray = postTags
        ? postTags
            .split(',')
            .map((t) => t.trim().replace(/^#/, ''))
            .filter(Boolean)
        : [
            composerType === 'gallery'
              ? 'CampusGallery'
              : composerType === 'announcement'
              ? 'Announcement'
              : 'Update'
          ];

      const result = await createSocialPost({
        postType: composerType,
        title: postTitle.trim() || (composerType === 'announcement' ? 'Community Announcement' : ''),
        content: postContent.trim(),
        imageUrl: postImageUrl.trim() || undefined,
        visibility,
        targetBatch: visibility === 'batch' ? currentUser?.batch : undefined,
        targetDepartment: visibility === 'department' ? (currentUser?.department || currentUser?.course) : undefined,
        isAnonymous,
        isPinned: isAdminOrSuperAdmin ? isPinned : false,
        pinExpiresAt: isAdminOrSuperAdmin && isPinned && pinExpiresAt ? new Date(pinExpiresAt).toISOString() : undefined,
        tags: tagsArray
      });

      const created = result?.success ? result.post : undefined;
      if (created) {
        seenIdsRef.current.add(created.id);
        if (created.isPinned && isPinActive(created)) {
          setPinnedPosts((prev) => [created, ...prev.filter((p) => p.id !== created.id)].slice(0, 3));
        } else {
          setStreamPosts((prev) => [created, ...prev.filter((p) => p.id !== created.id)]);
        }
        setLatestPostAt(created.createdAt);
        setPostTitle('');
        setPostContent('');
        setPostImageUrl('');
        setPostTags('');
        setVisibility('alumni');
        setIsAnonymous(false);
        setIsPinned(false);
        setPinExpiresAt('');
        setComposerExpanded(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const showSkeleton = (propIsLoading ?? isLoadingData) || (isFetchingFirst && streamPosts.length === 0 && pinnedPosts.length === 0);

  return (
    <div id="institutional-feed-container" className="w-full max-w-full space-y-5">
      {/* Header, Filters & Search */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/80 dark:border-stone-800 p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.03)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-stone-900 dark:text-white tracking-tight">
                Alumni & Campus Feed
              </h2>
              <span className="text-[11px] font-medium text-stone-400 dark:text-stone-500">
                {sortMode === 'relevance' ? 'Relevance' : 'Newest First'}
              </span>
            </div>
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
        <div className="flex flex-wrap items-center gap-1.5 pb-0.5">
          {[
            { id: 'all', label: 'All Posts', icon: Sparkles },
            { id: 'update', label: 'Updates', icon: Sparkles },
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

        {/* Inline Post Composer */}
        {canPublishPost ? (
          <form onSubmit={handleSubmitPost} className="pt-3 border-t border-stone-100 dark:border-stone-800 space-y-3">
            <div className="flex items-start gap-3">
              <img
                src={getUserAvatar(currentUser?.profilePictureUrl)}
                alt={currentUser?.name || 'Member'}
                onError={handleUserAvatarError}
                className="w-10 h-10 rounded-2xl object-cover border border-stone-200 dark:border-stone-700 shrink-0"
              />
              <div className="flex-1 space-y-2">
                {composerExpanded && (
                  <input
                    type="text"
                    value={postTitle}
                    onChange={(e) => setPostTitle(e.target.value)}
                    placeholder="Headline or short title (optional)"
                    className="w-full px-3.5 py-2 text-xs font-semibold bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-900 dark:text-white focus:outline-none focus:border-[#8B181B]"
                  />
                )}
                <textarea
                  rows={composerExpanded ? 3 : 2}
                  value={postContent}
                  onFocus={() => setComposerExpanded(true)}
                  onChange={(e) => setPostContent(e.target.value)}
                  placeholder={`Share a career update, achievement, or campus photo, ${currentUser?.name?.split(' ')[0] || 'Cecilian'}...`}
                  className="w-full px-3.5 py-2.5 text-sm bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-900 dark:text-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#8B181B]/20 focus:border-[#8B181B] resize-none leading-relaxed"
                />
              </div>
            </div>

            {composerExpanded && (
              <div className="pl-0 sm:pl-13 space-y-3">
                {/* Category & Visibility Row */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <select
                    value={composerType}
                    onChange={(e) => setComposerType(e.target.value as any)}
                    className="px-3 py-1.5 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 font-semibold min-h-[38px]"
                    aria-label="Post Category"
                  >
                    <option value="update">Community Update</option>
                    <option value="gallery">Campus Photo</option>
                    <option value="announcement">Announcement</option>
                  </select>

                  <select
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value as any)}
                    className="px-3 py-1.5 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 font-semibold min-h-[38px]"
                    aria-label="Post Visibility"
                  >
                    <option value="alumni">All Verified Alumni</option>
                    <option value="public">Public</option>
                    {currentUser?.batch && (
                      <option value="batch">Batch {currentUser.batch} Only</option>
                    )}
                    {(currentUser?.department || currentUser?.course) && (
                      <option value="department">
                        {currentUser.department || currentUser.course} Only
                      </option>
                    )}
                    <option value="private">Only Me (Private)</option>
                  </select>

                  {currentUser?.role === 'alumni' && (
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 cursor-pointer min-h-[38px]">
                      <input
                        type="checkbox"
                        checked={isAnonymous}
                        onChange={(e) => setIsAnonymous(e.target.checked)}
                        className="rounded text-[#8B181B] focus:ring-[#8B181B]"
                      />
                      <EyeOff className="w-3.5 h-3.5 text-stone-500" />
                      <span>Post Anonymously</span>
                    </label>
                  )}

                  {isAdminOrSuperAdmin && (
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-300 cursor-pointer min-h-[38px]">
                      <input
                        type="checkbox"
                        checked={isPinned}
                        onChange={(e) => setIsPinned(e.target.checked)}
                        className="rounded text-[#8B181B] focus:ring-[#8B181B]"
                      />
                      <Pin className="w-3.5 h-3.5" />
                      <span>Pin Announcement</span>
                    </label>
                  )}
                </div>

                {isAdminOrSuperAdmin && isPinned && (
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <label className="text-stone-600 dark:text-stone-400 font-medium">
                      Pin expires on (optional):
                    </label>
                    <input
                      type="datetime-local"
                      value={pinExpiresAt}
                      onChange={(e) => setPinExpiresAt(e.target.value)}
                      className="px-3 py-1.5 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200"
                    />
                  </div>
                )}

                {/* Media Attachment Row */}
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-xs font-semibold text-stone-700 dark:text-stone-200 cursor-pointer min-h-[38px]">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Photo</span>
                    <input
                      type="file"
                      accept="image/png, image/jpeg, image/webp"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </label>

                  {PRESET_CAMPUS_PHOTOS.map((preset) => (
                    <button
                      key={preset.url}
                      type="button"
                      onClick={() => setPostImageUrl(preset.url)}
                      className={`px-2.5 py-1.5 rounded-xl text-[11px] font-medium border cursor-pointer transition-colors min-h-[34px] ${
                        postImageUrl === preset.url
                          ? 'bg-red-50 border-[#8B181B] text-[#8B181B] dark:bg-red-950/40 dark:text-red-300'
                          : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-50'
                      }`}
                    >
                      {preset.name}
                    </button>
                  ))}

                  {postImageUrl && (
                    <button
                      type="button"
                      onClick={() => setPostImageUrl('')}
                      className="text-xs text-red-600 hover:underline cursor-pointer ml-auto"
                    >
                      Remove image
                    </button>
                  )}
                </div>

                {postImageUrl && (
                  <div className="rounded-xl overflow-hidden border border-stone-200 dark:border-stone-700 max-h-44 bg-stone-950">
                    <img src={postImageUrl} alt="Attachment preview" className="w-full h-full object-cover" />
                  </div>
                )}

                <input
                  type="text"
                  value={postTags}
                  onChange={(e) => setPostTags(e.target.value)}
                  placeholder="Tags (comma-separated, e.g. BSIT, Career, Homecoming)"
                  className="w-full px-3.5 py-2 text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-900 dark:text-white"
                />
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => setComposerExpanded((prev) => !prev)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 cursor-pointer min-h-[38px]"
              >
                {composerExpanded ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5" />
                    <span>Fewer options</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" />
                    <span>Add photo, visibility &amp; options</span>
                  </>
                )}
              </button>

              <button
                type="submit"
                disabled={isSubmitting || !postContent.trim()}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#8B181B] hover:bg-[#721316] disabled:opacity-50 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer min-h-[40px]"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Posting...' : 'Publish Post'}</span>
              </button>
            </div>
          </form>
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
        <div className="space-y-4">
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
      ) : loadError ? (
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-8 text-center space-y-3">
          <AlertTriangle className="w-8 h-8 mx-auto text-amber-600" />
          <p className="text-sm font-bold text-stone-900 dark:text-white">Failed to load, retry</p>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Could not fetch the latest feed updates right now.
          </p>
          <button
            type="button"
            onClick={() => void loadFeedPage(null, false)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#8B181B] hover:bg-[#721316] text-white text-xs font-bold cursor-pointer min-h-[40px]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      ) : combinedVisibleIds.pinned.length === 0 && combinedVisibleIds.regular.length === 0 ? (
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-10 text-center space-y-2">
          <Globe className="w-8 h-8 text-stone-300 dark:text-stone-600 mx-auto" />
          <p className="text-sm font-bold text-stone-800 dark:text-stone-200">
            Nothing to show yet, be the first to post
          </p>
          <p className="text-xs text-stone-400 dark:text-stone-500">
            Share a career update or campus photo above to start the timeline.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Pinned Admin Announcements (up to 3) */}
          {combinedVisibleIds.pinned.map((post) => (
            <PostCard
              key={`pinned-${post.id}`}
              post={post}
              highlighted={isHighlighted(post.id)}
              onImageClick={(url, title) => setViewerImage({ url, title })}
              onPostDeleted={(pid) =>
                setPinnedPosts((prev) => prev.filter((item) => item.id !== pid))
              }
              onPostShared={(shared) => {
                seenIdsRef.current.add(shared.id);
                setStreamPosts((prev) => [shared, ...prev]);
              }}
              onPostReported={(pid) =>
                setPinnedPosts((prev) =>
                  prev.map((item) => (item.id === pid ? { ...item, viewerHasReported: true } : item))
                )
              }
            />
          ))}

          {/* Regular Feed Stream */}
          {combinedVisibleIds.regular.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              highlighted={isHighlighted(post.id)}
              onImageClick={(url, title) => setViewerImage({ url, title })}
              onPostDeleted={(pid) =>
                setStreamPosts((prev) => prev.filter((item) => item.id !== pid))
              }
              onPostShared={(shared) => {
                seenIdsRef.current.add(shared.id);
                setStreamPosts((prev) => [shared, ...prev]);
              }}
              onPostReported={(pid) =>
                setStreamPosts((prev) =>
                  prev.map((item) => (item.id === pid ? { ...item, viewerHasReported: true } : item))
                )
              }
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
