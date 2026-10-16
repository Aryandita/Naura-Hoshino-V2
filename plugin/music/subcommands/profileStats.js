"use strict";
const { logger } = require("../../../src/managers/logger");

const { AttachmentBuilder } = require("discord.js");
const ui = require("../../../src/config/ui");
const cacheManager = require("../../../src/managers/cacheManager");
const { generateMusicProfileImage } = require("../../../src/canvas/canvasHelper");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");

module.exports = {
  async profile(ctx) {
    const { client, user, args, sendReply, isSlash } = ctx;
    const eError = ui.getEmoji("error") || "❌";
    let target = user;
    if (isSlash && args.target) target = args.target;
    if (target.bot) {
      const errPayload = buildErrorContainerV2({
        title: "Akses Ditolak",
        description: `${eError} | Bot tidak memiliki kartu profil musik!`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(errPayload, true);
    }
    try {
      const profile = await cacheManager.getUserProfile(target.id);
      const calculateTop5 = (jsonInput) => {
        if (!jsonInput) return [];
        try {
          const data =
            typeof jsonInput === "string" ? JSON.parse(jsonInput) : jsonInput;
          if (!data.history) return [];
          const sorted = Object.entries(data.history).sort(
            (a, b) => b[1] - a[1],
          );
          return sorted.slice(0, 5).map((entry) => entry[0]);
        } catch {
          return [];
        }
      };

      const stats = {
        tracksListened: profile.music_tracksListened || 0,
        totalDurationMs: profile.music_totalDurationMs || 0,
        lastListened: profile.music_lastListened || "Belum ada data",
        topTracks: calculateTop5(profile.music_topTrack),
        topServers: calculateTop5(profile.music_topServer),
        topFriends: calculateTop5(profile.music_topFriend),
        isPremium: profile.isPremium && profile.premiumUntil > new Date(),
      };
      const imageBuffer = await generateMusicProfileImage(
        target,
        stats,
        client.user.displayAvatarURL({ extension: "png" }),
      );
      const attachment = new AttachmentBuilder(imageBuffer, {
        name: "naura-audiophile.webp",
      });
      const profilePayload = buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#FFB6C1",
        title: `🎧 Profil Musik: ${target.username}`,
        bannerAttachmentName: "naura-audiophile.webp",
        footerText: ui.getFooter("music"),
      });
      return sendReply({ ...profilePayload, files: [attachment] });
    } catch {
      const errPayload = buildErrorContainerV2({
        title: "Gagal Render Profil",
        description: `${eError} | Gagal merender kartu profil dari server.`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(errPayload, true);
    }
  },

  async aura(ctx) {
    const { user, args, sendReply, isSlash, poru, guild } = ctx;
    const eError = ui.getEmoji("error") || "❌";
    let target = user;
    if (isSlash && args.target) target = args.target;
    if (target.bot) {
      const errPayload = buildErrorContainerV2({
        title: "Akses Ditolak",
        description: `${eError} | Bot tidak memiliki Music Aura!`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(errPayload, true);
    }
    try {
      const musicAuraService = require("../../../src/services/musicAuraService");
      const profile = await cacheManager.getUserProfile(target.id);

      let tracks = [];
      if (profile && profile.music_history) {
        try {
          const hist =
            typeof profile.music_history === "string"
              ? JSON.parse(profile.music_history)
              : profile.music_history;
          if (hist.history) {
            tracks = Object.keys(hist.history).slice(0, 10);
          }
        } catch (err) {
          logger.debug("[profileStats:aura] Operasi audio/voice gagal: " + (err?.message || err));
        }
      }

      if (tracks.length === 0 && poru && guild) {
        const player = poru.players?.get(guild.id);
        if (player && player.currentTrack) {
          tracks.push(player.currentTrack.info.title);
        }
      }

      const avatarUrl = target.displayAvatarURL({ extension: "png", size: 256 });
      const { auraData, cardBuffer } = await musicAuraService.generateMusicAura({
        username: target.username,
        avatarUrl,
        tracks,
        guildName: guild?.name || "Server Naura",
      });

      const file = new AttachmentBuilder(cardBuffer, {
        name: "music_aura.png",
      });
      const auraPayload = buildContainerV2({
        accentColorHex: auraData.primaryColor || "#38BDF8",
        authorName: `${target.username} - Resonansi Musik`,
        title: `🔮 AI Music Aura: ${auraData.auraName}`,
        bannerAttachmentName: "music_aura.png",
        description: [
          `> *"${auraData.description}"*`,
          "",
          `• **Signature Track:** 🎵 ${auraData.signatureTrack}`,
          `• **Dominant Genres:** ${Array.isArray(auraData.genres) ? auraData.genres.join(", ") : "Lo-Fi, Synthwave"}`,
          `• **Vibe Energy:** ⚡ ${auraData.energy}% | **Tempo:** 🎚️ ${auraData.tempo} BPM`,
        ].join("\n"),
        files: [file],
        footerText: ui.getFooter("music"),
      });

      return sendReply(auraPayload);
    } catch (err) {
      const errPayload = buildErrorContainerV2({
        title: "Gagal Menganalisis Aura",
        description: `${eError} | Terjadi kesalahan saat membaca resonansi aura musik: ${err.message}`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(errPayload, true);
    }
  },

  async wrapped(ctx) {
    const { user, args, sendReply, isSlash, guild } = ctx;
    const eError = ui.getEmoji("error") || "❌";
    let target = user;
    if (isSlash && args.target) target = args.target;
    if (target.bot) {
      const errPayload = buildErrorContainerV2({
        title: "Akses Ditolak",
        description: `${eError} | Bot tidak memiliki kartu Naura Wrapped!`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(errPayload, true);
    }
    try {
      const canvasWorkerPool = require("../../../src/canvas/canvasWorkerPool");
      const profile = await cacheManager.getUserProfile(target.id);
      const calculateTop5 = (jsonInput) => {
        if (!jsonInput) return [];
        try {
          const data =
            typeof jsonInput === "string" ? JSON.parse(jsonInput) : jsonInput;
          if (!data.history) return [];
          const sorted = Object.entries(data.history).sort(
            (a, b) => b[1] - a[1],
          );
          return sorted.slice(0, 5).map((entry) => entry[0]);
        } catch {
          return [];
        }
      };

      const stats = {
        tracksListened: profile?.music_tracksListened || 0,
        totalDurationMs: profile?.music_totalDurationMs || 0,
        lastListened: profile?.music_lastListened || "Belum ada data",
        topTracks: calculateTop5(profile?.music_topTrack),
        topServers: calculateTop5(profile?.music_topServer),
        topFriends: calculateTop5(profile?.music_topFriend),
        isPremium: profile?.isPremium && profile?.premiumUntil > new Date(),
      };

      const imageBuffer = await canvasWorkerPool.execute({
        task: "renderWrapped",
        payload: { user: target, stats },
        userId: target.id,
      });
      const attachment = new AttachmentBuilder(imageBuffer, {
        name: "naura-wrapped.png",
      });
      const hours = (stats.totalDurationMs / (1000 * 60 * 60)).toFixed(1);
      const wrappedPayload = buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#FFB6C1",
        title: `✨ Naura Music Wrapped: ${target.displayName || target.username}`,
        description: `Kilas balik petualangan musik **${target.displayName || target.username}** bersama Naura!\n\n🎧 **Total Lagu Didengar:** \`${stats.tracksListened} lagu\`\n⏳ **Waktu Berputar:** \`${hours} jam\`\n🎵 **Lagu Teratas:** \`${stats.topTracks[0] || "Belum ada data"}\`\n🏰 **Server Favorit:** \`${stats.topServers[0] || guild.name}\`\n\n*Terima kasih telah mewarnai harimu bersama alunan musik Naura Hoshino~* 🌸`,
        bannerAttachmentName: "naura-wrapped.png",
        footerText: ui.getFooter("music"),
      });
      return sendReply({ ...wrappedPayload, files: [attachment] });
    } catch {
      const errPayload = buildErrorContainerV2({
        title: "Gagal Render Wrapped",
        description: `${eError} | Gagal merender kartu Naura Wrapped dari server.`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(errPayload, true);
    }
  },
};
