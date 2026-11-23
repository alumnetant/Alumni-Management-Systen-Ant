/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Award,
  Building2,
  Clock,
  EyeOff,
  Flag,
  Globe,
  GraduationCap,
  Heart,
  Image as ImageIcon,
  Lock,
  Maximize2,
  Megaphone,
  MessageSquare,
  Pencil,
  Pin,
  PinOff,
  Repeat2,
  Send,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Users,
  X
} from 'lucide-react';
import { InstitutionalFeedPost } from '../../types';
import { useAlumni } from '../../context/AlumniContext';
import { formatFullLocalDateTime, formatRelativeTime } from '../../lib/dateUtils';
import { getUserAvatar, handleUserAvatarError } from '../../lib/defaultImages';
import { DoubleTapHeartOverlay, InteractiveHeartReaction } from '../common/InteractiveHeartReaction';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { ReportPostModal } from './ReportPostModal';
import { HIGHLIGHT_RING_CLASS } from '../../hooks/useDeepLinkHighlight';
import { canReportPost } from '../../lib/postVisibility';

interface PostCardProps {
  post: InstitutionalFeedPost;
  isPinnedOnProfile?: boolean;
  showPinControl?: boolean;
  highlighted?: boolean;
  autoOpenComments?: boolean;
  onImageClick?: (url: string, title: string) => void;
  onPostUpdated?: (updated: InstitutionalFeedPost) => void;
  onPostDeleted?: (postId: string) => void;
  onPostShared?: (sharedPost: InstitutionalFeedPost) => void;
  onPostPinned?: (postId: string | null) => void;
  onPostReported?: (postId: string) => void;
}

export const PostCard: React.FC<PostCardProps> = ({
  post,
  isPinnedOnProfile = false,
  showPinControl = false,
  highlighted = false,
  autoOpenComments = false,
  onImageClick,
  onPostUpdated,
  onPostDeleted,
  onPostShared,
  onPostPinned,
  onPostReported
}) => {
  const {
    currentUser,
    users,
    toggleHeartFeedPost,
    addFeedPostComment,
    updateFeedPost,
    deleteFeedPost,
    shareFeedPost,
    pinProfilePost,
    openProfile,
    openPostPermalink,
    showToast
  } = useAlumni();

  const [showComments, setShowComments] = useState(autoOpenComments);
  const [commentText, setCommentText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(post.title || '');
  const [editContent, setEditContent] = useState(post.content || '');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareCommentary, setShareCommentary] = useState('');
  const [isSharing, setIsSharing] = useState(false);

  const isOwner = Boolean(currentUser?.uid && post.authorId === currentUser.uid && !post.authorDeleted);
  const isStaff = ['admin', 'superadmin', 'moderator'].includes(currentUser?.role || '');
  const canEditOrDelete = isOwner || (isStaff && !post.authorDeleted);
  const authorForRole =
    post.authorId && post.authorId !== 'anonymous' && post.authorId !== 'former_alumni'
      ? users.find((u) => u.uid === post.authorId)
      : undefined;
  const canReport = canReportPost(post, currentUser, authorForRole);
  const canClickAuthor = Boolean(
    !post.isAnonymous &&
      !post.authorDeleted &&
      post.authorId &&
      post.authorId !== 'anonymous' &&
      post.authorId !== 'former_alumni'
  );

  const liveAuthor = canClickAuthor ? authorForRole : undefined;
  const displayName = post.isAnonymous
    ? 'Anonymous Alumnus'
    : post.authorDeleted
    ? 'Former alumni'
    : liveAuthor?.name || post.authorName || 'Cecilian Alumnus';
  const displayAvatar = post.isAnonymous || post.authorDeleted
    ? ''
    : liveAuthor?.profilePictureUrl || post.authorAvatar || '';
  const profileTargetSlug = post.authorUsername || liveAuthor?.username || post.authorId;

  const reactorUids = Array.isArray(post.hearts)
    ? post.hearts
    : Array.isArray(post.likes)
    ? post.likes
    : [];
  const heartsCount = reactorUids.length;
  const isHeartedByMe = Boolean(currentUser?.uid && reactorUids.includes(currentUser.uid));
  const comments = Array.isArray(post.comments) ? post.comments : [];

  const isSelfPost = Boolean(isOwner && !post.isAnonymous);

  const handleToggleHeart = () => {
    if (isSelfPost) {
      showToast('You cannot congratulate or react to your own post.', 'info');
      return;
    }
    toggleHeartFeedPost(post.id);
    if (onPostUpdated && currentUser?.uid) {
      const nextHearts = isHeartedByMe
        ? reactorUids.filter((id) => id !== currentUser.uid)
        : [...reactorUids, currentUser.uid];
      onPostUpdated({ ...post, hearts: nextHearts, likes: nextHearts });
    }
  };

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    addFeedPostComment(post.id, commentText.trim());
    if (onPostUpdated && currentUser) {
      const newComment = {
        id: `comm_${Date.now()}`,
        authorId: currentUser.uid,
        authorName: currentUser.name,
        authorAvatar: currentUser.profilePictureUrl || '',
        authorRole: currentUser.role,
        text: commentText.trim(),
        createdAt: new Date().toISOString()
      };
      onPostUpdated({ ...post, comments: [...comments, newComment] });
    }
    setCommentText('');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editContent.trim()) {
      showToast('Post content cannot be empty.', 'warning');
      return;
    }
    const ok = updateFeedPost(post.id, {
      title: editTitle.trim(),
      content: editContent.trim(),
      isEdited: true,
      updatedAt: new Date().toISOString()
    });
    if (ok && onPostUpdated) {
      onPostUpdated({
        ...post,
        title: editTitle.trim(),
        content: editContent.trim(),
        isEdited: true,
        updatedAt: new Date().toISOString()
      });
    }
    setIsEditing(false);
  };

  const handleConfirmDelete = () => {
    deleteFeedPost(post.id);
    if (onPostDeleted) onPostDeleted(post.id);
    setShowDeleteConfirm(false);
  };

  const handleRepostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSharing(true);
    try {
      const result = await shareFeedPost(post.id, shareCommentary);
      if (result.success) {
        if (result.sharedPost && onPostShared) {
          onPostShared(result.sharedPost);
        }
        if (onPostUpdated) {
          onPostUpdated({ ...post, sharesCount: (post.sharesCount || 0) + 1 });
        }
        setShareCommentary('');
        setShowShareModal(false);
      }
    } finally {
      setIsSharing(false);
    }
  };

  const handleCopyPermalink = () => {
    const url = `${window.location.origin}/post/${encodeURIComponent(post.id)}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    showToast('Post link copied to clipboard!', 'success');
  };

  const handleToggleProfilePin = async () => {
    const nextPin = isPinnedOnProfile ? null : post.id;
    const ok = await pinProfilePost(nextPin);
    if (ok && onPostPinned) {
      onPostPinned(nextPin);
    }
  };

  const renderVisibilityBadge = () => {
    const vis = post.visibility || 'alumni';
    if (vis === 'public') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] text-stone-500 dark:text-stone-400" title="Visible publicly">
          <Globe className="w-3 h-3" />
          <span>Public</span>
        </span>
      );
    }
    if (vis === 'batch') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400" title={`Visible to Batch ${post.targetBatch || ''}`}>
          <GraduationCap className="w-3 h-3" />
          <span>Batch {post.targetBatch || ''}</span>
        </span>
      );
    }
    if (vis === 'department') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] text-sky-700 dark:text-sky-400" title={`Visible to ${post.targetDepartment || 'Department'}`}>
          <Building2 className="w-3 h-3" />
          <span>{post.targetDepartment || 'Department'}</span>
        </span>
      );
    }
    if (vis === 'group') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400" title={`Visible to ${post.groupName || 'Group'} members`}>
          <Users className="w-3 h-3" />
          <span>{post.groupName || 'Group'}</span>
        </span>
      );
    }
    if (vis === 'private') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] text-stone-500 dark:text-stone-400" title="Visible only to you">
          <Lock className="w-3 h-3" />
          <span>Only me</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-stone-500 dark:text-stone-400" title="Visible to verified Cecilian alumni">
        <Users className="w-3 h-3" />
        <span>Alumni</span>
      </span>
    );
  };

  const renderPostTypeBadge = () => {
    if (post.postType === 'announcement') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#8B181B] dark:text-rose-400">
          <Megaphone className="w-3 h-3" />
          <span>Announcement</span>
        </span>
      );
    }
    if (post.postType === 'gallery') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-stone-600 dark:text-stone-300">
          <ImageIcon className="w-3 h-3" />
          <span>Gallery</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-400">
        <Award className="w-3 h-3" />
        <span>Community Update</span>
      </span>
    );
  };

  const mediaUrl = post.imageUrl || post.mediaUrl;

  return (
    <>
      <article
        id={`feed-${post.id}`}
        data-notify-target-id={post.id}
        className={`bg-white dark:bg-[#000000] lg:dark:bg-stone-900 rounded-none lg:rounded-2xl border-0 border-b lg:border transition-all duration-200 overflow-hidden shadow-none lg:shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.03)] ${
          highlighted
            ? `border-[#8B181B] ${HIGHLIGHT_RING_CLASS}`
            : 'border-[#E5E7EB] dark:border-[#27272A] lg:border-stone-200/80 lg:dark:border-stone-800'
        }`}
      >
        {/* Top Shared / Pinned Strip */}
        {(post.sharedFromPostId || post.sharedLabel || post.isPinned || isPinnedOnProfile) && (
          <div className="px-4 sm:px-5 pt-3 pb-1 flex flex-wrap items-center gap-2.5 text-[11px] font-semibold text-stone-500 dark:text-stone-400">
            {(post.isPinned || isPinnedOnProfile) && (
              <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                <Pin className="w-3 h-3" />
                <span>{isPinnedOnProfile ? 'Pinned Post' : 'Pinned Announcement'}</span>
              </span>
            )}
            {(post.sharedFromPostId || post.sharedLabel) && (
              <span className="inline-flex items-center gap-1 text-stone-600 dark:text-stone-300">
                <Repeat2 className="w-3 h-3 text-[#8B181B] dark:text-red-400" />
                <span>
                  {post.sharedLabel || 'Shared'}
                  {post.sharedFromAuthorName ? ` from ${post.sharedFromAuthorName}` : ''}
                </span>
              </span>
            )}
          </div>
        )}

        {/* Private Moderation Warning Banner (Visible only to Author / Staff) */}
        {post.flaggedByModerators && post.flaggedMessage && (
          <div className="mx-4 sm:mx-5 mt-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-start gap-2 text-amber-900 dark:text-amber-200">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-700 dark:text-amber-400" />
              <div>
                <span className="font-bold block">Moderator Notice (Private to You)</span>
                <span className="text-amber-800 dark:text-amber-300">{post.flaggedMessage}</span>
              </div>
            </div>
          </div>
        )}

        {/* Hidden Pending Review Banner */}
        {post.underReviewAutoHidden && (
          <div className="mx-4 sm:mx-5 mt-3 p-2.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 flex items-center gap-2 text-xs text-red-800 dark:text-red-300">
            <EyeOff className="w-4 h-4 shrink-0" />
            <span>This post is temporarily hidden from the public feed while moderators review reports.</span>
          </div>
        )}

        {/* Header Row: Author Avatar, Name, Relative Time, Badges, & Action Controls */}
        <div className="px-4 sm:px-5 pt-4 pb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {post.isAnonymous ? (
              <div className="w-11 h-11 rounded-2xl bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 flex items-center justify-center shrink-0 text-stone-500">
                <EyeOff className="w-5 h-5" />
              </div>
            ) : post.authorDeleted ? (
              <div className="w-11 h-11 rounded-2xl bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 flex items-center justify-center shrink-0 text-stone-400">
                <Users className="w-5 h-5" />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => openProfile(profileTargetSlug)}
                className="relative shrink-0 cursor-pointer group focus:outline-none"
                title={`View ${displayName}'s profile`}
              >
                <img
                  src={getUserAvatar(displayAvatar)}
                  alt={displayName}
                  onError={handleUserAvatarError}
                  referrerPolicy="no-referrer"
                  className="w-10 h-10 lg:w-11 lg:h-11 rounded-full lg:rounded-2xl object-cover ring-1 ring-stone-200 dark:ring-stone-700 group-hover:ring-[#8B181B] transition-all"
                />
                {liveAuthor?.isVerified && (
                  <span
                    title="Verified Cecilian"
                    className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#8B181B] text-white flex items-center justify-center ring-2 ring-white dark:ring-stone-900"
                  >
                    <ShieldCheck className="w-2.5 h-2.5 stroke-[2.5]" />
                  </span>
                )}
              </button>
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {canClickAuthor ? (
                  <button
                    type="button"
                    onClick={() => openProfile(profileTargetSlug)}
                    className="text-sm font-bold text-stone-900 dark:text-white hover:text-[#8B181B] dark:hover:text-red-400 hover:underline truncate cursor-pointer text-left"
                  >
                    {displayName}
                  </button>
                ) : (
                  <span className="text-sm font-bold text-stone-700 dark:text-stone-300 truncate">
                    {displayName}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400 mt-0.5 flex-wrap tabular-nums">
                {renderPostTypeBadge()}
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={() => openPostPermalink(post.id)}
                  title={formatFullLocalDateTime(post.createdAt)}
                  className="inline-flex items-center gap-1 hover:text-stone-800 dark:hover:text-stone-200 hover:underline cursor-pointer"
                >
                  <Clock className="w-3 h-3" />
                  <span>{formatRelativeTime(post.createdAt)}</span>
                </button>
                {post.isEdited && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span
                      className="text-[11px] font-medium text-stone-400 dark:text-stone-500"
                      title={post.updatedAt ? `Edited ${formatFullLocalDateTime(post.updatedAt)}` : 'Edited post'}
                    >
                      edited
                    </span>
                  </>
                )}
                <span aria-hidden="true">·</span>
                {renderVisibilityBadge()}
              </div>
            </div>
          </div>

          {/* Owner Edit / Delete / Pin Controls OR Non-Owner Report Control */}
          <div className="flex items-center gap-1 shrink-0">
            {showPinControl && isOwner && (
              <button
                type="button"
                onClick={handleToggleProfilePin}
                className={`p-2 rounded-xl transition-colors cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center ${
                  isPinnedOnProfile
                    ? 'text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300'
                    : 'text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800'
                }`}
                title={isPinnedOnProfile ? 'Unpin from profile' : 'Pin to top of profile'}
                aria-label={isPinnedOnProfile ? 'Unpin post' : 'Pin post'}
              >
                {isPinnedOnProfile ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
              </button>
            )}

            {canEditOrDelete && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setEditTitle(post.title || '');
                    setEditContent(post.content || '');
                    setIsEditing(true);
                  }}
                  className="p-2 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-colors cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center"
                  title="Edit post"
                  aria-label="Edit post"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-2 text-stone-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center"
                  title="Delete post"
                  aria-label="Delete post"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}

            {canReport && (
              <button
                type="button"
                onClick={() => setShowReportModal(true)}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer min-h-[38px] ${
                  post.viewerHasReported
                    ? 'bg-red-50 text-[#8B181B] dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-900/50'
                    : 'text-stone-500 hover:text-[#8B181B] dark:text-stone-400 dark:hover:text-red-400 hover:bg-stone-100 dark:hover:bg-stone-800'
                }`}
                title="Report this post to moderators"
              >
                <Flag className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{post.viewerHasReported ? 'Reported' : 'Report'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="px-4 sm:px-5 pb-4 space-y-2.5">
          {post.title && (
            <h3 className="text-base font-bold text-stone-900 dark:text-white leading-snug">
              {post.title}
            </h3>
          )}

          <p className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed whitespace-pre-line">
            {post.content}
          </p>

          {Array.isArray(post.tags) && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {post.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="text-[11px] font-semibold text-stone-600 dark:text-stone-300 bg-stone-100 dark:bg-stone-800 px-2 py-0.5 rounded-md"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Media Attachment */}
        {mediaUrl && (
          <DoubleTapHeartOverlay
            disabled={isSelfPost}
            onTrigger={() => {
              if (!isSelfPost) {
                handleToggleHeart();
              } else {
                showToast('You cannot congratulate or react to your own post.', 'info');
              }
            }}
          >
            <div className="relative group overflow-hidden bg-stone-900 max-h-[440px] flex items-center justify-center border-y border-stone-200 dark:border-stone-800">
              <img
                src={mediaUrl}
                alt={post.title || 'Post attachment'}
                referrerPolicy="no-referrer"
                onClick={() => onImageClick && onImageClick(mediaUrl, post.title || 'Post Image')}
                className="w-full h-full object-cover max-h-[440px] transition-transform duration-300 group-hover:scale-[1.01] cursor-pointer"
              />
              {onImageClick && (
                <button
                  type="button"
                  onClick={() => onImageClick(mediaUrl, post.title || 'Post Image')}
                  className="absolute bottom-3 right-3 p-2 rounded-lg bg-black/60 hover:bg-black/80 text-white text-xs backdrop-blur-xs flex items-center gap-1 transition-opacity opacity-0 group-hover:opacity-100 cursor-pointer"
                  title="Expand image"
                >
                  <Maximize2 className="w-4 h-4" />
                  <span>Expand</span>
                </button>
              )}
            </div>
          </DoubleTapHeartOverlay>
        )}

        {/* Engagement Stats Strip (No raw emojis) */}
        <div className="px-4 sm:px-5 py-2.5 flex items-center justify-between text-xs text-stone-500 dark:text-stone-400 border-t border-b border-stone-100 dark:border-stone-800 tabular-nums">
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-2xs">
              <Heart className="w-3 h-3 fill-current" />
            </span>
            <span className="font-semibold text-stone-700 dark:text-stone-300">
              {heartsCount} {heartsCount === 1 ? 'heart' : 'hearts'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowComments((prev) => !prev)}
              className="hover:underline cursor-pointer flex items-center gap-1 text-stone-600 dark:text-stone-300 hover:text-[#8B181B]"
            >
              <span>{comments.length} {comments.length === 1 ? 'comment' : 'comments'}</span>
            </button>
            <span aria-hidden="true">·</span>
            <span>{post.sharesCount || 0} {post.sharesCount === 1 ? 'share' : 'shares'}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="px-2 sm:px-4 py-1.5 grid grid-cols-3 gap-1 text-xs font-semibold text-stone-600 dark:text-stone-300">
          <InteractiveHeartReaction
            isHearted={isHeartedByMe}
            heartsCount={heartsCount}
            onToggle={handleToggleHeart}
            reactorUids={reactorUids}
            allUsers={users}
            disabled={isSelfPost}
            variant="button"
            label={isSelfPost ? 'Own Post' : isHeartedByMe ? 'Hearted' : 'Heart'}
            className={`w-full ${isSelfPost ? 'opacity-50 cursor-not-allowed' : ''}`}
          />

          <button
            type="button"
            onClick={() => setShowComments((prev) => !prev)}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-xl transition-colors cursor-pointer min-h-[44px] ${
              showComments
                ? 'bg-red-50 dark:bg-red-950/40 text-[#8B181B] dark:text-red-300 font-bold'
                : 'hover:bg-stone-100 dark:hover:bg-stone-800'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Comment</span>
          </button>

          <button
            type="button"
            onClick={() => setShowShareModal(true)}
            className="flex items-center justify-center gap-1.5 py-2 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer min-h-[44px]"
          >
            <Share2 className="w-4 h-4" />
            <span>Share</span>
          </button>
        </div>

        {/* Expandable Inline Comments Thread */}
        {showComments && (
          <div className="px-4 sm:px-5 py-4 bg-stone-50/70 dark:bg-stone-950/50 border-t border-stone-100 dark:border-stone-800 space-y-3">
            {comments.length === 0 ? (
              <p className="text-xs text-stone-400 dark:text-stone-500 text-center py-1">
                No comments yet. Start the conversation below.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {comments.map((c) => {
                  const commentUser = users.find((u) => u.uid === c.authorId);
                  const canOpenCommenter = Boolean(c.authorId && c.authorId !== 'anonymous');
                  return (
                    <div key={c.id} className="flex items-start gap-2.5 text-xs">
                      <button
                        type="button"
                        disabled={!canOpenCommenter}
                        onClick={() => canOpenCommenter && openProfile(commentUser?.username || c.authorId)}
                        className={canOpenCommenter ? 'cursor-pointer shrink-0' : 'shrink-0'}
                      >
                        <img
                          src={getUserAvatar(commentUser?.profilePictureUrl || c.authorAvatar)}
                          alt={c.authorName}
                          onError={handleUserAvatarError}
                          className="w-7 h-7 rounded-lg object-cover border border-stone-200 dark:border-stone-700"
                        />
                      </button>
                      <div className="flex-1 bg-white dark:bg-stone-900 rounded-xl px-3 py-2 border border-stone-200/70 dark:border-stone-800">
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            disabled={!canOpenCommenter}
                            onClick={() => canOpenCommenter && openProfile(commentUser?.username || c.authorId)}
                            className={`font-bold text-stone-900 dark:text-white ${
                              canOpenCommenter ? 'hover:text-[#8B181B] hover:underline cursor-pointer' : ''
                            }`}
                          >
                            {commentUser?.name || c.authorName}
                          </button>
                          <span
                            className="text-[10px] text-stone-400"
                            title={formatFullLocalDateTime(c.createdAt)}
                          >
                            {formatRelativeTime(c.createdAt)}
                          </span>
                        </div>
                        <p className="text-stone-700 dark:text-stone-300 mt-0.5 leading-relaxed">
                          {c.text}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {currentUser && (
              <form onSubmit={handleCommentSubmit} className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Write a comment..."
                  className="flex-1 px-3.5 py-2 text-base lg:text-xs bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-[#8B181B]/20 focus:border-[#8B181B] min-h-[44px] lg:min-h-[40px]"
                />
                <button
                  type="submit"
                  disabled={!commentText.trim()}
                  aria-label="Send comment"
                  className="px-3.5 py-2 rounded-xl bg-[#8B181B] hover:bg-[#721316] disabled:opacity-50 text-white text-xs font-bold inline-flex items-center justify-center gap-1 cursor-pointer min-h-[44px] min-w-[44px] lg:min-h-[40px]"
                >
                  <Send className="w-4 h-4 lg:w-3.5 lg:h-3.5" />
                  <span className="hidden sm:inline">Send</span>
                </button>
              </form>
            )}
          </div>
        )}
      </article>

      {/* Edit Post Modal */}
      {isEditing && (
        <div
          className="fixed inset-0 z-[75] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsEditing(false);
          }}
        >
          <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
              <div className="flex items-center gap-2">
                <Pencil className="w-4 h-4 text-[#8B181B] dark:text-red-400" />
                <h3 className="text-base font-bold text-stone-900 dark:text-white">Edit Post</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Content
                </label>
                <textarea
                  rows={4}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-900 dark:text-white leading-relaxed"
                  required
                />
              </div>

              <p className="text-[11px] text-stone-400 dark:text-stone-500">
                Editing updates your post content everywhere while keeping its original timeline position and timestamp.
              </p>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 dark:text-stone-300 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#8B181B] hover:bg-[#721316] cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Share / Repost Modal */}
      {showShareModal && (
        <div
          className="fixed inset-0 z-[75] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSharing) setShowShareModal(false);
          }}
        >
          <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
              <div className="flex items-center gap-2">
                <Repeat2 className="w-4 h-4 text-[#8B181B] dark:text-red-400" />
                <h3 className="text-base font-bold text-stone-900 dark:text-white">Share Post</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRepostSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Add commentary (optional)
                </label>
                <textarea
                  rows={3}
                  value={shareCommentary}
                  onChange={(e) => setShareCommentary(e.target.value)}
                  placeholder="Share your thoughts with this repost to your timeline..."
                  className="w-full px-3 py-2 text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-900 dark:text-white resize-none"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-100 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => {
                    handleCopyPermalink();
                    setShowShareModal(false);
                  }}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-stone-700 dark:text-stone-300 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 cursor-pointer"
                >
                  Copy Direct Link
                </button>
                <button
                  type="submit"
                  disabled={isSharing}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#8B181B] hover:bg-[#721316] disabled:opacity-60 cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Repeat2 className="w-3.5 h-3.5" />
                  <span>Repost to Timeline</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Post"
        message={`Are you sure you want to permanently remove "${post.title || 'this post'}"? It will disappear from the main feed and your profile timeline.`}
        confirmLabel="Delete Post"
        cancelLabel="Cancel"
        variant="danger"
      />

      {/* Report Post Modal */}
      {canReport && (
        <ReportPostModal
          isOpen={showReportModal}
          targetType="post"
          targetId={post.id}
          targetTitle={post.title || post.content}
          postSnapshot={post}
          onClose={() => setShowReportModal(false)}
          onReported={(pid) => {
            if (onPostUpdated) {
              onPostUpdated({ ...post, viewerHasReported: true });
            }
            if (onPostReported) onPostReported(pid);
          }}
        />
      )}
    </>
  );
};
