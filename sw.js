/**
 * Freeley Service Worker — PWA offline support
 * Caches core pages and assets for fast repeat visits.
 */

const CACHE_NAME = 'freeley-v1';
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

// Fetch — network first, falling back to cache
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip external requests
  if (!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Clone and cache successful responses
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Offline — serve from cache
        return caches.match(event.request);
      })
  );
});
