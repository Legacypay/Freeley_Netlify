/**
 * Freeley Service Worker — PWA offline support
 * Caches core pages and assets for fast repeat visits.
 */

// Bumped to v2 to invalidate the old cache that returned undefined
// from the fetch handler and broke favicon + dynamic requests.
const CACHE_NAME = 'freeley-v2';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/quiz.html',
  '/weight-loss.html',
  '/hair-loss.html',
  '/sexual-wellness.html',
  '/longevity.html',
  '/shared.css',
  '/shared.js',
  '/social-proof.js',
  '/mobile-features.js',
  '/manifest.json',
  '/favicon.png',
  '/favicon.svg',
  '/assets/brand/freeley-icon-192.png',
  '/assets/brand/freeley-icon-512.png'
];

// Install — cache core assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(CORE_ASSETS).catch(err => {
        console.warn('SW: Some assets failed to cache:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate — clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — network first, falling back to cache. Must always resolve
// to a Response object or respondWith() throws TypeError.
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  // Let Firebase Auth iframes / .map source maps and other dynamic
  // bytes pass straight to the network without SW interference.
  const url = new URL(event.request.url);
  if (url.pathname.endsWith('.map') || url.pathname.startsWith('/__/auth/')) return;

  event.respondWith((async () => {
    try {
      const response = await fetch(event.request);
      if (response && response.ok) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone)).catch(() => {});
      }
      return response;
    } catch (e) {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      // Last resort — return a synthesised empty response so the
      // browser's fetch promise resolves cleanly instead of throwing.
      return new Response('', { status: 504, statusText: 'Offline' });
    }
  })());
});
