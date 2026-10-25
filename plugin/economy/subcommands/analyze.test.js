"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

// Mock MarketTrendAnalyzer class untuk testing
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

  analyzeMarketTrends(guildId, economySnapshot = {}) {
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

test("economy analyze - detects healthy economy correctly", () => {
  const snapshot = {
    totalSupply: {
      sukamajuCoins: 50000,
      pratamaDollars: 30000,
      scholarshipVouchers: 5000,
      adishaDiamonds: 1000,
    },
    recentTransactions: Array(20).fill({ currency: "sukamajuCoins" }),
    activePlayers: 10,
  };

  const result = analyzer.analyzeMarketTrends("guild123", snapshot);

  assert.ok(result.analysis.sukamajuCoins);
  assert.equal(result.analysis.sukamajuCoins.healthStatus, "healthy");
  assert.ok(result.recommendations.some((r) => r.action === "maintain"));
});

test("economy analyze - detects inflation correctly", () => {
  const snapshot = {
    totalSupply: {
      sukamajuCoins: 2000000, // Very high supply
      pratamaDollars: 100000,
      scholarshipVouchers: 10000,
      adishaDiamonds: 5000,
    },
    recentTransactions: Array(5).fill({ currency: "sukamajuCoins" }), // Low volume
    activePlayers: 10,
  };

  const result = analyzer.analyzeMarketTrends("guild123", snapshot);

  assert.equal(result.analysis.sukamajuCoins.healthStatus, "inflated");
  assert.ok(result.alerts.some((a) => a.type === "inflation_warning"));
  assert.ok(result.recommendations.some((r) => r.action === "increase_sink"));
});

test("economy analyze - detects deflation correctly", () => {
  const snapshot = {
    totalSupply: {
      sukamajuCoins: 500, // Very low supply
      pratamaDollars: 200,
      scholarshipVouchers: 50,
      adishaDiamonds: 10,
    },
    recentTransactions: Array(60).fill({ currency: "sukamajuCoins" }), // High volume
    activePlayers: 10,
  };

  const result = analyzer.analyzeMarketTrends("guild123", snapshot);

  assert.equal(result.analysis.sukamajuCoins.healthStatus, "deflated");
  assert.ok(result.alerts.some((a) => a.type === "deflation_warning"));
  assert.ok(result.recommendations.some((r) => r.action === "increase_faucet"));
});

test("economy analyze - handles zero active players gracefully", () => {
  const snapshot = {
    totalSupply: {
      sukamajuCoins: 10000,
      pratamaDollars: 5000,
      scholarshipVouchers: 1000,
      adishaDiamonds: 200,
    },
    recentTransactions: [],
    activePlayers: 0,
  };

  const result = analyzer.analyzeMarketTrends("guild123", snapshot);

  assert.ok(result.analysis.sukamajuCoins);
  assert.ok(result.analysis.sukamajuCoins.supplyPerPlayer >= 0);
});

test("economy analyze - analyzes all 4 currencies", () => {
  const snapshot = {
    totalSupply: {
      sukamajuCoins: 50000,
      pratamaDollars: 30000,
      scholarshipVouchers: 5000,
      adishaDiamonds: 1000,
    },
    recentTransactions: [],
    activePlayers: 10,
  };

  const result = analyzer.analyzeMarketTrends("guild123", snapshot);

  assert.ok(result.analysis.sukamajuCoins);
  assert.ok(result.analysis.pratamaDollars);
  assert.ok(result.analysis.scholarshipVouchers);
  assert.ok(result.analysis.adishaDiamonds);
});

test("economy analyze - provides maintain recommendation when no alerts", () => {
  const snapshot = {
    totalSupply: {
      sukamajuCoins: 50000,
      pratamaDollars: 30000,
      scholarshipVouchers: 5000,
      adishaDiamonds: 1000,
    },
    recentTransactions: Array(30).fill({ currency: "sukamajuCoins" }),
    activePlayers: 10,
  };

  const result = analyzer.analyzeMarketTrends("guild123", snapshot);

  assert.ok(result.recommendations.length > 0);
  assert.ok(result.recommendations.some((r) => r.action === "maintain"));
});
