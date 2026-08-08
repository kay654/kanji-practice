// Bump this name when the app shell changes so an installed PWA gets a
// deterministic cache refresh on its next online update check.
const CACHE_NAME = "kanji-practice-cache-v2";
const CACHE_PREFIX = "kanji-practice-cache-";
const LEGACY_CACHE_NAMES = ["kanji-practice-cache"];
const NETWORK_TIMEOUT_MS = 3000;
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./data/graded_idioms.js",
  "./manifest.webmanifest",
  "./icon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => (
          (key.startsWith(CACHE_PREFIX) || LEGACY_CACHE_NAMES.includes(key)) &&
          key !== CACHE_NAME
        ))
        .map((key) => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

function fetchWithTimeout(request) {
  if (typeof AbortController === "undefined") return fetch(request);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);
  return fetch(request, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

function updateCache(request, response) {
  if (!response.ok) return Promise.resolve();
  return caches.open(CACHE_NAME)
    .then((cache) => cache.put(request, response.clone()))
    .catch(() => {});
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (event.request.mode === "navigate") {
    event.respondWith(serveRequest(event, "./index.html"));
    return;
  }
  event.respondWith(serveRequest(event));
});

async function serveRequest(event, fallbackAsset) {
  const cached = await caches.match(event.request);
  try {
    const response = await fetchWithTimeout(event.request);
    if (response.ok) event.waitUntil(updateCache(event.request, response));
    return response.ok ? response : (cached || response);
  } catch {
    if (cached) return cached;
    if (fallbackAsset) return (await caches.match(fallbackAsset)) || Response.error();
    return Response.error();
  }
}
