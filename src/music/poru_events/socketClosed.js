const { logger } = require("../../managers/logger");
const cacheManager = require("../../managers/cacheManager");
const { clearTransitionTimers } = require("./autoplayUtils");
const { is247Active } = require("../standby247");

const MAX_RETRY_ATTEMPTS = 8;
const BASE_BACKOFF_MS = 2000;
const MAX_BACKOFF_MS = 60000;

function calculateBackoff(attempt) {
  const jitter = Math.random() * 1000;
  return Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * Math.pow(2, attempt - 1) + jitter);
}

module.exports = {
  name: "socketClosed",
  async execute(manager, player, payload) {
    if (!player) return;

    const code = payload?.code || "Unknown";
    const is247 = is247Active(manager, player);
    
    logger.warn(`[SocketClosed] Guild ${player.guildId} disconnected (Code: ${code}, 24/7: ${is247})`);

    const cleanupPlayer = () => {
      const oldCache = manager.uiCache.get(player.guildId);
      if (oldCache) {
        if (oldCache.interval) clearInterval(oldCache.interval);
        manager.uiCache.delete(player.guildId);
      }
      clearTransitionTimers(player);
    };

    player.socketRetryCount = (player.socketRetryCount || 0) + 1;
    
    if (player.socketRetryCount > MAX_RETRY_ATTEMPTS) {
      if (is247) {
        // 24/7 tidak boleh menyerah: tetap mencoba dengan backoff maksimum (60 detik).
        player.socketRetryCount = MAX_RETRY_ATTEMPTS;
      } else {
        logger.error(`[SocketClosed] Max retries (${MAX_RETRY_ATTEMPTS}) exceeded for guild ${player.guildId}. Destroying player.`);
        player.socketRetryCount = 0;
        cleanupPlayer();
        player.destroy();
        return;
      }
    }

    const backoffMs = calculateBackoff(player.socketRetryCount);

    try {
      const guildData = await cacheManager.getGuildSettings(player.guildId);
      const shouldReconnect = is247 || (guildData?.music?.twentyFourSeven === true);

      if (shouldReconnect) {
        const voiceChannelId = player.voiceChannel || guildData?.music?.voiceChannel;
        const textChannelId = player.textChannel || guildData?.music?.textChannel;

        if (!voiceChannelId) {
          logger.warn(`[SocketClosed] No voice channel configured for guild ${player.guildId}. Cannot reconnect.`);
          cleanupPlayer();
          player.destroy();
          return;
        }

        const scheduleReconnect = (delayMs) => {
          const retryTimer = setTimeout(async () => {
            const guild = manager.client.guilds.cache.get(player.guildId);
            const voiceChannel = guild?.channels.cache.get(voiceChannelId);
            const existing = manager.poru.players?.get(player.guildId);

            if (existing && !existing.destroyed && existing !== player) return;

            if (!guild || !voiceChannel) {
              logger.warn(`[SocketClosed] Guild/voice channel ${voiceChannelId} belum tersedia. Mencoba lagi.`);
              player.socketRetryCount = Math.min(player.socketRetryCount + 1, MAX_RETRY_ATTEMPTS);
              scheduleReconnect(calculateBackoff(player.socketRetryCount));
              return;
            }

            try {
              logger.info(`[SocketClosed] Reconnect attempt #${player.socketRetryCount} for guild ${player.guildId}...`);

              const newPlayer = manager.poru.createConnection({
                guildId: player.guildId,
                voiceChannel: voiceChannelId,
                textChannel: textChannelId,
                deaf: true,
              });

              newPlayer.is247 = is247;
              newPlayer.socketRetryCount = player.socketRetryCount;

              logger.info(`[SocketClosed] Successfully reconnected to guild ${player.guildId}`);
            } catch (reconnectErr) {
              logger.error(`[SocketClosed] Reconnect failed for guild ${player.guildId}:`, reconnectErr.message);
              player.socketRetryCount = Math.min(player.socketRetryCount + 1, MAX_RETRY_ATTEMPTS);
              scheduleReconnect(calculateBackoff(player.socketRetryCount));
            }
          }, delayMs);
          if (retryTimer.unref) retryTimer.unref();
        };

        scheduleReconnect(backoffMs);
      } else {
        cleanupPlayer();
        player.destroy();
      }
    } catch (e) {
      logger.error(`[SocketClosed] Error processing disconnect for guild ${player.guildId}:`, e);
      cleanupPlayer();
      player.destroy();
    }
  },
};
