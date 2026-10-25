"use strict";

const { MessageFlags } = require("discord.js");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");
const ui = require("../../../src/config/ui");
const { logger } = require("../../../src/managers/logger");
const cacheManager = require("../../../src/managers/cacheManager");

class MarketTrendAnalyzer {
  constructor() {
    this.currencies = [
      "sukamajuCoins",
      "pratamaDollars",
      "scholarshipVouchers",
      "adishaDiamonds",
    ];
    this.alertThresholds = {
      inflation: 0.15,
      deflation: -0.1,
    };
  }

  async analyzeMarketTrends(guildId, economySnapshot = {}) {
    try {
      const totalSupply = economySnapshot.totalSupply || {};
      const recentTransactions = economySnapshot.recentTransactions || [];
      const activePlayers = economySnapshot.activePlayers || 0;

      const trends = this._calculateTrends(
        totalSupply,
        recentTransactions,
        activePlayers,
      );
      const alerts = this._generateAlerts(trends);
      const recommendations = this._generateRecommendations(trends, alerts);

      return {
        analysis: trends,
        alerts,
        recommendations,
      };
    } catch (error) {
      logger.error(`[MarketAnalyzer] Error for guild ${guildId}:`, error);
      return {
        analysis: {},
        alerts: [],
        recommendations: [],
      };
    }
  }

  _calculateTrends(totalSupply, transactions, activePlayers) {
    const trends = {};

    for (const currency of this.currencies) {
      const supply = totalSupply[currency] || 0;
      const txVolume = transactions.filter((t) => t.currency === currency).length;
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
        description:
          "Ekonomi server dalam kondisi sehat. Pertahankan parameter saat ini.",
        priority: "low",
      });
    }

    return recommendations;
  }
}

const analyzer = new MarketTrendAnalyzer();

module.exports = {
  name: "analyze",
  description: "Analisis tren ekonomi server dan rekomendasi balancing",

  async execute(interaction) {
    const userId = interaction.user.id;

    try {
      const userSurvival = await cacheManager.getUserSurvival(userId);
      const userProfile = await cacheManager.getUserProfile(userId);

      if (!userSurvival && !userProfile) {
        const errorPayload = buildErrorContainerV2(
          "Anda belum memiliki data ekonomi. Gunakan `/survival start` terlebih dahulu.",
        );
        return interaction.editReply({ ...errorPayload, embeds: [] });
      }

      const economySnapshot = {
        totalSupply: {
          sukamajuCoins: userSurvival?.sukamajuCoins || 0,
          pratamaDollars: userProfile?.pratamaDollars || 0,
          scholarshipVouchers: userSurvival?.scholarshipVouchers || 0,
          adishaDiamonds: userSurvival?.adishaDiamonds || 0,
        },
        recentTransactions: [],
        activePlayers: 1,
      };

      const result = await analyzer.analyzeMarketTrends(
        interaction.guildId,
        economySnapshot,
      );

      const currencyLines = Object.entries(result.analysis)
        .map(([currency, data]) => {
          const statusEmoji =
            data.healthStatus === "healthy"
              ? "✅"
              : data.healthStatus === "inflated"
                ? "📈"
                : data.healthStatus === "deflated"
                  ? "📉"
                  : "⚠️";
          return `${statusEmoji} **${currency}**: ${data.totalSupply.toLocaleString("id-ID")} (Supply/Player: ${data.supplyPerPlayer.toLocaleString("id-ID")}) - ${data.healthStatus.toUpperCase()}`;
        })
        .join("\n");

      const alertLines =
        result.alerts.length > 0
          ? result.alerts
              .map(
                (alert) =>
                  `[${alert.severity.toUpperCase()}] ${alert.message}`,
              )
              .join("\n")
          : "✅ Tidak ada alert ekonomi.";

      const recommendationLines = result.recommendations
        .map(
          (rec) =>
            `[${rec.priority.toUpperCase()}] ${rec.action}: ${rec.description}`,
        )
        .join("\n");

      const payload = buildContainerV2({
        accentColorHex: ui.getColor("info") || "#38BDF8",
        authorName: "Market Trend Analyzer",
        title: "📊 Analisis Ekonomi Server",
        description: [
          `**💰 Status Mata Uang:**`,
          currencyLines,
          "",
          `**🔔 Alert:**`,
          alertLines,
          "",
          `**💡 Rekomendasi Balancing:**`,
          recommendationLines,
        ].join("\n"),
        footerText: ui.getFooter("economy"),
      });

      return interaction.editReply({ ...payload, embeds: [] });
    } catch (error) {
      logger.error(`[EconomyAnalyze] Error for user ${userId}:`, error);
      const errorPayload = buildErrorContainerV2(
        "Gagal menganalisis ekonomi. Silakan coba lagi.",
      );
      return interaction.editReply({ ...errorPayload, embeds: [] });
    }
  },
};
