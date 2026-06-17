/**
 * Service Worker - Offline caching and background notifications
 *
 * Strategy:
 *  - App shell (html/css/js): stale-while-revalidate from CODE_CACHE.
 *  - manifest.json: network-first (so PWA metadata updates promptly), with cache fallback.
 *  - Everything else (same-origin GET): cache, then network fallback.
 */

const CACHE_VERSION = 'v2';
const CODE_CACHE = `habit-calendar-code-${CACHE_VERSION}`;
const RUNTIME_CACHE = `habit-calendar-runtime-${CACHE_VERSION}`;
const ALL_CACHES = [CODE_CACHE, RUNTIME_CACHE];

// App shell - every split file must be listed here.
const PRECACHE_URLS = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './storage.js',
    './notifications.js',
    './tasks.js',
    './calendar.js',
    './gestures.js',
    './validation.js',
    './manifest.json'
];

/**
 * Install - precache app shell
 */
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CODE_CACHE)
            .then((cache) => cache.addAll(PRECACHE_URLS))
            .then(() => self.skipWaiting())
            .catch((error) => {
                console.error('Service Worker: Installation failed', error);
            })
    );
});

/**
 * Activate - clean up old caches
 */
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => Promise.all(
                cacheNames.map((name) => {
                    if (!ALL_CACHES.includes(name)) {
                        return caches.delete(name);
                    }
                })
            ))
            .then(() => self.clients.claim())
    );
});

/**
 * Stale-while-revalidate: respond from cache immediately, refresh in background.
 */
function staleWhileRevalidate(request, cacheName) {
    return caches.open(cacheName).then((cache) =>
        cache.match(request).then((cached) => {
            const networkFetch = fetch(request)
                .then((response) => {
                    if (response && response.status === 200 && response.type === 'basic') {
                        cache.put(request, response.clone());
                    }
                    return response;
                })
                .catch(() => cached);
            return cached || networkFetch;
        })
    );
}

/**
 * Network-first: try network, fall back to cache (used for manifest.json).
 */
function networkFirst(request, cacheName) {
    return caches.open(cacheName).then((cache) =>
        fetch(request)
            .then((response) => {
                if (response && response.status === 200) {
                    cache.put(request, response.clone());
                }
                return response;
            })
            .catch(() => cache.match(request))
    );
}

/**
 * Fetch handler
 */
self.addEventListener('fetch', (event) => {
    const { request } = event;

    // Only handle same-origin GET requests.
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    const path = url.pathname;

    if (path.endsWith('/manifest.json')) {
        event.respondWith(networkFirst(request, CODE_CACHE));
        return;
    }

    const isShell = /\.(html|css|js)$/.test(path) || path === '/' || path.endsWith('/');
    if (isShell) {
        event.respondWith(staleWhileRevalidate(request, CODE_CACHE));
        return;
    }

    // Default: cache-first with network fallback into runtime cache.
    event.respondWith(
        caches.match(request).then((cached) =>
            cached || fetch(request).then((response) => {
                if (response && response.status === 200 && response.type === 'basic') {
                    const copy = response.clone();
                    caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
                }
                return response;
            }).catch(() => cached)
        )
    );
});

/**
 * Notification click event
 */
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                for (const client of clientList) {
                    if ('focus' in client) {
                        return client.focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow('./');
                }
            })
    );
});

/**
 * Push notification event (for future server-side notifications)
 */
self.addEventListener('push', (event) => {
    let data = {};
    if (event.data) {
        try { data = event.data.json(); } catch (e) { data = {}; }
    }

    const title = data.title || 'HABIT Calendar';
    const options = {
        body: data.body || 'You have a notification',
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">📅</text></svg>',
        badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">📅</text></svg>',
        vibrate: [200, 100, 200],
        data: data.data || {}
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

/**
 * Message event - communication with the main app
 */
self.addEventListener('message', (event) => {
    if (!event.data) return;

    if (event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (event.data.type === 'CLEAR_CACHE') {
        event.waitUntil(
            Promise.all(ALL_CACHES.map((name) => caches.delete(name)))
        );
    }
});
