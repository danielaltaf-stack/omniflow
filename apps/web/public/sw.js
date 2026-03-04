/**
 * OmniFlow — Service Worker v1
 * 4 cache strategies: App Shell, API Data, Images, Navigation
 * + Background Sync Queue + Push Notification Handler
 */

const CACHE_VERSION = 'v1';
const SHELL_CACHE = `omniflow-shell-${CACHE_VERSION}`;
const API_CACHE = `omniflow-api-${CACHE_VERSION}`;
const IMAGE_CACHE = `omniflow-images-${CACHE_VERSION}`;
const ALL_CACHES = [SHELL_CACHE, API_CACHE, IMAGE_CACHE];

// Max entries/ages
const IMAGE_MAX_ENTRIES = 100;
const API_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h

// API routes to cache (stale-while-revalidate)
const API_CACHE_PATTERNS = [
  '/api/v1/dashboard',
  '/api/v1/networth',
  '/api/v1/cashflow',
  '/api/v1/budget',
  '/api/v1/notifications',
  '/api/v1/insights',
  '/api/v1/vault/summary',
  '/api/v1/retirement',
  '/api/v1/heritage',
  '/api/v1/market/live/snapshot',
];

// ── Install ────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => {
      return cache.addAll([
        '/offline.html',
        '/manifest.json',
        '/icons/icon-192.svg',
        '/icons/icon-512.svg',
      ]);
    })
  );
  // Activate immediately — don't wait for old tabs to close
  self.skipWaiting();
});

// ── Activate ───────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => !ALL_CACHES.includes(name))
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  // Take control of all clients immediately
  self.clients.claim();
});

// ── Fetch ──────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET for caching (POST/PUT/DELETE handled by background sync)
  if (request.method !== 'GET') return;

  // Skip WebSocket and SSE
  if (url.protocol === 'ws:' || url.protocol === 'wss:') return;
  if (request.headers.get('Accept')?.includes('text/event-stream')) return;

  // Strategy 1: Navigation → Network-first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  // Strategy 2: API Data → Stale-while-revalidate
  if (isApiDataRequest(url)) {
    event.respondWith(staleWhileRevalidate(request, API_CACHE));
    return;
  }

  // Strategy 3: Images → Cache-first with limit
  if (isImageRequest(url)) {
    event.respondWith(cacheFirstImage(request));
    return;
  }

  // Strategy 4: Static assets → Cache-first
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
    return;
  }
});

// ── Strategy: Network-first for navigation ─────────────────────────────
async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch (err) {
    const cache = await caches.open(SHELL_CACHE);
    const offlinePage = await cache.match('/offline.html');
    return offlinePage || new Response('Offline', { status: 503 });
  }
}

// ── Strategy: Stale-while-revalidate for API data ──────────────────────
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  // Fetch in background to update cache
  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        // Clone before caching (stream can only be consumed once)
        const clone = networkResponse.clone();
        cache.put(request, clone);
      }
      return networkResponse;
    })
    .catch(() => {
      // Network failed — cachedResponse is our only hope
      return cachedResponse;
    });

  // Return cached immediately if available, else wait for network
  return cachedResponse || fetchPromise;
}

// ── Strategy: Cache-first for static assets ────────────────────────────
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  if (cachedResponse) return cachedResponse;

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    return new Response('', { status: 408 });
  }
}

// ── Strategy: Cache-first for images (with FIFO eviction) ──────────────
async function cacheFirstImage(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const cachedResponse = await cache.match(request);
  if (cachedResponse) return cachedResponse;

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      // Evict oldest if over limit
      const keys = await cache.keys();
      if (keys.length >= IMAGE_MAX_ENTRIES) {
        await cache.delete(keys[0]);
      }
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    return new Response('', { status: 408 });
  }
}

// ── URL matchers ───────────────────────────────────────────────────────
function isApiDataRequest(url) {
  return API_CACHE_PATTERNS.some((pattern) => url.pathname.startsWith(pattern));
}

function isImageRequest(url) {
  return /\.(png|jpg|jpeg|gif|svg|webp|ico)(\?.*)?$/i.test(url.pathname);
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/fonts/') ||
    url.pathname === '/manifest.json' ||
    url.pathname.startsWith('/icons/')
  );
}

// ── Background Sync ────────────────────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'omniflow-sync') {
    event.waitUntil(replayOfflineQueue());
  }
});

async function replayOfflineQueue() {
  try {
    const db = await openSyncDB();
    const tx = db.transaction('queue', 'readwrite');
    const store = tx.objectStore('queue');
    const allRequests = await idbGetAll(store);

    let successCount = 0;
    for (const item of allRequests) {
      try {
        await fetch(item.url, {
          method: item.method,
          headers: item.headers,
          body: item.body,
        });
        store.delete(item.id);
        successCount++;
      } catch {
        // Still offline — leave in queue for next sync
        break;
      }
    }

    if (successCount > 0) {
      // Notify all clients
      const clients = await self.clients.matchAll();
      clients.forEach((client) => {
        client.postMessage({
          type: 'SYNC_COMPLETE',
          count: successCount,
        });
      });
    }
  } catch (err) {
    console.error('[SW] Background sync failed:', err);
  }
}

function openSyncDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('omniflow-sync-queue', 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('queue')) {
        db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function idbGetAll(store) {
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ── Push Notifications ─────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = {
      title: 'OmniFlow',
      body: event.data.text(),
      url: '/dashboard',
    };
  }

  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icons/icon-192.svg',
    badge: '/icons/badge-72.svg',
    tag: payload.tag || 'omniflow-default',
    renotify: true,
    data: {
      url: payload.url || '/dashboard',
    },
    actions: [
      { action: 'open', title: 'Voir' },
      { action: 'close', title: 'Fermer' },
    ],
    vibrate: [100, 50, 100],
    timestamp: Date.now(),
  };

  event.waitUntil(
    self.registration.showNotification(payload.title || 'OmniFlow', options)
  );
});

// ── Notification Click ─────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') return;

  const targetUrl = event.notification.data?.url || '/dashboard';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if available
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(targetUrl);
          return;
        }
      }
      // Open new window
      return self.clients.openWindow(targetUrl);
    })
  );
});

// ── Message handler (from main thread) ─────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'QUEUE_REQUEST') {
    // Queue offline request for background sync
    queueOfflineRequest(event.data.payload);
  }
});

async function queueOfflineRequest(payload) {
  try {
    const db = await openSyncDB();
    const tx = db.transaction('queue', 'readwrite');
    tx.objectStore('queue').add({
      url: payload.url,
      method: payload.method,
      headers: payload.headers,
      body: payload.body,
      timestamp: Date.now(),
    });
    // Register sync
    if ('sync' in self.registration) {
      await self.registration.sync.register('omniflow-sync');
    }
  } catch (err) {
    console.error('[SW] Failed to queue request:', err);
  }
}

console.log('[SW] OmniFlow Service Worker loaded — version', CACHE_VERSION);
