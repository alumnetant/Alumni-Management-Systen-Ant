/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * FeedFilters Component
 * Multi-tab interface (For You, Chronological, Official) with real-time keyword search
 * Integrated at the top of the Alumni Home Page feed.
 */

import React from 'react';
import { Sparkles, Clock, Building2, Search, X } from 'lucide-react';
import { FeedTab } from '../../../types/feed';
import { triggerHaptic } from '../../../services/hapticsService';

interface FeedFiltersProps {
  activeTab: FeedTab;
  onTabChange: (tab: FeedTab) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  totalCount?: number;
}

export const FeedFilters: React.FC<FeedFiltersProps> = ({
  activeTab,
  onTabChange,
  searchQuery,
  onSearchChange,
  totalCount
}) => {
  return (
    <div className="bg-white dark:bg-stone-900 rounded-2xl sm:rounded-3xl border border-stone-200/90 dark:border-stone-800 p-2.5 sm:p-3 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-2.5">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Multi-Tab Switcher */}
        <nav
          className="flex items-center gap-1 p-1 bg-stone-100/90 dark:bg-stone-800 rounded-xl overflow-x-auto select-none"
          aria-label="Feed Streams Navigation"
        >
          {/* 1. For You Stream */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              onTabChange('foryou');
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'foryou'
                ? 'bg-white dark:bg-stone-700 text-[#8B181B] dark:text-rose-400 shadow-2xs font-extrabold'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>For You</span>
          </button>

          {/* 2. Chronological / Recent Stream */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              onTabChange('recent');
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'recent'
                ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-white shadow-2xs font-extrabold'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Chronological</span>
          </button>

          {/* 3. Official Bulletins Stream */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              onTabChange('official');
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'official'
                ? 'bg-white dark:bg-stone-700 text-[#8B181B] dark:text-rose-400 shadow-2xs font-extrabold'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Official</span>
          </button>
        </nav>

        {/* Real-Time Live Search Filter Input */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search feed updates, circulars, reunions..."
            className="w-full pl-9 pr-8 py-1.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-hidden focus:ring-2 focus:ring-[#8B181B]/20 focus:border-[#8B181B] transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer"
              title="Clear search query"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Stream Summary Bar */}
      {typeof totalCount === 'number' && (
        <div className="flex items-center justify-between text-[11px] text-stone-400 dark:text-stone-500 px-1 pt-1 border-t border-stone-100 dark:border-stone-800">
          <span>
            Stream Mode:{' '}
            <strong className="text-stone-700 dark:text-stone-300 capitalize">
              {activeTab === 'foryou' ? 'For You (Personalized)' : activeTab === 'recent' ? 'Chronological' : 'Official Bulletins Only'}
            </strong>
          </span>
          <span>{totalCount} updates available</span>
        </div>
      )}
    </div>
  );
};
