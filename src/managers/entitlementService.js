"use strict";

const UserProfile = require("../models/UserProfile");
const GuildSettings = require("../models/GuildSettings");
const cacheManager = require("./cacheManager");
const { sequelize } = require("./dbManager");

/**
 * Entitlement Service: Agnostik terhadap penyedia webhook (Saweria, Trakteer, dll).
 * Mengelola logic untuk memeriksa, memperpanjang, atau memberikan premium (baik untuk user maupun guild).
 */
class EntitlementService {
  /**
   * Mengecek apakah user memiliki status premium aktif.
   * @param {string} userId
   * @returns {Promise<boolean>}
   */
  static async isUserPremium(userId) {
    const profile = await cacheManager.getUserProfile(userId);
    if (!profile) return false;
    if (
      profile.isPremium &&
      profile.premiumUntil &&
      new Date(profile.premiumUntil) > new Date()
    ) {
      return true;
    }
    return false;
  }

  /**
   * Memperpanjang durasi premium user. Jika sudah expired, dimulai dari waktu sekarang.
   * @param {string} userId
   * @param {number} durationMs Waktu perpanjangan dalam milidetik
   * @returns {Promise<Date>} Waktu kedaluwarsa yang baru
   */
  static async extendUserPremium(userId, durationMs) {
    let expiry = new Date();

    await sequelize.transaction(async (t) => {
      const [profile] = await UserProfile.findOrCreate({
        where: { userId },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      const stillActive =
        profile.isPremium &&
        profile.premiumUntil &&
        new Date(profile.premiumUntil) > new Date();
      const base = stillActive
        ? new Date(profile.premiumUntil).getTime()
        : Date.now();
      expiry = new Date(base + durationMs);

      profile.isPremium = true;
      profile.premiumUntil = expiry;
      await profile.save({ transaction: t });
    });

    return expiry;
  }

  /**
   * Mengecek apakah guild memiliki status premium aktif.
   * Disiapkan untuk Entitlement/Premium Guild ke depannya.
   * @param {string} guildId
   * @returns {Promise<boolean>}
   */
  static async isGuildPremium(guildId) {
    const settings = await cacheManager.getGuildSettings(guildId);
    if (!settings) return false;
    // Misalkan struktur guildSettings menyimpan data premium
    const premiumData = settings.settings?.premium || {};
    if (
      premiumData.active &&
      premiumData.until &&
      new Date(premiumData.until) > new Date()
    ) {
      return true;
    }
    return false;
  }

  /**
   * Adapter handler untuk pembayaran spesifik.
   * Konsep agnostik: Kita meneruskan nominal/tier ke adapter, lalu adapter mengembalikan durasi yang didapat.
   */
  static async handleDonation(userId, amount, adapterName) {
    // Implementasi adapter khusus dapat disuntikkan atau diregister di sini.
    // Contoh ini mengembalikan data mentah tier.
  }
}

module.exports = EntitlementService;
