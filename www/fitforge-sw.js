// FitForge service worker — caches the app shell so the PWA loads offline,
// and serves a stale-while-revalidate strategy for same-origin GET requests.
// Cross-origin requests (backend API, Google Fonts, Gemini, etc.) are left
// untouched so apiCall() always hits the network directly.

const CACHE_NAME = 'fitforge-v1';
const APP_SHELL = [
  'fitforge_v3.html',
  'fitforge.webmanifest',
  'fitforge-icons/icon-192.png',
  'fitforge-icons/icon-512.png',
  'fitforge-icons/icon-512-maskable.png',
  'fitforge-icons/apple-touch-icon-180.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      const network = fetch(request)
        .then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
