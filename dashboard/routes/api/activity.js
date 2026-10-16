"use strict";

const express = require("express");
const { requireApiLogin, isOwner } = require("../../middleware/auth");
const { arcadeState, resolveUsername, isSafeWebhookUrl } = require("./helpers");

function register(router, client) {
  // --- 1. AI Companion Chat ---
  router.post("/chat", async (req, res) => {
    try {
      if (!req.body || typeof req.body !== "object") {
        return res.status(400).json({ error: "Pesan tidak boleh kosong." });
      }
      const {
        message,
        prompt,
        history,
        username: reqUsername,
      } = req.body;
      const rawText =
        typeof message === "string"
          ? message
          : typeof prompt === "string"
            ? prompt
            : "";
      const textPrompt = rawText.trim();
      if (!textPrompt || textPrompt.length === 0) {
        return res.status(400).json({ error: "Pesan tidak boleh kosong." });
      }
      if (textPrompt.length > 2000) {
        return res
          .status(400)
          .json({ error: "Pesan terlalu panjang (maksimum 2000 karakter)." });
      }

      const userId = req.user?.id || null;
      const username = req.user?.username || reqUsername || "Teman Baik";
      const { isOwner: checkIsOwner } = require("../../middleware/auth");
      const userIsOwner = userId ? checkIsOwner(userId) : false;
      const isPremium = req.user?.db?.isPremium || false;

      const aiManager = require("../../../src/managers/aiManager");
      const result = await aiManager.chatCompanion({
        prompt: textPrompt,
        history: Array.isArray(history) ? history : [],
        userId,
        username,
        isOwner: userIsOwner,
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

  // --- 2. Realtime Clan Territories & Contribution ---
  router.get("/realtime/territories", async (req, res) => {
    try {
      let territories = [];
      try {
        const ClanTerritory = require("../../../src/models/ClanTerritory");
        territories = await ClanTerritory.findAll({
          order: [["controlPoints", "DESC"]],
        });
      } catch (_) {}

      if (!territories || territories.length === 0) {
        const guildFederationEngine = require("../../../src/survival/engines/guildFederationEngine");
        const towers = guildFederationEngine.getRelicTowers();
        territories = towers.map((t, idx) => ({
          territoryId: t.id,
          name: t.name,
          clanName: t.controllerFedTag || "Aliansi Teritori",
          controlPoints: Math.floor((t.defenseHp / t.maxHp) * 1000),
          maxControlPoints: 1000,
          defenseLevel: idx + 1,
          infrastructurePoints: 250 * (idx + 1),
          taxYield: 1500,
          buffEffect: t.buffDescription || "+15% Resource Yield",
        }));
      }

      res.json({
        success: true,
        territories,
        totalControlled: territories.length,
        timestamp: Date.now(),
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post("/territory/contribute", requireApiLogin, async (req, res) => {
    try {
      const { territoryId, energyAmount = 100 } = req.body || {};
      if (!territoryId) {
        return res
          .status(400)
          .json({ success: false, error: "territoryId wajib disertakan." });
      }

      const amount = Math.min(1000, Math.max(10, Number(energyAmount) || 100));
      const userId = req.user.id;

      const cacheManager = require("../../../src/managers/cacheManager");
      const debited = await cacheManager.debitUserSurvival(
        userId,
        "starFragments",
        50,
      );
      if (!debited?.ok) {
        return res.status(400).json({
          success: false,
          error:
            "Saldo Star Fragments kamu tidak mencukupi untuk melakukan kontribusi (butuh 50 NSF).",
        });
      }

      let updatedPoints = 500 + amount;
      try {
        const ClanTerritory = require("../../../src/models/ClanTerritory");
        const territory = await ClanTerritory.findOne({
          where: { territoryId },
        });
        if (territory) {
          territory.infrastructurePoints =
            (territory.infrastructurePoints || 0) + amount;
          territory.controlPoints = Math.min(
            territory.maxControlPoints || 1000,
            (territory.controlPoints || 0) + Math.floor(amount / 2),
          );
          await territory.save({
            fields: ["infrastructurePoints", "controlPoints"],
          });
          updatedPoints = territory.controlPoints;
        }
      } catch (_) {}

      res.json({
        success: true,
        message: `Kontribusi energi berhasil ditambahkan ke sektor ${territoryId}!`,
        contributed: amount,
        currentPoints: updatedPoints,
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // --- 3. Discord Activity Manifest & Radar ---
  router.get("/activity/manifest", (req, res) => {
    try {
      const manifest = require("../../../src/config/discordActivityManifest.json");
      res.json(manifest);
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.get("/activity/social-radar", (req, res) => {
    try {
      const guildId = req.query.guildId || "default_guild";
      const friends = [
        {
          userId: "101",
          username: "AstralWalker",
          status: "IN_VOICE",
          level: 42,
          clanTag: "STAR",
          coopReady: true,
        },
        {
          userId: "102",
          username: "CyberSamurai",
          status: "IN_DUNGEON",
          level: 38,
          clanTag: "ECLIP",
          coopReady: false,
        },
        {
          userId: "103",
          username: "HoshinoAdventurer",
          status: "IN_VOICE",
          level: 29,
          clanTag: "STAR",
          coopReady: true,
        },
      ];
      res.json({
        success: true,
        guildId,
        scope: "relationships.read",
        activeFriendsCount: friends.filter((f) => f.coopReady).length,
        friends,
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post("/activity/coop-invite", (req, res) => {
    try {
      const { hostUserId, targetUserId, activityType = "neo_abyss" } =
        req.body || {};
      if (!hostUserId || !targetUserId) {
        return res
          .status(400)
          .json({ success: false, error: "Missing hostUserId or targetUserId" });
      }

      const partyId = `party_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      res.json({
        success: true,
        partyId,
        hostUserId,
        targetUserId,
        activityType,
        status: "INVITATION_DISPATCHED",
        message:
          "Undangan party Co-Op Dungeon (The Neo-Abyss) berhasil disiarkan ke sesi teman!",
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post("/activity/party-matchmake", (req, res) => {
    try {
      const { hostUserId = "current_user", guildId = "default_guild" } =
        req.body || {};
      const partyId = `party_auto_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const members = [
        { userId: hostUserId, role: "LEADER", ready: true },
        { userId: "101", username: "AstralWalker", role: "DPS", ready: true },
        { userId: "103", username: "HoshinoAdventurer", role: "SUPPORT", ready: true },
      ];

      res.json({
        success: true,
        partyId,
        guildId,
        activityType: "the_neo_abyss",
        matchedMembers: members,
        partyStatus: "READY_TO_DEPLOY",
        message: "Party Co-Op The Neo-Abyss berhasil dibentuk dalam 1 klik!",
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // --- 4. Spatial Audio & Positioning ---
  router.get("/activity/spatial-proximity", async (req, res) => {
    try {
      const landEngine = require("../../../src/survival/engines/landEngine");
      const guildId = req.query.guildId || "default_guild";
      const userId = req.query.userId || "current_user";

      const simulatedPlayers = [
        { userId: "player_01", username: "AstralWalker", x: 3, y: 3 },
        { userId: "player_02", username: "CyberSamurai", x: 4, y: 5 },
        { userId: "player_03", username: "StarlightMage", x: 8, y: 8 },
      ];

      const proximityMap = await landEngine.getProximityAudioMap(
        guildId,
        userId,
        simulatedPlayers,
      );
      const myPos = (await landEngine.getPlayerPosition(guildId, userId)) || {
        x: 3,
        y: 4,
        username: "You",
      };

      res.json({
        success: true,
        guildId,
        listenerPos: myPos,
        proximityAudio: proximityMap,
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post("/activity/spatial-position", async (req, res) => {
    try {
      const landEngine = require("../../../src/survival/engines/landEngine");
      const { guildId = "default_guild", x = 1, y = 1, username } =
        req.body || {};

      const userId =
        req.user?.id ||
        (req.body?.userId
          ? `guest_${String(req.body.userId).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32)}`
          : `guest_${String(req.ip || "anon").replace(/[^a-zA-Z0-9_-]/g, "")}`);
      const safeUsername = req.user?.username || username || "Guest";

      const clampedX = Math.max(-1000, Math.min(1000, Number(x) || 0));
      const clampedY = Math.max(-1000, Math.min(1000, Number(y) || 0));

      const pos = await landEngine.updatePlayerPosition(guildId, userId, {
        x: clampedX,
        y: clampedY,
        username: safeUsername,
      });
      res.json({ success: true, position: pos });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // --- 5. World POIs & Survival Regional Map ---
  router.get("/survival/world-pois", (req, res) => {
    try {
      const { REGIONS } = require("../../../src/survival/data/worldMapData");
      const rawNpcs = require("../../../src/survival/data/npcs");

      const enrichedNpcs = {};
      if (rawNpcs && typeof rawNpcs === "object") {
        for (const [id, npc] of Object.entries(rawNpcs)) {
          enrichedNpcs[id] = {
            ...npc,
            role: npc.title || npc.role || "Warga",
            avatar: npc.image
              ? `/assets/survival/characters/${npc.image}`
              : "/assets/core/avatar.png",
          };
        }
      }

      const REGION_METAS = {
        desa_sukamaju: {
          tag: "ZONA AWAL & GATHERING (STARTER HAVEN)",
          category: "safe",
          climate: "Tropis Lembab & Asri",
          reqLevel: "Lv. 1 - 10",
          danger: "★☆☆☆☆ Aman",
          dangerColor: "#34d399",
          resources: { wood: 85, ore: 65, fish: 90, herb: 75 },
          coords: "X: 220 · Y: 430",
          fastTravelCost: 10,
          monsters:
            "Aman terlindung. Hama kebun level rendah (Kelinci Liar, Tikus Sawah, Babi Hutan Hutan Pinus).",
        },
        kota_pratama: {
          tag: "PUSAT METROPOLIS & EKONOMI NC (SAFE HUB)",
          category: "commerce",
          climate: "Modern Sejuk & Gemerlap Neon",
          reqLevel: "Lv. 10 - 25",
          danger: "★☆☆☆☆ Aman Terlindung",
          dangerColor: "#38bdf8",
          resources: { wood: 20, ore: 30, fish: 40, tech: 95 },
          coords: "X: 480 · Y: 270",
          fastTravelCost: 25,
          monsters:
            "Tidak ada monster. Zona dilindungi oleh Pasukan Penjaga Kota dan Walikota Lucy.",
        },
        desa_khulkhas: {
          tag: "WILAYAH SALJU ABADI & GUNA ES (WINTER HAVEN)",
          category: "snow",
          climate: "Salju Abadi & Dingin Mistik",
          reqLevel: "Lv. 25 - 40",
          danger: "★★★☆☆ Dingin Ekstrem",
          dangerColor: "#38bdf8",
          resources: { wood: 30, ore: 85, fish: 60, iceCrystal: 95 },
          coords: "X: 720 · Y: 160",
          fastTravelCost: 50,
          monsters:
            "Beruang Salju Purba (Lv. 28), Serigala Es Gletser (Lv. 32), Golem Es Abadi (Lv. 38).",
        },
        hutan_dha_mhai: {
          tag: "KANOPY PURBA & SANCTUARY RIMBA (MYSTIC FOREST)",
          category: "forest",
          climate: "Lembab Mistik & Spora Berpendar",
          reqLevel: "Lv. 15 - 30",
          danger: "★★★☆☆ Berbahaya",
          dangerColor: "#8b5cf6",
          resources: { wood: 95, ore: 40, fish: 50, resin: 90 },
          coords: "X: 240 · Y: 190",
          fastTravelCost: 35,
          monsters:
            "Lebah Rimba Raksasa (Lv. 18), Babi Hutan Purba (Lv. 22), Treant Kanopi Gelap (Lv. 28).",
        },
        desa_lauh_than: {
          tag: "PESISIR MARITIM & GERBANG BAWAH LAUT (OCEAN PORT)",
          category: "coastal",
          climate: "Tropis Bahari & Semilir Ombak",
          reqLevel: "Lv. 20 - 35",
          danger: "★★★☆☆ Waspada Laut Dalam",
          dangerColor: "#0ea5e9",
          resources: { wood: 45, ore: 55, fish: 98, pearl: 85 },
          coords: "X: 520 · Y: 510",
          fastTravelCost: 40,
          monsters:
            "Predator Karang Gigi Gergaji (Lv. 24), Hiu Purba Bertanduk (Lv. 29), Kraken Pesisir (Lv. 35).",
        },
        istana_draken: {
          tag: "DUNGEON BERTINGKAT & WORLD BOSS (HIGH DANGER)",
          category: "dungeon",
          climate: "Panas Membara & Toksik Abyss",
          reqLevel: "Lv. 40+ (End-Game Raid)",
          danger: "★★★★★ EKSTREM / MAUT",
          dangerColor: "#ef4444",
          resources: { wood: 5, ore: 95, fish: 0, mythic: 100 },
          coords: "X: 740 · Y: 420",
          fastTravelCost: 100,
          monsters:
            "Gargoyle Malakor (Lv. 45 Gatekeeper), Iblis Bayangan (Lv. 48), Penguasa Draken (Lantai 50 Boss).",
        },
      };

      const enrichedRegions = {};
      for (const [key, reg] of Object.entries(REGIONS)) {
        enrichedRegions[key] = {
          ...reg,
          ...(REGION_METAS[key] || {}),
        };
      }

      res.json({
        success: true,
        regions: enrichedRegions,
        npcs: enrichedNpcs,
        timestamp: Date.now(),
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // --- 6. Realtime Survival Status ---
  router.get("/realtime/survival", async (req, res) => {
    try {
      const UserSurvival = require("../../../src/models/UserSurvival");
      const userIsOwner = req.user?.id ? isOwner(req.user.id) : false;
      const currentUserId =
        userIsOwner && req.query.userId
          ? String(req.query.userId)
          : req.user?.id || null;
      let currentUserData = null;

      if (currentUserId) {
        const s = await UserSurvival.findOne({
          where: { userId: currentUserId },
        });
        if (s) {
          currentUserData = {
            id: s.userId,
            name: req.user?.username || `Survivor #${s.userId.slice(-4)}`,
            avatar: req.user?.avatar
              ? `https://cdn.discordapp.com/avatars/${req.user.id}/${req.user.avatar}.png`
              : null,
            starFragments: s.starFragments || 0,
            coupons: s.coupons || 0,
            stats: {
              hp: s.hp || 100,
              stamina: s.stamina || 100,
              hunger: s.hunger || 100,
              thirst: s.thirst || 100,
            },
            attributes: {
              strength: s.strength || 1,
              agility: s.agility || 1,
              intelligence: s.intelligence || 1,
              luck: s.luck || 1,
            },
            progress: {
              level: s.survival_level || 1,
              xp: s.survival_xp || 0,
            },
            world: {
              location: s.currentLocation || "desa_sukamaju",
              day: s.day || 1,
            },
          };
        }
      }

      const survivors = await UserSurvival.findAll({
        limit: 10,
        order: [["updatedAt", "DESC"]],
      });
      const data = survivors.map((s) => ({
        id: s.userId,
        name:
          s.userId === currentUserId && req.user?.username
            ? req.user.username
            : `Survivor #${s.userId.slice(-4)}`,
        avatar:
          s.userId === currentUserId && req.user?.avatar
            ? `https://cdn.discordapp.com/avatars/${req.user.id}/${req.user.avatar}.png`
            : null,
        starFragments: s.starFragments || 0,
        coupons: s.coupons || 0,
        stats: {
          hp: s.hp || 100,
          stamina: s.stamina || 100,
          hunger: s.hunger || 100,
          thirst: s.thirst || 100,
        },
        attributes: {
          strength: s.strength || 1,
          agility: s.agility || 1,
          intelligence: s.intelligence || 1,
          luck: s.luck || 1,
        },
        progress: {
          level: s.survival_level || 1,
          xp: s.survival_xp || 0,
        },
        world: {
          location: s.currentLocation || "desa_sukamaju",
          day: s.day || 1,
        },
      }));

      if (currentUserData && !data.some((p) => p.id === currentUserData.id)) {
        data.unshift(currentUserData);
      }

      res.json({ success: true, currentUser: currentUserData, data });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message, data: [] });
    }
  });

  // --- 7. Activity SSE Stream ---
  router.get("/activity/stream", (req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    const sendFeedItem = async () => {
      try {
        const MarketAuction = require("../../../src/models/MarketAuction");
        const UserSurvival = require("../../../src/models/UserSurvival");
        const UserProfile = require("../../../src/models/UserProfile");
        const ServerStock = require("../../../src/models/ServerStock");

        const feeds = [];

        try {
          const auctions = await MarketAuction.findAll({
            order: [["updatedAt", "DESC"]],
            limit: 2,
          });
          auctions.forEach((auc) => {
            const cur = auc.currency === "coin" ? "NC" : "NSF";
            const price = auc.currentBid || auc.startingPrice || 100;
            feeds.push({
              type: "economy",
              title: `Bursa Lelang: ${auc.itemId.replace(/_/g, " ")}`,
              desc: `Lot ${auc.amount}x ${auc.itemId} aktif dengan penawaran ${price.toLocaleString("id-ID")} ${cur}.`,
              time: "Baru saja",
              badge: `${price} ${cur}`,
            });
          });
        } catch (_) {}

        try {
          const survivors = await UserSurvival.findAll({
            order: [["updatedAt", "DESC"]],
            limit: 2,
          });
          for (const s of survivors) {
            const name = await resolveUsername(client, s.userId);
            feeds.push({
              type: "survival",
              title: `Eksplorasi Wilds: ${name}`,
              desc: `${name} aktif di ${s.currentLocation || "hutan"} dengan ${(s.starFragments || 0).toLocaleString("id-ID")} NSF.`,
              time: "Baru saja",
              badge: `Lv. ${s.survival_level || 1}`,
            });
          }
        } catch (_) {}

        try {
          const profiles = await UserProfile.findAll({
            order: [
              ["leveling_level", "DESC"],
              ["leveling_xp", "DESC"],
            ],
            limit: 2,
          });
          for (const p of profiles) {
            const name = await resolveUsername(client, p.userId);
            feeds.push({
              type: "leveling",
              title: `Pencapaian: ${name}`,
              desc: `${name} mengumpulkan ${(p.leveling_xp || 0).toLocaleString("id-ID")} XP dan tabungan ${(p.economy_bank || 0).toLocaleString("id-ID")} NC.`,
              time: "Baru saja",
              badge: `Lv. ${p.leveling_level || 1}`,
            });
          }
        } catch (_) {}

        try {
          const stocks = await ServerStock.findAll({
            order: [["updatedAt", "DESC"]],
            limit: 2,
          });
          stocks.forEach((st) => {
            const cur = Number(st.currentPrice || 0);
            const prev = Number(st.previousPrice || cur);
            const diff = cur - prev;
            const pct = prev > 0 ? ((diff / prev) * 100).toFixed(1) : "0.0";
            feeds.push({
              type: "economy",
              title: `Saham ${st.ticker}: ${st.name}`,
              desc: `Harga pasar terkini 🪙 ${Math.round(cur).toLocaleString("id-ID")} NC (${diff >= 0 ? "+" : ""}${pct}%).`,
              time: "Baru saja",
              badge: `${st.ticker}`,
            });
          });
        } catch (_) {}

        const chosen =
          feeds.length > 0
            ? feeds[Math.floor(Math.random() * feeds.length)]
            : {
                type: "system",
                title: "Database Cluster Aktif",
                desc: "Bot dan database Supabase PostgreSQL beroperasi optimal.",
                time: "Baru saja",
                badge: "CONNECTED",
              };

        res.write(`event: activity\ndata: ${JSON.stringify(chosen)}\n\n`);
      } catch (_) {}
    };

    sendFeedItem().catch(() => {});
    const interval = setInterval(sendFeedItem, 15000);
    req.on("close", () => {
      clearInterval(interval);
      res.end();
    });
  });

  // --- 8. Gacha Pool ---
  router.get("/activity/gacha-pool", async (req, res) => {
    try {
      const GameItem = require("../../../src/models/GameItem");
      const items = await GameItem.findAll({ limit: 60 });
      const tierMap = {
        Biasa: "r",
        Langka: "sr",
        "Sangat Langka": "ssr",
        Mitos: "ssr",
      };
      const iconMap = {
        tool: "⛏️",
        weapon: "⚔️",
        armor: "🛡️",
        consumable: "🧪",
        accessory: "💍",
        special: "⭐",
      };
      const pool = items.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category || "item",
        price: item.price || 500,
        tier: tierMap[item.rarity] || "r",
        rarity: item.rarity || "Biasa",
        icon: iconMap[item.category] || "📦",
      }));
      res.json({ success: true, pool });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message, pool: [] });
    }
  });

  // --- 9. Survival Weather ---
  router.get("/survival/weather", (req, res) => {
    try {
      const regionId = req.query.region || "desa_sukamaju";
      const worldWeatherEngine = require("../../../src/survival/engines/worldWeatherEngine");
      const weather = worldWeatherEngine.getCurrentWeather(regionId);
      res.json({ success: true, weather });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // --- 10. Survival Farm Harvest Notification Webhooks ---
  router.get("/survival/farm/webhook", requireApiLogin, async (req, res) => {
    try {
      const targetUserId =
        isOwner(req.user.id) && req.query.userId
          ? String(req.query.userId)
          : req.user.id;
      const farmWebhook = require("../../../src/services/farmNotificationWebhook");
      const webhookUrl = await farmWebhook.getWebhook(targetUserId);
      res.json({ success: true, webhookUrl });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post(
    "/survival/farm/webhook",
    requireApiLogin,
    express.json(),
    async (req, res) => {
      try {
        const { webhookUrl, action } = req.body || {};
        const targetUserId =
          isOwner(req.user.id) && req.body?.userId
            ? String(req.body.userId)
            : req.user.id;

        const farmWebhook = require("../../../src/services/farmNotificationWebhook");
        if (action === "delete") {
          await farmWebhook.deleteWebhook(targetUserId);
          return res.json({ success: true, message: "Webhook berhasil dihapus." });
        }

        if (!webhookUrl || !isSafeWebhookUrl(webhookUrl)) {
          return res.status(400).json({
            success: false,
            message:
              "URL webhook tidak valid atau tidak aman. Pastikan menggunakan protokol HTTPS resmi dan bukan alamat privat internal.",
          });
        }

        const result = await farmWebhook.setWebhook(targetUserId, webhookUrl);
        if (!result.success) {
          return res.status(400).json(result);
        }
        res.json({
          success: true,
          message: "Webhook notifikasi panen berhasil disimpan!",
        });
      } catch (err) {
        res.status(500).json({ success: false, error: err.message });
      }
    },
  );

  // --- 11. Retro Arcade Reward Claim & Leaderboard (Redis Consolidated) ---
  router.post("/arcade/claim", async (req, res) => {
    try {
      const { score } = req.body || {};
      const numScore = Math.max(0, Math.min(5000, parseInt(score, 10) || 0));
      const reward = Math.min(300, Math.floor(numScore * 1.5));

      const isAuth =
        typeof req.isAuthenticated === "function" &&
        req.isAuthenticated() &&
        req.user;
      if (!isAuth) {
        return res.json({
          success: true,
          isGuest: true,
          reward,
          score: numScore,
          message: `Skor ${numScore.toLocaleString("id-ID")} dicatat! Masuk dengan Discord untuk menyimpan +${reward} NSF ke petualanganmu.`,
        });
      }

      // Validasi cooldown anti-farming via Redis / In-Memory
      const lastClaim = await arcadeState.getCooldown(req.user.id);
      const now = Date.now();
      if (now - lastClaim < arcadeState.COOLDOWN_MS) {
        const remainingSec = Math.ceil(
          (arcadeState.COOLDOWN_MS - (now - lastClaim)) / 1000,
        );
        return res.status(429).json({
          success: false,
          error: `Mohon tunggu ${remainingSec} detik sebelum menukarkan skor arcade kembali.`,
        });
      }

      // Validasi batas maksimum harian (Anti-Infinite Farming Daily Cap)
      const today = new Date().toISOString().slice(0, 10);
      const userDaily = await arcadeState.getDaily(req.user.id, today);
      if (userDaily.date !== today) {
        userDaily.date = today;
        userDaily.claimed = 0;
      }

      const remainingCap = Math.max(
        0,
        arcadeState.DAILY_CAP - userDaily.claimed,
      );
      if (remainingCap <= 0) {
        return res.status(400).json({
          success: false,
          error:
            "Batas klaim hadiah arcade harian (500 NSF) sudah tercapai untuk hari ini. Silakan coba lagi besok!",
        });
      }

      const actualReward = Math.min(reward, remainingCap);
      userDaily.claimed += actualReward;
      await arcadeState.setDaily(req.user.id, userDaily);
      await arcadeState.setCooldown(req.user.id, now);

      if (actualReward > 0) {
        const cacheManager = require("../../../src/managers/cacheManager");
        await cacheManager.incrementUserSurvival(
          req.user.id,
          "starFragments",
          actualReward,
        );
      }

      return res.json({
        success: true,
        isGuest: false,
        reward: actualReward,
        dailyClaimed: userDaily.claimed,
        dailyCap: arcadeState.DAILY_CAP,
        score: numScore,
        message: `Luar biasa! Skor ${numScore.toLocaleString("id-ID")} berhasil ditukarkan dengan +${actualReward} Star Fragments!`,
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  router.get("/arcade/leaderboard", async (req, res) => {
    try {
      const UserSurvival = require("../../../src/models/UserSurvival");
      const topSurvivals = await UserSurvival.findAll({
        order: [["survival_xp", "DESC"]],
        limit: 5,
      }).catch(() => []);

      const scores = topSurvivals.map((s, idx) => {
        let name = `Petualang_${String(s.userId).slice(0, 5)}`;
        if (client && client.users) {
          const u = client.users.cache.get(s.userId);
          if (u) name = u.username;
        }
        return {
          rank: idx + 1,
          name,
          highScore: Math.floor((s.survival_xp || 100) * 1.2),
        };
      });

      return res.json({ success: true, leaderboard: scores });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });
}

module.exports = {
  register,
  createRouter(client) {
    const router = express.Router();
    register(router, client);
    return router;
  },
};
