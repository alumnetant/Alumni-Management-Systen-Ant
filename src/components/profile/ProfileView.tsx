import React, { useState } from 'react';
import {
  MapPin,
  Phone,
  Mail,
  Briefcase,
  GraduationCap,
  Edit,
  Camera,
  Share2,
  CheckCircle2,
  Users,
  Building,
  Calendar,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  CreditCard,
  FileDown,
  Upload,
  RefreshCw,
  Award,
  BookOpen,
  Hash,
  ShieldAlert,
  ChevronRight,
  Clock,
  Pencil,
  Trash2,
  Megaphone,
  Heart,
  MoreHorizontal
} from 'lucide-react';
import { useAlumni } from '../../context/AlumniContext';
import { InstitutionalFeedPost } from '../../types';
import { DigitalAlumniCard } from './DigitalAlumniCard';
import { PlatformOnly } from '../common/PlatformOnly';
import { ContactMask } from '../common/ContactMask';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { RegistrarSelfVerificationModal } from './RegistrarSelfVerificationModal';
import { ImageViewerModal } from '../common/ImageViewerModal';
import { exportProfileToPdfResume } from '../../services/pdfResumeService';
import { PdfResumePreviewModal } from './PdfResumePreviewModal';
import { compressImage } from '../../lib/utils';
import {
  getUserAvatar,
  getCoverPhoto,
  handleUserAvatarError,
  handleCoverPhotoError
} from '../../lib/defaultImages';

export const ProfileView: React.FC = () => {
  const {
    currentUser,
    updateProfile,
    updateUserProfile,
    showToast,
    openEditProfile,
    feedPosts,
    deleteFeedPost,
    updateFeedPost
  } = useAlumni();
  const [showRegistrarModal, setShowRegistrarModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isDraggingCover, setIsDraggingCover] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [showResumePreview, setShowResumePreview] = useState(false);
  const [showMoreActionsMenu, setShowMoreActionsMenu] = useState(false);
  const [profileViewTab, setProfileViewTab] = useState<'overview' | 'posts'>('overview');
  const [viewerImage, setViewerImage] = useState<{ url: string; title: string } | null>(null);

  // My Feed Posts author controls
  const [postToEdit, setPostToEdit] = useState<InstitutionalFeedPost | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [postToDelete, setPostToDelete] = useState<{ id: string; title: string } | null>(null);

  const avatarFileInputRef = React.useRef<HTMLInputElement>(null);
  const coverFileInputRef = React.useRef<HTMLInputElement>(null);

  // Automatically open the Edit Profile modal when triggered by external directives
  React.useEffect(() => {
    const handleOpenEdit = () => {
      openEditProfile();
    };

    window.addEventListener('applet:open-edit-profile', handleOpenEdit);

    try {
      if (sessionStorage.getItem('applet_open_edit_profile') === 'true') {
        sessionStorage.removeItem('applet_open_edit_profile');
        openEditProfile();
      }
    } catch {}

    return () => {
      window.removeEventListener('applet:open-edit-profile', handleOpenEdit);
    };
  }, [openEditProfile]);

  if (!currentUser) return null;

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validMimes.includes(file.type)) {
      showToast('Please select a valid image file (JPEG, PNG, or WebP).', 'error');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showToast('Image file size must be less than 10MB.', 'error');
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const dataUrl = await compressImage(file, 500, 500, 0.85);
      const updater = updateProfile || updateUserProfile;
      if (typeof updater === 'function') {
        updater({ profilePictureUrl: dataUrl });
      }
      setIsUploadingPhoto(false);
      showToast('Profile photo updated successfully!', 'success');
    } catch {
      setIsUploadingPhoto(false);
      showToast('Failed to process image. Please try again.', 'error');
    }
    e.target.value = '';
  };

  const processCoverFile = async (file: File) => {
    const validMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validMimes.includes(file.type)) {
      showToast('Please select a valid image file (JPEG, PNG, or WebP).', 'error');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      showToast('Cover image size must be less than 15MB.', 'error');
      return;
    }

    setIsUploadingCover(true);
    try {
      const dataUrl = await compressImage(file, 1200, 480, 0.82);
      const updater = updateProfile || updateUserProfile;
      if (typeof updater === 'function') {
        updater({ coverPhotoUrl: dataUrl });
      }
      setIsUploadingCover(false);
      showToast('Cover photo uploaded and saved successfully!', 'success');
    } catch {
      setIsUploadingCover(false);
      showToast('Failed to process cover image. Please try again.', 'error');
    }
  };

  const handleCoverFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processCoverFile(file);
    }
    e.target.value = '';
  };

  const handleShareProfile = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopiedLink(true);
    showToast('Profile link copied to clipboard!', 'success');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const isVerifiedUser = !!(currentUser.isVerified || (currentUser as any).verified || currentUser.verificationStatus === 'verified');
  const roleDisplay = (currentUser.role || 'alumni').toUpperCase();

  const myPosts = (feedPosts || []).filter(
    (post) =>
      post.authorId === currentUser.uid ||
      post.authorId === (currentUser as any).id ||
      post.authorName === currentUser.name
  );

  const handleStartEditPost = (post: InstitutionalFeedPost) => {
    setPostToEdit(post);
    setEditTitle(post.title || '');
    setEditContent(post.content || '');
  };

  const handleSaveEditPost = async () => {
    if (!postToEdit) return;
    if (!editContent.trim()) {
      showToast('Post content cannot be empty.', 'error');
      return;
    }
    if (updateFeedPost) {
      await updateFeedPost(postToEdit.id, {
        title: editTitle.trim(),
        content: editContent.trim(),
        isEdited: true
      });
      showToast('Post updated successfully!', 'success');
      setPostToEdit(null);
    }
  };

  const handleConfirmDeletePost = async () => {
    if (!postToDelete) return;
    if (deleteFeedPost) {
      await deleteFeedPost(postToDelete.id);
      showToast('Post removed from feed.', 'success');
      setPostToDelete(null);
    }
  };

  return (
    <div className="space-y-6 pb-16 max-w-7xl mx-auto">
      {/* ========================================================
          HERO CARD: COVER + AVATAR + IDENTITY + ACTIONS
          ======================================================== */}
      <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200/90 dark:border-stone-800 overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.02),0_8px_24px_rgba(0,0,0,0.03)] dark:shadow-none transition-colors duration-200">
        
        {/* Cover Photo Container */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDraggingCover(true);
          }}
          onDragLeave={() => setIsDraggingCover(false)}
          onDrop={async (e) => {
            e.preventDefault();
            setIsDraggingCover(false);
            const file = e.dataTransfer.files?.[0];
            if (file) {
              await processCoverFile(file);
            }
          }}
          className={`relative h-48 sm:h-64 md:h-72 bg-stone-900 group transition-all duration-200 overflow-hidden ${
            isDraggingCover ? 'ring-4 ring-[#8B181B] ring-inset' : ''
          }`}
        >
          <input
            ref={coverFileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleCoverFileChange}
          />
          <img
            src={getCoverPhoto(currentUser.coverPhotoUrl)}
            alt="Cover"
            onError={handleCoverPhotoError}
            onClick={() =>
              setViewerImage({
                url: getCoverPhoto(currentUser.coverPhotoUrl),
                title: 'Cover Photo'
              })
            }
            className="w-full h-full object-cover opacity-90 dark:opacity-80 transition-opacity cursor-pointer hover:opacity-100 dark:hover:opacity-95"
            title="Click to view full cover photo"
          />

          {/* Elegant Scrim Gradient for text contrast */}
          <div className="absolute inset-0 bg-gradient-to-t from-stone-950/70 via-stone-950/20 to-transparent pointer-events-none" />

          {/* Drag and Drop Active Overlay */}
          {isDraggingCover && (
            <div className="absolute inset-0 bg-stone-950/80 backdrop-blur-xs flex flex-col items-center justify-center gap-2 text-white font-medium text-sm z-30 animate-in fade-in">
              <Upload className="w-8 h-8 text-white animate-bounce" />
              <span className="font-semibold text-base">Drop photo here to update cover</span>
              <span className="text-xs text-stone-300">Supports JPG, PNG, WebP up to 15MB</span>
            </div>
          )}

          {/* Loading overlay during device upload */}
          {isUploadingCover && (
            <div className="absolute inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center gap-2.5 text-white font-semibold text-xs sm:text-sm z-30">
              <RefreshCw className="w-5 h-5 animate-spin text-white" />
              <span>Optimizing & saving cover photo...</span>
            </div>
          )}

          {/* Cover Action Controls */}
          <div className="absolute top-3 sm:top-4 right-3 sm:right-4 flex items-center gap-2 z-10">
            <button
              type="button"
              onClick={() => coverFileInputRef.current?.click()}
              disabled={isUploadingCover}
              className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 bg-black/60 hover:bg-black/80 text-white rounded-xl text-xs font-semibold backdrop-blur-md transition-all cursor-pointer shadow-md hover:scale-[1.02] active:scale-95 border border-white/10"
              title="Upload cover photo from your device"
            >
              <Upload className="w-3.5 h-3.5 text-white" />
              <span>Upload Cover</span>
            </button>
            <button
              type="button"
              onClick={() => openEditProfile()}
              className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 bg-black/45 hover:bg-black/65 text-white/90 hover:text-white rounded-xl text-xs font-medium backdrop-blur-md transition-colors cursor-pointer border border-white/10"
              title="More cover options & campus presets"
            >
              <Camera className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Presets</span>
            </button>
          </div>
        </div>

        {/* Profile Details & Avatar Header */}
        <div className="px-4 sm:px-8 pb-8">
          <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-5 sm:gap-6 -mt-14 sm:-mt-20 mb-6">
            
            {/* Avatar & Photo Upload Trigger */}
            <div className="relative self-start shrink-0 z-10">
              <input
                ref={avatarFileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleAvatarFileChange}
              />
              <div className="relative group">
                <img
                  src={getUserAvatar(currentUser.profilePictureUrl)}
                  alt={currentUser.name}
                  onError={handleUserAvatarError}
                  onClick={() =>
                    setViewerImage({
                      url: getUserAvatar(currentUser.profilePictureUrl),
                      title: `${currentUser.name} — Profile Picture`
                    })
                  }
                  className="w-24 h-24 sm:w-36 sm:h-36 rounded-2xl object-cover border-4 border-white dark:border-stone-900 shadow-[0_8px_24px_rgba(0,0,0,0.15)] bg-stone-100 dark:bg-stone-800 ring-1 ring-stone-900/10 dark:ring-stone-700/50 aspect-square cursor-pointer hover:opacity-95 hover:scale-[1.02] transition-all"
                  title="Click to view enlarged profile photo"
                />
                {isUploadingPhoto && (
                  <div className="absolute inset-0 bg-black/60 rounded-2xl flex items-center justify-center text-white">
                    <RefreshCw className="w-5 h-5 animate-spin text-white" />
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => avatarFileInputRef.current?.click()}
                disabled={isUploadingPhoto}
                className="absolute bottom-1 right-1 sm:bottom-2 sm:right-2 p-1.5 sm:p-2 bg-[#8B181B] hover:bg-[#721316] text-white rounded-xl shadow-md transition-all cursor-pointer ring-2 ring-white dark:ring-stone-900 hover:scale-105 active:scale-95"
                title="Directly upload new profile photo"
              >
                <Camera className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2]" />
              </button>
            </div>

            {/* Profile Actions Toolbar */}
            <div className="flex items-center gap-2 w-full lg:w-auto pt-2 lg:pt-0 relative">
              {/* Primary Collegiate CTA: Edit Profile */}
              <button
                type="button"
                onClick={() => openEditProfile()}
                className="flex-1 sm:flex-none justify-center flex items-center gap-2 px-4 sm:px-5 py-2.5 bg-[#8B181B] hover:bg-[#721316] text-white rounded-xl text-xs sm:text-sm font-bold shadow-[0_1px_3px_rgba(139,24,27,0.25)] hover:shadow-[0_4px_12px_rgba(139,24,27,0.2)] transition-all cursor-pointer shrink-0 min-h-[44px]"
              >
                <Edit className="w-4 h-4 stroke-[2]" />
                <span className="whitespace-nowrap">Edit Profile</span>
              </button>

              {/* Registrar Verification CTA: Shown strictly if alumnus is not yet verified */}
              {currentUser.role === 'alumni' && !isVerifiedUser && (
                <button
                  type="button"
                  onClick={() => setShowRegistrarModal(true)}
                  className={`flex-1 sm:flex-none justify-center flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer min-h-[44px] ${
                    currentUser.verificationStatus === 'pending_review'
                      ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-xs font-bold'
                      : 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs font-bold'
                  }`}
                  title="Verify academic standing with the Office of the Registrar"
                >
                  <ShieldCheck className="w-4 h-4 shrink-0 text-white" />
                  <span className="truncate">
                    {currentUser.verificationStatus === 'pending_review' ? 'Verification Pending' : 'Verify with Registrar'}
                  </span>
                </button>
              )}

              {/* Overflow Actions Menu Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowMoreActionsMenu(!showMoreActionsMenu)}
                  className="p-2.5 bg-stone-100 hover:bg-stone-200/80 text-stone-700 dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-200 rounded-xl transition-colors cursor-pointer border border-stone-200 dark:border-stone-700 min-h-[44px] min-w-[44px] flex items-center justify-center"
                  title="More actions"
                  aria-label="More profile actions"
                >
                  <MoreHorizontal className="w-5 h-5" />
                </button>

                {showMoreActionsMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowMoreActionsMenu(false)}
                    />
                    <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-stone-900 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-stone-200 dark:border-stone-800 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                      <button
                        type="button"
                        onClick={() => {
                          setShowMoreActionsMenu(false);
                          setShowResumePreview(true);
                        }}
                        className="w-full px-4 py-2.5 text-left text-xs sm:text-sm font-medium text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 flex items-center gap-2.5 transition-colors cursor-pointer"
                      >
                        <FileDown className="w-4 h-4 text-stone-500 dark:text-stone-400" />
                        <span>Download PDF Resume</span>
                      </button>

                      {currentUser.role !== 'employer' && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowMoreActionsMenu(false);
                            setProfileViewTab('overview');
                            setTimeout(() => {
                              const el = document.getElementById('digital-id-section');
                              el?.scrollIntoView({ behavior: 'smooth' });
                            }, 50);
                          }}
                          className="w-full px-4 py-2.5 text-left text-xs sm:text-sm font-medium text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 flex items-center gap-2.5 transition-colors cursor-pointer"
                        >
                          <CreditCard className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          <span>Digital Alumni Pass</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setShowMoreActionsMenu(false);
                          handleShareProfile();
                        }}
                        className="w-full px-4 py-2.5 text-left text-xs sm:text-sm font-medium text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 flex items-center gap-2.5 transition-colors cursor-pointer"
                      >
                        <Share2 className="w-4 h-4 text-stone-500 dark:text-stone-400" />
                        <span>{copiedLink ? 'Link Copied!' : 'Share Public Profile'}</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* User Bio Details: Clean unboxed typography per design guidance */}
          <div className="mt-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-sans text-2xl sm:text-3xl lg:text-4xl font-bold text-stone-900 dark:text-white tracking-tight">
                {currentUser.name}
              </h1>

              {/* Single official verified shield badge */}
              {isVerifiedUser && (
                <span
                  title="Official Registrar Verified Alumnus"
                  className="inline-flex items-center text-emerald-600 dark:text-emerald-400"
                >
                  <ShieldCheck className="w-6 h-6 stroke-[2.2]" />
                </span>
              )}
            </div>

            {/* Zero-Pill Unboxed Metadata Bar */}
            <div className="flex items-center gap-2 text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-1 font-medium flex-wrap">
              <span className="uppercase font-bold tracking-wider text-[#8B181B] dark:text-red-400">
                {roleDisplay}
              </span>
              {currentUser.studentId && (
                <>
                  <span className="text-stone-300 dark:text-stone-600">·</span>
                  <span className="font-mono">
                    <ContactMask value={currentUser.studentId} type="studentId" />
                  </span>
                </>
              )}
              {isVerifiedUser && (
                <>
                  <span className="text-stone-300 dark:text-stone-600">·</span>
                  <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                    Registrar Verified
                  </span>
                </>
              )}
            </div>

            <p className="text-sm sm:text-base font-medium text-stone-600 dark:text-stone-300 mt-2 leading-relaxed max-w-3xl">
              {currentUser.headline || (currentUser.role === 'employer' ? 'Corporate Industry Partner • St. Cecilia’s College' : 'St. Cecilia’s College Alumnus')}
            </p>

            {/* Academic & Location Metadata Pills */}
            <div className="mt-4 flex flex-wrap items-center gap-y-2.5 gap-x-4 sm:gap-x-6 text-xs sm:text-sm text-stone-600 dark:text-stone-300 font-medium">
              <span className="flex items-center gap-1.5 text-[#8B181B] dark:text-red-400 font-semibold">
                <GraduationCap className="w-4 h-4 shrink-0 text-[#8B181B] dark:text-red-400" />
                <span>Batch {currentUser.batch || '2024'} • {currentUser.course || 'Degree Graduate'}</span>
              </span>

              {currentUser.location && (
                <span className="flex items-center gap-1.5 text-stone-600 dark:text-stone-400">
                  <MapPin className="w-4 h-4 text-stone-400 dark:text-stone-500 shrink-0" />
                  <span>{currentUser.location}</span>
                </span>
              )}

              {currentUser.email && (
                <span className="flex items-center gap-1.5 text-stone-600 dark:text-stone-400">
                  <Mail className="w-4 h-4 text-stone-400 dark:text-stone-500 shrink-0" />
                  <span className="break-all">{currentUser.email}</span>
                </span>
              )}

              {currentUser.phone && (
                <span className="flex items-center gap-1.5 text-stone-600 dark:text-stone-400">
                  <Phone className="w-4 h-4 text-stone-400 dark:text-stone-500 shrink-0" />
                  <ContactMask value={currentUser.phone} type="phone" />
                </span>
              )}
            </div>

            {/* Alumni Verification Status Guidance Callout */}
            {!isVerifiedUser && currentUser.role === 'alumni' && (
              <div className={`mt-5 p-4 sm:p-5 border rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 shadow-2xs transition-colors ${
                currentUser.verificationStatus === 'pending_review'
                  ? 'bg-blue-50/80 dark:bg-blue-950/30 border-blue-200/90 dark:border-blue-900/60'
                  : currentUser.verificationStatus === 'rejected'
                  ? 'bg-red-50/80 dark:bg-red-950/30 border-red-200/90 dark:border-red-900/60'
                  : 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-200/90 dark:border-amber-900/60'
              }`}>
                <div className="flex items-start gap-3">
                  <div className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
                    currentUser.verificationStatus === 'pending_review'
                      ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200'
                      : currentUser.verificationStatus === 'rejected'
                      ? 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200'
                      : 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200'
                  }`}>
                    {currentUser.verificationStatus === 'pending_review' ? (
                      <Clock className="w-4 h-4" />
                    ) : (
                      <GraduationCap className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100">
                      {currentUser.verificationStatus === 'pending_review'
                        ? 'Verification Request Under Review'
                        : currentUser.verificationStatus === 'rejected'
                        ? 'Institutional Verification Declined'
                        : 'Official Degree Verification Required'}
                    </h3>
                    <p className="text-[11px] sm:text-xs text-stone-600 dark:text-stone-300 mt-0.5 leading-relaxed">
                      {currentUser.verificationStatus === 'pending_review'
                        ? 'Your verification request and proof documents were submitted to the Office of the Registrar. Reviews are typically completed within 24–48 business hours.'
                        : currentUser.verificationStatus === 'rejected'
                        ? (currentUser.verificationNotes || 'Your submitted graduation credentials could not be validated. You may re-submit with updated documentation.')
                        : 'Cross-reference your student ID with the Office of the Registrar to earn the Verified Alum credential, unlock private peer messaging, and validate your Digital Pass.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRegistrarModal(true)}
                  className="px-4 py-2 bg-[#8B181B] hover:bg-[#721316] text-white text-xs font-bold rounded-xl shadow-xs transition-colors shrink-0 cursor-pointer"
                >
                  {currentUser.verificationStatus === 'pending_review'
                    ? 'Check Status →'
                    : currentUser.verificationStatus === 'rejected'
                    ? 'Re-apply with Documents →'
                    : 'Verify Now →'}
                </button>
              </div>
            )}
          </div>

          {/* Social Counts & Academic Standing Ribbon */}
          <div className="mt-6 p-4 bg-stone-50/80 dark:bg-stone-800/60 rounded-2xl border border-stone-200/80 dark:border-stone-700/60 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center transition-colors">
            <div className="p-2">
              <span className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-white block font-mono">
                {currentUser.connectionsCount || 0}
              </span>
              <span className="text-xs text-stone-500 dark:text-stone-400 font-medium">Alumni Network</span>
            </div>
            <div className="p-2 border-l border-stone-200/80 dark:border-stone-700/60">
              <span className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-white block font-mono">
                {currentUser.batch || '2024'}
              </span>
              <span className="text-xs text-stone-500 dark:text-stone-400 font-medium">Graduation Class</span>
            </div>
            <div className="p-2 border-l-0 sm:border-l border-stone-200/80 dark:border-stone-700/60">
              <span className="text-xl sm:text-2xl font-bold text-[#8B181B] dark:text-red-400 block font-mono">
                {isVerifiedUser ? 'Verified' : 'Pending'}
              </span>
              <span className="text-xs text-stone-500 dark:text-stone-400 font-medium">Registrar Status</span>
            </div>
            <div className="p-2 border-l border-stone-200/80 dark:border-stone-700/60">
              <span className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 block font-mono">
                {currentUser.company ? 'Active' : 'Member'}
              </span>
              <span className="text-xs text-stone-500 dark:text-stone-400 font-medium">Career Status</span>
            </div>
          </div>

          {/* Profile Navigation Tabs (Collegiate Social Style) */}
          <div className="mt-8 border-b border-stone-200 dark:border-stone-800 flex items-center gap-6">
            <button
              type="button"
              onClick={() => setProfileViewTab('overview')}
              className={`pb-3.5 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                profileViewTab === 'overview'
                  ? 'border-[#8B181B] text-[#8B181B] dark:border-red-400 dark:text-red-400'
                  : 'border-transparent text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Overview & Credentials</span>
            </button>

            <button
              type="button"
              onClick={() => setProfileViewTab('posts')}
              className={`pb-3.5 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                profileViewTab === 'posts'
                  ? 'border-[#8B181B] text-[#8B181B] dark:border-red-400 dark:text-red-400'
                  : 'border-transparent text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200'
              }`}
            >
              <Megaphone className="w-4 h-4" />
              <span>My Shared Posts</span>
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-mono font-bold ${
                profileViewTab === 'posts'
                  ? 'bg-red-100 text-[#8B181B] dark:bg-red-950/60 dark:text-red-300'
                  : 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400'
              }`}>
                {myPosts.length}
              </span>
            </button>
          </div>

          {profileViewTab === 'overview' ? (
            <>
              {/* ========================================================
                  OFFICIAL ALUMNI DIGITAL PASS
                  Interactive metallic pass with QR turnstile verification
                  Accessible across web and mobile (Alumni, Student, Staff only)
                  ======================================================== */}
          {currentUser.role !== 'employer' && (
            <div
              id="digital-id-section"
              className="mt-8 p-6 bg-gradient-to-br from-stone-900 via-stone-950 to-stone-900 dark:from-stone-950 dark:via-black dark:to-stone-950 rounded-2xl border border-stone-800 dark:border-stone-800/90 text-white shadow-xl scroll-mt-20 transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-6 border-b border-stone-800">
                <div>
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-amber-400" />
                    <h2 className="text-sm sm:text-base font-bold text-white uppercase tracking-wider font-serif">
                      Official Digital Alumni Credential
                    </h2>
                  </div>
                  <p className="text-xs text-amber-200/70 mt-1">
                    Official black and gold digital credential with profile photo integration, QR verification, and PDF/PNG export.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-700/50 shadow-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ACTIVE MEMBERSHIP
                  </span>
                </div>
              </div>

              <DigitalAlumniCard user={currentUser} />
            </div>
          )}

          {/* ========================================================
              BENTO GRID: ABOUT + ACADEMIC RECORD + EXPERIENCE + EDUCATION
              ======================================================== */}
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Column (5 Cols): About & Academic Record */}
            <div className="lg:col-span-5 space-y-6">
              
              {/* About Section */}
              <div className="bg-stone-50/60 dark:bg-stone-800/40 rounded-2xl border border-stone-200/80 dark:border-stone-700/60 p-5 sm:p-6 transition-colors">
                <h2 className="font-sans text-lg font-bold text-stone-900 dark:text-white tracking-tight flex items-center justify-between mb-3">
                  <span>Biography & About</span>
                  <button
                    type="button"
                    onClick={() => openEditProfile()}
                    className="text-xs text-[#8B181B] dark:text-red-400 font-sans font-semibold hover:underline"
                  >
                    Edit
                  </button>
                </h2>
                <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 leading-relaxed whitespace-pre-line bg-white dark:bg-stone-900/60 p-4 rounded-xl border border-stone-200/60 dark:border-stone-700/50">
                  {currentUser.about || 'No biography written yet. Click "Edit" to share your collegiate memories and achievements.'}
                </p>
              </div>

              {/* Cecilian Academic Credentials Invariants */}
              <div className="bg-stone-50/60 dark:bg-stone-800/40 rounded-2xl border border-stone-200/80 dark:border-stone-700/60 p-5 sm:p-6 transition-colors">
                <h2 className="font-sans text-lg font-bold text-stone-900 dark:text-white tracking-tight flex items-center gap-2 mb-4">
                  <ShieldCheck className="w-5 h-5 text-[#8B181B] dark:text-red-400" />
                  <span>Institutional Credentials</span>
                </h2>

                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between p-3 bg-white dark:bg-stone-900/60 rounded-xl border border-stone-200/60 dark:border-stone-700/50">
                    <span className="text-stone-500 dark:text-stone-400 font-medium">Academic Student ID</span>
                    <span className="font-mono font-bold text-stone-900 dark:text-stone-100">
                      {currentUser.studentId || 'SCC-2023-XXXX'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-white dark:bg-stone-900/60 rounded-xl border border-stone-200/60 dark:border-stone-700/50">
                    <span className="text-stone-500 dark:text-stone-400 font-medium">Alumni ID Pass</span>
                    <span className="font-mono font-bold text-[#8B181B] dark:text-red-400">
                      {currentUser.alumniId || `SCC-ALUM-${currentUser.batch || '2024'}-001`}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-white dark:bg-stone-900/60 rounded-xl border border-stone-200/60 dark:border-stone-700/50">
                    <span className="text-stone-500 dark:text-stone-400 font-medium">Accreditation Authority</span>
                    <span className="font-semibold text-stone-800 dark:text-stone-200">
                      Office of the Registrar
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-white dark:bg-stone-900/60 rounded-xl border border-stone-200/60 dark:border-stone-700/50">
                    <span className="text-stone-500 dark:text-stone-400 font-medium">Campus Access Standing</span>
                    <span className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Good Standing
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column (7 Cols): Experience & Education */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* Professional Experience Section */}
              <div className="bg-stone-50/60 dark:bg-stone-800/40 rounded-2xl border border-stone-200/80 dark:border-stone-700/60 p-5 sm:p-6 transition-colors">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-sans text-lg font-bold text-stone-900 dark:text-white tracking-tight flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-[#8B181B] dark:text-red-400" />
                    <span>Career Experience ({(currentUser.experience || []).length})</span>
                  </h2>
                  <button
                    type="button"
                    onClick={() => openEditProfile()}
                    className="text-xs text-[#8B181B] dark:text-red-400 font-semibold hover:underline cursor-pointer"
                  >
                    + Add / Edit
                  </button>
                </div>

                <div className="space-y-3">
                  {(currentUser.experience || []).length === 0 ? (
                    <div className="p-6 bg-white dark:bg-stone-900/60 rounded-xl border border-dashed border-stone-300 dark:border-stone-700 text-center text-xs text-stone-500 dark:text-stone-400">
                      <Briefcase className="w-6 h-6 mx-auto mb-2 text-stone-400 dark:text-stone-500 opacity-60" />
                      No professional experience listed yet. Click "+ Add / Edit" to build your alumni career timeline.
                    </div>
                  ) : (
                    (currentUser.experience || []).map((exp) => (
                      <div
                        key={exp.id}
                        className="p-4 bg-white dark:bg-stone-900/70 rounded-xl border border-stone-200/70 dark:border-stone-700/60 shadow-2xs transition-colors"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          <h3 className="text-sm font-bold text-stone-900 dark:text-white">{exp.title}</h3>
                          <span className="text-xs text-stone-500 dark:text-stone-400 font-medium">{exp.startDate}</span>
                        </div>
                        <div className="text-xs text-[#8B181B] dark:text-red-400 font-semibold mt-0.5">
                          {exp.company} • <span className="text-stone-600 dark:text-stone-400 font-normal">{exp.location}</span>
                        </div>
                        {exp.description && (
                          <p className="text-xs text-stone-600 dark:text-stone-300 mt-2.5 leading-relaxed whitespace-pre-line border-t border-stone-100 dark:border-stone-800/80 pt-2">
                            {exp.description}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Education Section */}
              <div className="bg-stone-50/60 dark:bg-stone-800/40 rounded-2xl border border-stone-200/80 dark:border-stone-700/60 p-5 sm:p-6 transition-colors">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-sans text-lg font-bold text-stone-900 dark:text-white tracking-tight flex items-center gap-2">
                    <GraduationCap className="w-5 h-5 text-[#8B181B] dark:text-red-400" />
                    <span>Education & Degrees ({(currentUser.education || []).length})</span>
                  </h2>
                  <button
                    type="button"
                    onClick={() => openEditProfile()}
                    className="text-xs text-[#8B181B] dark:text-red-400 font-semibold hover:underline cursor-pointer"
                  >
                    + Add / Edit
                  </button>
                </div>

                <div className="space-y-3">
                  {(currentUser.education || []).length === 0 ? (
                    <div className="p-6 bg-white dark:bg-stone-900/60 rounded-xl border border-dashed border-stone-300 dark:border-stone-700 text-center text-xs text-stone-500 dark:text-stone-400">
                      <GraduationCap className="w-6 h-6 mx-auto mb-2 text-stone-400 dark:text-stone-500 opacity-60" />
                      No educational degrees listed yet. Click "+ Add / Edit" to record your academic history.
                    </div>
                  ) : (
                    (currentUser.education || []).map((edu) => (
                      <div
                        key={edu.id}
                        className="p-4 bg-white dark:bg-stone-900/70 rounded-xl border border-stone-200/70 dark:border-stone-700/60 shadow-2xs transition-colors"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          <h3 className="text-sm font-bold text-stone-900 dark:text-white">{edu.degree}</h3>
                          <span className="text-xs text-stone-500 dark:text-stone-400 font-medium">
                            {edu.startYear} - {edu.endYear}
                          </span>
                        </div>
                        <div className="text-xs text-stone-700 dark:text-stone-300 font-medium mt-0.5">
                          {edu.institution} • <span className="text-stone-500 dark:text-stone-400">{edu.fieldOfStudy}</span>
                        </div>
                        {edu.honors && (
                          <div className="mt-2 text-xs font-semibold inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-50 dark:bg-red-950/40 text-[#8B181B] dark:text-red-300 border border-red-200/60 dark:border-red-900/60">
                            <Sparkles className="w-3 h-3 text-[#8B181B] dark:text-red-400" />
                            <span>Honors: {edu.honors}</span>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* My Published Posts & Updates Section (Profile Feed Sync) */}
              <div className="bg-stone-50/60 dark:bg-stone-800/40 rounded-2xl border border-stone-200/80 dark:border-stone-700/60 p-5 sm:p-6 transition-colors">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-sans text-lg font-bold text-stone-900 dark:text-white tracking-tight flex items-center gap-2">
                    <Megaphone className="w-5 h-5 text-[#8B181B] dark:text-red-400" />
                    <span>My Feed Posts & Updates ({myPosts.length})</span>
                  </h2>
                </div>

                <div className="space-y-3">
                  {myPosts.length === 0 ? (
                    <div className="p-6 bg-white dark:bg-stone-900/60 rounded-xl border border-dashed border-stone-300 dark:border-stone-700 text-center text-xs text-stone-500 dark:text-stone-400">
                      <Megaphone className="w-6 h-6 mx-auto mb-2 text-stone-400 dark:text-stone-500 opacity-60" />
                      You haven't published any posts to the Campus Feed yet.
                    </div>
                  ) : (
                    myPosts.map((post) => (
                        <div
                          key={post.id}
                          className="p-4 bg-white dark:bg-stone-900/70 rounded-xl border border-stone-200/70 dark:border-stone-700/60 shadow-2xs transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300">
                                  {post.postType}
                                </span>
                                <span className="text-xs text-stone-400">
                                  {new Date(post.createdAt).toLocaleDateString([], {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric'
                                  })}
                                </span>
                              </div>
                              <h3 className="text-sm font-bold text-stone-900 dark:text-white mt-1.5">{post.title}</h3>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setPostToEdit(post);
                                  setEditTitle(post.title);
                                  setEditContent(post.content);
                                }}
                                className="p-1.5 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors cursor-pointer"
                                title="Edit post"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setPostToDelete({ id: post.id, title: post.title })}
                                className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
                                title="Delete post"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <p className="text-xs text-stone-600 dark:text-stone-300 mt-2 leading-relaxed whitespace-pre-line">
                            {post.content}
                          </p>
                          {post.imageUrl && (
                            <div className="mt-2.5 rounded-lg overflow-hidden max-h-40 border border-stone-100 dark:border-stone-800">
                              <img src={post.imageUrl} alt={post.title} className="w-full h-full object-cover" />
                            </div>
                          )}
                          <div className="mt-3 pt-2 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between text-xs text-stone-400">
                            <span className="flex items-center gap-1">
                              <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500" />
                              <span>{(post.hearts || []).length || post.likes || 0} Hearts</span>
                            </span>
                            <span>{post.comments.length} Comments</span>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>

            </div>
          </div>
            </>
          ) : (
            /* Dedicated Collegiate Feed View for Alumni Profile */
            <div className="mt-6 space-y-4 max-w-3xl">
              <div className="flex items-center justify-between pb-2">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-stone-900 dark:text-white">
                    Publications & Community Updates
                  </h2>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    All updates, stories, and career milestones you have published to the campus feed.
                  </p>
                </div>
              </div>

              {myPosts.length === 0 ? (
                <div className="bg-stone-50/60 dark:bg-stone-800/40 rounded-2xl border border-dashed border-stone-300 dark:border-stone-700 p-10 text-center">
                  <Megaphone className="w-10 h-10 text-stone-400 mx-auto mb-3" />
                  <h3 className="text-sm font-bold text-stone-800 dark:text-stone-200">No posts shared yet</h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 max-w-md mx-auto">
                    You haven’t posted to the community feed yet. Share updates, industry tips, or project achievements with your fellow Cecilians.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {myPosts.map((post) => (
                    <article
                      key={post.id}
                      className="bg-stone-50/70 dark:bg-stone-800/40 rounded-2xl border border-stone-200/80 dark:border-stone-700/60 p-5 sm:p-6 transition-all shadow-[0_1px_3px_rgba(0,0,0,0.02)]"
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={getUserAvatar(post.authorAvatar || currentUser.profilePictureUrl)}
                            alt={post.authorName}
                            className="w-10 h-10 rounded-xl object-cover border border-stone-200 dark:border-stone-700"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-stone-900 dark:text-white">
                                {post.authorName}
                              </span>
                              {post.isEdited && (
                                <span className="text-[10px] text-stone-400 font-medium">(edited)</span>
                              )}
                            </div>
                            <span className="text-xs text-stone-400 dark:text-stone-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(post.createdAt).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleStartEditPost(post)}
                            className="p-1.5 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors cursor-pointer"
                            title="Edit post"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setPostToDelete({ id: post.id, title: post.title })}
                            className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
                            title="Delete post"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {post.title && (
                        <h3 className="text-base font-bold text-stone-900 dark:text-white mb-2">
                          {post.title}
                        </h3>
                      )}

                      <p className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed whitespace-pre-line">
                        {post.content}
                      </p>

                      {post.imageUrl && (
                        <div className="mt-3.5 rounded-xl overflow-hidden border border-stone-200 dark:border-stone-700 max-h-80">
                          <img
                            src={post.imageUrl}
                            alt={post.title}
                            className="w-full h-full object-cover cursor-pointer hover:scale-[1.01] transition-transform"
                            onClick={() =>
                              setViewerImage({
                                url: post.imageUrl!,
                                title: post.title || 'Attached Post Image'
                              })
                            }
                          />
                        </div>
                      )}

                      <div className="mt-4 pt-3 border-t border-stone-200/60 dark:border-stone-700/60 flex items-center justify-between text-xs text-stone-500 dark:text-stone-400 font-medium">
                        <span className="flex items-center gap-1.5">
                          <Heart className="w-4 h-4 text-red-500 fill-red-500" />
                          <span>{(post.hearts || []).length || post.likes || 0} Likes</span>
                        </span>
                        <span>{post.comments.length} Comments</span>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Registrar Degree Self-Verification Modal */}
      <RegistrarSelfVerificationModal
        isOpen={showRegistrarModal}
        onClose={() => setShowRegistrarModal(false)}
      />

      {/* Enlarged Image Viewer Modal for Profile Picture and Cover Photo */}
      <ImageViewerModal
        isOpen={Boolean(viewerImage)}
        imageUrl={viewerImage?.url || ''}
        title={viewerImage?.title || 'Image Viewer'}
        onClose={() => setViewerImage(null)}
      />

      {/* Official PDF Resume Preview & Verification Modal */}
      {currentUser && (
        <PdfResumePreviewModal
          isOpen={showResumePreview}
          onClose={() => setShowResumePreview(false)}
          targetUser={currentUser}
        />
      )}

      {/* Edit Feed Post Modal */}
      {postToEdit && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-xl border border-stone-200 dark:border-stone-800 w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
              <div className="flex items-center gap-2">
                <Pencil className="w-4 h-4 text-[#8B181B] dark:text-red-400" />
                <h3 className="text-base font-bold text-stone-900 dark:text-white">Edit Post</h3>
              </div>
              <button
                type="button"
                onClick={() => setPostToEdit(null)}
                className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 cursor-pointer p-1 rounded-lg"
              >
                &times;
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!editTitle.trim() || !editContent.trim()) {
                  showToast('Title and content cannot be empty.', 'warning');
                  return;
                }
                updateFeedPost(postToEdit.id, {
                  title: editTitle.trim(),
                  content: editContent.trim()
                });
                setPostToEdit(null);
              }}
              className="mt-4 space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1">
                  Post Title
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3.5 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-sm font-semibold text-stone-900 dark:text-white focus:outline-none focus:border-[#8B181B]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1">
                  Post Content
                </label>
                <textarea
                  rows={4}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full px-3.5 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-sm text-stone-800 dark:text-stone-200 focus:outline-none focus:border-[#8B181B] leading-relaxed resize-y"
                  required
                />
              </div>

              <div className="pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setPostToEdit(null)}
                  className="px-4 py-2 text-xs font-bold text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-[#8B181B] hover:bg-[#721316] rounded-xl transition-colors shadow-2xs cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={Boolean(postToDelete)}
        onClose={() => setPostToDelete(null)}
        onConfirm={() => {
          if (postToDelete) {
            deleteFeedPost(postToDelete.id);
          }
          setPostToDelete(null);
        }}
        title="Delete Feed Post"
        message={`Are you sure you want to permanently delete "${postToDelete?.title}"? This cannot be undone.`}
        confirmLabel="Delete Post"
        cancelLabel="Cancel"
        variant="danger"
      />
    </div>
  );
};
