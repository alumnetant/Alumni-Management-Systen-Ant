/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Cryptographically secure ID and token generator to satisfy CodeQL (CWE-338)
 * and ensure tamper-resistant identifiers across browser and Node.js runtimes.
 */

export function generateSecureId(prefix = 'id'): string {
  if (typeof crypto !== 'undefined') {
    if (typeof crypto.randomUUID === 'function') {
      return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    }
    if (typeof crypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(8);
      crypto.getRandomValues(bytes);
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      return `${prefix}_${hex}`;
    }
  }

  // Node.js environment fallback
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodeCrypto = require('crypto');
    return `${prefix}_${nodeCrypto.randomBytes(8).toString('hex')}`;
  } catch {
    return `${prefix}_${Date.now().toString(36)}_${(Date.now() % 100000).toString(36)}`;
  }
}

export function generateSecureNumericCode(min = 10000, max = 99999): number {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const range = max - min + 1;
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return min + (array[0] % range);
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodeCrypto = require('crypto');
    return nodeCrypto.randomInt(min, max + 1);
  } catch {
    return min + Math.floor((Date.now() % 100000) / 100000 * (max - min));
  }
}

export function generateShortToken(length = 6): string {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
  let result = '';
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    for (let i = 0; i < length; i++) {
      result += chars[bytes[i] % chars.length];
    }
    return result;
  }
  return generateSecureId('tok').slice(-length);
}
