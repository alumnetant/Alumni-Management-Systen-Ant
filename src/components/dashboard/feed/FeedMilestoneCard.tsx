/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Award, Sparkles, Building2, ExternalLink } from 'lucide-react';
import { FeedItem, FeedReactionType } from '../../../types/feed';
import { FeedCardHeader } from './FeedCardHeader';
import { FeedCardActions } from './FeedCardActions';
import { FeedCommentsDrawer } from './FeedCommentsDrawer';

interface FeedMilestoneCardProps {
  item: FeedItem;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
  onReact: (reaction: FeedReactionType) => void;
  onAddComment: (text: string) => void;
  onShare: () => void;
}

export const FeedMilestoneCard: React.FC<FeedMilestoneCardProps> = ({
  item,
  isBookmarked,
  onToggleBookmark,
  onReact,
  onAddComment,
  onShare
}) => {
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);

  const handleCongratulate = () => {
    onReact('celebrate');
    onAddComment(`Warm congratulations on this remarkable milestone! Proud Cecilian! 👏🎉`);
    setIsCommentsOpen(true);
  };

  return (
    <article className="bg-white dark:bg-stone-900 rounded-2xl sm:rounded-3xl border border-stone-200/90 dark:border-stone-800 p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:shadow-md transition-all duration-200 space-y-4">
      {/* Card Header */}
      <FeedCardHeader
        item={item}
        isBookmarked={isBookmarked}
        onToggleBookmark={onToggleBookmark}
      />

      {/* Laurel Category Kicker & Quick Congratulate CTA */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
          <Award className="w-4 h-4 text-amber-600" />
          <span>{item.categoryTag}</span>
        </div>

        <button
          type="button"
          onClick={handleCongratulate}
          className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800 rounded-full text-xs font-bold transition-all cursor-pointer shadow-2xs"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
          <span>Congratulate</span>
        </button>
      </div>

      {/* Main Milestone Body */}
      <div className="space-y-2">
        <h3 className="text-base sm:text-lg font-bold text-stone-900 dark:text-stone-100 leading-snug">
          {item.title}
        </h3>

        {item.metadata?.milestoneCompany && (
          <div className="flex items-center gap-1.5 text-xs text-stone-600 dark:text-stone-400 font-medium">
            <Building2 className="w-3.5 h-3.5 text-stone-400" />
            <span>{item.metadata.milestoneCompany}</span>
          </div>
        )}

        <p className="text-xs sm:text-sm text-stone-700 dark:text-stone-300 leading-relaxed whitespace-pre-line">
          {item.body}
        </p>
      </div>

      {/* Media Image Gallery */}
      {item.mediaUrl && (
        <div className="rounded-2xl overflow-hidden border border-stone-200/70 dark:border-stone-800">
          <img
            src={item.mediaUrl}
            alt={item.title}
            className="w-full max-h-96 object-cover hover:scale-[1.01] transition-transform duration-300"
          />
        </div>
      )}

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
