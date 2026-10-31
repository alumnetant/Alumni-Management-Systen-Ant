/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Alumni Home Page — Centered Timeline & "For You Page" (FYP)
 * Aggregates Announcements, Events, Milestones, and Opportunities
 * into an engaging single-column social timeline with infinite scrolling.
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  QrCode,
  CheckCircle2,
  X
} from 'lucide-react';
import { useAlumni } from '../../context/AlumniContext';
import { useAlumniFeed } from '../../hooks/useAlumniFeed';
import { Announcement } from '../../types';
import { getUserAvatar, handleUserAvatarError } from '../../lib/defaultImages';
import { CampusGalleryModal } from '../gallery/CampusGalleryModal';
import { triggerHaptic } from '../../services/hapticsService';

// Feed Components
import { FeedFilters } from './feed/FeedFilters';
import { FeedAnnouncementCard } from './feed/FeedAnnouncementCard';
import { FeedEventCard } from './feed/FeedEventCard';
import { FeedMilestoneCard } from './feed/FeedMilestoneCard';
import { FeedOpportunityCard } from './feed/FeedOpportunityCard';
import { FeedPostComposer } from './feed/FeedPostComposer';
import { FeedSkeletonLoader } from './feed/FeedSkeletonLoader';
import { FeedEmptyState } from './feed/FeedEmptyState';

export const DashboardView: React.FC = () => {
  const { currentUser } = useAlumni();
  const {
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    visibleFeed,
    totalCount,
    hasMore,
    loadMore,
    isLoadingMore,
    toggleReaction,
    addComment,
    toggleBookmark,
    isBookmarked,
    shareFeedItem
  } = useAlumniFeed();

  // Modals
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [showGalleryModal, setShowGalleryModal] = useState(false);

  // Sentinel Ref for Infinite Scroll Observer
  const sentinelRef = useRef<HTMLDivElement>(null);

  // IntersectionObserver for Infinite Scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          loadMore();
        }
      },
      { rootMargin: '300px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, loadMore]);

  // Reset feed and scroll to top on global reset event
  useEffect(() => {
    const handleReset = () => {
      setSelectedAnnouncement(null);
      setShowGalleryModal(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      const mainEl = document.querySelector('main');
      if (mainEl) mainEl.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.addEventListener('applet:reset-dashboard', handleReset);
    return () => window.removeEventListener('applet:reset-dashboard', handleReset);
  }, []);

  // Time-of-day greeting
  const salutation = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Good morning';
    if (hour >= 12 && hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  // Formal collegiate date string
  const todayFormatted = useMemo(() => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    }).format(new Date());
  }, []);

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6 pb-24 font-sans selection:bg-[#8B181B] selection:text-white">
      {/* =========================================================================
          1. ALUMNI GREETING & IDENTITY MASTHEAD
          ========================================================================= */}
      <section className="bg-white dark:bg-stone-900 rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-stone-200/80 dark:border-stone-800 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
            <div className="relative shrink-0">
              <img
                src={getUserAvatar(currentUser?.profilePictureUrl)}
                alt={currentUser?.name || 'Alumnus'}
                onError={handleUserAvatarError}
                referrerPolicy="no-referrer"
                className="w-13 h-13 sm:w-16 sm:h-16 rounded-2xl object-cover ring-2 ring-stone-100 dark:ring-stone-800"
              />
              <div
                className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#8B181B] text-white flex items-center justify-center ring-2 ring-white dark:ring-stone-900 shadow-2xs"
                title="Verified Cecilian Alumnus"
              >
                <Check className="w-3 h-3 stroke-[3]" />
              </div>
            </div>

            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-2 text-[11px] font-medium text-stone-400 dark:text-stone-500 flex-wrap">
                <span className="editorial-kicker">ST. CECILIA'S COLLEGE · CEBU</span>
                <span aria-hidden="true" className="text-stone-300 dark:text-stone-600">·</span>
                <span>{todayFormatted}</span>
              </div>
              <h1 className="editorial-title text-xl sm:text-2xl font-normal tracking-tight truncate text-stone-900 dark:text-stone-100">
                {salutation}, <span className="editorial-accent italic text-[#8B181B] dark:text-rose-400">{currentUser?.name?.split(' ')[0] || 'Cecilian'}</span>
              </h1>
              <div className="text-xs text-stone-500 dark:text-stone-400 flex items-center gap-2 flex-wrap">
                <span className="truncate">{currentUser?.course || 'Bachelor Degree'}</span>
                <span aria-hidden="true">·</span>
                <span className="font-semibold text-stone-700 dark:text-stone-300">
                  Class of {currentUser?.batch || '2023'}
                </span>
                <span aria-hidden="true">·</span>
                <span className="text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Verified Graduate</span>
                </span>
              </div>
            </div>
          </div>

          {/* Quick Action: Digital Pass */}
          <div className="flex items-center gap-2.5 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-stone-100 dark:border-stone-800">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                window.dispatchEvent(new CustomEvent('applet:open-alumni-pass'));
              }}
              className="w-full md:w-auto px-4 py-2.5 bg-[#8B181B] hover:bg-[#721316] text-white text-xs font-semibold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] min-h-[44px]"
            >
              <QrCode className="w-4 h-4 stroke-[2]" />
              <span>Digital Alumni Pass</span>
            </button>
          </div>
        </div>
      </section>

      {/* =========================================================================
          2. FEED FILTERS MULTI-TAB SWITCHER & LIVE SEARCH
          ========================================================================= */}
      <FeedFilters
        activeTab={activeTab}
        onTabChange={setActiveTab}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        totalCount={totalCount}
      />

      {/* =========================================================================
          3. MAIN CENTERED TIMELINE STREAM
          ========================================================================= */}
      <main className="space-y-5">
        {/* Quick Post / Story Composer */}
        <FeedPostComposer />

        {/* Feed Content Cards */}
        {visibleFeed.length === 0 ? (
          <FeedEmptyState
            activeTab={activeTab}
            searchQuery={searchQuery}
            onReset={() => {
              setSearchQuery('');
              setActiveTab('foryou');
            }}
          />
        ) : (
          <div className="space-y-5">
            {visibleFeed.map((item) => {
              if (item.type === 'announcement') {
                return (
                  <FeedAnnouncementCard
                    key={item.id}
                    item={item}
                    isBookmarked={isBookmarked(item.id)}
                    onToggleBookmark={() => toggleBookmark(item.id)}
                    onReact={(r) => toggleReaction(item.id, r)}
                    onAddComment={(txt) => addComment(item.id, txt)}
                    onShare={() => shareFeedItem(item)}
                    onOpenDetailModal={(a) => setSelectedAnnouncement(a)}
                  />
                );
              }

              if (item.type === 'event') {
                return (
                  <FeedEventCard
                    key={item.id}
                    item={item}
                    isBookmarked={isBookmarked(item.id)}
                    onToggleBookmark={() => toggleBookmark(item.id)}
                    onReact={(r) => toggleReaction(item.id, r)}
                    onAddComment={(txt) => addComment(item.id, txt)}
                    onShare={() => shareFeedItem(item)}
                  />
                );
              }

              if (item.type === 'milestone') {
                return (
                  <FeedMilestoneCard
                    key={item.id}
                    item={item}
                    isBookmarked={isBookmarked(item.id)}
                    onToggleBookmark={() => toggleBookmark(item.id)}
                    onReact={(r) => toggleReaction(item.id, r)}
                    onAddComment={(txt) => addComment(item.id, txt)}
                    onShare={() => shareFeedItem(item)}
                  />
                );
              }

              if (item.type === 'opportunity') {
                return (
                  <FeedOpportunityCard
                    key={item.id}
                    item={item}
                    isBookmarked={isBookmarked(item.id)}
                    onToggleBookmark={() => toggleBookmark(item.id)}
                    onReact={(r) => toggleReaction(item.id, r)}
                    onAddComment={(txt) => addComment(item.id, txt)}
                    onShare={() => shareFeedItem(item)}
                  />
                );
              }

              return null;
            })}
          </div>
        )}

        {/* Skeleton Loaders while fetching next batch */}
        {isLoadingMore && (
          <div className="space-y-5 pt-2">
            <FeedSkeletonLoader />
            <FeedSkeletonLoader />
          </div>
        )}

        {/* Bottom Sentinel Trigger for Infinite Scroll */}
        <div ref={sentinelRef} className="h-6 w-full pointer-events-none" />

        {/* End of Stream Marker */}
        {!hasMore && visibleFeed.length > 0 && (
          <div className="text-center py-8 text-stone-400 dark:text-stone-500 text-xs border-t border-stone-200/70 dark:border-stone-800 mt-6 space-y-1">
            <p className="font-semibold text-stone-600 dark:text-stone-400">
              You're all caught up on the Cecilian timeline!
            </p>
            <p className="text-[11px]">
              Showing all {totalCount} updates across campus circulars, reunions, and peer achievements.
            </p>
          </div>
        )}
      </main>

      {/* =========================================================================
          4. MODAL: ANNOUNCEMENT DETAIL READER
          ========================================================================= */}
      <AnimatePresence>
        {selectedAnnouncement && (
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
            onClick={() => setSelectedAnnouncement(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="bg-white dark:bg-[#181615] rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 sm:p-5 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#8B181B] dark:text-rose-400 uppercase tracking-wider">
                  {selectedAnnouncement.category || 'Official Advisory'}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedAnnouncement(null)}
                  className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 sm:p-6 overflow-y-auto space-y-3">
                <h3 className="text-base sm:text-lg font-bold text-stone-900 dark:text-stone-100 leading-snug">
                  {selectedAnnouncement.title}
                </h3>
                <div className="text-xs text-stone-400 flex items-center gap-2 pb-2 border-b border-stone-100 dark:border-stone-800 flex-wrap">
                  <span>{selectedAnnouncement.authorName || 'Alumni Affairs Office'}</span>
                  <span>·</span>
                  <span>
                    {new Date(selectedAnnouncement.publishedAt).toLocaleDateString([], {
                      dateStyle: 'long'
                    })}
                  </span>
                </div>
                <div className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 leading-relaxed whitespace-pre-line pt-2">
                  {selectedAnnouncement.content}
                </div>
              </div>

              <div className="p-3.5 bg-stone-50 dark:bg-stone-900 border-t border-stone-100 dark:border-stone-800 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedAnnouncement(null)}
                  className="px-4 py-2 bg-stone-200 dark:bg-stone-800 text-stone-800 dark:text-stone-200 rounded-xl text-xs font-semibold cursor-pointer min-h-[38px]"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CAMPUS HERITAGE GALLERY MODAL */}
      <CampusGalleryModal
        isOpen={showGalleryModal}
        onClose={() => setShowGalleryModal(false)}
      />
    </div>
  );
};
