/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ShieldCheck, Bookmark, BookmarkCheck } from 'lucide-react';
import { FeedItem } from '../../../types/feed';
import { getUserAvatar, handleUserAvatarError } from '../../../lib/defaultImages';
import { useAlumni } from '../../../context/AlumniContext';

interface FeedCardHeaderProps {
  item: FeedItem;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
}

export const FeedCardHeader: React.FC<FeedCardHeaderProps> = ({
  item,
  isBookmarked,
  onToggleBookmark
}) => {
  const { setSelectedUserIdForModal } = useAlumni();

  const handleAuthorClick = () => {
    if (item.author.uid && item.author.uid.startsWith('usr_')) {
      setSelectedUserIdForModal(item.author.uid);
    }
  };

  const formattedDate = React.useMemo(() => {
    try {
      const d = new Date(item.timestamp);
      const diffMs = Date.now() - d.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays}d ago`;

      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return 'Recently';
    }
  }, [item.timestamp]);

  return (
    <div className="flex items-start justify-between gap-3">
      {/* Author Details */}
      <div className="flex items-center gap-3 min-w-0">
        <div
          onClick={handleAuthorClick}
          className={`relative shrink-0 ${item.author.uid?.startsWith('usr_') ? 'cursor-pointer hover:opacity-90' : ''}`}
        >
          <img
            src={getUserAvatar(item.author.avatarUrl)}
            alt={item.author.name}
            onError={handleUserAvatarError}
            className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl object-cover ring-1 ring-stone-200/90 dark:ring-stone-700 shadow-2xs"
          />
          {item.author.isVerified && (
            <div
              className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#8B181B] text-white flex items-center justify-center ring-2 ring-white dark:ring-stone-900"
              title="Verified Cecilian Identity"
            >
              <ShieldCheck className="w-2.5 h-2.5 stroke-[2.5]" />
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <h4
              onClick={handleAuthorClick}
              className={`text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100 truncate ${
                item.author.uid?.startsWith('usr_') ? 'cursor-pointer hover:text-[#8B181B] hover:underline' : ''
              }`}
            >
              {item.author.name}
            </h4>

            {item.badgeLabel && (
              <span className="text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 text-[#8B181B] dark:text-rose-400 border border-stone-200/60 dark:border-stone-700 shrink-0">
                {item.badgeLabel}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-stone-500 dark:text-stone-400 flex-wrap truncate">
            {item.author.batch && <span>Class of '{item.author.batch.slice(-2)}</span>}
            {item.author.batch && item.author.course && <span aria-hidden="true">·</span>}
            {item.author.course && <span className="truncate">{item.author.course}</span>}
            {!item.author.batch && !item.author.course && <span>{item.author.role || 'Cecilian Community'}</span>}
            <span aria-hidden="true">·</span>
            <span className="text-stone-400 dark:text-stone-500">{formattedDate}</span>
          </div>
        </div>
      </div>

      {/* Top Right: Bookmark Action */}
      <button
        type="button"
        onClick={onToggleBookmark}
        className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer shrink-0"
        title={isBookmarked ? 'Remove Bookmark' : 'Save for Later'}
      >
        {isBookmarked ? (
          <BookmarkCheck className="w-4 h-4 text-[#8B181B] fill-[#8B181B]" />
        ) : (
          <Bookmark className="w-4 h-4" />
        )}
      </button>
    </div>
  );
};
