/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { QrCode, Calendar, Users, MapPin, ArrowRight, ExternalLink, Sparkles, Building2 } from 'lucide-react';
import { useAlumni } from '../../../context/AlumniContext';
import { getUserAvatar, handleUserAvatarError } from '../../../lib/defaultImages';
import { triggerHaptic } from '../../../services/hapticsService';

interface FeedSideRailProps {
  onOpenPass: () => void;
  onOpenGallery: () => void;
}

export const FeedSideRail: React.FC<FeedSideRailProps> = ({
  onOpenPass,
  onOpenGallery
}) => {
  const { currentUser, users, events, setActiveTab, setSelectedUserIdForModal, sendFriendRequest, connectionIds } = useAlumni();

  // Batch mates spotlight
  const batchmates = React.useMemo(() => {
    if (!currentUser) return (users || []).slice(0, 3);
    const sameBatch = (users || []).filter(
      (u) => u.uid !== currentUser.uid && u.batch === currentUser.batch && !(connectionIds || []).includes(u.uid)
    );
    if (sameBatch.length >= 3) return sameBatch.slice(0, 3);
    return (users || []).filter((u) => u.uid !== currentUser.uid && !(connectionIds || []).includes(u.uid)).slice(0, 3);
  }, [users, currentUser, connectionIds]);

  // Upcoming reunions/events (next 2)
  const upcomingEvents = React.useMemo(() => {
    return [...(events || [])]
      .filter((e) => new Date(e.startDate).getTime() >= Date.now() - 24 * 60 * 60 * 1000)
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
      .slice(0, 2);
  }, [events]);

  return (
    <aside className="space-y-5">
      {/* 1. Digital Alumni Pass Mini Card */}
      <div className="bg-gradient-to-br from-[#8B181B] to-[#5C0A0D] text-white rounded-3xl p-5 shadow-sm space-y-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-6 -mt-6 w-28 h-28 bg-white/10 rounded-full blur-xl pointer-events-none" />

        <div className="flex items-start justify-between gap-3 relative z-10">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-amber-300">Official Credential</span>
            <h3 className="text-base font-bold tracking-tight text-white mt-0.5">Digital Alumni Pass</h3>
            <p className="text-xs text-white/80 mt-1 leading-relaxed">
              Cryptographic pass for campus gate access & library entry.
            </p>
          </div>
          <div className="p-2.5 bg-white/15 backdrop-blur-md rounded-2xl ring-1 ring-white/20">
            <QrCode className="w-5 h-5 text-white" />
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            onOpenPass();
          }}
          className="w-full py-2.5 px-4 bg-white text-[#8B181B] hover:bg-stone-50 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
        >
          <span>Launch Digital Pass</span>
          <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
        </button>
      </div>

      {/* 2. Batch Mates / Class Cohort Recommendations */}
      <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200/90 dark:border-stone-800 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-stone-900 dark:text-stone-100 uppercase tracking-wider">
            <Users className="w-3.5 h-3.5 text-[#8B181B]" />
            <span>Class Cohort</span>
          </div>
          <span className="text-[11px] font-semibold text-stone-400">Class of '{currentUser?.batch?.slice(-2) || '24'}</span>
        </div>

        <div className="space-y-3">
          {batchmates.map((user) => (
            <div key={user.uid} className="flex items-center justify-between gap-2.5 text-xs">
              <div
                onClick={() => setSelectedUserIdForModal(user.uid)}
                className="flex items-center gap-2.5 min-w-0 cursor-pointer group"
              >
                <img
                  src={getUserAvatar(user.profilePictureUrl)}
                  alt={user.name}
                  onError={handleUserAvatarError}
                  className="w-9 h-9 rounded-xl object-cover ring-1 ring-stone-200 dark:ring-stone-700 shrink-0"
                />
                <div className="min-w-0">
                  <h4 className="font-bold text-stone-900 dark:text-stone-100 group-hover:text-[#8B181B] truncate text-xs">
                    {user.name}
                  </h4>
                  <p className="text-[11px] text-stone-500 truncate">{user.course || 'Graduate'}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => sendFriendRequest(user.uid)}
                className="px-2.5 py-1 text-[11px] font-bold text-[#8B181B] hover:bg-rose-50 dark:hover:bg-rose-950/60 border border-stone-200 dark:border-stone-700 rounded-lg transition-colors cursor-pointer shrink-0"
              >
                Connect
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setActiveTab('network')}
          className="w-full text-center text-xs font-semibold text-[#8B181B] hover:underline pt-1 cursor-pointer block"
        >
          View All Alumni Directory
        </button>
      </div>

      {/* 3. Upcoming Gatherings Quick Widget */}
      <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200/90 dark:border-stone-800 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-stone-900 dark:text-stone-100 uppercase tracking-wider">
            <Calendar className="w-3.5 h-3.5 text-[#8B181B]" />
            <span>Upcoming Reunions</span>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('events')}
            className="text-[11px] font-semibold text-[#8B181B] hover:underline cursor-pointer"
          >
            See all
          </button>
        </div>

        <div className="space-y-3">
          {upcomingEvents.map((evt) => (
            <div
              key={evt.id}
              onClick={() => setActiveTab('events')}
              className="p-3 rounded-2xl bg-stone-50 dark:bg-stone-850 border border-stone-200/80 dark:border-stone-750 hover:border-[#8B181B]/40 transition-colors cursor-pointer space-y-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#8B181B] dark:text-rose-400">
                  {new Date(evt.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
                <span className="text-[10px] text-stone-400">{evt.attendees?.length || 0} attending</span>
              </div>
              <h4 className="font-bold text-xs text-stone-900 dark:text-stone-100 line-clamp-1">{evt.title}</h4>
              <p className="text-[11px] text-stone-500 truncate flex items-center gap-1">
                <MapPin className="w-3 h-3 text-stone-400 shrink-0" />
                <span>{evt.location || 'Minglanilla, Cebu'}</span>
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Campus Heritage Gallery Quick Launch */}
      <button
        type="button"
        onClick={onOpenGallery}
        className="w-full p-4 rounded-3xl bg-stone-100 dark:bg-stone-850 border border-stone-200/90 dark:border-stone-750 hover:bg-stone-200/70 dark:hover:bg-stone-800 transition-colors flex items-center justify-between text-left cursor-pointer group"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white dark:bg-stone-800 flex items-center justify-center text-[#8B181B] shadow-2xs">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-stone-900 dark:text-white group-hover:text-[#8B181B]">Campus Heritage Gallery</h4>
            <p className="text-[10px] text-stone-500">Explore historic photos & milestones</p>
          </div>
        </div>
        <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-stone-700 dark:group-hover:text-stone-200 transition-transform group-hover:translate-x-0.5" />
      </button>
    </aside>
  );
};
