const { Events } = require("discord.js");
const { logger } = require("../managers/logger");
const fs = require("fs");
const path = require("path");

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    console.log(
      `\x1b[44m\x1b[37m 🤖 SYSTEM \x1b[0m \x1b[34mNaura Hoshino Online! Terhubung sebagai \x1b[36m${client.user.tag}\x1b[0m`,
    );

    // Load and execute all ready handlers dynamically
    const handlersPath = path.join(__dirname, "ready");
    if (fs.existsSync(handlersPath)) {
      const handlerFiles = fs
        .readdirSync(handlersPath)
        .filter((file) => file.endsWith(".js"));
      for (const file of handlerFiles) {
        try {
          const handler = require(path.join(handlersPath, file));
          if (handler.execute) {
            handler.execute(client);
          }
        } catch (error) {
          logger.error(
            `[READY HANDLER ERROR] Failed to load/execute ${file}:`,
            error,
          );
        }
      }
    }
  },
};
