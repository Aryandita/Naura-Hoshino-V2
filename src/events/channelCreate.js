const { EmbedBuilder, AuditLogEvent, ChannelType } = require("discord.js");
const cacheManager = require("../managers/cacheManager");
const ui = require("../config/ui");

module.exports = {
  name: "channelCreate",
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
        .fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelCreate })
        .catch(() => null);
      const creationLog = fetchedLogs ? fetchedLogs.entries.first() : null;
      const executor = creationLog ? creationLog.executor : null;
      const executorTag = executor
        ? `${executor.globalName || executor.username} (@${executor.username})`
        : "Sistem / Tidak Terdeteksi";

      const embed = new EmbedBuilder()
        .setColor(ui.getColor("success"))
        .setTitle(`${ui.getEmoji("success") || "✅"} Ruang Baru Dibuka!`)
        .setDescription(`>>> Sebuah channel komunitas baru saja diciptakan.`)
        .addFields(
          {
            name: `${ui.getEmoji("info") || "ℹ️"} Nama & Link`,
            value: `${channel.name} (<#${channel.id}>)`,
            inline: true,
          },
          {
            name: `${ui.getEmoji("desc") || "📋"} Tipe Channel`,
            value: `\`${typeName}\``,
            inline: true,
          },
          {
            name: `${ui.getEmoji("desc") || "📁"} Kategori Induk`,
            value: channel.parent
              ? `\`${channel.parent.name}\``
              : "`(Berada di Root)`",
            inline: false,
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
    } catch (error) {
      // Abaikan error diam-diam agar tidak spam konsol
    }
  },
};
