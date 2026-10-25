"use strict";

/**
 * @file marketTrendAnalyzer.js
 * @description Blueprint Analis Ekonomi AI untuk Prediksi Inflasi/Deflasi dan Balancing Mata Uang.
 * Modul ini diarsipkan di pending_plugin/ agar tidak memicu pemanggilan LLM pada free-tier.
 */

const { logger } = require("../../src/managers/logger");

class MarketTrendAnalyzer {
  constructor(analyzerId, baseConfig = {}) {
    this.analyzerId = analyzerId;
    this.name = baseConfig.name || "AI Economist";
    this.currencies = ["sukamajuCoins", "pratamaDollars", "scholarshipVouchers", "adishaDiamonds"];
    this.priceHistory = new Map();
    this.alertThresholds = baseConfig.alertThresholds || {
      inflation: 0.15,
      deflation: -0.10,
    };
  }

  /**
   * Menganalisis tren ekonomi server dan memberikan rekomendasi balancing
   * @param {string} guildId - ID Guild Discord
   * @param {object} economySnapshot - Snapshot ekonomi saat ini (total supply, transaksi terakhir)
   * @returns {Promise<{ analysis: object, alerts: Array, recommendations: Array }>}
   */
  async analyzeMarketTrends(guildId, economySnapshot = {}) {
    try {
      logger.info(`[MarketAnalyzer:${this.analyzerId}] Analyzing economy for guild ${guildId}`);

      const totalSupply = economySnapshot.totalSupply || {};
      const recentTransactions = economySnapshot.recentTransactions || [];
      const activePlayers = economySnapshot.activePlayers || 0;

      let promptTemplate = `Analisis kondisi ekonomi RPG server dengan data berikut:\n`;
      promptTemplate += `Total supply per mata uang: ${JSON.stringify(totalSupply)}.\n`;
      promptTemplate += `Transaksi terakhir (24 jam): ${recentTransactions.length}. Pemain aktif: ${activePlayers}.\n`;
      promptTemplate += `Identifikasi potensi inflasi/deflasi dan berikan rekomendasi balancing dalam format JSON.`;

      const trends = this._calculateTrends(totalSupply, recentTransactions, activePlayers);
      const alerts = this._generateAlerts(trends);
      const recommendations = this._generateRecommendations(trends, alerts);

      return {
        analyzerId: this.analyzerId,
        analyzerName: this.name,
        promptPrepared: promptTemplate,
        analysis: trends,
        alerts,
        recommendations,
        readyForAiActivation: true,
      };
    } catch (error) {
      logger.error(`[MarketAnalyzer] Galat pada analyzer ${this.analyzerId}:`, error);
      return {
        analyzerId: this.analyzerId,
        analyzerName: this.name,
        analysis: {},
        alerts: [],
        recommendations: [],
        readyForAiActivation: false,
      };
    }
  }

  /**
   * Mencatat snapshot harga untuk histori
   * @param {string} currency
   * @param {number} value
   */
  recordPricePoint(currency, value) {
    if (!this.priceHistory.has(currency)) {
      this.priceHistory.set(currency, []);
    }
    this.priceHistory.get(currency).push({
      value,
      timestamp: Date.now(),
    });
  }

  _calculateTrends(totalSupply, transactions, activePlayers) {
    const trends = {};

    for (const currency of this.currencies) {
      const supply = totalSupply[currency] || 0;
      const txVolume = transactions.filter(t => t.currency === currency).length;
      const supplyPerPlayer = activePlayers > 0 ? supply / activePlayers : supply;

      trends[currency] = {
        totalSupply: supply,
        transactionVolume: txVolume,
        supplyPerPlayer: Math.round(supplyPerPlayer),
        healthStatus: this._assessHealth(supplyPerPlayer, txVolume),
      };
    }

    return trends;
  }

  _assessHealth(supplyPerPlayer, txVolume) {
    if (supplyPerPlayer > 100000 && txVolume < 10) return "inflated";
    if (supplyPerPlayer < 100 && txVolume > 50) return "deflated";
    if (txVolume < 5) return "stagnant";
    return "healthy";
  }

  _generateAlerts(trends) {
    const alerts = [];

    for (const [currency, data] of Object.entries(trends)) {
      if (data.healthStatus === "inflated") {
        alerts.push({
          type: "inflation_warning",
          currency,
          message: `${currency} mengalami inflasi. Supply per pemain terlalu tinggi.`,
          severity: "high",
        });
      } else if (data.healthStatus === "deflated") {
        alerts.push({
          type: "deflation_warning",
          currency,
          message: `${currency} mengalami deflasi. Likuiditas terlalu ketat.`,
          severity: "medium",
        });
      }
    }

    return alerts;
  }

  _generateRecommendations(trends, alerts) {
    const recommendations = [];

    for (const alert of alerts) {
      if (alert.type === "inflation_warning") {
        recommendations.push({
          action: "increase_sink",
          currency: alert.currency,
          description: `Tambahkan money sink untuk ${alert.currency}: naikkan harga shop, tambah biaya crafting, atau event pajak.`,
          priority: "high",
        });
      } else if (alert.type === "deflation_warning") {
        recommendations.push({
          action: "increase_faucet",
          currency: alert.currency,
          description: `Tambahkan faucet untuk ${alert.currency}: naikkan reward quest, bonus harian, atau event giveaway.`,
          priority: "medium",
        });
      }
    }

    if (recommendations.length === 0) {
      recommendations.push({
        action: "maintain",
        description: "Ekonomi server dalam kondisi sehat. Pertahankan parameter saat ini.",
        priority: "low",
      });
    }

    return recommendations;
  }
}

module.exports = {
  MarketTrendAnalyzer,
};
