const { logger } = require("../../managers/logger");
module.exports = {
  async execute(manager, node, error) {
    const nodeName = node?.name || "Unknown";
    const errorMessage = error?.message || error || "Unknown error";
    logger.error(
      `\x1b[41m\x1b[37m ⚠️ NODE ERROR \x1b[0m Node ${nodeName} encountered an error: ${errorMessage}`,
    );
  },
};
