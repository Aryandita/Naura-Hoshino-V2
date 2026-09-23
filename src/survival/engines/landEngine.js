"use strict";

/**
 * landEngine.js - Mesin Tanah Metaverse Virtual & Kastil Klan (Metaverse Land & Guild Castles).
 *
 * Mengelola:
 *   1. Kepemilikan Kapling Tanah Virtual (Grid Koordinat X: 1..8, Y: 1..8).
 *   2. Konstruksi Istana Klan: Outpost (Lv. 1) -> Fortress (Lv. 2) -> Cyber Citadel (Lv. 3).
 *   3. Menara Pertahanan: Ion Cannon & Aegis Barrier untuk proteksi invasi klan.
 *   4. Fasilitas Riset Teknologi Bersama: Quantum Smeltery, Astral Observatory, Cyber Greenhouse.
 *   5. Transaksi Atomik Pembiayaan Konstruksi via Kas Klan / Star Fragments.
 */

const redisManager = require("../../managers/redisManager");
const GuildClan = require("../../models/GuildClan");
const { logger } = require("../../managers/logger");

const LAND_PREFIX = "land:guild:";
const PLOT_CLAIM_COST = 1000; // 1.000 NSF

const STRUCTURES = {
  castle: {
    name: "Istana Klan (Guild Castle)",
    tiers: [
      {
        level: 1,
        name: "Frontier Outpost",
        cost: 1500,
        maxMembersBonus: 5,
        vaultBonus: 5000,
      },
      {
        level: 2,
        name: "Iron Fortress",
        cost: 3500,
        maxMembersBonus: 10,
        vaultBonus: 15000,
      },
      {
        level: 3,
        name: "Cyber Citadel",
        cost: 8000,
        maxMembersBonus: 20,
        vaultBonus: 50000,
      },
    ],
  },
  defense_tower: {
    name: "Menara Pertahanan (Defense Tower)",
    tiers: [
      { level: 1, name: "Aegis Barrier", cost: 1000, defenseBonus: 25 },
      { level: 2, name: "Ion Cannon", cost: 2500, defenseBonus: 60 },
    ],
  },
  research_lab: {
    name: "Fasilitas Riset (Tech Lab)",
    tiers: [
      {
        level: 1,
        name: "Cyber Greenhouse Tech",
        cost: 1200,
        buff: "farm_yield_15",
      },
      {
        level: 2,
        name: "Quantum Smelter Tech",
        cost: 2500,
        buff: "craft_speed_20",
      },
      {
        level: 3,
        name: "Astral Observatory Tech",
        cost: 5000,
        buff: "omikuji_luck_25",
      },
    ],
  },
};

const memoryLands = new Map();

class LandEngine {
  /**
   * Mengambil data kapling tanah guild.
   * @param {string} guildId
   * @returns {Promise<object>}
   */
  async getGuildLand(guildId) {
    if (!guildId) return { guildId, plots: {} };
    try {
      if (redisManager.isReady) {
        const raw = await redisManager.getCache(`${LAND_PREFIX}${guildId}`);
        if (raw) return typeof raw === "string" ? JSON.parse(raw) : raw;
      }
    } catch (err) {
      logger.warn(`[LandEngine] Redis fetch error: ${err.message}`);
    }
    return memoryLands.get(guildId) || { guildId, plots: {} };
  }

  /**
   * Menyimpan data kapling tanah guild.
   * @param {string} guildId
   * @param {object} landData
   */
  async saveGuildLand(guildId, landData) {
    memoryLands.set(guildId, landData);
    try {
      if (redisManager.isReady) {
        await redisManager.setCache(
          `${LAND_PREFIX}${guildId}`,
          JSON.stringify(landData),
          86400 * 30,
        );
      }
    } catch (err) {
      logger.warn(`[LandEngine] Redis save error: ${err.message}`);
    }
  }

  /**
   * Mengklaim kapling tanah virtual baru pada koordinat X, Y.
   * @param {object} params
   * @param {string} params.guildId
   * @param {string} params.clanId
   * @param {number} params.x
   * @param {number} params.y
   * @returns {Promise<{success: boolean, plot?: object, error?: string}>}
   */
  async claimPlot({ guildId, clanId, x, y }) {
    if (x < 1 || x > 8 || y < 1 || y > 8) {
      return {
        success: false,
        error: "Koordinat harus berada dalam rentang grid 1..8.",
      };
    }

    const land = await this.getGuildLand(guildId);
    const coordKey = `${x},${y}`;

    if (land.plots[coordKey]) {
      return {
        success: false,
        error: `Kapling di koordinat (${x}, ${y}) sudah dimiliki.`,
      };
    }

    // Periksa dan potong saldo kas klan
    const clan = await GuildClan.findByPk(clanId);
    if (!clan || (clan.vault || 0) < PLOT_CLAIM_COST) {
      return {
        success: false,
        error: `Kas klan tidak mencukupi untuk klaim kapling (${PLOT_CLAIM_COST} Star Fragments).`,
      };
    }

    clan.vault = (clan.vault || 0) - PLOT_CLAIM_COST;
    await clan.save({ fields: ["vault"] });

    const newPlot = {
      x,
      y,
      clanId,
      claimedAt: new Date().toISOString(),
      structures: {
        castle: 1, // Default Frontier Outpost
        defense_tower: 0,
        research_lab: 0,
      },
    };

    land.plots[coordKey] = newPlot;
    await this.saveGuildLand(guildId, land);

    logger.info(
      `[LandEngine] Klan ${clan.name} mengklaim tanah di (${x}, ${y}) pada guild ${guildId}.`,
    );
    return { success: true, plot: newPlot };
  }

  /**
   * Membangun atau meng-upgrade struktur pada kapling tanah.
   * @param {object} params
   * @param {string} params.guildId
   * @param {string} params.clanId
   * @param {number} params.x
   * @param {number} params.y
   * @param {string} params.structureType - 'castle' | 'defense_tower' | 'research_lab'
   * @returns {Promise<{success: boolean, newLevel?: number, structureName?: string, error?: string}>}
   */
  async upgradeStructure({ guildId, clanId, x, y, structureType }) {
    const structDef = STRUCTURES[structureType];
    if (!structDef) {
      return { success: false, error: "Tipe bangunan tidak valid." };
    }

    const land = await this.getGuildLand(guildId);
    const coordKey = `${x},${y}`;
    const plot = land.plots[coordKey];

    if (!plot || plot.clanId !== clanId) {
      return { success: false, error: "Kapling ini bukan milik klan kamu." };
    }

    const currentLevel = plot.structures[structureType] || 0;
    const nextTier = structDef.tiers.find((t) => t.level === currentLevel + 1);

    if (!nextTier) {
      return {
        success: false,
        error: "Bangunan ini sudah mencapai level maksimum.",
      };
    }

    const clan = await GuildClan.findByPk(clanId);
    if (!clan || (clan.vault || 0) < nextTier.cost) {
      return {
        success: false,
        error: `Kas klan tidak mencukupi untuk upgrade ke ${nextTier.name} (Butuh ${nextTier.cost} NSF).`,
      };
    }

    // Potong brankas klan
    clan.vault = (clan.vault || 0) - nextTier.cost;
    await clan.save({ fields: ["vault"] });

    plot.structures[structureType] = nextTier.level;
    await this.saveGuildLand(guildId, land);

    return {
      success: true,
      newLevel: nextTier.level,
      structureName: nextTier.name,
      cost: nextTier.cost,
    };
  }

  /**
   * Mengambil kalkulasi total bonus riset teknologi & pertahanan tanah klan.
   * @param {string} guildId
   * @param {string} clanId
   * @returns {Promise<object>}
   */
  async getClanLandStats(guildId, clanId) {
    const land = await this.getGuildLand(guildId);
    let totalDefense = 0;
    let totalVaultBonus = 0;
    let maxMembersBonus = 0;
    const activeBuffs = [];
    let plotsOwned = 0;

    for (const plot of Object.values(land.plots)) {
      if (plot.clanId === clanId) {
        plotsOwned++;
        const castleLevel = plot.structures.castle || 0;
        const towerLevel = plot.structures.defense_tower || 0;
        const labLevel = plot.structures.research_lab || 0;

        const cTier = STRUCTURES.castle.tiers.find(
          (t) => t.level === castleLevel,
        );
        if (cTier) {
          totalVaultBonus += cTier.vaultBonus;
          maxMembersBonus += cTier.maxMembersBonus;
        }

        const tTier = STRUCTURES.defense_tower.tiers.find(
          (t) => t.level === towerLevel,
        );
        if (tTier) {
          totalDefense += tTier.defenseBonus;
        }

        const lTier = STRUCTURES.research_lab.tiers.find(
          (t) => t.level === labLevel,
        );
        if (lTier) {
          activeBuffs.push(lTier.buff);
        }
      }
    }

    return {
      plotsOwned,
      totalDefense,
      totalVaultBonus,
      maxMembersBonus,
      activeBuffs,
    };
  }

  /**
   * Memperbarui posisi koordinat avatar pemain di metaverse land (grid 1..8, 1..8)
   * @param {string} guildId
   * @param {string} userId
   * @param {{x: number, y: number, username?: string}} pos
   * @returns {Promise<object>}
   */
  async updatePlayerPosition(guildId, userId, { x, y, username }) {
    const clampedX = Math.max(1, Math.min(8, Math.round(Number(x) || 1)));
    const clampedY = Math.max(1, Math.min(8, Math.round(Number(y) || 1)));
    const posData = {
      x: clampedX,
      y: clampedY,
      username: username || "Player",
      updatedAt: Date.now(),
    };

    const key = `land:pos:${guildId}:${userId}`;
    if (redisManager.isReady) {
      try {
        await redisManager.set(key, JSON.stringify(posData), 3600);
      } catch (_) {}
    }
    if (!this.playerPositions) this.playerPositions = new Map();
    this.playerPositions.set(`${guildId}:${userId}`, posData);
    return posData;
  }

  /**
   * Mengambil posisi avatar pemain di metaverse land
   * @param {string} guildId
   * @param {string} userId
   * @returns {Promise<{x: number, y: number, username?: string}|null>}
   */
  async getPlayerPosition(guildId, userId) {
    const key = `land:pos:${guildId}:${userId}`;
    if (redisManager.isReady) {
      try {
        const raw = await redisManager.get(key);
        if (raw) return typeof raw === "string" ? JSON.parse(raw) : raw;
      } catch (_) {}
    }
    if (!this.playerPositions) this.playerPositions = new Map();
    return this.playerPositions.get(`${guildId}:${userId}`) || null;
  }

  /**
   * Menghitung atenuasi volume suara spasial 3D berdasarkan jarak ubin avatar (8x8 grid)
   * Menggunakan model inverse distance linear roll-off
   * @param {{x: number, y: number}} posA - Posisi pendengar (listener)
   * @param {{x: number, y: number}} posB - Posisi pembicara (speaker)
   * @param {object} [options]
   * @param {number} [options.maxDistance=4.5] - Jarak maksimal terdengar dalam satuan ubin
   * @param {number} [options.innerRadius=1.0] - Radius volume 100%
   * @returns {{distance: number, volume: number, pan: number, audible: boolean}}
   */
  calculateSpatialProximity(posA, posB, options = {}) {
    if (!posA || !posB) {
      return { distance: 99, volume: 0, pan: 0, audible: false };
    }
    const maxDist = options.maxDistance || 4.5;
    const innerRadius = options.innerRadius || 1.0;

    const dx = (posB.x || 1) - (posA.x || 1);
    const dy = (posB.y || 1) - (posA.y || 1);
    const distance = Math.sqrt(dx * dx + dy * dy);

    let volume = 0;
    if (distance <= innerRadius) {
      volume = 1.0;
    } else if (distance < maxDist) {
      // Linear attenuation dari innerRadius ke maxDist
      volume = Math.max(
        0,
        1.0 - (distance - innerRadius) / (maxDist - innerRadius),
      );
      volume = Math.round(volume * 100) / 100;
    }

    // Pan stereo: -1.0 (kiri penuh) sampai +1.0 (kanan penuh)
    const pan = Math.max(
      -1.0,
      Math.min(1.0, Math.round((dx / (maxDist || 1)) * 100) / 100),
    );

    return {
      distance: Math.round(distance * 100) / 100,
      volume,
      pan,
      audible: volume > 0.01,
    };
  }

  /**
   * Mengambil peta audio spasial untuk pendengar dari semua pemain yang berada di guild
   * @param {string} guildId
   * @param {string} listenerUserId
   * @param {Array<{userId: string, x: number, y: number, username?: string}>} [knownPlayers]
   * @returns {Promise<Array<object>>}
   */
  async getProximityAudioMap(guildId, listenerUserId, knownPlayers = []) {
    let listenerPos = await this.getPlayerPosition(guildId, listenerUserId);
    if (!listenerPos) {
      listenerPos = { x: 4, y: 4, username: "Listener" };
    }

    const proximityMap = [];
    for (const player of knownPlayers) {
      if (player.userId === listenerUserId) continue;
      const proximity = this.calculateSpatialProximity(listenerPos, player);
      proximityMap.push({
        userId: player.userId,
        username: player.username || `User_${player.userId}`,
        distance: proximity.distance,
        volume: proximity.volume,
        pan: proximity.pan,
        audible: proximity.audible,
      });
    }

    return proximityMap.sort((a, b) => a.distance - b.distance);
  }
}

module.exports = new LandEngine();
module.exports.STRUCTURES = STRUCTURES;
