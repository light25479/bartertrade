// A very small service worker. It makes the site installable and shows a friendly page when
// the phone is offline. It never stores listings, messages or logins.
const CACHE = 'bartertrade-offline-v1';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([OFFLINE_URL, '/logo-mark.png'])));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return; // only page loads, never data requests
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_URL)));
});