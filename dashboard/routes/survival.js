"use strict";

/**
 * dashboard/routes/survival.js - Router Tactical War Room & Survival Territory
 *
 * Mengelola endpoint API untuk 8x8 Land Grid, Relic Towers, dan World Boss Tracker.
 */

const express = require("express");
const { logger } = require("../../src/managers/logger");
const { isOwner } = require("../middleware/auth");

let landEngine = null;
try {
  landEngine = require("../../src/survival/engines/landEngine");
} catch (e) {
  logger.warn(`[Survival Route] landEngine gagal dimuat: ${e.message}`);
}

let guildFederationEngine = null;
try {
  guildFederationEngine = require("../../src/survival/engines/guildFederationEngine");
} catch (e) {
  logger.warn(`[Survival Route] guildFederationEngine gagal dimuat: ${e.message}`);
}

let worldBossEngine = null;
try {
  worldBossEngine = require("../../src/survival/engines/worldBossEngine");
} catch (e) {
  logger.warn(`[Survival Route] worldBossEngine gagal dimuat: ${e.message}`);
}

// Simulasi data kapling default 8x8
const TERRAIN_TYPES = ["Plains", "Forest", "Mountain", "Crystal Mine", "Ruins", "Lake Coast"];
const DEFAULT_PLOTS = {};

// Inisialisasi beberapa kapling yang dikuasai klan terkenal untuk demonstrasi
DEFAULT_PLOTS["3,3"] = {
  x: 3, y: 3,
  clanId: "clan_cyber_knights",
  clanName: "Cyber Knights",
  clanTag: "CYBER",
  color: "#38bdf8",
  terrain: "Crystal Mine",
  structure: { type: "castle", tier: 2, name: "Iron Fortress" },
  defensePower: 850,
  buffs: ["+15% Star Fragment Mining", "+10% Defense Barrier"],
  claimedAt: Date.now() - 86400000 * 3,
};
DEFAULT_PLOTS["4,4"] = {
  x: 4, y: 4,
  clanId: "clan_hoshino_vanguard",
  clanName: "Hoshino Vanguard",
  clanTag: "STAR",
  color: "#f472b6",
  terrain: "Ruins",
  structure: { type: "castle", tier: 3, name: "Cyber Citadel" },
  defensePower: 1420,
  buffs: ["+25% EXP Multiplier", "+20% Sanctuary Shield"],
  claimedAt: Date.now() - 86400000 * 5,
};
DEFAULT_PLOTS["5,3"] = {
  x: 5, y: 3,
  clanId: "clan_abyssal_legion",
  clanName: "Abyssal Legion",
  clanTag: "VOID",
  color: "#a855f7",
  terrain: "Mountain",
  structure: { type: "castle", tier: 2, name: "Iron Fortress" },
  defensePower: 920,
  buffs: ["+20% Raid Damage", "+10% Critical Strike"],
  claimedAt: Date.now() - 86400000 * 2,
};
DEFAULT_PLOTS["6,5"] = {
  x: 6, y: 5,
  clanId: "clan_emerald_dawn",
  clanName: "Emerald Dawn",
  clanTag: "MOSS",
  color: "#34d399",
  terrain: "Forest",
  structure: { type: "castle", tier: 1, name: "Frontier Outpost" },
  defensePower: 450,
  buffs: ["+15% Farm Yield", "+10% Stamina Regen"],
  claimedAt: Date.now() - 86400000 * 1,
};

const COMBAT_LOGS = [
  { id: 1, text: "⚔️ Klan Cyber Knights berhasil memperkuat Menara Pertahanan di Sektor (3,3).", time: "5 menit lalu", type: "defense" },
  { id: 2, text: "🏰 Hoshino Vanguard membuka riset Astral Observatory di Kapling Pusat (4,4).", time: "18 menit lalu", type: "upgrade" },
  { id: 3, text: "🚨 Aliansi Starfall melancarkan serangan ke Menara Relik Kuno Barat!", time: "42 menit lalu", type: "war" },
  { id: 4, text: "🌲 Klan Emerald Dawn berhasil mengklaim kapling subur di Sektor Hutan (6,5).", time: "2 jam lalu", type: "claim" },
];

module.exports = () => {
  const router = express.Router();

  // Default timeout untuk survival route
  router.use((req, res, next) => {
    req.timeoutMs = 30000;
    next();
  });

  // ------------------------------------------------------------------
  // 0. Profil Karakter Survival (Mobile & Web Dashboard)
  // ------------------------------------------------------------------
  router.get("/profile", async (req, res) => {
    if (typeof req.isAuthenticated !== "function" || !req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    try {
      const cacheManager = require("../../src/managers/cacheManager");
      const [profile, survival] = await Promise.all([
        cacheManager.getUserProfile(req.user.id),
        cacheManager.getUserSurvival(req.user.id),
      ]);
      let weather = "sunny";
      try {
        const seasonEngine = require("../../src/services/seasonEngine");
        weather = seasonEngine.getCurrentWeather?.()?.id || "sunny";
      } catch (_) {}

      return res.json({
        success: true,
        health: Number(survival?.health ?? 100),
        hunger: Number(survival?.hunger ?? 100),
        stamina: Number(survival?.stamina ?? 100),
        starFragments: Number(survival?.starFragments ?? 0),
        wallet: Number(profile?.economy_wallet ?? 0),
        coupons: Number(survival?.coupons ?? 0),
        level: Number(survival?.survival_level || survival?.level || 1),
        xp: Number(survival?.survival_xp || survival?.xp || 0),
        weather,
        inventory: Array.isArray(survival?.inventory) ? survival.inventory : [],
        activeQuest: survival?.activeQuest || null,
      });
    } catch (err) {
      logger.error("[API Survival Profile] Error:", err);
      return res.status(500).json({ error: "Gagal memuat profil survival." });
    }
  });

  // ------------------------------------------------------------------
  // 1. Matriks 8x8 Land Grid
  // ------------------------------------------------------------------
  router.get("/territory/grid", async (req, res) => {
    try {
      const guildId = req.query.guildId || "default";
      let liveData = { plots: {} };
      if (landEngine && typeof landEngine.getGuildLand === "function") {
        liveData = await landEngine.getGuildLand(guildId);
      }

      const dbPlots = {};
      try {
        const ClanTerritory = require("../../src/models/ClanTerritory");
        const territories = await ClanTerritory.findAll();
        if (territories && territories.length > 0) {
          territories.forEach((t, i) => {
            const x = (i % 6) + 2;
            const y = Math.floor(i / 6) + 2;
            const key = `${x},${y}`;
            dbPlots[key] = {
              x,
              y,
              clanId: t.clanId ? `clan_${t.clanId}` : "neutral",
              clanName: t.clanName || "Klan Teritorial",
              clanTag: (t.clanName || "TERR").slice(0, 4).toUpperCase(),
              color: "#38bdf8",
              terrain: t.name || "Sektor Strategis",
              structure: { type: "castle", tier: t.defenseLevel || 1, name: t.name },
              defensePower: t.controlPoints || 500,
              buffs: [t.buffEffect || "+10% Sektor Yield"],
              claimedAt: t.updatedAt ? new Date(t.updatedAt).getTime() : Date.now(),
            };
          });
        }
      } catch (_) {}

      const mergedPlots = { ...DEFAULT_PLOTS, ...dbPlots, ...(liveData.plots || {}) };
      const grid = [];

      for (let y = 1; y <= 8; y++) {
        const row = [];
        for (let x = 1; x <= 8; x++) {
          const key = `${x},${y}`;
          const existing = mergedPlots[key];
          if (existing) {
            row.push({
              x, y,
              isClaimed: true,
              ...existing,
            });
          } else {
            const terrainIdx = (x * 3 + y * 7) % TERRAIN_TYPES.length;
            row.push({
              x, y,
              isClaimed: false,
              terrain: TERRAIN_TYPES[terrainIdx],
              claimCost: 1000,
              potentialBuff: "+10% Resource Yield",
            });
          }
        }
        grid.push(row);
      }

      return res.json({
        success: true,
        gridSize: 8,
        totalPlots: 64,
        claimedCount: Object.keys(mergedPlots).length,
        grid,
      });
    } catch (err) {
      logger.warn(`[Survival Route] Gagal memuat territory grid: ${err.message}`);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // ------------------------------------------------------------------
  // 2. Status Menara Relik Kuno (Ancient Relic Towers)
  // ------------------------------------------------------------------
  router.get("/territory/towers", (req, res) => {
    try {
      if (guildFederationEngine && typeof guildFederationEngine.getRelicTowers === "function") {
        const rawTowers = guildFederationEngine.getRelicTowers();
        if (Array.isArray(rawTowers) && rawTowers.length > 0) {
          const enrichedTowers = rawTowers.map((t) => {
            const defensePercent = Math.round(((t.defenseHp || 0) / (t.maxHp || 1)) * 100);
            const isClaimed = !!t.controllerFedId && t.controllerFedTag !== "UNCLAIMED";
            return {
              ...t,
              region: t.zone || t.region || "Sukamaju Highlands",
              controllerFedName: isClaimed ? `Aliansi [${t.controllerFedTag}]` : "Diperebutkan (Netral)",
              controlPercent: isClaimed ? Math.max(35, defensePercent) : Math.max(15, 100 - defensePercent),
              weeklyDividends: t.weeklyDividends || "15.000 NSF & 50 Kupon",
              buff: t.buffDescription || t.buff || "+20% Territory Bonus",
            };
          });
          return res.json({ success: true, towers: enrichedTowers });
        }
      }
    } catch (err) {
      logger.warn(`[Survival Route] Gagal memuat relic towers: ${err.message}`);
    }

    // Default 4 Ancient Relic Towers
    const fallbackTowers = [
      {
        towerId: "relic_north_citadel",
        name: "Menara Relik Surya Kuno (Utara)",
        region: "Sukamaju Highlands",
        maxHp: 5000,
        defenseHp: 3800,
        controlPercent: 76,
        controllerFedId: "fed_starfall",
        controllerFedName: "Starfall Alliance",
        weeklyDividends: "15.000 NSF & 50 Kupon",
        buff: "+20% EXP Seluruh Anggota Aliansi",
      },
      {
        towerId: "relic_west_bastion",
        name: "Benteng Kristal Abyss (Barat)",
        region: "Khul'Khas Ravine",
        maxHp: 5000,
        defenseHp: 4400,
        controlPercent: 88,
        controllerFedId: "fed_abyssal",
        controllerFedName: "Abyssal Covenant",
        weeklyDividends: "20.000 NSF & 65 Kupon",
        buff: "+15% Serangan Boss & Durability Shield",
      },
      {
        towerId: "relic_east_spire",
        name: "Kubah Badai Petir (Timur)",
        region: "Pratama Metro Outskirts",
        maxHp: 5000,
        defenseHp: 2100,
        controlPercent: 42,
        controllerFedId: null,
        controllerFedName: "Diperebutkan (Netral)",
        weeklyDividends: "12.500 NSF & 40 Kupon",
        buff: "+10% Kecepatan Crafting & Diskon Kafe",
      },
      {
        towerId: "relic_south_sanctuary",
        name: "Kuil Perlindungan Bintang (Selatan)",
        region: "Draken Palace Frontier",
        maxHp: 5000,
        defenseHp: 4900,
        controlPercent: 98,
        controllerFedId: "fed_starfall",
        controllerFedName: "Starfall Alliance",
        weeklyDividends: "25.000 NSF & 80 Kupon",
        buff: "+25% Vital Regeneration Rate",
      },
    ];

    return res.json({ success: true, towers: fallbackTowers });
  });

  // ------------------------------------------------------------------
  // 3. Status World Boss Aktif & Raid Tracker
  // ------------------------------------------------------------------
  router.get("/world-boss/active", async (req, res) => {
    try {
      if (worldBossEngine && typeof worldBossEngine.getActiveBoss === "function") {
        const boss = await worldBossEngine.getActiveBoss();
        if (boss) {
          const hpPercent = Math.max(0, Math.min(100, Math.round(((boss.currentHp || 0) / (boss.maxHp || 1)) * 100)));
          const maxShieldHp = boss.maxShieldHp || (boss.maxHp ? Math.floor(boss.maxHp * 0.25) : 1);
          const shieldHp = boss.shieldHp || 0;
          const shieldPercent = Math.max(0, Math.min(100, Math.round((shieldHp / maxShieldHp) * 100)));
          const expiryTime = boss.endTime || boss.expiresAt;
          const remainingMinutes = expiryTime
            ? Math.max(0, Math.round((new Date(expiryTime).getTime() - Date.now()) / 60000))
            : 42;
          const elemColors = {
            WATER: "#38bdf8",
            FIRE: "#ef4444",
            DARK: "#a855f7",
            HOLY: "#f59e0b",
            LIGHTNING: "#eab308",
          };
          return res.json({
            success: true,
            boss: {
              ...boss,
              title: boss.title || "Ancient Calamity",
              elementColor: elemColors[boss.element] || "#38bdf8",
              maxShieldHp,
              shieldHp,
              hpPercent,
              shieldPercent,
              remainingMinutes: remainingMinutes || 42,
            },
          });
        }
      }
    } catch (err) {
      logger.warn(`[Survival Route] Gagal memuat world boss: ${err.message}`);
    }

    // Default World Boss State
    const defaultBoss = {
      bossId: "wb_abyssal_leviathan_01",
      name: "Abyssal Leviathan Lord",
      title: "Penguasa Samudra Kehampaan",
      element: "WATER",
      elementColor: "#38bdf8",
      phase: 2,
      maxHp: 1000000,
      currentHp: 642000,
      hpPercent: 64.2,
      shieldHp: 85000,
      maxShieldHp: 250000,
      shieldPercent: 34,
      expiresAt: new Date(Date.now() + 42 * 60 * 1000).toISOString(),
      remainingMinutes: 42,
      rewardsPool: {
        starFragments: 25000,
        coupons: 120,
        exclusiveTitle: "Leviathan Vanquisher",
      },
      participantsCount: 38,
      topContributors: [
        { rank: 1, name: "Sensei_Kivotos", damage: 184500, percent: 18.4, role: "DPS Utama" },
        { rank: 2, name: "Arona_Tactics", damage: 142300, percent: 14.2, role: "Burst Mage" },
        { rank: 3, name: "Hoshino_Shield", damage: 105800, percent: 10.5, role: "Tank / Breaker" },
        { rank: 4, name: "Draken_Ranger", damage: 88400, percent: 8.8, role: "DPS" },
        { rank: 5, name: "Cyber_Sniper", damage: 71200, percent: 7.1, role: "Support Buff" },
      ],
    };

    return res.json({ success: true, boss: defaultBoss });
  });

  // ------------------------------------------------------------------
  // 4. Log Pertempuran & Klaim Wilayah Real-time
  // ------------------------------------------------------------------
  router.get("/territory/logs", (req, res) => {
    return res.json({ success: true, logs: COMBAT_LOGS });
  });

  // ------------------------------------------------------------------
  // 5. Klaim Kapling Tanah (Interactive Sandbox / Live)
  // ------------------------------------------------------------------
  router.post("/territory/claim", async (req, res) => {
    try {
      const { x, y, clanName, clanTag } = req.body || {};
      const parsedX = parseInt(x, 10);
      const parsedY = parseInt(y, 10);

      if (!parsedX || !parsedY || parsedX < 1 || parsedX > 8 || parsedY < 1 || parsedY > 8) {
        return res.status(400).json({ success: false, error: "Koordinat kapling harus berada dalam rentang 1 s/d 8." });
      }

      const key = `${parsedX},${parsedY}`;
      if (DEFAULT_PLOTS[key]) {
        return res.status(400).json({ success: false, error: `Kapling (${parsedX}, ${parsedY}) sudah dikuasai oleh ${DEFAULT_PLOTS[key].clanName}.` });
      }

      const isAuth = typeof req.isAuthenticated === "function" && req.isAuthenticated() && req.user;
      let resolvedClanName = "Sensei Brigade";
      let resolvedClanTag = "VIP";
      let resolvedClanId = `clan_sandbox_${Date.now()}`;

      if (isAuth) {
        try {
          const UserSurvival = require("../../src/models/UserSurvival");
          const GuildClan = require("../../src/models/GuildClan");
          const userSurv = await UserSurvival.findOne({ where: { userId: req.user.id } });
          if (userSurv && userSurv.clanId) {
            const realClan = await GuildClan.findByPk(userSurv.clanId);
            if (realClan) {
              resolvedClanId = String(realClan.id);
              resolvedClanName = realClan.name;
              resolvedClanTag = realClan.tag || "CLN";
            }
          } else if (clanName && isOwner(req.user.id)) {
            resolvedClanName = String(clanName).slice(0, 32);
            resolvedClanTag = String(clanTag || "OWN").slice(0, 5);
          }
        } catch (_) {}
      } else {
        resolvedClanName = clanName ? String(clanName).slice(0, 32) : "Sensei Brigade (Demo)";
        resolvedClanTag = clanTag ? String(clanTag).slice(0, 5) : "DEMO";
      }

      const newPlot = {
        x: parsedX,
        y: parsedY,
        clanId: resolvedClanId,
        clanName: resolvedClanName,
        clanTag: resolvedClanTag,
        color: "#fbbf24",
        terrain: "Plains",
        structure: { type: "castle", tier: 1, name: "Frontier Outpost" },
        defensePower: 500,
        buffs: ["+10% Sukamaju Koin (SC) Yield", "+5% Fortress Shield"],
        claimedAt: Date.now(),
      };

      DEFAULT_PLOTS[key] = newPlot;
      COMBAT_LOGS.unshift({
        id: Date.now(),
        text: `🏰 ${newPlot.clanName} berhasil mengklaim kapling strategis baru di Koordinat (${parsedX}, ${parsedY})!`,
        time: "Baru saja",
        type: "claim",
      });

      return res.json({
        success: true,
        message: `Berhasil mengklaim kapling (${parsedX}, ${parsedY}) untuk klan ${newPlot.clanName}!`,
        plot: newPlot,
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // ------------------------------------------------------------------
  // 6. Endpoint Peta Dunia Adisha & Roam Interaktif
  // ------------------------------------------------------------------
  const {
    ADISHA_REGIONS,
    ADISHA_VEHICLES,
    getVehicleInfo,
    calculateResaleValue,
    canAccessArea,
    calculateRoamCost,
    evaluateWorkEligibility,
  } = require("../../src/survival/data/adishaWorldData");
  const cacheManager = require("../../src/managers/cacheManager");
  const { getTimeState } = require("../../src/survival/helpers/survivalTime");

  // Helper untuk membaca / menginisialisasi status pemain
  async function resolvePlayerSurvivalState(req) {
    const isAuth = typeof req.isAuthenticated === "function" && req.isAuthenticated() && req.user;
    if (isAuth) {
      try {
        const [survival, profile] = await Promise.all([
          cacheManager.getUserSurvival(req.user.id),
          cacheManager.getUserProfile(req.user.id),
        ]);
        const currentAreaId = survival.currentLocation || "desa_sukamaju";
        const currentLocId = survival.currentSubLocation || "warung";
        const vehicleId = survival.vehicle || null;
        return {
          isLoggedIn: true,
          userId: req.user.id,
          displayName: req.user.username || req.user.displayName || "Petualang",
          avatar: req.user.avatar
            ? `https://cdn.discordapp.com/avatars/${req.user.id}/${req.user.avatar}.png`
            : "/assets/core/avatar.png",
          currentAreaId,
          currentLocationId: currentLocId,
          vehicle: vehicleId,
          activeVehicle: getVehicleInfo(vehicleId),
          hp: Number(survival.hp ?? 100),
          stamina: Number(survival.stamina ?? 85),
          hunger: Number(survival.hunger ?? 80),
          thirst: Number(survival.thirst ?? 80),
          sukamajuCoins: Number(survival.sukamajuCoins || survival.starFragments || 0),
          pratamaDollars: Number(profile?.pratamaDollars || profile?.coins || profile?.balance || 0),
          scholarshipVouchers: Number(survival.scholarshipVouchers || survival.coupons || 0),
          stats: {
            strength: Number(survival.strength || 5),
            intelligence: Number(survival.intelligence || 6),
            agility: Number(survival.agility || 5),
            charisma: Number(survival.charisma || 7),
            luck: Number(survival.luck || 5),
          },
        };
      } catch (err) {
        logger.warn(`[AdishaMap] Gagal mengambil data user live: ${err.message}`);
      }
    }

    // Fallback Guest Session
    if (!req.session.guestSurvival) {
      req.session.guestSurvival = {
        isLoggedIn: false,
        userId: "guest_adventurer",
        displayName: "Guest Adventurer",
        avatar: "/assets/core/avatar.png",
        currentAreaId: "desa_sukamaju",
        currentLocationId: "warung",
        vehicle: null,
        hp: 100,
        stamina: 85,
        hunger: 80,
        thirst: 80,
        sukamajuCoins: 350,
        pratamaDollars: 120,
        scholarshipVouchers: 2,
        stats: {
          strength: 7,
          intelligence: 8,
          agility: 6,
          charisma: 7,
          luck: 5,
        },
      };
    }
    const guestState = req.session.guestSurvival;
    return {
      ...guestState,
      activeVehicle: getVehicleInfo(guestState.vehicle),
    };
  }

  // 6.1 Data Peta Dunia Adisha Lengkap
  router.get("/world/adisha-map", (req, res) => {
    try {
      const now = new Date();
      const inGameHour = Math.floor((now.getHours() * 60 + now.getMinutes()) / 60);
      const timeState = getTimeState(inGameHour);

      return res.json({
        success: true,
        worldName: "Benua Adisha",
        tagline: "Ekosistem Kehidupan & Petualangan Naura Wilds",
        inGameHour,
        timeState,
        regions: ADISHA_REGIONS,
        vehicles: ADISHA_VEHICLES,
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 6.2 Status & Vitalitas Pemain
  router.get("/world/player-status", async (req, res) => {
    try {
      const player = await resolvePlayerSurvivalState(req);
      return res.json({ success: true, player });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 6.3 Berpindah Tempat (Roam)
  router.post("/world/roam", async (req, res) => {
    try {
      const { targetAreaId, targetLocationId } = req.body || {};
      if (!targetAreaId || !targetLocationId) {
        return res.status(400).json({ success: false, error: "Target wilayah dan sub-lokasi wajib diisi." });
      }

      const area = ADISHA_REGIONS[targetAreaId];
      if (!area) {
        return res.status(404).json({ success: false, error: `Wilayah ${targetAreaId} tidak ditemukan.` });
      }

      const location = area.locations?.[targetLocationId];
      if (!location) {
        return res.status(404).json({ success: false, error: `Sub-lokasi ${targetLocationId} tidak ditemukan di wilayah ini.` });
      }

      const player = await resolvePlayerSurvivalState(req);

      // Cek izin akses wilayah (Kawasan Tambang Raksasa wajib kendaraan)
      const accessCheck = canAccessArea(targetAreaId, player.vehicle);
      if (!accessCheck.canAccess) {
        return res.status(403).json({
          success: false,
          error: accessCheck.reason,
          requiresVehicle: true,
        });
      }

      const roamCost = calculateRoamCost(player.currentAreaId, targetAreaId, targetLocationId, player.vehicle);

      if (player.stamina < roamCost) {
        return res.status(400).json({
          success: false,
          error: `Stamina tidak mencukupi untuk menjelajah ke ${location.name}. Butuh ${roamCost} Stamina, sisa staminamu ${player.stamina}.`,
        });
      }

      const newStamina = Math.max(0, player.stamina - roamCost);

      if (player.isLoggedIn) {
        await cacheManager.updateUserSurvival(player.userId, {
          stamina: newStamina,
          currentLocation: targetAreaId,
          currentSubLocation: targetLocationId,
        });
      } else {
        req.session.guestSurvival.stamina = newStamina;
        req.session.guestSurvival.currentAreaId = targetAreaId;
        req.session.guestSurvival.currentLocationId = targetLocationId;
      }

      const isCrossRegion = player.currentAreaId !== targetAreaId;
      const vehicleBonusText = player.activeVehicle
        ? ` Mengendarai ${player.activeVehicle.name} (diskon stamina aktif).`
        : "";
      const message = isCrossRegion
        ? `Kamu menempuh perjalanan jauh dan tiba di ${location.name} (${area.name})! Terpakai ${roamCost} Stamina.${vehicleBonusText}`
        : `Kamu melangkah santai dan sampai di ${location.name}. Terpakai ${roamCost} Stamina.${vehicleBonusText}`;

      return res.json({
        success: true,
        message,
        roamCost,
        currentAreaId: targetAreaId,
        currentLocationId: targetLocationId,
        newStamina,
        location,
        vehicleUsed: player.activeVehicle?.name || null,
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 6.4 Bekerja di Sub-Lokasi
  router.post("/world/work", async (req, res) => {
    try {
      const { areaId, locationId } = req.body || {};
      const area = ADISHA_REGIONS[areaId];
      if (!area) return res.status(404).json({ success: false, error: "Wilayah tidak ditemukan." });

      const location = area.locations?.[locationId];
      if (!location || !location.workAvailable) {
        return res.status(400).json({ success: false, error: "Tidak ada lowongan pekerjaan di tempat ini." });
      }

      const player = await resolvePlayerSurvivalState(req);

      // Cek kelayakan statistik
      const eligibility = evaluateWorkEligibility(location, player.stats);
      if (!eligibility.canWork) {
        return res.status(400).json({
          success: false,
          error: `Syarat fisik belum terpenuhi untuk pekerjaan ini: ${eligibility.missing.join(", ")}.`,
          missing: eligibility.missing,
        });
      }

      const workStaminaCost = 10;
      if (player.stamina < workStaminaCost) {
        return res.status(400).json({
          success: false,
          error: `Stamina kamu terlalu lelah untuk bekerja. Butuh ${workStaminaCost} Stamina, sisa ${player.stamina}.`,
        });
      }

      const reward = location.workReward || { currency: "SC", amount: 30, exp: 5 };
      const newStamina = Math.max(0, player.stamina - workStaminaCost);
      let newBalance = 0;

      if (player.isLoggedIn) {
        await cacheManager.updateUserSurvival(player.userId, { stamina: newStamina });
        if (reward.currency === "SC") {
          await cacheManager.incrementUserSurvival(player.userId, { sukamajuCoins: reward.amount });
          const fresh = await cacheManager.getUserSurvival(player.userId);
          newBalance = fresh.sukamajuCoins || fresh.starFragments || 0;
        } else if (reward.currency === "PD") {
          await cacheManager.incrementUserProfile(player.userId, { pratamaDollars: reward.amount });
          const fresh = await cacheManager.getUserProfile(player.userId);
          newBalance = fresh.pratamaDollars || fresh.coins || 0;
        } else if (reward.currency === "VB") {
          await cacheManager.incrementUserSurvival(player.userId, { scholarshipVouchers: reward.amount });
          const fresh = await cacheManager.getUserSurvival(player.userId);
          newBalance = fresh.scholarshipVouchers || fresh.coupons || 0;
        }
        try {
          const leveling = require("../../src/survival/engines/survivalLeveling");
          await leveling.addPlayerXP(player.userId, reward.exp || 5);
        } catch (_) {}
      } else {
        req.session.guestSurvival.stamina = newStamina;
        if (reward.currency === "SC") {
          req.session.guestSurvival.sukamajuCoins += reward.amount;
          newBalance = req.session.guestSurvival.sukamajuCoins;
        } else if (reward.currency === "PD") {
          req.session.guestSurvival.pratamaDollars += reward.amount;
          newBalance = req.session.guestSurvival.pratamaDollars;
        } else if (reward.currency === "VB") {
          req.session.guestSurvival.scholarshipVouchers += reward.amount;
          newBalance = req.session.guestSurvival.scholarshipVouchers;
        }
      }

      return res.json({
        success: true,
        message: `Selesai bekerja sebagai "${location.jobTitle || 'Pekerja'}"! Kamu menerima upah ${reward.amount} ${reward.currency} dan +${reward.exp} EXP.`,
        reward,
        newStamina,
        newBalance,
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 6.5 Belanja di Toko / Warung
  router.post("/world/shop/buy", async (req, res) => {
    try {
      const { areaId, locationId, itemId } = req.body || {};
      const area = ADISHA_REGIONS[areaId];
      if (!area) return res.status(404).json({ success: false, error: "Wilayah tidak ditemukan." });

      const location = area.locations?.[locationId];
      if (!location || !Array.isArray(location.shopItems)) {
        return res.status(400).json({ success: false, error: "Bukan tempat berbelanja." });
      }

      const item = location.shopItems.find((it) => it.itemId === itemId);
      if (!item) {
        return res.status(404).json({ success: false, error: "Barang tidak tersedia di toko ini." });
      }

      const player = await resolvePlayerSurvivalState(req);
      const currencyType = item.currency || "SC";
      let currentBal = 0;

      if (currencyType === "SC") currentBal = player.sukamajuCoins;
      else if (currencyType === "PD") currentBal = player.pratamaDollars;
      else if (currencyType === "VB") currentBal = player.scholarshipVouchers;

      if (currentBal < item.price) {
        return res.status(400).json({
          success: false,
          error: `Saldo tidak cukup! Butuh ${item.price} ${currencyType}, saldo kamu saat ini ${currentBal} ${currencyType}.`,
        });
      }

      const newBal = currentBal - item.price;
      const restores = item.restores || {};
      const newStamina = Math.min(100, player.stamina + (restores.stamina || 0));
      const newHunger = Math.min(100, player.hunger + (restores.hunger || 0));
      const newThirst = Math.min(100, player.thirst + (restores.thirst || 0));
      const newHp = Math.min(100, player.hp + (restores.hp || 0));

      if (player.isLoggedIn) {
        const patch = {
          stamina: newStamina,
          hunger: newHunger,
          thirst: newThirst,
          hp: newHp,
        };
        if (currencyType === "SC") patch.sukamajuCoins = newBal;
        else if (currencyType === "VB") patch.scholarshipVouchers = newBal;
        await cacheManager.updateUserSurvival(player.userId, patch);

        if (currencyType === "PD") {
          await cacheManager.updateUserProfile(player.userId, { pratamaDollars: newBal });
        }

        if (item.isTicket) {
          const { addItemsAtomic } = require("../../src/survival/engines/inventoryHelper");
          await addItemsAtomic(player.userId, [{ id: item.itemId, amount: 1, name: item.name }]);
        }
      } else {
        req.session.guestSurvival.stamina = newStamina;
        req.session.guestSurvival.hunger = newHunger;
        req.session.guestSurvival.thirst = newThirst;
        req.session.guestSurvival.hp = newHp;
        if (currencyType === "SC") req.session.guestSurvival.sukamajuCoins = newBal;
        else if (currencyType === "PD") req.session.guestSurvival.pratamaDollars = newBal;
        else if (currencyType === "VB") req.session.guestSurvival.scholarshipVouchers = newBal;
      }

      return res.json({
        success: true,
        message: item.isTicket
          ? `Berhasil membeli ${item.name}! Tiket disimpan di tas untuk kencan.`
          : `Berhasil membeli dan mengonsumsi ${item.name}! Vitalitasmu pulih.`,
        item,
        newBalance: newBal,
        vitality: {
          hp: newHp,
          stamina: newStamina,
          hunger: newHunger,
          thirst: newThirst,
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 6.6 Pembelian Kendaraan Bermotor di Dealer
  router.post("/world/vehicle/buy", async (req, res) => {
    try {
      const { vehicleId } = req.body || {};
      const vehicle = getVehicleInfo(vehicleId);
      if (!vehicle) {
        return res.status(404).json({ success: false, error: "Kendaraan tidak terdaftar di dealer Adisha." });
      }

      const player = await resolvePlayerSurvivalState(req);

      // Aturan: Hanya boleh memiliki 1 kendaraan aktif
      if (player.vehicle) {
        const currentV = getVehicleInfo(player.vehicle);
        const resale = calculateResaleValue(player.vehicle);
        return res.status(400).json({
          success: false,
          error: `Kamu sudah memiliki ${currentV?.name || "kendaraan"}! User hanya bisa memiliki 1 kendaraan. Jual kendaraan lamamu terlebih dahulu seharga ${resale?.resalePrice} ${resale?.currency} (70% harga beli) sebelum membeli motor baru.`,
          hasActiveVehicle: true,
          currentVehicle: currentV,
          resaleInfo: resale,
        });
      }

      const currencyType = vehicle.currency || "SC";
      let currentBal = 0;
      if (currencyType === "SC") currentBal = player.sukamajuCoins;
      else if (currencyType === "PD") currentBal = player.pratamaDollars;
      else if (currencyType === "VB") currentBal = player.scholarshipVouchers;

      if (currentBal < vehicle.price) {
        return res.status(400).json({
          success: false,
          error: `Saldo tidak mencukupi untuk membeli ${vehicle.name}! Butuh ${vehicle.price} ${currencyType}, saldo kamu ${currentBal} ${currencyType}.`,
        });
      }

      const newBal = currentBal - vehicle.price;

      if (player.isLoggedIn) {
        const patch = { vehicle: vehicle.id };
        if (currencyType === "SC") patch.sukamajuCoins = newBal;
        else if (currencyType === "VB") patch.scholarshipVouchers = newBal;
        await cacheManager.updateUserSurvival(player.userId, patch);

        if (currencyType === "PD") {
          await cacheManager.updateUserProfile(player.userId, { pratamaDollars: newBal });
        }
      } else {
        req.session.guestSurvival.vehicle = vehicle.id;
        if (currencyType === "SC") req.session.guestSurvival.sukamajuCoins = newBal;
        else if (currencyType === "PD") req.session.guestSurvival.pratamaDollars = newBal;
        else if (currencyType === "VB") req.session.guestSurvival.scholarshipVouchers = newBal;
      }

      return res.json({
        success: true,
        message: `Selamat! Kamu resmi memiliki ${vehicle.name} (${vehicle.vehicleType})! Diskon stamina roam aktif dan izin akses Kawasan Tambang Raksasa kini terbuka.`,
        vehicle,
        newBalance: newBal,
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 6.7 Penjualan Kendaraan Lama ke Dealer (Refund 70% dengan Currency yang Sama)
  router.post("/world/vehicle/sell", async (req, res) => {
    try {
      const player = await resolvePlayerSurvivalState(req);

      if (!player.vehicle) {
        return res.status(400).json({ success: false, error: "Kamu tidak memiliki kendaraan untuk dijual." });
      }

      const resale = calculateResaleValue(player.vehicle);
      if (!resale) {
        return res.status(400).json({ success: false, error: "Data kendaraan tidak dapat diverifikasi." });
      }

      const currencyType = resale.currency;
      let newBal = 0;

      if (player.isLoggedIn) {
        await cacheManager.updateUserSurvival(player.userId, { vehicle: null });
        if (currencyType === "SC") {
          await cacheManager.incrementUserSurvival(player.userId, { sukamajuCoins: resale.resalePrice });
          const fresh = await cacheManager.getUserSurvival(player.userId);
          newBal = fresh.sukamajuCoins || 0;
        } else if (currencyType === "PD") {
          await cacheManager.incrementUserProfile(player.userId, { pratamaDollars: resale.resalePrice });
          const fresh = await cacheManager.getUserProfile(player.userId);
          newBal = fresh.pratamaDollars || 0;
        } else if (currencyType === "VB") {
          await cacheManager.incrementUserSurvival(player.userId, { scholarshipVouchers: resale.resalePrice });
          const fresh = await cacheManager.getUserSurvival(player.userId);
          newBal = fresh.scholarshipVouchers || 0;
        }
      } else {
        req.session.guestSurvival.vehicle = null;
        if (currencyType === "SC") {
          req.session.guestSurvival.sukamajuCoins += resale.resalePrice;
          newBal = req.session.guestSurvival.sukamajuCoins;
        } else if (currencyType === "PD") {
          req.session.guestSurvival.pratamaDollars += resale.resalePrice;
          newBal = req.session.guestSurvival.pratamaDollars;
        } else if (currencyType === "VB") {
          req.session.guestSurvival.scholarshipVouchers += resale.resalePrice;
          newBal = req.session.guestSurvival.scholarshipVouchers;
        }
      }

      return res.json({
        success: true,
        message: `Berhasil menjual ${resale.vehicleName} ke dealer! Kamu menerima refund sebesar ${resale.resalePrice} ${resale.currency} (70% dari harga asli). Sekarang kamu dapat membeli kendaraan baru.`,
        resale,
        newBalance: newBal,
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
};
