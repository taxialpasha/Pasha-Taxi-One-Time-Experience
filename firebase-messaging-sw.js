// Import Firebase scripts
importScripts('https://www.gstatic.com/firebasejs/8.10.0/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.0/firebase-messaging.js');

// Firebase configuration
firebase.initializeApp({
    apiKey: "AIzaSyDGpAHia_wEmrhnmYjrPf1n1TrAzwEMiAI",
    authDomain: "messageemeapp.firebaseapp.com",
    projectId: "messageemeapp",
    storageBucket: "messageemeapp.appspot.com",
    messagingSenderId: "255034474844",
    appId: "1:255034474844:web:5e3b7a6bc4b2fb94cc4199"
});

const messaging = firebase.messaging();

// Enhanced notification handling
messaging.onBackgroundMessage((payload) => {
    console.log('Received background message:', payload);

    // Create notification options with enhanced features
    const notificationOptions = {
        body: payload.notification.body,
        icon: payload.notification.icon || '/pngwing.com.png',
        badge: '/pngwing.com.png',
        tag: payload.data?.notificationId || 'default',
        data: payload.data,
        requireInteraction: true, // Keep notification until user interacts
        actions: [
            {
                action: 'view',
                title: 'عرض'
            },
            {
                action: 'close',
                title: 'إغلاق'
            }
        ],
        vibrate: [200, 100, 200], // Vibration pattern
        silent: false // Allow sound
    };

    return self.registration.showNotification(
        payload.notification.title,
        notificationOptions
    );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    console.log('Notification clicked:', event);
    event.notification.close();

    // Handle action buttons
    if (event.action === 'view') {
        // Open or focus app window
        const urlToOpen = new URL('/', self.location.origin).href;

        event.waitUntil(
            clients.matchAll({
                type: 'window',
                includeUncontrolled: true
            })
            .then((windowClients) => {
                // Focus existing window if open
                for (let client of windowClients) {
                    if (client.url === urlToOpen && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Open new window if closed
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
        );
    }
});

// Cache configuration with versioning
const CACHE_VERSION = 'v1.0.1';
const CACHE_NAME = `taxi-app-cache-${CACHE_VERSION}`;

// Assets to cache
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/style.css',
    '/app.js',
    '/offline.html',
    '/pngwing.com.png',
    '/default-image.png'
];

const EXTERNAL_ASSETS = [
    'https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.2/css/bootstrap.rtl.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css',
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js'
];

// Enhanced install event handler with better error handling
self.addEventListener('install', (event) => {
    event.waitUntil(
        (async () => {
            try {
                const cache = await caches.open(CACHE_NAME);
                
                // Cache static assets with progress tracking
                console.log('Caching static assets...');
                let completed = 0;
                const total = STATIC_ASSETS.length;

                await Promise.all(
                    STATIC_ASSETS.map(async (url) => {
                        try {
                            await cache.add(url);
                            completed++;
                            console.log(`Cached ${completed}/${total}: ${url}`);
                        } catch (error) {
                            console.warn(`Failed to cache: ${url}`, error);
                        }
                    })
                );

                // Cache external assets with no-cors mode
                console.log('Caching external assets...');
                await Promise.all(
                    EXTERNAL_ASSETS.map(async (url) => {
                        try {
                            const response = await fetch(url, { 
                                mode: 'no-cors',
                                credentials: 'omit',
                                cache: 'no-cache'
                            });
                            await cache.put(url, response);
                            console.log(`Successfully cached external asset: ${url}`);
                        } catch (error) {
                            console.warn(`Failed to cache external asset: ${url}`, error);
                        }
                    })
                );

                console.log('Cache installation complete');
            } catch (error) {
                console.error('Cache installation failed:', error);
            }
        })()
    );
    self.skipWaiting();
});

// Enhanced activate event handler with proper cache cleanup
self.addEventListener('activate', (event) => {
    event.waitUntil(
        (async () => {
            try {
                // Clean up old caches
                const cacheKeys = await caches.keys();
                const outdatedCaches = cacheKeys.filter(key => 
                    key.startsWith('taxi-app-cache-') && key !== CACHE_NAME
                );

                await Promise.all(
                    outdatedCaches.map(key => {
                        console.log(`Deleting outdated cache: ${key}`);
                        return caches.delete(key);
                    })
                );

                // Take control of all clients
                await clients.claim();
                console.log('Service Worker activated and controlling all clients');
            } catch (error) {
                console.error('Activation error:', error);
            }
        })()
    );
});

// Enhanced fetch event handler with improved offline support
self.addEventListener('fetch', (event) => {
    event.respondWith(
        (async () => {
            try {
                // Try cache first
                const cachedResponse = await caches.match(event.request);
                if (cachedResponse) {
                    return cachedResponse;
                }

                // If not in cache, try network
                try {
                    const networkResponse = await fetch(event.request);
                    
                    // Cache successful same-origin responses
                    if (networkResponse.ok && event.request.url.startsWith(self.location.origin)) {
                        const cache = await caches.open(CACHE_NAME);
                        cache.put(event.request, networkResponse.clone());
                    }
                    
                    return networkResponse;
                } catch (fetchError) {
                    // Handle offline scenarios
                    console.log('Fetch failed, serving offline content:', fetchError);
                    
                    if (event.request.destination === 'image') {
                        return caches.match('/default-image.png');
                    }
                    
                    if (event.request.mode === 'navigate') {
                        return caches.match('/offline.html');
                    }
                    
                    throw fetchError;
                }
            } catch (error) {
                console.error('Fetch handler error:', error);
                throw error;
            }
        })()
    );
});

// Enhanced FCM token handling
messaging.getToken({ 
    vapidKey: 'BI9cpoewcZa1ftyZ_bGjO0GYa4_cT0HNja4YFd6FwLwHg5c0gQ5iSj_MJZRhMxKdgJ0-d-_rEXcpSQ_cx7GqCSc' 
}).then((token) => {
    if (token) {
        console.log('FCM Token obtained:', token);
        // Store token in IndexedDB for persistence
        return saveTokenToIndexedDB(token);
    } else {
        console.warn('No FCM token available');
    }
}).catch((err) => {
    console.error('Failed to get FCM token:', err);
});

// Helper function to store token in IndexedDB
async function saveTokenToIndexedDB(token) {
    try {
        const db = await openDB('fcm-store', 1, {
            upgrade(db) {
                db.createObjectStore('tokens');
            }
        });
        await db.put('tokens', token, 'current');
        console.log('Token saved to IndexedDB');
    } catch (error) {
        console.error('Error saving token to IndexedDB:', error);
    }
}