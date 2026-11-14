import type { FeedRankingConfig, InstitutionalFeedPost } from '../types';
import type { ViewerContext } from '../lib/postVisibility';

export const DEFAULT_FEED_CONFIG: FeedRankingConfig = {
  sortMode: 'chronological',
  likeWeight: 1,
  commentWeight: 2,
  decayOffsetHours: 2,
  decayExponent: 1.5,
  sameBatchBoost: 1.3,
  sameDepartmentBoost: 1.3,
  recentInteractionBoost: 1.25,
  maxPinnedAnnouncements: 3,
  maxConsecutiveSameAuthor: 3,
  pageSize: 10
};

export interface AuthorAffiliationLike {
  batch?: string;
  course?: string;
  department?: string;
}

/**
 * Computes simple, deterministic relevance score (no ML):
 *   score = (likeWeight * likes + commentWeight * comments) / (hours_since_posted + decayOffsetHours) ^ decayExponent
 * Multiplied by configurable boosts for same batch, same department, and recent author interactions.
 *
 * Strictly uses `post.createdAt` (never `updatedAt`) so editing a post never resets its age or position.
 */
export function calculateFeedRelevanceScore(
  post: InstitutionalFeedPost,
  viewer: ViewerContext | null | undefined,
  config: FeedRankingConfig,
  interactedAuthorIds?: Set<string>,
  nowMs = Date.now(),
  authorAccount?: AuthorAffiliationLike | null
): number {
  const likesCount = (post.likes?.length || 0) + (post.hearts?.length || 0);
  const commentsCount = post.comments?.length || 0;
  const engagement = likesCount * config.likeWeight + commentsCount * config.commentWeight;

  const createdMs = new Date(post.createdAt || nowMs).getTime();
  const safeCreatedMs = Number.isNaN(createdMs) ? nowMs : createdMs;
  const hoursSincePosted = Math.max(0, (nowMs - safeCreatedMs) / (1000 * 60 * 60));

  const denominator = Math.pow(
    hoursSincePosted + Math.max(0.1, config.decayOffsetHours),
    Math.max(0.1, config.decayExponent)
  );
  let score = engagement / denominator;

  if (!viewer) {
    return score;
  }

  // Never correlate anonymous posts with an author's batch/department or social interaction history
  if (!post.isAnonymous) {
    const viewerBatch = (viewer.batch || '').trim();
    const authorBatch = (post.targetBatch || authorAccount?.batch || '').trim();
    if (viewerBatch && authorBatch && viewerBatch === authorBatch) {
      score *= config.sameBatchBoost;
    }

    const viewerDept = (viewer.department || viewer.course || '').trim().toLowerCase();
    const authorDept = (post.targetDepartment || authorAccount?.department || authorAccount?.course || '')
      .trim()
      .toLowerCase();
    if (viewerDept && authorDept && viewerDept === authorDept) {
      score *= config.sameDepartmentBoost;
    }

    if (interactedAuthorIds && post.authorId && post.authorId !== viewer.uid && interactedAuthorIds.has(post.authorId)) {
      score *= config.recentInteractionBoost;
    }
  }

  return score;
}

/**
 * Enforces the Step 4 rule: avoid showing more than `maxConsecutive` posts in a row from the same author.
 * Anonymous posts receive distinct keys so they do not cluster or reveal shared authorship.
 */
export function enforceMaxConsecutiveAuthor(
  orderedPosts: InstitutionalFeedPost[],
  maxConsecutive = 3
): InstitutionalFeedPost[] {
  const cap = Math.max(1, Math.floor(maxConsecutive));
  if (orderedPosts.length <= cap) return [...orderedPosts];

  const pool = [...orderedPosts];
  const result: InstitutionalFeedPost[] = [];
  let currentAuthorKey = '';
  let currentRunLength = 0;

  const getAuthorKey = (p: InstitutionalFeedPost) =>
    p.isAnonymous ? `anon:${p.id}` : p.authorId || `unknown:${p.id}`;

  while (pool.length > 0) {
    let pickIndex = pool.findIndex((candidate) => {
      const key = getAuthorKey(candidate);
      return key !== currentAuthorKey || currentRunLength < cap;
    });

    // If all remaining posts in the pool belong to the same author, emit sequentially so no posts are dropped
    if (pickIndex === -1) {
      pickIndex = 0;
    }

    const [chosen] = pool.splice(pickIndex, 1);
    const chosenKey = getAuthorKey(chosen);
    if (chosenKey === currentAuthorKey) {
      currentRunLength += 1;
    } else {
      currentAuthorKey = chosenKey;
      currentRunLength = 1;
    }
    result.push(chosen);
  }

  return result;
}

export function validateAndMergeFeedConfig(
  current: FeedRankingConfig,
  updates: Partial<FeedRankingConfig>
): FeedRankingConfig {
  const toFinite = (val: unknown, fallback: number, min: number, max: number): number => {
    if (val === undefined) return fallback;
    const num = Number(val);
    if (!Number.isFinite(num) || num < min || num > max) {
      throw new Error(`Feed configuration parameter out of range [${min}, ${max}].`);
    }
    return num;
  };

  const toInt = (val: unknown, fallback: number, min: number, max: number): number => {
    if (val === undefined) return fallback;
    const num = Math.floor(Number(val));
    if (!Number.isFinite(num) || num < min || num > max) {
      throw new Error(`Feed configuration parameter must be an integer between ${min} and ${max}.`);
    }
    return num;
  };

  const sortMode =
    updates.sortMode !== undefined
      ? updates.sortMode === 'relevance' || updates.sortMode === 'chronological'
        ? updates.sortMode
        : (() => {
            throw new Error('sortMode must be either "chronological" or "relevance".');
          })()
      : current.sortMode;

  return {
    sortMode,
    likeWeight: toFinite(updates.likeWeight, current.likeWeight, 0, 20),
    commentWeight: toFinite(updates.commentWeight, current.commentWeight, 0, 20),
    decayOffsetHours: toFinite(updates.decayOffsetHours, current.decayOffsetHours, 0.5, 48),
    decayExponent: toFinite(updates.decayExponent, current.decayExponent, 0.2, 5),
    sameBatchBoost: toFinite(updates.sameBatchBoost, current.sameBatchBoost, 1, 5),
    sameDepartmentBoost: toFinite(updates.sameDepartmentBoost, current.sameDepartmentBoost, 1, 5),
    recentInteractionBoost: toFinite(updates.recentInteractionBoost, current.recentInteractionBoost, 1, 5),
    maxPinnedAnnouncements: toInt(updates.maxPinnedAnnouncements, current.maxPinnedAnnouncements, 1, 3),
    maxConsecutiveSameAuthor: toInt(updates.maxConsecutiveSameAuthor, current.maxConsecutiveSameAuthor, 1, 10),
    pageSize: toInt(updates.pageSize, current.pageSize, 1, 50)
  };
}
