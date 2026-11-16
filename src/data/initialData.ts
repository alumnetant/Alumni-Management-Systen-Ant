import {
  UserProfile,
  FriendRequest,
  ChatThread,
  ChatMessage,
  AppNotification,
  AlumniEvent,
  EventReservation,
  Announcement,
  Opportunity,
  JobApplication,
  GalleryItem,
  AuditLogEntry,
  AutomationJob,
  CareerSurveyResponse,
  DatabaseBackupSnapshot,
  InstitutionalFeedPost
} from '../types';

/**
 * Official Seed Accounts for St. Cecilia's College Deployment
 * Pristine, verified credentials for every system role.
 */
export const INITIAL_USERS: UserProfile[] = [
  {
    uid: 'usr_superadmin_cecilia',
    name: 'Dr. Emmanuel C. Salcedo',
    email: 'superadmin@stcecilia.edu.ph',
    password: 'Password123!',
    role: 'superadmin',
    batch: '2010',
    course: 'PhD in Educational Technology & Systems Administration',
    location: 'St. Cecilia’s Executive Complex, Minglanilla, Cebu',
    profilePictureUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
    coverPhotoUrl: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=1200&auto=format&fit=crop&q=80',
    headline: 'Executive Systems Administrator & Chief Information Officer',
    about: 'Chief system architect overseeing data governance, emergency administrative controls, platform security, and digital longevity for the St. Cecilia’s College network.',
    phone: '+63 917 111 2001',
    employeeId: 'SCC-SUP-001',
    department: 'Office of the Executive President & IT Directorate',
    isVerified: true,
    followersCount: 0,
    followingCount: 0,
    connectionsCount: 0,
    experience: [],
    education: [],
    createdAt: '2024-01-01T00:00:00.000Z'
  }
];

export const INITIAL_FRIEND_REQUESTS: FriendRequest[] = [];
export const INITIAL_CHATS: ChatThread[] = [];
export const INITIAL_MESSAGES: Record<string, ChatMessage[]> = {};
export const INITIAL_NOTIFICATIONS: AppNotification[] = [];
export const INITIAL_EVENTS: AlumniEvent[] = [];
export const INITIAL_RESERVATIONS: EventReservation[] = [];
export const INITIAL_ANNOUNCEMENTS: Announcement[] = [];
export const INITIAL_OPPORTUNITIES: Opportunity[] = [];
export const INITIAL_JOB_APPLICATIONS: JobApplication[] = [];
export const INITIAL_GALLERY_ITEMS: GalleryItem[] = [];
export const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [];
export const INITIAL_AUTOMATION_JOBS: AutomationJob[] = [];
export const INITIAL_CAREER_SURVEYS: CareerSurveyResponse[] = [];
export const INITIAL_BACKUPS: DatabaseBackupSnapshot[] = [];
export const INITIAL_FEED_POSTS: InstitutionalFeedPost[] = [];

