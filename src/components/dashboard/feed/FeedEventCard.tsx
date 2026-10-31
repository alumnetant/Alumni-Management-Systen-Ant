/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Calendar, MapPin, Users, Check, Clock, Video, ArrowRight } from 'lucide-react';
import { FeedItem, FeedReactionType } from '../../../types/feed';
import { FeedCardHeader } from './FeedCardHeader';
import { FeedCardActions } from './FeedCardActions';
import { FeedCommentsDrawer } from './FeedCommentsDrawer';
import { useAlumni } from '../../../context/AlumniContext';

interface FeedEventCardProps {
  item: FeedItem;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
  onReact: (reaction: FeedReactionType) => void;
  onAddComment: (text: string) => void;
  onShare: () => void;
}

export const FeedEventCard: React.FC<FeedEventCardProps> = ({
  item,
  isBookmarked,
  onToggleBookmark,
  onReact,
  onAddComment,
  onShare
}) => {
  const { rsvpEvent, setActiveTab, currentUser, showToast } = useAlumni();
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [isRsvping, setIsRsvping] = useState(false);

  const eventDateObj = item.metadata?.eventDate ? new Date(item.metadata.eventDate) : new Date();
  const monthStr = eventDateObj.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const dayStr = eventDateObj.getDate();
  const timeStr = eventDateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const isAttending = item.metadata?.isAttending;

  const handleToggleRsvp = async () => {
    if (!currentUser) return;
    setIsRsvping(true);
    try {
      const eventId = item.id.replace('event_', '');
      const newStatus = isAttending ? 'not_going' : 'going';
      rsvpEvent(eventId, newStatus as any);
      showToast(isAttending ? 'RSVP updated: Not Attending' : 'Confirmed Attendance! Your seat is reserved.', 'success');
    } finally {
      setIsRsvping(false);
    }
  };

  return (
    <article className="bg-white dark:bg-stone-900 rounded-2xl sm:rounded-3xl border border-stone-200/90 dark:border-stone-800 p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:shadow-md transition-all duration-200 space-y-4">
      {/* Card Header */}
      <FeedCardHeader
        item={item}
        isBookmarked={isBookmarked}
        onToggleBookmark={onToggleBookmark}
      />

      {/* Event Banner Media */}
      {item.mediaUrl && (
        <div className="relative rounded-2xl overflow-hidden border border-stone-200/70 dark:border-stone-800 max-h-72">
          <img
            src={item.mediaUrl}
            alt={item.title}
            className="w-full h-48 sm:h-60 object-cover"
          />
          {/* Calendar Badge Overlay */}
          <div className="absolute top-3 left-3 bg-white/95 dark:bg-stone-900/95 backdrop-blur-md rounded-xl p-2 text-center shadow-md min-w-[50px] border border-stone-200/80 dark:border-stone-700">
            <span className="block text-[10px] font-black tracking-wider text-[#8B181B] dark:text-rose-400">{monthStr}</span>
            <span className="block text-lg font-black text-stone-900 dark:text-white leading-none">{dayStr}</span>
          </div>
        </div>
      )}

      {/* Event Information Block */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#8B181B] dark:text-rose-400 uppercase tracking-wider">
          <Calendar className="w-3.5 h-3.5" />
          <span>{item.categoryTag}</span>
        </div>

        <h3 className="text-base sm:text-lg font-bold text-stone-900 dark:text-stone-100 leading-snug">
          {item.title}
        </h3>

        <p className="text-xs sm:text-sm text-stone-700 dark:text-stone-300 leading-relaxed line-clamp-3">
          {item.body}
        </p>

        {/* Date, Time, Location Strip */}
        <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-850 border border-stone-200/80 dark:border-stone-750 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2 text-stone-700 dark:text-stone-300 font-medium">
              <Clock className="w-3.5 h-3.5 text-stone-400 shrink-0" />
              <span>{eventDateObj.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} at {timeStr}</span>
            </div>

            <div className="flex items-center gap-2 text-stone-600 dark:text-stone-400">
              {item.metadata?.isVirtual ? (
                <>
                  <Video className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>Virtual Video Gathering</span>
                </>
              ) : (
                <>
                  <MapPin className="w-3.5 h-3.5 text-red-600 shrink-0" />
                  <span className="truncate">{item.metadata?.eventLocation || 'St. Cecilia’s College Campus'}</span>
                </>
              )}
            </div>
          </div>

          {/* 1-Click RSVP Action */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleToggleRsvp}
              disabled={isRsvping}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                isAttending
                  ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300'
                  : 'bg-[#8B181B] hover:bg-[#721316] text-white'
              }`}
            >
              {isAttending && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
              <span>{isAttending ? 'Attending' : 'RSVP Now'}</span>
            </button>
          </div>
        </div>

        {/* Attendees Count Indicator */}
        <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400 pt-1">
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            <span>{item.metadata?.attendeesCount || 0} Cecilians attending</span>
          </div>

          <button
            type="button"
            onClick={() => setActiveTab('events')}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#8B181B] dark:text-rose-400 hover:underline cursor-pointer"
          >
            <span>Event Hub</span>
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
