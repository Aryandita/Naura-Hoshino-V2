const { EmbedBuilder, AuditLogEvent } = require("discord.js");
const cacheManager = require("../managers/cacheManager");
const ui = require("../config/ui");

module.exports = {
  name: "guildMemberUpdate",
  async execute(oldMember, newMember, client) {
    // Abaikan jika bot
    if (newMember.user.bot) return;

    // Ambil ID Channel Log dari Database Automod
    const settings = await cacheManager.getGuildSettings(newMember.guild.id);
    const logChannelId = settings?.settings?.automod?.logChannelId;

    if (!logChannelId) return;

    const logChannel = newMember.guild.channels.cache.get(logChannelId);
    if (!logChannel) return;

    // 1. DETEKSI PERUBAHAN NICKNAME
    if (oldMember.nickname !== newMember.nickname) {
      const oldName = oldMember.nickname || oldMember.user.username;
      const newName = newMember.nickname || newMember.user.username;

      // 🔍 MENCARI PELAKU DARI AUDIT LOG (Bisa diri sendiri atau admin)
      const fetchedLogs = await newMember.guild
        .fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberUpdate })
        .catch(() => null);
      const updateLog = fetchedLogs ? fetchedLogs.entries.first() : null;
      let executorTag = `Diri Sendiri (@${newMember.user.username})`;
      if (
        updateLog &&
        updateLog.target.id === newMember.id &&
        updateLog.executor.id !== newMember.id
      ) {
        const executor = updateLog.executor;
        executorTag = `Moderator: ${executor.globalName || executor.username} (@${executor.username})`;
      }

      const embed = new EmbedBuilder()
        .setColor(ui.getColor("primary"))
        .setAuthor({
          name: newMember.user.tag,
          iconURL: newMember.user.displayAvatarURL(),
        })
        .setTitle(`${ui.getEmoji("rename") || "📝"} Perubahan Identitas`)
        .setDescription(
          `>>> <@${newMember.id}> mengalami perubahan nama panggilan (Nickname).`,
        )
        .addFields(
          { name: "⬅️ Identitas Lama", value: `\`${oldName}\``, inline: true },
          { name: "➡️ Identitas Baru", value: `\`${newName}\``, inline: true },
          {
            name: `${ui.getEmoji("admin") || "🛡️"} Diubah Oleh`,
            value: `\`${executorTag}\``,
            inline: false,
          },
        )
        .setFooter({ text: `User ID: ${newMember.id}` })
        .setTimestamp();

      await logChannel.send({ embeds: [embed] }).catch(() => {});
    }

    // 2. DETEKSI TIMEOUT (ISOLASI)
    if (
      !oldMember.isCommunicationDisabled() &&
      newMember.isCommunicationDisabled()
    ) {
      // Hitung durasi timeout
      const timeoutUntil = new Date(
        newMember.communicationDisabledUntilTimestamp,
      );

      // 🔍 MENCARI PELAKU DARI AUDIT LOG
      const fetchedLogs = await newMember.guild
        .fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberUpdate })
        .catch(() => null);
      const timeoutLog = fetchedLogs ? fetchedLogs.entries.first() : null;
      let executorTag = "Moderator / Sistem";
      if (timeoutLog && timeoutLog.target.id === newMember.id) {
        const executor = timeoutLog.executor;
        executorTag = `${executor.globalName || executor.username} (@${executor.username})`;
      }

      const embed = new EmbedBuilder()
        .setColor(ui.getColor("error"))
        .setAuthor({
          name: newMember.user.tag,
          iconURL: newMember.user.displayAvatarURL(),
        })
        .setTitle(
          `${ui.getEmoji("warning") || "⚠️"} Member Terkena Isolasi (Timeout)`,
        )
        .setDescription(
          `>>> Perhatian! <@${newMember.id}> telah diasingkan sementara dari interaksi publik.`,
        )
        .addFields(
          {
            name: "👤 Eksekutor / Moderator",
            value: `\`${executorTag}\``,
            inline: true,
          },
          {
            name: "⏳ Bebas Pada",
            value: `<t:${Math.floor(timeoutUntil.getTime() / 1000)}:F>\n*(<t:${Math.floor(timeoutUntil.getTime() / 1000)}:R>)*`,
            inline: true,
          },
        )
        .setFooter({ text: `User ID: ${newMember.id}` })
        .setTimestamp();

      await logChannel.send({ embeds: [embed] }).catch(() => {});
    }

    // 3. DETEKSI SERVER BOOST
    if (!oldMember.premiumSince && newMember.premiumSince) {
      // Kita menggunakan variabel 'settings' yang sudah di-fetch di baris atas file ini
      const boostData = settings?.settings?.greetings?.boost;

      if (boostData?.enabled && boostData?.channelId) {
        const boostChannel = newMember.guild.channels.cache.get(
          boostData.channelId,
        );

        if (boostChannel) {
          // Parsing Custom Message
          let customText = boostData.message;
          if (customText) {
            customText = customText
              .replace(/{user}/g, `<@${newMember.id}>`)
              .replace(/{server}/g, `**${newMember.guild.name}**`)
              .replace(/{count}/g, newMember.guild.premiumSubscriptionCount);
          } else {
            customText = `Terima kasih banyak <@${newMember.id}> sudah mem-boost **${newMember.guild.name}**! Server ini sekarang memiliki ${newMember.guild.premiumSubscriptionCount} boosts!`;
          }

          const boostEmbed = new EmbedBuilder()
            .setColor(boostData.color || "#FFD700")
            .setTitle(
              `${ui.getEmoji("booster") || "💎"} Terima Kasih Telah Boosting!`,
            )
            .setDescription(customText)
            .setThumbnail(newMember.user.displayAvatarURL());

          await boostChannel.send({ embeds: [boostEmbed] }).catch(() => {});
        }
      }
    }
  },
};
