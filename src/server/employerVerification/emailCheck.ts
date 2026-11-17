/**
 * Email Verification & Provider Validation Module
 * Rejects free/disposable providers and handles cryptographic 24h tokens hashed at rest.
 */

import crypto from 'crypto';
import configData from './config/verificationConfig.json';
import { hashTokenHmac, verifyTokenHmac as verifyHmacDigest } from '../security/cryptoUtils';

export interface EmailVerificationToken {
  token: string;
  hashedToken: string;
  email: string;
  expiresAt: Date;
  used: boolean;
}

export function isFreeOrDisposableEmail(email: string): boolean {
  if (!email || !email.includes('@')) return true;
  const parts = email.toLowerCase().trim().split('@');
  const domain = parts[parts.length - 1];

  const blockedList = configData.freeAndDisposableDomains || [];
  return blockedList.includes(domain);
}

export function generateVerificationToken(_email: string): { token: string; hashedToken: string; expiresAt: Date } {
  // 32-byte secure random token hashed with server HMAC secret
  const token = crypto.randomBytes(32).toString('hex');
  const hashedToken = hashTokenHmac(token);

  // 24 hours expiration
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  return {
    token,
    hashedToken,
    expiresAt
  };
}

export function verifyTokenHash(providedToken: string, storedHash: string, expiresAt: Date | string | number): boolean {
  if (!providedToken || !storedHash) return false;

  const expirationDate = new Date(expiresAt);
  if (Date.now() > expirationDate.getTime()) {
    return false; // Expired
  }

  return verifyHmacDigest(providedToken, storedHash);
}
