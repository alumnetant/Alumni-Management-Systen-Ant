/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import {
  Calendar,
  EyeOff,
  Globe,
  Hash,
  Image as ImageIcon,
  Loader2,
  Megaphone,
  Pin,
  Trash2,
  Users
} from 'lucide-react';
import { useAlumni } from '../../context/AlumniContext';
import { InstitutionalFeedPost } from '../../types';
import { validateUploadedFile } from '../../lib/security';
import { compressImage } from '../../lib/utils';
import { getUserAvatar, handleUserAvatarError } from '../../lib/defaultImages';
import { triggerHaptic } from '../../services/mobileAppService';
import { MobileBottomSheet } from './MobilePrimitives';

type PostVisibility = NonNullable<InstitutionalFeedPost['visibility']>;

const CAMPUS_PRESETS = [
  { name: 'Academic Tower', url: '/assets/landing-building-2.jpg' },
  { name: 'Campus Gate', url: '/assets/landing-building-1.jpg' },
  { name: 'Aerial Campus', url: '/assets/landing-building-3.jpg' },
  { name: 'College Seal', url: '/assets/cecilians-seal.jpg' }
];

interface MobileCreateSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated?: (post: InstitutionalFeedPost) => void;
  onOpenEvents?: () => void;
  onOpenAnnouncements?: () => void;
}

export const MobileCreateSheet: React.FC<MobileCreateSheetProps> = ({
  isOpen,
  onClose,
  onPostCreated,
  onOpenEvents,
  onOpenAnnouncements
}) => {
  const { currentUser, createSocialPost, permissions, showToast } = useAlumni();

  const [postType, setPostType] = useState<'update' | 'gallery' | 'announcement'>('update');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [visibility, setVisibility] = useState<PostVisibility>('alumni');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [showTagsRow, setShowTagsRow] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!currentUser || currentUser.role === 'employer') return null;

  const isVerifiedAlumni = currentUser.isVerified !== false && currentUser.status !== 'pending_verification';
  const isAdminOrSuperAdmin =
    currentUser.role === 'admin' || currentUser.role === 'superadmin';
  const canPostAnonymously = currentUser.role === 'alumni';

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const validation = await validateUploadedFile(file, 'images');
    if (!validation.valid) {
      setInlineError(validation.error || 'Please choose a valid JPEG, PNG, or WebP image.');
      return;
    }

    try {
      const compressed = await compressImage(file, 1080, 720, 0.85);
      setImageUrl(compressed);
      setPostType('gallery');
      setInlineError(null);
      triggerHaptic('light');
    } catch {
      setInlineError('Could not process selected photo.');
    }
  };

  const resetForm = () => {
    setPostType('update');
    setTitle('');
    setContent('');
    setImageUrl('');
    setTagsText('');
    setVisibility('alumni');
    setIsAnonymous(false);
    setIsPinned(false);
    setShowPresets(false);
    setShowTagsRow(false);
    setInlineError(null);
  };

  const handleShare = async () => {
    if (!isVerifiedAlumni) {
      setInlineError('Your account is pending Registrar verification before posting.');
      return;
    }
    if (!content.trim()) {
      setInlineError('Write a caption or update before sharing.');
      return;
    }

    setIsSubmitting(true);
    setInlineError(null);
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

      const result = await createSocialPost({
        postType,
        title: title.trim() || (postType === 'announcement' ? 'Community Announcement' : ''),
        content: content.trim(),
        imageUrl: imageUrl.trim() || undefined,
        visibility,
        targetBatch: visibility === 'batch' ? currentUser.batch : undefined,
        targetDepartment:
          visibility === 'department' ? currentUser.department || currentUser.course : undefined,
        isAnonymous: canPostAnonymously ? isAnonymous : false,
        isPinned: isAdminOrSuperAdmin ? isPinned : false,
        tags: parsedTags
      });

      if (result?.success && result.post) {
        triggerHaptic('medium');
        onPostCreated?.(result.post);
        resetForm();
        onClose();
      } else {
        setInlineError('Could not publish post right now. Please try again.');
      }
    } catch (err: any) {
      setInlineError(err?.message || 'Could not publish post.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <MobileBottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="New Post"
      fullHeight
      headerRight={
        <button
          type="button"
          onClick={handleShare}
          disabled={isSubmitting || !content.trim()}
          className="min-h-[44px] px-4 rounded-full bg-[#8B181B] dark:bg-[#E11D48] text-white text-[14px] font-bold disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
        >
          {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          <span>Share</span>
        </button>
      }
    >
      <div className="flex flex-col h-full bg-white dark:bg-[#121212]">
        <div className="p-4 space-y-4 flex-1">
          {/* Author Row + Audience Picker */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src={getUserAvatar(isAnonymous ? undefined : currentUser.profilePictureUrl)}
                onError={handleUserAvatarError}
                alt={currentUser.name}
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-full object-cover border border-[#E5E7EB] dark:border-[#27272A]"
              />
              <div className="min-w-0">
                <p className="text-[14px] font-bold text-[#111827] dark:text-[#FAFAFA] truncate">
                  {isAnonymous ? 'Anonymous Alumnus' : currentUser.name}
                </p>
                <p className="text-[12px] text-[#6B7280] dark:text-[#A1A1AA] truncate">
                  {currentUser.course || `Class of ${currentUser.batch || '2024'}`}
                </p>
              </div>
            </div>

            <select
              aria-label="Post audience"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as PostVisibility)}
              className="min-h-[44px] px-3.5 rounded-full bg-[#F3F4F6] dark:bg-[#262626] text-[13px] font-semibold text-[#111827] dark:text-[#FAFAFA] border-0 focus:outline-none cursor-pointer"
            >
              <option value="alumni">All Alumni</option>
              <option value="batch">Class {currentUser.batch || 'Batch'}</option>
              <option value="department">My Department</option>
              <option value="public">Public</option>
            </select>
          </div>

          {inlineError && (
            <div className="px-3.5 py-2.5 rounded-xl bg-[#FEF2F2] dark:bg-[#E11D48]/15 text-[13px] font-medium text-[#DC2626] dark:text-[#FB7185]">
              {inlineError}
            </div>
          )}

          {/* Optional Headline */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Headline (optional)"
            className="w-full text-[16px] font-semibold text-[#111827] dark:text-[#FAFAFA] placeholder:text-[#6B7280] dark:placeholder:text-[#A1A1AA] bg-transparent border-0 border-b border-[#E5E7EB] dark:border-[#27272A] pb-2 focus:outline-none focus:border-[#8B181B] dark:focus:border-[#FB7185]"
          />

          {/* Main Caption Field */}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Share a milestone, campus memory, or alumni update..."
            rows={5}
            autoFocus
            className="w-full text-[16px] text-[#111827] dark:text-[#FAFAFA] placeholder:text-[#6B7280] dark:placeholder:text-[#A1A1AA] bg-transparent border-0 resize-none focus:outline-none leading-relaxed"
          />

          {/* Attached Photo Preview */}
          {imageUrl && (
            <div className="relative rounded-xl overflow-hidden border border-[#E5E7EB] dark:border-[#27272A]">
              <img
                src={imageUrl}
                alt="Attachment preview"
                className="w-full max-h-64 object-cover"
              />
              <button
                type="button"
                onClick={() => setImageUrl('')}
                aria-label="Remove attached photo"
                className="absolute top-2 right-2 w-[44px] h-[44px] rounded-full bg-black/75 text-white flex items-center justify-center cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Campus Presets Picker */}
          {showPresets && (
            <div className="space-y-2">
              <p className="text-[12px] font-semibold text-[#6B7280] dark:text-[#A1A1AA]">
                Campus Heritage Photos
              </p>
              <div className="grid grid-cols-4 gap-2">
                {CAMPUS_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => {
                      setImageUrl(preset.url);
                      setPostType('gallery');
                      setShowPresets(false);
                    }}
                    className="rounded-lg overflow-hidden border border-[#E5E7EB] dark:border-[#27272A] aspect-square cursor-pointer"
                  >
                    <img
                      src={preset.url}
                      alt={preset.name}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Optional Hashtags Field */}
          {showTagsRow && (
            <input
              type="text"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder="Tags separated by commas (e.g. Reunion, Batch2023)"
              className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#F3F4F6] dark:bg-[#262626] text-[16px] text-[#111827] dark:text-[#FAFAFA] placeholder:text-[#6B7280] dark:placeholder:text-[#A1A1AA] focus:outline-none"
            />
          )}

          {/* Quick Jump Actions for Permitted Users */}
          {(permissions.canCreateEvents || permissions.canPostAnnouncements) && (
            <div className="pt-2 border-t border-[#E5E7EB] dark:border-[#27272A] flex flex-wrap gap-2">
              {permissions.canCreateEvents && onOpenEvents && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenEvents();
                  }}
                  className="min-h-[44px] px-4 rounded-full bg-[#F3F4F6] dark:bg-[#262626] text-[13px] font-semibold text-[#111827] dark:text-[#FAFAFA] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Calendar className="w-4 h-4 text-[#8B181B] dark:text-[#FB7185]" />
                  <span>Go to Events</span>
                </button>
              )}
              {permissions.canPostAnnouncements && onOpenAnnouncements && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAnnouncements();
                  }}
                  className="min-h-[44px] px-4 rounded-full bg-[#F3F4F6] dark:bg-[#262626] text-[13px] font-semibold text-[#111827] dark:text-[#FAFAFA] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Megaphone className="w-4 h-4 text-[#8B181B] dark:text-[#FB7185]" />
                  <span>Official Bulletin</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Sticky Bottom Accessory Bar */}
        <div className="sticky bottom-0 px-3 py-2 border-t border-[#E5E7EB] dark:border-[#27272A] bg-white dark:bg-[#121212] flex items-center justify-between gap-2 pb-safe">
          <div className="flex items-center gap-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handlePhotoSelect}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Upload photo"
              className="w-[44px] h-[44px] flex items-center justify-center rounded-full text-[#111827] dark:text-[#FAFAFA] hover:bg-[#F3F4F6] dark:hover:bg-[#262626] cursor-pointer"
            >
              <ImageIcon className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => setShowPresets((p) => !p)}
              aria-label="Campus photos"
              className={`min-h-[44px] px-3 rounded-full text-[13px] font-semibold flex items-center gap-1.5 cursor-pointer ${
                showPresets
                  ? 'bg-[#FEF2F2] dark:bg-[#E11D48]/15 text-[#8B181B] dark:text-[#FB7185]'
                  : 'text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F3F4F6] dark:hover:bg-[#262626]'
              }`}
            >
              <Globe className="w-4 h-4" />
              <span>Campus</span>
            </button>

            <button
              type="button"
              onClick={() => setShowTagsRow((t) => !t)}
              aria-label="Add tags"
              className={`w-[44px] h-[44px] flex items-center justify-center rounded-full cursor-pointer ${
                showTagsRow
                  ? 'bg-[#FEF2F2] dark:bg-[#E11D48]/15 text-[#8B181B] dark:text-[#FB7185]'
                  : 'text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F3F4F6] dark:hover:bg-[#262626]'
              }`}
            >
              <Hash className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-1">
            {canPostAnonymously && (
              <button
                type="button"
                onClick={() => {
                  setIsAnonymous((prev) => !prev);
                  triggerHaptic('light');
                  showToast(
                    !isAnonymous ? 'Posting anonymously.' : 'Posting with your name.',
                    'info'
                  );
                }}
                aria-label="Toggle anonymous post"
                className={`min-h-[44px] px-3.5 rounded-full text-[12px] font-semibold flex items-center gap-1.5 cursor-pointer ${
                  isAnonymous
                    ? 'bg-[#111827] dark:bg-[#FAFAFA] text-white dark:text-[#111827]'
                    : 'bg-[#F3F4F6] dark:bg-[#262626] text-[#6B7280] dark:text-[#A1A1AA]'
                }`}
              >
                <EyeOff className="w-3.5 h-3.5" />
                <span>Anon</span>
              </button>
            )}
            {isAdminOrSuperAdmin && (
              <button
                type="button"
                onClick={() => setIsPinned((p) => !p)}
                aria-label="Pin post"
                className={`w-[44px] h-[44px] rounded-full flex items-center justify-center cursor-pointer ${
                  isPinned
                    ? 'bg-[#8B181B] dark:bg-[#E11D48] text-white'
                    : 'bg-[#F3F4F6] dark:bg-[#262626] text-[#6B7280] dark:text-[#A1A1AA]'
                }`}
              >
                <Pin className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </MobileBottomSheet>
  );
};
