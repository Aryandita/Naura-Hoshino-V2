"use strict";

const { logger } = require("../../managers/logger");
const cacheManager = require("../../managers/cacheManager");
const redisManager = require("../../managers/redisManager");

class ProphecyEngine {
  static async consultOracle(userId) {
    try {
      const lastConsult = await redisManager.get(`prophecy_cooldown:${userId}`);
      if (lastConsult) return { ok: false, reason: "COOLDOWN_ACTIVE", retryAfterMs: parseInt(lastConsult, 10) - Date.now() };

      const prophecies = [
        { text: "Bintang jatuh akan membawa keberuntungan bagi yang berani mengambil risiko.", type: "fortune", effect: "luck_boost" },
        { text: "Badai besar mendekat. Persiapkan pertahananmu sebelum malam tiba.", type: "warning", effect: "defense_prep" },
        { text: "Seorang teman lama akan kembali dengan hadiah yang tak terduga.", type: "reunion", effect: "gift_incoming" },
        { text: "Jalan yang kamu pilih akan bercabang. Pilihanmu menentukan takdir.", type: "crossroads", effect: "choice_pending" },
        { text: "Kekuatan tersembunyi dalam dirimu akan bangkit saat dibutuhkan.", type: "awakening", effect: "hidden_power" },
      ];

      const prophecy = prophecies[Math.floor(Math.random() * prophecies.length)];
      const fatePoints = Math.floor(Math.random() * 3) + 1;

      const survival = await cacheManager.getUserSurvival(userId);
      const currentFate = survival?.fatePoints || 0;
      await cacheManager.updateUserSurvival(userId, { fatePoints: currentFate + fatePoints });

      await redisManager.set(`prophecy_cooldown:${userId}`, String(Date.now() + 28800000), "EX", 28800);

      logger.info(`[Prophecy] ${userId} consulted oracle, gained ${fatePoints} fate points`);
      return { ok: true, prophecy, fatePointsGained: fatePoints, totalFatePoints: currentFate + fatePoints };
    } catch (error) {
      logger.error(`[Prophecy] Consult error:`, error);
      return { ok: false, reason: "INTERNAL_ERROR" };
    }
  }

  static async spendFatePoint(userId, purpose) {
    try {
      const survival = await cacheManager.getUserSurvival(userId);
      const currentFate = survival?.fatePoints || 0;

      if (currentFate < 1) return { ok: false, reason: "INSUFFICIENT_FATE_POINTS" };

      await cacheManager.updateUserSurvival(userId, { fatePoints: currentFate - 1 });

      const effects = {
        reroll_loot: "Nasib mengubah hasil loot berikutnya.",
        avoid_death: "Takdir menyelamatkanmu dari kekalahan fatal.",
        boost_roll: "Keberuntungan meningkatkan peluang sukses.",
        reveal_secret: "Mata takdir mengungkapkan rahasia tersembunyi.",
      };

      logger.info(`[Prophecy] ${userId} spent fate point for ${purpose}`);
      return { ok: true, remaining: currentFate - 1, effect: effects[purpose] || "Nasib telah digunakan." };
    } catch (error) {
      return { ok: false, reason: "INTERNAL_ERROR" };
    }
  }

  static async getFateStatus(userId) {
    try {
      const survival = await cacheManager.getUserSurvival(userId);
      return { fatePoints: survival?.fatePoints || 0 };
    } catch {
      return { fatePoints: 0 };
    }
  }
}

module.exports = { ProphecyEngine };
