"use strict";

const cacheManager = require("../../managers/cacheManager");
const redisManager = require("../../managers/redisManager");
const { logger } = require("../../managers/logger");

const REDIS_KEY = "survival:outlaw_bounties";
const memoryBounties = new Map();

/**
 * Mengambil seluruh daftar buronan aktif di Naura Wilds.
 * @returns {Promise<Array<{targetUserId: string, rewardNsf: number, issuerId: string, reason: string, placedAt: string}>>}
 */
async function getWantedBoard() {
  if (redisManager.isReady) {
    try {
      const raw = await redisManager.getCache(REDIS_KEY);
      if (raw) {
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch (err) {
      logger.warn(`[OutlawBountyEngine] Redis read error: ${err.message}`);
    }
  }

  return Array.from(memoryBounties.values());
}

/**
 * Menyimpan daftar buronan ke Redis dan memori.
 * @param {Array} list
 */
async function saveWantedBoard(list) {
  memoryBounties.clear();
  for (const b of list) {
    memoryBounties.set(b.targetUserId, b);
  }

  if (redisManager.isReady) {
    try {
      await redisManager.setCache(REDIS_KEY, JSON.stringify(list), 86400 * 30);
    } catch (err) {
      logger.warn(`[OutlawBountyEngine] Redis save error: ${err.message}`);
    }
  }
}

/**
 * Mendaftarkan buronan baru atau menambah imbalan buronan yang sudah ada.
 * @param {object} params
 * @param {string} params.issuerId - Pengaju sayembara
 * @param {string} params.targetUserId - Target buronan
 * @param {number} params.rewardNsf - Nilai hadiah imbalan
 * @param {string} params.reason - Alasan penempatan bounty
 * @returns {Promise<{success: boolean, message: string, bounty?: object}>}
 */
async function placeOutlawBounty({ issuerId, targetUserId, rewardNsf, reason }) {
  if (!issuerId || !targetUserId) {
    return { success: false, message: "ID pemburu dan target buronan harus valid." };
  }

  if (issuerId === targetUserId) {
    return { success: false, message: "Kamu tidak bisa menaruh buronan atas kepalamu sendiri!" };
  }

  const safeReward = parseInt(rewardNsf, 10) || 0;
  if (safeReward < 100) {
    return { success: false, message: "Imbalan buronan minimal 100 Star Fragments (NSF)." };
  }

  // Potong saldo pengaju secara atomik
  const debitOk = await cacheManager.debitUserSurvival(issuerId, "starFragments", safeReward);
  if (!debitOk) {
    return {
      success: false,
      message: `Saldo Star Fragments kamu tidak mencukupi untuk imbalan ${safeReward.toLocaleString("id-ID")} NSF.`,
    };
  }

  const board = await getWantedBoard();
  const existingIdx = board.findIndex((b) => b.targetUserId === targetUserId);

  let bountyRecord;
  if (existingIdx >= 0) {
    board[existingIdx].rewardNsf += safeReward;
    board[existingIdx].reason = reason || board[existingIdx].reason;
    board[existingIdx].updatedAt = new Date().toISOString();
    bountyRecord = board[existingIdx];
  } else {
    bountyRecord = {
      targetUserId,
      rewardNsf: safeReward,
      issuerId,
      reason: reason || "Dicari hidup atau mati di alam liar Naura Wilds.",
      placedAt: new Date().toISOString(),
    };
    board.push(bountyRecord);
  }

  await saveWantedBoard(board);
  return {
    success: true,
    message: `Sayembara buronan untuk <@${targetUserId}> berhasil ditempatkan sebesar **${bountyRecord.rewardNsf.toLocaleString("id-ID")} NSF**!`,
    bounty: bountyRecord,
  };
}

/**
 * Mencairkan imbalan buronan ke pemburu setelah berhasil mengalahkan buronan.
 * @param {string} hunterId - ID pemburu yang menangkap
 * @param {string} targetUserId - ID buronan yang ditangkap
 * @returns {Promise<{success: boolean, message: string, rewardNsf?: number}>}
 */
async function claimOutlawBounty(hunterId, targetUserId) {
  if (!hunterId || !targetUserId) {
    return { success: false, message: "ID hunter dan buronan harus ditentukan." };
  }

  if (hunterId === targetUserId) {
    return { success: false, message: "Buronan tidak bisa mengklaim hadiah atas dirinya sendiri." };
  }

  const board = await getWantedBoard();
  const existingIdx = board.findIndex((b) => b.targetUserId === targetUserId);

  if (existingIdx === -1) {
    return { success: false, message: "Target ini tidak terdaftar di Papan Buronan aktif." };
  }

  const bounty = board[existingIdx];
  const rewardNsf = bounty.rewardNsf;

  // Hapus dari papan buronan
  board.splice(existingIdx, 1);
  await saveWantedBoard(board);

  // Transfer imbalan ke hunter secara atomik
  await cacheManager.incrementUserSurvival(hunterId, "starFragments", rewardNsf);

  logger.info(`[OutlawBounty] Pemburu ${hunterId} berhasil mengeksekusi buronan ${targetUserId}, imbalan: ${rewardNsf} NSF.`);
  return {
    success: true,
    message: `Selamat! Kamu berhasil menuntaskan buronan <@${targetUserId}> dan mengklaim hadiah **${rewardNsf.toLocaleString("id-ID")} NSF**!`,
    rewardNsf,
  };
}

/**
 * Membersihkan state papan buronan (untuk testing).
 */
function clearBoardMemory() {
  memoryBounties.clear();
}

module.exports = {
  getWantedBoard,
  placeOutlawBounty,
  claimOutlawBounty,
  clearBoardMemory,
};
