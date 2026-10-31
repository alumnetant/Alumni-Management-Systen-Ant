/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Award, Image as ImageIcon, Send, X, Sparkles, Building2 } from 'lucide-react';
import { useAlumni } from '../../../context/AlumniContext';
import { getUserAvatar, handleUserAvatarError } from '../../../lib/defaultImages';
import { compressImage } from '../../../lib/utils';

export const FeedPostComposer: React.FC = () => {
  const { currentUser, createMilestone, showToast } = useAlumni();
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'Promotion' | 'Award' | 'Startup' | 'Achievement'>('Promotion');
  const [company, setCompany] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isCompressing, setIsCompressing] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image (PNG, JPG, WebP)', 'error');
      return;
    }

    try {
      setIsCompressing(true);
      const compressed = await compressImage(file, 1200, 800, 0.85);
      setImageUrl(compressed);
    } catch {
      showToast('Failed to process photo.', 'error');
    } finally {
      setIsCompressing(false);
    }
  };

  const handlePublish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      showToast('Please provide both a title and description.', 'error');
      return;
    }

    createMilestone({
      title: title.trim(),
      description: description.trim(),
      category,
      company: company.trim() || undefined,
      images: imageUrl ? [imageUrl] : [],
      batch: currentUser?.batch,
      alumnusId: currentUser?.uid,
      alumnusName: currentUser?.name,
      alumnusAvatar: currentUser?.profilePictureUrl,
      awardDate: new Date().toISOString()
    });

    showToast('Your milestone was shared to the alumni timeline!', 'success');
    setTitle('');
    setDescription('');
    setCompany('');
    setImageUrl('');
    setIsOpen(false);
  };

  return (
    <>
      {/* Quick Trigger Bar */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl sm:rounded-3xl border border-stone-200/90 dark:border-stone-800 p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-3">
        <div className="flex items-center gap-3">
          <img
            src={getUserAvatar(currentUser?.profilePictureUrl)}
            alt={currentUser?.name || 'Alumnus'}
            onError={handleUserAvatarError}
            className="w-10 h-10 rounded-2xl object-cover ring-1 ring-stone-200/90 dark:ring-stone-700 shrink-0"
          />

          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="flex-1 text-left px-4 py-2.5 bg-stone-50 dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-750 text-stone-500 dark:text-stone-400 text-xs sm:text-sm rounded-xl sm:rounded-2xl border border-stone-200/70 dark:border-stone-700 transition-colors cursor-pointer"
          >
            Share an achievement, promotion, or story with your batch...
          </button>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-stone-100 dark:border-stone-800 text-xs">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => {
                setCategory('Promotion');
                setIsOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 font-semibold cursor-pointer transition-colors"
            >
              <Award className="w-4 h-4 text-amber-600" />
              <span>Milestone</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setCategory('Achievement');
                setIsOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 font-semibold cursor-pointer transition-colors"
            >
              <ImageIcon className="w-4 h-4 text-emerald-600" />
              <span>Photo</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="px-4 py-1.5 bg-[#8B181B] hover:bg-[#721316] text-white rounded-xl font-bold transition-all cursor-pointer shadow-2xs"
          >
            Post
          </button>
        </div>
      </div>

      {/* Post Modal Drawer */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsOpen(false);
          }}
        >
          <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#8B181B]" />
                <h3 className="text-base font-bold text-stone-900 dark:text-white">Share with Alumni Timeline</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePublish} className="space-y-4">
              {/* Category Pill Switcher */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {(['Promotion', 'Award', 'Startup', 'Achievement'] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      category === cat
                        ? 'bg-[#8B181B] text-white shadow-2xs'
                        : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Promoted to Senior Engineering Lead, Passed CPA Board Exam"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-hidden focus:ring-2 focus:ring-[#8B181B]/20 focus:border-[#8B181B]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">Company / Organization (Optional)</label>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="e.g. Accenture Philippines, San Miguel Corp, Department of Education"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-hidden focus:ring-2 focus:ring-[#8B181B]/20 focus:border-[#8B181B]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">Story / Note *</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Share the journey, lessons learned, or dedication to your mentors and batchmates..."
                  rows={4}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-hidden focus:ring-2 focus:ring-[#8B181B]/20 focus:border-[#8B181B] resize-none"
                />
              </div>

              {/* Image Upload */}
              <div>
                <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">Attach Photo</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="text-xs text-stone-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-stone-100 file:text-stone-700 hover:file:bg-stone-200 cursor-pointer"
                />
                {imageUrl && (
                  <div className="mt-2 relative rounded-xl overflow-hidden max-h-40 border border-stone-200">
                    <img src={imageUrl} alt="Preview" className="w-full h-36 object-cover" />
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      className="absolute top-1.5 right-1.5 p-1 bg-black/60 text-white rounded-full hover:bg-black cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-stone-100 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCompressing}
                  className="px-5 py-2 bg-[#8B181B] hover:bg-[#721316] text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  Publish to Feed
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
