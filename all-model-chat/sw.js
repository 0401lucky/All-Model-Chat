const CACHE_NAME = 'all-model-chat-cache-v2';
const API_HOSTS = ['generativelanguage.googleapis.com', 'api-proxy.me'];
const GOOGLE_API_HOSTNAME = 'generativelanguage.googleapis.com';
let proxyUrl = null;

// The app shell includes all the static assets needed to run the app offline.
const APP_SHELL_URLS = [
    '/',
    '/index.html',
    '/index.tsx', // This will be fetched and cached on install
    '/favicon.png',
    '/manifest.json',
    'https://cdn.tailwindcss.com',
    'https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.5.1/github-markdown-dark.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/a11y-dark.min.css',
    'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css',
];

// Listen for messages from the client to set the proxy URL.
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SET_PROXY_URL') {
        proxyUrl = event.data.url;
    }
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// Install: Cache the app shell.
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Caching App Shell v2');
                const promises = APP_SHELL_URLS.map(url => {
                    return cache.add(url).catch(reason => {
                        console.warn(`[Service Worker] Failed to cache ${url}: ${reason}`);
                    });
                });
                return Promise.all(promises);
            })
            .then(() => self.skipWaiting()) // Force the waiting service worker to become the active one.
    );
});

// Activate: Clean up old caches.
self.addEventListener('activate', (event) => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (!cacheWhitelist.includes(cacheName)) {
                        console.log(`[Service Worker] Deleting old cache: ${cacheName}`);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim()) // Take control of all open clients.
    );
});

// Fetch: Intercept network requests.
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const requestUrl = new URL(request.url);

    // If it's an API call to Google and a proxy is set, reroute it.
    if (requestUrl.hostname === GOOGLE_API_HOSTNAME && proxyUrl) {
        const originalUrlString = request.url;
        // This handles both v1 and v1beta as long as the proxy url is configured correctly.
        const newUrlString = originalUrlString
            .replace('https://generativelanguage.googleapis.com/v1beta', proxyUrl)
            .replace('https://generativelanguage.googleapis.com/v1', proxyUrl);
        
        // Only proceed if a replacement was actually made
        if (newUrlString !== originalUrlString) {
            const newRequest = new Request(newUrlString, request);
            event.respondWith(fetch(newRequest));
            return;
        }
    }

    // For other API calls, always go to the network and do not cache.
    if (API_HOSTS.some(host => request.url.includes(host))) {
        event.respondWith(fetch(request));
        return;
    }

    // For other GET requests, use a "Stale-While-Revalidate" strategy.
    if (request.method === 'GET') {
        event.respondWith(
            caches.open(CACHE_NAME).then((cache) => {
                return cache.match(request).then((cachedResponse) => {
                    // Fetch from network in the background to update the cache.
                    const fetchPromise = fetch(request).then((networkResponse) => {
                        // If we get a valid response, update the cache.
                        if (networkResponse && networkResponse.status === 200) {
                            cache.put(request, networkResponse.clone());
                        }
                        return networkResponse;
                    }).catch(error => {
                        console.warn(`[Service Worker] Network request for ${request.url} failed:`, error);
                        // If it's a navigation request and we're offline, serve the main app page as a fallback.
                        if (request.mode === 'navigate' && !cachedResponse) {
                            console.log('[Service Worker] Serving app shell for navigation fallback.');
                            return caches.match('/index.html');
                        }
                        // For other failed requests, if there was no cache, it will result in an error, which is intended.
                    });

                    // Return the cached response immediately if it's available,
                    // otherwise wait for the network response.
                    return cachedResponse || fetchPromise;
                });
            })
        );
    }
});