/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ThumbsUp, Heart, Sparkles, Lightbulb, MessageSquare, Share2 } from 'lucide-react';
import { FeedItem, FeedReactionType } from '../../../types/feed';

interface FeedCardActionsProps {
  item: FeedItem;
  onReact: (reaction: FeedReactionType) => void;
  onToggleComments: () => void;
  onShare: () => void;
  isCommentsOpen: boolean;
}

const REACTION_CONFIG: Record<FeedReactionType, { label: string; icon: any; color: string; bg: string }> = {
  like: { label: 'Like', icon: ThumbsUp, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/60' },
  love: { label: 'Love', icon: Heart, color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-950/60' },
  celebrate: { label: 'Celebrate', icon: Sparkles, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/60' },
  insightful: { label: 'Insightful', icon: Lightbulb, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/60' }
};

export const FeedCardActions: React.FC<FeedCardActionsProps> = ({
  item,
  onReact,
  onToggleComments,
  onShare,
  isCommentsOpen
}) => {
  const [showReactionPicker, setShowReactionPicker] = useState(false);

  const activeReaction = item.reactions.userReaction;
  const ActiveIcon = activeReaction ? REACTION_CONFIG[activeReaction].icon : ThumbsUp;

  return (
    <div className="pt-3 border-t border-stone-100 dark:border-stone-800 space-y-2">
      {/* Reaction Counts Summary Bar */}
      {(item.reactions.count > 0 || item.commentsCount > 0) && (
        <div className="flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400 px-1 pb-1">
          <div className="flex items-center gap-1.5">
            <span className="flex items-center -space-x-1">
              <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[9px] ring-1 ring-white">👍</span>
              <span className="w-4 h-4 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center text-[9px] ring-1 ring-white">❤️</span>
              <span className="w-4 h-4 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-[9px] ring-1 ring-white">👏</span>
            </span>
            <span className="font-semibold text-stone-700 dark:text-stone-300">{item.reactions.count}</span>
          </div>

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

      {/* Main Interactive Action Buttons */}
      <div className="flex items-center justify-between gap-1 relative select-none">
        {/* Floating Multi-Reaction Picker Popover */}
        {showReactionPicker && (
          <div
            onMouseLeave={() => setShowReactionPicker(false)}
            className="absolute -top-12 left-0 bg-white dark:bg-stone-850 border border-stone-200/90 dark:border-stone-700 rounded-full px-2 py-1 shadow-lg flex items-center gap-1 z-30 animate-in fade-in zoom-in-95 duration-150"
          >
            {(Object.keys(REACTION_CONFIG) as FeedReactionType[]).map((type) => {
              const cfg = REACTION_CONFIG[type];
              const Icon = cfg.icon;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    onReact(type);
                    setShowReactionPicker(false);
                  }}
                  className="p-1.5 hover:scale-125 transition-transform rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                  title={cfg.label}
                >
                  <Icon className={`w-5 h-5 ${cfg.color} stroke-[2]`} />
                </button>
              );
            })}
          </div>
        )}

        {/* Reaction Button */}
        <div className="relative">
          <button
            type="button"
            onMouseEnter={() => setShowReactionPicker(true)}
            onClick={() => onReact(activeReaction ? activeReaction : 'like')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
              activeReaction
                ? `${REACTION_CONFIG[activeReaction].bg} ${REACTION_CONFIG[activeReaction].color}`
                : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-900'
            }`}
          >
            <ActiveIcon className="w-4 h-4 stroke-[1.75]" />
            <span>{activeReaction ? REACTION_CONFIG[activeReaction].label : 'React'}</span>
          </button>
        </div>

        {/* Comment Button */}
        <button
          type="button"
          onClick={onToggleComments}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
            isCommentsOpen
              ? 'bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100'
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
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-900 transition-colors cursor-pointer"
        >
          <Share2 className="w-4 h-4 stroke-[1.75]" />
          <span>Share</span>
        </button>
      </div>
    </div>
  );
};
