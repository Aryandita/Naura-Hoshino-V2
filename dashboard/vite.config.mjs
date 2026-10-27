import { defineConfig } from "vite";
import fs from "node:fs";
import path, { resolve } from "node:path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// Target backend Express saat dev. Selaras dengan env.DASHBOARD_PORT
// (default 3070) yang dibaca dashboard/server.js.
const apiTarget = process.env.VITE_API_TARGET || "http://localhost:3070";

export default defineConfig({
  root: ".",
  publicDir: "public",

  // Dilayani Express di root path / (Dashboard Utama Naura V2).
  // Menggunakan base absolut '/' agar seluruh asset di dist (bundle JS, CSS, dll.)
  // ditautkan secara konsisten ke root /assets/... dan /vendor/...
  base: "/",

  // Catatan: Tailwind diproses lewat CLI terpisah (npm run build:css),
  // bukan plugin @tailwindcss/vite, karena plugin itu bertabrakan dengan
  // <style> inline di halaman-halaman MPA ini saat build.

  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      // Multi-page: satu entry per halaman
      // VITE_ONLY=<nama> untuk debug build satu halaman
      input: process.env.VITE_ONLY
        ? {
            [process.env.VITE_ONLY]: resolve(
              __dirname,
              `src/pages/${process.env.VITE_ONLY}.html`,
            ),
          }
        : {
            index: resolve(__dirname, "src/pages/index.html"),
            status: resolve(__dirname, "src/pages/status.html"),
            music: resolve(__dirname, "src/pages/music.html"),
            leaderboard: resolve(__dirname, "src/pages/leaderboard.html"),
            economy: resolve(__dirname, "src/pages/economy.html"),
            feed: resolve(__dirname, "src/pages/feed.html"),
            automations: resolve(__dirname, "src/pages/automations.html"),
            karaoke: resolve(__dirname, "src/pages/karaoke.html"),
            settings: resolve(__dirname, "src/pages/settings.html"),
            tickets: resolve(__dirname, "src/pages/tickets.html"),
            welcomer: resolve(__dirname, "src/pages/welcomer.html"),
            world: resolve(__dirname, "src/pages/world.html"),
            adishaMap: resolve(__dirname, "src/pages/adisha-map.html"),
            activity: resolve(__dirname, "src/pages/activity.html"),
            portfolio: resolve(__dirname, "src/pages/portfolio.html"),
            topology: resolve(__dirname, "src/pages/topology.html"),
            builder: resolve(__dirname, "src/pages/builder.html"),
            survivalMap: resolve(__dirname, "src/pages/survival-map.html"),
            soundboard: resolve(__dirname, "src/pages/soundboard.html"),
            jam: resolve(__dirname, "src/pages/jam.html"),
            lounge: resolve(__dirname, "src/pages/lounge.html"),
            warRoom: resolve(__dirname, "src/pages/war-room.html"),
            login: resolve(__dirname, "src/pages/login.html"),
            profile: resolve(__dirname, "src/pages/profile.html"),
            achievements: resolve(__dirname, "src/pages/achievements.html"),
            automod: resolve(__dirname, "src/pages/automod.html"),
            clan: resolve(__dirname, "src/pages/clan.html"),
            arcade: resolve(__dirname, "src/pages/arcade.html"),
            marketplace: resolve(__dirname, "src/pages/marketplace.html"),
            inventory: resolve(__dirname, "src/pages/inventory.html"),
            admin: resolve(__dirname, "src/pages/admin.html"),
            treasury: resolve(__dirname, "src/pages/treasury.html"),
            player: resolve(__dirname, "src/pages/player.html"),
          },
    },
    // Chunk terpisah agar model Three.js tidak disertakan di halaman yang tidak perlu
    chunkSizeWarningLimit: 2000,
  },

  server: {
    port: 3001,
    host: "0.0.0.0",
    // Proxy ke server Express utama hanya untuk endpoint API & Socket.IO.
    // DILARANG proxy /assets agar bundler internal Vite (JS, CSS, chunk)
    // dan asset statis di public/assets tidak terblokir dengan ECONNREFUSED.
    proxy: {
      "/api": {
        target: apiTarget,
        changeOrigin: true,
        // Timeout 2 menit untuk operasi berat (leaderboard, analytics, export)
        proxyTimeout: 120000,
        timeout: 120000,
      },
      "/auth": {
        target: apiTarget,
        changeOrigin: true,
        proxyTimeout: 30000,
        timeout: 30000,
      },
      "/socket.io": {
        target: apiTarget,
        ws: true,
        // WebSocket tidak perlu proxyTimeout, tapi timeout koneksi awal
        timeout: 30000,
      },
    },
  },

  preview: {
    port: 4173,
    host: "0.0.0.0",
  },

  plugins: [
    {
      name: "mpa-clean-urls",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (
            req.method === "GET" &&
            req.url &&
            !req.url.includes(".") &&
            !req.url.startsWith("/api") &&
            !req.url.startsWith("/auth") &&
            !req.url.startsWith("/socket.io")
          ) {
            const cleanPath = req.url.split("?")[0].replace(/^\//, "");
            if (cleanPath) {
              const htmlFile = resolve(__dirname, `src/pages/${cleanPath}.html`);
              if (fs.existsSync(htmlFile)) {
                req.url =
                  `/src/pages/${cleanPath}.html` +
                  (req.url.includes("?") ? "?" + req.url.split("?")[1] : "");
              }
            }
          }
          next();
        });
      },
    },
    {
      name: "copy-dist-index",
      closeBundle() {
        // Otomatis salin dist/src/pages/index.html ke dist/index.html
        // agar root URL '/' langsung menyajikan Dashboard Utama
        try {
          const distDir = resolve(__dirname, "dist");
          const srcIndex = path.join(distDir, "src", "pages", "index.html");
          const destIndex = path.join(distDir, "index.html");
          if (fs.existsSync(srcIndex)) {
            fs.copyFileSync(srcIndex, destIndex);
            console.log("[Vite] dist/index.html tersinkronisasi dari src/pages/index.html");
          }
        } catch {
          // Abaikan kesalahan bila folder dist belum tersedia saat build parsial
        }
      },
    },
  ],

  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      "@models": resolve(__dirname, "public/models"),
    },
  },

  // Pastikan file .glb dan .vrm bisa di-import
  assetsInclude: ["**/*.glb", "**/*.vrm", "**/*.gltf"],
});
