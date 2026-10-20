const { logger } = require("../../managers/logger");

module.exports = {
  name: "musicInit",
  execute(client) {
    // Initialize the music manager jika file dan fungsi tersedia
    try {
      if (
        client.musicManager &&
        typeof client.musicManager.initialize === "function"
      ) {
        client.musicManager.initialize();
        logger.music("Music Manager siap!");
      }
    } catch (err) {
      logger.error("[MUSIC MANAGER INIT ERROR]", err);
    }
  },
};
