/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Formats an ISO timestamp into human-readable relative time ("2 hours ago").
 */
export function formatRelativeTime(isoDate?: string | number | null): string {
  if (!isoDate) return 'Just now';
  const date = new Date(isoDate);
  const ms = date.getTime();
  if (Number.isNaN(ms)) return 'Recently';

  const diffSeconds = Math.floor((Date.now() - ms) / 1000);
  if (diffSeconds < 45) return 'Just now';

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return diffMinutes === 1 ? '1 minute ago' : `${diffMinutes} minutes ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 5) {
    return diffWeeks === 1 ? '1 week ago' : `${diffWeeks} weeks ago`;
  }

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) {
    return diffMonths === 1 ? '1 month ago' : `${diffMonths} months ago`;
  }

  const diffYears = Math.floor(diffDays / 365);
  return diffYears === 1 ? '1 year ago' : `${diffYears} years ago`;
}

/**
 * Formats a timestamp as a full local date + time string in the viewer's browser timezone
 * for hover tooltips on relative timestamps.
 */
export function formatFullLocalDateTime(isoDate?: string | number | null): string {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';

  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}
