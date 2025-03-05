const CACHE_NAME = 'nyazek-store-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/styles/main.css',
  '/scripts/main.js',
  'https://firebasestorage.googleapis.com/v0/b/messageemeapp.appspot.com/o/PriceInHand-main%2F7da94f84-c767-466c-b0d3-b7bb852fd5e7.webp?alt=media&token=83c906f1-292a-4629-819b-3d137c911737'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});
