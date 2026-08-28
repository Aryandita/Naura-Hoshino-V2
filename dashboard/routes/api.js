"use strict";

const express = require("express");
const { getDbStatus } = require("../../src/managers/dbManager");
const redisManager = require("../../src/managers/redisManager");
const mongoManager = require("../../src/managers/mongoManager");

module.exports = (client) => {
  const router = express.Router();

  router.get("/health", async (req, res) => {
    try {
      // DB Status (MySQL / Sequelize)
      const dbStatus = getDbStatus();

      // MongoDB Status
      const mongoStatus = mongoManager
        ? mongoManager.getStatus()
        : { state: "disabled", readyState: 0, models: [] };

      // Redis Status
      const redisStatus = !!(
        redisManager.client && redisManager.client.isReady
      );

      // Lavalink Status
      let lavalinkNodes = 0;
      let lavalinkConnected = 0;

      // Check if poru is initialized (musicManager ensures it)
      if (client.poru && client.poru.nodes) {
        const nodesList = client.poru.nodes.values
          ? Array.from(client.poru.nodes.values())
          : Array.isArray(client.poru.nodes)
            ? client.poru.nodes
            : [];
        lavalinkNodes = nodesList.length;
        lavalinkConnected = nodesList.filter(
          (node) => node && node.isConnected,
        ).length;
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
          mongodb: mongoStatus,
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

  router.post("/chat", async (req, res) => {
    try {
      const {
        message,
        prompt,
        history,
        username: reqUsername,
      } = req.body || {};
      const textPrompt = String(message || prompt || "").trim();
      if (!textPrompt) {
        return res.status(400).json({ error: "Pesan tidak boleh kosong." });
      }

      const userId = req.user?.id || null;
      const username = req.user?.username || reqUsername || "Teman Baik";
      const env = require("../../src/config/env");
      const isOwner = userId && env.OWNER_IDS && env.OWNER_IDS.includes(userId);
      const isPremium = req.user?.db?.isPremium || false;

      const aiManager = require("../../src/managers/aiManager");
      const result = await aiManager.chatCompanion({
        prompt: textPrompt,
        history: Array.isArray(history) ? history : [],
        userId,
        username,
        isOwner,
        isPremium,
      });

      res.json({
        success: true,
        reply: result.reply,
        source: result.source,
        username: result.username,
      });
    } catch (error) {
      res
        .status(500)
        .json({ error: error.message || "Gagal memproses pesan." });
    }
  });

  return router;
};
