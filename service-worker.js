/**
 * Service Worker - Handles offline caching and background notifications
 */

const CACHE_NAME = 'habit-calendar-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/storage.js',
    '/notifications.js',
    '/tasks.js',
    '/calendar.js',
    '/gestures.js',
    '/manifest.json'
];

/**
 * Install event - cache files
 */
self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing...');

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker: Caching files');
                return cache.addAll(urlsToCache);
            })
            .then(() => {
                console.log('Service Worker: Installed');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('Service Worker: Installation failed', error);
            })
    );
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activating...');

    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME) {
                            console.log('Service Worker: Deleting old cache', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('Service Worker: Activated');
                return self.clients.claim();
            })
    );
});

/**
 * Fetch event - serve from cache, fallback to network
 */
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Cache hit - return response
                if (response) {
                    return response;
                }

                // Clone the request
                const fetchRequest = event.request.clone();

                return fetch(fetchRequest).then((response) => {
                    // Check if valid response
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }

                    // Clone the response
                    const responseToCache = response.clone();

                    caches.open(CACHE_NAME)
                        .then((cache) => {
                            cache.put(event.request, responseToCache);
                        });

                    return response;
                });
            })
            .catch((error) => {
                console.error('Service Worker: Fetch failed', error);
                // You could return a custom offline page here
            })
    );
});

/**
 * Notification click event
 */
self.addEventListener('notificationclick', (event) => {
    console.log('Notification clicked:', event.notification.tag);

    event.notification.close();

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // Check if app is already open
                for (const client of clientList) {
                    if (client.url === '/' && 'focus' in client) {
                        return client.focus();
                    }
                }

                // Open new window
                if (clients.openWindow) {
                    return clients.openWindow('/');
                }
            })
    );
});

/**
 * Push notification event (for future server-side notifications)
 */
self.addEventListener('push', (event) => {
    console.log('Push notification received');

    let data = {};
    if (event.data) {
        data = event.data.json();
    }

    const title = data.title || 'HABIT Calendar';
    const options = {
        body: data.body || 'You have a notification',
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">📅</text></svg>',
        badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">📅</text></svg>',
        vibrate: [200, 100, 200],
        data: data.data || {}
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

/**
 * Message event - for communication with main app
 */
self.addEventListener('message', (event) => {
    console.log('Service Worker: Message received', event.data);

    if (event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (event.data.type === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.delete(CACHE_NAME).then(() => {
                console.log('Service Worker: Cache cleared');
            })
        );
    }
});

console.log('Service Worker: Loaded');
