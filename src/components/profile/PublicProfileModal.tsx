/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Ban,
  Briefcase,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileDown,
  GraduationCap,
  Mail,
  MapPin,
  Megaphone,
  MessageSquare,
  Phone,
  UserPlus,
  X
} from 'lucide-react';
import { useAlumni } from '../../context/AlumniContext';
import { PdfResumePreviewModal } from './PdfResumePreviewModal';
import { ImageViewerModal } from '../common/ImageViewerModal';
import { ConfirmationModal } from '../common/ConfirmationModal';
import {
  getCoverPhoto,
  getUserAvatar,
  handleCoverPhotoError,
  handleUserAvatarError
} from '../../lib/defaultImages';
import { isEmployerVisibleInDirectory } from '../../lib/employerValidation';
import {
  areUsersBlocked,
  canUserViewPost,
  comparePostsCreatedDesc,
  hydratePostWithLiveAuthor,
  isAccountDeleted,
  isAccountUnavailable,
  isStaffOrModeratorRole,
  slugifyUsername
} from '../../lib/postVisibility';
import { PostCard } from '../social/PostCard';

export const PublicProfileModal: React.FC = () => {
  const {
    users,
    currentUser,
    selectedUserIdForModal,
    setSelectedUserIdForModal,
    isConnected,
    hasPendingRequestWith,
    friendRequests,
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    cancelFriendRequest,
    getOrCreateChat,
    setActiveTab,
    feedPosts,
    openProfile,
    blockUser,
    unblockUser
  } = useAlumni();

  const [viewerImage, setViewerImage] = useState<{ url: string; title: string } | null>(null);
  const [showCancelRequestConfirm, setShowCancelRequestConfirm] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [showResumePreview, setShowResumePreview] = useState(false);

  const targetUser = useMemo(
    () => (selectedUserIdForModal ? users.find((u) => u.uid === selectedUserIdForModal) : undefined),
    [users, selectedUserIdForModal]
  );

  const viewerContext = useMemo(
    () =>
      currentUser
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
    [currentUser]
  );

  const targetUserPosts = useMemo(() => {
    if (!targetUser || !viewerContext) return [];
    return (feedPosts || [])
      .filter((p) =>
        canUserViewPost(p, {
          surface: 'profile',
          viewer: viewerContext,
          targetProfileUid: targetUser.uid,
          authorAccount: targetUser
        })
      )
      .map((p) => hydratePostWithLiveAuthor(p, targetUser, viewerContext))
      .sort(comparePostsCreatedDesc);
  }, [feedPosts, targetUser, viewerContext]);

  if (!selectedUserIdForModal || !currentUser || !targetUser) return null;

  const isPrivilegedViewer = isStaffOrModeratorRole(currentUser.role);
  if ((targetUser.role === 'admin' || targetUser.role === 'superadmin') && !isPrivilegedViewer) {
    return null;
  }

  const isAlumniViewer = currentUser.role === 'alumni';
  if (targetUser.role === 'employer' && isAlumniViewer && !isEmployerVisibleInDirectory(targetUser)) {
    return null;
  }

  const isSelf = currentUser.uid === targetUser.uid;
  const isBlockedByViewer = Boolean(currentUser.blockedUsers?.includes(targetUser.uid));
  const blocked = !isSelf && areUsersBlocked(currentUser.uid, targetUser.uid, currentUser, targetUser);
  const unavailable = !isSelf && (blocked || isAccountUnavailable(targetUser));

  const showEmail = isSelf || isPrivilegedViewer || Boolean(targetUser.show_email ?? targetUser.showEmail);
  const showPhone = isSelf || isPrivilegedViewer || Boolean(targetUser.show_phone ?? targetUser.showPhone);
  const showEmployer =
    isSelf || isPrivilegedViewer || (targetUser.show_current_employer ?? targetUser.showCurrentEmployer ?? true);

  const connected = isConnected(targetUser.uid);
  const reqState = hasPendingRequestWith(targetUser.uid);

  const pendingReq = friendRequests.find(
    (r) =>
      r.status === 'pending' &&
      ((r.fromUid === currentUser.uid && r.toUid === targetUser.uid) ||
        (r.fromUid === targetUser.uid && r.toUid === currentUser.uid))
  );

  if (typeof document === 'undefined') return null;

  const profileSlug = targetUser.username || slugifyUsername(targetUser.name || targetUser.uid) || targetUser.uid;

  const modalElement = (
    <>
      <div
        className="fixed inset-0 z-[75] bg-black/60 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 pt-safe pb-safe animate-in fade-in"
        onClick={(e) => {
          if (e.target === e.currentTarget) setSelectedUserIdForModal(null);
        }}
      >
        <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-800 w-full max-w-2xl max-h-[90dvh] overflow-hidden flex flex-col animate-in zoom-in-95 transition-colors">
          {unavailable && !isPrivilegedViewer ? (
            <div className="p-8 text-center space-y-4">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedUserIdForModal(null)}
                  className="p-2 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <Ban className="w-10 h-10 text-stone-400 mx-auto" />
              <h2 className="text-lg font-bold text-stone-900 dark:text-white">
                {isAccountDeleted(targetUser) ? 'Former alumni' : 'This account is unavailable'}
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                This profile and its posts are currently unavailable.
              </p>
              {isBlockedByViewer && (
                <button
                  type="button"
                  onClick={() => unblockUser(targetUser.uid)}
                  className="px-4 py-2.5 bg-[#8B181B] hover:bg-[#721316] text-white rounded-xl text-xs font-bold cursor-pointer min-h-[44px]"
                >
                  Unblock Account
                </button>
              )}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {/* Cover Photo Header */}
              <div className="relative h-44 sm:h-52 bg-stone-800 shrink-0">
                <img
                  src={getCoverPhoto(targetUser.coverPhotoUrl)}
                  alt="Cover"
                  onError={handleCoverPhotoError}
                  onClick={() =>
                    setViewerImage({
                      url: getCoverPhoto(targetUser.coverPhotoUrl),
                      title: `${targetUser.name} — Cover Photo`
                    })
                  }
                  className="w-full h-full object-cover opacity-90 dark:opacity-80 cursor-pointer hover:opacity-100 transition-opacity"
                  title="Click to view full cover photo"
                />
                <button
                  type="button"
                  onClick={() => setSelectedUserIdForModal(null)}
                  className="absolute top-4 right-4 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors cursor-pointer z-20 border border-white/10"
                  aria-label="Close profile"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Profile Card Body */}
              <div className="px-4 sm:px-6 pb-6">
                <div className="relative flex flex-col sm:flex-row sm:items-end justify-between gap-3.5 -mt-12 sm:-mt-14 mb-5">
                  <div className="relative self-start shrink-0 z-10">
                    <img
                      src={getUserAvatar(targetUser.profilePictureUrl)}
                      alt={targetUser.name}
                      onError={handleUserAvatarError}
                      onClick={() =>
                        setViewerImage({
                          url: getUserAvatar(targetUser.profilePictureUrl),
                          title: `${targetUser.name} — Profile Picture`
                        })
                      }
                      className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover border-4 border-white dark:border-stone-900 shadow-lg bg-stone-100 dark:bg-stone-800 ring-1 ring-stone-900/10 dark:ring-stone-700/50 aspect-square cursor-pointer"
                    />
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto pt-1 sm:pt-0">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedUserIdForModal(null);
                        openProfile(profileSlug);
                      }}
                      className="justify-center flex items-center gap-1.5 px-3.5 py-2.5 bg-stone-900 hover:bg-stone-800 dark:bg-stone-800 dark:hover:bg-stone-700 text-white rounded-xl text-xs font-semibold shadow-xs cursor-pointer transition-colors min-h-[44px]"
                    >
                      <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      <span>{targetUser.role === 'employer' ? 'View Full Profile' : 'View Full Profile & Timeline'}</span>
                    </button>

                    {isSelf && (
                      <button
                        type="button"
                        onClick={() => setShowResumePreview(true)}
                        className="justify-center flex items-center gap-2 px-3.5 py-2.5 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-100 rounded-xl text-xs font-semibold cursor-pointer min-h-[44px]"
                      >
                        <FileDown className="w-4 h-4 shrink-0" />
                        <span>PDF Resume</span>
                      </button>
                    )}

                    {!isSelf && (
                      <>
                        {connected ? (
                          <div className="flex items-center gap-2">
                            <div className="justify-center flex items-center gap-1.5 px-3 py-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200/90 dark:border-emerald-800/60 rounded-xl text-xs font-semibold min-h-[44px]">
                              <Check className="w-4 h-4 shrink-0" />
                              <span>Connected</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedUserIdForModal(null);
                                getOrCreateChat(targetUser.uid);
                                setActiveTab('messages');
                              }}
                              className="justify-center flex items-center gap-1.5 px-3.5 py-2.5 bg-[#8B181B] hover:bg-[#721316] text-white rounded-xl text-xs font-semibold shadow-xs cursor-pointer min-h-[44px]"
                            >
                              <MessageSquare className="w-4 h-4" />
                              <span>Message</span>
                            </button>
                          </div>
                        ) : reqState === 'sent' ? (
                          <button
                            type="button"
                            onClick={() => setShowCancelRequestConfirm(true)}
                            className="justify-center flex items-center gap-1.5 px-3.5 py-2.5 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 border border-amber-200/90 dark:border-amber-800/60 rounded-xl text-xs font-semibold cursor-pointer min-h-[44px]"
                          >
                            <Clock className="w-4 h-4 shrink-0" />
                            <span>Request Sent</span>
                          </button>
                        ) : reqState === 'received' ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => pendingReq && acceptFriendRequest(pendingReq.id)}
                              className="justify-center flex items-center gap-1.5 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold cursor-pointer min-h-[44px]"
                            >
                              <Check className="w-4 h-4" />
                              <span>Accept</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => pendingReq && declineFriendRequest(pendingReq.id)}
                              className="justify-center flex items-center gap-1 px-3 py-2.5 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 rounded-xl text-xs font-semibold cursor-pointer min-h-[44px]"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => sendFriendRequest(targetUser.uid)}
                            className="justify-center flex items-center gap-1.5 px-4 py-2.5 bg-[#8B181B] hover:bg-[#721316] text-white rounded-xl text-xs font-semibold shadow-xs cursor-pointer min-h-[44px]"
                          >
                            <UserPlus className="w-4 h-4 shrink-0" />
                            <span>Connect</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setShowBlockConfirm(true)}
                          className="justify-center flex items-center gap-1 px-3 py-2.5 bg-stone-100 dark:bg-stone-800 hover:bg-red-50 dark:hover:bg-red-950/40 text-stone-600 dark:text-stone-300 hover:text-red-700 rounded-xl text-xs font-semibold cursor-pointer min-h-[44px]"
                          title="Block user"
                        >
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* User Details */}
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-white tracking-tight">
                      {targetUser.name}
                    </h2>
                    {targetUser.role === 'alumni' && targetUser.isVerified && (
                      <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Verified Alum</span>
                      </span>
                    )}
                    <span className="uppercase text-[11px] font-bold tracking-wider text-stone-500 dark:text-stone-400">
                      {targetUser.role}
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm font-medium text-stone-600 dark:text-stone-300 mt-1 leading-relaxed">
                    {targetUser.headline || 'St. Cecilia’s College Alumnus'}
                  </p>

                  <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-stone-500 dark:text-stone-400">
                    <span className="flex items-center gap-1 text-[#8B181B] dark:text-red-400 font-semibold">
                      <GraduationCap className="w-3.5 h-3.5" />
                      Batch of {targetUser.batch || '—'} • {targetUser.course || 'Degree Program'}
                    </span>
                    {targetUser.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-stone-400" />
                        {targetUser.location}
                      </span>
                    )}
                    {showEmployer && (targetUser.currentPosition || targetUser.company) && (
                      <span className="flex items-center gap-1">
                        <Briefcase className="w-3.5 h-3.5 text-stone-400" />
                        {[targetUser.currentPosition, targetUser.company].filter(Boolean).join(' at ')}
                      </span>
                    )}
                    {showEmail && targetUser.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5 text-stone-400" />
                        {targetUser.email}
                      </span>
                    )}
                    {showPhone && targetUser.phone && (
                      <span className="flex items-center gap-1 font-mono tabular-nums">
                        <Phone className="w-3.5 h-3.5 text-stone-400" />
                        {targetUser.phone}
                      </span>
                    )}
                  </div>
                </div>

                {/* Metrics Row */}
                <div className={`mt-4 p-3 bg-stone-50 dark:bg-stone-800/60 rounded-xl border border-stone-200/80 dark:border-stone-700/60 grid ${targetUser.role === 'employer' ? 'grid-cols-2' : 'grid-cols-3'} text-center`}>
                  <div>
                    <span className="text-base font-bold text-stone-900 dark:text-white block font-mono tabular-nums">
                      {targetUser.connectionsCount || 0}
                    </span>
                    <span className="text-[11px] text-stone-500 dark:text-stone-400 font-medium">Connections</span>
                  </div>
                  <div>
                    <span className="text-base font-bold text-stone-900 dark:text-white block font-mono tabular-nums">
                      {targetUser.batch || '2024'}
                    </span>
                    <span className="text-[11px] text-stone-500 dark:text-stone-400 font-medium">
                      {targetUser.role === 'employer' ? 'Partner Cohort' : 'Graduation Batch'}
                    </span>
                  </div>
                  {targetUser.role !== 'employer' && (
                    <div>
                      <span className="text-base font-bold text-[#8B181B] dark:text-red-400 block font-mono tabular-nums">
                        {targetUserPosts.length}
                      </span>
                      <span className="text-[11px] text-stone-500 dark:text-stone-400 font-medium">Timeline Posts</span>
                    </div>
                  )}
                </div>

                {/* About Section */}
                <div className="mt-5">
                  <h3 className="font-sans text-sm font-bold text-stone-900 dark:text-white tracking-tight uppercase mb-1.5">
                    About
                  </h3>
                  <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 leading-relaxed whitespace-pre-line bg-stone-50/60 dark:bg-stone-800/40 p-3.5 rounded-xl border border-stone-200/60 dark:border-stone-700/50">
                    {targetUser.about || 'No bio written yet.'}
                  </p>
                </div>

                {/* Personal Timeline Posts (Hidden for Employer profiles) */}
                {targetUser.role !== 'employer' && (
                  <div className="mt-6">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-sans text-sm font-bold text-stone-900 dark:text-white tracking-tight uppercase flex items-center gap-1.5">
                        <Megaphone className="w-3.5 h-3.5 text-[#8B181B] dark:text-red-400" />
                        <span>Timeline Posts ({targetUserPosts.length})</span>
                      </h3>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedUserIdForModal(null);
                          openProfile(profileSlug);
                        }}
                        className="text-xs font-semibold text-[#8B181B] dark:text-red-400 hover:underline cursor-pointer"
                      >
                        Open Timeline Page
                      </button>
                    </div>

                    {targetUserPosts.length === 0 ? (
                      <div className="p-4 bg-stone-50 dark:bg-stone-800/40 rounded-xl border border-dashed border-stone-200 dark:border-stone-700 text-center text-xs text-stone-400">
                        No posts yet.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {targetUserPosts.slice(0, 5).map((post) => (
                          <PostCard
                            key={post.id}
                            post={post}
                            onImageClick={(url, title) => setViewerImage({ url, title })}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <ImageViewerModal
        isOpen={Boolean(viewerImage)}
        imageUrl={viewerImage?.url || ''}
        title={viewerImage?.title || 'Image Viewer'}
        onClose={() => setViewerImage(null)}
      />

      <ConfirmationModal
        isOpen={showCancelRequestConfirm}
        onClose={() => setShowCancelRequestConfirm(false)}
        onConfirm={() => {
          if (pendingReq) cancelFriendRequest(pendingReq.id);
          setShowCancelRequestConfirm(false);
        }}
        title="Withdraw Connection Request"
        message={`Are you sure you want to withdraw your pending connection request to ${targetUser.name}?`}
        confirmLabel="Withdraw Request"
        cancelLabel="Keep Request"
        variant="warning"
      />

      <ConfirmationModal
        isOpen={showBlockConfirm}
        onClose={() => setShowBlockConfirm(false)}
        onConfirm={() => {
          setShowBlockConfirm(false);
          setSelectedUserIdForModal(null);
          blockUser(targetUser.uid);
        }}
        title={`Block ${targetUser.name}`}
        message={`Blocking ${targetUser.name} hides their posts, comments, and profile from you and prevents them from viewing yours.`}
        confirmLabel="Block User"
        cancelLabel="Cancel"
        variant="danger"
      />

      <PdfResumePreviewModal
        isOpen={showResumePreview}
        onClose={() => setShowResumePreview(false)}
        targetUser={targetUser}
      />
    </>
  );

  return createPortal(modalElement, document.body);
};
