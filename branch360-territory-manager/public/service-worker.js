/**
 * Branch360 - Service Worker for PWA
 * Enables offline functionality and app-like experience
 */

const CACHE_NAME = 'branch360-v1';
const OFFLINE_URL = '/offline.html';

// Assets to cache on install
const urlsToCache = [
  '/',
  '/dashboard.html',
  '/ae-dashboard.html',
  '/tech-dashboard.html',
  '/ops-manager-dashboard.html',
  '/admin-dashboard.html',
  '/offline.html',
  '/src/offline-queue.html'
];

// Install event - cache assets
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Install');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[ServiceWorker] Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.error('[ServiceWorker] Cache install failed:', error);
      })
  );

  // Activate immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activate');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[ServiceWorker] Removing old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );

  // Take control immediately
  return self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http(s) requests
  if (!event.request.url.startsWith('http')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        // Clone the request
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest)
          .then((response) => {
            // Check if valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response
            const responseToCache = response.clone();

            // Cache the fetched response
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch((error) => {
            console.error('[ServiceWorker] Fetch failed:', error);

            // Return offline page for navigation requests
            if (event.request.mode === 'navigate') {
              return caches.match(OFFLINE_URL);
            }

            return new Response('Network error occurred', {
              status: 408,
              headers: { 'Content-Type': 'text/plain' }
            });
          });
      })
  );
});

// Background sync event - sync offline queue when online
self.addEventListener('sync', (event) => {
  console.log('[ServiceWorker] Background sync:', event.tag);

  if (event.tag === 'sync-offline-queue') {
    event.waitUntil(syncOfflineQueue());
  }
});

/**
 * Sync offline queue items
 */
async function syncOfflineQueue() {
  try {
    // Get queue from IndexedDB or localStorage
    const queue = await getOfflineQueue();

    if (!queue || queue.length === 0) {
      console.log('[ServiceWorker] No items to sync');
      return;
    }

    console.log('[ServiceWorker] Syncing', queue.length, 'items');

    // Process each queued item
    for (const item of queue) {
      try {
        await syncQueueItem(item);
        await removeFromQueue(item.id);
        console.log('[ServiceWorker] Synced item:', item.id);
      } catch (error) {
        console.error('[ServiceWorker] Failed to sync item:', item.id, error);
      }
    }

    console.log('[ServiceWorker] Sync complete');
  } catch (error) {
    console.error('[ServiceWorker] Sync failed:', error);
  }
}

/**
 * Get offline queue from storage
 */
async function getOfflineQueue() {
  // Implementation would use IndexedDB or message main thread
  return [];
}

/**
 * Sync a single queue item
 */
async function syncQueueItem(item) {
  // Implementation would POST to server
  throw new Error('Not implemented - handled by main thread');
}

/**
 * Remove item from queue
 */
async function removeFromQueue(itemId) {
  // Implementation would use IndexedDB or message main thread
}

// Push notification event
self.addEventListener('push', (event) => {
  console.log('[ServiceWorker] Push notification received');

  const options = {
    body: event.data ? event.data.text() : 'New notification from Branch360',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    vibrate: [200, 100, 200],
    tag: 'branch360-notification',
    requireInteraction: false
  };

  event.waitUntil(
    self.registration.showNotification('Branch360 CRM', options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('[ServiceWorker] Notification click');

  event.notification.close();

  event.waitUntil(
    clients.openWindow('/')
  );
});
