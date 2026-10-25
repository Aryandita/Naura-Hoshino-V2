"use strict";

/**
 * @file dynamicMerchantTrader.js
 * @description Blueprint NPC Pedagang Dinamis dengan Memori Transaksi & Preferensi Pemain.
 * Modul ini diarsipkan di pending_plugin/ agar tidak memicu pemanggilan LLM pada free-tier.
 */

const { logger } = require("../../src/managers/logger");

class DynamicMerchantTrader {
  constructor(merchantId, baseConfig = {}) {
    this.merchantId = merchantId;
    this.name = baseConfig.name || "Pedagang Desa";
    this.specialty = baseConfig.specialty || "general";
    this.greetingStyle = baseConfig.greetingStyle || "ramah";
    this.priceMultiplier = baseConfig.priceMultiplier || 1.0;
    this.transactionMemory = new Map();
  }

  /**
   * Menghasilkan respons dagang dinamis berdasarkan histori transaksi pemain
   * @param {string} userId - ID Pengguna Discord
   * @param {string} tradeAction - Aksi perdagangan ("buy", "sell", "bargain", "inquire")
   * @param {object} itemData - Data item yang diperdagangkan
   * @param {object} playerProfile - Profil ekonomi pemain
   * @returns {Promise<{ dialogue: string, adjustedPrice: number, dealAccepted: boolean }>}
   */
  async generateTradeInteraction(userId, tradeAction, itemData = {}, playerProfile = {}) {
    try {
      logger.info(`[DynamicMerchant:${this.merchantId}] Interaksi dagang dengan user ${userId}`);

      const transactionHistory = this.transactionMemory.get(userId) || [];
      const totalTransactions = transactionHistory.length;
      const playerReputation = playerProfile.reputation || 0;

      let promptTemplate = `Kamu adalah ${this.name}, pedagang spesialis ${this.specialty} di Naura Wilds.\n`;
      promptTemplate += `Gaya bicara: ${this.greetingStyle}. Multiplier harga dasar: ${this.priceMultiplier}x.\n`;
      promptTemplate += `Pemain memiliki reputasi: ${playerReputation}. Total transaksi sebelumnya: ${totalTransactions}.\n`;
      promptTemplate += `Aksi saat ini: "${tradeAction}" untuk item "${itemData.name || 'umum'}".\n`;
      promptTemplate += `Berikan respons singkat (maksimal 2 kalimat) dalam bahasa Indonesia.`;

      const adjustedPrice = this._calculateAdjustedPrice(itemData.basePrice || 100, playerReputation, totalTransactions);

      return {
        merchantId: this.merchantId,
        merchantName: this.name,
        promptPrepared: promptTemplate,
        simulatedDialogue: this._generateSimulatedDialogue(tradeAction, itemData.name),
        adjustedPrice,
        dealAccepted: true,
        readyForAiActivation: true,
      };
    } catch (error) {
      logger.error(`[DynamicMerchant] Galat pada interaksi ${this.merchantId}:`, error);
      return {
        merchantId: this.merchantId,
        merchantName: this.name,
        simulatedDialogue: "Selamat datang di toko saya!",
        adjustedPrice: itemData.basePrice || 100,
        dealAccepted: false,
        readyForAiActivation: false,
      };
    }
  }

  /**
   * Mencatat transaksi ke memori pedagang
   * @param {string} userId
   * @param {object} transactionRecord
   */
  recordTransaction(userId, transactionRecord) {
    if (!this.transactionMemory.has(userId)) {
      this.transactionMemory.set(userId, []);
    }
    this.transactionMemory.get(userId).push({
      ...transactionRecord,
      timestamp: Date.now(),
    });
  }

  _calculateAdjustedPrice(basePrice, reputation, transactionCount) {
    const loyaltyDiscount = Math.min(transactionCount * 0.02, 0.15);
    const reputationBonus = Math.min(reputation * 0.001, 0.10);
    const finalMultiplier = this.priceMultiplier * (1 - loyaltyDiscount - reputationBonus);
    return Math.round(basePrice * Math.max(finalMultiplier, 0.7));
  }

  _generateSimulatedDialogue(action, itemName) {
    const dialogues = {
      buy: `Tentu, ${itemName || 'barang ini'} tersedia! Harga spesial untukmu.`,
      sell: `Saya bisa beli ${itemName || 'itu'} darimu dengan harga wajar.`,
      bargain: `Hmm, mari kita negosiasi. Saya beri diskon kecil karena kamu pelanggan setia.`,
      inquire: `${itemName || 'Barang itu'}? Kualitas terbaik dari supplier terpercaya!`,
    };
    return dialogues[action] || "Ada yang bisa saya bantu hari ini?";
  }
}

module.exports = {
  DynamicMerchantTrader,
};
