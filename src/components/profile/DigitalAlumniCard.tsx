import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  RotateCw,
  QrCode,
  ShieldCheck,
  Wifi,
  Copy,
  Check,
  Maximize2,
  X,
  Camera,
  Share2,
  Award,
  Upload
} from 'lucide-react';
import { UserProfile } from '../../types';
import { useAlumni } from '../../context/AlumniContext';
import { generateAlumniId } from '../../services/studentVerificationService';
import { triggerHaptic } from '../../services/hapticsService';
import { secureStorageService } from '../../services/secureStorageService';
import { getAlumniVerificationUrl } from '../../services/alumniIdVerificationService';
import { compressImage } from '../../lib/utils';

interface DigitalAlumniCardProps {
  user?: UserProfile;
  compact?: boolean;
}

export const DigitalAlumniCard: React.FC<DigitalAlumniCardProps> = ({ user: propUser, compact = false }) => {
  const { currentUser, updateUserProfile, addAuditLog, showToast } = useAlumni();
  const user = propUser || currentUser;

  const [isFlipped, setIsFlipped] = useState(false);
  const [showFullNumber, setShowFullNumber] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [sealImgSrc, setSealImgSrc] = useState('/assets/cecilians-seal.jpg');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Verification QR Code URL & Campus Gate TOTP
  const [verificationQrUrl, setVerificationQrUrl] = useState<string>('');
  const [secondsRemaining, setSecondsRemaining] = useState<number>(() => {
    return 30 - (Math.floor(Date.now() / 1000) % 30);
  });
  const [rollingGateQrUrl, setRollingGateQrUrl] = useState<string>('');
  const [currentTokenHash, setCurrentTokenHash] = useState<string>('');

  const getFormattedId = (u: UserProfile) => {
    if (u.role === 'alumni') {
      if (u.alumniId) return u.alumniId;
      return generateAlumniId(u.batch || '2024', u.studentId, u.uid);
    }
    if (u.studentId) {
      const clean = u.studentId.trim();
      return clean.startsWith('SCC-')
        ? clean
        : clean.startsWith('SC-')
        ? `SCC-${clean.slice(3)}`
        : `SCC-${clean}`;
    }
    if (u.employeeId) {
      const clean = u.employeeId.trim();
      return clean.startsWith('SCC-') ? clean : `SCC-${clean}`;
    }
    const uidStr = u.uid || '0000';
    const userRole = (u.role as string) || '';
    if (userRole === 'admin' || userRole === 'superadmin') return `SCC-ADM-${uidStr.slice(-3).toUpperCase()}`;
    if (userRole === 'employer') return `SCC-EMP-${uidStr.slice(-3).toUpperCase()}`;
    if (userRole === 'moderator' || userRole === 'registrar' || userRole === 'staff') return `SCC-MOD-${uidStr.slice(-3).toUpperCase()}`;
    return `SCC-ALUM-${u.batch || '2024'}-${uidStr.slice(-4).toUpperCase()}`;
  };

  const isEligibleCardHolder = Boolean(user && user.role !== 'employer');
  const formattedId = user ? getFormattedId(user) : 'SCC-ALUM-0000';
  const avatarUrl = user ? user.avatar || user.profilePictureUrl || user.photoUrl : undefined;
  const graduationCohort = `Class of ${user?.batch || '2024'}`;
  const degreeProgram = user?.course || user?.department || 'B.S. Information Technology';
  const membershipType = user?.membershipType || 'Alumni Council Fellow';

  // Cache encrypted digital pass credentials to localStorage for offline readiness
  useEffect(() => {
    if (!isEligibleCardHolder || !user?.uid) return;
    try {
      const passCacheKey = `scc_offline_pass_${user.uid}`;
      const passData = {
        uid: user.uid,
        name: user.name,
        formattedId,
        role: user.role,
        batch: user.batch,
        course: user.course,
        studentId: user.studentId,
        alumniId: formattedId,
        membershipType,
        avatar: avatarUrl,
        cachedAt: new Date().toISOString()
      };
      secureStorageService.setSecureItem(passCacheKey, passData);
    } catch {}
  }, [isEligibleCardHolder, user, formattedId, avatarUrl, membershipType]);

  // Generate Verification QR Code for Card Front
  useEffect(() => {
    if (!isEligibleCardHolder || !user) return;
    const publicVerifyUrl = getAlumniVerificationUrl(user);
    QRCode.toDataURL(publicVerifyUrl, {
      width: 220,
      margin: 1,
      color: {
        dark: '#0a0a0c',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'M'
    })
      .then((url) => setVerificationQrUrl(url))
      .catch((err) => console.error('Failed to generate verification QR code', err));
  }, [isEligibleCardHolder, user]);

  // 30-Second Rolling Turnstile Token (Campus Physical Gate Pass)
  useEffect(() => {
    if (!isEligibleCardHolder || !user) return;
    const updateToken = () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const rem = 30 - (nowSec % 30);
      setSecondsRemaining(rem === 0 ? 30 : rem);

      const timeBucket = Math.floor(nowSec / 30);
      const uid = user?.uid || 'guest';
      const alumId = user?.alumniId || formattedId;
      const rawPayload = `SCC:ALUM:${uid}:${alumId}:${user?.batch || '2024'}:${timeBucket}`;

      let hash = 0;
      for (let i = 0; i < rawPayload.length; i++) {
        hash = (hash << 5) - hash + rawPayload.charCodeAt(i);
        hash |= 0;
      }
      const tokenHashHex = Math.abs(hash).toString(16).padStart(8, '0').toUpperCase();
      const secureTokenPayload = `${rawPayload}:${tokenHashHex}`;
      setCurrentTokenHash(tokenHashHex);

      QRCode.toDataURL(secureTokenPayload, {
        width: 280,
        margin: 1,
        color: {
          dark: '#1c1917',
          light: '#ffffff'
        },
        errorCorrectionLevel: 'M'
      })
        .then((url) => setRollingGateQrUrl(url))
        .catch(() => {});
    };

    updateToken();
    const interval = setInterval(updateToken, 1000);
    return () => clearInterval(interval);
  }, [isEligibleCardHolder, user, formattedId]);

  if (!user) return null;

  // Digital Alumni Card is for alumni, student, and academic staff
  // Partner employer companies do not receive digital alumni ID cards
  if (user.role === 'employer') return null;

  const maskedId = showFullNumber
    ? formattedId
    : `SCC •••• •••• ${user.batch || formattedId.slice(-4)}`;

  const handleCopyCard = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(formattedId);
    setCopied(true);
    addAuditLog({
      action: 'DIGITAL_ALUMNI_ID_COPIED',
      actorId: currentUser?.uid || user?.uid || 'alumni',
      actorName: currentUser?.name || user?.name || 'Alumni Member',
      actorRole: currentUser?.role || user?.role || 'alumni',
      category: 'profile',
      details: `Copied digital credential ID (${formattedId}) to clipboard.`,
      severity: 'info',
      targetRecordId: formattedId
    });
    showToast(`Official Alumni ID (${formattedId}) copied to clipboard!`, 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please upload a valid image file (JPG, PNG, WebP).', 'error');
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      showToast('Image size exceeds 8MB. Please choose a smaller photo.', 'error');
      return;
    }

    try {
      setIsUploadingPhoto(true);
      const compressedDataUrl = await compressImage(file, 800, 800, 0.85);

      if (updateUserProfile) {
        await updateUserProfile({
          avatar: compressedDataUrl,
          profilePictureUrl: compressedDataUrl,
          photoUrl: compressedDataUrl
        });
      }

      triggerHaptic('success');
    } catch (err) {
      console.error('Failed to update photo', err);
      showToast('Failed to update profile picture.', 'error');
    } finally {
      setIsUploadingPhoto(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // ==========================================
  // CARD FRONT — SIGNATURE DEEP CRIMSON (#8B181B) & GOLD THEME
  // ==========================================
  const cardFront = (
    <div className="relative w-full min-h-[250px] sm:h-full rounded-2xl overflow-hidden bg-gradient-to-br from-[#8B181B] via-[#6b1215] to-[#2b0709] text-white p-3.5 sm:p-6 flex flex-col justify-between gap-2.5 sm:gap-3 shadow-[0_14px_44px_rgba(139,24,27,0.45),0_0_0_1px_rgba(245,158,11,0.35)] border-2 border-amber-400/60 select-none">
      {/* Background Guilloche Security Pattern & Gold Radial Ambience */}
      <div className="absolute inset-0 opacity-25 pointer-events-none bg-[radial-gradient(ellipse_at_80%_20%,rgba(245,158,11,0.4),transparent_60%),radial-gradient(circle_at_20%_80%,rgba(139,24,27,0.45),transparent_50%)]" />
      <div className="absolute -right-14 -bottom-14 w-56 h-56 rounded-full border border-amber-400/20 pointer-events-none" />
      <div className="absolute -right-8 -bottom-8 w-44 h-44 rounded-full border border-amber-400/20 pointer-events-none" />
      <div className="absolute -left-12 -top-12 w-48 h-48 rounded-full border border-amber-400/15 pointer-events-none" />

      {/* 1. Header: Circular Logo + ST. CECILIA'S COLLEGE + Digital Alumni Credential + Verified Badge */}
      <div className="relative z-10 flex items-center justify-between gap-2 border-b border-amber-500/20 pb-2 sm:pb-2.5">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <img
            src={sealImgSrc}
            alt="St. Cecilia's College Seal"
            onError={() => {
              if (sealImgSrc !== '/assets/cecilians-seal.jpg') {
                setSealImgSrc('/assets/cecilians-seal.jpg');
              }
            }}
            className="w-9 h-9 sm:w-12 sm:h-12 rounded-full border-2 border-amber-400 shadow-md object-cover bg-white shrink-0"
          />
          <div className="min-w-0">
            <span className="text-[11px] sm:text-base font-black tracking-wide sm:tracking-wider uppercase text-amber-200 font-serif block leading-tight drop-shadow-xs">
              ST. CECILIA'S COLLEGE
            </span>
            <span className="text-[8.5px] sm:text-[11px] font-bold tracking-wider sm:tracking-widest text-amber-400/90 font-mono uppercase block leading-tight mt-0.5">
              Digital Alumni Credential
            </span>
          </div>
        </div>

        {/* Verified Status Badge & NFC Icon */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 shadow-xs">
            <ShieldCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400 shrink-0" />
            <span className="text-[9px] sm:text-[10.5px] font-extrabold uppercase tracking-wider">
              VERIFIED
            </span>
          </div>
          <Wifi className="w-4 h-4 text-amber-300/80 rotate-90 hidden sm:block" />
        </div>
      </div>

      {/* 2. Middle Row: Prominent Profile Picture + Alumnus Information + QR Code */}
      <div className="relative z-10 flex flex-col gap-2.5 sm:grid sm:grid-cols-12 sm:gap-4 sm:items-center my-auto py-1">
        {/* Top / Left Profile + Identity Row on mobile; Left Col on sm+ */}
        <div className="flex items-center gap-3 sm:contents">
          {/* Alumnus Profile Picture Frame */}
          <div className="shrink-0 sm:col-span-3 flex flex-col items-center">
            <div className="relative group">
              <div className="w-16 h-20 sm:w-24 sm:h-28 md:w-28 md:h-32 rounded-xl p-0.5 sm:p-1 bg-gradient-to-tr from-amber-500 via-amber-200 to-amber-600 shadow-lg overflow-hidden">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={user.name}
                    className="w-full h-full rounded-[9px] object-cover bg-stone-900"
                  />
                ) : (
                  <div className="w-full h-full rounded-[9px] bg-stone-900 flex flex-col items-center justify-center text-amber-300 p-1 text-center">
                    <span className="text-xl sm:text-3xl font-serif font-black">
                      {user.name.charAt(0)}
                    </span>
                    <span className="text-[7px] sm:text-[8px] text-amber-400/80 uppercase font-semibold mt-0.5">
                      No Photo
                    </span>
                  </div>
                )}
              </div>

              {/* Quick Upload / Change Photo Hover Trigger */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="absolute -bottom-1 -right-1 p-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 rounded-full border border-black shadow-md transition-transform hover:scale-110 cursor-pointer"
                title="Update profile picture on Digital ID"
                aria-label="Upload profile picture"
              >
                {isUploadingPhoto ? (
                  <div className="w-3 h-3 border-2 border-stone-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Camera className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                )}
              </button>
            </div>

            <span className="text-[8.5px] sm:text-[10px] text-amber-300/90 font-mono mt-1.5 text-center uppercase tracking-wider leading-tight">
              {graduationCohort}
            </span>
          </div>

          {/* Mobile Name + Degree summary */}
          <div className="min-w-0 flex-1 space-y-1 sm:hidden">
            <div className="inline-flex items-center gap-1 text-[8.5px] font-bold uppercase tracking-wider text-amber-300 bg-amber-500/15 px-1.5 py-0.5 rounded border border-amber-500/35 max-w-full">
              <Award className="w-2.5 h-2.5 text-amber-400 shrink-0" />
              <span className="leading-tight truncate">{membershipType}</span>
            </div>
            <h3 className="text-sm font-black tracking-tight uppercase text-white leading-tight break-words drop-shadow-sm font-sans">
              {user.name}
            </h3>
            <p className="text-[10.5px] font-bold text-amber-200/95 leading-snug break-words">
              {degreeProgram}
            </p>
          </div>
        </div>

        {/* Mobile Bottom Sub-Row: ID Box + Reveal + Verification QR */}
        <div className="flex items-center justify-between gap-2 pt-1 sm:hidden">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            <div className="bg-black/60 px-2 py-1 rounded border border-amber-500/30 font-mono text-[10px] font-bold text-amber-300 tracking-wider">
              {maskedId}
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowFullNumber(!showFullNumber);
              }}
              className="text-[8.5px] uppercase font-bold px-2 py-1 rounded bg-stone-800 hover:bg-stone-700 text-amber-200 border border-amber-500/20 cursor-pointer shrink-0"
            >
              {showFullNumber ? 'Hide' : 'Reveal'}
            </button>
          </div>

          <div className="shrink-0 flex flex-col items-center">
            <div className="p-1 bg-white rounded-lg shadow-md border border-amber-400/50">
              {verificationQrUrl ? (
                <img
                  src={verificationQrUrl}
                  alt="Alumni Verification QR Code"
                  className="w-12 h-12 object-contain"
                />
              ) : (
                <QrCode className="w-12 h-12 text-black" />
              )}
            </div>
            <span className="text-[7px] text-amber-300/85 font-mono tracking-widest uppercase mt-0.5">
              Scan Verify
            </span>
          </div>
        </div>

        {/* Desktop (sm+) Center-Right Column: Name, Degree, Membership & Verification QR */}
        <div className="hidden sm:flex sm:col-span-9 items-center justify-between gap-3 min-w-0">
          <div className="min-w-0 flex-1 space-y-1.5">
            {/* Membership Type Pill */}
            <div className="inline-flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wider text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded border border-amber-500/35 max-w-full">
              <Award className="w-3 h-3 text-amber-400 shrink-0" />
              <span className="leading-tight">{membershipType}</span>
            </div>

            {/* Alumnus Name */}
            <h3 className="text-lg md:text-xl font-black tracking-tight uppercase text-white leading-tight break-words drop-shadow-sm font-sans">
              {user.name}
            </h3>

            {/* Degree / Program */}
            <p className="text-xs md:text-sm font-bold text-amber-200/95 leading-snug break-words">
              {degreeProgram}
            </p>

            {/* Alumni ID Number Box */}
            <div className="pt-0.5 flex flex-wrap items-center gap-1.5">
              <div className="bg-black/60 px-2 py-0.5 rounded border border-amber-500/30 font-mono text-xs font-bold text-amber-300 tracking-wider">
                {maskedId}
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowFullNumber(!showFullNumber);
                }}
                className="text-[9px] uppercase font-bold px-2 py-0.5 rounded bg-stone-800 hover:bg-stone-700 text-amber-200 border border-amber-500/20 cursor-pointer shrink-0"
              >
                {showFullNumber ? 'Hide' : 'Reveal'}
              </button>
            </div>
          </div>

          {/* Verification QR Code (Opens Secure Public Verification Page) */}
          <div className="shrink-0 flex flex-col items-center pl-1">
            <div className="p-1.5 bg-white rounded-lg shadow-md border border-amber-400/50">
              {verificationQrUrl ? (
                <img
                  src={verificationQrUrl}
                  alt="Alumni Verification QR Code"
                  className="w-[72px] h-[72px] md:w-20 md:h-20 object-contain"
                />
              ) : (
                <QrCode className="w-[72px] h-[72px] md:w-20 md:h-20 text-black" />
              )}
            </div>
            <span className="text-[8.5px] text-amber-300/85 font-mono tracking-widest uppercase mt-1">
              Scan Verify
            </span>
          </div>
        </div>
      </div>

      {/* 3. Footer: Latin Motto "VIRTUS • SCIENTIA • CHARITAS" & Security Signature */}
      <div className="relative z-10 pt-2 border-t border-amber-500/20 flex items-center justify-between gap-2 text-[8px] sm:text-[10px]">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-amber-400/90 font-serif font-bold tracking-wider sm:tracking-widest truncate">
            VIRTUS • SCIENTIA • CHARITAS
          </span>
        </div>

        <div className="text-right shrink-0">
          <span className="font-mono text-amber-200/75 tracking-wider">
            OFFICIAL ALUMNI CREDENTIAL
          </span>
        </div>
      </div>

      {/* Hidden file input for one-click photo update */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handlePhotoUpload}
        accept="image/*"
        className="hidden"
      />
    </div>
  );

  // ==========================================
  // CARD BACK — OFFICIAL INSTITUTIONAL RECORD
  // ==========================================
  const cardBack = (
    <div className="relative w-full min-h-[250px] h-full rounded-2xl overflow-hidden bg-gradient-to-br from-[#8B181B] via-[#661013] to-[#250507] text-white p-3.5 sm:p-5 flex flex-col justify-between shadow-[0_14px_44px_rgba(139,24,27,0.45),0_0_0_1px_rgba(245,158,11,0.35)] border-2 border-amber-400/60 select-none">
      {/* Magnetic Stripe */}
      <div className="absolute top-3 sm:top-4 left-0 right-0 h-7 sm:h-9 bg-black border-y border-stone-800 shadow-inner" />

      <div className="pt-7 sm:pt-10 space-y-1 sm:space-y-2">
        {/* Signature Strip */}
        <div className="bg-stone-100 rounded px-2.5 sm:px-3 py-1 sm:py-1.5 flex items-center justify-between text-stone-900">
          <span className="font-serif italic text-[11px] sm:text-xs tracking-wider text-stone-800 truncate pr-2">
            {user.name}
          </span>
          <span className="font-mono text-[8px] sm:text-[9.5px] font-bold text-stone-500 shrink-0">
            SEC: {user.batch || '2024'}-SCC-ALUM
          </span>
        </div>

        {/* Terms & Conditions Notice */}
        <div className="p-2 bg-black/60 rounded-lg border border-amber-500/20 text-[7.5px] sm:text-[8.5px] text-stone-300 leading-snug space-y-1">
          <p className="font-bold text-amber-300 uppercase tracking-wider">
            ST. CECILIA'S COLLEGE - CEBU, INC. • OFFICIAL CREDENTIAL
          </p>
          <p>
            This Digital Alumni ID confirms accredited graduate status. It entitles the bearer to alumni privileges, campus privileges, library circulation access, and official institutional services.
          </p>
          {user.studentId && (
            <p className="font-mono text-amber-200/90">
              Registrar Student ID Ref: <span className="font-bold text-white">{user.studentId}</span>
            </p>
          )}
        </div>
      </div>

      {/* Optical Barcode Simulation & Latin Motto */}
      <div className="pt-1.5 border-t border-amber-500/20 flex flex-col items-center">
        <div className="w-full flex items-center justify-center gap-0.5 sm:gap-1 h-5 sm:h-7 bg-white/10 rounded px-2 py-0.5">
          {Array.from({ length: 38 }).map((_, i) => (
            <div
              key={i}
              className={`h-full bg-amber-200 ${
                i % 3 === 0 ? 'w-1 sm:w-1' : i % 5 === 0 ? 'w-1 sm:w-1.5' : 'w-0.5 sm:w-0.5'
              }`}
            />
          ))}
        </div>
        <div className="text-[7.5px] sm:text-[8.5px] font-mono text-amber-300/80 tracking-widest mt-1 truncate">
          *{formattedId}*
        </div>
        <span className="text-[7px] text-amber-400/60 font-serif tracking-widest uppercase mt-0.5">
          VIRTUS • SCIENTIA • CHARITAS
        </span>
      </div>
    </div>
  );

  return (
    <>
      <div className={`flex flex-col items-center ${compact ? 'max-w-lg w-full' : 'max-w-2xl w-full'} mx-auto`}>
        {/* Card Canvas Container with 3D Flip */}
        <div
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            triggerHaptic('light');
            setIsFlipped((prev) => !prev);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              triggerHaptic('light');
              setIsFlipped((prev) => !prev);
            }
          }}
          style={{ perspective: '1200px', WebkitPerspective: '1200px', touchAction: 'manipulation' }}
          className="w-full cursor-pointer transition-transform hover:scale-[1.01] active:scale-[0.99] duration-300 group select-none"
          title="Click to flip between front and back of your Digital Alumni ID"
          aria-label="Digital Alumni Card - tap to flip"
        >
          <div
            className="relative w-full transition-transform duration-700"
            style={{
              transformStyle: 'preserve-3d',
              WebkitTransformStyle: 'preserve-3d',
              transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
              WebkitTransform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
            }}
          >
            {/* Front Side (stays in normal flow so container never collapses on mobile Safari) */}
            <div
              className="relative w-full min-h-[250px] sm:aspect-[1.586/1] sm:min-h-[305px] md:min-h-[340px] transition-opacity duration-300"
              style={{
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                transform: 'rotateY(0deg)',
                WebkitTransform: 'rotateY(0deg)',
                opacity: isFlipped ? 0 : 1,
                pointerEvents: isFlipped ? 'none' : 'auto',
                zIndex: isFlipped ? 0 : 10
              }}
            >
              {cardFront}
            </div>

            {/* Back Side */}
            <div
              className="absolute inset-0 w-full h-full transition-opacity duration-300"
              style={{
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
                WebkitTransform: 'rotateY(180deg)',
                opacity: isFlipped ? 1 : 0,
                pointerEvents: isFlipped ? 'auto' : 'none',
                zIndex: isFlipped ? 10 : 0
              }}
            >
              {cardBack}
            </div>
          </div>
        </div>

        {/* Card Action Toolbar: Flip, Copy, Pass */}
        <div className="grid grid-cols-3 gap-2 w-full mt-3.5 text-xs">
          {/* Flip */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              triggerHaptic('light');
              setIsFlipped((prev) => !prev);
            }}
            className="flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-200 border border-amber-500/20 font-semibold transition-colors shadow-xs cursor-pointer text-center"
            title="Flip Card"
          >
            <RotateCw className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-[11px] sm:text-xs">{isFlipped ? 'Show Front' : 'Flip Card'}</span>
          </button>

          {/* Copy ID */}
          <button
            type="button"
            onClick={handleCopyCard}
            className="flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-200 border border-amber-500/20 font-medium transition-colors shadow-xs cursor-pointer text-center"
            title="Copy Official Alumni ID"
          >
            {copied ? (
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <Copy className="w-4 h-4 text-amber-400 shrink-0" />
            )}
            <span className="text-[11px] sm:text-xs">{copied ? 'Copied' : 'Copy ID'}</span>
          </button>

          {/* Full Screen Gate Pass */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setIsFullScreen(true);
            }}
            className="flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold transition-colors shadow-xs cursor-pointer text-center"
            title="Full screen gate pass for campus turnstiles"
          >
            <Maximize2 className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-[11px] sm:text-xs">Gate Pass</span>
          </button>
        </div>
      </div>

      {/* Full Screen Gate Pass Modal for Campus Turnstiles & Verification */}
      {isFullScreen && (
        <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 pt-safe pb-safe animate-in fade-in">
          <div className="bg-stone-900 border border-amber-500/30 rounded-2xl p-4 sm:p-6 max-w-lg w-full text-white shadow-2xl flex flex-col items-center gap-3.5 sm:gap-4 max-h-[94dvh] overflow-y-auto">
            <div className="w-full flex items-center justify-between pb-2.5 sm:pb-3 border-b border-stone-800">
              <div className="flex items-center gap-2.5">
                <img
                  src="/assets/cecilians-seal.jpg"
                  alt="St. Cecilia's College Seal"
                  className="w-6 h-6 rounded-full border border-amber-400/70 object-cover bg-white shrink-0"
                />
                <span className="font-bold text-xs sm:text-sm text-amber-200 truncate">
                  St. Cecilia's College Turnstile Pass
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsFullScreen(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Render card front */}
            <div className="w-full sm:aspect-[1.586/1] sm:min-h-[270px]">{cardFront}</div>

            {/* High-Contrast Turnstile QR Code with Rolling Token & SVG Countdown Ring */}
            <div className="bg-white p-3.5 sm:p-4 rounded-2xl flex flex-col items-center gap-3 text-stone-900 w-full shadow-lg border border-stone-200">
              <div className="relative flex items-center justify-center p-2 bg-stone-50 rounded-xl border border-stone-100">
                {rollingGateQrUrl ? (
                  <img
                    src={rollingGateQrUrl}
                    alt="Campus Gate QR Token"
                    className="w-40 h-40 sm:w-48 sm:h-48 rounded-lg object-contain"
                  />
                ) : (
                  <QrCode className="w-36 h-36 text-black" />
                )}
              </div>

              {/* Rolling 30s Countdown Ring & Security Status */}
              <div className="flex items-center justify-between w-full px-2.5 py-2 bg-stone-100/80 rounded-xl border border-stone-200/80">
                <div className="flex items-center gap-2.5">
                  <div className="relative w-8 h-8 flex items-center justify-center shrink-0">
                    <svg className="w-8 h-8 -rotate-90" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="15" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                      <circle
                        cx="18"
                        cy="18"
                        r="15"
                        fill="none"
                        stroke="#8B181B"
                        strokeWidth="3"
                        strokeDasharray="94.2"
                        strokeDashoffset={94.2 * (1 - secondsRemaining / 30)}
                        strokeLinecap="round"
                        className="transition-all duration-1000 ease-linear"
                      />
                    </svg>
                    <span className="absolute text-[10px] font-mono font-bold text-stone-800">
                      {secondsRemaining}
                    </span>
                  </div>

                  <div className="text-left">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-xs font-bold text-stone-900 uppercase tracking-tight">
                        Live Dynamic Token
                      </span>
                    </div>
                    <p className="text-[10px] text-stone-500">
                      Refreshes in {secondsRemaining}s • Anti-screenshot guard
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[9px] uppercase tracking-wider text-stone-400 font-mono block">SIG</span>
                  <span className="text-xs font-mono font-bold text-[#8B181B]">{currentTokenHash}</span>
                </div>
              </div>

              <div className="text-center pt-1 border-t border-stone-100 w-full">
                <div className="font-mono text-xs sm:text-sm font-black tracking-widest text-[#8B181B]">
                  {formattedId}
                </div>
                <div className="text-[10px] sm:text-[11px] text-stone-600 font-medium">
                  Scan at Turnstile Gate • Library Circulation • Registrar
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  );
};
