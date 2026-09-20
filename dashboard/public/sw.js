/**
 * dashboard/public/sw.js
 * Service Worker PWA Caching untuk Naura Hoshino Web Dashboard.
 *
 * Mengimplementasikan Cache-First strategy untuk model 3D avatar (.glb, .vrm),
 * efek audio soundboard, dan webfonts agar pemuatan halaman instan (<1 detik).
 */

const CACHE_NAME = "naura-dashboard-v2.3.0";
const ASSETS_TO_PRECACHE = [
  "/",
  "/src/css/variables.css",
  "/src/css/components.css",
  "/src/css/layout.css",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_PRECACHE).catch(() => {}))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => {
            if (name !== CACHE_NAME) {
              return caches.delete(name);
            }
          }),
        );
      })
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Jangan cache request API, auth, atau socket realtime
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/") ||
    url.pathname.startsWith("/socket.io/")
  ) {
    return;
  }

  // Cache-First untuk Model 3D (.glb, .vrm), Audio (.mp3, .wav, .ogg), dan Webfonts
  const isHeavyAsset =
    url.pathname.endsWith(".glb") ||
    url.pathname.endsWith(".vrm") ||
    url.pathname.endsWith(".mp3") ||
    url.pathname.endsWith(".wav") ||
    url.pathname.endsWith(".ogg") ||
    url.pathname.includes("/webfonts/") ||
    url.pathname.includes("/models/");

  if (isHeavyAsset) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }

        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch (err) {
          return cachedResponse || Promise.reject(err);
        }
      }),
    );
    return;
  }

  // Stale-While-Revalidate untuk aset statis lainnya
  if (
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".webp")
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(request);
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      }),
    );
  }
});
