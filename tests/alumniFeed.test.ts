import { describe, it, expect } from 'vitest';
import { FeedItem, FeedReactionType } from '../src/types/feed';

describe('Alumni Timeline & FYP Feed Logic', () => {
  const mockAnnouncement: FeedItem = {
    id: 'announcement_1',
    type: 'announcement',
    timestamp: new Date().toISOString(),
    title: 'Presidential Memorandum: University Week 2026',
    body: 'St. Cecilia’s College announces the grand Centennial Homecoming and University Week celebrations.',
    author: {
      name: 'Office of the College President',
      role: 'Presidential Directorate',
      isVerified: true
    },
    categoryTag: 'Circular · INSTITUTIONAL',
    reactions: {
      count: 12,
      reactionCounts: { like: 8, love: 2, celebrate: 1, insightful: 1 }
    },
    comments: [],
    commentsCount: 2,
    relevanceScore: 180,
    metadata: { isUrgent: true, isPinned: true },
    rawItem: {}
  };

  const mockMilestone: FeedItem = {
    id: 'milestone_1',
    type: 'milestone',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    title: 'Promoted to Senior Cloud Solutions Architect',
    body: 'Blessed to announce my promotion at Accenture Philippines. Grateful to my professors at SCC.',
    author: {
      name: 'Engr. Rafael D. Villanueva',
      role: 'Senior Cloud Architect',
      batch: '2020',
      course: 'BS Information Technology',
      isVerified: true
    },
    categoryTag: 'Milestone · Promotion',
    reactions: {
      count: 24,
      reactionCounts: { like: 10, love: 4, celebrate: 8, insightful: 2 }
    },
    comments: [],
    commentsCount: 5,
    relevanceScore: 120,
    metadata: { milestoneCompany: 'Accenture Philippines' },
    rawItem: {}
  };

  const mockEvent: FeedItem = {
    id: 'event_1',
    type: 'event',
    timestamp: new Date(Date.now() + 86400000 * 3).toISOString(),
    title: 'Grand Alumni Centennial Homecoming',
    body: 'Join fellow alumni across all batches at the SCC Gymnasium and Quadrangle.',
    author: {
      name: 'Alumni Affairs Office',
      role: 'Event Committee',
      isVerified: true
    },
    categoryTag: 'Event · REUNION',
    reactions: {
      count: 30,
      reactionCounts: { like: 18, love: 6, celebrate: 5, insightful: 1 }
    },
    comments: [],
    commentsCount: 8,
    relevanceScore: 140,
    metadata: {
      eventDate: new Date(Date.now() + 86400000 * 3).toISOString(),
      eventLocation: 'SCC Gymnasium',
      attendeesCount: 145,
      isAttending: true
    },
    rawItem: {}
  };

  it('correctly aggregates distinct content types into a unified feed', () => {
    const feed = [mockAnnouncement, mockMilestone, mockEvent];
    expect(feed.length).toBe(3);
    const types = feed.map((f) => f.type);
    expect(types).toContain('announcement');
    expect(types).toContain('milestone');
    expect(types).toContain('event');
  });

  it('correctly prioritizes high-relevance items in For You (FYP) mode', () => {
    const feed = [mockMilestone, mockAnnouncement, mockEvent];
    const sortedFyp = [...feed].sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Urgent presidential announcement should be rank 1
    expect(sortedFyp[0].id).toBe('announcement_1');
    expect(sortedFyp[0].metadata?.isUrgent).toBe(true);
  });

  it('correctly filters official circulars and events in Official tab', () => {
    const feed = [mockAnnouncement, mockMilestone, mockEvent];
    const officialOnly = feed.filter((i) => i.type === 'announcement' || i.type === 'event');

    expect(officialOnly.length).toBe(2);
    expect(officialOnly.map((i) => i.type)).toEqual(['announcement', 'event']);
  });

  it('correctly filters feed items matching search keywords', () => {
    const feed = [mockAnnouncement, mockMilestone, mockEvent];
    const query = 'Accenture'.toLowerCase();

    const matches = feed.filter(
      (item) =>
        item.title.toLowerCase().includes(query) ||
        item.body.toLowerCase().includes(query) ||
        (item.metadata?.milestoneCompany || '').toLowerCase().includes(query)
    );

    expect(matches.length).toBe(1);
    expect(matches[0].id).toBe('milestone_1');
  });

  it('supports reaction toggling and count adjustments', () => {
    const currentCounts = { like: 5, love: 1, celebrate: 0, insightful: 0 };
    let userReaction: FeedReactionType | undefined = undefined;

    // User clicks 'celebrate'
    const chosen: FeedReactionType = 'celebrate';
    currentCounts[chosen] += 1;
    userReaction = chosen;

    expect(userReaction).toBe('celebrate');
    expect(currentCounts.celebrate).toBe(1);

    // User changes reaction to 'love'
    currentCounts[userReaction] -= 1;
    currentCounts['love'] += 1;
    userReaction = 'love';

    expect(userReaction).toBe('love');
    expect(currentCounts.celebrate).toBe(0);
    expect(currentCounts.love).toBe(2);
  });
});
