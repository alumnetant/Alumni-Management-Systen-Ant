/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

export const FeedSkeletonLoader: React.FC = () => {
  return (
    <div className="bg-white dark:bg-stone-900 rounded-2xl sm:rounded-3xl border border-stone-200/80 dark:border-stone-800 p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-4 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-stone-200 dark:bg-stone-800" />
          <div className="space-y-1.5">
            <div className="w-32 h-3.5 bg-stone-200 dark:bg-stone-800 rounded" />
            <div className="w-20 h-2.5 bg-stone-100 dark:bg-stone-850 rounded" />
          </div>
        </div>
        <div className="w-16 h-5 bg-stone-100 dark:bg-stone-800 rounded-md" />
      </div>

      {/* Content Skeleton */}
      <div className="space-y-2 pt-1">
        <div className="w-3/4 h-5 bg-stone-200 dark:bg-stone-800 rounded" />
        <div className="w-full h-3 bg-stone-100 dark:bg-stone-850 rounded" />
        <div className="w-5/6 h-3 bg-stone-100 dark:bg-stone-850 rounded" />
      </div>

      {/* Media Skeleton */}
      <div className="w-full h-44 bg-stone-100 dark:bg-stone-800/60 rounded-2xl" />

      {/* Actions Skeleton */}
      <div className="flex items-center justify-between pt-3 border-t border-stone-100 dark:border-stone-800">
        <div className="flex items-center gap-4">
          <div className="w-16 h-6 bg-stone-100 dark:bg-stone-800 rounded" />
          <div className="w-16 h-6 bg-stone-100 dark:bg-stone-800 rounded" />
        </div>
        <div className="w-8 h-6 bg-stone-100 dark:bg-stone-800 rounded" />
      </div>
    </div>
  );
};
