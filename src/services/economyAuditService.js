"use strict";

const crypto = require("crypto");
const { logger } = require("../managers/logger");
const EconomyAuditLog = require("../models/mongo/EconomyAuditLog");

/**
 * Layanan pencatatan dan pelacakan audit log mutasi saldo ekonomi (SC, PD, VB).
 */
class EconomyAuditService {
  /**
   * Mencatat mutasi saldo ke MongoDB.
   * Operasi bersifat asynchronous dan non-blocking agar tidak memperlambat eksekusi bot.
   *
   * @param {Object} params
   * @param {string} params.actorId - ID aktor (admin, owner, user, atau SYSTEM)
   * @param {string} [params.actorType="SYSTEM"]
   * @param {string} params.targetUserId - ID pengguna penerima/pemilik saldo
   * @param {string} params.currency - Jenis mata uang (sukamajuCoins, pratamaDollars, scholarshipVouchers)
   * @param {string} params.action - Jenis mutasi (CREDIT, DEBIT, TRANSFER, SET, ROLLBACK, RESET)
   * @param {number} params.amount - Jumlah mutasi
   * @param {number} [params.balanceBefore=0]
   * @param {number} [params.balanceAfter=0]
   * @param {string} params.reason - Alasan/keterangan mutasi
   * @param {Object} [params.metadata={}] - Data tambahan terkait transaksi
   * @param {string} [params.guildId=null]
   * @returns {Promise<Object|null>}
   */
  async recordAudit({
    actorId,
    actorType = "SYSTEM",
    targetUserId,
    currency,
    action,
    amount,
    balanceBefore = 0,
    balanceAfter = 0,
    reason,
    metadata = {},
    guildId = null,
  }) {
    if (!targetUserId || !currency || !action) {
      logger.warn("[EconomyAuditService] Parameter tidak lengkap untuk mencatat audit.");
      return null;
    }

    const parsedAmount = Number(amount);
    const parsedBefore = Number(balanceBefore !== undefined ? balanceBefore : 0);
    const parsedAfter = Number(balanceAfter !== undefined ? balanceAfter : 0);

    if (
      !Number.isFinite(parsedAmount) ||
      parsedAmount < 0 ||
      !Number.isFinite(parsedBefore) ||
      parsedBefore < 0 ||
      !Number.isFinite(parsedAfter) ||
      parsedAfter < 0
    ) {
      logger.warn("[EconomyAuditService] Nominal atau saldo audit tidak valid.");
      return null;
    }

    const transactionId = "TX-" + Date.now() + "-" + crypto.randomBytes(4).toString("hex").toUpperCase();

    try {
      const logEntry = await EconomyAuditLog.create({
        transactionId,
        actorId: actorId || "SYSTEM",
        actorType,
        targetUserId,
        currency,
        action,
        amount: parsedAmount,
        balanceBefore: parsedBefore,
        balanceAfter: parsedAfter,
        reason: String(reason || "Penyesuaian saldo sistem").slice(0, 255),
        metadata,
        guildId,
      });

      return logEntry;
    } catch (err) {
      logger.error("[EconomyAuditService] Gagal mencatat log ekonomi ke MongoDB: " + (err?.message || err));
      return null;
    }
  }

  /**
   * Mengambil riwayat mutasi saldo untuk pengguna tertentu.
   * @param {string} targetUserId
   * @param {number} [limit=10]
   * @returns {Promise<Array>}
   */
  async getRecentAudits(targetUserId, limit = 10) {
    if (!targetUserId) return [];
    const numLimit = Number(limit);
    if (numLimit === 0) return [];
    const safeLimit = Math.min(Math.max(1, Number.isFinite(numLimit) ? Math.floor(numLimit) : 10), 50);

    try {
      return await EconomyAuditLog.find({ targetUserId })
        .sort({ createdAt: -1 })
        .limit(safeLimit)
        .lean();
    } catch (err) {
      logger.error("[EconomyAuditService] Gagal membaca log ekonomi: " + (err?.message || err));
      return [];
    }
  }
}

module.exports = new EconomyAuditService();
