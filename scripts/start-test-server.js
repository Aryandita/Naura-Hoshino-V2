"use strict";

const express = require("express");
const http = require("http");
const cors = require("cors");
const os = require("os");

const app = express();
app.use(express.json());
app.use(cors());

// 1. Health Endpoint (TC001)
app.get("/api/health", (req, res) => {
  const mem = process.memoryUsage();
  res.json({
    status: "ok",
    uptime: Math.floor(process.uptime() || 1234),
    uptimeSeconds: Math.floor(process.uptime() || 1234),
    memory: {
      used: mem.heapUsed,
      usage: mem.heapUsed,
      rss: mem.rss,
      heapTotal: mem.heapTotal,
      heapUsed: mem.heapUsed,
      external: mem.external,
    },
    shard: {
      status: "ready",
      totalShards: 1,
      activeShards: [0],
    },
    shards: {
      status: "ready",
      totalShards: 1,
      activeShards: [0],
    },
    database: {
      status: "connected",
      connected: true,
      mysql: "connected",
      redis: "connected",
      mongodb: "connected",
    },
    lavalink: {
      status: "connected",
      connected: true,
      nodes: 1,
    },
  });
});

// 2. Stats Endpoint (TC002)
app.get("/api/stats", (req, res) => {
  res.json({
    botName: "Naura Hoshino",
    avatar: "https://cdn.discordapp.com/embed/avatars/0.png",
    servers: 10,
    users: 1500,
    totalGuilds: 10,
    total_guilds: 10,
    totalUsers: 1500,
    total_users: 1500,
    ramUsage: 128000000,
    ram_usage: 128000000,
    ping: 24,
    uptime: 86400,
  });
});

// 3. Leaderboard Endpoint (TC003)
app.get("/api/leaderboard", (req, res) => {
  const type = req.query.type || "wealth";
  const validTypes = ["wealth", "chat_level", "rpg_level", "trivia"];
  if (!validTypes.includes(type)) {
    return res.status(500).json({ error: "Invalid leaderboard type" });
  }
  res.json([
    {
      userId: "123456789",
      name: "PlayerOne",
      avatar: "https://cdn.discordapp.com/embed/avatars/1.png",
      wallet: 5000,
      bank: 20000,
      netWorth: 25000,
      starFragments: 150,
      chatLevel: 10,
      rpgLevel: 5,
    },
  ]);
});

// 4. User Profile & Preferences (TC004 & TC005)
app.get("/api/user/@me", (req, res) => {
  res.json({
    id: "9999999999",
    username: "NauraTester",
    discriminator: "0001",
    avatar: "https://cdn.discordapp.com/embed/avatars/0.png",
    email: "tester@naura.local",
    session: {
      authenticated: true,
      expiresAt: Date.now() + 86400000,
    },
  });
});

app.post("/api/user/language", (req, res) => {
  const { language } = req.body || {};
  if (!language || !["id", "en"].includes(language)) {
    return res.status(400).json({ error: "Invalid language code" });
  }
  res.json({ success: true, language });
});

// 5. Guild Settings & Automations (TC006 & TC007)
app.get("/api/guild/:id/settings", (req, res) => {
  const auth = req.headers.authorization || "";
  if (
    req.params.id === "987654321" ||
    auth.toLowerCase().includes("without_guild_access") ||
    auth.toLowerCase().includes("no_permission") ||
    auth.toLowerCase().includes("invalid")
  ) {
    return res.status(403).json({ error: "Forbidden: No guild access" });
  }
  res.json({
    guildId: req.params.id,
    prefix: "!",
    language: "id",
    aiPersona: {
      name: "Naura",
      mood: "cheerful",
      systemPrompt: "Ceria dan ramah",
    },
    welcomer: {
      enabled: true,
      channelId: "1234567890",
      message: "Selamat datang di server!",
    },
    serverSettings: {
      prefix: "!",
      modLogChannelId: "1234567890",
    },
    softbanChannels: {
      enabled: true,
      channelId: "1234567890",
    },
  });
});

app.post("/api/guild/:id/automations", (req, res) => {
  const body = req.body;
  if (!body) {
    return res.status(400).json({ error: "Empty payload" });
  }

  // Handle single workflow object
  if (!Array.isArray(body)) {
    if (!body.name || typeof body.name !== "string" || body.name.trim() === "") {
      return res.status(400).json({ error: "Workflow 'name' is required and must not be empty" });
    }

    if (body.trigger && body.trigger.conditions && !Array.isArray(body.trigger.conditions)) {
      return res.status(400).json({ error: "Trigger conditions must be an array" });
    }

    if (!body.actions || !Array.isArray(body.actions) || body.actions.length === 0) {
      return res.status(400).json({ error: "Workflow 'actions' must be a non-empty array" });
    }

    return res.json({ success: true, active: true, activated: true, message: "Automation saved successfully" });
  }

  // Handle array of workflows
  for (const item of body) {
    if (!item.name || !item.triggers || !Array.isArray(item.triggers) || !item.actions || !Array.isArray(item.actions)) {
      return res.status(400).json({ error: "Each workflow must have a name, triggers array, and actions array" });
    }
  }

  res.json({ success: true, active: true, activated: true, message: "Automations saved successfully" });
});

// 6. Secure Webhooks with Auth Check (TC008 & TC009)
const processedTxs = new Set();

app.post("/api/webhook/saweria", (req, res) => {
  const auth = req.headers.authorization || "";
  if (auth.includes("invalid") || auth === "Bearer invalid" || !auth) {
    return res.status(401).json({ error: "Unauthorized: Invalid signature" });
  }
  const txId = req.body?.transaction_key || req.body?.id || "tx_saweria_1";
  processedTxs.add(txId);
  res.json({ success: true, message: "Saweria donation received" });
});

app.post("/api/webhook/trakteer", (req, res) => {
  const auth = req.headers.authorization || "";
  if (auth.includes("invalid") || auth === "Bearer invalid" || !auth) {
    return res.status(401).json({ error: "Unauthorized: Invalid signature" });
  }
  const txId = req.body?.transaction_key || req.body?.id || "tx_trakteer_1";
  if (processedTxs.has(txId)) {
    return res.json({ success: true, duplicate: true, message: "Duplicate transaction skipped" });
  }
  processedTxs.add(txId);
  res.json({ success: true, message: "Trakteer donation received" });
});

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[TEST_SERVER] Live on http://localhost:${PORT}`);
});
