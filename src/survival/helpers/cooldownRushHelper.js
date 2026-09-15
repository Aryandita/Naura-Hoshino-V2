"use strict";

const { ButtonBuilder, ButtonStyle } = require("discord.js");
const cacheManager = require("../../managers/cacheManager");
const redisManager = require("../../managers/redisManager");
const ui = require("../../config/ui");
const { buildContainerV2 } = require("../../utils/NauraContainerBuilder");

const RUSH_COUPON_COST = 1;

class CooldownRushHelper {
  /**
   * Eksekusi penghapusan cooldown berbayar 1 Naura Coupon secara atomik
   * @param {string} userId
   * @param {string} cooldownKey - misal 'work', 'study', 'hunt', 'collect', dll.
   * @returns {Promise<{ success: boolean, message: string, remainingCoupons: number }>}
   */
  static async executeRush(userId, cooldownKey) {
    if (!userId || !cooldownKey) {
      return {
        success: false,
        message: "Parameter pengguna atau cooldown tidak valid.",
        remainingCoupons: 0,
      };
    }

    const survival = await cacheManager.getUserSurvival(userId);
    const coupons = Number(survival?.coupons) || 0;

    if (coupons < RUSH_COUPON_COST) {
      return {
        success: false,
        message: `Naura Coupon kamu tidak cukup! Butuh ${RUSH_COUPON_COST} Coupon untuk melakukan Rush Cooldown (punyamu: ${coupons} Coupon).`,
        remainingCoupons: coupons,
      };
    }

    // Debit atomik 1 kupon
    const debitOk = await cacheManager.debitUserSurvival(
      userId,
      "coupons",
      RUSH_COUPON_COST,
    );
    if (!debitOk) {
      return {
        success: false,
        message: "Gagal memotong Naura Coupon. Saldo tidak mencukupi atau transaksi bentrok.",
        remainingCoupons: coupons,
      };
    }

    // Bersihkan cooldown di Redis
    if (redisManager.isReady) {
      await redisManager.deleteCache(`cooldown:${cooldownKey}:${userId}`);
      await redisManager.deleteCache(`ratelimit:${cooldownKey}:${userId}`);
    }

    // Bersihkan cooldown di rpg_state bila ada
    try {
      await cacheManager.mutateUserSurvivalJson(userId, "rpg_state", (state) => {
        const s = state || {};
        if (s[`${cooldownKey}_cd`]) s[`${cooldownKey}_cd`] = 0;
        if (s.test_cd && cooldownKey === "study") s.test_cd = 0;
        return s;
      });
    } catch (_err) {}

    const updatedSurvival = await cacheManager.getUserSurvival(userId);
    const remainingCoupons = Number(updatedSurvival?.coupons) || 0;

    return {
      success: true,
      message: `⚡ **Rush Berhasil!** Cooldown untuk \`${cooldownKey}\` telah direset seketika! (Sisa Coupon: **${remainingCoupons}**).`,
      remainingCoupons,
    };
  }

  /**
   * Buat tombol interaktif Rush Cooldown
   * @param {string} cooldownKey
   * @returns {ButtonBuilder}
   */
  static buildRushButton(cooldownKey) {
    return new ButtonBuilder()
      .setCustomId(`rush_cd_${cooldownKey}`)
      .setLabel("⚡ Rush (1 Coupon)")
      .setStyle(ButtonStyle.Success);
  }

  /**
   * Bangun container notifikasi bahwa cooldown sedang aktif dengan opsi Rush
   * @param {object} params
   * @returns {object} Discord Components V2 container payload
   */
  static buildCooldownPrompt({ title, activityName, cooldownKey, remainingSeconds }) {
    const minutes = Math.ceil(remainingSeconds / 60);
    const rushBtn = this.buildRushButton(cooldownKey);

    return buildContainerV2({
      accentColorHex: ui.getColor("warning") || "#F59E0B",
      authorName: "Naura Survival Cooldown",
      title: title || "⏳ Sedang Dalam Masa Istirahat",
      description: [
        `Kamu baru saja melakukan **${activityName}**. Silakan tunggu sekitar **${minutes} menit** lagi sebelum bisa melakukannya kembali.`,
        "",
        `💡 *Tidak sabar menunggu? Tekan tombol **Rush** di bawah untuk melewati masa cooldown seketika dengan 1 Naura Coupon!*`,
      ].join("\n"),
      buttonsRow: {
        components: [rushBtn],
      },
      footerText: ui.getFooter("survival"),
    });
  }
}

module.exports = CooldownRushHelper;
