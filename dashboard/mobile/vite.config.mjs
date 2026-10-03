import { defineConfig } from "vite";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: ".",
  publicDir: "public",

  // Semua asset mobile di-prefix /mobile/ agar tidak tabrakan dengan dashboard desktop
  base: "/mobile/",

  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index:       resolve(__dirname, "src/pages/index.html"),
        survival:    resolve(__dirname, "src/pages/survival.html"),
        inventory:   resolve(__dirname, "src/pages/inventory.html"),
        clan:        resolve(__dirname, "src/pages/clan.html"),
        marketplace: resolve(__dirname, "src/pages/marketplace.html"),
        arcade:      resolve(__dirname, "src/pages/arcade.html"),
        music:       resolve(__dirname, "src/pages/music.html"),
        economy:     resolve(__dirname, "src/pages/economy.html"),
        leaderboard: resolve(__dirname, "src/pages/leaderboard.html"),
        config:      resolve(__dirname, "src/pages/config.html"),
        profile:     resolve(__dirname, "src/pages/profile.html"),
      },
    },
    chunkSizeWarningLimit: 1000,
  },

  server: {
    port: 3091,
    host: "0.0.0.0",
    // Proxy ke Express backend yang sudah ada
    proxy: {
      "/api":      process.env.VITE_API_TARGET || "http://localhost:3070",
      "/auth":     process.env.VITE_API_TARGET || "http://localhost:3070",
      "/socket.io": {
        target: process.env.VITE_API_TARGET || "http://localhost:3070",
        ws: true,
      },
    },
  },

  preview: {
    port: 4174,
    host: "0.0.0.0",
  },

  resolve: {
    alias: {
      "@m": resolve(__dirname, "src"),
    },
  },
});
