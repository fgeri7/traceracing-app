const CACHE_NAME = "trace-racing-v19";
const SHELL = [
  "./",
  "./index.html",
  "./style.css?v=19",
  "./game.js?v=19",
  "./manifest.json?v=19",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-512.png",
  "./icons/favicon.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  const isAppFile =
    url.pathname.endsWith("/index.html") ||
    url.pathname.endsWith("/game.js") ||
    url.pathname.endsWith("/style.css") ||
    url.pathname.endsWith("/manifest.json") ||
    url.pathname.endsWith("/sw.js");

  // App code: network first, so a newly published GitHub Pages version wins immediately.
  if (isAppFile) {
    event.respondWith(
      fetch(event.request, { cache: "no-store" })
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Images and other static assets: cache first, with network fallback.
  event.respondWith(
    caches.match(event.request)
      .then(cached => cached || fetch(event.request).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      }))
  );
});
