"use strict";

const { Op } = require("sequelize");
const UserSurvival = require("../../models/UserSurvival");
const cacheManager = require("../../managers/cacheManager");
const { drainVitals, recoverVitals } = require("./survivalVitals");
const { logger } = require("../../managers/logger");

const ACTIVE_WINDOW_MS = 4 * 60 * 60 * 1000; // 4 Jam aktif

/**
 * Jalankan siklus peluruhan vital (hunger, thirst, stamina, hp) untuk seluruh pemain aktif.
 * Dipanggil oleh cronManager setiap 30 menit.
 *
 * @returns {Promise<{ processedCount: number, passedOutCount: number }>}
 */
async function processVitalDecayCycle() {
  let processedCount = 0;
  let passedOutCount = 0;

  try {
    const recentTime = new Date(Date.now() - ACTIVE_WINDOW_MS);
    const activeUsers = await UserSurvival.findAll({
      where: {
        updatedAt: {
          [Op.gte]: recentTime,
        },
      },
      attributes: [
        "userId",
        "currentLocation",
        "propertyId",
        "hunger",
        "thirst",
        "stamina",
        "hp",
        "rpg_state",
      ],
    });

    for (const record of activeUsers) {
      const userId = record.userId;
      const location = record.currentLocation || "desa";
      const property = record.propertyId || "jalanan";
      const rpgState = record.rpg_state || {};
      const weather = rpgState.weather || "cerah";
      const isSick = Boolean(rpgState.sick);

      const isHome = property === "rumah" || property === "mansion";
      const isHarshEnvironment = ["hutan", "tambang", "laut"].includes(location);

      let hungerDrain = isHarshEnvironment ? 8 : 5;
      let thirstDrain = location === "laut" || location === "tambang" ? 12 : 7;
      let staminaDrain = isHome ? 0 : 3;

      if (weather === "badai") {
        hungerDrain = Math.floor(hungerDrain * 1.5);
        thirstDrain = Math.floor(thirstDrain * 1.5);
      }

      let hpDrain = 0;
      if (Number(record.hunger) <= 0 || Number(record.thirst) <= 0) {
        hpDrain += 5;
      }
      if (isSick) {
        hpDrain += 3;
      }

      const result = await drainVitals(userId, {
        hunger: hungerDrain,
        thirst: thirstDrain,
        stamina: staminaDrain,
        hp: hpDrain,
      });

      if (isHome && record.stamina < 100) {
        await recoverVitals(userId, { stamina: 10 });
      }

      if (result && result.isExhausted) {
        passedOutCount++;
      }

      processedCount++;
    }

    if (processedCount > 0) {
      logger.info(
        `[Survival Decay] Memproses ${processedCount} pemain aktif (${passedOutCount} kelelahan).`,
      );
    }
  } catch (error) {
    logger.error("[Survival Decay Error]:", error.message);
  }

  return { processedCount, passedOutCount };
}

module.exports = {
  processVitalDecayCycle,
  ACTIVE_WINDOW_MS,
};
