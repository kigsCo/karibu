/* Karibu service worker — offline shell caching. No dependencies, no build step.
 *
 * Served from the origin root, so its scope is "/" and it sees every navigation.
 *
 * Routing:
 *   navigations (HTML)            → network-first, falling back to the cached shell
 *   /assets/*  (content-hashed)   → cache-first (the URL changes when bytes change)
 *   other same-origin GETs        → stale-while-revalidate (manifest, icons)
 *   cross-origin (Supabase, fonts) → not intercepted
 *
 * Navigations are network-first so a redeploy can never strand a user on a stale
 * index.html pointing at hashed assets that no longer exist. Because freshness is
 * a property of the strategy rather than of the worker generation, a new worker
 * has nothing urgent to do — so we skip `skipWaiting()` and let it activate on
 * the next cold start. That avoids serving a new worker to a page loaded from the
 * old HTML, which would 404 once KaribuApp.jsx is split into lazy route chunks.
 */

const CACHE = "karibu-cache-v1";
const OFFLINE_URL = "/index.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: "reload" }))),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

// Lets the page force a waiting worker to activate, if we ever add an
// "update available → reload" prompt.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;
  if (request.headers.has("range")) return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(cacheFirst(request));
    return;
  }
  event.respondWith(staleWhileRevalidate(event));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    // A redirected response replayed into a future navigation throws, so skip it.
    if (response && response.ok && !response.redirected) {
      cache.put(OFFLINE_URL, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(OFFLINE_URL);
    return cached || Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return Response.error();
  }
}

function staleWhileRevalidate(event) {
  const { request } = event;
  const update = caches.open(CACHE).then(async (cache) => {
    try {
      const response = await fetch(request);
      if (response && response.ok) await cache.put(request, response.clone());
      return response;
    } catch {
      return undefined;
    }
  });
  // Called synchronously so the background refresh outlives the response.
  event.waitUntil(update);
  return caches
    .match(request)
    .then((cached) => cached || update.then((res) => res || Response.error()));
}
