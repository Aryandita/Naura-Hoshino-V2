"use strict";

const { logger } = require("../../managers/logger");
const ui = require("../../config/ui");
const { buildContainerV2 } = require("../../utils/NauraContainerBuilder");
const { cleanSongTitle } = require("../../canvas/artworkResolver");
const { lavalinkClusterManager } = require("../../managers/lavalinkClusterManager");

module.exports = {
  async execute(manager, player, track, error) {
    const trackTitle = track?.info?.title || "Lagu tidak diketahui";
    const errorMessage =
      error?.exception?.message ||
      error?.message ||
      error?.error ||
      (typeof error === "string" ? error : "Lavalink gagal memutar stream");

    const isBotDetection =
      /sign in|confirm you.re not a bot|bot detection|video unavailable|this video is unavailable|requires login|All clients failed to load the item/i.test(
        errorMessage,
      );

    if (isBotDetection) {
      const compactError = String(errorMessage)
        .split(/\r?\n/)[0]
        .trim()
        .slice(0, 240);
      logger.info(
        `[trackError] YouTube menolak stream [${trackTitle}] (${compactError}). Fallback SoundCloud dijalankan.`,
      );
    } else {
      logger.error(
        `\x1b[41m\x1b[37m ⚠️ TRACK ERROR \x1b[0m Gagal memutar [${trackTitle}]: ${errorMessage}`,
      );
    }

    // Berikan penalti pada node yang gagal memutar stream agar node sehat diprioritaskan
    if (player?.node) {
      player.node.penalties = (Number(player.node.penalties) || 0) + 500;
      if (player.node.name && lavalinkClusterManager?.recordFailure) {
        lavalinkClusterManager.recordFailure(player.node.name, errorMessage);
      }
    }

    if (!player || !player.textChannel) return;

    // Jika track yang gagal adalah klip suara intro TTS, langsung lanjutkan ke lagu utama di antrean
    if (track && track.isTTS && !player.destroyed) {
      player.isPlaying = false;
      if (player.queue.length > 0) {
        await player.play().catch(() => {});
      }
      return;
    }

    // Coba pemulihan otomatis lintas sumber & lintas node bila lagu gagal diputar (misal limitasi YouTube / node 1.18.1)
    if (track && !track.isTTS && !track._fallbackAttempted && !player.destroyed) {
      track._fallbackAttempted = true;
      player.isRecoveringTrack = true;

      try {
        const failedNodeName = player.node?.name || null;
        const rawTitle = track.info?.title || "";
        const rawAuthor = String(track.info?.author || "")
          .replace(/ - Topic$/i, "")
          .replace(/VEVO$/i, "")
          .trim();
        const cleanedTitle = cleanSongTitle(rawTitle);

        // Susun query pencarian bersih agar SoundCloud / node alternatif menemukan lagunya
        let queryTerm = cleanedTitle;
        if (
          rawAuthor &&
          !cleanedTitle.toLowerCase().includes(rawAuthor.toLowerCase())
        ) {
          queryTerm = `${rawAuthor} ${cleanedTitle}`.trim();
        }
        if (!queryTerm) {
          queryTerm = rawTitle;
        }

        logger.info(
          `[trackError] Mengupayakan pemulihan otomatis via SoundCloud untuk [${trackTitle}] (query: "${queryTerm}")...`,
        );

        const requester = track.info?.requester || manager.client.user;
        const fallbackQueries = [
          `scsearch:${queryTerm}`,
          `spsearch:${queryTerm}`,
        ];
        if (queryTerm !== rawTitle && rawTitle) {
          fallbackQueries.push(`scsearch:${rawTitle}`);
        }

        let fallbackRes = null;
        for (const fbQuery of fallbackQueries) {
          try {
            const candidateRes = await manager.poru.resolve({
              query: fbQuery,
              requester,
            });
            if (
              candidateRes &&
              Array.isArray(candidateRes.tracks) &&
              candidateRes.tracks.length > 0 &&
              !["error", "empty", "LOAD_FAILED", "NO_MATCHES"].includes(candidateRes.loadType)
            ) {
              fallbackRes = candidateRes;
              break;
            }
          } catch (_) {}
        }

        // Jika SoundCloud/Spotify tidak menemukan hasil, coba ytsearch di node sehat selain node yang gagal
        if (!fallbackRes || !Array.isArray(fallbackRes.tracks) || fallbackRes.tracks.length === 0) {
          const altNodes = [...(manager.poru.nodes?.values?.() || [])].filter(
            (n) =>
              Boolean(n.isConnected ?? n.connected) &&
              n.name !== failedNodeName &&
              !/hyperion/i.test(n.name),
          );
          for (const altNode of altNodes) {
            try {
              const altRes = await manager.poru.resolve(
                { query: `ytsearch:${queryTerm}`, requester },
                altNode,
              );
              if (
                altRes &&
                Array.isArray(altRes.tracks) &&
                altRes.tracks.length > 0 &&
                !["error", "empty", "LOAD_FAILED", "NO_MATCHES"].includes(altRes.loadType)
              ) {
                fallbackRes = altRes;
                break;
              }
            } catch (_) {}
          }
        }

        if (
          fallbackRes &&
          Array.isArray(fallbackRes.tracks) &&
          fallbackRes.tracks.length > 0
        ) {
          const fallbackTrack = fallbackRes.tracks[0];
          fallbackTrack._fallbackAttempted = true;
          fallbackTrack._forceNodeSwitch = true;
          fallbackTrack.info.originalSource =
            fallbackTrack.info.sourceName || "soundcloud";
          fallbackTrack.info.requester = requester;

          if (track.info?.skipDj) fallbackTrack.info.skipDj = true;
          if (track.ttsMessageId) fallbackTrack.ttsMessageId = track.ttsMessageId;
          if (track.info?.ttsMessageId) fallbackTrack.info.ttsMessageId = track.info.ttsMessageId;

          const targetNodeName =
            fallbackTrack._resolvedNodeName ||
            lavalinkClusterManager.getPreferredNode(manager.poru, {
              excludeNode: failedNodeName,
              requireLavaSrc: true,
            });

          if (
            targetNodeName &&
            targetNodeName !== failedNodeName &&
            typeof manager.switchPlayerNode === "function"
          ) {
            await manager.switchPlayerNode(player, targetNodeName).catch(() => {});
          }

          player.queue.unshift(fallbackTrack);
          player.isRecoveringTrack = false;
          player.isPlaying = false;

          await player.play();

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
            if (msg && typeof msg.delete === "function") {
              setTimeout(() => msg.delete().catch(() => {}), 12000);
            }
          }
          return;
        }
      } catch (recoveryErr) {
        logger.warn(
          `[trackError] Pemulihan otomatis SoundCloud gagal: ${recoveryErr.message}`,
        );
      } finally {
        player.isRecoveringTrack = false;
      }
    }

    player.isPlaying = false;

    try {
      const channel = manager.client.channels.cache.get(player.textChannel);
      if (channel) {
        const payload = buildContainerV2({
          accentColorHex: ui.getColor("danger") || "#EF4444",
          authorName: "Naura Music Guard",
          title: `${ui.getEmoji("cross") || "⚠️"} Gagal Memutar Lagu`,
          description: (() => {
            if (isBotDetection) {
              return `Maaf ya, Naura tidak dapat memutar **${trackTitle}** karena YouTube mendeteksi akses otomatis.\n\n💡 **Solusi:** Gunakan prefix \`sc:\` untuk mencari via SoundCloud, atau gunakan link Spotify langsung.`;
            }
            return `Maaf ya, Naura tidak dapat memutar **${trackTitle}** karena sumber audio tidak merespons atau dibatasi.\n\n> *Detail:* \`${errorMessage}\``;
          })(),
          footerText: ui.getFooter("music"),
        });

        const msg = await channel.send(payload).catch(() => null);
        if (msg && typeof msg.delete === "function") {
          setTimeout(() => msg.delete().catch(() => {}), 15000);
        }
      }

      if (player.queue.length === 0 && !player.isPlaying) {
        manager.poru.emit("queueEnd", player);
      } else if (player.queue.length > 0 && !player.isPlaying) {
        await player.stop(); // Secara native akan men-trigger `trackEnd` dan lanjut ke antrean berikutnya
      }
    } catch (err) {
      logger.error("[trackError] Gagal mengirim notifikasi ke channel:", err);
    }
  },
};
