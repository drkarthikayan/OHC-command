// OHC Command Service Worker
const CACHE = 'ohc-v1';
const STATIC = ['/','index.html'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Network first for Firestore/API calls
  if (e.request.url.includes('firestore.googleapis.com') ||
      e.request.url.includes('firebase') ||
      e.request.method !== 'GET') return;

  // Cache first for static assets
  if (e.request.destination === 'script' ||
      e.request.destination === 'style' ||
      e.request.destination === 'font' ||
      e.request.destination === 'image') {
    e.respondWith(
      caches.match(e.request).then(cached => cached ||
        fetch(e.request).then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return res;
        })
      )
    );
    return;
  }

  // Network first with offline fallback for navigation
  e.respondWith(
    fetch(e.request).catch(() => caches.match('/') || caches.match('index.html'))
  );
});
