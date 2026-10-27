"use strict";

/**
 * 💎 Premium Reminder Service - VIP Expiry Notifications - Naura Hoshino V2
 * --------------------------------------------------------------------------
 * Orchestrates intelligent VIP expiry reminder notifications via Discord DM.
 * Sends personalized reminders 24 hours before subscription expiration with
 * one-click renewal buttons and anti-spam deduplication.
 *
 * Features:
 * - Automatic 24-hour pre-expiry DM notifications
 * - Personalized tier display names with emoji branding
 * - Discord Components V2 container payloads
 * - Anti-spam deduplication via notification_prefs tracking
 * - Batch scanning of expiring subscriptions
 * - Graceful fallback for DB query failures
 *
 * @module src/services/premiumReminderService
 * @example
 * const premiumReminder = require('./premiumReminderService');
 *
 * // Send individual reminder
 * const sent = await premiumReminder.sendExpirationReminder(
 *   client, userId, expiryDate, 'tier2', 'Username'
 * );
 *
 * // Batch scan and notify all expiring subscriptions
 * const stats = await premiumReminder.checkExpiringSubscriptions(client);
 * console.log(`Notified: ${stats.notified}/${stats.checked}`);
 */

const { Op } = require("sequelize");
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { logger } = require("../managers/logger");
const UserProfile = require("../models/UserProfile");
const cacheManager = require("../managers/cacheManager");
const { buildContainerV2 } = require("../utils/NauraContainerBuilder");
const ui = require("../config/ui");

// ============================================================================
// CONSTANTS
// ============================================================================

/** Discord Snowflake ID validation pattern (17-20 digits) */
const SNOWFLAKE_REGEX = /^\d{17,20}$/;

/** Hours before expiry to send reminder notification */
const REMINDER_WINDOW_HOURS = 24;

/** Reminder window in milliseconds (derived from hours) */
const REMINDER_WINDOW_MS = REMINDER_WINDOW_HOURS * 60 * 60 * 1000;

/** Custom ID for VIP renewal button */
const BUTTON_RENEW_CUSTOM_ID = "premium_renew_click";

/** Custom ID for VIP benefits info button */
const BUTTON_BENEFITS_CUSTOM_ID = "premium_benefits_info";

/** Notification prefs key for tracking sent expiry reminders */
const PREFS_KEY_REMIND_EXPIRY = "reminded_premium_expiry";

/** Notification prefs key for last reminder timestamp */
const PREFS_KEY_LAST_REMINDER_AT = "last_expiry_reminder_at";

/** Tier display name mapping with emoji branding */
const TIER_DISPLAY_NAMES = {
  vip_starter: "🌱 Naura VIP Starter",
  starter: "🌱 Naura VIP Starter",
  tier1: "🌸 Naura Supporter",
  supporter: "🌸 Naura Supporter",
  tier2: "💎 Naura VIP Member",
  friends: "💎 Naura Friends",
  tier3: "👑 Naura VIP Bestie (VVIP)",
  vip: "👑 Naura VVIP Elite",
};

/** Default tier display name when tier is unrecognized */
const DEFAULT_TIER_DISPLAY = "💎 Naura VIP Member";

/** Default username fallback for notifications */
const DEFAULT_USERNAME = "Sahabat Naura";

/** Fallback timestamp text when date is invalid */
const FALLBACK_TIMESTAMP_TEXT = "waktu tidak diketahui";

// ============================================================================
// PREMIUM REMINDER SERVICE CLASS
// ============================================================================

/**
 * Manages VIP expiry reminder notifications via Discord DM.
 * Provides batch scanning, individual sending, and anti-spam deduplication.
 */
class PremiumReminderService {
  /**
   * Format Discord timestamp for user-friendly display.
   * Returns both absolute (F) and relative (R) timestamp formats.
   * @param {Date|string} date - Expiry date to format
   * @returns {string} Formatted Discord timestamp string
   * @example
   * const formatted = service.formatTimestamp(new Date('2025-12-31'));
   * // Returns: "<t:1735689600:F> (<t:1735689600:R>)"
   */
  formatTimestamp(date) {
    if (!date) return FALLBACK_TIMESTAMP_TEXT;
    const ts = Math.floor(new Date(date).getTime() / 1000);
    return `<t:${ts}:F> (<t:${ts}:R>)`;
  }

  /**
   * Get localized tier display name with emoji branding.
   * Maps internal tier identifiers to user-friendly names.
   * @param {string} tier - Internal tier identifier (e.g., 'tier2', 'vip_starter')
   * @returns {string} Display name with emoji prefix
   * @example
   * const name = service.getTierDisplayName('tier3');
   * // Returns: "👑 Naura VIP Bestie (VVIP)"
   */
  getTierDisplayName(tier) {
    return TIER_DISPLAY_NAMES[tier] || DEFAULT_TIER_DISPLAY;
  }

  /**
   * Build Discord Components V2 payload for VIP expiry reminder.
   * Creates a visually rich container with renewal buttons and personalized message.
   * @param {Object} params - Payload parameters
   * @param {string} [params.username='Sahabat Naura'] - User display name
   * @param {Date} params.expiryDate - Subscription expiration date
   * @param {string} [params.tier] - User's premium tier
   * @returns {Object} Container V2 payload ready for Discord API
   * @example
   * const payload = service.buildReminderPayload({
   *   username: 'JohnDoe',
   *   expiryDate: new Date('2025-12-31'),
   *   tier: 'tier2'
   * });
   * await user.send(payload);
   */
  buildReminderPayload({ username = DEFAULT_USERNAME, expiryDate, tier }) {
    const clock = ui.getEmoji("time") || "⏳";
    const tierName = this.getTierDisplayName(tier);
    const expiryStr = this.formatTimestamp(expiryDate);

    const buttonsRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(BUTTON_RENEW_CUSTOM_ID)
        .setLabel("💎 Perpanjang VIP")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(BUTTON_BENEFITS_CUSTOM_ID)
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
   * Send VIP expiry reminder DM to a specific user.
   * Validates user ID, fetches user from Discord, and delivers personalized notification.
   * @param {Object} client - Discord.js Client instance
   * @param {string} userId - Target user's Discord Snowflake ID
   * @param {Date} expiryDate - Subscription expiration date
   * @param {string} [tier] - User's premium tier for display
   * @param {string} [username] - Optional username override
   * @returns {Promise<boolean>} True if DM sent successfully, false otherwise
   * @example
   * const success = await service.sendExpirationReminder(
   *   client, '123456789012345678', new Date('2025-12-31'), 'tier2'
   * );
   */
  async sendExpirationReminder(client, userId, expiryDate, tier, username) {
    if (!client || !userId || !SNOWFLAKE_REGEX.test(String(userId)) || !expiryDate) return false;

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
   * Scan and notify all users with subscriptions expiring within the reminder window.
   * Queries database for active premiums nearing expiration, sends DMs, and marks
   * users as notified to prevent duplicate reminders.
   * @param {Object} client - Discord.js Client instance
   * @param {Object} [options={}] - Scan options
   * @param {number} [options.hoursAhead=24] - Hours ahead to check for expiry
   * @param {Date} [options.now=new Date()] - Reference time for calculation
   * @returns {Promise<ScanStats>} Statistics about the scan operation
   * @example
   * const stats = await service.checkExpiringSubscriptions(client);
   * console.log(`Checked: ${stats.checked}, Notified: ${stats.notified}`);
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
        if (!userId || !SNOWFLAKE_REGEX.test(String(userId))) {
          stats.skipped++;
          continue;
        }
        const expiryDate = new Date(profile.premiumUntil);
        const expiryIso = expiryDate.toISOString();

        const prefs = profile.notification_prefs || {};
        if (prefs[PREFS_KEY_REMIND_EXPIRY] === expiryIso) {
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
              obj[PREFS_KEY_REMIND_EXPIRY] = expiryIso;
              obj[PREFS_KEY_LAST_REMINDER_AT] = new Date().toISOString();
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

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * @typedef {Object} ScanStats
 * @property {number} checked - Total profiles examined
 * @property {number} notified - Successfully sent reminders
 * @property {number} skipped - Skipped (already notified or invalid)
 * @property {number} errors - Failed delivery attempts
 */

// ============================================================================
// GLOBAL INSTANCE & EXPORTS
// ============================================================================

/**
 * Global PremiumReminderService instance for application-wide reminder processing.
 * @type {PremiumReminderService}
 */
const premiumReminderService = new PremiumReminderService();

// Expose class and constants for external use
premiumReminderService.PremiumReminderService = PremiumReminderService;
premiumReminderService.REMINDER_WINDOW_HOURS = REMINDER_WINDOW_HOURS;
premiumReminderService.REMINDER_WINDOW_MS = REMINDER_WINDOW_MS;

module.exports = premiumReminderService;
