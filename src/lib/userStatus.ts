/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface OnlineStatusResult {
  isOnline: boolean;
  statusLabel: string;
  dotColor: string;
}

/**
 * Calculates accurate active status for alumni users based on heartbeat timestamps.
 * Threshold: Within the past 5 minutes = "Active now" (emerald indicator)
 * Otherwise = Formatted relative activity (e.g. "Active 15m ago", "Active 2h ago")
 */
export function getUserOnlineStatus(user?: {
  lastActiveAt?: string | number;
  isOnline?: boolean;
} | null): OnlineStatusResult {
  if (!user) {
    return {
      isOnline: false,
      statusLabel: 'Offline',
      dotColor: 'bg-stone-300 dark:bg-stone-600'
    };
  }

  // If explicitly flagged offline
  if (user.isOnline === false) {
    return {
      isOnline: false,
      statusLabel: 'Offline',
      dotColor: 'bg-stone-300 dark:bg-stone-600'
    };
  }

  if (!user.lastActiveAt) {
    return {
      isOnline: false,
      statusLabel: 'Offline',
      dotColor: 'bg-stone-300 dark:bg-stone-600'
    };
  }

  const lastActiveMs =
    typeof user.lastActiveAt === 'number'
      ? user.lastActiveAt
      : new Date(user.lastActiveAt).getTime();

  if (isNaN(lastActiveMs)) {
    return {
      isOnline: false,
      statusLabel: 'Offline',
      dotColor: 'bg-stone-300 dark:bg-stone-600'
    };
  }

  const diffMs = Date.now() - lastActiveMs;
  if (diffMs < 0) {
    return {
      isOnline: true,
      statusLabel: 'Active now',
      dotColor: 'bg-emerald-500 ring-2 ring-emerald-500/20'
    };
  }

  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes <= 5) {
    return {
      isOnline: true,
      statusLabel: 'Active now',
      dotColor: 'bg-emerald-500 ring-2 ring-emerald-500/20'
    };
  } else if (diffMinutes < 60) {
    return {
      isOnline: false,
      statusLabel: `Active ${diffMinutes}m ago`,
      dotColor: 'bg-stone-400 dark:bg-stone-500'
    };
  } else if (diffMinutes < 1440) {
    const hours = Math.floor(diffMinutes / 60);
    return {
      isOnline: false,
      statusLabel: `Active ${hours}h ago`,
      dotColor: 'bg-stone-400 dark:bg-stone-600'
    };
  } else {
    const days = Math.floor(diffMinutes / 1440);
    return {
      isOnline: false,
      statusLabel: `Active ${days}d ago`,
      dotColor: 'bg-stone-300 dark:bg-stone-700'
    };
  }
}
