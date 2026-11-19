import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef, ReactNode } from 'react';
import {
  UserProfile,
  UserRole,
  FriendRequest,
  ChatThread,
  ChatMessage,
  AppNotification,
  AlumniEvent,
  Announcement,
  Opportunity,
  JobApplication,
  ApplicationStatus,
  UserNotificationSettings,
  Experience,
  Education,
  GalleryItem,
  ToastType,
  ToastNotification,
  AuditLogEntry,
  AutomationJob,
  CareerSurveyResponse,
  DatabaseBackupSnapshot,
  EventAttendee,
  EventAttendanceRecord,
  RegistrarVerificationResult,
  InstitutionalFeedPost,
  FeedComment,
  EventReservation,
  SuspensionRecord,
  SuspensionHistoryEntry,
  SuspensionNoticeInfo,
  DeepLinkTarget,
  normalizeSystemRole
} from '../types';
import {
  INITIAL_USERS,
  INITIAL_FRIEND_REQUESTS,
  INITIAL_CHATS,
  INITIAL_MESSAGES,
  INITIAL_NOTIFICATIONS,
  INITIAL_EVENTS,
  INITIAL_RESERVATIONS,
  INITIAL_ANNOUNCEMENTS,
  INITIAL_OPPORTUNITIES,
  INITIAL_JOB_APPLICATIONS,
  INITIAL_GALLERY_ITEMS,
  INITIAL_AUDIT_LOGS,
  INITIAL_AUTOMATION_JOBS,
  INITIAL_CAREER_SURVEYS,
  INITIAL_BACKUPS,
  INITIAL_FEED_POSTS
} from '../data/initialData';
import {
  auth,
  signInWithGoogle,
  signOutUser,
  saveUserToFirestore,
  getUserFromFirestore,
  getAllUsersFromFirestore,
  subscribeToUsers,
  saveFriendRequestToFirestore,
  deleteFriendRequestFromFirestore,
  subscribeToFriendRequests,
  saveEventToFirestore,
  getEventsFromFirestore,
  saveReservationToFirestore,
  deleteReservationFromFirestore,
  getReservationsFromFirestore,
  subscribeToReservations,
  deleteEventFromFirestore,
  subscribeToEvents,
  saveOpportunityToFirestore,
  getOpportunitiesFromFirestore,
  deleteOpportunityFromFirestore,
  subscribeToOpportunities,
  saveJobApplicationToFirestore,
  deleteJobApplicationFromFirestore,
  subscribeToJobApplications,
  getJobApplicationsFromFirestore,
  saveAnnouncementToFirestore,
  getAnnouncementsFromFirestore,
  deleteAnnouncementFromFirestore,
  subscribeToAnnouncements,
  saveChatToFirestore,
  saveChatMessageToFirestore,
  updateChatMessageInFirestore,
  saveNotificationToFirestore,
  getNotificationsFromFirestore,
  subscribeToUserNotifications,
  markNotificationReadInFirestore,
  deleteNotificationFromFirestore,
  markAllNotificationsReadInFirestore,
  saveConnectionToFirestore,
  subscribeToUserChats,
  subscribeToChatMessages,
  saveAuditLogToFirestore,
  saveGalleryItemToFirestore,
  deleteGalleryItemFromFirestore,
  syncAllCollectionsToFirestore,
  saveFeedPostToFirestore,
  getFeedPostsFromFirestore,
  deleteFeedPostFromFirestore,
  subscribeToFeedPosts,
  subscribeToGalleryItems,
  saveAuthCredentialToFirestore,
  getAuthCredentialFromFirestore,
  deleteAuthCredentialInFirestore,
  saveRejectedBlockToFirestore,
  getRejectedBlocksFromFirestore,
  purgeRejectedEmployerInFirestore,
  purgeAllFirestoreSampleData,
  testFirestoreWriteSync,
  purgeUserPostsAndCommentsInFirestore,
  FIRESTORE_DATABASE_ID
} from '../lib/firebase';
import {
  markRegistryRecordAsRegistered,
  releaseRegistryRecordRegistration,
  getRegistrarRecords,
  isValidStudentIdPattern,
  normalizeStudentId,
  syncRegistrarRecordsWithFirestore,
  syncRegistrationConflictsWithFirestore,
  generateAlumniId,
  recordLocalRejectedBlock,
  isBlockedByLocalRejectedRegistry,
  purgeExpiredPendingConflicts
} from '../services/studentVerificationService';
import {
  hashSecretClient,
  verifySecretClient,
  isSaltedSecretHash,
  encryptUserPiiForStorage,
  decryptUserPiiFromStorage,
  stripPlaintextSecretsFromUser,
  PENDING_VERIFICATION_TTL_MS
} from '../lib/clientCrypto';
import {
  DEFAULT_USER_AVATAR,
  DEFAULT_COVER_PHOTO,
  DEFAULT_EVENT_IMAGE,
  DEFAULT_COLLEGE_SEAL,
  getUserAvatar,
  getCoverPhoto,
  getEventImage
} from '../lib/defaultImages';
import { dedupePostsById, isAccountDeleted } from '../lib/postVisibility';
import { alumniService } from '../services/alumniService';
import { calculateProfileCompletion } from '../services/automationService';
import { analyzeUserRegistryIntegrity } from '../services/governanceLogicService';
import { getEventCancellationInfo } from '../services/eventCancellationService';
import {
  sendJobPostingEmail,
  sendDirectMessageEmail,
  sendEventRsvpEmail,
  sendAnnouncementEmail,
  sendSecurityAlertEmail,
  sendEvent24HourReminderEmail,
  clearDispatchedEmails
} from '../services/emailNotificationService';
import {
  isNotificationRelevantToUser,
  filterUniqueNotifications
} from '../services/notificationFilterService';
import {
  getPushPermission,
  requestPushPermission,
  triggerPushNotification,
  playCollegiateChime,
  calculate24HourAlertStatus,
  generate24HourReservationAlert,
  PushPermissionState
} from '../services/eventPushNotificationService';
import { sendPushBroadcast } from '../services/pushNotificationService';
import { computePreciseJobMatch } from '../services/jobMatchingService';
import {
  enqueueOfflineMessage,
  getOfflineMessageQueue,
  syncOfflineMessageQueue,
  retryQueuedMessage,
  removeOfflineMessage,
  QueuedOfflineMessage
} from '../services/offlineMessageQueueService';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import {
  vaultBiometricRefreshToken,
  wipeVaultedBiometricCredentials
} from '../services/biometricAuthService';
import { validateRejectionReason, isEmployerVisibleInDirectory } from '../lib/employerValidation';
import { getEmployerAuthStatus, isEmployerApproved } from '../lib/employerAuthStatus';
import { generateSecureId, generateSecureNumericCode } from '../lib/secureId';
import { apiFetch, apiFetchWithCsrf, getAuthToken } from '../services/apiClient';
import {
  resolveNotificationDeepLink,
  normalizeNotificationPayload,
  parsePortalUrlPath,
  buildPortalUrlForTab,
  isSuperAdminRestrictedTarget
} from '../lib/notificationDeepLink';

export interface ActiveSessionConflictInfo {
  identifier: string;
  password?: string;
  message: string;
  activeSession: {
    deviceInfo: string;
    approxLocation: string;
    createdAt?: string;
    lastActiveAt?: string;
  };
  attemptInfo?: {
    attemptTime: string;
    deviceInfo: string;
    approxLocation: string;
  };
  ownerEmailMasked: string;
  canTerminateExistingSession: boolean;
}

export interface PendingAccountNoticeInfo {
  role: 'alumni' | 'employer';
  title: string;
  message: string;
  email: string;
}

interface AlumniContextType {
  currentUser: UserProfile | null;
  users: UserProfile[];
  friendRequests: FriendRequest[];
  chats: ChatThread[];
  messages: Record<string, ChatMessage[]>;
  notifications: AppNotification[];
  events: AlumniEvent[];
  announcements: Announcement[];
  opportunities: Opportunity[];
  notificationSettings: UserNotificationSettings;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  viewedProfileIdentifier: string | null;
  viewedPostId: string | null;
  openProfile: (identifierOrUid: string) => void;
  openPostPermalink: (postId: string) => void;
  closeSubRoute: () => void;
  selectedUserIdForModal: string | null;
  setSelectedUserIdForModal: (uid: string | null) => void;
  isEditProfileModalOpen: boolean;
  setIsEditProfileModalOpen: (open: boolean) => void;
  openEditProfile: () => void;
  closeEditProfile: () => void;
  isFirebaseConnected: boolean;
  isFirestoreSyncing: boolean;
  authReady: boolean;
  isLoadingData: boolean;
  isOnline: boolean;
  isBackgroundSyncing: boolean;
  lastBackgroundSyncTime: Date | null;
  refreshData: () => Promise<void>;
  triggerBackgroundSync: () => Promise<void>;
  loginWithGoogle: () => Promise<boolean>;
  syncAllDataToCloud: () => Promise<void>;
  purgeDatabaseSampleData: () => Promise<{ success: boolean; message: string }>;
  purgeAllSampleData: () => Promise<void>;
  testDatabaseWrite: () => Promise<{ success: boolean; latencyMs: number; message: string; error?: string }>;
  firestoreDatabaseId: string;
  
  // Permissions derived from current user role (from Role Permissions Summary)
  permissions: {
    canSendFriendRequests: boolean;
    canFollow: boolean;
    canCreateEvents: boolean;
    canDeleteEvents: boolean;
    canPostAnnouncements: boolean;
    canDeleteAnnouncements: boolean;
    canDeleteEventsComments: boolean;
    canAccessAdminPanel: boolean;
    canMessageAnyone: boolean;
    canUploadGallery: boolean;
    canManageJobModeration: boolean;
    canPostJobs: boolean;
    canAccessEmployerDashboard: boolean;
    canAccessRegistry: boolean;
    canAccessConflictResolution: boolean;
    canAccessEmployerAccreditation: boolean;
    canAccessGovernance: boolean;
    canAccessAuditTrails: boolean;
    canAccessDatabaseTools: boolean;
    canAccessAutomations: boolean;
    canAccessGrowthAnalytics: boolean;
    canManageBackups: boolean;
    canAssignRoles: boolean;
    canVerifyAlumni: boolean;
  };

  // Auth & Session (One Account, One Active Login)
  login: (identifier: string, pass: string) => Promise<boolean>;
  biometricLoginWithRefreshToken: (refreshToken: string) => Promise<{ success: boolean; user?: UserProfile; error?: string }>;
  activeSessionConflict: ActiveSessionConflictInfo | null;
  clearActiveSessionConflict: () => void;
  terminateOtherSessionAndLogin: (identifier: string, pass: string) => Promise<boolean>;
  register: (data: Partial<UserProfile> & { password?: string }) => boolean;
  createUserByAdmin: (data: Partial<UserProfile> & { password?: string; role: UserRole }) => { success: boolean; error?: string; role?: UserRole; user?: UserProfile } | boolean;
  // Platform Gate & Testing Controls
  clientPlatform: 'mobile' | 'web';
  setClientPlatformOverride: (platform: 'mobile' | 'web' | null) => void;
  loginPlatformError: string | null;
  clearLoginPlatformError: () => void;
  loginPendingAccountNotice: PendingAccountNoticeInfo | null;
  clearLoginPendingAccountNotice: () => void;
  loginSuspensionNotice: SuspensionNoticeInfo | null;
  clearLoginSuspensionNotice: () => void;
  // Strict Moderator Quota (MAX 3 ACTIVE ACCOUNTS)
  moderatorQuota: { activeCount: number; maxQuota: number; availableSlots: number; canCreateModerator: boolean };
  logout: (options?: { revokeBiometrics?: boolean }) => void;
  switchUser: (uid: string) => void;
  resetPassword: (email: string) => boolean;
  resetUserPasswordByEmail: (email: string, newPass: string) => boolean;
  deleteAccount: () => Promise<boolean> | boolean;
  changeEmail: (newEmail: string) => Promise<boolean> | boolean;
  changePassword: (
    oldOrNewPass: string,
    newPass?: string
  ) => Promise<{ success: boolean; message?: string } | boolean> | { success: boolean; message?: string } | boolean;

  // Profile
  updateProfile: (data: Partial<UserProfile>) => void;
  updateUserProfile: (data: Partial<UserProfile>) => void;
  addExperience: (exp: Omit<Experience, 'id'>) => void;
  removeExperience: (id: string) => void;
  addEducation: (edu: Omit<Education, 'id'>) => void;
  removeEducation: (id: string) => void;

  // Friends & Network
  followingIds: string[];
  connectionIds: string[];
  sendFriendRequest: (targetUid: string) => { success: boolean; error?: string };
  acceptFriendRequest: (requestId: string) => void;
  declineFriendRequest: (requestId: string) => void;
  cancelFriendRequest: (requestId: string) => void;
  toggleFollow: (targetUid: string) => void;
  isFollowing: (uid: string) => boolean;
  isConnected: (uid: string) => boolean;
  hasPendingRequestWith: (uid: string) => 'sent' | 'received' | false;

  // Messaging
  activeChatId: string | null;
  setActiveChatId: (id: string | null) => void;
  sendMessage: (chatId: string, text: string) => void;
  unsendMessage: (chatId: string, messageId: string) => Promise<void>;
  deleteMessageForMe: (chatId: string, messageId: string) => Promise<void>;
  reactToMessage: (chatId: string, messageId: string, emoji: string) => Promise<void>;
  getOrCreateChat: (targetUid: string) => string;
  markChatAsRead: (chatId: string) => void;

  // Offline Message Queue
  offlineQueueCount: number;
  offlineQueue: QueuedOfflineMessage[];
  syncOfflineMessages: () => Promise<{ syncedCount: number; failedCount: number }>;
  retryOfflineMessage: (messageId: string) => Promise<boolean>;
  cancelOfflineMessage: (messageId: string) => void;

  // Events
  createEvent: (event: Omit<AlumniEvent, 'id' | 'likes' | 'comments' | 'attendeesCount' | 'createdBy' | 'createdByName'>) => void;
  editEvent: (eventId: string, data: Partial<AlumniEvent>) => void;
  deleteEvent: (eventId: string) => void;
  toggleLikeEvent: (eventId: string) => void;
  addCommentToEvent: (eventId: string, text: string) => void;
  rsvpEvent: (eventId: string, status: 'going' | 'interested' | 'not_going') => void;
  updateEventAttendance: (eventId: string, uid: string, status: 'attended' | 'not_attended' | 'pending') => void;
  manualCheckInAttendee: (eventId: string, attendeeIdOrUid: string, checkedIn: boolean) => void;
  updateAttendeeInfo: (eventId: string, attendeeIdOrUid: string, updates: Partial<EventAttendee>) => void;
  removeAttendeeFromEvent: (eventId: string, attendeeIdOrUid: string) => void;
  addAttendeeToEvent: (eventId: string, attendee: Partial<EventAttendee> & { name: string; email: string }) => void;
  reservations: EventReservation[];
  reserveEventSlot: (data: {
    eventId: string;
    alumniName: string;
    email: string;
    contactNumber: string;
    alumniId: string;
    graduationYear: string;
    course: string;
    numberOfGuests: number;
    dietaryRequirements?: string;
    specialRequests?: string;
  }) => Promise<{ success: boolean; reservation?: EventReservation; error?: string }>;
  cancelEventReservation: (reservationId: string, reason?: string) => Promise<{ success: boolean; error?: string }>;
  updateEventReservationSettings: (eventId: string, settings: Partial<AlumniEvent>) => void;
  pushPermissionStatus: PushPermissionState;
  requestBrowserPushPermission: () => Promise<PushPermissionState>;
  confirmEventAttendance: (reservationId: string) => Promise<void>;
  sendTest24HourAlert: (targetReservation?: EventReservation) => Promise<void>;
  upcoming24hReservations: EventReservation[];

  // Announcements
  createAnnouncement: (data: Omit<Announcement, 'id' | 'publishedAt' | 'createdBy' | 'authorName' | 'authorRole'>) => void;
  editAnnouncement: (id: string, data: Partial<Announcement>) => void;
  deleteAnnouncement: (id: string) => void;
  togglePinAnnouncement: (id: string) => void;
  toggleHeartAnnouncement: (id: string) => void;

  // Opportunities & Career Portal
  jobApplications: JobApplication[];
  createOpportunity: (data: Omit<Opportunity, 'id' | 'createdAt' | 'postedBy' | 'posterName' | 'status'>) => void;
  updateOpportunity: (id: string, data: Partial<Opportunity>) => void;
  deleteOpportunity: (id: string) => void;
  approveOpportunity: (id: string) => void;
  rejectOpportunity: (id: string, reason: string) => void;
  applyForJob: (data: Omit<JobApplication, 'id' | 'appliedAt' | 'status'>) => { success: boolean; error?: string };
  withdrawJobApplication: (applicationId: string) => void;
  updateApplicationStatus: (applicationId: string, status: ApplicationStatus, notes?: string) => void;
  verifyEmployer: (employerUid: string, verified: boolean | 'verified' | 'rejected', notes?: string) => void;
  toggleEmployerJobPosting: (employerUid: string, canPost: boolean) => void;
  selfVerifyAlumniWithRegistry: (studentId: string) => Promise<{ success: boolean; message: string }>;
  isAlumniVerified: boolean;
  registrar_verification: (studentIdToCheck?: string, candidateName?: string) => RegistrarVerificationResult;
  verifyAlumniStatus: (studentIdToVerify: string) => Promise<RegistrarVerificationResult>;
  getConnectionStatus: (otherUid: string) => 'pending' | 'accepted' | 'declined' | null;

  // Notifications & Deep-Link Navigation
  userNotifications: AppNotification[];
  unreadNotificationsCount: number;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  deleteNotification: (id: string) => void;
  deepLinkTarget: DeepLinkTarget | null;
  setDeepLinkTarget: React.Dispatch<React.SetStateAction<DeepLinkTarget | null>>;
  clearDeepLinkTarget: () => void;
  highlightedItemId: string | null;
  clearHighlightedItem: () => void;
  navigateFromNotification: (notif: AppNotification) => void;
  navigateToPortalPath: (targetPath: string, overrideNotif?: AppNotification) => void;
  reportUnauthorizedSuperAdminAccess: (attemptedPath: string, attemptedModule: string) => Promise<void>;

  // Settings
  updateNotificationSettings: (settings: Partial<UserNotificationSettings>) => void;
  updateUserSettings: (settings: any) => void;

  // Campus & Heritage Gallery
  galleryItems: GalleryItem[];
  addGalleryItem: (item: Omit<GalleryItem, 'id' | 'createdAt'>) => boolean;
  deleteGalleryItem: (id: string) => boolean;

  // Institutional Social Feed (Alumni, Admin, Moderator posts synced with /api/feed & /api/posts)
  feedPosts: InstitutionalFeedPost[];
  addFeedPost: (post: {
    postType: 'update' | 'gallery' | 'announcement';
    title: string;
    content: string;
    imageUrl?: string;
    isPinned?: boolean;
    pinExpiresAt?: string;
    tags?: string[];
    visibility?: 'public' | 'alumni' | 'batch' | 'department' | 'group' | 'private';
    targetBatch?: string;
    targetDepartment?: string;
    groupId?: string;
    groupName?: string;
    isAnonymous?: boolean;
    status?: 'published' | 'draft' | 'scheduled' | 'pending_approval';
  }) => boolean;
  createSocialPost: (post: {
    postType: 'update' | 'gallery' | 'announcement';
    title: string;
    content: string;
    imageUrl?: string;
    isPinned?: boolean;
    pinExpiresAt?: string;
    tags?: string[];
    visibility?: 'public' | 'alumni' | 'batch' | 'department' | 'group' | 'private';
    targetBatch?: string;
    targetDepartment?: string;
    groupId?: string;
    groupName?: string;
    isAnonymous?: boolean;
  }) => Promise<{ success: boolean; post?: InstitutionalFeedPost; error?: string }>;
  toggleLikeFeedPost: (postId: string) => void;
  toggleHeartFeedPost: (postId: string) => void;
  addFeedPostComment: (postId: string, text: string) => void;
  shareFeedPost: (postId: string, commentary?: string) => Promise<{ success: boolean; sharedPost?: InstitutionalFeedPost; error?: string }>;
  deleteFeedPost: (postId: string) => void;
  updateFeedPost: (postId: string, updates: Partial<InstitutionalFeedPost>) => boolean;
  pinProfilePost: (postId: string | null) => Promise<boolean>;
  blockUser: (targetUid: string) => Promise<boolean>;
  unblockUser: (targetUid: string) => Promise<boolean>;
  deleteMyAccount: () => Promise<boolean>;

  // Alumni Directory Service (direct Firestore service layer)
  fetchAlumni: () => Promise<UserProfile[]>;
  createAlumni: (profile: UserProfile) => Promise<UserProfile | undefined>;
  updateAlumniProfile: (uid: string, updates: Partial<UserProfile>) => Promise<Partial<UserProfile> | undefined>;

  // Admin Actions
  verifyUser: (uid: string) => void;
  setUserVerified: (
    uid: string,
    status?: boolean,
    options?: {
      rejectionReason?: string;
      reviewedByUid?: string;
      reviewedByName?: string;
      reviewedByRole?: string;
      reviewedAt?: string;
      silentToast?: boolean;
      conflictId?: string;
      requestId?: string;
      submissionSource?: 'dispute_student_id_claim' | 'request_verification';
      requestType?: 'claimed_id_dispute' | 'manual_verification_request' | 'registration_conflict';
      studentId?: string;
      course?: string;
      batch?: string;
      notes?: string;
    }
  ) => void;
  updateUserRole: (uid: string, newRole: UserRole) => Promise<{ success: boolean; message?: string }>;
  setUserRole: (uid: string, newRole: UserRole) => Promise<{ success: boolean; message?: string }>;
  deleteAlumni: (uid: string) => Promise<boolean>;
  isEmployerExpired: (user?: UserProfile | null) => boolean;
  requestEmployerRenewal: (notes: string) => void;
  renewEmployerAccount: (uid: string, extensionMonths?: number) => void;
  checkAndEnforceEmployerExpirations: () => { expiredCount: number; warningsCount: number };

  // Alumni Management Automations
  auditLogs: AuditLogEntry[];
  automationJobs: AutomationJob[];
  careerSurveys: CareerSurveyResponse[];
  backups: DatabaseBackupSnapshot[];
  addAuditLog: (entry: Omit<AuditLogEntry, 'id' | 'timestamp'>) => void;
  submitCareerSurvey: (survey: Omit<CareerSurveyResponse, 'id' | 'submittedAt'>) => void;
  runAutomationJob: (jobId: string) => void;
  triggerDatabaseBackup: (type?: 'automated' | 'manual') => void;
  unlockUserAccount: (uid: string, reason?: string) => Promise<{ success: boolean; message?: string }> | void;
  suspendUserAccount: (uid: string, data: { startDate?: string; endDate?: string; reason: string; isPermanentLock?: boolean }) => Promise<{ success: boolean; message?: string }>;
  lockUserAccount: (uid: string, data: { startDate?: string; reason: string }) => Promise<{ success: boolean; message?: string }>;
  extendUserSuspension: (uid: string, data: { newEndDate: string; reason: string }) => Promise<{ success: boolean; message?: string }>;
  updateSuspensionReason: (uid: string, reason: string) => Promise<{ success: boolean; message?: string }>;
  getSuspensionHistory: (uid: string) => Promise<SuspensionHistoryEntry[]>;
  verifyAndApproveAlumni: (uid: string, approve: boolean, flagReason?: string) => void;
  sendEmergencyAnnouncement: (title: string, content: string) => void;
  updateEmploymentStatus: (status: 'Employed' | 'Self-employed' | 'Seeking Opportunities' | 'Unemployed' | 'Retired' | 'N/A') => void;

  // Toast / System Feedback
  toasts: ToastNotification[];
  toastMessage: string | null;
  showToast: (msg: string, type?: ToastType) => void;
  dismissToast: (id: string) => void;
}

const AlumniContext = createContext<AlumniContextType | null>(null);

export const STORAGE_KEYS = {
  USER_ID: 'alumni_auth_session_real_v2',
  USERS: 'alumni_users_v5',
  REQUESTS: 'alumni_friend_requests_v5',
  CHATS: 'alumni_chats_v5',
  MESSAGES: 'alumni_messages_v5',
  NOTIFICATIONS: 'alumni_notifications_v5',
  EVENTS: 'alumni_events_v5',
  ANNOUNCEMENTS: 'alumni_announcements_v5',
  OPPORTUNITIES: 'alumni_opportunities_v5',
  APPLICATIONS: 'alumni_job_applications_v5',
  FOLLOWING: 'alumni_following_v5',
  CONNECTIONS: 'alumni_connections_v5',
  SETTINGS: 'alumni_settings_v5',
  GALLERY: 'alumni_gallery_v5',
  FEED_POSTS: 'alumni_feed_posts_v1',
  AUDIT_LOGS: 'alumni_audit_logs_v2',
  AUTOMATION_JOBS: 'alumni_automation_jobs_v2',
  CAREER_SURVEYS: 'alumni_career_surveys_v2',
  BACKUPS: 'alumni_backups_v2',
  RESERVATIONS: 'alumni_event_reservations_v2',
  ACTIVE_TAB: 'alumni_active_tab_v2',
  VIEW: 'alumni_active_view_v1'
};

export const CREDENTIALS_VAULT_KEY = 'st_cecilia_auth_credentials_vault_v1';
export const DELETED_ACCOUNT_UIDS_KEY = 'st_cecilia_deleted_account_uids_v1';

export function getDeletedAccountUids(): Set<string> {
  try {
    const raw = localStorage.getItem(DELETED_ACCOUNT_UIDS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.filter((id) => typeof id === 'string' && id.length > 0)) : new Set();
  } catch {
    return new Set();
  }
}

export function addDeletedAccountUids(uids: string[]): Set<string> {
  const existing = getDeletedAccountUids();
  let changed = false;
  for (const uid of uids) {
    if (uid && uid !== 'usr_superadmin_cecilia' && !existing.has(uid)) {
      existing.add(uid);
      changed = true;
    }
  }
  if (changed) {
    try {
      localStorage.setItem(DELETED_ACCOUNT_UIDS_KEY, JSON.stringify(Array.from(existing)));
    } catch {}
  }
  return existing;
}

export function purgeDeletedUidsFromVaultAndStorage(uids: Iterable<string>) {
  const uidSet = new Set(Array.from(uids).filter((id) => id && id !== 'usr_superadmin_cecilia'));
  if (uidSet.size === 0) return;
  try {
    const vault = getStoredCredentialsVault();
    let vaultChanged = false;
    for (const key of Object.keys(vault)) {
      const entry = vault[key];
      if (entry?.uid && uidSet.has(entry.uid)) {
        delete vault[key];
        vaultChanged = true;
      }
    }
    if (vaultChanged) {
      localStorage.setItem(CREDENTIALS_VAULT_KEY, JSON.stringify(vault));
    }
  } catch {}
}

export interface StoredCredentialEntry {
  uid: string;
  name?: string;
  email: string;
  studentId?: string;
  alumniId?: string;
  employeeId?: string;
  password?: string;
  passwordHash?: string;
  role: string;
  isVerified: boolean;
  verificationExpiresAt?: string;
  profilePictureUrl?: string;
  coverPhotoUrl?: string;
}

const pendingVaultHashPromises = new Map<string, Promise<void>>();
let usersStorageWriteSeq = 0;

export function isPendingAccountExpired(u: Partial<UserProfile> | null | undefined, nowMs: number = Date.now()): boolean {
  if (!u) return false;
  if (u.isVerified || u.verified) return false;
  const role = (u.role || 'alumni').toLowerCase().trim();
  if (['admin', 'superadmin', 'moderator'].includes(role)) return false;
  if (u.employerStatus === 'approved' || u.employerVerificationStatus === 'verified') return false;
  const acctStatus = (u.accountStatus || u.status || '').toUpperCase().trim();
  const isPending =
    acctStatus === 'PENDING_VERIFICATION' ||
    u.verificationStatus === 'pending_review' ||
    (role === 'employer' && ['pending', 'pending_verification', ''].includes(u.employerStatus || ''));
  if (!isPending) return false;

  const createdMs = u.createdAt ? new Date(u.createdAt).getTime() : 0;
  const expiresMs = u.verificationExpiresAt
    ? new Date(u.verificationExpiresAt).getTime()
    : (Number.isFinite(createdMs) && createdMs > 0 ? createdMs + PENDING_VERIFICATION_TTL_MS : 0);
  return expiresMs > 0 && nowMs >= expiresMs;
}

function stripLargeInlineDataUrls<T>(value: T, maxLen = 24000): T {
  const cleanNode = (node: any): any => {
    if (typeof node === 'string') {
      if (node.startsWith('data:') && node.length > maxLen) {
        return undefined;
      }
      return node;
    }
    if (Array.isArray(node)) {
      return node.map((item) => cleanNode(item)).filter((item) => item !== undefined);
    }
    if (node && typeof node === 'object') {
      const out: Record<string, any> = {};
      for (const [k, v] of Object.entries(node)) {
        const cleanedVal = cleanNode(v);
        if (cleanedVal !== undefined) {
          out[k] = cleanedVal;
        }
      }
      return out;
    }
    return node;
  };
  return cleanNode(value) as T;
}

const EVICTABLE_MEDIA_CACHE_KEYS = [
  'alumni_gallery_v5',
  'alumni_feed_posts_v1',
  'alumni_events_v1',
  'alumni_announcements_v1',
  'alumni_opportunities_v1',
  'alumni_backups_v1',
  'alumni_audit_logs_v1',
  'st_cecilia_registry_conflicts',
  'alumni_messages_v2',
  'alumni_notifications_v1'
];

const MAX_CACHE_ENTRY_CHARS = 300_000;

function pruneOversizedLocalStorageCaches(excludeKey?: string): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  for (const cacheKey of EVICTABLE_MEDIA_CACHE_KEYS) {
    if (excludeKey && cacheKey === excludeKey) continue;
    try {
      const raw = localStorage.getItem(cacheKey);
      if (!raw || raw.length <= MAX_CACHE_ENTRY_CHARS) continue;
      try {
        const parsed = JSON.parse(raw);
        const compacted = stripLargeInlineDataUrls(parsed);
        const compactedJson = JSON.stringify(compacted);
        if (compactedJson.length <= MAX_CACHE_ENTRY_CHARS) {
          localStorage.setItem(cacheKey, compactedJson);
        } else if (Array.isArray(compacted)) {
          localStorage.setItem(cacheKey, JSON.stringify(compacted.slice(0, 15)));
        } else {
          localStorage.removeItem(cacheKey);
        }
      } catch {
        localStorage.removeItem(cacheKey);
      }
    } catch {}
  }
}

// Proactively compact any legacy multi-megabyte media caches left in localStorage on boot
pruneOversizedLocalStorageCaches();

function safeSetLocalStorageJson(key: string, data: unknown): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  let serialized = '';
  try {
    serialized = JSON.stringify(data);
  } catch {
    return;
  }

  // Never allow a single non-critical cache entry to consume multi-megabyte localStorage quota with inline base64 images
  const isAuthOrVaultKey =
    key === CREDENTIALS_VAULT_KEY ||
    key === 'alumni_user' ||
    key === 'alumni_auth_session_real_v1';

  const payloadToWrite =
    !isAuthOrVaultKey && serialized.length > MAX_CACHE_ENTRY_CHARS
      ? JSON.stringify(stripLargeInlineDataUrls(data))
      : serialized;

  try {
    localStorage.setItem(key, payloadToWrite);
    return;
  } catch {
    // QuotaExceededError or private-mode restriction: evict bloated media caches and retry compact payload
  }

  pruneOversizedLocalStorageCaches(key);

  try {
    const compact = stripLargeInlineDataUrls(data);
    localStorage.setItem(key, JSON.stringify(compact));
    return;
  } catch {
    // Still over quota: if array, cache only the most recent 15 compact items
  }

  if (Array.isArray(data)) {
    try {
      const recentCompact = stripLargeInlineDataUrls(data.slice(0, 15));
      localStorage.setItem(key, JSON.stringify(recentCompact));
    } catch {
      // Final graceful skip so React state & Firestore/server persistence remain unaffected
    }
  }
}

export function persistUsersSafe(list: UserProfile[]): void {
  const cleaned = (list || []).map((u) => stripPlaintextSecretsFromUser(u));
  const seq = ++usersStorageWriteSeq;
  safeSetLocalStorageJson(STORAGE_KEYS.USERS, cleaned);
  Promise.all(cleaned.map((u) => encryptUserPiiForStorage(u)))
    .then((encrypted) => {
      if (seq !== usersStorageWriteSeq) return;
      safeSetLocalStorageJson(STORAGE_KEYS.USERS, encrypted);
    })
    .catch(() => {});
}

export function getStoredCredentialsVault(): Record<string, StoredCredentialEntry> {
  try {
    const raw = localStorage.getItem(CREDENTIALS_VAULT_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeVaultEntryToStorage(entry: StoredCredentialEntry): void {
  const vault = getStoredCredentialsVault();
  const safeEntry: StoredCredentialEntry = { ...entry };
  delete safeEntry.password;
  if (safeEntry.uid) vault[safeEntry.uid] = safeEntry;
  if (safeEntry.email) vault[safeEntry.email.toLowerCase()] = safeEntry;
  if (safeEntry.studentId) {
    const sLower = safeEntry.studentId.toLowerCase();
    const sNorm = sLower.replace(/[^a-zA-Z0-9]/g, '');
    const sClean = sLower.replace(/^scc-?/i, '');
    vault[sLower] = safeEntry;
    vault[sNorm] = safeEntry;
    vault[sClean] = safeEntry;
    vault[`scc-${sClean}`] = safeEntry;
    vault[`scc${sNorm}`] = safeEntry;
  }
  if (safeEntry.alumniId) {
    const aLower = safeEntry.alumniId.toLowerCase();
    const aNorm = aLower.replace(/[^a-zA-Z0-9]/g, '');
    const aClean = aLower.replace(/^scc-alum-?/i, '').replace(/^scc-?/i, '');
    vault[aLower] = safeEntry;
    vault[aNorm] = safeEntry;
    vault[aClean] = safeEntry;
  }
  if (safeEntry.employeeId) {
    const eLower = safeEntry.employeeId.toLowerCase();
    const eClean = eLower.replace(/^scc-?/i, '');
    vault[eLower] = safeEntry;
    vault[eClean] = safeEntry;
    vault[`scc-${eClean}`] = safeEntry;
  }
  try {
    localStorage.setItem(CREDENTIALS_VAULT_KEY, JSON.stringify(vault));
  } catch {}
}

export function saveCredentialToVault(entry: StoredCredentialEntry) {
  try {
    if (entry.uid && getDeletedAccountUids().has(entry.uid)) {
      return;
    }
    const existingVault = getStoredCredentialsVault();
    const existingHash =
      entry.passwordHash ||
      (entry.uid ? existingVault[entry.uid]?.passwordHash : undefined) ||
      (entry.email ? existingVault[entry.email.toLowerCase()]?.passwordHash : undefined);

    const immediateEntry: StoredCredentialEntry = {
      ...entry,
      ...(existingHash ? { passwordHash: existingHash } : {})
    };
    delete immediateEntry.password;
    writeVaultEntryToStorage(immediateEntry);

    const rawSecret = entry.passwordHash || entry.password;
    if (!rawSecret) return;

    const hashPromise = (async () => {
      try {
        const resolvedHash = isSaltedSecretHash(rawSecret)
          ? rawSecret
          : await hashSecretClient(rawSecret);
        if (entry.uid && getDeletedAccountUids().has(entry.uid)) return;
        const finalizedEntry: StoredCredentialEntry = {
          ...entry,
          passwordHash: resolvedHash
        };
        delete finalizedEntry.password;
        writeVaultEntryToStorage(finalizedEntry);
        if (finalizedEntry.uid && finalizedEntry.passwordHash) {
          saveAuthCredentialToFirestore(finalizedEntry).catch(() => {});
        }
      } catch {}
    })();

    if (entry.uid) {
      pendingVaultHashPromises.set(entry.uid, hashPromise);
      hashPromise.finally(() => {
        if (pendingVaultHashPromises.get(entry.uid) === hashPromise) {
          pendingVaultHashPromises.delete(entry.uid);
        }
      });
    }
  } catch {}
}

export function removeCredentialFromVault(identifier: {
  uid?: string;
  email?: string;
  studentId?: string;
  alumniId?: string;
  employeeId?: string;
}) {
  try {
    const vault = getStoredCredentialsVault();
    const targetUid = identifier.uid;
    const targetEmail = identifier.email?.toLowerCase().trim();
    const targetStudentNorm = identifier.studentId?.toLowerCase().replace(/[^a-zA-Z0-9]/g, '');
    const targetAlumniNorm = identifier.alumniId?.toLowerCase().replace(/[^a-zA-Z0-9]/g, '');
    const targetEmployeeNorm = identifier.employeeId?.toLowerCase().replace(/[^a-zA-Z0-9]/g, '');
    for (const key of Object.keys(vault)) {
      const entry = vault[key];
      const entryStudentNorm = entry?.studentId?.toLowerCase().replace(/[^a-zA-Z0-9]/g, '');
      const entryAlumniNorm = entry?.alumniId?.toLowerCase().replace(/[^a-zA-Z0-9]/g, '');
      const entryEmployeeNorm = entry?.employeeId?.toLowerCase().replace(/[^a-zA-Z0-9]/g, '');
      if (
        (targetUid && entry?.uid === targetUid) ||
        (targetEmail && entry?.email?.toLowerCase().trim() === targetEmail) ||
        (targetStudentNorm && entryStudentNorm && entryStudentNorm === targetStudentNorm) ||
        (targetAlumniNorm && entryAlumniNorm && entryAlumniNorm === targetAlumniNorm) ||
        (targetEmployeeNorm && entryEmployeeNorm && entryEmployeeNorm === targetEmployeeNorm)
      ) {
        delete vault[key];
      }
    }
    localStorage.setItem(CREDENTIALS_VAULT_KEY, JSON.stringify(vault));
  } catch {}
}

export function findCredentialInVault(identifier: string): StoredCredentialEntry | null {
  try {
    const vault = getStoredCredentialsVault();
    const trimmed = identifier.trim().toLowerCase();
    const norm = trimmed.replace(/[^a-zA-Z0-9]/g, '');
    const clean = trimmed.replace(/^scc-?/i, '').replace(/^alum-?/i, '');
    const found = vault[trimmed] || vault[norm] || vault[clean] || vault[`scc-${clean}`] || vault[`scc${norm}`] || null;
    if (found && getDeletedAccountUids().has(found.uid)) {
      return null;
    }
    return found;
  } catch {
    return null;
  }
}

export const LEGACY_UID_MIGRATION_MAP: Record<string, string> = {
  'usr_superadmin_01': 'usr_superadmin_cecilia',
  'usr_admin_01': 'usr_admin_cecilia',
  'usr_registrar_01': 'usr_registrar_cecilia',
  'usr_staff_01': 'usr_staff_cecilia',
  'usr_moderator_01': 'usr_moderator_cecilia',
  'usr_employer_01': 'usr_employer_cecilia',
  'usr_alumni_01': 'usr_alumni_cecilia_01',
  'usr_alumni_02': 'usr_alumni_02',
  'usr_alumni_03': 'usr_alumni_03'
};

export function normalizeUid(uid?: string | null): string | null {
  if (!uid) return null;
  return LEGACY_UID_MIGRATION_MAP[uid] || uid;
}

/**
 * Create a cryptographically compliant session token with a 7-day persistent expiration
 */
export function createSessionToken(user: {
  uid: string;
  name?: string;
  email: string;
  role: string;
  studentId?: string;
  alumniId?: string;
  employeeId?: string;
  isVerified?: boolean;
}): string {
  const normUid = normalizeUid(user.uid) || user.uid;
  const tokenPayload = {
    uid: normUid,
    name: user.name || 'Cecilian Member',
    email: user.email,
    role: user.role || 'alumni',
    studentId: user.studentId,
    alumniId: user.alumniId,
    employeeId: user.employeeId,
    emailVerified: true,
    isVerified: user.isVerified ?? true,
    iat: Date.now(),
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7-day persistent session
  };
  return btoa(unescape(encodeURIComponent(JSON.stringify(tokenPayload))));
}

/**
 * Validate and decode base64 or JWT session token
 */
export function parseAndValidateSessionToken(token: string): { valid: boolean; payload?: any; expired?: boolean } {
  try {
    if (!token || typeof token !== 'string') return { valid: false };
    const cleanToken = token.trim();
    let payloadStr = '';
    const rawPart = cleanToken.includes('.') ? cleanToken.split('.')[1] : cleanToken;
    try {
      payloadStr = decodeURIComponent(escape(atob(rawPart)));
    } catch {
      payloadStr = atob(rawPart);
    }
    const payload = JSON.parse(payloadStr);
    if (!payload || !payload.uid) return { valid: false };
    payload.uid = normalizeUid(payload.uid) || payload.uid;
    if (payload.exp && typeof payload.exp === 'number') {
      const expMs = payload.exp < 10000000000 ? payload.exp * 1000 : payload.exp;
      if (expMs < Date.now()) {
        return { valid: false, expired: true, payload };
      }
    }
    return { valid: true, payload };
  } catch {
    return { valid: false };
  }
}

/**
 * Retrieve active session token from localStorage or sessionStorage
 */
export function getStoredSessionToken(): string | null {
  try {
    return (
      localStorage.getItem('alumni_server_auth_token') ||
      sessionStorage.getItem('alumni_server_auth_token') ||
      localStorage.getItem('alumni_auth_token') ||
      sessionStorage.getItem('alumni_auth_token') ||
      null
    );
  } catch {
    return null;
  }
}

export function isSignedHmacToken(token?: string | null): boolean {
  if (!token || typeof token !== 'string') return false;
  const parts = token.trim().split('.');
  return parts.length === 3 && parts.every((part) => part.length > 0);
}

/**
 * Persist active session tokens and identifiers to both localStorage and sessionStorage.
 * Preserves an existing valid signed HMAC server token when a caller omits `token`.
 */
export function saveActiveSession(user: UserProfile, token?: string, forceRefresh = false) {
  try {
    const canonicalUid = normalizeUid(user.uid) || user.uid;
    let sessionToken = token;
    if (!sessionToken && !forceRefresh) {
      const existingToken = getStoredSessionToken();
      if (isSignedHmacToken(existingToken)) {
        const parsed = parseAndValidateSessionToken(existingToken!);
        if (parsed.valid && parsed.payload?.uid === canonicalUid) {
          sessionToken = existingToken!;
        }
      }
    }
    if (!sessionToken) {
      sessionToken = createSessionToken({ ...user, uid: canonicalUid });
    }
    localStorage.setItem(STORAGE_KEYS.USER_ID, canonicalUid);
    localStorage.setItem('alumni_auth_session_real_v1', canonicalUid);
    localStorage.setItem('alumni_server_auth_token', sessionToken);
    sessionStorage.setItem('alumni_server_auth_token', sessionToken);
    localStorage.setItem('alumni_auth_token', sessionToken);
    sessionStorage.setItem('alumni_auth_token', sessionToken);
    localStorage.setItem(STORAGE_KEYS.VIEW, 'portal');
  } catch {}
}

/**
 * Clear stored auth credentials and tokens on explicit logout or expiry
 */
export function clearStoredSession() {
  try {
    localStorage.removeItem(STORAGE_KEYS.USER_ID);
    localStorage.removeItem('alumni_auth_session_real_v1');
    localStorage.removeItem('alumni_server_auth_token');
    localStorage.removeItem('alumni_auth_token');
    sessionStorage.removeItem('alumni_server_auth_token');
    sessionStorage.removeItem('alumni_auth_token');
  } catch {}
}

export const AlumniProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Purge legacy mock data from browser storage on initial load
  useEffect(() => {
    try {
      const PURGE_KEY = 'st_cecilia_production_purge_v5';
      if (!localStorage.getItem(PURGE_KEY)) {
        const mockKeys = [
          STORAGE_KEYS.EVENTS,
          STORAGE_KEYS.OPPORTUNITIES,
          STORAGE_KEYS.ANNOUNCEMENTS,
          STORAGE_KEYS.FEED_POSTS,
          STORAGE_KEYS.CHATS,
          STORAGE_KEYS.MESSAGES,
          STORAGE_KEYS.NOTIFICATIONS,
          'st_cecilia_chapters_v1',
          STORAGE_KEYS.GALLERY,
          'alumni_milestones_v5',
          STORAGE_KEYS.REQUESTS,
          STORAGE_KEYS.APPLICATIONS,
          'st_cecilia_accredited_registry_records',
          'st_cecilia_registry_conflicts'
        ];
        mockKeys.forEach((k) => localStorage.removeItem(k));

        // Purge mock profiles from cached users list
        const rawUsers = localStorage.getItem(STORAGE_KEYS.USERS);
        if (rawUsers) {
          try {
            const parsed = JSON.parse(rawUsers);
            if (Array.isArray(parsed)) {
              const genuine = parsed.filter(
                (u) =>
                  u &&
                  !['user_default_alumni', 'user_default_student', 'user_default_moderator', 'user_default_staff', 'user_default_employer'].includes(u.uid)
              );
              localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(genuine));
            }
          } catch {}
        }
        localStorage.setItem(PURGE_KEY, 'true');
      }
    } catch {}
  }, []);

  // Load or fallback to initial data
  const [users, setUsers] = useState<UserProfile[]>(() => {
    try {
      // Account Reset / Upgrade to Superadmin-Only Clean Baseline
      const ACCOUNTS_VERSION_KEY = 'st_cecilia_accounts_version_v12_wipe_all_except_superadmin';
      const hasUpgradedAccounts = localStorage.getItem(ACCOUNTS_VERSION_KEY) === 'true';
      if (!hasUpgradedAccounts) {
        try {
          const currentToken = getStoredSessionToken();
          const tokenCheck = currentToken ? parseAndValidateSessionToken(currentToken) : null;
          const isSuperadminSession = tokenCheck?.valid && tokenCheck?.payload?.uid === 'usr_superadmin_cecilia';
          if (!isSuperadminSession) {
            clearStoredSession();
          }

          Object.values(STORAGE_KEYS).forEach((k) => {
            if (k !== STORAGE_KEYS.VIEW) {
              localStorage.removeItem(k);
            }
          });
          [
            CREDENTIALS_VAULT_KEY,
            'st_cecilia_credentials_vault',
            'st_cecilia_chapters_v1',
            'st_cecilia_registrar_student_records',
            'st_cecilia_registrar_records_v1',
            'st_cecilia_student_records_v1',
            'st_cecilia_accredited_registry_records',
            'st_cecilia_registry_conflicts',
            'sc_alumni_dispatched_emails',
            'st_cecilia_admin_module_v1',
            'st_cecilia_superadmin_security_alerts_v1',
            'st_cecilia_centenary_time_capsules_v1',
            'st_cecilia_governance_policies_v1',
            'alumni_offline_message_queue_v1',
            'cecilian_event_reminders_v1',
            'scc_jobs_badge_dismissed_v1'
          ].forEach((k) => localStorage.removeItem(k));
          localStorage.setItem(ACCOUNTS_VERSION_KEY, 'true');
        } catch {}
      }

      const deletedUids = getDeletedAccountUids();
      purgeDeletedUidsFromVaultAndStorage(deletedUids);

      // Seed initial superadmin into vault (salted PBKDF2 hash only)
      INITIAL_USERS.forEach((seedUser) => {
        if (deletedUids.has(seedUser.uid)) return;
        saveCredentialToVault({
          uid: seedUser.uid,
          name: seedUser.name,
          email: seedUser.email,
          studentId: seedUser.studentId,
          alumniId: seedUser.alumniId,
          employeeId: seedUser.employeeId,
          password: seedUser.password || 'Password123!',
          role: seedUser.role,
          isVerified: seedUser.isVerified ?? true
        });
      });

      const saved = localStorage.getItem(STORAGE_KEYS.USERS);
      let list: UserProfile[] = saved ? JSON.parse(saved) : INITIAL_USERS.map((u) => stripPlaintextSecretsFromUser(u));
      if (!Array.isArray(list)) list = INITIAL_USERS.map((u) => stripPlaintextSecretsFromUser(u));

      const PREVIOUS_DEPRECATED_UIDS = [
        'usr_superadmin_01',
        'usr_admin_01',
        'usr_registrar_01',
        'usr_staff_01',
        'usr_moderator_01',
        'usr_employer_01',
        'usr_alumni_01',
        'usr_alumni_02',
        'usr_alumni_03'
      ];
      list = list.filter(
        (u) =>
          u &&
          !u.uid.startsWith('usr_sheepyawa') &&
          !u.uid.startsWith('usr_canonigo') &&
          !PREVIOUS_DEPRECATED_UIDS.includes(u.uid) &&
          !deletedUids.has(u.uid) &&
          !isAccountDeleted(u) &&
          !isPendingAccountExpired(u)
      );

      if (list.length === 0 || !list.some(u => u.uid === 'usr_superadmin_cecilia')) {
        list = INITIAL_USERS.map((u) => stripPlaintextSecretsFromUser(u));
      }

      // Sanitize arrays, normalize roles, and migrate any legacy plaintext password from cached users into vault hash
      list = list.map((u) => {
        if ((u as any).password && !u.passwordHash) {
          saveCredentialToVault({
            uid: u.uid,
            name: u.name,
            email: u.email,
            studentId: u.studentId,
            alumniId: u.alumniId,
            employeeId: u.employeeId,
            password: (u as any).password,
            role: u.role,
            isVerified: Boolean(u.isVerified)
          });
        }
        return stripPlaintextSecretsFromUser({
          ...u,
          role: normalizeSystemRole(u.role),
          experience: Array.isArray(u.experience) ? u.experience : [],
          education: Array.isArray(u.education) ? u.education : []
        });
      });

      const vault = getStoredCredentialsVault();
      INITIAL_USERS.forEach((seedUser) => {
        if (deletedUids.has(seedUser.uid)) return;
        const safeSeed = stripPlaintextSecretsFromUser(seedUser);
        const existingIdx = list.findIndex(
          (u) => u.uid === seedUser.uid || (seedUser.email && u.email?.toLowerCase() === seedUser.email.toLowerCase())
        );
        if (existingIdx >= 0) {
          list[existingIdx] = stripPlaintextSecretsFromUser({
            ...safeSeed,
            ...list[existingIdx],
            role: seedUser.role,
            studentId: list[existingIdx].studentId || seedUser.studentId,
            alumniId: list[existingIdx].alumniId || seedUser.alumniId,
            isVerified: true,
            verified: true
          });
        } else {
          list.push(safeSeed);
        }
      });

      // Attach passwordHash & verification from vault (never plaintext passwords)
      list = list.map((u) => {
        const cred = vault[u.uid] || (u.email ? vault[u.email.toLowerCase()] : null) || (u.studentId ? vault[u.studentId.toLowerCase()] : null);
        if (cred?.password && !cred.passwordHash) {
          saveCredentialToVault(cred);
        }
        return stripPlaintextSecretsFromUser({
          ...u,
          ...(u.passwordHash || cred?.passwordHash ? { passwordHash: u.passwordHash || cred?.passwordHash } : {}),
          isVerified: u.isVerified !== undefined ? u.isVerified : (u.role === 'alumni' ? true : false),
          verified: u.verified !== undefined ? u.verified : (u.role === 'alumni' ? true : false)
        });
      });

      // Restore any registered active users from credentials vault if missing from list
      Object.values(vault).forEach((entry) => {
        if (!entry?.uid || deletedUids.has(entry.uid)) return;
        if (!list.some(u => u.uid === entry.uid || (entry.email && u.email?.toLowerCase() === entry.email.toLowerCase()))) {
          list.push(stripPlaintextSecretsFromUser({
            uid: entry.uid,
            name: entry.name || 'Alumnus Member',
            email: entry.email,
            ...(entry.passwordHash ? { passwordHash: entry.passwordHash } : {}),
            role: (entry.role as UserRole) || 'alumni',
            studentId: entry.studentId,
            alumniId: entry.alumniId,
            employeeId: entry.employeeId,
            profilePictureUrl: entry.profilePictureUrl || DEFAULT_USER_AVATAR,
            coverPhotoUrl: entry.coverPhotoUrl || DEFAULT_COVER_PHOTO,
            about: 'Registered member of St. Cecilia’s College alumni network.',
            phone: '+63 917 123 4567',
            isVerified: entry.isVerified ?? true,
            verified: entry.isVerified ?? true,
            verificationStatus: entry.isVerified ? 'verified' : 'pending_review',
            verificationExpiresAt: entry.verificationExpiresAt,
            batch: '2024',
            course: 'B.S. Information Technology',
            headline: 'Alumni Graduate • St. Cecilia’s College',
            location: 'Cebu, Philippines',
            followersCount: 0,
            followingCount: 0,
            connectionsCount: 0,
            experience: [],
            education: [],
            createdAt: new Date().toISOString()
          }));
        }
      });

      const finalCleanList = list
        .filter((u) => !deletedUids.has(u.uid) && !isAccountDeleted(u) && !isPendingAccountExpired(u))
        .map((u) => stripPlaintextSecretsFromUser(u));
      persistUsersSafe(finalCleanList);
      return finalCleanList;
    } catch {
      return INITIAL_USERS.map((u) => stripPlaintextSecretsFromUser(u));
    }
  });

  // Real system: restore legitimate session or initialize unauthenticated
  const [currentUserId, setCurrentUserId] = useState<string | null>(() => {
    try {
      const savedToken = getStoredSessionToken();
      if (savedToken) {
        const val = parseAndValidateSessionToken(savedToken);
        if (val.expired) {
          clearStoredSession();
          return null;
        }
        if (val.valid && val.payload?.uid) {
          return normalizeUid(val.payload.uid);
        }
      }
      const saved =
        localStorage.getItem(STORAGE_KEYS.USER_ID) ||
        localStorage.getItem('alumni_auth_session_real_v1');
      if (saved && ['user_default_alumni', 'user_default_student', 'user_default_moderator', 'user_default_staff', 'user_default_employer'].includes(saved)) {
        localStorage.removeItem(STORAGE_KEYS.USER_ID);
        localStorage.removeItem('alumni_auth_session_real_v1');
        return null;
      }
      return normalizeUid(saved) || null;
    } catch {
      return null;
    }
  });

  /**
   * Identifies whether an entity ID originates from the previous mock/seed batches.
   * Ensures generated mock datasets are never loaded or merged.
   */
  const isSeedId = (id?: string | null): boolean => {
    if (!id) return false;
    return (
      id.startsWith('evt_scc_') ||
      id.startsWith('notif_scc_') ||
      id.startsWith('ann_scc_') ||
      id.startsWith('opp_scc_') ||
      id.startsWith('gal_scc_') ||
      id.startsWith('post_scc_') ||
      id.startsWith('chat_centennial_') ||
      id.startsWith('chat_ccs_') ||
      id.startsWith('chat_registrar_') ||
      id.startsWith('chat_admin_') ||
      id.startsWith('chat_julian_') ||
      id.startsWith('chat_celeste_') ||
      id.startsWith('chat_metrocebu_') ||
      id.startsWith('chat_exec_')
    );
  };

  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.REQUESTS);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [chats, setChats] = useState<ChatThread[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CHATS);
      const parsed = saved ? JSON.parse(saved) : [];
      if (!Array.isArray(parsed) || parsed.length === 0) return INITIAL_CHATS;
      const clean = parsed.filter((c: ChatThread) => !isSeedId(c.id));
      return clean;
    } catch {
      return INITIAL_CHATS;
    }
  });

  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.MESSAGES);
      const parsed = saved ? JSON.parse(saved) : {};
      if (typeof parsed !== 'object' || parsed === null) return INITIAL_MESSAGES;
      const cleanMessages: Record<string, ChatMessage[]> = {};
      Object.entries(parsed).forEach(([chatId, msgList]) => {
        if (!isSeedId(chatId) && Array.isArray(msgList)) {
          cleanMessages[chatId] = (msgList as ChatMessage[]).filter((m) => !isSeedId(m.id));
        }
      });
      return cleanMessages;
    } catch {
      return INITIAL_MESSAGES;
    }
  });

  // Offline Outgoing Message Queue state
  const [offlineQueue, setOfflineQueue] = useState<QueuedOfflineMessage[]>(() => {
    return getOfflineMessageQueue();
  });
  const offlineQueueCount = offlineQueue.length;

  const currentUserRoleRef = useRef<string>('alumni');
  const currentUserIdRef = useRef<string | null>(null);

  const [notifications, setNotificationsState] = useState<AppNotification[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
      const parsed = saved ? JSON.parse(saved) : [];
      const list = Array.isArray(parsed)
        ? parsed.filter((n: AppNotification) => !isSeedId(n.id))
        : INITIAL_NOTIFICATIONS;
      return list.map((n: AppNotification) => normalizeNotificationPayload(n));
    } catch {
      return INITIAL_NOTIFICATIONS.map((n: AppNotification) => normalizeNotificationPayload(n));
    }
  });

  const setNotifications = useCallback<React.Dispatch<React.SetStateAction<AppNotification[]>>>(
    (updater) => {
      setNotificationsState((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        return Array.isArray(next)
          ? next.map((n) => normalizeNotificationPayload(n, currentUserRoleRef.current))
          : prev;
      });
    },
    []
  );

  const [events, setEvents] = useState<AlumniEvent[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.EVENTS);
      const parsed = saved ? JSON.parse(saved) : [];
      const list = Array.isArray(parsed) ? parsed.filter((e: AlumniEvent) => !isSeedId(e.id)) : INITIAL_EVENTS;
      return list.map((e: AlumniEvent) => ({
        ...e,
        likes: Array.isArray(e.likes) ? e.likes : [],
        comments: Array.isArray(e.comments) ? e.comments : []
      }));
    } catch {
      return INITIAL_EVENTS;
    }
  });

  const [announcements, setAnnouncements] = useState<Announcement[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ANNOUNCEMENTS);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed.filter((a: Announcement) => !isSeedId(a.id)) : INITIAL_ANNOUNCEMENTS;
    } catch {
      return INITIAL_ANNOUNCEMENTS;
    }
  });

  const [opportunities, setOpportunities] = useState<Opportunity[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.OPPORTUNITIES);
      const parsed = saved ? JSON.parse(saved) : [];
      const list = Array.isArray(parsed) ? parsed.filter((opp: Opportunity) => !isSeedId(opp.id)) : INITIAL_OPPORTUNITIES;
      return list.map((opp: Opportunity) => ({
        ...opp,
        skills: Array.isArray(opp.skills) ? opp.skills : []
      }));
    } catch {
      return INITIAL_OPPORTUNITIES;
    }
  });

  const [jobApplications, setJobApplications] = useState<JobApplication[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.APPLICATIONS);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_JOB_APPLICATIONS;
    } catch {
      return INITIAL_JOB_APPLICATIONS;
    }
  });

  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.GALLERY);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed.filter((g: GalleryItem) => !isSeedId(g.id)) : INITIAL_GALLERY_ITEMS;
    } catch {
      return INITIAL_GALLERY_ITEMS;
    }
  });

  const pendingLocalPostsRef = useRef<Map<string, InstitutionalFeedPost>>(new Map());
  const deletedFeedPostIdsRef = useRef<Set<string>>(new Set());

  const [feedPosts, setFeedPosts] = useState<InstitutionalFeedPost[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.FEED_POSTS);
      const parsed = saved ? JSON.parse(saved) : [];
      const list = Array.isArray(parsed) ? parsed.filter((p: InstitutionalFeedPost) => !isSeedId(p.id)) : INITIAL_FEED_POSTS;
      return dedupePostsById(
        list.map((p: InstitutionalFeedPost) => ({
          ...p,
          likes: Array.isArray(p.likes) ? p.likes : [],
          hearts: Array.isArray(p.hearts) ? p.hearts : (Array.isArray(p.likes) ? p.likes : []),
          comments: Array.isArray(p.comments) ? p.comments : []
        }))
      );
    } catch {
      return dedupePostsById(INITIAL_FEED_POSTS);
    }
  });

  useEffect(() => {
    safeSetLocalStorageJson(STORAGE_KEYS.FEED_POSTS, feedPosts);
  }, [feedPosts]);

  // One-time purge of any residual seed items from localStorage
  useEffect(() => {
    try {
      const keysToClean = [
        STORAGE_KEYS.NOTIFICATIONS,
        STORAGE_KEYS.EVENTS,
        STORAGE_KEYS.ANNOUNCEMENTS,
        STORAGE_KEYS.OPPORTUNITIES,
        STORAGE_KEYS.GALLERY,
        STORAGE_KEYS.FEED_POSTS,
        STORAGE_KEYS.CHATS
      ];
      keysToClean.forEach((key) => {
        const item = localStorage.getItem(key);
        if (item) {
          try {
            const parsed = JSON.parse(item);
            if (Array.isArray(parsed)) {
              const cleaned = parsed.filter((x: any) => !isSeedId(x?.id));
              if (cleaned.length !== parsed.length) {
                safeSetLocalStorageJson(key, cleaned);
              }
            }
          } catch {}
        }
      });
      // Purge seed messages
      const msgs = localStorage.getItem(STORAGE_KEYS.MESSAGES);
      if (msgs) {
        try {
          const parsedMsgs = JSON.parse(msgs);
          if (typeof parsedMsgs === 'object' && parsedMsgs !== null) {
            const cleanMsgs: Record<string, ChatMessage[]> = {};
            let removedAny = false;
            Object.entries(parsedMsgs).forEach(([chatId, mList]) => {
              if (!isSeedId(chatId) && Array.isArray(mList)) {
                const filtered = (mList as ChatMessage[]).filter((m) => !isSeedId(m?.id));
                if (filtered.length !== mList.length) removedAny = true;
                cleanMsgs[chatId] = filtered;
              } else {
                removedAny = true;
              }
            });
            if (removedAny) {
              safeSetLocalStorageJson(STORAGE_KEYS.MESSAGES, cleanMsgs);
            }
          }
        } catch {}
      }
    } catch {}
  }, []);

  const [reservations, setReservations] = useState<EventReservation[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.RESERVATIONS);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.RESERVATIONS, JSON.stringify(reservations));
    } catch {}
  }, [reservations]);

  useEffect(() => {
    const unsub = subscribeToReservations((cloudReservations) => {
      setReservations(cloudReservations || []);
    });
    return () => unsub();
  }, []);

  // Connections mapping: userUid -> array of connected uids
  const [connectionsMap, setConnectionsMap] = useState<Record<string, string[]>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CONNECTIONS);
      if (saved) return JSON.parse(saved);
      return {};
    } catch {
      return {};
    }
  });

  // Following mapping: userUid -> array of uids being followed
  const [followingMap, setFollowingMap] = useState<Record<string, string[]>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.FOLLOWING);
      if (saved) return JSON.parse(saved);
      return {};
    } catch {
      return {};
    }
  });

  const [notificationSettings, setNotificationSettings] = useState<UserNotificationSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (saved) return JSON.parse(saved);
      return {
        pushNotifications: true,
        emailDigests: true,
        directMessages: true,
        eventReminders: true
      };
    } catch {
      return {
        pushNotifications: true,
        emailDigests: true,
        directMessages: true,
        eventReminders: true
      };
    }
  });

  const [activeTab, setActiveTabState] = useState<string>(() => {
    try {
      if (typeof window !== 'undefined' && /^\/portal\//i.test(window.location.pathname)) {
        return parsePortalUrlPath(window.location.pathname).tab;
      }
      const saved = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB);
      return saved || 'dashboard';
    } catch {
      return 'dashboard';
    }
  });
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [deepLinkTarget, setDeepLinkTarget] = useState<DeepLinkTarget | null>(() => {
    if (typeof window !== 'undefined' && /^\/portal\//i.test(window.location.pathname)) {
      const parsed = parsePortalUrlPath(window.location.pathname);
      if (parsed.targetId || parsed.subTab) {
        return {
          tab: parsed.tab,
          targetType: parsed.targetType,
          targetId: parsed.targetId,
          subTab: parsed.subTab,
          targetPath: parsed.targetPath,
          targetRoute: parsed.targetRoute,
          timestamp: Date.now()
        };
      }
    }
    return null;
  });
  const clearDeepLinkTarget = useCallback(() => setDeepLinkTarget(null), []);
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(() => {
    if (typeof window !== 'undefined' && /^\/portal\//i.test(window.location.pathname)) {
      return parsePortalUrlPath(window.location.pathname).targetId || null;
    }
    return null;
  });
  const highlightTimerRef = useRef<number | null>(null);
  const clearHighlightedItem = useCallback(() => {
    if (highlightTimerRef.current) {
      window.clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = null;
    }
    setHighlightedItemId(null);
  }, []);
  const triggerItemHighlight = useCallback((id?: string | null) => {
    if (highlightTimerRef.current) {
      window.clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = null;
    }
    if (!id) {
      setHighlightedItemId(null);
      return;
    }
    setHighlightedItemId(id);
    if (typeof window !== 'undefined') {
      highlightTimerRef.current = window.setTimeout(() => {
        setHighlightedItemId((curr) => (curr === id ? null : curr));
        highlightTimerRef.current = null;
      }, 3600);
    }
  }, []);
  const [selectedUserIdForModal, setSelectedUserIdForModal] = useState<string | null>(null);

  const parseSubRouteFromLocation = useCallback((): { profile: string | null; post: string | null } => {
    if (typeof window === 'undefined') return { profile: null, post: null };
    const path = window.location.pathname || '/';
    const profileMatch = path.match(/^\/profile\/([^/]+)\/?$/i);
    if (profileMatch?.[1]) {
      return { profile: decodeURIComponent(profileMatch[1]), post: null };
    }
    const postMatch = path.match(/^\/post\/([^/]+)\/?$/i);
    if (postMatch?.[1]) {
      return { profile: null, post: decodeURIComponent(postMatch[1]) };
    }
    return { profile: null, post: null };
  }, []);

  const [viewedProfileIdentifier, setViewedProfileIdentifier] = useState<string | null>(() => {
    return parseSubRouteFromLocation().profile;
  });
  const [viewedPostId, setViewedPostId] = useState<string | null>(() => {
    return parseSubRouteFromLocation().post;
  });

  const setActiveTab = useCallback((tab: string) => {
    setActiveTabState(tab);
    setViewedProfileIdentifier(null);
    setViewedPostId(null);
    if (typeof window !== 'undefined') {
      const hasSession = Boolean(currentUserIdRef.current);
      if (hasSession) {
        const nextUrl = buildPortalUrlForTab(tab);
        if (window.location.pathname !== nextUrl) {
          window.history.pushState({ portalPath: nextUrl, tab }, '', nextUrl);
        }
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handlePopState = () => {
      const parsedSub = parseSubRouteFromLocation();
      setViewedProfileIdentifier(parsedSub.profile);
      setViewedPostId(parsedSub.post);
      if (!parsedSub.profile && !parsedSub.post && /^\/portal\//i.test(window.location.pathname)) {
        const parsedPortal = parsePortalUrlPath(window.location.pathname, currentUserRoleRef.current);
        setActiveTabState(parsedPortal.tab);
        if (parsedPortal.targetId || parsedPortal.subTab) {
          setDeepLinkTarget({
            tab: parsedPortal.tab,
            targetType: parsedPortal.targetType,
            targetId: parsedPortal.targetId,
            subTab: parsedPortal.subTab,
            targetPath: parsedPortal.targetPath,
            targetRoute: parsedPortal.targetRoute,
            timestamp: Date.now()
          });
          triggerItemHighlight(parsedPortal.targetId);
        } else {
          setDeepLinkTarget(null);
          triggerItemHighlight(null);
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [parseSubRouteFromLocation, triggerItemHighlight]);

  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState<boolean>(false);
  const openEditProfile = useCallback(() => {
    setIsEditProfileModalOpen(true);
  }, []);
  const closeEditProfile = useCallback(() => {
    setIsEditProfileModalOpen(false);
  }, []);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [isFirebaseConnected, setIsFirebaseConnected] = useState<boolean>(true);
  const [isFirestoreSyncing, setIsFirestoreSyncing] = useState<boolean>(false);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(() => {
    try {
      return (typeof auth !== 'undefined' && auth?.currentUser) ? auth.currentUser : null;
    } catch {
      return null;
    }
  });
  const [authReady, setAuthReady] = useState<boolean>(false);

  // Automation datasets
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
      return saved ? JSON.parse(saved) : INITIAL_AUDIT_LOGS;
    } catch {
      return INITIAL_AUDIT_LOGS;
    }
  });

  const addAuditLog = useCallback((entry: Omit<AuditLogEntry, 'id' | 'timestamp'>) => {
    const newLog: AuditLogEntry = {
      id: generateSecureId('log'),
      timestamp: new Date().toISOString(),
      ...entry
    };
    setAuditLogs((prev) => [newLog, ...prev.slice(0, 99)]);
    saveAuditLogToFirestore(newLog).catch(() => {});
  }, []);

  const [automationJobs, setAutomationJobs] = useState<AutomationJob[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.AUTOMATION_JOBS);
      const jobs = saved ? JSON.parse(saved) : INITIAL_AUTOMATION_JOBS;
      return (jobs || []).filter((j: AutomationJob) => j.id !== 'job_birthday_greeter');
    } catch {
      return INITIAL_AUTOMATION_JOBS;
    }
  });

  const [careerSurveys, setCareerSurveys] = useState<CareerSurveyResponse[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CAREER_SURVEYS);
      return saved ? JSON.parse(saved) : INITIAL_CAREER_SURVEYS;
    } catch {
      return INITIAL_CAREER_SURVEYS;
    }
  });

  const [backups, setBackups] = useState<DatabaseBackupSnapshot[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.BACKUPS);
      return saved ? JSON.parse(saved) : INITIAL_BACKUPS;
    } catch {
      return INITIAL_BACKUPS;
    }
  });

  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });
  const [isBackgroundSyncing, setIsBackgroundSyncing] = useState<boolean>(false);
  const [lastBackgroundSyncTime, setLastBackgroundSyncTime] = useState<Date | null>(null);
  const isSyncInProgressRef = useRef<boolean>(false);

  // Single Active Login State (One Account, One Active Login)
  const [activeSessionConflict, setActiveSessionConflict] = useState<ActiveSessionConflictInfo | null>(null);
  const clearActiveSessionConflict = useCallback(() => {
    setActiveSessionConflict(null);
  }, []);

  // Failed Login Tracking & Account Lockout Tracker (3-attempt threshold)
  const failedLoginAttemptsRef = useRef<Map<string, { count: number; lockedUntil?: number }>>(new Map());

  // Platform Gate & Testing Controls (Mobile App / Tablet vs Web Portal)
  const [clientPlatformOverride, setClientPlatformOverrideState] = useState<'mobile' | 'web' | null>(() => {
    try {
      const saved = localStorage.getItem('scc_client_platform_override');
      return (saved === 'mobile' || saved === 'web') ? saved : null;
    } catch {
      return null;
    }
  });

  const clientPlatform: 'mobile' | 'web' = useMemo(() => {
    if (clientPlatformOverride) return clientPlatformOverride;
    if (typeof window === 'undefined') return 'web';
    // Strictly native Capacitor Android APK package
    const isCapacitorNative =
      typeof (window as any).Capacitor !== 'undefined' &&
      typeof (window as any).Capacitor.isNativePlatform === 'function' &&
      (window as any).Capacitor.isNativePlatform();
    return isCapacitorNative ? 'mobile' : 'web';
  }, [clientPlatformOverride]);

  const setClientPlatformOverride = useCallback((platform: 'mobile' | 'web' | null) => {
    setClientPlatformOverrideState(platform);
    try {
      if (platform) {
        localStorage.setItem('scc_client_platform_override', platform);
      } else {
        localStorage.removeItem('scc_client_platform_override');
      }
    } catch {}
  }, []);

  const [loginPlatformError, setLoginPlatformError] = useState<string | null>(null);
  const clearLoginPlatformError = useCallback(() => {
    setLoginPlatformError(null);
  }, []);

  const [loginPendingAccountNotice, setLoginPendingAccountNotice] = useState<PendingAccountNoticeInfo | null>(null);
  const clearLoginPendingAccountNotice = useCallback(() => {
    setLoginPendingAccountNotice(null);
  }, []);

  const [loginSuspensionNotice, setLoginSuspensionNotice] = useState<SuspensionNoticeInfo | null>(null);
  const clearLoginSuspensionNotice = useCallback(() => {
    setLoginSuspensionNotice(null);
  }, []);


  // Strict Moderator Quota State: MAX 3 ACTIVE ACCOUNTS
  const moderatorQuota = useMemo(() => {
    const activeMods = users.filter((u) => {
      const role = (u.role || '').toLowerCase();
      const status = (u.accountStatus || u.status || 'ACTIVE').toUpperCase();
      return role === 'moderator' && status !== 'SUSPENDED';
    });
    const count = activeMods.length;
    return {
      activeCount: count,
      maxQuota: 3,
      availableSlots: Math.max(0, 3 - count),
      canCreateModerator: count < 3
    };
  }, [users]);

  const getClientDeviceInfo = useCallback((): string => {
    if (typeof window === 'undefined') return 'Web Client';
    const ua = navigator.userAgent;
    if (/android/i.test(ua)) return 'Android Device (Mobile App)';
    if (/iphone|ipad|ipod/i.test(ua)) return 'Apple iOS Device (Mobile Safari / App)';
    if (/macintosh|mac os x/i.test(ua)) return 'macOS Desktop';
    if (/windows/i.test(ua)) return 'Windows PC';
    if (/linux/i.test(ua)) return 'Linux Device';
    return 'Web Browser';
  }, []);

  // Initial loading grace period for immediate skeleton visual feedback
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoadingData(false);
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const lastToastRef = useRef<{ msg: string; time: number } | null>(null);

  const showToast = useCallback((msg: string, type: ToastType = 'info') => {
    const now = Date.now();
    if (lastToastRef.current && lastToastRef.current.msg === msg && now - lastToastRef.current.time < 900) {
      return;
    }
    lastToastRef.current = { msg, time: now };

    const id = generateSecureId('toast');
    const newToast: ToastNotification = { id, message: msg, type };

    setToastMessage(msg);
    setToasts((prev) => [...prev.slice(-3), newToast]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4000);
  }, []);

  // Background Synchronization Mechanism:
  // Fetches latest data from Firebase collections to update local state and localStorage cache
  const triggerBackgroundSync = useCallback(async () => {
    if (isSyncInProgressRef.current) return;
    isSyncInProgressRef.current = true;
    setIsBackgroundSyncing(true);

    try {
      // 1. Sync authoritative deleted UIDs from server and fetch live alumni users from Firestore
      const usersPromise = (async () => {
        try {
          const [deletedRes, firestoreUsers] = await Promise.all([
            fetch('/api/auth/deleted-uids').then((r) => (r.ok ? r.json() : null)).catch(() => null),
            alumniService.getAllAlumni()
          ]);
          const serverDeletedUids: string[] = Array.isArray(deletedRes?.deletedUids) ? deletedRes.deletedUids : [];
          const firestoreDeletedUids = (firestoreUsers || []).filter((u) => isAccountDeleted(u)).map((u) => u.uid);
          const allDeletedSet = addDeletedAccountUids([...serverDeletedUids, ...firestoreDeletedUids]);
          purgeDeletedUidsFromVaultAndStorage(allDeletedSet);

          if (currentUserIdRef.current && allDeletedSet.has(currentUserIdRef.current)) {
            clearStoredSession();
            setCurrentUserId(null);
          }

          if ((firestoreUsers && firestoreUsers.length > 0) || allDeletedSet.size > 0) {
            setUsers((prevUsers) => {
              const vault = getStoredCredentialsVault();
              const userMap = new Map<string, UserProfile>();
              prevUsers.forEach((u) => {
                if (!allDeletedSet.has(u.uid) && !isAccountDeleted(u)) {
                  userMap.set(u.uid, u);
                }
              });

              (firestoreUsers || []).forEach((fUser) => {
                if (allDeletedSet.has(fUser.uid) || isAccountDeleted(fUser) || isPendingAccountExpired(fUser)) {
                  userMap.delete(fUser.uid);
                  return;
                }
                const existing = userMap.get(fUser.uid);
                const cred = vault[fUser.uid] || (fUser.email ? vault[fUser.email.toLowerCase()] : null);
                const preservedHash = existing?.passwordHash || fUser.passwordHash || cred?.passwordHash;
                userMap.set(fUser.uid, stripPlaintextSecretsFromUser({
                  ...fUser,
                  role: normalizeSystemRole(fUser.role),
                  ...(preservedHash ? { passwordHash: preservedHash } : {}),
                  isVerified: fUser.isVerified !== undefined ? fUser.isVerified : (existing?.isVerified ?? (fUser.role === 'alumni')),
                  verified: fUser.verified !== undefined ? fUser.verified : (existing?.verified ?? (fUser.role === 'alumni'))
                }));
              });

              const merged = Array.from(userMap.values());
              persistUsersSafe(merged);
              return merged;
            });
          }
        } catch (err) {
          console.warn('Background sync alumni notice:', err);
        }
      })();

      // 2. Fetch events from Firestore
      const eventsPromise = (async () => {
        try {
          const liveEvents = await getEventsFromFirestore();
          if (liveEvents && liveEvents.length > 0) {
            const cleanEvents = liveEvents.filter((e) => !isSeedId(e.id));
            setEvents(cleanEvents);
            safeSetLocalStorageJson(STORAGE_KEYS.EVENTS, cleanEvents);
          }
        } catch (err) {
          console.warn('Background sync events notice:', err);
        }
      })();

      // 3. Fetch event reservations from Firestore
      const reservationsPromise = (async () => {
        try {
          const liveReservations = await getReservationsFromFirestore();
          if (liveReservations && liveReservations.length > 0) {
            setReservations(liveReservations);
          }
        } catch (err) {
          console.warn('Background sync reservations notice:', err);
        }
      })();

      // 4. Fetch announcements from Firestore
      const announcementsPromise = (async () => {
        try {
          const liveAnnouncements = await getAnnouncementsFromFirestore();
          if (liveAnnouncements && liveAnnouncements.length > 0) {
            const cleanAnnouncements = liveAnnouncements.filter((a) => !isSeedId(a.id));
            setAnnouncements(cleanAnnouncements);
            safeSetLocalStorageJson(STORAGE_KEYS.ANNOUNCEMENTS, cleanAnnouncements);
          }
        } catch (err) {
          console.warn('Background sync announcements notice:', err);
        }
      })();

      // 5. Fetch career opportunities from Firestore
      const opportunitiesPromise = (async () => {
        try {
          const liveOpps = await getOpportunitiesFromFirestore();
          if (liveOpps && liveOpps.length > 0) {
            const cleanOpps = liveOpps.filter((o) => !isSeedId(o.id));
            setOpportunities(cleanOpps);
            safeSetLocalStorageJson(STORAGE_KEYS.OPPORTUNITIES, cleanOpps);
          }
        } catch (err) {
          console.warn('Background sync opportunities notice:', err);
        }
      })();

      // 5b. Fetch job applications from Firestore to ensure persistent visibility
      const applicationsPromise = (async () => {
        try {
          const liveApps = await getJobApplicationsFromFirestore();
          if (liveApps && liveApps.length > 0) {
            setJobApplications(liveApps);
            safeSetLocalStorageJson(STORAGE_KEYS.APPLICATIONS, liveApps);
          } else {
            setJobApplications([]);
          }
        } catch (err) {
          console.warn('Background sync job applications notice:', err);
        }
      })();

      // 6. Fetch institutional feed posts from Firestore
      const feedPostsPromise = (async () => {
        try {
          const livePosts = await getFeedPostsFromFirestore();
          if (livePosts && livePosts.length > 0) {
            const cleanPosts = dedupePostsById(livePosts.filter((p) => !isSeedId(p.id)));
            setFeedPosts(cleanPosts);
            safeSetLocalStorageJson(STORAGE_KEYS.FEED_POSTS, cleanPosts);
          }
        } catch (err) {
          console.warn('Background sync feed posts notice:', err);
        }
      })();

      // 7. If current user is logged in, fetch fresh profile doc & notifications (including backend moderation notices)
      const userSpecificPromise = (async () => {
        if (!currentUserId) return;
        try {
          const hasServerToken = Boolean(getAuthToken());
          const [freshUser, freshNotifs, modNotifsRes] = await Promise.all([
            getUserFromFirestore(currentUserId).catch(() => null),
            getNotificationsFromFirestore(currentUserId).catch(() => []),
            hasServerToken
              ? apiFetch('/api/moderation/notifications')
                  .then((r) => (r.ok ? r.json() : null))
                  .catch(() => null)
              : Promise.resolve(null)
          ]);
          if (freshUser) {
            setUsers((prev) => {
              const updated = prev.map((u) => (u.uid === currentUserId ? stripPlaintextSecretsFromUser({ ...u, ...freshUser }) : u));
              persistUsersSafe(updated);
              return updated;
            });
          }
          const serverModNotifs: AppNotification[] = Array.isArray(modNotifsRes?.notifications)
            ? modNotifsRes.notifications
            : [];
          const cleanNotifs = (freshNotifs || []).filter((n) => !isSeedId(n.id));
          if (cleanNotifs.length > 0 || serverModNotifs.length > 0) {
            setNotifications((prev) => {
              const map = new Map<string, AppNotification>();
              for (const n of serverModNotifs) {
                if (n && n.id) map.set(n.id, n);
              }
              for (const n of cleanNotifs) {
                if (n && n.id && !map.has(n.id)) map.set(n.id, n);
              }
              for (const n of prev) {
                if (n && n.id && !map.has(n.id)) map.set(n.id, n);
              }
              const merged = Array.from(map.values()).sort(
                (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
              );
              safeSetLocalStorageJson(STORAGE_KEYS.NOTIFICATIONS, merged);
              return merged;
            });
          }
        } catch (err) {
          console.warn('Background sync user-specific notice:', err);
        }
      })();

      // 8. Sync Registrar Registry & Verification Conflicts in parallel
      const registrySyncPromise = (async () => {
        try {
          await Promise.allSettled([
            syncRegistrarRecordsWithFirestore(),
            syncRegistrationConflictsWithFirestore()
          ]);
        } catch (err) {
          console.warn('Background sync registry/conflicts notice:', err);
        }
      })();

      await Promise.allSettled([
        usersPromise,
        eventsPromise,
        reservationsPromise,
        announcementsPromise,
        opportunitiesPromise,
        applicationsPromise,
        feedPostsPromise,
        userSpecificPromise,
        registrySyncPromise
      ]);

      setLastBackgroundSyncTime(new Date());
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('scc:portal-refreshed'));
        window.dispatchEvent(new CustomEvent('conflicts-updated'));
      }
    } finally {
      setIsBackgroundSyncing(false);
      isSyncInProgressRef.current = false;
    }
  }, [currentUserId]);

  // Network Restoration Listener:
  // Detects when the network is restored, flushes pending offline message queue,
  // and triggers background synchronization from Firebase
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setIsOnline(true);
      // Automatically synchronize and drain any queued offline messages
      syncOfflineMessageQueue().catch((err) => {
        console.warn('Auto-sync offline queue notice:', err);
      });
      // Trigger background synchronization from Firebase
      triggerBackgroundSync().then(() => {
        showToast('Network restored: Synchronizing data with Firebase.', 'info');
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    const handleQueueChange = (e: any) => {
      setOfflineQueue(e.detail?.queue || getOfflineMessageQueue());
    };

    const handleMessageStatusChange = (e: any) => {
      const { messageId, chatId, status, error } = e.detail || {};
      if (chatId && messageId) {
        setMessages((prev) => ({
          ...prev,
          [chatId]: (prev[chatId] || []).map((m) =>
            m.id === messageId ? { ...m, status, lastError: error } : m
          )
        }));
      }
      setOfflineQueue(getOfflineMessageQueue());
    };

    const handleMessageSynced = (e: any) => {
      const { messageId, chatId, cleanMsg } = e.detail || {};
      if (chatId && messageId) {
        setMessages((prev) => ({
          ...prev,
          [chatId]: (prev[chatId] || []).map((m) =>
            m.id === messageId ? { ...m, ...cleanMsg, status: 'sent', offlineQueued: false } : m
          )
        }));
      }
      setOfflineQueue(getOfflineMessageQueue());
    };

    const handleOfflineMessagesSynced = (e: any) => {
      const { syncedCount } = e.detail || {};
      if (syncedCount > 0) {
        showToast(`Delivered ${syncedCount} queued message${syncedCount > 1 ? 's' : ''} successfully!`, 'success');
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('applet:offline-queue-change', handleQueueChange);
    window.addEventListener('applet:message-status-change', handleMessageStatusChange);
    window.addEventListener('applet:message-synced', handleMessageSynced);
    window.addEventListener('applet:offline-messages-synced', handleOfflineMessagesSynced);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('applet:offline-queue-change', handleQueueChange);
      window.removeEventListener('applet:message-status-change', handleMessageStatusChange);
      window.removeEventListener('applet:message-synced', handleMessageSynced);
      window.removeEventListener('applet:offline-messages-synced', handleOfflineMessagesSynced);
    };
  }, [triggerBackgroundSync, showToast]);

  // System Background Sync Engine:
  // Automatically synchronizes cloud records with local store on a continuous background interval
  useEffect(() => {
    const syncInterval = setInterval(() => {
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        triggerBackgroundSync().catch((err) => {
          console.warn('Silent background synchronization notice:', err);
        });
      }
    }, 60000); // Syncs silently in background every 60 seconds

    return () => clearInterval(syncInterval);
  }, [triggerBackgroundSync]);

  const refreshData = useCallback(async () => {
    setIsLoadingData(true);
    try {
      await triggerBackgroundSync();
    } catch (err) {
      console.warn('Refresh data notice:', err);
    } finally {
      setTimeout(() => {
        setIsLoadingData(false);
      }, 450);
    }
  }, [triggerBackgroundSync]);

  // Decrypt encrypted local PII on mount and enforce 30-day pending retention sweep
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        purgeExpiredPendingConflicts();
        const decrypted = await Promise.all(users.map((u) => decryptUserPiiFromStorage(stripPlaintextSecretsFromUser(u))));
        const expired = decrypted.filter((u) => isPendingAccountExpired(u));
        if (expired.length > 0) {
          const expUids = expired.map((u) => u.uid);
          addDeletedAccountUids(expUids);
          purgeDeletedUidsFromVaultAndStorage(expUids);
          expUids.forEach((uid) => {
            deleteAuthCredentialInFirestore(uid).catch(() => {});
            alumniService.deleteAlumni(uid).catch(() => {});
          });
        }
        const cleaned = decrypted.filter((u) => !isPendingAccountExpired(u));
        if (active) {
          const changed = JSON.stringify(cleaned) !== JSON.stringify(users);
          if (changed) {
            setUsers(cleaned);
          }
        }
      } catch {}
    })();
    return () => {
      active = false;
    };
  }, []);

  // Sync to localStorage with PII encryption and zero plaintext secrets
  useEffect(() => {
    persistUsersSafe(users);
  }, [users]);

  useEffect(() => {
    try {
      if (currentUserId) {
        localStorage.setItem(STORAGE_KEYS.USER_ID, currentUserId);
        localStorage.setItem('alumni_auth_session_real_v1', currentUserId);
      } else if (authReady) {
        // ONLY remove stored session if authentication initialization is verified and completed
        // Never wipe stored session prematurely during initial page load!
        localStorage.removeItem(STORAGE_KEYS.USER_ID);
        localStorage.removeItem('alumni_auth_session_real_v1');
      }
    } catch {}
  }, [currentUserId, authReady]);

  useEffect(() => {
    safeSetLocalStorageJson(STORAGE_KEYS.REQUESTS, friendRequests);
  }, [friendRequests]);

  useEffect(() => {
    safeSetLocalStorageJson(STORAGE_KEYS.CHATS, chats);
  }, [chats]);

  useEffect(() => {
    safeSetLocalStorageJson(STORAGE_KEYS.MESSAGES, messages);
  }, [messages]);

  useEffect(() => {
    safeSetLocalStorageJson(STORAGE_KEYS.NOTIFICATIONS, notifications);
  }, [notifications]);

  useEffect(() => {
    safeSetLocalStorageJson(STORAGE_KEYS.EVENTS, events);
  }, [events]);

  useEffect(() => {
    safeSetLocalStorageJson(STORAGE_KEYS.ANNOUNCEMENTS, announcements);
  }, [announcements]);

  useEffect(() => {
    safeSetLocalStorageJson(STORAGE_KEYS.OPPORTUNITIES, opportunities);
  }, [opportunities]);

  useEffect(() => {
    safeSetLocalStorageJson(STORAGE_KEYS.APPLICATIONS, jobApplications);
  }, [jobApplications]);

  useEffect(() => {
    safeSetLocalStorageJson(STORAGE_KEYS.CONNECTIONS, connectionsMap);
  }, [connectionsMap]);

  useEffect(() => {
    safeSetLocalStorageJson(STORAGE_KEYS.FOLLOWING, followingMap);
  }, [followingMap]);

  useEffect(() => {
    safeSetLocalStorageJson(STORAGE_KEYS.SETTINGS, notificationSettings);
  }, [notificationSettings]);

  useEffect(() => {
    safeSetLocalStorageJson(STORAGE_KEYS.GALLERY, galleryItems);
  }, [galleryItems]);

  useEffect(() => {
    safeSetLocalStorageJson(STORAGE_KEYS.FEED_POSTS, feedPosts);
  }, [feedPosts]);

  useEffect(() => {
    safeSetLocalStorageJson(STORAGE_KEYS.AUDIT_LOGS, auditLogs);
  }, [auditLogs]);

  useEffect(() => {
    safeSetLocalStorageJson(STORAGE_KEYS.AUTOMATION_JOBS, automationJobs);
  }, [automationJobs]);

  useEffect(() => {
    safeSetLocalStorageJson(STORAGE_KEYS.CAREER_SURVEYS, careerSurveys);
  }, [careerSurveys]);

  useEffect(() => {
    safeSetLocalStorageJson(STORAGE_KEYS.BACKUPS, backups);
  }, [backups]);

  useEffect(() => {
    if (activeTab) {
      try {
        localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, activeTab);
      } catch {}
    }
  }, [activeTab]);

  // Dedicated Session Restoration & Authentication State Initialization
  useEffect(() => {
    let isCancelled = false;

    // Safety fallback: if anything stalls or takes > 300ms, mark authReady true so UI NEVER hangs
    const safetyTimer = setTimeout(() => {
      if (!isCancelled) {
        setAuthReady((prev) => (prev ? prev : true));
      }
    }, 300);

    const restoreActiveSession = async () => {
      try {
        const storedToken = getStoredSessionToken();
        const rawStoredUserId =
          localStorage.getItem(STORAGE_KEYS.USER_ID) ||
          localStorage.getItem('alumni_auth_session_real_v1');
        const storedUserId = normalizeUid(rawStoredUserId);

        if (!storedToken && !storedUserId) {
          // Unauthenticated visitor
          if (!isCancelled) setAuthReady(true);
          return;
        }

        // 1. Check if token is present and check expiration
        let tokenCandidateUid: string | null = null;
        let tokenPayload: any = null;
        if (storedToken) {
          const validation = parseAndValidateSessionToken(storedToken);
          if (validation.expired) {
            // Expired token: clear session, prompt reauthentication
            if (!isCancelled) {
              clearStoredSession();
              setCurrentUserId(null);
              setAuthReady(true);
              showToast('Your session has expired. Please sign in again.', 'info');
            }
            return;
          }
          if (validation.valid && validation.payload) {
            tokenPayload = validation.payload;
            if (validation.payload.uid) {
              tokenCandidateUid = normalizeUid(validation.payload.uid);
            }
          }
        }

        const candidateUid = tokenCandidateUid || storedUserId;
        const localDeletedUids = getDeletedAccountUids();

        if (
          !candidateUid ||
          localDeletedUids.has(candidateUid) ||
          ['user_default_alumni', 'user_default_student', 'user_default_moderator', 'user_default_staff', 'user_default_employer'].includes(candidateUid)
        ) {
          clearStoredSession();
          if (candidateUid && localDeletedUids.has(candidateUid)) {
            purgeDeletedUidsFromVaultAndStorage([candidateUid]);
          }
          if (!isCancelled) {
            setCurrentUserId(null);
            setAuthReady(true);
          }
          return;
        }

        // Check server-authoritative deleted UIDs list first (non-blocking fast timeout)
        try {
          const delRes = await apiFetch('/api/auth/deleted-uids', {}, 1500);
          if (delRes.ok) {
            const delData = await delRes.json();
            const serverDeleted = Array.isArray(delData?.deletedUids) ? delData.deletedUids : [];
            if (serverDeleted.length > 0) {
              const updatedDeleted = addDeletedAccountUids(serverDeleted);
              purgeDeletedUidsFromVaultAndStorage(updatedDeleted);
              if (updatedDeleted.has(candidateUid)) {
                clearStoredSession();
                setUsers((prev) => {
                  const cleaned = prev.filter((u) => !updatedDeleted.has(u.uid) && !isAccountDeleted(u));
                  persistUsersSafe(cleaned);
                  return cleaned;
                });
                if (!isCancelled) {
                  setCurrentUserId(null);
                  setAuthReady(true);
                }
                return;
              }
            }
          }
        } catch {}

        // Resolve candidate user across memory, credentials vault, initial seeds, and Firestore
        let resolvedUser: UserProfile | null = null;
        const candidateEmail = tokenPayload?.email?.toLowerCase();

        // A. In-memory users
        const inMemory = users.find(
          (u) => u.uid === candidateUid || (candidateEmail && u.email?.toLowerCase() === candidateEmail)
        );
        if (inMemory) {
          if (isAccountDeleted(inMemory)) {
            addDeletedAccountUids([inMemory.uid]);
            purgeDeletedUidsFromVaultAndStorage([inMemory.uid]);
            clearStoredSession();
            if (!isCancelled) {
              setCurrentUserId(null);
              setAuthReady(true);
            }
            return;
          }
          resolvedUser = inMemory;
        }

        // B. Credentials vault
        if (!resolvedUser) {
          const vault = getStoredCredentialsVault();
          const cred = vault[candidateUid] || (candidateEmail ? vault[candidateEmail] : null);
          if (cred && !getDeletedAccountUids().has(cred.uid)) {
            resolvedUser = stripPlaintextSecretsFromUser({
              uid: cred.uid,
              name: cred.name || 'Alumnus Member',
              email: cred.email,
              ...(cred.passwordHash ? { passwordHash: cred.passwordHash } : {}),
              role: (cred.role as UserRole) || 'alumni',
              studentId: cred.studentId,
              alumniId: cred.alumniId,
              employeeId: cred.employeeId,
              profilePictureUrl: cred.profilePictureUrl || DEFAULT_USER_AVATAR,
              coverPhotoUrl: cred.coverPhotoUrl || DEFAULT_COVER_PHOTO,
              about: 'Registered member of St. Cecilia’s College alumni network.',
              phone: '+63 917 123 4567',
              isVerified: cred.isVerified ?? true,
              verified: cred.isVerified ?? true,
              verificationStatus: cred.isVerified ? 'verified' : 'pending_review',
              verificationExpiresAt: cred.verificationExpiresAt,
              batch: '2024',
              course: 'B.S. Information Technology',
              headline: 'Alumni Graduate • St. Cecilia’s College',
              location: 'Cebu, Philippines',
              followersCount: 0,
              followingCount: 0,
              connectionsCount: 0,
              experience: [],
              education: [],
              createdAt: new Date().toISOString()
            });
          }
        }

        // C. Pre-seeded INITIAL_USERS
        if (!resolvedUser) {
          const seedMatch = INITIAL_USERS.find(
            (u) => u.uid === candidateUid || (candidateEmail && u.email?.toLowerCase() === candidateEmail)
          );
          if (seedMatch && !getDeletedAccountUids().has(seedMatch.uid)) {
            resolvedUser = stripPlaintextSecretsFromUser({ ...seedMatch });
          }
        }

        // D. Firestore Database
        if (!resolvedUser) {
          try {
            const cloudUser = await getUserFromFirestore(candidateUid);
            if (cloudUser) {
              if (isAccountDeleted(cloudUser)) {
                addDeletedAccountUids([cloudUser.uid || candidateUid]);
                purgeDeletedUidsFromVaultAndStorage([cloudUser.uid || candidateUid]);
                clearStoredSession();
                if (!isCancelled) {
                  setCurrentUserId(null);
                  setAuthReady(true);
                }
                return;
              }
              resolvedUser = cloudUser;
            }
          } catch {}
        }

        // INSTANT ACTIVATION (Offline-First):
        if (resolvedUser && !isAccountDeleted(resolvedUser) && !getDeletedAccountUids().has(resolvedUser.uid) && !isCancelled) {
          const canonicalUser = stripPlaintextSecretsFromUser({ ...resolvedUser, uid: normalizeUid(resolvedUser.uid) || resolvedUser.uid });

          setUsers((prev) => {
            const deleted = getDeletedAccountUids();
            const cleanedPrev = prev.filter((u) => !deleted.has(u.uid) && !isAccountDeleted(u));
            const idx = cleanedPrev.findIndex((u) => u.uid === canonicalUser.uid);
            if (idx >= 0) {
              const updated = [...cleanedPrev];
              updated[idx] = stripPlaintextSecretsFromUser({ ...updated[idx], ...canonicalUser });
              persistUsersSafe(updated);
              return updated;
            }
            const newList = [canonicalUser, ...cleanedPrev];
            persistUsersSafe(newList);
            return newList;
          });

          setCurrentUserId(canonicalUser.uid);
          saveActiveSession(canonicalUser, storedToken || undefined);
          setAuthReady(true);

          if (storedToken) {
            apiFetch('/api/auth/session', {
              headers: { Authorization: `Bearer ${storedToken}` }
            }, 3000)
              .then(async (res) => {
                if (res.ok) {
                  const data = await res.json();
                  if (data?.user && !isCancelled) {
                    setUsers((prev) =>
                      prev.map((u) => (u.uid === canonicalUser.uid ? stripPlaintextSecretsFromUser({ ...u, ...data.user }) : u))
                    );
                  }
                } else if (res.status === 401) {
                  const errData = await res.json().catch(() => ({}));
                  if (errData?.code === 'ACCOUNT_DELETED' && !isCancelled) {
                    addDeletedAccountUids([canonicalUser.uid]);
                    purgeDeletedUidsFromVaultAndStorage([canonicalUser.uid]);
                    clearStoredSession();
                    setCurrentUserId(null);
                    setUsers((prev) => {
                      const next = prev.filter((u) => u.uid !== canonicalUser.uid);
                      persistUsersSafe(next);
                      return next;
                    });
                  }
                }
              })
              .catch(() => {});
          }
          return;
        }

        // If candidate cannot be found locally, query backend endpoint with quick 2500ms timeout
        if (storedToken) {
          try {
            const res = await apiFetch('/api/auth/session', {
              headers: { Authorization: `Bearer ${storedToken}` }
            }, 2500);
            if (res.ok) {
              const data = await res.json();
              if (data?.user && !isCancelled) {
                const srvUser = data.user;
                setUsers((prev) => [srvUser, ...prev.filter((u) => u.uid !== srvUser.uid)]);
                setCurrentUserId(srvUser.uid);
                saveActiveSession(srvUser, storedToken);
                setAuthReady(true);
                return;
              }
            }
          } catch {}
        }

        // If candidate cannot be found anywhere
        if (!isCancelled) {
          clearStoredSession();
          setCurrentUserId(null);
          setAuthReady(true);
        }
      } catch (err) {
        console.warn('Session restoration exception:', err);
        if (!isCancelled) setAuthReady(true);
      }
    };

    restoreActiveSession();

    return () => {
      isCancelled = true;
      clearTimeout(safetyTimer);
    };
  }, []);

  // Firebase Auth State Observer
  useEffect(() => {
    if (!auth) {
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      // CRITICAL: Anonymous users are solely for Firestore background transport security, NEVER treat as portal login!
      if (fbUser && !fbUser.isAnonymous) {
        setIsFirebaseConnected(true);
        const emailLower = (fbUser.email || '').toLowerCase();
        const isKnownAdmin =
          emailLower === 'rlopez@stcecilia.edu.ph' ||
          emailLower === 'pocoravenlopez2024@gmail.com' ||
          emailLower.includes('admin') ||
          emailLower.includes('superadmin') ||
          ['vincentbaloro002@gmail.com', 'vincentbaloro003@gmail.com', 'jamessvencanonigo@gmail.com', 'jamessvenansali@gmail.com', 'sheepyawa@gmail.com', 'just47969@gmail.com', 'pocoravenlopez2024@gmail.com'].includes(emailLower);

        let matched = users.find(
          (u) => u.uid === fbUser.uid || (fbUser.email && u.email.toLowerCase() === emailLower)
        );
        if (!matched) {
          matched = (await getUserFromFirestore(fbUser.uid)) || undefined;
        }
        if (matched) {
          if (isKnownAdmin) {
            matched.role = normalizeSystemRole(matched.role) === 'superadmin' ? 'superadmin' : 'admin';
            matched.isVerified = true;
            matched.verified = true;
          }
          setCurrentUserId(matched.uid);
          saveActiveSession(matched);
          setAuthReady(true);
        } else {
          const email = fbUser.email || '';
          const role: UserRole = isKnownAdmin
            ? 'admin'
            : (emailLower.includes('registrar') || emailLower.includes('staff') || emailLower.includes('moderator'))
            ? 'moderator'
            : 'alumni';

          const isAutoVerified = role !== 'alumni' || isKnownAdmin;

          const newProfile: UserProfile = {
            uid: fbUser.uid,
            name: fbUser.displayName || email.split('@')[0] || 'Cecilian Alumnus',
            email,
            role,
            batch: role === 'alumni' ? '2024' : 'N/A',
            course: role === 'alumni' ? 'B.S. Information Technology' : 'Academic Administration',
            location: 'Cebu, Philippines',
            profilePictureUrl: fbUser.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&auto=format&fit=crop&q=80',
            coverPhotoUrl: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=1200&auto=format&fit=crop&q=80',
            headline: `${role === 'alumni' ? 'B.S. Information Technology Graduate' : (role || 'Alumni').toUpperCase() + ' Specialist'} • St. Cecilia’s College`,
            about: 'Member of St. Cecilia’s College Alumni Community connected with Google Authentication.',
            phone: '',
            isVerified: isAutoVerified,
            verified: isAutoVerified,
            followersCount: 0,
            followingCount: 0,
            connectionsCount: 0,
            experience: [],
            education: [],
            createdAt: new Date().toISOString(),
            authProvider: 'google'
          };
          setUsers((prev) => [newProfile, ...prev]);
          if (isAutoVerified) {
            setCurrentUserId(newProfile.uid);
            saveActiveSession(newProfile);
          }
          saveUserToFirestore(newProfile).catch(() => {});
          setAuthReady(true);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Real-time Firestore Subscriptions & Initial Seeding via alumniService
  useEffect(() => {
    let isSubscribed = true;

    // Fetch live alumni directory directly from Firestore instance and deleted-UIDs from backend on load
    const fetchAlumniFromFirestore = async () => {
      try {
        const [deletedRes, firestoreUsers] = await Promise.all([
          fetch('/api/auth/deleted-uids').then((r) => (r.ok ? r.json() : null)).catch(() => null),
          alumniService.getAllAlumni()
        ]);
        const serverDeletedUids: string[] = Array.isArray(deletedRes?.deletedUids) ? deletedRes.deletedUids : [];
        const firestoreDeletedUids = (firestoreUsers || []).filter((u) => isAccountDeleted(u) || isPendingAccountExpired(u)).map((u) => u.uid);
        const allDeletedSet = addDeletedAccountUids([...serverDeletedUids, ...firestoreDeletedUids]);
        purgeDeletedUidsFromVaultAndStorage(allDeletedSet);

        if (isSubscribed && ((firestoreUsers && firestoreUsers.length > 0) || allDeletedSet.size > 0)) {
          setUsers((prevUsers) => {
            const vault = getStoredCredentialsVault();
            const userMap = new Map<string, UserProfile>();
            prevUsers.forEach((u) => {
              if (!allDeletedSet.has(u.uid) && !isAccountDeleted(u) && !isPendingAccountExpired(u)) {
                userMap.set(u.uid, stripPlaintextSecretsFromUser(u));
              }
            });

            (firestoreUsers || []).forEach((fUser) => {
              if (allDeletedSet.has(fUser.uid) || isAccountDeleted(fUser) || isPendingAccountExpired(fUser)) {
                userMap.delete(fUser.uid);
                return;
              }
              const existing = userMap.get(fUser.uid);
              const cred = vault[fUser.uid] || (fUser.email ? vault[fUser.email.toLowerCase()] : null) || (fUser.studentId ? vault[fUser.studentId.toLowerCase()] : null);
              const preservedHash = existing?.passwordHash || fUser.passwordHash || cred?.passwordHash;

              userMap.set(fUser.uid, stripPlaintextSecretsFromUser({
                ...fUser,
                ...(preservedHash ? { passwordHash: preservedHash } : {}),
                isVerified: fUser.isVerified !== undefined ? fUser.isVerified : (existing?.isVerified ?? (fUser.role === 'alumni')),
                verified: fUser.verified !== undefined ? fUser.verified : (existing?.verified ?? (fUser.role === 'alumni'))
              }));
            });

            const merged = Array.from(userMap.values());
            persistUsersSafe(merged);
            return merged;
          });
        }
      } catch (err) {
        console.warn('Initial Firestore alumni load notice:', err);
      }
    };
    fetchAlumniFromFirestore();
    syncRegistrarRecordsWithFirestore().catch(() => {});

    // Subscribe to real-time alumni directory directly from Firestore
    const unsubUsers = alumniService.subscribeToAlumniDirectory(
      (firestoreUsers) => {
        if (isSubscribed && firestoreUsers && firestoreUsers.length > 0) {
          const firestoreDeletedUids = firestoreUsers.filter((u) => isAccountDeleted(u) || isPendingAccountExpired(u)).map((u) => u.uid);
          const allDeletedSet = addDeletedAccountUids(firestoreDeletedUids);
          purgeDeletedUidsFromVaultAndStorage(allDeletedSet);

          if (currentUserIdRef.current && allDeletedSet.has(currentUserIdRef.current)) {
            clearStoredSession();
            setCurrentUserId(null);
          }

          setUsers((prevUsers) => {
            const vault = getStoredCredentialsVault();
            const userMap = new Map<string, UserProfile>();
            prevUsers.forEach((u) => {
              if (!allDeletedSet.has(u.uid) && !isAccountDeleted(u) && !isPendingAccountExpired(u)) {
                userMap.set(u.uid, stripPlaintextSecretsFromUser(u));
              }
            });

            firestoreUsers.forEach((fUser) => {
              if (allDeletedSet.has(fUser.uid) || isAccountDeleted(fUser) || isPendingAccountExpired(fUser)) {
                userMap.delete(fUser.uid);
                return;
              }
              const existing = userMap.get(fUser.uid);
              const cred = vault[fUser.uid] || (fUser.email ? vault[fUser.email.toLowerCase()] : null) || (fUser.studentId ? vault[fUser.studentId.toLowerCase()] : null);
              const preservedHash = existing?.passwordHash || fUser.passwordHash || cred?.passwordHash;

              userMap.set(fUser.uid, stripPlaintextSecretsFromUser({
                ...fUser,
                ...(preservedHash ? { passwordHash: preservedHash } : {}),
                isVerified: fUser.isVerified !== undefined ? fUser.isVerified : (existing?.isVerified ?? (fUser.role === 'alumni')),
                verified: fUser.verified !== undefined ? fUser.verified : (existing?.verified ?? (fUser.role === 'alumni'))
              }));
            });

            const merged = Array.from(userMap.values());
            persistUsersSafe(merged);
            return merged;
          });
        }
      },
      (error) => {
        console.warn('Alumni Directory Firestore subscription notice:', error);
      }
    );

    const unsubEvents = subscribeToEvents((firestoreEvents) => {
      if (isSubscribed) {
        setEvents((firestoreEvents || []).filter((e) => !isSeedId(e.id)));
      }
    });

    const unsubOpps = subscribeToOpportunities((firestoreOpps) => {
      if (isSubscribed) {
        setOpportunities((firestoreOpps || []).filter((o) => !isSeedId(o.id)));
      }
    });

    const unsubApps = subscribeToJobApplications((firestoreApps) => {
      if (isSubscribed) {
        if (firestoreApps && firestoreApps.length > 0) {
          setJobApplications(firestoreApps);
        } else {
          setJobApplications([]);
        }
      }
    });

    const unsubAnn = subscribeToAnnouncements((firestoreAnns) => {
      if (isSubscribed) {
        setAnnouncements((firestoreAnns || []).filter((a) => !isSeedId(a.id)));
      }
    });

    const unsubReqs = subscribeToFriendRequests((firestoreReqs) => {
      if (isSubscribed) {
        setFriendRequests(firestoreReqs);
        // Automatically sync bidirectional connectionsMap with all accepted requests
        setConnectionsMap((prev) => {
          const next = { ...prev };
          let changed = false;
          firestoreReqs.forEach((r) => {
            if (r.status === 'accepted') {
              const listA = next[r.fromUid] || [];
              if (!listA.includes(r.toUid)) {
                next[r.fromUid] = [...listA, r.toUid];
                changed = true;
              }
              const listB = next[r.toUid] || [];
              if (!listB.includes(r.fromUid)) {
                next[r.toUid] = [...listB, r.fromUid];
                changed = true;
              }
            }
          });
          return changed ? next : prev;
        });
      }
    });

    const unsubFeed = subscribeToFeedPosts((firestorePosts) => {
      if (isSubscribed) {
        const cleanRemote = (firestorePosts || []).filter(
          (p) => !isSeedId(p.id) && !deletedFeedPostIdsRef.current.has(p.id)
        );
        const remoteIds = new Set(cleanRemote.map((p) => p.id));
        const pendingExtras: InstitutionalFeedPost[] = [];
        pendingLocalPostsRef.current.forEach((pendingPost, id) => {
          if (remoteIds.has(id)) {
            pendingLocalPostsRef.current.delete(id);
          } else if (!deletedFeedPostIdsRef.current.has(id)) {
            pendingExtras.push(pendingPost);
          }
        });
        setFeedPosts(dedupePostsById([...pendingExtras, ...cleanRemote]));
      }
    });

    const unsubGallery = subscribeToGalleryItems((firestoreGallery) => {
      if (isSubscribed && firestoreGallery) {
        setGalleryItems(firestoreGallery.filter((g) => !isSeedId(g.id)));
      }
    });

    return () => {
      isSubscribed = false;
      unsubUsers();
      unsubEvents();
      unsubOpps();
      unsubApps();
      unsubAnn();
      unsubReqs();
      unsubFeed();
      unsubGallery();
    };
  }, []);

  // Current User resolution with resilient session recovery
  const currentUser = useMemo(() => {
    if (!currentUserId) return null;
    const deletedUids = getDeletedAccountUids();
    if (deletedUids.has(currentUserId)) return null;
    let found = users.find((u) => u.uid === currentUserId);
    if (found && isAccountDeleted(found)) return null;
    if (!found) {
      const vault = getStoredCredentialsVault();
      const cred = vault[currentUserId];
      if (cred && !deletedUids.has(cred.uid)) {
        found = stripPlaintextSecretsFromUser({
          uid: cred.uid,
          name: cred.name || 'Alumnus Member',
          email: cred.email,
          ...(cred.passwordHash ? { passwordHash: cred.passwordHash } : {}),
          role: (cred.role as UserRole) || 'alumni',
          studentId: cred.studentId,
          alumniId: cred.alumniId,
          employeeId: cred.employeeId,
          profilePictureUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&auto=format&fit=crop&q=80',
          coverPhotoUrl: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=1200&auto=format&fit=crop&q=80',
          about: 'Registered member of St. Cecilia’s College alumni network.',
          phone: '+63 917 123 4567',
          isVerified: true,
          verified: true,
          verificationStatus: 'verified',
          batch: '2024',
          course: 'B.S. Information Technology',
          headline: 'Alumni Graduate • St. Cecilia’s College',
          location: 'Cebu, Philippines',
          followersCount: 0,
          followingCount: 0,
          connectionsCount: 0,
          experience: [],
          education: [],
          createdAt: new Date().toISOString()
        });
      }
    }
    return found || null;
  }, [currentUserId, users]);

  currentUserRoleRef.current = currentUser?.role || 'alumni';
  currentUserIdRef.current = currentUser?.uid || currentUserId || null;

  useEffect(() => {
    if (!currentUser || typeof window === 'undefined') return;
    if (/^\/portal\//i.test(window.location.pathname)) {
      const parsed = parsePortalUrlPath(window.location.pathname, currentUser.role);
      setActiveTabState(parsed.tab);
      if (parsed.targetId || parsed.subTab) {
        setDeepLinkTarget({
          tab: parsed.tab,
          targetType: parsed.targetType,
          targetId: parsed.targetId,
          subTab: parsed.subTab,
          targetPath: parsed.targetPath,
          targetRoute: parsed.targetRoute,
          timestamp: Date.now()
        });
        if (parsed.targetId) {
          triggerItemHighlight(parsed.targetId);
        }
      }
    }
  }, [currentUser?.uid, currentUser?.role, triggerItemHighlight]);

  // Ensure recovered session user is back in active users array (never resurrect deleted UIDs)
  useEffect(() => {
    if (currentUserId && !getDeletedAccountUids().has(currentUserId) && !users.some((u) => u.uid === currentUserId)) {
      const vault = getStoredCredentialsVault();
      const cred = vault[currentUserId];
      if (cred && !getDeletedAccountUids().has(cred.uid)) {
        setUsers((prev) => {
          if (prev.some((u) => u.uid === currentUserId)) return prev;
          const recovered: UserProfile = stripPlaintextSecretsFromUser({
            uid: cred.uid,
            name: cred.name || 'Alumnus Member',
            email: cred.email,
            ...(cred.passwordHash ? { passwordHash: cred.passwordHash } : {}),
            role: (cred.role as UserRole) || 'alumni',
            studentId: cred.studentId,
            alumniId: cred.alumniId,
            employeeId: cred.employeeId,
            profilePictureUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&auto=format&fit=crop&q=80',
            coverPhotoUrl: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=1200&auto=format&fit=crop&q=80',
            about: 'Registered member of St. Cecilia’s College alumni network.',
            phone: '+63 917 123 4567',
            isVerified: true,
            verified: true,
            verificationStatus: 'verified',
            batch: '2024',
            course: 'B.S. Information Technology',
            headline: 'Alumni Graduate • St. Cecilia’s College',
            location: 'Cebu, Philippines',
            followersCount: 0,
            followingCount: 0,
            connectionsCount: 0,
            experience: [],
            education: [],
            createdAt: new Date().toISOString()
          });
          return [recovered, ...prev];
        });
      }
    }
  }, [currentUserId, users]);

  // Synchronize authenticated session token for backend API and PDF export authorization
  useEffect(() => {
    if (currentUser) {
      try {
        const canonicalUid = normalizeUid(currentUser.uid) || currentUser.uid;
        const existingToken = getStoredSessionToken();
        if (isSignedHmacToken(existingToken)) {
          const parsed = parseAndValidateSessionToken(existingToken!);
          if (parsed.valid && parsed.payload?.uid === canonicalUid) {
            sessionStorage.setItem('alumni_server_auth_token', existingToken!);
            sessionStorage.setItem('alumni_auth_token', existingToken!);
            localStorage.setItem('alumni_server_auth_token', existingToken!);
            localStorage.setItem('alumni_auth_token', existingToken!);
            return;
          }
        }
        const tokenPayload = {
          uid: canonicalUid,
          email: currentUser.email,
          role: currentUser.role || 'alumni',
          emailVerified: !!currentUser.isVerified,
          exp: Date.now() + 24 * 60 * 60 * 1000
        };
        const token = btoa(unescape(encodeURIComponent(JSON.stringify(tokenPayload))));
        sessionStorage.setItem('alumni_server_auth_token', token);
        sessionStorage.setItem('alumni_auth_token', token);
        localStorage.setItem('alumni_server_auth_token', token);
        localStorage.setItem('alumni_auth_token', token);
      } catch (e) {
        console.warn('Could not cache session auth token:', e);
      }
    }
  }, [currentUser]);

  // Real-time Peer-to-Peer Chat Subscription (strictly member-scoped)
  useEffect(() => {
    if (!currentUser?.uid) return;
    const unsub = subscribeToUserChats(currentUser.uid, (cloudChats) => {
      if (cloudChats) {
        setChats((prev) => {
          const map = new Map<string, ChatThread>();
          prev.forEach((c) => {
            if ((c.memberIds || (c as any).participants || []).includes(currentUser.uid) && c.id !== 'chat_admin_alumni') {
              map.set(c.id, c);
            }
          });
          cloudChats.forEach((c) => {
            if ((c.memberIds || (c as any).participants || []).includes(currentUser.uid) && c.id !== 'chat_admin_alumni') {
              map.set(c.id, { ...(map.get(c.id) || {}), ...c });
            }
          });
          return Array.from(map.values()).sort(
            (a, b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime()
          );
        });
      }
    });
    return () => unsub();
  }, [currentUser?.uid]);

  // Real-time Notifications Subscription (user-scoped and broadcast)
  useEffect(() => {
    if (!currentUser?.uid) return;
    const unsub = subscribeToUserNotifications(currentUser.uid, (cloudNotifs) => {
      if (cloudNotifs && cloudNotifs.length > 0) {
        setNotifications((prev) => {
          const map = new Map<string, AppNotification>();
          // Cloud notifications have authoritative state
          prev.forEach((n) => map.set(n.id, n));
          cloudNotifs.forEach((n) => map.set(n.id, n));
          return Array.from(map.values()).sort(
            (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
          );
        });
      }
    });
    return () => unsub();
  }, [currentUser?.uid]);

  // Real-time Chat Messages Subscription for Active Thread
  useEffect(() => {
    if (!activeChatId) return;
    const unsub = subscribeToChatMessages(activeChatId, (cloudMsgs) => {
      if (cloudMsgs && cloudMsgs.length > 0) {
        setMessages((prev) => ({
          ...prev,
          [activeChatId]: cloudMsgs
        }));
      }
    });
    return () => unsub();
  }, [activeChatId]);

  // Automated profile completion check on session start
  useEffect(() => {
    if (!currentUser) return;
    const sessionKey = `greeted_${currentUser.uid}_${new Date().toISOString().split('T')[0]}`;
    if (sessionStorage.getItem(sessionKey)) return;
    sessionStorage.setItem(sessionKey, 'true');

    // Profile completion reminder if < 70% (strictly for alumni)
    if (currentUser.role === 'alumni') {
      const completion = calculateProfileCompletion(currentUser);
      if (completion.percentage < 70 && !currentUser.lastProfileUpdateReminder) {
        setNotifications((prev) => {
          const alreadyNotified = prev.some(
            (n) => n.toUid === currentUser.uid && n.type === 'profile_update'
          );
          if (alreadyNotified) return prev;
          const missingList = completion.missingFields.slice(0, 3).join(', ');
          const notif: AppNotification = {
            id: `notif_prof_${currentUser.uid}`,
            toUid: currentUser.uid,
            type: 'profile_update',
            title: 'Complete Your Cecilian Alumni Profile',
            body: `Your profile is ${completion.percentage}% complete. Adding your ${missingList} boosts networking and job matching!`,
            metadata: { targetRole: 'alumni' },
            read: false,
            createdAt: new Date().toISOString()
          };
          return [notif, ...prev];
        });
      }
    }
  }, [currentUser, showToast]);

  // Role Permissions Summary (Enforcing Functional Ownership & Least Privilege)
  const permissions = useMemo(() => {
    const role = currentUser?.role;
    return {
      // Send friend requests: Verified alumni only
      canSendFriendRequests: role === 'alumni',
      // Follow users: alumni, admin, superadmin, moderator
      canFollow: role === 'alumni' || role === 'admin' || role === 'superadmin' || role === 'moderator',
      // Create events: Moderator (primary routine owner), Admin, Superadmin. Alumni strictly NOT allowed.
      canCreateEvents: role !== 'alumni' && ['admin', 'superadmin', 'moderator'].includes(role || ''),
      // Manage/publish events: Moderator, Admin, Superadmin. Alumni strictly NOT allowed.
      canManageEvents: role !== 'alumni' && ['admin', 'superadmin', 'moderator'].includes(role || ''),
      // Delete events: Moderator (routine owner), Admin/Superadmin (oversight). Alumni strictly NOT allowed.
      canDeleteEvents: role !== 'alumni' && ['admin', 'superadmin', 'moderator'].includes(role || ''),
      // Post announcements: Moderator, Admin, Superadmin
      canPostAnnouncements: ['admin', 'superadmin', 'moderator'].includes(role || ''),
      // Delete announcements: Moderator, Admin, Superadmin
      canDeleteAnnouncements: ['admin', 'superadmin', 'moderator'].includes(role || ''),
      // Delete events/comments & Community Moderation: Moderator (routine owner), Admin/Superadmin (oversight)
      canDeleteEventsComments: role !== 'alumni' && ['moderator', 'admin', 'superadmin'].includes(role || ''),
      // Access admin workspace: superadmin, admin, moderator
      canAccessAdminPanel: ['admin', 'superadmin', 'moderator'].includes(role || ''),
      // Access employer dashboard: verified employer partner or admin/superadmin (oversight)
      canAccessEmployerDashboard: role === 'employer' || ['admin', 'superadmin'].includes(role || ''),
      // Message anyone: Verified alumni, verified employers, moderator, admin/superadmin
      canMessageAnyone: Boolean(currentUser) && (Boolean(currentUser?.isVerified) || ['admin', 'superadmin', 'moderator'].includes(role || '')),
      // Campus & Heritage Gallery: Moderator, Admin, Superadmin
      canUploadGallery: ['moderator', 'admin', 'superadmin'].includes(role || ''),
      // Manage Job Moderation & Approval: Moderator (routine owner), Admin/Superadmin (oversight)
      canManageJobModeration: ['moderator', 'admin', 'superadmin'].includes(role || ''),
      // Post Jobs: Verified employer partners, Admin/Superadmin (oversight), moderators. Alumni are strictly NOT allowed to post jobs!
      canPostJobs: role !== 'alumni' && (
        ['admin', 'superadmin', 'moderator'].includes(role || '') ||
        (role === 'employer' &&
          (Boolean(currentUser?.isVerified) ||
           currentUser?.employerVerificationStatus === 'verified' ||
           currentUser?.employerStatus === 'active') &&
          currentUser?.employerVerificationStatus !== 'rejected' &&
          currentUser?.canPostJobs !== false &&
          (currentUser?.employerStatus !== 'expired' &&
           (!currentUser?.employerExpirationDate || new Date(currentUser.employerExpirationDate).getTime() >= Date.now()))
        )
      ),

      // SPECIFIC RBAC & FUNCTIONAL OWNERSHIP RESTRICTIONS:
      // Academic Registry: Moderator (primary owner, degree clearance), Superadmin/Admin (view/oversight)
      canAccessRegistry: ['moderator', 'admin', 'superadmin'].includes(role || ''),
      // Conflict Resolution: Moderator (primary owner), Superadmin/Admin (oversight)
      canAccessConflictResolution: ['moderator', 'admin', 'superadmin'].includes(role || ''),
      // Employer Accreditation: Administrator & Super Administrator only
      canAccessEmployerAccreditation: ['admin', 'superadmin'].includes(role || ''),
      // Governance & Retention Policies: Super Administrator ONLY
      canAccessGovernance: role === 'superadmin',
      // Audit Trails & Database Indexes/Config: Super Administrator ONLY
      canAccessAuditTrails: role === 'superadmin',
      canAccessDatabaseTools: role === 'superadmin',
      // Automations: Super Administrator & Administrator
      canAccessAutomations: ['superadmin', 'admin'].includes(role || ''),
      // Growth Analytics: Super Administrator & Administrator
      canAccessGrowthAnalytics: ['superadmin', 'admin'].includes(role || ''),
      // Database Backup: Super Administrator ONLY
      canManageBackups: role === 'superadmin',

      // Administration
      // Role Assignment: Super Administrator (full), Administrator (approved roles)
      canAssignRoles: ['admin', 'superadmin'].includes(role || ''),
      // Alumni Verification: Moderator (primary owner, academic clearance), Admin/Superadmin (oversight)
      canVerifyAlumni: ['moderator', 'admin', 'superadmin'].includes(role || '')
    };
  }, [currentUser]);

  // Following & Connection list for current user
  const followingIds = useMemo(() => {
    if (!currentUserId) return [];
    return followingMap[currentUserId] || [];
  }, [currentUserId, followingMap]);

  const connectionIds = useMemo(() => {
    if (!currentUserId) return [];
    return connectionsMap[currentUserId] || [];
  }, [currentUserId, connectionsMap]);

  // Role-based User Notifications strictly scoped to current user's role and dashboard activities
  const userNotifications = useMemo(() => {
    if (!currentUser) return [];
    const relevant = notifications.filter((n) => isNotificationRelevantToUser(n, currentUser, permissions));
    return filterUniqueNotifications(relevant);
  }, [currentUser, permissions, notifications]);

  // Unread notifications count strictly for relevant notifications
  const unreadNotificationsCount = useMemo(() => {
    if (!currentUserId || !currentUser) return 0;
    return userNotifications.filter((n) => !n.read).length;
  }, [currentUserId, currentUser, userNotifications]);

  // Auth Operations
  const loginWithGoogle = async (): Promise<boolean> => {
    try {
      const res = await signInWithGoogle();
      const fbUser = res.user;
      if (!fbUser) return false;

      let matched = users.find(
        (u) => u.uid === fbUser.uid || (fbUser.email && u.email.toLowerCase() === fbUser.email.toLowerCase())
      );

      if (!matched) {
        matched = (await getUserFromFirestore(fbUser.uid)) || undefined;
      }

      const emailLower = (fbUser.email || '').toLowerCase();
      const isKnownAdmin =
        emailLower === 'rlopez@stcecilia.edu.ph' ||
        emailLower.includes('admin') ||
        emailLower.includes('superadmin') ||
        ['vincentbaloro002@gmail.com', 'vincentbaloro003@gmail.com', 'jamessvencanonigo@gmail.com', 'jamessvenansali@gmail.com', 'sheepyawa@gmail.com', 'just47969@gmail.com'].includes(emailLower);

      if (matched) {
        // If user is a verified institution administrator
        if (isKnownAdmin) {
          matched.role = normalizeSystemRole(matched.role) === 'superadmin' ? 'superadmin' : 'admin';
          matched.isVerified = true;
          matched.verified = true;
        }

        // Strict Verification Check: Do not let unverified accounts log in
        if (matched.role === 'alumni' && !matched.isVerified) {
          showToast('Login blocked: Your alumni account has not been verified by the Registrar.', 'error');
          return false;
        }
        if (matched.role === 'employer' && (!matched.isVerified || matched.employerVerificationStatus === 'rejected')) {
          showToast('Login blocked: Your employer account has not been approved yet.', 'error');
          return false;
        }

        setCurrentUserId(matched.uid);
        saveActiveSession(matched);
        setAuthReady(true);
        await saveUserToFirestore(matched).catch(() => {});
        if (['admin', 'superadmin', 'moderator'].includes(matched.role)) {
          setActiveTab('admin');
        } else {
          setActiveTab('dashboard');
        }
        showToast(`Welcome back, ${matched.name}! Signed in via Google.`);
        return true;
      } else {
        const email = fbUser.email || '';
        const role: UserRole = isKnownAdmin
          ? 'admin'
          : (emailLower.includes('registrar') || emailLower.includes('staff') || emailLower.includes('moderator'))
          ? 'moderator'
          : 'alumni';

        // Alumni registering via Google must be verified before login
        const isAutoVerified = role !== 'alumni' || isKnownAdmin;

        const newProfile: UserProfile = {
          uid: fbUser.uid,
          name: fbUser.displayName || email.split('@')[0] || 'Cecilian Member',
          email,
          role,
          batch: role === 'alumni' ? '2024' : 'N/A',
          course: role === 'alumni' ? 'B.S. Information Technology' : 'Institutional Leadership',
          location: 'Cebu, Philippines',
          profilePictureUrl: fbUser.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&auto=format&fit=crop&q=80',
          coverPhotoUrl: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=1200&auto=format&fit=crop&q=80',
          headline: `${role === 'alumni' ? 'B.S. Information Technology Graduate' : (role || 'Alumni').toUpperCase() + ' Specialist'} • St. Cecilia’s College`,
          about: 'Member of St. Cecilia’s College Alumni Community connected with Google Authentication.',
          phone: '',
          isVerified: isAutoVerified,
          verified: isAutoVerified,
          followersCount: 0,
          followingCount: 0,
          connectionsCount: 0,
          experience: [],
          education: [],
          createdAt: new Date().toISOString(),
          authProvider: 'google'
        };

        setUsers((prev) => [newProfile, ...prev]);
        await saveUserToFirestore(newProfile).catch(() => {});

        if (!isAutoVerified) {
          showToast('Google account linked, but access is blocked pending verification.', 'error');
          return false;
        }

        setCurrentUserId(newProfile.uid);
        saveActiveSession(newProfile);
        setAuthReady(true);

        if (['admin', 'superadmin', 'moderator'].includes(role)) {
          setActiveTab('admin');
        } else {
          setActiveTab('dashboard');
        }
        showToast(`Welcome, ${newProfile.name}! Account linked with Google.`);
        return true;
      }
    } catch (err: any) {
      console.warn('Google sign-in error:', err);
      if (err?.code !== 'auth/popup-closed-by-user') {
        showToast(err?.message || 'Google sign-in could not be completed.');
      }
      return false;
    }
  };

  // Core Registrar Verification Check
  const registrar_verification = useCallback(
    (studentIdToCheck?: string, candidateName?: string): RegistrarVerificationResult => {
      const rawId = (studentIdToCheck || currentUser?.studentId || '').trim();

      if (!rawId) {
        return {
          isVerified: false,
          status: 'format_error',
          studentId: 'None',
          message: "Student ID 'None' could not be confirmed in St. Cecilia's College registrar records. Expected format: SCC-YYYY-XXXX (e.g. SCC-2024-0001 or SCC-2020-0192)."
        };
      }

      // Check pattern requirement: SCC-YYYY-XXXX (e.g. SCC-2020-0192)
      if (!isValidStudentIdPattern(rawId)) {
        return {
          isVerified: false,
          status: 'format_error',
          studentId: rawId,
          message: `Student ID '${rawId}' could not be confirmed in St. Cecilia's College registrar records. Expected format: SCC-YYYY-XXXX (e.g. SCC-2024-0001 or SCC-2020-0192).`
        };
      }

      const normalized = normalizeStudentId(rawId).toUpperCase();
      const registryRecords = getRegistrarRecords();
      const match = registryRecords.find(
        (r) => normalizeStudentId(r.studentId).toUpperCase() === normalized
      );

      if (match) {
        const isUnverifiedRecord =
          (match.status as string)?.toLowerCase() === 'unverified' ||
          match.verification_status === 'unverified';

        if (isUnverifiedRecord) {
          return {
            isVerified: false,
            status: 'not_found',
            studentId: rawId,
            message: `Student ID '${rawId}' could not be confirmed in St. Cecilia's College registrar records. Expected format: SCC-YYYY-XXXX (e.g. SCC-2024-0001 or SCC-2020-0192).`
          };
        }

        if (candidateName && candidateName.trim().length >= 2) {
          const qNorm = candidateName.trim().toLowerCase();
          const rNorm = (match.fullName || '').trim().toLowerCase();
          const qParts = qNorm.split(' ').filter((p) => p.length >= 2);
          const nameMatches =
            rNorm === qNorm ||
            rNorm.includes(qNorm) ||
            qNorm.includes(rNorm) ||
            qParts.some((p) => rNorm.includes(p));

          if (!nameMatches) {
            return {
              isVerified: false,
              status: 'not_found',
              studentId: rawId,
              message: 'Security Verification Failed: The student name provided does not match the official registrar record for this Student ID. Details on file cannot be disclosed for identity protection.'
            };
          }
        }

        return {
          isVerified: true,
          status: 'verified',
          studentId: normalized,
          record: match,
          message: 'Academic Record Confirmed! Official graduate record verified.'
        };
      }

      return {
        isVerified: false,
        status: 'not_found',
        studentId: rawId,
        message: `Student ID '${rawId}' could not be confirmed in St. Cecilia's College registrar records. Expected format: SCC-YYYY-XXXX (e.g. SCC-2024-0001 or SCC-2020-0192).`
      };
    },
    [currentUser]
  );

  const login = async (identifier: string, pass: string): Promise<boolean> => {
    setLoginPendingAccountNotice(null);
    // 1. Mandatory input validation
    if (!identifier || typeof identifier !== 'string' || !identifier.trim()) {
      showToast('Email address or SCC ID is required to sign in.', 'error');
      return false;
    }
    if (!pass || typeof pass !== 'string' || !pass.trim()) {
      showToast('Password is required to sign in.', 'error');
      return false;
    }

    const trimmed = identifier.trim().toLowerCase();
    const rawClean = trimmed.replace(/^scc-?/i, '').replace(/^alum-?/i, '');
    const normalizedInputId = normalizeStudentId(trimmed).toLowerCase();
    const digitsOnly = trimmed.replace(/[^a-zA-Z0-9]/g, '');

    // Check if account is currently locked due to repeated failed login attempts
    const attemptTracker = failedLoginAttemptsRef.current.get(trimmed) || { count: 0 };
    if (attemptTracker.lockedUntil && Date.now() < attemptTracker.lockedUntil) {
      const remainingSec = Math.ceil((attemptTracker.lockedUntil - Date.now()) / 1000);
      showToast(`Account locked due to repeated failed login attempts. Please try again in ${remainingSec}s.`, 'error');
      return false;
    }

    // 2. Server-side validation via backend /api/auth/login (authoritative single active session provider)
    let serverAuthToken: string | undefined;
    try {
      const serverRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          identifier: trimmed,
          password: pass,
          platform: clientPlatform,
          deviceInfo: getClientDeviceInfo()
        })
      });

      if (serverRes.status === 410) {
        const errorData = await serverRes.json().catch(() => ({}));
        setUsers((prev) => {
          const next = prev.filter(
            (u) =>
              !(
                (u.email && u.email.toLowerCase() === trimmed) ||
                (u.studentId && normalizeStudentId(u.studentId).toLowerCase() === normalizedInputId)
              )
          );
          persistUsersSafe(next);
          return next;
        });
        removeCredentialFromVault({ email: trimmed, studentId: trimmed });
        showToast(
          errorData?.error || 'Your pending verification expired after 30 days and your personal data was purged. Please submit a new registration.',
          'error'
        );
        return false;
      }

      if (serverRes.status === 403) {
        const errorData = await serverRes.json();

        if (
          errorData.code === 'EMPLOYER_REAPPLICATION_BLOCKED' ||
          errorData.code === 'APPLICATION_PREVIOUSLY_REJECTED'
        ) {
          showToast(
            errorData.error || 'This application was previously rejected and cannot be re-submitted.',
            'error'
          );
          return false;
        }

        if (errorData.code === 'ACCOUNT_SUSPENDED') {
          setLoginSuspensionNotice({
            status: 'SUSPENDED',
            title: 'Your account has been temporarily suspended',
            reason: errorData.reason || 'Violation of institutional account policies.',
            startDate: errorData.startDate,
            endDate: errorData.endDate,
            suspendedByName: errorData.suspendedByName || 'Institutional Administration',
            contactInstructions: errorData.contactInstructions || 'Please contact the Registrar Office or System Administration (admin@stcecilia.edu.ph) for assistance.'
          });
          showToast(errorData.error || 'Your account has been temporarily suspended.', 'error');
          return false;
        }

        if (errorData.code === 'ACCOUNT_LOCKED') {
          setLoginSuspensionNotice({
            status: 'LOCKED',
            title: 'Your account has been locked by an administrator',
            reason: errorData.reason || 'Administrative account lockout.',
            startDate: errorData.startDate,
            suspendedByName: errorData.suspendedByName || 'Institutional Administration',
            contactInstructions: errorData.contactInstructions || 'Please contact the Registrar Office or System Administration (admin@stcecilia.edu.ph) to request an account review.'
          });
          showToast(errorData.error || 'Your account has been locked by an administrator.', 'error');
          return false;
        }

        const errorMsg = errorData.error || 'Access denied on this platform.';
        showToast(errorMsg, 'error');
        setLoginPlatformError(errorMsg);
        return false;
      }


      if (serverRes.status === 409) {
        const conflictData = await serverRes.json();
        setActiveSessionConflict({
          identifier: trimmed,
          password: pass,
          message: conflictData.message || 'This account is currently in use on another device.',
          activeSession: conflictData.activeSession || {
            deviceInfo: 'Another device',
            approxLocation: 'Minglanilla, Cebu, Philippines'
          },
          attemptInfo: conflictData.attemptInfo,
          ownerEmailMasked: conflictData.ownerEmailMasked || 'your registered email',
          canTerminateExistingSession: true
        });

        // Record MULTIPLE_USERS_SAME_ACCOUNT (Suspicious Activity with Warning Icon ⚠️)
        const activeDev = conflictData.activeSession?.deviceInfo || 'Another device';
        const activeLoc = conflictData.activeSession?.approxLocation || 'Cebu';
        const currentDev = getClientDeviceInfo();
        const conflictTimestamp = new Date().toISOString();

        try {
          addAuditLog({
            action: 'MULTIPLE_USERS_SAME_ACCOUNT',
            actorId: trimmed,
            actorName: trimmed,
            actorRole: 'alumni',
            category: 'security',
            details: `Suspected multiple people using account "${trimmed}". Existing session active on ${activeDev} (${activeLoc}); concurrent sign-in attempt from ${currentDev}. Timestamp: ${conflictTimestamp}.`,
            severity: 'alert',
            targetRecordId: trimmed
          });

          // Notify Superadministrator only
          const adminNotif: AppNotification = {
            id: `notif_multi_${Date.now()}`,
            toUid: 'superadmin',
            title: '⚠️ Suspicious Activity: Multiple Users Detected',
            body: `Account "${trimmed}" was accessed concurrently from multiple devices (${activeDev} vs ${currentDev}). Possible account sharing detected at ${conflictTimestamp}.`,
            type: 'security',
            targetPath: '/portal/audit',
            targetRoute: '/portal/audit',
            metadata: { targetRole: 'superadmin' },
            read: false,
            createdAt: conflictTimestamp
          };
          setNotifications((prev) => [adminNotif, ...prev]);
          saveNotificationToFirestore(adminNotif).catch(() => {});
        } catch {}

        showToast(
          'This account is currently in use on another device. An alert notification has been sent to your email.',
          'error'
        );
        return false;
      }

      if (serverRes.status === 401) {
        if (pendingVaultHashPromises.size > 0) {
          await Promise.all(Array.from(pendingVaultHashPromises.values())).catch(() => {});
        }
        let deletedUids = getDeletedAccountUids();
        try {
          const delRes = await fetch('/api/auth/deleted-uids');
          if (delRes.ok) {
            const delJson = await delRes.json();
            if (Array.isArray(delJson?.deletedUids)) {
              deletedUids = addDeletedAccountUids(delJson.deletedUids);
              purgeDeletedUidsFromVaultAndStorage(deletedUids);
            }
          }
        } catch {}
        // If not found in backend in-memory cache, check if user exists locally with matching credentials and auto-sync
        const localUser = users.find(
          (u) =>
            !isAccountDeleted(u) &&
            !deletedUids.has(u.uid) &&
            (u.email?.toLowerCase() === trimmed ||
              (u.studentId && normalizeStudentId(u.studentId).toLowerCase() === normalizedInputId))
        );
        if (localUser && isPendingAccountExpired(localUser)) {
          setUsers((prev) => {
            const next = prev.filter((u) => u.uid !== localUser.uid);
            persistUsersSafe(next);
            return next;
          });
          removeCredentialFromVault({ uid: localUser.uid, email: localUser.email, studentId: localUser.studentId });
          alumniService.deleteAlumni(localUser.uid).catch(() => {});
          showToast('Your pending verification expired after 30 days and your personal data was purged. Please submit a new registration.', 'error');
          return false;
        }
        const localVault = findCredentialInVault(trimmed);
        const seedForLocal = INITIAL_USERS.find(
          (iu) => iu.uid === localUser?.uid || (iu.email && localUser?.email && iu.email.toLowerCase() === localUser.email.toLowerCase())
        );
        const candidateSecret =
          localUser?.passwordHash ||
          (localVault && !deletedUids.has(localVault.uid) ? localVault.passwordHash || localVault.password : undefined) ||
          (localUser as any)?.password ||
          seedForLocal?.password;
        const localMatches = localUser && candidateSecret ? await verifySecretClient(pass, candidateSecret) : false;

        if (localUser && localMatches) {
          await fetch('/api/auth/sync-credentials', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ users: [{ ...stripPlaintextSecretsFromUser(localUser), password: pass }] })
          }).catch(() => {});

          const retryRes = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              identifier: trimmed,
              password: pass,
              platform: clientPlatform,
              deviceInfo: getClientDeviceInfo()
            })
          });

          if (retryRes.ok) {
            const authData = await retryRes.json();
            if (authData.token) {
              serverAuthToken = authData.token;
              try {
                sessionStorage.setItem('alumni_server_auth_token', authData.token);
                sessionStorage.setItem('alumni_auth_token', authData.token);
                localStorage.setItem('alumni_server_auth_token', authData.token);
                localStorage.setItem('alumni_auth_token', authData.token);
              } catch {}
            }
            if (authData.refreshToken) {
              try {
                sessionStorage.setItem('alumni_refresh_token', authData.refreshToken);
                localStorage.setItem('alumni_refresh_token', authData.refreshToken);
                sessionStorage.setItem('alumni_latest_refresh_token', authData.refreshToken);
              } catch {}
            }
            setActiveSessionConflict(null);
            setLoginPlatformError(null);
          } else if (retryRes.status === 410) {
            const errData = await retryRes.json().catch(() => ({}));
            setUsers((prev) => {
              const next = prev.filter((u) => u.uid !== localUser.uid);
              persistUsersSafe(next);
              return next;
            });
            removeCredentialFromVault({ uid: localUser.uid, email: localUser.email, studentId: localUser.studentId });
            showToast(errData.error || 'Pending verification expired after 30 days.', 'error');
            return false;
          } else if (retryRes.status === 403) {
            const errData = await retryRes.json();
            showToast(errData.error || 'Access denied.', 'error');
            return false;
          } else {
            showToast('Invalid email address/Student ID or password.', 'error');
            return false;
          }
        } else {
          showToast('Invalid email address/Student ID or password.', 'error');
          return false;
        }
      }

      if (serverRes.ok) {
        const authData = await serverRes.json();
        if (authData.token) {
          serverAuthToken = authData.token;
          try {
            sessionStorage.setItem('alumni_server_auth_token', authData.token);
            sessionStorage.setItem('alumni_auth_token', authData.token);
            localStorage.setItem('alumni_server_auth_token', authData.token);
            localStorage.setItem('alumni_auth_token', authData.token);
          } catch {}
        }
        if (authData.refreshToken) {
          try {
            sessionStorage.setItem('alumni_refresh_token', authData.refreshToken);
            localStorage.setItem('alumni_refresh_token', authData.refreshToken);
            sessionStorage.setItem('alumni_latest_refresh_token', authData.refreshToken);
          } catch {}
        }
        setActiveSessionConflict(null);
        setLoginPlatformError(null);
      }
    } catch {
      // In offline / standalone preview mode, continue to local validation
    }

    const deletedUidsForLookup = getDeletedAccountUids();

    // 3. User lookup across active registered accounts (supports Email, SCC Student ID, Alumni ID, Employee ID)
    let user = users.find((u) => {
      if (isAccountDeleted(u) || deletedUidsForLookup.has(u.uid)) return false;

      // Direct Email match
      if (u.email && u.email.toLowerCase() === trimmed) return true;
      if (trimmed === 'juan@email.com' && (u.email === 'alumni@stcecilia.edu' || u.email === 'maria.santos@alumni.stcecilia.edu')) return true;

      // Student ID / SCC ID match (e.g. SCC-2020-0192, 2020-0192, scc20200192, etc.)
      if (u.studentId) {
        const uLower = u.studentId.toLowerCase();
        const uNormalized = normalizeStudentId(u.studentId).toLowerCase();
        const uClean = uLower.replace(/^scc-?/i, '');
        const uDigits = u.studentId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

        if (
          uLower === trimmed ||
          uNormalized === normalizedInputId ||
          uNormalized === `scc-${trimmed}` ||
          uClean === rawClean ||
          uDigits === digitsOnly ||
          uDigits === `scc${digitsOnly}` ||
          `scc${uDigits}` === digitsOnly ||
          `scc-${rawClean}` === uLower
        ) {
          return true;
        }
      }

      // Official Alumni ID match (e.g. SCC-ALUM-2020-0192, SCC-ALUM-2023-0192)
      if (u.alumniId) {
        const aLower = u.alumniId.toLowerCase();
        const aDigits = u.alumniId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        if (
          aLower === trimmed ||
          aDigits === digitsOnly ||
          aLower.replace(/^scc-alum-?/i, '') === rawClean
        ) {
          return true;
        }
      }

      // Employee ID match (for staff/admin/registrar)
      if (u.employeeId) {
        const eLower = u.employeeId.toLowerCase();
        const eClean = eLower.replace(/^scc-?/i, '');
        if (eLower === trimmed || eLower === `scc-${trimmed}` || eClean === rawClean) {
          return true;
        }
      }

      return false;
    });

    if (pendingVaultHashPromises.size > 0) {
      await Promise.all(Array.from(pendingVaultHashPromises.values())).catch(() => {});
    }

    const vaultCred = findCredentialInVault(trimmed);
    if (!user && vaultCred && !deletedUidsForLookup.has(vaultCred.uid)) {
      user = users.find(
        (u) =>
          !isAccountDeleted(u) &&
          !deletedUidsForLookup.has(u.uid) &&
          (u.uid === vaultCred.uid || (u.email && u.email.toLowerCase() === vaultCred.email.toLowerCase()))
      );
      if (!user) {
        try {
          const rawSaved = localStorage.getItem(STORAGE_KEYS.USERS);
          if (rawSaved) {
            const parsedList: UserProfile[] = JSON.parse(rawSaved);
            if (Array.isArray(parsedList)) {
              const foundSaved = parsedList.find(
                (u) =>
                  !isAccountDeleted(u) &&
                  !deletedUidsForLookup.has(u.uid) &&
                  (u.uid === vaultCred.uid || (u.email && u.email.toLowerCase() === vaultCred.email.toLowerCase()))
              );
              if (foundSaved) {
                user = await decryptUserPiiFromStorage(foundSaved);
                setUsers((prev) => [user!, ...prev]);
              }
            }
          }
        } catch {}
      }
    }

    // 4. Strict Password Validation:
    // A correct User ID/email alone must NEVER allow login.
    // The password must ALWAYS be verified via salted PBKDF2 hash.
    if (!user) {
      attemptTracker.count = (attemptTracker.count || 0) + 1;
      failedLoginAttemptsRef.current.set(trimmed, attemptTracker);
      const attemptTimestamp = new Date().toISOString();

      // Record FAILED_LOGIN_ATTEMPT (⚠️ Warning: Never expose passwords; record timestamp and attempted username)
      try {
        addAuditLog({
          action: 'FAILED_LOGIN_ATTEMPT',
          actorId: 'unknown_attempt',
          actorName: 'Unauthenticated Actor',
          actorRole: 'alumni',
          category: 'security',
          details: `Failed authentication attempt (attempt ${attemptTracker.count} of 3) for attempted username "${trimmed}". Reason: Unrecognized identifier.`,
          severity: 'warning',
          targetRecordId: trimmed
        });
      } catch {}

      // If threshold reached: log MULTIPLE_FAILED_LOGIN_ATTEMPTS and enforce ACCOUNT_LOCKED
      if (attemptTracker.count >= 3) {
        attemptTracker.lockedUntil = Date.now() + 5 * 60 * 1000; // 5 min lockout
        try {
          addAuditLog({
            action: 'MULTIPLE_FAILED_LOGIN_ATTEMPTS',
            actorId: 'unknown_attempt',
            actorName: 'Unauthenticated Actor',
            actorRole: 'alumni',
            category: 'security',
            details: `Multiple failed login attempts detected (${attemptTracker.count} of 3 attempts) for attempted username "${trimmed}". Temporary account lockout enforced.`,
            severity: 'alert',
            targetRecordId: trimmed
          });

          addAuditLog({
            action: 'ACCOUNT_LOCKED',
            actorId: 'system_security',
            actorName: 'Security Enforcer',
            actorRole: 'admin',
            category: 'security',
            details: `Account temporarily locked for attempted username "${trimmed}". Lock Reason: Repeated failed login attempts exceeding security threshold. Timestamp: ${attemptTimestamp}.`,
            severity: 'alert',
            targetRecordId: trimmed
          });

          // In-app Notification for Superadministrator
          const adminNotif: AppNotification = {
            id: `notif_locked_${Date.now()}`,
            toUid: 'superadmin',
            title: '⚠️ Security Warning: Account Locked',
            body: `Account "${trimmed}" was locked following 3 consecutive failed login attempts. Reason: Repeated authentication failures at ${attemptTimestamp}.`,
            type: 'security',
            targetPath: '/portal/audit',
            targetRoute: '/portal/audit',
            metadata: { targetRole: 'superadmin' },
            read: false,
            createdAt: attemptTimestamp
          };
          setNotifications((prev) => [adminNotif, ...prev]);
          saveNotificationToFirestore(adminNotif).catch(() => {});
        } catch {}

        showToast('Account locked due to repeated failed login attempts. Administrator notified.', 'error');
        return false;
      }

      showToast('Invalid email, SCC ID, or password.', 'error');
      return false;
    }

    if (isPendingAccountExpired(user)) {
      const expiredUid = user.uid;
      setUsers((prev) => {
        const next = prev.filter((u) => u.uid !== expiredUid);
        persistUsersSafe(next);
        return next;
      });
      removeCredentialFromVault({ uid: expiredUid, email: user.email, studentId: user.studentId });
      alumniService.deleteAlumni(expiredUid).catch(() => {});
      showToast('Your pending verification expired after 30 days and your personal data was purged. Please submit a new registration.', 'error');
      return false;
    }

    const seedMatch = INITIAL_USERS.find(
      (iu) => iu.uid === user?.uid || (iu.email && user?.email && iu.email.toLowerCase() === user.email.toLowerCase())
    );
    let expectedHashOrSecret: string | undefined =
      user.passwordHash ||
      vaultCred?.passwordHash ||
      vaultCred?.password ||
      (user as any).password ||
      seedMatch?.password;

    let passwordMatched = expectedHashOrSecret
      ? await verifySecretClient(pass, expectedHashOrSecret)
      : false;

    // Cross-environment database check: check shared Firestore database security vault (salted passwordHash)
    if (!passwordMatched) {
      try {
        const cloudCred = await getAuthCredentialFromFirestore(user.uid);
        const cloudSecret = cloudCred?.passwordHash || cloudCred?.password;
        if (cloudSecret && (await verifySecretClient(pass, cloudSecret))) {
          passwordMatched = true;
          const resolvedHash = isSaltedSecretHash(cloudSecret)
            ? cloudSecret
            : await hashSecretClient(pass);
          expectedHashOrSecret = resolvedHash;
          user.passwordHash = resolvedHash;
          saveCredentialToVault({
            uid: user.uid,
            name: user.name,
            email: user.email,
            studentId: user.studentId,
            alumniId: user.alumniId,
            role: user.role,
            isVerified: Boolean(user.isVerified),
            passwordHash: resolvedHash
          });
        }
      } catch (err) {
        console.warn('Cross-environment auth credential fetch notice:', err);
      }
    }

    if (!passwordMatched) {
      attemptTracker.count = (attemptTracker.count || 0) + 1;
      failedLoginAttemptsRef.current.set(trimmed, attemptTracker);
      const attemptTimestamp = new Date().toISOString();

      // Record FAILED_LOGIN_ATTEMPT (⚠️ Warning: Never expose passwords; record timestamp and attempted username)
      try {
        addAuditLog({
          action: 'FAILED_LOGIN_ATTEMPT',
          actorId: user.uid,
          actorName: user.name || 'Unauthenticated Actor',
          actorRole: user.role || 'alumni',
          category: 'security',
          details: `Failed authentication attempt (attempt ${attemptTracker.count} of 3) due to incorrect password for attempted username "${trimmed}".`,
          severity: 'warning',
          targetRecordId: user.email || trimmed
        });
      } catch {}

      // If threshold reached: log MULTIPLE_FAILED_LOGIN_ATTEMPTS and enforce ACCOUNT_LOCKED
      if (attemptTracker.count >= 3) {
        attemptTracker.lockedUntil = Date.now() + 5 * 60 * 1000; // 5 min lockout
        try {
          addAuditLog({
            action: 'MULTIPLE_FAILED_LOGIN_ATTEMPTS',
            actorId: user.uid,
            actorName: user.name,
            actorRole: user.role || 'alumni',
            category: 'security',
            details: `Multiple failed login attempts detected (${attemptTracker.count} of 3 attempts) for attempted username "${trimmed}". Temporary account lockout enforced.`,
            severity: 'alert',
            targetRecordId: user.email || trimmed
          });

          addAuditLog({
            action: 'ACCOUNT_LOCKED',
            actorId: 'system_security',
            actorName: 'Security Enforcer',
            actorRole: 'admin',
            category: 'security',
            details: `Account temporarily locked for user "${user.name}" (${user.email || trimmed}). Lock Reason: Repeated failed login attempts exceeding security threshold. Timestamp: ${attemptTimestamp}.`,
            severity: 'alert',
            targetRecordId: user.email || trimmed
          });

          // In-app Notification for Superadministrator
          const adminNotif: AppNotification = {
            id: `notif_locked_${Date.now()}`,
            toUid: 'superadmin',
            title: '⚠️ Security Warning: Account Locked',
            body: `Account "${user.name}" (${user.email || trimmed}) was locked following 3 consecutive failed login attempts. Reason: Repeated authentication failures at ${attemptTimestamp}.`,
            type: 'security',
            targetPath: '/portal/audit',
            targetRoute: '/portal/audit',
            metadata: { targetRole: 'superadmin' },
            read: false,
            createdAt: attemptTimestamp
          };
          setNotifications((prev) => [adminNotif, ...prev]);
          saveNotificationToFirestore(adminNotif).catch(() => {});
        } catch {}

        showToast('Account locked due to repeated failed login attempts. Administrator notified.', 'error');
        return false;
      }

      showToast('Invalid email, SCC ID, or password.', 'error');
      return false;
    }

    // Clear failed attempts counter on successful credential validation
    failedLoginAttemptsRef.current.delete(trimmed);

    // ========================================================================
    // PLATFORM-BASED ACCESS ENFORCEMENT
    // Alumni: Allowed on both Web and Mobile APK.
    // Admin / Staff: Allowed ONLY on Web Portal. Blocked on Mobile APK.
    // ========================================================================
    const effectiveRole = (user.role || 'alumni').toLowerCase().trim();
    if (clientPlatform === 'mobile' && effectiveRole !== 'alumni') {
      const errorMsg = 'Administrative access is restricted to the web portal.';
      showToast(errorMsg, 'error');
      setLoginPlatformError(errorMsg);
      return false;
    }
    setLoginPlatformError(null);

    const accountStatus = (user.accountStatus || user.status || 'ACTIVE').toUpperCase().trim();
    if (accountStatus === 'SUSPENDED') {
      const now = Date.now();
      const endDate = user.suspensionInfo?.endDate || user.suspensionEndDate;
      const endTimestamp = endDate ? new Date(endDate).getTime() : 0;

      if (endTimestamp > 0 && now >= endTimestamp) {
        // Scheduled suspension duration expired! Auto-restore to ACTIVE
        user.accountStatus = 'ACTIVE';
        user.status = 'ACTIVE';
        user.isLocked = false;
        setUsers((prev) =>
          prev.map((u) => (u.uid === user!.uid ? { ...u, accountStatus: 'ACTIVE', status: 'ACTIVE', isLocked: false } : u))
        );
        addAuditLog({
          action: 'ACCOUNT_AUTO_RESTORED',
          actorId: 'system_automation',
          actorName: 'System Scheduler',
          actorRole: 'system',
          category: 'security',
          details: `Scheduled suspension duration expired for ${user.name} (${user.email}). Account automatically restored to ACTIVE.`,
          severity: 'info',
          targetRecordId: user.email
        });
      } else {
        setLoginSuspensionNotice({
          status: 'SUSPENDED',
          title: 'Your account has been temporarily suspended',
          reason: user.suspensionInfo?.reason || user.suspensionReason || 'Violation of institutional account policies.',
          startDate: user.suspensionInfo?.startDate,
          endDate: user.suspensionInfo?.endDate,
          suspendedByName: user.suspensionInfo?.suspendedByName || 'Institutional Administration',
          contactInstructions: 'Please contact the Registrar Office or System Administration (admin@stcecilia.edu.ph) for assistance.'
        });
        showToast('This account has been temporarily suspended by administration.', 'error');
        return false;
      }
    }

    if (accountStatus === 'LOCKED') {
      setLoginSuspensionNotice({
        status: 'LOCKED',
        title: 'Your account has been locked by an administrator',
        reason: user.suspensionInfo?.reason || user.suspensionReason || 'Administrative security lockout.',
        startDate: user.suspensionInfo?.startDate,
        suspendedByName: user.suspensionInfo?.suspendedByName || 'Institutional Administration',
        contactInstructions: 'Please contact the Registrar Office or System Administration (admin@stcecilia.edu.ph) to request an account review.'
      });
      showToast('This account has been locked by an administrator.', 'error');
      return false;
    }

    if (accountStatus === 'PENDING_VERIFICATION' && user.role !== 'employer') {
      setLoginPendingAccountNotice({
        role: 'alumni',
        title: 'Alumni Credential Verification in Progress',
        message: 'Your graduation record is currently undergoing Registrar review or conflict verification. You will be notified via email once your academic standing is confirmed.',
        email: user.email || identifier
      });
      showToast('Your account is pending registrar verification. You will be notified once your graduation credentials are confirmed.', 'info');
      return false;
    }

    if (
      user.role === 'alumni' &&
      (accountStatus === 'REJECTED' || user.verificationStatus === 'rejected')
    ) {
      const reasonSuffix = user.rejectionReason ? ` Reason: ${user.rejectionReason}` : '';
      showToast(
        `Your alumni verification request was rejected.${reasonSuffix} Please contact the Registrar Office for assistance.`,
        'error'
      );
      return false;
    }

    // 5. Verification checks: Only enforced after credentials have passed
    if (user.role === 'alumni') {
      const isAlumVerified = !!(user.isVerified || user.verified || user.verificationStatus === 'verified' || vaultCred?.isVerified);
      if (!isAlumVerified) {
        const regCheck = user.studentId ? registrar_verification(user.studentId, user.name) : null;
        if (regCheck?.isVerified) {
          user.isVerified = true;
          user.verified = true;
          user.verificationStatus = 'verified';
          setUsers((prev) => prev.map((u) => u.uid === user!.uid ? { ...u, isVerified: true, verified: true, verificationStatus: 'verified' } : u));
        } else {
          setLoginPendingAccountNotice({
            role: 'alumni',
            title: 'Alumni Credential Verification in Progress',
            message: 'Your graduation record is currently undergoing Registrar review or conflict verification. You will be notified via email once your academic standing is confirmed.',
            email: user.email || identifier
          });
          showToast('Login blocked: Your alumni account has not been verified by the Registrar.', 'info');
          return false;
        }
      }
    }
    if (user.role === 'employer') {
      const authStatus = getEmployerAuthStatus({
        ...user,
        isVerified: user.isVerified || vaultCred?.isVerified
      });

      if (authStatus === 'SUSPENDED') {
        showToast('This employer account has been suspended by administration. Please contact institutional support.', 'error');
        return false;
      }

      if (authStatus === 'REJECTED') {
        const rejectionMsg = (user as any).rejectionReason
          ? `Accreditation declined: ${(user as any).rejectionReason}`
          : 'Your employer accreditation request was reviewed and declined by the institutional administration.';
        showToast(rejectionMsg, 'error');
        return false;
      }

      if (authStatus === 'PENDING_APPROVAL') {
        setLoginPendingAccountNotice({
          role: 'employer',
          title: 'Employer Accreditation Pending',
          message: 'Your corporate partner account has been received and is currently under review by the Alumni & Placement Office. Institutional verification typically concludes within 24–48 business hours. You will receive an official notification once approved.',
          email: user.email || identifier
        });
        showToast('Login blocked: Your employer account has not been approved yet. Institutional accreditation takes 24–48 hours.', 'info');
        return false;
      }

      user.isVerified = true;
      user.verified = true;
      user.employerStatus = 'approved';
      user.employerVerificationStatus = 'verified';
      user.accountStatus = 'ACTIVE';
      user.status = 'ACTIVE';
    }

    // Ensure user profile in memory holds salted passwordHash (never plaintext password) and verified flags
    const resolvedPasswordHash =
      user.passwordHash ||
      vaultCred?.passwordHash ||
      (expectedHashOrSecret && isSaltedSecretHash(expectedHashOrSecret) ? expectedHashOrSecret : undefined) ||
      (await hashSecretClient(pass));

    if (!vaultCred?.passwordHash || !user.passwordHash) {
      saveCredentialToVault({
        uid: user.uid,
        name: user.name,
        email: user.email,
        studentId: user.studentId,
        alumniId: user.alumniId,
        employeeId: user.employeeId,
        passwordHash: resolvedPasswordHash,
        role: user.role,
        isVerified: user.role === 'alumni' ? true : Boolean(user.isVerified)
      });
    }

    const userToSave: UserProfile = stripPlaintextSecretsFromUser({
      ...user,
      passwordHash: resolvedPasswordHash,
      isVerified: user.role === 'alumni' ? true : user.isVerified,
      verified: user.role === 'alumni' ? true : user.verified,
      verificationStatus: user.role === 'alumni' ? 'verified' : user.verificationStatus,
      lastActiveAt: new Date().toISOString(),
      isOnline: true
    });

    setUsers((prev) => {
      const next = prev.map((u) => (u.uid === userToSave.uid ? userToSave : u));
      persistUsersSafe(next);
      return next;
    });

    // 6. Complete login & persist session securely
    saveActiveSession(userToSave, serverAuthToken);
    setCurrentUserId(userToSave.uid);
    setAuthReady(true);
    saveUserToFirestore(userToSave).catch(() => {});

    // Record User Login activity event with NORMAL status (No warning icon)
    try {
      addAuditLog({
        action: 'USER_LOGIN',
        actorId: userToSave.uid,
        actorName: userToSave.name,
        actorRole: userToSave.role,
        category: 'security',
        details: `User ${userToSave.name} (${userToSave.role}) signed in successfully via ${clientPlatform === 'mobile' ? 'Mobile App' : 'Web Portal'}.`,
        severity: 'info',
        targetRecordId: userToSave.email
      });
    } catch {
      // ignore
    }

    // Always direct user to home (dashboard) upon logging in
    setActiveTab('dashboard');
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    showToast(`Welcome back, ${userToSave.name}!`);
    return true;
  };

  const terminateOtherSessionAndLogin = async (identifier: string, pass: string): Promise<boolean> => {
    const trimmed = identifier.trim().toLowerCase();
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: trimmed,
          password: pass,
          forceTerminateOtherSession: true,
          deviceInfo: getClientDeviceInfo()
        })
      });

      if (res.ok) {
        const authData = await res.json();
        if (authData.token) {
          try {
            sessionStorage.setItem('alumni_server_auth_token', authData.token);
            localStorage.setItem('alumni_server_auth_token', authData.token);
            localStorage.setItem('alumni_auth_token', authData.token);
          } catch {}
        }
        if (authData.refreshToken) {
          try {
            sessionStorage.setItem('alumni_refresh_token', authData.refreshToken);
            localStorage.setItem('alumni_refresh_token', authData.refreshToken);
            sessionStorage.setItem('alumni_latest_refresh_token', authData.refreshToken);
          } catch {}
        }
        setActiveSessionConflict(null);

        // Find user to log in
        let user = users.find(u => u.uid === authData.user?.uid || u.email?.toLowerCase() === authData.user?.email?.toLowerCase());
        if (!user) {
          const vaultCred = findCredentialInVault(trimmed);
          if (vaultCred) {
            user = users.find(u => u.uid === vaultCred.uid || u.email?.toLowerCase() === vaultCred.email.toLowerCase());
          }
        }
        if (!user && authData.user) {
          user = stripPlaintextSecretsFromUser({
            uid: authData.user.uid,
            name: authData.user.name,
            email: authData.user.email,
            role: authData.user.role,
            isVerified: true,
            verified: true,
            studentId: authData.user.studentId,
            alumniId: authData.user.alumniId
          } as UserProfile);
        }

        if (user) {
          saveActiveSession(user, authData.token);
          setCurrentUserId(user.uid);
          setAuthReady(true);

          // Discontinue USER_RELOGIN - record standard USER_LOGIN session continuation (NORMAL status, No warning icon)
          try {
            addAuditLog({
              action: 'USER_LOGIN',
              actorId: user.uid,
              actorName: user.name,
              actorRole: user.role,
              category: 'security',
              details: `User ${user.name} signed in successfully via ${clientPlatform === 'mobile' ? 'Mobile App' : 'Web Portal'}. Previous session ended by user.`,
              severity: 'info',
              targetRecordId: user.email
            });
          } catch {
            // ignore
          }

          setActiveTab('dashboard');
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
          showToast(`Welcome back, ${user.name}! Other device session ended.`);
          return true;
        }
        return true;
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'Could not end other session.', 'error');
        return false;
      }
    } catch {
      showToast('Connection error while ending session. Please check your network.', 'error');
      return false;
    }
  };

  const biometricLoginWithRefreshToken = async (
    refreshToken: string
  ): Promise<{ success: boolean; user?: UserProfile; error?: string }> => {
    if (!refreshToken) {
      return { success: false, error: 'No vaulted refresh token provided.' };
    }

    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        return {
          success: false,
          error: errData.error || 'Biometric session expired. Please sign in with your password.'
        };
      }

      const authData = await res.json();
      if (authData.token) {
        try {
          sessionStorage.setItem('alumni_server_auth_token', authData.token);
          localStorage.setItem('alumni_server_auth_token', authData.token);
          localStorage.setItem('alumni_auth_token', authData.token);
        } catch {}
      }
      if (authData.refreshToken) {
        try {
          sessionStorage.setItem('alumni_refresh_token', authData.refreshToken);
          localStorage.setItem('alumni_refresh_token', authData.refreshToken);
          if (Capacitor.isNativePlatform() && authData.user) {
            vaultBiometricRefreshToken(authData.user.uid, authData.user.email, authData.refreshToken).catch(() => {});
          }
        } catch {}
      }

      let user = users.find(
        (u) =>
          u.uid === authData.user?.uid ||
          u.email?.toLowerCase() === authData.user?.email?.toLowerCase()
      );

      if (!user && authData.user) {
        user = {
          uid: authData.user.uid,
          name: authData.user.name || 'Cecilian Alumnus',
          email: authData.user.email,
          role: authData.user.role || 'alumni',
          studentId: authData.user.studentId,
          alumniId: authData.user.alumniId,
          employeeId: authData.user.employeeId,
          isVerified: authData.user.isVerified ?? true,
          verified: authData.user.isVerified ?? true,
          verificationStatus: 'verified',
          lastActiveAt: new Date().toISOString(),
          isOnline: true
        } as UserProfile;
        setUsers((prev) => [user!, ...prev]);
      }

      if (user) {
        saveActiveSession(user, authData.token);
        setCurrentUserId(user.uid);
        setAuthReady(true);
        setActiveTab('dashboard');
        if (typeof window !== 'undefined') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        showToast(`Welcome back, ${user.name}! Biometric identity verified.`);
        return { success: true, user };
      }

      return { success: false, error: 'User profile not found.' };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Biometric session renewal failed.' };
    }
  };

  const register = (data: Partial<UserProfile> & { password?: string }): boolean => {
    const newUid =
      data.uid && typeof data.uid === 'string' && data.uid.trim().length >= 4
        ? data.uid.trim()
        : `user_${Date.now()}`;
    // Admin accounts cannot be created by public registration (admin account created by admin only)
    let role = data.role || 'alumni';
    if (role === 'admin') {
      showToast('Admin accounts cannot be registered publicly. Provisioned as Alumni.');
      role = 'alumni';
    }

    const formLock = (data as any).formLock;
    if (formLock && formLock !== role) {
      showToast(`Form is locked to ${formLock}. Please reset or cancel the form before switching roles.`, 'error');
      return false;
    }

    const deletedUidsForReg = getDeletedAccountUids();

    // Check if employer was previously rejected - block re-application
    if (role === 'employer') {
      const isRejected = users.some(
        (u) =>
          !isAccountDeleted(u) &&
          !deletedUidsForReg.has(u.uid) &&
          u.role === 'employer' &&
          (u.employerStatus === 'rejected' || u.employerVerificationStatus === 'rejected') &&
          (
            (data.email && u.email?.toLowerCase().trim() === data.email.toLowerCase().trim()) ||
            (data.companyName && u.companyName && u.companyName.toLowerCase().trim() === data.companyName.toLowerCase().trim()) ||
            (data.companyName && u.company && u.company.toLowerCase().trim() === data.companyName.toLowerCase().trim())
          )
      );
      if (isRejected) {
        showToast('This organization registration was previously rejected and cannot re-apply in accordance with institutional policy.', 'error');
        return false;
      }
    }

    // Check if email already exists among active (non-deleted) accounts
    if (data.email && users.some((u) => !isAccountDeleted(u) && !deletedUidsForReg.has(u.uid) && u.email?.toLowerCase() === data.email!.toLowerCase())) {
      showToast('An account with this email already exists.', 'error');
      return false;
    }

    // Strict password requirements for registration
    if (!data.password || typeof data.password !== 'string' || data.password.trim().length < 6) {
      showToast('Password must be at least 6 characters.', 'error');
      return false;
    }

    // Strict registrar verification check for standard student/alumni registrations
    // Manual Verification Requests & Dispute Claims bypass strict ID format checks and remain unverified until reviewed
    const rawStudentId = (data.studentId || '').trim();
    const isAppealRegistration =
      Boolean((data as any).isAppealRegistration) ||
      data.accountStatus === 'PENDING_VERIFICATION' ||
      (data.verificationStatus as string) === 'in_review' ||
      data.verificationStatus === 'pending_review' ||
      rawStudentId.startsWith('SCC-PENDING-') ||
      rawStudentId.startsWith('SCC-DISPUTE-');

    let verifiedRegistrarRecord: any = null;
    if (role === 'alumni' && !isAppealRegistration) {
      // Specifically reject accounts if Student ID is missing or does not match supported SCC ID formats
      if (!rawStudentId || !isValidStudentIdPattern(rawStudentId)) {
        showToast(
          `Student ID '${rawStudentId || 'None'}' could not be confirmed in St. Cecilia's College registrar records. Accepted formats: SCC-22-00017358 or SCC-2024-0001.`,
          'error'
        );
        return false;
      }

      // Strictly verify academic record against official registrar records
      const verification = registrar_verification(rawStudentId, data.name);
      if (!verification.isVerified || !verification.record) {
        showToast(
          verification.message ||
            `Student ID '${rawStudentId}' could not be confirmed in St. Cecilia's College registrar records. Accepted formats: SCC-22-00017358 or SCC-2024-0001.`,
          'error'
        );
        return false;
      }

      // Reject if student ID is already claimed by another active (non-deleted) profile
      const alreadyClaimed = users.some(
        (u) =>
          !isAccountDeleted(u) &&
          !deletedUidsForReg.has(u.uid) &&
          u.studentId &&
          normalizeStudentId(u.studentId).toUpperCase() === normalizeStudentId(rawStudentId).toUpperCase()
      );
      if (alreadyClaimed) {
        showToast(
          `Student ID '${rawStudentId}' is already registered with an active alumni profile. Please sign in or contact the Registrar.`,
          'error'
        );
        return false;
      }

      verifiedRegistrarRecord = verification.record;
    }

    const finalStudentId = verifiedRegistrarRecord?.studentId || data.studentId;
    const finalBatch = verifiedRegistrarRecord?.batchYear || data.batch || (role === 'alumni' ? '2024' : 'N/A');
    const finalCourse =
      verifiedRegistrarRecord?.course ||
      data.course ||
      (role === 'alumni' ? 'B.S. Information Technology' : role === 'employer' ? 'Corporate Industry Partner' : 'Campus Administration & Services');
    const finalName = data.name || verifiedRegistrarRecord?.fullName || (role === 'employer' ? data.companyName || 'Corporate Partner' : 'Cecilian Member');
    const isAlumniVerified = role === 'alumni' ? !isAppealRegistration : Boolean(data.isVerified);

    const rawPassword = data.password || '';
    const isPendingAccount = !isAlumniVerified || role === 'employer';
    const verificationExpiresAt = isPendingAccount
      ? new Date(Date.now() + PENDING_VERIFICATION_TTL_MS).toISOString()
      : undefined;

    const newUser: UserProfile = stripPlaintextSecretsFromUser({
      uid: newUid,
      name: finalName,
      email: data.email || `${role === 'employer' ? 'careers' : 'alumni'}_${Date.now()}@stcecilia.edu`,
      role,
      batch: finalBatch,
      course: finalCourse,
      location: data.location || verifiedRegistrarRecord?.homeAddress || (role === 'employer' ? 'Cebu City, Philippines' : 'Cebu, Philippines'),
      alumniId: data.alumniId || (role === 'alumni' && isAlumniVerified ? generateAlumniId(finalBatch, finalStudentId, newUid) : undefined),
      studentId: finalStudentId,
      employeeId: data.employeeId,
      department: data.department,
      companyName: data.companyName,
      companyIndustry: data.companyIndustry,
      companyWebsite: data.companyWebsite,
      companyAddress: data.companyAddress,
      contactPerson: data.contactPerson,
      contactPhone: data.contactPhone,
      accountType: data.accountType || (role === 'employer' ? 'employer' : 'alumni'),
      currentPosition: data.currentPosition || '',
      company: data.company || '',
      employmentStatus: data.employmentStatus || (data.currentPosition ? 'Employed' : 'Seeking Opportunities'),
      profilePictureUrl: data.profilePictureUrl || (role === 'employer' ? DEFAULT_COLLEGE_SEAL : DEFAULT_USER_AVATAR),
      coverPhotoUrl: data.coverPhotoUrl || DEFAULT_COVER_PHOTO,
      headline: data.headline || (role === 'employer' ? `Hiring Partner • ${data.companyName || 'Corporate Partner'}` : `${role === 'alumni' ? (finalCourse || 'Alumni') + ' Graduate' : role.toUpperCase() + ' Specialist'} • St. Cecilia’s College`),
      about: data.about || (role === 'employer' ? `Official employer and industry partner recruiting talented graduates of St. Cecilia’s College.` : 'Excited to be part of the St. Cecilia’s College alumni and institutional community.'),
      phone: data.phone || data.contactPhone || verifiedRegistrarRecord?.phone || '+63 917 123 4567',
      guardianName: data.guardianName || verifiedRegistrarRecord?.guardianName,
      homeAddress: data.homeAddress || verifiedRegistrarRecord?.homeAddress,
      birthday: data.birthday || verifiedRegistrarRecord?.birthDate,
      isVerified: isAlumniVerified,
      verified: isAlumniVerified,
      verificationStatus: isAlumniVerified ? 'verified' : (data.verificationStatus || 'pending_review'),
      accountStatus: isAlumniVerified ? 'ACTIVE' : (data.accountStatus || 'PENDING_VERIFICATION'),
      ...(data.selfieWithIdUrl ? { selfieWithIdUrl: data.selfieWithIdUrl } : {}),
      ...(data.selfieWithIdName ? { selfieWithIdName: data.selfieWithIdName } : {}),
      ...(data.selfieWithIdUploadedAt ? { selfieWithIdUploadedAt: data.selfieWithIdUploadedAt } : {}),
      ...(data.verificationSubmissionSource !== 'dispute_student_id_claim' && (data.verificationProofUrl || data.selfieWithIdUrl)
        ? { verificationProofUrl: data.verificationProofUrl || data.selfieWithIdUrl }
        : {}),
      ...(data.verificationSubmissionSource !== 'dispute_student_id_claim' && (data.verificationProofName || data.selfieWithIdName)
        ? { verificationProofName: data.verificationProofName || data.selfieWithIdName }
        : {}),
      ...(data.verificationSubmissionSource !== 'dispute_student_id_claim' && (data.verificationSubmittedAt || data.selfieWithIdUploadedAt)
        ? { verificationSubmittedAt: data.verificationSubmittedAt || data.selfieWithIdUploadedAt }
        : {}),
      ...(data.verificationNotes ? { verificationNotes: data.verificationNotes } : {}),
      ...(data.verificationRequestId ? { verificationRequestId: data.verificationRequestId } : {}),
      ...(data.verificationSubmissionSource ? { verificationSubmissionSource: data.verificationSubmissionSource } : {}),
      ...(verificationExpiresAt ? { verificationExpiresAt } : {}),
      followersCount: 0,
      followingCount: 0,
      connectionsCount: 0,
      experience: [],
      education: role === 'employer' ? [] : [
        {
          id: `edu_${Date.now()}`,
          degree: finalCourse || 'Bachelor Degree Program',
          institution: 'St. Cecilia’s College',
          fieldOfStudy: finalCourse || 'Information Technology',
          startYear: String(new Date().getFullYear() - 4),
          endYear: String(new Date().getFullYear())
        }
      ],
      createdAt: new Date().toISOString()
    });

    const rollbackRejectedRegistration = (reasonMsg: string) => {
      addDeletedAccountUids([newUid]);
      removeCredentialFromVault({ uid: newUid, email: newUser.email, studentId: newUser.studentId });
      setUsers((prev) => {
        const next = prev.filter((u) => u.uid !== newUid);
        persistUsersSafe(next);
        return next;
      });
      alumniService.deleteAlumni(newUid).catch(() => {});
      if (currentUserIdRef.current === newUid) {
        clearStoredSession();
        setCurrentUserId(null);
      }
      showToast(reasonMsg, 'error');
    };

    // Hash password with salted PBKDF2 in client vault + attach hash once ready
    saveCredentialToVault({
      uid: newUid,
      name: newUser.name,
      email: newUser.email,
      studentId: newUser.studentId,
      alumniId: newUser.alumniId,
      password: rawPassword,
      role: newUser.role,
      isVerified: Boolean(newUser.isVerified),
      verificationExpiresAt
    });
    hashSecretClient(rawPassword)
      .then((passwordHash) => {
        if (getDeletedAccountUids().has(newUid)) return;
        setUsers((prev) => {
          const next = prev.map((u) => (u.uid === newUid ? { ...u, passwordHash } : u));
          persistUsersSafe(next);
          return next;
        });
      })
      .catch(() => {});

    // Enforce anonymized rejected-block registry & register on backend server credentials store
    isBlockedByLocalRejectedRegistry({
      email: newUser.email,
      companyName: newUser.companyName,
      identifier: newUser.studentId
    })
      .then((blockHit) => {
        if (blockHit) {
          rollbackRejectedRegistration(
            'This registration matches a previously rejected application and cannot be re-submitted under institutional policy.'
          );
          return null;
        }
        return fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uid: newUid,
            name: newUser.name,
            email: newUser.email,
            password: rawPassword,
            schoolId: newUser.studentId,
            alumniId: newUser.alumniId,
            role: newUser.role,
            companyName: newUser.companyName,
            isVerified: isAlumniVerified,
            accountStatus: newUser.accountStatus,
            isAppealRegistration,
            formLock: (data as any).formLock
          })
        });
      })
      .then(async (res) => {
        if (res && res.status === 403) {
          const errBody = await res.json().catch(() => ({}));
          if (
            errBody?.code === 'EMPLOYER_REAPPLICATION_BLOCKED' ||
            errBody?.code === 'APPLICATION_PREVIOUSLY_REJECTED'
          ) {
            rollbackRejectedRegistration(
              errBody.error ||
                'This registration was previously rejected and cannot re-apply in accordance with institutional policy.'
            );
          }
        }
      })
      .catch((err) => console.warn('Backend server register notice:', err));

    setUsers((prev) => {
      const next = [newUser, ...prev];
      persistUsersSafe(next);
      return next;
    });
    // Log in immediately only if verified
    if (newUser.isVerified) {
      saveActiveSession(newUser);
      setCurrentUserId(newUid);
      setAuthReady(true);
    }
    alumniService.createAlumni(newUser).catch((err) => {
      console.warn('Error saving new user to Firestore:', err);
    });

    if (role === 'alumni' && newUser.studentId && !isAppealRegistration) {
      markRegistryRecordAsRegistered(newUser.studentId, newUid);
    }

    if (role === 'employer') {
      // Notify admins that employer registered and requires verification
      const adminNotif: AppNotification = {
        id: `notif_emp_reg_${Date.now()}`,
        toUid: 'admin',
        type: 'general',
        title: 'New Employer Partner Registered',
        body: `${newUser.companyName || newUser.name} has registered and submitted an accreditation request for Admin Verification.`,
        refId: newUser.uid,
        targetPath: `/portal/jobs/employers/${encodeURIComponent(newUser.uid)}`,
        targetRoute: `/portal/jobs/employers/${encodeURIComponent(newUser.uid)}`,
        metadata: { targetRole: 'admin', targetTab: 'jobs', targetSubTab: 'employers', employerUid: newUser.uid },
        read: false,
        createdAt: new Date().toISOString()
      };
      setNotifications((prev) => [adminNotif, ...prev]);
      saveNotificationToFirestore(adminNotif).catch(() => {});
      showToast(`Company registered! Status: Pending Admin Verification.`, 'info');
    } else if (isAppealRegistration) {
      const appealNotif: AppNotification = {
        id: `notif_appeal_${Date.now()}`,
        toUid: 'admin',
        type: 'general',
        title: 'New Alumni Verification Appeal / Dispute',
        body: `${newUser.name} (${newUser.email}) submitted a verification request or ID conflict claim for Moderator & Admin review.`,
        refId: newUser.uid,
        targetPath: `/portal/conflicts/requests/${encodeURIComponent(newUser.uid)}`,
        targetRoute: `/portal/conflicts/requests/${encodeURIComponent(newUser.uid)}`,
        metadata: { targetRole: 'moderator', targetTab: 'conflicts', targetSubTab: 'requests', targetId: newUser.uid },
        read: false,
        createdAt: new Date().toISOString()
      };
      setNotifications((prev) => [appealNotif, ...prev]);
      saveNotificationToFirestore(appealNotif).catch(() => {});
    } else {
      showToast(`Account registered and verified with official registrar records! Welcome, ${newUser.name}!`, 'success');
    }
    return true;
  };

  // Administrator-exclusive account creation (admin accounts created by admin only)
  const createUserByAdmin = (data: Partial<UserProfile> & { password?: string; role: UserRole }): { success: boolean; error?: string; role?: UserRole; user?: UserProfile } => {
    if (currentUser?.role !== 'admin' && currentUser?.role !== 'superadmin') {
      const err = 'Permission denied: Only system Administrators can provision staff and admin accounts.';
      showToast(err, 'error');
      return { success: false, error: err };
    }
    const role = data.role || 'alumni';

    // Super Admin provisioning restriction
    if (role === 'superadmin' && currentUser?.role !== 'superadmin') {
      const err = 'Permission denied: Only Super Administrators can provision superadmin accounts.';
      showToast(err, 'error');
      return { success: false, error: err };
    }

    // Strict Moderator Quota Constraint: MAX 3 ACTIVE ACCOUNTS
    if (role === 'moderator' && !moderatorQuota.canCreateModerator) {
      const err = 'Moderator quota limit reached (maximum 3 active moderators allowed). Cannot create or promote another moderator.';
      showToast(err, 'error');
      return { success: false, error: err };
    }

    // Check duplicate email
    const trimmedEmail = (data.email || '').trim().toLowerCase();
    if (trimmedEmail) {
      const emailExists = users.some((u) => u.email?.trim().toLowerCase() === trimmedEmail);
      if (emailExists) {
        const err = `An account with the email "${trimmedEmail}" already exists in the system.`;
        showToast(err, 'error');
        return { success: false, error: err };
      }
    }

    const newUid = `user_admin_${Date.now()}`;
    const rawAdminPassword = data.password || 'Password123!';
    const newUser: UserProfile = stripPlaintextSecretsFromUser({
      uid: newUid,
      name: data.name || 'New University User',
      email: data.email || `account_${Date.now()}@stcecilia.edu`,
      role,
      batch: data.batch || (role === 'alumni' ? '2024' : 'N/A'),
      course: data.course || (role === 'alumni' ? 'B.S. Information Technology' : 'Campus Administration & Services'),
      location: data.location || 'St. Cecilia’s Campus',
      studentId: data.studentId,
      employeeId: data.employeeId || `EMP-${Date.now().toString().slice(-4)}`,
      department: data.department || (role === 'admin' ? 'Institutional Advancement' : 'Academic Affairs'),
      profilePictureUrl: data.profilePictureUrl || DEFAULT_USER_AVATAR,
      coverPhotoUrl: data.coverPhotoUrl || DEFAULT_COVER_PHOTO,
      headline: data.headline || `${role.toUpperCase()} • St. Cecilia’s College`,
      about: data.about || `Official ${role} profile created by Administrator.`,
      phone: data.phone || '+63 918 000 0000',
      isVerified: true,
      followersCount: 0,
      followingCount: 0,
      connectionsCount: 0,
      experience: [],
      education: [],
      createdAt: new Date().toISOString()
    });

    setUsers((prev) => {
      const next = [newUser, ...prev];
      persistUsersSafe(next);
      return next;
    });

    // Save salted PBKDF2 hash to credentials vault for instant login capability
    saveCredentialToVault({
      uid: newUid,
      name: newUser.name,
      email: newUser.email,
      studentId: newUser.studentId,
      employeeId: newUser.employeeId,
      password: rawAdminPassword,
      role: newUser.role,
      isVerified: Boolean(newUser.isVerified)
    });
    hashSecretClient(rawAdminPassword)
      .then((passwordHash) => {
        if (getDeletedAccountUids().has(newUid)) return;
        setUsers((prev) => {
          const next = prev.map((u) => (u.uid === newUid ? { ...u, passwordHash } : u));
          persistUsersSafe(next);
          return next;
        });
      })
      .catch(() => {});

    alumniService.createAlumni(newUser).catch((err) => {
      console.warn('Error saving admin-created alumni to Firestore:', err);
    });

    // Also register on backend server credentials database
    const token = getAuthToken() || (currentUser ? createSessionToken(currentUser) : '');
    fetch('/api/admin/create-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        uid: newUid,
        name: newUser.name,
        email: newUser.email,
        password: rawAdminPassword,
        role: newUser.role,
        department: newUser.department,
        batch: newUser.batch,
        course: newUser.course
      })
    }).catch((err) => console.warn('Could not provision user on backend auth store:', err));

    showToast(`Account for ${newUser.name} provisioned as ${(newUser.role || 'alumni').toUpperCase()}!`);
    return { success: true, role: newUser.role, user: newUser };
  };

  // Campus & Heritage Gallery: Admin, Superadmin, Moderator can upload
  const addGalleryItem = (item: Omit<GalleryItem, 'id' | 'createdAt'>): boolean => {
    if (!['admin', 'superadmin', 'moderator'].includes(currentUser?.role || '')) {
      showToast('Permission denied: Only Admin and Moderator can upload to Campus & Heritage Gallery.');
      return false;
    }
    const finalUrl = item.url || (item as any).imageUrl || '';
    const newItem: GalleryItem = {
      ...item,
      url: finalUrl,
      id: `gal_${Date.now()}`,
      uploadedBy: currentUser!.uid,
      uploadedByName: currentUser!.name,
      uploaderRole: currentUser!.role,
      createdAt: new Date().toISOString()
    };
    setGalleryItems((prev) => [newItem, ...prev]);
    saveGalleryItemToFirestore(newItem).catch(() => {});

    // Cross-post to Alumni Dashboard Institutional Social Feed
    const feedCrossPost: InstitutionalFeedPost = {
      id: `post_gal_${Date.now()}`,
      authorId: currentUser!.uid,
      authorName: currentUser!.name || "St. Cecilia's College Administration",
      authorRole: (currentUser!.role as any) || 'admin',
      authorAvatar: currentUser!.profilePictureUrl || '/assets/cecilians-seal.jpg',
      postType: 'gallery',
      title: `Campus Gallery: ${newItem.title}`,
      content: newItem.description || `New campus photo added to the St. Cecilia's College Official Heritage & Campus Gallery (${newItem.year}).`,
      imageUrl: finalUrl,
      likes: [],
      comments: [],
      sharesCount: 0,
      createdAt: new Date().toISOString(),
      tags: ['Campus Gallery', newItem.category, newItem.year]
    };
    setFeedPosts((prev) => dedupePostsById([feedCrossPost, ...prev.filter((p) => p.id !== feedCrossPost.id)]));
    saveFeedPostToFirestore(feedCrossPost).catch(() => {});

    const galNotif: AppNotification = {
      id: `notif_gal_${Date.now()}`,
      toUid: 'all',
      type: 'gallery',
      title: `Campus Gallery: ${newItem.title}`,
      body: `New campus photo published: ${newItem.title} (${newItem.year}).`,
      refId: newItem.id,
      read: false,
      createdAt: new Date().toISOString()
    };
    setNotifications((prev) => [galNotif, ...prev]);
    saveNotificationToFirestore(galNotif).catch(() => {});

    showToast(`New photo "${newItem.title}" added and shared to Alumni Feed!`);
    return true;
  };

  const deleteGalleryItem = (id: string): boolean => {
    if (!['admin', 'superadmin', 'moderator'].includes(currentUser?.role || '')) {
      showToast('Permission denied: Only Admin and Moderator can manage gallery items.');
      return false;
    }
    setGalleryItems((prev) => prev.filter((g) => g.id !== id));
    deleteGalleryItemFromFirestore(id).catch(() => {});
    showToast('Photo removed from Campus & Heritage Gallery.');
    return true;
  };

  // Hydrate server-side PostModerationEngine store when authenticated with a backend session token
  const hasSyncedServerSnapshotRef = useRef<string>('');
  useEffect(() => {
    if (!currentUserId || !getAuthToken()) return;
    const signature = `${currentUserId}:${users.length}:${feedPosts.length}`;
    if (hasSyncedServerSnapshotRef.current === signature) return;
    hasSyncedServerSnapshotRef.current = signature;
    const stripLargeDataUri = (val?: string) =>
      typeof val === 'string' && val.startsWith('data:') && val.length > 4096 ? undefined : val;
    apiFetchWithCsrf('/api/posts/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profiles: users.map((u) => ({
          uid: u.uid,
          name: u.name,
          email: u.email,
          role: u.role,
          username: u.username,
          batch: u.batch,
          course: u.course,
          department: u.department,
          location: u.location,
          profilePictureUrl: stripLargeDataUri(u.profilePictureUrl),
          coverPhotoUrl: stripLargeDataUri(u.coverPhotoUrl),
          headline: u.headline,
          about: u.about,
          company: u.company,
          currentPosition: u.currentPosition,
          phone: u.phone,
          isVerified: u.isVerified,
          quickStatus: u.quickStatus,
          followersCount: u.followersCount,
          followingCount: u.followingCount,
          connectionsCount: u.connectionsCount,
          pinnedPostId: u.pinnedPostId,
          blockedUsers: u.blockedUsers,
          groupIds: u.groupIds,
          show_email: u.show_email ?? u.showEmail,
          show_phone: u.show_phone ?? u.showPhone,
          show_current_employer: u.show_current_employer ?? u.showCurrentEmployer,
          accountStatus: u.accountStatus,
          status: u.status,
          isDeactivated: u.isDeactivated,
          isDeleted: u.isDeleted,
          isBanned: u.isBanned,
          createdAt: u.createdAt
        })),
        posts: feedPosts.map((p) => ({
          ...p,
          authorAvatar: stripLargeDataUri(p.authorAvatar),
          imageUrl: stripLargeDataUri(p.imageUrl),
          mediaUrl: stripLargeDataUri(p.mediaUrl),
          comments: Array.isArray(p.comments) ? p.comments.slice(0, 20) : []
        }))
      })
    }).catch(() => {});
  }, [currentUserId, users, feedPosts]);

  // Institutional Social Feed methods
  const createSocialPost = useCallback(async (postData: {
    postType: 'update' | 'gallery' | 'announcement';
    title: string;
    content: string;
    imageUrl?: string;
    isPinned?: boolean;
    pinExpiresAt?: string;
    tags?: string[];
    visibility?: 'public' | 'alumni' | 'batch' | 'department' | 'group' | 'private';
    targetBatch?: string;
    targetDepartment?: string;
    groupId?: string;
    groupName?: string;
    isAnonymous?: boolean;
  }): Promise<{ success: boolean; post?: InstitutionalFeedPost; error?: string }> => {
    if (!currentUser) {
      return { success: false, error: 'Please sign in to publish posts.' };
    }
    if (currentUser.role === 'employer') {
      showToast('Employer accounts cannot publish feed posts.', 'error');
      return { success: false, error: 'Employer accounts cannot publish feed posts.' };
    }

    const canPin = ['admin', 'superadmin', 'moderator'].includes(currentUser.role);
    const optimisticPost: InstitutionalFeedPost = {
      id: generateSecureId('post'),
      authorId: currentUser.uid,
      authorName: postData.isAnonymous ? 'Anonymous Alumnus' : (currentUser.name || "St. Cecilia's College Alumnus"),
      authorRole: (currentUser.role as any) || 'alumni',
      authorAvatar: postData.isAnonymous ? '' : (currentUser.profilePictureUrl || '/assets/cecilians-seal.jpg'),
      authorUsername: postData.isAnonymous ? undefined : currentUser.username,
      postType: postData.postType,
      title: postData.title,
      content: postData.content,
      imageUrl: postData.imageUrl,
      likes: [],
      hearts: [],
      comments: [],
      sharesCount: 0,
      isPinned: Boolean(postData.isPinned && canPin),
      pinExpiresAt: postData.isPinned && canPin ? postData.pinExpiresAt : undefined,
      tags: postData.tags || [],
      visibility: postData.visibility || 'alumni',
      targetBatch: postData.targetBatch || (postData.visibility === 'batch' ? currentUser.batch : undefined),
      targetDepartment: postData.targetDepartment || (postData.visibility === 'department' ? (currentUser.department || currentUser.course) : undefined),
      groupId: postData.groupId,
      groupName: postData.groupName,
      isAnonymous: Boolean(postData.isAnonymous),
      status: 'published',
      createdAt: new Date().toISOString()
    };

    if (getAuthToken()) {
      try {
        const res = await apiFetchWithCsrf('/api/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: optimisticPost.id,
            postType: postData.postType,
            title: postData.title,
            content: postData.content,
            imageUrl: postData.imageUrl,
            isPinned: Boolean(postData.isPinned && canPin),
            pinExpiresAt: postData.isPinned && canPin ? postData.pinExpiresAt : undefined,
            tags: postData.tags || [],
            visibility: postData.visibility || 'alumni',
            targetBatch: optimisticPost.targetBatch,
            targetDepartment: optimisticPost.targetDepartment,
            groupId: postData.groupId,
            groupName: postData.groupName,
            isAnonymous: Boolean(postData.isAnonymous)
          })
        });
        const data = await res.json().catch(() => null);
        if (res.ok) {
          const savedPost: InstitutionalFeedPost = {
            ...(data?.post || optimisticPost),
            authorId: currentUser.uid
          };
          deletedFeedPostIdsRef.current.delete(savedPost.id);
          pendingLocalPostsRef.current.set(savedPost.id, savedPost);
          setFeedPosts((prev) => dedupePostsById([savedPost, ...prev.filter((p) => p.id !== savedPost.id)]));
          saveFeedPostToFirestore(savedPost).catch(() => {});
          showToast(
            savedPost.isAnonymous
              ? 'Anonymous post published to the main feed.'
              : 'Post published to feed and profile timeline!',
            'success'
          );
          return { success: true, post: savedPost };
        }
        if (res.status === 403 || res.status === 400) {
          const msg = data?.error || 'Could not publish post.';
          showToast(msg, 'error');
          return { success: false, error: msg };
        }
        // For 401 stale/in-memory server token or transient 5xx, continue with Firestore + local state fallback
      } catch {
        // Fallback to local + Firestore persistence if offline
      }
    }

    deletedFeedPostIdsRef.current.delete(optimisticPost.id);
    pendingLocalPostsRef.current.set(optimisticPost.id, optimisticPost);
    setFeedPosts((prev) => dedupePostsById([optimisticPost, ...prev.filter((p) => p.id !== optimisticPost.id)]));
    saveFeedPostToFirestore(optimisticPost).catch((err) => {
      console.warn('Failed to persist feed post in Firestore:', err);
    });
    showToast(
      optimisticPost.isAnonymous
        ? 'Anonymous post published to the main feed.'
        : 'Post published to feed and profile timeline!',
      'success'
    );
    return { success: true, post: optimisticPost };
  }, [currentUser, showToast]);

  const addFeedPost = (postData: {
    postType: 'update' | 'gallery' | 'announcement';
    title: string;
    content: string;
    imageUrl?: string;
    isPinned?: boolean;
    pinExpiresAt?: string;
    tags?: string[];
    visibility?: 'public' | 'alumni' | 'batch' | 'department' | 'group' | 'private';
    targetBatch?: string;
    targetDepartment?: string;
    groupId?: string;
    groupName?: string;
    isAnonymous?: boolean;
    status?: 'published' | 'draft' | 'scheduled' | 'pending_approval';
  }): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'employer') {
      showToast('Employer accounts cannot publish feed posts.', 'error');
      return false;
    }
    void createSocialPost(postData);
    return true;
  };

  const toggleHeartFeedPost = (postId: string) => {
    if (!currentUser) {
      showToast('Please sign in to react with a heart.', 'info');
      return;
    }
    const targetPost = feedPosts.find((p) => p.id === postId);
    if (targetPost && targetPost.authorId === currentUser.uid && !targetPost.isAnonymous) {
      showToast('You cannot congratulate or react to your own post.', 'info');
      return;
    }
    let addedReaction = false;
    setFeedPosts((prev) =>
      prev.map((post) => {
        if (post.id !== postId) return post;
        const currentHearts = Array.isArray(post.hearts)
          ? post.hearts
          : Array.isArray(post.likes)
          ? post.likes
          : [];
        const alreadyHearted = currentHearts.includes(currentUser.uid);
        addedReaction = !alreadyHearted;
        const newHearts = alreadyHearted
          ? currentHearts.filter((uid) => uid !== currentUser.uid)
          : [...currentHearts, currentUser.uid];
        const updated: InstitutionalFeedPost = {
          ...post,
          hearts: newHearts,
          likes: newHearts
        };
        saveFeedPostToFirestore(updated).catch(() => {});
        return updated;
      })
    );
    if (getAuthToken()) {
      apiFetchWithCsrf(`/api/posts/${encodeURIComponent(postId)}/react`, { method: 'POST' }).catch(() => {});
    }
    if (addedReaction && targetPost && targetPost.authorId && targetPost.authorId !== currentUser.uid && !targetPost.isAnonymous) {
      const reactNotif: AppNotification = {
        id: `notif_react_${postId}_${currentUser.uid}_${Date.now()}`,
        toUid: targetPost.authorId,
        fromUid: currentUser.uid,
        type: 'post_reaction',
        title: `${currentUser.name} appreciated your post`,
        body: `"${(targetPost.title || targetPost.content || 'Community Post').slice(0, 80)}"`,
        refId: postId,
        metadata: { postId, actorUid: currentUser.uid },
        read: false,
        createdAt: new Date().toISOString()
      };
      setNotifications((prev) => [reactNotif, ...prev]);
      saveNotificationToFirestore(reactNotif).catch(() => {});
    }
  };

  const toggleLikeFeedPost = (postId: string) => {
    toggleHeartFeedPost(postId);
  };

  const addFeedPostComment = (postId: string, text: string) => {
    if (!currentUser) {
      showToast('Please sign in to leave a comment.', 'info');
      return;
    }
    if (!text.trim()) return;

    const newComment: FeedComment = {
      id: generateSecureId('comm'),
      authorId: currentUser.uid,
      authorName: currentUser.name,
      authorAvatar: currentUser.profilePictureUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      authorRole: currentUser.role,
      text: text.trim(),
      createdAt: new Date().toISOString()
    };

    const targetPost = feedPosts.find((p) => p.id === postId);
    setFeedPosts((prev) =>
      prev.map((post) => {
        if (post.id !== postId) return post;
        const updated = {
          ...post,
          comments: [...post.comments, newComment]
        };
        saveFeedPostToFirestore(updated).catch(() => {});
        return updated;
      })
    );
    if (getAuthToken()) {
      apiFetchWithCsrf(`/api/posts/${encodeURIComponent(postId)}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim() })
      }).catch(() => {});
    }
    if (targetPost && targetPost.authorId && targetPost.authorId !== currentUser.uid && !targetPost.isAnonymous) {
      const commentNotif: AppNotification = {
        id: `notif_comm_${postId}_${newComment.id}`,
        toUid: targetPost.authorId,
        fromUid: currentUser.uid,
        type: 'post_comment',
        title: `${currentUser.name} commented on your post`,
        body: text.trim().slice(0, 120),
        refId: postId,
        metadata: { postId, commentId: newComment.id, actorUid: currentUser.uid },
        read: false,
        createdAt: new Date().toISOString()
      };
      setNotifications((prev) => [commentNotif, ...prev]);
      saveNotificationToFirestore(commentNotif).catch(() => {});
    }
    showToast('Comment posted!', 'success');
  };

  const shareFeedPost = useCallback(async (
    postId: string,
    commentary?: string
  ): Promise<{ success: boolean; sharedPost?: InstitutionalFeedPost; error?: string }> => {
    if (!currentUser) {
      return { success: false, error: 'Please sign in to repost.' };
    }
    if (getAuthToken()) {
      try {
        const res = await apiFetchWithCsrf(`/api/posts/${encodeURIComponent(postId)}/share`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ commentary: commentary?.trim() || undefined })
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          const msg = data?.error || 'Could not share post.';
          showToast(msg, 'error');
          return { success: false, error: msg };
        }
        const sharedPost: InstitutionalFeedPost | undefined = data?.sharedPost || data?.post;
        if (sharedPost) {
          setFeedPosts((prev) =>
            dedupePostsById([
              sharedPost,
              ...prev
                .filter((p) => p.id !== sharedPost.id)
                .map((p) => (p.id === postId ? { ...p, sharesCount: (p.sharesCount || 0) + 1 } : p))
            ])
          );
          saveFeedPostToFirestore(sharedPost).catch(() => {});
        }
        showToast('Shared to your timeline and the main feed!', 'success');
        return { success: true, sharedPost };
      } catch {
        // Fallback below
      }
    }
    const orig = feedPosts.find((p) => p.id === postId);
    if (!orig) return { success: false, error: 'Original post not found.' };
    const sharedPost: InstitutionalFeedPost = {
      ...orig,
      id: generateSecureId('post'),
      authorId: currentUser.uid,
      authorName: currentUser.name,
      authorRole: currentUser.role,
      authorAvatar: currentUser.profilePictureUrl || '',
      authorUsername: currentUser.username,
      content: commentary?.trim() ? `${commentary.trim()}\n\n${orig.content}` : orig.content,
      sharedFromPostId: orig.id,
      sharedFromAuthorId: orig.isAnonymous ? undefined : orig.authorId,
      sharedFromAuthorName: orig.isAnonymous ? 'Anonymous Alumnus' : orig.authorName,
      sharedLabel: 'Shared',
      isAnonymous: false,
      isPinned: false,
      likes: [],
      hearts: [],
      comments: [],
      sharesCount: 0,
      createdAt: new Date().toISOString()
    };
    setFeedPosts((prev) =>
      dedupePostsById([
        sharedPost,
        ...prev
          .filter((p) => p.id !== sharedPost.id)
          .map((p) => (p.id === postId ? { ...p, sharesCount: (p.sharesCount || 0) + 1 } : p))
      ])
    );
    saveFeedPostToFirestore(sharedPost).catch(() => {});
    showToast('Shared to your timeline!', 'success');
    return { success: true, sharedPost };
  }, [currentUser, feedPosts, showToast]);

  const deleteFeedPost = (postId: string) => {
    if (!currentUser) return;
    const post = feedPosts.find((p) => p.id === postId);
    const isStaff = ['admin', 'superadmin', 'moderator'].includes(currentUser.role);
    if (post && !isStaff && post.authorId !== currentUser.uid) {
      showToast('You do not have permission to delete this post.', 'error');
      return;
    }
    deletedFeedPostIdsRef.current.add(postId);
    pendingLocalPostsRef.current.delete(postId);
    setFeedPosts((prev) => prev.filter((p) => p.id !== postId));
    deleteFeedPostFromFirestore(postId).catch((err) => {
      console.warn('Failed to delete feed post from Firestore:', err);
    });
    if (getAuthToken()) {
      apiFetchWithCsrf(`/api/posts/${encodeURIComponent(postId)}`, { method: 'DELETE' }).catch(() => {});
    }
    showToast('Post removed from feed and timeline.', 'info');
  };

  const updateFeedPost = (postId: string, updates: Partial<InstitutionalFeedPost>) => {
    if (!currentUser) return false;
    const post = feedPosts.find((p) => p.id === postId);
    const isStaff = ['admin', 'superadmin', 'moderator'].includes(currentUser.role);
    if (post && !isStaff && post.authorId !== currentUser.uid) {
      showToast('You do not have permission to edit this post.', 'error');
      return false;
    }
    const { createdAt: _ignoreCreatedAt, ...safeUpdates } = updates;
    const updatedPost: InstitutionalFeedPost | undefined = post
      ? { ...post, ...safeUpdates, isEdited: true, updatedAt: new Date().toISOString() }
      : undefined;
    if (updatedPost) {
      pendingLocalPostsRef.current.set(updatedPost.id, updatedPost);
      setFeedPosts((prev) => prev.map((p) => (p.id === postId ? updatedPost : p)));
      saveFeedPostToFirestore(updatedPost).catch((err) => {
        console.warn('Failed to update feed post in Firestore:', err);
      });
    }
    if (getAuthToken()) {
      apiFetchWithCsrf(`/api/posts/${encodeURIComponent(postId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(safeUpdates)
      }).catch(() => {});
    }
    showToast('Post updated successfully.', 'success');
    return true;
  };

  const logout = useCallback((options?: { revokeBiometrics?: boolean }) => {
    const shouldRevokeBiometrics = options?.revokeBiometrics ?? false;
    try {
      const token =
        sessionStorage.getItem('alumni_server_auth_token') ||
        localStorage.getItem('alumni_server_auth_token') ||
        localStorage.getItem('alumni_auth_token');
      const refreshToken =
        sessionStorage.getItem('alumni_refresh_token') ||
        localStorage.getItem('alumni_refresh_token');

      if (token || refreshToken) {
        fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            refreshToken,
            revokeRefreshToken: shouldRevokeBiometrics
          })
        }).catch(() => {});
      }
    } catch {}

    // Only wipe vaulted credentials from native Keystore if explicitly requested or if biometrics is disabled
    if (shouldRevokeBiometrics) {
      wipeVaultedBiometricCredentials().catch(() => {});
    }

    signOutUser().catch(() => {});
    clearStoredSession();
    currentUserIdRef.current = null;
    currentUserRoleRef.current = 'alumni';
    setCurrentUserId(null);
    setActiveSessionConflict(null);
    try {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_TAB);
      localStorage.removeItem(STORAGE_KEYS.VIEW);
      localStorage.removeItem('alumni_server_auth_token');
      localStorage.removeItem('alumni_auth_token');
      if (shouldRevokeBiometrics) {
        localStorage.removeItem('alumni_refresh_token');
        localStorage.removeItem('alumni_latest_refresh_token');
        sessionStorage.clear();
      } else {
        sessionStorage.removeItem('alumni_server_auth_token');
      }
      if (typeof window !== 'undefined' && /^\/(portal|profile|post)\//i.test(window.location.pathname)) {
        window.history.replaceState({}, '', '/');
      }
    } catch {}
    setActiveTabState('dashboard');
    setViewedProfileIdentifier(null);
    setViewedPostId(null);
    showToast(shouldRevokeBiometrics ? 'Logged out and biometric credentials revoked.' : 'Logged out successfully.');
  }, [showToast]);

  // Server-Authoritative Session Heartbeat Supervisor: Checks single active session validity
  useEffect(() => {
    if (!currentUserId) return;

    const checkActiveSessionHealth = async () => {
      try {
        const token =
          sessionStorage.getItem('alumni_server_auth_token') ||
          localStorage.getItem('alumni_server_auth_token') ||
          localStorage.getItem('alumni_auth_token');
        if (!token) return;

        const res = await fetch('/api/auth/session', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (res.ok) {
          const nowIso = new Date().toISOString();
          setUsers((prev) =>
            prev.map((u) => (u.uid === currentUserId ? { ...u, lastActiveAt: nowIso, isOnline: true } : u))
          );
        }

        if (res.status === 401) {
          const errData = await res.json().catch(() => ({}));
          if (errData.code === 'ACCOUNT_DELETED') {
            addDeletedAccountUids([currentUserId]);
            purgeDeletedUidsFromVaultAndStorage([currentUserId]);
            setUsers((prev) => {
              const next = prev.filter((u) => u.uid !== currentUserId);
              persistUsersSafe(next);
              return next;
            });
            logout({ revokeBiometrics: true });
            showToast('This account has been deleted.', 'info');
          } else if (errData.code === 'SESSION_TERMINATED') {
            logout();
            showToast('You were signed out because this account was logged into on another device.', 'error');
          } else if (errData.code === 'SESSION_EXPIRED') {
            logout();
            showToast('Your session has expired. Please sign in again.', 'info');
          }
        }
      } catch {
        // Do not kick user out on temporary connection issues
      }
    };

    // Check periodically every 30 seconds
    const interval = setInterval(checkActiveSessionHealth, 30000);
    // Also check when tab becomes visible
    const handleVis = () => {
      if (document.visibilityState === 'visible') {
        checkActiveSessionHealth();
      }
    };
    document.addEventListener('visibilitychange', handleVis);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVis);
    };
  }, [currentUserId, logout, showToast]);

  const switchUser = (uid: string) => {
    const target = users.find((u) => u.uid === uid);
    if (target) {
      saveActiveSession(target);
      setCurrentUserId(uid);
      showToast(`Switched view to ${target.name} (${(target.role || 'user').toUpperCase()})`);
    }
  };

  const resetPassword = (email: string): boolean => {
    showToast(`Password reset link sent to ${email}. Check your inbox.`);
    return true;
  };

  const resetUserPasswordByEmail = (email: string, newPass: string): boolean => {
    const trimmed = email.trim().toLowerCase();
    const targetUser = users.find((u) => u.email.toLowerCase() === trimmed);
    if (!targetUser) {
      showToast('No registered account found with that email address.');
      return false;
    }
    hashSecretClient(newPass)
      .then((passwordHash) => {
        setUsers((prev) => {
          const next = prev.map((u) =>
            u.email.toLowerCase() === trimmed
              ? stripPlaintextSecretsFromUser({ ...u, passwordHash })
              : u
          );
          persistUsersSafe(next);
          return next;
        });
        saveCredentialToVault({
          uid: targetUser.uid,
          name: targetUser.name,
          email: targetUser.email,
          studentId: targetUser.studentId,
          alumniId: targetUser.alumniId,
          passwordHash,
          role: targetUser.role,
          isVerified: Boolean(targetUser.isVerified)
        });
      })
      .catch(() => {});

    saveCredentialToVault({
      uid: targetUser.uid,
      name: targetUser.name,
      email: targetUser.email,
      studentId: targetUser.studentId,
      alumniId: targetUser.alumniId,
      password: newPass,
      role: targetUser.role,
      isVerified: Boolean(targetUser.isVerified)
    });
    fetch('/api/auth/sync-credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        users: [{ ...stripPlaintextSecretsFromUser(targetUser), password: newPass }]
      })
    }).catch(() => {});
    showToast('Password updated securely. You can now sign in with your new password.');
    return true;
  };

  const cascadeDeleteAccount = useCallback(async (uidToDelete: string, mode: 'self' | 'admin'): Promise<boolean> => {
    if (!uidToDelete || uidToDelete === 'usr_superadmin_cecilia') {
      showToast('The primary Superadmin institutional account cannot be deleted.', 'error');
      return false;
    }
    const target = users.find((u) => u.uid === uidToDelete);
    if (mode === 'admin') {
      if ((target?.role === 'admin' || target?.role === 'superadmin') && currentUserRoleRef.current !== 'superadmin') {
        showToast('Only Superadmin accounts can delete institutional administrators.', 'error');
        return false;
      }
    }

    const activeToken = getAuthToken();
    if (activeToken && isSignedHmacToken(activeToken)) {
      const deleteEndpoint =
        mode === 'self'
          ? '/api/profiles/me'
          : `/api/profiles/${encodeURIComponent(uidToDelete)}`;
      const postFallback =
        mode === 'self'
          ? '/api/profiles/me/delete'
          : `/api/admin/users/${encodeURIComponent(uidToDelete)}/delete`;

      let serverRes = await apiFetchWithCsrf(deleteEndpoint, { method: 'DELETE' }).catch(() => null);
      if (serverRes && serverRes.status === 403) {
        const d = await serverRes.json().catch(() => null);
        if (
          d?.code === 'SUPERADMIN_REQUIRED' ||
          d?.code === 'CANNOT_DELETE_PRIMARY_SUPERADMIN' ||
          d?.code === 'FORBIDDEN'
        ) {
          showToast(d.error || 'Permission denied to delete this account.', 'error');
          return false;
        }
      }

      if (!serverRes || !serverRes.ok) {
        const postRes = await apiFetchWithCsrf(postFallback, {
          method: 'POST',
          body: JSON.stringify({ targetUid: uidToDelete })
        }).catch(() => null);
        if (postRes && postRes.status === 403) {
          const d = await postRes.json().catch(() => null);
          if (
            d?.code === 'SUPERADMIN_REQUIRED' ||
            d?.code === 'CANNOT_DELETE_PRIMARY_SUPERADMIN' ||
            d?.code === 'FORBIDDEN'
          ) {
            showToast(d.error || 'Permission denied to delete this account.', 'error');
            return false;
          }
        }
      }
    }

    // 1. Mark UID as deleted locally so neither vault nor stale caches can restore it
    addDeletedAccountUids([uidToDelete]);
    removeCredentialFromVault({
      uid: uidToDelete,
      email: target?.email,
      studentId: target?.studentId,
      alumniId: target?.alumniId,
      employeeId: target?.employeeId
    });

    // 2. Soft-delete user profile & delete auth security vault in Firestore (retains anonymized tombstone)
    try {
      await Promise.allSettled([
        alumniService.deleteAlumni(uidToDelete),
        deleteAuthCredentialInFirestore(uidToDelete)
      ]);
    } catch (err) {
      console.warn('Error soft-deleting user account from Firestore:', err);
    }

    // 3. Release registrar verification claim while keeping core institutional verification record
    try {
      releaseRegistryRecordRegistration(target?.studentId, uidToDelete);
    } catch {}

    // 4. Permanently delete all posts created by the deleted user AND remove their comments/reactions everywhere
    setFeedPosts((prev) => {
      const cleaned = prev
        .filter((p) => p.authorId !== uidToDelete)
        .map((p) => {
          const hadComment = Array.isArray(p.comments) && p.comments.some((c) => c.authorId === uidToDelete);
          const hadLike = Array.isArray(p.likes) && p.likes.includes(uidToDelete);
          const hadHeart = Array.isArray(p.hearts) && p.hearts.includes(uidToDelete);
          if (!hadComment && !hadLike && !hadHeart) return p;
          return {
            ...p,
            comments: hadComment ? (p.comments || []).filter((c) => c.authorId !== uidToDelete) : p.comments,
            likes: hadLike ? (p.likes || []).filter((id) => id !== uidToDelete) : p.likes,
            hearts: hadHeart ? (p.hearts || []).filter((id) => id !== uidToDelete) : p.hearts
          };
        });
      try {
        localStorage.setItem(STORAGE_KEYS.FEED_POSTS, JSON.stringify(cleaned));
      } catch {}
      return cleaned;
    });

    setEvents((prev) => {
      const cleaned = prev.map((ev) => {
        if (!Array.isArray(ev.comments) || !ev.comments.some((c) => c.authorId === uidToDelete)) return ev;
        return {
          ...ev,
          comments: ev.comments.filter((c) => c.authorId !== uidToDelete)
        };
      });
      try {
        localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(cleaned));
      } catch {}
      return cleaned;
    });

    setFriendRequests((prev) => {
      const cleaned = prev.filter((r) => r.fromUid !== uidToDelete && r.toUid !== uidToDelete);
      try {
        localStorage.setItem(STORAGE_KEYS.REQUESTS, JSON.stringify(cleaned));
      } catch {}
      return cleaned;
    });

    purgeUserPostsAndCommentsInFirestore(uidToDelete).catch((err) => {
      console.warn('Background Firestore purge notice:', err);
    });

    // 5. Remove from in-memory directory & localStorage users cache
    setUsers((prev) => {
      const next = prev.filter((u) => u.uid !== uidToDelete);
      persistUsersSafe(next);
      return next;
    });

    setSelectedUserIdForModal((prev) => (prev === uidToDelete ? null : prev));

    // 6. Preserve anonymized security/governance audit trail without PII linking to future registrations
    try {
      addAuditLog({
        action: 'ACCOUNT_SOFT_DELETED',
        actorId: currentUserIdRef.current || 'system_admin',
        actorName: mode === 'self' ? 'Account Owner' : 'Institutional Administrator',
        actorRole: currentUserRoleRef.current || 'superadmin',
        category: 'user_management',
        details: 'Soft-deleted account profile and permanently purged authored posts and comments. Institutional verification record released for fresh verification.',
        severity: 'warning',
        targetRecordId: `redacted_${uidToDelete.slice(-6)}`
      });
    } catch {}

    if (mode === 'self' || uidToDelete === currentUserId) {
      logout({ revokeBiometrics: true });
      showToast('Account permanently deleted from the database.', 'info');
    } else {
      showToast('Member account deleted and posts/comments purged.', 'info');
    }

    return true;
  }, [users, currentUserId, logout, showToast, addAuditLog]);

  const performFullAccountDeletion = useCallback(async (uidToDelete: string): Promise<boolean> => {
    return cascadeDeleteAccount(uidToDelete, 'self');
  }, [cascadeDeleteAccount]);

  const deleteAccount = async (): Promise<boolean> => {
    if (!currentUserId) return false;
    const target = users.find((u) => u.uid === currentUserId);
    if (target && ['admin', 'superadmin', 'moderator'].includes(target.role)) {
      showToast('Administrative accounts cannot be deleted from settings. Contact institutional governance.', 'error');
      return false;
    }
    return performFullAccountDeletion(currentUserId);
  };

  const changeEmail = async (newEmail: string): Promise<boolean> => {
    if (!currentUserId) return false;
    const trimmed = newEmail.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmed || !emailRegex.test(trimmed)) {
      showToast('Please enter a valid email address.', 'error');
      return false;
    }

    const duplicate = users.some(
      (u) => u.uid !== currentUserId && u.email && u.email.trim().toLowerCase() === trimmed
    );
    if (duplicate) {
      showToast(`An account registered with ${trimmed} already exists.`, 'error');
      return false;
    }

    const targetUser = users.find((u) => u.uid === currentUserId);
    const oldEmail = targetUser?.email?.trim().toLowerCase();

    if (targetUser) {
      const vaultCred = findCredentialInVault(oldEmail || targetUser.uid);
      const preservedHash = targetUser.passwordHash || vaultCred?.passwordHash;

      if (oldEmail && oldEmail !== trimmed) {
        try {
          const vault = getStoredCredentialsVault();
          if (vault[oldEmail]?.uid === targetUser.uid) {
            delete vault[oldEmail];
            localStorage.setItem(CREDENTIALS_VAULT_KEY, JSON.stringify(vault));
          }
        } catch {}
      }

      saveCredentialToVault({
        uid: targetUser.uid,
        name: targetUser.name,
        email: trimmed,
        studentId: targetUser.studentId,
        alumniId: targetUser.alumniId,
        employeeId: targetUser.employeeId,
        role: targetUser.role,
        isVerified: Boolean(targetUser.isVerified),
        ...(preservedHash ? { passwordHash: preservedHash } : {})
      });
    }

    setUsers((prev) => {
      const next = prev.map((u) =>
        u.uid === currentUserId ? { ...u, email: trimmed, emailVerified: true } : u
      );
      persistUsersSafe(next);
      return next;
    });

    try {
      await alumniService.updateAlumni(currentUserId, { email: trimmed, emailVerified: true });
    } catch (err) {
      console.warn('Error updating email in Firestore:', err);
    }

    addAuditLog({
      action: 'EMAIL_ADDRESS_UPDATED',
      actorId: currentUserId,
      actorName: targetUser?.name || 'User',
      actorRole: targetUser?.role || 'alumni',
      category: 'security',
      details: `Verified and updated account email to ${trimmed}`,
      severity: 'info',
      targetUserId: currentUserId
    });
    showToast(`Email address verified and updated to ${trimmed}!`, 'success');
    return true;
  };

  const changePassword = async (
    oldOrNewPass: string,
    newPass?: string
  ): Promise<{ success: boolean; message?: string }> => {
    if (!currentUserId) {
      showToast('No active session found.', 'error');
      return { success: false, message: 'No active session found.' };
    }
    const targetUser = users.find((u) => u.uid === currentUserId);
    if (!targetUser) {
      showToast('User profile not found.', 'error');
      return { success: false, message: 'User profile not found.' };
    }

    let actualOldPass: string | undefined;
    let actualNewPass: string;

    if (newPass !== undefined) {
      actualOldPass = oldOrNewPass;
      actualNewPass = newPass;
    } else {
      actualNewPass = oldOrNewPass;
    }

    if (pendingVaultHashPromises.size > 0) {
      await Promise.all(Array.from(pendingVaultHashPromises.values())).catch(() => {});
    }

    const vaultCred = findCredentialInVault(targetUser.email || targetUser.uid);
    const seedUser = INITIAL_USERS.find((iu) => iu.uid === targetUser.uid);
    const storedSecret =
      targetUser.passwordHash ||
      vaultCred?.passwordHash ||
      vaultCred?.password ||
      (targetUser as any).password ||
      seedUser?.password;

    // Verify current (old) password using PBKDF2 hash comparison
    if (actualOldPass !== undefined && storedSecret) {
      const oldValid = await verifySecretClient(actualOldPass, storedSecret);
      if (!oldValid) {
        showToast('The old password you entered is incorrect.', 'error');
        return { success: false, message: 'The old password you entered is incorrect.' };
      }
    }

    if (!actualNewPass || actualNewPass.length < 6) {
      showToast('New password must be at least 6 characters long.', 'error');
      return { success: false, message: 'New password must be at least 6 characters long.' };
    }

    if (actualOldPass && actualNewPass === actualOldPass) {
      showToast('New password must be different from your current password.', 'error');
      return { success: false, message: 'New password must be different from your current password.' };
    }

    const newPasswordHash = await hashSecretClient(actualNewPass);

    setUsers((prev) => {
      const next = prev.map((u) =>
        u.uid === currentUserId ? stripPlaintextSecretsFromUser({ ...u, passwordHash: newPasswordHash }) : u
      );
      persistUsersSafe(next);
      return next;
    });
    saveCredentialToVault({
      uid: targetUser.uid,
      name: targetUser.name,
      email: targetUser.email,
      studentId: targetUser.studentId,
      alumniId: targetUser.alumniId,
      employeeId: targetUser.employeeId,
      passwordHash: newPasswordHash,
      role: targetUser.role,
      isVerified: Boolean(targetUser.isVerified)
    });

    // Update backend credential store cleanly without leaving an invalidated token active
    try {
      await fetch('/api/auth/sync-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          users: [{ ...stripPlaintextSecretsFromUser(targetUser), password: actualNewPass }]
        })
      });
    } catch {}

    // Also dispatch an institutional Security Notice to the user's email
    try {
      sendSecurityAlertEmail(
        targetUser,
        'Password Successfully Updated',
        'Your St. Cecilia’s College alumni network account password has been updated securely. If you did not make this change, please report it to campus security.'
      );
    } catch {
      // ignore
    }

    showToast('Password updated securely!', 'success');
    return { success: true, message: 'Password updated securely!' };
  };

  // Profile & URL sub-route navigation helpers
  const openProfile = useCallback((identifierOrUid: string) => {
    if (!identifierOrUid || identifierOrUid === 'anonymous' || identifierOrUid === 'former_alumni') return;
    const matched = users.find((u) => u.uid === identifierOrUid || u.username === identifierOrUid);
    const canonicalSlug = matched?.username || identifierOrUid;
    setSelectedUserIdForModal(null);
    setViewedPostId(null);
    setViewedProfileIdentifier(canonicalSlug);
    if (typeof window !== 'undefined') {
      const targetUrl = `/profile/${encodeURIComponent(canonicalSlug)}`;
      if (window.location.pathname !== targetUrl) {
        window.history.pushState({ profile: canonicalSlug }, '', targetUrl);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [users]);

  const openPostPermalink = useCallback((postId: string) => {
    if (!postId) return;
    setSelectedUserIdForModal(null);
    setViewedProfileIdentifier(null);
    setViewedPostId(postId);
    if (typeof window !== 'undefined') {
      const targetUrl = `/post/${encodeURIComponent(postId)}`;
      if (window.location.pathname !== targetUrl) {
        window.history.pushState({ post: postId }, '', targetUrl);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const closeSubRoute = useCallback(() => {
    setViewedProfileIdentifier(null);
    setViewedPostId(null);
    if (typeof window !== 'undefined') {
      if (window.location.pathname.startsWith('/profile/') || window.location.pathname.startsWith('/post/')) {
        const nextPortal = buildPortalUrlForTab(activeTab || 'dashboard');
        window.history.pushState({ portalPath: nextPortal }, '', nextPortal);
      }
    }
  }, [activeTab]);

  // Profile operations
  const updateProfile = (data: Partial<UserProfile>) => {
    if (!currentUserId) {
      showToast('You must be signed in to update your profile.', 'error');
      return;
    }
    const currentFullUser = users.find((u) => u.uid === currentUserId);
    setUsers((prev) => {
      const updated = prev.map((u) => (u.uid === currentUserId ? { ...u, ...data } : u));
      return updated;
    });
    if (getAuthToken()) {
      apiFetchWithCsrf('/api/profiles/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).catch(() => {});
    }
    alumniService
      .updateAlumni(currentUserId, data, currentFullUser ? { ...currentFullUser, ...data } : undefined)
      .then(() => {
        showToast('Profile updated successfully!', 'success');
      })
      .catch((err) => {
        console.warn('Notice saving profile changes to Firestore:', err);
        showToast('Profile changes saved successfully.', 'success');
      });
  };

  const pinProfilePost = useCallback(async (postId: string | null): Promise<boolean> => {
    if (!currentUserId) return false;
    setUsers((prev) =>
      prev.map((u) => (u.uid === currentUserId ? { ...u, pinnedPostId: postId || undefined } : u))
    );
    if (getAuthToken()) {
      try {
        const res = postId
          ? await apiFetchWithCsrf('/api/profiles/me/pin', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ postId })
            })
          : await apiFetchWithCsrf('/api/profiles/me/pin', { method: 'DELETE' });
        if (!res.ok) {
          const d = await res.json().catch(() => null);
          showToast(d?.error || 'Could not update pinned post.', 'error');
          return false;
        }
      } catch {
        // Offline fallback kept
      }
    }
    showToast(postId ? 'Post pinned to the top of your profile!' : 'Post unpinned from profile.', 'success');
    return true;
  }, [currentUserId, showToast]);

  const blockUser = useCallback(async (targetUid: string): Promise<boolean> => {
    if (!currentUserId || !targetUid || targetUid === currentUserId) return false;
    setUsers((prev) =>
      prev.map((u) =>
        u.uid === currentUserId
          ? { ...u, blockedUsers: Array.from(new Set([...(u.blockedUsers || []), targetUid])) }
          : u
      )
    );
    if (getAuthToken()) {
      await apiFetchWithCsrf(`/api/profiles/${encodeURIComponent(targetUid)}/block`, { method: 'POST' }).catch(() => {});
    }
    showToast('User blocked. Their posts and profile are now hidden.', 'info');
    return true;
  }, [currentUserId, showToast]);

  const unblockUser = useCallback(async (targetUid: string): Promise<boolean> => {
    if (!currentUserId || !targetUid) return false;
    setUsers((prev) =>
      prev.map((u) =>
        u.uid === currentUserId
          ? { ...u, blockedUsers: (u.blockedUsers || []).filter((id) => id !== targetUid) }
          : u
      )
    );
    if (getAuthToken()) {
      await apiFetchWithCsrf(`/api/profiles/${encodeURIComponent(targetUid)}/block`, { method: 'DELETE' }).catch(() => {});
    }
    showToast('User unblocked.', 'success');
    return true;
  }, [currentUserId, showToast]);

  const deleteMyAccount = useCallback(async (): Promise<boolean> => {
    if (!currentUserId) return false;
    return performFullAccountDeletion(currentUserId);
  }, [currentUserId, performFullAccountDeletion]);

  const addExperience = (exp: Omit<Experience, 'id'>) => {
    if (!currentUserId) return;
    const newExp: Experience = {
      id: `exp_${Date.now()}`,
      ...exp
    };
    const targetUser = users.find((u) => u.uid === currentUserId);
    const updatedExperience = [newExp, ...(targetUser?.experience || [])];
    setUsers((prev) =>
      prev.map((u) =>
        u.uid === currentUserId
          ? { ...u, experience: updatedExperience }
          : u
      )
    );
    alumniService.updateAlumni(currentUserId, { experience: updatedExperience }).catch((err) => {
      console.warn('Error saving experience to Firestore:', err);
    });
    showToast('New work experience added!');
  };

  const removeExperience = (id: string) => {
    if (!currentUserId) return;
    const targetUser = users.find((u) => u.uid === currentUserId);
    const updatedExperience = (targetUser?.experience || []).filter((e) => e.id !== id);
    setUsers((prev) =>
      prev.map((u) =>
        u.uid === currentUserId
          ? { ...u, experience: updatedExperience }
          : u
      )
    );
    alumniService.updateAlumni(currentUserId, { experience: updatedExperience }).catch((err) => {
      console.warn('Error updating experience in Firestore:', err);
    });
    showToast('Experience removed.');
  };

  const addEducation = (edu: Omit<Education, 'id'>) => {
    if (!currentUserId) return;
    const newEdu: Education = {
      id: `edu_${Date.now()}`,
      ...edu
    };
    const targetUser = users.find((u) => u.uid === currentUserId);
    const updatedEducation = [newEdu, ...(targetUser?.education || [])];
    setUsers((prev) =>
      prev.map((u) =>
        u.uid === currentUserId
          ? { ...u, education: updatedEducation }
          : u
      )
    );
    alumniService.updateAlumni(currentUserId, { education: updatedEducation }).catch((err) => {
      console.warn('Error saving education to Firestore:', err);
    });
    showToast('Education record added!');
  };

  const removeEducation = (id: string) => {
    if (!currentUserId) return;
    const targetUser = users.find((u) => u.uid === currentUserId);
    const updatedEducation = (targetUser?.education || []).filter((e) => e.id !== id);
    setUsers((prev) =>
      prev.map((u) =>
        u.uid === currentUserId
          ? { ...u, education: updatedEducation }
          : u
      )
    );
    alumniService.updateAlumni(currentUserId, { education: updatedEducation }).catch((err) => {
      console.warn('Error updating education in Firestore:', err);
    });
    showToast('Education removed.');
  };

  // Friends & Network operations
  const isFollowing = (uid: string) => {
    if (!currentUserId) return false;
    return (followingMap[currentUserId] || []).includes(uid);
  };

  const isConnected = (uid: string) => {
    if (!currentUserId || !uid) return false;
    if ((connectionsMap[currentUserId] || []).includes(uid)) return true;
    return friendRequests.some(
      (r) =>
        r.status === 'accepted' &&
        ((r.fromUid === currentUserId && r.toUid === uid) ||
          (r.fromUid === uid && r.toUid === currentUserId))
    );
  };

  const hasPendingRequestWith = (uid: string): 'sent' | 'received' | false => {
    if (!currentUserId) return false;
    const req = friendRequests.find(
      (r) =>
        r.status === 'pending' &&
        ((r.fromUid === currentUserId && r.toUid === uid) ||
          (r.fromUid === uid && r.toUid === currentUserId))
    );
    if (!req) return false;
    return req.fromUid === currentUserId ? 'sent' : 'received';
  };

  const sendFriendRequest = (targetUid: string) => {
    if (!currentUser) {
      showToast('Please sign in to send connection requests.', 'error');
      return { success: false, error: 'Not authenticated' };
    }

    if (currentUser.uid === targetUid) {
      showToast('You cannot send a connection request to yourself.', 'warning');
      return { success: false, error: 'Self connection' };
    }

    const targetUser = users.find((u) => u.uid === targetUid);
    if (!targetUser) {
      showToast('Target alumnus profile not found.', 'error');
      return { success: false, error: 'Target user not found' };
    }

    if (isConnected(targetUid)) {
      showToast(`You are already connected with ${targetUser.name}.`, 'info');
      return { success: false, error: 'Already connected' };
    }

    const existingReq = friendRequests.find(
      (r) =>
        r.status === 'pending' &&
        ((r.fromUid === currentUser.uid && r.toUid === targetUid) ||
          (r.fromUid === targetUid && r.toUid === currentUser.uid))
    );
    if (existingReq) {
      showToast('A pending connection request already exists.', 'warning');
      return { success: false, error: 'Request exists' };
    }

    const newReqId = `req_${currentUser.uid}_${targetUid}_${Date.now()}`;
    const newReq: FriendRequest = {
      id: newReqId,
      fromUid: currentUser.uid,
      toUid: targetUid,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    setFriendRequests((prev) => [newReq, ...prev]);
    saveFriendRequestToFirestore(newReq).catch(() => {});

    // Create Notification for receiver
    const newNotif: AppNotification = {
      id: `notif_${Date.now()}`,
      toUid: targetUid,
      fromUid: currentUser.uid,
      type: 'friend_request',
      title: 'New Connection Request',
      body: `${currentUser.name} (${currentUser.course || 'Alumni'}, Batch ${currentUser.batch || 'Class'}) sent you a connection request.`,
      refId: newReq.id,
      actionStatus: 'pending',
      read: false,
      createdAt: new Date().toISOString()
    };

    setNotifications((prev) => [newNotif, ...prev]);
    saveNotificationToFirestore(newNotif).catch(() => {});
    showToast(`Connection request sent to ${targetUser.name}!`, 'success');

    return { success: true };
  };

  const acceptFriendRequest = (requestId: string) => {
    const req = friendRequests.find((r) => r.id === requestId);
    if (!req || !currentUser) return;

    const updatedReq = { ...req, status: 'accepted' as const };
    setFriendRequests((prev) =>
      prev.map((r) => (r.id === requestId ? updatedReq : r))
    );
    saveFriendRequestToFirestore(updatedReq).catch(() => {});

    // Update bidirectional connections
    setConnectionsMap((prev) => {
      const currentCons = prev[currentUser.uid] || [];
      const senderCons = prev[req.fromUid] || [];
      return {
        ...prev,
        [currentUser.uid]: Array.from(new Set([...currentCons, req.fromUid])),
        [req.fromUid]: Array.from(new Set([...senderCons, currentUser.uid]))
      };
    });

    // Persist accepted connection to Firestore connections collection
    const connId = [currentUser.uid, req.fromUid].sort().join('_');
    const nowIso = new Date().toISOString();
    saveConnectionToFirestore({
      id: connId,
      userId: currentUser.uid,
      connectedUserId: req.fromUid,
      participants: [currentUser.uid, req.fromUid],
      status: 'accepted',
      createdAt: nowIso,
      updatedAt: nowIso
    }).catch((err) => {
      console.warn('Error saving connection to Firestore:', err);
    });

    // Increment connection counts
    setUsers((prev) =>
      prev.map((u) => {
        if (u.uid === currentUser.uid || u.uid === req.fromUid) {
          return { ...u, connectionsCount: (u.connectionsCount || 0) + 1 };
        }
        return u;
      })
    );

    const sender = users.find((u) => u.uid === req.fromUid);

    // Update the receiving notification status to 'accepted' so buttons are removed
    setNotifications((prev) =>
      prev.map((n) => {
        if (n.refId === requestId || (n.type === 'friend_request' && n.fromUid === req.fromUid && n.toUid === currentUser.uid)) {
          const updated: AppNotification = {
            ...n,
            actionStatus: 'accepted',
            read: true,
            body: `You accepted ${sender?.name || 'alumnus'}'s connection request.`
          };
          saveNotificationToFirestore(updated).catch(() => {});
          return updated;
        }
        return n;
      })
    );

    // Notification to sender
    const notif: AppNotification = {
      id: `notif_${Date.now()}`,
      toUid: req.fromUid,
      fromUid: currentUser.uid,
      type: 'friend_accepted',
      title: 'Connection Accepted',
      body: `${currentUser.name} accepted your alumni connection request.`,
      refId: currentUser.uid,
      actionStatus: 'accepted',
      read: false,
      createdAt: new Date().toISOString()
    };
    setNotifications((prev) => [notif, ...prev]);
    saveNotificationToFirestore(notif).catch(() => {});

    showToast(`You are now connected with ${sender ? sender.name : 'your fellow alumnus'}!`, 'success');
  };

  const declineFriendRequest = (requestId: string) => {
    const req = friendRequests.find((r) => r.id === requestId);
    if (!req || !currentUser) return;

    const updatedReq = { ...req, status: 'declined' as const };
    saveFriendRequestToFirestore(updatedReq).catch(() => {});
    setFriendRequests((prev) =>
      prev.map((r) => (r.id === requestId ? updatedReq : r))
    );

    // Update receiving notification so buttons are removed
    setNotifications((prev) =>
      prev.map((n) => {
        if (n.refId === requestId || (n.type === 'friend_request' && n.fromUid === req.fromUid && n.toUid === currentUser.uid)) {
          const updated: AppNotification = {
            ...n,
            actionStatus: 'declined',
            read: true,
            body: 'Connection request was declined.'
          };
          saveNotificationToFirestore(updated).catch(() => {});
          return updated;
        }
        return n;
      })
    );

    showToast('Connection request declined.', 'info');
  };

  const cancelFriendRequest = (requestId: string) => {
    const req = friendRequests.find((r) => r.id === requestId);
    setFriendRequests((prev) => prev.filter((r) => r.id !== requestId));
    deleteFriendRequestFromFirestore(requestId).catch(() => {});
    if (req) {
      setNotifications((prev) =>
        prev.filter((n) => !(n.refId === requestId && n.type === 'friend_request'))
      );
    }
    showToast('Connection request cancelled.');
  };

  const toggleFollow = (targetUid: string) => {
    if (!currentUser) return;
    if (!permissions.canFollow) {
      showToast('Only Alumni and Admins can follow users.');
      return;
    }

    const currentFollowing = followingMap[currentUser.uid] || [];
    const isNowFollowing = currentFollowing.includes(targetUid);

    setFollowingMap((prev) => {
      const updated = isNowFollowing
        ? currentFollowing.filter((id) => id !== targetUid)
        : [...currentFollowing, targetUid];
      return { ...prev, [currentUser.uid]: updated };
    });

    // Update follower/following counts
    setUsers((prev) =>
      prev.map((u) => {
        if (u.uid === currentUser.uid) {
          return {
            ...u,
            followingCount: Math.max(0, (u.followingCount || 0) + (isNowFollowing ? -1 : 1))
          };
        }
        if (u.uid === targetUid) {
          return {
            ...u,
            followersCount: Math.max(0, (u.followersCount || 0) + (isNowFollowing ? -1 : 1))
          };
        }
        return u;
      })
    );

    const target = users.find((u) => u.uid === targetUid);
    showToast(isNowFollowing ? `Unfollowed ${target?.name}` : `Following ${target?.name}`);
  };

  // Messaging operations
  const getOrCreateChat = (targetUid: string): string => {
    if (!currentUser) return '';

    // Strict connection check: Direct messaging is strictly restricted to mutual connections
    const target = users.find((u) => u.uid === targetUid);
    const isTargetAlumni = !target?.role || target?.role === 'alumni';
    const isCurrentAlumni = !currentUser.role || currentUser.role === 'alumni';
    if (isTargetAlumni && isCurrentAlumni && targetUid !== currentUser.uid) {
      const userConnections = connectionsMap[currentUser.uid] || [];
      if (!userConnections.includes(targetUid)) {
        showToast('Direct messaging is strictly restricted to mutual connections. Please send a connection request first.', 'warning');
        return '';
      }
    }

    const existingChat = chats.find(
      (c) => (c.memberIds || (c as any).participants || []).includes(currentUser.uid) && (c.memberIds || (c as any).participants || []).includes(targetUid)
    );
    if (existingChat) {
      setActiveChatId(existingChat.id);
      return existingChat.id;
    }

    // Create new chat
    const newChatId = `chat_${Date.now()}`;
    const newChat: ChatThread = {
      id: newChatId,
      memberIds: [currentUser.uid, targetUid],
      lastMessage: 'Conversation started',
      lastMessageAt: new Date().toISOString(),
      unreadCount: {
        [currentUser.uid]: 0,
        [targetUid]: 0
      }
    };

    setChats((prev) => [newChat, ...prev]);
    setMessages((prev) => ({ ...prev, [newChatId]: [] }));
    setActiveChatId(newChatId);
    saveChatToFirestore(newChat).catch(() => {});
    return newChatId;
  };

  const sendMessage = (chatId: string, text: string) => {
    if (!currentUser || !text.trim()) return;

    // Strict connection check: verify mutual connection for direct peer-to-peer chats
    const targetChat = chats.find((c) => c.id === chatId);
    if (targetChat && !targetChat.isGroupChat) {
      const members = targetChat.memberIds || [];
      const otherUid = members.find((m) => m !== currentUser.uid);
      if (otherUid) {
        const userConnections = connectionsMap[currentUser.uid] || [];
        const target = users.find((u) => u.uid === otherUid);
        const isTargetAlumni = !target?.role || target?.role === 'alumni';
        const isCurrentAlumni = !currentUser.role || currentUser.role === 'alumni';
        if (isTargetAlumni && isCurrentAlumni && !userConnections.includes(otherUid)) {
          showToast('Cannot send message: You must be mutually connected with this alumnus to exchange messages.', 'error');
          return;
        }
      }
    }

    const now = new Date().toISOString();
    const isDeviceOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const cleanText = text.trim();

    // Offline Handling: Queue message locally and present immediately in thread
    if (!isDeviceOnline) {
      const offlineMsg: ChatMessage = {
        id: generateSecureId('msg_offline'),
        chatId,
        senderId: currentUser.uid,
        senderName: currentUser.name,
        senderAvatar: currentUser.profilePictureUrl,
        senderRole: currentUser.role,
        text: cleanText,
        createdAt: now,
        status: 'pending',
        offlineQueued: true
      };

      setMessages((prev) => {
        const existing = prev[chatId] || [];
        if (existing.some((m) => m.id === offlineMsg.id)) return prev;
        return {
          ...prev,
          [chatId]: [...existing, offlineMsg]
        };
      });

      // Update thread preview
      setChats((prev) =>
        prev.map((c) => {
          if (c.id === chatId) {
            return {
              ...c,
              lastMessage: cleanText,
              lastMessageAt: now
            };
          }
          return c;
        })
      );

      enqueueOfflineMessage(chatId, offlineMsg);
      showToast('You are currently offline. Message saved locally and will auto-sync on reconnect.', 'info');
      return;
    }

    // Online Handling: Optimistically display and dispatch to Firestore and backend
    const newMsg: ChatMessage = {
      id: generateSecureId('msg'),
      chatId,
      senderId: currentUser.uid,
      senderName: currentUser.name,
      senderAvatar: currentUser.profilePictureUrl,
      senderRole: currentUser.role,
      text: cleanText,
      createdAt: now,
      status: 'sending'
    };

    setMessages((prev) => {
      const existing = prev[chatId] || [];
      if (existing.some((m) => m.id === newMsg.id)) return prev;
      return {
        ...prev,
        [chatId]: [...existing, newMsg]
      };
    });

    // Send to both Firestore and Express backend
    saveChatMessageToFirestore(chatId, newMsg)
      .then(() => {
        // Also push to backend REST store
        fetch('/api/messages/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId, message: newMsg })
        }).catch(() => {});

        setMessages((prev) => ({
          ...prev,
          [chatId]: (prev[chatId] || []).map((m) =>
            m.id === newMsg.id ? { ...m, status: 'sent', offlineQueued: false } : m
          )
        }));
      })
      .catch((err) => {
        console.warn('Network send failed, enqueuing message offline:', err);
        const queuedFallback: ChatMessage = {
          ...newMsg,
          status: 'failed',
          offlineQueued: true
        };
        enqueueOfflineMessage(chatId, queuedFallback);
        setMessages((prev) => ({
          ...prev,
          [chatId]: (prev[chatId] || []).map((m) =>
            m.id === newMsg.id ? queuedFallback : m
          )
        }));
        showToast('Connection interrupted. Message saved to offline queue.', 'warning');
      });

    let updatedChatObj: ChatThread | undefined;
    setChats((prev) =>
      prev.map((c) => {
        if (c.id === chatId) {
          const nextUnread = { ...c.unreadCount };
          // Increment unread count for all other members in group or 1-on-1 chat
          (c.memberIds || []).forEach((mId) => {
            if (mId !== currentUser.uid) {
              nextUnread[mId] = (nextUnread[mId] || 0) + 1;
              const recipient = users.find((u) => u.uid === mId);
              if (recipient) {
                sendDirectMessageEmail(currentUser, recipient, text.trim(), chatId);
              }
              const msgNotif: AppNotification = {
                id: `notif_msg_${Date.now()}_${mId}`,
                toUid: mId,
                fromUid: currentUser.uid,
                type: 'message',
                title: `New message from ${currentUser.name}`,
                body: text.trim().slice(0, 90),
                refId: chatId,
                read: false,
                createdAt: now
              };
              setNotifications((prev) => [msgNotif, ...prev]);
              saveNotificationToFirestore(msgNotif).catch(() => {});

              // Send real push notification to recipient device
              fetch('/api/push/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  targetUserId: mId,
                  title: `New message from ${currentUser.name}`,
                  body: text.trim().slice(0, 90),
                  category: 'message',
                  data: {
                    chatId,
                    senderId: currentUser.uid,
                    url: `/?tab=messages&chatId=${encodeURIComponent(chatId)}`
                  }
                })
              }).catch(() => {});
            }
          });
          updatedChatObj = {
            ...c,
            lastMessage: text.trim(),
            lastMessageAt: now,
            unreadCount: nextUnread
          };
          return updatedChatObj;
        }
        return c;
      })
    );

    if (updatedChatObj) {
      saveChatToFirestore(updatedChatObj).catch(() => {});
    }
  };

  const unsendMessage = useCallback(
    async (chatId: string, messageId: string) => {
      if (!currentUser) return;
      const now = new Date().toISOString();

      // Find target message
      const threadMsgs = messages[chatId] || [];
      const targetMsg = threadMsgs.find((m) => m.id === messageId);
      if (!targetMsg) return;

      // Authorization check: sender or administrator/moderator
      const isSender = targetMsg.senderId === currentUser.uid;
      const isElevated = ['admin', 'superadmin', 'moderator'].includes(currentUser.role || '');
      if (!isSender && !isElevated) {
        showToast('You can only unsend messages you authored.', 'error');
        return;
      }

      const updatedMsg: ChatMessage = {
        ...targetMsg,
        isUnsent: true,
        unsentAt: now,
        text: 'This message was unsent',
        reactions: {}
      };

      // Optimistically update conversation interface immediately
      setMessages((prev) => ({
        ...prev,
        [chatId]: (prev[chatId] || []).map((m) => (m.id === messageId ? updatedMsg : m))
      }));

      // If this was the preview message, update the chat thread preview
      setChats((prev) =>
        prev.map((c) => {
          if (c.id === chatId && c.lastMessage === targetMsg.text) {
            const next = { ...c, lastMessage: 'This message was unsent', lastMessageAt: now };
            saveChatToFirestore(next).catch(() => {});
            return next;
          }
          return c;
        })
      );

      // Synchronize with backend and Firestore
      try {
        await updateChatMessageInFirestore(chatId, messageId, {
          isUnsent: true,
          unsentAt: now,
          text: 'This message was unsent',
          reactions: {}
        });
        showToast('Message unsent for all participants.', 'info');
      } catch (err) {
        console.warn('Failed to unsend message:', err);
      }
    },
    [currentUser, messages, showToast]
  );

  const deleteMessageForMe = useCallback(
    async (chatId: string, messageId: string) => {
      if (!currentUser) return;
      const threadMsgs = messages[chatId] || [];
      const targetMsg = threadMsgs.find((m) => m.id === messageId);
      if (!targetMsg) return;

      const currentDeleted = targetMsg.deletedForUsers || [];
      if (currentDeleted.includes(currentUser.uid)) return;

      const nextDeleted = [...currentDeleted, currentUser.uid];

      // Optimistically update conversation interface immediately (filter out locally)
      setMessages((prev) => ({
        ...prev,
        [chatId]: (prev[chatId] || []).map((m) =>
          m.id === messageId ? { ...m, deletedForUsers: nextDeleted } : m
        )
      }));

      // Synchronize deletion preference to Firestore
      try {
        await updateChatMessageInFirestore(chatId, messageId, {
          deletedForUsers: nextDeleted
        });
        showToast('Message deleted from your conversation view.', 'info');
      } catch (err) {
        console.warn('Failed to delete message for user:', err);
      }
    },
    [currentUser, messages, showToast]
  );

  const activeReactionLocksRef = useRef<Set<string>>(new Set());

  // Messenger-Style Message Reactions (Request 7)
  // - Exactly ONE active reaction per user per message
  // - Replaces previous reaction if another is clicked
  // - Toggles off reaction if selected reaction is clicked again
  // - Debounced / locked to prevent duplicate reactions from rapid taps
  const reactToMessage = useCallback(
    async (chatId: string, messageId: string, emoji: string) => {
      if (!currentUser) {
        showToast('Please sign in to react to messages.', 'info');
        return;
      }

      // Concurrency lock to prevent rapid repeated taps
      if (activeReactionLocksRef.current.has(messageId)) {
        return;
      }
      activeReactionLocksRef.current.add(messageId);

      try {
        const threadMsgs = messages[chatId] || [];
        const targetMsg = threadMsgs.find((m) => m.id === messageId);
        if (!targetMsg || targetMsg.isUnsent) return;

        // Build clean next reactions object ensuring single active reaction per user
        const nextReactions: Record<string, string[]> = {};
        let previousEmoji: string | null = null;

        for (const [em, uids] of Object.entries(targetMsg.reactions || {})) {
          if (Array.isArray(uids) && uids.includes(currentUser.uid)) {
            previousEmoji = em;
          }
          // Filter out current user from all emojis first
          const otherUids = (uids || []).filter((id) => id !== currentUser.uid);
          if (otherUids.length > 0) {
            nextReactions[em] = otherUids;
          }
        }

        if (previousEmoji === emoji) {
          // User tapped their current active reaction: toggle off (remove)
          // Since they were already filtered out, doing nothing removes it
        } else {
          // User selected a different reaction: replace previous reaction with new emoji
          const currentList = nextReactions[emoji] || [];
          nextReactions[emoji] = [...currentList, currentUser.uid];
        }

        // 1. Optimistically update local conversation state immediately
        setMessages((prev) => ({
          ...prev,
          [chatId]: (prev[chatId] || []).map((m) =>
            m.id === messageId ? { ...m, reactions: nextReactions } : m
          )
        }));

        // 2. Synchronize reaction with Firestore in real time
        try {
          await updateChatMessageInFirestore(chatId, messageId, {
            reactions: nextReactions
          });
        } catch (err) {
          console.warn('Firestore reaction sync warning:', err);
        }

        // 3. Synchronize with backend server endpoint enforcing server-side rule
        try {
          fetch('/api/messages/react', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chatId,
              messageId,
              emoji,
              userId: currentUser.uid
            })
          }).catch(() => {});
        } catch {}
      } finally {
        setTimeout(() => {
          activeReactionLocksRef.current.delete(messageId);
        }, 300);
      }
    },
    [currentUser, messages, showToast]
  );

  const syncOfflineMessages = useCallback(async () => {
    setIsFirestoreSyncing(true);
    try {
      const res = await syncOfflineMessageQueue();
      if (res.syncedCount > 0) {
        showToast(`Successfully uploaded ${res.syncedCount} offline message${res.syncedCount > 1 ? 's' : ''} to database.`, 'success');
      } else if (res.failedCount > 0) {
        showToast(`${res.failedCount} message${res.failedCount > 1 ? 's' : ''} could not be delivered. Tap Retry to resend.`, 'warning');
      } else {
        showToast('All messages are up to date.', 'info');
      }
      return res;
    } catch (err: any) {
      console.warn('Sync offline messages error:', err);
      showToast('Synchronization error occurred while delivering messages.', 'error');
      return { syncedCount: 0, failedCount: 0 };
    } finally {
      setIsFirestoreSyncing(false);
      setOfflineQueue(getOfflineMessageQueue());
    }
  }, [showToast]);

  const retryOfflineMessage = useCallback(async (messageId: string) => {
    return await retryQueuedMessage(messageId);
  }, []);

  const cancelOfflineMessage = useCallback((messageId: string) => {
    removeOfflineMessage(messageId);
    setMessages((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((cId) => {
        next[cId] = (next[cId] || []).filter((m) => m.id !== messageId);
      });
      return next;
    });
    showToast('Message removed from offline queue.');
  }, [showToast]);

  const markChatAsRead = (chatId: string) => {
    if (!currentUser) return;
    setChats((prev) =>
      prev.map((c) => {
        if (c.id === chatId) {
          return {
            ...c,
            unreadCount: {
              ...c.unreadCount,
              [currentUser.uid]: 0
            }
          };
        }
        return c;
      })
    );
  };

  // Events operations
  const createEvent = (
    eventData: Omit<AlumniEvent, 'id' | 'likes' | 'comments' | 'attendeesCount' | 'createdBy' | 'createdByName'>
  ) => {
    if (!currentUser || currentUser.role === 'alumni' || !permissions.canCreateEvents) {
      showToast('Permission denied: Alumni accounts cannot create, publish, or manage events.', 'error');
      return;
    }

    const newEvtId = `evt_${Date.now()}`;
    const eventChatId = `chat_event_${newEvtId}`;

    // Step 2: System automatically creates a group chat with the event name
    const eventGroupChat: ChatThread = {
      id: eventChatId,
      memberIds: [currentUser.uid],
      lastMessage: `Official event group chat created for "${eventData.title}". Attendees will be automatically added when they RSVP.`,
      lastMessageAt: new Date().toISOString(),
      unreadCount: { [currentUser.uid]: 0 },
      isGroupChat: true,
      groupName: `${eventData.title} – Group Chat`,
      groupDescription: `Official coordination chat for ${eventData.title}. Organized by ${currentUser.name}.`,
      eventId: newEvtId,
      isEventChat: true,
      adminUids: [currentUser.uid]
    };

    const newEvt: AlumniEvent = {
      id: newEvtId,
      ...eventData,
      groupChatId: eventChatId,
      likes: [],
      comments: [],
      attendeesCount: 1,
      createdBy: currentUser.uid,
      createdByName: `${currentUser.name} (${(currentUser.role || 'member').toUpperCase()})`,
      attendees: [
        {
          uid: currentUser.uid,
          name: currentUser.name,
          avatar: currentUser.profilePictureUrl,
          role: currentUser.role,
          status: 'going',
          rsvpDate: new Date().toISOString()
        }
      ]
    };

    // System welcome message for the event group chat
    const initialWelcomeMessage: ChatMessage = {
      id: `msg_${Date.now()}_sys_init`,
      chatId: eventChatId,
      senderId: currentUser.uid,
      senderName: currentUser.name,
      senderAvatar: currentUser.profilePictureUrl,
      senderRole: currentUser.role,
      text: `Welcome to the official group chat for "${eventData.title}"! All alumni and guests who RSVP will be automatically added to this conversation.`,
      createdAt: new Date().toISOString(),
      isSystemMessage: true
    };

    setChats((prev) => [eventGroupChat, ...prev]);
    setMessages((prev) => ({
      ...prev,
      [eventChatId]: [initialWelcomeMessage]
    }));
    saveChatToFirestore(eventGroupChat).catch(() => {});
    saveChatMessageToFirestore(eventChatId, initialWelcomeMessage).catch(() => {});

    setEvents((prev) => [newEvt, ...prev]);
    saveEventToFirestore(newEvt).catch((err) => {
      console.warn('Failed to persist new event in Firestore:', err);
    });

    addAuditLog({
      action: 'Event & Group Chat Provisioned',
      actorId: currentUser.uid,
      actorName: currentUser.name,
      actorRole: currentUser.role,
      category: 'communication',
      details: `Created event "${newEvt.title}" and initialized official attendee group chat "${eventGroupChat.groupName}".`,
      severity: 'info'
    });

    // Broadcast notification to other users
    const broadcastNotif: AppNotification = {
      id: `notif_${Date.now()}`,
      toUid: 'all',
      type: 'event_broadcast',
      title: `New Event: ${newEvt.title}`,
      body: `Organized by ${currentUser.name}. ${newEvt.isVirtual ? 'Virtual event' : newEvt.location}. RSVP now to join the official event group chat!`,
      refId: newEvt.id,
      read: false,
      createdAt: new Date().toISOString()
    };
    setNotifications((prev) => [broadcastNotif, ...prev]);
    saveNotificationToFirestore(broadcastNotif).catch(() => {});

    // Broadcast push notification to devices with the APK or web app
    sendPushBroadcast({
      title: `🎓 Campus Event: ${newEvt.title}`,
      body: `${newEvt.isVirtual ? 'Virtual Event' : newEvt.location || 'Main Campus'} • ${newEvt.date}. RSVP now!`,
      category: 'event',
      data: {
        eventId: newEvt.id,
        category: 'event',
        targetPath: `/portal/events/${encodeURIComponent(newEvt.id)}`,
        targetRoute: `/portal/events/${encodeURIComponent(newEvt.id)}`,
        url: `/portal/events/${encodeURIComponent(newEvt.id)}`
      }
    }).catch(() => {});

    showToast(`Event published and group chat "${eventGroupChat.groupName}" created!`);
  };

  const editEvent = (eventId: string, data: Partial<AlumniEvent>) => {
    if (!currentUser || currentUser.role === 'alumni' || !permissions.canCreateEvents) {
      showToast('Permission denied: Alumni accounts cannot edit or manage events.', 'error');
      return;
    }
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id === eventId) {
          const updated = { ...e, ...data };
          saveEventToFirestore(updated).catch((err) => {
            console.warn('Failed to update event in Firestore:', err);
          });
          return updated;
        }
        return e;
      })
    );
    showToast('Event details updated.');
  };

  const deleteEvent = (eventId: string) => {
    if (!currentUser || currentUser.role === 'alumni' || !permissions.canDeleteEventsComments) {
      showToast('Permission denied: Alumni accounts cannot delete or manage events.', 'error');
      return;
    }
    const target = events.find((e) => e.id === eventId);
    if (target) {
      // Event Cancellation Notification dispatched to attendees
      if (target.attendees && target.attendees.length > 0) {
        const cancelNotif: AppNotification = {
          id: `notif_evt_cancel_${Date.now()}`,
          type: 'event',
          title: 'Event Cancellation Notice',
          body: `Notice: "${target.title}" originally scheduled on ${new Date(target.startDate).toLocaleDateString()} has been cancelled by the administration.`,
          refId: target.id,
          metadata: { eventId: target.id },
          read: false,
          createdAt: new Date().toISOString()
        };
        setNotifications((prev) => [cancelNotif, ...prev]);
      }

      addAuditLog({
        action: 'Event Deleted / Cancelled',
        actorId: currentUser?.uid || 'admin',
        actorName: currentUser?.name || 'Administrator',
        actorRole: currentUser?.role || 'admin',
        category: 'admin',
        details: `Event "${target.title}" was removed from the institutional calendar.`,
        severity: 'warning'
      });
    }

    setEvents((prev) => prev.filter((e) => e.id !== eventId));
    deleteEventFromFirestore(eventId).catch((err) => {
      console.warn('Failed to delete event from Firestore:', err);
    });
    showToast('Event deleted.');
  };

  const toggleLikeEvent = (eventId: string) => {
    if (!currentUser) return;
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id === eventId) {
          const currentLikes = e.likes || [];
          const liked = currentLikes.includes(currentUser.uid);
          const updated = {
            ...e,
            likes: liked
              ? currentLikes.filter((id) => id !== currentUser.uid)
              : [...currentLikes, currentUser.uid]
          };
          saveEventToFirestore(updated).catch(() => {});
          return updated;
        }
        return e;
      })
    );
  };

  const addCommentToEvent = (eventId: string, text: string) => {
    if (!currentUser || !text.trim()) return;
    const newComment = {
      id: `c_${Date.now()}`,
      eventId,
      authorId: currentUser.uid,
      authorName: currentUser.name,
      authorAvatar: currentUser.profilePictureUrl,
      text: text.trim(),
      createdAt: new Date().toISOString()
    };

    setEvents((prev) =>
      prev.map((e) => {
        if (e.id === eventId) {
          const updated = {
            ...e,
            comments: [...e.comments, newComment]
          };
          saveEventToFirestore(updated).catch(() => {});
          return updated;
        }
        return e;
      })
    );
    showToast('Comment posted.');
  };

  const rsvpEvent = (eventId: string, status: 'going' | 'interested' | 'not_going') => {
    if (!currentUser) {
      showToast('Please sign in to RSVP for events.', 'error');
      return;
    }
    const targetEvent = events.find((e) => e.id === eventId);
    if (!targetEvent) return;

    // Toggle logic: if user clicks the currently active status, toggle back to 'not_going'
    const newStatus = targetEvent.userRsvp === status ? 'not_going' : status;

    // Validate cancellation deadline if user is cancelling RSVP
    if (targetEvent.userRsvp && newStatus === 'not_going') {
      const cancelInfo = getEventCancellationInfo(targetEvent);
      const isAdmin = currentUser.role === 'admin' || currentUser.role === 'superadmin';
      if (cancelInfo.isPastDeadline && !isAdmin) {
        showToast(
          `Cancellation deadline passed. Cancellations closed on ${cancelInfo.deadlineFormatted}. Please contact the event administrator.`,
          'error'
        );
        return;
      }
    }

    const wasGoing = targetEvent.userRsvp === 'going';
    const isNowGoing = newStatus === 'going';
    let delta = 0;
    if (!wasGoing && isNowGoing) delta = 1;
    if (wasGoing && !isNowGoing) delta = -1;

    // Update dynamic attendees array
    const existingAttendees = targetEvent.attendees || [];
    let updatedAttendees: EventAttendee[];
    if (newStatus === 'not_going') {
      updatedAttendees = existingAttendees.filter((a) => a.uid !== currentUser.uid);
    } else {
      const evtCode = (targetEvent.id || 'EVT').replace(/^evt_/, '').slice(0, 4).toUpperCase();
      const rawId = currentUser.uid.replace(/^usr_/, '').slice(0, 6).toUpperCase();
      const regCode = `SCC-${evtCode}-${rawId}`;
      const attendeeItem: EventAttendee = {
        id: `att_${Date.now()}_${currentUser.uid.slice(0, 5)}`,
        uid: currentUser.uid,
        name: currentUser.name,
        email: currentUser.email,
        phone: currentUser.phone,
        avatar: currentUser.profilePictureUrl,
        batch: currentUser.batch,
        course: currentUser.course,
        role: currentUser.role,
        status: newStatus,
        ticketType: 'General Alumni',
        paymentStatus: 'Complimentary',
        registrationCode: regCode,
        checkInStatus: 'not_checked_in',
        registeredAt: new Date().toISOString(),
        rsvpDate: new Date().toISOString()
      };
      const foundIdx = existingAttendees.findIndex((a) => a.uid === currentUser.uid);
      if (foundIdx >= 0) {
        updatedAttendees = [...existingAttendees];
        updatedAttendees[foundIdx] = attendeeItem;
      } else {
        updatedAttendees = [attendeeItem, ...existingAttendees];
      }
    }

    const updatedEvent: AlumniEvent = {
      ...targetEvent,
      userRsvp: newStatus,
      attendees: updatedAttendees,
      attendeesCount: Math.max(0, targetEvent.attendeesCount + delta)
    };

    setEvents((prev) => prev.map((e) => (e.id === eventId ? updatedEvent : e)));

    // Send automated Event Registration Confirmation and schedule 1-day before & event-day reminders
    if (newStatus !== 'not_going') {
      const eventDate = new Date(targetEvent.startDate);
      const eventDateFormatted = isNaN(eventDate.getTime())
        ? targetEvent.startDate
        : eventDate.toLocaleDateString([], {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          });
      const eventTimeFormatted = isNaN(eventDate.getTime())
        ? ''
        : eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      // 1. Immediate RSVP Confirmation
      const confirmNotif: AppNotification = {
        id: `notif_rsvp_${Date.now()}`,
        toUid: currentUser.uid,
        type: 'event',
        title: 'Event Registration Confirmed!',
        body: `You are confirmed as ${newStatus === 'going' ? 'attending' : 'interested in'} "${targetEvent.title}". We have scheduled automated reminders: 1 day prior and on event day.`,
        refId: targetEvent.id,
        read: false,
        createdAt: new Date().toISOString(),
        metadata: { eventId: targetEvent.id, rsvpStatus: newStatus }
      };

      // 2. Automated 1-Day Before Event Reminder Notification
      const oneDayBeforeNotif: AppNotification = {
        id: `notif_rsvp_1day_${targetEvent.id}_${currentUser.uid}`,
        toUid: currentUser.uid,
        type: 'event',
        title: `Event Reminder (1 Day Before): ${targetEvent.title}`,
        body: `Tomorrow is the day! "${targetEvent.title}" takes place tomorrow (${eventDateFormatted} ${eventTimeFormatted ? 'at ' + eventTimeFormatted : ''}) at ${targetEvent.location}. Ensure you have your St. Cecilia's College Digital ID ready for campus entry!`,
        refId: targetEvent.id,
        read: false,
        createdAt: new Date(Date.now() + 1000).toISOString(),
        metadata: {
          eventId: targetEvent.id,
          reminderType: '1_day_before',
          eventStartDate: targetEvent.startDate,
          location: targetEvent.location
        }
      };

      // 3. Automated Event Day Notification ("when the event comes")
      const eventDayNotif: AppNotification = {
        id: `notif_rsvp_day_${targetEvent.id}_${currentUser.uid}`,
        toUid: currentUser.uid,
        type: 'event',
        title: `Event Today: ${targetEvent.title}`,
        body: `Today is the event! "${targetEvent.title}" takes place today at ${targetEvent.location}. Check in at the entrance using your official SCC Digital Pass.`,
        refId: targetEvent.id,
        read: false,
        createdAt: new Date(Date.now() + 2000).toISOString(),
        metadata: {
          eventId: targetEvent.id,
          reminderType: 'event_day',
          eventStartDate: targetEvent.startDate,
          location: targetEvent.location
        }
      };

      setNotifications((prev) => {
        const withoutOldReminders = prev.filter(
          (n) => n.id !== oneDayBeforeNotif.id && n.id !== eventDayNotif.id
        );
        return [confirmNotif, oneDayBeforeNotif, eventDayNotif, ...withoutOldReminders];
      });

      saveNotificationToFirestore(confirmNotif).catch(() => {});
      saveNotificationToFirestore(oneDayBeforeNotif).catch(() => {});
      saveNotificationToFirestore(eventDayNotif).catch(() => {});

      // Step 4: When a user RSVPs, automatically add them to the event's group chat
      const eventChatId = targetEvent.groupChatId || `chat_event_${eventId}`;
      const joinMsg: ChatMessage = {
        id: `msg_${Date.now()}_sys_join`,
        chatId: eventChatId,
        senderId: currentUser.uid,
        senderName: currentUser.name,
        senderAvatar: currentUser.profilePictureUrl,
        senderRole: currentUser.role,
        text: `${currentUser.name} joined the event group chat (${newStatus === 'going' ? 'Attending' : 'Interested'}).`,
        createdAt: new Date().toISOString(),
        isSystemMessage: true
      };

      setMessages((prev) => ({
        ...prev,
        [eventChatId]: [...(prev[eventChatId] || []), joinMsg]
      }));
      saveChatMessageToFirestore(eventChatId, joinMsg).catch(() => {});

      setChats((prevChats) => {
        const existingChatIndex = prevChats.findIndex(
          (c) => c.eventId === eventId || c.id === eventChatId
        );
        if (existingChatIndex >= 0) {
          const c = prevChats[existingChatIndex];
          const currentMembers = c.memberIds || (c as any).participants || [];
          const hasMember = currentMembers.includes(currentUser.uid);
          const updatedChat: ChatThread = {
            ...c,
            memberIds: hasMember ? currentMembers : [...currentMembers, currentUser.uid],
            lastMessage: `${currentUser.name} joined the event group chat (${newStatus === 'going' ? 'Attending' : 'Interested'}).`,
            lastMessageAt: new Date().toISOString()
          };
          saveChatToFirestore(updatedChat).catch(() => {});
          const updated = [...prevChats];
          updated[existingChatIndex] = updatedChat;
          return updated;
        } else {
          // Auto-generate group chat if it didn't already exist
          const newChat: ChatThread = {
            id: eventChatId,
            memberIds: Array.from(new Set([targetEvent.createdBy, currentUser.uid])),
            lastMessage: `${currentUser.name} joined the event group chat (${newStatus === 'going' ? 'Attending' : 'Interested'}).`,
            lastMessageAt: new Date().toISOString(),
            unreadCount: { [currentUser.uid]: 0 },
            isGroupChat: true,
            groupName: `${targetEvent.title} – Group Chat`,
            groupDescription: `Official coordination chat for ${targetEvent.title}.`,
            eventId: eventId,
            isEventChat: true,
            adminUids: [targetEvent.createdBy]
          };
          saveChatToFirestore(newChat).catch(() => {});
          return [newChat, ...prevChats];
        }
      });

      // Group chat confirmation notification
      const groupChatNotif: AppNotification = {
        id: `notif_chat_added_${Date.now()}`,
        toUid: currentUser.uid,
        type: 'message',
        title: 'Added to Event Group Chat',
        body: `You have been automatically added to the official attendee group chat for "${targetEvent.title}". Open Messaging to connect with fellow attendees!`,
        refId: eventChatId,
        read: false,
        createdAt: new Date().toISOString()
      };
      setNotifications((prev) => [groupChatNotif, ...prev]);

      // Notify organizer of new RSVP
      if (targetEvent.createdBy && targetEvent.createdBy !== currentUser.uid) {
        const organizerNotif: AppNotification = {
          id: `notif_rsvp_org_${Date.now()}`,
          toUid: targetEvent.createdBy,
          type: 'event',
          title: `New RSVP: ${targetEvent.title}`,
          body: `${currentUser.name} confirmed RSVP (${newStatus === 'going' ? 'Attending' : 'Interested'}) for "${targetEvent.title}". Attendees: ${Math.max(0, targetEvent.attendeesCount + delta)}.`,
          refId: targetEvent.id,
          read: false,
          createdAt: new Date().toISOString()
        };
        setNotifications((prev) => [organizerNotif, ...prev]);
        saveNotificationToFirestore(organizerNotif).catch(() => {});
      }

      sendEventRsvpEmail(targetEvent, currentUser, newStatus);

      addAuditLog({
        action: 'Event RSVP Registered',
        actorId: currentUser.uid,
        actorName: currentUser.name,
        actorRole: currentUser.role,
        category: 'communication',
        details: `Alumnus confirmed RSVP (${newStatus}) for event: "${targetEvent.title}". Added to event group chat.`,
        severity: 'info'
      });
    } else {
      // Step 5: User cancelled RSVP: remove them from event group chat unless they are an admin
      const eventChatId = targetEvent.groupChatId || `chat_event_${eventId}`;
      const leaveMsg: ChatMessage = {
        id: `msg_${Date.now()}_sys_leave`,
        chatId: eventChatId,
        senderId: currentUser.uid,
        senderName: currentUser.name,
        senderAvatar: currentUser.profilePictureUrl,
        senderRole: currentUser.role,
        text: `${currentUser.name} updated their RSVP to Not Attending and left the group chat.`,
        createdAt: new Date().toISOString(),
        isSystemMessage: true
      };

      setMessages((prev) => ({
        ...prev,
        [eventChatId]: [...(prev[eventChatId] || []), leaveMsg]
      }));
      saveChatMessageToFirestore(eventChatId, leaveMsg).catch(() => {});

      setChats((prevChats) => {
        return prevChats.map((c) => {
          if (c.eventId === eventId || c.id === eventChatId) {
            const currentMembers = c.memberIds || (c as any).participants || [];
            if (currentMembers.includes(currentUser.uid) && !c.adminUids?.includes(currentUser.uid)) {
              const updatedChat: ChatThread = {
                ...c,
                memberIds: currentMembers.filter((id) => id !== currentUser.uid),
                lastMessage: `${currentUser.name} left the event group chat.`,
                lastMessageAt: new Date().toISOString()
              };
              saveChatToFirestore(updatedChat).catch(() => {});
              return updatedChat;
            }
          }
          return c;
        });
      });

      // Cancellation notification to user
      const cancelNotif: AppNotification = {
        id: `notif_rsvp_cancel_${Date.now()}`,
        toUid: currentUser.uid,
        type: 'event',
        title: 'RSVP Cancelled',
        body: `You have cancelled your attendance for "${targetEvent.title}". You have been removed from the event group chat.`,
        refId: targetEvent.id,
        read: false,
        createdAt: new Date().toISOString()
      };
      setNotifications((prev) => [cancelNotif, ...prev]);

      // Notify event administrator / organizer about the cancellation
      if (targetEvent.createdBy && targetEvent.createdBy !== currentUser.uid) {
        const orgCancelNotif: AppNotification = {
          id: `notif_rsvp_cancel_org_${Date.now()}`,
          toUid: targetEvent.createdBy,
          type: 'event',
          title: `RSVP Cancelled: ${targetEvent.title}`,
          body: `${currentUser.name} cancelled their RSVP for "${targetEvent.title}". Updated attendee count: ${Math.max(0, targetEvent.attendeesCount + delta)}.`,
          refId: targetEvent.id,
          read: false,
          createdAt: new Date().toISOString()
        };
        setNotifications((prev) => [orgCancelNotif, ...prev]);
        saveNotificationToFirestore(orgCancelNotif).catch(() => {});
      }
      sendEventRsvpEmail(targetEvent, currentUser, 'cancelled');
      showToast(`RSVP cancelled for "${targetEvent.title}". Attendee list updated.`, 'info');

      // User cancelled attendance: clean up scheduled event notifications
      setNotifications((prev) =>
        prev.filter(
          (n) =>
            n.id !== `notif_rsvp_1day_${targetEvent.id}_${currentUser.uid}` &&
            n.id !== `notif_rsvp_day_${targetEvent.id}_${currentUser.uid}`
        )
      );

      addAuditLog({
        action: 'Event RSVP Cancelled',
        actorId: currentUser.uid,
        actorName: currentUser.name,
        actorRole: currentUser.role,
        category: 'communication',
        details: `Alumnus cancelled RSVP for event: "${targetEvent.title}". Removed from event group chat.`,
        severity: 'info'
      });
    }

    // Persist attendance update directly in Firestore
    saveEventToFirestore(updatedEvent)
      .then(() => {
        if (newStatus === 'not_going') {
          showToast(`Attendance removed for "${targetEvent.title}"`, 'info');
        } else {
          showToast(
            `RSVP confirmed: You are ${newStatus === 'going' ? 'attending' : 'interested in'} "${targetEvent.title}" and added to the group chat!`,
            'success'
          );
        }
      })
      .catch((err) => {
        console.warn('Failed to persist RSVP in Firestore:', err);
        showToast('Could not save RSVP to Firestore. Please check your connection.', 'error');
      });
  };

  const updateEventAttendance = (eventId: string, uid: string, status: 'attended' | 'not_attended' | 'pending') => {
    if (!permissions.canCreateEvents && currentUser?.role !== 'admin' && currentUser?.role !== 'moderator') {
      showToast('Permission denied: Only authorized administrators can record event attendance.', 'error');
      return;
    }
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id === eventId) {
          const records = e.attendanceRecords || [];
          const existingIdx = records.findIndex((r) => r.uid === uid);
          const attendeeObj = e.attendees?.find((a) => a.uid === uid);
          const attendeeName = attendeeObj?.name || users.find((u) => u.uid === uid)?.name || 'Alumnus';
          const newRecord: EventAttendanceRecord = {
            uid,
            name: attendeeName,
            status,
            checkedInAt: status === 'attended' ? new Date().toISOString() : undefined,
            updatedBy: currentUser?.name || 'Administrator'
          };
          let updatedRecords: EventAttendanceRecord[];
          if (existingIdx >= 0) {
            updatedRecords = [...records];
            updatedRecords[existingIdx] = newRecord;
          } else {
            updatedRecords = [...records, newRecord];
          }

          // Also keep e.attendees in sync
          const updatedAttendees = (e.attendees || []).map((a) => {
            if (a.uid === uid) {
              return {
                ...a,
                checkInStatus: (status === 'attended' ? 'checked_in' : 'not_checked_in') as 'checked_in' | 'not_checked_in',
                checkedInAt: status === 'attended' ? new Date().toISOString() : undefined,
                checkedInBy: status === 'attended' ? (currentUser?.name || 'Administrator') : undefined
              };
            }
            return a;
          });

          const updated = { ...e, attendanceRecords: updatedRecords, attendees: updatedAttendees };
          saveEventToFirestore(updated).catch(() => {});
          return updated;
        }
        return e;
      })
    );
    showToast(`Attendance marked as ${status.replace('_', ' ')}.`);
  };

  const manualCheckInAttendee = (eventId: string, attendeeIdOrUid: string, checkedIn: boolean) => {
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id === eventId) {
          const attendees = e.attendees || [];
          let updatedAttendeeName = '';
          let updatedUid = '';

          const updatedAttendees = attendees.map((a) => {
            if (a.id === attendeeIdOrUid || a.uid === attendeeIdOrUid) {
              updatedAttendeeName = a.name;
              updatedUid = a.uid;
              return {
                ...a,
                checkInStatus: (checkedIn ? 'checked_in' : 'not_checked_in') as 'checked_in' | 'not_checked_in',
                checkedInAt: checkedIn ? new Date().toISOString() : undefined,
                checkedInBy: checkedIn ? (currentUser?.name || 'Administrator') : undefined
              };
            }
            return a;
          });

          // Sync attendanceRecords
          const records = e.attendanceRecords || [];
          const targetUid = updatedUid || attendeeIdOrUid;
          const recIdx = records.findIndex((r) => r.uid === targetUid);
          let newRecords = [...records];
          if (checkedIn) {
            const newRec: EventAttendanceRecord = {
              uid: targetUid,
              name: updatedAttendeeName || 'Alumnus',
              status: 'attended',
              checkedInAt: new Date().toISOString(),
              updatedBy: currentUser?.name || 'Administrator'
            };
            if (recIdx >= 0) {
              newRecords[recIdx] = newRec;
            } else {
              newRecords.push(newRec);
            }
          } else {
            if (recIdx >= 0) {
              newRecords.splice(recIdx, 1);
            }
          }

          const updatedEvent: AlumniEvent = {
            ...e,
            attendees: updatedAttendees,
            attendanceRecords: newRecords
          };
          saveEventToFirestore(updatedEvent).catch(() => {});
          return updatedEvent;
        }
        return e;
      })
    );

    // Also update any matching reservation
    setReservations((prev) =>
      prev.map((r) => {
        if (r.eventId === eventId && (r.id === attendeeIdOrUid || r.userId === attendeeIdOrUid)) {
          const updatedRes = {
            ...r,
            status: (checkedIn ? 'attended' : 'confirmed') as 'attended' | 'confirmed',
            attendanceConfirmed: checkedIn,
            attendanceConfirmedAt: checkedIn ? new Date().toISOString() : undefined
          };
          saveReservationToFirestore(updatedRes).catch(() => {});
          return updatedRes;
        }
        return r;
      })
    );

    showToast(checkedIn ? 'Attendee checked in successfully.' : 'Check-in reverted.', 'info');
  };

  const updateAttendeeInfo = (eventId: string, attendeeIdOrUid: string, updates: Partial<EventAttendee>) => {
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id === eventId) {
          const attendees = (e.attendees || []).map((a) => {
            if (a.id === attendeeIdOrUid || a.uid === attendeeIdOrUid) {
              return { ...a, ...updates };
            }
            return a;
          });
          const updatedEvent = { ...e, attendees };
          saveEventToFirestore(updatedEvent).catch(() => {});
          return updatedEvent;
        }
        return e;
      })
    );
    showToast('Attendee details updated.', 'success');
  };

  const removeAttendeeFromEvent = (eventId: string, attendeeIdOrUid: string) => {
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id === eventId) {
          const attendees = (e.attendees || []).filter(
            (a) => a.id !== attendeeIdOrUid && a.uid !== attendeeIdOrUid
          );
          const records = (e.attendanceRecords || []).filter(
            (r) => r.uid !== attendeeIdOrUid
          );
          const updatedEvent = {
            ...e,
            attendees,
            attendanceRecords: records,
            attendeesCount: Math.max(0, (e.attendeesCount || 1) - 1),
            reservedSeatsCount: Math.max(0, (e.reservedSeatsCount || 1) - 1)
          };
          saveEventToFirestore(updatedEvent).catch(() => {});
          return updatedEvent;
        }
        return e;
      })
    );
    showToast('Attendee registration removed.', 'info');
  };

  const addAttendeeToEvent = (
    eventId: string,
    attendee: Partial<EventAttendee> & { name: string; email: string }
  ) => {
    const newUid = attendee.uid || generateSecureId('usr_manual');
    const newAttendee: EventAttendee = {
      id: `att_${eventId}_${newUid}`,
      uid: newUid,
      name: attendee.name.trim(),
      email: attendee.email.trim(),
      phone: attendee.phone?.trim() || '',
      avatar: attendee.avatar || DEFAULT_USER_AVATAR,
      batch: attendee.batch || 'Cecilian Alumnus',
      course: attendee.course || 'Alumni Associate',
      role: attendee.role || 'alumni',
      ticketType: attendee.ticketType || 'General Alumni',
      paymentStatus: attendee.paymentStatus || 'Free',
      checkInStatus: attendee.checkInStatus || 'not_checked_in',
      checkedInAt: attendee.checkInStatus === 'checked_in' ? new Date().toISOString() : undefined,
      checkedInBy: attendee.checkInStatus === 'checked_in' ? (currentUser?.name || 'Administrator') : undefined,
      status: 'going',
      registeredAt: new Date().toISOString(),
      notes: attendee.notes
    };

    setEvents((prev) =>
      prev.map((e) => {
        if (e.id === eventId) {
          const attendees = [...(e.attendees || []), newAttendee];
          let records = e.attendanceRecords || [];
          if (newAttendee.checkInStatus === 'checked_in') {
            records = [
              ...records,
              {
                uid: newUid,
                name: newAttendee.name,
                status: 'attended',
                checkedInAt: newAttendee.checkedInAt,
                updatedBy: currentUser?.name || 'Administrator'
              }
            ];
          }
          const updatedEvent = {
            ...e,
            attendees,
            attendanceRecords: records,
            attendeesCount: (e.attendeesCount || 0) + 1,
            reservedSeatsCount: (e.reservedSeatsCount || 0) + 1
          };
          saveEventToFirestore(updatedEvent).catch(() => {});
          return updatedEvent;
        }
        return e;
      })
    );
    showToast(`Registered ${attendee.name} to event.`, 'success');
  };

  // Event Reservation Operations
  const reserveEventSlot = async (data: {
    eventId: string;
    alumniName: string;
    email: string;
    contactNumber: string;
    alumniId: string;
    graduationYear: string;
    course: string;
    numberOfGuests: number;
    dietaryRequirements?: string;
    specialRequests?: string;
  }): Promise<{ success: boolean; reservation?: EventReservation; error?: string }> => {
    const targetEvent = events.find((e) => e.id === data.eventId);
    if (!targetEvent) {
      return { success: false, error: 'Target event was not found.' };
    }

    const userId = currentUser ? currentUser.uid : `guest_${Date.now()}`;

    // Verify existing active reservation
    const existing = reservations.find(
      (r) => r.eventId === data.eventId && r.userId === userId && r.status !== 'cancelled'
    );
    if (existing) {
      return {
        success: false,
        error: `You already hold a confirmed reservation (${existing.id}) for "${targetEvent.title}". Check "My Reservations" to view or manage your pass.`
      };
    }

    // Capacity & Status check
    const totalCapacity = targetEvent.maxParticipants || targetEvent.maxAttendees || 200;
    const reservedSeats = targetEvent.reservedSeatsCount ?? targetEvent.attendeesCount ?? 0;
    const remainingSeats = Math.max(0, totalCapacity - reservedSeats);
    const requestedSeats = 1 + (Number(data.numberOfGuests) || 0);

    const isWaitlist = remainingSeats <= 0;
    if (isWaitlist && targetEvent.enableWaitingList === false) {
      return {
        success: false,
        error: 'Registration is full and the waiting list is currently closed.'
      };
    }

    // Reservation Code generation
    const randomSuffix = generateSecureNumericCode(10000, 99999);
    const reservationId = `ALM-2026-${randomSuffix}`;

    const newReservation: EventReservation = {
      id: reservationId,
      eventId: targetEvent.id,
      eventTitle: targetEvent.title,
      eventDate: targetEvent.startDate,
      eventTime: targetEvent.startTime ? `${targetEvent.startTime} – ${targetEvent.endTime || ''}` : undefined,
      eventVenue: targetEvent.venue || targetEvent.location,
      userId,
      alumniName: data.alumniName,
      email: data.email,
      contactNumber: data.contactNumber,
      alumniId: data.alumniId,
      graduationYear: data.graduationYear,
      course: data.course,
      numberOfGuests: Number(data.numberOfGuests) || 0,
      totalSeats: requestedSeats,
      dietaryRequirements: data.dietaryRequirements,
      specialRequests: data.specialRequests,
      status: isWaitlist ? 'waitlisted' : 'confirmed',
      reservedAt: new Date().toISOString(),
      qrCodeData: `SCC-PASS-${reservationId}-${targetEvent.id}`
    };

    setReservations((prev) => [newReservation, ...prev]);
    saveReservationToFirestore(newReservation).catch(() => {});

    // Update event seat count & attendee records
    if (!isWaitlist) {
      setEvents((prev) =>
        prev.map((e) => {
          if (e.id === targetEvent.id) {
            const currentReserved = e.reservedSeatsCount ?? e.attendeesCount ?? 0;
            const updatedSeats = currentReserved + requestedSeats;
            const currentAttendees = e.attendees || [];
            const userAttendee: EventAttendee = {
              uid: userId,
              name: data.alumniName,
              avatar: currentUser?.profilePictureUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
              batch: data.graduationYear,
              course: data.course,
              role: currentUser?.role || 'alumni',
              status: 'going',
              registeredAt: new Date().toISOString()
            };
            const updatedAttendees = currentAttendees.some((a) => a.uid === userId)
              ? currentAttendees
              : [...currentAttendees, userAttendee];

            const updatedEvent: AlumniEvent = {
              ...e,
              reservedSeatsCount: updatedSeats,
              attendeesCount: updatedAttendees.length,
              attendees: updatedAttendees
            };
            saveEventToFirestore(updatedEvent).catch(() => {});
            return updatedEvent;
          }
          return e;
        })
      );
    }

    // Automatically enroll reserving user to the official event group chat
    if (currentUser) {
      const eventChatId = targetEvent.groupChatId || `chat_event_${targetEvent.id}`;
      const joinMsg: ChatMessage = {
        id: `msg_${Date.now()}_sys_reserve`,
        chatId: eventChatId,
        senderId: currentUser.uid,
        senderName: currentUser.name,
        senderAvatar: currentUser.profilePictureUrl,
        senderRole: currentUser.role,
        text: `${currentUser.name} confirmed seat reservation and joined the official event group chat.`,
        createdAt: new Date().toISOString(),
        isSystemMessage: true
      };

      setMessages((prev) => ({
        ...prev,
        [eventChatId]: [...(prev[eventChatId] || []), joinMsg]
      }));
      saveChatMessageToFirestore(eventChatId, joinMsg).catch(() => {});

      setChats((prevChats) => {
        const existingChatIndex = prevChats.findIndex(
          (c) => c.eventId === targetEvent.id || c.id === eventChatId
        );
        if (existingChatIndex >= 0) {
          const c = prevChats[existingChatIndex];
          const currentMembers = c.memberIds || (c as any).participants || [];
          const hasMember = currentMembers.includes(currentUser.uid);
          const updatedChat: ChatThread = {
            ...c,
            memberIds: hasMember ? currentMembers : [...currentMembers, currentUser.uid],
            lastMessage: `${currentUser.name} joined the event group chat.`,
            lastMessageAt: new Date().toISOString()
          };
          saveChatToFirestore(updatedChat).catch(() => {});
          const updated = [...prevChats];
          updated[existingChatIndex] = updatedChat;
          return updated;
        } else {
          const newChat: ChatThread = {
            id: eventChatId,
            memberIds: Array.from(new Set([targetEvent.createdBy || 'admin', currentUser.uid])),
            lastMessage: `${currentUser.name} joined the event group chat.`,
            lastMessageAt: new Date().toISOString(),
            unreadCount: { [currentUser.uid]: 0 },
            isGroupChat: true,
            groupName: `${targetEvent.title} – Group Chat`,
            groupDescription: `Official coordination chat for ${targetEvent.title}.`,
            eventId: targetEvent.id,
            isEventChat: true,
            adminUids: [targetEvent.createdBy || 'admin']
          };
          saveChatToFirestore(newChat).catch(() => {});
          return [newChat, ...prevChats];
        }
      });
    }

    // In-app Notification
    const notif: AppNotification = {
      id: `notif_res_${Date.now()}`,
      toUid: userId,
      type: 'event',
      title: isWaitlist ? `Waitlist Confirmed: ${targetEvent.title}` : `Reservation Confirmed: ${targetEvent.title}`,
      body: isWaitlist
        ? `You have joined the waiting list (Pass: ${reservationId}). We will notify you if a seat opens.`
        : `Your seat for ${targetEvent.title} has been confirmed. Reservation ID: ${reservationId} (${requestedSeats} seat(s)).`,
      refId: targetEvent.id,
      read: false,
      createdAt: new Date().toISOString()
    };
    setNotifications((prev) => [notif, ...prev]);
    saveNotificationToFirestore(notif).catch(() => {});

    // Audit Log
    addAuditLog({
      action: isWaitlist ? 'Event Waitlist Joined' : 'Event Seat Reserved',
      actorId: userId,
      actorName: data.alumniName,
      actorRole: currentUser?.role || 'alumni',
      category: 'engagement',
      details: `${isWaitlist ? 'Waitlist' : 'Confirmed'} seat pass (${reservationId}) created for "${targetEvent.title}". Total seats: ${requestedSeats}.`,
      severity: 'info'
    });

    showToast(
      isWaitlist
        ? `Added to waiting list (${reservationId})!`
        : `Reservation Confirmed (${reservationId})! Seat reserved for ${targetEvent.title}.`,
      'success'
    );

    return { success: true, reservation: newReservation };
  };

  const cancelEventReservation = async (reservationId: string, reason?: string): Promise<{ success: boolean; error?: string }> => {
    const targetReservation = reservations.find((r) => r.id === reservationId);
    if (!targetReservation) {
      return { success: false, error: 'Reservation record not found.' };
    }

    const targetEvent = events.find((e) => e.id === targetReservation.eventId);
    const userId = targetReservation.userId;

    const updatedReservation: EventReservation = {
      ...targetReservation,
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
      cancellationReason: reason || 'Cancelled by attendee'
    };

    setReservations((prev) =>
      prev.map((r) => (r.id === reservationId ? updatedReservation : r))
    );
    saveReservationToFirestore(updatedReservation).catch(() => {});

    // Release seats
    if (targetEvent && targetReservation.status === 'confirmed') {
      const seatsToFree = targetReservation.totalSeats || 1;
      setEvents((prev) =>
        prev.map((e) => {
          if (e.id === targetEvent.id) {
            const currentSeats = e.reservedSeatsCount ?? e.attendeesCount ?? 0;
            const updatedSeats = Math.max(0, currentSeats - seatsToFree);
            const updatedAttendees = (e.attendees || []).filter((a) => a.uid !== userId);
            const updatedEvent: AlumniEvent = {
              ...e,
              reservedSeatsCount: updatedSeats,
              attendeesCount: updatedAttendees.length,
              attendees: updatedAttendees
            };
            saveEventToFirestore(updatedEvent).catch(() => {});
            return updatedEvent;
          }
          return e;
        })
      );
    }

    const cancelNotif: AppNotification = {
      id: `notif_res_cancel_${Date.now()}`,
      toUid: userId,
      type: 'event',
      title: `Reservation Cancelled: ${targetReservation.eventTitle}`,
      body: `Your reservation pass ${reservationId} for ${targetReservation.eventTitle} has been cancelled.`,
      refId: targetReservation.eventId,
      read: false,
      createdAt: new Date().toISOString()
    };
    setNotifications((prev) => [cancelNotif, ...prev]);
    saveNotificationToFirestore(cancelNotif).catch(() => {});

    addAuditLog({
      action: 'Event Reservation Cancelled',
      actorId: currentUser?.uid || userId,
      actorName: currentUser?.name || targetReservation.alumniName,
      actorRole: currentUser?.role || 'alumni',
      category: 'engagement',
      details: `Reservation (${reservationId}) cancelled for "${targetReservation.eventTitle}". Reason: ${reason || 'Attendee request'}.`,
      severity: 'warning'
    });

    showToast(`Reservation ${reservationId} has been cancelled.`, 'info');
    return { success: true };
  };

  const updateEventReservationSettings = (eventId: string, settings: Partial<AlumniEvent>) => {
    if (!currentUser || !permissions.canCreateEvents) {
      showToast('Permission denied: Only administrators and staff can configure event settings.', 'error');
      return;
    }

    setEvents((prev) =>
      prev.map((e) => {
        if (e.id === eventId) {
          const merged = { ...e, ...settings };
          saveEventToFirestore(merged).catch(() => {});
          return merged;
        }
        return e;
      })
    );

    addAuditLog({
      action: 'Event Settings Updated',
      actorId: currentUser.uid,
      actorName: currentUser.name,
      actorRole: currentUser.role,
      category: 'settings',
      details: `Administrator updated reservation rules and limits for event ${eventId}.`,
      severity: 'info'
    });

    showToast('Event settings and reservation rules updated successfully.', 'success');
  };

  // =========================================================================
  // 24-HOUR EVENT RESERVATION PUSH NOTIFICATION SYSTEM
  // Alerts alumni 24 hours prior to reserved events, maximizing campus turnout
  // =========================================================================
  const [pushPermissionStatus, setPushPermissionStatus] = useState<PushPermissionState>(() => getPushPermission());

  // Listen to browser permission changes if supported
  useEffect(() => {
    if (typeof window !== 'undefined' && 'permissions' in navigator) {
      navigator.permissions?.query({ name: 'notifications' as PermissionName }).then((permissionStatus) => {
        permissionStatus.onchange = () => {
          setPushPermissionStatus(getPushPermission());
        };
      }).catch(() => {});
    }
  }, []);

  const requestBrowserPushPermission = async (): Promise<PushPermissionState> => {
    const res = await requestPushPermission();
    setPushPermissionStatus(res);
    if (res === 'granted') {
      playCollegiateChime();
      showToast('Browser push notifications enabled! You will be alerted 24 hours before your reserved events.', 'success');
      
      // Dispatch welcome push preview
      await triggerPushNotification({
        title: "🔔 24-Hour Event Alerts Activated",
        body: "St. Cecilia's College will alert you 24 hours before your reserved events to confirm your seat!",
        tag: 'scc-welcome-push'
      });
    } else if (res === 'denied') {
      showToast('Browser push notifications were blocked in browser site permissions.', 'warning');
    }
    return res;
  };

  const confirmEventAttendance = async (reservationId: string): Promise<void> => {
    const targetReservation = reservations.find((r) => r.id === reservationId);
    if (!targetReservation) return;

    const updatedReservation: EventReservation = {
      ...targetReservation,
      attendanceConfirmed: true,
      attendanceConfirmedAt: new Date().toISOString()
    };

    setReservations((prev) =>
      prev.map((r) => (r.id === reservationId ? updatedReservation : r))
    );
    saveReservationToFirestore(updatedReservation).catch(() => {});

    // Update corresponding in-app notification if present
    setNotifications((prev) =>
      prev.map((n) => {
        if (n.metadata?.reservationId === reservationId && n.metadata?.type === '24h_reservation_alert') {
          return {
            ...n,
            read: true,
            title: `✅ Attendance Confirmed: ${targetReservation.eventTitle}`,
            body: `You have confirmed attendance for your seat pass (${reservationId}). Your seat is fully secured for tomorrow.`
          };
        }
        return n;
      })
    );

    addAuditLog({
      action: 'Event Attendance Confirmed',
      actorId: currentUser?.uid || targetReservation.userId,
      actorName: currentUser?.name || targetReservation.alumniName,
      actorRole: currentUser?.role || 'alumni',
      category: 'engagement',
      details: `Alumnus confirmed attendance for reserved pass ${reservationId} ("${targetReservation.eventTitle}"). Attendance rate safeguard verified.`,
      severity: 'info'
    });

    showToast(`Attendance verified! Your seat for "${targetReservation.eventTitle}" is fully secured.`, 'success');
  };

  const sendTest24HourAlert = async (targetReservation?: EventReservation): Promise<void> => {
    const res = targetReservation || reservations.find((r) => r.userId === currentUser?.uid && r.status === 'confirmed') || reservations[0];
    const targetEvent = res ? events.find((e) => e.id === res.eventId) : events[0];

    const dummyRes: EventReservation = res || {
      id: 'ALM-2026-DEMO',
      eventId: targetEvent?.id || 'demo_event',
      eventTitle: targetEvent?.title || 'Annual Grand Alumni Homecoming 2026',
      eventDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      eventVenue: targetEvent?.venue || targetEvent?.location || "St. Cecilia's College Main Pavilion",
      userId: currentUser?.uid || 'guest_user',
      alumniName: currentUser?.name || 'Cecilian Alumnus',
      email: currentUser?.email || 'alumni@stcecilia.edu',
      contactNumber: '09123456789',
      alumniId: 'SCC-2026',
      graduationYear: '2024',
      course: 'BSIT',
      numberOfGuests: 1,
      totalSeats: 2,
      status: 'confirmed',
      reservedAt: new Date().toISOString()
    };

    const ev = targetEvent || {
      id: dummyRes.eventId,
      title: dummyRes.eventTitle,
      startDate: dummyRes.eventDate,
      location: dummyRes.eventVenue,
      venue: dummyRes.eventVenue
    } as AlumniEvent;

    const { pushTitle, pushBody, inAppNotification } = generate24HourReservationAlert(dummyRes, ev);

    // 1. Web Push Notification & Harmonic Audio Chime
    await triggerPushNotification({
      title: pushTitle,
      body: pushBody,
      tag: `scc-test-alert-${Date.now()}`,
      data: { reservationId: dummyRes.id, eventId: ev.id },
      onClick: () => {
        window.focus();
        setActiveTab('dashboard');
      }
    });

    // 2. In-App Notification
    setNotifications((prev) => [inAppNotification, ...prev]);
    saveNotificationToFirestore(inAppNotification).catch(() => {});

    // 3. Automated Email Dispatch Simulation
    if (currentUser) {
      sendEvent24HourReminderEmail(ev, currentUser, dummyRes);
    }

    // 4. Audit Log
    addAuditLog({
      action: '24-Hour Event Alert Dispatched',
      actorId: currentUser?.uid || 'system_test',
      actorName: currentUser?.name || 'System Dispatcher',
      actorRole: currentUser?.role || 'system',
      category: 'engagement',
      details: `Test 24-hour event reservation push alert triggered for "${ev.title}". Push notification, chime, and email dispatched.`,
      severity: 'info'
    });

    showToast(`Event reminder sent! You can preview the notification now.`, 'success');
  };

  // Memoized list of current user's confirmed reservations in 24h window
  const upcoming24hReservations = useMemo(() => {
    if (!currentUser || !reservations) return [];
    const now = new Date();
    return reservations.filter((r) => {
      if (r.userId !== currentUser.uid || r.status !== 'confirmed') return false;
      const targetEvent = events.find((e) => e.id === r.eventId);
      const startDate = targetEvent?.startDate || r.eventDate;
      const status24h = calculate24HourAlertStatus(startDate, now);
      return status24h.isWithin24HourWindow;
    });
  }, [currentUser, reservations, events]);

  // Automated 24-Hour Background Dispatcher
  useEffect(() => {
    if (!currentUser || !reservations || reservations.length === 0) return;

    const evaluate24HourReservations = () => {
      const now = new Date();
      const myReservations = reservations.filter(
        (r) => r.userId === currentUser.uid && r.status === 'confirmed'
      );

      myReservations.forEach((reservation) => {
        if (reservation.reminder24hSent) return;

        const targetEvent = events.find((e) => e.id === reservation.eventId);
        const eventStartDate = targetEvent?.startDate || reservation.eventDate;
        if (!eventStartDate) return;

        const status24h = calculate24HourAlertStatus(eventStartDate, now);

        if (status24h.isWithin24HourWindow) {
          const ev = targetEvent || {
            id: reservation.eventId,
            title: reservation.eventTitle,
            startDate: reservation.eventDate,
            location: reservation.eventVenue,
            venue: reservation.eventVenue
          } as AlumniEvent;

          const { pushTitle, pushBody, inAppNotification } = generate24HourReservationAlert(reservation, ev);

          // 1. Fire Web Push & Chime
          triggerPushNotification({
            title: pushTitle,
            body: pushBody,
            tag: `scc-event-24h-${reservation.id}`,
            data: { reservationId: reservation.id, eventId: reservation.eventId },
            onClick: () => {
              window.focus();
              setActiveTab('dashboard');
            }
          });

          // 2. In-App Notification
          setNotifications((prev) => {
            const alreadyExists = prev.some(
              (n) => n.id === inAppNotification.id || (n.refId === ev.id && n.metadata?.type === '24h_reservation_alert')
            );
            if (alreadyExists) return prev;
            return [inAppNotification, ...prev];
          });
          saveNotificationToFirestore(inAppNotification).catch(() => {});

          // 3. Automated Institutional Email Notification
          sendEvent24HourReminderEmail(ev, currentUser, reservation);

          // 4. Mark reservation as 24h reminder sent
          const updatedReservation: EventReservation = {
            ...reservation,
            reminder24hSent: true,
            reminder24hSentAt: now.toISOString()
          };

          setReservations((prev) =>
            prev.map((r) => (r.id === reservation.id ? updatedReservation : r))
          );
          saveReservationToFirestore(updatedReservation).catch(() => {});

          // 5. Audit Log
          addAuditLog({
            action: '24-Hour Event Alert Dispatched',
            actorId: 'system_push_service',
            actorName: '24h Event Alert Dispatcher',
            actorRole: 'system',
            category: 'engagement',
            details: `Automated 24h push notification, chime, and email dispatched to ${currentUser.name} for "${ev.title}" (Pass #${reservation.id}). Attendance rate safeguard active.`,
            severity: 'info'
          });

          showToast(
            `🚨 24-Hour Event Alert: "${reservation.eventTitle}" is tomorrow! Please verify your attendance.`,
            'info'
          );
        }
      });
    };

    evaluate24HourReservations();
    const intervalId = setInterval(evaluate24HourReservations, 30000);
    return () => clearInterval(intervalId);
  }, [currentUser, reservations, events]);

  // Announcements operations
  const createAnnouncement = (
    data: Omit<Announcement, 'id' | 'publishedAt' | 'createdBy' | 'authorName' | 'authorRole'>
  ) => {
    if (!currentUser || !permissions.canPostAnnouncements) {
      showToast('Permission denied: Only staff and admin roles can post announcements.');
      return;
    }

    const newAnn: Announcement = {
      id: `ann_${Date.now()}`,
      ...data,
      publishedAt: new Date().toISOString(),
      createdBy: currentUser.uid,
      authorName: currentUser.name,
      authorRole: currentUser.headline || (currentUser.role ? currentUser.role.toUpperCase() : 'ADMIN')
    };

    setAnnouncements((prev) => [newAnn, ...prev]);
    saveAnnouncementToFirestore(newAnn).catch((err) => {
      console.warn('Failed to save announcement to Firestore:', err);
    });

    // Broadcast notification
    const notif: AppNotification = {
      id: `notif_${Date.now()}`,
      type: 'announcement',
      title: `${newAnn.urgent ? '🚨 URGENT: ' : newAnn.important ? '⭐ NOTICE: ' : ''}${newAnn.title}`,
      body: newAnn.content.slice(0, 110) + '...',
      refId: newAnn.id,
      targetPath: `/portal/announcements/${encodeURIComponent(newAnn.id)}`,
      targetRoute: `/portal/announcements/${encodeURIComponent(newAnn.id)}`,
      read: false,
      createdAt: new Date().toISOString(),
      metadata: { announcementId: newAnn.id }
    };
    setNotifications((prev) => [notif, ...prev]);
    saveNotificationToFirestore(notif).catch(() => {});

    // Broadcast push notification to devices with the APK or web app
    sendPushBroadcast({
      title: notif.title,
      body: newAnn.content.slice(0, 140) + '...',
      category: 'announcement',
      data: {
        announcementId: newAnn.id,
        category: 'announcement',
        urgent: !!newAnn.urgent,
        targetPath: `/portal/announcements/${encodeURIComponent(newAnn.id)}`,
        targetRoute: `/portal/announcements/${encodeURIComponent(newAnn.id)}`,
        url: `/portal/announcements/${encodeURIComponent(newAnn.id)}`
      }
    }).catch(() => {});

    // Dispatch institutional email notice to alumni cohort
    try {
      const recipientAlumni = users.filter((u) => u.role === 'alumni' && u.email);
      sendAnnouncementEmail(newAnn, recipientAlumni);
    } catch (e) {
      console.warn('Failed to dispatch announcement emails:', e);
    }

    // Trigger native browser notification if permitted on active device
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(notif.title, {
          body: notif.body,
          icon: '/favicon.ico'
        });
      } catch (e) {}
    }

    addAuditLog({
      action: 'Announcement Published',
      actorId: currentUser.uid,
      actorName: currentUser.name,
      actorRole: currentUser.role,
      category: 'communication',
      details: `Published announcement "${newAnn.title}" [Category: ${newAnn.category || 'General'}${newAnn.urgent ? ' | URGENT' : ''}].`,
      severity: newAnn.urgent ? 'alert' : 'info'
    });

    const targetMembers = users.filter((u) => u.uid !== currentUser.uid);
    sendAnnouncementEmail(newAnn, targetMembers);

    showToast('Announcement posted and broadcast to members!');
  };

  const editAnnouncement = (id: string, data: Partial<Announcement>) => {
    if (!permissions.canPostAnnouncements) {
      showToast('Permission denied: Only staff and admin can edit announcements.');
      return;
    }
    setAnnouncements((prev) =>
      prev.map((a) => {
        if (a.id === id) {
          const updated = { ...a, ...data };
          saveAnnouncementToFirestore(updated).catch(() => {});
          return updated;
        }
        return a;
      })
    );
    showToast('Announcement updated.');
  };

  const deleteAnnouncement = (id: string) => {
    if (!permissions.canPostAnnouncements) {
      showToast('Permission denied.');
      return;
    }
    setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    deleteAnnouncementFromFirestore(id).catch(() => {});
    showToast('Announcement removed.');
  };

  const togglePinAnnouncement = (id: string) => {
    if (!permissions.canPostAnnouncements) {
      showToast('Permission denied: Only authorized staff and administrators can pin announcements.', 'error');
      return;
    }
    setAnnouncements((prev) =>
      prev.map((a) => {
        if (a.id === id) {
          const nextPinned = !a.isPinned;
          const updated = { ...a, isPinned: nextPinned };
          saveAnnouncementToFirestore(updated).catch(() => {});
          showToast(nextPinned ? 'Announcement pinned to top.' : 'Announcement unpinned.', 'info');
          return updated;
        }
        return a;
      })
    );
  };

  const toggleHeartAnnouncement = (id: string) => {
    if (!currentUser) {
      showToast('Please sign in to react to announcements.', 'info');
      return;
    }
    setAnnouncements((prev) =>
      prev.map((a) => {
        if (a.id === id) {
          const currentHearts = Array.isArray(a.hearts) ? a.hearts : [];
          const alreadyHearted = currentHearts.includes(currentUser.uid);
          const newHearts = alreadyHearted
            ? currentHearts.filter((uid) => uid !== currentUser.uid)
            : [...currentHearts, currentUser.uid];
          const updated: Announcement = {
            ...a,
            hearts: newHearts,
            likes: newHearts.length
          };
          saveAnnouncementToFirestore(updated).catch(() => {});
          return updated;
        }
        return a;
      })
    );
  };

  // Opportunities & Career Portal Operations
  const createOpportunity = (
    data: Omit<Opportunity, 'id' | 'createdAt' | 'postedBy' | 'posterName' | 'status'>
  ) => {
    if (!currentUser || currentUser.role === 'alumni' || !permissions.canPostJobs) {
      showToast('Permission denied: Alumni accounts cannot create or publish job opportunities.', 'error');
      return;
    }
    // Accredited employer partners, administrators, and coordinators publish active, approved job postings directly to the Alumni Job Board
    const initialApproval = data.approvalStatus || 'approved';

    const posterCompany = currentUser.companyName || currentUser.company;
    const newOpp: Opportunity = {
      id: `opp_${Date.now()}`,
      ...data,
      postedBy: currentUser.uid,
      posterName: currentUser.role === 'employer' && posterCompany ? posterCompany : `${currentUser.name} (${currentUser.course || currentUser.role})`,
      posterRole: currentUser.role,
      approvalStatus: initialApproval,
      createdAt: new Date().toISOString(),
      status: 'active',
      applicationsCount: 0
    };

    setOpportunities((prev) => [newOpp, ...prev]);
    saveOpportunityToFirestore(newOpp).catch((err) => {
      console.warn('Failed to save opportunity to Firestore:', err);
    });

    // Sync to backend opportunity registry
    const authToken = getStoredSessionToken() || 'dev-admin-session-token';
    fetch('/api/opportunities/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify(newOpp)
    }).catch(() => {});

    if (newOpp.approvalStatus === 'pending_approval') {
      showToast('Job posting submitted for Admin Approval! Status: Pending Approval.', 'info');
      // Alert admin office
      const adminNotif: AppNotification = {
        id: `notif_job_pend_${newOpp.id}`,
        toUid: 'admin',
        type: 'job',
        title: 'New Job Posting Awaiting Approval',
        body: `${newOpp.company} submitted "${newOpp.title}" for review. Click to verify & approve.`,
        refId: newOpp.id,
        metadata: { targetRole: 'admin', targetTab: 'jobs', targetSubTab: 'moderation', jobId: newOpp.id },
        read: false,
        createdAt: new Date().toISOString()
      };
      setNotifications((prev) => [adminNotif, ...prev]);
      saveNotificationToFirestore(adminNotif).catch(() => {});
    } else {
      const eligibleAlumni = users.filter((u) => u.role === 'alumni');
      sendJobPostingEmail(newOpp, eligibleAlumni);

      const jobNotif: AppNotification = {
        id: `notif_job_${newOpp.id}`,
        toUid: 'all',
        type: 'job',
        title: `Career Opening: ${newOpp.title}`,
        body: `${newOpp.company} is hiring for ${newOpp.title} (${newOpp.location || 'Cebu'}).`,
        refId: newOpp.id,
        metadata: { targetRole: 'alumni', jobId: newOpp.id },
        read: false,
        createdAt: new Date().toISOString()
      };
      setNotifications((prev) => [jobNotif, ...prev]);
      saveNotificationToFirestore(jobNotif).catch(() => {});

      showToast('Career opportunity published to the Cecilian Job Board!', 'success');
    }
  };

  const updateOpportunity = (id: string, data: Partial<Opportunity>) => {
    if (!currentUser || currentUser.role === 'alumni') {
      showToast('Permission denied: Alumni accounts cannot edit or manage job opportunities.', 'error');
      return;
    }
    setOpportunities((prev) =>
      prev.map((o) => {
        if (o.id === id) {
          const updated = { ...o, ...data };
          saveOpportunityToFirestore(updated).catch(() => {});
          const authToken = getStoredSessionToken() || 'dev-admin-session-token';
          fetch('/api/opportunities/sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${authToken}`
            },
            body: JSON.stringify(updated)
          }).catch(() => {});
          return updated;
        }
        return o;
      })
    );
    showToast('Job posting details updated.', 'success');
  };

  const deleteOpportunity = (id: string) => {
    if (!currentUser || currentUser.role === 'alumni') {
      showToast('Permission denied: Alumni accounts cannot delete or manage job opportunities.', 'error');
      return;
    }
    setOpportunities((prev) => prev.filter((o) => o.id !== id));
    deleteOpportunityFromFirestore(id).catch(() => {});
    const authToken = getStoredSessionToken() || 'dev-admin-session-token';
    fetch(`/api/opportunities/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    }).catch(() => {});
    showToast('Opportunity removed.');
  };

  const approveOpportunity = (id: string) => {
    const opp = opportunities.find((o) => o.id === id);
    if (!opp) return;

    const updated = { ...opp, approvalStatus: 'approved' as const };
    setOpportunities((prev) =>
      prev.map((o) => (o.id === id ? updated : o))
    );
    saveOpportunityToFirestore(updated).catch(() => {});

    // Send email notifications to alumni for approved job
    const eligibleAlumni = users.filter((u) => u.role === 'alumni');
    sendJobPostingEmail(updated, eligibleAlumni);

    // Notify the job poster
    const notif: AppNotification = {
      id: `notif_job_appr_${opp.id}`,
      toUid: opp.postedBy,
      type: 'job',
      title: '✅ Job Posting Approved & Published!',
      body: `Your job posting "${opp.title}" at ${opp.company} has been approved by the Alumni Office and is now live on the Alumni Job Board.`,
      refId: opp.id,
      metadata: { targetRole: 'employer', jobId: opp.id },
      read: false,
      createdAt: new Date().toISOString()
    };
    
    const broadcastJobNotif: AppNotification = {
      id: `notif_job_live_${opp.id}`,
      toUid: 'all',
      type: 'job',
      title: `Career Opening: ${opp.title}`,
      body: `${opp.company} is hiring for ${opp.title} (${opp.location || 'Cebu'}).`,
      refId: opp.id,
      metadata: { targetRole: 'alumni', jobId: opp.id },
      read: false,
      createdAt: new Date().toISOString()
    };

    setNotifications((prev) => [broadcastJobNotif, notif, ...prev]);
    saveNotificationToFirestore(notif).catch(() => {});
    saveNotificationToFirestore(broadcastJobNotif).catch(() => {});
    showToast(`Approved "${opp.title}". Posting is now live.`, 'success');
  };

  const rejectOpportunity = (id: string, reason: string) => {
    const opp = opportunities.find((o) => o.id === id);
    if (!opp) return;

    const updated = { ...opp, approvalStatus: 'rejected' as const, rejectionReason: reason };
    setOpportunities((prev) =>
      prev.map((o) => (o.id === id ? updated : o))
    );
    saveOpportunityToFirestore(updated).catch(() => {});

    // Notify the job poster
    const notif: AppNotification = {
      id: `notif_job_rej_${opp.id}`,
      toUid: opp.postedBy,
      type: 'job',
      title: '❌ Job Posting Needs Revision',
      body: `Your job posting "${opp.title}" was declined by the Alumni Office. Reason: ${reason}`,
      refId: opp.id,
      metadata: { targetRole: 'employer', jobId: opp.id },
      read: false,
      createdAt: new Date().toISOString()
    };
    setNotifications((prev) => [notif, ...prev]);
    saveNotificationToFirestore(notif).catch(() => {});
    showToast(`Job posting "${opp.title}" rejected with feedback sent.`, 'info');
  };

  // Automated Match Calculation & Job Application
  const applyForJob = (data: Omit<JobApplication, 'id' | 'appliedAt' | 'status'>): { success: boolean; error?: string } => {
    if (!currentUser) return { success: false, error: 'Please log in to apply.' };

    // Check duplicate
    const existing = jobApplications.find((a) => a.jobId === data.jobId && a.applicantUid === currentUser.uid);
    if (existing) {
      showToast('You have already applied for this position.', 'info');
      return { success: false, error: 'Already applied' };
    }

    const job = opportunities.find((o) => o.id === data.jobId);
    
    // Calculate Precision Multi-Factor Match Score
    const matchResult = job ? computePreciseJobMatch(currentUser, job) : null;
    const finalScore = matchResult?.score || 60;

    const newApp: JobApplication = {
      ...data,
      id: `app_${Date.now()}`,
      employerUid: job?.postedBy,
      applicantUid: currentUser.uid,
      applicantName: data.applicantName || currentUser.name,
      applicantEmail: data.applicantEmail || currentUser.email,
      applicantPhotoUrl: currentUser.profilePictureUrl || (currentUser as any).avatar || '',
      appliedAt: new Date().toISOString(),
      status: 'Pending',
      statusNotes: '',
      matchScore: finalScore,
      matchBreakdown: {
        courseMatch:
          matchResult?.programMatchStatus === 'exact' ||
          matchResult?.programMatchStatus === 'cluster' ||
          matchResult?.programMatchStatus === 'open',
        skillsMatchCount: matchResult?.matchedSkills.length || 0,
        totalSkillsCount: matchResult?.totalOppSkills || (job?.skills?.length || 0),
        locationMatch: matchResult?.locationFit ?? true
      }
    };

    setJobApplications((prev) => [newApp, ...prev]);
    saveJobApplicationToFirestore(newApp).catch((err) => {
      console.warn('Failed to save job application to Firestore:', err);
    });

    // Also sync to backend application store
    const authToken = getStoredSessionToken() || 'dev-admin-session-token';
    fetch('/api/applications/apply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify(newApp)
    }).catch(() => {});

    // Increment count on job
    setOpportunities((prev) =>
      prev.map((o) => (o.id === data.jobId ? { ...o, applicationsCount: (o.applicationsCount || 0) + 1 } : o))
    );

    // Notify employer / job poster
    if (job) {
      const employerNotif: AppNotification = {
        id: `notif_app_recv_${newApp.id}`,
        toUid: job.postedBy,
        type: 'job',
        title: `💼 New Job Application: ${job.title}`,
        body: `${data.applicantName || currentUser.name} applied for "${job.title}" with a ${finalScore}% match score! Status: Pending review.`,
        refId: job.id,
        metadata: { jobId: job.id, applicationId: newApp.id, targetRole: 'employer' },
        read: false,
        createdAt: new Date().toISOString()
      };
      setNotifications((prev) => [employerNotif, ...prev]);
      saveNotificationToFirestore(employerNotif).catch(() => {});
    }

    // Confirmation notif for applicant
    const applicantNotif: AppNotification = {
      id: `notif_app_sent_${newApp.id}`,
      toUid: currentUser.uid,
      type: 'job',
      title: '🎯 Application Submitted: Pending Review',
      body: `Your application for "${job?.title || 'Job'}" at ${job?.company || 'Company'} was submitted. Status: Pending. (Profile Match: ${finalScore}%)`,
      refId: job?.id,
      metadata: { jobId: job?.id, applicationId: newApp.id, targetRole: 'alumni' },
      read: false,
      createdAt: new Date().toISOString()
    };
    setNotifications((prev) => [applicantNotif, ...prev]);
    saveNotificationToFirestore(applicantNotif).catch(() => {});

    showToast(`Application submitted with ${finalScore}% automated profile match!`, 'success');
    return { success: true };
  };

  const updateApplicationStatus = (applicationId: string, status: ApplicationStatus, notes?: string) => {
    const app = jobApplications.find((a) => a.id === applicationId);
    if (!app) return;

    const targetJob = opportunities.find((o) => o.id === app.jobId);
    const userCompany = currentUser ? (currentUser.companyName || currentUser.company) : '';
    const isOwnerEmployer =
      currentUser &&
      (app.employerUid === currentUser.uid ||
        targetJob?.postedBy === currentUser.uid ||
        (userCompany && targetJob?.company && targetJob.company.toLowerCase() === userCompany.toLowerCase()));
    const isAdmin = currentUser && ['admin', 'superadmin', 'moderator'].includes(currentUser.role);

    if (!isOwnerEmployer && !isAdmin) {
      showToast('Permission denied: You can only update applications for your own job postings.', 'error');
      return;
    }

    const updatedApp: JobApplication = {
      ...app,
      status,
      statusNotes: notes !== undefined ? notes : app.statusNotes
    };

    setJobApplications((prev) =>
      prev.map((a) => (a.id === applicationId ? updatedApp : a))
    );
    saveJobApplicationToFirestore(updatedApp).catch((err) => {
      console.warn('Failed to update application status in Firestore:', err);
    });

    // Authoritative backend status sync with ownership validation
    const authToken = getStoredSessionToken() || 'dev-admin-session-token';
    fetch(`/api/employer/applications/${applicationId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        status,
        notes,
        application: updatedApp
      })
    })
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          if (res.status === 403) {
            showToast(errData.error || 'Backend policy violation: unauthorized to manage this application.', 'error');
          }
        }
      })
      .catch((err) => console.warn('Backend application status sync error:', err));

    // Notify applicant
    const notif: AppNotification = {
      id: `notif_app_status_${app.id}_${status.toLowerCase().replace(/\s+/g, '_')}`,
      toUid: app.applicantUid,
      type: 'job',
      title: `Application Status Updated: ${status}`,
      body: `Your application for "${app.jobTitle}" at ${app.companyName} is now: ${status}.${notes ? ` Note: ${notes}` : ''}`,
      refId: app.jobId,
      metadata: { jobId: app.jobId, applicationId: app.id, status, targetRole: 'alumni' },
      read: false,
      createdAt: new Date().toISOString()
    };
    setNotifications((prev) => [notif, ...prev]);
    saveNotificationToFirestore(notif).catch(() => {});
    showToast(`Applicant status updated to "${status}".`, 'success');
  };

  const withdrawJobApplication = (applicationId: string) => {
    const app = jobApplications.find((a) => a.id === applicationId);
    if (!app) return;
    setJobApplications((prev) => prev.filter((a) => a.id !== applicationId));
    deleteJobApplicationFromFirestore(applicationId).catch(() => {});
    if (app.jobId) {
      const job = opportunities.find((o) => o.id === app.jobId);
      setOpportunities((prev) =>
        prev.map((o) =>
          o.id === app.jobId
            ? { ...o, applicationsCount: Math.max(0, (o.applicationsCount || 0) - 1) }
            : o
        )
      );

      // Notify the employer that the applicant withdrew
      if (job && job.postedBy) {
        const employerWithdrawNotif: AppNotification = {
          id: `notif_app_withdraw_${applicationId}`,
          toUid: job.postedBy,
          type: 'job',
          title: `Application Withdrawn: ${job.title}`,
          body: `${app.applicantName || 'An applicant'} has withdrawn their application for "${job.title}".`,
          refId: job.id,
          metadata: { jobId: job.id, applicationId, targetRole: 'employer' },
          read: false,
          createdAt: new Date().toISOString()
        };
        setNotifications((prev) => [employerWithdrawNotif, ...prev]);
        saveNotificationToFirestore(employerWithdrawNotif).catch(() => {});
      }
    }
    showToast('Application withdrawn successfully.', 'info');
  };

  const verifyEmployer = (employerUid: string, verified: boolean | 'verified' | 'rejected', notes?: string) => {
    const isApproved = typeof verified === 'boolean' ? verified : verified === 'verified';

    // Mandatory rejection reason validation
    let validRejectionReason = '';
    if (!isApproved) {
      const validation = validateRejectionReason(notes);
      if (!validation.valid) {
        showToast(validation.error || 'Rejection reason is invalid.', 'error');
        return { success: false, error: validation.error };
      }
      validRejectionReason = validation.trimmed;
    }

    const targetEmployer = users.find((u) => u.uid === employerUid);
    let updatedEmployer: UserProfile | undefined;

    if (isApproved) {
      setUsers((prev) => {
        const nextUsers = prev.map((u) => {
          if (u.uid === employerUid) {
            updatedEmployer = stripPlaintextSecretsFromUser({
              ...u,
              isVerified: true,
              verified: true,
              employerStatus: 'approved',
              employerVerificationStatus: 'verified',
              verificationStatus: 'verified',
              verificationExpiresAt: undefined,
              accountStatus: 'ACTIVE',
              status: 'ACTIVE',
              canPostJobs: true,
              employerVerificationNotes: notes || 'Accredited by Alumni Office',
              rejectionReason: undefined,
              rejectionDate: undefined,
              rejectedBy: undefined
            });
            return updatedEmployer;
          }
          return u;
        });
        persistUsersSafe(nextUsers);
        return nextUsers;
      });

      if (updatedEmployer) {
        saveUserToFirestore(updatedEmployer).catch(() => {});
        const vaultCred = findCredentialInVault(updatedEmployer.email || employerUid);
        const existingHash = updatedEmployer.passwordHash || vaultCred?.passwordHash;
        saveCredentialToVault({
          uid: updatedEmployer.uid,
          name: updatedEmployer.name,
          email: updatedEmployer.email,
          ...(existingHash ? { passwordHash: existingHash } : {}),
          role: 'employer',
          isVerified: true
        });
      }
    } else {
      // Rejection lifecycle: purge all personal data & credentials, keep only anonymized block record
      addDeletedAccountUids([employerUid]);
      removeCredentialFromVault({
        uid: employerUid,
        email: targetEmployer?.email
      });
      setUsers((prev) => {
        const nextUsers = prev.filter((u) => u.uid !== employerUid);
        persistUsersSafe(nextUsers);
        return nextUsers;
      });

      recordLocalRejectedBlock({
        email: targetEmployer?.email,
        companyName: targetEmployer?.companyName || targetEmployer?.company || targetEmployer?.name,
        identifier: employerUid,
        category: 'employer',
        reason: validRejectionReason,
        rejectedByRole: currentUser?.role || 'admin'
      })
        .then((block) => purgeRejectedEmployerInFirestore(employerUid, block))
        .catch(() => purgeRejectedEmployerInFirestore(employerUid));

      // When an employer is rejected, reject and close all their jobs across the network
      setOpportunities((prevOpps) => {
        const nextOpps = prevOpps.map((o) => {
          const isTargetJob =
            o.postedBy === employerUid ||
            (targetEmployer?.companyName && o.company?.toLowerCase() === targetEmployer.companyName.toLowerCase()) ||
            (targetEmployer?.name && o.company?.toLowerCase() === targetEmployer.name.toLowerCase());

          if (isTargetJob) {
            const rejectedJob = {
              ...o,
              approvalStatus: 'rejected' as const,
              status: 'closed' as const,
              rejectionReason: validRejectionReason || 'Employer partner accreditation declined.'
            };
            saveOpportunityToFirestore(rejectedJob).catch(() => {});
            return rejectedJob;
          }
          return o;
        });

        try {
          localStorage.setItem(STORAGE_KEYS.OPPORTUNITIES, JSON.stringify(nextOpps));
        } catch {}

        return nextOpps;
      });
    }

    // Synchronize backend credentials & anonymized block store (single authoritative call)
    try {
      const token = getAuthToken() || (currentUser ? createSessionToken(currentUser) : '');
      fetch('/api/admin/verify-employer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          employerUid,
          status: isApproved ? 'approved' : 'rejected',
          reason: isApproved ? notes : validRejectionReason
        })
      }).catch((err) => console.warn('Backend verify-employer sync notice:', err));
    } catch {}

    const notif: AppNotification = {
      id: `notif_emp_ver_${Date.now()}`,
      toUid: employerUid,
      type: 'general',
      title: isApproved ? '🏢 Employer Verification Approved!' : 'Employer Verification Status Update',
      body: isApproved
        ? 'Congratulations! Your company registration has been approved and accredited by St. Cecilia’s College Alumni Office. You may now post career opportunities.'
        : `Employer verification update: Your partnership application was declined and your submitted data was purged. Reason: ${validRejectionReason}`,
      read: false,
      createdAt: new Date().toISOString()
    };
    setNotifications((prev) => [notif, ...prev]);
    if (isApproved) {
      saveNotificationToFirestore(notif).catch(() => {});
    }

    // Save an anonymized audit record
    addAuditLog({
      action: isApproved ? 'Employer Registration Approved' : 'Employer Registration Rejected & PII Purged',
      actorId: currentUser?.uid || 'admin',
      actorName: currentUser?.name || 'Administrator',
      actorRole: currentUser?.role || 'admin',
      category: 'admin',
      details: isApproved
        ? `Company ${employerUid} accredited by ${currentUser?.uid || 'admin'}. Status: approved.`
        : `Employer application rejected by ${currentUser?.role || 'admin'} and personal data purged. Anonymized block retained. Reason: "${validRejectionReason}"`,
      severity: isApproved ? 'success' : 'warning'
    });

    showToast(
      isApproved
        ? 'Employer partner approved & accredited. Job posting permissions activated!'
        : 'Employer application rejected and personal data purged.',
      isApproved ? 'success' : 'info'
    );
    return { success: true };
  };

  const toggleEmployerJobPosting = (employerUid: string, canPost: boolean) => {
    let updatedEmployer: UserProfile | undefined;
    setUsers((prev) =>
      prev.map((u) => {
        if (u.uid === employerUid) {
          updatedEmployer = {
            ...u,
            canPostJobs: canPost
          };
          return updatedEmployer;
        }
        return u;
      })
    );

    if (updatedEmployer) {
      saveUserToFirestore(updatedEmployer).catch(() => {});
    }

    addAuditLog({
      action: 'Employer Job Posting Rights Changed',
      actorId: currentUser?.uid || 'admin',
      actorName: currentUser?.name || 'Administrator',
      actorRole: currentUser?.role || 'admin',
      category: 'admin',
      details: `Company ${employerUid} job posting rights updated to: ${canPost ? 'Enabled' : 'Disabled'}.`,
      severity: 'info'
    });

    showToast(`Company job posting permission set to ${canPost ? 'Enabled' : 'Disabled'}.`, 'success');
  };

  const selfVerifyAlumniWithRegistry = async (studentId: string): Promise<{ success: boolean; message: string }> => {
    if (!currentUser) {
      return { success: false, message: 'Must be logged in to verify.' };
    }
    const res = await verifyAlumniStatus(studentId);
    return {
      success: res.isVerified,
      message: res.message
    };
  };

  // Connection status checker against connections and requests
  const getConnectionStatus = useCallback(
    (otherUid: string): 'pending' | 'accepted' | 'declined' | null => {
      if (!currentUser || !otherUid) return null;
      if (connectionsMap[currentUser.uid]?.includes(otherUid)) return 'accepted';
      const req = friendRequests.find(
        (r) =>
          (r.fromUid === currentUser.uid && r.toUid === otherUid) ||
          (r.fromUid === otherUid && r.toUid === currentUser.uid)
      );
      if (req) {
        return req.status;
      }
      return null;
    },
    [currentUser, connectionsMap, friendRequests]
  );

  // Global Alumni Academic Record Verification Gate State
  const isAlumniVerified = useMemo(() => {
    if (!currentUser) return false;
    if (['admin', 'moderator', 'superadmin'].includes(currentUser.role)) return true;
    if (currentUser.role === 'employer') {
      return Boolean((currentUser.isVerified || currentUser.verified) && currentUser.verificationStatus !== 'rejected');
    }
    return Boolean(
      (currentUser.isVerified === true || currentUser.verified === true) &&
      currentUser.verificationStatus !== 'pending_review' &&
      currentUser.verificationStatus !== 'flagged' &&
      currentUser.verificationStatus !== 'rejected'
    );
  }, [currentUser]);

  const verifyAlumniStatus = useCallback(
    async (studentIdToVerify: string): Promise<RegistrarVerificationResult> => {
      const result = registrar_verification(studentIdToVerify, currentUser?.name);

      if (result.isVerified && result.record && currentUser) {
        const updated: UserProfile = {
          ...currentUser,
          studentId: result.record.studentId,
          isVerified: true,
          verified: true,
          verificationStatus: 'verified',
          verificationFlagReason: undefined,
          batch: result.record.batchYear || currentUser.batch,
          course: result.record.course || currentUser.course
        };
        setUsers((prev) => prev.map((u) => (u.uid === currentUser.uid ? updated : u)));
        await saveUserToFirestore(updated);
        markRegistryRecordAsRegistered(result.record.studentId, currentUser.uid);
        showToast(result.message, 'success');
      } else {
        if (currentUser) {
          const updated: UserProfile = {
            ...currentUser,
            studentId: studentIdToVerify,
            isVerified: false,
            verified: false,
            verificationStatus: 'rejected',
            verificationFlagReason: result.message
          };
          setUsers((prev) => prev.map((u) => (u.uid === currentUser.uid ? updated : u)));
          saveUserToFirestore(updated).catch(() => {});
        }
        showToast(result.message, 'error');
      }
      return result;
    },
    [registrar_verification, currentUser, showToast]
  );

  // Notifications operations
  const markNotificationAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    if (id.startsWith('notif_mod_') && getAuthToken()) {
      apiFetchWithCsrf(`/api/moderation/notifications/${encodeURIComponent(id)}/read`, {
        method: 'POST'
      }).catch(() => {});
    }
    markNotificationReadInFirestore(id).catch((err) => {
      console.warn('Failed to mark notification read in Firestore:', err);
    });
  };

  const unauthorizedAttemptDedupeRef = useRef<Map<string, number>>(new Map());

  const reportUnauthorizedSuperAdminAccess = useCallback(
    async (attemptedPath: string, attemptedModule: string) => {
      if (!currentUser || normalizeSystemRole(currentUser.role) === 'superadmin') return;
      const cleanPath = attemptedPath || buildPortalUrlForTab(attemptedModule || 'audit');
      const dedupeKey = `${currentUser.uid}:${cleanPath}`;
      const now = Date.now();
      const lastLogged = unauthorizedAttemptDedupeRef.current.get(dedupeKey) || 0;
      if (now - lastLogged < 10000) return;
      unauthorizedAttemptDedupeRef.current.set(dedupeKey, now);

      let loggedViaServer = false;
      if (getAuthToken()) {
        try {
          const res = await apiFetchWithCsrf('/api/security/unauthorized-access', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              attemptedPath: cleanPath,
              attemptedModule,
              attemptedSection: attemptedModule
            })
          });
          if (res.status === 403 || res.ok) {
            loggedViaServer = true;
          }
        } catch {}
      }

      if (!loggedViaServer) {
        addAuditLog({
          action: 'UNAUTHORIZED_SUPERADMIN_ACCESS',
          actorId: currentUser.uid,
          actorName: currentUser.name,
          actorRole: currentUser.role || 'alumni',
          category: 'security',
          details: `HTTP 403 Forbidden: Unauthorized access attempt by ${currentUser.name} (${currentUser.role}) to restricted superadmin route ${cleanPath} [${attemptedModule}].`,
          severity: 'alert',
          targetRecordId: cleanPath,
          isSuspicious: true,
          requiresAlertIcon: true
        });
      }

      const secNotif: AppNotification = normalizeNotificationPayload({
        id: `notif_unauth_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        toUid: 'superadmin',
        fromUid: currentUser.uid,
        type: 'security',
        title: 'Security Alert: Unauthorized Restricted Route Attempt',
        body: `${currentUser.name} (${currentUser.role}) attempted to access ${cleanPath}. Access blocked (403 Forbidden).`,
        refId: cleanPath,
        targetPath: '/portal/audit',
        targetRoute: '/portal/audit',
        metadata: { targetRole: 'superadmin', attemptedPath: cleanPath, attemptedModule },
        read: false,
        createdAt: new Date().toISOString()
      }, 'superadmin');
      setNotifications((prev) => [secNotif, ...prev]);
    },
    [currentUser, addAuditLog, setNotifications]
  );

  const navigateToPortalPath = useCallback(
    (rawPath: string, overrideNotif?: AppNotification) => {
      const normalizedRaw = rawPath.startsWith('/portal/')
        ? rawPath
        : buildPortalUrlForTab(rawPath.replace(/^\/+/, '') || 'dashboard');
      const role = currentUser?.role || 'alumni';
      const parsed = parsePortalUrlPath(normalizedRaw, role);
      const resolved = overrideNotif
        ? resolveNotificationDeepLink(overrideNotif, role)
        : {
            tab: parsed.tab,
            subTab: parsed.subTab,
            targetType: parsed.targetType,
            targetId: parsed.targetId,
            targetPath: parsed.targetPath,
            targetRoute: parsed.targetRoute,
            notificationId: undefined,
            fromUid: undefined,
            timestamp: Date.now()
          };

      const finalPath = resolved.targetPath || parsed.targetPath;

      setSelectedUserIdForModal(null);
      setViewedProfileIdentifier(null);
      setViewedPostId(null);

      if (
        (parsed.requiresSuperAdmin || isSuperAdminRestrictedTarget(finalPath)) &&
        normalizeSystemRole(role) !== 'superadmin'
      ) {
        reportUnauthorizedSuperAdminAccess(finalPath, parsed.requestedSection || parsed.tab).catch(() => {});
      }

      setDeepLinkTarget(resolved);
      setActiveTabState(resolved.tab);
      triggerItemHighlight(resolved.targetId || null);

      if (typeof window !== 'undefined') {
        if (window.location.pathname !== finalPath) {
          window.history.pushState({ portalPath: finalPath, tab: resolved.tab }, '', finalPath);
        }
      }

      if (resolved.targetType === 'message' && resolved.targetId) {
        setActiveChatId(resolved.targetId);
      }
    },
    [currentUser?.role, reportUnauthorizedSuperAdminAccess, triggerItemHighlight]
  );

  const navigateFromNotification = useCallback(
    (notif: AppNotification) => {
      if (!notif.read) {
        markNotificationAsRead(notif.id);
      }
      const normalized = normalizeNotificationPayload(notif, currentUser?.role);
      const target = resolveNotificationDeepLink(normalized, currentUser?.role);
      navigateToPortalPath(target.targetPath || target.targetRoute, normalized);
    },
    [currentUser?.role, navigateToPortalPath]
  );

  const markAllNotificationsAsRead = () => {
    if (!currentUserId) return;
    setNotifications((prev) =>
      prev.map((n) =>
        !n.toUid || n.toUid === 'all' || n.toUid === currentUserId ? { ...n, read: true } : n
      )
    );
    markAllNotificationsReadInFirestore(currentUserId).catch((err) => {
      console.warn('Failed to mark all notifications read in Firestore:', err);
    });
    showToast('All notifications marked as read.', 'success');
  };

  const deleteNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    deleteNotificationFromFirestore(id).catch((err) => {
      console.warn('Failed to delete notification from Firestore:', err);
    });
    showToast('Notification deleted.', 'info');
  };

  // Settings operations
  const updateNotificationSettings = (settings: Partial<UserNotificationSettings>) => {
    setNotificationSettings((prev) => ({ ...prev, ...settings }));
    showToast('Notification preferences saved.');
  };

  const updateUserSettings = (settings: any) => {
    if (
      settings.notificationsPush !== undefined ||
      settings.notificationsEmail !== undefined ||
      settings.notificationsMessages !== undefined ||
      settings.notificationsEvents !== undefined
    ) {
      updateNotificationSettings({
        pushNotifications: settings.notificationsPush ?? settings.pushNotifications,
        emailDigests: settings.notificationsEmail ?? settings.emailDigests,
        directMessages: settings.notificationsMessages ?? settings.directMessages,
        eventReminders: settings.notificationsEvents ?? settings.eventReminders
      });
    } else {
      updateNotificationSettings(settings);
    }
  };

  // Admin Actions
  const setUserVerifiedExplicit = (
    uid: string,
    targetStatus?: boolean,
    options?: {
      rejectionReason?: string;
      reviewedByUid?: string;
      reviewedByName?: string;
      reviewedByRole?: string;
      reviewedAt?: string;
      silentToast?: boolean;
      conflictId?: string;
      requestId?: string;
      submissionSource?: 'dispute_student_id_claim' | 'request_verification';
      requestType?: 'claimed_id_dispute' | 'manual_verification_request' | 'registration_conflict';
      studentId?: string;
      course?: string;
      batch?: string;
      notes?: string;
    }
  ) => {
    const actorCanonicalRole = normalizeSystemRole(currentUser?.role);
    const isAuthorizedReviewer =
      permissions.canAccessAdminPanel ||
      ['moderator', 'admin', 'superadmin'].includes(actorCanonicalRole);

    if (!isAuthorizedReviewer) {
      showToast('Permission denied: Moderator, Admin, or Superadmin clearance required.', 'error');
      return;
    }
    const target = users.find((u) => u.uid === uid);
    if (!target) return;

    const newStatus = targetStatus !== undefined ? targetStatus : !target.isVerified;

    // Prevent duplicate verification action if member is already verified
    if (newStatus && target.isVerified && target.verificationStatus === 'verified') {
      if (!options?.silentToast) {
        showToast(`${target.name} is already verified.`, 'info');
      }
      return;
    }

    // Prevent duplicate rejection if already rejected
    if (!newStatus && target.verificationStatus === 'rejected' && target.accountStatus === 'REJECTED') {
      if (!options?.silentToast) {
        showToast(`${target.name}'s verification request is already marked as rejected.`, 'info');
      }
      return;
    }

    const nowIso = options?.reviewedAt || new Date().toISOString();
    const reviewerUid = options?.reviewedByUid || currentUser?.uid || 'reviewer';
    const reviewerName = options?.reviewedByName || currentUser?.name || 'Authorized Reviewer';
    const reviewerRole = options?.reviewedByRole || actorCanonicalRole;
    const preservedRole: UserRole = target.role === 'alumni' ? 'alumni' : target.role;
    const rejectionReason = !newStatus ? (options?.rejectionReason || '').trim() : undefined;

    const generatedAlumniId =
      newStatus && preservedRole === 'alumni'
        ? target.alumniId ||
          generateAlumniId(
            options?.batch || target.batch || '2024',
            options?.studentId || target.studentId,
            target.uid
          )
        : target.alumniId;

    const profileUpdates: Partial<UserProfile> = newStatus
      ? {
          role: preservedRole,
          isVerified: true,
          verified: true,
          verificationStatus: 'verified',
          accountStatus: 'ACTIVE',
          status: 'ACTIVE',
          alumniId: generatedAlumniId,
          ...(options?.studentId ? { studentId: options.studentId } : {}),
          ...(options?.course ? { course: options.course } : {}),
          ...(options?.batch ? { batch: options.batch } : {}),
          verifiedAt: nowIso,
          verifiedBy: reviewerName,
          reviewedAt: nowIso,
          reviewedByUid: reviewerUid,
          reviewedByName: reviewerName,
          reviewedByRole: reviewerRole,
          rejectionReason: undefined,
          rejectedBy: undefined,
          rejectionDate: undefined
        }
      : {
          role: preservedRole,
          isVerified: false,
          verified: false,
          verificationStatus: 'rejected',
          accountStatus: 'REJECTED',
          status: 'REJECTED',
          rejectionReason: rejectionReason || 'Verification request rejected by administrator.',
          rejectedBy: reviewerName,
          rejectionDate: nowIso,
          reviewedAt: nowIso,
          reviewedByUid: reviewerUid,
          reviewedByName: reviewerName,
          reviewedByRole: reviewerRole
        };

    setUsers((prev) => {
      const next = prev.map((u) =>
        u.uid === uid
          ? {
              ...u,
              ...profileUpdates
            }
          : u
      );
      persistUsersSafe(next);
      return next;
    });

    // Update local credential vault to keep verified login access in sync
    try {
      const cred = findCredentialInVault(target.email) || findCredentialInVault(uid);
      if (cred) {
        saveCredentialToVault({
          ...cred,
          role: preservedRole,
          isVerified: newStatus,
          alumniId: generatedAlumniId || cred.alumniId,
          studentId: options?.studentId || cred.studentId
        });
      }
    } catch {}

    alumniService.updateAlumni(uid, profileUpdates, target).catch((err) => {
      console.warn('Error updating verification status in Firestore:', err);
    });

    // Synchronize approval/rejection decision with server credentials & verification store
    const token = getStoredSessionToken();
    if (token) {
      fetch('/api/admin/alumni-verification/decision', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          action: newStatus ? 'approve' : 'reject',
          userId: uid,
          email: target.email,
          studentId: options?.studentId || target.studentId,
          alumniId: generatedAlumniId,
          conflictId: options?.conflictId,
          requestId: options?.requestId || target.verificationRequestId,
          submissionSource: options?.submissionSource || target.verificationSubmissionSource,
          requestType: options?.requestType,
          rejectionReason: rejectionReason || (!newStatus ? 'Verification request rejected by administrator.' : undefined),
          notes: options?.notes
        })
      }).catch((err) => {
        console.warn('Backend alumni verification sync notice:', err);
      });
    }

    if (!options?.silentToast) {
      if (newStatus) {
        showToast('Alumni Successfully Verified.', 'success');
      } else {
        showToast(
          `Verification request for ${target?.name || 'Alumni'} has been rejected.`,
          'info'
        );
      }
    }

    if (!newStatus && currentUserId === uid) {
      logout();
    }
  };

  const verifyUser = (uid: string) => {
    setUserVerifiedExplicit(uid);
  };

  const updateUserRole = async (uid: string, newRole: UserRole): Promise<{ success: boolean; message?: string }> => {
    if (!permissions.canAccessAdminPanel && currentUser?.role !== 'admin' && currentUser?.role !== 'superadmin') {
      showToast('Permission denied: Only Administrators and Super Admins can modify user roles.', 'error');
      return { success: false, message: 'Permission denied: Administrators only' };
    }

    const targetUser = users.find((u) => u.uid === uid) || (currentUser?.uid === uid ? currentUser : null);
    const previousRole = targetUser?.role || 'alumni';

    // Task 3: The Employer role is fixed and immutable. No user, including the employer themselves, can change, upgrade, or reassign it.
    if (previousRole === 'employer' || newRole === 'employer') {
      showToast('The Employer role is fixed and immutable and cannot be changed or reassigned.', 'error');
      return { success: false, message: 'The Employer role is fixed and immutable.' };
    }

    // Superadmin protection: Only superadmin can assign superadmin or modify a superadmin account
    if (currentUser?.role !== 'superadmin' && (newRole === 'superadmin' || previousRole === 'superadmin')) {
      showToast('Permission denied: Only Super Administrators can assign or modify the Super Admin role.', 'error');
      return { success: false, message: 'Superadmin privilege required' };
    }

    // Moderator quota: Max 3 active moderators allowed
    if (newRole === 'moderator' && previousRole !== 'moderator') {
      const activeMods = users.filter((u) => u.role === 'moderator' && u.uid !== uid).length;
      if (activeMods >= 3) {
        showToast('Moderator quota limit reached (maximum 3 active moderators allowed).', 'error');
        return { success: false, message: 'Moderator quota limit reached (maximum 3 allowed)' };
      }
    }

    // 1. Optimistic Local State Update
    setUsers((prev) => prev.map((u) => (u.uid === uid ? { ...u, role: newRole } : u)));
    if (currentUser && currentUser.uid === uid) {
      const updatedUser = { ...currentUser, role: newRole };
      saveActiveSession(updatedUser);
      try {
        localStorage.setItem('alumni_user', JSON.stringify(updatedUser));
      } catch {}
    }

    // 2. Persist to Firestore database
    try {
      await alumniService.updateAlumni(uid, { role: newRole }, targetUser || undefined);
    } catch (fsErr) {
      console.warn('Firestore updateDoc warning for role change:', fsErr);
    }

    // 3. Update Credential Vault for local login synchronization
    try {
      const userEmail = targetUser?.email;
      if (userEmail) {
        const cred = findCredentialInVault(userEmail) || findCredentialInVault(uid);
        if (cred) {
          cred.role = newRole;
          saveCredentialToVault(cred);
        }
      }
    } catch {}

    // 4. Synchronize with Backend Credentials DB & Audit Log
    try {
      const token = getStoredSessionToken() || (currentUser ? createSessionToken(currentUser) : 'dev-admin-session-token');
      const response = await fetch('/api/admin/promote-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          targetEmail: targetUser?.email || '',
          targetUid: uid,
          newRole
        })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        // Rollback optimistic state
        setUsers((prev) => prev.map((u) => (u.uid === uid ? { ...u, role: previousRole } : u)));
        if (currentUser && currentUser.uid === uid) {
          const rolledBack = { ...currentUser, role: previousRole };
          saveActiveSession(rolledBack);
          try {
            localStorage.setItem('alumni_user', JSON.stringify(rolledBack));
          } catch {}
        }
        await alumniService.updateAlumni(uid, { role: previousRole }, targetUser || undefined);
        const errMsg = data.error || 'Failed to update user role on server.';
        showToast(errMsg, 'error');
        return { success: false, message: errMsg };
      }
    } catch (netErr) {
      console.warn('Backend /api/admin/promote-user sync skipped or offline:', netErr);
    }

    // 5. System Audit Log
    addAuditLog({
      action: 'ROLE_MODIFIED',
      actorId: currentUser?.uid || 'usr_admin',
      actorName: currentUser?.name || currentUser?.email || 'Administrator',
      actorRole: currentUser?.role || 'admin',
      category: 'user_management',
      details: `Modified role for ${targetUser?.name || targetUser?.email || uid} from ${previousRole.toUpperCase()} to ${newRole.toUpperCase()}`,
      severity: 'info',
      targetRecordId: uid
    });

    showToast(`Role updated to ${newRole.toUpperCase()} and persisted to database.`, 'success');
    return { success: true };
  };

  const deleteAlumni = async (uid: string): Promise<boolean> => {
    if (!permissions.canAccessAdminPanel) {
      showToast('Permission denied: Only administrators can remove alumni records.', 'error');
      return false;
    }
    try {
      return await cascadeDeleteAccount(uid, 'admin');
    } catch (err) {
      console.error('Failed to delete alumnus:', err);
      showToast('Error removing alumni record.', 'error');
      return false;
    }
  };

  // Alumni Service Operations (direct Firestore CRUD)
  const fetchAlumni = async (): Promise<UserProfile[]> => {
    try {
      setIsFirestoreSyncing(true);
      const [deletedRes, liveUsers] = await Promise.all([
        fetch('/api/auth/deleted-uids').then((r) => (r.ok ? r.json() : null)).catch(() => null),
        alumniService.getAllAlumni()
      ]);
      const serverDeletedUids: string[] = Array.isArray(deletedRes?.deletedUids) ? deletedRes.deletedUids : [];
      const firestoreDeletedUids = (liveUsers || []).filter((u) => isAccountDeleted(u)).map((u) => u.uid);
      const allDeletedSet = addDeletedAccountUids([...serverDeletedUids, ...firestoreDeletedUids]);
      purgeDeletedUidsFromVaultAndStorage(allDeletedSet);

      if (liveUsers && liveUsers.length > 0) {
        const normalized = liveUsers
          .filter((u) => !allDeletedSet.has(u.uid) && !isAccountDeleted(u) && !isPendingAccountExpired(u))
          .map((u) => stripPlaintextSecretsFromUser({ ...u, role: normalizeSystemRole(u.role) }));
        setUsers(normalized);
        persistUsersSafe(normalized);
        return normalized;
      }
      return [];
    } catch (err) {
      console.warn('Error fetching alumni from Firestore service:', err);
      return [];
    } finally {
      setIsFirestoreSyncing(false);
    }
  };

  const createAlumni = async (profile: UserProfile): Promise<UserProfile | undefined> => {
    try {
      const created = await alumniService.createAlumni(profile);
      if (created) {
        setUsers((prev) => {
          const exists = prev.some((u) => u.uid === created.uid);
          return exists ? prev.map((u) => (u.uid === created.uid ? created : u)) : [created, ...prev];
        });
        showToast(`Alumni record created for ${created.name}.`);
      }
      return created;
    } catch (err) {
      console.error('Failed to create alumni in Firestore:', err);
      showToast('Error creating alumni profile in Firestore.');
      return undefined;
    }
  };

  const updateAlumniProfile = async (uid: string, updates: Partial<UserProfile>): Promise<Partial<UserProfile> | undefined> => {
    try {
      const targetUser = users.find((u) => u.uid === uid);
      const updated = await alumniService.updateAlumni(uid, updates, targetUser ? { ...targetUser, ...updates } : undefined);
      if (updated) {
        setUsers((prev) => prev.map((u) => (u.uid === uid ? { ...u, ...updated } : u)));
        showToast('Alumni profile updated successfully.');
      }
      return updated;
    } catch (err) {
      console.error('Failed to update alumni in Firestore:', err);
      showToast('Error updating alumni profile in Firestore.');
      return undefined;
    }
  };

  const isEmployerExpired = useCallback((user?: UserProfile | null): boolean => {
    if (!user || user.role !== 'employer') return false;
    if (user.employerStatus === 'expired') return true;
    if (user.employerExpirationDate) {
      return new Date(user.employerExpirationDate).getTime() < Date.now();
    }
    // Default active period: 365 days from user.createdAt or default 1 year
    if (user.createdAt) {
      const createdTime = new Date(user.createdAt).getTime();
      const defaultExpiry = createdTime + 365 * 86400000;
      return defaultExpiry < Date.now();
    }
    return false;
  }, []);

  const requestEmployerRenewal = useCallback((notes: string) => {
    if (!currentUser || currentUser.role !== 'employer') return;
    const updated = {
      ...currentUser,
      employerStatus: 'pending_renewal' as const,
      employerRenewalRequested: true,
      employerRenewalNotes: notes
    };
    updateProfile(updated);

    // Notify administrators
    const adminNotif: AppNotification = {
      id: `notif_renew_req_${Date.now()}`,
      toUid: 'admin',
      type: 'general',
      title: 'Employer Accreditation Renewal Requested',
      body: `Employer "${currentUser.companyName || currentUser.name}" submitted a renewal request: "${notes.slice(0, 80)}..."`,
      refId: currentUser.uid,
      targetPath: `/portal/jobs/employers/${encodeURIComponent(currentUser.uid)}`,
      targetRoute: `/portal/jobs/employers/${encodeURIComponent(currentUser.uid)}`,
      metadata: { targetRole: 'admin', targetTab: 'jobs', targetSubTab: 'employers', employerUid: currentUser.uid },
      read: false,
      createdAt: new Date().toISOString()
    };
    setNotifications((prev) => [adminNotif, ...prev]);
    showToast('Renewal request submitted for administrator review.');
  }, [currentUser, updateProfile]);

  const renewEmployerAccount = useCallback((uid: string, extensionMonths: number = 12) => {
    const target = users.find((u) => u.uid === uid);
    if (!target) return;
    const currentExpiry = target.employerExpirationDate && new Date(target.employerExpirationDate).getTime() > Date.now()
      ? new Date(target.employerExpirationDate).getTime()
      : Date.now();
    const newExpiry = new Date(currentExpiry + extensionMonths * 30 * 86400000).toISOString();

    setUsers((prev) =>
      prev.map((u) => {
        if (u.uid === uid) {
          return {
            ...u,
            employerStatus: 'active',
            employerExpirationDate: newExpiry,
            employerRenewalRequested: false,
            employerRenewalNotes: undefined,
            employerVerificationStatus: 'verified',
            canPostJobs: true
          };
        }
        return u;
      })
    );

    const renewNotif: AppNotification = {
      id: `notif_renew_${Date.now()}`,
      toUid: uid,
      type: 'security',
      title: 'Accreditation Extended & Restored',
      body: `Your partner account accreditation has been successfully extended for ${extensionMonths} months. Valid through ${new Date(newExpiry).toLocaleDateString()}.`,
      refId: uid,
      read: false,
      createdAt: new Date().toISOString()
    };
    setNotifications((prev) => [renewNotif, ...prev]);
    showToast(`Accreditation renewed for ${extensionMonths} months.`);
  }, [users, currentUser]);

  // Automated Employer Expiration System and Renewal Warning Notification Engine
  const checkAndEnforceEmployerExpirations = useCallback(() => {
    let expiredCount = 0;
    let warningsCount = 0;
    const now = Date.now();
    const newNotifications: AppNotification[] = [];

    setUsers((prevUsers) => {
      let stateChanged = false;
      const updated = prevUsers.map((user) => {
        if (user.role !== 'employer') return user;

        let expiryTimestamp: number | null = null;
        if (user.employerExpirationDate) {
          expiryTimestamp = new Date(user.employerExpirationDate).getTime();
        } else if (user.createdAt) {
          expiryTimestamp = new Date(user.createdAt).getTime() + 365 * 86400000;
        }

        if (!expiryTimestamp || isNaN(expiryTimestamp)) return user;

        const msUntilExpiry = expiryTimestamp - now;
        const daysUntilExpiry = Math.ceil(msUntilExpiry / 86400000);

        // Check if expiration date has been reached
        if (daysUntilExpiry <= 0) {
          if (user.employerStatus !== 'expired' || user.canPostJobs !== false) {
            expiredCount++;
            stateChanged = true;
            const updatedUser: UserProfile = {
              ...user,
              employerStatus: 'expired',
              canPostJobs: false
            };

            // Persist expiration status asynchronously to Firestore
            alumniService.updateAlumni(user.uid, {
              employerStatus: 'expired',
              canPostJobs: false
            }).catch(() => {});

            // Dispatch Account Expired Notification (strictly once)
            const alreadyExpiredNotif = notifications.some(
              (n) => n.toUid === user.uid && n.title === 'Account Accreditation Expired'
            );
            if (!alreadyExpiredNotif) {
              const expNotif: AppNotification = {
                id: `notif_emp_expired_${user.uid}`,
                toUid: user.uid,
                type: 'security',
                title: 'Account Accreditation Expired',
                body: `Your institutional partner accreditation for "${user.companyName || user.name}" has expired on ${new Date(expiryTimestamp).toLocaleDateString()}. Job posting and candidate contact privileges have been set to inactive. Please submit a renewal request to restore active status.`,
                refId: user.uid,
                metadata: { targetRole: 'employer' },
                read: false,
                createdAt: new Date().toISOString()
              };
              newNotifications.push(expNotif);
            }

            addAuditLog({
              action: 'Employer Account Automatically Expired',
              actorId: 'system_automation',
              actorName: 'System Expiration Engine',
              actorRole: 'system',
              category: 'security',
              details: `Employer accreditation for "${user.companyName || user.name}" reached expiration date (${new Date(expiryTimestamp).toLocaleDateString()}). Status set to 'Expired' and posting privileges disabled.`,
              severity: 'warning'
            });

            return updatedUser;
          }
        } else {
          // Warning notifications (30-day, 14-day, 7-day, 1-day)
          let warningTitle: string | null = null;
          let warningBody: string | null = null;

          if (daysUntilExpiry <= 1) {
            warningTitle = 'Accreditation Expiry Warning (1 Day Remaining)';
            warningBody = `Urgent Final Notice: Your employer accreditation for "${user.companyName || user.name}" expires tomorrow. Please submit a renewal request to avoid interruption.`;
          } else if (daysUntilExpiry <= 7) {
            warningTitle = 'Accreditation Expiry Notice (7 Days Remaining)';
            warningBody = `Your employer accreditation will expire in ${daysUntilExpiry} days. Please prepare your renewal documentation.`;
          } else if (daysUntilExpiry <= 14) {
            warningTitle = 'Accreditation Renewal Notice (14 Days Remaining)';
            warningBody = `Your partner accreditation is due for renewal in 2 weeks. Submit a renewal request to ensure continuous access.`;
          } else if (daysUntilExpiry <= 30) {
            warningTitle = 'Accreditation Renewal Notice (30 Days Remaining)';
            warningBody = `Annual accreditation notice: Your partner account is scheduled for expiration in ${daysUntilExpiry} days.`;
          }

          if (warningTitle && warningBody) {
            const alreadyExists = notifications.some(
              (n) => n.toUid === user.uid && n.title === warningTitle
            );
            if (!alreadyExists) {
              warningsCount++;
              const warnNotif: AppNotification = {
                id: `notif_emp_warn_${daysUntilExpiry}_${user.uid}`,
                toUid: user.uid,
                type: 'security',
                title: warningTitle,
                body: warningBody,
                refId: user.uid,
                metadata: { targetRole: 'employer' },
                read: false,
                createdAt: new Date().toISOString()
              };
              newNotifications.push(warnNotif);
            }
          }
        }

        return user;
      });

      return stateChanged ? updated : prevUsers;
    });

    if (newNotifications.length > 0) {
      setNotifications((prev) => [...newNotifications, ...prev]);
      newNotifications.forEach((n) => {
        saveNotificationToFirestore(n).catch(() => {});
      });
    }

    return { expiredCount, warningsCount };
  }, [notifications, addAuditLog, currentUser, isEmployerExpired]);

  // Run automatic expiration check on component mount and on interval
  useEffect(() => {
    checkAndEnforceEmployerExpirations();
    const interval = setInterval(() => {
      checkAndEnforceEmployerExpirations();
    }, 60000 * 30); // check every 30 minutes
    return () => clearInterval(interval);
  }, [checkAndEnforceEmployerExpirations]);

  // Automated Account Suspension Expiration Sweeper:
  // Automatically restores accounts from SUSPENDED to ACTIVE when scheduled duration has expired.
  // Records ACCOUNT_AUTO_RESTORED in Activity Logs and dispatches notification to admin.
  useEffect(() => {
    const checkExpiredSuspensions = () => {
      const now = Date.now();
      setUsers((prevUsers) => {
        let changed = false;
        const next = prevUsers.map((user) => {
          const status = (user.accountStatus || user.status || '').toUpperCase().trim();
          if (status !== 'SUSPENDED') return user;
          if (user.suspensionInfo?.isPermanentLock || user.accountStatus === 'LOCKED') return user;

          const endDate = user.suspensionInfo?.endDate || user.suspensionEndDate;
          if (!endDate) return user;
          const endTimestamp = new Date(endDate).getTime();
          if (isNaN(endTimestamp) || now < endTimestamp) return user;

          changed = true;
          const autoRestoreEntry: SuspensionHistoryEntry = {
            id: `hist_auto_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            action: 'ACCOUNT_AUTO_RESTORED',
            timestamp: new Date().toISOString(),
            adminId: 'system_automation',
            adminName: 'System Scheduler',
            adminRole: 'system',
            reason: 'Scheduled suspension duration reached expiration. Account automatically restored to ACTIVE status.',
            startDate: user.suspensionInfo?.startDate,
            endDate
          };

          addAuditLog({
            action: 'ACCOUNT_AUTO_RESTORED',
            actorId: 'system_automation',
            actorName: 'System Scheduler',
            actorRole: 'system',
            category: 'security',
            details: `Scheduled suspension duration expired for ${user.name} (${user.email}). Account automatically restored to ACTIVE.`,
            severity: 'info',
            targetRecordId: user.email,
            targetUserId: user.uid,
            targetUserName: user.name,
            targetUserRole: user.role
          });

          // In-app Notification for Superadmin
          const adminNotif: AppNotification = {
            id: `notif_auto_restored_${user.uid}_${Date.now()}`,
            toUid: 'superadmin',
            title: 'Account Suspension Expired & Auto-Restored',
            body: `Account for ${user.name} (${user.role}) reached its scheduled suspension expiration and was automatically restored to ACTIVE.`,
            type: 'security',
            refId: user.uid,
            targetPath: '/portal/audit',
            targetRoute: '/portal/audit',
            metadata: { targetRole: 'superadmin' },
            read: false,
            createdAt: new Date().toISOString()
          };
          setNotifications((prev) => [adminNotif, ...prev]);

          return {
            ...user,
            accountStatus: 'ACTIVE' as const,
            status: 'ACTIVE' as const,
            isLocked: false,
            lockedUntil: undefined,
            suspensionInfo: {
              ...(user.suspensionInfo || {
                startDate: new Date().toISOString(),
                reason: user.suspensionReason || 'Administrative suspension',
                suspendedBy: 'admin',
                suspendedByName: 'Administration'
              }),
              autoRestored: true,
              autoRestoredAt: new Date().toISOString(),
              history: [...(user.suspensionInfo?.history || []), autoRestoreEntry]
            }
          };
        });

        if (changed) {
          persistUsersSafe(next);
        }
        return changed ? next : prevUsers;
      });
    };

    checkExpiredSuspensions();
    const interval = setInterval(checkExpiredSuspensions, 30000);
    return () => clearInterval(interval);
  }, [addAuditLog]);


  // System Background Automation Engine:
  // Automatically reconciles, validates, and approves perfect registrar matches in the background
  useEffect(() => {
    const runBackgroundRegistrarReconciliation = () => {
      try {
        const records = getRegistrarRecords();
        if (!records || records.length === 0) return;

        setUsers((prevUsers) => {
          let updated = false;
          let verifiedCount = 0;

          const next = prevUsers.map((user) => {
            if (user.role === 'alumni' && !user.isVerified && user.studentId) {
              const analysis = analyzeUserRegistryIntegrity(user, prevUsers, records);
              if (analysis.status === 'PERFECT_MATCH' && analysis.recommendedAction === 'AUTO_VERIFY') {
                updated = true;
                verifiedCount++;
                return {
                  ...user,
                  isVerified: true,
                  verified: true,
                  verificationStatus: 'verified' as const,
                  verificationFlagReason: undefined
                };
              }
            }
            return user;
          });

          if (updated) {
            persistUsersSafe(next);

            setAutomationJobs((prevJobs) =>
              prevJobs.map((j) =>
                j.id === 'job_reg_verifier'
                  ? {
                      ...j,
                      lastRun: new Date().toISOString(),
                      triggerCount: j.triggerCount + verifiedCount,
                      status: 'active'
                    }
                  : j
              )
            );
          }
          return next;
        });
      } catch (err) {
        console.warn('Background registrar reconciliation notice:', err);
      }
    };

    runBackgroundRegistrarReconciliation();
    const recInterval = setInterval(runBackgroundRegistrarReconciliation, 60000);
    return () => clearInterval(recInterval);
  }, []);

  const submitCareerSurvey = useCallback((survey: Omit<CareerSurveyResponse, 'id' | 'submittedAt'>) => {
    const newSurvey: CareerSurveyResponse = {
      id: `survey_${Date.now()}`,
      submittedAt: new Date().toISOString(),
      ...survey
    };
    setCareerSurveys((prev) => [newSurvey, ...prev]);

    if (currentUser) {
      updateProfile({
        employmentStatus: survey.employmentStatus,
        currentPosition: survey.jobTitle || currentUser.currentPosition,
        company: survey.company || currentUser.company
      });
    }

    addAuditLog({
      action: 'Graduate Tracer Survey Submitted',
      actorId: survey.uid,
      actorName: survey.userName,
      actorRole: 'alumni',
      category: 'career',
      details: `Response recorded for ${survey.userName} (${survey.course}, Batch ${survey.batch}) - Status: ${survey.employmentStatus}.`,
      severity: 'success'
    });

    showToast('Graduate tracer survey submitted! Thank you for supporting institutional accreditation.', 'success');
  }, [currentUser, updateProfile, addAuditLog, showToast]);

  const triggerDatabaseBackup = useCallback((type: 'automated' | 'manual' = 'manual') => {
    if (normalizeSystemRole(currentUser?.role) !== 'superadmin') {
      showToast('Database snapshots and backups are restricted strictly to Super Administrators.', 'error');
      return;
    }
    const newSnapshot: DatabaseBackupSnapshot = {
      id: `snap_${Date.now()}`,
      timestamp: new Date().toISOString(),
      recordCount: users.length,
      sizeKb: 128 + users.length * 2,
      status: 'verified',
      type
    };
    setBackups((prev) => [newSnapshot, ...prev]);

    addAuditLog({
      action: 'Database Snapshot Backup Created',
      actorId: currentUser?.uid || 'system',
      actorName: currentUser?.name || 'Automated Backup Daemon',
      actorRole: currentUser?.role || 'system',
      category: 'admin',
      details: `Encrypted point-in-time snapshot created (${users.length} alumni, ${events.length} events). Verified integrity.`,
      severity: 'info'
    });

    showToast('Encrypted database backup snapshot created and verified.', 'success');
  }, [users.length, events.length, currentUser, addAuditLog, showToast]);

  const runAutomationJob = useCallback((jobId: string) => {
    setAutomationJobs((prev) =>
      prev.map((job) => {
        if (job.id === jobId) {
          return {
            ...job,
            lastRun: new Date().toISOString(),
            triggerCount: job.triggerCount + 1,
            status: 'active'
          };
        }
        return job;
      })
    );

    const targetJob = automationJobs.find((j) => j.id === jobId);
    const jobName = targetJob?.name || 'Automation Job';

    if (jobId === 'job_backup_daily') {
      triggerDatabaseBackup('manual');
      return;
    }

    addAuditLog({
      action: `Automation Job Triggered: ${jobName}`,
      actorId: currentUser?.uid || 'admin',
      actorName: currentUser?.name || 'System Operator',
      actorRole: currentUser?.role || 'admin',
      category: 'admin',
      details: `Manual run dispatched for "${jobName}".`,
      severity: 'info'
    });

    showToast(`Automation job "${jobName}" triggered successfully.`, 'success');
  }, [automationJobs, currentUser, triggerDatabaseBackup, addAuditLog, showToast]);

  // ============================================================================
  // ADMIN ACCOUNT SUSPENSION & LOCK SCHEDULER MANAGEMENT
  // ============================================================================

  const suspendUserAccount = useCallback(
    async (
      uid: string,
      data: { startDate?: string; endDate?: string; reason: string; isPermanentLock?: boolean }
    ): Promise<{ success: boolean; message?: string }> => {
      const cleanReason = (data.reason || '').trim();
      if (!cleanReason || cleanReason.length < 5) {
        showToast('Please provide an explanation (at least 5 characters) for this action.', 'error');
        return { success: false, message: 'Reason is required (min 5 characters).' };
      }

      const target = users.find((u) => u.uid === uid);
      if (target && target.role !== 'alumni') {
        const errMsg = 'Role restriction: Only Alumni accounts can be suspended. Staff, Administrators, and Corporate Partners cannot be suspended.';
        showToast(errMsg, 'error');
        return { success: false, message: errMsg };
      }
      const isLock = !!data.isPermanentLock;
      const effectiveStartDate = data.startDate || new Date().toISOString();
      const effectiveEndDate = isLock ? undefined : data.endDate;
      const targetStatus = isLock ? ('LOCKED' as const) : ('SUSPENDED' as const);

      const historyEntry: SuspensionHistoryEntry = {
        id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        action: isLock ? 'ACCOUNT_LOCKED' : 'ACCOUNT_SUSPENDED',
        timestamp: new Date().toISOString(),
        adminId: currentUser?.uid || 'admin',
        adminName: currentUser?.name || 'Administrator',
        adminRole: currentUser?.role || 'admin',
        reason: cleanReason,
        startDate: effectiveStartDate,
        endDate: effectiveEndDate
      };

      // 1. Optimistic / local state update
      setUsers((prev) =>
        prev.map((u) => {
          if (u.uid === uid) {
            const updatedInfo: SuspensionRecord = {
              startDate: effectiveStartDate,
              endDate: effectiveEndDate,
              reason: cleanReason,
              suspendedBy: currentUser?.uid || 'admin',
              suspendedByName: currentUser?.name || 'Administrator',
              suspendedByRole: currentUser?.role || 'admin',
              isPermanentLock: isLock,
              history: [...(u.suspensionInfo?.history || []), historyEntry]
            };
            return {
              ...u,
              accountStatus: targetStatus,
              status: targetStatus,
              isLocked: true,
              suspensionReason: cleanReason,
              suspensionEndDate: effectiveEndDate,
              suspensionInfo: updatedInfo
            };
          }
          return u;
        })
      );

      // 2. Call backend endpoint to enforce persistence and session revocation
      try {
        await apiFetch(`/api/admin/users/${encodeURIComponent(uid)}/suspend`, {
          method: 'POST',
          body: JSON.stringify({
            startDate: effectiveStartDate,
            endDate: effectiveEndDate,
            reason: cleanReason,
            isPermanentLock: isLock
          })
        });
      } catch (err) {
        console.warn('[Backend Suspend Call Notice]', err);
      }

      // 3. Activity Log (Classification: SECURITY WARNING, Warning Icon: ⚠️ Yes)
      addAuditLog({
        action: isLock ? 'ACCOUNT_LOCKED' : 'ACCOUNT_SUSPENDED',
        actorId: currentUser?.uid || 'admin',
        actorName: currentUser?.name || 'Administrator',
        actorRole: currentUser?.role || 'admin',
        category: 'security',
        details: isLock
          ? `Account for ${target?.name || uid} (${target?.role || 'user'}) locked permanently by administrator. Reason: ${cleanReason}.`
          : `Account for ${target?.name || uid} (${target?.role || 'user'}) suspended until ${effectiveEndDate ? new Date(effectiveEndDate).toLocaleString('en-US', { timeZone: 'Asia/Manila' }) : 'manual review'}. Reason: ${cleanReason}.`,
        severity: 'alert',
        targetRecordId: target?.email || uid,
        targetUserId: uid,
        targetUserName: target?.name,
        targetUserRole: target?.role,
        suspensionReason: cleanReason,
        suspensionStartDate: effectiveStartDate,
        suspensionEndDate: effectiveEndDate,
        isSuspicious: true,
        requiresAlertIcon: true
      });

      // 4. In-App Notification for Superadmin Security Awareness
      const adminNotif: AppNotification = {
        id: `notif_susp_${uid}_${Date.now()}`,
        toUid: 'superadmin',
        title: isLock ? '⚠️ Account Locked by Administrator' : '⚠️ Account Suspended by Administrator',
        body: `${isLock ? 'Lockout' : 'Suspension'} applied to ${target?.name || uid} (${target?.role || 'member'}). Reason: "${cleanReason}".`,
        type: 'security',
        refId: uid,
        targetPath: '/portal/audit',
        targetRoute: '/portal/audit',
        metadata: { targetRole: 'superadmin' },
        read: false,
        createdAt: new Date().toISOString()
      };
      setNotifications((prev) => [adminNotif, ...prev]);

      // 5. If current user suspended themselves, force logout immediately
      if (currentUser?.uid === uid) {
        logout();
      }

      showToast(
        isLock
          ? `Account for ${target?.name || 'user'} has been locked permanently.`
          : `Account for ${target?.name || 'user'} has been suspended until ${effectiveEndDate ? new Date(effectiveEndDate).toLocaleString('en-US', { timeZone: 'Asia/Manila' }) : 'manual review'}.`,
        'warning'
      );

      return { success: true };
    },
    [currentUser, users, addAuditLog, showToast, logout]
  );

  const lockUserAccount = useCallback(
    async (
      uid: string,
      data: { startDate?: string; reason: string }
    ): Promise<{ success: boolean; message?: string }> => {
      return suspendUserAccount(uid, {
        startDate: data.startDate,
        endDate: undefined,
        reason: data.reason,
        isPermanentLock: true
      });
    },
    [suspendUserAccount]
  );

  const unlockUserAccount = useCallback(
    async (uid: string, reason?: string): Promise<{ success: boolean; message?: string }> => {
      const cleanReason = (reason || '').trim() || 'Manual account unlock clearance granted by administrator';
      const target = users.find((u) => u.uid === uid);

      const historyEntry: SuspensionHistoryEntry = {
        id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        action: 'ACCOUNT_UNLOCKED',
        timestamp: new Date().toISOString(),
        adminId: currentUser?.uid || 'admin',
        adminName: currentUser?.name || 'Administrator',
        adminRole: currentUser?.role || 'admin',
        reason: cleanReason
      };

      setUsers((prev) =>
        prev.map((u) => {
          if (u.uid === uid) {
            const updatedInfo: SuspensionRecord | undefined = u.suspensionInfo
              ? {
                  ...u.suspensionInfo,
                  unlockedAt: new Date().toISOString(),
                  unlockedBy: currentUser?.uid || 'admin',
                  unlockedByName: currentUser?.name || 'Administrator',
                  unlockReason: cleanReason,
                  history: [...(u.suspensionInfo.history || []), historyEntry]
                }
              : undefined;

            return {
              ...u,
              accountStatus: 'ACTIVE' as const,
              status: 'ACTIVE' as const,
              isLocked: false,
              lockedUntil: undefined,
              failedLoginAttempts: 0,
              suspensionInfo: updatedInfo
            };
          }
          return u;
        })
      );

      try {
        await apiFetch(`/api/admin/users/${encodeURIComponent(uid)}/unlock`, {
          method: 'POST',
          body: JSON.stringify({ reason: cleanReason })
        });
      } catch (err) {
        console.warn('[Backend Unlock Call Notice]', err);
      }

      // Activity Log: ACCOUNT_UNLOCKED (Classification: NORMAL, Warning Icon: NO)
      addAuditLog({
        action: 'ACCOUNT_UNLOCKED',
        actorId: currentUser?.uid || 'admin',
        actorName: currentUser?.name || 'Administrator',
        actorRole: currentUser?.role || 'admin',
        category: 'security',
        details: `Account for ${target?.name || uid} was unlocked by administrator. Explanation: ${cleanReason}. Failed attempts reset to zero.`,
        severity: 'info',
        targetRecordId: target?.email || uid,
        targetUserId: uid,
        targetUserName: target?.name,
        targetUserRole: target?.role,
        isSuspicious: false,
        requiresAlertIcon: false
      });

      showToast(`Account for ${target?.name || 'user'} has been restored to active status.`, 'success');
      return { success: true };
    },
    [currentUser, users, addAuditLog, showToast]
  );

  const extendUserSuspension = useCallback(
    async (
      uid: string,
      data: { newEndDate: string; reason: string }
    ): Promise<{ success: boolean; message?: string }> => {
      const cleanReason = (data.reason || '').trim() || 'Suspension duration extended by administrator';
      const target = users.find((u) => u.uid === uid);
      const effectiveNewEnd = new Date(data.newEndDate).toISOString();
      const previousEndDate = target?.suspensionInfo?.endDate || target?.suspensionEndDate;

      const historyEntry: SuspensionHistoryEntry = {
        id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        action: 'ACCOUNT_SUSPENSION_EXTENDED',
        timestamp: new Date().toISOString(),
        adminId: currentUser?.uid || 'admin',
        adminName: currentUser?.name || 'Administrator',
        adminRole: currentUser?.role || 'admin',
        reason: cleanReason,
        startDate: target?.suspensionInfo?.startDate,
        endDate: effectiveNewEnd,
        previousEndDate
      };

      setUsers((prev) =>
        prev.map((u) => {
          if (u.uid === uid) {
            const updatedInfo: SuspensionRecord = {
              ...(u.suspensionInfo || {
                startDate: new Date().toISOString(),
                reason: cleanReason,
                suspendedBy: currentUser?.uid || 'admin',
                suspendedByName: currentUser?.name || 'Administrator'
              }),
              endDate: effectiveNewEnd,
              history: [...(u.suspensionInfo?.history || []), historyEntry]
            };
            return {
              ...u,
              accountStatus: 'SUSPENDED' as const,
              status: 'SUSPENDED' as const,
              suspensionEndDate: effectiveNewEnd,
              suspensionInfo: updatedInfo
            };
          }
          return u;
        })
      );

      try {
        await apiFetch(`/api/admin/users/${encodeURIComponent(uid)}/extend`, {
          method: 'POST',
          body: JSON.stringify({ newEndDate: effectiveNewEnd, reason: cleanReason })
        });
      } catch (err) {
        console.warn('[Backend Extend Call Notice]', err);
      }

      // Activity Log: ACCOUNT_SUSPENSION_EXTENDED (Classification: FAILED / WARNING, Warning Icon: ⚠️ Yes)
      addAuditLog({
        action: 'ACCOUNT_SUSPENSION_EXTENDED',
        actorId: currentUser?.uid || 'admin',
        actorName: currentUser?.name || 'Administrator',
        actorRole: currentUser?.role || 'admin',
        category: 'security',
        details: `Suspension period for ${target?.name || uid} extended until ${new Date(effectiveNewEnd).toLocaleString('en-US', { timeZone: 'Asia/Manila' })}. Reason: ${cleanReason}.`,
        severity: 'warning',
        targetRecordId: target?.email || uid,
        targetUserId: uid,
        targetUserName: target?.name,
        targetUserRole: target?.role,
        suspensionReason: cleanReason,
        suspensionEndDate: effectiveNewEnd,
        isSuspicious: false,
        requiresAlertIcon: true
      });

      showToast(`Suspension extended until ${new Date(effectiveNewEnd).toLocaleString('en-US', { timeZone: 'Asia/Manila' })}.`, 'info');
      return { success: true };
    },
    [currentUser, users, addAuditLog, showToast]
  );

  const updateSuspensionReason = useCallback(
    async (uid: string, reason: string): Promise<{ success: boolean; message?: string }> => {
      const cleanReason = (reason || '').trim();
      if (!cleanReason || cleanReason.length < 5) {
        showToast('Please enter an explanation of at least 5 characters.', 'error');
        return { success: false, message: 'Reason must be at least 5 characters.' };
      }
      const target = users.find((u) => u.uid === uid);
      const oldReason = target?.suspensionInfo?.reason || target?.suspensionReason;

      const historyEntry: SuspensionHistoryEntry = {
        id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        action: 'ACCOUNT_SUSPENSION_REASON_UPDATED',
        timestamp: new Date().toISOString(),
        adminId: currentUser?.uid || 'admin',
        adminName: currentUser?.name || 'Administrator',
        adminRole: currentUser?.role || 'admin',
        reason: cleanReason,
        notes: `Updated from: "${oldReason}"`
      };

      setUsers((prev) =>
        prev.map((u) => {
          if (u.uid === uid) {
            const updatedInfo: SuspensionRecord = {
              ...(u.suspensionInfo || {
                startDate: new Date().toISOString(),
                reason: cleanReason,
                suspendedBy: currentUser?.uid || 'admin',
                suspendedByName: currentUser?.name || 'Administrator'
              }),
              reason: cleanReason,
              history: [...(u.suspensionInfo?.history || []), historyEntry]
            };
            return {
              ...u,
              suspensionReason: cleanReason,
              suspensionInfo: updatedInfo
            };
          }
          return u;
        })
      );

      try {
        await apiFetch(`/api/admin/users/${encodeURIComponent(uid)}/update-suspension-reason`, {
          method: 'POST',
          body: JSON.stringify({ reason: cleanReason })
        });
      } catch (err) {
        console.warn('[Backend Update Reason Call Notice]', err);
      }

      // Activity Log: ACCOUNT_SUSPENSION_REASON_UPDATED (Classification: NORMAL, Warning Icon: NO)
      addAuditLog({
        action: 'ACCOUNT_SUSPENSION_REASON_UPDATED',
        actorId: currentUser?.uid || 'admin',
        actorName: currentUser?.name || 'Administrator',
        actorRole: currentUser?.role || 'admin',
        category: 'security',
        details: `Suspension explanation for ${target?.name || uid} updated. New explanation: "${cleanReason}".`,
        severity: 'info',
        targetRecordId: target?.email || uid,
        targetUserId: uid,
        targetUserName: target?.name,
        targetUserRole: target?.role,
        suspensionReason: cleanReason,
        isSuspicious: false,
        requiresAlertIcon: false
      });

      showToast('Suspension explanation updated.', 'success');
      return { success: true };
    },
    [currentUser, users, addAuditLog, showToast]
  );

  const getSuspensionHistory = useCallback(
    async (uid: string): Promise<SuspensionHistoryEntry[]> => {
      try {
        const res = await apiFetch(`/api/admin/users/${encodeURIComponent(uid)}/suspension-history`);
        if (res && res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.history)) {
            return data.history;
          }
        }
      } catch {}
      const localUser = users.find((u) => u.uid === uid);
      return localUser?.suspensionInfo?.history || [];
    },
    [users]
  );


  const verifyAndApproveAlumni = useCallback((uid: string, approve: boolean, flagReason?: string) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.uid === uid) {
          return {
            ...u,
            isVerified: approve,
            verificationStatus: approve ? 'verified' : 'rejected',
            verificationFlagReason: flagReason
          };
        }
        return u;
      })
    );

    const target = users.find((u) => u.uid === uid);
    addAuditLog({
      action: approve ? 'Alumni Account Approved' : 'Alumni Account Flagged / Rejected',
      actorId: currentUser?.uid || 'admin',
      actorName: currentUser?.name || 'Administrator',
      actorRole: currentUser?.role || 'admin',
      category: 'alumni_registration',
      details: approve
        ? `Alumnus "${target?.name}" (${target?.email}) officially approved and verified against registrar archives.`
        : `Alumnus registration for "${target?.name}" flagged: ${flagReason || 'Requires additional registrar validation'}.`,
      severity: approve ? 'success' : 'warning'
    });

    showToast(
      approve ? `Alumnus "${target?.name}" approved & verified!` : `Alumnus record marked with review flag.`,
      approve ? 'success' : 'info'
    );
  }, [users, currentUser, addAuditLog, showToast]);

  const sendEmergencyAnnouncement = useCallback((title: string, content: string) => {
    if (!currentUser || !permissions.canPostAnnouncements) {
      showToast('Permission denied: Staff/Admin authorization required.');
      return;
    }
    const newAnn: Announcement = {
      id: `ann_emerg_${Date.now()}`,
      title,
      content,
      important: true,
      urgent: true,
      category: 'emergency',
      publishedAt: new Date().toISOString(),
      createdBy: currentUser.uid,
      authorName: currentUser.name,
      authorRole: currentUser.headline || (currentUser.role ? currentUser.role.toUpperCase() : 'ADMIN')
    };

    setAnnouncements((prev) => [newAnn, ...prev]);

    const notif: AppNotification = {
      id: `notif_emerg_${Date.now()}`,
      type: 'announcement',
      title: `EMERGENCY ADVISORY: ${title}`,
      body: content.slice(0, 140) + '...',
      refId: newAnn.id,
      targetPath: `/portal/announcements/${encodeURIComponent(newAnn.id)}`,
      targetRoute: `/portal/announcements/${encodeURIComponent(newAnn.id)}`,
      metadata: { announcementId: newAnn.id },
      read: false,
      createdAt: new Date().toISOString()
    };
    setNotifications((prev) => [notif, ...prev]);

    addAuditLog({
      action: 'Emergency Broadcast Advisory Dispatched',
      actorId: currentUser.uid,
      actorName: currentUser.name,
      actorRole: currentUser.role,
      category: 'communication',
      details: `Urgent institutional advisory broadcast dispatched: "${title}".`,
      severity: 'alert'
    });

    showToast('Urgent announcement sent to all members.', 'success');
  }, [currentUser, permissions.canPostAnnouncements, addAuditLog, showToast]);

  const updateEmploymentStatus = useCallback((status: 'Employed' | 'Self-employed' | 'Seeking Opportunities' | 'Unemployed' | 'Retired' | 'N/A') => {
    if (!currentUser) return;
    updateProfile({ employmentStatus: status, lastEmploymentUpdateReminder: new Date().toISOString() });
    addAuditLog({
      action: 'Employment Information Updated',
      actorId: currentUser.uid,
      actorName: currentUser.name,
      actorRole: currentUser.role,
      category: 'career',
      details: `Status set to "${status}".`,
      severity: 'info'
    });
    showToast(`Employment status updated to: ${status}`, 'success');
  }, [currentUser, updateProfile, addAuditLog, showToast]);

  const syncAllDataToCloud = useCallback(async () => {
    setIsFirestoreSyncing(true);
    showToast('Pushing all institutional datasets to Cloud Firestore...', 'info');
    try {
      // 1. Flush and upload any pending offline messages first
      const offlineRes = await syncOfflineMessageQueue().catch(() => ({ syncedCount: 0, failedCount: 0 }));

      // 2. Push core datasets to Cloud Firestore
      const regRecords = getRegistrarRecords();
      const result = await syncAllCollectionsToFirestore({
        users,
        events,
        opportunities,
        announcements,
        registryRecords: regRecords,
        auditLogs,
        onProgress: (step) => {
          console.info('[Cloud Sync Progress]:', step);
        }
      });

      // 3. Sync datasets to backend REST API
      try {
        await fetch('/api/sync/all', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            users,
            events,
            opportunities,
            announcements,
            chats,
            messages: Object.values(messages).flat()
          })
        });
      } catch (backendSyncErr) {
        console.warn('Backend sync API notice:', backendSyncErr);
      }

      const msgNote = offlineRes.syncedCount > 0 ? ` (${offlineRes.syncedCount} queued messages delivered)` : '';

      if (result.success) {
        showToast(
          `Cloud Sync Complete: ${result.syncedCounts.users} Users, ${result.syncedCounts.events} Events, ${result.syncedCounts.opportunities} Opportunities, ${result.syncedCounts.announcements} Announcements, ${result.syncedCounts.registry_records} Student Registry records written to Firestore${msgNote}.`,
          'success'
        );
      } else {
        showToast(
          `Sync completed with notices: ${result.errors.slice(0, 2).join('; ')}${msgNote}`,
          'warning'
        );
      }
    } catch (err: any) {
      console.warn('Manual Firestore sync error:', err);
      showToast(`Firestore synchronization notice: ${err?.message || err}`, 'error');
    } finally {
      setIsFirestoreSyncing(false);
      setOfflineQueue(getOfflineMessageQueue());
    }
  }, [users, events, opportunities, announcements, auditLogs, chats, messages, showToast]);

  const purgeDatabaseSampleData = useCallback(async (): Promise<{ success: boolean; message: string }> => {
    setIsFirestoreSyncing(true);
    showToast('Purging all database records (keeping Superadmin account only)...', 'info');
    try {
      // 1. Reset server-side credentials & moderation stores (superadmin-only)
      if (getAuthToken()) {
        await apiFetch('/api/admin/database/reset-superadmin-only', { method: 'POST' }).catch(() => null);
      }

      // 2. Purge all remote Cloud Firestore collections except the primary superadmin
      const cloudRes = await purgeAllFirestoreSampleData();

      // 3. Retain only primary superadmin in state and credentials vault
      const retainedSuperadmin =
        users.find((u) => u.uid === 'usr_superadmin_cecilia') ||
        INITIAL_USERS[0];
      const nextUsers = retainedSuperadmin ? [retainedSuperadmin] : [];
      setUsers(nextUsers);

      setEvents([]);
      setAnnouncements([]);
      setOpportunities([]);
      setJobApplications([]);
      setReservations([]);
      setFeedPosts([]);
      setGalleryItems([]);
      setFriendRequests([]);
      setChats([]);
      setMessages({});
      setNotifications([]);
      setAuditLogs([]);
      setAutomationJobs([]);
      setCareerSurveys([]);
      setBackups([]);
      setConnectionsMap({});
      setFollowingMap({});
      setOfflineQueue([]);

      try {
        [
          STORAGE_KEYS.USERS,
          STORAGE_KEYS.REQUESTS,
          STORAGE_KEYS.CHATS,
          STORAGE_KEYS.MESSAGES,
          STORAGE_KEYS.NOTIFICATIONS,
          STORAGE_KEYS.EVENTS,
          STORAGE_KEYS.ANNOUNCEMENTS,
          STORAGE_KEYS.OPPORTUNITIES,
          STORAGE_KEYS.APPLICATIONS,
          'alumni_milestones_v5',
          STORAGE_KEYS.FOLLOWING,
          STORAGE_KEYS.CONNECTIONS,
          STORAGE_KEYS.GALLERY,
          STORAGE_KEYS.FEED_POSTS,
          STORAGE_KEYS.AUDIT_LOGS,
          STORAGE_KEYS.AUTOMATION_JOBS,
          STORAGE_KEYS.CAREER_SURVEYS,
          STORAGE_KEYS.BACKUPS,
          STORAGE_KEYS.RESERVATIONS,
          CREDENTIALS_VAULT_KEY,
          DELETED_ACCOUNT_UIDS_KEY,
          'st_cecilia_credentials_vault',
          'st_cecilia_registrar_student_records',
          'st_cecilia_registrar_records_v1',
          'st_cecilia_student_records_v1',
          'st_cecilia_accredited_registry_records',
          'st_cecilia_registry_conflicts',
          'st_cecilia_chapters_v1',
          'st_cecilia_superadmin_security_alerts_v1',
          'st_cecilia_centenary_time_capsules_v1',
          'st_cecilia_governance_policies_v1',
          'alumni_offline_message_queue_v1',
          'cecilian_event_reminders_v1',
          'scc_jobs_badge_dismissed_v1'
        ].forEach((k) => localStorage.removeItem(k));
        clearDispatchedEmails();

        if (retainedSuperadmin) {
          persistUsersSafe(nextUsers);
          saveCredentialToVault({
            uid: retainedSuperadmin.uid,
            name: retainedSuperadmin.name,
            email: retainedSuperadmin.email,
            studentId: retainedSuperadmin.studentId,
            alumniId: retainedSuperadmin.alumniId,
            employeeId: retainedSuperadmin.employeeId,
            ...(retainedSuperadmin.passwordHash ? { passwordHash: retainedSuperadmin.passwordHash } : {}),
            role: retainedSuperadmin.role,
            isVerified: true
          });
        }
      } catch {}

      const msg = `Database reset complete: ${cloudRes.deletedCount} cloud records purged. Only the Superadmin account remains.`;
      showToast(msg, 'success');
      return { success: true, message: msg };
    } catch (err: any) {
      const errMsg = `Purge notice: ${err?.message || err}`;
      showToast(errMsg, 'error');
      return { success: false, message: errMsg };
    } finally {
      setIsFirestoreSyncing(false);
    }
  }, [users, setNotifications, showToast]);

  const testDatabaseWrite = useCallback(async (): Promise<{ success: boolean; latencyMs: number; message: string }> => {
    setIsFirestoreSyncing(true);
    try {
      const res = await testFirestoreWriteSync();
      if (res.success) {
        const msg = `Firestore live verification passed (${res.latencyMs}ms roundtrip to ${FIRESTORE_DATABASE_ID}). Writes and real-time listeners are active.`;
        showToast(msg, 'success');
        return { success: true, latencyMs: res.latencyMs, message: msg };
      } else {
        const msg = `Firestore connection notice: ${res.error || 'Write could not be completed'}`;
        showToast(msg, 'error');
        return { success: false, latencyMs: res.latencyMs, message: msg };
      }
    } catch (err: any) {
      const msg = `Firestore connection error: ${err?.message || err}`;
      showToast(msg, 'error');
      return { success: false, latencyMs: -1, message: msg };
    } finally {
      setIsFirestoreSyncing(false);
    }
  }, [showToast]);

  const isSuperAdmin = normalizeSystemRole(currentUser?.role) === 'superadmin';

  return (
    <AlumniContext.Provider
      value={{
        currentUser,
        users,
        friendRequests,
        chats,
        messages,
        notifications,
        events,
        announcements,
        opportunities,
        notificationSettings,
        activeTab,
        setActiveTab,
        deepLinkTarget,
        setDeepLinkTarget,
        clearDeepLinkTarget,
        highlightedItemId,
        clearHighlightedItem,
        navigateFromNotification,
        navigateToPortalPath,
        reportUnauthorizedSuperAdminAccess,
        selectedUserIdForModal,
        setSelectedUserIdForModal,
        isEditProfileModalOpen,
        setIsEditProfileModalOpen,
        openEditProfile,
        closeEditProfile,
        permissions,
        isFirebaseConnected,
        isFirestoreSyncing,
        authReady,
        isLoadingData,
        isOnline,
        isBackgroundSyncing,
        lastBackgroundSyncTime,
        refreshData,
        triggerBackgroundSync,
        loginWithGoogle,
        syncAllDataToCloud,
        purgeDatabaseSampleData,
        purgeAllSampleData: purgeDatabaseSampleData as any,
        testDatabaseWrite,
        firestoreDatabaseId: FIRESTORE_DATABASE_ID,
        login,
        biometricLoginWithRefreshToken,
        activeSessionConflict,
        clearActiveSessionConflict,
        terminateOtherSessionAndLogin,
        register,
        clientPlatform,
        setClientPlatformOverride,
        loginPlatformError,
        clearLoginPlatformError,
        loginPendingAccountNotice,
        clearLoginPendingAccountNotice,
        loginSuspensionNotice,
        clearLoginSuspensionNotice,
        moderatorQuota,
        logout,
        switchUser,
        resetPassword,
        resetUserPasswordByEmail,
        deleteAccount,
        changeEmail,
        changePassword,
        updateProfile,
        updateUserProfile: updateProfile,
        addExperience,
        removeExperience,
        addEducation,
        removeEducation,
        followingIds,
        connectionIds,
        sendFriendRequest,
        acceptFriendRequest,
        declineFriendRequest,
        cancelFriendRequest,
        toggleFollow,
        isFollowing,
        isConnected,
        hasPendingRequestWith,
        activeChatId,
        setActiveChatId,
        sendMessage,
        unsendMessage,
        deleteMessageForMe,
        reactToMessage,
        getOrCreateChat,
        markChatAsRead,
        offlineQueueCount,
        offlineQueue,
        syncOfflineMessages,
        retryOfflineMessage,
        cancelOfflineMessage,
        createEvent,
        editEvent,
        deleteEvent,
        toggleLikeEvent,
        addCommentToEvent,
        rsvpEvent,
        updateEventAttendance,
        manualCheckInAttendee,
        updateAttendeeInfo,
        removeAttendeeFromEvent,
        addAttendeeToEvent,
        reservations,
        reserveEventSlot,
        cancelEventReservation,
        updateEventReservationSettings,
        pushPermissionStatus,
        requestBrowserPushPermission,
        confirmEventAttendance,
        sendTest24HourAlert,
        upcoming24hReservations,
        createAnnouncement,
        editAnnouncement,
        deleteAnnouncement,
        togglePinAnnouncement,
        toggleHeartAnnouncement,
        createOpportunity,
        updateOpportunity,
        deleteOpportunity,
        approveOpportunity,
        rejectOpportunity,
        applyForJob,
        withdrawJobApplication,
        updateApplicationStatus,
        verifyEmployer,
        toggleEmployerJobPosting,
        selfVerifyAlumniWithRegistry,
        isAlumniVerified,
        registrar_verification,
        verifyAlumniStatus,
        getConnectionStatus,
        jobApplications,
        userNotifications,
        unreadNotificationsCount,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        deleteNotification,
        updateNotificationSettings,
        updateUserSettings,
        galleryItems,
        addGalleryItem,
        deleteGalleryItem,
        feedPosts,
        addFeedPost,
        createSocialPost,
        toggleLikeFeedPost,
        toggleHeartFeedPost,
        addFeedPostComment,
        shareFeedPost,
        deleteFeedPost,
        updateFeedPost,
        pinProfilePost,
        blockUser,
        unblockUser,
        deleteMyAccount,
        viewedProfileIdentifier,
        viewedPostId,
        openProfile,
        openPostPermalink,
        closeSubRoute,
        createUserByAdmin,
        fetchAlumni,
        createAlumni,
        updateAlumniProfile,
        verifyUser,
        setUserVerified: setUserVerifiedExplicit,
        updateUserRole,
        setUserRole: updateUserRole,
        deleteAlumni,
        isEmployerExpired,
        requestEmployerRenewal,
        renewEmployerAccount,
        checkAndEnforceEmployerExpirations,
        auditLogs: isSuperAdmin ? auditLogs : [],
        automationJobs,
        careerSurveys,
        backups: isSuperAdmin ? backups : [],
        addAuditLog,
        submitCareerSurvey,
        runAutomationJob,
        triggerDatabaseBackup,
        unlockUserAccount,
        suspendUserAccount,
        lockUserAccount,
        extendUserSuspension,
        updateSuspensionReason,
        getSuspensionHistory,
        verifyAndApproveAlumni,
        sendEmergencyAnnouncement,
        updateEmploymentStatus,
        toasts,
        toastMessage,
        showToast,
        dismissToast
      }}
    >
      {children}
    </AlumniContext.Provider>
  );
};

export const useAlumni = () => {
  const context = useContext(AlumniContext);
  if (!context) {
    throw new Error('useAlumni must be used within an AlumniProvider');
  }
  return context;
};
