"use strict";

const { MessageFlags } = require("discord.js");
const arcadeContract = require("../domain/contracts/arcadeContract");
const { logger } = require("../managers/logger");
const ui = require("../config/ui");
const languageManager = require("../managers/languageManager");

const DAILY_REMINDER_HOUR = 7; // 07:00 UTC

class ArcadeDailyService {
  constructor() {
    this.client = null;
    this.reminderInterval = null;
  }

  /**
   * Inisialisasi service dengan Discord client
   * @param {Client} client
   */
  init(client) {
    this.client = client;
    this.startReminderLoop();
    logger.info("[ArcadeDailyService] Inisialisasi selesai, reminder loop dimulai");
  }

  /**
   * Memulai loop reminder harian jam 07:00 UTC
   */
  startReminderLoop() {
    if (this.reminderInterval) {
      clearInterval(this.reminderInterval);
    }

    const checkAndRemind = async () => {
      const now = new Date();
      if (now.getUTCHours() === DAILY_REMINDER_HOUR && now.getUTCMinutes() === 0) {
        await this.sendDailyReminders();
      }
    };

    // Cek setiap menit
    this.reminderInterval = setInterval(checkAndRemind, 60000);
    if (this.reminderInterval.unref) this.reminderInterval.unref();

    // Jalankan sekali di awal untuk menangkap jam 07:00 jika baru start
    checkAndRemind();
  }

  /**
   * Mengirim reminder daily ke semua user yang belum klaim
   */
  async sendDailyReminders() {
    if (!this.client || !this.client.isReady()) return;

    try {
      const users = await this.getUsersWithMP();
      let sent = 0;
      let failed = 0;

      for (const userId of users) {
        const claimed = await arcadeContract.hasClaimedDaily(userId);
        if (claimed) continue;

        try {
          const user = await this.client.users.fetch(userId);
          if (!user) continue;

          const lang = await this.getUserLang(userId);
          const dmSent = await this.sendReminderDM(user, lang);
          if (dmSent) sent++;
        } catch (err) {
          failed++;
          logger.debug(`[ArcadeDailyService] Gagal kirim DM ke ${userId}:`, err.message);
        }

        // Rate limit: jeda 100ms per user
        await new Promise((r) => setTimeout(r, 100));
      }

      logger.info(`[ArcadeDailyService] Daily reminder terkirim: ${sent} sukses, ${failed} gagal`);
    } catch (err) {
      logger.error("[ArcadeDailyService] Error sendDailyReminders:", err.message);
    }
  }

  /**
   * Mendapatkan daftar user yang punya MP > 0 (aktif di arcade)
   * @returns {Promise<string[]>}
   */
  async getUsersWithMP() {
    const UserProfile = require("../models/UserProfile");
    try {
      const profiles = await UserProfile.findAll({
        where: {
          medaliPermainan: { [require("sequelize").Op.gt]: 0 },
        },
        attributes: ["userId"],
        raw: true,
      });
      return profiles.map((p) => p.userId);
    } catch (err) {
      logger.error("[ArcadeDailyService] getUsersWithMP error:", err.message);
      return [];
    }
  }

  /**
   * Mendapatkan preferensi bahasa user
   * @param {string} userId
   * @returns {Promise<string>}
   */
  async getUserLang(userId) {
    const UserProfile = require("../models/UserProfile");
    try {
      const profile = await UserProfile.findByPk(userId, { attributes: ["language"] });
      return profile?.language || "id";
    } catch {
      return "id";
    }
  }

  /**
   * Mengirim DM reminder
   * @param {import("discord.js").User} user
   * @param {string} lang
   * @returns {Promise<boolean>}
   */
  async sendReminderDM(user, lang) {
    try {
      const emoji = ui.getEmoji("medali_permainan") || "🏅";
      const t = (key) => languageManager.translateSync(lang, key);

      const content = [
        `${emoji} **Pengingat Harian Arcade!**`,
        "",
        t("arcade.daily_reminder.body"),
        "",
        `> ${emoji} **Hadiah:** \`+${50} MP\` (Medali Permainan)`,
        `> 🎮 **Gunakan untuk:** Minigame, Gacha Arcade, Leaderboard`,
        "",
        t("arcade.daily_reminder.footer"),
      ].join("\n");

      await user.send({
        content,
        flags: MessageFlags.Ephemeral,
      });
      return true;
    } catch (err) {
      logger.debug(`[ArcadeDailyService] DM blocked/failed for ${user.id}:`, err.message);
      return false;
    }
  }

  /**
   * Manual trigger reminder untuk testing/admin
   * @param {string} userId
   */
  async triggerReminderForUser(userId) {
    if (!this.client) return false;
    try {
      const user = await this.client.users.fetch(userId);
      const lang = await this.getUserLang(userId);
      return await this.sendReminderDM(user, lang);
    } catch (err) {
      logger.error("[ArcadeDailyService] Manual trigger error:", err.message);
      return false;
    }
  }

  /**
   * Hentikan service
   */
  stop() {
    if (this.reminderInterval) {
      clearInterval(this.reminderInterval);
      this.reminderInterval = null;
    }
  }
}

module.exports = new ArcadeDailyService();