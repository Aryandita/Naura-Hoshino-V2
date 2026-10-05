"use strict";

const { sequelize } = require("../src/managers/dbManager");
const UserProfile = require("../src/models/UserProfile");
const store = require("../src/premium/premiumStore");
const cacheManager = require("../src/managers/cacheManager");
const redisManager = require("../src/managers/redisManager");
const ui = require("../src/config/ui");
const { tierDisplayName } = require("../src/premium/premiumTiers");

async function run() {
  const env = require("../src/config/env");
  const targetId = process.argv[2] || (env.OWNER_IDS && env.OWNER_IDS[0]) || "795241173009825853";
  const daysNum = Math.max(1, parseInt(process.argv[3], 10) || 30);
  const action = (process.argv[4] || "grant").toLowerCase().trim();
  const userId = String(targetId).trim();

  console.log(`[Premium CLI] Memproses aksi "${action}" untuk userId: ${userId} (${daysNum} hari)`);

  const [profile] = await UserProfile.findOrCreate({ where: { userId } });

  if (action === "revoke" || action === "cabut") {
    await store.revokePremium(userId, profile);
    await cacheManager.flushUser(userId);
    console.log(`[Premium CLI] Status VIP Premium untuk user ${userId} berhasil DICABUT.`);
  } else {
    const newExpiry = await store.grantPremium(userId, profile, daysNum);
    const tierKey = ui.getPremiumTier(daysNum, true);
    const displayName = tierDisplayName(tierKey, daysNum);
    await cacheManager.flushUser(userId);

    console.log(`[Premium CLI] Berhasil menanamkan status ${displayName} (${daysNum} hari) untuk user ${userId}.`);
    console.log(`[Premium CLI] Masa berlaku hingga: ${newExpiry.toISOString()}`);
  }

  // Bersihkan cache redis
  if (redisManager.isReady && redisManager.client) {
    try {
      await redisManager.client.del(`user:profile:${userId}`);
      await redisManager.client.quit();
    } catch (_) {}
  }

  await sequelize.close();
  console.log("[Premium CLI] Selesai 100%!");
  process.exit(0);
}

run().catch((err) => {
  console.error("[Premium CLI] Error fatal:", err);
  process.exit(1);
});
