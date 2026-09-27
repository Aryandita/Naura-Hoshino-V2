"use strict";

const UserAlias = require("../models/mongo/UserAlias");
const mongoManager = require("../managers/mongoManager");
const { logger } = require("../managers/logger");

// Local LRU / in-memory cache untuk performa resolusi < 1ms
const memoryCache = new Map();
const MAX_ALIASES_DEFAULT = 20;

/**
 * Membersihkan format nama alias atau perintah target.
 * @param {string} str
 * @returns {string}
 */
function sanitizeName(str) {
  if (!str) return "";
  return str.toLowerCase().replace(/^[n!/]+/, "").trim();
}

/**
 * Mengambil semua alias milik seorang user.
 * @param {string} userId
 * @returns {Promise<Array<{name: string, targetCommand: string, createdAt: Date}>>}
 */
async function getAliases(userId) {
  if (!userId) return [];

  if (memoryCache.has(userId)) {
    return memoryCache.get(userId);
  }

  if (!mongoManager?.isReady) {
    return [];
  }

  try {
    const doc = await UserAlias.findOne({ userId }).lean();
    const list = doc?.aliases || [];
    memoryCache.set(userId, list);
    return list;
  } catch (err) {
    logger.warn(`[AliasService] Gagal membaca alias untuk user ${userId}:`, err.message);
    return [];
  }
}

/**
 * Menambahkan atau memperbarui alias pengguna.
 * @param {string} userId
 * @param {string} aliasName
 * @param {string} targetCommand
 * @returns {Promise<{success: boolean, message: string, list?: Array}>}
 */
async function setAlias(userId, aliasName, targetCommand) {
  if (!userId) return { success: false, message: "User ID diperlukan." };

  const cleanName = sanitizeName(aliasName);
  const cleanTarget = targetCommand?.trim();

  if (!cleanName || cleanName.length < 1 || cleanName.length > 20) {
    return {
      success: false,
      message: "Nama shortcut harus berupa teks 1 sampai 20 karakter.",
    };
  }

  if (!cleanTarget || cleanTarget.length < 1) {
    return {
      success: false,
      message: "Perintah tujuan shortcut tidak boleh kosong.",
    };
  }

  if (cleanName === sanitizeName(cleanTarget.split(" ")[0])) {
    return {
      success: false,
      message: "Nama shortcut tidak boleh sama dengan perintah tujuannya.",
    };
  }

  const currentList = await getAliases(userId);
  const existingIndex = currentList.findIndex((a) => a.name === cleanName);

  if (existingIndex === -1 && currentList.length >= MAX_ALIASES_DEFAULT) {
    return {
      success: false,
      message: `Batas maksimal shortcut telah tercapai (${MAX_ALIASES_DEFAULT} shortcut).`,
    };
  }

  let updatedList;
  if (existingIndex >= 0) {
    updatedList = [...currentList];
    updatedList[existingIndex] = {
      name: cleanName,
      targetCommand: cleanTarget,
      createdAt: new Date(),
    };
  } else {
    updatedList = [
      ...currentList,
      {
        name: cleanName,
        targetCommand: cleanTarget,
        createdAt: new Date(),
      },
    ];
  }

  memoryCache.set(userId, updatedList);

  if (mongoManager?.isReady) {
    try {
      await UserAlias.findOneAndUpdate(
        { userId },
        { $set: { aliases: updatedList } },
        { upsert: true, new: true },
      );
    } catch (err) {
      logger.error(`[AliasService] Gagal menyimpan alias ke MongoDB:`, err.message);
    }
  }

  return {
    success: true,
    message: `Shortcut \`${cleanName}\` berhasil diarahkan ke \`${cleanTarget}\`.`,
    list: updatedList,
  };
}

/**
 * Menghapus alias pengguna.
 * @param {string} userId
 * @param {string} aliasName
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function removeAlias(userId, aliasName) {
  if (!userId) return { success: false, message: "User ID diperlukan." };

  const cleanName = sanitizeName(aliasName);
  const currentList = await getAliases(userId);
  const filteredList = currentList.filter((a) => a.name !== cleanName);

  if (filteredList.length === currentList.length) {
    return {
      success: false,
      message: `Shortcut \`${cleanName}\` tidak ditemukan.`,
    };
  }

  memoryCache.set(userId, filteredList);

  if (mongoManager?.isReady) {
    try {
      await UserAlias.findOneAndUpdate(
        { userId },
        { $set: { aliases: filteredList } },
        { upsert: true },
      );
    } catch (err) {
      logger.error(`[AliasService] Gagal menghapus alias di MongoDB:`, err.message);
    }
  }

  return {
    success: true,
    message: `Shortcut \`${cleanName}\` berhasil dihapus.`,
  };
}

/**
 * Menyelesaikan alias pengguna jika cocok.
 * @param {string} userId
 * @param {string} triggerCommand - kata pertama yang diketik pengguna
 * @returns {Promise<string|null>} - perintah target pengganti atau null bila tidak ada
 */
async function resolveAlias(userId, triggerCommand) {
  if (!userId || !triggerCommand) return null;
  const cleanTrigger = sanitizeName(triggerCommand);
  const userAliases = await getAliases(userId);
  const match = userAliases.find((a) => a.name === cleanTrigger);
  return match ? match.targetCommand : null;
}

/**
 * Membersihkan memory cache (berguna untuk testing).
 */
function clearCache() {
  memoryCache.clear();
}

module.exports = {
  sanitizeName,
  getAliases,
  setAlias,
  removeAlias,
  resolveAlias,
  clearCache,
  MAX_ALIASES_DEFAULT,
};
