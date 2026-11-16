/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  Briefcase,
  Check,
  Clock,
  Copy,
  EyeOff,
  FileText,
  Globe,
  GraduationCap,
  Image as ImageIcon,
  Layers,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Megaphone,
  MessageSquare,
  Phone,
  Pin,
  RefreshCw,
  Scale,
  Send,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
  X
} from 'lucide-react';
import { useAlumni } from '../../context/AlumniContext';
import { InstitutionalFeedPost, UserProfile } from '../../types';

type PostVisibility = NonNullable<InstitutionalFeedPost['visibility']>;
import { apiFetch } from '../../services/apiClient';
import {
  areUsersBlocked,
  canUserViewPost,
  comparePostsCreatedDesc,
  hydratePostWithLiveAuthor,
  isAccountDeleted,
  isAccountUnavailable,
  isStaffOrModeratorRole,
  paginatePostsWithCursor,
  slugifyUsername
} from '../../lib/postVisibility';
import { formatFullLocalDateTime, formatRelativeTime } from '../../lib/dateUtils';
import { getCoverPhoto, getUserAvatar, handleCoverPhotoError, handleUserAvatarError } from '../../lib/defaultImages';
import { compressImage } from '../../lib/utils';
import { PostCard } from '../social/PostCard';
import { AppealPostModal } from '../social/AppealPostModal';
import { ImageViewerModal } from '../common/ImageViewerModal';
import { ConfirmationModal } from '../common/ConfirmationModal';

interface PublicProfileSummary {
  uid: string;
  username?: string;
  name: string;
  role: string;
  batch?: string;
  course?: string;
  department?: string;
  location?: string;
  profilePictureUrl?: string;
  coverPhotoUrl?: string;
  headline?: string;
  about?: string;
  company?: string;
  currentPosition?: string;
  email?: string;
  phone?: string;
  isVerified?: boolean;
  quickStatus?: string;
  followersCount?: number;
  followingCount?: number;
  connectionsCount?: number;
  pinnedPostId?: string;
  postsCount?: number;
  unavailable?: boolean;
  unavailableReason?: string;
  isBlockedByViewer?: boolean;
  show_email?: boolean;
  show_phone?: boolean;
  show_current_employer?: boolean;
  createdAt?: string;
}

interface ModerationWarningItem {
  id: string;
  postId: string;
  reason: string;
  message: string;
  moderatorName: string;
  createdAt: string;
  actionType?: 'warning' | 'deletion';
}

interface PublicProfilePageProps {
  identifier: string;
}

export const PublicProfilePage: React.FC<PublicProfilePageProps> = ({ identifier }) => {
  const {
    currentUser,
    users,
    feedPosts,
    createSocialPost,
    blockUser,
    unblockUser,
    isConnected,
    hasPendingRequestWith,
    friendRequests,
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    cancelFriendRequest,
    getOrCreateChat,
    setActiveTab,
    closeSubRoute,
    openEditProfile,
    showToast
  } = useAlumni();

  const [profile, setProfile] = useState<PublicProfileSummary | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [subTab, setSubTab] = useState<'posts' | 'media' | 'about'>('posts');
  const [postTypeFilter, setPostTypeFilter] = useState<string>('all');
  const [yearFilter, setYearFilter] = useState<string>('all');

  const [timelinePosts, setTimelinePosts] = useState<InstitutionalFeedPost[]>([]);
  const [pinnedPost, setPinnedPost] = useState<InstitutionalFeedPost | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [postsLoading, setPostsLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [postsError, setPostsError] = useState<string | null>(null);

  const [myWarnings, setMyWarnings] = useState<ModerationWarningItem[]>([]);
  const [appealTarget, setAppealTarget] = useState<{
    postId: string;
    warningId?: string;
    actionType: 'warning' | 'deletion';
    reason?: string;
  } | null>(null);

  // Own profile composer state
  const [composerTitle, setComposerTitle] = useState('');
  const [composerContent, setComposerContent] = useState('');
  const [composerCategory, setComposerCategory] = useState<'update' | 'gallery' | 'announcement'>('update');
  const [composerVisibility, setComposerVisibility] = useState<PostVisibility>('alumni');
  const [composerBatch, setComposerBatch] = useState(currentUser?.batch || '');
  const [composerDepartment, setComposerDepartment] = useState(currentUser?.course || '');
  const [composerTags, setComposerTags] = useState('');
  const [composerImageUrl, setComposerImageUrl] = useState('');
  const [isComposerAnonymous, setIsComposerAnonymous] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const [viewerImage, setViewerImage] = useState<{ url: string; title: string } | null>(null);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [showCancelRequestConfirm, setShowCancelRequestConfirm] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const composerRef = useRef<HTMLInputElement>(null);
  const composerFileRef = useRef<HTMLInputElement>(null);

  const isStaffViewer = isStaffOrModeratorRole(currentUser?.role);

  const resolveLocalFallbackUser = useCallback(
    (idOrSlug: string): UserProfile | undefined => {
      const normalized = idOrSlug.trim().toLowerCase();
      return users.find((u) => {
        if (u.uid.toLowerCase() === normalized) return true;
        if (u.username && u.username.toLowerCase() === normalized) return true;
        if (Array.isArray(u.previousUsernames) && u.previousUsernames.some((p) => p.toLowerCase() === normalized)) {
          return true;
        }
        return slugifyUsername(u.name || '') === normalized;
      });
    },
    [users]
  );

  const buildLocalProfileSummary = useCallback(
    (target: UserProfile): PublicProfileSummary => {
      const isSelf = currentUser?.uid === target.uid;
      const blocked = currentUser ? areUsersBlocked(currentUser.uid, target.uid, currentUser, target) : false;
      const unavailable = !isSelf && (blocked || isAccountUnavailable(target));

      if ((unavailable && !isStaffViewer) || isAccountDeleted(target)) {
        return {
          uid: target.uid,
          username: target.username,
          name: isAccountDeleted(target) ? 'Former alumni' : 'Unavailable Account',
          role: 'alumni',
          unavailable: true,
          unavailableReason: 'This account is unavailable',
          postsCount: 0,
          isBlockedByViewer: Boolean(currentUser?.blockedUsers?.includes(target.uid))
        };
      }

      const showEmail = isSelf || isStaffViewer || Boolean(target.show_email ?? target.showEmail);
      const showPhone = isSelf || isStaffViewer || Boolean(target.show_phone ?? target.showPhone);
      const showEmployer =
        isSelf || isStaffViewer || (target.show_current_employer ?? target.showCurrentEmployer ?? true);

      const visibleCount = (feedPosts || []).filter((p) =>
        canUserViewPost(p, {
          surface: 'profile',
          viewer: currentUser
            ? {
                uid: currentUser.uid,
                role: currentUser.role,
                batch: currentUser.batch,
                course: currentUser.course,
                department: currentUser.department,
                groupIds: currentUser.groupIds,
                blockedUsers: currentUser.blockedUsers
              }
            : null,
          targetProfileUid: target.uid,
          authorAccount: target,
          isBlocked: blocked
        })
      ).length;

      return {
        uid: target.uid,
        username: target.username || slugifyUsername(target.name),
        name: target.name,
        role: target.role,
        batch: target.batch,
        course: target.course,
        department: target.department,
        location: target.location,
        profilePictureUrl: target.profilePictureUrl,
        coverPhotoUrl: target.coverPhotoUrl,
        headline: target.headline,
        about: target.about,
        company: showEmployer ? target.company : undefined,
        currentPosition: showEmployer ? target.currentPosition : undefined,
        email: showEmail ? target.email : undefined,
        phone: showPhone ? target.phone : undefined,
        isVerified: target.isVerified,
        quickStatus: target.quickStatus,
        followersCount: target.followersCount,
        followingCount: target.followingCount,
        connectionsCount: target.connectionsCount,
        pinnedPostId: target.pinnedPostId,
        postsCount: visibleCount,
        unavailable: false,
        isBlockedByViewer: Boolean(currentUser?.blockedUsers?.includes(target.uid)),
        show_email: target.show_email ?? target.showEmail,
        show_phone: target.show_phone ?? target.showPhone,
        show_current_employer: target.show_current_employer ?? target.showCurrentEmployer,
        createdAt: target.createdAt
      };
    },
    [currentUser, feedPosts, isStaffViewer]
  );

  const loadProfile = useCallback(async () => {
    setProfileLoading(true);
    setProfileError(null);
    setNotFound(false);

    try {
      const res = await apiFetch(`/api/profiles/${encodeURIComponent(identifier)}?noRedirect=true`);
      if (res.status === 404) {
        const localUser = resolveLocalFallbackUser(identifier);
        if (localUser) {
          setProfile(buildLocalProfileSummary(localUser));
          setProfileLoading(false);
          return;
        }
        setNotFound(true);
        setProfileLoading(false);
        return;
      }

      if (res.ok) {
        const data = await res.json();
        if (data?.redirectToSlug && typeof window !== 'undefined') {
          window.history.replaceState({}, '', `/profile/${encodeURIComponent(data.redirectToSlug)}`);
        }
        if (data?.profile) {
          setProfile(data.profile);
          setProfileLoading(false);
          return;
        }
      }

      const localUser = resolveLocalFallbackUser(identifier);
      if (localUser) {
        setProfile(buildLocalProfileSummary(localUser));
      } else {
        setProfileError('Failed to load, retry');
      }
    } catch {
      const localUser = resolveLocalFallbackUser(identifier);
      if (localUser) {
        setProfile(buildLocalProfileSummary(localUser));
      } else {
        setProfileError('Failed to load, retry');
      }
    } finally {
      setProfileLoading(false);
    }
  }, [identifier, resolveLocalFallbackUser, buildLocalProfileSummary]);

  const computeLocalTimelinePage = useCallback(
    (targetUid: string, cursor?: string | null) => {
      const targetUser = users.find((u) => u.uid === targetUid) || resolveLocalFallbackUser(identifier);
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

      let visible = (feedPosts || [])
        .filter((p) =>
          canUserViewPost(p, {
            surface: 'profile',
            viewer: viewerCtx,
            targetProfileUid: targetUid,
            authorAccount: targetUser
          })
        )
        .map((p) => hydratePostWithLiveAuthor(p, targetUser, viewerCtx))
        .sort(comparePostsCreatedDesc);

      const countAll = visible.length;

      if (subTab === 'media') {
        visible = visible.filter((p) => Boolean(p.imageUrl || p.mediaUrl));
      }
      if (postTypeFilter !== 'all') {
        visible = visible.filter((p) => p.postType === postTypeFilter);
      }
      if (yearFilter !== 'all') {
        visible = visible.filter((p) => String(new Date(p.createdAt).getFullYear()) === yearFilter);
      }

      let resolvedPinned: InstitutionalFeedPost | null = null;
      const pinnedId = profile?.pinnedPostId || targetUser?.pinnedPostId;
      if (pinnedId && subTab !== 'media' && !cursor) {
        const match = visible.find((p) => p.id === pinnedId);
        if (match) {
          resolvedPinned = { ...match, isPinned: true };
          visible = visible.filter((p) => p.id !== match.id);
        }
      } else if (pinnedId && subTab !== 'media' && cursor) {
        visible = visible.filter((p) => p.id !== pinnedId);
      }

      const paged = paginatePostsWithCursor(visible, cursor, 10);
      return {
        posts: paged.items,
        pinnedPost: resolvedPinned,
        nextCursor: paged.nextCursor,
        hasMore: paged.hasMore,
        totalCount: countAll
      };
    },
    [users, resolveLocalFallbackUser, identifier, currentUser, feedPosts, subTab, postTypeFilter, yearFilter, profile?.pinnedPostId]
  );

  const loadTimeline = useCallback(
    async (cursor?: string | null, append = false) => {
      if (!profile || profile.unavailable || subTab === 'about') {
        setPostsLoading(false);
        return;
      }

      if (append) {
        setLoadingMore(true);
      } else {
        setPostsLoading(true);
      }
      setPostsError(null);

      try {
        const params = new URLSearchParams();
        params.set('limit', '10');
        params.set('tab', subTab === 'media' ? 'media' : 'posts');
        if (postTypeFilter !== 'all') params.set('postType', postTypeFilter);
        if (yearFilter !== 'all') params.set('year', yearFilter);
        if (cursor) params.set('cursor', cursor);

        const res = await apiFetch(`/api/profiles/${encodeURIComponent(profile.uid)}/posts?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          const serverPosts: InstitutionalFeedPost[] = Array.isArray(data?.posts) ? data.posts : [];
          if (serverPosts.length > 0 || !append) {
            if (append) {
              setTimelinePosts((prev) => {
                const seen = new Set(prev.map((x) => x.id));
                return [...prev, ...serverPosts.filter((x) => !seen.has(x.id))];
              });
            } else {
              setPinnedPost(data.pinnedPost || null);
              setTimelinePosts(serverPosts);
            }
            setNextCursor(data.nextCursor || null);
            setHasMore(Boolean(data.hasMore));
            setTotalCount(typeof data.totalCount === 'number' ? data.totalCount : serverPosts.length);
            return;
          }
        }

        const local = computeLocalTimelinePage(profile.uid, cursor);
        if (append) {
          setTimelinePosts((prev) => {
            const seen = new Set(prev.map((x) => x.id));
            return [...prev, ...local.posts.filter((x) => !seen.has(x.id))];
          });
        } else {
          setPinnedPost(local.pinnedPost);
          setTimelinePosts(local.posts);
        }
        setNextCursor(local.nextCursor);
        setHasMore(local.hasMore);
        setTotalCount(local.totalCount);
      } catch {
        const local = computeLocalTimelinePage(profile.uid, cursor);
        if (!append && local.posts.length === 0 && !navigator.onLine) {
          setPostsError('Failed to load, retry');
        } else {
          if (append) {
            setTimelinePosts((prev) => {
              const seen = new Set(prev.map((x) => x.id));
              return [...prev, ...local.posts.filter((x) => !seen.has(x.id))];
            });
          } else {
            setPinnedPost(local.pinnedPost);
            setTimelinePosts(local.posts);
          }
          setNextCursor(local.nextCursor);
          setHasMore(local.hasMore);
          setTotalCount(local.totalCount);
        }
      } finally {
        setPostsLoading(false);
        setLoadingMore(false);
      }
    },
    [profile, subTab, postTypeFilter, yearFilter, computeLocalTimelinePage]
  );

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (profile && !profile.unavailable) {
      loadTimeline(null, false);
    }
  }, [profile?.uid, profile?.unavailable, subTab, postTypeFilter, yearFilter]);

  const isSelf = Boolean(currentUser?.uid && profile?.uid === currentUser.uid);

  // Load private moderation warnings on own profile
  useEffect(() => {
    if (!isSelf) {
      setMyWarnings([]);
      return;
    }
    let cancelled = false;
    apiFetch('/api/moderation/my-warnings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && Array.isArray(data?.warnings)) {
          setMyWarnings(data.warnings);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isSelf]);

  const localFullUser = useMemo(() => {
    if (!profile) return undefined;
    return users.find((u) => u.uid === profile.uid);
  }, [users, profile]);

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    years.add(String(new Date().getFullYear()));
    (feedPosts || [])
      .filter((p) => p.authorId === profile?.uid && !p.isAnonymous)
      .forEach((p) => {
        const y = new Date(p.createdAt).getFullYear();
        if (!Number.isNaN(y)) years.add(String(y));
      });
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [feedPosts, profile?.uid]);

  const handleComposerImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid JPEG, PNG, or WebP image.', 'error');
      return;
    }
    try {
      const compressed = await compressImage(file, 1080, 720, 0.85);
      setComposerImageUrl(compressed);
      showToast('Photo attached to your post.', 'success');
    } catch {
      showToast('Could not process image file.', 'error');
    }
    e.target.value = '';
  };

  const handlePublishFromProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composerContent.trim()) {
      showToast('Please write something before publishing.', 'error');
      return;
    }
    setIsPublishing(true);
    try {
      const tags = composerTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const result = await createSocialPost({
        title: composerTitle.trim() || 'Community Update',
        content: composerContent.trim(),
        postType: composerCategory,
        visibility: composerVisibility,
        targetBatch: composerVisibility === 'batch' ? composerBatch.trim() || currentUser?.batch : undefined,
        targetDepartment: composerVisibility === 'department' ? composerDepartment.trim() || currentUser?.course : undefined,
        imageUrl: composerImageUrl || undefined,
        tags: tags.length > 0 ? tags : undefined,
        isAnonymous: isComposerAnonymous
      });

      const created = result?.success ? result.post : undefined;
      if (created) {
        setComposerTitle('');
        setComposerContent('');
        setComposerImageUrl('');
        setComposerTags('');
        setIsComposerAnonymous(false);

        // Anonymous posts never appear on personal timeline
        if (!created.isAnonymous) {
          setTimelinePosts((prev) => [created, ...prev.filter((p) => p.id !== created.id)]);
          setTotalCount((c) => c + 1);
        }
      }
    } catch (err: any) {
      showToast(err?.message || 'Could not publish post.', 'error');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleCopyProfileLink = () => {
    const slug = profile?.username || profile?.uid || identifier;
    const url = `${window.location.origin}/profile/${encodeURIComponent(slug)}`;
    navigator.clipboard?.writeText(url);
    setCopiedUrl(true);
    showToast('Profile URL copied to clipboard.', 'success');
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const connected = profile ? isConnected(profile.uid) : false;
  const reqState = profile ? hasPendingRequestWith(profile.uid) : false;
  const pendingReq = profile
    ? friendRequests.find(
        (r) =>
          r.status === 'pending' &&
          ((r.fromUid === currentUser?.uid && r.toUid === profile.uid) ||
            (r.fromUid === profile.uid && r.toUid === currentUser?.uid))
      )
    : undefined;

  if (profileLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-pulse">
        <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200/90 dark:border-stone-800 overflow-hidden">
          <div className="h-44 sm:h-56 bg-stone-200 dark:bg-stone-800" />
          <div className="px-6 pb-8 -mt-12 space-y-4">
            <div className="w-28 h-28 rounded-2xl bg-stone-300 dark:bg-stone-700 border-4 border-white dark:border-stone-900" />
            <div className="h-7 w-56 bg-stone-200 dark:bg-stone-800 rounded-lg" />
            <div className="h-4 w-80 bg-stone-100 dark:bg-stone-800/70 rounded-lg" />
          </div>
        </div>
        {[1, 2].map((n) => (
          <div
            key={n}
            className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/80 dark:border-stone-800 p-6 space-y-3"
          >
            <div className="h-4 w-40 bg-stone-200 dark:bg-stone-800 rounded" />
            <div className="h-4 w-full bg-stone-100 dark:bg-stone-800/70 rounded" />
            <div className="h-4 w-3/4 bg-stone-100 dark:bg-stone-800/70 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="max-w-xl mx-auto bg-white dark:bg-stone-900 rounded-3xl border border-stone-200/90 dark:border-stone-800 p-10 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-stone-100 dark:bg-stone-800 text-stone-500 flex items-center justify-center mx-auto">
          <Users className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">Alumni profile not found</h2>
        <p className="text-xs text-stone-500 dark:text-stone-400">
          This profile link may have changed or the member record is no longer active.
        </p>
        <button
          type="button"
          onClick={closeSubRoute}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#8B181B] hover:bg-[#721316] text-white rounded-xl text-xs font-bold cursor-pointer min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Feed</span>
        </button>
      </div>
    );
  }

  if (profileError || !profile) {
    return (
      <div className="max-w-xl mx-auto bg-white dark:bg-stone-900 rounded-3xl border border-stone-200/90 dark:border-stone-800 p-10 text-center space-y-4">
        <AlertTriangle className="w-8 h-8 text-amber-600 mx-auto" />
        <p className="text-sm font-bold text-stone-900 dark:text-stone-100">{profileError || 'Failed to load, retry'}</p>
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={closeSubRoute}
            className="px-4 py-2.5 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-xl text-xs font-semibold cursor-pointer min-h-[44px]"
          >
            Back
          </button>
          <button
            type="button"
            onClick={loadProfile}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#8B181B] text-white rounded-xl text-xs font-bold cursor-pointer min-h-[44px]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      </div>
    );
  }

  if (profile.unavailable) {
    return (
      <div className="max-w-xl mx-auto bg-white dark:bg-stone-900 rounded-3xl border border-stone-200/90 dark:border-stone-800 p-10 text-center space-y-4 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.03)]">
        <div className="w-12 h-12 rounded-2xl bg-stone-100 dark:bg-stone-800 text-stone-500 flex items-center justify-center mx-auto">
          <Ban className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">
          {profile.name === 'Former alumni' ? 'Former alumni' : 'This account is unavailable'}
        </h2>
        <p className="text-xs text-stone-500 dark:text-stone-400">
          {profile.unavailableReason || 'This account is unavailable.'}
        </p>
        <div className="flex items-center justify-center gap-2.5 pt-2">
          <button
            type="button"
            onClick={closeSubRoute}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 rounded-xl text-xs font-semibold cursor-pointer min-h-[44px]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Feed</span>
          </button>
          {profile.isBlockedByViewer && (
            <button
              type="button"
              onClick={async () => {
                await unblockUser(profile.uid);
                loadProfile();
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#8B181B] hover:bg-[#721316] text-white rounded-xl text-xs font-bold cursor-pointer min-h-[44px]"
            >
              <span>Unblock Account</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      {/* Back Navigation Bar */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={closeSubRoute}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 text-xs font-semibold text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors cursor-pointer min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4 stroke-[1.75]" />
          <span>Back to Feed</span>
        </button>

        <button
          type="button"
          onClick={handleCopyProfileLink}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 text-xs font-semibold text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white transition-colors cursor-pointer min-h-[44px]"
        >
          <Copy className="w-3.5 h-3.5 stroke-[1.75]" />
          <span>{copiedUrl ? 'Profile Link Copied' : 'Copy Profile URL'}</span>
        </button>
      </div>

      {/* Hero Profile Header */}
      <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200/90 dark:border-stone-800 overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.03)]">
        <div className="relative h-44 sm:h-60 bg-stone-900 overflow-hidden">
          <img
            src={getCoverPhoto(profile.coverPhotoUrl)}
            alt={`${profile.name} cover`}
            onError={handleCoverPhotoError}
            onClick={() =>
              setViewerImage({
                url: getCoverPhoto(profile.coverPhotoUrl),
                title: `${profile.name} — Cover Photo`
              })
            }
            className="w-full h-full object-cover opacity-90 cursor-pointer hover:opacity-100 transition-opacity"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-stone-950/70 via-stone-950/15 to-transparent pointer-events-none" />
        </div>

        <div className="px-5 sm:px-8 pb-7">
          <div className="relative flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-14 sm:-mt-16 mb-5">
            <img
              src={getUserAvatar(profile.profilePictureUrl)}
              alt={profile.name}
              onError={handleUserAvatarError}
              onClick={() =>
                setViewerImage({
                  url: getUserAvatar(profile.profilePictureUrl),
                  title: `${profile.name} — Profile Photo`
                })
              }
              className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl object-cover border-4 border-white dark:border-stone-900 shadow-lg bg-stone-100 dark:bg-stone-800 cursor-pointer"
            />

            <div className="flex flex-wrap items-center gap-2">
              {isSelf ? (
                <button
                  type="button"
                  onClick={() => openEditProfile()}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#8B181B] hover:bg-[#721316] text-white rounded-xl text-xs font-bold cursor-pointer min-h-[44px]"
                >
                  <span>Edit Profile & Privacy</span>
                </button>
              ) : (
                <>
                  {connected ? (
                    <>
                      <span className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-xs font-semibold min-h-[44px]">
                        <Check className="w-4 h-4" />
                        <span>Connected</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          closeSubRoute();
                          getOrCreateChat(profile.uid);
                          setActiveTab('messages');
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#8B181B] hover:bg-[#721316] text-white rounded-xl text-xs font-bold cursor-pointer min-h-[44px]"
                      >
                        <MessageSquare className="w-4 h-4" />
                        <span>Message</span>
                      </button>
                    </>
                  ) : reqState === 'sent' ? (
                    <button
                      type="button"
                      onClick={() => setShowCancelRequestConfirm(true)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 rounded-xl text-xs font-semibold cursor-pointer min-h-[44px]"
                    >
                      <Clock className="w-4 h-4" />
                      <span>Request Sent</span>
                    </button>
                  ) : reqState === 'received' ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => pendingReq && acceptFriendRequest(pendingReq.id)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer min-h-[44px]"
                      >
                        <Check className="w-4 h-4" />
                        <span>Accept</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => pendingReq && declineFriendRequest(pendingReq.id)}
                        className="inline-flex items-center gap-1 px-3 py-2.5 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-xl text-xs font-semibold cursor-pointer min-h-[44px]"
                      >
                        <X className="w-4 h-4" />
                        <span>Decline</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => sendFriendRequest(profile.uid)}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#8B181B] hover:bg-[#721316] text-white rounded-xl text-xs font-bold cursor-pointer min-h-[44px]"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Connect</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowBlockConfirm(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2.5 bg-stone-100 dark:bg-stone-800 hover:bg-red-50 dark:hover:bg-red-950/40 text-stone-600 dark:text-stone-300 hover:text-red-700 dark:hover:text-red-400 rounded-xl text-xs font-semibold border border-stone-200 dark:border-stone-700 cursor-pointer min-h-[44px]"
                    title="Block user"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>Block</span>
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 dark:text-white tracking-tight">
                {profile.name}
              </h1>
              {profile.isVerified && (
                <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 stroke-[2.2]" />
              )}
              {profile.username && (
                <span className="text-xs font-mono text-stone-500 dark:text-stone-400">
                  @{profile.username}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400 font-medium flex-wrap">
              <span className="uppercase font-bold tracking-wider text-[#8B181B] dark:text-red-400">
                {profile.role}
              </span>
              {profile.batch && (
                <>
                  <span>·</span>
                  <span>Batch {profile.batch}</span>
                </>
              )}
              {profile.course && (
                <>
                  <span>·</span>
                  <span>{profile.course}</span>
                </>
              )}
            </div>

            {profile.headline && (
              <p className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed max-w-3xl">
                {profile.headline}
              </p>
            )}

            {/* Privacy-Gated Contact & Career Metadata */}
            <div className="pt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-stone-600 dark:text-stone-300">
              {profile.location && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-stone-400" />
                  <span>{profile.location}</span>
                </span>
              )}
              {(profile.currentPosition || profile.company) && (
                <span className="inline-flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-stone-400" />
                  <span>
                    {[profile.currentPosition, profile.company].filter(Boolean).join(' at ')}
                  </span>
                </span>
              )}
              {profile.email && (
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-stone-400" />
                  <span>{profile.email}</span>
                </span>
              )}
              {profile.phone && (
                <span className="inline-flex items-center gap-1.5 font-mono tabular-nums">
                  <Phone className="w-3.5 h-3.5 text-stone-400" />
                  <span>{profile.phone}</span>
                </span>
              )}
            </div>
          </div>

          {/* Metrics Ribbon */}
          <div className="mt-5 grid grid-cols-3 gap-3 p-3.5 bg-stone-50/90 dark:bg-stone-800/50 rounded-2xl border border-stone-200/70 dark:border-stone-700/60 text-center">
            <div>
              <div className="text-lg font-bold font-mono tabular-nums text-stone-900 dark:text-white">
                {totalCount || profile.postsCount || 0}
              </div>
              <div className="text-[11px] text-stone-500 dark:text-stone-400">Published Posts</div>
            </div>
            <div className="border-x border-stone-200/70 dark:border-stone-700/60">
              <div className="text-lg font-bold font-mono tabular-nums text-stone-900 dark:text-white">
                {profile.connectionsCount || 0}
              </div>
              <div className="text-[11px] text-stone-500 dark:text-stone-400">Connections</div>
            </div>
            <div>
              <div className="text-lg font-bold font-mono tabular-nums text-[#8B181B] dark:text-red-400">
                {profile.batch || '—'}
              </div>
              <div className="text-[11px] text-stone-500 dark:text-stone-400">Batch</div>
            </div>
          </div>

          {/* Sub-Tabs */}
          <div className="mt-6 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-6">
              {(
                [
                  { id: 'posts', label: 'Posts', icon: Megaphone },
                  { id: 'media', label: 'Media', icon: ImageIcon },
                  { id: 'about', label: 'About', icon: FileText }
                ] as const
              ).map((tab) => {
                const Icon = tab.icon;
                const active = subTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSubTab(tab.id)}
                    className={`pb-3 text-xs sm:text-sm font-bold border-b-2 transition-colors inline-flex items-center gap-1.5 cursor-pointer min-h-[44px] ${
                      active
                        ? 'border-[#8B181B] text-[#8B181B] dark:border-red-400 dark:text-red-400'
                        : 'border-transparent text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200'
                    }`}
                  >
                    <Icon className="w-4 h-4 stroke-[1.75]" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {subTab !== 'about' && (
              <div className="flex items-center gap-2 pb-2">
                <select
                  value={postTypeFilter}
                  onChange={(e) => setPostTypeFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-xs text-stone-700 dark:text-stone-200"
                >
                  <option value="all">All types</option>
                  <option value="update">Community Update</option>
                  <option value="gallery">Campus Gallery</option>
                  <option value="announcement">Announcement</option>
                </select>
                <select
                  value={yearFilter}
                  onChange={(e) => setYearFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-xs text-stone-700 dark:text-stone-200"
                >
                  <option value="all">All years</option>
                  {availableYears.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Private Moderation Notices (Owner Only) */}
      {isSelf && myWarnings.length > 0 && (
        <div className="bg-amber-50/90 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider">
            <ShieldAlert className="w-4 h-4" />
            <span>Private Moderation Notices ({myWarnings.length})</span>
          </div>
          <div className="space-y-2.5">
            {myWarnings.map((w) => (
              <div
                key={w.id}
                className="bg-white dark:bg-stone-900 border border-amber-200/80 dark:border-amber-900/50 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1 text-xs">
                  <div className="font-bold text-stone-900 dark:text-stone-100">{w.reason}</div>
                  <p className="text-stone-600 dark:text-stone-300 leading-relaxed">{w.message}</p>
                  <div
                    className="text-[11px] text-stone-400"
                    title={formatFullLocalDateTime(w.createdAt)}
                  >
                    Issued {formatRelativeTime(w.createdAt)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setAppealTarget({
                      postId: w.postId,
                      warningId: w.id,
                      actionType: w.actionType || 'warning',
                      reason: w.reason
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-900 dark:bg-stone-800 hover:bg-stone-800 text-white text-xs font-semibold shrink-0 cursor-pointer min-h-[44px]"
                >
                  <Scale className="w-3.5 h-3.5" />
                  <span>Appeal Decision</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Own Profile Inline Post Composer */}
      {isSelf && subTab === 'posts' && (
        <form
          onSubmit={handlePublishFromProfile}
          className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/90 dark:border-stone-800 p-5 space-y-3 shadow-[0_1px_3px_rgba(0,0,0,0.03)]"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
              Share to Feed &amp; Timeline
            </span>
            <span className="text-[11px] text-stone-400 dark:text-stone-500">
              Publishes to main feed and your profile simultaneously
            </span>
          </div>

          <input
            ref={composerRef}
            type="text"
            value={composerTitle}
            onChange={(e) => setComposerTitle(e.target.value)}
            placeholder="Headline or post title (optional)"
            className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-sm font-semibold text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-[#8B181B]"
          />

          <textarea
            rows={3}
            value={composerContent}
            onChange={(e) => setComposerContent(e.target.value)}
            placeholder="Share a career update, alumni gathering recap, or mentorship note..."
            className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-sm text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-[#8B181B] leading-relaxed"
          />

          {composerImageUrl && (
            <div className="relative rounded-xl overflow-hidden max-h-56 border border-stone-200 dark:border-stone-700">
              <img src={composerImageUrl} alt="Upload preview" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => setComposerImageUrl('')}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 text-white cursor-pointer"
                aria-label="Remove image"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={composerCategory}
              onChange={(e) => setComposerCategory(e.target.value as 'update' | 'gallery' | 'announcement')}
              className="px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-xs font-semibold text-stone-700 dark:text-stone-200 min-h-[44px]"
            >
              <option value="update">Community Update</option>
              <option value="gallery">Campus Gallery</option>
              <option value="announcement">Announcement</option>
            </select>

            <select
              value={composerVisibility}
              onChange={(e) => setComposerVisibility(e.target.value as PostVisibility)}
              className="px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-xs font-semibold text-stone-700 dark:text-stone-200 min-h-[44px]"
            >
              <option value="alumni">Alumni Only</option>
              <option value="public">Public</option>
              <option value="batch">Batch Only</option>
              <option value="department">Department Only</option>
              <option value="private">Private (Only Me)</option>
            </select>

            {composerVisibility === 'batch' && (
              <input
                type="text"
                value={composerBatch}
                onChange={(e) => setComposerBatch(e.target.value)}
                placeholder="Batch year (e.g. 2023)"
                className="px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-xs text-stone-800 dark:text-stone-200 w-36 min-h-[44px]"
              />
            )}

            {composerVisibility === 'department' && (
              <input
                type="text"
                value={composerDepartment}
                onChange={(e) => setComposerDepartment(e.target.value)}
                placeholder="Course / Department"
                className="px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-xs text-stone-800 dark:text-stone-200 w-44 min-h-[44px]"
              />
            )}

            <input
              ref={composerFileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleComposerImageUpload}
            />
            <button
              type="button"
              onClick={() => composerFileRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-xs font-semibold text-stone-700 dark:text-stone-200 cursor-pointer min-h-[44px]"
            >
              <ImageIcon className="w-4 h-4" />
              <span>Photo</span>
            </button>

            <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800/70 border border-stone-200 dark:border-stone-700 text-xs text-stone-600 dark:text-stone-300 cursor-pointer min-h-[44px]">
              <input
                type="checkbox"
                checked={isComposerAnonymous}
                onChange={(e) => setIsComposerAnonymous(e.target.checked)}
                className="accent-[#8B181B]"
              />
              <EyeOff className="w-3.5 h-3.5" />
              <span>Post Anonymously</span>
            </label>

            <button
              type="submit"
              disabled={isPublishing || !composerContent.trim()}
              className="ml-auto inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#8B181B] hover:bg-[#721316] disabled:opacity-50 text-white rounded-xl text-xs font-bold cursor-pointer min-h-[44px]"
            >
              {isPublishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span>Publish</span>
            </button>
          </div>

          {isComposerAnonymous && (
            <p className="text-[11px] text-amber-700 dark:text-amber-400">
              Anonymous posts appear only on the main feed without your name and will never appear on your profile timeline.
            </p>
          )}
        </form>
      )}

      {/* Sub-Tab Body */}
      {subTab === 'about' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/90 dark:border-stone-800 p-6 space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-stone-900 dark:text-white">
              Biography
            </h2>
            <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 leading-relaxed whitespace-pre-line">
              {profile.about || 'No biography provided yet.'}
            </p>
          </div>

          <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/90 dark:border-stone-800 p-6 space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-stone-900 dark:text-white">
              Academic &amp; Career Record
            </h2>
            {localFullUser && (localFullUser.experience || []).length > 0 ? (
              <div className="space-y-3">
                {localFullUser.experience.map((exp) => (
                  <div
                    key={exp.id}
                    className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200/60 dark:border-stone-700/50 text-xs"
                  >
                    <div className="font-bold text-stone-900 dark:text-white">{exp.title}</div>
                    <div className="text-stone-600 dark:text-stone-300 mt-0.5">
                      {exp.company} • {exp.startDate}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-stone-500 dark:text-stone-400">
                {profile.course ? `${profile.course} (Batch ${profile.batch || '—'})` : 'Cecilian Alumni Member'}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {postsLoading ? (
            <div className="space-y-4 animate-pulse">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/80 dark:border-stone-800 p-6 space-y-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-stone-200 dark:bg-stone-800" />
                    <div className="space-y-1.5">
                      <div className="h-3.5 w-36 bg-stone-200 dark:bg-stone-800 rounded" />
                      <div className="h-3 w-24 bg-stone-100 dark:bg-stone-800/70 rounded" />
                    </div>
                  </div>
                  <div className="h-4 w-full bg-stone-100 dark:bg-stone-800/70 rounded" />
                  <div className="h-4 w-2/3 bg-stone-100 dark:bg-stone-800/70 rounded" />
                </div>
              ))}
            </div>
          ) : postsError ? (
            <div className="bg-white dark:bg-stone-900 rounded-2xl border border-red-200 dark:border-red-900/50 p-8 text-center space-y-3">
              <AlertTriangle className="w-7 h-7 text-red-600 mx-auto" />
              <p className="text-sm font-bold text-stone-900 dark:text-stone-100">{postsError}</p>
              <button
                type="button"
                onClick={() => loadTimeline(null, false)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#8B181B] text-white rounded-xl text-xs font-bold cursor-pointer min-h-[44px]"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            </div>
          ) : !pinnedPost && timelinePosts.length === 0 ? (
            <div className="bg-white dark:bg-stone-900 rounded-2xl border border-dashed border-stone-300 dark:border-stone-700 p-10 text-center space-y-3">
              <Megaphone className="w-9 h-9 text-stone-400 mx-auto" />
              <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">No posts yet</h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 max-w-md mx-auto">
                {isSelf
                  ? 'Posts you publish on the main feed or here appear on your timeline automatically.'
                  : 'This alumni member has not published any visible posts yet.'}
              </p>
              {isSelf && (
                <button
                  type="button"
                  onClick={() => {
                    setSubTab('posts');
                    setTimeout(() => composerRef.current?.focus(), 50);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#8B181B] hover:bg-[#721316] text-white rounded-xl text-xs font-bold cursor-pointer min-h-[44px]"
                >
                  <span>Share your first post</span>
                </button>
              )}
            </div>
          ) : (
            <>
              {pinnedPost && (
                <PostCard
                  key={`pinned-${pinnedPost.id}`}
                  post={pinnedPost}
                  isPinnedOnProfile={true}
                  showPinControl={isSelf}
                  onImageClick={(url, title) => setViewerImage({ url, title })}
                  onPostUpdated={(updated) => setPinnedPost(updated)}
                  onPostDeleted={() => {
                    setPinnedPost(null);
                    setTotalCount((c) => Math.max(0, c - 1));
                  }}
                  onPostPinned={(newPinnedId) => {
                    if (!newPinnedId) {
                      setTimelinePosts((prev) => [pinnedPost, ...prev].sort(comparePostsCreatedDesc));
                      setPinnedPost(null);
                    }
                  }}
                />
              )}

              {timelinePosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  isPinnedOnProfile={false}
                  showPinControl={isSelf}
                  onImageClick={(url, title) => setViewerImage({ url, title })}
                  onPostUpdated={(updated) =>
                    setTimelinePosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
                  }
                  onPostDeleted={(postId) => {
                    setTimelinePosts((prev) => prev.filter((p) => p.id !== postId));
                    setTotalCount((c) => Math.max(0, c - 1));
                  }}
                  onPostPinned={(newPinnedId) => {
                    if (newPinnedId === post.id) {
                      const prevPinned = pinnedPost;
                      setPinnedPost({ ...post, isPinned: true });
                      setTimelinePosts((prev) => {
                        const withoutNew = prev.filter((p) => p.id !== post.id);
                        return prevPinned ? [prevPinned, ...withoutNew].sort(comparePostsCreatedDesc) : withoutNew;
                      });
                    }
                  }}
                />
              ))}

              {hasMore && (
                <div className="pt-2 flex justify-center">
                  <button
                    type="button"
                    disabled={loadingMore}
                    onClick={() => loadTimeline(nextCursor, true)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs font-bold text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 cursor-pointer min-h-[44px]"
                  >
                    {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>{loadingMore ? 'Loading...' : 'Load more'}</span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Modals */}
      <ImageViewerModal
        isOpen={Boolean(viewerImage)}
        imageUrl={viewerImage?.url || ''}
        title={viewerImage?.title || 'Image Viewer'}
        onClose={() => setViewerImage(null)}
      />

      {appealTarget && (
        <AppealPostModal
          isOpen={true}
          postId={appealTarget.postId}
          warningId={appealTarget.warningId}
          actionType={appealTarget.actionType}
          reasonSummary={appealTarget.reason}
          onClose={() => setAppealTarget(null)}
        />
      )}

      <ConfirmationModal
        isOpen={showBlockConfirm}
        onClose={() => setShowBlockConfirm(false)}
        onConfirm={async () => {
          setShowBlockConfirm(false);
          await blockUser(profile.uid);
          loadProfile();
        }}
        title={`Block ${profile.name}`}
        message={`Blocking ${profile.name} hides their posts, comments, and profile from you and prevents them from viewing yours.`}
        confirmLabel="Block User"
        cancelLabel="Cancel"
        variant="danger"
      />

      <ConfirmationModal
        isOpen={showCancelRequestConfirm}
        onClose={() => setShowCancelRequestConfirm(false)}
        onConfirm={() => {
          if (pendingReq) cancelFriendRequest(pendingReq.id);
          setShowCancelRequestConfirm(false);
        }}
        title="Withdraw Connection Request"
        message={`Withdraw your pending connection request to ${profile.name}?`}
        confirmLabel="Withdraw Request"
        cancelLabel="Keep Request"
        variant="warning"
      />
    </div>
  );
};
