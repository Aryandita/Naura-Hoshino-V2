/**
 * @namespace: plugin/leveling/xpBuffer.js
 * @type: Module
 * @copyright 2026 Aryandita Praftian
 * @assistant Naura Hoshino
 * @version 1.0.0
 * @description Penyangga XP di Redis supaya obrolan ramai tidak menulis ke MySQL tiap pesan.
 */

"use strict";

const redisManager = require("../managers/redisManager");
const { sequelize } = require("../managers/dbManager");
const UserLeveling = require("../models/UserLeveling");
const { logger } = require("../managers/logger");

// Dua hash terpisah, bukan satu hash berisi JSON, supaya penambahan XP bisa
// memakai HINCRBY. Operasi itu atomik di sisi Redis sehingga dua shard yang
// menulis pengguna yang sama tidak pernah saling menimpa.
const PENDING_XP_KEY = "xp:pending:xp";
const PENDING_MSG_KEY = "xp:pending:msg";

const BASE_TTL = 3600;
const FLUSH_INTERVAL_MS = 5 * 60 * 1000;

let flushTimer = null;
let flushing = false;

function toInt(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function baseKey(guildId, userId) {
  return `xp:base:${guildId}:${userId}`;
}

function fieldOf(guildId, userId) {
  return `${guildId}:${userId}`;
}

// Pemisah pertama saja yang dipakai. ID Discord tidak pernah memuat titik dua,
// tetapi memotong di indeks pertama tetap lebih aman daripada split penuh.
function parseField(field) {
  const sep = field.indexOf(":");
  if (sep === -1) return null;
  return { guildId: field.slice(0, sep), userId: field.slice(sep + 1) };
}

function isEnabled() {
  return redisManager.isReady;
}

function start() {
  if (flushTimer) return;

  flushTimer = setInterval(() => {
    flush().catch((error) =>
      logger.error("[XP BUFFER] Flush berkala gagal:", error.message),
    );
  }, FLUSH_INTERVAL_MS);

  // Tanpa unref, interval ini menahan event loop dan proses menolak mati saat
  // shutdown sampai watchdog memaksanya keluar. Lihat aturan 1.9 di AGENTS.md.
  if (flushTimer.unref) flushTimer.unref();
}

function stop() {
  if (!flushTimer) return;
  clearInterval(flushTimer);
  flushTimer = null;
}

/**
 * Menambah XP tertunda untuk satu pengguna di satu server.
 *
 * @returns {Promise<number|null>} Total XP tertunda setelah ditambah, atau null bila Redis tidak siap.
 */
async function addXp(guildId, userId, amount, messages = 1) {
  if (!isEnabled()) return null;

  const field = fieldOf(guildId, userId);

  try {
    const replies = await redisManager.client
      .multi()
      .hIncrBy(PENDING_XP_KEY, field, toInt(amount))
      .hIncrBy(PENDING_MSG_KEY, field, toInt(messages))
      .exec();

    start();
    return toInt(replies[0]);
  } catch (error) {
    logger.error("[XP BUFFER] Gagal menyimpan XP tertunda:", error.message);
    return null;
  }
}

/** XP dan jumlah pesan yang masih menunggu, untuk pembaca seperti perintah rank. */
async function getPending(guildId, userId) {
  if (!isEnabled()) return { xp: 0, messages: 0 };

  const field = fieldOf(guildId, userId);

  try {
    const replies = await redisManager.client
      .multi()
      .hGet(PENDING_XP_KEY, field)
      .hGet(PENDING_MSG_KEY, field)
      .exec();

    return { xp: toInt(replies[0]), messages: toInt(replies[1]) };
  } catch (error) {
    logger.error("[XP BUFFER] Gagal membaca XP tertunda:", error.message);
    return { xp: 0, messages: 0 };
  }
}

/**
 * Nilai dasar dari database, disimpan sebentar di Redis. Inilah yang memangkas
 * pembacaan: tanpa cache ini setiap pesan tetap memicu satu findOrCreate.
 */
async function readBase(guildId, userId) {
  const key = baseKey(guildId, userId);

  if (isEnabled()) {
    const cached = await redisManager.getCache(key);
    if (
      cached &&
      typeof cached.xp === "number" &&
      typeof cached.level === "number"
    ) {
      return cached;
    }
  }

  const [row] = await UserLeveling.findOrCreate({
    where: { userId, guildId },
    defaults: { xp: 0, level: 1, messageCount: 0, lastActivity: new Date(0) },
  });

  const base = { xp: toInt(row.xp), level: toInt(row.level) || 1 };
  if (isEnabled()) await redisManager.setCache(key, base, BASE_TTL);
  return base;
}

async function invalidateBase(guildId, userId) {
  if (!isEnabled()) return;
  await redisManager.deleteCache(baseKey(guildId, userId));
}

/**
 * Menambahkan XP batch ke satu baris. Memakai literal SQL, bukan baca lalu tulis,
 * supaya dua shard yang menyetor bersamaan tidak saling menghapus setoran.
 */
async function applyToDatabase(guildId, userId, xp, messages) {
  const addedXp = toInt(xp);
  const addedMessages = toInt(messages);
  if (addedXp <= 0 && addedMessages <= 0) return;

  // Kedua nilai sudah lewat toInt, jadi tidak ada teks pengguna yang masuk ke SQL.
  const [affected] = await UserLeveling.update(
    {
      xp: sequelize.literal(`xp + ${addedXp}`),
      messageCount: sequelize.literal(`messageCount + ${addedMessages}`),
      lastActivity: new Date(),
    },
    { where: { userId, guildId } },
  );

  if (affected === 0) {
    await UserLeveling.findOrCreate({
      where: { userId, guildId },
      defaults: {
        xp: addedXp,
        level: 1,
        messageCount: addedMessages,
        lastActivity: new Date(),
      },
    });
  }
}

/**
 * Menyetorkan XP satu pengguna sekarang, lalu mengembalikan barisnya yang sudah
 * mutakhir. Dipakai saat ambang naik level terlampaui, karena pengumuman naik
 * level tidak boleh menunggu siklus flush berikutnya.
 *
 * @returns {Promise<object|null>} Baris UserLeveling terbaru, atau null bila gagal.
 */
async function settleUser(guildId, userId) {
  const field = fieldOf(guildId, userId);
  let xp = 0;
  let messages = 0;

  if (isEnabled()) {
    try {
      // Baca dan hapus dalam satu multi. Bila dipisah, XP yang masuk di
      // antara keduanya akan terhapus tanpa pernah tercatat.
      const replies = await redisManager.client
        .multi()
        .hGet(PENDING_XP_KEY, field)
        .hGet(PENDING_MSG_KEY, field)
        .hDel(PENDING_XP_KEY, field)
        .hDel(PENDING_MSG_KEY, field)
        .exec();

      xp = toInt(replies[0]);
      messages = toInt(replies[1]);
    } catch (error) {
      logger.error("[XP BUFFER] Gagal mengambil XP tertunda:", error.message);
      return null;
    }
  }

  try {
    await applyToDatabase(guildId, userId, xp, messages);
    await invalidateBase(guildId, userId);
    return await UserLeveling.findOne({ where: { userId, guildId } });
  } catch (error) {
    logger.error(
      "[XP BUFFER] Gagal menyetorkan XP ke database:",
      error.message,
    );

    // XP sudah dikeluarkan dari Redis di atas. Kembalikan supaya kegagalan
    // database tidak menghanguskan XP pengguna.
    if (xp > 0 || messages > 0) await addXp(guildId, userId, xp, messages);
    return null;
  }
}

async function renameIfExists(from, to) {
  try {
    await redisManager.client.rename(from, to);
    return true;
  } catch (error) {
    // RENAME melempar bila key sumber tidak ada, dan itu berarti tidak ada
    // yang perlu disetor.
    return false;
  }
}

/**
 * Menyetorkan seluruh XP tertunda ke database.
 *
 * @returns {Promise<number>} Jumlah pengguna yang berhasil disetor.
 */
async function flush() {
  if (!isEnabled() || flushing) return 0;

  flushing = true;
  const suffix = `${Date.now()}:${process.pid}`;
  const xpKey = `${PENDING_XP_KEY}:flush:${suffix}`;
  const msgKey = `${PENDING_MSG_KEY}:flush:${suffix}`;

  try {
    // RENAME bersifat atomik. Pesan yang masuk setelah titik ini menulis ke
    // hash baru, jadi tidak ada XP yang hilang karena terhapus bersama batch.
    const renamed = await renameIfExists(PENDING_XP_KEY, xpKey);
    if (!renamed) return 0;
    await renameIfExists(PENDING_MSG_KEY, msgKey);

    const pendingXp = (await redisManager.client.hGetAll(xpKey)) || {};
    let pendingMsg = {};
    try {
      pendingMsg = (await redisManager.client.hGetAll(msgKey)) || {};
    } catch (error) {
      pendingMsg = {};
    }

    let written = 0;

    for (const [field, value] of Object.entries(pendingXp)) {
      const parsed = parseField(field);
      if (!parsed) continue;

      try {
        await applyToDatabase(
          parsed.guildId,
          parsed.userId,
          value,
          pendingMsg[field],
        );
        await invalidateBase(parsed.guildId, parsed.userId);
        written += 1;
      } catch (error) {
        logger.error("[XP BUFFER] Gagal menulis XP batch:", error.message);
        await addXp(
          parsed.guildId,
          parsed.userId,
          toInt(value),
          toInt(pendingMsg[field]),
        );
      }
    }

    try {
      await redisManager.client.del([xpKey, msgKey]);
    } catch (error) {
      logger.error("[XP BUFFER] Gagal membersihkan key batch:", error.message);
    }

    if (written > 0) {
      logger.info(
        `[XP BUFFER] Menyetorkan XP ${written} pengguna ke database.`,
      );
    }

    return written;
  } catch (error) {
    logger.error("[XP BUFFER] Flush gagal:", error.message);
    return 0;
  } finally {
    flushing = false;
  }
}

module.exports = {
  addXp,
  getPending,
  readBase,
  invalidateBase,
  settleUser,
  flush,
  start,
  stop,
  isEnabled,
  FLUSH_INTERVAL_MS,
  PENDING_XP_KEY,
  PENDING_MSG_KEY,
};
