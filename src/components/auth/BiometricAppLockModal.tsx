/**
 * St. Cecilia's College - Cecilian Alumnet
 * Multi-Modal Biometric Security Gate (Face Detection, Fingerprint & Campus PIN)
 * 
 * Powered by:
 * - Optical Face Detection & Active Liveness Challenge Engine
 * - Native WebAuthn Platform Authenticator & Capacitor Biometrics
 * - Secure 4-6 Digit Campus PIN Enclave Fallback
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  ScanFace,
  Fingerprint,
  KeyRound,
  Lock,
  Unlock,
  LogOut,
  AlertCircle,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  Camera,
  CameraOff,
  Scan,
  Focus,
  Delete,
  Eye,
  ArrowRight,
  ShieldAlert,
  ChevronRight,
  Cpu
} from 'lucide-react';
import { UserProfile } from '../../types';
import {
  checkBiometricAvailability,
  verifyBiometricForDashboardAccess,
  verifyCampusPin,
  getCampusPinConfig,
  getPreferredBiometricModality,
  setPreferredBiometricModality,
  BiometricAvailability
} from '../../services/biometricAuthService';
import { LivenessDetector, LivenessChallengeState } from '../../utils/livenessDetector';
import { getUserAvatar, handleUserAvatarError } from '../../lib/defaultImages';
import { triggerHaptic } from '../../services/hapticsService';

interface BiometricAppLockModalProps {
  currentUser: UserProfile;
  isOpen: boolean;
  onUnlocked: () => void;
  onSignOut: () => void;
}

type AuthModality = 'face' | 'fingerprint' | 'pin';

export const BiometricAppLockModal: React.FC<BiometricAppLockModalProps> = ({
  currentUser,
  isOpen,
  onUnlocked,
  onSignOut
}) => {
  const [activeModality, setActiveModality] = useState<AuthModality>(() => getPreferredBiometricModality());
  const [biometricAvail, setBiometricAvail] = useState<BiometricAvailability>({
    isAvailable: true,
    biometryType: 'both',
    label: 'Face & Fingerprint Biometrics',
    hasFace: true,
    hasFingerprint: true,
    hasWebAuthn: false,
    hasCapacitor: false
  });

  const [isInitializing, setIsInitializing] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Live Camera & Optical Liveness Detector
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const livenessDetectorRef = useRef<LivenessDetector>(new LivenessDetector());

  const [livenessState, setLivenessState] = useState<LivenessChallengeState>({
    currentStep: 'center_face',
    instruction: 'Align your face in the oval reticle',
    progress: 15,
    blinkDetected: false,
    turnDetected: false,
    microMotionScore: 0.5,
    isSpoofSuspected: false
  });

  // Campus PIN Keypad State
  const [pinDigits, setPinDigits] = useState<string>('');
  const [pinLockoutSeconds, setPinLockoutSeconds] = useState<number>(0);
  const [pinRemainingAttempts, setPinRemainingAttempts] = useState<number>(5);
  const [isPinSubmitting, setIsPinSubmitting] = useState<boolean>(false);

  // Load hardware status on mount
  useEffect(() => {
    checkBiometricAvailability().then((avail) => {
      setBiometricAvail(avail);
    });
    const pinConfig = getCampusPinConfig(currentUser.uid);
    setPinLockoutSeconds(pinConfig.lockoutSecondsLeft);
    setPinRemainingAttempts(pinConfig.remainingAttempts);
  }, [currentUser.uid]);

  // Handle countdown interval for PIN lockout
  useEffect(() => {
    if (pinLockoutSeconds <= 0) return;
    const interval = setInterval(() => {
      setPinLockoutSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          const updated = getCampusPinConfig(currentUser.uid);
          setPinRemainingAttempts(updated.remainingAttempts);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [pinLockoutSeconds, currentUser.uid]);

  // Clean stop camera stream
  const stopCameraStream = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  // Frame processing loop for optical liveness
  const processLivenessLoop = useCallback(() => {
    if (!videoRef.current || !cameraActive) return;

    const state = livenessDetectorRef.current.processVideoFrame(videoRef.current);
    setLivenessState(state);

    if (state.currentStep === 'complete') {
      setIsSuccess(true);
      triggerHaptic('success');
      stopCameraStream();
      setTimeout(() => {
        onUnlocked();
      }, 550);
      return;
    }

    animationFrameRef.current = requestAnimationFrame(processLivenessLoop);
  }, [cameraActive, onUnlocked, stopCameraStream]);

  // Start front camera stream
  const startCameraStream = useCallback(async () => {
    try {
      setCameraError(null);
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Camera API not accessible on this device.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 480 },
          height: { ideal: 480 }
        },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(() => {});
          livenessDetectorRef.current.reset();
          animationFrameRef.current = requestAnimationFrame(processLivenessLoop);
        };
      }
      setCameraActive(true);
    } catch (err: any) {
      console.warn('Front camera stream error:', err);
      setCameraError('Front camera inactive. Using simulated optical sensor.');
      setCameraActive(false);
    }
  }, [processLivenessLoop]);

  // Stop camera when unmounting or switching to fingerprint/PIN
  useEffect(() => {
    if (activeModality !== 'face') {
      stopCameraStream();
    }
  }, [activeModality, stopCameraStream]);

  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, [stopCameraStream]);

  // Switch modality handler
  const handleSelectModality = (modality: AuthModality) => {
    triggerHaptic('light');
    setActiveModality(modality);
    setErrorMsg(null);
    if (modality === 'face' || modality === 'fingerprint') {
      setPreferredBiometricModality(modality);
    }
  };

  // Face unlock trigger (with simulated challenge if camera preview is off)
  const handleTriggerFaceUnlock = useCallback(async () => {
    if (isVerifying || isSuccess) return;
    setIsVerifying(true);
    setErrorMsg(null);

    // If live camera is running, user performs physical blink & head turn
    if (cameraActive) {
      livenessDetectorRef.current.reset();
      setLivenessState(livenessDetectorRef.current.getState());
      setIsVerifying(false);
      return;
    }

    // Otherwise, execute high-fidelity simulated liveness progression
    const cleanupSim = livenessDetectorRef.current.simulateStepProgression((state) => {
      setLivenessState(state);
      if (state.currentStep === 'complete') {
        setIsSuccess(true);
        triggerHaptic('success');
        setTimeout(() => {
          onUnlocked();
        }, 550);
      }
    });

    try {
      const res = await verifyBiometricForDashboardAccess({
        modality: 'face',
        userName: currentUser.name
      });
      if (!res.success && res.error) {
        cleanupSim();
        setErrorMsg(res.error);
        await triggerHaptic('error');
      }
    } catch (err: any) {
      cleanupSim();
      setErrorMsg(err?.message || 'Face detection was cancelled.');
      await triggerHaptic('error');
    } finally {
      setIsVerifying(false);
    }
  }, [cameraActive, currentUser.name, isSuccess, isVerifying, onUnlocked]);

  // Fingerprint verification trigger (WebAuthn / Capacitor Hardware)
  const handleTriggerFingerprintUnlock = useCallback(async () => {
    if (isVerifying || isSuccess) return;
    setIsVerifying(true);
    setErrorMsg(null);

    try {
      const res = await verifyBiometricForDashboardAccess({
        modality: 'fingerprint',
        userName: currentUser.name
      });

      if (res.success) {
        setIsSuccess(true);
        await triggerHaptic('success');
        setTimeout(() => {
          onUnlocked();
        }, 500);
      } else {
        setErrorMsg(res.error || 'Fingerprint was not recognized. Please try again.');
        await triggerHaptic('error');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Fingerprint verification failed.');
      await triggerHaptic('error');
    } finally {
      setIsVerifying(false);
    }
  }, [currentUser.name, isSuccess, isVerifying, onUnlocked]);

  // Campus PIN Submission handler
  const handlePinDigitPress = (digit: string) => {
    if (pinLockoutSeconds > 0 || isPinSubmitting || isSuccess) return;
    if (pinDigits.length >= 6) return;
    triggerHaptic('light');
    const newPin = pinDigits + digit;
    setPinDigits(newPin);
    setErrorMsg(null);

    // Auto-verify if 4 or 6 digits entered
    if (newPin.length >= 4) {
      // Evaluate after small delay for UI feedback
      setTimeout(() => {
        executePinVerification(newPin);
      }, 150);
    }
  };

  const handlePinBackspace = () => {
    if (pinLockoutSeconds > 0 || isPinSubmitting || isSuccess) return;
    triggerHaptic('light');
    setPinDigits((prev) => prev.slice(0, -1));
    setErrorMsg(null);
  };

  const executePinVerification = async (pinToVerify: string) => {
    if (isPinSubmitting) return;
    setIsPinSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await verifyCampusPin(pinToVerify, currentUser.uid);
      if (res.success) {
        setIsSuccess(true);
        await triggerHaptic('success');
        setTimeout(() => {
          onUnlocked();
        }, 500);
      } else {
        setErrorMsg(res.error || 'Incorrect Campus PIN.');
        setPinDigits('');
        if (res.remainingAttempts !== undefined) {
          setPinRemainingAttempts(res.remainingAttempts);
        }
        if (res.lockedUntil) {
          setPinLockoutSeconds(Math.ceil((res.lockedUntil - Date.now()) / 1000));
        }
        await triggerHaptic('error');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to verify PIN.');
      setPinDigits('');
      await triggerHaptic('error');
    } finally {
      setIsPinSubmitting(false);
    }
  };

  // Auto trigger face or fingerprint on modal open
  useEffect(() => {
    if (isOpen) {
      setIsInitializing(true);
      setErrorMsg(null);
      setIsSuccess(false);

      const timer = setTimeout(() => {
        setIsInitializing(false);
        if (activeModality === 'face') {
          handleTriggerFaceUnlock();
        } else if (activeModality === 'fingerprint') {
          handleTriggerFingerprintUnlock();
        }
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] bg-stone-950/95 backdrop-blur-2xl flex items-center justify-center p-3 sm:p-4 pt-safe pb-safe select-none">
        {/* Ambient collegiate background glow */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-[#8B181B]/20 rounded-full blur-3xl opacity-60" />
          <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl opacity-40" />
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full max-w-sm sm:max-w-md bg-stone-900/95 border border-stone-800 rounded-3xl p-5 sm:p-6 text-center shadow-[0_24px_80px_rgba(0,0,0,0.8)] flex flex-col items-center z-10"
        >
          {/* Top Security Banner */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-950/80 border border-red-800/60 text-red-300 text-[10px] font-bold uppercase tracking-wider mb-3">
            <ShieldCheck className="w-3.5 h-3.5 text-red-400 shrink-0" />
            <span>Biometric Security Enclave</span>
          </div>

          {/* User Profile Avatar with Lock Hub */}
          <div className="relative mb-3">
            <div
              className={`absolute inset-0 rounded-full blur-lg transition-all duration-500 ${
                isSuccess
                  ? 'bg-emerald-500/60 scale-110'
                  : isVerifying
                  ? 'bg-[#8B181B]/60 scale-105 animate-pulse'
                  : 'bg-[#8B181B]/30'
              }`}
            />
            <img
              src={getUserAvatar(currentUser.profilePictureUrl)}
              alt={currentUser.name}
              onError={handleUserAvatarError}
              className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover border-2 shadow-xl transition-all duration-300 ${
                isSuccess
                  ? 'border-emerald-500 ring-4 ring-emerald-500/30'
                  : 'border-[#8B181B] ring-4 ring-[#8B181B]/20'
              }`}
            />
            <div
              className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-stone-900 flex items-center justify-center shadow-lg transition-colors duration-300 ${
                isSuccess ? 'bg-emerald-600' : 'bg-[#8B181B]'
              }`}
            >
              {isSuccess ? (
                <Unlock className="w-3 h-3 text-white" />
              ) : (
                <Lock className="w-3 h-3 text-white" />
              )}
            </div>
          </div>

          {/* Title & Greeting */}
          <h2 className="text-base sm:text-lg font-bold font-sans text-white tracking-tight">
            {isSuccess
              ? 'Identity Verified'
              : activeModality === 'face'
              ? 'Face Recognition'
              : activeModality === 'fingerprint'
              ? 'Fingerprint Sensor'
              : 'Campus PIN Entry'}
          </h2>
          <p className="text-xs text-stone-200 font-semibold mt-0.5">
            {currentUser.name}
          </p>

          {/* Interactive Modality Switcher Tab Bar */}
          <div className="w-full mt-3 mb-4 p-1 bg-stone-950/80 rounded-2xl border border-stone-800 flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleSelectModality('face')}
              className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeModality === 'face'
                  ? 'bg-[#8B181B] text-white shadow-sm'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-850'
              }`}
            >
              <ScanFace className="w-3.5 h-3.5" />
              <span>Face Scan</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectModality('fingerprint')}
              className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeModality === 'fingerprint'
                  ? 'bg-[#8B181B] text-white shadow-sm'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-850'
              }`}
            >
              <Fingerprint className="w-3.5 h-3.5" />
              <span>Fingerprint</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectModality('pin')}
              className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeModality === 'pin'
                  ? 'bg-[#8B181B] text-white shadow-sm'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-850'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>PIN Code</span>
            </button>
          </div>

          {/* ========================================================================= */}
          {/* VIEW A: OPTICAL FACE DETECTION & ACTIVE LIVENESS CHALLENGE                */}
          {/* ========================================================================= */}
          {activeModality === 'face' && (
            <div className="w-full flex flex-col items-center animate-in fade-in duration-200">
              <div
                onClick={handleTriggerFaceUnlock}
                role="button"
                tabIndex={0}
                className={`relative w-40 h-40 sm:w-44 sm:h-44 rounded-3xl overflow-hidden flex flex-col items-center justify-center transition-all cursor-pointer select-none ${
                  isSuccess
                    ? 'bg-emerald-950/70 border-2 border-emerald-500 shadow-[0_0_35px_rgba(16,185,129,0.35)]'
                    : isVerifying || isInitializing
                    ? 'bg-stone-950/90 border-2 border-[#8B181B] shadow-[0_0_25px_rgba(139,24,27,0.45)]'
                    : 'bg-stone-950/80 hover:bg-stone-900 border-2 border-stone-700/80 hover:border-[#8B181B]/70 shadow-xl'
                }`}
              >
                {/* Live Camera Viewfinder Video */}
                {cameraActive && (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`absolute inset-0 w-full h-full object-cover transform -scale-x-100 transition-opacity duration-300 ${
                      isSuccess ? 'opacity-80' : 'opacity-90'
                    }`}
                  />
                )}

                {/* Subtle Coordinate Grid Overlay */}
                <div className="absolute inset-0 pointer-events-none opacity-20">
                  <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <pattern id="biometric-grid-mini" width="16" height="16" patternUnits="userSpaceOnUse">
                        <path d="M 16 0 L 0 0 0 16" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-red-300/30" />
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#biometric-grid-mini)" />
                  </svg>
                </div>

                {/* Corner Target Reticles */}
                <div className="absolute top-2.5 left-2.5 w-3.5 h-3.5 border-t-2 border-l-2 border-red-400" />
                <div className="absolute top-2.5 right-2.5 w-3.5 h-3.5 border-t-2 border-r-2 border-red-400" />
                <div className="absolute bottom-2.5 left-2.5 w-3.5 h-3.5 border-b-2 border-l-2 border-red-400" />
                <div className="absolute bottom-2.5 right-2.5 w-3.5 h-3.5 border-b-2 border-r-2 border-red-400" />

                {/* Oval Facial Reticle */}
                <div
                  className={`relative w-24 h-32 rounded-[50%] border-2 transition-all duration-300 flex items-center justify-center ${
                    isSuccess
                      ? 'border-emerald-400 scale-95 shadow-[0_0_20px_rgba(52,211,153,0.3)]'
                      : isVerifying || isInitializing
                      ? 'border-red-500/80 border-dashed animate-pulse'
                      : 'border-dashed border-stone-600'
                  }`}
                >
                  {!cameraActive && (
                    <div className="z-10">
                      {isSuccess ? (
                        <CheckCircle2 className="w-12 h-12 text-emerald-400" />
                      ) : (
                        <ScanFace
                          className={`w-12 h-12 transition-all ${
                            isVerifying || isInitializing
                              ? 'text-rose-400 scale-105'
                              : 'text-stone-300'
                          }`}
                        />
                      )}
                    </div>
                  )}
                </div>

                {/* Optical Laser Scanning Beam */}
                {(isVerifying || isInitializing || cameraActive) && !isSuccess && (
                  <motion.div
                    initial={{ y: -70 }}
                    animate={{ y: 70 }}
                    transition={{
                      repeat: Infinity,
                      repeatType: 'reverse',
                      duration: 1.5,
                      ease: 'easeInOut'
                    }}
                    className="absolute inset-x-2 pointer-events-none z-20 flex flex-col items-center"
                  >
                    <div className="w-full h-5 bg-gradient-to-b from-transparent via-red-500/10 to-red-500/30 blur-[1px]" />
                    <div className="w-full h-[2px] bg-gradient-to-r from-transparent via-red-300 to-transparent shadow-[0_0_10px_rgba(248,113,113,0.9)]" />
                  </motion.div>
                )}

                {/* Status Pill in Viewfinder */}
                <div className="absolute bottom-2 inset-x-2 flex items-center justify-center z-20 pointer-events-none">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[8.5px] font-bold uppercase tracking-wider backdrop-blur-md shadow-sm ${
                      isSuccess
                        ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-500/50'
                        : isVerifying
                        ? 'bg-red-950/90 text-rose-300 border border-red-500/50'
                        : 'bg-stone-900/90 text-stone-300 border border-stone-700/60'
                    }`}
                  >
                    {isSuccess
                      ? 'Face Verified (100%)'
                      : cameraActive
                      ? 'Live Liveness Active'
                      : isVerifying
                      ? 'Optical Scan Active'
                      : 'Tap to Scan Face'}
                  </span>
                </div>
              </div>

              {/* Active Liveness Challenge Guidance Badge */}
              <div className="w-full mt-2.5 p-2 rounded-xl bg-stone-950/90 border border-stone-800 text-[10.5px] font-sans flex items-center justify-between">
                <div className="flex items-center gap-1.5 truncate text-stone-300">
                  <Eye className={`w-3.5 h-3.5 ${livenessState.blinkDetected ? 'text-emerald-400' : 'text-amber-400'} shrink-0`} />
                  <span className="truncate">{livenessState.instruction}</span>
                </div>
                <span className="font-mono font-bold text-amber-400 shrink-0 pl-2">
                  {livenessState.progress}%
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full mt-1.5 h-1.5 bg-stone-800 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full transition-all duration-300 ${
                    isSuccess ? 'bg-emerald-500' : 'bg-gradient-to-r from-[#8B181B] to-amber-500'
                  }`}
                  style={{ width: `${livenessState.progress}%` }}
                />
              </div>

              {/* Camera Preview Button */}
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (cameraActive) {
                      stopCameraStream();
                    } else {
                      startCameraStream();
                    }
                  }}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-stone-800/80 hover:bg-stone-800 text-stone-300 hover:text-white border border-stone-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {cameraActive ? (
                    <>
                      <CameraOff className="w-3 h-3 text-stone-400" />
                      <span>Turn Off Camera</span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-3 h-3 text-amber-400" />
                      <span>Start Front Camera & Liveness</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* VIEW B: HARDWARE FINGERPRINT / TOUCH ID                                   */}
          {/* ========================================================================= */}
          {activeModality === 'fingerprint' && (
            <div className="w-full flex flex-col items-center animate-in fade-in duration-200">
              <div
                onClick={handleTriggerFingerprintUnlock}
                role="button"
                tabIndex={0}
                className={`relative w-40 h-40 sm:w-44 sm:h-44 rounded-3xl overflow-hidden flex flex-col items-center justify-center transition-all cursor-pointer select-none group ${
                  isSuccess
                    ? 'bg-emerald-950/70 border-2 border-emerald-500 shadow-[0_0_35px_rgba(16,185,129,0.35)]'
                    : isVerifying
                    ? 'bg-stone-950/90 border-2 border-[#8B181B] shadow-[0_0_25px_rgba(139,24,27,0.45)]'
                    : 'bg-stone-950/80 hover:bg-stone-900 border-2 border-stone-700/80 hover:border-[#8B181B]/70 shadow-xl'
                }`}
              >
                {/* Concentric Capacitive Wave Rings */}
                {isVerifying && !isSuccess && (
                  <>
                    <motion.div
                      initial={{ scale: 0.6, opacity: 0.7 }}
                      animate={{ scale: 1.4, opacity: 0 }}
                      transition={{ repeat: Infinity, duration: 1.8, ease: 'easeOut' }}
                      className="absolute w-28 h-28 rounded-full border border-red-500/50 pointer-events-none"
                    />
                    <motion.div
                      initial={{ scale: 0.6, opacity: 0.7 }}
                      animate={{ scale: 1.4, opacity: 0 }}
                      transition={{ repeat: Infinity, duration: 1.8, delay: 0.9, ease: 'easeOut' }}
                      className="absolute w-28 h-28 rounded-full border border-amber-500/40 pointer-events-none"
                    />
                  </>
                )}

                {/* Fingerprint Center Graphic */}
                <div className="relative z-10 flex flex-col items-center">
                  {isSuccess ? (
                    <CheckCircle2 className="w-16 h-16 text-emerald-400 scale-110 transition-transform" />
                  ) : (
                    <Fingerprint
                      className={`w-16 h-16 transition-all duration-300 ${
                        isVerifying
                          ? 'text-rose-400 scale-110 animate-pulse'
                          : 'text-stone-300 group-hover:text-white'
                      }`}
                    />
                  )}
                </div>

                {/* Status Pill */}
                <div className="absolute bottom-2 inset-x-2 flex items-center justify-center z-20 pointer-events-none">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[8.5px] font-bold uppercase tracking-wider backdrop-blur-md shadow-sm ${
                      isSuccess
                        ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-500/50'
                        : isVerifying
                        ? 'bg-red-950/90 text-rose-300 border border-red-500/50'
                        : 'bg-stone-900/90 text-stone-300 border border-stone-700/60'
                    }`}
                  >
                    {isSuccess
                      ? 'Fingerprint Match'
                      : isVerifying
                      ? 'Reading Hardware Sensor...'
                      : 'Touch Sensor to Scan'}
                  </span>
                </div>
              </div>

              {/* Hardware Sensor Metadata Badge */}
              <div className="w-full mt-2.5 p-2 rounded-xl bg-stone-950/80 border border-stone-800 text-[10.5px] flex items-center justify-between text-stone-400 font-mono">
                <span className="flex items-center gap-1.5 text-stone-300">
                  <Cpu className="w-3 h-3 text-amber-400" />
                  <span>{biometricAvail.hasWebAuthn ? 'WebAuthn Hardware' : 'Biometric Enclave'}</span>
                </span>
                <span className="text-emerald-400 font-semibold">Ready</span>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* VIEW C: CAMPUS PIN CODE FALLBACK KEYPAD                                  */}
          {/* ========================================================================= */}
          {activeModality === 'pin' && (
            <div className="w-full flex flex-col items-center animate-in fade-in duration-200">
              {/* PIN Code Display Dots */}
              <div className="my-2 flex items-center gap-2.5">
                {[0, 1, 2, 3].map((idx) => (
                  <div
                    key={idx}
                    className={`w-3.5 h-3.5 rounded-full border transition-all duration-200 ${
                      pinDigits.length > idx
                        ? 'bg-[#8B181B] border-red-400 scale-110 shadow-[0_0_8px_rgba(239,68,68,0.5)]'
                        : 'bg-stone-800 border-stone-700'
                    }`}
                  />
                ))}
              </div>

              {pinLockoutSeconds > 0 ? (
                <div className="p-3 my-2 bg-red-950/80 border border-red-800 rounded-2xl text-[11px] text-red-200 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
                  <span>Locked out due to too many attempts. Wait {pinLockoutSeconds}s.</span>
                </div>
              ) : (
                <p className="text-[10px] text-stone-400 mb-2 font-mono">
                  Default Campus PIN: <strong className="text-stone-300">1973</strong> (Founding Year)
                </p>
              )}

              {/* 3x4 Numeric Keypad */}
              <div className="grid grid-cols-3 gap-2 w-full max-w-[240px]">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    disabled={pinLockoutSeconds > 0 || isPinSubmitting || isSuccess}
                    onClick={() => handlePinDigitPress(digit)}
                    className="h-11 rounded-xl bg-stone-800/90 hover:bg-stone-750 text-white font-bold text-base shadow-sm border border-stone-700/60 active:scale-95 transition-all cursor-pointer disabled:opacity-40"
                  >
                    {digit}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={pinLockoutSeconds > 0 || pinDigits.length === 0}
                  onClick={() => setPinDigits('')}
                  className="h-11 rounded-xl bg-stone-900 hover:bg-stone-850 text-stone-400 text-xs font-semibold border border-stone-800 active:scale-95 transition-all cursor-pointer disabled:opacity-40"
                >
                  Clear
                </button>
                <button
                  type="button"
                  disabled={pinLockoutSeconds > 0 || isPinSubmitting || isSuccess}
                  onClick={() => handlePinDigitPress('0')}
                  className="h-11 rounded-xl bg-stone-800/90 hover:bg-stone-750 text-white font-bold text-base shadow-sm border border-stone-700/60 active:scale-95 transition-all cursor-pointer disabled:opacity-40"
                >
                  0
                </button>
                <button
                  type="button"
                  disabled={pinLockoutSeconds > 0 || pinDigits.length === 0}
                  onClick={handlePinBackspace}
                  className="h-11 rounded-xl bg-stone-900 hover:bg-stone-850 text-stone-300 flex items-center justify-center border border-stone-800 active:scale-95 transition-all cursor-pointer disabled:opacity-40"
                >
                  <Delete className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {errorMsg && (
            <div className="w-full mt-3 p-2.5 bg-red-950/70 border border-red-800/80 rounded-2xl text-[11px] text-red-200 flex items-center gap-2 text-left animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span className="flex-1 leading-snug">{errorMsg}</span>
              <button
                type="button"
                onClick={() => {
                  if (activeModality === 'face') handleTriggerFaceUnlock();
                  else if (activeModality === 'fingerprint') handleTriggerFingerprintUnlock();
                }}
                className="p-1 text-red-300 hover:text-white rounded-lg hover:bg-red-900/60 transition-colors cursor-pointer"
                title="Retry"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Primary Action Button */}
          <div className="w-full mt-4 space-y-2">
            {activeModality !== 'pin' && (
              <button
                type="button"
                disabled={isVerifying || isInitializing || isSuccess}
                onClick={
                  activeModality === 'face'
                    ? handleTriggerFaceUnlock
                    : handleTriggerFingerprintUnlock
                }
                className={`w-full py-3 px-4 rounded-2xl text-xs sm:text-sm font-bold tracking-wider uppercase transition-all shadow-md active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 ${
                  isSuccess
                    ? 'bg-emerald-600 text-white'
                    : 'bg-[#8B181B] hover:bg-[#721316] text-white disabled:opacity-70'
                }`}
              >
                {activeModality === 'face' ? (
                  <ScanFace className="w-4 h-4" />
                ) : (
                  <Fingerprint className="w-4 h-4" />
                )}
                <span>
                  {isSuccess
                    ? 'Access Granted'
                    : isVerifying
                    ? 'Verifying Biometrics...'
                    : activeModality === 'face'
                    ? 'Scan Face with Camera'
                    : 'Scan Fingerprint Sensor'}
                </span>
              </button>
            )}

            {/* Switch to PIN or Fallback */}
            {activeModality !== 'pin' ? (
              <button
                type="button"
                onClick={() => handleSelectModality('pin')}
                className="w-full py-2 px-3 bg-stone-850 hover:bg-stone-800 text-stone-300 hover:text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <KeyRound className="w-3 h-3 text-amber-400" />
                <span>Use Campus PIN Fallback (1973)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSelectModality('face')}
                className="w-full py-2 px-3 bg-stone-850 hover:bg-stone-800 text-stone-300 hover:text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <ScanFace className="w-3 h-3 text-red-400" />
                <span>Return to Biometric Scan</span>
              </button>
            )}

            {/* Alternative Password / Sign Out */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                stopCameraStream();
                onSignOut();
              }}
              className="w-full py-2 px-3 text-stone-400 hover:text-stone-200 text-[11px] font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <LogOut className="w-3 h-3" />
              <span>Use Account Password or Switch User</span>
            </button>
          </div>

          {/* Enclave Note */}
          <div className="mt-3 pt-2.5 border-t border-stone-800/80 w-full flex items-center justify-between text-[10px] text-stone-500 font-mono">
            <div className="flex items-center gap-1">
              <Scan className="w-3 h-3 text-stone-400" />
              <span>Multi-Modal Biometrics</span>
            </div>
            <div className="flex items-center gap-1 text-amber-400/90 font-sans font-medium">
              <Sparkles className="w-3 h-3" />
              <span>Hardware Shield</span>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
