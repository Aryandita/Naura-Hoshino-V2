"use strict";

const { logger } = require("../managers/logger");
const { buildContainerV2 } = require("./NauraContainerBuilder");
const { getGuildSettings } = require("../managers/cacheManager");

/**
 * Utility untuk mencatat log aksi moderasi, pembelian, atau pengaturan ke channel audit.
 * Mendukung pengiriman menggunakan Discord Components V2.
 */
class AuditLogger {
  /**
   * Mengirim pesan audit ke server yang dikonfigurasi.
   * @param {import('discord.js').Client} client Discord Client
   * @param {string} guildId ID Server (Guild)
   * @param {Object} options Opsi log
   * @param {string} options.action Aksi yang dilakukan (misal: "BAN", "UNBAN", "WARN", "ECONOMY")
   * @param {string} options.description Rincian log
   * @param {import('discord.js').User} options.user Pengguna yang terkena aksi atau melakukan aksi
   * @param {import('discord.js').User} [options.moderator] Pengguna yang mengeksekusi aksi (opsional)
   * @param {string} [options.color] Warna khusus (hex) (default menyesuaikan aksi)
   */
  static async log(client, guildId, options) {
    if (!guildId || !client) return;

    try {
      const settings = await getGuildSettings(guildId);
      const channelId = settings?.settings?.auditLogChannel;
      if (!channelId) return; // Audit log tidak dikonfigurasi

      const guild =
        client.guilds.cache.get(guildId) ||
        (await client.guilds.fetch(guildId).catch(() => null));
      if (!guild) return;

      const channel =
        guild.channels.cache.get(channelId) ||
        (await guild.channels.fetch(channelId).catch(() => null));
      if (!channel) return;

      const { action, description, user, moderator, color } = options;

      // Tentukan warna default jika tidak disetel
      let accentColor = color;
      if (!accentColor) {
        switch (action.toUpperCase()) {
          case "BAN":
          case "KICK":
          case "WARN":
          case "DELETE":
            accentColor = "#EF4444"; // Red
            break;
          case "ECONOMY":
          case "PREMIUM":
            accentColor = "#F59E0B"; // Orange/Gold
            break;
          case "SETTINGS":
            accentColor = "#3B82F6"; // Blue
            break;
          default:
            accentColor = "#10B981"; // Green
        }
      }

      let fullDesc = `**Aksi:** ${action}\n**Rincian:** ${description}`;
      if (user) {
        fullDesc += `\n**Pengguna:** <@${user.id}> (${user.tag} - \`${user.id}\`)`;
      }
      if (moderator) {
        fullDesc += `\n**Eksekutor:** <@${moderator.id}> (${moderator.tag} - \`${moderator.id}\`)`;
      }

      const container = buildContainerV2({
        title: `🛡️ Audit Log: ${action}`,
        description: fullDesc,
        color: accentColor,
        footerText: `Guild ID: ${guildId}`,
      });

      await channel.send(container).catch((err) => {
        logger.warn(
          `[AuditLogger] Gagal mengirim log ke channel ${channelId} di guild ${guildId}: ${err.message}`,
        );
      });
    } catch (e) {
      logger.warn(
        `[AuditLogger] Kesalahan memproses log audit untuk guild ${guildId}: ${e.message}`,
      );
    }
  }
}

module.exports = AuditLogger;
