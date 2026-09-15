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
      { level: 1, name: "Frontier Outpost", cost: 1500, maxMembersBonus: 5, vaultBonus: 5000 },
      { level: 2, name: "Iron Fortress", cost: 3500, maxMembersBonus: 10, vaultBonus: 15000 },
      { level: 3, name: "Cyber Citadel", cost: 8000, maxMembersBonus: 20, vaultBonus: 50000 },
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
      { level: 1, name: "Cyber Greenhouse Tech", cost: 1200, buff: "farm_yield_15" },
      { level: 2, name: "Quantum Smelter Tech", cost: 2500, buff: "craft_speed_20" },
      { level: 3, name: "Astral Observatory Tech", cost: 5000, buff: "omikuji_luck_25" },
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
        await redisManager.setCache(`${LAND_PREFIX}${guildId}`, JSON.stringify(landData), 86400 * 30);
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
      return { success: false, error: "Koordinat harus berada dalam rentang grid 1..8." };
    }

    const land = await this.getGuildLand(guildId);
    const coordKey = `${x},${y}`;

    if (land.plots[coordKey]) {
      return { success: false, error: `Kapling di koordinat (${x}, ${y}) sudah dimiliki.` };
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

    logger.info(`[LandEngine] Klan ${clan.name} mengklaim tanah di (${x}, ${y}) pada guild ${guildId}.`);
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
      return { success: false, error: "Bangunan ini sudah mencapai level maksimum." };
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

        const cTier = STRUCTURES.castle.tiers.find((t) => t.level === castleLevel);
        if (cTier) {
          totalVaultBonus += cTier.vaultBonus;
          maxMembersBonus += cTier.maxMembersBonus;
        }

        const tTier = STRUCTURES.defense_tower.tiers.find((t) => t.level === towerLevel);
        if (tTier) {
          totalDefense += tTier.defenseBonus;
        }

        const lTier = STRUCTURES.research_lab.tiers.find((t) => t.level === labLevel);
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
}

module.exports = new LandEngine();
module.exports.STRUCTURES = STRUCTURES;
