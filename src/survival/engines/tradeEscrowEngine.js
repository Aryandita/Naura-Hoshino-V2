"use strict";

const { logger } = require("../../managers/logger");
const cacheManager = require("../../managers/cacheManager");

const ESCROW_TIMEOUT_MS = 300000;
const MAX_ACTIVE_ESCROWS_PER_USER = 5;

class TradeEscrowEngine {
  constructor() {
    this.activeEscrows = new Map();
  }

  /**
   * Membuat escrow baru untuk trade player-to-player
   * @param {object} params - { sellerId, buyerId, itemId, price, currency }
   * @returns {{ ok: boolean, escrowId?: string, reason?: string }}
   */
  createEscrow(params) {
    const { sellerId, buyerId, itemId, price, currency } = params;

    if (!sellerId || !buyerId || !itemId || price === undefined) {
      return { ok: false, reason: "INVALID_PARAMS" };
    }

    if (sellerId === buyerId) {
      return { ok: false, reason: "SELF_TRADE_NOT_ALLOWED" };
    }

    const sellerEscrows = this._countUserEscrows(sellerId);
    const buyerEscrows = this._countUserEscrows(buyerId);

    if (sellerEscrows >= MAX_ACTIVE_ESCROWS_PER_USER || buyerEscrows >= MAX_ACTIVE_ESCROWS_PER_USER) {
      return { ok: false, reason: "MAX_ESCROWS_REACHED" };
    }

    const escrowId = `escrow_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    this.activeEscrows.set(escrowId, {
      id: escrowId,
      sellerId,
      buyerId,
      itemId,
      price,
      currency: currency || "sukamajuCoins",
      status: "pending",
      createdAt: Date.now(),
      expiresAt: Date.now() + ESCROW_TIMEOUT_MS,
      sellerConfirmed: false,
      buyerConfirmed: false,
    });

    logger.info(`[TradeEscrow] Created ${escrowId}: ${sellerId} -> ${buyerId}, item ${itemId}, price ${price}`);

    return { ok: true, escrowId };
  }

  /**
   * Konfirmasi trade dari salah satu pihak
   * @param {string} escrowId
   * @param {string} userId
   * @returns {{ ok: boolean, completed?: boolean, reason?: string }}
   */
  async confirmTrade(escrowId, userId) {
    const escrow = this.activeEscrows.get(escrowId);
    if (!escrow) return { ok: false, reason: "ESCROW_NOT_FOUND" };
    if (escrow.status !== "pending") return { ok: false, reason: "ESCROW_NOT_PENDING" };

    if (Date.now() > escrow.expiresAt) {
      escrow.status = "expired";
      return { ok: false, reason: "ESCROW_EXPIRED" };
    }

    if (userId === escrow.sellerId) escrow.sellerConfirmed = true;
    else if (userId === escrow.buyerId) escrow.buyerConfirmed = true;
    else return { ok: false, reason: "NOT_PARTICIPANT" };

    if (escrow.sellerConfirmed && escrow.buyerConfirmed) {
      return await this._executeTrade(escrow);
    }

    return { ok: true, completed: false };
  }

  /**
   * Batalkan escrow
   * @param {string} escrowId
   * @param {string} userId
   */
  cancelEscrow(escrowId, userId) {
    const escrow = this.activeEscrows.get(escrowId);
    if (!escrow) return { ok: false, reason: "ESCROW_NOT_FOUND" };
    if (userId !== escrow.sellerId && userId !== escrow.buyerId) {
      return { ok: false, reason: "NOT_PARTICIPANT" };
    }

    escrow.status = "cancelled";
    this.activeEscrows.delete(escrowId);
    logger.info(`[TradeEscrow] Cancelled ${escrowId} by ${userId}`);
    return { ok: true };
  }

  getEscrow(escrowId) {
    return this.activeEscrows.get(escrowId) || null;
  }

  cleanupExpired() {
    const now = Date.now();
    let cleaned = 0;
    for (const [id, escrow] of this.activeEscrows) {
      if (now > escrow.expiresAt && escrow.status === "pending") {
        escrow.status = "expired";
        this.activeEscrows.delete(id);
        cleaned++;
      }
    }
    if (cleaned > 0) logger.info(`[TradeEscrow] Cleaned ${cleaned} expired escrows`);
    return cleaned;
  }

  async _executeTrade(escrow) {
    try {
      const buyerProfile = await cacheManager.getUserSurvival(escrow.buyerId);
      const currencyField = escrow.currency;

      if (!buyerProfile || (buyerProfile[currencyField] || 0) < escrow.price) {
        escrow.status = "failed_insufficient_funds";
        this.activeEscrows.delete(escrow.id);
        return { ok: false, reason: "BUYER_INSUFFICIENT_FUNDS" };
      }

      await cacheManager.incrementUserSurvival(escrow.buyerId, { [currencyField]: -escrow.price });
      await cacheManager.incrementUserSurvival(escrow.sellerId, { [currencyField]: escrow.price });

      escrow.status = "completed";
      this.activeEscrows.delete(escrow.id);

      logger.info(`[TradeEscrow] Completed ${escrow.id}: ${escrow.price} ${escrow.currency} transferred`);
      return { ok: true, completed: true, escrowId: escrow.id };
    } catch (error) {
      logger.error(`[TradeEscrow] Execution error for ${escrow.id}:`, error);
      escrow.status = "error";
      return { ok: false, reason: "EXECUTION_ERROR" };
    }
  }

  _countUserEscrows(userId) {
    let count = 0;
    for (const escrow of this.activeEscrows.values()) {
      if ((escrow.sellerId === userId || escrow.buyerId === userId) && escrow.status === "pending") {
        count++;
      }
    }
    return count;
  }
}

module.exports = { TradeEscrowEngine, ESCROW_TIMEOUT_MS, MAX_ACTIVE_ESCROWS_PER_USER };
