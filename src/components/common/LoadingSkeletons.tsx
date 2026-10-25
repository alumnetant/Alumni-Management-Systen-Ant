import React from 'react';

/**
 * Shimmering Skeleton Loader Components
 * Institutional warm-stone shimmer placeholders for smooth data loading
 */

export const ShimmerBar: React.FC<{ className?: string }> = ({ className = 'h-4 w-full' }) => (
  <div
    className={`bg-stone-200/70 dark:bg-stone-800/80 rounded-md animate-pulse relative overflow-hidden ${className}`}
  >
    <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_infinite] bg-linear-to-r from-transparent via-white/20 dark:via-white/5 to-transparent" />
  </div>
);

export const DirectorySkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header bar skeleton */}
      <div className="p-6 bg-white dark:bg-[#181615] rounded-3xl border border-stone-200/80 dark:border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <ShimmerBar className="h-3 w-32" />
          <ShimmerBar className="h-6 w-56 sm:w-72" />
          <ShimmerBar className="h-3 w-48" />
        </div>
        <ShimmerBar className="h-10 w-full sm:w-64 rounded-xl" />
      </div>

      {/* Grid of alumni cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, idx) => (
          <div
            key={idx}
            className="p-5 bg-white dark:bg-[#181615] rounded-2xl border border-stone-200/80 dark:border-stone-800 space-y-4 shadow-2xs"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-13 h-13 rounded-2xl bg-stone-200 dark:bg-stone-800 animate-pulse shrink-0" />
              <div className="flex-1 space-y-2 min-w-0">
                <ShimmerBar className="h-4 w-3/4" />
                <ShimmerBar className="h-3 w-1/2" />
              </div>
            </div>
            <div className="space-y-2 pt-1">
              <ShimmerBar className="h-3 w-full" />
              <ShimmerBar className="h-3 w-5/6" />
            </div>
            <div className="pt-3 border-t border-stone-100 dark:border-stone-800/80 flex items-center justify-between">
              <ShimmerBar className="h-3 w-20" />
              <ShimmerBar className="h-7 w-20 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const EventsSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Hero Event Banner Skeleton */}
      <div className="h-64 sm:h-72 w-full rounded-3xl bg-stone-200 dark:bg-stone-800 animate-pulse p-6 sm:p-8 flex flex-col justify-end space-y-3 relative overflow-hidden">
        <ShimmerBar className="h-4 w-32 bg-stone-300 dark:bg-stone-700" />
        <ShimmerBar className="h-7 w-2/3 bg-stone-300 dark:bg-stone-700" />
        <ShimmerBar className="h-4 w-1/2 bg-stone-300 dark:bg-stone-700" />
      </div>

      {/* Grid of Event Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 3 }).map((_, idx) => (
          <div
            key={idx}
            className="rounded-2xl bg-white dark:bg-[#181615] border border-stone-200/80 dark:border-stone-800 p-5 space-y-4 shadow-2xs"
          >
            <div className="h-36 rounded-xl bg-stone-200 dark:bg-stone-800 animate-pulse" />
            <ShimmerBar className="h-5 w-4/5" />
            <ShimmerBar className="h-3 w-full" />
            <ShimmerBar className="h-3 w-2/3" />
            <div className="pt-2 flex justify-between items-center">
              <ShimmerBar className="h-4 w-24" />
              <ShimmerBar className="h-8 w-24 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const JobsSkeleton: React.FC = () => {
  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Search Header */}
      <div className="p-5 bg-white dark:bg-[#181615] rounded-2xl border border-stone-200/80 dark:border-stone-800 flex gap-3">
        <ShimmerBar className="h-10 flex-1 rounded-xl" />
        <ShimmerBar className="h-10 w-28 rounded-xl" />
      </div>

      {/* Job list rows */}
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div
            key={idx}
            className="p-5 bg-white dark:bg-[#181615] rounded-2xl border border-stone-200/80 dark:border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-stone-200 dark:bg-stone-800 animate-pulse shrink-0" />
              <div className="space-y-2">
                <ShimmerBar className="h-4 w-48 sm:w-64" />
                <ShimmerBar className="h-3 w-32" />
                <div className="flex gap-2 pt-1">
                  <ShimmerBar className="h-4 w-16 rounded-md" />
                  <ShimmerBar className="h-4 w-20 rounded-md" />
                </div>
              </div>
            </div>
            <ShimmerBar className="h-9 w-28 rounded-xl shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
};
