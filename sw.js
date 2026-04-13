const APP_VERSION = "2026.04.12-1";
const CACHE_PREFIX = "mino-kumoyou-static-";
const CACHE_NAME = `${CACHE_PREFIX}${APP_VERSION}`;
const PRECACHE_PATHS = [
  "./",
  "./index.html",
  `./styles.css?v=${APP_VERSION}`,
  `./app.js?v=${APP_VERSION}`,
  `./manifest.webmanifest?v=${APP_VERSION}`,
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-32.png",
  "./icons/favicon-16.png"
];
const PRECACHE_URLS = PRECACHE_PATHS.map((path) => new URL(path, self.location).toString());
const OFFLINE_FALLBACKS = [
  new URL("./index.html", self.location).toString(),
  new URL("./", self.location).toString()
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  const forceReload = request.cache === "reload" || url.searchParams.get("reload") === "1";
  const isNavigation = request.mode === "navigate";
  const isStaticAsset =
    ["script", "style", "image", "font", "manifest"].includes(request.destination) ||
    url.pathname.endsWith(".webmanifest");

  if (isNavigation) {
    event.respondWith(networkFirst(request, true));
    return;
  }

  if (isStaticAsset) {
    event.respondWith(forceReload ? networkFirst(request, false) : cacheFirst(request));
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request, { ignoreVary: true });
  if (cached) {
    return cached;
  }

  const fresh = await fetch(request);
  await putInCache(request, fresh);
  return fresh;
}

async function networkFirst(request, fallbackToShell) {
  try {
    const fresh = await fetch(request);
    await putInCache(request, fresh);
    return fresh;
  } catch (error) {
    const cached = await caches.match(request, { ignoreVary: true });
    if (cached) {
      return cached;
    }

    if (fallbackToShell) {
      for (const fallback of OFFLINE_FALLBACKS) {
        const offline = await caches.match(fallback, { ignoreVary: true });
        if (offline) {
          return offline;
        }
      }
    }
    throw error;
  }
}

async function putInCache(request, response) {
  if (!response || !response.ok) {
    return;
  }

  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response.clone());
}
