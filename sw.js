const CACHE_NAME = "trace-racing-v1";

const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./game.js",
  "./manifest.json",
  "./icons/icon-48.png",
  "./icons/icon-72.png",
  "./icons/icon-96.png",
  "./icons/icon-144.png",
  "./icons/icon-192.png",
  "./icons/icon-256.png",
  "./icons/icon-512.png",
  "./icons/maskable-512.png",
  "./icons/favicon.png",
  "./icons/apple-touch-icon.png",
  "./brand/logo-master.svg",
  "./brand/logo-compact.svg",
  "./brand/logo-light.svg",
  "./brand/icon-mark.svg"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
