/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Normalized Feed Types for Alumni Social Timeline (FYP)
 */

export type FeedItemType = 'announcement' | 'event' | 'milestone' | 'opportunity';

export type FeedReactionType = 'like' | 'love' | 'celebrate' | 'insightful';

export interface FeedComment {
  id: string;
  authorUid: string;
  authorName: string;
  authorAvatar?: string;
  authorBatch?: string;
  content: string;
  createdAt: string;
}

export interface FeedItem {
  id: string;
  type: FeedItemType;
  timestamp: string; // ISO date for chronological ordering
  title: string;
  body: string;
  author: {
    uid?: string;
    name: string;
    role?: string;
    avatarUrl?: string;
    batch?: string;
    course?: string;
    department?: string;
    isVerified?: boolean;
  };
  mediaUrl?: string;
  mediaGallery?: string[];
  categoryTag: string;
  badgeLabel?: string;
  reactions: {
    count: number;
    userReaction?: FeedReactionType;
    reactionCounts: Record<FeedReactionType, number>;
  };
  comments: FeedComment[];
  commentsCount: number;
  relevanceScore: number;
  metadata?: {
    eventDate?: string;
    eventEndDate?: string;
    eventLocation?: string;
    isVirtual?: boolean;
    isAttending?: boolean;
    attendeesCount?: number;
    opportunityCompany?: string;
    opportunitySalary?: string;
    opportunityLocation?: string;
    opportunityType?: string;
    matchScore?: number;
    milestoneCompany?: string;
    milestoneCategory?: string;
    isUrgent?: boolean;
    isPinned?: boolean;
    attachmentsCount?: number;
  };
  rawItem: any;
}

export type FeedTab = 'foryou' | 'recent' | 'official';
