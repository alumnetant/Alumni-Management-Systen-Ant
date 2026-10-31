import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Camera,
  Upload,
  Briefcase,
  Building2,
  MapPin,
  GraduationCap,
  RefreshCw,
  Image as ImageIcon,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { useAlumni } from '../../context/AlumniContext';
import { Experience, Education } from '../../types';
import { compressImage } from '../../lib/utils';
import {
  DEFAULT_USER_AVATAR,
  DEFAULT_COVER_PHOTO,
  USER_AVATAR_PRESETS,
  COVER_PHOTO_PRESETS,
  getUserAvatar,
  getCoverPhoto,
  handleUserAvatarError,
  handleCoverPhotoError
} from '../../lib/defaultImages';
import { triggerHaptic } from '../../services/hapticsService';

const INDUSTRIES = [
  'Information Technology & Software',
  'Education & Academic Research',
  'Healthcare, Medical & Nursing',
  'Engineering & Construction',
  'Banking, Finance & Insurance',
  'Hospitality & Tourism Management',
  'Government & Public Administration',
  'Maritime & Naval Architecture',
  'Media, Arts & Communication',
  'Business Administration & Commerce',
  'Law & Criminal Justice',
  'Other Professional Field'
];

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EditProfileModalContent: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { currentUser, updateProfile, updateUserProfile, showToast } = useAlumni();

  const [name, setName] = useState(currentUser?.name || '');
  const [headline, setHeadline] = useState(currentUser?.headline || '');
  const [about, setAbout] = useState(currentUser?.about || '');
  const [location, setLocation] = useState(currentUser?.location || '');
  const [employmentStatus, setEmploymentStatus] = useState<
    'Employed' | 'Self-employed' | 'Seeking Opportunities' | 'Retired' | 'N/A'
  >((currentUser?.employmentStatus as any) || 'Employed');
  const [currentPosition, setCurrentPosition] = useState(currentUser?.currentPosition || '');
  const [company, setCompany] = useState(currentUser?.company || '');
  const [industry, setIndustry] = useState((currentUser as any)?.industry || 'Information Technology & Software');

  // Reactive logic: freeze/auto-fill professional fields based on employment status
  useEffect(() => {
    if (employmentStatus === 'N/A') {
      setCurrentPosition('N/A');
      setCompany('N/A');
      setLocation('N/A');
      setIndustry('Other Professional Field');
    } else if (employmentStatus === 'Seeking Opportunities') {
      setCurrentPosition('Seeking Opportunities');
      setCompany('N/A');
      if (location === 'N/A') setLocation(currentUser?.location || 'Cebu City, Philippines');
      if (industry === 'Other Professional Field') setIndustry('Information Technology & Software');
    } else if (employmentStatus === 'Retired') {
      setCurrentPosition('Retired');
      setCompany('Retired');
      setLocation('N/A');
      setIndustry('Other Professional Field');
    } else if (employmentStatus === 'Self-employed') {
      if (currentPosition === 'N/A' || currentPosition === 'Retired' || currentPosition === 'Seeking Opportunities') {
        setCurrentPosition('Self-Employed Consultant / Specialist');
      }
      if (company === 'N/A' || company === 'Retired') {
        setCompany('Self-Employed / Freelance');
      }
      if (location === 'N/A') setLocation(currentUser?.location || 'Cebu City, Philippines');
    } else if (employmentStatus === 'Employed') {
      if (currentPosition === 'N/A' || currentPosition === 'Retired' || currentPosition === 'Seeking Opportunities') {
        setCurrentPosition('');
      }
      if (company === 'N/A' || company === 'Retired') {
        setCompany('');
      }
      if (location === 'N/A') setLocation(currentUser?.location || 'Cebu City, Philippines');
    }
  }, [employmentStatus]);

  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [profilePictureUrl, setProfilePictureUrl] = useState(currentUser?.profilePictureUrl || '');
  const [coverPhotoUrl, setCoverPhotoUrl] = useState(currentUser?.coverPhotoUrl || '');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const validatePhilippinePhone = (rawPhone: string): { isValid: boolean; formatted: string; error?: string } => {
    const cleaned = rawPhone.replace(/[\s\-()]/g, '');
    if (!cleaned) {
      return { isValid: false, formatted: '', error: 'Philippine contact number is required.' };
    }
    const phRegex = /^(\+639|639|09)\d{9}$/;
    if (!phRegex.test(cleaned)) {
      return {
        isValid: false,
        formatted: cleaned,
        error: 'Please enter a valid Philippine mobile number (e.g. 0917 123 4567 or +63 917 123 4567).'
      };
    }
    let standardized = cleaned;
    if (standardized.startsWith('639')) {
      standardized = '+639' + standardized.slice(3);
    } else if (standardized.startsWith('09')) {
      standardized = '+639' + standardized.slice(2);
    }
    return { isValid: true, formatted: standardized };
  };

  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isDraggingCover, setIsDraggingCover] = useState(false);
  const [coverUploadError, setCoverUploadError] = useState<string | null>(null);
  const [showCoverUrlInput, setShowCoverUrlInput] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const validMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validMimes.includes(file.type)) {
      setUploadError('Please select a valid image file (JPG, PNG, or WebP).');
      showToast('Please select a valid image file (JPG, PNG, or WebP).', 'error');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadError('Image size exceeds 10MB. Please choose a smaller photo.');
      showToast('Image size exceeds 10MB limit.', 'error');
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const optimizedDataUrl = await compressImage(file, 500, 500, 0.85);
      setProfilePictureUrl(optimizedDataUrl);
      setIsUploadingPhoto(false);
      showToast('Profile photo ready! Save to update your profile.', 'success');
    } catch (err) {
      console.warn('Failed to compress avatar photo:', err);
      setIsUploadingPhoto(false);
      setUploadError('Failed to process image file. Please try another image.');
      showToast('Could not process photo. Please try another file.', 'error');
    }
  };

  const processCoverFile = async (file: File) => {
    setCoverUploadError(null);
    const validMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validMimes.includes(file.type)) {
      setCoverUploadError('Please select a valid image file (JPG, PNG, or WebP).');
      showToast('Please select a valid image file (JPG, PNG, or WebP).', 'error');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setCoverUploadError('Image size exceeds 15MB limit. Please choose a smaller photo.');
      showToast('Cover photo size exceeds 15MB limit.', 'error');
      return;
    }

    setIsUploadingCover(true);
    try {
      const optimizedDataUrl = await compressImage(file, 1200, 480, 0.82);
      setCoverPhotoUrl(optimizedDataUrl);
      setIsUploadingCover(false);
      showToast('Cover photo ready! Click "Save Profile" to apply.', 'success');
    } catch (err) {
      console.warn('Failed to compress cover image:', err);
      setIsUploadingCover(false);
      setCoverUploadError('Failed to process cover image. Please try another image.');
      showToast('Could not process cover photo.', 'error');
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processCoverFile(file);
    }
  };

  const handleRemoveCover = () => {
    setCoverPhotoUrl('');
    setCoverUploadError(null);
    showToast('Cover photo cleared. Default campus backdrop will be used.', 'info');
  };

  const [experience, setExperience] = useState<Experience[]>(
    currentUser?.experience || []
  );

  const [education, setEducation] = useState<Education[]>(
    currentUser?.education || []
  );

  const addExperience = () => {
    const newExp: Experience = {
      id: `exp_${Date.now()}`,
      title: '',
      company: '',
      location: '',
      startDate: '',
      current: false,
      description: ''
    };
    setExperience([...experience, newExp]);
  };

  const updateExperience = (id: string, field: keyof Experience, value: any) => {
    setExperience(
      experience.map((exp) => (exp.id === id ? { ...exp, [field]: value } : exp))
    );
  };

  const removeExperience = (id: string) => {
    setExperience(experience.filter((exp) => exp.id !== id));
  };

  const addEducation = () => {
    const newEdu: Education = {
      id: `edu_${Date.now()}`,
      degree: '',
      institution: "St. Cecilia's College",
      fieldOfStudy: '',
      startYear: '',
      endYear: '',
      honors: ''
    };
    setEducation([...education, newEdu]);
  };

  const updateEducation = (id: string, field: keyof Education, value: any) => {
    setEducation(
      education.map((edu) => (edu.id === id ? { ...edu, [field]: value } : edu))
    );
  };

  const removeEducation = (id: string) => {
    setEducation(education.filter((edu) => edu.id !== id));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError(null);

    if (!name.trim()) {
      triggerHaptic('warning');
      showToast('Please enter your full name.', 'error');
      return;
    }

    const phoneValidation = validatePhilippinePhone(phone);
    if (!phoneValidation.isValid) {
      triggerHaptic('warning');
      setPhoneError(phoneValidation.error || 'Invalid Philippine contact number.');
      showToast(phoneValidation.error || 'Please enter a valid Philippine mobile number.', 'error');
      return;
    }

    const updater = updateProfile || updateUserProfile;
    if (typeof updater === 'function') {
      updater({
        name: name.trim(),
        headline: headline.trim(),
        about: about.trim(),
        location: location.trim(),
        phone: phoneValidation.formatted,
        profilePictureUrl,
        coverPhotoUrl,
        employmentStatus,
        currentPosition: currentPosition.trim(),
        company: company.trim(),
        industry,
        experience,
        education
      });
    }
    triggerHaptic('success');
    showToast('Alumni profile updated successfully!', 'success');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 pt-safe pb-safe animate-in fade-in">
      <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-800 w-full max-w-2xl max-h-[90dvh] overflow-hidden flex flex-col animate-in zoom-in-95 transition-colors">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
          <div>
            <span className="editorial-kicker block mb-0.5">ALUMNI RECORD</span>
            <h2 className="editorial-title text-lg sm:text-xl font-normal">
              Edit Alumni <span className="editorial-accent italic">Profile</span>
            </h2>
            <p className="editorial-sub text-xs mt-0.5">
              Update your biography, photography, professional trajectory, and academic degrees
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-200 p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-6 text-xs sm:text-sm">
          
          {/* Media Section: Cover & Avatar */}
          <div className="space-y-4">
            <h3 className="font-bold text-stone-900 dark:text-white uppercase tracking-wider text-xs flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5 text-[#8B181B] dark:text-red-400" />
              <span>Profile Imagery</span>
            </h3>
            
            {/* Cover Photo Upload & Customization */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 block">
                  Cover Photo (Drag & Drop or Choose Preset)
                </label>
                {coverPhotoUrl && (
                  <button
                    type="button"
                    onClick={handleRemoveCover}
                    className="text-[11px] text-stone-500 dark:text-stone-400 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer"
                  >
                    Clear Cover
                  </button>
                )}
              </div>

              {/* Cover Preview & Drop Zone */}
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
                onClick={() => coverInputRef.current?.click()}
                className={`relative rounded-xl overflow-hidden border-2 cursor-pointer transition-all duration-200 h-36 sm:h-40 group ${
                  isDraggingCover
                    ? 'border-[#8B181B] bg-red-50/50 dark:bg-red-950/30 ring-4 ring-[#8B181B]/15'
                    : 'border-stone-200 dark:border-stone-700 hover:border-stone-400 dark:hover:border-stone-500 bg-stone-100 dark:bg-stone-800'
                }`}
              >
                {coverPhotoUrl ? (
                  <img
                    src={getCoverPhoto(coverPhotoUrl)}
                    alt="Cover Preview"
                    onError={handleCoverPhotoError}
                    className="w-full h-full object-cover transition-transform group-hover:scale-[1.01]"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-stone-400 dark:text-stone-500 p-4 text-center">
                    <ImageIcon className="w-8 h-8 stroke-1 text-stone-400 dark:text-stone-500 mb-1.5" />
                    <span className="text-xs font-medium text-stone-600 dark:text-stone-300">Click or Drag & Drop image here</span>
                    <span className="text-[11px] text-stone-400 dark:text-stone-500 mt-0.5">Upload JPG, PNG, or WebP up to 15MB</span>
                  </div>
                )}

                <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 text-white text-xs font-semibold">
                  <Upload className="w-5 h-5 text-white" />
                  <span>Click to choose photo from device</span>
                </div>

                {isDraggingCover && (
                  <div className="absolute inset-0 bg-stone-900/80 backdrop-blur-xs flex flex-col items-center justify-center gap-2 text-white text-xs font-semibold z-20">
                    <Upload className="w-7 h-7 text-white animate-bounce" />
                    <span>Drop image to upload cover</span>
                  </div>
                )}

                {isUploadingCover && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center gap-2 text-white text-xs font-semibold z-20">
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>Optimizing cover image...</span>
                  </div>
                )}
              </div>

              {/* Upload & Preset Actions */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleCoverUpload}
                />
                
                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  disabled={isUploadingCover}
                  className="px-3 py-1.5 bg-[#8B181B] hover:bg-[#721316] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{coverPhotoUrl ? 'Upload New Cover' : 'Upload Cover'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCoverPhotoUrl(DEFAULT_COVER_PHOTO);
                    showToast('Default campus tower cover applied.', 'info');
                  }}
                  className="px-2.5 py-1.5 text-xs bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-[#8B181B] dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60 rounded-lg font-semibold transition-colors cursor-pointer flex items-center gap-1"
                  title="Use default St. Cecilia campus cover"
                >
                  <Sparkles className="w-3 h-3 text-[#8B181B] dark:text-amber-400" />
                  <span>Default Cover</span>
                </button>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {COVER_PHOTO_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setCoverPhotoUrl(p.url);
                        showToast(`${p.name} applied as cover.`, 'info');
                      }}
                      className="px-2.5 py-1.5 text-xs bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 rounded-lg font-medium transition-colors cursor-pointer border border-stone-200/60 dark:border-stone-700"
                      title={p.name}
                    >
                      {p.name.replace(' (Default)', '')}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setShowCoverUrlInput(!showCoverUrlInput)}
                  className="px-2.5 py-1.5 text-xs text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg font-medium transition-colors cursor-pointer ml-auto"
                >
                  {showCoverUrlInput ? 'Hide URL' : 'Or Paste URL'}
                </button>
              </div>

              {showCoverUrlInput && (
                <div className="pt-2">
                  <input
                    type="url"
                    value={coverPhotoUrl}
                    onChange={(e) => setCoverPhotoUrl(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-xs text-stone-900 dark:text-stone-100"
                    placeholder="https://example.com/cover.jpg"
                  />
                </div>
              )}

              {coverUploadError && (
                <p className="text-[11px] text-red-600 dark:text-red-400 font-medium">{coverUploadError}</p>
              )}
            </div>

            {/* Avatar Photo Upload */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 block">
                  Profile Photo
                </label>
                <span className="text-[11px] text-stone-400 dark:text-stone-500">
                  {profilePictureUrl === DEFAULT_USER_AVATAR ? 'Default Avatar' : 'Custom Photo'}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3.5 p-3.5 bg-stone-50 dark:bg-stone-800/60 rounded-xl border border-stone-200 dark:border-stone-700">
                <div className="relative shrink-0">
                  <img
                    src={getUserAvatar(profilePictureUrl)}
                    alt="Profile Preview"
                    onError={handleUserAvatarError}
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-white dark:border-stone-800 shadow-xs bg-stone-200 dark:bg-stone-700"
                  />
                  {isUploadingPhoto && (
                    <div className="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center">
                      <RefreshCw className="w-4 h-4 text-white animate-spin" />
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-2 w-full">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handlePhotoUpload}
                    />
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={isUploadingPhoto}
                      className="px-3 py-1.5 bg-[#8B181B] hover:bg-[#721316] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{profilePictureUrl ? 'Upload Photo' : 'Upload Photo'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setProfilePictureUrl(DEFAULT_USER_AVATAR);
                        showToast('Default institutional avatar applied.', 'info');
                      }}
                      className="px-2.5 py-1.5 text-xs bg-white dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-700 text-[#8B181B] dark:text-red-400 border border-stone-300 dark:border-stone-600 rounded-lg font-semibold transition-colors cursor-pointer flex items-center gap-1"
                      title="Use official St. Cecilia graduate avatar"
                    >
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      <span>Default Avatar</span>
                    </button>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {USER_AVATAR_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            setProfilePictureUrl(preset.url);
                            showToast(`${preset.name} selected.`, 'info');
                          }}
                          className={`px-2 py-1 text-[11px] rounded-md border transition-colors cursor-pointer ${
                            profilePictureUrl === preset.url
                              ? 'bg-red-50 dark:bg-red-950/40 border-[#8B181B] text-[#8B181B] dark:text-red-300 font-bold'
                              : 'bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-750'
                          }`}
                        >
                          {preset.name.replace(' (Default)', '')}
                        </button>
                      ))}
                    </div>
                  </div>

                  {uploadError && (
                    <p className="text-[11px] text-red-600 dark:text-red-400 font-medium">{uploadError}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Basic Details */}
          <div className="space-y-3 pt-4 border-t border-stone-200 dark:border-stone-800">
            <h3 className="font-bold text-stone-900 dark:text-white uppercase tracking-wider text-xs">
              Basic Information
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 block mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-xs text-stone-900 dark:text-stone-100"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 block mb-1">
                  Location * {employmentStatus === 'N/A' || employmentStatus === 'Retired' ? '(Frozen)' : ''}
                </label>
                <input
                  type="text"
                  required
                  disabled={employmentStatus === 'N/A' || employmentStatus === 'Retired'}
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Cebu City, Philippines"
                  className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-xs text-stone-900 dark:text-stone-100 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-stone-100 dark:disabled:bg-stone-900"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 block mb-1">
                Professional Headline
              </label>
              <input
                type="text"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="Lead Full-Stack Cloud Engineer at Archipelagic Systems"
                className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-xs text-stone-900 dark:text-stone-100"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 block">
                  Contact Phone (Philippine Mobile) *
                </label>
                <span className="text-[10px] text-stone-400 font-mono">09XX / +63 9XX</span>
              </div>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (phoneError) setPhoneError(null);
                }}
                placeholder="0917 123 4567 or +63 917 123 4567"
                className={`w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border rounded-lg text-xs text-stone-900 dark:text-stone-100 transition-colors ${
                  phoneError
                    ? 'border-red-500 focus:ring-1 focus:ring-red-500'
                    : 'border-stone-200 dark:border-stone-700 focus:ring-1 focus:ring-[#8B181B]'
                }`}
              />
              {phoneError && (
                <p className="text-[11px] text-red-600 dark:text-red-400 font-medium mt-1">
                  {phoneError}
                </p>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 block mb-1">
                Biography / About
              </label>
              <textarea
                rows={3}
                value={about}
                onChange={(e) => setAbout(e.target.value)}
                placeholder="Share your passions, university memories, or current professional initiatives..."
                className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-xs text-stone-900 dark:text-stone-100 leading-relaxed"
              />
            </div>
          </div>

          {/* Professional Status & Trajectory */}
          <div className="space-y-3 pt-4 border-t border-stone-200 dark:border-stone-800">
            <h3 className="font-bold text-stone-900 dark:text-white uppercase tracking-wider text-xs flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-[#8B181B] dark:text-red-400" />
              <span>Professional Details & Employment Status</span>
            </h3>

            {/* Employment Status Selector */}
            <div>
              <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 block mb-1.5">
                Current Employment Status
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(['Employed', 'Self-employed', 'Seeking Opportunities', 'Retired', 'N/A'] as const).map((st) => (
                  <button
                    type="button"
                    key={st}
                    onClick={() => setEmploymentStatus(st)}
                    className={`py-2 px-2.5 rounded-lg border text-xs font-semibold text-center transition-all cursor-pointer ${
                      employmentStatus === st
                        ? 'bg-[#8B181B] text-white border-[#8B181B] shadow-2xs'
                        : 'bg-stone-50 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-750'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
              {employmentStatus === 'N/A' && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-1.5">
                  Note: Professional fields are frozen as Not Applicable (N/A).
                </p>
              )}
              {employmentStatus === 'Seeking Opportunities' && (
                <p className="text-[11px] text-sky-600 dark:text-sky-400 font-medium mt-1.5">
                  Note: Job Title and Company are set to Seeking Opportunities. Target location and industry remain editable.
                </p>
              )}
              {employmentStatus === 'Retired' && (
                <p className="text-[11px] text-stone-500 dark:text-stone-400 font-medium mt-1.5">
                  Note: Professional trajectory is archived as Retired.
                </p>
              )}
            </div>

            {/* Current Position & Company */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 block mb-1">
                  Current Job Title / Position {employmentStatus === 'N/A' || employmentStatus === 'Retired' || employmentStatus === 'Seeking Opportunities' ? '(Frozen)' : ''}
                </label>
                <div className="relative">
                  <Briefcase className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    disabled={employmentStatus === 'N/A' || employmentStatus === 'Retired' || employmentStatus === 'Seeking Opportunities'}
                    value={currentPosition}
                    onChange={(e) => setCurrentPosition(e.target.value)}
                    placeholder="e.g. Lead Software Engineer"
                    className="w-full pl-9 pr-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-xs text-stone-900 dark:text-stone-100 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-stone-100 dark:disabled:bg-stone-900"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 block mb-1">
                  Company / Organization {employmentStatus === 'N/A' || employmentStatus === 'Retired' || employmentStatus === 'Seeking Opportunities' ? '(Frozen)' : ''}
                </label>
                <div className="relative">
                  <Building2 className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    disabled={employmentStatus === 'N/A' || employmentStatus === 'Retired' || employmentStatus === 'Seeking Opportunities'}
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="e.g. Archipelagic Systems"
                    className="w-full pl-9 pr-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-xs text-stone-900 dark:text-stone-100 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-stone-100 dark:disabled:bg-stone-900"
                  />
                </div>
              </div>
            </div>

            {/* Industry Sector */}
            <div>
              <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 block mb-1">
                Industry Sector {employmentStatus === 'N/A' || employmentStatus === 'Retired' ? '(Frozen)' : ''}
              </label>
              <select
                disabled={employmentStatus === 'N/A' || employmentStatus === 'Retired'}
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-xs text-stone-900 dark:text-stone-100 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-stone-100 dark:disabled:bg-stone-900"
              >
                {INDUSTRIES.map((ind) => (
                  <option key={ind} value={ind} className="dark:bg-stone-800">
                    {ind}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Professional Experience Section */}
          <div className="space-y-3 pt-4 border-t border-stone-200 dark:border-stone-800">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-stone-900 dark:text-white uppercase tracking-wider text-xs flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-[#8B181B] dark:text-red-400" />
                <span>Professional Experience</span>
              </h3>
              <button
                type="button"
                onClick={addExperience}
                className="text-xs font-semibold text-[#8B181B] dark:text-red-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Role</span>
              </button>
            </div>

            {experience.map((exp, idx) => (
              <div key={exp.id || idx} className="p-3.5 bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 rounded-xl space-y-2 relative">
                <button
                  type="button"
                  onClick={() => removeExperience(exp.id)}
                  className="absolute top-2.5 right-2.5 text-stone-400 hover:text-red-600 dark:hover:text-red-400 cursor-pointer p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                <div className="grid grid-cols-2 gap-2 pr-6">
                  <div>
                    <label className="text-[10px] font-semibold text-stone-600 dark:text-stone-400 block mb-0.5">Job Title</label>
                    <input
                      type="text"
                      value={exp.title}
                      onChange={(e) => updateExperience(exp.id, 'title', e.target.value)}
                      placeholder="e.g. Lead Software Engineer"
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded text-xs text-stone-900 dark:text-stone-100"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-stone-600 dark:text-stone-400 block mb-0.5">Company</label>
                    <input
                      type="text"
                      value={exp.company}
                      onChange={(e) => updateExperience(exp.id, 'company', e.target.value)}
                      placeholder="e.g. Archipelagic Systems"
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded text-xs text-stone-900 dark:text-stone-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-semibold text-stone-600 dark:text-stone-400 block mb-0.5">Time Period</label>
                    <input
                      type="text"
                      value={exp.startDate}
                      onChange={(e) => updateExperience(exp.id, 'startDate', e.target.value)}
                      placeholder="2023 - Present"
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded text-xs text-stone-900 dark:text-stone-100"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-stone-600 dark:text-stone-400 block mb-0.5">Location</label>
                    <input
                      type="text"
                      value={exp.location}
                      onChange={(e) => updateExperience(exp.id, 'location', e.target.value)}
                      placeholder="Cebu City, Philippines"
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded text-xs text-stone-900 dark:text-stone-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-stone-600 dark:text-stone-400 block mb-0.5">Key Responsibilities</label>
                  <textarea
                    rows={2}
                    value={exp.description}
                    onChange={(e) => updateExperience(exp.id, 'description', e.target.value)}
                    placeholder="Describe your role and impact..."
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded text-xs text-stone-900 dark:text-stone-100 leading-relaxed"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Education Section */}
          <div className="space-y-3 pt-4 border-t border-stone-200 dark:border-stone-800">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-stone-900 dark:text-white uppercase tracking-wider text-xs flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-[#8B181B] dark:text-red-400" />
                <span>Education & Degrees</span>
              </h3>
              <button
                type="button"
                onClick={addEducation}
                className="text-xs font-semibold text-[#8B181B] dark:text-red-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Degree</span>
              </button>
            </div>

            {education.map((edu, idx) => (
              <div key={edu.id || idx} className="p-3.5 bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 rounded-xl space-y-2 relative">
                <button
                  type="button"
                  onClick={() => removeEducation(edu.id)}
                  className="absolute top-2.5 right-2.5 text-stone-400 hover:text-red-600 dark:hover:text-red-400 cursor-pointer p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                <div className="grid grid-cols-2 gap-2 pr-6">
                  <div>
                    <label className="text-[10px] font-semibold text-stone-600 dark:text-stone-400 block mb-0.5">Degree Program</label>
                    <input
                      type="text"
                      value={edu.degree}
                      onChange={(e) => updateEducation(edu.id, 'degree', e.target.value)}
                      placeholder="B.S. Information Technology"
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded text-xs text-stone-900 dark:text-stone-100"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-stone-600 dark:text-stone-400 block mb-0.5">Institution</label>
                    <input
                      type="text"
                      value={edu.institution}
                      onChange={(e) => updateEducation(edu.id, 'institution', e.target.value)}
                      placeholder="St. Cecilia's College"
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded text-xs text-stone-900 dark:text-stone-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-semibold text-stone-600 dark:text-stone-400 block mb-0.5">Years</label>
                    <input
                      type="text"
                      value={`${edu.startYear} - ${edu.endYear}`}
                      onChange={(e) => {
                        const parts = e.target.value.split('-');
                        updateEducation(edu.id, 'startYear', parts[0]?.trim() || '');
                        updateEducation(edu.id, 'endYear', parts[1]?.trim() || '');
                      }}
                      placeholder="2019 - 2023"
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded text-xs text-stone-900 dark:text-stone-100"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-stone-600 dark:text-stone-400 block mb-0.5">Honors & Distinctions</label>
                    <input
                      type="text"
                      value={edu.honors || ''}
                      onChange={(e) => updateEducation(edu.id, 'honors', e.target.value)}
                      placeholder="Magna Cum Laude"
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded text-xs text-stone-900 dark:text-stone-100"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Footer Save Button */}
          <div className="pt-4 border-t border-stone-200 dark:border-stone-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 rounded-xl font-medium text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-[#8B181B] hover:bg-[#721316] text-white rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer"
            >
              Save Profile
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ isOpen, onClose }) => {
  const { currentUser } = useAlumni();
  if (!isOpen || !currentUser) return null;
  return <EditProfileModalContent onClose={onClose} />;
};
