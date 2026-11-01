/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Megaphone, AlertCircle, Paperclip, ExternalLink, ArrowRight } from 'lucide-react';
import { FeedItem, FeedReactionType } from '../../../types/feed';
import { FeedCardHeader } from './FeedCardHeader';
import { FeedCardActions } from './FeedCardActions';
import { FeedCommentsDrawer } from './FeedCommentsDrawer';

interface FeedAnnouncementCardProps {
  item: FeedItem;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
  onReact: (reaction: FeedReactionType) => void;
  onAddComment: (text: string) => void;
  onShare: () => void;
  onOpenDetailModal?: (announcement: any) => void;
}

export const FeedAnnouncementCard: React.FC<FeedAnnouncementCardProps> = ({
  item,
  isBookmarked,
  onToggleBookmark,
  onReact,
  onAddComment,
  onShare,
  onOpenDetailModal
}) => {
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const shouldTruncate = item.body.length > 150;

  return (
    <article className="bg-white dark:bg-stone-900 rounded-2xl sm:rounded-3xl border border-stone-200/90 dark:border-stone-800 p-3.5 sm:p-5 md:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:shadow-md transition-all duration-200 space-y-3.5 sm:space-y-4 relative overflow-hidden">
      {/* Top Accent for Urgent Items */}
      {item.metadata?.isUrgent && (
        <div className="h-1 bg-red-600 absolute top-0 left-0 right-0" />
      )}

      {/* Card Header */}
      <FeedCardHeader
        item={item}
        isBookmarked={isBookmarked}
        onToggleBookmark={onToggleBookmark}
      />

      {/* Category Kicker */}
      <div className="flex items-center gap-2 text-xs font-semibold text-[#8B181B] dark:text-rose-400 uppercase tracking-wider">
        <Megaphone className="w-3.5 h-3.5" />
        <span>{item.categoryTag}</span>
      </div>

      {/* Title & Body */}
      <div className="space-y-2">
        <h3
          onClick={() => onOpenDetailModal?.(item.rawItem)}
          className="text-base sm:text-lg font-bold text-stone-900 dark:text-stone-100 hover:text-[#8B181B] transition-colors cursor-pointer leading-snug"
        >
          {item.title}
        </h3>

        <div className="text-xs sm:text-sm text-stone-700 dark:text-stone-300 leading-relaxed whitespace-pre-line">
          {shouldTruncate && !isExpanded ? (
            <>
              <span className="line-clamp-3 sm:line-clamp-none inline">{item.body.slice(0, 150)}...</span>
              <button
                type="button"
                onClick={() => setIsExpanded(true)}
                className="text-[#8B181B] dark:text-rose-400 font-semibold ml-1.5 hover:underline cursor-pointer inline-block"
              >
                See more
              </button>
            </>
          ) : (
            <>
              <span>{item.body}</span>
              {shouldTruncate && (
                <button
                  type="button"
                  onClick={() => setIsExpanded(false)}
                  className="text-[#8B181B] dark:text-rose-400 font-semibold ml-1.5 hover:underline cursor-pointer inline-block"
                >
                  See less
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Attached Image Media */}
      {item.mediaUrl && (
        <div className="relative rounded-xl sm:rounded-2xl overflow-hidden border border-stone-200/70 dark:border-stone-800 aspect-[4/3] max-h-56 sm:max-h-72 md:max-h-80 w-full bg-stone-100 dark:bg-stone-800">
          <img
            src={item.mediaUrl}
            alt={item.title}
            className="w-full h-full object-cover hover:scale-[1.01] transition-transform duration-300 cursor-pointer"
            onClick={() => onOpenDetailModal?.(item.rawItem)}
          />
        </div>
      )}

      {/* Attachment indicator & full read action */}
      <div className="flex items-center justify-between gap-3 text-xs pt-1">
        {item.metadata?.attachmentsCount && item.metadata.attachmentsCount > 0 ? (
          <div className="flex items-center gap-1.5 text-stone-500 dark:text-stone-400">
            <Paperclip className="w-3.5 h-3.5 text-stone-400" />
            <span>{item.metadata.attachmentsCount} official attachment(s)</span>
          </div>
        ) : <div />}

        <button
          type="button"
          onClick={() => onOpenDetailModal?.(item.rawItem)}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#8B181B] dark:text-rose-400 hover:underline cursor-pointer"
        >
          <span>View Official Circular</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Social Actions */}
      <FeedCardActions
        item={item}
        onReact={onReact}
        onToggleComments={() => setIsCommentsOpen(!isCommentsOpen)}
        onShare={onShare}
        isCommentsOpen={isCommentsOpen}
      />

      {/* Expandable Comments Drawer */}
      {isCommentsOpen && (
        <FeedCommentsDrawer
          comments={item.comments}
          onAddComment={onAddComment}
        />
      )}
    </article>
  );
};
