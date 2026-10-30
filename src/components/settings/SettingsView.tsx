/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  User,
  Mail,
  Lock,
  Bell,
  HelpCircle,
  Shield,
  Info,
  LogOut,
  Trash2,
  Copy,
  Check,
  ChevronRight,
  ExternalLink,
  AlertTriangle,
  AlertCircle,
  X,
  Eye,
  EyeOff,
  KeyRound,
  CheckCircle2,
  Volume2,
  Sparkles,
  Clock,
  Sun,
  Moon,
  Monitor,
  Palette,
  ShieldCheck,
  Radio,
  SlidersHorizontal,
  ArrowRight,
  Smartphone,
  Cpu,
  Layers,
  ScanFace,
  Fingerprint,
  RefreshCw,
  Sliders,
  Send,
  Share2,
  Globe,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAlumni } from '../../context/AlumniContext';
import { ThemeMode, applyTheme, getStoredTheme } from '../../lib/theme';
import { UserRoleBadge } from '../common/UserRoleBadge';
import { UserRole } from '../../types';
import { PlatformOnly } from '../common/PlatformOnly';
import { getUserAvatar, handleUserAvatarError } from '../../lib/defaultImages';
import {
  checkBiometricAvailability,
  isBiometricLoginEnabled,
  enableBiometricLogin,
  disableBiometricLogin,
  authenticateWithBiometrics,
  isBiometricAppLockEnabled,
  setBiometricAppLockEnabled,
  verifyBiometricForDashboardAccess,
  setCampusPin,
  getCampusPinConfig,
  BiometricAvailability
} from '../../services/biometricAuthService';
import {
  checkPushPermissions,
  requestPushNotifications,
  sendInAppPushAlert,
  triggerTestPushNotification
} from '../../services/pushNotificationService';
import { openExternalUrl } from '../../services/externalLinkService';
import { shareAlumniPortal } from '../../services/nativeShareService';
import { sendPasswordResetLinkEmail } from '../../services/emailNotificationService';

export const SettingsView: React.FC = () => {
  const {
    currentUser,
    setActiveTab,
    logout,
    deleteAccount,
    changePassword,
    showToast,
    notificationSettings,
    updateNotificationSettings,
    pushPermissionStatus,
    requestBrowserPushPermission,
    sendTest24HourAlert,
    updateUserRole,
    users,
    permissions
  } = useAlumni();

  // Active filter pill for Command Center navigation
  const [activeFilterPill, setActiveFilterPill] = useState<'all' | 'security' | 'notifications' | 'appearance' | 'compliance'>('all');


  // Clipboard & Modal States
  const [copiedId, setCopiedId] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [isSendingResetEmail, setIsSendingResetEmail] = useState(false);
  const [resetEmailStatus, setResetEmailStatus] = useState<string | null>(null);

  const [showFaqModal, setShowFaqModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [revokeBiometricsOnLogout, setRevokeBiometricsOnLogout] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Authority Role Management Modal state
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedRoleUserUid, setSelectedRoleUserUid] = useState<string>(currentUser?.uid || '');
  const [selectedRoleValue, setSelectedRoleValue] = useState<UserRole>((currentUser?.role as UserRole) || 'alumni');
  const [isSavingRole, setIsSavingRole] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [roleSuccess, setRoleSuccess] = useState<string | null>(null);

  // Synchronize target selection when modal triggers or user profile changes
  useEffect(() => {
    if (currentUser?.uid) {
      setSelectedRoleUserUid(currentUser.uid);
      setSelectedRoleValue((currentUser.role as UserRole) || 'alumni');
    }
  }, [currentUser?.uid, currentUser?.role]);

  // Administrative roles cannot delete their accounts from settings
  const isAdminRole = ['admin', 'superadmin', 'registrar', 'staff', 'moderator'].includes(currentUser?.role || '');

  // Email form
  const [newEmail, setNewEmail] = useState('');
  const [emailStatusMessage, setEmailStatusMessage] = useState('');

  // Notification toggles
  const [pushEnabled, setPushEnabled] = useState(
    currentUser?.settings?.notificationsPush ?? notificationSettings?.pushNotifications ?? true
  );
  const [emailEnabled, setEmailEnabled] = useState(
    currentUser?.settings?.notificationsEmail ?? notificationSettings?.emailDigests ?? true
  );
  const [messagesEnabled, setMessagesEnabled] = useState(
    currentUser?.settings?.notificationsMessages ?? notificationSettings?.directMessages ?? true
  );
  const [eventsEnabled, setEventsEnabled] = useState(
    currentUser?.settings?.notificationsEvents ?? notificationSettings?.eventReminders ?? true
  );
  const [jobsEnabled, setJobsEnabled] = useState(
    currentUser?.settings?.notificationsJobs ?? notificationSettings?.jobOpportunities ?? true
  );
  const [smsEnabled, setSmsEnabled] = useState(true);

  // Biometric state (Face Detection)
  const [biometricAvail, setBiometricAvail] = useState<BiometricAvailability>({
    isAvailable: false,
    biometryType: 'none',
    label: 'Biometrics',
    hasFace: false,
    hasFingerprint: false,
    hasWebAuthn: false,
    hasCapacitor: false
  });
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [isBiometricTesting, setIsBiometricTesting] = useState(false);
  const [appLockEnabled, setAppLockEnabled] = useState(false);

  useEffect(() => {
    checkBiometricAvailability().then((avail) => {
      setBiometricAvail(avail);
      setBiometricEnabled(isBiometricLoginEnabled(currentUser?.uid));
      setAppLockEnabled(isBiometricAppLockEnabled(currentUser?.uid));
    });
  }, [currentUser?.uid]);

  const handleToggleAppLock = (enabled: boolean) => {
    if (!currentUser) return;
    setBiometricAppLockEnabled(currentUser.uid, enabled);
    setAppLockEnabled(enabled);
    if (enabled) {
      showToast('Secondary biometric app lock enabled! App will lock when returning from background.', 'success');
    } else {
      showToast('Secondary biometric app lock disabled.', 'info');
    }
  };

  const handleToggleBiometrics = async (enabled: boolean) => {
    if (!currentUser) return;
    if (enabled) {
      const success = await enableBiometricLogin(currentUser.uid, currentUser.email);
      if (success) {
        setBiometricEnabled(true);
        showToast(`${biometricAvail.label} login enabled successfully!`, 'success');
      } else {
        showToast('Could not enable biometric authentication.', 'error');
      }
    } else {
      await disableBiometricLogin(currentUser.uid);
      setBiometricEnabled(false);
      showToast('Biometric login disabled.', 'info');
    }
  };

  // Campus PIN state
  const [showPinModal, setShowPinModal] = useState(false);
  const [newCampusPin, setNewCampusPin] = useState('');
  const [confirmCampusPin, setConfirmCampusPin] = useState('');
  const [pinDialogError, setPinDialogError] = useState<string | null>(null);

  const handleTestBiometrics = async (modality: 'face' | 'fingerprint' = 'face') => {
    setIsBiometricTesting(true);
    try {
      const res = await verifyBiometricForDashboardAccess({
        modality,
        userName: currentUser?.name
      });
      if (res.success) {
        showToast(
          `${modality === 'fingerprint' ? 'Fingerprint Sensor' : 'Face Detection'} verified successfully! Hardware security active.`,
          'success'
        );
      } else if (res.error) {
        showToast(res.error, 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Biometric recognition test cancelled.', 'error');
    } finally {
      setIsBiometricTesting(false);
    }
  };

  const handleSaveCampusPin = async () => {
    setPinDialogError(null);
    if (!newCampusPin || newCampusPin.length < 4 || newCampusPin.length > 6 || !/^\d+$/.test(newCampusPin)) {
      setPinDialogError('Emergency PIN must be 4 to 6 numeric digits.');
      return;
    }
    if (newCampusPin !== confirmCampusPin) {
      setPinDialogError('PINs do not match. Please verify both fields.');
      return;
    }
    const success = await setCampusPin(newCampusPin, currentUser?.uid);
    if (success) {
      showToast('Emergency PIN updated successfully!', 'success');
      setShowPinModal(false);
      setNewCampusPin('');
      setConfirmCampusPin('');
    } else {
      setPinDialogError('Failed to update Emergency PIN.');
    }
  };

  const handleSendTestPush = (category: 'event' | 'message' | 'announcement') => {
    const titles = {
      event: 'Cecilian Grand Reunion: 24h Confirmation',
      message: 'New Direct Message from Maria Santos',
      announcement: 'Campus News: Centennial Homecoming'
    };
    const bodies = {
      event: 'Your reserved seat at the Centennial Grand Alumni Reunion is scheduled for tomorrow at 6:00 PM.',
      message: '"Hi! Great catching up with you during the Alumni Homecoming seminar."',
      announcement: 'Registration is now open for the 2026 Batch Representative Council meeting.'
    };

    sendInAppPushAlert({
      title: titles[category],
      body: bodies[category],
      category,
      data: { category }
    });

    if (currentUser?.uid) {
      fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: currentUser.uid,
          title: titles[category],
          body: bodies[category],
          category,
          data: {
            category,
            url: category === 'message' ? '/?tab=messages' : category === 'event' ? '/?tab=events' : '/?tab=announcements'
          }
        })
      }).catch(() => {});
    }

    showToast(`Test ${category} notification sent! Check your phone.`, 'success');
  };

  const handleShareApp = async () => {
    const res = await shareAlumniPortal();
    if (res.shared) {
      showToast('Thank you for sharing Cecilian Alumnet!', 'success');
    } else if (res.copiedToClipboard) {
      showToast('Portal link copied to clipboard! Share it with your fellow alumni.', 'success');
    } else if (res.error) {
      showToast(res.error, 'error');
    }
  };

  // Theme switcher state
  const [themeMode, setThemeMode] = useState<ThemeMode>(getStoredTheme);

  useEffect(() => {
    const handleThemeEvent = (e: any) => {
      if (e.detail?.mode) {
        setThemeMode(e.detail.mode);
      }
    };
    window.addEventListener('cecilian:theme-change', handleThemeEvent);
    return () => window.removeEventListener('cecilian:theme-change', handleThemeEvent);
  }, []);

  const handleThemeChange = (mode: ThemeMode) => {
    setThemeMode(mode);
    applyTheme(mode);
    showToast(`Switched to ${mode === 'dark' ? 'Dark' : mode === 'light' ? 'Light' : 'System'} mode`, 'info');
  };

  useEffect(() => {
    if (notificationSettings) {
      setPushEnabled(notificationSettings.pushNotifications ?? true);
      setEmailEnabled(notificationSettings.emailDigests ?? true);
      setMessagesEnabled(notificationSettings.directMessages ?? true);
      setEventsEnabled(notificationSettings.eventReminders ?? true);
      setJobsEnabled(notificationSettings.jobOpportunities ?? true);
    }
  }, [notificationSettings]);

  if (!currentUser) return null;

  const handleCopyId = () => {
    navigator.clipboard?.writeText(currentUser.uid);
    setCopiedId(true);
    showToast('UID copied to clipboard for IT support.', 'success');
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleToggle = (key: 'push' | 'email' | 'messages' | 'events' | 'jobs', value: boolean) => {
    if (key === 'push') {
      setPushEnabled(value);
      updateNotificationSettings({ pushNotifications: value });
    }
    if (key === 'email') {
      setEmailEnabled(value);
      updateNotificationSettings({ emailDigests: value });
    }
    if (key === 'messages') {
      setMessagesEnabled(value);
      updateNotificationSettings({ directMessages: value });
    }
    if (key === 'events') {
      setEventsEnabled(value);
      updateNotificationSettings({ eventReminders: value });
    }
    if (key === 'jobs') {
      setJobsEnabled(value);
      updateNotificationSettings({ jobOpportunities: value });
    }
    showToast(`Updated ${key} notification preference`, 'info');
  };

  const handleChangeEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newEmail.includes('@')) return;
    setEmailStatusMessage(`Verification email sent to ${newEmail}. Please confirm to complete this change.`);
    setTimeout(() => {
      setShowEmailModal(false);
      setEmailStatusMessage('');
      setNewEmail('');
    }, 2500);
  };

  const openPasswordModal = () => {
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError(null);
    setPasswordSuccess(null);
    setResetEmailStatus(null);
    setShowOldPass(false);
    setShowNewPass(false);
    setShowConfirmPass(false);
    setShowPasswordModal(true);
  };

  const handleSendResetEmail = async () => {
    if (!currentUser?.email) {
      setPasswordError('No registered email address found for your account.');
      return;
    }
    setIsSendingResetEmail(true);
    setResetEmailStatus(null);
    setPasswordError(null);
    try {
      const email = sendPasswordResetLinkEmail(currentUser);
      if (email) {
        setResetEmailStatus(`A password change link and authorization token have been sent to ${currentUser.email}.`);
        showToast(`Password change instructions sent to ${currentUser.email}`, 'success');
      } else {
        setPasswordError('Failed to dispatch password email.');
      }
    } catch (err: any) {
      setPasswordError(err?.message || 'Failed to dispatch password email.');
    } finally {
      setIsSendingResetEmail(false);
    }
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!oldPassword.trim()) {
      setPasswordError('Please enter your current (old) password.');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword === oldPassword) {
      setPasswordError('New password must be different from your old password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('The new passwords do not match. Please re-enter.');
      return;
    }

    const res = changePassword(oldPassword, newPassword);
    if (typeof res === 'object' && res !== null && !res.success) {
      setPasswordError(res.message || 'The current password you entered is incorrect.');
      return;
    }

    setPasswordSuccess(
      `Your password has been changed successfully! A security confirmation email was dispatched to ${currentUser.email}.`
    );
    showToast(`Password updated! Security confirmation sent to ${currentUser.email}`, 'success');
    setTimeout(() => {
      setShowPasswordModal(false);
      setPasswordSuccess(null);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setResetEmailStatus(null);
    }, 2400);
  };

  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setRoleError(null);
    setRoleSuccess(null);
    if (!selectedRoleUserUid) {
      setRoleError('Please select a target user account.');
      return;
    }
    setIsSavingRole(true);
    try {
      const res = await updateUserRole(selectedRoleUserUid, selectedRoleValue);
      if (res?.success) {
        setRoleSuccess(`Successfully updated role to ${selectedRoleValue.toUpperCase()} and persisted to database.`);
        setTimeout(() => {
          setShowRoleModal(false);
          setRoleSuccess(null);
        }, 1600);
      } else {
        setRoleError(res?.message || 'Could not update user role.');
      }
    } catch (err: any) {
      setRoleError(err?.message || 'Unexpected error updating role.');
    } finally {
      setIsSavingRole(false);
    }
  };

  // Active channel count
  const activeChannelsCount = [pushEnabled, emailEnabled, messagesEnabled, eventsEnabled, jobsEnabled].filter(Boolean).length;

  return (
    <div className="w-full space-y-6 antialiased pb-12">
      {/* ========================================================================= */}
      {/* HEADER: CLEAN INSTITUTIONAL SETTINGS HEADER                              */}
      {/* ========================================================================= */}
      <div className="pb-5 border-b border-stone-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight font-sans">
              Settings
            </h1>
            <UserRoleBadge role={currentUser.role} size="sm" />
          </div>
          <p className="text-xs text-stone-500 font-medium">
            Manage your credentials, security preferences, and system alerts
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer active:scale-95 shrink-0"
          >
            <User className="w-3.5 h-3.5 text-stone-500" />
            <span>View Profile</span>
          </button>
        </div>
      </div>

      {/* MOBILE SEGMENTED FILTER TABS (< lg) */}
      <div className="lg:hidden flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveFilterPill('all')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 shrink-0 ${
            activeFilterPill === 'all'
              ? 'bg-[#8B181B] text-white shadow-xs font-bold'
              : 'bg-stone-100 hover:bg-stone-200/80 text-stone-700'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>All Settings</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveFilterPill('security')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 shrink-0 ${
            activeFilterPill === 'security'
              ? 'bg-[#8B181B] text-white shadow-xs font-bold'
              : 'bg-stone-100 hover:bg-stone-200/80 text-stone-700'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Security & Access</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveFilterPill('notifications')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 shrink-0 ${
            activeFilterPill === 'notifications'
              ? 'bg-[#8B181B] text-white shadow-xs font-bold'
              : 'bg-stone-100 hover:bg-stone-200/80 text-stone-700'
          }`}
        >
          <Bell className="w-3.5 h-3.5" />
          <span>Notifications</span>
          <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
            activeFilterPill === 'notifications' ? 'bg-white/20 text-white' : 'bg-stone-200 text-stone-700'
          }`}>
            {activeChannelsCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveFilterPill('appearance')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 shrink-0 ${
            activeFilterPill === 'appearance'
              ? 'bg-[#8B181B] text-white shadow-xs font-bold'
              : 'bg-stone-100 hover:bg-stone-200/80 text-stone-700'
          }`}
        >
          <Palette className="w-3.5 h-3.5" />
          <span>Appearance</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveFilterPill('compliance')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 shrink-0 ${
            activeFilterPill === 'compliance'
              ? 'bg-[#8B181B] text-white shadow-xs font-bold'
              : 'bg-stone-100 hover:bg-stone-200/80 text-stone-700'
          }`}
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Governance</span>
        </button>
      </div>

      {/* MASTER-DETAIL LAYOUT: SIDEBAR ON DESKTOP + CONTENT ON RIGHT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* DESKTOP SIDEBAR NAVIGATION (lg:col-span-4 xl:col-span-3) */}
        <aside className="hidden lg:block lg:col-span-4 xl:col-span-3 sticky top-6 space-y-4">
          <div className="bg-white rounded-2xl border border-stone-200/90 p-2 shadow-2xs space-y-1">
            <button
              type="button"
              onClick={() => setActiveFilterPill('all')}
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-between cursor-pointer ${
                activeFilterPill === 'all'
                  ? 'bg-[#8B181B] text-white shadow-xs font-bold'
                  : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <SlidersHorizontal className="w-4 h-4 shrink-0" />
                <span>All Settings</span>
              </div>
              <ChevronRight className={`w-3.5 h-3.5 ${activeFilterPill === 'all' ? 'text-white/80' : 'text-stone-400'}`} />
            </button>

            <button
              type="button"
              onClick={() => setActiveFilterPill('security')}
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-between cursor-pointer ${
                activeFilterPill === 'security'
                  ? 'bg-[#8B181B] text-white shadow-xs font-bold'
                  : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>Security & Access</span>
              </div>
              <ChevronRight className={`w-3.5 h-3.5 ${activeFilterPill === 'security' ? 'text-white/80' : 'text-stone-400'}`} />
            </button>

            <button
              type="button"
              onClick={() => setActiveFilterPill('notifications')}
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-between cursor-pointer ${
                activeFilterPill === 'notifications'
                  ? 'bg-[#8B181B] text-white shadow-xs font-bold'
                  : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Bell className="w-4 h-4 shrink-0" />
                <span>Notifications</span>
              </div>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                activeFilterPill === 'notifications' ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-600'
              }`}>
                {activeChannelsCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveFilterPill('appearance')}
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-between cursor-pointer ${
                activeFilterPill === 'appearance'
                  ? 'bg-[#8B181B] text-white shadow-xs font-bold'
                  : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Palette className="w-4 h-4 shrink-0" />
                <span>Appearance</span>
              </div>
              <ChevronRight className={`w-3.5 h-3.5 ${activeFilterPill === 'appearance' ? 'text-white/80' : 'text-stone-400'}`} />
            </button>

            <button
              type="button"
              onClick={() => setActiveFilterPill('compliance')}
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-between cursor-pointer ${
                activeFilterPill === 'compliance'
                  ? 'bg-[#8B181B] text-white shadow-xs font-bold'
                  : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <HelpCircle className="w-4 h-4 shrink-0" />
                <span>Governance & Info</span>
              </div>
              <ChevronRight className={`w-3.5 h-3.5 ${activeFilterPill === 'compliance' ? 'text-white/80' : 'text-stone-400'}`} />
            </button>
          </div>

          {/* Institutional Account Overview Card */}
          <div className="p-4 rounded-2xl bg-stone-50/90 border border-stone-200/80 space-y-3">
            <div className="flex items-center gap-3">
              <img
                src={getUserAvatar(currentUser.avatar)}
                alt={currentUser.name || 'User'}
                onError={handleUserAvatarError}
                className="w-10 h-10 rounded-full object-cover border border-stone-300"
              />
              <div className="min-w-0">
                <p className="text-xs font-bold text-stone-900 truncate">
                  {currentUser.name || 'Alumnus'}
                </p>
                <p className="text-[11px] text-stone-500 font-mono truncate">
                  {currentUser.email}
                </p>
              </div>
            </div>
            <div className="pt-2.5 border-t border-stone-200/80 flex items-center justify-between text-[11px]">
              <span className="text-stone-500">Clearance Tier</span>
              <UserRoleBadge role={currentUser.role} size="sm" />
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className="w-full py-2 bg-white hover:bg-stone-100 border border-stone-200 text-stone-800 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs active:scale-95"
            >
              <User className="w-3.5 h-3.5 text-stone-500" />
              <span>Open Profile Desk</span>
            </button>
          </div>
        </aside>

        {/* SETTINGS CARDS CONTENT COLUMN (lg:col-span-8 xl:col-span-9) */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-6">
      
      {/* SECTION: AUTHORITY ROLE & ACCESS GOVERNANCE */}
      {(activeFilterPill === 'all' || activeFilterPill === 'security' || activeFilterPill === 'compliance') && (
        <div className="bg-white rounded-[32px] p-6 sm:p-7 border border-stone-200/90 shadow-2xs space-y-5">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-red-50 text-[#8B181B] flex items-center justify-center">
                <ShieldCheck className="w-4 h-4 stroke-[2]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-stone-900">Authority Role & Privilege Governance</h3>
                <p className="text-xs text-stone-500">Institutional clearance tier, permission boundaries, and Firestore synchronization</p>
              </div>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-stone-100 text-stone-700 font-bold border border-stone-200">
              Synchronized DB
            </span>
          </div>

          <div className="space-y-3">
            <div className="p-4 rounded-2xl bg-stone-50/80 border border-stone-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-stone-900">Active Institutional Clearance:</span>
                  <UserRoleBadge role={currentUser.role} size="sm" />
                </div>
                <p className="text-[11px] text-stone-500 max-w-xl">
                  {currentUser.role === 'superadmin' && 'Full system root access: Architecture configurations, all role delegations, and security auditing.'}
                  {currentUser.role === 'admin' && 'Administrative privileges: Manage alumni accounts, directory moderation, opportunity reviews, and announcements.'}
                  {currentUser.role === 'registrar' && 'Registrar authority: Validate student credentials, verify alumni graduation registry records, and audit status.'}
                  {currentUser.role === 'staff' && 'Institutional staff clearance: Departmental notices, campus career posts, and student event coordination.'}
                  {currentUser.role === 'moderator' && 'Community moderator clearance: Review discussion submissions, forum items, and member report flags.'}
                  {currentUser.role === 'employer' && 'Corporate employer clearance: Post job opportunities and browse qualified alumni candidates.'}
                  {currentUser.role === 'alumni' && 'Verified alumni privileges: Discover alumni, connect with classmates, submit career applications, and access campus pass.'}
                </p>
              </div>

              {(currentUser.role === 'admin' || currentUser.role === 'superadmin') ? (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRoleUserUid(currentUser.uid);
                    setSelectedRoleValue(currentUser.role as UserRole);
                    setShowRoleModal(true);
                  }}
                  className="px-4 py-2 bg-[#8B181B] hover:bg-[#721316] text-white rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-2 cursor-pointer shrink-0 active:scale-95"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Modify Authority Role</span>
                </button>
              ) : (
                <span className="text-[11px] text-stone-400 italic">
                  Role managed by Administration
                </span>
              )}
            </div>

            {/* Account UID Verification Chip */}
            <div className="p-3.5 rounded-2xl bg-stone-50/80 border border-stone-200/80 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[11px] font-bold text-stone-800 block">
                  Institutional Account UID
                </span>
                <span className="text-[10px] text-stone-500 font-mono truncate block">
                  {currentUser.uid}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyId}
                className="px-3 py-1.5 bg-white hover:bg-stone-100 border border-stone-200 text-stone-700 rounded-xl text-[10px] font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer shrink-0 active:scale-95"
              >
                {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-stone-400" />}
                <span className={copiedId ? 'text-emerald-700 font-bold' : 'text-stone-700'}>
                  {copiedId ? 'Copied' : 'Copy UID'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 1: SECURITY & CREDENTIALS ACCESS */}
      {(activeFilterPill === 'all' || activeFilterPill === 'security') && (
        <div className="bg-white rounded-[32px] p-6 sm:p-7 border border-stone-200/90 shadow-2xs space-y-5">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-red-50 text-[#8B181B] flex items-center justify-center">
                <Lock className="w-4 h-4 stroke-[2]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-stone-900">Security Credentials & Access</h3>
                <p className="text-xs text-stone-500">Manage account authentication, institutional email, and encryption</p>
              </div>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">
              Active Protection
            </span>
          </div>

          <div className="divide-y divide-stone-100 text-xs">
            {/* Email Setting */}
            <div className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-stone-400 shrink-0" />
                <div>
                  <p className="font-bold text-stone-900 text-xs">Institutional Email Address</p>
                  <p className="text-stone-500 text-[11px]">{currentUser.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEmailModal(true)}
                className="px-3.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl font-semibold transition-colors cursor-pointer self-start sm:self-auto"
              >
                Change Email
              </button>
            </div>

            {/* Password Setting */}
            <div className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <KeyRound className="w-4 h-4 text-stone-400 shrink-0" />
                <div>
                  <p className="font-bold text-stone-900 text-xs">Access Password</p>
                  <p className="text-stone-500 text-[11px]">Protected via authenticated password hash</p>
                </div>
              </div>
              <button
                type="button"
                onClick={openPasswordModal}
                className="px-3.5 py-1.5 bg-[#8B181B] hover:bg-[#721316] text-white rounded-xl font-semibold transition-colors shadow-2xs cursor-pointer self-start sm:self-auto"
              >
                Update Password
              </button>
            </div>

            {/* ========================================================================= */}
            {/* SUB-SECTION: BIOMETRIC PREFERENCES & SECONDARY APP LOCK (MOBILE ONLY)     */}
            {/* ========================================================================= */}
            <div className="mt-6 pt-5 border-t border-stone-100">
              <div className="flex items-center justify-between pb-3.5 mb-3 border-b border-stone-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-red-50 text-[#8B181B] flex items-center justify-center">
                    <ScanFace className="w-4 h-4 stroke-[2]" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                      <span>Multi-Modal Biometrics & Access Gate</span>
                      <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-stone-100 text-stone-700">
                        {biometricAvail.label}
                      </span>
                    </h4>
                    <p className="text-[11px] text-stone-500">
                      Configure Face Detection, hardware Fingerprint / Touch ID sensors, and Emergency PIN fallback
                    </p>
                  </div>
                </div>

                <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-stone-500 font-mono">
                  <span className={`w-2 h-2 rounded-full ${biometricAvail.isAvailable ? 'bg-emerald-500 animate-pulse' : 'bg-stone-300'}`} />
                  <span>{biometricAvail.isAvailable ? 'Biometric Enclave Ready' : 'Sensors Standby'}</span>
                </div>
              </div>

              <div className="space-y-3.5">
                {/* 1. Dashboard Biometric Access Gate */}
                <div className="p-4 rounded-2xl bg-stone-50/80 dark:bg-stone-850/80 border border-stone-200/80 dark:border-stone-800 space-y-3 transition-all hover:bg-stone-50 dark:hover:bg-stone-850">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-stone-900 dark:text-stone-100 text-xs flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span>Dashboard Biometric Gate</span>
                        </p>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          appLockEnabled
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : 'bg-stone-200/70 text-stone-600 dark:bg-stone-800 dark:text-stone-400'
                        }`}>
                          {appLockEnabled ? 'ENFORCED BEFORE DASHBOARD' : 'OFF'}
                        </span>
                      </div>
                      <p className="text-stone-500 dark:text-stone-400 text-[11px] mt-1 leading-relaxed">
                        Protects collegiate records with optical Face Detection, hardware Touch ID / Fingerprint sensor, and Emergency PIN fallback before entering the portal.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleTestBiometrics('face')}
                        disabled={isBiometricTesting}
                        className="px-2.5 py-1.5 bg-white dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 border border-stone-200/80 dark:border-stone-700 rounded-xl font-semibold text-[11px] transition-colors cursor-pointer shadow-2xs flex items-center gap-1.5 disabled:opacity-50"
                        title="Test native Face Detection"
                      >
                        <ScanFace className="w-3.5 h-3.5 text-[#8B181B] dark:text-rose-400" />
                        <span>Face Scan</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleTestBiometrics('fingerprint')}
                        disabled={isBiometricTesting}
                        className="px-2.5 py-1.5 bg-white dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 border border-stone-200/80 dark:border-stone-700 rounded-xl font-semibold text-[11px] transition-colors cursor-pointer shadow-2xs flex items-center gap-1.5 disabled:opacity-50"
                        title="Test native Fingerprint / Touch ID"
                      >
                        <Fingerprint className="w-3.5 h-3.5 text-amber-500" />
                        <span>Fingerprint</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent('applet:lock-dashboard'));
                        }}
                        className="px-2.5 py-1.5 bg-stone-900 hover:bg-black text-white dark:bg-stone-700 dark:hover:bg-stone-600 rounded-xl font-semibold text-[11px] transition-colors cursor-pointer shadow-2xs flex items-center gap-1"
                        title="Immediately lock the dashboard now"
                      >
                        <Lock className="w-3 h-3 text-amber-300" />
                        <span>Lock</span>
                      </button>

                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={appLockEnabled}
                          onChange={(e) => handleToggleAppLock(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-stone-200 dark:bg-stone-700 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#8B181B]" />
                      </label>
                    </div>
                  </div>

                  {/* Persistence confirmation tag */}
                  <div className="pt-2 border-t border-stone-200/60 dark:border-stone-800 flex items-center justify-between flex-wrap gap-2 text-[10px] text-stone-500 dark:text-stone-400">
                    <span className="flex items-center gap-1">
                      <Lock className="w-3 h-3 text-stone-400" />
                      Status: <strong>{appLockEnabled ? 'Enforced on launch, resume & lock' : 'Bypass on launch'}</strong>
                    </span>
                    <span className="font-mono text-[9px] text-stone-400">
                      Capacitor & WebAuthn Multi-Modal
                    </span>
                  </div>
                </div>

                {/* 2. Primary Biometric Quick Sign-In */}
                <div className="p-4 rounded-2xl bg-white border border-stone-200/80 space-y-3 shadow-2xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-stone-900 text-xs">Biometric Quick Sign-In</p>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          biometricEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-600'
                        }`}>
                          {biometricEnabled ? 'ACTIVE' : 'DISABLED'}
                        </span>
                      </div>
                      <p className="text-stone-500 text-[11px] mt-0.5">
                        Store credentials in native Keychain / Keystore to sign in with your face or fingerprint from the login screen
                      </p>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={biometricEnabled}
                          onChange={(e) => handleToggleBiometrics(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-stone-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#8B181B]" />
                      </label>
                    </div>
                  </div>

                  {biometricEnabled && (
                    <div className="pt-2 border-t border-stone-100 flex items-center gap-2 flex-wrap text-xs">
                      <button
                        type="button"
                        onClick={async () => {
                          if (!currentUser) return;
                          const ok = await enableBiometricLogin(currentUser.uid, currentUser.email);
                          if (ok) {
                            showToast('Biometric credentials re-enrolled in hardware vault!', 'success');
                          } else {
                            showToast('Could not re-enroll biometric credentials.', 'error');
                          }
                        }}
                        className="px-2.5 py-1 text-[11px] font-semibold text-[#8B181B] bg-red-50 hover:bg-red-100 rounded-lg cursor-pointer transition-colors"
                      >
                        Re-enroll Biometrics
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!currentUser) return;
                          await disableBiometricLogin(currentUser.uid);
                          setBiometricEnabled(false);
                          showToast('Biometric credentials revoked from hardware vault.', 'info');
                        }}
                        className="px-2.5 py-1 text-[11px] font-medium text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-lg cursor-pointer transition-colors"
                      >
                        Revoke Vault
                      </button>
                    </div>
                  )}
                </div>

                {/* 3. Emergency PIN Fallback Configuration */}
                <div className="p-4 rounded-2xl bg-white border border-stone-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-stone-900 text-xs flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5 text-[#8B181B]" />
                        <span>Emergency PIN</span>
                      </p>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                        {getCampusPinConfig(currentUser.uid).isConfigured ? 'CUSTOM CONFIGURED' : 'DEFAULT 1973'}
                      </span>
                    </div>
                    <p className="text-stone-500 text-[11px] mt-0.5">
                      4-6 digit numeric passcode used if camera is inaccessible or hardware biometric sensors fail
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setPinDialogError(null);
                      setNewCampusPin('');
                      setConfirmCampusPin('');
                      setShowPinModal(true);
                    }}
                    className="px-3 py-1.5 bg-[#8B181B] hover:bg-[#721316] text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs shrink-0 self-start sm:self-auto"
                  >
                    Configure PIN
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: DISPATCH CHANNELS & NOTIFICATION MATRIX */}
      {(activeFilterPill === 'all' || activeFilterPill === 'notifications') && (
        <div className="bg-white rounded-[32px] p-6 sm:p-7 border border-stone-200/90 shadow-2xs space-y-5">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                <Bell className="w-4 h-4 stroke-[2]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-stone-900">Dispatch Channels & Notification Matrix</h3>
                <p className="text-xs text-stone-500">Configure real-time event reminders, direct dispatches, and career notices</p>
              </div>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-stone-100 text-stone-700 font-bold">
              {activeChannelsCount} Enabled
            </span>
          </div>

          <div className="space-y-4">
            {/* 24-Hour Push Notification Safeguard & Audio Chime Banner */}
            <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#8B181B]" />
                  <span className="text-xs font-bold text-stone-900">24h Event & Milestone Chime Safeguard</span>
                  <span
                    className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                      pushPermissionStatus === 'granted'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : pushPermissionStatus === 'denied'
                        ? 'bg-rose-50 text-rose-800 border-rose-200'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}
                  >
                    {pushPermissionStatus === 'granted' ? 'Push Active' : pushPermissionStatus === 'denied' ? 'Blocked' : 'Default'}
                  </span>
                </div>
                <p className="text-[11px] text-stone-600">
                  Campus event kick-off chime & 24-hour advance high-attendance reminder alerts
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {pushPermissionStatus !== 'granted' && (
                  <button
                    type="button"
                    onClick={requestBrowserPushPermission}
                    className="py-1.5 px-3 bg-[#8B181B] hover:bg-[#721316] text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer active:scale-95"
                  >
                    <Bell className="w-3.5 h-3.5" />
                    <span>Authorize OS Push Alerts</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => sendTest24HourAlert()}
                  className="py-1.5 px-3 bg-stone-900 hover:bg-black text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer active:scale-95"
                >
                  <Volume2 className="w-3.5 h-3.5 text-amber-300" />
                  <span>Test Audio Chime & Push</span>
                </button>
              </div>
            </div>

            {/* Toggle 1: Push (Mobile Only) */}
            <PlatformOnly client="mobile">
              <div className="p-3.5 rounded-2xl bg-stone-50/70 border border-stone-200/70 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 pr-4">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-stone-900">Phone Notifications</p>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        Live Push
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-500 mt-0.5">
                      Receive instant alerts on your phone for direct messages, campus events, and announcements even when the app is closed.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={pushEnabled}
                      onChange={async (e) => {
                        const checked = e.target.checked;
                        setPushEnabled(checked);
                        handleToggle('push', checked);
                        if (checked) {
                          const res = await requestPushNotifications(currentUser?.uid);
                          if (res.granted) {
                            showToast('Phone notifications turned on! Real-time alerts active.', 'success');
                          } else if (res.error) {
                            showToast(res.error, 'error');
                          }
                        }
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-stone-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#8B181B]" />
                  </label>
                </div>

                {pushEnabled && (
                  <div className="pt-2.5 border-t border-stone-200/60 space-y-2 text-[11px]">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-stone-600 font-medium">Test Real Notifications:</span>
                      <button
                        type="button"
                        onClick={async () => {
                          showToast('Notification scheduled in 5 seconds! Lock your phone or go to your home screen now.', 'info');
                          const res = await triggerTestPushNotification(currentUser.uid, 5);
                          if (res.success) {
                            showToast(res.message, 'success');
                          } else {
                            showToast(res.message, 'error');
                          }
                        }}
                        className="px-2.5 py-1 rounded-lg bg-[#8B181B] hover:bg-[#721316] text-white font-semibold transition-colors cursor-pointer text-[10px] flex items-center gap-1.5 shadow-2xs active:scale-95"
                      >
                        <Bell className="w-3 h-3" />
                        <span>Test on Phone (5s Delay)</span>
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-stone-400 text-[10px]">Test alert types:</span>
                      <button
                        type="button"
                        onClick={() => handleSendTestPush('event')}
                        className="px-2 py-0.5 rounded-lg bg-white border border-stone-200 hover:border-[#8B181B] text-stone-700 font-semibold transition-colors cursor-pointer text-[10px]"
                      >
                        Event Reminder
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSendTestPush('message')}
                        className="px-2 py-0.5 rounded-lg bg-white border border-stone-200 hover:border-[#8B181B] text-stone-700 font-semibold transition-colors cursor-pointer text-[10px]"
                      >
                        Chat Message
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSendTestPush('announcement')}
                        className="px-2 py-0.5 rounded-lg bg-white border border-stone-200 hover:border-[#8B181B] text-stone-700 font-semibold transition-colors cursor-pointer text-[10px]"
                      >
                        Announcement
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </PlatformOnly>

            {/* Toggle: SMS Urgent Notifications (Web & Mobile) */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-stone-50/70 border border-stone-200/70">
              <div className="min-w-0 pr-4">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold text-stone-900">SMS Urgent & Turnstile Gate Alerts</p>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                    Cellular SMS
                  </span>
                </div>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  Receive critical account recovery codes, security traces, and campus gate notices via cellular SMS.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={smsEnabled}
                  onChange={(e) => {
                    setSmsEnabled(e.target.checked);
                    showToast(e.target.checked ? 'SMS urgent alerts enabled.' : 'SMS alerts disabled.', 'info');
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-stone-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#8B181B]" />
              </label>
            </div>

            {/* Toggle 2: Email */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-stone-50/70 border border-stone-200/70">
              <div className="min-w-0 pr-4">
                <p className="text-xs font-bold text-stone-900">Email Digest & Institutional Broadcasts</p>
                <p className="text-[11px] text-stone-500 mt-0.5">Monthly alumni circulars, reunion invitations, and career opportunities</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={emailEnabled}
                  onChange={(e) => handleToggle('email', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-stone-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#8B181B]" />
              </label>
            </div>

            {/* Toggle 3: Messages */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-stone-50/70 border border-stone-200/70">
              <div className="min-w-0 pr-4">
                <p className="text-xs font-bold text-stone-900">Direct Messages</p>
                <p className="text-[11px] text-stone-500 mt-0.5">Notify when another alumnus or staff member sends you a message</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={messagesEnabled}
                  onChange={(e) => handleToggle('messages', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-stone-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#8B181B]" />
              </label>
            </div>

            {/* Toggle 4: Events */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-stone-50/70 border border-stone-200/70">
              <div className="min-w-0 pr-4">
                <p className="text-xs font-bold text-stone-900">Campus Events & Reunions</p>
                <p className="text-[11px] text-stone-500 mt-0.5">Reminders for events you marked "Going" or "Interested"</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={eventsEnabled}
                  onChange={(e) => handleToggle('events', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-stone-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#8B181B]" />
              </label>
            </div>

            {/* Toggle 5: Jobs */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-stone-50/70 border border-stone-200/70">
              <div className="min-w-0 pr-4">
                <p className="text-xs font-bold text-stone-900">Job Postings & Career Opportunities</p>
                <p className="text-[11px] text-stone-500 mt-0.5">Instant alerts when vacancies matching your academic program are published</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={jobsEnabled}
                  onChange={(e) => handleToggle('jobs', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-stone-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#8B181B]" />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* SECTION: APPEARANCE & THEME STUDIO */}
      {(activeFilterPill === 'all' || activeFilterPill === 'appearance') && (
        <div className="bg-white rounded-[32px] p-6 sm:p-7 border border-stone-200/90 shadow-2xs space-y-5">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                <Palette className="w-4 h-4 stroke-[2]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-stone-900">Appearance & Theme Studio</h3>
                <p className="text-xs text-stone-500">Interface mode, visual contrast, and system theme preferences</p>
              </div>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-stone-100 text-stone-700 font-bold uppercase border border-stone-200">
              {themeMode}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <button
              type="button"
              onClick={() => handleThemeChange('light')}
              className={`p-4 rounded-2xl flex flex-col items-center gap-2 transition-all cursor-pointer border ${
                themeMode === 'light'
                  ? 'bg-amber-50/80 border-amber-400 text-amber-950 font-bold shadow-2xs ring-1 ring-amber-400/40'
                  : 'bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-700'
              }`}
            >
              <Sun className="w-5 h-5 text-amber-600" />
              <div className="text-center">
                <span className="text-xs font-bold block">Light Theme</span>
                <span className="text-[10px] text-stone-400 font-medium">Warm collegiate stone</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleThemeChange('dark')}
              className={`p-4 rounded-2xl flex flex-col items-center gap-2 transition-all cursor-pointer border ${
                themeMode === 'dark'
                  ? 'bg-stone-900 border-stone-700 text-white font-bold shadow-2xs ring-1 ring-stone-600'
                  : 'bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-700'
              }`}
            >
              <Moon className="w-5 h-5 text-amber-400" />
              <div className="text-center">
                <span className="text-xs font-bold block">Dark Theme</span>
                <span className="text-[10px] text-stone-400 font-medium">High contrast obsidian</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleThemeChange('system')}
              className={`p-4 rounded-2xl flex flex-col items-center gap-2 transition-all cursor-pointer border ${
                themeMode === 'system'
                  ? 'bg-blue-50/80 border-blue-400 text-blue-950 font-bold shadow-2xs ring-1 ring-blue-400/40'
                  : 'bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-700'
              }`}
            >
              <Monitor className="w-5 h-5 text-blue-600" />
              <div className="text-center">
                <span className="text-xs font-bold block">System Default</span>
                <span className="text-[10px] text-stone-400 font-medium">Sync with OS appearance</span>
              </div>
            </button>
          </div>

          <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-xs">
            <span className="text-stone-500 text-[10px] font-medium">
              Applied automatically across all Cecilian tabs and sessions
            </span>
            <span className="text-[11px] font-bold text-[#8B181B]">
              Active Configuration
            </span>
          </div>
        </div>
      )}

      {/* SECTION: INSTITUTIONAL GOVERNANCE, SUPPORT & POLICIES */}
      {(activeFilterPill === 'all' || activeFilterPill === 'compliance') && (
        <div className="bg-white rounded-[32px] p-6 sm:p-7 border border-stone-200/90 shadow-2xs space-y-5">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-red-50 text-[#8B181B] flex items-center justify-center">
                <HelpCircle className="w-4 h-4 stroke-[2]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-stone-900">Institutional Governance & Support</h3>
                <p className="text-xs text-stone-500">Alumni network charters, directory policies, FAQ, and registrar support</p>
              </div>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-stone-100 text-stone-700 font-bold border border-stone-200">
              v2.4.0
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {/* Share App Action */}
            <button
              type="button"
              onClick={handleShareApp}
              className="p-4 bg-red-50/70 hover:bg-red-100/80 text-[#8B181B] rounded-2xl font-bold flex items-center justify-between transition-colors cursor-pointer group shadow-2xs border border-red-200/60"
            >
              <div className="flex items-center gap-2.5">
                <Share2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                <span>Share App with Alumni</span>
              </div>
              <span className="text-[10px] bg-white px-2 py-0.5 rounded-full border border-red-200 font-semibold text-stone-700">
                Invite
              </span>
            </button>

            {/* Official College Website */}
            <button
              type="button"
              onClick={() => openExternalUrl('https://stcecilia.edu.ph')}
              className="p-4 bg-stone-50 hover:bg-stone-100 text-stone-800 rounded-2xl font-semibold flex items-center justify-between transition-colors cursor-pointer border border-stone-200/80"
            >
              <span className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-stone-400" />
                <span>Official College Website</span>
              </span>
              <ExternalLink className="w-3.5 h-3.5 text-stone-400" />
            </button>

            {/* FAQ */}
            <button
              type="button"
              onClick={() => setShowFaqModal(true)}
              className="p-4 bg-stone-50 hover:bg-stone-100 text-stone-800 rounded-2xl font-semibold flex items-center justify-between transition-colors cursor-pointer border border-stone-200/80"
            >
              <span className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-stone-400" />
                <span>Frequently Asked Questions</span>
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-stone-400" />
            </button>

            {/* Privacy Policy */}
            <button
              type="button"
              onClick={() => setShowPrivacyModal(true)}
              className="p-4 bg-stone-50 hover:bg-stone-100 text-stone-800 rounded-2xl font-semibold flex items-center justify-between transition-colors cursor-pointer border border-stone-200/80"
            >
              <span className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-stone-400" />
                <span>Directory Privacy Policy</span>
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-stone-400" />
            </button>

            {/* About */}
            <button
              type="button"
              onClick={() => setShowAboutModal(true)}
              className="p-4 bg-stone-50 hover:bg-stone-100 text-stone-800 rounded-2xl font-semibold flex items-center justify-between transition-colors cursor-pointer border border-stone-200/80"
            >
              <span className="flex items-center gap-2">
                <Info className="w-4 h-4 text-stone-400" />
                <span>About Alumni Network</span>
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-stone-400" />
            </button>

            {/* Contact Registrar Support */}
            <a
              href="mailto:support@scc.edu.ph"
              className="p-4 bg-stone-50 hover:bg-stone-100 text-[#8B181B] rounded-2xl font-bold flex items-center justify-between transition-colors cursor-pointer border border-stone-200/80"
            >
              <span className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#8B181B]" />
                <span>Contact IT Registrar Support</span>
              </span>
              <ExternalLink className="w-3.5 h-3.5 text-stone-400" />
            </a>
          </div>
        </div>
      )}

      {/* SECTION 3: SESSION TERMINATION & DANGER DESK */}
      {(activeFilterPill === 'all' || activeFilterPill === 'security') && (
        <div className="bg-red-50/40 rounded-[32px] p-6 sm:p-7 border border-red-200/80 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-red-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-red-100 text-red-800 flex items-center justify-center">
                <LogOut className="w-4 h-4 stroke-[2]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-red-950">Session & Account Lifecycle</h3>
                <p className="text-xs text-red-700/80">Manage active authenticated token or remove alumni record</p>
              </div>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-100 text-red-800 font-bold border border-red-200">
              Authorized Actions
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <div>
              <p className="text-xs font-bold text-stone-900">Active Console Session</p>
              <p className="text-[11px] text-stone-500">End your active authenticated session on this device</p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(true)}
                className="w-full sm:w-auto px-4 py-2 bg-white hover:bg-stone-100 border border-stone-300 text-stone-800 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-2xs transition-colors"
              >
                <LogOut className="w-3.5 h-3.5 text-stone-600" />
                <span>Log Out of Console</span>
              </button>

              {!isAdminRole && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full sm:w-auto px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Account</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

        </div>
      </div>

      {/* ========================================================================= */}
      {/* CHANGE EMAIL MODAL                                                        */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {showEmailModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-stone-200 text-xs space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-stone-900">Change Account Email</h3>
                    <p className="text-[11px] text-stone-500">Update your verified address for circulars</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEmailModal(false)}
                  className="p-1 rounded-lg text-stone-400 hover:bg-stone-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {emailStatusMessage ? (
                <div className="my-4 p-3 bg-emerald-50 text-emerald-800 rounded-xl font-medium flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{emailStatusMessage}</span>
                </div>
              ) : (
                <form onSubmit={handleChangeEmail} className="space-y-3.5">
                  <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                    <span className="text-stone-500 block text-[11px]">Current Address</span>
                    <span className="font-bold text-stone-900 text-xs">{currentUser.email}</span>
                  </div>

                  <div>
                    <label className="font-bold text-stone-700 block mb-1">New Email Address *</label>
                    <input
                      type="email"
                      required
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="e.g. cecilian.alumni@domain.com"
                      className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:border-[#8B181B]"
                    />
                  </div>

                  <div className="pt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowEmailModal(false)}
                      className="px-3.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl font-medium cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-[#8B181B] hover:bg-[#721316] text-white rounded-xl font-bold cursor-pointer shadow-2xs"
                    >
                      Dispatch Verification
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* CHANGE PASSWORD MODAL                                                     */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {showPasswordModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 sm:p-7 w-full max-w-md shadow-2xl border border-stone-200 text-xs space-y-4"
            >
              <div className="flex items-center justify-between pb-3.5 border-b border-stone-200">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#8B181B]/10 flex items-center justify-center text-[#8B181B]">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-stone-900">Change Account Password</h3>
                    <p className="text-[11px] text-stone-500">Verify current password and set your new credential</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="text-stone-400 hover:text-stone-600 p-1 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {passwordSuccess ? (
                <div className="my-5 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-xs">Password Updated</p>
                    <p className="text-[11px] text-emerald-700 mt-0.5">{passwordSuccess}</p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleChangePassword} className="space-y-3.5">
                  {passwordError && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                      <span>{passwordError}</span>
                    </div>
                  )}

                  {/* Old Password */}
                  <div>
                    <label className="text-xs font-semibold text-stone-700 block mb-1">
                      Current (Old) Password *
                    </label>
                    <div className="relative">
                      <input
                        type={showOldPass ? 'text' : 'password'}
                        required
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                        placeholder="Enter your current password"
                        className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs pr-10 focus:bg-white focus:outline-hidden focus:border-[#8B181B]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowOldPass(!showOldPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 cursor-pointer"
                      >
                        {showOldPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* New Password */}
                  <div>
                    <label className="text-xs font-semibold text-stone-700 block mb-1">
                      New Password *
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPass ? 'text' : 'password'}
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs pr-10 focus:bg-white focus:outline-hidden focus:border-[#8B181B]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPass(!showNewPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 cursor-pointer"
                      >
                        {showNewPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <p className="text-[10px] text-stone-400 mt-1">Must be at least 6 characters and different from old password.</p>
                  </div>

                  {/* Confirm New Password */}
                  <div>
                    <label className="text-xs font-semibold text-stone-700 block mb-1">
                      Confirm New Password *
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPass ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-type new password"
                        className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs pr-10 focus:bg-white focus:outline-hidden focus:border-[#8B181B]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPass(!showConfirmPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 cursor-pointer"
                      >
                        {showConfirmPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {resetEmailStatus && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{resetEmailStatus}</span>
                    </div>
                  )}

                  {/* Send Password Reset Link by Email Option */}
                  <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/80 text-[11px] text-stone-600 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-stone-700">
                      <Mail className="w-3.5 h-3.5 text-[#8B181B] shrink-0" />
                      <span>Prefer to change via email instructions?</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleSendResetEmail}
                      disabled={isSendingResetEmail}
                      className="text-xs font-bold text-[#8B181B] hover:text-[#721316] hover:underline cursor-pointer flex items-center gap-1 shrink-0 disabled:opacity-50"
                    >
                      {isSendingResetEmail ? 'Sending...' : 'Email Reset Link'}
                    </button>
                  </div>

                  {/* Security Policy Reminder */}
                  <p className="text-[10px] text-stone-500 leading-relaxed">
                    🔒 Institutional Security Protocol: Changing your password automatically dispatches a verified security confirmation email to <strong className="text-stone-700">{currentUser.email}</strong>.
                  </p>

                  <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowPasswordModal(false)}
                      className="px-3.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl font-medium cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-[#8B181B] hover:bg-[#721316] text-white rounded-xl font-bold cursor-pointer shadow-2xs"
                    >
                      Update Password
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* ROLE MODIFICATION MODAL                                                   */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {showRoleModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 sm:p-7 w-full max-w-md shadow-2xl border border-stone-200 text-xs space-y-4"
            >
              <div className="flex items-center justify-between pb-3.5 border-b border-stone-200">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center text-[#8B181B]">
                    <ShieldCheck className="w-4 h-4 stroke-[2]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-stone-900">Modify Authority Role</h3>
                    <p className="text-[11px] text-stone-500">Update clearance tier and persist to Firestore database</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRoleModal(false)}
                  disabled={isSavingRole}
                  className="text-stone-400 hover:text-stone-600 p-1 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {roleSuccess ? (
                <div className="my-5 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-xs">Role Committed</p>
                    <p className="text-[11px] text-emerald-700 mt-0.5">{roleSuccess}</p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleUpdateRole} className="space-y-4">
                  {roleError && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                      <span>{roleError}</span>
                    </div>
                  )}

                  {/* Target User Selector */}
                  <div>
                    <label className="text-xs font-semibold text-stone-700 block mb-1">
                      Target User Account *
                    </label>
                    <select
                      value={selectedRoleUserUid}
                      onChange={(e) => {
                        const targetUid = e.target.value;
                        setSelectedRoleUserUid(targetUid);
                        const userObj = users.find((u) => u.uid === targetUid) || (currentUser.uid === targetUid ? currentUser : null);
                        if (userObj) {
                          setSelectedRoleValue(userObj.role as UserRole);
                        }
                      }}
                      disabled={isSavingRole}
                      className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:border-[#8B181B] cursor-pointer"
                    >
                      <option value={currentUser.uid}>
                        {currentUser.name} ({currentUser.email}) - Current User [Self]
                      </option>
                      {users
                        .filter((u) => u.uid !== currentUser.uid)
                        .map((u) => (
                          <option key={u.uid} value={u.uid}>
                            {u.name} ({u.email || u.uid}) - Currently {u.role.toUpperCase()}
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* New Role Selector */}
                  <div>
                    <label className="text-xs font-semibold text-stone-700 block mb-1">
                      Assigned Role Tier *
                    </label>
                    <select
                      value={selectedRoleValue}
                      onChange={(e) => setSelectedRoleValue(e.target.value as UserRole)}
                      disabled={isSavingRole}
                      className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-hidden focus:border-[#8B181B] cursor-pointer"
                    >
                      <option value="alumni">Alumni (Standard Portal Access)</option>
                      <option value="moderator">Moderator (Community Governance)</option>
                      <option value="staff">Staff (Department Operations)</option>
                      <option value="registrar">Registrar (Verification Officer)</option>
                      <option value="admin">Admin (Portal Administrator)</option>
                      {currentUser?.role === 'superadmin' && (
                        <option value="superadmin">Superadmin (Root System Authority)</option>
                      )}
                      <option value="employer">Employer (Career Partner)</option>
                    </select>
                  </div>

                  <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-[11px] text-stone-600 space-y-1">
                    <p className="font-semibold text-stone-800 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Persistence Guarantee:</span>
                    </p>
                    <p className="text-stone-500">
                      Changes commit directly to the Firestore collection and update credentials across all client and backend sessions.
                    </p>
                  </div>

                  <div className="pt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowRoleModal(false)}
                      disabled={isSavingRole}
                      className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl font-medium cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingRole}
                      className="px-4 py-2 bg-[#8B181B] hover:bg-[#721316] text-white rounded-xl font-bold cursor-pointer shadow-2xs flex items-center gap-1.5 disabled:opacity-60"
                    >
                      {isSavingRole && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>{isSavingRole ? 'Persisting...' : 'Save Role Change'}</span>
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* FAQ MODAL                                                                 */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {showFaqModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 sm:p-7 w-full max-w-lg shadow-2xl border border-stone-200 max-h-[85vh] overflow-y-auto space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                    <HelpCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-stone-900">Frequently Asked Questions</h3>
                    <p className="text-[11px] text-stone-500">St. Cecilia's College Alumni Network</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFaqModal(false)}
                  className="p-1 rounded-lg text-stone-400 hover:bg-stone-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4 text-xs text-stone-700 leading-relaxed">
                <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200/80">
                  <h4 className="font-bold text-stone-900">Who can connect with who?</h4>
                  <p className="mt-1">
                    Peer dispatches are open across verified alumni, staff officers, and authorized university administrators. Unverified accounts cannot message directory members.
                  </p>
                </div>

                <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200/80">
                  <h4 className="font-bold text-stone-900">How do I verify my degree and graduation records?</h4>
                  <p className="mt-1">
                    University Registrars cross-match graduation masterlists. You can also submit student verification via the Registrar Matcher in your profile.
                  </p>
                </div>

                <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200/80">
                  <h4 className="font-bold text-stone-900">Who can create events and circulars?</h4>
                  <p className="mt-1">
                    Admins, Registrars, Staff members, and Chapter Leaders have publishing privileges for official campus events and announcements.
                  </p>
                </div>

                <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200/80">
                  <h4 className="font-bold text-stone-900">How can I post jobs on the Alumni Board?</h4>
                  <p className="mt-1">
                    Any verified alumnus or corporate partner can post career openings directly from the Career Opportunities hub.
                  </p>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowFaqModal(false)}
                  className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl font-semibold cursor-pointer"
                >
                  Close FAQ
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* PRIVACY POLICY MODAL                                                      */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {showPrivacyModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 sm:p-7 w-full max-w-lg shadow-2xl border border-stone-200 max-h-[85vh] overflow-y-auto space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-stone-900">Privacy Policy & Directory Governance</h3>
                    <p className="text-[11px] text-stone-500">St. Cecilia's College - Cebu, Inc.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPrivacyModal(false)}
                  className="p-1 rounded-lg text-stone-400 hover:bg-stone-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-stone-700 leading-relaxed">
                <p>
                  The Cecilian Alumni Portal complies strictly with Republic Act No. 10173 (Data Privacy Act of 2012). Personal contact details, phone numbers, and private emails are never exposed to public internet search crawlers.
                </p>
                <p>
                  Directory information is visible only to authenticated alumni, staff officers, and authorized university administrators who have accepted institutional terms.
                </p>
                <p>
                  You retain full control over your career tracer visibility and can delete your profile records permanently at any time.
                </p>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowPrivacyModal(false)}
                  className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl font-semibold cursor-pointer"
                >
                  Acknowledge & Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* ABOUT MODAL                                                               */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {showAboutModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 sm:p-7 w-full max-w-md shadow-2xl border border-stone-200 text-center text-xs space-y-4"
            >
              <img
                src="/assets/cecilians-seal.jpg"
                alt="St. Cecilia's Seal"
                className="w-16 h-16 rounded-full object-cover mx-auto border-2 border-[#8B181B] shadow-md"
              />
              <div>
                <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 font-sans tracking-tight">St. Cecilia's College Alumni Network</h3>
                <p className="text-[11px] text-stone-400 mt-0.5">Version 2.4.0 (Production Release)</p>
              </div>
              <p className="text-stone-600 leading-relaxed text-xs">
                Empowering graduates of St. Cecilia's College - Cebu, Inc. across disciplines with lifelong mentorship, institutional verification, and career mobility.
              </p>
              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => openExternalUrl('https://stcecilia.edu.ph')}
                  className="w-full py-2.5 px-3 bg-red-50 hover:bg-red-100/80 text-[#8B181B] rounded-xl font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer text-xs"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Visit Official College Website</span>
                  <ExternalLink className="w-3.5 h-3.5 text-[#8B181B]" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowAboutModal(false)}
                  className="px-5 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl font-semibold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* LOGOUT CONFIRMATION MODAL                                                 */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-stone-200 text-xs text-center space-y-3"
            >
              <div className="w-12 h-12 rounded-2xl bg-red-50 text-[#8B181B] flex items-center justify-center mx-auto shadow-2xs">
                <LogOut className="w-6 h-6 stroke-[2]" />
              </div>
              <h3 className="text-base font-bold text-stone-900">End Active Session?</h3>
              <p className="text-stone-500 leading-relaxed">
                Are you sure you want to end your authenticated session on this workstation?
              </p>

              {biometricEnabled && (
                <label className="flex items-center gap-2 justify-center text-[11px] text-stone-600 cursor-pointer pt-1 select-none">
                  <input
                    type="checkbox"
                    checked={revokeBiometricsOnLogout}
                    onChange={(e) => setRevokeBiometricsOnLogout(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-stone-300 text-[#8B181B] focus:ring-[#8B181B]"
                  />
                  <span>Also revoke biometric quick unlock on this device</span>
                </label>
              )}

              <div className="pt-3 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowLogoutConfirm(false)}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 rounded-xl font-medium text-stone-700 cursor-pointer"
                >
                  Stay Connected
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowLogoutConfirm(false);
                    logout({ revokeBiometrics: revokeBiometricsOnLogout });
                  }}
                  className="px-4 py-2 bg-[#8B181B] hover:bg-[#721316] text-white rounded-xl font-bold shadow-2xs cursor-pointer"
                >
                  Yes, Log Out
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* DELETE ACCOUNT CONFIRMATION MODAL                                         */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {!isAdminRole && showDeleteConfirm && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-red-200 text-xs space-y-3"
            >
              <div className="flex items-center gap-2.5 text-red-600">
                <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-red-950">Permanently Remove Account?</h3>
              </div>
              <p className="text-stone-600 leading-relaxed">
                This action is permanent and irreversible. Your alumni registry verification, direct message history, and career postings will be permanently expunged.
              </p>
              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 rounded-xl text-stone-700 font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    deleteAccount();
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-xs cursor-pointer"
                >
                  Permanently Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* CAMPUS PIN CONFIGURATION MODAL                                            */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {showPinModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-stone-200 text-xs space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-red-50 text-[#8B181B] flex items-center justify-center">
                    <KeyRound className="w-4 h-4 stroke-[2]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-stone-900">Emergency PIN</h3>
                    <p className="text-[11px] text-stone-500">4 to 6 digit backup passcode</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPinModal(false)}
                  className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {pinDialogError && (
                <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-[11px] flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-600" />
                  <span>{pinDialogError}</span>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">
                    New 4-6 Digit PIN
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={newCampusPin}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setNewCampusPin(val);
                    }}
                    placeholder="Enter 4-6 digits"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 focus:outline-hidden focus:ring-2 focus:ring-[#8B181B] text-center tracking-widest text-base font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">
                    Confirm PIN
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={confirmCampusPin}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setConfirmCampusPin(val);
                    }}
                    placeholder="Re-enter PIN"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 focus:outline-hidden focus:ring-2 focus:ring-[#8B181B] text-center tracking-widest text-base font-mono"
                  />
                </div>

                <p className="text-[10px] text-stone-400 leading-relaxed">
                  Default collegiate founding year PIN is <strong>1973</strong>. Customizing this Emergency PIN protects your account if cameras or fingerprint sensors are unavailable.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPinModal(false)}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveCampusPin}
                  className="px-4 py-2 bg-[#8B181B] hover:bg-[#721316] text-white rounded-xl font-bold transition-all shadow-2xs cursor-pointer"
                >
                  Save Emergency PIN
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
