"use strict";

const express = require("express");
const { getDbStatus } = require("../src/managers/dbManager");
const redisManager = require("../src/managers/redisManager");

module.exports = (client) => {
  const router = express.Router();

  router.get("/health", async (req, res) => {
    try {
      // DB Status
      const dbStatus = getDbStatus();

      // Redis Status
      const redisStatus = redisManager.client && redisManager.client.isReady;

      // Lavalink Status
      let lavalinkNodes = 0;
      let lavalinkConnected = 0;

      // Check if poru is initialized (musicManager ensures it)
      if (client.poru && client.poru.nodes) {
        lavalinkNodes = client.poru.nodes.size;
        lavalinkConnected = client.poru.nodes.filter(
          (node) => node.isConnected,
        ).size;
      }

      // Uptime Bot
      const uptimeStr = client.uptime ? Math.floor(client.uptime / 1000) : 0;

      // Memory Usage
      const mem = process.memoryUsage();
      const memoryMb = (mem.heapUsed / 1024 / 1024).toFixed(2);

      res.json({
        status: "ok",
        bot: {
          uptimeSeconds: uptimeStr,
          memoryUsageMB: parseFloat(memoryMb),
          guilds: client.guilds ? client.guilds.cache.size : 0,
          ping: client.ws ? client.ws.ping : -1,
        },
        services: {
          database: dbStatus,
          redis: {
            connected: redisStatus,
          },
          lavalink: {
            nodes: lavalinkNodes,
            connected: lavalinkConnected,
          },
        },
        timestamp: Date.now(),
      });
    } catch (e) {
      res.status(500).json({ status: "error", error: e.message });
    }
  });

  router.post("/music/control", async (req, res) => {
    const { guildId, action } = req.body;
    if (!guildId || !action)
      return res.status(400).json({ error: "Missing guildId or action" });

    const player = client.poru?.players.get(guildId);
    if (!player) return res.status(404).json({ error: "Player not found" });

    try {
      if (action === "playpause") {
        if (player.isPaused) player.pause(false);
        else player.pause(true);
      } else if (action === "skip") {
        if (typeof player.stopTrack === "function") player.stopTrack();
        else
          player.node?.rest
            .updatePlayer({ guildId, data: { track: { encoded: null } } })
            .catch(() => {});
      } else if (action === "stop") {
        player.destroy();
      }
      res.json({ success: true, action });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
};
