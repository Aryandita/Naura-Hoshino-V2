"use strict";

const ClanTerritory = require("../models/ClanTerritory");
const GuildClan = require("../models/GuildClan");
const { logger } = require("../managers/logger");

const DEFAULT_SECTORS = [
  {
    territoryId: "SECTOR_DOCKS",
    name: "Neon Cyber-Docks",
    taxYield: 500,
    buffEffect: "+15% Hasil Memancing (Fish Yield)",
  },
  {
    territoryId: "SECTOR_MINES",
    name: "Crystal Quarry",
    taxYield: 600,
    buffEffect: "+15% Hasil Tambang (Mining Yield)",
  },
  {
    territoryId: "SECTOR_CITADEL",
    name: "Babel Citadel",
    taxYield: 1000,
    buffEffect: "+20% Serangan World Boss Raid",
  },
  {
    territoryId: "SECTOR_VALLEY",
    name: "Sakura Valley",
    taxYield: 500,
    buffEffect: "+15% Panen Kebun (Farm Harvest)",
  },
  {
    territoryId: "SECTOR_PLAZA",
    name: "Central Cyber-Hub",
    taxYield: 800,
    buffEffect: "+10% Pendapatan Kafe & Toko",
  },
];

class TerritoryWarEngine {
  /**
   * Ambil seluruh wilayah dan inisialisasi jika belum ada
   */
  static async getTerritories() {
    let list = await ClanTerritory.findAll();
    if (list.length === 0) {
      for (const sec of DEFAULT_SECTORS) {
        await ClanTerritory.findOrCreate({
          where: { territoryId: sec.territoryId },
          defaults: {
            territoryId: sec.territoryId,
            name: sec.name,
            taxYield: sec.taxYield,
            buffEffect: sec.buffEffect,
            controlPoints: 0,
            defenseLevel: 1,
            lastTaxClaimedAt: new Date(),
          },
        });
      }
      list = await ClanTerritory.findAll();
    }
    return list.map((t) => t.toJSON());
  }

  /**
   * Serang sektor wilayah dengan poin energi klan
   */
  static async attackTerritory({
    clanId,
    clanName,
    territoryId,
    energySpent = 50,
  }) {
    const energy = Math.max(10, Math.floor(Number(energySpent) || 50));
    let territory = await ClanTerritory.findOne({ where: { territoryId } });

    if (!territory) {
      const def =
        DEFAULT_SECTORS.find((s) => s.territoryId === territoryId) ||
        DEFAULT_SECTORS[0];
      territory = await ClanTerritory.create({
        territoryId: def.territoryId,
        name: def.name,
        taxYield: def.taxYield,
        buffEffect: def.buffEffect,
        controlPoints: 0,
        defenseLevel: 1,
        lastTaxClaimedAt: new Date(),
      });
    }

    const currentClanId = territory.clanId;
    const currentPoints = Number(territory.controlPoints || 0);

    // Jika klan penyerang sudah menjadi pemilik, tingkatkan pertahanan
    if (currentClanId === Number(clanId)) {
      territory.controlPoints = Math.min(1000, currentPoints + energy);
      await territory.save();
      return {
        success: true,
        action: "DEFENDED",
        territoryName: territory.name,
        controlPoints: territory.controlPoints,
      };
    }

    // Penyerangan terhadap klan lain atau wilayah netral
    const newPoints = currentPoints - energy;

    if (newPoints <= 0) {
      // Wilayah terebut!
      const capturedPoints = Math.abs(newPoints) + 50;
      territory.clanId = Number(clanId);
      territory.clanName = clanName;
      territory.controlPoints = capturedPoints;
      territory.contestedAt = new Date();
      territory.lastTaxClaimedAt = new Date();
      await territory.save();

      logger.info(
        `[TerritoryWar] Klan ${clanName} (#${clanId}) berhasil merebut ${territory.name}!`,
      );
      return {
        success: true,
        action: "CAPTURED",
        territoryName: territory.name,
        newOwnerName: clanName,
        controlPoints: capturedPoints,
      };
    }

    territory.controlPoints = newPoints;
    await territory.save();

    return {
      success: true,
      action: "ATTACKED",
      territoryName: territory.name,
      remainingDefPoints: newPoints,
      damageDealt: energy,
    };
  }

  /**
   * Klaim akumulasi pajak dari seluruh sektor yang dikuasai klan
   */
  static async claimClanTax(clanId) {
    const territories = await ClanTerritory.findAll({
      where: { clanId: Number(clanId) },
    });
    if (territories.length === 0) {
      return { success: false, reason: "NO_TERRITORIES_OWNED" };
    }

    let totalTaxEarned = 0;
    const now = Date.now();

    for (const terr of territories) {
      const lastClaim = terr.lastTaxClaimedAt
        ? new Date(terr.lastTaxClaimedAt).getTime()
        : now - 3600000;
      const hoursPassed = Math.min(
        24,
        Math.max(0.1, (now - lastClaim) / (1000 * 60 * 60)),
      );
      const earned = Math.floor(hoursPassed * (terr.taxYield || 500));

      if (earned > 0) {
        totalTaxEarned += earned;
        terr.lastTaxClaimedAt = new Date();
        await terr.save();
      }
    }

    if (totalTaxEarned <= 0) {
      return { success: false, reason: "NO_ACCUMULATED_TAX" };
    }

    const clan = await GuildClan.findByPk(clanId);
    if (clan) {
      clan.vault = Number(clan.vault || 0) + totalTaxEarned;
      await clan.save();
    }

    logger.info(
      `[TerritoryWar] Klan #${clanId} mengklaim ${totalTaxEarned} ⭐ pajak wilayah.`,
    );
    return {
      success: true,
      claimedTax: totalTaxEarned,
      territoriesCount: territories.length,
    };
  }

  /**
   * Reset mingguan perang wilayah (Weekly War Reset)
   */
  static async resetWeeklyWar() {
    logger.info(
      "[TerritoryWar] Menjalankan Weekly War Reset untuk seluruh sektor...",
    );
    const territories = await ClanTerritory.findAll();
    for (const terr of territories) {
      terr.controlPoints = Math.floor(Number(terr.controlPoints || 0) * 0.5); // Kurangi 50% untuk persaingan baru
      await terr.save();
    }
  }
}

module.exports = TerritoryWarEngine;
module.exports.DEFAULT_SECTORS = DEFAULT_SECTORS;
