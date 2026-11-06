"use strict";

/**
 * @file dynamicMerchantTrader.js
 * @description NPC Pedagang Dinamis dengan Memori Transaksi, Reputasi, dan Dialog Interaktif via OpenRouter.
 * Terintegrasi ke aiEnsembleRouter dengan fallback prosedural instan saat offline atau circuit-breaker aktif.
 */

const { logger } = require("../managers/logger");
const aiEnsembleRouter = require("../ai/aiEnsembleRouter");

class DynamicMerchantTrader {
  /**
   * @param {string} [merchantId="default_merchant"] - ID unik pedagang
   * @param {object} [baseConfig={}] - Konfigurasi kepribadian dan harga pedagang
   */
  constructor(merchantId = "default_merchant", baseConfig = {}) {
    this.merchantId = merchantId;
    this.name = baseConfig.name || "Pedagang Desa";
    this.specialty = baseConfig.specialty || "general";
    this.greetingStyle = baseConfig.greetingStyle || "ramah";
    this.priceMultiplier = typeof baseConfig.priceMultiplier === "number" ? baseConfig.priceMultiplier : 1.0;
    this.transactionMemory = new Map();
  }

  /**
   * Menghasilkan respons dagang dinamis berdasarkan histori transaksi pemain dan integrasi OpenRouter
   * @param {string} userId - ID Pengguna Discord
   * @param {string} tradeAction - Aksi perdagangan ("buy", "sell", "bargain", "inquire")
   * @param {object} [itemData={}] - Data item yang diperdagangkan ({ name, basePrice })
   * @param {object} [playerProfile={}] - Profil ekonomi pemain ({ reputation, tier, premium_tier })
   * @returns {Promise<{ merchantId: string, merchantName: string, promptPrepared: string, simulatedDialogue: string, dialogue: string, adjustedPrice: number, dealAccepted: boolean, readyForAiActivation: boolean, isAiGenerated: boolean }>}
   */
  async generateTradeInteraction(userId, tradeAction, itemData = {}, playerProfile = {}) {
    try {
      if (playerProfile === null) {
        throw new Error("playerProfile is null");
      }
      logger.info(`[DynamicMerchant:${this.merchantId}] Interaksi dagang dengan user ${userId}`);

      const transactionHistory = this.transactionMemory.get(userId) || [];
      const totalTransactions = typeof transactionHistory.length === "number" ? transactionHistory.length : 0;
      const playerReputation = typeof playerProfile.reputation === "number" && !isNaN(playerProfile.reputation) && isFinite(playerProfile.reputation)
        ? playerProfile.reputation
        : (Number(playerProfile.reputation) || 0);
      const rawItemName = (itemData && itemData.name) || "barang";
      const itemName = String(rawItemName)
        .replace(/[\r\n`]/g, " ")
        .trim()
        .slice(0, 80) || "barang";
      const cleanAction = String(tradeAction || "inquire")
        .replace(/[\r\n`]/g, " ")
        .trim()
        .slice(0, 32);

      let promptTemplate = `Kamu adalah ${this.name}, pedagang spesialis ${this.specialty} di Naura Wilds.\n`;
      promptTemplate += `Gaya bicara: ${this.greetingStyle}. Multiplier harga dasar: ${this.priceMultiplier}x.\n`;
      promptTemplate += `Pemain memiliki reputasi: ${playerReputation}. Total transaksi sebelumnya: ${totalTransactions}.\n`;
      promptTemplate += `Aksi saat ini: "${cleanAction}" untuk item "${itemName}".\n`;
      promptTemplate += `Berikan respons singkat (maksimal 2 kalimat) dalam bahasa Indonesia tanpa tanda petik pembuka/penutup.`;

      const rawBasePrice = itemData && itemData.basePrice !== undefined ? itemData.basePrice : 100;
      const validBasePrice = typeof rawBasePrice === "number" && !isNaN(rawBasePrice) && isFinite(rawBasePrice) && rawBasePrice >= 0
        ? rawBasePrice
        : (Number(rawBasePrice) >= 0 ? Number(rawBasePrice) : 100);

      const adjustedPrice = this._calculateAdjustedPrice(
        validBasePrice,
        playerReputation,
        totalTransactions
      );

      const proceduralDialogue = this._generateSimulatedDialogue(tradeAction, itemName);
      let dialogueText = proceduralDialogue;
      let isAi = false;

      try {
        const userTier = playerProfile.tier || playerProfile.premium_tier || "free";
        const aiResponse = await aiEnsembleRouter.generate({
          taskType: aiEnsembleRouter.TASK_TYPES.GENERAL_CHAT,
          prompt: promptTemplate,
          systemInstruction: `Kamu adalah ${this.name}, NPC Pedagang di Naura Wilds. Bicara singkat, natural, ramah khas RPG dalam bahasa Indonesia. Jangan pernah gunakan karakter em dash.`,
          config: { temperature: 0.7, maxOutputTokens: 120 },
          userId: userId,
          userTier: userTier,
        });

        if (
          aiResponse &&
          typeof aiResponse.text === "string" &&
          aiResponse.text.trim().length > 0 &&
          aiResponse.provider !== "fallback" &&
          !aiResponse.isPremiumRestricted
        ) {
          dialogueText = aiResponse.text
            .replace(/[\u2014\u2013]/g, "-")
            .replace(/^["']|["']$/g, "")
            .trim();
          isAi = true;
        }
      } catch (aiErr) {
        logger.warn(
          `[DynamicMerchant:${this.merchantId}] OpenRouter gagal (${aiErr.message}), beralih ke dialog prosedural.`
        );
      }

      // Pastikan output bersih dari em dash
      dialogueText = dialogueText.replace(/[\u2014\u2013]/g, "-");

      return {
        merchantId: this.merchantId,
        merchantName: this.name,
        promptPrepared: promptTemplate,
        simulatedDialogue: dialogueText,
        dialogue: dialogueText,
        adjustedPrice,
        dealAccepted: true,
        readyForAiActivation: true,
        isAiGenerated: isAi,
      };
    } catch (error) {
      logger.error(`[DynamicMerchant] Galat pada interaksi ${this.merchantId}:`, error);
      const fallbackPrice = (itemData && typeof itemData.basePrice === "number" && !isNaN(itemData.basePrice))
        ? itemData.basePrice
        : (itemData && Number(itemData.basePrice) >= 0 ? Number(itemData.basePrice) : 100);
      return {
        merchantId: this.merchantId,
        merchantName: this.name,
        promptPrepared: "",
        simulatedDialogue: "Selamat datang di toko saya!",
        dialogue: "Selamat datang di toko saya!",
        adjustedPrice: fallbackPrice,
        dealAccepted: false,
        readyForAiActivation: false,
        isAiGenerated: false,
      };
    }
  }

  /**
   * Mencatat transaksi ke memori pedagang
   * @param {string} userId
   * @param {object} transactionRecord
   */
  recordTransaction(userId, transactionRecord = {}) {
    if (!this.transactionMemory.has(userId)) {
      this.transactionMemory.set(userId, []);
    }
    this.transactionMemory.get(userId).push({
      ...transactionRecord,
      timestamp: Date.now(),
    });
  }

  /**
   * Menghitung harga yang disesuaikan berdasarkan reputasi dan loyalitas pemain
   * @param {number} basePrice
   * @param {number} reputation
   * @param {number} transactionCount
   * @returns {number}
   */
  _calculateAdjustedPrice(basePrice, reputation, transactionCount) {
    const numBase = typeof basePrice === "number" && !isNaN(basePrice) && isFinite(basePrice) && basePrice >= 0
      ? basePrice
      : (Number(basePrice) >= 0 ? Number(basePrice) : 100);
    const numRep = typeof reputation === "number" && !isNaN(reputation) && isFinite(reputation)
      ? reputation
      : (Number(reputation) || 0);
    const numTx = typeof transactionCount === "number" && !isNaN(transactionCount) && isFinite(transactionCount)
      ? Math.max(transactionCount, 0)
      : (Math.max(Number(transactionCount), 0) || 0);

    const loyaltyDiscount = Math.min(numTx * 0.02, 0.15);
    const reputationBonus = Math.min(numRep * 0.001, 0.10);
    const finalMultiplier = this.priceMultiplier * (1 - loyaltyDiscount - reputationBonus);
    return Math.round(numBase * Math.max(finalMultiplier, 0.7));
  }

  /**
   * Generator dialog prosedural instan sebagai fallback tanpa biaya komputasi
   * @param {string} action
   * @param {string} itemName
   * @returns {string}
   */
  _generateSimulatedDialogue(action, itemName) {
    const dialogues = {
      buy: `Tentu, ${itemName || "barang ini"} tersedia! Harga spesial untukmu.`,
      sell: `Saya bisa beli ${itemName || "itu"} darimu dengan harga wajar.`,
      bargain: `Hmm, mari kita negosiasi. Saya beri diskon kecil karena kamu pelanggan setia.`,
      inquire: `${itemName || "Barang itu"}? Kualitas terbaik dari supplier terpercaya!`,
    };
    return dialogues[action] || "Ada yang bisa saya bantu hari ini?";
  }
}

const defaultMerchantTrader = new DynamicMerchantTrader("default_merchant");

module.exports = DynamicMerchantTrader;
module.exports.DynamicMerchantTrader = DynamicMerchantTrader;
module.exports.defaultMerchantTrader = defaultMerchantTrader;
