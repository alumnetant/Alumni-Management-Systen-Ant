/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Firebase Cloud Messaging (FCM) Token & Permission Service
 * Unified token management for React Web & Capacitor Android
 */

import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token } from '@capacitor/push-notifications';
import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import { doc, updateDoc, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore';
import { app, db } from '../lib/firebase';
import { UserProfile } from '../types';

export const FCM_VAPID_PUBLIC_KEY =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_VAPID_KEY) ||
  'BG76dqXNJbtI96zMEebXjzsr_i8pQ0y_9ERFB-DcG8R0Bak0RWHgMJo32cctrz0Osju-o6huqygEUY6oM8f8KY4';

const FCM_TOKEN_STORAGE_KEY = 'scc_fcm_device_token';

/**
 * Check if running inside Capacitor Android or iOS native shell
 */
export const isNativePlatform = (): boolean => {
  return Capacitor.isNativePlatform();
};

/**
 * Request notification permissions across Web and Capacitor Android
 */
export async function requestPushPermissions(): Promise<boolean> {
  try {
    if (isNativePlatform()) {
      const permStatus = await PushNotifications.checkPermissions();
      if (permStatus.receive === 'granted') {
        return true;
      }
      const requested = await PushNotifications.requestPermissions();
      return requested.receive === 'granted';
    }

    // Web Notification API
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        return true;
      }
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    return false;
  } catch (err) {
    console.warn('[FCM] Permission request error:', err);
    return false;
  }
}

/**
 * Save FCM token to the currently logged in user's Firestore document
 * Maintains a de-duplicated array of tokens (fcmTokens: string[])
 */
export async function saveFCMTokenToFirestore(
  userId: string,
  token: string,
  platform: 'web' | 'android' | 'ios'
): Promise<void> {
  if (!userId || !token) return;

  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const existingTokens: string[] = userSnap.data()?.fcmTokens || [];
      // Keep max 5 most recent tokens to avoid document bloating
      const updatedTokens = Array.from(new Set([...existingTokens, token])).slice(-5);

      await updateDoc(userRef, {
        fcmTokens: updatedTokens,
        lastFcmPlatform: platform,
        lastFcmTokenUpdatedAt: new Date().toISOString()
      });

      // Cache locally
      localStorage.setItem(FCM_TOKEN_STORAGE_KEY, token);
      console.info(`[FCM] Device token registered to Firestore for user: ${userId}`);
    }
  } catch (err) {
    console.warn('[FCM] Failed to save token to Firestore:', err);
  }
}

/**
 * Subscribe device token to cohort topics via backend proxy
 */
export async function subscribeToFCMTopics(
  token: string,
  user: UserProfile
): Promise<void> {
  if (!token) return;

  const topics: string[] = ['all_alumni'];

  if (user.batch) {
    topics.push(`batch_${user.batch}`);
  }

  if (user.role === 'employer') {
    topics.push(`employer_${user.uid}`);
  }

  try {
    await fetch('/api/fcm/subscribe-topics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, topics })
    }).catch(() => {
      // Graceful fallback if backend server route is processing
    });
  } catch {
    // Non-blocking
  }
}

/**
 * Initialize FCM, generate device token, and synchronize with Firestore
 * Runs seamlessly upon user login
 */
export async function initializeFCMForUser(user: UserProfile): Promise<string | null> {
  if (!user || !user.uid) return null;

  try {
    const hasPermission = await requestPushPermissions();
    if (!hasPermission) {
      console.info('[FCM] Push permissions not granted by user.');
      return null;
    }

    // 1. Android Capacitor Native Implementation
    if (isNativePlatform()) {
      return new Promise<string | null>((resolve) => {
        PushNotifications.addListener('registration', async (token: Token) => {
          const deviceToken = token.value;
          await saveFCMTokenToFirestore(user.uid, deviceToken, 'android');
          await subscribeToFCMTopics(deviceToken, user);
          resolve(deviceToken);
        });

        PushNotifications.addListener('registrationError', (error) => {
          console.warn('[FCM Android] Registration failed:', error);
          resolve(null);
        });

        PushNotifications.register();
      });
    }

    // 2. React Web Implementation
    const supported = await isSupported().catch(() => false);
    if (!supported) {
      console.info('[FCM Web] Firebase messaging is not supported in this browser.');
      return null;
    }

    const messaging = getMessaging(app);

    // Ensure service worker is registered
    let swRegistration: ServiceWorkerRegistration | undefined;
    if ('serviceWorker' in navigator) {
      swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js').catch(() => undefined);
    }

    const currentToken = await getToken(messaging, {
      vapidKey: FCM_VAPID_PUBLIC_KEY,
      serviceWorkerRegistration: swRegistration
    });

    if (currentToken) {
      await saveFCMTokenToFirestore(user.uid, currentToken, 'web');
      await subscribeToFCMTopics(currentToken, user);
      return currentToken;
    } else {
      console.info('[FCM Web] No registration token available. Request permission to generate one.');
      return null;
    }
  } catch (err) {
    console.warn('[FCM] Token generation failed:', err);
    return null;
  }
}

/**
 * Remove device FCM token from Firestore on user sign-out
 */
export async function removeFCMDeviceToken(userId: string): Promise<void> {
  const token = localStorage.getItem(FCM_TOKEN_STORAGE_KEY);
  if (!userId || !token) return;

  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      fcmTokens: arrayRemove(token)
    });
    localStorage.removeItem(FCM_TOKEN_STORAGE_KEY);
    console.info(`[FCM] Token detached on sign out for user: ${userId}`);
  } catch (err) {
    console.warn('[FCM] Failed to detach token on sign out:', err);
  }
}
