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
const { logger } = require("../src/managers/logger");
const { getDbStatus } = require("../src/managers/dbManager");
const RateLimiter = require("../../utils/rateLimiter");
const redisManager = require("../src/managers/redisManager");

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
        totalRamUsed += (parseFloat(stats.ramUsed) * 1024 * 1024) || 0;
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
        5,
        10,
      );
      if (limited) {
        return socket.emit("chat_response", {
          reply:
            "Pelan-pelan ya, Naura masih mengetik. Tunggu beberapa detik lagi.",
        });
      }

      const message = String(data?.message || "").slice(0, 2000);
      if (!message) return;

      const env = require("../src/config/env");

      // --- Mesin utama: Verba ---
      try {
        const response = await fetch("https://api.verba.ink/v1/response", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.VERBA_API_KEY}`,
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0",
          },
          body: JSON.stringify({
            character: env.VERBA_CHARACTER_SLUG || "naura",
            messages: [{ role: "user", content: message }],
          }),
        });

        const rawText = await response.text();
        if (!response.ok)
          throw new Error(`Verba API error: HTTP ${response.status}`);

        const result = JSON.parse(rawText);
        const reply =
          result?.choices?.[0]?.message?.content ||
          result?.message?.content ||
          result?.content;
        if (!reply) throw new Error("Verba mengembalikan jawaban kosong.");

        return socket.emit("chat_response", { reply });
      } catch (error) {
        logger.warn(
          `[SOCKET CHAT] Verba gagal (${error.message}). Beralih ke cadangan...`,
        );
      }

      // --- Cadangan 1: Gemini ---
      try {
        const { GoogleGenerativeAI } = require("@google/generative-ai");
        const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.startChat().sendMessage(message);
        return socket.emit("chat_response", { reply: result.response.text() });
      } catch (geminiError) {
        logger.warn(`[SOCKET CHAT] Gemini gagal (${geminiError.message}).`);
      }

      // --- Cadangan 2: Ollama ---
      try {
        const { Ollama } = require("ollama");
        const ollamaClient = new Ollama({ host: env.OLLAMA_BASE_URL });
        const ollamaResponse = await ollamaClient.chat({
          model: env.OLLAMA_MODEL,
          messages: [{ role: "user", content: message }],
        });
        return socket.emit("chat_response", {
          reply: ollamaResponse.message.content,
        });
      } catch (ollamaError) {
        return socket.emit("chat_response", {
          reply:
            "Maaf ya, otak Naura lagi ngambek sebentar. Coba lagi nanti, oke?",
        });
      }
    });

    socket.on("disconnect", () => {
      // Tidak ada yang perlu dibersihkan untuk saat ini.
    });
  });

  return io;
};
