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
    const raw = await redisManager.get(`mc:link:code:${code}`);
    if (!raw) return null;

    const data = JSON.parse(raw);
    const link = await MinecraftLink.findOne({
      where: { userId: data.userId },
    });
    if (!link) return null;

    link.isVerified = true;
    link.verificationCode = null;
    link.lastSyncedAt = new Date();
    await link.save({
      fields: ["isVerified", "verificationCode", "lastSyncedAt"],
    });
    await redisManager.del(`mc:link:code:${code}`);

    // Bonus Star Fragments untuk penautan pertama
    await currency.reward(
      data.userId,
      { starFragments: 500 },
      "Minecraft Account Linking Bonus",
    );

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
      userId,
      { starFragments: rewardFrags, coupons: rewardCoupons },
      "Minecraft Playtime Realm Sync",
    );

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
