/* ═══════════════════════════════════════════════════════
   SNIP — Service Worker
   Caches the static app shell so the UI loads instantly and
   works offline. The shorten API call itself always goes to
   the network — we never cache or fake that response.
   ═══════════════════════════════════════════════════════ */

// Bump this on every deploy that changes any cached file — stale caches
// from an old version must never be served after an update.
const CACHE_VERSION = 'snip-v1';

const SHELL_FILES = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_VERSION)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never intercept the shortening API — always live network, never cached,
  // never served stale from a previous version's cache bucket.
  if (url.hostname.endsWith('workers.dev')) return;

  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(res => {
        // Only cache same-origin, successful responses.
        if (res.ok && url.origin === self.location.origin) {
          const clone = res.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(event.request, clone));
        }
        return res;
      }).catch(() => {
        // Offline and not cached — for navigations, fall back to the shell.
        if (event.request.mode === 'navigate') return caches.match('./index.html');
      });
    })
  );
});
