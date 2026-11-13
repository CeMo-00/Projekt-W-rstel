
const CACHE_NAME = "wuerstelbaron-v3";

const DATEIEN = [
    "/",
    "/manifest.json",
    "/css/style.css?v=20261113-1",
    "/js/script.js?v=20261113-1",
    "/bilder/logo.png",
    "/bilder/wuerstelicon.png"
];

self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(DATEIEN);
        })
    );

    self.skipWaiting();
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.map(key => {
                    if (key !== CACHE_NAME && key.startsWith("wuerstelbaron-")) {
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", event => {
    const url = new URL(event.request.url);

    if (
        event.request.method !== "GET" ||
        url.origin !== self.location.origin
    ) {
        return;
    }

    if (event.request.mode === "navigate") {
        event.respondWith(
            fetch(event.request).then(response => {
                if (url.pathname === "/" && response.ok) {
                    const kopie = response.clone();

                    caches.open(CACHE_NAME).then(cache => {
                        cache.put("/", kopie);
                    });
                }

                return response;
            }).catch(() => {
                return caches.match("/");
            })
        );

        return;
    }

    if (
        url.pathname.endsWith(".css") ||
        url.pathname.endsWith(".js") ||
        url.pathname.endsWith(".png") ||
        url.pathname.endsWith(".jpg") ||
        url.pathname.endsWith(".jpeg") ||
        url.pathname.endsWith(".webp") ||
        url.pathname.endsWith("manifest.json")
    ) {
        event.respondWith(
            caches.match(event.request).then(datei => {
                if (datei) {
                    return datei;
                }

                return fetch(event.request).then(response => {
                    if (response.ok) {
                        const kopie = response.clone();

                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, kopie);
                        });
                    }

                    return response;
                });
            })
        );
    }
});
