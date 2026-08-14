const { EmbedBuilder, AuditLogEvent, ChannelType } = require("discord.js");
const GuildSettings = require("../models/GuildSettings");
const cacheManager = require("../managers/cacheManager");
const ui = require("../config/ui");

module.exports = {
  name: "channelDelete",
  async execute(channel, client) {
    if (!channel.guild) return;

    try {
      const settings = await cacheManager.getGuildSettings(channel.guild.id);
      const logChannelId = settings?.settings?.automod?.logChannelId;
      if (!logChannelId) return;

      const logChannel = channel.guild.channels.cache.get(logChannelId);
      if (!logChannel) return;

      let typeName = "Channel Lainnya";
      if (channel.type === ChannelType.GuildText) typeName = "📄 Text Channel";
      if (channel.type === ChannelType.GuildVoice)
        typeName = "🔊 Voice Channel";
      if (channel.type === ChannelType.GuildCategory) typeName = "📁 Kategori";

      // 🔍 MENCARI PELAKU DARI AUDIT LOG
      const fetchedLogs = await channel.guild
        .fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelDelete })
        .catch(() => null);
      const deletionLog = fetchedLogs ? fetchedLogs.entries.first() : null;
      const executor = deletionLog ? deletionLog.executor : null;
      const executorTag = executor
        ? `${executor.globalName || executor.username} (@${executor.username})`
        : "Sistem / Tidak Terdeteksi";

      const embed = new EmbedBuilder()
        .setColor(ui.getColor("error"))
        .setTitle(`${ui.getEmoji("error") || "❌"} Channel Ditutup / Dihapus`)
        .setDescription(`>>> Sebuah channel telah dihapus dari radar server.`)
        .addFields(
          {
            name: `${ui.getEmoji("info") || "ℹ️"} Nama Channel Sebelumnya`,
            value: `\`${channel.name}\``,
            inline: true,
          },
          {
            name: `${ui.getEmoji("desc") || "📋"} Tipe Channel`,
            value: `\`${typeName}\``,
            inline: true,
          },
          {
            name: `${ui.getEmoji("admin") || "🛡️"} Dieksekusi Oleh`,
            value: `\`${executorTag}\``,
            inline: false,
          },
        )
        .setFooter({ text: `Channel ID: ${channel.id}` })
        .setTimestamp();

      await logChannel.send({ embeds: [embed] }).catch(() => {});
    } catch (error) {}
  },
};
