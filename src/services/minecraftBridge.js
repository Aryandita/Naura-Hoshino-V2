"use strict";

const MinecraftLink = require("../models/MinecraftLink");
const currency = require("../survival/engines/currency");
const redisManager = require("../managers/redisManager");

class MinecraftBridgeService {
  /**
   * Buat kode verifikasi unik untuk penautan akun in-game.
   */
  static async generateLinkCode(userId, mcUsername) {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    await redisManager.set(
      `mc:link:code:${code}`,
      JSON.stringify({ userId, mcUsername }),
      "EX",
      900,
    ); // 15 menit

    const [link] = await MinecraftLink.findOrCreate({
      where: { userId },
      defaults: { mcUsername, verificationCode: code, isVerified: false },
    });

    link.mcUsername = mcUsername;
    link.verificationCode = code;
    await link.save({ fields: ["mcUsername", "verificationCode"] });

    return code;
  }

  /**
   * Verifikasi penautan akun Minecraft (bisa dipanggil dari console/RCON/webhook).
   */
  static async verifyAccount(code) {
    let userId = null;

    try {
      const raw = await redisManager.get(`mc:link:code:${code}`);
      if (raw) {
        const data = JSON.parse(raw);
        userId = data.userId;
      }
    } catch (_) {}

    let link = null;
    if (userId) {
      link = await MinecraftLink.findOne({ where: { userId } });
    }

    // Fallback: cari langsung dari database berdasarkan verificationCode
    if (!link && code) {
      link = await MinecraftLink.findOne({ where: { verificationCode: String(code).trim() } });
      if (link) {
        userId = link.userId;
      }
    }

    if (!link) return null;

    link.isVerified = true;
    link.verificationCode = null;
    link.lastSyncedAt = new Date();
    await link.save({
      fields: ["isVerified", "verificationCode", "lastSyncedAt"],
    });

    try {
      await redisManager.del(`mc:link:code:${code}`);
    } catch (_) {}

    // Bonus Star Fragments untuk penautan pertama
    try {
      await currency.reward(
        "starFragments",
        { userId: link.userId },
        500,
      );
    } catch (_) {}

    return link;
  }

  /**
   * Verifikasi paksa oleh Administrator Discord tanpa memerlukan kode in-game.
   */
  static async adminVerifyAccount(userId, mcUsername) {
    const [link] = await MinecraftLink.findOrCreate({
      where: { userId },
      defaults: { mcUsername, isVerified: true, verificationCode: null, lastSyncedAt: new Date() },
    });

    link.mcUsername = mcUsername;
    link.isVerified = true;
    link.verificationCode = null;
    link.lastSyncedAt = new Date();
    await link.save({
      fields: ["mcUsername", "isVerified", "verificationCode", "lastSyncedAt"],
    });

    try {
      await currency.reward(
        "starFragments",
        { userId },
        500,
      );
    } catch (_) {}

    return link;
  }

  /**
   * Sinkronisasi reward in-game Minecraft ke Discord Survival economy.
   */
  static async syncRewards(userId) {
    const link = await MinecraftLink.findOne({
      where: { userId, isVerified: true },
    });
    if (!link) {
      return {
        success: false,
        message: "Akun Minecraft belum ditautkan atau belum diverifikasi.",
      };
    }

    const now = Date.now();
    const lastSync = link.lastSyncedAt
      ? new Date(link.lastSyncedAt).getTime()
      : 0;
    const hoursSince = Math.floor((now - lastSync) / (1000 * 60 * 60));

    if (hoursSince < 1) {
      return {
        success: false,
        message:
          "Sinkronisasi reward hanya dapat dilakukan setiap 1 jam sekali.",
      };
    }

    const rewardFrags = Math.min(2000, hoursSince * 100);
    const rewardCoupons = hoursSince >= 24 ? 1 : 0;

    await currency.reward(
      "starFragments",
      { userId },
      rewardFrags,
    );
    if (rewardCoupons > 0) {
      await currency.reward("coupons", { userId }, rewardCoupons);
    }

    link.lastSyncedAt = new Date();
    link.totalSyncRewards = (link.totalSyncRewards || 0) + rewardFrags;
    await link.save({ fields: ["lastSyncedAt", "totalSyncRewards"] });

    return {
      success: true,
      starFragments: rewardFrags,
      coupons: rewardCoupons,
      mcUsername: link.mcUsername,
    };
  }
}

module.exports = MinecraftBridgeService;
