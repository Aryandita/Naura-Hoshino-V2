"use strict";

const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT =
  parseInt(process.env.DASHBOARD_PORT || process.env.SERVER_PORT) || 3000;

const projectRoot = path.resolve(__dirname, "..");
const distPath = path.join(projectRoot, "dashboard", "dist");
const assetsPath = path.join(projectRoot, "assets");

app.use(express.json());

// 1. Serve static assets & 3D models with robust alias handling
const handleModel = (req, res) => {
  const isVrm = req.path.toLowerCase().endsWith(".vrm");
  const filename = isVrm ? "naura.vrm" : "naura.glb";
  const candidates = [
    path.join(distPath, "models", filename),
    path.join(projectRoot, "dashboard", "public", "models", filename),
    path.join(assetsPath, "3D Model Naura", filename),
    path.join(distPath, "models", "naura.glb"),
    path.join(projectRoot, "dashboard", "public", "models", "naura.glb"),
  ];
  for (const f of candidates) {
    if (fs.existsSync(f)) {
      res.setHeader("Content-Type", "model/gltf-binary");
      res.setHeader("Access-Control-Allow-Origin", "*");
      return res.sendFile(f);
    }
  }
  res.status(404).send("Model 3D tidak ditemukan");
};

app.get(
  [
    "/models/naura.vrm",
    "/assets/3d/naura.vrm",
    "/models/naura.glb",
    "/models/Naura%20Hoshino%203D.glb",
    "/models/Naura Hoshino 3D.glb",
    "/assets/3d/naura.glb",
    "/assets/3d/Naura%20Hoshino%203D.glb",
    "/assets/3d/Naura Hoshino 3D.glb",
  ],
  handleModel,
);

app.use("/assets", express.static(assetsPath));
app.use("/assets/3d", express.static(path.join(assetsPath, "3D Model Naura")));
app.use("/models", express.static(path.join(distPath, "models")));
app.use("/vendor", express.static(path.join(distPath, "vendor")));
app.use("/v2", express.static(distPath));
app.use(express.static(distPath));

// 2. Mock API endpoints for realistic preview
app.get("/api/stats", (req, res) => {
  res.json({
    botName: "Naura Hoshino",
    avatar: "/assets/core/avatar.png",
    servers: 142,
    users: 48920,
    ping: 28,
    uptime: "7d 14h 23m",
    ram: "1.42GB / 8.00GB",
    cpu: "3.8%",
    shardId: 0,
    totalShards: 2,
    dbEngine: "SUPABASE (POSTGRESQL)",
    version: "2.1.0",
  });
});

app.get("/api/user/me", (req, res) => {
  res.json({
    authenticated: true,
    user: {
      id: "123456789012345678",
      username: "Aryandita",
      discriminator: "0",
      avatar: "https://cdn.discordapp.com/embed/avatars/0.png",
      level: 42,
      xp: 18450,
      xpNeeded: 22000,
      balance: 1542000,
      bank: 5000000,
      coupons: 35,
      reputation: 128,
      rank: "Grandmaster",
      badges: ["VIP", "Early Adopter", "Bug Hunter", "RPG Pioneer"],
    },
  });
});

app.get("/api/leaderboard", (req, res) => {
  const users = [
    {
      rank: 1,
      username: "Aryandita",
      level: 42,
      xp: 18450,
      balance: 6542000,
      avatar: "/assets/Naura_Expression/Thinking.png",
    },
    {
      rank: 2,
      username: "HoshinoFan",
      level: 39,
      xp: 15200,
      balance: 4120000,
      avatar: "/assets/Naura_Expression/Read.png",
    },
    {
      rank: 3,
      username: "CyberSamurai",
      level: 35,
      xp: 12800,
      balance: 3500000,
      avatar: "/assets/Naura_Expression/Surprised.png",
    },
    {
      rank: 4,
      username: "NeonKitsune",
      level: 31,
      xp: 10400,
      balance: 2900000,
      avatar: "/assets/Naura_Expression/Angry.png",
    },
    {
      rank: 5,
      username: "QuantumDev",
      level: 28,
      xp: 8900,
      balance: 2100000,
      avatar: "/assets/Naura_Expression/Thinking.png",
    },
  ];
  res.json({ total: 5, page: 1, limit: 10, leaderboard: users });
});

app.get("/api/economy/stats", (req, res) => {
  res.json({
    circulationTotal: 485000000,
    dailyTransactions: 1420,
    marketVolume: 85200000,
    inflationRate: "+1.2%",
  });
});

app.post("/api/settings/sandbox", (req, res) => {
  const { message } = req.body || {};
  const q = String(message || "").toLowerCase();

  let reply =
    "Halo! Naura siap bantu. Ada yang bisa kubantu seputar server Discord atau fitur bot? ✨";
  if (q.includes("status") || q.includes("ping")) {
    reply =
      "Status bot saat ini: 🟢 ONLINE dengan latensi 28ms. Seluruh database (Supabase, Redis, Mongo) berjalan lancar!";
  } else if (q.includes("saldo") || q.includes("coin") || q.includes("uang")) {
    reply =
      "Saldo akunmu saat ini adalah 1.542.000 Coins dan 35 Kupon Naura di Bank Vault!";
  } else if (q.includes("lagu") || q.includes("music") || q.includes("putar")) {
    reply =
      "Saat ini sedang memutar: 'Cyber Kawaii Lo-Fi Stream' di voice channel #general! 🎵";
  } else if (q.includes("dadu") || q.includes("roll")) {
    const roll = Math.floor(Math.random() * 6) + 1;
    reply = `🎲 Dadu bergulir... dan hasilnya adalah **${roll}**! Semoga harimu menyenangkan!`;
  } else if (q.includes("aturan") || q.includes("rules")) {
    reply =
      "Aturan server utama: 1. Saling menghormati sesama member. 2. Dilarang spam atau promosi tanpa izin. 3. Patuhi arahan moderator!";
  } else if (message) {
    reply = `Naura mencatat: "${message}". Jika kamu butuh bantuan perintah lengkap, silakan ketik /help di Discord ya! 🌸`;
  }

  res.json({ reply });
});

// 3. Multi-page routes mapping to dist/src/pages
const pages = [
  "index",
  "status",
  "music",
  "leaderboard",
  "economy",
  "feed",
  "automations",
  "karaoke",
  "settings",
  "tickets",
  "welcomer",
  "world",
  "activity",
  "portfolio",
];

pages.forEach((page) => {
  const htmlPath = path.join(distPath, "src", "pages", `${page}.html`);
  const handler = (req, res) => {
    if (fs.existsSync(htmlPath)) {
      res.sendFile(htmlPath);
    } else {
      res.status(404).send(`Halaman ${page} belum dibangun.`);
    }
  };

  if (page === "index") {
    app.get("/", handler);
    app.get("/index", handler);
  }
  app.get(`/${page}`, handler);
  app.get(`/v2/${page}`, handler);
});

// Fallback to index
app.use((req, res, next) => {
  const possiblePage = path.join(
    distPath,
    "src",
    "pages",
    req.path.replace(/^\//, "") + ".html",
  );
  if (fs.existsSync(possiblePage)) {
    return res.sendFile(possiblePage);
  }
  next();
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n======================================================`);
  console.log(`🌸 NAURA HOSHINO V2 - DASHBOARD PREVIEW SERVER`);
  console.log(`======================================================`);
  console.log(`🔗 Local Preview URL : http://localhost:${PORT}`);
  console.log(`🌐 Network URL       : http://127.0.0.1:${PORT}`);
  console.log(`======================================================\n`);
});
