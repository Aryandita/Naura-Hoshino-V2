const { EmbedBuilder } = require("discord.js");
const { logger } = require("./logger");
const cacheManager = require("./cacheManager");
const ui = require("../config/ui");

/**
 * Mengirim log audit terpusat ke server jika logChannel diatur
 * @param {import('discord.js').Client} client Discord Client
 * @param {string} guildId ID Server
 * @param {string} action Aksi (contoh: KICK, BAN, SETTING_UPDATE)
 * @param {import('discord.js').User} moderator Yang mengeksekusi aksi
 * @param {import('discord.js').User|null} target Target aksi (bila ada)
 * @param {string} reason Alasan / Detail perubahan
 */
  async function sendAuditLog(
    client,
    guildId,
    action,
    moderator,
    target = null,
    reason = "Tidak ada alasan",
    extraFields = [],
  ) {
    try {
      const settings = await cacheManager.getGuildSettings(guildId);
      // Fallback: cek automod.logChannel atau properti spesifik auditLogChannel
      const logChannelId =
        settings?.settings?.auditLogChannel ||
        settings?.settings?.automod?.logChannel ||
        settings?.settings?.automod?.logChannelId;
  
      if (!logChannelId) return; // Tidak ada channel log yang di-set
  
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return;
  
      const logChannel = await guild.channels
        .fetch(logChannelId)
        .catch(() => null);
      if (!logChannel) return;
  
      let color = "#3498db"; // Info color
      if (
        action.includes("BAN") ||
        action.includes("KICK") ||
        action.includes("WARN") ||
        action.includes("DELETE") ||
        action.includes("REMOVE")
      )
        color = "#e74c3c"; // Danger color
      else if (action.includes("UPDATE") || action.includes("SETTING"))
        color = "#f1c40f"; // Warning color
  
      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`📋 Audit Log: ${action}`);
        
      if (moderator) {
        embed.addFields({
          name: "Moderator / Admin",
          value: `<@${moderator.id}> (${moderator.tag || moderator.username})`,
          inline: true,
        });
      }
      
      embed.setTimestamp();
  
      if (target) {
        embed.addFields({
          name: "Target User",
          value: `<@${target.id}> (${target.tag || target.username})`,
          inline: true,
        });
      }
  
      if (reason) embed.addFields({ name: "Detail / Alasan", value: reason });
      if (extraFields && extraFields.length > 0) {
        embed.addFields(extraFields);
      }
    embed.setFooter({ text: ui.getFooter("core") || "Naura Governance" });

    await logChannel.send({ embeds: [embed] });
  } catch (err) {
    logger.error(
      `[AuditLogManager] Gagal mengirim audit log ke guild ${guildId}: ${err.message}`,
    );
  }
}

module.exports = { sendAuditLog };
