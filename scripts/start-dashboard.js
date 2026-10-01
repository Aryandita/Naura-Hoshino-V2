"use strict";

/**
 * Script untuk menjalankan Dashboard Naura secara mandiri di lokal
 */

const env = require("../src/config/env");
const initDashboard = require("../dashboard/server");
const { connectToDatabase } = require("../src/managers/dbManager");
const { displayDashboardBootScreen } = require("../src/utils/bootScreen");
const { MODEL_3D } = require("../dashboard/routes/dashboardAssetPaths");

async function main() {
  let isDbConnected = false;

  // 1. Hubungkan database
  try {
    await connectToDatabase();
    isDbConnected = true;
  } catch (e) {
    // Fallback gracefully jika database offline
    isDbConnected = false;
  }

  // 2. Mock Client untuk telemetri
  const mockClient = {
    uptime: 3600000,
    ws: { ping: 28 },
    isReady: () => true,
    guilds: {
      cache: {
        size: 1,
        get: () => null,
      },
    },
    users: {
      cache: new Map(),
      fetch: async () => null,
    },
    channels: {
      cache: new Map(),
    },
    user: {
      id: "1483665745727721543",
      username: "Naura Hoshino",
      displayAvatarURL: () => "/assets/dashboard/naura.png",
    },
  };

  const mockPoru = {
    nodes: new Map([["Lavalink-Primary", { isConnected: true }]]),
    players: new Map(),
  };

  mockClient.poru = mockPoru;
  initDashboard(mockClient);

  const port = env.DASHBOARD_PORT || 3000;
  displayDashboardBootScreen({
    port,
    modelPaths: MODEL_3D,
    dbConnected: isDbConnected,
  });

  // Jaga proses tetap berjalan aktif tanpa batas waktu (keepalive)
  setInterval(() => {}, 1000 * 60 * 60);
}

process.on("unhandledRejection", (err) => {
  console.error("[start-dashboard] Unhandled Rejection:", err);
});

process.on("uncaughtException", (err) => {
  console.error("[start-dashboard] Uncaught Exception:", err);
});

main().catch((err) => {
  console.error("Fatal error starting dashboard:", err);
});
