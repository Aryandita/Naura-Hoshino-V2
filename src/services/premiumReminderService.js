"use strict";

/**
 * @file premiumReminderService.js
 * @description Layanan pengingat kedaluwarsa VIP cerdas melalui DM ramah Naura
 * 24 jam sebelum masa aktif berakhir dengan tombol perpanjangan.
 */

const { Op } = require("sequelize");
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { logger } = require("../managers/logger");
const UserProfile = require("../models/UserProfile");
const cacheManager = require("../managers/cacheManager");
const { buildContainerV2 } = require("../utils/NauraContainerBuilder");
const ui = require("../config/ui");

const REMINDER_WINDOW_HOURS = 24;
const REMINDER_WINDOW_MS = REMINDER_WINDOW_HOURS * 60 * 60 * 1000;

class PremiumReminderService {
  /**
   * Format cap waktu Discord untuk tampilan ramah
   * @param {Date} date
   * @returns {string}
   */
  formatTimestamp(date) {
    if (!date) return "waktu tidak diketahui";
    const ts = Math.floor(new Date(date).getTime() / 1000);
    return `<t:${ts}:F> (<t:${ts}:R>)`;
  }

  /**
   * Menghasilkan nama representasi tier untuk pesan notifikasi
   * @param {string} tier
   * @returns {string}
   */
  getTierDisplayName(tier) {
    const map = {
      vip_starter: "🌱 Naura VIP Starter",
      starter: "🌱 Naura VIP Starter",
      tier1: "🌸 Naura Supporter",
      supporter: "🌸 Naura Supporter",
      tier2: "💎 Naura VIP Member",
      friends: "💎 Naura Friends",
      tier3: "👑 Naura VIP Bestie (VVIP)",
      vip: "👑 Naura VVIP Elite",
    };
    return map[tier] || "💎 Naura VIP Member";
  }

  /**
   * Membuat Container V2 payload untuk pengingat masa aktif VIP yang akan kedaluwarsa
   * @param {object} params
   * @param {string} [params.username]
   * @param {Date} params.expiryDate
   * @param {string} [params.tier]
   * @returns {object} Container V2 payload
   */
  buildReminderPayload({ username = "Sahabat Naura", expiryDate, tier }) {
    const clock = ui.getEmoji("time") || "⏳";
    const tierName = this.getTierDisplayName(tier);
    const expiryStr = this.formatTimestamp(expiryDate);

    const buttonsRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("premium_renew_click")
        .setLabel("💎 Perpanjang VIP")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("premium_benefits_info")
        .setLabel("📋 Cek Keuntungan VIP")
        .setStyle(ButtonStyle.Secondary),
    );

    return buildContainerV2({
      accentColorHex: ui.getColor("warning") || "#FBBF24",
      authorName: "Naura Hoshino - Pengingat VIP",
      title: `${clock} Masa Aktif VIP Kamu Segera Berakhir`,
      expression: "pleading",
      description: [
        `Hai **${username}**, status **${tierName}** kamu akan berakhir dalam 24 jam ke depan.`,
        ``,
        `📅 **Batas Waktu**: ${expiryStr}`,
        ``,
        `Setelah masa aktif habis, benefit eksklusif seperti kuota obrolan AI tanpa batas, personalisasi sapaan audio AI DJ, dan bingkai hologram Canvas profil akan dinonaktifkan otomatis.`,
        ``,
        `Kamu bisa memperpanjang status kapan saja menggunakan tombol di bawah ini atau melalui menu \`/premium\`.`,
        ``,
        `-# Terima kasih banyak telah mendampingi perjalanan Naura!`,
      ].join("\n"),
      buttonsRow,
      footerText: ui.getFooter("premium"),
    });
  }

  /**
   * Mengirimkan pesan DM pengingat kepada pengguna spesifik
   * @param {object} client - Discord Client
   * @param {string} userId - Snowflake Discord user ID
   * @param {Date} expiryDate - Tanggal kedaluwarsa
   * @param {string} [tier] - Tier premium
   * @param {string} [username] - Nama pengguna
   * @returns {Promise<boolean>}
   */
  async sendExpirationReminder(client, userId, expiryDate, tier, username) {
    if (!client || !userId || !expiryDate) return false;

    try {
      const user = await client.users.fetch(userId).catch(() => null);
      if (!user) {
        logger.warn(`[PremiumReminder] User ${userId} tidak ditemukan di cache/gateway Discord.`);
        return false;
      }

      const payload = this.buildReminderPayload({
        username: username || user.username,
        expiryDate,
        tier,
      });

      await user.send(payload);
      logger.info(`[PremiumReminder] Berhasil mengirimkan pengingat kedaluwarsa ke ${userId} (${user.username}).`);
      return true;
    } catch (dmErr) {
      logger.warn(`[PremiumReminder] Gagal mengirim DM ke user ${userId}: ${dmErr.message}`);
      return false;
    }
  }

  /**
   * Memindai pengguna yang masa aktif VIP-nya akan habis dalam kurun 24 jam dan mengirimkan notifikasi
   * @param {object} client - Discord Client
   * @param {object} [options]
   * @param {number} [options.hoursAhead=24]
   * @param {Date} [options.now=new Date()]
   * @returns {Promise<{checked: number, notified: number, skipped: number, errors: number}>}
   */
  async checkExpiringSubscriptions(client, { hoursAhead = REMINDER_WINDOW_HOURS, now = new Date() } = {}) {
    const stats = { checked: 0, notified: 0, skipped: 0, errors: 0 };
    if (!client) return stats;

    const windowEnd = new Date(now.getTime() + hoursAhead * 3600 * 1000);

    try {
      let profiles = [];

      if (typeof UserProfile.findAll === "function") {
        try {
          profiles = await UserProfile.findAll({
            where: {
              isPremium: true,
              premiumUntil: {
                [Op.gt]: now,
                [Op.lte]: windowEnd,
              },
            },
          });
        } catch (dbErr) {
          logger.warn(`[PremiumReminder] DB query gagal, mencoba in-memory check: ${dbErr.message}`);
        }
      }

      stats.checked = profiles.length;

      for (const profile of profiles) {
        const userId = profile.userId;
        const expiryDate = new Date(profile.premiumUntil);
        const expiryIso = expiryDate.toISOString();

        // Pemeriksaan anti-spam: Jangan kirim berulang untuk siklus expiry yang sama
        const prefs = profile.notification_prefs || {};
        if (prefs.reminded_premium_expiry === expiryIso) {
          stats.skipped++;
          continue;
        }

        const sent = await this.sendExpirationReminder(
          client,
          userId,
          expiryDate,
          profile.premium_tier,
          profile.username,
        );

        if (sent) {
          stats.notified++;
          if (typeof cacheManager.mutateUserProfileJson === "function") {
            await cacheManager.mutateUserProfileJson(userId, "notification_prefs", (cur) => {
              const obj = cur && typeof cur === "object" ? cur : {};
              obj.reminded_premium_expiry = expiryIso;
              obj.last_expiry_reminder_at = new Date().toISOString();
              return obj;
            }).catch(() => {});
          }
        } else {
          stats.errors++;
        }
      }

      logger.info(
        `[PremiumReminder] Pengecekan selesai. Diperiksa: ${stats.checked}, Notifikasi: ${stats.notified}, Dilewati: ${stats.skipped}, Gagal: ${stats.errors}`,
      );
      return stats;
    } catch (err) {
      logger.error("[PremiumReminder] Kesalahan saat memindai langganan:", err.message);
      return stats;
    }
  }
}

const premiumReminderService = new PremiumReminderService();
premiumReminderService.PremiumReminderService = PremiumReminderService;
premiumReminderService.REMINDER_WINDOW_HOURS = REMINDER_WINDOW_HOURS;
premiumReminderService.REMINDER_WINDOW_MS = REMINDER_WINDOW_MS;

module.exports = premiumReminderService;
