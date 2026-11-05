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
      const RateLimiter = require("../../../src/utils/rateLimiter");
      const clientIp = req.ip || req.headers["x-forwarded-for"] || "anon";
      const identifier = userId || clientIp;
      const rateCheck = await RateLimiter.consume(identifier, "api_activity_chat", 25, 60);
      if (rateCheck.limited) {
        return res.status(429).json({
          error: `Terlalu banyak permintaan percakapan. Silakan tunggu ${rateCheck.retryAfter} detik.`,
        });
      }
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

  // In-memory guest sessions cache for visitors playing without Discord login (Capped at 500, 30m TTL)
  const MAX_GUEST_SESSIONS = 500;
  const GUEST_SESSION_TTL_MS = 30 * 60 * 1000;
  const guestSessions = new Map();

  function cleanGuestSessions() {
    const now = Date.now();
    for (const [id, entry] of guestSessions.entries()) {
      if (now - (entry.lastAccessedAt || 0) > GUEST_SESSION_TTL_MS) {
        guestSessions.delete(id);
      }
    }
    if (guestSessions.size > MAX_GUEST_SESSIONS) {
      const sorted = Array.from(guestSessions.entries()).sort(
        (a, b) => (a[1].lastAccessedAt || 0) - (b[1].lastAccessedAt || 0),
      );
      const toRemove = guestSessions.size - MAX_GUEST_SESSIONS;
      for (let i = 0; i < toRemove; i++) {
        guestSessions.delete(sorted[i][0]);
      }
    }
  }

  function getOrCreateGuest(guestId, username) {
    cleanGuestSessions();
    const id = guestId || `guest_${Math.random().toString(36).substring(2, 9)}`;
    const now = Date.now();
    if (!guestSessions.has(id)) {
      guestSessions.set(id, {
        lastAccessedAt: now,
        data: {
          userId: id,
          username: username || "Petualang Adisha",
          avatar: null,
          hp: 100,
          maxHp: 120,
          stamina: 100,
          maxStamina: 100,
          hunger: 100,
          thirst: 100,
          starFragments: 150,
          coins: 1000,
          survival_level: 1,
          survival_xp: 0,
          inventory: [
            { id: "wooden_axe", name: "Kapak Kayu", amount: 1, type: "tool" },
            { id: "wooden_pickaxe", name: "Beliung Kayu", amount: 1, type: "tool" },
            { id: "wood", name: "Kayu", amount: 5, type: "material" },
            { id: "stone", name: "Batu", amount: 3, type: "material" },
          ],
          lastBlessing: 0,
          claimedStarterKit: false,
          claimedFishingKit: false,
        },
      });
    } else {
      const entry = guestSessions.get(id);
      entry.lastAccessedAt = now;
      if (username) entry.data.username = username;
    }
    return guestSessions.get(id).data;
  }

  // --- 3B. Hybrid Discord Embedded App Auth & Session Handshake ---
  router.post("/activity/auth", async (req, res) => {
    try {
      const { code, guestId, username: reqUsername, avatar: reqAvatar } = req.body || {};
      let userId = req.user?.id || null;
      let username = req.user?.username || null;
      let avatar = req.user?.avatar ? `https://cdn.discordapp.com/avatars/${req.user.id}/${req.user.avatar}.png` : null;
      let isGuest = false;

      // 1. Check if authenticated via Express Session / Passport
      if (userId) {
        isGuest = false;
      } else if (code) {
        // 2. Check if Discord OAuth code was provided by Embedded App SDK
        const env = require("../../../src/config/env");
        if (env.CLIENT_ID && env.CLIENT_SECRET) {
          try {
            const axios = require("axios");
            const tokenRes = await axios.post(
              "https://discord.com/api/oauth2/token",
              new URLSearchParams({
                client_id: env.CLIENT_ID,
                client_secret: env.CLIENT_SECRET,
                grant_type: "authorization_code",
                code,
              }),
              {
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                timeout: 5000,
              },
            );
            if (tokenRes.data?.access_token) {
              const userRes = await axios.get("https://discord.com/api/users/@me", {
                headers: { Authorization: `Bearer ${tokenRes.data.access_token}` },
                timeout: 5000,
              });
              if (userRes.data?.id) {
                userId = userRes.data.id;
                username = userRes.data.username;
                avatar = userRes.data.avatar
                  ? `https://cdn.discordapp.com/avatars/${userRes.data.id}/${userRes.data.avatar}.png`
                  : null;
                isGuest = false;
              }
            }
          } catch (_) {
            // Fallback to guest if token exchange fails (e.g. offline dev, mock code)
          }
        }
      }

      // 3. Fallback to Guest Mode if not authenticated
      let survivalData = null;
      let inventoryList = [];

      if (userId && !isGuest) {
        const cacheManager = require("../../../src/managers/cacheManager");
        const { safeParseInventory } = require("../../../src/survival/engines/inventoryHelper");
        const [userSurvival, userProfile] = await Promise.all([
          cacheManager.getUserSurvival(userId),
          cacheManager.getUserProfile(userId),
        ]);

        inventoryList = safeParseInventory(userProfile?.inventory);
        survivalData = {
          hp: Number(userSurvival?.hp ?? 100),
          maxHp: 120,
          stamina: Number(userSurvival?.stamina ?? 100),
          maxStamina: 100,
          hunger: Number(userSurvival?.hunger ?? 100),
          thirst: Number(userSurvival?.thirst ?? 100),
          starFragments: Number(userSurvival?.starFragments ?? 0),
          coins: Number(userProfile?.economy_wallet ?? 0),
          survival_level: Number(userSurvival?.survival_level ?? 1),
          survival_xp: Number(userSurvival?.survival_xp ?? 0),
        };
      } else {
        isGuest = true;
        const guest = getOrCreateGuest(guestId, reqUsername);
        userId = guest.userId;
        username = guest.username;
        avatar = reqAvatar || null;
        survivalData = {
          hp: guest.hp,
          maxHp: guest.maxHp,
          stamina: guest.stamina,
          maxStamina: guest.maxStamina,
          hunger: guest.hunger,
          thirst: guest.thirst,
          starFragments: guest.starFragments,
          coins: guest.coins,
          survival_level: guest.survival_level,
          survival_xp: guest.survival_xp,
        };
        inventoryList = guest.inventory;
      }

      res.json({
        success: true,
        isGuest,
        user: { id: userId, username: username || "Petualang Sukamaju", avatar },
        survival: survivalData,
        inventory: inventoryList,
        location: "desa_sukamaju",
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // --- Real-time Activity State (Survival Stats, Inventory, Weather) ---
  router.get("/activity/state", async (req, res) => {
    try {
      const requestedUserId = req.query.userId || null;
      const requestedIsGuest = requestedUserId && String(requestedUserId).startsWith("guest_");
      if (requestedUserId && !requestedIsGuest && !req.user?.id) {
        return res.status(401).json({ success: false, error: "Masuk terlebih dahulu untuk melihat data akun." });
      }
      if (requestedUserId && !requestedIsGuest && req.user?.id && String(requestedUserId) !== String(req.user.id) && !isOwner(req.user.id)) {
        return res.status(403).json({ success: false, error: "Akses data pemain lain ditolak." });
      }
      const targetUserId = requestedIsGuest ? String(requestedUserId) : req.user?.id || null;
      const guestId = req.query.guestId || null;

      if (!targetUserId && !guestId) {
        const guest = getOrCreateGuest(null);
        return res.json({
          success: true,
          isGuest: true,
          user: { id: guest.userId, username: guest.username, avatar: null },
          survival: {
            hp: guest.hp,
            maxHp: guest.maxHp,
            stamina: guest.stamina,
            maxStamina: guest.maxStamina,
            starFragments: guest.starFragments,
            coins: guest.coins,
            survival_level: guest.survival_level,
            survival_xp: guest.survival_xp,
          },
          inventory: guest.inventory,
          location: "desa_sukamaju",
        });
      }

      if (targetUserId && !targetUserId.startsWith("guest_")) {
        const cacheManager = require("../../../src/managers/cacheManager");
        const { safeParseInventory } = require("../../../src/survival/engines/inventoryHelper");
        const [userSurvival, userProfile] = await Promise.all([
          cacheManager.getUserSurvival(targetUserId),
          cacheManager.getUserProfile(targetUserId),
        ]);

        const inventory = safeParseInventory(userProfile?.inventory);
        return res.json({
          success: true,
          isGuest: false,
          user: {
            id: targetUserId,
            username: req.user?.username || (await resolveUsername(client, targetUserId)),
            avatar: req.user?.avatar ? `https://cdn.discordapp.com/avatars/${targetUserId}/${req.user.avatar}.png` : null,
          },
          survival: {
            hp: Number(userSurvival?.hp ?? 100),
            maxHp: 120,
            stamina: Number(userSurvival?.stamina ?? 100),
            maxStamina: 100,
            hunger: Number(userSurvival?.hunger ?? 100),
            thirst: Number(userSurvival?.thirst ?? 100),
            starFragments: Number(userSurvival?.starFragments ?? 0),
            coins: Number(userProfile?.economy_wallet ?? 0),
            survival_level: Number(userSurvival?.survival_level ?? 1),
            survival_xp: Number(userSurvival?.survival_xp ?? 0),
          },
          inventory,
          location: userSurvival?.currentLocation || "desa_sukamaju",
        });
      }

      const guest = getOrCreateGuest(targetUserId || guestId);
      return res.json({
        success: true,
        isGuest: true,
        user: { id: guest.userId, username: guest.username, avatar: null },
        survival: {
          hp: guest.hp,
          maxHp: guest.maxHp,
          stamina: guest.stamina,
          maxStamina: guest.maxStamina,
          starFragments: guest.starFragments,
          coins: guest.coins,
          survival_level: guest.survival_level,
          survival_xp: guest.survival_xp,
        },
        inventory: guest.inventory,
        location: "desa_sukamaju",
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // --- Real-time Atomic Gathering Action (Pine Wood, Mineral Ore, Fishing) ---
  router.post("/activity/gather", async (req, res) => {
    try {
      const { action, guestId } = req.body || {};
      const validActions = ["chop", "mine", "fish"];
      if (!action || !validActions.includes(action)) {
        return res.status(400).json({
          success: false,
          error: "Aksi gathering tidak valid. Pilih antara 'chop', 'mine', atau 'fish'.",
        });
      }

      const requestedUserId = req.body?.userId;
      if (requestedUserId && !String(requestedUserId).startsWith("guest_") && !req.user?.id) {
        return res.status(401).json({ success: false, error: "Masuk terlebih dahulu untuk melakukan aktivitas akun." });
      }
      if (requestedUserId && req.user?.id && String(requestedUserId) !== String(req.user.id) && !isOwner(req.user.id)) {
        return res.status(403).json({ success: false, error: "Akses aktivitas pemain lain ditolak." });
      }
      const activeUserId = req.user?.id || null;

      const STAMINA_COSTS = { chop: 12, mine: 15, fish: 10 };
      const cost = STAMINA_COSTS[action];

      const itemsGained = [];
      let xpGained = 0;
      let nsfGained = 0;
      let message = "";

      if (action === "chop") {
        const woodCount = Math.floor(Math.random() * 3) + 1;
        itemsGained.push({ id: "wood", name: "Kayu Pinus", amount: woodCount, type: "material" });
        if (Math.random() < 0.25) {
          itemsGained.push({ id: "fiber", name: "Serat Tumbuhan", amount: 1, type: "material" });
        }
        xpGained = 25;
        nsfGained = 15;
        message = `Tebasan mantap! Kamu berhasil memanen ${woodCount}x Kayu Pinus (+${nsfGained} NSF, +${xpGained} XP).`;
      } else if (action === "mine") {
        const stoneCount = Math.floor(Math.random() * 3) + 1;
        itemsGained.push({ id: "stone", name: "Batu Andesit", amount: stoneCount, type: "material" });
        const oreRoll = Math.random();
        if (oreRoll < 0.15) {
          itemsGained.push({ id: "iron_ore", name: "Bijih Besi Murni", amount: 1, type: "material" });
        } else if (oreRoll < 0.35) {
          itemsGained.push({ id: "copper_ore", name: "Bijih Tembaga", amount: 1, type: "material" });
        } else if (oreRoll < 0.50) {
          itemsGained.push({ id: "coal_lump", name: "Bongkahan Batubara", amount: 1, type: "material" });
        }
        xpGained = 35;
        nsfGained = 20;
        message = `Batu pecah! Kamu menambang ${stoneCount}x Batu dan mineral berharga (+${nsfGained} NSF, +${xpGained} XP).`;
      } else if (action === "fish") {
        const fishRoll = Math.random();
        if (fishRoll < 0.12) {
          itemsGained.push({ id: "golden_fish", name: "Ikan Mas Koki Bintang", amount: 1, type: "consumable" });
          nsfGained = 50;
          xpGained = 55;
          message = `Luar biasa! Kamu menangkap Ikan Mas Koki Bintang Langka di Kolam Bintang (+${nsfGained} NSF, +${xpGained} XP)!`;
        } else if (fishRoll < 0.50) {
          itemsGained.push({ id: "salmon", name: "Ikan Salmon Segar", amount: 1, type: "consumable" });
          nsfGained = 30;
          xpGained = 40;
          message = `Umpan disambar! Kamu menangkap 1x Ikan Salmon Segar (+${nsfGained} NSF, +${xpGained} XP).`;
        } else {
          itemsGained.push({ id: "fish", name: "Ikan Nila Kolam", amount: 2, type: "consumable" });
          nsfGained = 20;
          xpGained = 30;
          message = `Tarik joran! Kamu mendapatkan 2x Ikan Nila Kolam (+${nsfGained} NSF, +${xpGained} XP).`;
        }
      }

      if (activeUserId) {
        // Real authenticated DB mutation
        const survivalVitals = require("../../../src/survival/helpers/survivalVitals");
        const cacheManager = require("../../../src/managers/cacheManager");
        const { addItemsAtomic, safeParseInventory } = require("../../../src/survival/engines/inventoryHelper");
        const survivalLeveling = require("../../../src/survival/engines/survivalLeveling");

        const energyRes = await survivalVitals.consumeEnergyOrVitals(activeUserId, cost);
        if (!energyRes.ok) {
          return res.status(400).json({
            success: false,
            error: "Stamina tidak mencukupi untuk melakukan aktivitas ini! Istirahat sejenak atau minta berkah ke Pak Kades Tirto.",
          });
        }

        await addItemsAtomic(activeUserId, itemsGained);
        await cacheManager.incrementUserSurvival(activeUserId, "starFragments", nsfGained);
        await survivalLeveling.addPlayerXP(activeUserId, xpGained);
        try {
          const dailyQuestEngine = require("../../../src/survival/engines/dailyQuestEngine");
          await dailyQuestEngine.recordQuestProgress(activeUserId, action, 1);
        } catch (_) {}

        const [updatedSurvival, updatedProfile] = await Promise.all([
          cacheManager.getUserSurvival(activeUserId),
          cacheManager.getUserProfile(activeUserId),
        ]);

        return res.json({
          success: true,
          action,
          itemsGained,
          xpGained,
          starFragmentsGained: nsfGained,
          staminaRemaining: Number(updatedSurvival?.stamina ?? 0),
          survival: {
            hp: Number(updatedSurvival?.hp ?? 100),
            stamina: Number(updatedSurvival?.stamina ?? 0),
            starFragments: Number(updatedSurvival?.starFragments ?? 0),
            survival_level: Number(updatedSurvival?.survival_level ?? 1),
            survival_xp: Number(updatedSurvival?.survival_xp ?? 0),
          },
          inventory: safeParseInventory(updatedProfile?.inventory),
          message,
        });
      }

      // Guest mutation
      const guest = getOrCreateGuest(guestId || req.body?.userId);
      if (guest.stamina < cost) {
        return res.status(400).json({
          success: false,
          error: "Stamina petualang tamu habis! Minta berkah pemulihan ke Pak Kades Tirto yuk.",
        });
      }

      guest.stamina = Math.max(0, guest.stamina - cost);
      guest.starFragments += nsfGained;
      guest.survival_xp += xpGained;
      if (guest.survival_xp >= guest.survival_level * 100) {
        guest.survival_xp -= guest.survival_level * 100;
        guest.survival_level += 1;
      }

      for (const it of itemsGained) {
        const exist = guest.inventory.find((i) => i.id === it.id);
        if (exist) {
          exist.amount += it.amount;
        } else {
          guest.inventory.push({ ...it });
        }
      }

      return res.json({
        success: true,
        action,
        itemsGained,
        xpGained,
        starFragmentsGained: nsfGained,
        staminaRemaining: guest.stamina,
        survival: {
          hp: guest.hp,
          stamina: guest.stamina,
          starFragments: guest.starFragments,
          survival_level: guest.survival_level,
          survival_xp: guest.survival_xp,
        },
        inventory: guest.inventory,
        message,
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // --- Real-time Village NPC Interaction (Kades Tirto, Bagas, Mang Ujang) ---
  router.post("/activity/npc-interact", async (req, res) => {
    try {
      const { npcId, choice, guestId } = req.body || {};
      const requestedUserId = req.body?.userId;
      if (requestedUserId && !String(requestedUserId).startsWith("guest_") && !req.user?.id) {
        return res.status(401).json({ success: false, error: "Masuk terlebih dahulu untuk berinteraksi dengan NPC." });
      }
      if (requestedUserId && req.user?.id && String(requestedUserId) !== String(req.user.id) && !isOwner(req.user.id)) {
        return res.status(403).json({ success: false, error: "Akses interaksi pemain lain ditolak." });
      }
      const activeUserId = req.user?.id || null;

      const NPC_DATABASE = {
        kades_tirto: {
          id: "kades_tirto",
          name: "Pak Kades Tirto",
          title: "Kepala Desa Adisha",
          image: "/assets/survival/characters/kades_tirto.jpeg",
          defaultDialogue: "Selamat datang di Desa Adisha, Petualang! Desa kami subur dan aman. Di utara ada Hutan Pinus untuk kayu, di timur ada Bukit Tambang kaya mineral, dan di selatan ada Kolam Bintang tempat memancing yang menenangkan.",
          options: [
            { id: "blessing", label: "Minta Berkah Desa (+40 Stamina, +50 NSF)" },
            { id: "guide", label: "Panduan Wilayah & Sumber Daya" },
            { id: "close", label: "Pamit Melanjutkan Petualangan" },
          ],
        },
        bagas: {
          id: "bagas",
          name: "Bagas",
          title: "Pandai Besi Adisha",
          image: "/assets/survival/characters/bagas.jpeg",
          defaultDialogue: "Klang! Klang! Halo kawan! Aku Bagas, pandai besi desa. Butuh perkakas tangguh atau ingin mengasah kapak dan beliungmu? Api bengkelku selalu berkobar!",
          options: [
            { id: "starter_kit", label: "Minta Peralatan Tempa Dasar (Kapak & Beliung)" },
            { id: "repair", label: "Asah & Perbaiki Peralatan (20 NSF)" },
            { id: "close", label: "Pamit Dulu, Bagas" },
          ],
        },
        mang_ujang: {
          id: "mang_ujang",
          name: "Mang Ujang",
          title: "Nelayan Kolam Bintang",
          image: "/assets/survival/characters/mang_ujang.jpeg",
          defaultDialogue: "Semilir angin kolam memang paling sedap dinikmati sore hari. Ikan di Kolam Bintang ini jinak-jinak, asal sabar joranmu pasti disambar!",
          options: [
            { id: "fishing_kit", label: "Minta Pancingan Bambu Nelayan" },
            { id: "tips", label: "Tips Menangkap Golden Koi" },
            { id: "close", label: "Pamit Memancing" },
          ],
        },
        bu_yati: {
          id: "bu_yati",
          name: "Bu Yati",
          title: "Pemilik Warung Desa Adisha",
          image: "/assets/survival/characters/bu_yati.jpeg",
          defaultDialogue: "Ayo mampir dulu, Nak! Nasi hangat, sayur asem, dan teh manis baru matang. Makan yang kenyang supaya tenagamu pulih sebelum lanjut menjelajah Adisha.",
          options: [
            { id: "meal", label: "Santap Hidangan Warung (+30 Stamina)" },
            { id: "gossip", label: "Tanya Kabar Warga Desa" },
            { id: "close", label: "Terima Kasih, Bu Yati" },
          ],
        },
        kakek_danu: {
          id: "kakek_danu",
          name: "Kakek Danu",
          title: "Penjaga Rimba Dha Mhai",
          image: "/assets/survival/characters/kakek_danu.jpeg",
          defaultDialogue: "Pepohonan pinus dan rimba Dha Mhai menyimpan napas kuno Adisha. Tebanglah secukupnya, dan hutan akan memberimu kayu terbaik serta getah damar murni.",
          options: [
            { id: "forest_lore", label: "Dengarkan Petuah Hutan (+25 NSF)" },
            { id: "close", label: "Pamit Menjelajah Hutan" },
          ],
        },
        barista_chloe: {
          id: "barista_chloe",
          name: "Barista Laras & Chloe",
          title: "Kafe Siber Distrik Pratama",
          image: "/assets/core/avatar.png",
          defaultDialogue: "Selamat datang di Neo-Cyber Cafe Pratama! Mau pesan Espresso Aether dingin atau mencoba peruntungan Gacha dan Mesin Slot di pojok arkade?",
          options: [
            { id: "espresso", label: "Minum Espresso Aether (+25 Stamina)" },
            { id: "close", label: "Lanjut Keliling Kota" },
          ],
        },
        syeikh_malik: {
          id: "syeikh_malik",
          name: "Syeikh Malik",
          title: "Tetua Lembah Salju Khul'Khas",
          image: "/assets/core/avatar.png",
          defaultDialogue: "Angin puncak Khul'Khas memang membekukan tulang, namun kristal es di altar utara menyimpan ketenangan batin bagi siapa pun yang bermeditasi di dekatnya.",
          options: [
            { id: "meditate", label: "Meditasi Kristal Es (+30 NSF & +20 Stamina)" },
            { id: "close", label: "Turun dari Puncak Salju" },
          ],
        },
        draken_archivist: {
          id: "draken_archivist",
          name: "Profesor Arsip Draken",
          title: "Peneliti Kampus & Obelisk Hextech",
          image: "/assets/core/avatar.png",
          defaultDialogue: "Obelisk Hextech di Gerbang Selatan ini memancarkan resonansi kristal dari kawah tambang. Pelajari polanya untuk mempercepat pemahaman ekspedisimu.",
          options: [
            { id: "study_obelisk", label: "Pelajari Resonansi Obelisk (+35 NSF)" },
            { id: "close", label: "Kembali ke Lapangan" },
          ],
        },
      };

      const npc = NPC_DATABASE[npcId] || NPC_DATABASE.kades_tirto;
      let dialogue = npc.defaultDialogue;
      let reward = null;

      if (npcId === "kades_tirto") {
        if (choice === "blessing") {
          const BLESSING_COOLDOWN_MS = 3600000; // 1 Jam
          if (activeUserId) {
            const cacheManager = require("../../../src/managers/cacheManager");
            let blessingAllowed = true;
            let remainingMinutes = 0;
            await cacheManager.mutateUserSurvivalJson(activeUserId, "rpg_state", (state) => {
              const last = state.lastKadesBlessingAt || 0;
              const elapsed = Date.now() - last;
              if (elapsed < BLESSING_COOLDOWN_MS) {
                blessingAllowed = false;
                remainingMinutes = Math.ceil((BLESSING_COOLDOWN_MS - elapsed) / 60000);
                return state;
              }
              state.lastKadesBlessingAt = Date.now();
              return state;
            });

            if (!blessingAllowed) {
              return res.status(400).json({
                success: false,
                error: `Pak Kades Tirto: 'Kamu baru saja menerima berkah! Beristirahatlah sejenak dan kembalilah dalam ${remainingMinutes} menit.'`,
              });
            }

            const userSurv = await cacheManager.getUserSurvival(activeUserId);
            const currentStam = Number(userSurv?.stamina ?? 100);
            const stamDelta = Math.max(0, Math.min(40, 100 - currentStam));
            const deltas = { starFragments: 50, sukamajuCoins: 50 };
            if (stamDelta > 0) deltas.stamina = stamDelta;
            await cacheManager.incrementUserSurvival(activeUserId, deltas);
          } else {
            const guest = getOrCreateGuest(guestId || req.body?.userId);
            const now = Date.now();
            if (guest.lastBlessing && now - guest.lastBlessing < BLESSING_COOLDOWN_MS) {
              const remMin = Math.ceil((BLESSING_COOLDOWN_MS - (now - guest.lastBlessing)) / 60000);
              return res.status(400).json({
                success: false,
                error: `Pak Kades Tirto: 'Kamu baru saja menerima berkah! Beristirahatlah sejenak dan kembalilah dalam ${remMin} menit.'`,
              });
            }
            guest.lastBlessing = now;
            guest.stamina = Math.min(100, guest.stamina + 40);
            guest.starFragments += 50;
          }

          dialogue = "Pak Kades Tirto tersenyum hangat dan menepuk bahumu: 'Semoga leluhur Adisha memberkatimu dengan kesegaran tubuh dan kelimpahan bintang hari ini!' (+40 Stamina & +50 Koin Adisha)";
          reward = { stamina: 40, starFragments: 50 };
        } else if (choice === "guide") {
          dialogue = "Pak Kades Tirto: 'Peta Adisha terhubung tanpa sekat. Berjalanlah ke utara melewati pohon pinus, tambang batu di timur laut, dan segarkan diri di kolam dermaga selatan. Jangan ragu menyapa warga lain di voice channel!'";
        }
      } else if (npcId === "bagas") {
        if (choice === "starter_kit") {
          const starterTools = [
            { id: "wooden_axe", name: "Kapak Kayu", amount: 1, type: "tool" },
            { id: "wooden_pickaxe", name: "Beliung Kayu", amount: 1, type: "tool" },
          ];

          if (activeUserId) {
            const cacheManager = require("../../../src/managers/cacheManager");
            let claimAllowed = true;
            await cacheManager.mutateUserSurvivalJson(activeUserId, "rpg_state", (state) => {
              if (state.claimedStarterKit) {
                claimAllowed = false;
                return state;
              }
              state.claimedStarterKit = true;
              return state;
            });

            if (!claimAllowed) {
              return res.status(400).json({
                success: false,
                error: "Bagas: 'Hei, kamu sudah pernah mengambil paket peralatan pemula! Gunakan yang ada atau tempa yang baru di bengkel.'",
              });
            }

            const { addItemsAtomic } = require("../../../src/survival/engines/inventoryHelper");
            await addItemsAtomic(activeUserId, starterTools);
          } else {
            const guest = getOrCreateGuest(guestId || req.body?.userId);
            if (guest.claimedStarterKit) {
              return res.status(400).json({
                success: false,
                error: "Bagas: 'Hei, kamu sudah pernah mengambil paket peralatan pemula! Gunakan yang ada atau tempa yang baru di bengkel.'",
              });
            }
            guest.claimedStarterKit = true;
            for (const t of starterTools) {
              if (!guest.inventory.some((i) => i.id === t.id)) {
                guest.inventory.push({ ...t });
              }
            }
          }

          dialogue = "Bagas menyerahkan Kapak dan Beliung: 'Ini dia modal pertamamu! Pakai dengan bijak untuk memajukan perekonomian Adisha!'";
          reward = { items: starterTools };
        } else if (choice === "repair") {
          dialogue = "Bagas mengayunkan palunya: 'Klang! Selesai! Seluruh perkakasmu kini tajam kembali dan siap bekerja keras!'";
          reward = { repaired: true };
        }
      } else if (npcId === "mang_ujang") {
        if (choice === "fishing_kit") {
          const rodItem = [{ id: "bamboo_fishing_rod", name: "Pancingan Bambu", amount: 1, type: "tool" }];

          if (activeUserId) {
            const cacheManager = require("../../../src/managers/cacheManager");
            let claimAllowed = true;
            await cacheManager.mutateUserSurvivalJson(activeUserId, "rpg_state", (state) => {
              if (state.claimedFishingKit) {
                claimAllowed = false;
                return state;
              }
              state.claimedFishingKit = true;
              return state;
            });

            if (!claimAllowed) {
              return res.status(400).json({
                success: false,
                error: "Mang Ujang: 'Kamu sudah punya pancingan bambu dari paman! Rawat baik-baik ya.'",
              });
            }

            const { addItemsAtomic } = require("../../../src/survival/engines/inventoryHelper");
            await addItemsAtomic(activeUserId, rodItem);
          } else {
            const guest = getOrCreateGuest(guestId || req.body?.userId);
            if (guest.claimedFishingKit) {
              return res.status(400).json({
                success: false,
                error: "Mang Ujang: 'Kamu sudah punya pancingan bambu dari paman! Rawat baik-baik ya.'",
              });
            }
            guest.claimedFishingKit = true;
            if (!guest.inventory.some((i) => i.id === "bamboo_fishing_rod")) {
              guest.inventory.push(rodItem[0]);
            }
          }

          dialogue = "Mang Ujang memberikan joran bambu: 'Ini pancingan bambu buat kamu. Pegang erat-erat saat joran melengkung ya!'";
          reward = { items: rodItem };
        } else if (choice === "tips") {
          dialogue = "Mang Ujang: 'Ikan Mas Koki Bintang suka berenang di dekat dermaga saat riak air tenang. Perhatikan lingkaran cahaya air dan lempar kailmu ke sana!'";
        }
      } else if (npcId === "bu_yati") {
        if (choice === "meal") {
          dialogue = "Bu Yati menyajikan sepiring nasi hangat dan teh manis: 'Makan pelan-pelan ya, Nak. Semoga staminamu pulih kembali!' (+30 Stamina)";
          reward = { stamina: 30 };
        } else if (choice === "gossip") {
          dialogue = "Bu Yati: 'Katanya di puncak utara Khul'Khas sedang turun salju abadi, sedangkan anak-anak muda di Barat Daya sibuk nongkrong di Neo-Cyber Cafe Pratama!'";
        }
      } else if (npcId === "kakek_danu") {
        if (choice === "forest_lore") {
          dialogue = "Kakek Danu menyerahkan kantung kecil berisi kristal: 'Terima kasih sudah menjaga kelestarian pohon pinus Adisha. Ini sedikit bekal untukmu.' (+25 NSF)";
          reward = { starFragments: 25 };
        }
      } else if (npcId === "barista_chloe") {
        if (choice === "espresso") {
          dialogue = "Barista menyajikan secangkir Espresso Aether hangat: 'Aroma biji kopi pegunungan Adisha siap menyegarkan fokusmu!' (+25 Stamina)";
          reward = { stamina: 25 };
        }
      } else if (npcId === "syeikh_malik") {
        if (choice === "meditate") {
          dialogue = "Syeikh Malik mengangguk tenang saat kamu bermeditasi di depan Altar Es: 'Pikiran yang jernih membawa langkah yang ringan.' (+30 NSF & +20 Stamina)";
          reward = { stamina: 20, starFragments: 30 };
        }
      } else if (npcId === "draken_archivist") {
        if (choice === "study_obelisk") {
          dialogue = "Profesor Arsip Draken mencatat hasil pengamatanmu: 'Data resonansi Hextech ini sangat berharga! Terimalah insentif riset kampus ini.' (+35 NSF)";
          reward = { starFragments: 35 };
        }
      }

      return res.json({
        success: true,
        npc,
        dialogue,
        options: npc.options,
        reward,
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // --- 4. Spatial Audio & Positioning ---
  router.get("/activity/spatial-proximity", requireApiLogin, async (req, res) => {
    try {
      const landEngine = require("../../../src/survival/engines/landEngine");
      const guildId = req.query.guildId || "default_guild";
      const requestedUserId = req.query.userId;
      if (requestedUserId && String(requestedUserId) !== String(req.user.id) && !isOwner(req.user.id)) {
        return res.status(403).json({ success: false, error: "Akses posisi pemain lain ditolak." });
      }
      const userId = isOwner(req.user.id) && requestedUserId ? String(requestedUserId) : req.user.id;

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

      const requestedUserId = req.body?.userId;
      if (requestedUserId && !String(requestedUserId).startsWith("guest_") && !req.user?.id) {
        return res.status(401).json({ success: false, error: "Masuk terlebih dahulu untuk memperbarui posisi akun." });
      }
      if (requestedUserId && req.user?.id && String(requestedUserId) !== String(req.user.id) && !isOwner(req.user.id)) {
        return res.status(403).json({ success: false, error: "Akses posisi pemain lain ditolak." });
      }
      const userId = req.user?.id ||
        (requestedUserId
          ? `guest_${String(requestedUserId).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32)}`
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
  router.get("/realtime/survival", requireApiLogin, async (req, res) => {
    try {
      const UserSurvival = require("../../../src/models/UserSurvival");
      const userIsOwner = req.user?.id ? isOwner(req.user.id) : false;
      const requestedUserId = req.query.userId;
      if (requestedUserId && !isOwner(req.user.id) && String(requestedUserId) !== String(req.user.id)) {
        return res.status(403).json({ success: false, error: "Akses data survival pemain lain ditolak." });
      }
      const currentUserId =
        userIsOwner && req.query.userId
          ? String(req.query.userId)
          : req.user.id;
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

      const survivors = await UserSurvival.findAll(
        userIsOwner
          ? { limit: 10, order: [["updatedAt", "DESC"]] }
          : { where: { userId: req.user.id }, limit: 1 },
      );
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
  router.get("/activity/stream", requireApiLogin, (req, res) => {
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
