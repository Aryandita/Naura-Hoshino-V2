"use strict";

/**
 * Registry kepemilikan Temp Voice.
 *
 * Sebelum ini, kepemilikan ruangan ditebak dari nama channel yang mengandung
 * username pembuatnya. Cara itu salah dalam beberapa kasus yang tidak jarang:
 *
 *   - Pengguna dengan username sangat pendek cocok dengan hampir semua nama.
 *   - Mengganti nama ruangan lewat tombol Rename membuat pemilik aslinya
 *     kehilangan panelnya sendiri.
 *   - Siapa pun bisa mengganti username agar mengandung nama pemilik, lalu
 *     mengambil alih panel ruangan orang lain.
 *
 * Registry ini menyimpan pemetaan channelId ke ownerId secara eksplisit.
 *
 * Ada dua lapis penyimpanan. Map di memori dipakai untuk pemeriksaan cepat yang
 * harus sinkron, sedangkan Redis membuat pemetaannya bertahan melewati restart.
 * Tanpa lapis Redis, setiap restart membuat seluruh ruangan aktif jadi yatim:
 * tidak ada yang mengenali pemiliknya dan tidak ada yang menghapusnya saat
 * kosong.
 *
 * Bila Redis tidak dikonfigurasi, registry tetap berjalan dengan memori saja.
 * Perilakunya sama persis dengan sebelum PR ini, jadi Redis benar-benar
 * opsional dan tidak ada jalur yang gagal karenanya.
 */

const redis = require("./redisManager");
const { logger } = require("./logger");

// Seminggu. Ruangan sementara tidak pernah sepanjang itu, tapi TTL yang longgar
// lebih aman daripada kehilangan pemetaan pada ruangan yang memang dibiarkan
// hidup lama oleh pemiliknya.
const TTL_SECONDS = 7 * 24 * 60 * 60;

const keyFor = (channelId) => `tempvoice:owner:${channelId}`;

/** @type {Map<string, {ownerId: string, guildId: string, tier: string, createdAt: number}>} */
const memory = new Map();

/**
 * Catat kepemilikan sebuah ruangan.
 */
async function register(channelId, data) {
  memory.set(channelId, data);
  try {
    await redis.setCache(keyFor(channelId), data, TTL_SECONDS);
  } catch (error) {
    // Kegagalan Redis tidak boleh membatalkan pembuatan ruangan. Kita cuma
    // kehilangan ketahanan terhadap restart, bukan fungsinya.
    logger.warn(
      `[TempVoice] Gagal menyimpan kepemilikan ${channelId}: ${error.message}`,
    );
  }
}

/**
 * Ambil data kepemilikan, termasuk dari Redis bila tidak ada di memori.
 *
 * Ini jalur yang memulihkan keadaan setelah restart.
 */
async function get(channelId) {
  const local = memory.get(channelId);
  if (local) return local;

  try {
    const stored = await redis.getCache(keyFor(channelId));
    if (stored && stored.ownerId) {
      memory.set(channelId, stored);
      return stored;
    }
  } catch (error) {
    logger.warn(
      `[TempVoice] Gagal membaca kepemilikan ${channelId}: ${error.message}`,
    );
  }

  return null;
}

/**
 * Versi sinkron yang hanya melihat memori.
 *
 * Dipakai di jalur yang tidak boleh await. Nilai balik null berarti "tidak
 * tahu", bukan "bukan pemilik". Pemanggil wajib membedakan keduanya.
 */
function getSync(channelId) {
  return memory.get(channelId) || null;
}

/**
 * @returns {boolean|null} null bila kepemilikan ruangan ini tidak diketahui.
 */
function isOwnerSync(channelId, userId) {
  const entry = memory.get(channelId);
  if (!entry) return null;
  return entry.ownerId === userId;
}

async function isOwner(channelId, userId) {
  const entry = await get(channelId);
  if (!entry) return null;
  return entry.ownerId === userId;
}

async function isTracked(channelId) {
  return Boolean(await get(channelId));
}

async function unregister(channelId) {
  memory.delete(channelId);
  try {
    await redis.deleteCache(keyFor(channelId));
  } catch (error) {
    logger.warn(
      `[TempVoice] Gagal menghapus kepemilikan ${channelId}: ${error.message}`,
    );
  }
}

/**
 * Pindahkan kepemilikan ruangan ke pengguna lain.
 *
 * Belum dipakai panel mana pun, tapi keberadaannya membuat fitur "transfer
 * owner" jadi pekerjaan satu baris nanti. Dengan skema nama channel yang lama,
 * fitur itu mustahil.
 */
async function transfer(channelId, newOwnerId) {
  const entry = await get(channelId);
  if (!entry) return null;

  const updated = { ...entry, ownerId: newOwnerId };
  await register(channelId, updated);
  return updated;
}

module.exports = {
  register,
  get,
  getSync,
  isOwner,
  isOwnerSync,
  isTracked,
  unregister,
  transfer,
  TTL_SECONDS,
};
