"use strict";

const { logger } = require("../managers/logger");

const EXPIRY_WARNING_MS = 86400000;

class CouponExpiryNotifier {
  /**
   * Scan semua user dengan kupon yang akan expired dalam 24 jam
   * @returns {Promise<Array<{ userId: string, couponType: string, expiresAt: number, hoursLeft: number }>>}
   */
  static async scanExpiringCoupons() {
    try {
      const UserProfile = require("../models/UserProfile");
      const now = Date.now();
      const threshold = now + EXPIRY_WARNING_MS;

      const users = await UserProfile.findAll({
        where: {},
        attributes: ["userId", "premiumTier", "premiumExpiresAt"],
      });

      const expiring = [];
      for (const user of users) {
        if (!user.premiumExpiresAt || user.premiumExpiresAt <= now) continue;
        if (user.premiumExpiresAt <= threshold) {
          const hoursLeft = Math.round((user.premiumExpiresAt - now) / 3600000);
          expiring.push({
            userId: user.userId,
            couponType: user.premiumTier || "vip_starter",
            expiresAt: user.premiumExpiresAt,
            hoursLeft,
          });
        }
      }

      logger.info(`[CouponExpiry] Found ${expiring.length} expiring coupons within 24h`);
      return expiring;
    } catch (error) {
      logger.error("[CouponExpiry] Scan error:", error);
      return [];
    }
  }

  /**
   * Build payload Components V2 untuk notifikasi expiry
   * @param {object} data - { userId, couponType, hoursLeft }
   * @returns {object}
   */
  static buildNotificationPayload(data) {
    return {
      title: "Kupon Premium Segera Berakhir!",
      description: `Halo! Kupon **${data.couponType}** kamu akan berakhir dalam **${data.hoursLeft} jam**.\n\nPerpanjang sekarang agar tidak kehilangan akses fitur premium!`,
      color: 0xFFA500,
      footer: "Gunakan /premium claim atau kunjungi dashboard untuk perpanjang",
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Kirim notifikasi ke user (wrapper aman)
   * @param {object} client - Discord Client
   * @param {object} data
   * @returns {Promise<{ ok: boolean, reason?: string }>}
   */
  static async sendNotification(client, data) {
    try {
      const user = await client.users.fetch(data.userId).catch(() => null);
      if (!user) return { ok: false, reason: "USER_NOT_FOUND" };

      const payload = this.buildNotificationPayload(data);
      await user.send({ embeds: [payload] });

      logger.info(`[CouponExpiry] Notified user ${data.userId}`);
      return { ok: true };
    } catch (error) {
      logger.error(`[CouponExpiry] Send error for ${data.userId}:`, error);
      return { ok: false, reason: "SEND_FAILED" };
    }
  }
}

module.exports = { CouponExpiryNotifier, EXPIRY_WARNING_MS };
