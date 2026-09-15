"use strict";

const express = require("express");
const env = require("../../src/config/env");
const { getDbStatus } = require("../../src/managers/dbManager");
const redisManager = require("../../src/managers/redisManager");
const mongoManager = require("../../src/managers/mongoManager");

const { requireGuildManager } = require("../middleware/auth");

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

  router.post("/music/control", requireGuildManager, async (req, res) => {
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

  // --- Endpoint Topology Arsitektur Terdistribusi (Live System Topology) ---
  router.get("/topology/status", async (req, res) => {
    try {
      const dbStatus = getDbStatus();
      const mongoStatus = mongoManager
        ? mongoManager.getStatus()
        : { state: "disabled", readyState: 0, models: [] };
      const redisStatus = !!(
        redisManager.client && redisManager.client.isReady
      );

      // Lavalink Nodes
      let lavalinkNodesList = [];
      if (client.poru && client.poru.nodes) {
        const rawNodes = client.poru.nodes.values
          ? Array.from(client.poru.nodes.values())
          : Array.isArray(client.poru.nodes)
            ? client.poru.nodes
            : [];

        lavalinkNodesList = rawNodes.map((n) => ({
          name: n.name || "Lavalink Node",
          host: n.options?.host || "localhost",
          port: n.options?.port || 2333,
          connected: !!n.isConnected,
          isFallback: !!n.options?.isPrimaryFallback,
          players: n.players
            ? n.players.size ||
              (Array.isArray(n.players) ? n.players.length : 0)
            : 0,
        }));
      }

      const mem = process.memoryUsage();
      const env = require("../../src/config/env");

      res.json({
        success: true,
        timestamp: Date.now(),
        gateway: {
          status: "online",
          shardsCount: env.TOTAL_SHARDS || 1,
          currentShardId: env.SHARD_ID || 0,
          pingMs: client.ws ? client.ws.ping : 0,
          guildsCount: client.guilds ? client.guilds.cache.size : 0,
          usersCount: client.guilds
            ? client.guilds.cache.reduce(
                (acc, g) => acc + (g.memberCount || 0),
                0,
              )
            : 0,
        },
        compute: {
          runtime: `Node.js ${process.version}`,
          eventLoop: "healthy",
          workerPool: {
            service: "Dedicated Canvas Worker Pool",
            threads: 3,
            status: "ready",
          },
          memory: {
            heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
            heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
            rssMB: Math.round(mem.rss / 1024 / 1024),
          },
        },
        persistence: {
          relational: {
            engine: "Supabase / PostgreSQL (Sequelize)",
            status: dbStatus.connected ? "connected" : "disconnected",
            poolMax: dbStatus.poolMax || 10,
            poolUsed: dbStatus.poolUsed || 0,
          },
          cache: {
            engine: "Redis In-Memory Cache & Pub/Sub",
            status: redisStatus ? "connected" : "disconnected",
            mode: "Cluster Invalidator Active",
          },
          document: {
            engine: "MongoDB Atlas",
            status: mongoStatus.readyState === 1 ? "connected" : "standby",
            modelsCount: Array.isArray(mongoStatus.models)
              ? mongoStatus.models.length
              : 0,
          },
          emergencyFallback: {
            engine: "SQLite Local Fallback",
            status: "ready",
            active: false,
          },
        },
        audioCluster: {
          manager: "Poru Audio Engine v4",
          totalNodes: lavalinkNodesList.length,
          connectedNodes: lavalinkNodesList.filter((n) => n.connected).length,
          nodes: lavalinkNodesList,
        },
        aiOrchestration: {
          primaryEngine: {
            name: "Gemini 2.5 Flash",
            status: env.GEMINI_API ? "active" : "unconfigured",
          },
          failoverEngine: {
            name: "Groq LLaMA 3.3 Versatile",
            status: env.GROQ_API_KEY ? "standby_ready" : "unconfigured",
          },
          memoryService: {
            name: "Persistent AI Memory (MongoDB + Redis)",
            status: "active",
          },
          ensemble: require("../../src/ai/aiEnsembleRouter").getTelemetry(),
        },
      });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // Endpoint pertukaran token OAuth2 untuk Discord Embedded App SDK (Activity)
  router.post("/discord/token", async (req, res) => {
    try {
      const { code } = req.body || {};
      if (!code) {
        return res
          .status(400)
          .json({ success: false, error: "Missing authorization code" });
      }

      if (!env.CLIENT_ID || !env.CLIENT_SECRET) {
        return res.status(503).json({
          success: false,
          error: "Discord OAuth credentials not configured",
        });
      }

      const params = new URLSearchParams({
        client_id: env.CLIENT_ID,
        client_secret: env.CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
      });

      const tokenResponse = await globalThis.fetch(
        "https://discord.com/api/v10/oauth2/token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params,
        },
      );

      const data = await tokenResponse.json();
      if (!tokenResponse.ok) {
        return res.status(tokenResponse.status).json({
          success: false,
          error: data.error_description || data.error || "Token exchange failed",
        });
      }

      res.json({
        success: true,
        access_token: data.access_token,
        token_type: data.token_type,
        expires_in: data.expires_in,
        scope: data.scope,
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // --- Soundboard API Endpoints ---
  router.get("/soundboard/sounds", async (req, res) => {
    try {
      const soundboardService = require("../../src/services/soundboardService");
      const guildId = req.query.guildId || null;
      const sounds = await soundboardService.getAvailableSounds(guildId);
      res.json({ success: true, sounds });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post("/soundboard/play", async (req, res) => {
    try {
      const { guildId, soundId, voiceChannelId } = req.body || {};
      if (!guildId || !soundId) {
        return res
          .status(400)
          .json({ success: false, error: "Missing guildId or soundId" });
      }

      const RateLimiter = require("../../src/utils/rateLimiter");
      const clientIp = req.ip || req.headers["x-forwarded-for"] || "ip_anon";
      const rateLimitKey = req.user?.id ? `user_${req.user.id}` : `ip_${clientIp}`;
      const isLimited = await RateLimiter.isRateLimited(
        rateLimitKey,
        "api_soundboard_play",
        5,
        10,
      );
      if (isLimited) {
        return res.status(429).json({
          success: false,
          error: "Terlalu banyak permintaan pemutaran soundboard. Mohon tunggu sebentar.",
        });
      }

      // Validasi keberadaan bot di server tujuan
      const targetGuild = client.guilds?.cache?.get(guildId);
      if (!targetGuild) {
        return res.status(404).json({
          success: false,
          error: "Bot tidak berada di server tujuan.",
        });
      }

      const soundboardService = require("../../src/services/soundboardService");
      const user = req.user || null;

      const result = await soundboardService.playSound({
        client,
        guildId,
        soundId,
        voiceChannelId,
        requester: user,
      });

      if (!result.success) {
        return res.status(400).json(result);
      }

      res.json(result);
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
};
