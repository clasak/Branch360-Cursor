/**
 * Self-destructing service worker - clears all caches and unregisters
 */

console.log('[ServiceWorker] CACHE CLEARING VERSION - This will self-destruct');

self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installing cache-clearing version...');
  event.waitUntil(
    (async () => {
      // Delete all caches
      const cacheNames = await caches.keys();
      console.log('[ServiceWorker] Deleting caches:', cacheNames);
      await Promise.all(cacheNames.map(name => caches.delete(name)));

      // Skip waiting to activate immediately
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activating cache-clearing version...');
  event.waitUntil(
    (async () => {
      // Claim all clients
      await self.clients.claim();

      // Delete all caches again for good measure
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));

      // Notify all clients to reload
      const allClients = await self.clients.matchAll();
      allClients.forEach(client => {
        client.postMessage({
          type: 'CACHE_CLEARED',
          message: 'All caches cleared. Page will reload.'
        });
      });

      console.log('[ServiceWorker] All caches cleared. Unregistering...');

      // Unregister this service worker
      const registration = await self.registration;
      await registration.unregister();

      console.log('[ServiceWorker] Self-destructed successfully');
    })()
  );
});

// Network-only strategy - never cache anything
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
