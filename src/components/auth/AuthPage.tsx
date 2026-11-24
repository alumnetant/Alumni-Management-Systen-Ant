import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft,
  ArrowLeft,
  Mail,
  Lock,
  Eye,
  EyeOff,
  GraduationCap,
  Briefcase,
  Building,
  Building2,
  Globe,
  MapPin,
  Phone,
  User,
  Shield,
  ShieldCheck,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  School,
  Clock,
  ShieldAlert,
  KeyRound,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  RefreshCw,
  HelpCircle,
  FileSpreadsheet,
  Moon,
  Sun,
  Scale,
  X,
  FileText,
  Send,
  ScanFace,
  Fingerprint,
  Camera,
  Upload,
  Trash2
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import {
  checkBiometricAvailability,
  authenticateWithBiometrics,
  enableBiometricLogin,
  vaultBiometricRefreshToken,
  retrieveVaultedRefreshToken,
  isBiometricLoginEnabled,
  getBiometricSavedUsername,
  canAutoPromptBiometrics,
  BiometricAvailability
} from '../../services/biometricAuthService';
import { useAlumni } from '../../context/AlumniContext';
import { useTheme } from '../../lib/theme';
import { useIsMobileOrTablet } from '../../lib/platform';
import { UserRole, UserProfile, StudentVerificationRecord, OFFICIAL_DEGREE_PROGRAMS, normalizeSystemRole } from '../../types';
import { getStoredFormLock, setStoredFormLock, clearStoredFormLock } from '../../lib/employerValidation';
import { ForgotPasswordModal } from './ForgotPasswordModal';
import { AccountSuspendedNoticeModal } from './AccountSuspendedNoticeModal';
import {
  verifyStudentRecord,
  findRegistryMatch,
  markRegistryRecordAsRegistered,
  getRegistrarRecords,
  isValidStudentIdPattern,
  validateStudentRegistrationStrict,
  generateAlumniId,
  lookupStudentBySchoolId,
  addRegistrationConflict,
  getRegistrationConflicts,
  normalizeStudentId,
  splitFullNameParts
} from '../../services/studentVerificationService';
import { saveConflictRecordToFirestore } from '../../lib/firebase';
import { compressImage } from '../../lib/utils';
import { getCentenaryBatchYears } from '../../services/longevityService';
import { getEmployerAuthStatus } from '../../lib/employerAuthStatus';
import { MobileSegmentedTabs } from '../mobile/MobilePrimitives';

interface AuthPageProps {
  initialMode?: 'login' | 'register' | 'forgot';
  initialRole?: 'alumni' | 'employer';
  onLoginSuccess?: (role: string) => void;
  onBackToApp?: () => void;
}

// Local storage keys for persistent login rate-limiting / lockout timer
const LOCKOUT_STORAGE_KEYS = {
  UNTIL: 'sc_alumni_login_lockout_until',
  ATTEMPTS: 'sc_alumni_login_failed_attempts',
  CYCLE: 'sc_alumni_login_lockout_cycle'
};

// Lockout duration math:
// First 1-3 attempts = 1 min (60s)
// Subsequent 1-3 attempts = +2 mins each trial (Trial 2 = 3m, Trial 3 = 5m, etc.)
const getLockoutDurationSeconds = (cycle: number): number => {
  return (1 + Math.max(0, cycle - 1) * 2) * 60;
};

const formatSecondsToMMSS = (totalSeconds: number): string => {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const AuthPage: React.FC<AuthPageProps> = ({
  initialMode = 'login',
  initialRole = 'alumni',
  onLoginSuccess,
  onBackToApp
}) => {
  const {
    login,
    biometricLoginWithRefreshToken,
    register,
    users,
    updateAlumniProfile,
    resetUserPasswordByEmail,
    addAuditLog,
    showToast,
    activeSessionConflict,
    clearActiveSessionConflict,
    terminateOtherSessionAndLogin,
    loginPlatformError,
    clearLoginPlatformError,
    loginPendingAccountNotice,
    clearLoginPendingAccountNotice,
    loginSuspensionNotice,
    clearLoginSuspensionNotice,
    moderatorQuota,
    clientPlatform
  } = useAlumni();

  const { isDark, toggleTheme } = useTheme();

  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(initialMode);
  const [loginMethod, setLoginMethod] = useState<'email' | 'studentId'>('email');
  const [isSubmittingEndSession, setIsSubmittingEndSession] = useState(false);

  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [staySignedIn, setStaySignedIn] = useState(true);
  const [loginError, setLoginError] = useState('');

  // Post-Login Biometric Opt-In Interactive Modal State
  const [showBiometricOptInModal, setShowBiometricOptInModal] = useState(false);
  const [pendingOptInUser, setPendingOptInUser] = useState<{
    uid: string;
    email: string;
    role: string;
    refreshToken: string;
  } | null>(null);

  // Pending Account Approval Notification (Explicit 24 to 48 business hours)
  const [pendingApprovalNotice, setPendingApprovalNotice] = useState<{
    show: boolean;
    role: 'alumni' | 'employer';
    email: string;
    message: string;
  } | null>(null);

  // Synchronize platform-specific access restriction notifications immediately
  useEffect(() => {
    if (loginPlatformError) {
      setLoginError(loginPlatformError);
    }
  }, [loginPlatformError]);

  // Synchronize pending account notices immediately and suppress lockout
  useEffect(() => {
    if (loginPendingAccountNotice) {
      setPendingApprovalNotice({
        show: true,
        role: loginPendingAccountNotice.role,
        email: loginPendingAccountNotice.email,
        message: loginPendingAccountNotice.message
      });
      setLoginError('');
    }
  }, [loginPendingAccountNotice]);

  // Biometric Authentication State (Android Keystore / BiometricPrompt)
  const [biometricAvail, setBiometricAvail] = useState<BiometricAvailability>({
    isAvailable: false,
    biometryType: 'none',
    label: 'Biometrics',
    hasFace: false,
    hasFingerprint: false,
    hasWebAuthn: false,
    hasCapacitor: false,
    isNative: false
  });
  const [isBiometricLoading, setIsBiometricLoading] = useState(false);
  const hasAutoPromptedRef = useRef(false);

  // Initial Biometric Availability Check
  useEffect(() => {
    checkBiometricAvailability().then((avail) => {
      setBiometricAvail(avail);
    });
  }, []);

  // Automatic Native BiometricPrompt on Android App Launch
  useEffect(() => {
    if (hasAutoPromptedRef.current) return;
    if (mode !== 'login') return;

    const attemptNativeBiometricAutoLaunch = async () => {
      // Only execute on native Capacitor wrapper (Android APK / iOS)
      if (!Capacitor.isNativePlatform()) return;

      const avail = await checkBiometricAvailability();
      setBiometricAvail(avail);

      if (!avail.isAvailable) return;

      // Check if user has opted in and has vaulted credentials
      const savedUser = getBiometricSavedUsername();
      const isEnabled = isBiometricLoginEnabled();
      if (!isEnabled || !savedUser) return;

      hasAutoPromptedRef.current = true;

      // Wait 350ms to ensure the native activity and login view have stabilized
      setTimeout(async () => {
        setIsBiometricLoading(true);
        try {
          const res = await retrieveVaultedRefreshToken({
            promptReason: 'Touch fingerprint sensor or scan face to unlock Cecilian Alumnet',
            title: 'Cecilian Biometric Unlock',
            subtitle: `Alumnus: ${savedUser}`,
            description: 'Verify your biometric identity to access your alumni workspace.',
            negativeButtonText: 'Sign in with Password'
          });

          if (res.success && res.refreshToken) {
            const refreshRes = await biometricLoginWithRefreshToken(res.refreshToken);
            if (refreshRes.success) {
              if (onLoginSuccess) {
                onLoginSuccess('alumni');
              } else if (onBackToApp) {
                onBackToApp();
              }
            } else {
              setLoginIdentifier(savedUser);
              showToast(refreshRes.error || 'Biometric session expired. Please sign in with password.', 'info');
            }
          } else if (res.cancelled) {
            setLoginIdentifier(savedUser);
            showToast('Biometric unlock cancelled. Please sign in with your password.', 'info');
          } else if (res.error) {
            setLoginIdentifier(savedUser);
            showToast(res.error, 'error');
          }
        } catch (err: any) {
          console.warn('Auto biometric prompt error:', err);
        } finally {
          setIsBiometricLoading(false);
        }
      }, 350);
    };

    attemptNativeBiometricAutoLaunch();
  }, [mode, biometricLoginWithRefreshToken, onLoginSuccess, onBackToApp, showToast]);

  const handleBiometricSignIn = async (modality: 'face' | 'fingerprint' = 'fingerprint') => {
    setIsBiometricLoading(true);
    try {
      const isNative = Capacitor.isNativePlatform();

      if (isNative) {
        // Native Android BiometricPrompt flow
        const isFace = modality === 'face';
        const res = await retrieveVaultedRefreshToken({
          promptReason: isFace
            ? 'Scan your face to sign in to Cecilian Alumnet'
            : 'Touch fingerprint sensor to sign in to Cecilian Alumnet',
          title: isFace ? 'Cecilian Face Unlock' : 'Cecilian Touch ID & Fingerprint',
          subtitle: 'St. Cecilia\'s College Alumni Network',
          description: 'Authenticate using device biometrics to access your account.',
          negativeButtonText: 'Sign in with Password'
        });

        if (res.success && res.refreshToken) {
          const loginRes = await biometricLoginWithRefreshToken(res.refreshToken);
          if (loginRes.success) {
            showToast('Biometric authentication verified!', 'success');
            if (onLoginSuccess) {
              onLoginSuccess('alumni');
            } else if (onBackToApp) {
              onBackToApp();
            }
          } else {
            showToast(loginRes.error || 'Session could not be renewed. Please enter your password.', 'info');
            if (res.email) setLoginIdentifier(res.email);
          }
        } else if (res.cancelled) {
          showToast('Biometric sign-in cancelled. Please use password.', 'info');
        } else {
          showToast(res.error || 'Biometric authentication failed.', 'error');
        }
      } else {
        // Clean Web/Desktop fallback
        const res = await authenticateWithBiometrics();
        if (res.success && res.credentials) {
          const emailOrUser = res.credentials.email;
          const storedRefresh = res.credentials.refreshToken;

          if (storedRefresh) {
            const loginRes = await biometricLoginWithRefreshToken(storedRefresh);
            if (loginRes.success) {
              showToast('Biometric authentication verified!', 'success');
              if (onLoginSuccess) onLoginSuccess('alumni');
              else if (onBackToApp) onBackToApp();
              return;
            }
          }

          const matched = users.find(
            (u) =>
              u.email?.toLowerCase() === emailOrUser.toLowerCase() ||
              u.studentId?.toLowerCase() === emailOrUser.toLowerCase()
          );
          if (matched && matched.password) {
            const ok = await login(matched.email, matched.password);
            if (ok) {
              showToast('Biometric authentication verified!', 'success');
              if (onLoginSuccess) onLoginSuccess('alumni');
              else if (onBackToApp) onBackToApp();
              return;
            }
          }

          setLoginIdentifier(emailOrUser);
          showToast('Biometric verified! Please enter your password to sign in.', 'info');
        } else if (res.error) {
          showToast(res.error, 'error');
        }
      }
    } catch (err: any) {
      showToast(err?.message || 'Biometric authentication failed.', 'error');
    } finally {
      setIsBiometricLoading(false);
    }
  };

  // Forgot Password modal state
  const [showForgotModal, setShowForgotModal] = useState(initialMode === 'forgot');
  const [forgotEmail, setForgotEmail] = useState('');

  const handleOpenForgotPassword = () => {
    if (loginIdentifier && loginIdentifier.includes('@')) {
      setForgotEmail(loginIdentifier.trim());
    }
    setShowForgotModal(true);
  };

  const handlePasswordResetSuccess = (email: string, newPassword?: string) => {
    // Clear any lockout constraints upon identity verification & password reset
    try {
      localStorage.removeItem(LOCKOUT_STORAGE_KEYS.UNTIL);
      localStorage.removeItem(LOCKOUT_STORAGE_KEYS.ATTEMPTS);
      localStorage.removeItem(LOCKOUT_STORAGE_KEYS.CYCLE);
    } catch {
      // ignore
    }
    setFailedAttempts(0);
    setLockoutCycle(1);
    setLockoutSecondsRemaining(0);
    setLoginError('');

    // Prepopulate sign-in form with newly reset credentials
    setLoginMethod('email');
    setLoginIdentifier(email);
    if (newPassword) {
      setLoginPassword(newPassword);
    }
    setShowForgotModal(false);
  };

  // Failed login rate-limiting / lockout timer state
  const [failedAttempts, setFailedAttempts] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(LOCKOUT_STORAGE_KEYS.ATTEMPTS);
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });

  const [lockoutCycle, setLockoutCycle] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(LOCKOUT_STORAGE_KEYS.CYCLE);
      return saved ? Math.max(1, parseInt(saved, 10)) : 1;
    } catch {
      return 1;
    }
  });

  const [lockoutSecondsRemaining, setLockoutSecondsRemaining] = useState<number>(() => {
    try {
      const savedUntil = localStorage.getItem(LOCKOUT_STORAGE_KEYS.UNTIL);
      if (!savedUntil) return 0;
      const untilMs = parseInt(savedUntil, 10);
      const diff = Math.ceil((untilMs - Date.now()) / 1000);
      return diff > 0 ? diff : 0;
    } catch {
      return 0;
    }
  });

  // Countdown timer effect for login lockout
  useEffect(() => {
    if (lockoutSecondsRemaining <= 0) return;

    const timer = setInterval(() => {
      setLockoutSecondsRemaining((prev) => {
        if (prev <= 1) {
          try {
            localStorage.removeItem(LOCKOUT_STORAGE_KEYS.UNTIL);
          } catch {
            // ignore
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [lockoutSecondsRemaining]);

  const isLockedOut = lockoutSecondsRemaining > 0;

  const isMobileViewport = useIsMobileOrTablet();
  const isMobileClient = clientPlatform === 'mobile' || isMobileViewport;

  // Registration multi-step state (1: Initial Student ID Screening, 2: Account & Profile, 3: Review & Honor Pledge)
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [registrationType, setRegistrationType] = useState<'alumni' | 'employer'>(() => {
    if (isMobileClient) {
      return 'alumni';
    }
    return initialRole || 'alumni';
  });

  useEffect(() => {
    if (isMobileClient) {
      setRegistrationType('alumni');
      setEmployerStep(1);
    } else if (initialRole) {
      setRegistrationType(initialRole);
    }
  }, [initialRole, isMobileClient]);

  // Employer Registration State
  const [companyName, setCompanyName] = useState('');
  const [companyIndustry, setCompanyIndustry] = useState('Information Technology & Software');
  const [companyWebsite, setCompanyWebsite] = useState('');
  const [companyAddress, setCompanyAddress] = useState('Cebu City, Philippines');
  const [employerContactPerson, setEmployerContactPerson] = useState('');
  const [employerEmail, setEmployerEmail] = useState('');
  const [employerPhone, setEmployerPhone] = useState('');
  const [employerPassword, setEmployerPassword] = useState('');
  const [employerConfirmPassword, setEmployerConfirmPassword] = useState('');
  const [showEmployerPassword, setShowEmployerPassword] = useState(false);
  const [showEmployerConfirmPassword, setShowEmployerConfirmPassword] = useState(false);
  const [employerError, setEmployerError] = useState('');
  const [isSubmittingEmployer, setIsSubmittingEmployer] = useState(false);
  const [employerStep, setEmployerStep] = useState<1 | 2>(1);

  // Step 1: Initial Student ID Screening
  const [studentId, setStudentId] = useState('');
  const [screeningError, setScreeningError] = useState('');
  const [studentVerificationStatus, setStudentVerificationStatus] = useState<
    'idle' | 'checking' | 'verified' | 'failed'
  >('idle');
  const [verificationMessage, setVerificationMessage] = useState('');
  const [verifiedRecord, setVerifiedRecord] = useState<StudentVerificationRecord | null>(null);
  const [isRegistryMatched, setIsRegistryMatched] = useState(false);

  // Step 2: Account Details & Profile Credentials
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [batch, setBatch] = useState('2024');
  const [course, setCourse] = useState('B.S. Information Technology');
  const [location, setLocation] = useState('Cebu, Philippines');
  const [headline, setHeadline] = useState('');
  const [phone, setPhone] = useState('');
  const [regAccountType, setRegAccountType] = useState<'alumni'>('alumni');
  const [regPosition, setRegPosition] = useState('');
  const [regCompany, setRegCompany] = useState('');
  const [regEmploymentStatus, setRegEmploymentStatus] = useState<string>('Employed');
  const [step2Error, setStep2Error] = useState('');
  const [step3Error, setStep3Error] = useState('');

  // ID Conflict / Dispute Claim state (when ID is taken/already registered)
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeStudentId, setDisputeStudentId] = useState('');
  const [disputeFullName, setDisputeFullName] = useState('');
  const [disputeEmail, setDisputeEmail] = useState('');
  const [disputeBatch, setDisputeBatch] = useState('2024');
  const [disputeCourse, setDisputeCourse] = useState('B.S. Information Technology');
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeReferenceId, setDisputeReferenceId] = useState<string | null>(null);
  const [disputeSelfieDataUrl, setDisputeSelfieDataUrl] = useState<string | null>(null);
  const [disputeSelfieFileName, setDisputeSelfieFileName] = useState('');
  const [disputeSelfieError, setDisputeSelfieError] = useState<string | null>(null);
  const [isProcessingDisputeSelfie, setIsProcessingDisputeSelfie] = useState(false);
  const [isSubmittingDispute, setIsSubmittingDispute] = useState(false);
  const disputeSelfieInputRef = useRef<HTMLInputElement | null>(null);

  // Manual Verification Request state (when alumnus has no ID or ID unlisted in registrar masterlist)
  const [showManualVerificationModal, setShowManualVerificationModal] = useState(false);
  const [manualFullName, setManualFullName] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualBatch, setManualBatch] = useState('2024');
  const [manualCourse, setManualCourse] = useState('B.S. Information Technology');
  const [manualNotes, setManualNotes] = useState('');
  const [manualPassword, setManualPassword] = useState('');
  const [showManualPassword, setShowManualPassword] = useState(false);
  const [manualReferenceId, setManualReferenceId] = useState<string | null>(null);
  const [isSubmittingAppeal, setIsSubmittingAppeal] = useState(false);
  const [manualSelfieDataUrl, setManualSelfieDataUrl] = useState<string | null>(null);
  const [manualSelfieFileName, setManualSelfieFileName] = useState('');
  const [manualSelfieError, setManualSelfieError] = useState<string | null>(null);
  const [isProcessingManualSelfie, setIsProcessingManualSelfie] = useState(false);
  const manualSelfieInputRef = useRef<HTMLInputElement | null>(null);

  // 100-Year Centenary batches (from 1968 to 50 years into the future)
  const centenaryBatches = React.useMemo(() => getCentenaryBatchYears(1968, 50), []);

  // Degree Program options from official registry & accredited offerings
  const allDegreeOptions = React.useMemo(() => {
    const list: string[] = [...OFFICIAL_DEGREE_PROGRAMS];
    const records = getRegistrarRecords();
    records.forEach((r) => {
      if (r.course && !list.includes(r.course)) {
        list.push(r.course);
      }
    });
    return list;
  }, []);

  // Compute preview Alumni ID (Distinct from Student ID)
  const previewAlumniId = React.useMemo(() => {
    return generateAlumniId(batch, studentId);
  }, [batch, studentId]);

  // Open Dispute Modal helper
  const handleOpenDispute = (idToDispute?: string) => {
    setDisputeStudentId(idToDispute || studentId || '');
    setDisputeFullName(firstName && lastName ? `${firstName} ${lastName}` : firstName || '');
    setDisputeEmail(regEmail || '');
    setDisputeReferenceId(null);
    setShowDisputeModal(true);
  };

  // Open Manual Verification Modal helper
  const handleOpenManualVerification = () => {
    setManualFullName(firstName && lastName ? `${firstName} ${lastName}` : firstName || '');
    setManualEmail(regEmail || '');
    setManualPhone(phone || '');
    setManualReferenceId(null);
    setShowManualVerificationModal(true);
  };

  // -------------------------------------------------------------
  // REGISTRATION FORM LOCKING (SessionStorage-persisted across page refresh)
  // When user starts filling either form, opposite role tab switch is disabled.
  // Cleared ONLY by explicit Reset/Cancel buttons or successful submission.
  // -------------------------------------------------------------
  const [formLock, setFormLock] = useState<'alumni' | 'employer' | null>(() => getStoredFormLock());
  const [switchRoleConfirmTarget, setSwitchRoleConfirmTarget] = useState<'alumni' | 'employer' | null>(null);

  // Restore stored session lock on mount (ignore employer lock on mobile/tablet)
  useEffect(() => {
    const storedLock = getStoredFormLock();
    if (storedLock) {
      if (isMobileClient && storedLock === 'employer') {
        clearStoredFormLock();
        setFormLock(null);
        setRegistrationType('alumni');
      } else {
        setFormLock(storedLock);
        setRegistrationType(storedLock);
      }
    }
  }, [isMobileClient]);

  // Detect "Started filling" on any registration form field
  useEffect(() => {
    if (mode !== 'register') return;

    const alumniStarted = Boolean(
      studentId.trim() ||
      firstName.trim() ||
      lastName.trim() ||
      regEmail.trim() ||
      regPassword.trim() ||
      confirmPassword.trim() ||
      headline.trim() ||
      phone.trim() ||
      regPosition.trim() ||
      regCompany.trim() ||
      step > 1 ||
      studentVerificationStatus !== 'idle'
    );

    const employerStarted = Boolean(
      companyName.trim() ||
      companyWebsite.trim() ||
      employerContactPerson.trim() ||
      employerEmail.trim() ||
      employerPhone.trim() ||
      employerPassword.trim() ||
      employerConfirmPassword.trim() ||
      employerStep > 1
    );

    if (registrationType === 'alumni' && alumniStarted) {
      if (formLock !== 'alumni') {
        setFormLock('alumni');
        setStoredFormLock('alumni');
      }
    } else if (registrationType === 'employer' && employerStarted) {
      if (formLock !== 'employer') {
        setFormLock('employer');
        setStoredFormLock('employer');
      }
    }
  }, [
    mode,
    registrationType,
    studentId,
    firstName,
    lastName,
    regEmail,
    regPassword,
    confirmPassword,
    headline,
    phone,
    regPosition,
    regCompany,
    step,
    studentVerificationStatus,
    companyName,
    companyWebsite,
    employerContactPerson,
    employerEmail,
    employerPhone,
    employerPassword,
    employerConfirmPassword,
    employerStep,
    formLock
  ]);

  const handleResetAlumniForm = () => {
    setStudentId('');
    setScreeningError('');
    setStudentVerificationStatus('idle');
    setVerificationMessage('');
    setVerifiedRecord(null);
    setIsRegistryMatched(false);
    setFirstName('');
    setLastName('');
    setRegEmail('');
    setRegPassword('');
    setConfirmPassword('');
    setHeadline('');
    setPhone('');
    setRegPosition('');
    setRegCompany('');
    setStep2Error('');
    setStep(1);
    clearStoredFormLock();
    setFormLock(null);
    showToast('Alumni registration form cleared.', 'info');
  };

  const handleCancelAlumniForm = () => {
    handleResetAlumniForm();
    setMode('login');
  };

  const handleResetEmployerForm = () => {
    setCompanyName('');
    setCompanyWebsite('');
    setCompanyAddress('Cebu City, Philippines');
    setEmployerContactPerson('');
    setEmployerEmail('');
    setEmployerPhone('');
    setEmployerPassword('');
    setEmployerConfirmPassword('');
    setEmployerError('');
    setEmployerStep(1);
    clearStoredFormLock();
    setFormLock(null);
    showToast('Employer registration form cleared.', 'info');
  };

  const handleCancelEmployerForm = () => {
    handleResetEmployerForm();
    setMode('login');
  };

  const handleRoleTabClick = (targetRole: 'alumni' | 'employer') => {
    if (targetRole === registrationType) return;
    if (formLock && formLock === registrationType) {
      setSwitchRoleConfirmTarget(targetRole);
    } else {
      setRegistrationType(targetRole);
      if (targetRole === 'alumni') {
        setEmployerError('');
      } else {
        setScreeningError('');
      }
    }
  };

  const handleConfirmRoleSwitch = () => {
    if (!switchRoleConfirmTarget) return;
    const target = switchRoleConfirmTarget;
    if (registrationType === 'alumni') {
      handleResetAlumniForm();
    } else {
      handleResetEmployerForm();
    }
    setRegistrationType(target);
    if (target === 'alumni') {
      setEmployerError('');
    } else {
      setScreeningError('');
    }
    setSwitchRoleConfirmTarget(null);
  };

  // Selfie with ID validation & upload handler exclusively for Dispute Student ID Claim (JPG, JPEG, PNG, WEBP, max 5 MB)
  const handleDisputeSelfieFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const hasAllowedExt = /\.(jpe?g|png|webp)$/i.test(file.name || '');
    const normalizedType = (file.type || '').toLowerCase();

    if (!allowedMimeTypes.includes(normalizedType) || !hasAllowedExt) {
      const msg = 'Unsupported file format. Please upload a JPG, JPEG, PNG, or WEBP image.';
      setDisputeSelfieError(msg);
      showToast(msg, 'error');
      e.target.value = '';
      return;
    }

    const maxBytes = 5 * 1024 * 1024; // 5 MB
    if (file.size === 0 || file.size > maxBytes) {
      const msg = 'Image file size exceeds the 5 MB limit. Please upload a photo up to 5 MB.';
      setDisputeSelfieError(msg);
      showToast(msg, 'error');
      e.target.value = '';
      return;
    }

    setDisputeSelfieError(null);
    setIsProcessingDisputeSelfie(true);
    try {
      const compressed = await compressImage(file, 1200, 1200, 0.84);
      const dataUrlMatch = /^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/i.exec(compressed);
      if (!dataUrlMatch) {
        throw new Error('Invalid image format after processing.');
      }
      const approxBytes = Math.ceil((dataUrlMatch[2].length * 3) / 4);
      if (approxBytes > maxBytes) {
        const msg = 'Processed image still exceeds the 5 MB limit. Please choose a smaller photo.';
        setDisputeSelfieError(msg);
        showToast(msg, 'error');
        return;
      }
      setDisputeSelfieDataUrl(compressed);
      setDisputeSelfieFileName(file.name);
      setDisputeSelfieError(null);
    } catch {
      const msg = 'Unable to read the selected image. Please upload a valid JPG, JPEG, PNG, or WEBP photo.';
      setDisputeSelfieError(msg);
      showToast(msg, 'error');
    } finally {
      setIsProcessingDisputeSelfie(false);
      e.target.value = '';
    }
  };

  const handleRemoveDisputeSelfie = () => {
    setDisputeSelfieDataUrl(null);
    setDisputeSelfieFileName('');
    setDisputeSelfieError(null);
    if (disputeSelfieInputRef.current) {
      disputeSelfieInputRef.current.value = '';
    }
  };

  // Submit ID Ownership Dispute & Conflict
  const handleDisputeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingDispute || isProcessingDisputeSelfie) return;

    if (!disputeFullName.trim() || !disputeEmail.trim() || !disputeReason.trim()) {
      showToast('Please fill out all required fields.', 'error');
      return;
    }

    const cleanEmail = disputeEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      showToast('Please enter a valid contact email address.', 'error');
      return;
    }

    const targetStudentId = (disputeStudentId.trim() || studentId.trim()).toUpperCase();
    if (!targetStudentId) {
      showToast('Contested Student ID number is required.', 'error');
      return;
    }

    if (!disputeSelfieDataUrl) {
      const msg = 'Please upload your Selfie with ID before submitting this Student ID dispute.';
      setDisputeSelfieError(msg);
      showToast(msg, 'error');
      return;
    }

    // Prevent duplicate pending disputes for the same claimant + Student ID
    const normTargetId = normalizeStudentId(targetStudentId).toUpperCase();
    const existingPendingDispute = getRegistrationConflicts().find(
      (c) =>
        c.status === 'pending' &&
        (c.requestType === 'claimed_id_dispute' || c.conflictType === 'claimed_id_dispute') &&
        c.applicantEmail?.trim().toLowerCase() === cleanEmail &&
        normalizeStudentId(c.targetRegistryStudentId || c.applicantStudentId || '').toUpperCase() === normTargetId
    );
    if (existingPendingDispute) {
      const msg = `A pending Student ID dispute for ${targetStudentId} under this email already exists (Ref #${existingPendingDispute.id}).`;
      setDisputeSelfieError(msg);
      showToast(msg, 'error');
      return;
    }

    setIsSubmittingDispute(true);
    setDisputeSelfieError(null);
    try {
      const nowIso = new Date().toISOString();
      const existingByEmail = users.find((u) => u.email?.trim().toLowerCase() === cleanEmail);
      const targetUid = existingByEmail?.uid || `user_${Date.now()}`;
      const claimantProvisionalId = existingByEmail?.studentId || `SCC-DISPUTE-${Date.now().toString().slice(-4)}`;
      const conflictId = `conflict_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const selfieFileName = disputeSelfieFileName || `dispute_selfie_${Date.now()}.jpg`;
      const trimmedExplanation = disputeReason.trim();
      const claimantPhone = (phone || existingByEmail?.phone || '').trim() || undefined;

      // Identify the original registered account owner currently associated with the contested Student ID
      const originalOwner = users.find(
        (u) =>
          !u.isDeleted &&
          u.studentId &&
          normalizeStudentId(u.studentId).toUpperCase() === normTargetId &&
          u.uid !== targetUid &&
          u.email?.trim().toLowerCase() !== cleanEmail
      );

      // 1. Upload & validate Selfie with ID on backend storage FIRST so failed uploads never create incomplete requests
      const uploadRes = await fetch('/api/alumni/verification-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: targetUid,
          conflictId,
          submissionSource: 'dispute_student_id_claim',
          requestType: 'claimed_id_dispute',
          name: disputeFullName.trim(),
          email: cleanEmail,
          phone: claimantPhone,
          studentId: targetStudentId,
          batch: disputeBatch.trim(),
          course: disputeCourse.trim(),
          originalOwnerUid: originalOwner?.uid,
          originalOwnerName: originalOwner?.name,
          originalOwnerEmail: originalOwner?.email,
          originalOwnerStudentId: originalOwner?.studentId || targetStudentId,
          originalOwnerCourse: originalOwner?.course,
          originalOwnerBatch: originalOwner?.batch,
          selfieWithIdName: selfieFileName,
          selfieWithIdUrl: disputeSelfieDataUrl,
          notes: trimmedExplanation
        })
      });

      const uploadPayload = await uploadRes.json().catch(() => null);
      if (!uploadRes.ok || !uploadPayload?.success || !uploadPayload?.request?.id) {
        const errMsg =
          uploadPayload?.error ||
          'Failed to upload your Selfie with ID photo. Please try again with a valid JPG, JPEG, PNG, or WEBP image (max 5 MB).';
        setDisputeSelfieError(errMsg);
        showToast(errMsg, 'error');
        return;
      }

      const savedServerRequest = uploadPayload.request;

      // 2. Provision provisional account if email is not yet registered, or link uploaded Selfie with ID metadata
      if (!existingByEmail) {
        register({
          uid: targetUid,
          name: disputeFullName.trim(),
          email: cleanEmail,
          password: 'TemporaryPassword123!',
          role: 'alumni',
          batch: disputeBatch.trim(),
          course: disputeCourse.trim(),
          phone: claimantPhone || '09123456789',
          contactNumber: claimantPhone || '09123456789',
          location: 'Cebu, Philippines',
          headline: `Claimant for Contested ID ${targetStudentId} • Class of ${disputeBatch.trim()}`,
          studentId: claimantProvisionalId,
          isVerified: false,
          accountStatus: 'PENDING_VERIFICATION',
          verificationStatus: 'in_review',
          verificationSubmissionSource: 'dispute_student_id_claim',
          selfieWithIdUrl: disputeSelfieDataUrl,
          selfieWithIdName: selfieFileName,
          selfieWithIdUploadedAt: savedServerRequest.selfieUploadedAt || nowIso,
          verificationRequestId: savedServerRequest.id,
          isAppealRegistration: true
        } as any);
      } else {
        updateAlumniProfile(existingByEmail.uid, {
          verificationSubmissionSource: 'dispute_student_id_claim',
          selfieWithIdUrl: disputeSelfieDataUrl,
          selfieWithIdName: selfieFileName,
          selfieWithIdUploadedAt: savedServerRequest.selfieUploadedAt || nowIso,
          verificationRequestId: savedServerRequest.id
        }).catch(() => {});
      }

      // 3. Add dispute record classified exclusively as Dispute Student ID Claim (Alumni Claims) & persist to Firestore
      const conflict = addRegistrationConflict({
        id: conflictId,
        applicantUid: targetUid,
        applicantName: disputeFullName.trim(),
        applicantEmail: cleanEmail,
        applicantPhone: claimantPhone,
        applicantStudentId: targetStudentId,
        applicantBatch: disputeBatch.trim(),
        applicantCourse: disputeCourse.trim(),
        targetRegistryStudentId: targetStudentId,
        originalOwnerUid: originalOwner?.uid || savedServerRequest.originalOwnerUid,
        originalOwnerName: originalOwner?.name || savedServerRequest.originalOwnerName,
        originalOwnerEmail: originalOwner?.email || savedServerRequest.originalOwnerEmail,
        originalOwnerStudentId: originalOwner?.studentId || savedServerRequest.originalOwnerStudentId || targetStudentId,
        originalOwnerCourse: originalOwner?.course || savedServerRequest.originalOwnerCourse,
        originalOwnerBatch: originalOwner?.batch || savedServerRequest.originalOwnerBatch,
        submissionSource: 'dispute_student_id_claim',
        requestType: 'claimed_id_dispute',
        conflictType: 'claimed_id_dispute',
        severity: 'high',
        confidenceScore: 85,
        disputeExplanation: trimmedExplanation,
        selfieWithIdUrl: disputeSelfieDataUrl,
        selfieWithIdName: selfieFileName,
        selfieWithIdUploadedAt: savedServerRequest.selfieUploadedAt || nowIso,
        selfieStoragePath: savedServerRequest.selfieStoragePath,
        verificationRequestId: savedServerRequest.id,
        notes: `STUDENT ID CLAIM DISPUTE: Claimant ${disputeFullName.trim()} (${cleanEmail}) is contesting ownership of Student ID "${targetStudentId}". Course: ${disputeCourse.trim()}, Batch: Class of ${disputeBatch.trim()}. Statement: "${trimmedExplanation}". Selfie with ID uploaded for identity verification.`
      });

      await saveConflictRecordToFirestore(conflict);

      addAuditLog({
        action: 'REGISTRATION_CONFLICT_DISPUTE_FILED',
        actorId: targetUid,
        actorName: disputeFullName.trim(),
        actorRole: 'alumni',
        category: 'conflict_resolution',
        details: `Official ID dispute with Selfie with ID filed for Student ID "${targetStudentId}" by ${disputeFullName.trim()} (${cleanEmail}). Classified under Alumni Claims in Requests & Conflicts.`,
        severity: 'alert'
      });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('conflicts-updated', { detail: [conflict] }));
      }

      setDisputeReferenceId(conflict.id);
      handleRemoveDisputeSelfie();
      showToast(`Student ID dispute filed! Reference #${conflict.id}. Forwarded to Alumni Claims.`, 'success');
    } catch {
      const msg = 'Unable to upload your Selfie with ID photo right now. Please check your connection and try again.';
      setDisputeSelfieError(msg);
      showToast(msg, 'error');
    } finally {
      setIsSubmittingDispute(false);
    }
  };

  const handleManualSelfieFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      setManualSelfieError('Please upload a valid image file (JPG, PNG, or WebP).');
      showToast('Please upload a valid JPG, PNG, or WebP image for your Selfie with ID.', 'error');
      e.target.value = '';
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setManualSelfieError('Image file size must be 10MB or smaller.');
      showToast('Image is too large. Please upload a photo under 10MB.', 'error');
      e.target.value = '';
      return;
    }

    setManualSelfieError(null);
    setIsProcessingManualSelfie(true);
    try {
      const compressed = await compressImage(file, 1200, 1200, 0.84);
      setManualSelfieDataUrl(compressed);
      setManualSelfieFileName(file.name);
    } catch {
      setManualSelfieError('Unable to read the selected image. Please try another photo.');
      showToast('Failed to process the selected Selfie with ID image.', 'error');
    } finally {
      setIsProcessingManualSelfie(false);
      e.target.value = '';
    }
  };

  const handleRemoveManualSelfie = () => {
    setManualSelfieDataUrl(null);
    setManualSelfieFileName('');
    setManualSelfieError(null);
    if (manualSelfieInputRef.current) {
      manualSelfieInputRef.current.value = '';
    }
  };

  // Submit Manual Verification Request (when No ID or Unlisted Record)
  const handleManualVerificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualFullName.trim() || !manualEmail.trim() || !manualBatch.trim() || !manualCourse.trim() || !manualPassword.trim()) {
      showToast('Please complete all required fields including password.', 'error');
      return;
    }

    if (manualPassword.trim().length < 6) {
      showToast('Account password must be at least 6 characters.', 'error');
      return;
    }

    if (!manualSelfieDataUrl) {
      setManualSelfieError('Please upload your Selfie with ID before submitting this request.');
      showToast('Selfie with ID is required before submitting your manual verification request.', 'error');
      return;
    }

    const cleanEmail = manualEmail.trim().toLowerCase();
    const existingByEmail = users.find((u) => u.email?.trim().toLowerCase() === cleanEmail);
    if (existingByEmail && existingByEmail.isVerified) {
      showToast('An account with this email is already verified. Please sign in instead.', 'error');
      return;
    }

    setIsSubmittingAppeal(true);
    try {
      const nowIso = new Date().toISOString();
      const targetUid = existingByEmail?.uid || `user_${Date.now()}`;
      const provisionalStudentId = existingByEmail?.studentId || `SCC-PENDING-${Date.now().toString().slice(-4)}`;
      const trimmedNotes = manualNotes.trim();
      const selfieFileName = manualSelfieFileName || `selfie_with_id_${Date.now()}.jpg`;

      // 1. Create provisional account if not already present in users, or attach Selfie with ID to existing unverified profile
      if (!existingByEmail) {
        const registered = register({
          uid: targetUid,
          name: manualFullName.trim(),
          email: cleanEmail,
          password: manualPassword.trim(),
          role: 'alumni',
          batch: manualBatch.trim(),
          course: manualCourse.trim(),
          phone: manualPhone.trim() || '+63 917 123 4567',
          location: 'Cebu, Philippines',
          headline: `${manualCourse.trim()} Alumnus • Class of ${manualBatch.trim()}`,
          studentId: provisionalStudentId,
          isVerified: false,
          accountStatus: 'PENDING_VERIFICATION',
          verificationStatus: 'pending_review',
          verificationSubmissionSource: 'request_verification',
          selfieWithIdUrl: manualSelfieDataUrl,
          selfieWithIdName: selfieFileName,
          selfieWithIdUploadedAt: nowIso,
          verificationProofUrl: manualSelfieDataUrl,
          verificationProofName: selfieFileName,
          verificationSubmittedAt: nowIso,
          verificationNotes: trimmedNotes || undefined,
          isAppealRegistration: true
        } as any);

        if (!registered) {
          return;
        }
      } else {
        await updateAlumniProfile(existingByEmail.uid, {
          name: manualFullName.trim(),
          batch: manualBatch.trim(),
          course: manualCourse.trim(),
          phone: manualPhone.trim() || existingByEmail.phone,
          accountStatus: 'PENDING_VERIFICATION',
          verificationStatus: 'pending_review',
          verificationSubmissionSource: 'request_verification',
          selfieWithIdUrl: manualSelfieDataUrl,
          selfieWithIdName: selfieFileName,
          selfieWithIdUploadedAt: nowIso,
          verificationProofUrl: manualSelfieDataUrl,
          verificationProofName: selfieFileName,
          verificationSubmittedAt: nowIso,
          verificationNotes: trimmedNotes || undefined
        });
      }

      // 2. Register Request Verification / Manual Verification Appeal exclusively under Collisions & Appeals & persist to Firestore
      const conflict = addRegistrationConflict({
        applicantUid: targetUid,
        applicantName: manualFullName.trim(),
        applicantEmail: cleanEmail,
        applicantPhone: manualPhone.trim() || existingByEmail?.phone,
        applicantStudentId: provisionalStudentId,
        applicantBatch: manualBatch.trim(),
        applicantCourse: manualCourse.trim(),
        submissionSource: 'request_verification',
        requestType: 'manual_verification_request',
        conflictType: 'manual_verification_request',
        severity: 'medium',
        confidenceScore: 50,
        selfieWithIdUrl: manualSelfieDataUrl,
        selfieWithIdName: selfieFileName,
        selfieWithIdUploadedAt: nowIso,
        notes: `MANUAL REGISTRAR APPEAL (NO ID / UNLISTED): Alumnus requested manual identity confirmation. Degree: ${manualCourse.trim()}, Cohort: Class of ${manualBatch.trim()}, Phone: ${manualPhone.trim() || 'N/A'}. Details: "${trimmedNotes || 'No electronic student ID record on file. Academic archive verification requested.'}".`
      });

      await saveConflictRecordToFirestore(conflict);

      // 3. Persist the actual Selfie with ID image securely on the backend verification store
      try {
        const res = await fetch('/api/alumni/verification-request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: targetUid,
            conflictId: conflict.id,
            submissionSource: 'request_verification',
            requestType: 'manual_verification_request',
            name: manualFullName.trim(),
            email: cleanEmail,
            phone: manualPhone.trim() || existingByEmail?.phone,
            studentId: provisionalStudentId,
            batch: manualBatch.trim(),
            course: manualCourse.trim(),
            selfieWithIdName: selfieFileName,
            selfieWithIdUrl: manualSelfieDataUrl,
            notes: trimmedNotes || undefined
          })
        });
        if (res.ok) {
          const payload = await res.json().catch(() => null);
          if (payload?.request?.id) {
            updateAlumniProfile(targetUid, {
              verificationRequestId: payload.request.id
            }).catch(() => {});
          }
        }
      } catch (serverErr) {
        console.warn('Server verification request sync notice:', serverErr);
      }

      addAuditLog({
        action: 'MANUAL_VERIFICATION_REQUEST_SUBMITTED',
        actorId: targetUid,
        actorName: manualFullName.trim(),
        actorRole: 'alumni',
        category: 'alumni_registration',
        details: `Manual verification appeal with Selfie with ID submitted for ${manualFullName.trim()} (${cleanEmail}) for Degree ${manualCourse.trim()}, Batch ${manualBatch.trim()}. Placed in Requests & Conflicts inbox.`,
        severity: 'info'
      });

      setManualReferenceId(conflict.id);
      handleRemoveManualSelfie();
      showToast(`Verification appeal submitted! Case #${conflict.id}`, 'success');
    } finally {
      setIsSubmittingAppeal(false);
    }
  };

  // Step 1 Screening Verification Handler (Primary School ID Verification & Duplicate Prevention)
  const handleVerifyStudentClick = async (
    e?: React.MouseEvent | React.FormEvent,
    overrideId?: string
  ) => {
    if (e && 'preventDefault' in e) e.preventDefault();
    const targetId = (overrideId || studentId).trim();

    if (!targetId) {
      setScreeningError('Please enter your St. Cecilia’s School / Student ID (e.g., SCC-2020-0192).');
      setStudentVerificationStatus('idle');
      return;
    }

    setScreeningError('');
    setStudentVerificationStatus('checking');

    // 1. Primary lookup using School ID with duplicate detection
    const lookup = lookupStudentBySchoolId(targetId, users);

    if (lookup.isDuplicate) {
      setStudentVerificationStatus('failed');
      setIsRegistryMatched(false);
      setVerifiedRecord(null);
      const msg = lookup.errorMessage || `School ID "${targetId}" is already registered to an active account. Duplicate registration is prevented.`;
      setScreeningError(msg);
      setVerificationMessage(msg);
      return;
    }

    if (lookup.isValid && lookup.matchedRecord) {
      setStudentVerificationStatus('verified');
      setIsRegistryMatched(true);
      setVerifiedRecord(lookup.matchedRecord);
      setVerificationMessage(
        `Registrar Match Confirmed: ${lookup.matchedRecord.fullName} • ${lookup.matchedRecord.course}, Class of ${lookup.matchedRecord.batchYear}`
      );
      setScreeningError('');

      // Auto-populate user details from registrar record (handles both "Last, First M." and "First M. Last")
      const { firstName: parsedFirst, lastName: parsedLast } = splitFullNameParts(lookup.matchedRecord.fullName);
      setFirstName(parsedFirst);
      setLastName(parsedLast);
      if (lookup.matchedRecord.batchYear) setBatch(lookup.matchedRecord.batchYear);
      if (lookup.matchedRecord.course) setCourse(lookup.matchedRecord.course);
      if (lookup.matchedRecord.email && !regEmail) setRegEmail(lookup.matchedRecord.email);
      if (lookup.matchedRecord.phone && !phone) setPhone(lookup.matchedRecord.phone.replace(/[^0-9]/g, '').slice(0, 11));
      if (lookup.matchedRecord.homeAddress && !location) setLocation(lookup.matchedRecord.homeAddress);
    } else {
      setStudentVerificationStatus('failed');
      setIsRegistryMatched(false);
      setVerifiedRecord(null);
      const msg = lookup.errorMessage || `School ID "${targetId}" was not found in the official registrar masterlist. Accepted formats: SCC-22-00017358 or SCC-2020-0192.`;
      setScreeningError(msg);
      setVerificationMessage(msg);
    }
  };

  // Step 3: Terms, Privacy & Zero Disclosure Agreement
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToPrivacyConsent, setAgreedToPrivacyConsent] = useState(false);
  const [agreedToZeroDisclosure, setAgreedToZeroDisclosure] = useState(false);
  const [showPrivacyDetails, setShowPrivacyDetails] = useState(false);
  const [showZeroDisclosureDetails, setShowZeroDisclosureDetails] = useState(false);
  const [registrationComplete, setRegistrationComplete] = useState(false);

  const allConsentsAgreed = agreedToTerms && agreedToPrivacyConsent && agreedToZeroDisclosure;
  const toggleAllConsents = () => {
    const nextVal = !allConsentsAgreed;
    setAgreedToPrivacyConsent(nextVal);
    setAgreedToZeroDisclosure(nextVal);
    setAgreedToTerms(nextVal);
  };

  // Password requirements validation
  const hasMinLength = regPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(regPassword);
  const hasNumber = /[0-9]/.test(regPassword);
  const isPasswordValid = hasMinLength && hasUppercase && hasNumber;

  // Handle Login submission with strict rate-limiting and progressive lockout timers
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    if (isLockedOut) {
      setLoginError(
        `Account temporarily locked due to failed attempts. Please wait ${formatSecondsToMMSS(
          lockoutSecondsRemaining
        )} before attempting to sign in again.`
      );
      return;
    }

    if (!loginIdentifier.trim()) {
      setLoginError(loginMethod === 'email' ? 'Please enter your email address.' : 'Please enter your Student ID.');
      return;
    }

    if (!loginPassword || !loginPassword.trim()) {
      setLoginError('Please enter your password.');
      return;
    }

    // Strict Password Validation: A correct User ID/email alone must NEVER allow login.
    // The password must ALWAYS be validated. If the User ID/email is correct but the password
    // is incorrect, authentication MUST fail.
    const success = await login(loginIdentifier.trim(), loginPassword);
    if (success) {
      // Clear all lockout state on successful authentication
      try {
        localStorage.removeItem(LOCKOUT_STORAGE_KEYS.UNTIL);
        localStorage.removeItem(LOCKOUT_STORAGE_KEYS.ATTEMPTS);
        localStorage.removeItem(LOCKOUT_STORAGE_KEYS.CYCLE);
      } catch {
        // ignore
      }
      setFailedAttempts(0);
      setLockoutCycle(1);
      setLockoutSecondsRemaining(0);

      const trimmed = loginIdentifier.trim().toLowerCase();
      const rawClean = trimmed.replace(/^scc-?/i, '').replace(/^alum-?/i, '');
      const normalizedInputId = trimmed.replace(/[^a-zA-Z0-9]/g, '');

      const matchedUser = users.find((u) => {
        if (u.email && u.email.toLowerCase() === trimmed) return true;
        if (trimmed === 'juan@email.com' && (u.email === 'alumni@stcecilia.edu' || u.email === 'maria.santos@alumni.stcecilia.edu')) return true;

        if (u.studentId) {
          const uLower = u.studentId.toLowerCase();
          const uClean = uLower.replace(/^scc-?/i, '');
          const uDigits = u.studentId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
          if (
            uLower === trimmed ||
            uClean === rawClean ||
            uDigits === normalizedInputId ||
            `scc${normalizedInputId}` === uDigits ||
            uDigits === `scc${normalizedInputId}` ||
            `scc-${rawClean}` === uLower
          ) {
            return true;
          }
        }

        if (u.alumniId) {
          const aLower = u.alumniId.toLowerCase();
          const aDigits = u.alumniId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
          if (aLower === trimmed || aDigits === normalizedInputId || aLower.replace(/^scc-alum-?/i, '') === rawClean) {
            return true;
          }
        }

        if (u.employeeId) {
          const eLower = u.employeeId.toLowerCase();
          const eClean = eLower.replace(/^scc-?/i, '');
          if (eLower === trimmed || eLower === `scc-${trimmed}` || eClean === rawClean) {
            return true;
          }
        }

        return false;
      });

      const userRole = matchedUser?.role || 'alumni';
      const userEmail = matchedUser?.email || (trimmed.includes('@') ? trimmed : `${trimmed}@alumni.stcecilia.edu`);
      const isNative = Capacitor.isNativePlatform();
      const userId = matchedUser?.uid || '';
      const latestRefreshToken =
        sessionStorage.getItem('alumni_latest_refresh_token') ||
        sessionStorage.getItem('alumni_refresh_token') ||
        localStorage.getItem('alumni_refresh_token') ||
        '';

      if (
        isNative &&
        biometricAvail.isAvailable &&
        userId &&
        !isBiometricLoginEnabled(userId) &&
        latestRefreshToken
      ) {
        setPendingOptInUser({
          uid: userId,
          email: userEmail,
          role: userRole,
          refreshToken: latestRefreshToken
        });
        setShowBiometricOptInModal(true);
        return;
      }

      if (onLoginSuccess) {
        onLoginSuccess(userRole);
      } else if (onBackToApp) {
        onBackToApp();
      }
    } else {
      // Check if user is an administrative/staff account attempting to log in on mobile APK
      const trimmed = loginIdentifier.trim().toLowerCase();
      const rawClean = trimmed.replace(/^scc-?/i, '').replace(/^alum-?/i, '');
      const normalizedInputId = trimmed.replace(/[^a-zA-Z0-9]/g, '');

      const potentialUser = users.find((u) => {
        if (u.email && u.email.toLowerCase() === trimmed) return true;
        if (u.studentId) {
          const uLower = u.studentId.toLowerCase();
          const uClean = uLower.replace(/^scc-?/i, '');
          const uDigits = u.studentId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
          if (uLower === trimmed || uClean === rawClean || uDigits === normalizedInputId) return true;
        }
        if (u.employeeId) {
          const eLower = u.employeeId.toLowerCase();
          const eClean = eLower.replace(/^scc-?/i, '');
          if (eLower === trimmed || eLower === `scc-${trimmed}` || eClean === rawClean) return true;
        }
        return false;
      });

      if (isMobileClient && potentialUser && normalizeSystemRole(potentialUser.role) !== 'alumni') {
        setLoginError('Administrative access is restricted to the web portal.');
        return;
      }

      // If failure was due to platform access gate or lifecycle restriction, display message directly
      if (loginPlatformError) {
        setLoginError(loginPlatformError);
        return;
      }

      // If failure was due to an active session conflict, do not increment failed password lockout
      if (activeSessionConflict) {
        return;
      }

      // Check if user is a pending employer or conflict/pending alumni account
      const isPendingEmployer = Boolean(
        potentialUser &&
          potentialUser.role === 'employer' &&
          (!potentialUser.isVerified ||
            potentialUser.employerVerificationStatus === 'pending_verification' ||
            potentialUser.employerStatus === 'pending' ||
            potentialUser.accountStatus === 'PENDING_VERIFICATION' ||
            getEmployerAuthStatus(potentialUser) === 'PENDING_APPROVAL')
      );

      const isPendingOrConflictAlumni = Boolean(
        potentialUser &&
          potentialUser.role === 'alumni' &&
          (!potentialUser.isVerified ||
            potentialUser.verificationStatus === 'pending_review' ||
            potentialUser.verificationStatus === 'flagged' ||
            potentialUser.accountStatus === 'PENDING_VERIFICATION')
      );

      if (loginPendingAccountNotice || isPendingEmployer || isPendingOrConflictAlumni) {
        const noticeInfo = loginPendingAccountNotice || (isPendingEmployer ? {
          role: 'employer' as const,
          title: 'Employer Accreditation Pending',
          message: 'Your corporate partner account has been received and is currently under review by the Alumni & Placement Office. Institutional verification typically concludes within 24–48 business hours. You will receive an official notification once approved.',
          email: potentialUser?.email || trimmed
        } : {
          role: 'alumni' as const,
          title: 'Alumni Credential Verification in Progress',
          message: 'Your graduation record is currently undergoing Registrar review or conflict verification. You will be notified via email once your academic standing is confirmed.',
          email: potentialUser?.email || trimmed
        });

        setPendingApprovalNotice({
          show: true,
          role: noticeInfo.role,
          email: noticeInfo.email,
          message: noticeInfo.message
        });
        setLoginError('');
        return;
      }

      // Failed login attempt tracking
      const newAttempts = failedAttempts + 1;

      if (newAttempts >= 3) {
        // Reached 3 failed attempts in current trial -> trigger lockout
        const durationSec = getLockoutDurationSeconds(lockoutCycle);
        const untilMs = Date.now() + durationSec * 1000;
        const nextCycle = lockoutCycle + 1;

        try {
          localStorage.setItem(LOCKOUT_STORAGE_KEYS.UNTIL, untilMs.toString());
          localStorage.setItem(LOCKOUT_STORAGE_KEYS.ATTEMPTS, '0');
          localStorage.setItem(LOCKOUT_STORAGE_KEYS.CYCLE, nextCycle.toString());
        } catch {
          // ignore
        }

        // Record suspicious multiple failed attempts audit log with alert
        addAuditLog({
          action: 'SUSPICIOUS_MULTIPLE_FAILED_LOGINS',
          actorId: potentialUser?.uid || 'unauthenticated_actor',
          actorName: potentialUser?.name || 'Unauthenticated Actor',
          actorRole: potentialUser?.role || 'alumni',
          category: 'security',
          details: `Multiple failed login attempts detected (${newAttempts} of 3 attempts) for target identifier "${trimmed}". Temporary account lockout enforced.`,
          severity: 'alert',
          targetRecordId: trimmed
        });

        setLockoutSecondsRemaining(durationSec);
        setFailedAttempts(0);
        setLockoutCycle(nextCycle);
        setLoginError('');
      } else {
        // 1st or 2nd failed attempt in current trial
        setFailedAttempts(newAttempts);
        try {
          localStorage.setItem(LOCKOUT_STORAGE_KEYS.ATTEMPTS, newAttempts.toString());
        } catch {
          // ignore
        }

        // Record failed login attempt audit log with warning
        addAuditLog({
          action: 'FAILED_LOGIN_ATTEMPT',
          actorId: potentialUser?.uid || 'unknown_attempt',
          actorName: potentialUser?.name || 'Unauthenticated Actor',
          actorRole: potentialUser?.role || 'alumni',
          category: 'security',
          details: `Failed authentication attempt (attempt ${newAttempts} of 3) due to incorrect password for identifier "${trimmed}".`,
          severity: 'warning',
          targetRecordId: trimmed
        });

        const trialDurationMins = Math.round(getLockoutDurationSeconds(lockoutCycle) / 60);
        const attemptsRemaining = 3 - newAttempts;
        setLoginError(
          `Invalid email/Student ID or password. (${newAttempts} of 3 attempts used). Warning: ${attemptsRemaining} attempt${
            attemptsRemaining > 1 ? 's' : ''
          } remaining before a ${trialDurationMins}-minute account lockout.`
        );
      }
    }
  };

  // Step 1 Screening Validation -> Proceed to Step 2 Account & Profile (School ID Primary Identifier)
  const handleProceedFromStep1ToStep2 = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setScreeningError('');

    const targetId = studentId.trim();
    if (!targetId) {
      setScreeningError('Please enter your St. Cecilia’s School ID (format: SCC-YYYY-XXXX) to proceed.');
      return;
    }

    // 1. Check for duplicates in existing users
    const lookup = lookupStudentBySchoolId(targetId, users);
    if (lookup.isDuplicate) {
      setStudentVerificationStatus('failed');
      setIsRegistryMatched(false);
      setVerifiedRecord(null);
      const msg = lookup.errorMessage || `School ID "${targetId}" is already registered. Duplicate registration is prevented.`;
      setScreeningError(msg);
      setVerificationMessage(msg);
      return;
    }

    // If not yet verified, check if valid registrar record
    if (!verifiedRecord) {
      if (lookup.isValid && lookup.matchedRecord) {
        setStudentVerificationStatus('verified');
        setIsRegistryMatched(true);
        setVerifiedRecord(lookup.matchedRecord);
        const { firstName: parsedFirst, lastName: parsedLast } = splitFullNameParts(lookup.matchedRecord.fullName);
        setFirstName(parsedFirst);
        setLastName(parsedLast);
        if (lookup.matchedRecord.batchYear) setBatch(lookup.matchedRecord.batchYear);
        if (lookup.matchedRecord.course) setCourse(lookup.matchedRecord.course);
        if (lookup.matchedRecord.email && !regEmail) setRegEmail(lookup.matchedRecord.email);
        if (lookup.matchedRecord.phone && !phone) setPhone(lookup.matchedRecord.phone.replace(/[^0-9]/g, '').slice(0, 11));
        if (lookup.matchedRecord.homeAddress && !location) setLocation(lookup.matchedRecord.homeAddress);
        setStep(2);
        return;
      } else {
        setStudentVerificationStatus('failed');
        setIsRegistryMatched(false);
        setVerifiedRecord(null);
        const msg = lookup.errorMessage || `School ID "${targetId}" was not found in the official registrar masterlist. Accepted formats: SCC-22-00017358 or SCC-2020-0192.`;
        setScreeningError(msg);
        setVerificationMessage(msg);
        return;
      }
    }

    setStep(2);
  };

  // Step 2 Validation -> Proceed to Step 3 Review & Honor Pledge
  const handleProceedFromStep2ToStep3 = (e: React.FormEvent) => {
    e.preventDefault();
    setStep2Error('');

    const officialFullName = verifiedRecord?.fullName?.trim() || `${firstName.trim()} ${lastName.trim()}`.trim();
    if (!officialFullName) {
      setStep2Error('Official alumnus record not found. Please return to Step 1 and verify your Student ID.');
      return;
    }
    if (!regEmail.trim() || !regEmail.includes('@')) {
      setStep2Error('A valid email address is required.');
      return;
    }
    if (!isPasswordValid) {
      setStep2Error('Please ensure password satisfies all security requirements (8+ chars, uppercase, number).');
      return;
    }
    if (regPassword !== confirmPassword) {
      setStep2Error('Passwords do not match.');
      return;
    }
    if (!phone || phone.length !== 11 || !phone.startsWith('09')) {
      setStep2Error('Contact number must not be empty, must be exactly 11 digits, and must start with 09 (e.g. 09123456789).');
      return;
    }
    if (!regEmploymentStatus) {
      setStep2Error('Current employment status is required.');
      return;
    }

    setStep(3);
  };

  // Step 3 Submit Registration (Strictly Alumni Role)
  const handleCompleteRegistration = () => {
    if (!agreedToPrivacyConsent || !agreedToZeroDisclosure || !agreedToTerms) {
      setStep3Error('Please confirm all required consents (Data Privacy Consent, Zero Disclosure Agreement, and Honor Pledge) to complete registration.');
      return;
    }
    setStep3Error('');

    const fullName = verifiedRecord?.fullName?.trim() || `${firstName.trim()} ${lastName.trim()}`.trim();
    const finalCourse = verifiedRecord?.course || course;
    const finalBatch = verifiedRecord?.batchYear || batch;
    const generatedHeadline = headline.trim() || `${finalCourse} Graduate • Class of ${finalBatch}`;
    const isAutoVerified = true;
    const finalStudentId = studentId.trim();
    const generatedAlumniId = generateAlumniId(finalBatch, finalStudentId);

    const finalPosition = regPosition.trim();
    const finalCompany = regCompany.trim();
    const finalEmploymentStatus = regEmploymentStatus || (finalPosition ? 'Employed' : 'Seeking Opportunities');

    const registered = register({
      name: fullName,
      email: regEmail.trim(),
      password: regPassword,
      role: 'alumni', // Exclusively Alumni
      accountType: 'alumni',
      currentPosition: finalPosition,
      company: finalCompany,
      employmentStatus: finalEmploymentStatus as any,
      batch: finalBatch,
      course: finalCourse,
      location: location.trim() || verifiedRecord?.homeAddress || 'Cebu, Philippines',
      headline: generatedHeadline,
      phone: phone.trim() || verifiedRecord?.phone || '+63 917 123 4567',
      guardianName: verifiedRecord?.guardianName,
      homeAddress: verifiedRecord?.homeAddress || location.trim() || undefined,
      birthday: verifiedRecord?.birthDate,
      studentId: finalStudentId,
      alumniId: generatedAlumniId,
      isVerified: isAutoVerified,
      formLock: formLock || 'alumni'
    } as any);

    if (!registered) {
      return;
    }

    clearStoredFormLock();
    setFormLock(null);

    if (finalStudentId) {
      addAuditLog({
        action: 'INSTANT_REGISTRY_AUTO_REGISTRATION',
        actorId: 'alumni_registration_screening',
        actorName: fullName,
        actorRole: 'alumni',
        category: 'alumni_registration',
        details: `Alumnus completed screening and registered with verified Student ID (${finalStudentId}) and Official Alumni ID (${generatedAlumniId}). Account pre-authenticated and registered into Cecilian alumni network.`,
        severity: 'success'
      });
      showToast(`🎉 Welcome to St. Cecilia's Alumni Network, ${fullName}! Your Official Alumni ID is ${generatedAlumniId}`, 'success');
    }

    setRegistrationComplete(true);
    if (isAutoVerified) {
      setTimeout(() => {
        if (onLoginSuccess) {
          onLoginSuccess('alumni');
        } else if (onBackToApp) {
          onBackToApp();
        }
      }, 1200);
    }
  };

  // Step 1: Employer Details Validation -> Proceed to Step 2 Review
  const handleProceedEmployerToReview = (e: React.FormEvent) => {
    e.preventDefault();
    setEmployerError('');

    if (!companyName.trim()) {
      setEmployerError('Company / Organization Name is required.');
      return;
    }
    if (!employerContactPerson.trim()) {
      setEmployerError('Contact Person / HR Representative full name is required.');
      return;
    }
    if (!employerPhone || employerPhone.length !== 11 || !employerPhone.startsWith('09')) {
      setEmployerError('Contact number must not be empty, must be exactly 11 digits, and must start with 09 (e.g. 09123456789).');
      return;
    }
    if (!employerEmail.trim() || !employerEmail.includes('@')) {
      setEmployerError('A valid corporate work email address is required.');
      return;
    }
    if (!employerPassword || employerPassword.length < 6) {
      setEmployerError('Password must be at least 6 characters long.');
      return;
    }
    if (employerPassword !== employerConfirmPassword) {
      setEmployerError('Passwords do not match.');
      return;
    }

    // Check if employer was previously rejected - block re-application
    const isPreviouslyRejected = users.some(
      (u) =>
        u.role === 'employer' &&
        (u.employerStatus === 'rejected' || u.employerVerificationStatus === 'rejected') &&
        (
          u.email?.toLowerCase().trim() === employerEmail.trim().toLowerCase() ||
          (u.companyName && companyName && u.companyName.toLowerCase().trim() === companyName.toLowerCase().trim()) ||
          (u.company && companyName && u.company.toLowerCase().trim() === companyName.toLowerCase().trim())
        )
    );
    if (isPreviouslyRejected) {
      setEmployerError('This organization registration was previously rejected and cannot re-apply in accordance with institutional policy.');
      return;
    }

    // Check duplicate email
    const existing = users.find((u) => u.email.toLowerCase() === employerEmail.trim().toLowerCase());
    if (existing) {
      setEmployerError(`An account with email "${employerEmail}" is already registered. Please sign in or use a different email.`);
      return;
    }

    // Advance to Step 2: Information Validation & Review Step
    setEmployerStep(2);
  };

  // Step 2: Employer Final Submission -> Redirects straight to Sign In page
  const handleConfirmEmployerSubmit = () => {
    setIsSubmittingEmployer(true);

    // Check if employer was previously rejected - block re-application
    const isPreviouslyRejected = users.some(
      (u) =>
        u.role === 'employer' &&
        (u.employerStatus === 'rejected' || u.employerVerificationStatus === 'rejected') &&
        (
          u.email?.toLowerCase().trim() === employerEmail.trim().toLowerCase() ||
          (u.companyName && companyName && u.companyName.toLowerCase().trim() === companyName.toLowerCase().trim()) ||
          (u.company && companyName && u.company.toLowerCase().trim() === companyName.toLowerCase().trim())
        )
    );
    if (isPreviouslyRejected) {
      setIsSubmittingEmployer(false);
      setEmployerError('This organization registration was previously rejected and cannot re-apply in accordance with institutional policy.');
      return;
    }

    const formattedWebsite = companyWebsite.trim()
      ? companyWebsite.startsWith('http')
        ? companyWebsite.trim()
        : `https://${companyWebsite.trim()}`
      : '';

    const registered = register({
      role: 'employer',
      name: employerContactPerson.trim(),
      email: employerEmail.trim().toLowerCase(),
      password: employerPassword,
      companyName: companyName.trim(),
      companyIndustry: companyIndustry.trim(),
      companyWebsite: formattedWebsite,
      companyAddress: companyAddress.trim() || 'Cebu City, Philippines',
      location: companyAddress.trim() || 'Cebu City, Philippines',
      phone: employerPhone.trim() || '+63 917 123 4567',
      contactPhone: employerPhone.trim() || '+63 917 123 4567',
      contactPerson: employerContactPerson.trim(),
      headline: `Hiring Partner • ${companyName.trim()}`,
      isVerified: false,
      verified: false,
      employerVerificationStatus: 'pending_verification',
      formLock: formLock || 'employer'
    } as any);

    setIsSubmittingEmployer(false);
    if (!registered) {
      setEmployerError('Registration could not be completed. Please review your details.');
      return;
    }

    clearStoredFormLock();
    setFormLock(null);

    addAuditLog({
      action: 'EMPLOYER_REGISTER',
      actorId: 'new_employer',
      actorName: employerContactPerson.trim(),
      actorRole: 'employer',
      category: 'user_management',
      details: `Employer partner registered: "${companyName.trim()}" by ${employerContactPerson.trim()} (${employerEmail.trim()}). Account provisioned, pending accreditation review (24-48 business hours).`,
      severity: 'info'
    });

    const registeredEmail = employerEmail.trim().toLowerCase();

    // Reset employer state
    setEmployerStep(1);
    setEmployerPassword('');
    setEmployerConfirmPassword('');

    // Requirement 4 & 5: Redirect straight to Sign In page (not looping back to Alumni Registration)
    // with clear pending approval notification (24 to 48 business hours)
    setLoginIdentifier(registeredEmail);
    setLoginMethod('email');
    setPendingApprovalNotice({
      show: true,
      role: 'employer',
      email: registeredEmail,
      message: `Your corporate employer account for "${companyName.trim()}" has been submitted for institutional accreditation. Account verification typically completes within 24 to 48 business hours. You will be able to sign in once approved by the Directorate of Corporate Alliances.`
    });
    setMode('login');
    showToast('Employer registration submitted! Account pending review (24-48 business hours).', 'success');
  };

  return (
    <div className="min-h-[100dvh] w-full flex bg-stone-900 text-stone-800 font-sans pt-safe pb-safe">
      
      {/* ================= LEFT HALF: DARK ARCHITECTURE HERO ================= */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 text-white overflow-hidden">
        {/* Background Image with Dark Vignette - St. Cecilia's College Building Photo */}
        <div className="absolute inset-0 z-0">
          <img
            src="/assets/landing-building-2.jpg"
            alt="St. Cecilia's College Architecture"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover opacity-45 filter contrast-110 brightness-80 scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/75 to-black/50" />
        </div>

        {/* Top Bar: Back to Home Button */}
        <div className="relative z-10">
          {onBackToApp && (
            <button
              type="button"
              onClick={onBackToApp}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-sm border border-white/15 transition-all cursor-pointer group shadow-2xs"
              title="Back to Home"
              aria-label="Back to Home"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              <span className="font-bold tracking-tight">ALUMNET</span>
            </button>
          )}
        </div>

        {/* Center Hero Content */}
        <div className="relative z-10 max-w-lg my-auto py-8">
          {/* Eyebrow with Team Seal */}
          <div className="flex items-center gap-2.5 mb-4">
            <div className="relative w-8 h-8 rounded-full p-0.5 bg-gradient-to-tr from-[#8B181B] to-amber-500 shadow-sm flex items-center justify-center shrink-0">
              <img
                src="/assets/cecilians-seal.jpg"
                alt="Alumni Cecilian's Seal"
                referrerPolicy="no-referrer"
                className="w-full h-full rounded-full object-cover bg-white"
              />
            </div>
            <span className="w-5 h-[2px] bg-[#991B1B]" />
            <span className="editorial-kicker text-[#fca5a5]">
              ST. CECILIA'S · ALUMNI NETWORK
            </span>
          </div>

          {/* Large Editorial Heading */}
          <h1 className="editorial-title text-4xl sm:text-5xl xl:text-6xl font-normal text-white tracking-tight leading-[1.08] mb-5">
            {mode === 'login' ? (
              <>Welcome <span className="italic text-[#fca5a5]">Back.</span></>
            ) : registrationType === 'employer' ? (
              <>Hiring <span className="italic text-[#fca5a5]">Partner Network.</span></>
            ) : (
              <>Join the <span className="italic text-[#fca5a5]">Network.</span></>
            )}
          </h1>

          {/* Subtitle */}
          <p className="text-stone-300 text-base xl:text-lg leading-relaxed font-light mb-8">
            {mode === 'login'
              ? 'Sign in to access your alumni network, events, and career opportunities.'
              : registrationType === 'employer'
              ? 'Register your organization to hire certified Cecilian graduates, publish job openings, and access our career recruitment portal.'
              : "Apply for exclusive access to the St. Cecilia's alumni community."}
          </p>

          {/* Stepper (Only on Register Mode) */}
          {mode === 'register' && (
            registrationType === 'employer' ? (
              <div className="space-y-4 pt-4 border-t border-white/10 max-w-xs">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#8B181B] text-white flex items-center justify-center text-xs font-bold">
                    1
                  </div>
                  <span className="text-sm font-bold text-white">Company Registration</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full border border-white/40 text-white/50 flex items-center justify-center text-xs font-bold">
                    2
                  </div>
                  <span className="text-sm font-medium text-stone-400">Accreditation Verification</span>
                </div>
              </div>
            ) : (
              <div className="space-y-4 pt-4 border-t border-white/10 max-w-xs">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                      step === 1
                        ? 'bg-white text-stone-950 shadow-md'
                        : step > 1
                        ? 'bg-[#8B181B] text-white'
                        : 'border border-white/40 text-white/50'
                    }`}
                  >
                    {step > 1 ? '✓' : '1'}
                  </div>
                  <span
                    className={`text-sm font-medium ${
                      step === 1 ? 'text-white font-bold' : step > 1 ? 'text-stone-300' : 'text-stone-500'
                    }`}
                  >
                    Student ID Screening
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                      step === 2
                        ? 'bg-white text-stone-950 shadow-md'
                        : step > 2
                        ? 'bg-[#8B181B] text-white'
                        : 'border border-white/40 text-white/50'
                    }`}
                  >
                    {step > 2 ? '✓' : '2'}
                  </div>
                  <span
                    className={`text-sm font-medium ${
                      step === 2 ? 'text-white font-bold' : step > 2 ? 'text-stone-300' : 'text-stone-500'
                    }`}
                  >
                    Account & Profile
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                      step === 3
                        ? 'bg-white text-stone-950 shadow-md'
                        : 'border border-white/40 text-white/50'
                    }`}
                  >
                    3
                  </div>
                  <span
                    className={`text-sm font-medium ${
                      step === 3 ? 'text-white font-bold' : 'text-stone-500'
                    }`}
                  >
                    Review & Pledge
                  </span>
                </div>
              </div>
            )
          )}
        </div>

        {/* Footer Notes */}
        <div className="relative z-10 text-xs text-stone-400 font-light flex items-center gap-2">
          <span>St. Cecilia's College Global Alumni Association</span>
          <span>•</span>
          <span>Institutional Portal</span>
        </div>
      </div>

      {/* ================= RIGHT HALF: CLEAN WHITE FORM ================= */}
      <div className="w-full lg:w-1/2 bg-white dark:bg-[#000000] lg:dark:bg-[#111827] flex flex-col justify-center px-5 sm:px-12 xl:px-20 py-8 sm:py-12 overflow-y-auto min-h-[100dvh] lg:max-h-screen relative">
        
        {/* Quick Theme Toggle & Navigation Controls */}
        <div className="absolute top-[calc(1rem+env(safe-area-inset-top,0px))] right-4 sm:top-6 sm:right-6 flex items-center gap-2 z-20">
          <button
            type="button"
            onClick={toggleTheme}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-stone-500 dark:text-[#A8A8A8] hover:text-stone-900 dark:hover:text-[#FAFAFA] hover:bg-stone-100 dark:hover:bg-[#1C1C1E] transition-colors cursor-pointer"
            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
            aria-label="Toggle Dark/Light Theme"
          >
            {isDark ? (
              <Sun className="w-5 h-5 text-amber-400 stroke-[1.75]" />
            ) : (
              <Moon className="w-5 h-5 stroke-[1.75]" />
            )}
          </button>
        </div>

        {/* Mobile Centered Brand & Mode Switcher (<1024px) */}
        <div className="lg:hidden max-w-md w-full mx-auto mb-6 pt-2 text-center space-y-4">
          <div className="flex flex-col items-center gap-2.5">
            <img
              src="/assets/cecilians-seal.jpg"
              alt="St. Cecilia's College Seal"
              referrerPolicy="no-referrer"
              className="w-12 h-12 rounded-full object-cover border border-[#EFEFEF] dark:border-[#262626] bg-white"
            />
            <div>
              <h1 className="text-[20px] font-bold tracking-tight text-[#111827] dark:text-[#FAFAFA]">
                ALUMNET
              </h1>
              <p className="text-[12px] text-[#737373] dark:text-[#A8A8A8]">
                St. Cecilia&apos;s Alumni Network
              </p>
            </div>
          </div>

          {!registrationComplete && (
            <MobileSegmentedTabs
              value={mode}
              onChange={(v) => {
                if (v === 'login') {
                  setMode('login');
                } else {
                  setMode('register');
                  setRegistrationType('alumni');
                  setStep(1);
                }
              }}
              options={[
                { id: 'login', label: 'Sign In' },
                { id: 'register', label: 'Create Account' }
              ]}
            />
          )}
        </div>

        {/* ========================================================
            VIEW A: SIGN IN FORM (Matches Screenshot 2)
            ======================================================== */}
        {mode === 'login' && (
          <div className="max-w-md w-full mx-auto">
            {/* Form Title & Subtitle (Desktop Only — Mobile uses centered brand above) */}
            <span className="hidden lg:block editorial-kicker mb-1">OFFICIAL ACCESS</span>
            <h2 className="hidden lg:block editorial-title text-2xl sm:text-3xl font-normal mb-1">
              Sign In to <span className="editorial-accent italic">Alumnet</span>
            </h2>
            <p className="hidden lg:block editorial-sub text-xs sm:text-sm mb-6">
              Enter your credentials to access the alumni workspace.
            </p>

            {/* Requirement 1: Active Login Session Conflict Banner (One Account, One Active Login) */}
            {activeSessionConflict && (
              <div className="mb-6 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-700/60 text-amber-950 dark:text-amber-100 shadow-sm animate-in fade-in duration-200">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 shrink-0 mt-0.5">
                    <ShieldAlert className="w-5 h-5 text-amber-700 dark:text-amber-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <h4 className="font-bold text-sm text-amber-950 dark:text-amber-100">
                        Account Currently in Use
                      </h4>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-200/80 dark:bg-amber-800 text-amber-900 dark:text-amber-100">
                        1 Active Session
                      </span>
                    </div>

                    <p className="text-xs text-amber-800 dark:text-amber-200 mt-1.5 leading-relaxed">
                      {activeSessionConflict.message}
                    </p>

                    <div className="mt-2.5 p-2.5 rounded-xl bg-white/90 dark:bg-stone-900/90 border border-amber-200 dark:border-amber-800/50 space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-stone-500 dark:text-stone-400">Active Device:</span>
                        <span className="font-semibold text-stone-900 dark:text-stone-100">
                          {activeSessionConflict.activeSession.deviceInfo || 'Another Device'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-stone-500 dark:text-stone-400">Location:</span>
                        <span className="font-semibold text-stone-900 dark:text-stone-100">
                          {activeSessionConflict.activeSession.approxLocation || 'Cebu, Philippines'}
                        </span>
                      </div>
                      {activeSessionConflict.attemptInfo?.attemptTime && (
                        <div className="flex items-center justify-between">
                          <span className="text-stone-500 dark:text-stone-400">Attempt Time:</span>
                          <span className="font-mono text-[11px] text-stone-700 dark:text-stone-300">
                            {activeSessionConflict.attemptInfo.attemptTime}
                          </span>
                        </div>
                      )}
                    </div>

                    <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-2 leading-tight">
                      A security alert email notification was sent to <span className="font-semibold underline">{activeSessionConflict.ownerEmailMasked}</span>.
                    </p>

                    <div className="mt-3 pt-2.5 border-t border-amber-200 dark:border-amber-800/60 flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        disabled={isSubmittingEndSession}
                        onClick={async () => {
                          setIsSubmittingEndSession(true);
                          const ok = await terminateOtherSessionAndLogin(
                            activeSessionConflict.identifier,
                            activeSessionConflict.password || loginPassword
                          );
                          setIsSubmittingEndSession(false);
                          if (ok && onLoginSuccess) {
                            onLoginSuccess('alumni');
                          }
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-[#8B181B] hover:bg-[#721316] text-white text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                      >
                        {isSubmittingEndSession ? 'Ending Session...' : 'End Existing Session & Log In Here'}
                      </button>
                      <button
                        type="button"
                        onClick={clearActiveSessionConflict}
                        className="px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 text-xs font-medium transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Pending Account Approval Notification Banner (Requirement 5) */}
            {pendingApprovalNotice?.show && (
              <div className="mb-5 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 text-amber-950 dark:text-amber-100 shadow-sm animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 shrink-0 mt-0.5">
                    <Clock className="w-5 h-5 text-amber-700 dark:text-amber-400" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <h4 className="font-bold text-xs uppercase tracking-wider text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        {pendingApprovalNotice.role === 'employer' ? 'Employer Accreditation Pending' : 'Alumni Credential Verification in Progress'}
                      </h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100">
                        {pendingApprovalNotice.role === 'employer' ? '24 to 48 Business Hours' : 'Registrar Review'}
                      </span>
                    </div>
                    <p className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                      {pendingApprovalNotice.message}
                    </p>
                    <div className="pt-2 flex items-center justify-between text-[11px] text-amber-800 dark:text-amber-300 border-t border-amber-200/60 dark:border-amber-800/40 mt-2">
                      <span>Registered Account: <strong className="font-semibold">{pendingApprovalNotice.email}</strong></span>
                      <button
                        type="button"
                        onClick={() => {
                          setPendingApprovalNotice(null);
                          clearLoginPendingAccountNotice?.();
                        }}
                        className="font-bold underline hover:text-amber-950 dark:hover:text-amber-100 cursor-pointer"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Prominent Live Countdown Lockout Banner or Error State */}
            {isLockedOut ? (
              <div className="mb-6 p-4 rounded-xl bg-red-50 border-2 border-red-300 text-red-900 shadow-sm animate-pulse">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-red-100 text-red-700 shrink-0 mt-0.5">
                    <Clock className="w-5 h-5 animate-spin" style={{ animationDuration: '4s' }} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <h4 className="font-bold text-sm text-red-900 flex items-center gap-1.5">
                        <ShieldAlert className="w-4 h-4 text-red-600" />
                        Account Temporarily Locked
                      </h4>
                      <span className="font-mono text-sm font-black px-2.5 py-0.5 rounded-md bg-red-600 text-white tracking-widest shadow-xs">
                        {formatSecondsToMMSS(lockoutSecondsRemaining)}
                      </span>
                    </div>
                    <p className="text-xs text-red-700 mt-1.5 leading-relaxed">
                      Too many consecutive failed sign-in attempts (3 of 3). For security, sign-in is suspended. Please wait until the timer finishes before trying again.
                    </p>
                    <div className="mt-2.5 pt-2 border-t border-red-200 text-[11px] text-red-700 flex items-center justify-between flex-wrap gap-2">
                      <span>Rate limit rule: 1st trial = 1 min (+2 mins each subsequent trial)</span>
                      <button
                        type="button"
                        onClick={handleOpenForgotPassword}
                        className="font-bold underline text-red-900 hover:text-red-950 cursor-pointer"
                      >
                        Reset Credentials via Email
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : loginError ? (
              loginError.includes('Administrative access is restricted to the web portal') ? (
                <div className="mb-4 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 text-amber-900 dark:text-amber-100">
                  <div className="flex items-start gap-3">
                    <ShieldAlert className="w-5 h-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-2">
                      <h4 className="font-bold text-[12px] uppercase tracking-wider text-amber-900 dark:text-amber-200">
                        Desktop Browser Required
                      </h4>
                      <p className="text-[13px] font-semibold leading-snug text-amber-950 dark:text-amber-100">
                        Mobile and tablet sign-in is exclusively for St. Cecilia&apos;s Alumni.
                      </p>
                      <p className="text-[12px] text-amber-800 dark:text-amber-300/90 leading-relaxed">
                        Admin, Moderator, Staff, and Employer accounts require a desktop or laptop screen (1024px or wider).
                      </p>
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setLoginIdentifier('');
                            setLoginPassword('');
                            setLoginError('');
                          }}
                          className="min-h-[44px] px-4 py-2 rounded-xl bg-[#8B181B] dark:bg-[#E11D48] hover:bg-[#721316] text-white text-[13px] font-semibold transition-opacity active:opacity-85 cursor-pointer"
                        >
                          Use an Alumni Account
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mb-4 p-3.5 rounded-xl bg-red-50 text-red-800 text-xs border border-red-200 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium leading-relaxed">{loginError}</p>
                  </div>
                </div>
              )
            ) : failedAttempts > 0 ? (
              <div className="mb-4 p-3 rounded-xl bg-amber-50 text-amber-800 text-xs border border-amber-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="text-[11px] font-medium">
                  {failedAttempts} of 3 attempts used in this trial. {3 - failedAttempts} attempt{3 - failedAttempts > 1 ? 's' : ''} remaining before temporary lockout.
                </span>
              </div>
            ) : null}

            {/* Sign In Form */}
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              {/* Identifier Field */}
              <div>
                <label className="block text-[12px] lg:text-[11px] font-semibold lg:font-bold text-[#111827] dark:text-[#FAFAFA] lg:text-stone-700 lg:uppercase lg:tracking-wider mb-1.5">
                  Email or SCC ID
                </label>
                <div className="relative">
                  <input
                    type="text"
                    autoComplete="username"
                    required
                    disabled={isLockedOut}
                    value={loginIdentifier}
                    onChange={(e) => {
                      const val = e.target.value;
                      setLoginIdentifier(val);
                      if (val.includes('@')) {
                        setLoginMethod('email');
                      } else {
                        setLoginMethod('studentId');
                      }
                    }}
                    placeholder="SCC ID or email address"
                    className="w-full min-h-[48px] px-4 py-3 bg-[#F3F4F6] dark:bg-[#262626] lg:bg-white lg:dark:bg-stone-900 border border-transparent lg:border-stone-200 lg:dark:border-stone-700 text-[#111827] dark:text-[#FAFAFA] placeholder:text-[#737373] dark:placeholder:text-[#A8A8A8] rounded-xl text-base lg:text-sm focus:outline-hidden focus:ring-2 focus:ring-[#8B181B]/25 focus:border-[#8B181B] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
                <p className="text-[12px] lg:text-[11px] text-[#737373] dark:text-[#A8A8A8] lg:text-stone-500 mt-1.5 leading-relaxed">
                  Use your registered email or SCC ID (e.g. <code>SCC-2020-0192</code>).
                </p>
              </div>

              {/* Password Field */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[12px] lg:text-[11px] font-semibold lg:font-bold text-[#111827] dark:text-[#FAFAFA] lg:text-stone-600 lg:uppercase lg:tracking-wider">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={handleOpenForgotPassword}
                    className="text-[12px] text-[#8B181B] dark:text-[#FB7185] lg:dark:text-red-400 hover:underline font-semibold cursor-pointer min-h-[36px] flex items-center"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    required
                    disabled={isLockedOut}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Password"
                    className="w-full min-h-[48px] pl-4 pr-12 py-3 bg-[#F3F4F6] dark:bg-[#262626] lg:bg-white lg:dark:bg-stone-900 border border-transparent lg:border-stone-200 lg:dark:border-stone-700 text-[#111827] dark:text-[#FAFAFA] placeholder:text-[#737373] dark:placeholder:text-[#A8A8A8] rounded-xl text-base lg:text-sm focus:outline-hidden focus:ring-2 focus:ring-[#8B181B]/25 focus:border-[#8B181B] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <button
                    type="button"
                    disabled={isLockedOut}
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                    title={showLoginPassword ? 'Hide password' : 'Show password'}
                    style={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      right: '4px',
                      marginTop: 'auto',
                      marginBottom: 'auto',
                      height: '44px',
                      width: '44px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transform: 'none',
                      translate: 'none'
                    }}
                    className="no-gooey text-[#737373] dark:text-[#A8A8A8] hover:text-[#111827] dark:hover:text-[#FAFAFA] rounded-xl transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none z-10"
                  >
                    {showLoginPassword ? (
                      <EyeOff className="w-5 h-5 transition-transform active:scale-90" strokeWidth={1.75} />
                    ) : (
                      <Eye className="w-5 h-5 transition-transform active:scale-90" strokeWidth={1.75} />
                    )}
                  </button>
                </div>
              </div>

              {/* Stay Signed In */}
              <div className="flex items-center gap-2.5 pt-1 min-h-[44px]">
                <input
                  type="checkbox"
                  id="staySignedIn"
                  disabled={isLockedOut}
                  checked={staySignedIn}
                  onChange={(e) => setStaySignedIn(e.target.checked)}
                  className="w-4 h-4 accent-[#8B181B] rounded border-stone-300 focus:ring-[#8B181B] disabled:cursor-not-allowed"
                />
                <label htmlFor="staySignedIn" className="text-[13px] lg:text-xs text-[#737373] dark:text-[#A8A8A8] lg:text-stone-600 select-none">
                  Stay signed in
                </label>
              </div>

              {/* Red Submit Button with dynamic lockout countdown */}
              <button
                type="submit"
                disabled={isLockedOut}
                className={`w-full min-h-[48px] py-3 rounded-xl text-[14px] lg:text-xs font-semibold lg:tracking-wider lg:uppercase transition-all cursor-pointer ${
                  isLockedOut
                    ? 'bg-stone-300 text-stone-600 cursor-not-allowed shadow-none'
                    : 'bg-[#8B181B] dark:bg-[#E11D48] hover:bg-[#721316] text-white lg:ds-btn-primary active:opacity-85'
                }`}
              >
                {isLockedOut
                  ? `LOCKED — TRY AGAIN IN ${formatSecondsToMMSS(lockoutSecondsRemaining)}`
                  : 'Sign In'}
              </button>

              {/* Multi-Modal Biometric Quick Login (Native Android APK / iOS Only) */}
              {biometricAvail.isAvailable && Capacitor.isNativePlatform() && (
                <div className="pt-2">
                  <div className="relative flex py-2 items-center">
                    <div className="flex-grow border-t border-stone-200"></div>
                    <span className="flex-shrink mx-3 text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                      or biometric sign-in
                    </span>
                    <div className="flex-grow border-t border-stone-200"></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      disabled={isLockedOut || isBiometricLoading}
                      onClick={() => handleBiometricSignIn('face')}
                      className="min-h-[46px] py-2.5 px-3 rounded-xl border border-stone-200/90 dark:border-[#262626] hover:border-[#8B181B] dark:hover:border-[#E11D48] bg-white dark:bg-[#171717] hover:bg-stone-50/80 dark:hover:bg-[#262626] text-stone-800 dark:text-[#FAFAFA] text-[13px] lg:text-xs font-bold tracking-wide transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      title="Sign in with Face Detection"
                    >
                      <ScanFace className="w-4 h-4 text-[#8B181B] dark:text-[#FB7185]" />
                      <span className="truncate">Face Scan</span>
                    </button>
                    <button
                      type="button"
                      disabled={isLockedOut || isBiometricLoading}
                      onClick={() => handleBiometricSignIn('fingerprint')}
                      className="min-h-[46px] py-2.5 px-3 rounded-xl border border-stone-200/90 dark:border-[#262626] hover:border-[#8B181B] dark:hover:border-[#E11D48] bg-white dark:bg-[#171717] hover:bg-stone-50/80 dark:hover:bg-[#262626] text-stone-800 dark:text-[#FAFAFA] text-[13px] lg:text-xs font-bold tracking-wide transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      title="Sign in with Fingerprint / Touch ID"
                    >
                      <Fingerprint className="w-4 h-4 text-[#8B181B] dark:text-[#FB7185]" />
                      <span className="truncate">Fingerprint</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Bottom Switcher */}
              <div className="text-center pt-4 text-[13px] lg:text-xs text-stone-500 dark:text-[#A3A3A3] space-y-1.5">
                <div className="flex flex-wrap items-center justify-center gap-1">
                  <span>Don't have an alumni account?</span>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('register');
                      setRegistrationType('alumni');
                      setStep(1);
                    }}
                    className="min-h-[44px] inline-flex items-center px-1.5 text-[#8B181B] dark:text-[#FB7185] font-bold hover:underline cursor-pointer"
                  >
                    Register as Alumnus
                  </button>
                </div>
                {!isMobileClient && (
                  <div className="text-stone-400">
                    Looking to hire Cecilians?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setMode('register');
                        setRegistrationType('employer');
                      }}
                      className="text-[#8B181B] dark:text-[#FB7185] font-bold hover:underline cursor-pointer"
                    >
                      Register as Employer Partner
                    </button>
                  </div>
                )}
              </div>
            </form>
          </div>
        )}

        {/* ========================================================
            VIEW B: MULTI-STEP REGISTRATION (Matches Screenshot 1)
            ======================================================== */}
        {mode === 'register' && (
          <div className="max-w-md w-full mx-auto">
            {registrationComplete ? (
              <div className="text-center py-12">
                <CheckCircle2 className="w-16 h-16 text-emerald-600 mx-auto mb-4" />
                <h3 className="font-sans text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
                  {registrationType === 'employer'
                    ? 'Registration Received — Pending Review'
                    : (studentVerificationStatus === 'verified' || isRegistryMatched)
                    ? "Welcome to St. Cecilia's Alumni!"
                    : "Registration Submitted — Pending Verification"}
                </h3>
                <p className="text-sm text-stone-500 mt-2 max-w-sm mx-auto">
                  {registrationType === 'employer'
                    ? 'Your employer profile has been submitted for institutional accreditation. You cannot log in until the account is approved.'
                    : (studentVerificationStatus === 'verified' || isRegistryMatched)
                    ? 'Your credentials have been verified by the Registrar. Redirecting you to the portal...'
                    : 'Your registration has been recorded. In accordance with institutional policy, unverified alumni cannot log in until their academic records are confirmed by the Office of the Registrar.'}
                </p>
                {!(registrationType !== 'employer' && (studentVerificationStatus === 'verified' || isRegistryMatched)) && (
                  <div className="mt-6">
                    <button
                      type="button"
                      onClick={() => {
                        setRegistrationComplete(false);
                        setMode('login');
                      }}
                      className="px-5 py-2.5 bg-[#8B181B] hover:bg-[#721316] text-white rounded-xl text-sm font-semibold transition-colors cursor-pointer shadow-xs"
                    >
                      Return to Sign In
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Universal Back to Sign In & Registration Flow Navigation */}
                <div className="flex items-center justify-between gap-3 mb-4">
                  <button
                    type="button"
                    onClick={() => {
                      if (registrationType === 'employer' && employerStep === 2) {
                        setEmployerStep(1);
                      } else if (registrationType === 'alumni' && step > 1) {
                        setStep((prev) => (prev - 1) as any);
                      } else {
                        setMode('login');
                      }
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 dark:text-[#A8A8A8] hover:text-stone-900 dark:hover:text-[#FAFAFA] transition-colors cursor-pointer min-h-[44px]"
                  >
                    <ArrowLeft className="w-4 h-4 lg:w-3.5 lg:h-3.5" />
                    <span>
                      {registrationType === 'employer' && employerStep === 2
                        ? 'Back to Organization Details'
                        : registrationType === 'alumni' && step > 1
                        ? `Back to Step ${step - 1}`
                        : 'Back to Sign In'}
                    </span>
                  </button>

                  <span className="text-[12px] lg:text-[11px] font-semibold text-[#737373] dark:text-[#A8A8A8] tabular-nums">
                    {registrationType === 'employer'
                      ? `Step ${employerStep} of 2`
                      : `Step ${step} of 3`}
                  </span>
                </div>

                {/* Separate, Distinct Registration Role Selector Tabs with Confirmation on Form Switching */}
                {!isMobileClient && (
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-stone-100 dark:bg-stone-800 rounded-xl mb-3">
                    <button
                      type="button"
                      onClick={() => handleRoleTabClick('alumni')}
                      className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        registrationType === 'alumni'
                          ? 'bg-white dark:bg-stone-900 text-[#8B181B] dark:text-red-400 shadow-xs'
                          : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                      }`}
                    >
                      <GraduationCap className="w-3.5 h-3.5" />
                      <span>Alumni Registration</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRoleTabClick('employer')}
                      className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        registrationType === 'employer'
                          ? 'bg-white dark:bg-stone-900 text-[#8B181B] dark:text-red-400 shadow-xs'
                          : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                      }`}
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      <span>Employer Registration</span>
                    </button>
                  </div>
                )}

                {!isMobileClient && registrationType === 'employer' ? (
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-red-100 text-[#8B181B] mb-2 border border-red-200">
                      <Building2 className="w-3 h-3" />
                      Corporate Accreditation & Recruitment Partner
                    </div>
                    <span className="editorial-kicker block mb-1">CORPORATE ALLIANCE</span>
                    <h2 className="editorial-title text-2xl sm:text-3xl font-normal mb-1">
                      {employerStep === 1 ? (
                        <>Register <span className="editorial-accent italic">Organization</span></>
                      ) : (
                        <>Validate <span className="editorial-accent italic">Information</span></>
                      )}
                    </h2>
                    <p className="editorial-sub text-xs sm:text-sm mb-4">
                      {employerStep === 1
                        ? 'Create an employer account to post career opportunities and hire certified Cecilian graduates.'
                        : 'Please double-check and verify that all entered company details are accurate before submitting for accreditation.'}
                    </p>

                    {/* Pending Approval Notice Banner */}
                    <div className="mb-5 p-3 rounded-xl bg-amber-50/90 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                      <Clock className="w-4 h-4 text-[#8B181B] shrink-0 mt-0.5" />
                      <div className="leading-snug">
                        <span className="font-bold">Accreditation Review Timeframe:</span>{' '}
                        <span>
                          Newly submitted corporate registrations are reviewed by the Directorate of Corporate Alliances & Placement within <strong>24 to 48 business hours</strong>.
                        </span>
                      </div>
                    </div>

                    {employerError && (
                      <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                        <span>{employerError}</span>
                      </div>
                    )}

                    {employerStep === 1 ? (
                      /* STEP 1: ORGANIZATION DETAILS INPUT FORM */
                      <form onSubmit={handleProceedEmployerToReview} className="space-y-4">
                        {/* Company Name */}
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                            Company / Organization Name <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <Building className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              required
                              value={companyName}
                              onChange={(e) => setCompanyName(e.target.value)}
                              placeholder="e.g., TechSolutions Philippines Inc."
                              className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-[#8B181B]/20 focus:border-[#8B181B]"
                            />
                          </div>
                        </div>

                        {/* Industry & Website */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                              Industry Sector <span className="text-red-500">*</span>
                            </label>
                            <select
                              value={companyIndustry}
                              onChange={(e) => setCompanyIndustry(e.target.value)}
                              className="w-full px-3 py-2.5 bg-white border border-stone-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-[#8B181B]/20 focus:border-[#8B181B]"
                            >
                              <option value="Information Technology & Software">Information Technology & Software</option>
                              <option value="BPO & Shared Services">BPO & Shared Services</option>
                              <option value="Healthcare & Nursing">Healthcare & Nursing</option>
                              <option value="Education & Academics">Education & Academics</option>
                              <option value="Engineering & Construction">Engineering & Construction</option>
                              <option value="Hospitality & Tourism">Hospitality & Tourism</option>
                              <option value="Banking & Financial Services">Banking & Financial Services</option>
                              <option value="Retail & E-Commerce">Retail & E-Commerce</option>
                              <option value="Manufacturing & Logistics">Manufacturing & Logistics</option>
                              <option value="Government & Public Sector">Government & Public Sector</option>
                              <option value="Other Industry">Other Industry</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                              Company Website <span className="text-stone-400 font-normal">(optional)</span>
                            </label>
                            <div className="relative">
                              <Globe className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                              <input
                                type="text"
                                value={companyWebsite}
                                onChange={(e) => setCompanyWebsite(e.target.value)}
                                placeholder="https://company.com"
                                className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-[#8B181B]/20 focus:border-[#8B181B]"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Office Address / Location */}
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                            Office / Headquarters Location <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <MapPin className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              required
                              value={companyAddress}
                              onChange={(e) => setCompanyAddress(e.target.value)}
                              placeholder="e.g., Cebu IT Park, Apas, Cebu City"
                              className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-[#8B181B]/20 focus:border-[#8B181B]"
                            />
                          </div>
                        </div>

                        {/* Contact Person Name & Phone */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                              Contact Person <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                              <User className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                              <input
                                type="text"
                                required
                                value={employerContactPerson}
                                onChange={(e) => setEmployerContactPerson(e.target.value)}
                                placeholder="e.g., Juan Dela Cruz (HR)"
                                className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-[#8B181B]/20 focus:border-[#8B181B]"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                              Phone / Mobile Number <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                              <Phone className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                              <input
                                type="tel"
                                required
                                maxLength={11}
                                value={employerPhone}
                                onChange={(e) => setEmployerPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                                placeholder="09123456789"
                                className={`w-full pl-10 pr-4 py-2.5 bg-white border rounded-xl text-sm focus:outline-hidden focus:ring-2 ${
                                  employerPhone && (!employerPhone.startsWith('09') || employerPhone.length !== 11)
                                    ? 'border-red-400 focus:border-red-500 focus:ring-red-400/20'
                                    : employerPhone && employerPhone.startsWith('09') && employerPhone.length === 11
                                    ? 'border-emerald-500 focus:border-emerald-600 focus:ring-emerald-500/20'
                                    : 'border-stone-200 focus:ring-[#8B181B]/20 focus:border-[#8B181B]'
                                }`}
                              />
                            </div>
                            <span className="text-[10px] text-stone-400 mt-1 block">11 digits starting with 09 (e.g. 09123456789)</span>
                          </div>
                        </div>

                        {/* Work Email */}
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                            Official Corporate Email <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                            <input
                              type="email"
                              required
                              value={employerEmail}
                              onChange={(e) => setEmployerEmail(e.target.value)}
                              placeholder="careers@company.com or hr@company.com"
                              className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-[#8B181B]/20 focus:border-[#8B181B]"
                            />
                          </div>
                          <p className="text-[11px] text-stone-400 mt-1">This email will be used for applicant notifications and corporate login.</p>
                        </div>

                        {/* Passwords */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                              Password <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                              <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                              <input
                                type={showEmployerPassword ? 'text' : 'password'}
                                required
                                value={employerPassword}
                                onChange={(e) => setEmployerPassword(e.target.value)}
                                placeholder="Min. 6 chars"
                                className="w-full pl-10 pr-10 py-2.5 bg-white border border-stone-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-[#8B181B]/20 focus:border-[#8B181B]"
                              />
                              <button
                                type="button"
                                onClick={() => setShowEmployerPassword(!showEmployerPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 cursor-pointer"
                                aria-label={showEmployerPassword ? 'Hide password' : 'Show password'}
                              >
                                {showEmployerPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                              Confirm Password <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                              <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                              <input
                                type={showEmployerConfirmPassword ? 'text' : 'password'}
                                required
                                value={employerConfirmPassword}
                                onChange={(e) => setEmployerConfirmPassword(e.target.value)}
                                placeholder="Re-enter password"
                                className={`w-full pl-10 pr-10 py-2.5 rounded-xl text-sm focus:outline-hidden focus:ring-2 ${
                                  employerConfirmPassword && employerConfirmPassword === employerPassword
                                    ? 'bg-emerald-50/20 border border-emerald-500 text-emerald-950 focus:border-emerald-600 focus:ring-emerald-500/20'
                                    : employerConfirmPassword && employerConfirmPassword !== employerPassword
                                    ? 'bg-red-50/20 border border-red-400 text-red-950 focus:border-red-500 focus:ring-red-400/20'
                                    : 'bg-white border border-stone-200 focus:ring-[#8B181B]/20 focus:border-[#8B181B]'
                                }`}
                              />
                              <button
                                type="button"
                                onClick={() => setShowEmployerConfirmPassword(!showEmployerConfirmPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 cursor-pointer"
                                aria-label={showEmployerConfirmPassword ? 'Hide password' : 'Show password'}
                              >
                                {showEmployerConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                            {employerConfirmPassword && employerConfirmPassword === employerPassword && (
                              <div className="flex items-center gap-1 mt-1 text-[11px] font-semibold text-emerald-600">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Passwords match</span>
                              </div>
                            )}
                            {employerConfirmPassword && employerConfirmPassword !== employerPassword && (
                              <div className="flex items-center gap-1 mt-1 text-[11px] font-semibold text-red-500">
                                <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                                <span>Passwords do not match</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Step 1 Action Buttons with Reset & Cancel */}
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={handleResetEmployerForm}
                            className="px-3.5 py-3.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                          >
                            Reset
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEmployerForm}
                            className="px-3.5 py-3.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="flex-1 py-3.5 bg-[#8B181B] hover:bg-[#721316] text-white rounded-xl text-xs font-bold tracking-widest uppercase transition-all shadow-md shadow-red-950/20 hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>REVIEW & VERIFY</span>
                          </button>
                        </div>
                      </form>
                    ) : (
                      /* STEP 2: INFORMATION VALIDATION & REVIEW STEP (Requirement 3) */
                      <div className="space-y-4">
                        <div className="p-4 bg-stone-50 border border-stone-200 rounded-2xl space-y-3 text-xs">
                          <div className="flex items-center gap-2 pb-2 border-b border-stone-200 text-[#8B181B] font-bold uppercase tracking-wider">
                            <ShieldCheck className="w-4 h-4" />
                            <span>Employer Profile Validation Summary</span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <span className="text-stone-400 block text-[10px] uppercase font-bold">Company Name</span>
                              <span className="font-bold text-stone-900 text-sm">{companyName}</span>
                            </div>
                            <div>
                              <span className="text-stone-400 block text-[10px] uppercase font-bold">Industry Sector</span>
                              <span className="font-semibold text-stone-800">{companyIndustry}</span>
                            </div>
                            <div>
                              <span className="text-stone-400 block text-[10px] uppercase font-bold">Website</span>
                              <span className="text-stone-700">{companyWebsite || 'None specified'}</span>
                            </div>
                            <div>
                              <span className="text-stone-400 block text-[10px] uppercase font-bold">Headquarters</span>
                              <span className="text-stone-700">{companyAddress}</span>
                            </div>
                            <div>
                              <span className="text-stone-400 block text-[10px] uppercase font-bold">HR Representative</span>
                              <span className="font-semibold text-stone-900">{employerContactPerson}</span>
                            </div>
                            <div>
                              <span className="text-stone-400 block text-[10px] uppercase font-bold">Corporate Email</span>
                              <span className="font-semibold text-stone-900">{employerEmail}</span>
                            </div>
                            <div>
                              <span className="text-stone-400 block text-[10px] uppercase font-bold">Contact Phone</span>
                              <span className="text-stone-700">{employerPhone}</span>
                            </div>
                            <div>
                              <span className="text-stone-400 block text-[10px] uppercase font-bold">Target Access</span>
                              <span className="font-bold text-emerald-800">Employer Placement Hub</span>
                            </div>
                          </div>
                        </div>

                        {/* Affirmation Checklist */}
                        <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl text-[11px] text-stone-600 flex items-start gap-2">
                          <ShieldCheck className="w-4 h-4 text-[#8B181B] shrink-0 mt-0.5" />
                          <span>
                            I certify that all registered information is accurate and authorized by {companyName}. I understand accreditation takes 24 to 48 business hours.
                          </span>
                        </div>

                        {/* Step 2 Buttons: Edit or Confirm & Submit + Reset/Cancel */}
                        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => setEmployerStep(1)}
                            className="px-3.5 py-3 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-bold tracking-wider uppercase transition-colors cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={handleResetEmployerForm}
                            className="px-3 py-3 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                          >
                            Reset
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEmployerForm}
                            className="px-3 py-3 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={isSubmittingEmployer}
                            onClick={handleConfirmEmployerSubmit}
                            className="flex-1 py-3 bg-[#8B181B] hover:bg-[#721316] text-white rounded-xl text-xs font-bold tracking-wider uppercase transition-all shadow-md shadow-red-950/20 hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                          >
                            {isSubmittingEmployer ? (
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <>
                                <CheckCircle2 className="w-4 h-4" />
                                <span>CONFIRM & SUBMIT</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Switch to sign in */}
                    <div className="text-center pt-4 text-xs text-stone-500">
                      Already registered?{' '}
                      <button
                        type="button"
                        onClick={() => setMode('login')}
                        className="text-[#8B181B] font-bold hover:underline cursor-pointer"
                      >
                        Sign In Here
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* NOTICE BANNER: ALUMNI-ONLY REGISTRATION (Desktop Step 1) */}
                    {step === 1 && (
                      <div className="hidden lg:flex mb-5 p-3 rounded-xl bg-amber-50/90 border border-amber-200 text-amber-900 text-xs items-start gap-2.5">
                        <GraduationCap className="w-4 h-4 text-[#8B181B] shrink-0 mt-0.5" />
                        <div className="leading-snug">
                          <span className="font-bold">Official Cecilian Alumni Registration:</span>{' '}
                          <span>
                            Exclusively for graduates and alumni of St. Cecilia’s College. Faculty, staff, and administrators receive pre-configured credentials directly from the Registrar and IT Services.
                          </span>
                        </div>
                      </div>
                    )}

                {/* Multi-Step Animated Progress Indicator */}
                <div className="mb-6 pt-1">
                  <div className="flex items-center justify-between relative">
                    {/* Step 1 Pill */}
                    <div className="flex flex-col items-center gap-1 z-10">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                          step === 1
                            ? 'bg-[#8B181B] text-white ring-4 ring-[#8B181B]/15 shadow-sm'
                            : step > 1
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-stone-200 text-stone-600'
                        }`}
                      >
                        {step > 1 ? <Check className="w-4 h-4 stroke-[2.5]" /> : '1'}
                      </div>
                      <span
                        className={`text-[11px] tracking-tight transition-colors ${
                          step === 1
                            ? 'text-[#8B181B] font-bold'
                            : step > 1
                            ? 'text-emerald-700 font-semibold'
                            : 'text-stone-400 font-medium'
                        }`}
                      >
                        Verify Student ID
                      </span>
                    </div>

                    {/* Connecting Track 1 -> 2 */}
                    <div className="flex-1 h-0.5 mx-2 bg-stone-200 relative -top-3">
                      <div
                        className="h-full bg-emerald-600 transition-all duration-500 ease-out"
                        style={{ width: step > 1 ? '100%' : '0%' }}
                      />
                    </div>

                    {/* Step 2 Pill */}
                    <div className="flex flex-col items-center gap-1 z-10">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                          step === 2
                            ? 'bg-[#8B181B] text-white ring-4 ring-[#8B181B]/15 shadow-sm'
                            : step > 2
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-stone-100 border border-stone-300 text-stone-500'
                        }`}
                      >
                        {step > 2 ? <Check className="w-4 h-4 stroke-[2.5]" /> : '2'}
                      </div>
                      <span
                        className={`text-[11px] tracking-tight transition-colors ${
                          step === 2
                            ? 'text-[#8B181B] font-bold'
                            : step > 2
                            ? 'text-emerald-700 font-semibold'
                            : 'text-stone-400 font-medium'
                        }`}
                      >
                        Account Setup
                      </span>
                    </div>

                    {/* Connecting Track 2 -> 3 */}
                    <div className="flex-1 h-0.5 mx-2 bg-stone-200 relative -top-3">
                      <div
                        className="h-full bg-emerald-600 transition-all duration-500 ease-out"
                        style={{ width: step > 2 ? '100%' : '0%' }}
                      />
                    </div>

                    {/* Step 3 Pill */}
                    <div className="flex flex-col items-center gap-1 z-10">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                          step === 3
                            ? 'bg-[#8B181B] text-white ring-4 ring-[#8B181B]/15 shadow-sm'
                            : 'bg-stone-100 border border-stone-300 text-stone-500'
                        }`}
                      >
                        3
                      </div>
                      <span
                        className={`text-[11px] tracking-tight transition-colors ${
                          step === 3 ? 'text-[#8B181B] font-bold' : 'text-stone-400 font-medium'
                        }`}
                      >
                        Review & Pledge
                      </span>
                    </div>
                  </div>
                </div>

                {/* STEP 1: ONLY STUDENT ID COLLECTED & AUTHENTICATE OWNERSHIP */}
                {step === 1 && (
                  <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="mb-4">
                      <div className="editorial-kicker flex items-center gap-1.5 mb-1">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Step 1 of 3 · Official Alumni Verification</span>
                      </div>
                      <h2 className="editorial-title text-2xl sm:text-3xl font-normal mb-1">
                        Verify <span className="editorial-accent italic">Student ID</span>
                      </h2>
                      <p className="editorial-sub text-xs sm:text-sm leading-relaxed">
                        Enter your official St. Cecilia’s College Student ID number to authenticate your graduation record with the Registrar.
                      </p>
                    </div>

                    {screeningError && (
                      <div className="mb-4 p-3.5 rounded-xl bg-red-50 text-red-800 text-xs border border-red-200/80 flex items-start gap-2.5 animate-in fade-in">
                        <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <span className="font-semibold block mb-0.5">Verification Notice</span>
                          <p className="leading-relaxed">{screeningError}</p>
                          {!screeningError.toLowerCase().includes('already registered') && (
                            <button
                              type="button"
                              onClick={() => handleOpenManualVerification()}
                              className="mt-2 text-xs font-bold text-[#8B181B] hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>Request manual registrar record review & verification appeal</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Duplicate Account Alert with direct 1-click Sign In & Dispute Trigger */}
                    {screeningError && screeningError.toLowerCase().includes('already registered') && (
                      <div className="mb-4 p-4 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs flex flex-col gap-2.5 animate-in fade-in">
                        <div className="flex items-center gap-2 font-bold text-amber-800">
                          <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                          <span>Student ID Already Registered</span>
                        </div>
                        <p className="text-amber-800 text-[11px] leading-relaxed">
                          An active alumni account with Student ID <strong>{studentId}</strong> is already registered. If this is your account, please sign in. If someone else claimed your ID or this is an unauthorized duplicate, you can submit an official conflict dispute to the Registrar.
                        </p>
                        <div className="flex flex-wrap items-center gap-2 pt-0.5">
                          <button
                            type="button"
                            onClick={() => {
                              setLoginIdentifier(studentId);
                              setMode('login');
                            }}
                            className="px-3.5 py-2 bg-amber-800 hover:bg-amber-900 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-xs hover:shadow-sm"
                          >
                            <span>Sign In With Student ID</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenDispute(studentId)}
                            className="px-3.5 py-2 bg-white hover:bg-amber-100 text-amber-950 border border-amber-300 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-2xs hover:border-amber-400"
                          >
                            <Scale className="w-3.5 h-3.5 text-amber-700" />
                            <span>Dispute Claim (Trigger Conflict)</span>
                          </button>
                        </div>
                      </div>
                    )}

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleProceedFromStep1ToStep2();
                      }}
                      className="space-y-4"
                    >
                      {/* Student ID Field with Interactive Hover Popup */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider">
                              Student ID Number <span className="text-red-600">*</span>
                            </label>

                            {/* Hover Tooltip Popover */}
                            <div className="relative group/tooltip">
                              <button
                                type="button"
                                className="text-stone-400 hover:text-[#8B181B] transition-colors p-0.5 rounded-full hover:bg-stone-100 cursor-help"
                                aria-label="Student ID help"
                              >
                                <HelpCircle className="w-3.5 h-3.5" />
                              </button>
                              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-72 p-3.5 bg-stone-900 text-stone-100 text-[11px] rounded-xl shadow-2xl pointer-events-none opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 z-50 transform translate-y-1 group-hover/tooltip:translate-y-0 border border-stone-800">
                                <div className="font-semibold text-white mb-1 flex items-center gap-1.5">
                                  <School className="w-3.5 h-3.5 text-amber-400" />
                                  <span>Where to find your Student ID?</span>
                                </div>
                                <p className="text-stone-300 leading-relaxed mb-2">
                                  Your official Student ID is printed on your SCC Student/Alumni Card, Official Transcript of Records (TOR), or graduation diploma.
                                </p>
                                <div className="p-1.5 bg-stone-800/90 rounded-lg font-mono text-[10px] text-amber-300 flex items-center justify-between gap-2">
                                  <span>SCC-YY-XXXXXXXX / SCC-YYYY-XXXX</span>
                                  <span className="text-stone-400">e.g. SCC-22-00017358</span>
                                </div>
                                <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-stone-900" />
                              </div>
                            </div>
                          </div>

                          <span className="text-[10px] text-stone-400 font-mono">
                            SCC-22-00017358 / SCC-2020-0192
                          </span>
                        </div>

                        <div className="relative">
                          <input
                            type="text"
                            required
                            value={studentId}
                            onChange={(e) => {
                              const val = e.target.value;
                              setStudentId(val);
                              if (studentVerificationStatus !== 'idle') {
                                setStudentVerificationStatus('idle');
                                setVerificationMessage('');
                              }
                            }}
                            placeholder="e.g. SCC-22-00017358 or SCC-2020-0192"
                            className={`w-full min-h-[48px] pl-4 pr-10 py-3 bg-[#F3F4F6] dark:bg-[#262626] lg:bg-white lg:dark:bg-stone-900 text-[#111827] dark:text-[#FAFAFA] placeholder:text-[#737373] dark:placeholder:text-[#A8A8A8] border rounded-xl text-base lg:text-sm font-mono tracking-wide transition-all shadow-2xs ${
                              studentVerificationStatus === 'verified'
                                ? 'border-emerald-500 ring-2 ring-emerald-500/20 font-semibold'
                                : studentVerificationStatus === 'failed'
                                ? 'border-red-400 ring-2 ring-red-400/20'
                                : 'border-transparent lg:border-stone-200 lg:dark:border-stone-700 focus:border-[#8B181B] focus:ring-2 focus:ring-[#8B181B]/15'
                            }`}
                          />
                          {studentVerificationStatus === 'verified' && (
                            <Check className="w-4 h-4 text-emerald-600 absolute right-3.5 top-1/2 -translate-y-1/2 stroke-[2.5]" />
                          )}
                        </div>
                      </div>

                      {/* Verify & Authenticate Ownership Button */}
                      <button
                        type="button"
                        disabled={studentVerificationStatus === 'checking' || !studentId.trim()}
                        onClick={() => handleVerifyStudentClick()}
                        className={`w-full min-h-[48px] lg:min-h-[44px] py-3 px-4 rounded-xl text-[14px] lg:text-xs font-semibold lg:tracking-wider lg:uppercase flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer ${
                          studentVerificationStatus === 'verified'
                            ? 'ds-btn-secondary'
                            : 'bg-[#8B181B] dark:bg-[#E11D48] text-white lg:ds-btn-primary active:opacity-85'
                        }`}
                      >
                        {studentVerificationStatus === 'checking' ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin text-amber-300" />
                            <span>Verifying with Registrar Records...</span>
                          </>
                        ) : (
                          <>
                            <ShieldCheck className={`w-4 h-4 ${studentVerificationStatus === 'verified' ? 'text-emerald-600' : 'text-amber-300'}`} />
                            <span>{studentVerificationStatus === 'verified' ? 'Re-verify Student Record' : 'Verify & Authenticate Ownership'}</span>
                          </>
                        )}
                      </button>

                      {/* No Student ID / Unlisted Record Helper Card */}
                      <div className="p-3.5 bg-[#F3F4F6] dark:bg-[#1C1C1E] lg:bg-stone-50 border border-[#EFEFEF] dark:border-[#262626] lg:border-stone-200 rounded-2xl flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <HelpCircle className="w-4 h-4 text-[#737373] dark:text-[#A8A8A8] shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <span className="font-bold text-[#111827] dark:text-[#FAFAFA] block leading-snug">
                              No Student ID or graduated before digital records?
                            </span>
                            <span className="text-[11px] text-[#737373] dark:text-[#A8A8A8] block leading-tight mt-0.5">
                              Submit a direct verification appeal to the Registrar.
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenManualVerification()}
                          className="shrink-0 min-h-[44px] px-3.5 py-2 bg-white dark:bg-[#262626] hover:bg-stone-100 text-[#111827] dark:text-[#FAFAFA] border border-[#E5E7EB] dark:border-[#3A3A3C] rounded-xl text-xs font-bold transition-all cursor-pointer"
                        >
                          Request Appeal
                        </button>
                      </div>

                      {/* Verified Record Display & Continue Button */}
                      {studentVerificationStatus === 'verified' && verifiedRecord && (
                        <div className="p-4 bg-emerald-50/90 border border-emerald-200 rounded-2xl space-y-3.5 animate-in fade-in slide-in-from-bottom-2 duration-300 shadow-sm">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span>Identity Record Authenticated</span>
                            </div>
                            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 uppercase tracking-wider">
                              Registrar Confirmed
                            </span>
                          </div>

                          <div className="p-3 bg-white/95 border border-emerald-100 rounded-xl space-y-1.5 shadow-2xs">
                            <div>
                              <span className="text-[10px] text-stone-400 font-semibold uppercase block">
                                Official Student Record
                              </span>
                              <span className="text-sm font-bold text-stone-900">
                                {verifiedRecord.fullName}
                              </span>
                            </div>
                            <div className="pt-1.5 border-t border-stone-100 flex flex-wrap items-center justify-between text-xs text-stone-600 gap-1">
                              <span className="font-medium text-stone-700">{verifiedRecord.course}</span>
                              <span className="font-semibold text-stone-900">Class of {verifiedRecord.batchYear}</span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={handleProceedFromStep1ToStep2}
                            className="ds-btn-primary w-full min-h-[44px] py-3 tracking-wider uppercase group"
                          >
                            <span>Continue to Account Setup</span>
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                          </button>
                        </div>
                      )}

                      {/* Explicit Reset and Cancel Form Buttons */}
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-stone-100">
                        <button
                          type="button"
                          onClick={handleResetAlumniForm}
                          className="px-3 py-1.5 text-xs font-semibold text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors cursor-pointer"
                        >
                          Reset Form
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelAlumniForm}
                          className="px-3 py-1.5 text-xs font-semibold text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>

                      {/* Bottom Switcher */}
                      <div className="text-center pt-2 text-xs text-stone-500">
                        Already have an alumni account?{' '}
                        <button
                          type="button"
                          onClick={() => setMode('login')}
                          className="text-[#8B181B] font-bold hover:underline cursor-pointer"
                        >
                          Sign In
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* STEP 2: ACCOUNT CREDENTIALS (NAME CANNOT BE MODIFIED, DISPLAYS ID RECORD) */}
                {step === 2 && (
                  <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="mb-4">
                      <div className="editorial-kicker flex items-center gap-1.5 mb-1">
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Step 2 of 3 · Account Setup</span>
                      </div>
                      <h2 className="editorial-title text-2xl sm:text-3xl font-normal mb-1">
                        Account <span className="editorial-accent italic">Credentials</span>
                      </h2>
                      <p className="editorial-sub text-xs sm:text-sm leading-relaxed">
                        Your identity has been verified. Set up your portal login credentials below.
                      </p>
                    </div>

                    {/* Section 1: Official Verified Identity (Streamlined Compact Card) */}
                    <div className="mb-4 p-3.5 bg-stone-50 border border-stone-200/90 rounded-2xl shadow-2xs">
                      <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-stone-200/70">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-stone-800">
                          <ShieldCheck className="w-4 h-4 text-emerald-600" />
                          <span>Registrar Verified Identity</span>
                        </div>
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-stone-200/80 text-[10px] font-bold text-stone-700">
                          <Lock className="w-2.5 h-2.5 text-stone-500" />
                          <span>Locked</span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="text-sm font-bold text-stone-900 tracking-tight">
                          {verifiedRecord?.fullName || `${firstName} ${lastName}`.trim()}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-stone-600">
                          <span className="font-medium">Class of {verifiedRecord?.batchYear || batch}</span>
                          <span className="text-stone-300">•</span>
                          <span className="font-medium text-stone-700 truncate">{verifiedRecord?.course || course}</span>
                        </div>
                        <div className="pt-1 flex items-center justify-between text-[11px]">
                          <span className="text-stone-500">Official Alumni ID:</span>
                          <span className="font-mono font-bold text-[#8B181B] bg-red-50 px-2 py-0.5 rounded border border-red-200/60">
                            {previewAlumniId}
                          </span>
                        </div>
                      </div>
                    </div>

                    {step2Error && (
                      <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-800 text-xs border border-red-200/80 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                        <span>{step2Error}</span>
                      </div>
                    )}

                    <form onSubmit={handleProceedFromStep2ToStep3} className="space-y-4">
                      {/* Section 2: Account Login Credentials */}
                      <div className="p-4 bg-white rounded-2xl border border-stone-200/90 shadow-2xs space-y-3.5">
                        <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                          <KeyRound className="w-3.5 h-3.5 text-[#8B181B]" />
                          <span>Portal Login Credentials</span>
                        </h4>

                        {/* Email Address */}
                        <div>
                          <label className="block text-[12px] lg:text-[11px] font-bold text-[#111827] dark:text-[#FAFAFA] lg:text-stone-700 lg:uppercase lg:tracking-wider mb-1">
                            Email Address <span className="text-red-600">*</span>
                          </label>
                          <div className="relative">
                            <input
                              type="email"
                              required
                              value={regEmail}
                              onChange={(e) => setRegEmail(e.target.value)}
                              placeholder="e.g. juan.delacruz@alumni.stcecilia.edu"
                              className="w-full min-h-[48px] lg:min-h-[42px] pl-10 pr-4 py-2.5 bg-[#F3F4F6] dark:bg-[#262626] lg:bg-stone-50/50 lg:hover:bg-white lg:focus:bg-white border border-transparent lg:border-stone-200 rounded-xl text-base lg:text-sm text-[#111827] dark:text-[#FAFAFA] focus:border-[#8B181B] focus:ring-2 focus:ring-[#8B181B]/15 transition-all"
                            />
                            <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                          </div>
                        </div>

                        {/* Password with clean inline criteria */}
                        <div>
                          <label className="block text-[12px] lg:text-[11px] font-bold text-[#111827] dark:text-[#FAFAFA] lg:text-stone-700 lg:uppercase lg:tracking-wider mb-1">
                            Create Password <span className="text-red-600">*</span>
                          </label>
                          <div className="relative">
                            <input
                              type={showRegPassword ? 'text' : 'password'}
                              required
                              value={regPassword}
                              onChange={(e) => setRegPassword(e.target.value)}
                              placeholder="••••••••••••"
                              className="w-full min-h-[48px] lg:min-h-[42px] pl-10 pr-12 py-2.5 bg-[#F3F4F6] dark:bg-[#262626] lg:bg-stone-50/50 lg:hover:bg-white lg:focus:bg-white border border-transparent lg:border-stone-200 rounded-xl text-base lg:text-sm text-[#111827] dark:text-[#FAFAFA] focus:border-[#8B181B] focus:ring-2 focus:ring-[#8B181B]/15 transition-all"
                            />
                            <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                            <button
                              type="button"
                              onClick={() => setShowRegPassword(!showRegPassword)}
                              className="absolute right-1 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors cursor-pointer"
                              aria-label={showRegPassword ? 'Hide password' : 'Show password'}
                            >
                              {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>

                          {/* Inline requirement indicators */}
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 px-0.5 text-[11px]">
                            <span className={`inline-flex items-center gap-1 ${hasMinLength ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-stone-400'}`}>
                              <span>{hasMinLength ? '✓' : '•'}</span> 8+ chars
                            </span>
                            <span className={`inline-flex items-center gap-1 ${hasUppercase ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-stone-400'}`}>
                              <span>{hasUppercase ? '✓' : '•'}</span> Uppercase
                            </span>
                            <span className={`inline-flex items-center gap-1 ${hasNumber ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-stone-400'}`}>
                              <span>{hasNumber ? '✓' : '•'}</span> Number
                            </span>
                          </div>
                        </div>

                        {/* Confirm Password */}
                        <div>
                          <label className="block text-[12px] lg:text-[11px] font-bold text-[#111827] dark:text-[#FAFAFA] lg:text-stone-700 lg:uppercase lg:tracking-wider mb-1">
                            Confirm Password <span className="text-red-600">*</span>
                          </label>
                          <div className="relative">
                            <input
                              type={showConfirmPassword ? 'text' : 'password'}
                              required
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              placeholder="••••••••••••"
                              className={`w-full min-h-[48px] lg:min-h-[42px] pl-10 pr-12 py-2.5 rounded-xl text-base lg:text-sm transition-all ${
                                confirmPassword && confirmPassword === regPassword
                                  ? 'bg-emerald-50/20 dark:bg-emerald-950/20 border border-emerald-500 text-emerald-950 dark:text-emerald-100 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20'
                                  : confirmPassword && confirmPassword !== regPassword
                                  ? 'bg-red-50/20 dark:bg-red-950/20 border border-red-400 text-red-950 dark:text-red-100 focus:border-red-500 focus:ring-2 focus:ring-red-500/20'
                                  : 'bg-[#F3F4F6] dark:bg-[#262626] lg:bg-stone-50/50 border border-transparent lg:border-stone-200 text-[#111827] dark:text-[#FAFAFA] focus:border-[#8B181B] focus:ring-2 focus:ring-[#8B181B]/15'
                              }`}
                            />
                            <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              className="absolute right-1 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors cursor-pointer"
                              aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                            >
                              {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          {confirmPassword && confirmPassword === regPassword && (
                            <div className="flex items-center gap-1 mt-1 text-[11px] font-semibold text-emerald-600">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Passwords match</span>
                            </div>
                          )}
                          {confirmPassword && confirmPassword !== regPassword && (
                            <div className="flex items-center gap-1 mt-1 text-[11px] font-semibold text-red-500">
                              <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                              <span>Passwords do not match</span>
                            </div>
                          )}
                        </div>

                        {/* Account Classification */}
                        <div className="pt-1">
                          <label className="block text-[11px] font-bold text-stone-700 dark:text-[#A8A8A8] uppercase tracking-wider mb-1.5">
                            Account Classification
                          </label>
                          <div className="p-2.5 bg-red-50/80 dark:bg-[#1C1C1E] border border-red-200/60 dark:border-[#262626] rounded-xl flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <GraduationCap className="w-4 h-4 text-[#8B181B] dark:text-[#FB7185]" />
                              <div>
                                <span className="text-xs font-bold text-stone-900 dark:text-[#FAFAFA] block leading-tight">
                                  Graduated Alumnus
                                </span>
                                <span className="text-[10px] text-stone-500 dark:text-[#A8A8A8]">
                                  Registrar verified • Class of {verifiedRecord?.batchYear || batch}
                                </span>
                              </div>
                            </div>
                            <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200">
                              Graduate Exclusive
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Section 3: Professional & Contact Details (Mandatory) */}
                      <div className="p-4 bg-[#F9FAFB] dark:bg-[#121212] lg:bg-stone-50/70 rounded-2xl border border-[#EFEFEF] dark:border-[#262626] lg:border-stone-200/80 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-stone-800 dark:text-[#FAFAFA] uppercase tracking-wider flex items-center gap-1.5">
                            <Briefcase className="w-3.5 h-3.5 text-[#8B181B] dark:text-[#FB7185]" />
                            <span>Professional Profile & Contact Details</span>
                          </h4>
                        </div>

                        <div>
                          <label className="block text-[12px] lg:text-[11px] font-bold text-stone-700 dark:text-[#FAFAFA] uppercase tracking-wider mb-1">
                            Current Employment Status <span className="text-red-600">*</span>
                          </label>
                          <select
                            required
                            value={regEmploymentStatus}
                            onChange={(e) => setRegEmploymentStatus(e.target.value)}
                            className="w-full min-h-[46px] lg:min-h-[38px] px-3 py-2 bg-white dark:bg-[#262626] border border-stone-200 dark:border-[#3A3A3C] rounded-xl text-base lg:text-xs font-semibold text-stone-800 dark:text-[#FAFAFA] focus:outline-hidden focus:border-[#8B181B]"
                          >
                            <option value="Employed">Employed</option>
                            <option value="Self-employed">Self-employed</option>
                            <option value="Seeking Opportunities">Seeking Opportunities</option>
                            <option value="Student / Continuing Studies">Student / Continuing Studies</option>
                            <option value="Retired">Retired</option>
                            <option value="N/A">Not Applicable (N/A)</option>
                          </select>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div>
                            <label className="block text-[11px] font-medium text-stone-600 dark:text-[#A8A8A8] mb-1">
                              Current Role / Position {regEmploymentStatus === 'N/A' || regEmploymentStatus === 'Retired' ? '(Disabled)' : ''}
                            </label>
                            <input
                              type="text"
                              disabled={regEmploymentStatus === 'N/A' || regEmploymentStatus === 'Retired'}
                              value={regPosition}
                              onChange={(e) => setRegPosition(e.target.value)}
                              placeholder="e.g. Software Engineer, Teacher, N/A"
                              className="w-full min-h-[46px] lg:min-h-[38px] px-3 py-2 bg-white dark:bg-[#262626] border border-stone-200 dark:border-[#3A3A3C] rounded-xl text-base lg:text-xs text-[#111827] dark:text-[#FAFAFA] disabled:bg-stone-100 dark:disabled:bg-[#1C1C1E] disabled:cursor-not-allowed"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-stone-600 dark:text-[#A8A8A8] mb-1">
                              Company / Organization {regEmploymentStatus === 'N/A' || regEmploymentStatus === 'Retired' ? '(Disabled)' : ''}
                            </label>
                            <input
                              type="text"
                              disabled={regEmploymentStatus === 'N/A' || regEmploymentStatus === 'Retired'}
                              value={regCompany}
                              onChange={(e) => setRegCompany(e.target.value)}
                              placeholder="e.g. DepEd, Tech Corp, N/A"
                              className="w-full min-h-[46px] lg:min-h-[38px] px-3 py-2 bg-white dark:bg-[#262626] border border-stone-200 dark:border-[#3A3A3C] rounded-xl text-base lg:text-xs text-[#111827] dark:text-[#FAFAFA] disabled:bg-stone-100 dark:disabled:bg-[#1C1C1E] disabled:cursor-not-allowed"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                          <div>
                            <label className="block text-[11px] font-bold text-stone-700 dark:text-[#FAFAFA] uppercase tracking-wider mb-1">
                              Contact Number <span className="text-red-600">*</span>
                            </label>
                            <input
                              type="tel"
                              required
                              maxLength={11}
                              value={phone}
                              onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '').slice(0, 11);
                                setPhone(val);
                                if (step2Error) setStep2Error('');
                              }}
                              placeholder="09123456789"
                              className={`w-full min-h-[46px] lg:min-h-[38px] px-3 py-2 bg-white dark:bg-[#262626] border rounded-xl text-base lg:text-xs text-[#111827] dark:text-[#FAFAFA] ${
                                phone && (!phone.startsWith('09') || phone.length !== 11)
                                  ? 'border-red-400 focus:border-red-500'
                                  : phone && phone.startsWith('09') && phone.length === 11
                                  ? 'border-emerald-500 focus:border-emerald-600'
                                  : 'border-stone-200 dark:border-[#3A3A3C] focus:border-[#8B181B]'
                              }`}
                            />
                            <span className="text-[10px] text-stone-400 mt-0.5 block">11 digits starting with 09 (e.g. 09123456789)</span>
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-stone-600 dark:text-[#A8A8A8] mb-1">
                              City / Residence <span className="text-stone-400 font-normal">(optional)</span>
                            </label>
                            <input
                              type="text"
                              value={location}
                              onChange={(e) => setLocation(e.target.value)}
                              placeholder="Minglanilla, Cebu"
                              className="w-full min-h-[46px] lg:min-h-[38px] px-3 py-2 bg-white dark:bg-[#262626] border border-stone-200 dark:border-[#3A3A3C] rounded-xl text-base lg:text-xs text-[#111827] dark:text-[#FAFAFA]"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap sm:flex-nowrap gap-2 pt-3">
                        <button
                          type="button"
                          onClick={() => setStep(1)}
                          className="ds-btn-secondary px-3.5 py-2.5 min-h-[44px]"
                        >
                          Back
                        </button>
                        <button
                          type="button"
                          onClick={handleResetAlumniForm}
                          className="ds-btn-ghost px-3 py-2.5 min-h-[44px]"
                        >
                          Reset
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelAlumniForm}
                          className="ds-btn-ghost px-3 py-2.5 min-h-[44px]"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="ds-btn-primary flex-1 min-h-[48px] lg:min-h-[44px] py-2.5 tracking-wider uppercase group"
                        >
                          <span>Review & Pledge</span>
                          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* STEP 3: REVIEW APPLICATION & CECILIAN ALUMNI PLEDGE */}
                {step === 3 && (
                  <div>
                    <div className="editorial-kicker flex items-center gap-1.5 mb-1">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Step 3 of 3 · Final Verification & Covenants</span>
                    </div>
                    <h2 className="editorial-title text-2xl sm:text-3xl font-normal mb-1">
                      Review <span className="editorial-accent italic">& Honor Pledge</span>
                    </h2>
                    <p className="editorial-sub text-xs sm:text-sm mb-4">
                      Verify your alumni credentials before submitting to St. Cecilia’s College alumni portal.
                    </p>

                    {/* Pending Review Timeframe Notice (Requirement 5) */}
                    <div className="mb-4 p-3 rounded-xl bg-amber-50/90 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                      <Clock className="w-4 h-4 text-[#8B181B] shrink-0 mt-0.5" />
                      <div className="leading-snug">
                        <span className="font-bold">Registrar Review Timeframe:</span>{' '}
                        <span>
                          Account verification against official college archives is processed within <strong>24 to 48 business hours</strong>.
                        </span>
                      </div>
                    </div>

                    <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 space-y-3 text-xs mb-5">
                      <div className="flex justify-between border-b border-stone-200 pb-2">
                        <span className="text-stone-500">Official Alumni ID</span>
                        <div className="text-right">
                          <span className="font-mono font-bold text-[#8B181B] text-sm">{previewAlumniId}</span>
                          <span className="text-[10px] text-stone-500 block font-mono">Academic Student ID: {studentId}</span>
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-bold block">
                            <Check className="w-3 h-3 text-emerald-600 inline" />
                            Official Registrar Screened
                          </span>
                        </div>
                      </div>
                      <div className="flex justify-between border-b border-stone-200 pb-2">
                        <span className="text-stone-500">Alumnus Name</span>
                        <span className="font-bold text-stone-900">{firstName} {lastName}</span>
                      </div>
                      <div className="flex justify-between border-b border-stone-200 pb-2">
                        <span className="text-stone-500">Degree & Batch</span>
                        <span className="font-semibold text-stone-800">{course} • Class of {batch}</span>
                      </div>
                      <div className="flex justify-between border-b border-stone-200 pb-2">
                        <span className="text-stone-500">Portal Email</span>
                        <span className="font-semibold text-stone-800">{regEmail}</span>
                      </div>
                      <div className="flex justify-between border-b border-stone-200 pb-2">
                        <span className="text-stone-500">Residence</span>
                        <span className="text-stone-800">{location || 'Cebu, Philippines'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-stone-500">Community Role</span>
                        <span className="font-bold uppercase text-[#8B181B] bg-red-50 px-2 py-0.5 rounded border border-red-200">
                          Alumni Member
                        </span>
                      </div>
                    </div>

                    {/* DATA PRIVACY ACT & INSTITUTIONAL COMPLIANCE SECTION */}
                    <div className="p-4 sm:p-5 bg-stone-50/70 border border-stone-200/90 rounded-2xl mb-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
                      {/* Section Header with All-Select Action */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 mb-3.5 border-b border-stone-200/80">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-red-100/80 text-[#8B181B] flex items-center justify-center shrink-0">
                            <ShieldCheck className="w-4 h-4" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-stone-900 text-xs sm:text-sm">
                              Compliance & Institutional Covenants
                            </h3>
                            <p className="text-[11px] text-stone-500">
                              Data Privacy Act (RA 10173) & Cecilian Directory Governance
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-2.5">
                          <span className="text-[11px] font-medium">
                            {allConsentsAgreed ? (
                              <span className="text-emerald-700 font-semibold inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                All 3 confirmed
                              </span>
                            ) : (
                              <span className="text-stone-500">
                                {(agreedToPrivacyConsent ? 1 : 0) + (agreedToZeroDisclosure ? 1 : 0) + (agreedToTerms ? 1 : 0)} of 3 confirmed
                              </span>
                            )}
                          </span>
                          <button
                            type="button"
                            onClick={toggleAllConsents}
                            className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-stone-200 bg-white text-stone-700 hover:text-[#8B181B] hover:border-red-200 hover:bg-red-50/30 transition-all cursor-pointer shadow-2xs"
                          >
                            {allConsentsAgreed ? 'Clear All' : 'Agree to All'}
                          </button>
                        </div>
                      </div>

                      {/* 3 Structured Consent Cards */}
                      <div className="space-y-2.5">
                        {/* 1. Data Privacy Act (RA 10173) */}
                        <div
                          role="checkbox"
                          tabIndex={0}
                          aria-checked={agreedToPrivacyConsent}
                          onClick={() => setAgreedToPrivacyConsent(!agreedToPrivacyConsent)}
                          onKeyDown={(e) => {
                            if (e.key === ' ' || e.key === 'Enter') {
                              e.preventDefault();
                              setAgreedToPrivacyConsent(!agreedToPrivacyConsent);
                            }
                          }}
                          className={`group relative p-3.5 rounded-xl border transition-all duration-150 cursor-pointer select-none ${
                            agreedToPrivacyConsent
                              ? 'bg-red-50/30 border-red-200/90 shadow-2xs'
                              : 'bg-white border-stone-200 hover:border-stone-300 hover:bg-stone-50/50'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="pt-0.5 shrink-0">
                              <div
                                className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                                  agreedToPrivacyConsent
                                    ? 'bg-[#8B181B] border-[#8B181B] text-white shadow-2xs'
                                    : 'border-stone-300 bg-white group-hover:border-stone-400'
                                }`}
                              >
                                {agreedToPrivacyConsent && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1">
                                <span className="font-semibold text-stone-900 text-xs sm:text-sm">
                                  Data Privacy Consent (RA 10173)
                                </span>
                                <span className="text-[10px] font-medium tracking-wide uppercase px-2 py-0.5 rounded-md bg-stone-100 text-stone-600">
                                  Required by Law
                                </span>
                              </div>
                              <p className="text-xs text-stone-600 leading-relaxed">
                                I consent to the collection, secure storage, and institutional processing of my academic, graduation, and tracer records by St. Cecilia’s College - Cebu, Inc. strictly for official alumni records and CHED compliance.
                              </p>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowPrivacyDetails(!showPrivacyDetails);
                                }}
                                className="mt-2 text-[11px] font-medium text-[#8B181B] hover:text-[#721316] inline-flex items-center gap-1 cursor-pointer transition-colors"
                              >
                                <span>{showPrivacyDetails ? 'Hide details' : 'View official purposes & statutory safeguards'}</span>
                                {showPrivacyDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </button>

                              {showPrivacyDetails && (
                                <div
                                  onClick={(e) => e.stopPropagation()}
                                  className="mt-2.5 pt-2.5 border-t border-stone-200/70 text-[11px] text-stone-600 space-y-1.5"
                                >
                                  <p className="font-medium text-stone-700">Official Institutional Scope under RA 10173:</p>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1.5 pt-0.5">
                                    <div className="flex items-center gap-1.5">
                                      <span className="w-1.5 h-1.5 rounded-full bg-[#8B181B] shrink-0" />
                                      <span>Alumni record & registrar verification</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="w-1.5 h-1.5 rounded-full bg-[#8B181B] shrink-0" />
                                      <span>Official college communications</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="w-1.5 h-1.5 rounded-full bg-[#8B181B] shrink-0" />
                                      <span>Reunions, convocations & campus events</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="w-1.5 h-1.5 rounded-full bg-[#8B181B] shrink-0" />
                                      <span>CHED graduate tracer study reporting</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="w-1.5 h-1.5 rounded-full bg-[#8B181B] shrink-0" />
                                      <span>Career placement & professional tracking</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="w-1.5 h-1.5 rounded-full bg-[#8B181B] shrink-0" />
                                      <span>Zero commercial sharing / marketing guarantee</span>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* 2. Zero Disclosure & Confidentiality */}
                        <div
                          role="checkbox"
                          tabIndex={0}
                          aria-checked={agreedToZeroDisclosure}
                          onClick={() => setAgreedToZeroDisclosure(!agreedToZeroDisclosure)}
                          onKeyDown={(e) => {
                            if (e.key === ' ' || e.key === 'Enter') {
                              e.preventDefault();
                              setAgreedToZeroDisclosure(!agreedToZeroDisclosure);
                            }
                          }}
                          className={`group relative p-3.5 rounded-xl border transition-all duration-150 cursor-pointer select-none ${
                            agreedToZeroDisclosure
                              ? 'bg-red-50/30 border-red-200/90 shadow-2xs'
                              : 'bg-white border-stone-200 hover:border-stone-300 hover:bg-stone-50/50'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="pt-0.5 shrink-0">
                              <div
                                className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                                  agreedToZeroDisclosure
                                    ? 'bg-[#8B181B] border-[#8B181B] text-white shadow-2xs'
                                    : 'border-stone-300 bg-white group-hover:border-stone-400'
                                }`}
                              >
                                {agreedToZeroDisclosure && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1">
                                <span className="font-semibold text-stone-900 text-xs sm:text-sm">
                                  Zero Disclosure & Directory Confidentiality
                                </span>
                                <span className="text-[10px] font-medium tracking-wide uppercase px-2 py-0.5 rounded-md bg-stone-100 text-stone-600">
                                  Directory Covenant
                                </span>
                              </div>
                              <p className="text-xs text-stone-600 leading-relaxed">
                                I agree to protect fellow Cecilians' directory privacy and pledge never to disclose, scrape, export, or commercially distribute alumni profiles, phone numbers, or contact records.
                              </p>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowZeroDisclosureDetails(!showZeroDisclosureDetails);
                                }}
                                className="mt-2 text-[11px] font-medium text-[#8B181B] hover:text-[#721316] inline-flex items-center gap-1 cursor-pointer transition-colors"
                              >
                                <span>{showZeroDisclosureDetails ? 'Hide details' : 'View directory terms & safeguards'}</span>
                                {showZeroDisclosureDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </button>

                              {showZeroDisclosureDetails && (
                                <div
                                  onClick={(e) => e.stopPropagation()}
                                  className="mt-2.5 pt-2.5 border-t border-stone-200/70 text-[11px] text-stone-600 leading-relaxed"
                                >
                                  Member contact records, phone numbers, and graduation credentials are provided strictly for collegiate networking and campus engagement. Automated crawling, third-party marketing solicitation, and bulk extraction are strictly prohibited under institutional cybersecurity guidelines.
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* 3. Cecilian Alumni Honor Pledge */}
                        <div
                          role="checkbox"
                          tabIndex={0}
                          aria-checked={agreedToTerms}
                          onClick={() => setAgreedToTerms(!agreedToTerms)}
                          onKeyDown={(e) => {
                            if (e.key === ' ' || e.key === 'Enter') {
                              e.preventDefault();
                              setAgreedToTerms(!agreedToTerms);
                            }
                          }}
                          className={`group relative p-3.5 rounded-xl border transition-all duration-150 cursor-pointer select-none ${
                            agreedToTerms
                              ? 'bg-red-50/30 border-red-200/90 shadow-2xs'
                              : 'bg-white border-stone-200 hover:border-stone-300 hover:bg-stone-50/50'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="pt-0.5 shrink-0">
                              <div
                                className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                                  agreedToTerms
                                    ? 'bg-[#8B181B] border-[#8B181B] text-white shadow-2xs'
                                    : 'border-stone-300 bg-white group-hover:border-stone-400'
                                }`}
                              >
                                {agreedToTerms && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1">
                                <span className="font-semibold text-stone-900 text-xs sm:text-sm">
                                  Cecilian Alumni Honor Pledge
                                </span>
                                <span className="text-[10px] font-medium tracking-wide uppercase px-2 py-0.5 rounded-md bg-stone-100 text-stone-600">
                                  Honor Code
                                </span>
                              </div>
                              <p className="text-xs text-stone-600 leading-relaxed">
                                I solemnly affirm that I am an alumnus/graduate of <strong className="text-stone-800">St. Cecilia’s College - Cebu, Inc.</strong> and pledge to uphold the collegiate values of <span className="font-medium text-stone-900">Excellence, Integrity, and Compassionate Service</span>, adhering to all portal terms of use.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {step3Error && (
                      <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200 text-xs border border-red-200/80 dark:border-red-900/60 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                        <span>{step3Error}</span>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex flex-wrap sm:flex-nowrap gap-2">
                      <button
                        type="button"
                        onClick={() => setStep(2)}
                        className="ds-btn-secondary px-3.5 py-2.5 min-h-[44px]"
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        onClick={handleResetAlumniForm}
                        className="ds-btn-ghost px-3 py-2.5 min-h-[44px]"
                      >
                        Reset
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelAlumniForm}
                        className="ds-btn-ghost px-3 py-2.5 min-h-[44px]"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={!allConsentsAgreed}
                        onClick={handleCompleteRegistration}
                        className={`flex-1 min-h-[48px] lg:min-h-[44px] py-2.5 rounded-xl text-[14px] lg:text-xs font-semibold lg:tracking-wider lg:uppercase transition-all ${
                          allConsentsAgreed
                            ? 'bg-[#8B181B] dark:bg-[#E11D48] text-white lg:ds-btn-primary active:opacity-85 cursor-pointer'
                            : 'bg-stone-300 dark:bg-[#262626] text-stone-500 dark:text-[#737373] cursor-not-allowed'
                        }`}
                      >
                        {allConsentsAgreed ? 'Complete Registration' : 'Confirm Consents'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
            </>
          )}
          </div>
        )}
      </div>

      {/* FORGOT PASSWORD MODAL */}
      <ForgotPasswordModal
        isOpen={showForgotModal}
        initialEmail={forgotEmail || (loginIdentifier?.includes('@') ? loginIdentifier.trim() : '')}
        onClose={() => setShowForgotModal(false)}
        onSuccess={handlePasswordResetSuccess}
      />

      {/* ========================================================
          ID DISPUTE & REGISTRATION CONFLICT MODAL
          ======================================================== */}
      {showDisputeModal && (
        <div
          className="fixed inset-0 bg-stone-950/60 backdrop-blur-xs flex items-end lg:items-center justify-center p-0 lg:p-4 z-50 animate-in fade-in duration-150"
          onClick={() => setShowDisputeModal(false)}
        >
          <div
            className="bg-white dark:bg-[#121212] rounded-t-3xl lg:rounded-3xl border border-stone-200 dark:border-[#262626] shadow-2xl max-w-lg w-full max-h-[92dvh] overflow-y-auto p-5 sm:p-7 relative pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            {disputeReferenceId ? (
              <div className="text-center py-6 space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 flex items-center justify-center mx-auto border border-amber-200 dark:border-amber-800 shadow-2xs">
                  <Scale className="w-7 h-7 stroke-[2]" />
                </div>
                <div>
                  <span className="text-[11px] lg:text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/60 px-2.5 py-1 rounded-full border border-amber-300 dark:border-amber-800">
                    Conflict Case Flagged: #{disputeReferenceId}
                  </span>
                  <h3 className="text-xl font-bold font-sans text-stone-900 dark:text-[#FAFAFA] mt-2">
                    ID Dispute Submitted to Registrar
                  </h3>
                  <p className="text-[13px] lg:text-xs text-stone-500 dark:text-[#A3A3A3] leading-relaxed max-w-sm mx-auto mt-2">
                    Your claim for Student ID <strong>{disputeStudentId || studentId}</strong> has been logged in the official <strong>Requests & Conflicts</strong> queue. A Registrar Officer will review your academic credentials and initiate hearing resolution.
                  </p>
                </div>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDisputeModal(false);
                      setDisputeReferenceId(null);
                    }}
                    className="min-h-[46px] px-6 py-2.5 bg-stone-900 dark:bg-[#E11D48] hover:bg-stone-800 text-white rounded-xl text-[14px] lg:text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    Close Window
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between pb-4 border-b border-stone-100 dark:border-[#262626]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 flex items-center justify-center border border-amber-200 dark:border-amber-800">
                      <Scale className="w-4 h-4 stroke-[2]" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-stone-900 dark:text-[#FAFAFA]">Dispute Student ID Claim</h3>
                      <p className="text-xs text-stone-500 dark:text-[#A3A3A3]">Report duplicate registration conflict to the Registrar</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDisputeModal(false)}
                    aria-label="Close dispute modal"
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-[#FAFAFA] hover:bg-stone-100 dark:hover:bg-[#262626] cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleDisputeSubmit} className="space-y-4 mt-5">
                  <div className="p-3 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/70 rounded-xl text-xs lg:text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
                    Student ID <strong>{disputeStudentId || studentId}</strong> is already registered. If someone registered using your credentials, submit your details below to place this in the Registrar Requests & Conflicts hearing queue.
                  </div>

                  <div>
                    <label className="text-xs font-bold text-stone-700 dark:text-[#D4D4D4] block mb-1.5">
                      Contested Student ID Number
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={disputeStudentId || studentId}
                      className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-[#262626] bg-stone-100 dark:bg-[#1C1C1C] font-mono text-base lg:text-xs font-bold text-stone-700 dark:text-[#D4D4D4] cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-stone-700 dark:text-[#D4D4D4] block mb-1.5">
                      Your Full Legal Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={disputeFullName}
                      onChange={(e) => setDisputeFullName(e.target.value)}
                      placeholder="e.g. Maria Santos Dela Cruz"
                      className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-[#262626] bg-stone-50 dark:bg-[#171717] text-base lg:text-xs font-medium text-stone-900 dark:text-[#FAFAFA] focus:outline-none focus:ring-2 focus:ring-[#8B181B]/20"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-stone-700 dark:text-[#D4D4D4] block mb-1.5">
                      Your Contact Email Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={disputeEmail}
                      onChange={(e) => setDisputeEmail(e.target.value)}
                      placeholder="name@email.com"
                      className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-[#262626] bg-stone-50 dark:bg-[#171717] text-base lg:text-xs font-medium text-stone-900 dark:text-[#FAFAFA] focus:outline-none focus:ring-2 focus:ring-[#8B181B]/20"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-stone-700 dark:text-[#D4D4D4] block mb-1.5">
                        Degree Program
                      </label>
                      <select
                        value={disputeCourse}
                        onChange={(e) => setDisputeCourse(e.target.value)}
                        className="w-full min-h-[46px] px-3 py-2.5 rounded-xl border border-stone-200 dark:border-[#262626] bg-stone-50 dark:bg-[#171717] text-base lg:text-xs text-stone-900 dark:text-[#FAFAFA]"
                      >
                        {allDegreeOptions.map((prog) => (
                          <option key={prog} value={prog}>
                            {prog}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-stone-700 dark:text-[#D4D4D4] block mb-1.5">
                        Graduation Batch Year
                      </label>
                      <select
                        value={disputeBatch}
                        onChange={(e) => setDisputeBatch(e.target.value)}
                        className="w-full min-h-[46px] px-3 py-2.5 rounded-xl border border-stone-200 dark:border-[#262626] bg-stone-50 dark:bg-[#171717] text-base lg:text-xs text-stone-900 dark:text-[#FAFAFA]"
                      >
                        {centenaryBatches.map((yr) => (
                          <option key={yr} value={yr}>
                            Class of {yr}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-stone-700 dark:text-[#D4D4D4] block mb-1.5">
                      Dispute Explanation & Supporting Statement <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={disputeReason}
                      onChange={(e) => setDisputeReason(e.target.value)}
                      placeholder="Explain why this ID belongs to you (e.g. graduation year, transcript details, previous student number)..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-[#262626] bg-stone-50 dark:bg-[#171717] text-base lg:text-xs text-stone-900 dark:text-[#FAFAFA] resize-none focus:outline-none focus:ring-2 focus:ring-[#8B181B]/20"
                    />
                  </div>

                  {/* Required Selfie with ID Photo Upload Section (Dispute Student ID Claim) */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-stone-700 dark:text-[#D4D4D4] block">
                      Selfie with ID <span className="text-red-500">*</span>
                    </label>
                    <p className="text-xs lg:text-[11px] text-stone-500 dark:text-[#A3A3A3] leading-relaxed">
                      Upload a clear selfie of yourself holding your valid School ID or any valid government-issued ID. Ensure that your face and identification details are clearly visible. This photo is required to verify your identity and ownership of the disputed Student ID.
                    </p>

                    <input
                      ref={disputeSelfieInputRef}
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                      onChange={handleDisputeSelfieFileChange}
                      className="hidden"
                      aria-label="Upload Selfie with ID"
                    />

                    {!disputeSelfieDataUrl ? (
                      <button
                        type="button"
                        disabled={isProcessingDisputeSelfie || isSubmittingDispute}
                        onClick={() => disputeSelfieInputRef.current?.click()}
                        className={`w-full min-h-[104px] p-4 rounded-xl border-2 border-dashed transition-colors flex flex-col items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 ${
                          disputeSelfieError
                            ? 'border-red-300 dark:border-red-800 bg-red-50/40 dark:bg-red-950/20 hover:bg-red-50/70'
                            : 'border-stone-200 dark:border-[#262626] bg-stone-50 dark:bg-[#171717] hover:border-[#8B181B]/40 hover:bg-stone-100/60 dark:hover:bg-[#1F1F1F]'
                        }`}
                      >
                        <div className="w-9 h-9 rounded-xl bg-white dark:bg-[#262626] border border-stone-200 dark:border-[#333] text-[#8B181B] dark:text-[#FB7185] flex items-center justify-center shadow-2xs">
                          <Camera className="w-4 h-4" strokeWidth={1.75} />
                        </div>
                        <span className="text-xs font-bold text-stone-800 dark:text-[#FAFAFA]">
                          {isProcessingDisputeSelfie ? 'Processing photo...' : 'Upload Selfie with ID'}
                        </span>
                        <span className="text-[11px] text-stone-500 dark:text-[#A3A3A3]">
                          JPG, JPEG, PNG, or WEBP (Max 5 MB)
                        </span>
                      </button>
                    ) : (
                      <div className="rounded-xl border border-stone-200 dark:border-[#262626] bg-stone-50 dark:bg-[#171717] p-3 space-y-2.5">
                        <div className="relative rounded-lg overflow-hidden border border-stone-200 dark:border-[#262626] bg-stone-900/5 max-h-48 flex items-center justify-center">
                          <img
                            src={disputeSelfieDataUrl}
                            alt="Selfie with ID preview"
                            className="max-h-48 w-auto object-contain"
                          />
                        </div>
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" strokeWidth={1.75} />
                            <span className="text-[11px] font-medium text-stone-700 dark:text-[#D4D4D4] truncate max-w-[180px]">
                              {disputeSelfieFileName || 'Selfie with ID uploaded'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={isProcessingDisputeSelfie || isSubmittingDispute}
                              onClick={() => disputeSelfieInputRef.current?.click()}
                              className="min-h-[44px] lg:min-h-[30px] px-3 py-1.5 rounded-xl border border-stone-200 dark:border-[#262626] bg-white dark:bg-[#262626] hover:bg-stone-100 text-stone-700 dark:text-[#FAFAFA] text-xs lg:text-[11px] font-semibold transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                            >
                              <Upload className="w-3.5 h-3.5" strokeWidth={1.75} />
                              <span>Replace Photo</span>
                            </button>
                            <button
                              type="button"
                              disabled={isProcessingDisputeSelfie || isSubmittingDispute}
                              onClick={handleRemoveDisputeSelfie}
                              className="min-h-[44px] lg:min-h-[30px] px-3 py-1.5 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 text-[#8B181B] dark:text-[#FB7185] text-xs lg:text-[11px] font-semibold transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                              <span>Remove Photo</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {disputeSelfieError && (
                      <p className="text-xs lg:text-[11px] font-semibold text-red-600 dark:text-[#FB7185] flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
                        <span>{disputeSelfieError}</span>
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-stone-100 dark:border-[#262626] flex items-center justify-end gap-2.5">
                    <button
                      type="button"
                      disabled={isSubmittingDispute}
                      onClick={() => {
                        setShowDisputeModal(false);
                        setDisputeSelfieError(null);
                      }}
                      className="min-h-[46px] lg:min-h-[38px] px-4 py-2 rounded-xl border border-stone-200 dark:border-[#262626] text-stone-600 dark:text-[#D4D4D4] text-[14px] lg:text-xs font-semibold hover:bg-stone-50 dark:hover:bg-[#1C1C1C] cursor-pointer disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingDispute || isProcessingDisputeSelfie}
                      className="min-h-[46px] lg:min-h-[38px] px-5 py-2 bg-[#8B181B] dark:bg-[#E11D48] hover:bg-[#721316] text-white rounded-xl text-[14px] lg:text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
                    >
                      <Scale className="w-3.5 h-3.5" />
                      <span>{isSubmittingDispute ? 'Submitting...' : 'Submit ID Dispute'}</span>
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          MANUAL ALUMNI VERIFICATION REQUEST MODAL (NO ID)
          ======================================================== */}
      {showManualVerificationModal && (
        <div
          className="fixed inset-0 bg-stone-950/60 backdrop-blur-xs flex items-end lg:items-center justify-center p-0 lg:p-4 z-50 animate-in fade-in duration-150"
          onClick={() => setShowManualVerificationModal(false)}
        >
          <div
            className="bg-white dark:bg-[#121212] rounded-t-3xl lg:rounded-3xl border border-stone-200 dark:border-[#262626] shadow-2xl max-w-lg w-full max-h-[92dvh] overflow-y-auto p-5 sm:p-7 relative pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            {manualReferenceId ? (
              <div className="text-center py-6 space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center mx-auto border border-emerald-200 dark:border-emerald-800 shadow-2xs">
                  <CheckCircle2 className="w-7 h-7 stroke-[2]" />
                </div>
                <div>
                  <span className="text-[11px] lg:text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-200 bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-300 dark:border-emerald-800">
                    Appeal Reference: #{manualReferenceId}
                  </span>
                  <h3 className="text-xl font-bold font-sans text-stone-900 dark:text-[#FAFAFA] mt-2">
                    Verification Appeal Received
                  </h3>
                  <p className="text-[13px] lg:text-xs text-stone-500 dark:text-[#A3A3A3] leading-relaxed max-w-sm mx-auto mt-2">
                    Your manual verification request has been queued in the <strong>Requests & Conflicts</strong> inbox. The Registrar will review your academic archives and update your status.
                  </p>
                </div>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowManualVerificationModal(false);
                      setManualReferenceId(null);
                    }}
                    className="min-h-[46px] px-6 py-2.5 bg-stone-900 dark:bg-[#E11D48] hover:bg-stone-800 text-white rounded-xl text-[14px] lg:text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    Done & Return to Sign In
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between pb-4 border-b border-stone-100 dark:border-[#262626]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-[#E11D48]/15 text-[#8B181B] dark:text-[#FB7185] flex items-center justify-center">
                      <FileText className="w-4 h-4 stroke-[2]" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-stone-900 dark:text-[#FAFAFA]">Manual Verification Request</h3>
                      <p className="text-xs text-stone-500 dark:text-[#A3A3A3]">For unlisted records or alumni without an electronic ID</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowManualVerificationModal(false)}
                    aria-label="Close manual verification modal"
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-[#FAFAFA] hover:bg-stone-100 dark:hover:bg-[#262626] cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleManualVerificationSubmit} className="space-y-3.5 mt-4">
                  <div className="p-3 bg-stone-50 dark:bg-[#171717] border border-stone-200 dark:border-[#262626] rounded-xl text-xs lg:text-[11px] text-stone-600 dark:text-[#A3A3A3] leading-relaxed">
                    If you graduated before modern Student IDs were assigned or cannot locate your ID, submit your details. The Registrar will verify your graduation records against the university archives.
                  </div>

                  <div>
                    <label className="text-xs font-bold text-stone-700 dark:text-[#D4D4D4] block mb-1.5">
                      Full Legal Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={manualFullName}
                      onChange={(e) => setManualFullName(e.target.value)}
                      placeholder="e.g. Maria Santos Dela Cruz"
                      className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-[#262626] bg-stone-50 dark:bg-[#171717] text-base lg:text-xs font-medium text-stone-900 dark:text-[#FAFAFA] focus:outline-none focus:ring-2 focus:ring-[#8B181B]/20"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-stone-700 dark:text-[#D4D4D4] block mb-1.5">
                        Degree Program <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={manualCourse}
                        onChange={(e) => setManualCourse(e.target.value)}
                        className="w-full min-h-[46px] px-3 py-2.5 rounded-xl border border-stone-200 dark:border-[#262626] bg-stone-50 dark:bg-[#171717] text-base lg:text-xs text-stone-900 dark:text-[#FAFAFA]"
                      >
                        {allDegreeOptions.map((prog) => (
                          <option key={prog} value={prog}>
                            {prog}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-stone-700 dark:text-[#D4D4D4] block mb-1.5">
                        Graduation Batch Year <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={manualBatch}
                        onChange={(e) => setManualBatch(e.target.value)}
                        className="w-full min-h-[46px] px-3 py-2.5 rounded-xl border border-stone-200 dark:border-[#262626] bg-stone-50 dark:bg-[#171717] text-base lg:text-xs text-stone-900 dark:text-[#FAFAFA]"
                      >
                        {centenaryBatches.map((yr) => (
                          <option key={yr} value={yr}>
                            Class of {yr}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-stone-700 dark:text-[#D4D4D4] block mb-1.5">
                        Contact Email <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        value={manualEmail}
                        onChange={(e) => setManualEmail(e.target.value)}
                        placeholder="you@email.com"
                        className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-[#262626] bg-stone-50 dark:bg-[#171717] text-base lg:text-xs font-medium text-stone-900 dark:text-[#FAFAFA]"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-stone-700 dark:text-[#D4D4D4] block mb-1.5">
                        Mobile / Phone Number
                      </label>
                      <input
                        type="tel"
                        value={manualPhone}
                        onChange={(e) => setManualPhone(e.target.value)}
                        placeholder="+63 917 123 4567"
                        className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-[#262626] bg-stone-50 dark:bg-[#171717] text-base lg:text-xs text-stone-900 dark:text-[#FAFAFA]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-stone-700 dark:text-[#D4D4D4] block mb-1.5">
                      Account Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showManualPassword ? 'text' : 'password'}
                        required
                        value={manualPassword}
                        onChange={(e) => setManualPassword(e.target.value)}
                        placeholder="Min. 8 characters"
                        className="w-full min-h-[46px] pl-3.5 pr-12 py-2.5 rounded-xl border border-stone-200 dark:border-[#262626] bg-stone-50 dark:bg-[#171717] text-base lg:text-xs text-stone-900 dark:text-[#FAFAFA]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowManualPassword(!showManualPassword)}
                        style={{
                          position: 'absolute',
                          top: 0,
                          bottom: 0,
                          right: '4px',
                          marginTop: 'auto',
                          marginBottom: 'auto',
                          height: '44px',
                          width: '44px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transform: 'none',
                          translate: 'none'
                        }}
                        className="no-gooey text-stone-400 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200 cursor-pointer z-10"
                        aria-label={showManualPassword ? 'Hide password' : 'Show password'}
                      >
                        {showManualPassword ? <EyeOff className="w-4 h-4" strokeWidth={1.75} /> : <Eye className="w-4 h-4" strokeWidth={1.75} />}
                      </button>
                    </div>
                    <span className="text-[11px] lg:text-[10px] text-stone-400 dark:text-[#737373] mt-1 block">
                      This password will activate once the Registrar approves your account.
                    </span>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-stone-700 dark:text-[#D4D4D4] block mb-1.5">
                      Academic Details & Remarks
                    </label>
                    <textarea
                      rows={2}
                      value={manualNotes}
                      onChange={(e) => setManualNotes(e.target.value)}
                      placeholder="e.g., Campus branch, old student number, honors, or attendance years..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-[#262626] bg-stone-50 dark:bg-[#171717] text-base lg:text-xs text-stone-900 dark:text-[#FAFAFA] resize-none"
                    />
                  </div>

                  {/* Required Selfie with ID Upload Section */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-stone-700 dark:text-[#D4D4D4] block">
                      Selfie with ID <span className="text-red-500">*</span>
                    </label>
                    <p className="text-xs lg:text-[11px] text-stone-500 dark:text-[#A3A3A3] leading-relaxed">
                      Upload a selfie of yourself holding your valid School ID or any valid government-issued ID. Make sure your face and ID details are clearly visible. This is required to verify that you are the legitimate account owner.
                    </p>

                    <input
                      ref={manualSelfieInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleManualSelfieFileChange}
                      className="hidden"
                      aria-label="Upload Selfie with ID"
                    />

                    {!manualSelfieDataUrl ? (
                      <button
                        type="button"
                        disabled={isProcessingManualSelfie}
                        onClick={() => manualSelfieInputRef.current?.click()}
                        className={`w-full min-h-[104px] p-4 rounded-xl border-2 border-dashed transition-colors flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                          manualSelfieError
                            ? 'border-red-300 dark:border-red-800 bg-red-50/40 dark:bg-red-950/20 hover:bg-red-50/70'
                            : 'border-stone-200 dark:border-[#262626] bg-stone-50 dark:bg-[#171717] hover:border-[#8B181B]/40 hover:bg-stone-100/60 dark:hover:bg-[#1F1F1F]'
                        }`}
                      >
                        <div className="w-9 h-9 rounded-xl bg-white dark:bg-[#262626] border border-stone-200 dark:border-[#333] text-[#8B181B] dark:text-[#FB7185] flex items-center justify-center shadow-2xs">
                          <Camera className="w-4 h-4" strokeWidth={1.75} />
                        </div>
                        <span className="text-xs font-bold text-stone-800 dark:text-[#FAFAFA]">
                          {isProcessingManualSelfie ? 'Processing image...' : 'Upload Selfie with ID'}
                        </span>
                        <span className="text-[11px] text-stone-500 dark:text-[#A3A3A3]">
                          JPG, PNG, or WebP up to 10MB
                        </span>
                      </button>
                    ) : (
                      <div className="rounded-xl border border-stone-200 dark:border-[#262626] bg-stone-50 dark:bg-[#171717] p-3 space-y-2.5">
                        <div className="relative rounded-lg overflow-hidden border border-stone-200 dark:border-[#262626] bg-stone-900/5 max-h-48 flex items-center justify-center">
                          <img
                            src={manualSelfieDataUrl}
                            alt="Selfie with ID preview"
                            className="max-h-48 w-auto object-contain"
                          />
                        </div>
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" strokeWidth={1.75} />
                            <span className="text-[11px] font-medium text-stone-700 dark:text-[#D4D4D4] truncate max-w-[180px]">
                              {manualSelfieFileName || 'Selfie with ID uploaded'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => manualSelfieInputRef.current?.click()}
                              className="min-h-[44px] lg:min-h-[30px] px-3 py-1.5 rounded-xl border border-stone-200 dark:border-[#262626] bg-white dark:bg-[#262626] hover:bg-stone-100 text-stone-700 dark:text-[#FAFAFA] text-xs lg:text-[11px] font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
                            >
                              <Upload className="w-3.5 h-3.5" strokeWidth={1.75} />
                              <span>Replace</span>
                            </button>
                            <button
                              type="button"
                              onClick={handleRemoveManualSelfie}
                              className="min-h-[44px] lg:min-h-[30px] px-3 py-1.5 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 text-[#8B181B] dark:text-[#FB7185] text-xs lg:text-[11px] font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
                            >
                              <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                              <span>Remove</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {manualSelfieError && (
                      <p className="text-xs lg:text-[11px] font-semibold text-red-600 dark:text-[#FB7185] flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
                        <span>{manualSelfieError}</span>
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-stone-100 dark:border-[#262626] flex items-center justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setShowManualVerificationModal(false);
                        setManualSelfieError(null);
                      }}
                      className="min-h-[46px] lg:min-h-[38px] px-4 py-2 rounded-xl border border-stone-200 dark:border-[#262626] text-stone-600 dark:text-[#D4D4D4] text-[14px] lg:text-xs font-semibold hover:bg-stone-50 dark:hover:bg-[#1C1C1C] cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingAppeal || isProcessingManualSelfie}
                      className="min-h-[46px] lg:min-h-[38px] px-5 py-2 bg-[#8B181B] dark:bg-[#E11D48] hover:bg-[#721316] text-white rounded-xl text-[14px] lg:text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isSubmittingAppeal ? 'Submitting...' : 'Submit Verification Request'}</span>
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* Post-Login Biometric Opt-In Interactive Modal (Android Keystore Vaulting) */}
      {showBiometricOptInModal && pendingOptInUser && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-2xl bg-[#8B181B]/10 dark:bg-[#8B181B]/20 text-[#8B181B] dark:text-[#f87171] flex items-center justify-center mx-auto mb-4 border border-[#8B181B]/20">
              <Fingerprint className="w-7 h-7" strokeWidth={1.75} />
            </div>

            <span className="editorial-kicker block text-center mb-1 text-[#8B181B] dark:text-[#f87171]">
              QUICK HARDWARE ACCESS
            </span>
            <h3 className="text-xl font-semibold text-stone-900 dark:text-stone-100 text-center tracking-tight mb-2">
              Enable Biometric Login?
            </h3>

            <p className="text-xs text-stone-600 dark:text-stone-400 text-center leading-relaxed mb-6">
              Sign in instantly next time with your <strong>Fingerprint</strong> or <strong>Face ID</strong>. Your session token is bound to this device and protected in hardware Keystore.
            </p>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={async () => {
                  if (pendingOptInUser.refreshToken) {
                    await vaultBiometricRefreshToken(
                      pendingOptInUser.uid,
                      pendingOptInUser.email,
                      pendingOptInUser.refreshToken
                    );
                    showToast('Biometric Login enabled for this device!', 'success');
                  }
                  const targetRole = pendingOptInUser.role;
                  setShowBiometricOptInModal(false);
                  setPendingOptInUser(null);
                  if (onLoginSuccess) {
                    onLoginSuccess(targetRole);
                  } else if (onBackToApp) {
                    onBackToApp();
                  }
                }}
                className="w-full min-h-[44px] py-3 px-4 rounded-xl bg-[#8B181B] hover:bg-[#721316] text-white text-xs font-bold tracking-wider uppercase transition-all shadow-md hover:shadow-lg cursor-pointer flex items-center justify-center gap-2"
              >
                <Fingerprint className="w-4 h-4" strokeWidth={1.75} />
                <span>Enable Biometric Login</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const targetRole = pendingOptInUser.role;
                  setShowBiometricOptInModal(false);
                  setPendingOptInUser(null);
                  if (onLoginSuccess) {
                    onLoginSuccess(targetRole);
                  } else if (onBackToApp) {
                    onBackToApp();
                  }
                }}
                className="w-full min-h-[44px] py-2.5 px-4 rounded-xl border border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800/80 text-stone-600 dark:text-stone-400 text-xs font-semibold transition-colors cursor-pointer"
              >
                Not Now, Continue to App
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Role Switch Confirmation Modal */}
      {switchRoleConfirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-stone-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200 dark:border-stone-800 text-left">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900/60 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                <AlertTriangle className="w-5 h-5 stroke-[1.75]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                  Switch to {switchRoleConfirmTarget === 'employer' ? 'Employer' : 'Alumni'} Registration?
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Reset current registration progress
                </p>
              </div>
            </div>
            <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed mb-6">
              You have already started filling out the {registrationType === 'employer' ? 'employer accreditation' : 'alumni'} form. Switching to {switchRoleConfirmTarget === 'employer' ? 'employer' : 'alumni'} registration will clear any entered information.
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setSwitchRoleConfirmTarget(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 border border-stone-200/80 dark:border-stone-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRoleSwitch}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#8B181B] hover:bg-[#721316] text-white shadow-xs transition-colors cursor-pointer"
              >
                Clear & Switch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Institutional Account Suspension / Lockout Notice Modal */}
      <AccountSuspendedNoticeModal
        notice={loginSuspensionNotice}
        onClose={clearLoginSuspensionNotice}
      />
    </div>
  );
};


