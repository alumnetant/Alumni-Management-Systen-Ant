/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Briefcase, Building2, MapPin, ArrowRight, Sparkles } from 'lucide-react';
import { FeedItem, FeedReactionType } from '../../../types/feed';
import { FeedCardHeader } from './FeedCardHeader';
import { FeedCardActions } from './FeedCardActions';
import { FeedCommentsDrawer } from './FeedCommentsDrawer';
import { useAlumni } from '../../../context/AlumniContext';

interface FeedOpportunityCardProps {
  item: FeedItem;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
  onReact: (reaction: FeedReactionType) => void;
  onAddComment: (text: string) => void;
  onShare: () => void;
}

export const FeedOpportunityCard: React.FC<FeedOpportunityCardProps> = ({
  item,
  isBookmarked,
  onToggleBookmark,
  onReact,
  onAddComment,
  onShare
}) => {
  const { setActiveTab } = useAlumni();
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);

  const handleOpenJob = () => {
    setActiveTab('opportunities');
  };

  return (
    <article className="bg-white dark:bg-stone-900 rounded-2xl sm:rounded-3xl border border-stone-200/90 dark:border-stone-800 p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:shadow-md transition-all duration-200 space-y-4">
      {/* Card Header */}
      <FeedCardHeader
        item={item}
        isBookmarked={isBookmarked}
        onToggleBookmark={onToggleBookmark}
      />

      {/* Category Kicker & Match Badge */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
          <Briefcase className="w-3.5 h-3.5 text-emerald-600" />
          <span>{item.categoryTag}</span>
        </div>

        {item.metadata?.matchScore && (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
            <Sparkles className="w-3 h-3 text-emerald-600" />
            <span>{Math.round(item.metadata.matchScore)}% Match</span>
          </span>
        )}
      </div>

      {/* Job Details Box */}
      <div className="space-y-2.5">
        <div>
          <h3
            onClick={handleOpenJob}
            className="text-base sm:text-lg font-bold text-stone-900 dark:text-stone-100 hover:text-[#8B181B] cursor-pointer transition-colors leading-snug"
          >
            {item.title}
          </h3>
          <p className="text-xs text-stone-600 dark:text-stone-400 font-medium mt-0.5">
            {item.metadata?.opportunityCompany}
          </p>
        </div>

        <p className="text-xs sm:text-sm text-stone-700 dark:text-stone-300 leading-relaxed line-clamp-3">
          {item.body}
        </p>

        {/* Tactical Info Pill Bar */}
        <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-850 border border-stone-200/80 dark:border-stone-750 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 text-stone-600 dark:text-stone-400">
            {item.metadata?.opportunityLocation && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-stone-400" />
                <span>{item.metadata.opportunityLocation}</span>
              </span>
            )}
            {item.metadata?.opportunityType && (
              <span className="uppercase text-[10px] font-bold text-stone-500 bg-stone-200/60 dark:bg-stone-700 px-2 py-0.5 rounded">
                {item.metadata.opportunityType}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleOpenJob}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-stone-900 hover:bg-[#8B181B] transition-colors cursor-pointer shadow-2xs"
          >
            <span>View Opportunity</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
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
