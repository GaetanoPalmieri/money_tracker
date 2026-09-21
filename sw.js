const CACHE_NAME = "bilancio-cache-v19";
const ASSETS = ["./", "./index.html", "./style.css?v=1.0.19", "./app.js?v=1.0.19", "./manifest.json", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png"];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS.map(url => new Request(url, {cache:"reload"})))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith("bilancio-cache-") && k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  const req = event.request;
  if(req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  // Refresh the interface online; keep the saved copy available offline.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const response = await fetch(req, {cache:"no-cache"});
      if(response.ok) {
        await cache.put(req, response.clone());
        return response;
      }
      return (await cache.match(req)) || response;
    } catch(error) {
      const cached = await cache.match(req);
      if(cached) return cached;
      if(req.mode === "navigate") {
        const home = await cache.match("./index.html");
        if(home) return home;
      }
      throw error;
    }
  })());
});
