"use strict";

const { sequelize } = require("../src/managers/dbManager");
const cacheManager = require("../src/managers/cacheManager");
const redisManager = require("../src/managers/redisManager");
const leveling = require("../src/survival/engines/survivalLeveling");

async function run() {
  const env = require("../src/config/env");
  const targetId = process.argv[2] || (env.OWNER_IDS && env.OWNER_IDS[0]) || "795241173009825853";
  const statType = (process.argv[3] || "all").toLowerCase().trim();
  const rawAmount = parseInt(process.argv[4], 10);
  const userId = String(targetId).trim();

  console.log(`[Heal] Memulai pemulihan untuk userId: ${userId} (Tipe: ${statType})`);

  const survival = await cacheManager.getUserSurvival(userId);
  if (!survival) {
    console.error(`[Heal] Data survival untuk userId ${userId} tidak ditemukan!`);
    process.exit(1);
  }

  const maxHp = leveling.calculateMaxHp(survival, survival.rpg_state?.class_bonus?.hp || 0);
  const patch = {};

  if (statType === "stamina") {
    patch.stamina = Number.isFinite(rawAmount) ? Math.max(0, Math.min(100, rawAmount)) : 100;
  } else if (statType === "hp") {
    patch.hp = Number.isFinite(rawAmount) ? Math.max(1, Math.min(maxHp, rawAmount)) : maxHp;
  } else if (statType === "hunger" || statType === "lapar") {
    patch.hunger = Number.isFinite(rawAmount) ? Math.max(0, Math.min(100, rawAmount)) : 100;
  } else if (statType === "thirst" || statType === "haus") {
    patch.thirst = Number.isFinite(rawAmount) ? Math.max(0, Math.min(100, rawAmount)) : 100;
  } else if (statType === "sick" || statType === "sembuh") {
    patch.rpg_state = {
      ...(survival.rpg_state || {}),
      sick: false,
    };
  } else {
    // Default: 'all' -> Pulihkan seluruh status vital 100% dan sembuhkan sakit
    patch.hp = maxHp;
    patch.hunger = 100;
    patch.thirst = 100;
    patch.stamina = 100;
    patch.rpg_state = {
      ...(survival.rpg_state || {}),
      sick: false,
    };
  }

  console.log("[Heal] Mengaplikasikan patch:", patch);

  // Update via cacheManager (menangani Redis + antrean PostgreSQL)
  await cacheManager.updateUserSurvival(userId, patch);

  // Flush langsung ke database PostgreSQL
  await cacheManager.flushUser(userId);
  await cacheManager.flushAll();

  // Invalidate Redis agar cache bersih seketika
  if (redisManager.isReady && redisManager.client) {
    try {
      await redisManager.client.del(`user:survival:${userId}`);
    } catch (_) {}
  }

  // Verifikasi ulang dari cacheManager
  const verified = await cacheManager.getUserSurvival(userId);
  console.log("[Heal] Berhasil dipulihkan! Data sekarang:", {
    userId: verified.userId,
    hp: verified.hp,
    maxHp,
    hunger: verified.hunger,
    thirst: verified.thirst,
    stamina: verified.stamina,
    sick: verified.rpg_state?.sick,
  });

  // Tutup koneksi agar script selesai bersih
  if (redisManager.isReady && redisManager.client) {
    await redisManager.client.quit();
  }
  await sequelize.close();
  console.log("[Heal] Selesai 100%!");
  process.exit(0);
}

run().catch((err) => {
  console.error("[Heal] Error fatal:", err);
  process.exit(1);
});
