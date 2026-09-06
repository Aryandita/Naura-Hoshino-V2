"use strict";

const { logger } = require("../../managers/logger");
const ui = require("../../config/ui");
const { buildContainerV2 } = require("../../utils/NauraContainerBuilder");

module.exports = {
  async execute(manager, player, track, error) {
    const trackTitle = track?.info?.title || "Lagu tidak diketahui";
    const errorMessage =
      error?.exception?.message ||
      error?.message ||
      error?.error ||
      (typeof error === "string" ? error : "Lavalink gagal memutar stream");

    logger.error(
      `\x1b[41m\x1b[37m ⚠️ TRACK ERROR \x1b[0m Gagal memutar [${trackTitle}]: ${errorMessage}`,
    );

    if (!player || !player.textChannel) return;

    // Coba pemulihan otomatis via SoundCloud bila lagu gagal diputar (misal limitasi YouTube)
    if (track && !track._fallbackAttempted && !player.destroyed) {
      track._fallbackAttempted = true;
      player.isRecoveringTrack = true;

      try {
        const queryTerm = track.info?.author
          ? `${track.info.author} ${track.info.title}`
          : track.info?.title;

        if (queryTerm) {
          logger.info(
            `[trackError] Mengupayakan pemulihan otomatis via SoundCloud untuk [${trackTitle}]...`,
          );

          const fallbackRes = await manager.poru.resolve({
            query: `scsearch:${queryTerm}`,
            requester: track.info?.requester || manager.client.user,
          });

          if (
            fallbackRes &&
            Array.isArray(fallbackRes.tracks) &&
            fallbackRes.tracks.length > 0
          ) {
            const fallbackTrack = fallbackRes.tracks[0];
            fallbackTrack._fallbackAttempted = true;
            fallbackTrack.info.originalSource = "soundcloud";
            fallbackTrack.info.requester =
              track.info?.requester || manager.client.user;

            player.queue.unshift(fallbackTrack);
            player.isRecoveringTrack = false;

            if (!player.isPlaying) {
              await player.play();
            }

            const channel = manager.client.channels.cache.get(
              player.textChannel,
            );
            if (channel) {
              const noticePayload = buildContainerV2({
                accentColorHex: "#FF7700",
                authorName: "Naura Music Guard",
                title: "🔄 Pengalihan Sumber Audio Otomatis",
                description: `Sumber audio utama untuk **${trackTitle}** mengalami kendala koneksi.\nNaura otomatis mengalihkan aliran musik ke **SoundCloud** agar lagumu tetap berputar tanpa henti!`,
                footerText: ui.getFooter("music"),
              });

              const msg = await channel.send(noticePayload).catch(() => null);
              if (msg) {
                setTimeout(() => msg.delete().catch(() => {}), 12000);
              }
            }
            return;
          }
        }
      } catch (recoveryErr) {
        logger.warn(
          `[trackError] Pemulihan otomatis SoundCloud gagal: ${recoveryErr.message}`,
        );
      } finally {
        player.isRecoveringTrack = false;
      }
    }

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

      if (player.queue.length === 0 && !player.isPlaying) {
        manager.poru.emit("queueEnd", player);
      }
    } catch (err) {
      logger.error("[trackError] Gagal mengirim notifikasi ke channel:", err);
    }
  },
};
