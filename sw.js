// YourLift Service Worker — v2
const CACHE = 'yourlift-v2';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/atleta.html',
  '/ranking.html',
  '/resultados.html',
  '/cronograma.html',
  '/inscripcion.html',
  '/documentos.html',
  '/bg-fechipo.css',
  '/favicon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/YourLift_logo.png',
];

// Install: cache app shell
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// Activate: delete old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Skip admin, livecast, videos-admin — always need live auth/data
  if (/\/(admin|livecast|videos-admin)/.test(url.pathname)) return;

  // Skip Firestore, Firebase Auth, Analytics APIs — never cache these
  if (
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('securetoken.googleapis.com') ||
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('www.googletagmanager.com') ||
    url.hostname.includes('google-analytics.com')
  ) return;

  // Firebase Storage public data — network-first, cache fallback for offline
  if (url.hostname.includes('firebasestorage.googleapis.com')) {
    e.respondWith(
      fetch(req)
        .then(res => {
          if (res.ok) { const clone = res.clone(); caches.open(CACHE).then(c => c.put(req, clone)); }
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Google Fonts — stale-while-revalidate (rarely changes, needed offline)
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    e.respondWith(
      caches.open(CACHE).then(async cache => {
        const cached = await cache.match(req);
        const network = fetch(req).then(res => { const clone = res.clone(); cache.put(req, clone); return res; }).catch(() => null);
        return cached || network;
      })
    );
    return;
  }

  // Firebase SDK scripts from gstatic — cache-first (versioned URLs, safe to cache forever)
  if (url.hostname.includes('gstatic.com') || url.hostname.includes('cdn.jsdelivr.net')) {
    e.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(res => {
        const clone = res.clone(); caches.open(CACHE).then(c => c.put(req, clone));
        return res;
      }))
    );
    return;
  }

  // HTML pages — network-first, cache fallback (stay up-to-date)
  if (url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname === '') {
    e.respondWith(
      fetch(req)
        .then(res => {
          if (res.ok) { const clone = res.clone(); caches.open(CACHE).then(c => c.put(req, clone)); }
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Static assets (CSS, images, fonts) — cache-first
  e.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (res.ok) { const clone = res.clone(); caches.open(CACHE).then(c => c.put(req, clone)); }
        return res;
      });
    })
  );
});
