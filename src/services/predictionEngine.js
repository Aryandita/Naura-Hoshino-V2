"use strict";

const { sequelize } = require("../config/database");
const PredictionMarket = require("../models/PredictionMarket");
const PredictionBet = require("../models/PredictionBet");
const WorldBoss = require("../models/WorldBoss");
const redisManager = require("../managers/redisManager");
const cacheManager = require("../managers/cacheManager");
const { logger } = require("../managers/logger");

const MARKET_CACHE_PREFIX = "prediction:market:";
const GUILD_MARKETS_CACHE_PREFIX = "prediction:guild:";

class PredictionEngine {
  /**
   * Buat pasar prediksi baru
   */
  static async createMarket({
    guildId,
    creatorId,
    title,
    description = "",
    category = "COMMUNITY",
    optionsList = ["Ya", "Tidak"],
    durationMinutes = 60,
    houseFeePercent = 5,
    maxBetPerUser = 10000,
  }) {
    const marketId = `pred_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const lockTime = new Date(Date.now() + durationMinutes * 60 * 1000);

    const formattedOptions = optionsList.map((label, index) => ({
      id: index + 1,
      label: label.trim(),
      totalBet: 0,
      bettorCount: 0,
    }));

    const market = await PredictionMarket.create({
      marketId,
      guildId,
      creatorId,
      title,
      description,
      category,
      options: formattedOptions,
      totalPool: 0,
      status: "OPEN",
      lockTime,
      houseFeePercent,
      maxBetPerUser,
    });

    await this._invalidateCache(guildId, marketId);
    logger.info(
      `[PredictionEngine] Market dibuat: ${marketId} (${title}) di guild ${guildId}`,
    );
    return market.toJSON();
  }

  /**
   * Ambil data market berdasarkan ID
   */
  static async getMarket(marketId) {
    if (redisManager.isReady) {
      const cached = await redisManager.getCache(
        `${MARKET_CACHE_PREFIX}${marketId}`,
      );
      if (cached)
        return typeof cached === "string" ? JSON.parse(cached) : cached;
    }

    const market = await PredictionMarket.findByPk(marketId);
    if (market && redisManager.isReady) {
      await redisManager.setCache(
        `${MARKET_CACHE_PREFIX}${marketId}`,
        JSON.stringify(market.toJSON()),
        30,
      );
    }
    return market ? market.toJSON() : null;
  }

  /**
   * Ambil daftar market aktif di sebuah guild
   */
  static async getActiveMarkets(guildId) {
    const markets = await PredictionMarket.findAll({
      where: {
        guildId,
        status: ["OPEN", "LOCKED"],
      },
      order: [["createdAt", "DESC"]],
      limit: 10,
    });
    return markets.map((m) => m.toJSON());
  }

  /**
   * Pasang taruhan pada pasar prediksi (Pari-Mutuel Bet)
   */
  static async placeBet({
    marketId,
    guildId,
    userId,
    username = "Anonymous",
    optionId,
    amount,
  }) {
    const betAmount = Math.floor(Number(amount));
    if (isNaN(betAmount) || betAmount <= 0) {
      return { success: false, reason: "INVALID_AMOUNT" };
    }

    const debitResult = await cacheManager.debitUserSurvival(
      userId,
      "starFragments",
      betAmount,
    );
    if (!debitResult.ok) {
      const currentSurvival = await cacheManager.getUserSurvival(userId);
      return {
        success: false,
        reason: "INSUFFICIENT_FUNDS",
        balance: currentSurvival
          ? Number(currentSurvival.starFragments || 0)
          : 0,
      };
    }

    // Jalankan mutasi pool dalam SQL Transaction dengan penguncian baris
    return await sequelize.transaction(async (t) => {
      const market = await PredictionMarket.findOne({
        where: { marketId, guildId },
        lock: t.LOCK.UPDATE,
        transaction: t,
      });

      if (!market) {
        // Refund bila market tidak ada
        await cacheManager.incrementUserSurvival(
          userId,
          "starFragments",
          betAmount,
        );
        return { success: false, reason: "MARKET_NOT_FOUND" };
      }

      if (market.status !== "OPEN" || new Date() > new Date(market.lockTime)) {
        // Refund bila market sudah terkunci
        await cacheManager.incrementUserSurvival(
          userId,
          "starFragments",
          betAmount,
        );
        return { success: false, reason: "MARKET_LOCKED_OR_CLOSED" };
      }

      const options = Array.isArray(market.options) ? [...market.options] : [];
      const optionIndex = options.findIndex(
        (o) => Number(o.id) === Number(optionId),
      );
      if (optionIndex === -1) {
        await cacheManager.incrementUserSurvival(
          userId,
          "starFragments",
          betAmount,
        );
        return { success: false, reason: "INVALID_OPTION" };
      }

      if (betAmount > (market.maxBetPerUser || 10000)) {
        await cacheManager.incrementUserSurvival(
          userId,
          "starFragments",
          betAmount,
        );
        return {
          success: false,
          reason: "EXCEEDS_MAX_BET",
          maxBet: market.maxBetPerUser || 10000,
        };
      }

      // Mutasi options dan pool
      options[optionIndex].totalBet =
        Number(options[optionIndex].totalBet || 0) + betAmount;
      options[optionIndex].bettorCount =
        Number(options[optionIndex].bettorCount || 0) + 1;

      const newTotalPool = Number(market.totalPool || 0) + betAmount;

      market.options = options;
      market.totalPool = newTotalPool;
      market.changed("options", true);
      await market.save({ transaction: t });

      // Catat tiket taruhan
      const betId = `bet_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      await PredictionBet.create(
        {
          betId,
          marketId,
          guildId,
          userId,
          username,
          optionId: Number(optionId),
          amount: betAmount,
          status: "PENDING",
        },
        { transaction: t },
      );

      // Invalidate cache setelah commit
      t.afterCommit(async () => {
        await PredictionEngine._invalidateCache(guildId, marketId);
      });

      return {
        success: true,
        betId,
        marketId,
        chosenOption: options[optionIndex].label,
        amount: betAmount,
        totalPool: newTotalPool,
        optionPool: options[optionIndex].totalBet,
      };
    });
  }

  /**
   * Kunci pasar taruhan (tidak bisa bertaruh lagi, menunggu hasil)
   */
  static async lockMarket(marketId, guildId) {
    const market = await PredictionMarket.findOne({
      where: { marketId, guildId },
    });
    if (!market) return { success: false, reason: "MARKET_NOT_FOUND" };
    if (market.status !== "OPEN") return { success: false, reason: "NOT_OPEN" };

    market.status = "LOCKED";
    await market.save({ fields: ["status"] });
    await this._invalidateCache(guildId, marketId);
    return { success: true, market: market.toJSON() };
  }

  /**
   * Selesaikan pasar prediksi dan distribusikan hadiah Pari-Mutuel
   */
  static async resolveMarket(marketId, guildId, winningOptionId) {
    return await sequelize.transaction(async (t) => {
      const market = await PredictionMarket.findOne({
        where: { marketId, guildId },
        lock: t.LOCK.UPDATE,
        transaction: t,
      });

      if (!market) return { success: false, reason: "MARKET_NOT_FOUND" };
      if (market.status === "RESOLVED" || market.status === "CANCELLED") {
        return { success: false, reason: "ALREADY_FINISHED" };
      }

      const options = market.options || [];
      const winningOption = options.find(
        (o) => Number(o.id) === Number(winningOptionId),
      );
      if (!winningOption)
        return { success: false, reason: "INVALID_WINNING_OPTION" };

      const totalPool = Number(market.totalPool || 0);
      const winningOptionTotalBet = Number(winningOption.totalBet || 0);

      // Ambil seluruh tiket taruhan
      const bets = await PredictionBet.findAll({
        where: { marketId },
        lock: t.LOCK.UPDATE,
        transaction: t,
      });

      let totalPayoutDistributed = 0;
      let houseFeeCollected = 0;

      if (winningOptionTotalBet > 0 && totalPool > 0) {
        const feePercent = market.houseFeePercent || 5;
        houseFeeCollected = Math.floor(totalPool * (feePercent / 100));
        const distributablePool = totalPool - houseFeeCollected;

        for (const bet of bets) {
          if (Number(bet.optionId) === Number(winningOptionId)) {
            // Formula Pari-Mutuel
            const share = Number(bet.amount) / winningOptionTotalBet;
            const payout = Math.floor(distributablePool * share);

            bet.status = "WON";
            bet.payout = payout;
            await bet.save({
              fields: ["status", "payout"],
              transaction: t,
            });

            // Berikan saldo ke pemenang lewat cacheManager
            await cacheManager.incrementUserSurvival(
              bet.userId,
              "starFragments",
              payout,
            );

            totalPayoutDistributed += payout;
          } else {
            bet.status = "LOST";
            bet.payout = 0;
            await bet.save({
              fields: ["status", "payout"],
              transaction: t,
            });
          }
        }

        // Salurkan fee ke World Boss rewards pool jika ada bos aktif
        if (houseFeeCollected > 0) {
          const activeBoss = await WorldBoss.findOne({
            where: { status: "ACTIVE" },
            transaction: t,
          });
          if (activeBoss) {
            const currentPool = activeBoss.rewardsPool || {
              starFragments: 5000,
              coupons: 30,
            };
            currentPool.starFragments =
              (Number(currentPool.starFragments) || 5000) + houseFeeCollected;
            activeBoss.rewardsPool = currentPool;
            activeBoss.changed("rewardsPool", true);
            await activeBoss.save({
              fields: ["rewardsPool"],
              transaction: t,
            });
          }
        }
      } else {
        // Jika tidak ada pemenang (misal opsi pemenang bernilai 0 bet), refund semua tiket
        for (const bet of bets) {
          bet.status = "REFUNDED";
          bet.payout = Number(bet.amount);
          await bet.save({
            fields: ["status", "payout"],
            transaction: t,
          });

          await cacheManager.incrementUserSurvival(
            bet.userId,
            "starFragments",
            Number(bet.amount),
          );
        }
      }

      market.status = "RESOLVED";
      market.winningOptionId = Number(winningOptionId);
      market.resolveTime = new Date();
      await market.save({
        fields: ["status", "winningOptionId", "resolveTime"],
        transaction: t,
      });

      t.afterCommit(async () => {
        await PredictionEngine._invalidateCache(guildId, marketId);
      });

      return {
        success: true,
        marketId,
        winningOption: winningOption.label,
        totalPool,
        payoutDistributed: totalPayoutDistributed,
        houseFee: houseFeeCollected,
      };
    });
  }

  /**
   * Batalkan pasar dan refund seluruh taruhan
   */
  static async cancelMarket(marketId, guildId) {
    return await sequelize.transaction(async (t) => {
      const market = await PredictionMarket.findOne({
        where: { marketId, guildId },
        lock: t.LOCK.UPDATE,
        transaction: t,
      });

      if (!market) return { success: false, reason: "MARKET_NOT_FOUND" };
      if (market.status === "RESOLVED" || market.status === "CANCELLED") {
        return { success: false, reason: "ALREADY_FINISHED" };
      }

      const bets = await PredictionBet.findAll({
        where: { marketId },
        lock: t.LOCK.UPDATE,
        transaction: t,
      });

      for (const bet of bets) {
        bet.status = "REFUNDED";
        bet.payout = Number(bet.amount);
        await bet.save({
          fields: ["status", "payout"],
          transaction: t,
        });

        await cacheManager.incrementUserSurvival(
          bet.userId,
          "starFragments",
          Number(bet.amount),
        );
      }

      market.status = "CANCELLED";
      market.resolveTime = new Date();
      await market.save({
        fields: ["status", "resolveTime"],
        transaction: t,
      });

      t.afterCommit(async () => {
        await PredictionEngine._invalidateCache(guildId, marketId);
      });

      return { success: true, marketId, refundedBetsCount: bets.length };
    });
  }

  /**
   * Invalidate cache Redis
   */
  static async _invalidateCache(guildId, marketId) {
    if (redisManager.isReady) {
      await redisManager.deleteCache(`${MARKET_CACHE_PREFIX}${marketId}`);
      await redisManager.deleteCache(`${GUILD_MARKETS_CACHE_PREFIX}${guildId}`);
    }
  }
}

module.exports = PredictionEngine;
