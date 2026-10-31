/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * FCM Notifications Hook
 * Manages foreground message listeners on Web and Capacitor Android,
 * and synchronizes token generation upon login.
 */

import { useEffect, useRef } from 'react';
import { getMessaging, onMessage, isSupported } from 'firebase/messaging';
import { PushNotifications, ActionPerformed, PushNotificationSchema } from '@capacitor/push-notifications';
import { app } from '../lib/firebase';
import { useAlumni } from '../context/AlumniContext';
import {
  isNativePlatform,
  initializeFCMForUser,
  removeFCMDeviceToken
} from '../services/fcmTokenService';

export function useFCMNotifications() {
  const { currentUser, setActiveTab } = useAlumni();
  const initializedUserUidRef = useRef<string | null>(null);

  // 1. Seamless FCM Device Token Initialization upon login
  useEffect(() => {
    if (!currentUser || !currentUser.uid) {
      initializedUserUidRef.current = null;
      return;
    }

    if (initializedUserUidRef.current === currentUser.uid) {
      return;
    }

    initializedUserUidRef.current = currentUser.uid;

    // Small delay to allow Firestore connection to stabilize
    const timeout = setTimeout(() => {
      initializeFCMForUser(currentUser).catch((err) => {
        console.warn('[FCM] Error in background initialization:', err);
      });
    }, 1500);

    return () => clearTimeout(timeout);
  }, [currentUser]);

  // 2. Dual-Platform Foreground & Background Action Listeners
  useEffect(() => {
    // A. Native Android Capacitor Environment
    if (isNativePlatform()) {
      let isSubscribed = true;

      // Handle foreground push notification (show interactive in-app toast)
      const receivedListenerPromise = PushNotifications.addListener(
        'pushNotificationReceived',
        (notification: PushNotificationSchema) => {
          if (!isSubscribed) return;
          console.info('[FCM Android Foreground] Notification received:', notification);

          window.dispatchEvent(
            new CustomEvent('applet:fcm-push-received', {
              detail: {
                title: notification.title || "St. Cecilia's College",
                body: notification.body || 'You have a new update.',
                route: notification.data?.route || 'dashboard',
                tag: notification.data?.tag || 'Alumnet Notice',
                data: notification.data || {}
              }
            })
          );
        }
      );

      // Handle system tray notification tap / action performed
      const actionListenerPromise = PushNotifications.addListener(
        'pushNotificationActionPerformed',
        (action: ActionPerformed) => {
          console.info('[FCM Android Tray Tap] Action performed:', action);
          const route = action.notification.data?.route;
          if (route) {
            if (['announcements', 'events', 'opportunities', 'network', 'profile'].includes(route)) {
              setActiveTab(route as any);
            }
          }
        }
      );

      return () => {
        isSubscribed = false;
        receivedListenerPromise.then((handle) => handle.remove()).catch(() => {});
        actionListenerPromise.then((handle) => handle.remove()).catch(() => {});
      };
    }

    // B. React Web Environment
    let unsubscribeWeb: (() => void) | undefined;

    isSupported().then((supported) => {
      if (!supported) return;

      try {
        const messaging = getMessaging(app);

        unsubscribeWeb = onMessage(messaging, (payload) => {
          console.info('[FCM Web Foreground] Message received:', payload);

          const title = payload.notification?.title || payload.data?.title || "St. Cecilia's College";
          const body = payload.notification?.body || payload.data?.body || 'New announcement available.';
          const route = payload.data?.route || 'announcements';
          const tag = payload.data?.tag || 'Presidential Bulletin';

          window.dispatchEvent(
            new CustomEvent('applet:fcm-push-received', {
              detail: {
                title,
                body,
                route,
                tag,
                data: payload.data || {}
              }
            })
          );
        });
      } catch (err) {
        console.warn('[FCM Web] Failed to bind onMessage listener:', err);
      }
    });

    return () => {
      if (unsubscribeWeb) unsubscribeWeb();
    };
  }, [setActiveTab]);

  return {
    initializeDeviceToken: () => currentUser && initializeFCMForUser(currentUser),
    removeDeviceToken: () => currentUser && removeFCMDeviceToken(currentUser.uid)
  };
}
