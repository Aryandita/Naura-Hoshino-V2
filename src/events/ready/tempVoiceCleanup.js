const { ChannelType } = require("discord.js");
const { logger } = require("../../managers/logger");

module.exports = {
  name: "tempVoiceCleanup",
  execute(client) {
    // ==========================================
    // 🧹 IN-BOOT TEMP VOICE GARBAGE COLLECTION
    // ==========================================
    try {
      client.trackedTempChannels = client.trackedTempChannels || new Set();

      client.guilds.cache.forEach(async (guild) => {
        const voiceChannels = guild.channels.cache.filter(
          (c) => c.type === ChannelType.GuildVoice,
        );

        for (const [id, channel] of voiceChannels) {
          const name = channel.name;
          const isTempVoice =
            name.startsWith("🔊 ") ||
            name.startsWith("「🌟」・") ||
            name.startsWith("「👑」・") ||
            name.startsWith("⏳ Wait - ");

          if (isTempVoice) {
            if (channel.members.size === 0) {
              await channel
                .delete("Boot cleanup: empty ghost temp voice channel")
                .catch(() => {});
            } else {
              client.trackedTempChannels.add(channel.id);
            }
          }
        }
      });
      console.log(
        "\x1b[46m\x1b[30m 🔊 TEMPVOICE \x1b[0m \x1b[36mPembersihan awal ghost temp voice channel berhasil.\x1b[0m",
      );
    } catch (err) {
      logger.error("[TEMPVOICE BOOT CLEANUP ERROR]", err);
    }

    // ==========================================
    // 🗑️ GARBAGE COLLECTOR TEMP VOICE (Setiap 5 Menit)
    // ==========================================
    const cleanupTimer = setInterval(
      async () => {
        if (
          !client.trackedTempChannels ||
          client.trackedTempChannels.size === 0
        )
          return;

        for (const channelId of client.trackedTempChannels) {
          try {
            const channel = await client.channels
              .fetch(channelId)
              .catch(() => null);
            if (!channel) {
              client.trackedTempChannels.delete(channelId);
              continue;
            }

            if (channel.isVoiceBased() && channel.members.size === 0) {
              await channel
                .delete("Auto-cleanup empty temp voice channel")
                .catch(() => {});
              client.trackedTempChannels.delete(channelId);
            }
          } catch (e) {}
        }
      },
      5 * 60 * 1000,
    );
    // Rule 1.9: timer level-modul wajib unref agar tidak menahan proses
    // saat graceful shutdown.
    if (cleanupTimer.unref) cleanupTimer.unref();
  },
};
