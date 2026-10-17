/**
 * St. Cecilia's College - Cecilian Alumnet
 * Firebase Cloud Messaging Service Worker (FCM)
 */

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Initialize Firebase in Service Worker using existing config
firebase.initializeApp({
  projectId: "gen-lang-client-0856157514",
  appId: "1:1009258374587:web:54ceb8986fca911019d09e",
  apiKey: "AIzaSyBlWVOajT23-xN7cRpIh7GciyytmGPeUcI",
  messagingSenderId: "1009258374587"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.info('[FCM SW] Received background message:', payload);
  const notificationTitle = payload.notification?.title || payload.data?.title || "St. Cecilia's College";
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'New update from Cecilian Alumnet',
    icon: payload.notification?.icon || '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    data: payload.data || {},
    vibrate: [100, 50, 100],
    tag: payload.data?.tag || `sc-fcm-${Date.now()}`
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
