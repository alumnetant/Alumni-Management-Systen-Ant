/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useCallback } from 'react';
import { ArrowLeft, AlertTriangle, RefreshCw } from 'lucide-react';
import { InstitutionalFeedPost } from '../../types';
import { useAlumni } from '../../context/AlumniContext';
import { apiFetch } from '../../services/apiClient';
import { PostCard } from './PostCard';
import { ImageViewerModal } from '../common/ImageViewerModal';
import { canUserViewPost, hydratePostWithLiveAuthor } from '../../lib/postVisibility';

interface PostPermalinkViewProps {
  postId: string;
}

export const PostPermalinkView: React.FC<PostPermalinkViewProps> = ({ postId }) => {
  const { currentUser, users, feedPosts, closeSubRoute } = useAlumni();
  const [post, setPost] = useState<InstitutionalFeedPost | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [viewerImage, setViewerImage] = useState<{ url: string; title: string } | null>(null);

  const loadPost = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await apiFetch(`/api/posts/${encodeURIComponent(postId)}`);
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.post) {
          setPost(data.post);
          setIsLoading(false);
          return;
        }
      } else if (res.status === 403 || res.status === 404) {
        const errData = await res.json().catch(() => null);
        setErrorMsg(errData?.error || 'This post is unavailable or you do not have permission to view it.');
        setIsLoading(false);
        return;
      }
    } catch {
      // Fallback below if offline / local state
    }

    const localPost = feedPosts.find((p) => p.id === postId);
    if (localPost) {
      const authorAcc = users.find((u) => u.uid === localPost.authorId);
      const allowed = canUserViewPost(localPost, {
        surface: 'permalink',
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
        authorAccount: authorAcc
      });
      if (allowed) {
        setPost(hydratePostWithLiveAuthor(localPost, authorAcc, currentUser));
      } else {
        setErrorMsg('You do not have permission to view this post.');
      }
    } else {
      setErrorMsg('Post not found or has been removed.');
    }
    setIsLoading(false);
  }, [postId, feedPosts, users, currentUser]);

  useEffect(() => {
    void loadPost();
  }, [loadPost]);

  return (
    <div className="w-full max-w-3xl mx-auto lg:py-4 lg:space-y-5">
      <div className="hidden lg:flex items-center justify-between">
        <button
          type="button"
          onClick={closeSubRoute}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-xs font-semibold text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors cursor-pointer min-h-[40px]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Feed</span>
        </button>
      </div>

      {isLoading ? (
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6 space-y-4 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-stone-200 dark:bg-stone-800" />
            <div className="space-y-2 flex-1">
              <div className="h-3.5 bg-stone-200 dark:bg-stone-800 rounded w-1/3" />
              <div className="h-2.5 bg-stone-100 dark:bg-stone-800 rounded w-1/4" />
            </div>
          </div>
          <div className="h-4 bg-stone-200 dark:bg-stone-800 rounded w-2/3" />
          <div className="h-20 bg-stone-100 dark:bg-stone-800 rounded" />
        </div>
      ) : errorMsg || !post ? (
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-8 text-center space-y-3">
          <AlertTriangle className="w-8 h-8 mx-auto text-amber-600" />
          <h2 className="text-base font-bold text-stone-900 dark:text-white">
            Post Unavailable
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 max-w-md mx-auto">
            {errorMsg || 'Failed to load post.'}
          </p>
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => void loadPost()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-xs font-semibold text-stone-700 dark:text-stone-300 hover:bg-stone-200 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
            <button
              type="button"
              onClick={closeSubRoute}
              className="px-4 py-2 rounded-xl bg-[#8B181B] text-white text-xs font-bold hover:bg-[#721316] cursor-pointer"
            >
              Return to Feed
            </button>
          </div>
        </div>
      ) : (
        <PostCard
          post={post}
          autoOpenComments={true}
          onImageClick={(url, title) => setViewerImage({ url, title })}
          onPostUpdated={(updated) => setPost(updated)}
          onPostDeleted={() => closeSubRoute()}
          onPostReported={(pid) =>
            setPost((prev) => (prev && prev.id === pid ? { ...prev, viewerHasReported: true } : prev))
          }
        />
      )}

      <ImageViewerModal
        isOpen={Boolean(viewerImage)}
        imageUrl={viewerImage?.url || ''}
        title={viewerImage?.title || 'Post Attachment'}
        onClose={() => setViewerImage(null)}
      />
    </div>
  );
};
