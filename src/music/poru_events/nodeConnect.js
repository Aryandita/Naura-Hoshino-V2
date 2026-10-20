// Lokasi: src/events/poru/nodeConnect.js
const GuildSettings = require("../../models/GuildSettings");
const { logger } = require("../../managers/logger");
const {
  lavalinkClusterManager,
} = require("../../managers/lavalinkClusterManager");

module.exports = {
  async execute(manager, node) {
    logger.success(`Koneksi Audio Node [${node.name}] Berhasil & Stabil.`);

    // Reset circuit breaker dan periksa kapabilitas server secara otomatis
    lavalinkClusterManager.recordNodeSuccess(node.name);
    lavalinkClusterManager.probeNodeCapabilities(node).catch(() => {});

    setTimeout(async () => {
      try {
        const allSettings = await GuildSettings.findAll().catch(() => []);
        for (const guildData of allSettings) {
          if (guildData.music?.twentyFourSeven === true) {
            const guild = manager.client.guilds.cache.get(guildData.guildId);
            if (
              guild &&
              guild.channels.cache.has(guildData.music.voiceChannel)
            ) {
              manager.poru.createConnection({
                guildId: guildData.guildId,
                voiceChannel: guildData.music.voiceChannel,
                textChannel: guildData.music.textChannel,
                deaf: true,
              }).is247 = true;
            }
          }
        }
      } catch (e) {
        logger.error("Gagal memulihkan mode 24/7.", e);
      }
    }, 5000);
  },
};
