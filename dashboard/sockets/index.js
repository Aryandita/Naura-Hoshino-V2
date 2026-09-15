"use strict";

/**
 * Lapisan realtime dashboard (socket.io).
 *
 * Perubahan penting: kanal `music_control` dulu bisa dipakai siapa pun yang
 * menebak Guild ID untuk menjeda, melewati, atau mengacak antrean lagu di
 * server mana pun. Kini sesi Express ikut dibagikan ke socket.io sehingga
 * setiap perintah kendali diverifikasi keanggotaannya di guild tersebut.
 */

const os = require("os");
const { logger } = require("../../src/managers/logger");
const { getDbStatus } = require("../../src/managers/dbManager");
const RateLimiter = require("../../src/utils/rateLimiter");
const redisManager = require("../../src/managers/redisManager");
const mongoManager = require("../../src/managers/mongoManager");
const env = require("../../src/config/env");

const STATS_INTERVAL_MS = 3000;
const MUSIC_INTERVAL_MS = 2000;

/** Susun potret keadaan pemutar musik satu guild. */
function snapshotPlayer(client, player) {
  const channel = client.channels.cache.get(player.voiceChannel);
  const members = channel
    ? channel.members.map((m) => ({
        id: m.id,
        username: m.user.username,
        avatar: m.user.displayAvatarURL({ extension: "png", size: 64 }),
      }))
    : [];

  const queue = player.queue.map((track) => ({
    title: track.info.title,
    uri: track.info.uri,
    duration: track.info.length,
    requester: track.info.requester?.username || "Tidak diketahui",
  }));

  const currentTrack = player.currentTrack
    ? {
        title: player.currentTrack.info.title,
        uri: player.currentTrack.info.uri,
        duration: player.currentTrack.info.length,
        position: player.position,
        isPlaying: player.isPlaying,
        isPaused: player.isPaused,
      }
    : null;

  return { currentTrack, queue, members };
}

/** Ambil ID pengguna dari sesi Express yang menempel di socket. */
function socketUserId(socket) {
  return socket.request?.session?.passport?.user?.id || null;
}

/** Pastikan pengguna memang anggota guild yang ingin dikendalikan. */
async function canControlGuild(client, socket, guildId) {
  const userId = socketUserId(socket);
  if (!userId || !guildId) return false;

  const guild = client.guilds.cache.get(String(guildId));
  if (!guild) return false;

  const member =
    guild.members.cache.get(userId) ||
    (await guild.members.fetch(userId).catch(() => null));
  return !!member;
}

module.exports = (client, io, { sessionMiddleware } = {}) => {
  // Bagikan sesi Express ke socket.io agar identitas pengguna diketahui.
  if (sessionMiddleware) {
    io.engine.use(sessionMiddleware);
  }

  // --- Siaran statistik berkala (Lintas Shard via Redis) ---
  const shardStats = new Map();

  if (redisManager.client && redisManager.client.isReady) {
    redisManager.initPubSub("cluster:stats_update", (data) => {
      if (data && data.shardId !== undefined) {
        shardStats.set(data.shardId, data);
      }
    });

    redisManager.initPubSub("leaderboard:live", (data) => {
      if (data) {
        io.emit("survival_leaderboard_update", data);
      }
    });
  }

  const statsTimer = setInterval(() => {
    if (!client.isReady()) return;

    let totalGuilds = client.guilds.cache.size;
    let totalUsers = client.users.cache.size;
    let avgPing = client.ws.ping;
    let totalRamUsed = os.totalmem() - os.freemem();
    const ramTotalStr = (os.totalmem() / 1024 / 1024).toFixed(2);

    if (shardStats.size > 0) {
      totalGuilds = 0;
      totalUsers = 0;
      totalRamUsed = 0;
      let pingSum = 0;
      let pingCount = 0;

      // Hapus data stale (older than 15 seconds)
      const now = Date.now();
      for (const [shardId, stats] of shardStats.entries()) {
        if (now - stats.timestamp > 15000) {
          shardStats.delete(shardId);
          continue;
        }
        totalGuilds += stats.guilds || 0;
        totalUsers += stats.users || 0;
        totalRamUsed += parseFloat(stats.ramUsed) * 1024 * 1024 || 0;
        pingSum += stats.ping || 0;
        pingCount++;
      }

      if (pingCount > 0) avgPing = Math.round(pingSum / pingCount);
    }

    io.emit("stats_update", {
      ramUsed: (totalRamUsed / 1024 / 1024).toFixed(2),
      ramTotal: ramTotalStr,
      ping: avgPing,
      guilds: totalGuilds,
      users: totalUsers,
      dbStatus: getDbStatus(),
      mongoStatus: mongoManager ? mongoManager.getStatus() : null,
      redisStatus: !!(redisManager.client && redisManager.client.isReady),
      botVersion: env.BOT_VERSION,
      engineVersion: env.ENGINE_VERSION,
    });
  }, STATS_INTERVAL_MS);

  // --- Siaran keadaan pemutar musik ---
  const musicTimer = setInterval(() => {
    if (!client.isReady()) return;

    const players = client.musicManager?.poru?.players;
    if (!players) return;

    players.forEach((player) => {
      io.to(player.guildId).emit("music_state", snapshotPlayer(client, player));
    });
  }, MUSIC_INTERVAL_MS);

  statsTimer.unref?.();
  musicTimer.unref?.();

  io.on("connection", (socket) => {
    logger.info(`[SOCKET] Ada yang terhubung ke dashboard: ${socket.id}`);

    socket.on("join_guild_music", async (guildId) => {
      if (!(await canControlGuild(client, socket, guildId))) return;

      socket.join(String(guildId));
      const player = client.musicManager?.poru?.players.get(String(guildId));
      if (player) socket.emit("music_state", snapshotPlayer(client, player));
    });

    socket.on("music_control", async (data) => {
      // Guard Clause: Rate limiting kontrol pemutar musik (3 aksi / 2 detik per socket)
      const isLimited = await RateLimiter.isRateLimited(
        socket.id,
        "socket_music_ctrl",
        3,
        2,
      );
      if (isLimited) {
        return socket.emit("music_error", {
          message: "Terlalu cepat mengontrol pemutar musik. Tunggu sebentar ya!",
        });
      }

      const { guildId, action, value } = data || {};
      if (!(await canControlGuild(client, socket, guildId))) {
        return socket.emit("music_error", {
          message: "Kamu belum tergabung di server itu ya.",
        });
      }

      const player = client.musicManager?.poru?.players.get(String(guildId));
      if (!player) return;

      if (action === "pause") {
        player.pause(true);
      } else if (action === "resume") {
        player.pause(false);
      } else if (action === "skip") {
        player.stop();
      } else if (action === "reorder" && Array.isArray(value)) {
        const newQueue = [];
        value.forEach((oldIdx) => {
          if (player.queue[oldIdx]) newQueue.push(player.queue[oldIdx]);
        });
        player.queue = newQueue;
      } else if (action === "volume") {
        const vol = Math.min(Math.max(Number(value) || 0, 0), 200);
        player.setVolume(vol);
      }

      io.to(String(guildId)).emit(
        "music_state",
        snapshotPlayer(client, player),
      );
    });

    socket.on("chat_message", async (data) => {
      const limited = await RateLimiter.isRateLimited(
        socket.id,
        "dashboard_chat",
        6,
        10,
      );
      if (limited) {
        return socket.emit("chat_response", {
          reply:
            "Pelan-pelan ya sahabatku! Naura masih menyusun kata-kata manis. Tunggu sebentar ya! ✨",
        });
      }

      const message = String(data?.message || data?.prompt || "").slice(
        0,
        2000,
      );
      if (!message) return;

      const history = Array.isArray(data?.history) ? data.history : [];
      const userId = socketUserId(socket);
      const sessionUser = socket.request?.session?.passport?.user;
      const username = sessionUser?.username || data?.username || "Teman Baik";
      const isOwner = userId && env.OWNER_IDS && env.OWNER_IDS.includes(userId);

      const aiManager = require("../../src/managers/aiManager");

      try {
        const response = await aiManager.chatCompanion({
          prompt: message,
          history,
          userId,
          username,
          isOwner,
        });

        return socket.emit("chat_response", {
          reply: response.reply,
          source: response.source,
          username: response.username,
        });
      } catch (err) {
        logger.error("[SOCKET CHAT ERROR]", err);
        return socket.emit("chat_response", {
          reply:
            "Aduh, Naura tersandung kabel sebentar! 🌸 Coba sapa Naura lagi ya, Naura selalu siap nemenin kamu kok! ✨",
        });
      }
    });

    socket.on("soundboard_play", async (data) => {
      const { guildId, soundId, voiceChannelId } = data || {};
      if (!guildId || !soundId) {
        return socket.emit("soundboard_status", {
          success: false,
          message: "Data soundboard tidak lengkap.",
        });
      }

      const allowed = await canControlGuild(client, socket, guildId);
      if (!allowed) {
        return socket.emit("soundboard_status", {
          success: false,
          message:
            "Kamu harus menjadi anggota server ini untuk memutar soundboard.",
        });
      }

      const soundboardService = require("../../src/services/soundboardService");
      const sessionUser = socket.request?.session?.passport?.user;

      const result = await soundboardService.playSound({
        client,
        guildId,
        soundId,
        voiceChannelId,
        requester: sessionUser,
      });

      socket.emit("soundboard_status", result);
    });

    socket.on("get_survival_leaderboard", async () => {
      try {
        const UserSurvival = require("../../src/models/UserSurvival");
        const topPlayers = await UserSurvival.findAll({
          order: [["level", "DESC"], ["xp", "DESC"], ["starFragments", "DESC"]],
          limit: 10,
          attributes: ["userId", "level", "xp", "starFragments", "health", "energy"],
        });
        socket.emit("survival_leaderboard_data", topPlayers);
      } catch (err) {
        logger.warn("[SOCKET LEADERBOARD ERROR]", err.message);
      }
    });

    // --- Collaborative Live Jam Room Events ---
    socket.on("jam:join", ({ roomId = "global" } = {}) => {
      socket.join(`jam:${roomId}`);
    });

    socket.on("jam:step_toggle", ({ roomId = "global", inst, step, active } = {}) => {
      socket.to(`jam:${roomId}`).emit("jam:step_toggle", { inst, step, active });
    });

    socket.on("jam:note_play", ({ roomId = "global", note, wave } = {}) => {
      socket.to(`jam:${roomId}`).emit("jam:note_play", { note, wave });
    });

    socket.on("jam:tempo_change", ({ roomId = "global", bpm } = {}) => {
      socket.to(`jam:${roomId}`).emit("jam:tempo_change", { bpm });
    });

    socket.on("jam:clear", ({ roomId = "global" } = {}) => {
      socket.to(`jam:${roomId}`).emit("jam:clear");
    });

    socket.on("disconnect", () => {
      // Tidak ada yang perlu dibersihkan untuk saat ini.
    });
  });

  return io;
};
