"use strict";

const { logger } = require("../../managers/logger");
const ui = require("../../config/ui");
const { buildContainerV2 } = require("../../utils/NauraContainerBuilder");

module.exports = {
  async execute(manager, player, track, error) {
    const trackTitle = track?.info?.title || "Lagu tidak diketahui";
    const errorMessage =
      error?.message ||
      error?.error ||
      (typeof error === "string" ? error : "Lavalink gagal memutar stream");

    logger.error(
      `\x1b[41m\x1b[37m ⚠️ TRACK ERROR \x1b[0m Gagal memutar [${trackTitle}]: ${errorMessage}`,
    );

    if (!player || !player.textChannel) return;

    try {
      const channel = manager.client.channels.cache.get(player.textChannel);
      if (channel) {
        const payload = buildContainerV2({
          accentColorHex: ui.getColor("danger") || "#EF4444",
          authorName: "Naura Music Guard",
          title: `${ui.getEmoji("cross") || "⚠️"} Gagal Memutar Lagu`,
          description: `Maaf ya, Naura tidak dapat memutar **${trackTitle}** karena sumber audio tidak merespons atau dibatasi.\n\n> *Detail:* \`${errorMessage}\``,
          footerText: ui.getFooter("music"),
        });

        const msg = await channel.send(payload).catch(() => null);
        if (msg) {
          setTimeout(() => msg.delete().catch(() => {}), 15000);
        }
      }
    } catch (err) {
      logger.error("[trackError] Gagal mengirim notifikasi ke channel:", err);
    }
  },
};
