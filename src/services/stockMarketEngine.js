"use strict";

const ServerStock = require("../models/ServerStock");
const UserStockHolding = require("../models/UserStockHolding");
const GuildClan = require("../models/GuildClan");
const cacheManager = require("../managers/cacheManager");
const { logger } = require("../managers/logger");

const DEFAULT_STOCKS = [
  {
    ticker: "HOSHINO_AI",
    name: "Hoshino Core AI Corp",
    currentPrice: 150.0,
    dividendYield: 0.06,
    isHighRisk: false,
  },
  {
    ticker: "NEO_ENERGY",
    name: "Neo-Hoshino Fusion Power",
    currentPrice: 85.0,
    dividendYield: 0.04,
    isHighRisk: false,
  },
  {
    ticker: "CYBER_DOCKS",
    name: "Harbor Logistics Global",
    currentPrice: 115.0,
    dividendYield: 0.05,
    isHighRisk: false,
  },
  {
    ticker: "ASTRA_FOODS",
    name: "Astral Culinary Ventures",
    currentPrice: 65.0,
    dividendYield: 0.03,
    isHighRisk: false,
  },
  {
    ticker: "NAURA_COIN",
    name: "$NRA Volatile Index (High Risk)",
    currentPrice: 200.0,
    dividendYield: 0.12,
    isHighRisk: true,
  },
];

class StockMarketEngine {
  /**
   * Ambil ringkasan seluruh saham di bursa efek
   */
  static async getMarketOverview() {
    let list = await ServerStock.findAll();
    if (list.length === 0) {
      for (const def of DEFAULT_STOCKS) {
        await ServerStock.findOrCreate({
          where: { ticker: def.ticker },
          defaults: {
            ticker: def.ticker,
            name: def.name,
            currentPrice: def.currentPrice,
            previousPrice: def.currentPrice,
            totalShares: 10000,
            availableShares: 10000,
            dividendYield: def.dividendYield,
            isHighRisk: def.isHighRisk,
            history24h: [
              { timestamp: Date.now() - 3600000 * 2, price: def.currentPrice * 0.95 },
              { timestamp: Date.now() - 3600000, price: def.currentPrice * 0.98 },
              { timestamp: Date.now(), price: def.currentPrice },
            ],
          },
        });
      }
      list = await ServerStock.findAll();
    }
    return list.map((s) => s.toJSON());
  }

  /**
   * Beli atau Jual saham di bursa efek
   */
  static async tradeStock(userId, ticker, action = "BUY", quantity = 10) {
    const qty = Math.max(1, Math.floor(Number(quantity) || 1));
    const stock = await ServerStock.findOne({ where: { ticker } });
    if (!stock) return { success: false, reason: "STOCK_NOT_FOUND" };

    const unitPrice = stock.currentPrice;
    const totalCost = Math.floor(unitPrice * qty);

    if (action.toUpperCase() === "BUY") {
      const debit = await cacheManager.debitUserSurvival(userId, "starFragments", totalCost);
      if (!debit.ok) {
        return { success: false, reason: "INSUFFICIENT_FUNDS", cost: totalCost };
      }

      let holding = await UserStockHolding.findOne({ where: { userId, ticker } });
      if (!holding) {
        holding = await UserStockHolding.create({
          userId,
          ticker,
          sharesOwned: qty,
          avgBuyPrice: unitPrice,
        });
      } else {
        const totalOldCost = holding.sharesOwned * holding.avgBuyPrice;
        const newTotalShares = holding.sharesOwned + qty;
        holding.avgBuyPrice = Number(((totalOldCost + totalCost) / newTotalShares).toFixed(2));
        holding.sharesOwned = newTotalShares;
        await holding.save();
      }

      // Sedikit dorong harga naik (+0.1% per 10 lembar)
      const priceImpact = 1 + Math.min(0.05, (qty / 100) * 0.01);
      stock.previousPrice = stock.currentPrice;
      stock.currentPrice = Number((stock.currentPrice * priceImpact).toFixed(2));
      await stock.save();

      logger.info(`[StockMarket] User ${userId} membeli ${qty} lembar ${ticker} seharga ${totalCost} ⭐.`);
      return {
        success: true,
        action: "BUY",
        ticker,
        quantity: qty,
        unitPrice,
        totalCost,
        currentShares: holding.sharesOwned,
        newStockPrice: stock.currentPrice,
      };
    } else {
      // SELL
      const holding = await UserStockHolding.findOne({ where: { userId, ticker } });
      if (!holding || holding.sharesOwned < qty) {
        return {
          success: false,
          reason: "INSUFFICIENT_SHARES",
          owned: holding ? holding.sharesOwned : 0,
          requested: qty,
        };
      }

      holding.sharesOwned -= qty;
      if (holding.sharesOwned <= 0) {
        await holding.destroy();
      } else {
        await holding.save();
      }

      await cacheManager.incrementUserSurvival(userId, "starFragments", totalCost);

      // Sedikit dorong harga turun (-0.1% per 10 lembar)
      const priceImpact = 1 - Math.min(0.05, (qty / 100) * 0.01);
      stock.previousPrice = stock.currentPrice;
      stock.currentPrice = Math.max(10.0, Number((stock.currentPrice * priceImpact).toFixed(2)));
      await stock.save();

      logger.info(`[StockMarket] User ${userId} menjual ${qty} lembar ${ticker} dan menerima ${totalCost} ⭐.`);
      return {
        success: true,
        action: "SELL",
        ticker,
        quantity: qty,
        unitPrice,
        totalGained: totalCost,
        remainingShares: holding ? Math.max(0, holding.sharesOwned) : 0,
        newStockPrice: stock.currentPrice,
      };
    }
  }

  /**
   * Ambil portofolio investasi saham pengguna
   */
  static async getUserPortfolio(userId) {
    const holdings = await UserStockHolding.findAll({ where: { userId } });
    const stocks = await ServerStock.findAll();
    const stockMap = new Map(stocks.map((s) => [s.ticker, s]));

    let totalPortfolioValue = 0;
    const items = [];

    for (const h of holdings) {
      const stock = stockMap.get(h.ticker);
      const currentPrice = stock ? stock.currentPrice : h.avgBuyPrice;
      const currentValue = Math.floor(currentPrice * h.sharesOwned);
      const totalBuyCost = Math.floor(h.avgBuyPrice * h.sharesOwned);
      const profitLoss = currentValue - totalBuyCost;
      const profitPercent = totalBuyCost > 0 ? Number(((profitLoss / totalBuyCost) * 100).toFixed(1)) : 0;

      totalPortfolioValue += currentValue;
      items.push({
        ticker: h.ticker,
        name: stock ? stock.name : h.ticker,
        shares: h.sharesOwned,
        avgBuyPrice: h.avgBuyPrice,
        currentPrice,
        currentValue,
        profitLoss,
        profitPercent,
      });
    }

    return {
      userId,
      totalPortfolioValue,
      holdings: items,
    };
  }

  /**
   * Pendaftaran Startup Baru oleh Klan (IPO)
   */
  static async launchStartupIPO(clanId, ticker, name, isHighRisk = false) {
    const cleanTicker = ticker.toUpperCase().replace(/[^A-Z0-9_]/g, "").substring(0, 10);
    const existing = await ServerStock.findOne({ where: { ticker: cleanTicker } });
    if (existing) {
      return { success: false, reason: "TICKER_ALREADY_EXISTS" };
    }

    const clan = await GuildClan.findByPk(clanId);
    if (!clan) return { success: false, reason: "CLAN_NOT_FOUND" };

    const ipoCost = 25000;
    if (Number(clan.vault || 0) < ipoCost) {
      return { success: false, reason: "INSUFFICIENT_VAULT", cost: ipoCost, current: clan.vault };
    }

    clan.vault = Number(clan.vault || 0) - ipoCost;
    await clan.save();

    const newStock = await ServerStock.create({
      ticker: cleanTicker,
      name,
      clanId: clan.id,
      guildId: clan.guildId,
      currentPrice: 100.0,
      previousPrice: 100.0,
      totalShares: 10000,
      availableShares: 10000,
      dividendYield: isHighRisk ? 0.10 : 0.05,
      isHighRisk,
      history24h: [{ timestamp: Date.now(), price: 100.0 }],
    });

    logger.info(`[StockMarket] Klan ${clan.name} resmi meluncurkan IPO Startup ${cleanTicker} (${name})!`);
    return {
      success: true,
      stock: newStock.toJSON(),
      clanName: clan.name,
    };
  }

  /**
   * Update fluktuasi harga pasar saham berkala
   */
  static async updateMarketTick() {
    const stocks = await ServerStock.findAll();
    for (const stock of stocks) {
      const volatility = stock.isHighRisk ? 0.15 : 0.04;
      const changePercent = (Math.random() * 2 - 0.98) * volatility;
      const newPrice = Math.max(10.0, Number((stock.currentPrice * (1 + changePercent)).toFixed(2)));

      stock.previousPrice = stock.currentPrice;
      stock.currentPrice = newPrice;

      let history = stock.history24h || [];
      if (typeof history === "string") history = JSON.parse(history);
      history.push({ timestamp: Date.now(), price: newPrice });
      if (history.length > 24) history = history.slice(-24);

      stock.history24h = history;
      await stock.save();
    }
  }
}

module.exports = StockMarketEngine;
module.exports.DEFAULT_STOCKS = DEFAULT_STOCKS;
