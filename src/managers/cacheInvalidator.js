const env = require("../config/env");
const redisManager = require("./redisManager");
const { logger } = require("./logger");

// Kanal Pub/Sub untuk memberi tahu seluruh shard bahwa ada state yang basi.
const CHANNEL = "cache:invalidate";

// Penanda asal pesan. Hanya untuk keperluan diagnosa, shard asal tetap ikut
// memproses pesannya sendiri karena penyegaran bersifat idempoten.
const ORIGIN = `shard-${env.SHARD_ID ?? "main"}-${process.pid}`;

function guildKey(guildId) {
  return `guild:settings:${guildId}`;
}

/**
 * Menghapus cache GuildSettings dan menyiarkannya ke seluruh shard.
 *
 * Dipanggil otomatis oleh hook pada model GuildSettings, jadi kode pemanggil
 * biasanya tidak perlu memanggilnya sendiri.
 *
 * Kegagalan Redis sengaja tidak dilempar ulang: invalidasi yang gagal tidak
 * boleh membatalkan penulisan yang sudah berhasil masuk database.
 *
 * @param {string} guildId
 * @param {{ broadcast?: boolean }} [options]
 */
async function invalidateGuild(guildId, { broadcast = true } = {}) {
  if (!guildId) return;
  try {
    await redisManager.deleteCache(guildKey(guildId));
    if (broadcast) {
      await redisManager.publish(CHANNEL, {
        type: "guild",
        guildId,
        origin: ORIGIN,
      });
    }
  } catch (error) {
    logger.error(
      "[CacheInvalidator] Gagal menginvalidasi cache guild:",
      error.message,
    );
  }
}

/**
 * Menghapus cache UserProfile & User Leveling serta canvas gambar miliknya.
 * @param {string} userId
 */
async function invalidateUser(userId) {
  if (!userId) return;
  try {
    const canvasRuntime = require("../canvas/canvasRuntime");
    await canvasRuntime.smartInvalidateUserCanvas(userId);
  } catch (error) {
    logger.error(
      "[CacheInvalidator] Gagal menginvalidasi canvas cache user:",
      error.message,
    );
  }
}

/**
 * Menyegarkan state guild yang disimpan di memori proses ini.
 *
 * Cache Redis bersifat bersama, jadi menghapus key-nya sudah cukup untuk seluruh
 * shard. Yang TIDAK bersama adalah peta di memori seperti client.globalChatChannels
 *, inilah alasan kanal Pub/Sub tetap dibutuhkan.
 *
 * @param {import('discord.js').Client} client
 * @param {string} guildId
 */
async function refreshGuildMemoryState(client, guildId) {
  if (!client || !guildId) return;

  if (!client.globalChatChannels) client.globalChatChannels = new Map();

  // Buang seluruh entri lama milik guild ini sebelum memasang yang baru.
  for (const [
    channelId,
    mappedGuildId,
  ] of client.globalChatChannels.entries()) {
    if (mappedGuildId === guildId) client.globalChatChannels.delete(channelId);
  }

  // Lazy require: cacheManager memuat model, dan model memuat modul ini.
  const cacheManager = require("./cacheManager");
  const data = await cacheManager.getGuildSettings(guildId);
  const globalChat = data && data.settings ? data.settings.globalChat : null;

  if (globalChat && globalChat.enabled && globalChat.channelId) {
    client.globalChatChannels.set(globalChat.channelId, guildId);
  }
}

/**
 * Memasang listener invalidasi. Harus dipanggil di SETIAP shard, bukan hanya
 * shard utama.
 *
 * @param {import('discord.js').Client} client
 */
function initSubscriber(client) {
  if (!redisManager.isReady) {
    logger.warn(
      "[CacheInvalidator] Redis tidak aktif. Sinkronisasi cache lintas shard dilewati.",
    );
    return;
  }

  redisManager.initPubSub(CHANNEL, (payload) => {
    if (!payload || payload.type !== "guild" || !payload.guildId) return;
    refreshGuildMemoryState(client, payload.guildId).catch((error) =>
      logger.error(
        "[CacheInvalidator] Gagal menyegarkan state guild:",
        error.message,
      ),
    );
  });
}

module.exports = {
  CHANNEL,
  invalidateGuild,
  invalidateUser,
  refreshGuildMemoryState,
  initSubscriber,
};
