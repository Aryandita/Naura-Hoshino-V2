"use strict";

const GuildClan = require("../../models/GuildClan");
const cacheManager = require("../../managers/cacheManager");
const { logger } = require("../../managers/logger");
const ui = require("../../config/ui");

const FURNITURE_CATALOG = [
  {
    id: "neon_sofa",
    name: "Sofa Kaca Cyberpunk",
    cost: 2000,
    get emoji() {
      return ui.getEmoji("sofa") || "🛋️";
    },
    desc: "Tempat bersantai yang nyaman untuk anggota klan.",
  },
  {
    id: "coffee_maker",
    name: "Espresso Barista Cyber",
    cost: 3000,
    get emoji() {
      return ui.getEmoji("coffee") || "☕";
    },
    desc: "Menghasilkan seduhan kopi harian penambah stamina (+25 Energy).",
  },
  {
    id: "arcade_cabinet",
    name: "Arcade Machine Retro",
    cost: 5000,
    get emoji() {
      return ui.getEmoji("arcade") || "🕹️";
    },
    desc: "Mesin game dingdong untuk hiburan di dalam lounge.",
  },
  {
    id: "sakura_bonsai",
    name: "Bonsai Sakura Holografis",
    cost: 4000,
    get emoji() {
      return ui.getEmoji("bonsai") || "🌸";
    },
    desc: "Tanaman bercahaya neon yang mempercantik suasana klan.",
  },
  {
    id: "trophy_case",
    name: "Lemari Trofi Penakluk",
    cost: 7500,
    get emoji() {
      return ui.getEmoji("trophy_cup") || "🏆";
    },
    desc: "Memamerkan pencapaian kemenangan raid dan perang wilayah.",
  },
];

class GuildHallEngine {
  /**
   * Ambil status layout ruang 2.5D Guild Hall klan
   */
  static async getHall(clanId) {
    const clan = await GuildClan.findByPk(clanId);
    if (!clan) return null;

    let layout = clan.hallLayout;
    if (typeof layout === "string") {
      try {
        layout = JSON.parse(layout);
      } catch {
        layout = null;
      }
    }

    if (!layout) {
      layout = {
        theme: "CYBERPUNK_LOUNGE",
        furniture: ["neon_sofa", "coffee_maker"],
        jukeboxTrack: "Hoshino Beats #1",
        lastCoffeeServedAt: null,
      };
    }

    return {
      clanId: clan.id,
      clanName: clan.name,
      level: clan.level || 1,
      vault: clan.vault || 0,
      layout,
      availableFurniture: FURNITURE_CATALOG,
    };
  }

  /**
   * Beli dan tempatkan furnitur baru ke dalam Guild Hall
   */
  static async buyFurniture(clanId, furnitureId) {
    const clan = await GuildClan.findByPk(clanId);
    if (!clan) return { success: false, reason: "CLAN_NOT_FOUND" };

    const item = FURNITURE_CATALOG.find((f) => f.id === furnitureId);
    if (!item) return { success: false, reason: "INVALID_FURNITURE" };

    let layout = clan.hallLayout || { furniture: [] };
    if (typeof layout === "string") layout = JSON.parse(layout);
    if (!Array.isArray(layout.furniture)) layout.furniture = [];

    if (layout.furniture.includes(furnitureId)) {
      return { success: false, reason: "ALREADY_OWNED" };
    }

    if (Number(clan.vault || 0) < item.cost) {
      return {
        success: false,
        reason: "INSUFFICIENT_VAULT",
        cost: item.cost,
        current: clan.vault,
      };
    }

    clan.vault = Number(clan.vault || 0) - item.cost;
    layout.furniture.push(furnitureId);
    clan.hallLayout = layout;
    await clan.save();

    logger.info(
      `[GuildHall] Klan ${clan.name} membeli furnitur ${item.name} seharga ${item.cost} ⭐.`,
    );
    return {
      success: true,
      item,
      remainingVault: clan.vault,
      totalFurnitures: layout.furniture.length,
    };
  }

  /**
   * Minum seduhan kopi harian di Lounge (+25 Energy)
   */
  static async claimCoffeeBuff(userId, clanId) {
    const clan = await GuildClan.findByPk(clanId);
    if (!clan) return { success: false, reason: "CLAN_NOT_FOUND" };

    let layout = clan.hallLayout || { furniture: [] };
    if (typeof layout === "string") layout = JSON.parse(layout);
    if (!layout.furniture || !layout.furniture.includes("coffee_maker")) {
      return { success: false, reason: "NO_COFFEE_MAKER" };
    }

    // Berikan buff stamina survival
    await cacheManager.incrementUserSurvival(userId, "stamina", 25);

    logger.info(
      `[GuildHall] User ${userId} menikmati seduhan kopi di Hall klan ${clan.name}.`,
    );
    return {
      success: true,
      energyGained: 25,
      clanName: clan.name,
    };
  }
}

module.exports = GuildHallEngine;
module.exports.FURNITURE_CATALOG = FURNITURE_CATALOG;
