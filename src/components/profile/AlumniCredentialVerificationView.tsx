import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Award,
  GraduationCap,
  Calendar,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  ArrowLeft,
  Building,
  UserCheck,
  QrCode,
  Share2
} from 'lucide-react';
import { verifyAlumniToken, AlumniCredentialClaim } from '../../services/alumniIdVerificationService';
import { triggerHaptic } from '../../services/hapticsService';

interface AlumniCredentialVerificationViewProps {
  token: string;
  onBackToApp?: () => void;
}

export const AlumniCredentialVerificationView: React.FC<AlumniCredentialVerificationViewProps> = ({
  token,
  onBackToApp
}) => {
  const [verificationResult, setVerificationResult] = useState<{
    isLoading: boolean;
    isValid: boolean;
    claim?: AlumniCredentialClaim;
    error?: string;
  }>({
    isLoading: true,
    isValid: false
  });

  const [sealImgSrc, setSealImgSrc] = useState('/assets/cecilians-seal.jpg');
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    // Simulate instantaneous verification with official St. Cecilia's registrar key validation
    const timer = setTimeout(() => {
      const result = verifyAlumniToken(token);
      setVerificationResult({
        isLoading: false,
        isValid: result.isValid,
        claim: result.claim,
        error: result.error
      });
      if (result.isValid) {
        triggerHaptic('success');
      } else {
        triggerHaptic('warning');
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [token]);

  const handleShare = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0e11] text-stone-100 flex flex-col justify-between selection:bg-amber-500 selection:text-stone-900">
      {/* Institutional Top Header */}
      <header className="border-b border-amber-500/20 bg-stone-950/80 backdrop-blur-md sticky top-0 z-30 px-4 py-3 sm:px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={sealImgSrc}
              alt="St. Cecilia's College Seal"
              onError={() => setSealImgSrc('/assets/st-cecilias-college-seal.jpg')}
              className="w-10 h-10 rounded-full border-2 border-amber-400 shadow-md object-cover bg-white"
            />
            <div>
              <h1 className="text-sm sm:text-base font-black tracking-wider uppercase text-amber-300 font-serif">
                St. Cecilia's College
              </h1>
              <p className="text-[10px] sm:text-xs text-amber-100/70 tracking-widest font-mono uppercase">
                Digital Credential Verification Service • Cebu, Inc.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleShare}
              className="px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Share verification link"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{copiedLink ? 'Copied' : 'Share'}</span>
            </button>

            {onBackToApp && (
              <button
                type="button"
                onClick={onBackToApp}
                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Portal</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Verification Certificate Card */}
      <main className="flex-1 max-w-2xl w-full mx-auto p-4 sm:p-6 flex flex-col justify-center">
        {verificationResult.isLoading ? (
          <div className="p-8 sm:p-12 text-center rounded-3xl bg-stone-900/60 border border-amber-500/20 backdrop-blur-sm">
            <div className="w-14 h-14 mx-auto mb-4 border-3 border-amber-400 border-t-transparent rounded-full animate-spin" />
            <h2 className="text-lg font-bold text-amber-200 uppercase tracking-wider font-mono">
              Verifying Alumni Credential...
            </h2>
            <p className="text-xs text-stone-400 mt-2">
              Validating cryptographic token against St. Cecilia’s College Alumni Archive.
            </p>
          </div>
        ) : verificationResult.isValid && verificationResult.claim ? (
          <div className="relative rounded-3xl overflow-hidden bg-gradient-to-b from-stone-900 via-stone-950 to-black border-2 border-amber-500/40 shadow-[0_8px_40px_rgba(217,119,6,0.15)] p-6 sm:p-8">
            {/* Background Guilloche Wave / Watermark */}
            <div className="absolute -right-20 -bottom-20 w-80 h-80 rounded-full border border-amber-500/10 pointer-events-none" />
            <div className="absolute -right-10 -bottom-10 w-60 h-60 rounded-full border border-amber-500/10 pointer-events-none" />
            <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent" />

            {/* Official Validated Banner */}
            <div className="mb-6 p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-full bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-emerald-300">
                    Authentic Credential Verified
                  </span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <p className="text-[11px] text-emerald-200/80 mt-0.5">
                  Official registered alumnus of St. Cecilia’s College - Cebu, Inc.
                </p>
              </div>
            </div>

            {/* Alumnus Identity Block */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 pb-6 border-b border-amber-500/20 text-center sm:text-left">
              {/* Profile Photo Frame */}
              <div className="relative shrink-0">
                <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl p-1 bg-gradient-to-tr from-amber-500 via-amber-200 to-amber-600 shadow-xl">
                  {verificationResult.claim.avatar ? (
                    <img
                      src={verificationResult.claim.avatar}
                      alt={verificationResult.claim.name}
                      className="w-full h-full rounded-xl object-cover bg-stone-900"
                    />
                  ) : (
                    <div className="w-full h-full rounded-xl bg-stone-900 flex flex-col items-center justify-center text-amber-300 font-serif font-black text-3xl">
                      {verificationResult.claim.name.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="absolute -bottom-2 -right-2 bg-black/90 p-1.5 rounded-full border border-amber-400/80 shadow-md">
                  <UserCheck className="w-4 h-4 text-amber-400" />
                </div>
              </div>

              {/* Name & Core Credentials */}
              <div className="flex-1 min-w-0">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-300 border border-amber-500/30 mb-2">
                  <Award className="w-3.5 h-3.5 text-amber-400" />
                  <span>{verificationResult.claim.membershipType || 'Alumni Council Member'}</span>
                </div>

                <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight uppercase font-serif drop-shadow-sm">
                  {verificationResult.claim.name}
                </h2>

                <p className="text-sm font-semibold text-amber-200/90 mt-1 flex items-center justify-center sm:justify-start gap-1.5">
                  <GraduationCap className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Class of {verificationResult.claim.batch} • {verificationResult.claim.degree}</span>
                </p>

                <div className="mt-3 inline-block font-mono text-xs font-bold text-amber-300 bg-black/60 px-3 py-1 rounded-lg border border-amber-500/20 tracking-wider">
                  ID: {verificationResult.claim.alumniId}
                </div>
              </div>
            </div>

            {/* Academic Credential Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 my-6 text-xs">
              <div className="p-3.5 rounded-xl bg-stone-900/60 border border-stone-800">
                <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider block">
                  Degree / Program
                </span>
                <span className="font-semibold text-stone-100 text-sm mt-0.5 block">
                  {verificationResult.claim.degree}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-stone-900/60 border border-stone-800">
                <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider block">
                  Graduation Cohort
                </span>
                <span className="font-semibold text-stone-100 text-sm mt-0.5 block">
                  Class of {verificationResult.claim.batch}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-stone-900/60 border border-stone-800">
                <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider block">
                  Membership Classification
                </span>
                <span className="font-semibold text-stone-100 text-sm mt-0.5 block">
                  {verificationResult.claim.membershipType || 'Active Alumni Member'}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-stone-900/60 border border-stone-800">
                <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider block">
                  Credential Status
                </span>
                <span className="font-semibold text-emerald-400 text-sm mt-0.5 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Accredited & Active</span>
                </span>
              </div>
            </div>

            {/* Institutional Seal & Motto Footer */}
            <div className="pt-4 border-t border-amber-500/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left text-xs">
              <div>
                <span className="text-[9px] uppercase tracking-widest text-amber-400/80 font-mono block">
                  Official Motto
                </span>
                <span className="text-amber-200 font-serif tracking-widest font-bold">
                  VIRTUS • SCIENTIA • CHARITAS
                </span>
              </div>

              <div className="text-right">
                <span className="text-[9px] uppercase tracking-wider text-stone-500 font-mono block">
                  Verification Token Hash
                </span>
                <span className="font-mono text-[11px] text-amber-400/90 font-bold">
                  {verificationResult.claim.sig}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 sm:p-8 rounded-3xl bg-stone-950 border-2 border-red-500/40 text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-950/60 border border-red-500/50 flex items-center justify-center">
              <ShieldAlert className="w-7 h-7 text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-white uppercase tracking-wider">
              Verification Failed
            </h2>
            <p className="text-sm text-red-300 mt-2 max-w-md mx-auto">
              {verificationResult.error || 'The digital alumni credential could not be verified or has been revoked.'}
            </p>
            <p className="text-xs text-stone-500 mt-4">
              Please contact the St. Cecilia’s College Registrar or Alumni Relations Office for official transcript verification.
            </p>
            {onBackToApp && (
              <button
                type="button"
                onClick={onBackToApp}
                className="mt-6 px-5 py-2.5 bg-stone-800 hover:bg-stone-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
              >
                Go to Portal Home
              </button>
            )}
          </div>
        )}
      </main>

      {/* Institutional Legal Footer */}
      <footer className="border-t border-stone-800/80 bg-stone-950/80 px-4 py-4 text-center text-xs text-stone-500">
        <p>St. Cecilia's College - Cebu, Inc. • Alumni Relations & Registrar Verification System</p>
        <p className="text-[11px] text-stone-600 mt-0.5">
          Poblacion Ward II, Minglanilla, Cebu, Philippines • All rights reserved
        </p>
      </footer>
    </div>
  );
};
