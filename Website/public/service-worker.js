
const CACHE_NAME = "wuerstelbaron-v1";

const FILES_TO_CACHE = [
    "/",
    "/css/style.css",
    "/js/script.js",
    "/manifest.json",
    "/bilder/wuerstelicon.jpg"
];

self.addEventListener("install", event => {
    event.waitUntil(
        caches
            .open(CACHE_NAME)
            .then(cache => {
                return cache.addAll(FILES_TO_CACHE);
            })
    );
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys
                    .filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            );
        })
    );
});

self.addEventListener("fetch", event => {
    event.respondWith(
        caches
            .match(event.request)
            .then(cacheResponse => {
                return cacheResponse || fetch(event.request);
            })
    );
});