const { logger } = require("../../managers/logger");
const cacheManager = require("../../managers/cacheManager");
const { clearTransitionTimers } = require("./autoplayUtils");

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
    const is247 = player.is247 || false;
    
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
      logger.error(`[SocketClosed] Max retries (${MAX_RETRY_ATTEMPTS}) exceeded for guild ${player.guildId}. Destroying player.`);
      player.socketRetryCount = 0;
      cleanupPlayer();
      player.destroy();
      return;
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

        setTimeout(async () => {
          const guild = manager.client.guilds.cache.get(player.guildId);
          if (!guild) {
            logger.warn(`[SocketClosed] Guild ${player.guildId} not found in cache. Skipping reconnect.`);
            return;
          }

          const voiceChannel = guild.channels.cache.get(voiceChannelId);
          if (!voiceChannel) {
            logger.warn(`[SocketClosed] Voice channel ${voiceChannelId} not found. Skipping reconnect.`);
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
          }
        }, backoffMs);
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
