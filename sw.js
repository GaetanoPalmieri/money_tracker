const CACHE_NAME = "bilancio-cache-v56";
const LEGACY_CACHE_NAME = "bilancio-cache-v52";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css?v=1.3.11",
  "./app.js?v=1.3.11",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png"
];

let legacyMigration = false;

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(ASSETS.map(url => new Request(url, {cache:"reload"})));

    // Bootstrap una tantum soltanto per installazioni precedenti al meccanismo di update.
    // Dalla v1.3.8 in poi il nuovo worker resta in attesa e viene attivato solo
    // dopo la conferma dell’utente tramite il prompt in-app.
    const keys = await caches.keys();
    legacyMigration = keys.includes(LEGACY_CACHE_NAME);
    if (legacyMigration) await self.skipWaiting();
  })());
});

self.addEventListener("message", event => {
  if(event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const migratedFromLegacy = keys.includes(LEGACY_CACHE_NAME);
    await Promise.all(
      keys
        .filter(k => k.startsWith("bilancio-cache-") && k !== CACHE_NAME)
        .map(k => caches.delete(k))
    );
    await self.clients.claim();

    // Solo per il passaggio dalla vecchia gestione update: ricarica una volta
    // le PWA già aperte, così da installare il codice client che mostra il prompt.
    if(migratedFromLegacy){
      const clients = await self.clients.matchAll({type:"window", includeUncontrolled:true});
      await Promise.all(clients.map(client => client.navigate(client.url).catch(()=>{})));
    }
  })());
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if(req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
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
