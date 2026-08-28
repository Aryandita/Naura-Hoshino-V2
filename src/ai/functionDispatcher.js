"use strict";

const rawParseDuration = require("parse-duration");
const parseDuration =
  typeof rawParseDuration === "function"
    ? rawParseDuration
    : rawParseDuration?.default;

function safeParseDuration(str) {
  if (!str) return 0;
  if (typeof parseDuration === "function") {
    try {
      const parsed = parseDuration(str);
      if (parsed) return parsed;
    } catch (e) {}
  }
  const match = String(str)
    .trim()
    .match(/^(\d+)\s*(s|m|h|d|w|min|sec|hour|day)?$/i);
  if (match) {
    const num = parseInt(match[1], 10);
    const unit = (match[2] || "m").toLowerCase();
    if (unit === "s" || unit === "sec") return num * 1000;
    if (unit === "m" || unit === "min") return num * 60 * 1000;
    if (unit === "h" || unit === "hour") return num * 60 * 60 * 1000;
    if (unit === "d" || unit === "day") return num * 24 * 60 * 60 * 1000;
    if (unit === "w") return num * 7 * 24 * 60 * 60 * 1000;
  }
  return 0;
}

const cacheManager = require("../managers/cacheManager");
const redisManager = require("../managers/redisManager");
const { logger } = require("../managers/logger");
const UserProfile = require("../models/UserProfile");
const UserReminder = require("../models/UserReminder");
const { safeParseInventory } = require("../survival/engines/inventoryHelper");

const tools = [
  {
    name: "check_balance",
    description:
      "Cek saldo koin dompet, tabungan bank, Star Fragments, dan Naura Coupons milik pengguna.",
    parameters: {
      type: "OBJECT",
      properties: {},
    },
  },
  {
    name: "get_user_info",
    description:
      "Dapatkan informasi profil lengkap pengguna (level, xp, survival level, reputasi, status premium).",
    parameters: {
      type: "OBJECT",
      properties: {},
    },
  },
  {
    name: "play_music",
    description:
      "Kontrol pemutar musik di voice channel: memutar lagu (play), jeda (pause), lanjut (resume), lewati lagu (skip), hentikan (stop), atau lihat antrean (queue).",
    parameters: {
      type: "OBJECT",
      properties: {
        action: {
          type: "STRING",
          description:
            "Aksi yang ingin dijalankan: 'play', 'pause', 'resume', 'skip', 'stop', atau 'queue'. Default: 'play'.",
        },
        query: {
          type: "STRING",
          description:
            "Judul lagu atau kata kunci pencarian musik (wajib jika action 'play').",
        },
      },
    },
  },
  {
    name: "get_inventory",
    description:
      "Lihat daftar item dan perlengkapan yang ada di dalam inventory tas pengguna.",
    parameters: {
      type: "OBJECT",
      properties: {},
    },
  },
  {
    name: "get_leaderboard",
    description:
      "Lihat peringkat top 5 pemain dengan kekayaan (ekonomi) atau level obrolan tertinggi di server.",
    parameters: {
      type: "OBJECT",
      properties: {
        type: {
          type: "STRING",
          description:
            "Tipe leaderboard: 'economy' (kekayaan koin) atau 'level' (level & XP). Default: 'economy'.",
        },
      },
    },
  },
  {
    name: "get_server_stats",
    description:
      "Dapatkan statistik ringkas tentang server Discord ini (nama server, jumlah anggota, channel, dan roles).",
    parameters: {
      type: "OBJECT",
      properties: {},
    },
  },
  {
    name: "create_reminder",
    description:
      "Buat pengingat jadwal otomatis agar Naura mengingatkan pengguna di waktu mendatang.",
    parameters: {
      type: "OBJECT",
      properties: {
        duration: {
          type: "STRING",
          description:
            "Durasi waktu pengingat (contoh: '10m', '30m', '1h', '2h', '1d').",
        },
        message: {
          type: "STRING",
          description: "Isi pesan yang ingin diingatkan.",
        },
      },
      required: ["duration", "message"],
    },
  },
  {
    name: "give_daily",
    description:
      "Klaim hadiah gratis harian pengguna berupa Star Fragments, XP, dan kupon (reset setiap 24 jam).",
    parameters: {
      type: "OBJECT",
      properties: {},
    },
  },
];

async function dispatchFunction(name, args = {}, message = {}) {
  const author = message.author || message.user || {};
  const userId = author.id;
  if (!userId) {
    return { error: "User ID tidak terdeteksi dari konteks pesan." };
  }

  try {
    // 1. CHECK BALANCE
    if (name === "check_balance") {
      const [profile, survival] = await Promise.all([
        cacheManager.getUserProfile(userId),
        cacheManager.getUserSurvival(userId),
      ]);
      const wallet = profile?.economy_wallet || 0;
      const bank = profile?.economy_bank || 0;
      const starFragments = survival?.starFragments || 0;
      const coupons = survival?.coupons || 0;

      return {
        username: author.username,
        economyWallet: wallet,
        economyBank: bank,
        totalCoins: wallet + bank,
        starFragments,
        coupons,
        currencyUnit: "Star Fragments (⭐) & Coupons (🎟️)",
      };
    }

    // 2. GET USER INFO
    if (name === "get_user_info") {
      const [profile, survival] = await Promise.all([
        cacheManager.getUserProfile(userId),
        cacheManager.getUserSurvival(userId),
      ]);
      return {
        username: author.username,
        chatLevel: profile?.leveling_level || profile?.level || 1,
        chatXp: profile?.leveling_xp || profile?.xp || 0,
        survivalLevel: survival?.survival_level || 1,
        survivalXp: survival?.survival_xp || 0,
        reputation: profile?.reputation || 0,
        characterClass: profile?.characterClass || "None",
        isPremium: Boolean(
          profile?.isPremium && profile?.premiumUntil > new Date(),
        ),
        language: profile?.language || "id",
      };
    }

    // 3. PLAY / CONTROL MUSIC
    if (name === "play_music") {
      const action = (args.action || "play").toLowerCase();
      const musicManager = require("../managers/musicManager");
      if (!musicManager.poru) {
        return { error: "Layanan pemutar musik Naura sedang tidak aktif." };
      }

      const guild = message.guild;
      const member = message.member;

      if (!guild) {
        return { error: "Musik hanya bisa diputar di dalam server Discord." };
      }

      const player = musicManager.poru.players.get(guild.id);

      if (action === "pause") {
        if (!player || !player.isPlaying)
          return { error: "Tidak ada lagu yang sedang diputar untuk dijeda." };
        player.pause(true);
        return {
          status: "success",
          message: "Musik berhasil dijeda (paused).",
        };
      }

      if (action === "resume") {
        if (!player || !player.isPaused)
          return { error: "Musik tidak sedang dalam keadaan jeda." };
        player.pause(false);
        return {
          status: "success",
          message: "Musik dilanjutkan kembali (resumed).",
        };
      }

      if (action === "skip") {
        if (!player || !player.currentTrack)
          return {
            error: "Tidak ada lagu yang sedang diputar untuk dilewati.",
          };
        const skippedTitle = player.currentTrack.info?.title || "Lagu saat ini";
        player.stop();
        return {
          status: "success",
          message: `Lagu "${skippedTitle}" berhasil dilewati.`,
        };
      }

      if (action === "stop") {
        if (!player)
          return { error: "Bot tidak sedang memutar musik di server ini." };
        player.destroy();
        return {
          status: "success",
          message:
            "Pemutaran musik dihentikan dan Naura keluar dari Voice Channel.",
        };
      }

      if (action === "queue") {
        if (!player || !player.currentTrack)
          return { message: "Antrean musik saat ini kosong." };
        return {
          nowPlaying: player.currentTrack.info?.title,
          totalQueue: player.queue.length,
          upcoming: player.queue
            .slice(0, 5)
            .map((t, idx) => `${idx + 1}. ${t.info?.title}`),
        };
      }

      // Default: action === "play"
      const query = args.query;
      if (!query) {
        return { error: "Sebutkan judul lagu yang ingin diputar." };
      }

      if (!member || !member.voice || !member.voice.channelId) {
        return {
          error:
            "Kamu harus bergabung ke dalam Voice Channel terlebih dahulu agar Naura bisa memutarkan musik.",
        };
      }

      const resolve = await musicManager.poru.resolve({
        query,
        source: "ytmsearch",
        requester: author,
      });

      if (!resolve || !resolve.tracks || resolve.tracks.length === 0) {
        return { error: `Lagu dengan judul "${query}" tidak ditemukan.` };
      }

      const track = resolve.tracks[0];
      let activePlayer = player;

      if (!activePlayer) {
        activePlayer = musicManager.poru.createConnection({
          guildId: guild.id,
          voiceChannel: member.voice.channelId,
          textChannel: message.channel?.id || member.voice.channelId,
          deaf: true,
        });
      }

      activePlayer.queue.add(track);
      if (!activePlayer.isPlaying && !activePlayer.isPaused) {
        activePlayer.play();
      }

      return {
        status: "success",
        action: "play",
        trackTitle: track.info?.title,
        trackAuthor: track.info?.author,
        durationMs: track.info?.length,
        message: `Lagu "${track.info?.title}" berhasil dimasukkan ke antrean!`,
      };
    }

    // 4. GET INVENTORY
    if (name === "get_inventory") {
      const profile = await cacheManager.getUserProfile(userId);
      const inv = safeParseInventory(profile?.inventory);
      const itemsFormatted = inv.slice(0, 10).map((i) => ({
        id: i.id || i.name || "Item",
        name: i.name || i.id,
        amount: i.amount || i.quantity || 1,
        type: i.type || "general",
      }));

      return {
        username: author.username,
        totalItemTypes: inv.length,
        items: itemsFormatted,
        isEmpty: inv.length === 0,
      };
    }

    // 5. GET LEADERBOARD
    if (name === "get_leaderboard") {
      const lbType = (args.type || "economy").toLowerCase();
      if (lbType === "level") {
        const topProfiles = await UserProfile.findAll({
          order: [
            ["leveling_level", "DESC"],
            ["leveling_xp", "DESC"],
          ],
          limit: 5,
        });
        return {
          type: "level",
          leaderboard: topProfiles.map((p, idx) => ({
            rank: idx + 1,
            userId: p.userId,
            level: p.leveling_level || 1,
            xp: p.leveling_xp || 0,
          })),
        };
      } else {
        const topProfiles = await UserProfile.findAll({
          order: [["economy_wallet", "DESC"]],
          limit: 5,
        });
        return {
          type: "economy",
          leaderboard: topProfiles.map((p, idx) => ({
            rank: idx + 1,
            userId: p.userId,
            wallet: p.economy_wallet || 0,
            bank: p.economy_bank || 0,
            total: (p.economy_wallet || 0) + (p.economy_bank || 0),
          })),
        };
      }
    }

    // 6. GET SERVER STATS
    if (name === "get_server_stats") {
      const guild = message.guild;
      if (!guild) {
        return {
          error: "Fungsi ini hanya dapat dijalankan di dalam server Discord.",
        };
      }
      return {
        serverName: guild.name,
        memberCount: guild.memberCount,
        channelsCount: guild.channels?.cache?.size || 0,
        rolesCount: guild.roles?.cache?.size || 0,
        boostTier: guild.premiumTier || 0,
        boostCount: guild.premiumSubscriptionCount || 0,
      };
    }

    // 7. CREATE REMINDER
    if (name === "create_reminder") {
      const durationStr = args.duration;
      const reminderMsg = args.message;
      if (!durationStr || !reminderMsg) {
        return { error: "Durasi dan pesan pengingat wajib diisi." };
      }

      const ms = safeParseDuration(durationStr);
      if (!ms || ms < 5000) {
        return {
          error:
            "Format durasi tidak valid (minimal 10s, contoh: '10m', '1h', '1d').",
        };
      }

      const remindAt = new Date(Date.now() + ms);
      const channelId = message.channel?.id || author.id;

      await UserReminder.create({
        userId,
        channelId,
        message: reminderMsg,
        remindAt,
      });

      return {
        status: "success",
        message: `Pengingat berhasil disetel untuk "${reminderMsg}".`,
        remindAt: remindAt.toISOString(),
        duration: durationStr,
      };
    }

    // 8. GIVE DAILY REWARD
    if (name === "give_daily") {
      const cooldownKey = `daily:claim:${userId}`;
      if (redisManager.isReady) {
        const onCooldown = await redisManager.getCache(cooldownKey);
        if (onCooldown) {
          const remainingMs = Number(onCooldown) - Date.now();
          const remainingHours = Math.max(
            1,
            Math.ceil(remainingMs / (60 * 60 * 1000)),
          );
          return {
            status: "cooldown",
            message: `Kamu sudah mengklaim hadiah harianmu. Silakan kembali lagi dalam ${remainingHours} jam.`,
          };
        }
      }

      const profile = await cacheManager.getUserProfile(userId);
      const isVIP = Boolean(
        profile?.isPremium && profile?.premiumUntil > new Date(),
      );

      const rewardFragments = isVIP ? 350 : 200;
      const rewardXp = isVIP ? 100 : 50;
      const rewardCoupons = isVIP ? 1 : 0;

      await cacheManager.incrementUserSurvival(
        userId,
        "starFragments",
        rewardFragments,
      );
      await cacheManager.incrementUserSurvival(userId, "survival_xp", rewardXp);
      if (rewardCoupons > 0) {
        await cacheManager.incrementUserSurvival(
          userId,
          "coupons",
          rewardCoupons,
        );
      }

      if (redisManager.isReady) {
        // 24 jam cooldown
        await redisManager.setCache(
          cooldownKey,
          Date.now() + 24 * 60 * 60 * 1000,
          24 * 60 * 60,
        );
      }

      return {
        status: "success",
        username: author.username,
        isVIP,
        rewardFragments,
        rewardXp,
        rewardCoupons,
        message: `Hadiah harian berhasil diklaim: +${rewardFragments} Star Fragments ⭐, +${rewardXp} XP 🌟${rewardCoupons > 0 ? `, +${rewardCoupons} Coupon 🎟️` : ""}!`,
      };
    }
  } catch (e) {
    logger.error(`[AI Function] Gagal menjalankan function call "${name}":`, e);
    return {
      error: `Terjadi kesalahan saat menjalankan ${name}: ${e.message}`,
    };
  }

  return { error: `Function "${name}" tidak ditemukan.` };
}

module.exports = {
  tools,
  dispatchFunction,
};
