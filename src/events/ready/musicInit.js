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
        console.log(
          "\x1b[45m\x1b[37m 🎵 MUSIC \x1b[0m \x1b[35mMusic Manager siap!\x1b[0m",
        );
      }
    } catch (err) {
      logger.error("[MUSIC MANAGER INIT ERROR]", err);
    }
  },
};
