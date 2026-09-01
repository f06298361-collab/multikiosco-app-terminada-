const CACHE_NAME = "kiosco-pwa-v1";
const ASSETS_TO_CACHE = [
  "/",
  "/favicon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Ignorar peticiones API
  if (event.request.url.includes("/api/")) {
    return;
  }
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request).then((response) => {
        if (response) return response;
        if (event.request.mode === "navigate") {
          return caches.match("/");
        }
      });
    })
  );
});
