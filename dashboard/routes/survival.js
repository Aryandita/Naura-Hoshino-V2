"use strict";

/**
 * dashboard/routes/survival.js - Router Tactical War Room & Survival Territory
 *
 * Mengelola endpoint API untuk 8x8 Land Grid, Relic Towers, dan World Boss Tracker.
 */

const express = require("express");
const { logger } = require("../../src/managers/logger");

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
  logger.warn(
    `[Survival Route] guildFederationEngine gagal dimuat: ${e.message}`,
  );
}

let worldBossEngine = null;
try {
  worldBossEngine = require("../../src/survival/engines/worldBossEngine");
} catch (e) {
  logger.warn(`[Survival Route] worldBossEngine gagal dimuat: ${e.message}`);
}

// Simulasi data kapling default 8x8
const TERRAIN_TYPES = [
  "Plains",
  "Forest",
  "Mountain",
  "Crystal Mine",
  "Ruins",
  "Lake Coast",
];
const DEFAULT_PLOTS = {};

// Inisialisasi beberapa kapling yang dikuasai klan terkenal untuk demonstrasi
DEFAULT_PLOTS["3,3"] = {
  x: 3,
  y: 3,
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
  x: 4,
  y: 4,
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
  x: 5,
  y: 3,
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
  x: 6,
  y: 5,
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
  {
    id: 1,
    text: "⚔️ Klan Cyber Knights berhasil memperkuat Menara Pertahanan di Sektor (3,3).",
    time: "5 menit lalu",
    type: "defense",
  },
  {
    id: 2,
    text: "🏰 Hoshino Vanguard membuka riset Astral Observatory di Kapling Pusat (4,4).",
    time: "18 menit lalu",
    type: "upgrade",
  },
  {
    id: 3,
    text: "🚨 Aliansi Starfall melancarkan serangan ke Menara Relik Kuno Barat!",
    time: "42 menit lalu",
    type: "war",
  },
  {
    id: 4,
    text: "🌲 Klan Emerald Dawn berhasil mengklaim kapling subur di Sektor Hutan (6,5).",
    time: "2 jam lalu",
    type: "claim",
  },
];

module.exports = () => {
  const router = express.Router();

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
              structure: {
                type: "castle",
                tier: t.defenseLevel || 1,
                name: t.name,
              },
              defensePower: t.controlPoints || 500,
              buffs: [t.buffEffect || "+10% Sektor Yield"],
              claimedAt: t.updatedAt
                ? new Date(t.updatedAt).getTime()
                : Date.now(),
            };
          });
        }
      } catch (_) {}

      const mergedPlots = {
        ...DEFAULT_PLOTS,
        ...dbPlots,
        ...(liveData.plots || {}),
      };
      const grid = [];

      for (let y = 1; y <= 8; y++) {
        const row = [];
        for (let x = 1; x <= 8; x++) {
          const key = `${x},${y}`;
          const existing = mergedPlots[key];
          if (existing) {
            row.push({
              x,
              y,
              isClaimed: true,
              ...existing,
            });
          } else {
            const terrainIdx = (x * 3 + y * 7) % TERRAIN_TYPES.length;
            row.push({
              x,
              y,
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
      logger.warn(
        `[Survival Route] Gagal memuat territory grid: ${err.message}`,
      );
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // ------------------------------------------------------------------
  // 2. Status Menara Relik Kuno (Ancient Relic Towers)
  // ------------------------------------------------------------------
  router.get("/territory/towers", (req, res) => {
    try {
      if (
        guildFederationEngine &&
        typeof guildFederationEngine.getRelicTowers === "function"
      ) {
        const rawTowers = guildFederationEngine.getRelicTowers();
        if (Array.isArray(rawTowers) && rawTowers.length > 0) {
          const enrichedTowers = rawTowers.map((t) => {
            const defensePercent = Math.round(
              ((t.defenseHp || 0) / (t.maxHp || 1)) * 100,
            );
            const isClaimed =
              !!t.controllerFedId && t.controllerFedTag !== "UNCLAIMED";
            return {
              ...t,
              region: t.zone || t.region || "Sukamaju Highlands",
              controllerFedName: isClaimed
                ? `Aliansi [${t.controllerFedTag}]`
                : "Diperebutkan (Netral)",
              controlPercent: isClaimed
                ? Math.max(35, defensePercent)
                : Math.max(15, 100 - defensePercent),
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
      if (
        worldBossEngine &&
        typeof worldBossEngine.getActiveBoss === "function"
      ) {
        const boss = await worldBossEngine.getActiveBoss();
        if (boss) {
          const hpPercent = Math.max(
            0,
            Math.min(
              100,
              Math.round(((boss.currentHp || 0) / (boss.maxHp || 1)) * 100),
            ),
          );
          const maxShieldHp =
            boss.maxShieldHp ||
            (boss.maxHp ? Math.floor(boss.maxHp * 0.25) : 1);
          const shieldHp = boss.shieldHp || 0;
          const shieldPercent = Math.max(
            0,
            Math.min(100, Math.round((shieldHp / maxShieldHp) * 100)),
          );
          const expiryTime = boss.endTime || boss.expiresAt;
          const remainingMinutes = expiryTime
            ? Math.max(
                0,
                Math.round(
                  (new Date(expiryTime).getTime() - Date.now()) / 60000,
                ),
              )
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
        {
          rank: 1,
          name: "Sensei_Kivotos",
          damage: 184500,
          percent: 18.4,
          role: "DPS Utama",
        },
        {
          rank: 2,
          name: "Arona_Tactics",
          damage: 142300,
          percent: 14.2,
          role: "Burst Mage",
        },
        {
          rank: 3,
          name: "Hoshino_Shield",
          damage: 105800,
          percent: 10.5,
          role: "Tank / Breaker",
        },
        {
          rank: 4,
          name: "Draken_Ranger",
          damage: 88400,
          percent: 8.8,
          role: "DPS",
        },
        {
          rank: 5,
          name: "Cyber_Sniper",
          damage: 71200,
          percent: 7.1,
          role: "Support Buff",
        },
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
  router.post("/territory/claim", (req, res) => {
    const { x, y, clanName, clanTag } = req.body || {};
    const parsedX = parseInt(x, 10);
    const parsedY = parseInt(y, 10);

    if (
      !parsedX ||
      !parsedY ||
      parsedX < 1 ||
      parsedX > 8 ||
      parsedY < 1 ||
      parsedY > 8
    ) {
      return res
        .status(400)
        .json({
          success: false,
          error: "Koordinat kapling harus berada dalam rentang 1 s/d 8.",
        });
    }

    const key = `${parsedX},${parsedY}`;
    if (DEFAULT_PLOTS[key]) {
      return res
        .status(400)
        .json({
          success: false,
          error: `Kapling (${parsedX}, ${parsedY}) sudah dikuasai oleh ${DEFAULT_PLOTS[key].clanName}.`,
        });
    }

    const newPlot = {
      x: parsedX,
      y: parsedY,
      clanId: `clan_user_${Date.now()}`,
      clanName: clanName || "Sensei Brigade",
      clanTag: clanTag || "VIP",
      color: "#fbbf24",
      terrain: "Plains",
      structure: { type: "castle", tier: 1, name: "Frontier Outpost" },
      defensePower: 500,
      buffs: ["+10% Star Fragment Yield", "+5% Fortress Shield"],
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
  });

  return router;
};
