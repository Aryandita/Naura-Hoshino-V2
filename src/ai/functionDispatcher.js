"use strict";

const cacheManager = require("../managers/cacheManager");
const { logger } = require("../managers/logger");

const tools = [
  {
    name: "check_balance",
    description:
      "Cek saldo koin dan uang (economy_wallet, economy_bank) milik pengguna.",
    parameters: {
      type: "OBJECT",
      properties: {},
    },
  },
  {
    name: "get_user_info",
    description: "Dapatkan informasi profil pengguna (level, xp, role).",
    parameters: {
      type: "OBJECT",
      properties: {},
    },
  },
  {
    name: "play_music",
    description:
      "Memutar lagu atau musik di voice channel berdasarkan judul atau kata kunci.",
    parameters: {
      type: "OBJECT",
      properties: {
        query: {
          type: "STRING",
          description: "Judul lagu atau penyanyi yang ingin diputar.",
        },
      },
      required: ["query"],
    },
  },
];

async function dispatchFunction(name, args, message) {
  const userId = message.author.id;
  try {
    if (name === "check_balance") {
      const survival = await cacheManager.getUserSurvival(userId);
      return {
        wallet: survival?.economy_wallet || 0,
        bank: survival?.economy_bank || 0,
        coupons: survival?.coupons || 0,
        fragments: survival?.starFragments || 0,
      };
    }
    if (name === "get_user_info") {
      const profile = await cacheManager.getUserProfile(userId);
      return {
        username: message.author.username,
        level: profile?.level || 1,
        xp: profile?.xp || 0,
        language: profile?.language || "id",
        isPremium: profile?.isPremium || false,
      };
    }
    if (name === "play_music") {
      const query = args.query;
      if (!query) return { error: "Judul lagu tidak diberikan." };

      const musicManager = require("../managers/musicManager");
      if (!musicManager.poru)
        return { error: "Layanan musik sedang tidak aktif." };

      const { member, guild } = message;
      if (!member.voice.channelId) {
        return {
          error: "Kamu harus berada di Voice Channel untuk memutar lagu.",
        };
      }

      const resolve = await musicManager.poru.resolve({
        query,
        source: "ytmsearch",
        requester: member.user,
      });
      if (!resolve || !resolve.tracks || resolve.tracks.length === 0) {
        return { error: "Lagu tidak ditemukan." };
      }

      const track = resolve.tracks[0];
      let player = musicManager.poru.players.get(guild.id);

      if (!player) {
        player = musicManager.poru.createConnection({
          guildId: guild.id,
          voiceChannel: member.voice.channelId,
          textChannel: message.channel.id,
          deaf: true,
        });
      }

      player.queue.add(track);
      if (!player.isPlaying && !player.isPaused) player.play();

      return {
        status: "success",
        message: `Lagu "${track.info.title}" berhasil ditambahkan ke antrean.`,
        track: track.info.title,
      };
    }
  } catch (e) {
    logger.error(`[AI Function] Gagal menjalankan ${name}:`, e.message);
    return { error: "Terjadi kesalahan sistem saat mengeksekusi fungsi." };
  }
  return { error: "Fungsi tidak ditemukan." };
}

module.exports = {
  tools,
  dispatchFunction,
};
