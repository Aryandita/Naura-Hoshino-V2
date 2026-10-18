/**
 * dashboard/public/sw.js
 * Progressive Web App (PWA) Service Worker untuk Naura Hoshino Dashboard.
 *
 * Fitur:
 *   1. Pre-caching aset penting & Offline Fallback untuk navigasi.
 *   2. Cache-First untuk aset 3D (.glb, .vrm), efek suara, dan Webfonts.
 *   3. Stale-While-Revalidate untuk script JS, stylesheet CSS, dan ikon gambar.
 *   4. Push Notification Event Listener & Notification Click Handler.
 */

"use strict";

const CACHE_NAME = "naura-pwa-v2.3.0";
const OFFLINE_FALLBACK_PAGE = `<!doctype html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Naura OS, Mode Offline</title>
  <style>
    body {
      margin: 0;
      min-height: 100dvh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #0b0c10;
      color: #f3f4f6;
      font-family: system-ui, -apple-system, sans-serif;
      text-align: center;
      padding: 24px;
      box-sizing: border-box;
    }
    .card {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 182, 193, 0.2);
      border-radius: 16px;
      padding: 32px 24px;
      max-width: 420px;
      backdrop-filter: blur(12px);
    }
    h1 {
      color: #ffb6c1;
      font-size: 1.5rem;
      margin-bottom: 8px;
    }
    p {
      color: #9ca3af;
      font-size: 0.95rem;
      line-height: 1.5;
      margin-bottom: 20px;
    }
    button {
      background: #ffb6c1;
      color: #0b0c10;
      border: none;
      border-radius: 8px;
      padding: 10px 20px;
      font-weight: 600;
      cursor: pointer;
      font-size: 0.9rem;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>Koneksi Terputus</h1>
    <p>Aplikasi sedang berada dalam mode offline. Silakan periksa kembali jaringan internet Anda.</p>
    <button onclick="window.location.reload()">Coba Muat Ulang</button>
  </div>
</body>
</html>`;

const ASSETS_TO_PRECACHE = [
  "/",
  "/manifest.json",
  "/naura_3d_closeup.png",
  "/vendor/tailwind-built.css",
  "/vendor/fontawesome.min.css",
];

// 1. Install & Precache
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(ASSETS_TO_PRECACHE).catch(() => {});
      })
      .then(() => self.skipWaiting()),
  );
});

// 2. Activate & Cache Cleanup
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

// 3. Fetch Strategy & Offline Fallback
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Bypass API, OAuth, dan Socket.io
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/") ||
    url.pathname.startsWith("/socket.io/")
  ) {
    return;
  }

  // A. Permintaan Navigasi HTML (Halaman Browser)
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) return cachedResponse;
          return new Response(OFFLINE_FALLBACK_PAGE, {
            headers: { "Content-Type": "text/html; charset=utf-8" },
          });
        }),
    );
    return;
  }

  // B. Cache-First untuk Model 3D (.glb, .vrm), Audio (.mp3, .wav), dan Webfonts
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
        if (cachedResponse) return cachedResponse;

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

  // C. Stale-While-Revalidate untuk Aset Statis Lainnya (.css, .js, .png, .svg, .webp)
  if (
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".webp") ||
    url.pathname.endsWith(".json")
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

// 4. Push Event Listener (Web Push Notification)
self.addEventListener("push", (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (_) {
      data = { title: "Naura Hoshino", body: event.data.text() };
    }
  }

  const title = data.title || "Notifikasi Naura Hoshino";
  const options = {
    body: data.body || "Ada pembaruan status baru di server Discord Anda!",
    icon: data.icon || "/naura_3d_closeup.png",
    badge: data.badge || "/naura_3d_closeup.png",
    tag: data.tag || "naura-notification",
    data: {
      url: data.url || "/",
      timestamp: Date.now(),
      guildId: data.guildId || null,
    },
    vibrate: [100, 50, 100],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// 5. Notification Click Handler
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url && "focus" in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      }),
  );
});
