/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Heart, MessageSquare, Share2, X, User } from 'lucide-react';
import { FeedItem, FeedReactionType } from '../../../types/feed';
import { useAlumni } from '../../../context/AlumniContext';
import { getUserAvatar, handleUserAvatarError } from '../../../lib/defaultImages';

interface FeedCardActionsProps {
  item: FeedItem;
  onReact: (reaction: FeedReactionType) => void;
  onToggleComments: () => void;
  onShare: () => void;
  isCommentsOpen: boolean;
}

export const FeedCardActions: React.FC<FeedCardActionsProps> = ({
  item,
  onReact,
  onToggleComments,
  onShare,
  isCommentsOpen
}) => {
  const { currentUser, users, showToast, setSelectedUserIdForModal } = useAlumni();
  const [showReactorsModal, setShowReactorsModal] = useState(false);

  // Reaction state: Restrict to 'Heart' only
  const isHearted = item.reactions.userReaction === 'love';
  const heartsCount = item.reactions.count;

  // Self-congratulations prevention: User cannot congratulate/react to their own achievement post
  const isOwnPost = currentUser?.uid && item.author.uid === currentUser.uid;
  const isAchievementPost = item.type === 'milestone' || (item.rawItem && (item.rawItem.type === 'achievement' || item.rawItem.badge));
  const isSelfAchievement = Boolean(isOwnPost && isAchievementPost);

  const handleHeartClick = () => {
    if (isSelfAchievement) {
      showToast('You cannot congratulate or react to your own achievement post.', 'info');
      return;
    }
    // Toggle heart (love)
    onReact('love');
  };

  // Resolve reactor users for modal
  const reactorUsers = React.useMemo(() => {
    const rawIds: string[] = item.rawItem?.hearts || item.rawItem?.likes || [];
    if (rawIds.length === 0 && isHearted && currentUser) {
      return [currentUser];
    }
    return rawIds
      .map((id) => users.find((u) => u.uid === id))
      .filter(Boolean) as typeof users;
  }, [item.rawItem, users, isHearted, currentUser]);

  return (
    <div className="pt-3 border-t border-stone-100 dark:border-stone-800 space-y-2">
      {/* Reaction Counts Summary Bar - Clicking opens who reacted modal */}
      {(heartsCount > 0 || item.commentsCount > 0) && (
        <div className="flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400 px-1 pb-1">
          {heartsCount > 0 ? (
            <button
              type="button"
              onClick={() => setShowReactorsModal(true)}
              className="flex items-center gap-1.5 hover:underline cursor-pointer group"
              title="Click to view who reacted with Heart"
            >
              <span className="w-4 h-4 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-[10px] ring-1 ring-rose-200">
                <Heart className="w-2.5 h-2.5 fill-rose-600 text-rose-600" />
              </span>
              <span className="font-semibold text-stone-700 dark:text-stone-300 group-hover:text-rose-600 transition-colors">
                {heartsCount} {heartsCount === 1 ? 'heart' : 'hearts'}
              </span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            {item.commentsCount > 0 && (
              <button
                type="button"
                onClick={onToggleComments}
                className="hover:underline cursor-pointer"
              >
                {item.commentsCount} {item.commentsCount === 1 ? 'comment' : 'comments'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Interactive Action Buttons: Restrict to Heart, Comment, Share */}
      <div className="flex items-center justify-between gap-1 relative select-none">
        {/* Heart Reaction Button */}
        <button
          type="button"
          onClick={handleHeartClick}
          disabled={isSelfAchievement}
          className={`min-h-[44px] flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            isSelfAchievement
              ? 'opacity-50 cursor-not-allowed text-stone-400 bg-stone-50 dark:bg-stone-850'
              : isHearted
              ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 font-bold'
              : 'text-stone-600 dark:text-stone-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-stone-800'
          }`}
          title={isSelfAchievement ? 'You cannot react to your own achievement' : isHearted ? 'Remove Heart' : 'Heart this post'}
        >
          <Heart className={`w-4 h-4 transition-transform active:scale-125 ${isHearted ? 'fill-rose-600 text-rose-600' : 'text-stone-500'}`} />
          <span>{isHearted ? 'Hearted' : 'Heart'}</span>
        </button>

        {/* Comment Button */}
        <button
          type="button"
          onClick={onToggleComments}
          className={`min-h-[44px] flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
            isCommentsOpen
              ? 'bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-bold'
              : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-900'
          }`}
        >
          <MessageSquare className="w-4 h-4 stroke-[1.75]" />
          <span>Comment</span>
        </button>

        {/* Share Button */}
        <button
          type="button"
          onClick={onShare}
          className="min-h-[44px] flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-900 transition-colors cursor-pointer"
        >
          <Share2 className="w-4 h-4 stroke-[1.75]" />
          <span>Share</span>
        </button>
      </div>

      {/* Modal: View who reacted with Heart */}
      {showReactorsModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setShowReactorsModal(false)}
        >
          <div
            className="w-full max-w-sm bg-white dark:bg-stone-900 rounded-2xl p-4 shadow-xl border border-stone-200 dark:border-stone-800 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-stone-100 dark:border-stone-800">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
                  <Heart className="w-3.5 h-3.5 fill-rose-600" />
                </span>
                <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                  Heart Reactions ({heartsCount})
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowReactorsModal(false)}
                className="p-1 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 divide-y divide-stone-100 dark:divide-stone-800">
              {reactorUsers.length > 0 ? (
                reactorUsers.map((reactor) => (
                  <div
                    key={reactor.uid}
                    onClick={() => {
                      setShowReactorsModal(false);
                      setSelectedUserIdForModal(reactor.uid);
                    }}
                    className="flex items-center gap-3 pt-2 first:pt-0 hover:bg-stone-50 dark:hover:bg-stone-800/60 p-2 rounded-xl transition-colors cursor-pointer"
                  >
                    <img
                      src={getUserAvatar(reactor.profilePictureUrl)}
                      alt={reactor.name}
                      onError={handleUserAvatarError}
                      className="w-8 h-8 rounded-full object-cover border border-stone-200 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate">
                        {reactor.name}
                      </p>
                      <p className="text-[10px] text-stone-500 dark:text-stone-400 truncate">
                        {reactor.course || reactor.role || 'Cecilian Community'}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-4 text-center text-xs text-stone-500">
                  {heartsCount} Cecilian{heartsCount === 1 ? '' : 's'} reacted with Heart.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
