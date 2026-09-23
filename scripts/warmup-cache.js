"use strict";

/**
 * Script pemanasan cache awal (Cache Warming): `node scripts/warmup-cache.js`.
 * Memuat konfigurasi server dan papan peringkat aktif ke Redis sebelum bot menerima request,
 * sehingga request pertama user langsung mendapatkan latensi sub-10ms.
 */

const { logger } = require("../src/managers/logger");
const redisManager = require("../src/managers/redisManager");
const { sequelize } = require("../src/managers/dbManager");
const UserProfile = require("../src/models/UserProfile");
const UserSurvival = require("../src/models/UserSurvival");
const GuildSettings = require("../src/models/GuildSettings");

async function warmup() {
  logger.info("[WARMUP] Memulai pemanasan Redis cache...");

  try {
    if (!redisManager.isReady) {
      logger.info(
        "[WARMUP] Redis tidak aktif atau belum siap. Pemanasan dilewati secara aman.",
      );
      process.exit(0);
    }

    await sequelize.authenticate();

    // 1. Pemanasan Pengaturan Guild
    const guilds = await GuildSettings.findAll({ limit: 50 });
    let warmedGuilds = 0;
    for (const g of guilds) {
      if (g.guild_id) {
        await redisManager.set(
          `guild:${g.guild_id}`,
          JSON.stringify(g.toJSON()),
          600,
        );
        warmedGuilds++;
      }
    }
    logger.info(
      `[WARMUP] Berhasil memanaskan ${warmedGuilds} konfigurasi server ke Redis.`,
    );

    // 2. Pemanasan Top User Survival
    const topSurvivors = await UserSurvival.findAll({
      order: [
        ["level", "DESC"],
        ["exp", "DESC"],
      ],
      limit: 30,
    });
    if (topSurvivors.length > 0) {
      await redisManager.set(
        "survival:leaderboard:top30",
        JSON.stringify(topSurvivors.map((s) => s.toJSON())),
        300,
      );
      logger.info(
        `[WARMUP] Berhasil memanaskan ${topSurvivors.length} top survival leaderboard.`,
      );
    }

    // 3. Pemanasan Top Economy Profile
    const topEconomy = await UserProfile.findAll({
      order: [["economy_wallet", "DESC"]],
      limit: 30,
    });
    if (topEconomy.length > 0) {
      await redisManager.set(
        "economy:leaderboard:top30",
        JSON.stringify(topEconomy.map((e) => e.toJSON())),
        300,
      );
      logger.info(
        `[WARMUP] Berhasil memanaskan ${topEconomy.length} top economy leaderboard.`,
      );
    }

    logger.info("[WARMUP] Pemanasan cache Redis selesai dengan sukses!");
    process.exit(0);
  } catch (err) {
    logger.warn(
      "[WARMUP] Pemanasan cache mendapati kendala non-fatal:",
      err.message,
    );
    process.exit(0); // Selalu keluar dengan 0 agar tidak menggagalkan siklus startup
  }
}

if (require.main === module) {
  warmup();
}

module.exports = { warmup };
