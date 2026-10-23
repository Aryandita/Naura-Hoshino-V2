"use strict";
const { logger } = require("../../managers/logger");

const { ButtonBuilder, ButtonStyle } = require("discord.js");
const cacheManager = require("../../managers/cacheManager");
const redisManager = require("../../managers/redisManager");
const ui = require("../../config/ui");
const { buildContainerV2 } = require("../../utils/NauraContainerBuilder");

const RUSH_COUPON_COST = 1;

class CooldownRushHelper {
  /**
   * Eksekusi penghapusan cooldown berbayar 1 Voucher Beasiswa secara atomik
   * @param {string} userId
   * @param {string} cooldownKey - misal 'work', 'study', 'hunt', 'collect', dll.
   * @returns {Promise<{ success: boolean, message: string, remainingscholarshipVouchers: number }>}
   */
  static async executeRush(userId, cooldownKey) {
    if (!userId || !cooldownKey) {
      return {
        success: false,
        message: "Parameter pengguna atau cooldown tidak valid.",
        remainingscholarshipVouchers: 0,
      };
    }

    const survival = await cacheManager.getUserSurvival(userId);
    const scholarshipVouchers = Number(survival?.scholarshipVouchers) || 0;

    if (scholarshipVouchers < RUSH_COUPON_COST) {
      return {
        success: false,
        message: `Voucher Beasiswa kamu tidak cukup! Butuh ${RUSH_COUPON_COST} Coupon untuk melakukan Rush Cooldown (punyamu: ${scholarshipVouchers} Coupon).`,
        remainingscholarshipVouchers: scholarshipVouchers,
      };
    }

    // Debit atomik 1 kupon
    const debitOk = await cacheManager.debitUserSurvival(
      userId,
      "scholarshipVouchers",
      RUSH_COUPON_COST,
    );
    if (!debitOk?.ok) {
      return {
        success: false,
        message: "Gagal memotong Voucher Beasiswa. Saldo tidak mencukupi atau transaksi bentrok.",
        remainingscholarshipVouchers: scholarshipVouchers,
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
    } catch (_err) {
      logger.error("[cooldownRushHelper:executeRush] Mutasi saldo ekonomi/survival gagal: " + (_err?.message || _err), _err);
    }

    const updatedSurvival = await cacheManager.getUserSurvival(userId);
    const remainingscholarshipVouchers = Number(updatedSurvival?.scholarshipVouchers) || 0;

    return {
      success: true,
      message: `⚡ **Rush Berhasil!** Cooldown untuk \`${cooldownKey}\` telah direset seketika! (Sisa Coupon: **${remainingscholarshipVouchers}**).`,
      remainingscholarshipVouchers,
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
        `💡 *Tidak sabar menunggu? Tekan tombol **Rush** di bawah untuk melewati masa cooldown seketika dengan 1 Voucher Beasiswa!*`,
      ].join("\n"),
      buttonsRow: {
        components: [rushBtn],
      },
      footerText: ui.getFooter("survival"),
    });
  }
}

module.exports = CooldownRushHelper;
