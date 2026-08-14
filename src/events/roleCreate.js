const { EmbedBuilder, AuditLogEvent } = require("discord.js");
const GuildSettings = require("../models/GuildSettings");
const cacheManager = require("../managers/cacheManager");
const ui = require("../config/ui");

module.exports = {
  name: "roleCreate",
  async execute(role, client) {
    try {
      const settings = await cacheManager.getGuildSettings(role.guild.id);
      const logChannelId = settings?.settings?.automod?.logChannelId;
      if (!logChannelId) return;

      const logChannel = role.guild.channels.cache.get(logChannelId);
      if (!logChannel) return;

      // 🔍 MENCARI PELAKU DARI AUDIT LOG
      const fetchedLogs = await role.guild
        .fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleCreate })
        .catch(() => null);
      const roleLog = fetchedLogs ? fetchedLogs.entries.first() : null;
      const executor = roleLog ? roleLog.executor : null;
      const executorTag = executor
        ? `${executor.globalName || executor.username} (@${executor.username})`
        : "Sistem / Tidak Terdeteksi";

      const embed = new EmbedBuilder()
        .setColor(ui.getColor("success"))
        .setTitle(`${ui.getEmoji("success") || "✅"} Role Baru Diciptakan`)
        .setDescription(
          `>>> Role <@&${role.id}> baru saja ditambahkan ke dalam server.`,
        )
        .addFields(
          {
            name: `${ui.getEmoji("info") || "ℹ️"} Nama Role`,
            value: `\`${role.name}\``,
            inline: true,
          },
          {
            name: `${ui.getEmoji("desc") || "🎨"} Warna (Hex)`,
            value: `\`${role.hexColor}\``,
            inline: true,
          },
          {
            name: `${ui.getEmoji("admin") || "🛡️"} Dieksekusi Oleh`,
            value: `\`${executorTag}\``,
            inline: false,
          },
        )
        .setFooter({ text: `Role ID: ${role.id}` })
        .setTimestamp();

      await logChannel.send({ embeds: [embed] }).catch(() => {});
    } catch (error) {}
  },
};
