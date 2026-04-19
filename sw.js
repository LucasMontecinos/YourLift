// YourLift Service Worker — v1.0
const CACHE = 'yourlift-v1';
const STATIC = [
  '/',
  '/index.html',
  '/atleta.html',
  '/inscripcion.html',
  '/cronograma.html',
  '/ranking.html',
  '/data.json',
  '/records.json',
  '/nominas.json',
  '/YourLift_logo.png',
  'https://fonts.googleapis.com/css2?family=Oswald:wght@400;600;700&family=DM+Sans:wght@400;500;600&display=swap'
];

// Install: cache static assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(STATIC.map(u => new Request(u, {cache:'reload'}))))
    .catch(() => {}) // Don't fail install if some assets missing
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network-first for Firestore/Firebase, cache-first for static
self.addEventListener('fetch', e => {
  const url = e.request.url;
  
  // Always network for Firebase/API calls
  if (url.includes('firebase') || url.includes('firestore') || 
      url.includes('googleapis.com') || url.includes('gstatic.com') ||
      e.request.method !== 'GET') {
    return;
  }
  
  // Network-first for HTML pages (fresh content)
  if (url.endsWith('.html') || url.endsWith('/')) {
    e.respondWith(
      fetch(e.request)
        .then(r => { caches.open(CACHE).then(c => c.put(e.request, r.clone())); return r; })
        .catch(() => caches.match(e.request))
    );
    return;
  }
  
  // Cache-first for static assets (data.json, images, fonts)
  e.respondWith(
    caches.match(e.request)
      .then(cached => cached || fetch(e.request)
        .then(r => { caches.open(CACHE).then(c => c.put(e.request, r.clone())); return r; })
      )
  );
});
