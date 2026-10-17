/**
 * St. Cecilia's College - Cecilian Alumnet
 * PWA Service Worker & Real Web Push Notifications Handler
 *
 * Compliant with W3C Push API, Notifications API, and Background Sync
 * Supports Android Chrome, iOS Safari 16.4+ (PWA/Standalone), Edge, and modern browsers.
 */

const CACHE_NAME = 'sc-alumnet-v2';
const STATIC_ASSETS = [
  '/',
  '/icon.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/apple-touch-icon.png'
];

// Service Worker Installation
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Cache addAll skipped for some assets:', err);
      });
    })
  );
});

// Service Worker Activation
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// ============================================================================
// REAL PUSH NOTIFICATIONS EVENT LISTENER
// Wakes up device in background / when app is closed to display native OS notification
// ============================================================================
self.addEventListener('push', (event) => {
  console.info('[SW Push] Received push event from network.');

  let payload = {
    title: "St. Cecilia's College - Alumni Alert",
    body: "You have a new update in Cecilian Alumnet.",
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: 'sc-alumnet-push',
    data: {
      url: '/',
      timestamp: Date.now()
    }
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = {
        ...payload,
        ...parsed,
        data: {
          ...payload.data,
          ...(parsed.data || {})
        }
      };
    } catch (err) {
      const text = event.data.text();
      if (text) {
        payload.body = text;
      }
    }
  }

  // Deduplication Tag: Prevents spamming duplicate alerts
  const notificationTag =
    payload.tag ||
    (payload.data && payload.data.chatId ? `chat-${payload.data.chatId}` : undefined) ||
    (payload.data && payload.data.eventId ? `event-${payload.data.eventId}` : undefined) ||
    `sc-push-${Date.now()}`;

  const options = {
    body: payload.body,
    icon: payload.icon || '/pwa-192x192.png',
    badge: payload.badge || '/pwa-192x192.png',
    tag: notificationTag,
    renotify: true,
    requireInteraction: false,
    vibrate: [120, 60, 120, 60, 180],
    data: payload.data || {},
    actions: payload.actions || [
      { action: 'open', title: 'Open Alumnet' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, options)
  );
});

// ============================================================================
// NOTIFICATION CLICK HANDLER
// Navigates directly to the specific conversation, event, or announcement
// ============================================================================
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const clickData = event.notification.data || {};
  let targetPath = '/';

  if (clickData.chatId) {
    targetPath = `/?tab=messages&chatId=${encodeURIComponent(clickData.chatId)}`;
  } else if (clickData.eventId) {
    targetPath = `/?tab=events&eventId=${encodeURIComponent(clickData.eventId)}`;
  } else if (clickData.announcementId) {
    targetPath = `/?tab=announcements&announcementId=${encodeURIComponent(clickData.announcementId)}`;
  } else if (clickData.url) {
    targetPath = clickData.url;
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // 1. If an existing app window is open, focus it and broadcast event
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if ('focus' in client) {
          client.postMessage({
            type: 'PUSH_NOTIFICATION_CLICK',
            data: clickData,
            targetPath
          });
          return client.focus();
        }
      }

      // 2. Otherwise open a new window to the destination
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetPath);
      }
    })
  );
});

// Notification Close listener for analytics or state clean-up
self.addEventListener('notificationclose', (_event) => {
  // Silent cleanup
});
