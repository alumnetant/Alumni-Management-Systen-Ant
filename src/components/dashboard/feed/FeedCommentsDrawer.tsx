/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Send, CornerDownRight } from 'lucide-react';
import { FeedComment } from '../../../types/feed';
import { getUserAvatar, handleUserAvatarError } from '../../../lib/defaultImages';
import { useAlumni } from '../../../context/AlumniContext';

interface FeedCommentsDrawerProps {
  comments: FeedComment[];
  onAddComment: (text: string) => void;
}

export const FeedCommentsDrawer: React.FC<FeedCommentsDrawerProps> = ({
  comments,
  onAddComment
}) => {
  const { currentUser, setSelectedUserIdForModal } = useAlumni();
  const [inputText, setInputText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onAddComment(inputText.trim());
    setInputText('');
  };

  return (
    <div className="pt-3 border-t border-stone-100 dark:border-stone-800 space-y-3.5">
      {/* Input Composer */}
      <form onSubmit={handleSubmit} className="flex items-start gap-2.5">
        <img
          src={getUserAvatar(currentUser?.profilePictureUrl)}
          alt={currentUser?.name || 'You'}
          onError={handleUserAvatarError}
          className="w-8 h-8 rounded-xl object-cover ring-1 ring-stone-200 dark:ring-stone-700 shrink-0 mt-0.5"
        />
        <div className="flex-1 relative">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Write a congratulatory note or thought..."
            className="w-full pl-3 pr-10 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200/90 dark:border-stone-700 rounded-xl text-xs text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-hidden focus:ring-2 focus:ring-[#8B181B]/20 focus:border-[#8B181B] transition-all"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-[#8B181B] dark:text-rose-400 hover:text-[#721316] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title="Post comment"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>

      {/* Comments List */}
      {comments.length > 0 && (
        <div className="space-y-2.5 pl-2 sm:pl-4 border-l-2 border-stone-100 dark:border-stone-800 mt-2">
          {comments.map((comm) => (
            <div key={comm.id} className="flex items-start gap-2.5 text-xs group">
              <img
                src={getUserAvatar(comm.authorAvatar)}
                alt={comm.authorName}
                onError={handleUserAvatarError}
                onClick={() => setSelectedUserIdForModal(comm.authorUid)}
                className="w-7 h-7 rounded-lg object-cover ring-1 ring-stone-200 dark:ring-stone-700 shrink-0 cursor-pointer hover:opacity-85"
              />
              <div className="flex-1 bg-stone-50/90 dark:bg-stone-850 p-2.5 rounded-xl rounded-tl-xs border border-stone-200/70 dark:border-stone-750 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      onClick={() => setSelectedUserIdForModal(comm.authorUid)}
                      className="font-bold text-stone-900 dark:text-stone-100 cursor-pointer hover:text-[#8B181B]"
                    >
                      {comm.authorName}
                    </span>
                    {comm.authorBatch && (
                      <span className="text-[10px] text-stone-400 dark:text-stone-500">
                        '{comm.authorBatch.slice(-2)}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-stone-400">
                    {new Date(comm.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-stone-700 dark:text-stone-300 text-xs leading-relaxed">
                  {comm.content}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
