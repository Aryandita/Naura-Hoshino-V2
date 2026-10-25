"use strict";

const { logger } = require("../../managers/logger");
const cacheManager = require("../../managers/cacheManager");

const DEFAULT_TAX_RATES = {
  market_sell: 0.05,
  market_buy: 0.02,
  crafting: 0.03,
  trade_p2p: 0.01,
};

const MIN_TAX_AMOUNT = 1;
const MAX_TAX_RATE = 0.15;

class GuildTaxEngine {
  /**
   * Menghitung pajak untuk transaksi tertentu
   * @param {string} guildId
   * @param {string} transactionType - "market_sell", "market_buy", "crafting", "trade_p2p"
   * @param {number} amount - Nominal transaksi
   * @returns {Promise<{ taxAmount: number, rate: number, afterTax: number }>}
   */
  static async calculateTax(guildId, transactionType, amount) {
    try {
      const settings = await cacheManager.getGuildSettings(guildId);
      const customRates = settings?.taxRates || {};
      const rate = Math.min(
        MAX_TAX_RATE,
        Math.max(0, customRates[transactionType] ?? DEFAULT_TAX_RATES[transactionType] ?? 0)
      );

      const rawTax = Math.floor(amount * rate);
      const taxAmount = Math.max(rawTax > 0 ? MIN_TAX_AMOUNT : 0, rawTax);
      const afterTax = amount - taxAmount;

      return { taxAmount, rate, afterTax };
    } catch (error) {
      logger.error(`[GuildTax] Calculate error for guild ${guildId}:`, error);
      return { taxAmount: 0, rate: 0, afterTax: amount };
    }
  }

  /**
   * Memotong pajak dan mengalirkan ke ServerTreasury
   * @param {string} guildId
   * @param {string} userId
   * @param {string} transactionType
   * @param {number} amount
   * @param {string} currency
   * @returns {Promise<{ ok: boolean, taxCollected: number, reason?: string }>}
   */
  static async collectTax(guildId, userId, transactionType, amount, currency = "sukamajuCoins") {
    try {
      const { taxAmount } = await this.calculateTax(guildId, transactionType, amount);

      if (taxAmount <= 0) {
        return { ok: true, taxCollected: 0 };
      }

      await cacheManager.incrementUserSurvival(userId, { [currency]: -taxAmount });

      const ServerTreasury = require("../../models/ServerTreasury");
      await ServerTreasury.create({
        guildId,
        mutationType: "tax_collection",
        amount: taxAmount,
        currency,
        actorUserId: userId,
        description: `Tax ${transactionType}`,
      });

      logger.info(`[GuildTax] Collected ${taxAmount} ${currency} from ${userId} for ${transactionType}`);
      return { ok: true, taxCollected: taxAmount };
    } catch (error) {
      logger.error(`[GuildTax] Collect error for guild ${guildId}, user ${userId}:`, error);
      return { ok: false, taxCollected: 0, reason: "COLLECTION_FAILED" };
    }
  }

  /**
   * Mengatur rate pajak custom untuk guild
   * @param {string} guildId
   * @param {object} newRates
   */
  static async setTaxRates(guildId, newRates) {
    try {
      const validatedRates = {};
      for (const [type, rate] of Object.entries(newRates)) {
        if (DEFAULT_TAX_RATES[type] !== undefined) {
          validatedRates[type] = Math.min(MAX_TAX_RATE, Math.max(0, Number(rate)));
        }
      }

      const GuildSettings = require("../../models/GuildSettings");
      await GuildSettings.upsert({ guildId, taxRates: validatedRates });
      logger.info(`[GuildTax] Updated rates for guild ${guildId}:`, validatedRates);
      return { ok: true, rates: validatedRates };
    } catch (error) {
      logger.error(`[GuildTax] Set rates error for guild ${guildId}:`, error);
      return { ok: false, reason: "UPDATE_FAILED" };
    }
  }

  static getDefaultRates() {
    return { ...DEFAULT_TAX_RATES };
  }
}

module.exports = { GuildTaxEngine, DEFAULT_TAX_RATES, MAX_TAX_RATE };
