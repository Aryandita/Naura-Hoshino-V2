"use strict";

const crypto = require("crypto");
const MinecraftLink = require("../models/MinecraftLink");
const currency = require("../survival/engines/currency");
const redisManager = require("../managers/redisManager");
const { logger } = require("../managers/logger");

const CODE_TTL_SECONDS = 900; // 15 menit
const CODE_TTL_MS = CODE_TTL_SECONDS * 1000;
const FIRST_LINK_BONUS = 500;

// Catatan waktu penerbitan kode di memori untuk penegakan TTL ketat saat Redis fallback
const codeIssuedAtMap = new Map();
// Mutex per-user untuk mencegah race condition / double claim pada verifikasi & sync
const userLocks = new Map();

async function withUserLock(userId, fn) {
  const key = String(userId || "global");
  const prev = userLocks.get(key) || Promise.resolve();
  let release;
  const next = new Promise((resolve) => {
    release = resolve;
  });
  userLocks.set(
    key,
    prev.then(() => next),
  );
  try {
    await prev;
    return await fn();
  } finally {
    release();
    if (userLocks.get(key) === next) {
      userLocks.delete(key);
    }
  }
}

class MinecraftBridgeService {
  /**
   * Buat kode verifikasi 6 digit kriptografis untuk penautan akun in-game.
   */
  static async generateLinkCode(userId, mcUsername) {
    const cleanCode = crypto.randomInt(100000, 1000000).toString();
    const now = Date.now();
    codeIssuedAtMap.set(cleanCode, { userId, mcUsername, issuedAt: now });

    await redisManager.set(
      `mc:link:code:${cleanCode}`,
      JSON.stringify({ userId, mcUsername, issuedAt: now }),
      "EX",
      CODE_TTL_SECONDS,
    );

    const [link] = await MinecraftLink.findOrCreate({
      where: { userId },
      defaults: {
        mcUsername,
        verificationCode: cleanCode,
        isVerified: false,
      },
    });

    link.mcUsername = mcUsername;
    link.verificationCode = cleanCode;
    await link.save({ fields: ["mcUsername", "verificationCode"] });

    return cleanCode;
  }

  /**
   * Verifikasi penautan akun Minecraft (dari console/RCON/webhook).
   * Menegakkan TTL 15 menit, one-time code, dan bonus +500 hanya satu kali per akun.
   */
  static async verifyAccount(code) {
    const cleanCode = String(code || "").trim();
    if (!/^\d{6}$/.test(cleanCode)) return null;

    let userId = null;
    let redisHit = false;

    try {
      const raw = await redisManager.get(`mc:link:code:${cleanCode}`);
      if (raw) {
        const data = JSON.parse(raw);
        if (!data.issuedAt || Date.now() - Number(data.issuedAt) <= CODE_TTL_MS) {
          userId = data.userId;
          redisHit = true;
        }
      }
    } catch (err) {
      logger.debug(`[MinecraftBridge] Redis get gagal: ${err?.message || err}`);
    }

    let link = null;
    if (userId) {
      link = await MinecraftLink.findOne({ where: { userId } });
    }

    // Fallback ke database dengan pemeriksaan masa berlaku 15 menit yang ketat
    if (!link) {
      const candidate = await MinecraftLink.findOne({
        where: { verificationCode: cleanCode },
      });
      if (candidate) {
        const memEntry = codeIssuedAtMap.get(cleanCode);
        const updatedTime = candidate.updatedAt
          ? new Date(candidate.updatedAt).getTime()
          : 0;
        const issuedAt = memEntry?.issuedAt || updatedTime;
        const isExpired = issuedAt > 0 && Date.now() - issuedAt > CODE_TTL_MS;

        if (isExpired && !redisHit) {
          candidate.verificationCode = null;
          await candidate.save({ fields: ["verificationCode"] }).catch(() => {});
          codeIssuedAtMap.delete(cleanCode);
          return null;
        }
        link = candidate;
        userId = candidate.userId;
      }
    }

    if (!link) return null;

    return withUserLock(link.userId, async () => {
      // Pastikan kode belum dikonsumsi oleh request paralel
      if (link.verificationCode && link.verificationCode !== cleanCode) {
        return null;
      }

      const alreadyRewarded = Boolean(
        link.isVerified || Number(link.totalSyncRewards) > 0,
      );

      link.isVerified = true;
      link.verificationCode = null;
      link.lastSyncedAt = new Date();
      const saveFields = ["isVerified", "verificationCode", "lastSyncedAt"];

      let bonusGranted = false;
      if (!alreadyRewarded) {
        try {
          await currency.reward("starFragments", { userId: link.userId }, FIRST_LINK_BONUS);
          link.totalSyncRewards = (Number(link.totalSyncRewards) || 0) + FIRST_LINK_BONUS;
          saveFields.push("totalSyncRewards");
          bonusGranted = true;
        } catch (err) {
          logger.warn(
            `[MinecraftBridge] Gagal memberikan bonus penautan ke ${link.userId}: ${err?.message || err}`,
          );
        }
      }

      await link.save({ fields: saveFields });
      link.bonusGranted = bonusGranted;

      codeIssuedAtMap.delete(cleanCode);
      try {
        await redisManager.del(`mc:link:code:${cleanCode}`);
      } catch (err) {
        logger.debug(`[MinecraftBridge] Redis del gagal: ${err?.message || err}`);
      }

      return link;
    });
  }

  /**
   * Verifikasi paksa oleh Administrator Discord tanpa memerlukan kode in-game.
   */
  static async adminVerifyAccount(userId, mcUsername) {
    return withUserLock(userId, async () => {
      const [link, created] = await MinecraftLink.findOrCreate({
        where: { userId },
        defaults: {
          mcUsername,
          isVerified: true,
          verificationCode: null,
          lastSyncedAt: new Date(),
        },
      });

      const alreadyRewarded =
        !created && Boolean(link.isVerified || Number(link.totalSyncRewards) > 0);

      link.mcUsername = mcUsername;
      link.isVerified = true;
      link.verificationCode = null;
      link.lastSyncedAt = new Date();
      const saveFields = [
        "mcUsername",
        "isVerified",
        "verificationCode",
        "lastSyncedAt",
      ];

      let bonusGranted = false;
      if (!alreadyRewarded) {
        try {
          await currency.reward("starFragments", { userId }, FIRST_LINK_BONUS);
          link.totalSyncRewards = (Number(link.totalSyncRewards) || 0) + FIRST_LINK_BONUS;
          saveFields.push("totalSyncRewards");
          bonusGranted = true;
        } catch (err) {
          logger.warn(
            `[MinecraftBridge] Gagal memberikan bonus admin-verify ke ${userId}: ${err?.message || err}`,
          );
        }
      }

      await link.save({ fields: saveFields });
      link.bonusGranted = bonusGranted;
      return link;
    });
  }

  /**
   * Sinkronisasi reward in-game Minecraft ke Discord Survival economy.
   * Dilindungi mutex per-user untuk mencegah klaim ganda (race condition).
   */
  static async syncRewards(userId) {
    return withUserLock(userId, async () => {
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

      // Perbarui timestamp terlebih dahulu sebelum distribusi mata uang
      link.lastSyncedAt = new Date();
      link.totalSyncRewards = (Number(link.totalSyncRewards) || 0) + rewardFrags;
      await link.save({ fields: ["lastSyncedAt", "totalSyncRewards"] });

      await currency.reward("starFragments", { userId }, rewardFrags);
      if (rewardCoupons > 0) {
        await currency.reward("coupons", { userId }, rewardCoupons);
      }

      return {
        success: true,
        starFragments: rewardFrags,
        coupons: rewardCoupons,
        mcUsername: link.mcUsername,
      };
    });
  }
}

module.exports = MinecraftBridgeService;
