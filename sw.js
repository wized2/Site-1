const CACHE_PRIMARY = 'pds-static-v1';
const CACHE_SECONDARY = 'pds-static-v2';
const CACHE_PAGES = 'pds-pages-v1';

const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/icons/icon-192x192.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png',
  '/icons/icon-180x180.png',
  '/icons/icon-192x192-maskable.png',
  '/icons/icon-512x512-maskable.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap'
];

self.addEventListener('install', event => {
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_PRIMARY).then(cache => cache.addAll(ASSETS)),
      caches.open(CACHE_SECONDARY).then(cache => cache.addAll(ASSETS)),
      caches.open(CACHE_PAGES).then(cache => cache.add('/'))
    ]).catch(err => console.warn('Pre-cache error (some assets may be offline):', err))
  );
});

self.addEventListener('activate', event => {
  const allowedCaches = [CACHE_PRIMARY, CACHE_SECONDARY, CACHE_PAGES];
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => !allowedCaches.includes(key)).map(key => caches.delete(key))
    ))
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  // For navigation requests: network first, fallback to cached index
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then(response => {
        const clone = response.clone();
        caches.open(CACHE_PAGES).then(cache => cache.put(request, clone));
        return response;
      }).catch(() => {
        return caches.match(request).then(cached => cached || caches.match('/'));
      })
    );
    return;
  }

  // For static assets: cache-first with redundant caches
  event.respondWith(
    caches.match(request, { cacheName: CACHE_PRIMARY }).then(primary => {
      if (primary) return primary;
      return caches.match(request, { cacheName: CACHE_SECONDARY }).then(secondary => {
        if (secondary) return secondary;
        return fetch(request).then(networkResponse => {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_PRIMARY).then(cache => cache.put(request, responseClone));
          caches.open(CACHE_SECONDARY).then(cache => cache.put(request, networkResponse.clone()));
          return networkResponse;
        }).catch(() => {
          // Ultimate fallback for images/fonts could be a placeholder, but not needed here
          return new Response('Offline: resource not available', { status: 503 });
        });
      });
    })
  );
});
