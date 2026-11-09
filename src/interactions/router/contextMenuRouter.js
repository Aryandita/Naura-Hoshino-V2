"use strict";

const { logger } = require("../../managers/logger");
const rateLimiter = require("../../utils/rateLimiter");
const { respondError } = require("../safeExecute");
const { buildErrorContainerV2 } = require("../../utils/NauraContainerBuilder");
const { withEphemeralFlags } = require("./interactionGuards");

async function handleContextMenu(interaction, client) {
  let isContextRateLimited = false;
  try {
    isContextRateLimited = await rateLimiter.isRateLimited(
      interaction.user.id,
      `ctx_${interaction.commandName}`,
      4,
      10,
    );
  } catch (error) {
    logger.error("[INTERAKSI] Gagal mengecek rate limit context menu:", error);
  }
  if (isContextRateLimited) {
    return interaction
      .reply(
        withEphemeralFlags(
          buildErrorContainerV2({
            authorName: "Naura Rate Limit",
            title: "Slow Down!",
            errorMessage:
              "Kamu menggunakan context menu terlalu cepat. Harap tunggu beberapa detik ya!",
            lang: interaction.localeLang,
            expression: "sleepy",
          }),
        ),
      )
      .catch(() => {});
  }
  const { resolveContextMenu } = require("../contextMenus");
  const contextMenuHandler = resolveContextMenu(interaction.commandName);
  if (!contextMenuHandler) return undefined;
  try {
    return await contextMenuHandler.execute(interaction, client);
  } catch (error) {
    logger.error(
      `[CONTEXT MENU ERROR] Galat saat mengeksekusi ${interaction.commandName}:`,
      error,
    );
    return await respondError(
      interaction,
      "Terjadi kesalahan saat memproses context menu ini.",
    );
  }
}

module.exports = { handleContextMenu };
