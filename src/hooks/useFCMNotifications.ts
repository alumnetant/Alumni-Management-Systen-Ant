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
import { buildPortalUrlForTab } from '../lib/notificationDeepLink';

export function useFCMNotifications() {
  const { currentUser, navigateToPortalPath } = useAlumni();
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
    const computeTargetPath = (data?: Record<string, any>) => {
      if (!data) return '/portal/dashboard';
      if (typeof data.targetPath === 'string' && data.targetPath.startsWith('/portal/')) return data.targetPath;
      if (typeof data.targetRoute === 'string' && data.targetRoute.startsWith('/portal/')) return data.targetRoute;
      if (typeof data.url === 'string' && data.url.startsWith('/portal/')) return data.url;
      const route = data.route || data.category || 'dashboard';
      const id = data.eventId || data.announcementId || data.postId || data.chatId || data.jobId || data.targetId || data.refId;
      return buildPortalUrlForTab(route, data.subTab, id);
    };

    // A. Native Android Capacitor Environment
    if (isNativePlatform()) {
      let isSubscribed = true;

      // Handle foreground push notification (show interactive in-app toast)
      const receivedListenerPromise = PushNotifications.addListener(
        'pushNotificationReceived',
        (notification: PushNotificationSchema) => {
          if (!isSubscribed) return;
          console.info('[FCM Android Foreground] Notification received:', notification);
          const resolvedPath = computeTargetPath(notification.data);

          window.dispatchEvent(
            new CustomEvent('applet:fcm-push-received', {
              detail: {
                title: notification.title || "St. Cecilia's College",
                body: notification.body || 'You have a new update.',
                route: notification.data?.route || 'dashboard',
                targetPath: resolvedPath,
                targetRoute: resolvedPath,
                tag: notification.data?.tag || 'Alumnet Notice',
                data: { ...(notification.data || {}), targetPath: resolvedPath, targetRoute: resolvedPath }
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
          const resolvedPath = computeTargetPath(action.notification.data);
          navigateToPortalPath(resolvedPath);
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
          const resolvedPath = computeTargetPath(payload.data);
          const tag = payload.data?.tag || 'Presidential Bulletin';

          window.dispatchEvent(
            new CustomEvent('applet:fcm-push-received', {
              detail: {
                title,
                body,
                route,
                targetPath: resolvedPath,
                targetRoute: resolvedPath,
                tag,
                data: { ...(payload.data || {}), targetPath: resolvedPath, targetRoute: resolvedPath }
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
  }, [navigateToPortalPath]);

  return {
    initializeDeviceToken: () => currentUser && initializeFCMForUser(currentUser),
    removeDeviceToken: () => currentUser && removeFCMDeviceToken(currentUser.uid)
  };
}
