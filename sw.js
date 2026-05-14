/**
 * Freeley Service Worker — PWA offline support
 * Caches core pages and assets for fast repeat visits.
 */

// v3: bypass media (mp4/webm/mov/m4v/m3u8/ts/ogg/wav/mp3) so the
// browser handles HTTP 206 range requests directly. The SW returning
// a cached 200 in response to a Range: request breaks <video>
// playback (especially Safari/iOS).
const CACHE_NAME = 'freeley-v3';
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

  // Let Firebase Auth iframes / .map source maps / media (range
  // requests) / range-requesting clients bypass the SW so the
  // browser gets a proper 206 Partial Content response.
  const url = new URL(event.request.url);
  const isMedia = /\.(mp4|webm|mov|m4v|m3u8|ts|ogg|ogv|wav|mp3|aac|flac)(\?|$)/i.test(url.pathname);
  if (
    url.pathname.endsWith('.map') ||
    url.pathname.startsWith('/__/auth/') ||
    url.pathname.startsWith('/assets/videos/') ||
    isMedia ||
    event.request.headers.has('range')
  ) {
    return;
  }

  event.respondWith((async () => {
    try {
      const response = await fetch(event.request);
      // Only cache full 200 responses. Skip 206 (partial), redirects,
      // errors, opaque, and non-basic responses to avoid corrupt cache.
      if (response && response.status === 200 && response.type === 'basic') {
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
