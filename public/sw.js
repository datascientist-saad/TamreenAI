const CACHE = "tamreen-shell-v1";
const SHELL = ["/", "/offline", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  event.respondWith(
    fetch(request).catch(async () => {
      const cached = await caches.match(request);
      return cached || caches.match("/offline");
    }),
  );
});
