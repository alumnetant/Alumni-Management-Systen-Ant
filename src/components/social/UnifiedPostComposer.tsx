/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  EyeOff,
  Loader2,
  Pin,
  Send,
  Upload,
  X
} from 'lucide-react';
import { useAlumni } from '../../context/AlumniContext';
import { InstitutionalFeedPost } from '../../types';
import { validateUploadedFile } from '../../lib/security';
import { compressImage } from '../../lib/utils';
import { getUserAvatar, handleUserAvatarError } from '../../lib/defaultImages';

type PostVisibility = NonNullable<InstitutionalFeedPost['visibility']>;

const PRESET_CAMPUS_PHOTOS = [
  { name: 'Academic Tower', url: '/assets/landing-building-2.jpg' },
  { name: 'Campus Entrance', url: '/assets/landing-building-1.jpg' },
  { name: 'Aerial Campus', url: '/assets/landing-building-3.jpg' },
  { name: 'College Seal', url: '/assets/cecilians-seal.jpg' }
];

interface UnifiedPostComposerProps {
  mode: 'feed' | 'profile';
  titleInputRef?: React.RefObject<HTMLInputElement | null>;
  onPostCreated?: (post: InstitutionalFeedPost) => void;
}

export const UnifiedPostComposer: React.FC<UnifiedPostComposerProps> = ({
  mode,
  titleInputRef,
  onPostCreated
}) => {
  const { currentUser, createSocialPost, showToast } = useAlumni();

  const isProfileMode = mode === 'profile';
  const [composerExpanded, setComposerExpanded] = useState(isProfileMode);
  const [postType, setPostType] = useState<'update' | 'gallery' | 'announcement'>('update');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [visibility, setVisibility] = useState<PostVisibility>('alumni');
  const [targetBatch, setTargetBatch] = useState('');
  const [targetDepartment, setTargetDepartment] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [pinExpiresAt, setPinExpiresAt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!currentUser || currentUser.role === 'employer') return null;

  const isAdminOrSuperAdmin =
    currentUser.role === 'admin' || currentUser.role === 'superadmin';
  const canPostAnonymously = currentUser.role === 'alumni';

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const validation = await validateUploadedFile(file, 'images');
    if (!validation.valid) {
      showToast(validation.error || 'Please select a valid JPEG, PNG, or WebP photo.', 'error');
      return;
    }

    try {
      const compressed = await compressImage(file, 1080, 720, 0.85);
      setImageUrl(compressed);
      showToast('Photo attached to your post.', 'success');
    } catch {
      showToast('Could not process the selected image.', 'error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      showToast('Please write something to share with the community.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const parsedTags = tagsText
        ? tagsText
            .split(',')
            .map((t) => t.trim().replace(/^#/, ''))
            .filter(Boolean)
        : [
            postType === 'gallery'
              ? 'CampusGallery'
              : postType === 'announcement'
              ? 'Announcement'
              : 'Update'
          ];

      const resolvedBatch =
        visibility === 'batch' ? targetBatch.trim() || currentUser.batch : undefined;
      const resolvedDepartment =
        visibility === 'department'
          ? targetDepartment.trim() || currentUser.department || currentUser.course
          : undefined;

      const result = await createSocialPost({
        postType,
        title: title.trim() || (postType === 'announcement' ? 'Community Announcement' : ''),
        content: content.trim(),
        imageUrl: imageUrl.trim() || undefined,
        visibility,
        targetBatch: resolvedBatch,
        targetDepartment: resolvedDepartment,
        isAnonymous: canPostAnonymously ? isAnonymous : false,
        isPinned: isAdminOrSuperAdmin ? isPinned : false,
        pinExpiresAt:
          isAdminOrSuperAdmin && isPinned && pinExpiresAt
            ? new Date(pinExpiresAt).toISOString()
            : undefined,
        tags: parsedTags
      });

      const created = result?.success ? result.post : undefined;
      if (created) {
        if (onPostCreated) {
          onPostCreated(created);
        }
        setTitle('');
        setContent('');
        setImageUrl('');
        setTagsText('');
        setVisibility('alumni');
        setTargetBatch('');
        setTargetDepartment('');
        setIsAnonymous(false);
        setIsPinned(false);
        setPinExpiresAt('');
        if (!isProfileMode) {
          setComposerExpanded(false);
        }
      }
    } catch (err: any) {
      showToast(err?.message || 'Could not publish post.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const showDetails = isProfileMode || composerExpanded;

  return (
    <form
      onSubmit={handleSubmit}
      className={
        isProfileMode
          ? 'bg-stone-50/70 dark:bg-stone-800/40 rounded-2xl border border-stone-200/90 dark:border-stone-700/60 p-5 space-y-3'
          : 'pt-3 border-t border-stone-100 dark:border-stone-800 space-y-3'
      }
    >
      {isProfileMode && (
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
            Create Post
          </span>
          <span className="text-[11px] text-stone-400 dark:text-stone-500">
            Appears on main feed and your timeline immediately
          </span>
        </div>
      )}

      <div className={isProfileMode ? 'space-y-2.5' : 'flex items-start gap-3'}>
        {!isProfileMode && (
          <img
            src={getUserAvatar(currentUser.profilePictureUrl)}
            alt={currentUser.name || 'Member'}
            onError={handleUserAvatarError}
            className="w-10 h-10 rounded-2xl object-cover border border-stone-200 dark:border-stone-700 shrink-0"
          />
        )}

        <div className={isProfileMode ? 'space-y-2.5' : 'flex-1 space-y-2'}>
          {showDetails && (
            <input
              ref={titleInputRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Headline or post title (optional)"
              className={`w-full px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#8B181B] focus:border-[#8B181B] ${
                isProfileMode ? 'bg-white dark:bg-stone-900 py-2.5' : 'bg-stone-50 dark:bg-stone-800'
              }`}
            />
          )}

          <textarea
            rows={showDetails ? 3 : 2}
            value={content}
            onFocus={() => {
              if (!isProfileMode) setComposerExpanded(true);
            }}
            onChange={(e) => setContent(e.target.value)}
            placeholder={
              isProfileMode
                ? 'Share an update, achievement, or mentorship offer with fellow Cecilians...'
                : `Share a career update, achievement, or campus photo, ${currentUser.name?.split(' ')[0] || 'Cecilian'}...`
            }
            className={`w-full px-3.5 py-2.5 text-sm rounded-xl border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#8B181B]/20 focus:border-[#8B181B] resize-none leading-relaxed ${
              isProfileMode ? 'bg-white dark:bg-stone-900' : 'bg-stone-50 dark:bg-stone-800'
            }`}
          />
        </div>
      </div>

      {showDetails && (
        <div className={isProfileMode ? 'space-y-3' : 'pl-0 sm:pl-13 space-y-3'}>
          {/* Category, Visibility & Toggles */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select
              value={postType}
              onChange={(e) => setPostType(e.target.value as 'update' | 'gallery' | 'announcement')}
              className={`px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 font-semibold min-h-[40px] ${
                isProfileMode ? 'bg-white dark:bg-stone-900' : 'bg-stone-50 dark:bg-stone-800'
              }`}
              aria-label="Post Category"
            >
              <option value="update">Community Update</option>
              <option value="gallery">Campus Gallery</option>
              <option value="announcement">Announcement</option>
            </select>

            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as PostVisibility)}
              className={`px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 font-semibold min-h-[40px] ${
                isProfileMode ? 'bg-white dark:bg-stone-900' : 'bg-stone-50 dark:bg-stone-800'
              }`}
              aria-label="Post Visibility"
            >
              <option value="alumni">All Verified Alumni</option>
              <option value="public">Public</option>
              <option value="batch">
                {currentUser.batch ? `Batch ${currentUser.batch} Only` : 'Batch Only'}
              </option>
              <option value="department">
                {currentUser.department || currentUser.course
                  ? `${currentUser.department || currentUser.course} Only`
                  : 'Department Only'}
              </option>
              <option value="private">Only Me (Private)</option>
            </select>

            {visibility === 'batch' && (
              <input
                type="text"
                value={targetBatch}
                onChange={(e) => setTargetBatch(e.target.value)}
                placeholder={currentUser.batch || 'Batch year'}
                className={`px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 text-xs text-stone-800 dark:text-stone-200 w-32 min-h-[40px] ${
                  isProfileMode ? 'bg-white dark:bg-stone-900' : 'bg-stone-50 dark:bg-stone-800'
                }`}
              />
            )}

            {visibility === 'department' && (
              <input
                type="text"
                value={targetDepartment}
                onChange={(e) => setTargetDepartment(e.target.value)}
                placeholder={currentUser.department || currentUser.course || 'Department'}
                className={`px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 text-xs text-stone-800 dark:text-stone-200 w-44 min-h-[40px] ${
                  isProfileMode ? 'bg-white dark:bg-stone-900' : 'bg-stone-50 dark:bg-stone-800'
                }`}
              />
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png, image/jpeg, image/webp"
              onChange={handlePhotoSelect}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-semibold text-stone-700 dark:text-stone-200 cursor-pointer min-h-[40px] transition-colors ${
                isProfileMode
                  ? 'bg-white dark:bg-stone-900 hover:bg-stone-100 dark:hover:bg-stone-800'
                  : 'bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Photo</span>
            </button>

            {canPostAnonymously && (
              <label
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 cursor-pointer min-h-[40px] ${
                  isProfileMode ? 'bg-white dark:bg-stone-900' : 'bg-stone-50 dark:bg-stone-800'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  className="accent-[#8B181B]"
                />
                <EyeOff className="w-3.5 h-3.5 text-stone-500" />
                <span>Post Anonymously</span>
              </label>
            )}

            {isAdminOrSuperAdmin && (
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-300 cursor-pointer min-h-[40px]">
                <input
                  type="checkbox"
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                  className="accent-[#8B181B]"
                />
                <Pin className="w-3.5 h-3.5" />
                <span>Pin Announcement</span>
              </label>
            )}
          </div>

          {canPostAnonymously && isAnonymous && (
            <p className="text-[11px] text-amber-700 dark:text-amber-400">
              Anonymous posts appear on the main feed only and are excluded from your public profile timeline.
            </p>
          )}

          {isAdminOrSuperAdmin && isPinned && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <label className="text-stone-600 dark:text-stone-400 font-medium">
                Pin expires on (optional):
              </label>
              <input
                type="datetime-local"
                value={pinExpiresAt}
                onChange={(e) => setPinExpiresAt(e.target.value)}
                className={`px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 ${
                  isProfileMode ? 'bg-white dark:bg-stone-900' : 'bg-stone-50 dark:bg-stone-800'
                }`}
              />
            </div>
          )}

          {/* Quick Campus Photos */}
          <div className="flex flex-wrap items-center gap-1.5">
            {PRESET_CAMPUS_PHOTOS.map((preset) => (
              <button
                key={preset.url}
                type="button"
                onClick={() => setImageUrl(preset.url)}
                className={`px-2.5 py-1.5 rounded-xl text-[11px] font-medium border cursor-pointer transition-colors min-h-[34px] ${
                  imageUrl === preset.url
                    ? 'bg-red-50 border-[#8B181B] text-[#8B181B] dark:bg-red-950/40 dark:text-red-300'
                    : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800'
                }`}
              >
                {preset.name}
              </button>
            ))}

            {imageUrl && (
              <button
                type="button"
                onClick={() => setImageUrl('')}
                className="text-xs text-red-600 dark:text-red-400 hover:underline cursor-pointer ml-auto"
              >
                Remove image
              </button>
            )}
          </div>

          {imageUrl && (
            <div className="relative rounded-xl overflow-hidden border border-stone-200 dark:border-stone-700 max-h-52 bg-stone-950">
              <img src={imageUrl} alt="Attachment preview" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => setImageUrl('')}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 text-white cursor-pointer"
                aria-label="Remove image"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <input
            type="text"
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
            placeholder="Tags (comma-separated, e.g. BSIT, Career, Homecoming)"
            className={`w-full px-3.5 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-white ${
              isProfileMode ? 'bg-white dark:bg-stone-900' : 'bg-stone-50 dark:bg-stone-800'
            }`}
          />
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        {!isProfileMode ? (
          <button
            type="button"
            onClick={() => setComposerExpanded((prev) => !prev)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 cursor-pointer min-h-[38px]"
          >
            {composerExpanded ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                <span>Fewer options</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                <span>Add photo, visibility &amp; options</span>
              </>
            )}
          </button>
        ) : (
          <span className="text-[11px] text-stone-500 dark:text-stone-400">
            Synced across feed &amp; profile
          </span>
        )}

        <button
          type="submit"
          disabled={isSubmitting || !content.trim()}
          className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#8B181B] hover:bg-[#721316] disabled:opacity-50 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer min-h-[40px]"
        >
          {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          <span>{isSubmitting ? 'Posting...' : 'Publish Post'}</span>
        </button>
      </div>
    </form>
  );
};
