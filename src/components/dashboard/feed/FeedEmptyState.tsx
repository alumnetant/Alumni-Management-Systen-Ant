/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Newspaper, RotateCcw } from 'lucide-react';
import { FeedTab } from '../../../types/feed';

interface FeedEmptyStateProps {
  activeTab: FeedTab;
  searchQuery: string;
  onReset: () => void;
}

export const FeedEmptyState: React.FC<FeedEmptyStateProps> = ({
  activeTab,
  searchQuery,
  onReset
}) => {
  return (
    <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200/90 dark:border-stone-800 p-12 text-center shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-4">
      <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-[#8B181B] dark:text-rose-400 flex items-center justify-center mx-auto shadow-2xs">
        <Newspaper className="w-7 h-7 stroke-[1.5]" />
      </div>

      <div className="space-y-1.5 max-w-sm mx-auto">
        <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
          {searchQuery ? 'No Matching Timeline Updates' : 'Timeline Is Calm Today'}
        </h3>
        <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
          {searchQuery
            ? `No updates matched "${searchQuery}". Try searching for another topic or reset the search.`
            : activeTab === 'official'
            ? 'There are no official circulars or administrative notices published recently.'
            : 'Check back soon for new career milestones, campus gatherings, and batch announcements.'}
        </p>
      </div>

      <button
        type="button"
        onClick={onReset}
        className="inline-flex items-center gap-1.5 px-4 py-2 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-700 dark:text-stone-200 font-bold text-xs rounded-xl transition-colors cursor-pointer"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        <span>Reset Stream Filter</span>
      </button>
    </div>
  );
};
