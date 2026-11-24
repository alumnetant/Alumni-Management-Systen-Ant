/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const MOBILE_OR_TABLET_PLATFORM_TOKENS = new Set([
  'mobile',
  'native_apk',
  'apk',
  'tablet',
  'mobile_web',
  'ipad'
]);

/**
 * Pure predicate evaluating whether a serialized platform string or boolean flag
 * represents a restricted mobile or tablet client where only alumni accounts are allowed.
 */
export function isMobilePlatformToken(
  platform?: unknown,
  isMobileOrTabletFlag?: unknown
): boolean {
  if (isMobileOrTabletFlag === true) return true;
  if (typeof platform !== 'string') return false;
  return MOBILE_OR_TABLET_PLATFORM_TOKENS.has(platform.toLowerCase().trim());
}

/**
 * Pure User-Agent & touch capability check for mobile phones and tablets
 * (including iPadOS Safari desktop-mode reporting Macintosh with touch points).
 */
export function isMobileOrTabletUserAgent(
  userAgent?: string,
  maxTouchPoints = 0
): boolean {
  const ua = userAgent || '';
  const isMobileOrTabletUA =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Tablet|Silk/i.test(ua);
  const isIpadOSDesktopMode = /Macintosh/i.test(ua) && maxTouchPoints > 1;
  return isMobileOrTabletUA || isIpadOSDesktopMode;
}
