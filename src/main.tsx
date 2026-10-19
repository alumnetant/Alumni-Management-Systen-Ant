import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import {installFetchInterceptor} from './services/apiClient';

// Bundled Plus Jakarta Sans font assets (offline parity for Android APK & web)
import '@fontsource/plus-jakarta-sans/300.css';
import '@fontsource/plus-jakarta-sans/400.css';
import '@fontsource/plus-jakarta-sans/500.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/700.css';
import '@fontsource/plus-jakarta-sans/800.css';

import './lib/theme';
import App from './App.tsx';
import './index.css';

// Install centralized API fetch interceptor for X-Client-Platform and Bearer token injection
installFetchInterceptor();

// In production, register Service Worker for offline PWA caching.
// In development, unregister any stale service workers that might cache mismatched Vite module chunks.
if (import.meta.env.PROD) {
  registerSW({
    immediate: true,
    onNeedRefresh() {
      console.info('PWA: New content available, updating service worker cache.');
    },
    onOfflineReady() {
      console.info('PWA: Application offline cache ready for mobile network resilience.');
    },
  });
} else if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister().catch(() => {});
    }
  }).catch(() => {});
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
