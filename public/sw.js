// Quantzo HR Portal Service Worker
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Pass-through to network so NextAuth, Prisma endpoints, and live GPS remain real-time
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
