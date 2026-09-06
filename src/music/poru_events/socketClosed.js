const { logger } = require("../../managers/logger");
const cacheManager = require("../../managers/cacheManager");
const { clearTransitionTimers } = require("./autoplayUtils");

module.exports = {
  name: "socketClosed",
  async execute(manager, player, payload) {
    if (!player || !player.is247) return;

    // Kode 4014 artinya terputus (bisa karena region shift atau ditendang).
    // Kode 1000/1006 artinya terputus normal/abnormal dari websocket.
    console.warn(
      `\x1b[43m\x1b[30m ⚠️ VOICE DISCONNECT \x1b[0m Bot terputus dari Voice (Code: ${payload?.code || "Unknown"}). Memeriksa mode 24/7...`,
    );

    // Helper: bersihkan uiCache dan transition timers sebelum destroy
    const cleanupPlayer = () => {
      const oldCache = manager.uiCache.get(player.guildId);
      if (oldCache) {
        if (oldCache.interval) clearInterval(oldCache.interval);
        manager.uiCache.delete(player.guildId);
      }
      clearTransitionTimers(player);
    };

    player.socketRetryCount = (player.socketRetryCount || 0) + 1;
    if (player.socketRetryCount > 5) {
      console.error(
        `\x1b[41m\x1b[37m ⚠️ VOICE RECONNECT FAILED \x1b[0m Gagal menghubungkan 24/7 setelah 5 percobaan. Menghentikan player.`,
      );
      player.socketRetryCount = 0;
      cleanupPlayer();
      player.destroy();
      return;
    }

    const backoffMs = Math.min(
      30000,
      3000 * Math.pow(2, player.socketRetryCount - 1),
    );

    try {
      // Gunakan cacheManager sesuai aturan AGENTS.md 1.9 (bukan GuildSettings.findOrCreate langsung)
      const guildData = await cacheManager.getGuildSettings(player.guildId);

      // Jika 24/7 diaktifkan di server ini
      if (guildData && guildData.music && guildData.music.twentyFourSeven) {
        const voiceChannelId = guildData.music.voiceChannel;

        // Delay bertahap (backoff) untuk menghindari loop spam
        setTimeout(() => {
          const guild = manager.client.guilds.cache.get(player.guildId);
          if (guild && guild.channels.cache.has(voiceChannelId)) {
            console.log(
              `\x1b[42m\x1b[30m ♻️ AUTO RECONNECT \x1b[0m Percobaan #${player.socketRetryCount}: Mengembalikan Naura ke Voice Channel (24/7 Mode)...`,
            );
            const newPlayer = manager.poru.createConnection({
              guildId: player.guildId,
              voiceChannel: voiceChannelId,
              textChannel: player.textChannel || guildData.music.textChannel,
              deaf: true,
            });
            newPlayer.is247 = true;
            newPlayer.socketRetryCount = player.socketRetryCount;
          }
        }, backoffMs);
      } else {
        cleanupPlayer();
        player.destroy();
      }
    } catch (e) {
      logger.error("[SocketClosed] Gagal memulihkan 24/7:", e);
      cleanupPlayer();
      player.destroy();
    }
  },
};
