"use strict";

const express = require("express");
const { fn, col, literal } = require("sequelize");
const UserProfile = require("../../src/models/UserProfile");
const UserSurvival = require("../../src/models/UserSurvival");
const UserLeveling = require("../../src/models/UserLeveling");
const UserPet = require("../../src/models/UserPet");
const redisManager = require("../../src/managers/redisManager");
const { requireApiLogin } = require("../middleware/auth");

module.exports = (client) => {
  const router = express.Router();

  // GET /api/analytics/overview (Ringkasan Cepat)
  router.get("/overview", async (req, res) => {
    try {
      const cacheKey = "analytics:cache:overview";
      const cached = await redisManager.getCache(cacheKey);
      if (cached)
        return res.json(
          typeof cached === "string" ? JSON.parse(cached) : cached,
        );

      const totalUsers = await UserProfile.count();
      const totalGuilds = client.guilds ? client.guilds.cache.size : 0;
      const totalPets = await UserPet.count();

      // Hitung total ekonomi
      const ecoStats = await UserProfile.findAll({
        attributes: [
          [fn("SUM", col("economy_wallet")), "totalWallet"],
          [fn("SUM", col("economy_bank")), "totalBank"],
        ],
        raw: true,
      });

      const survivalStats = await UserSurvival.findAll({
        attributes: [
          [fn("SUM", col("coupons")), "totalCoupons"],
          [fn("SUM", col("starFragments")), "totalFragments"],
        ],
        raw: true,
      });

      const overview = {
        totalUsers,
        totalGuilds,
        totalPets,
        economy: {
          totalWallet: Number(ecoStats[0]?.totalWallet) || 0,
          totalBank: Number(ecoStats[0]?.totalBank) || 0,
          totalCoupons: Number(survivalStats[0]?.totalCoupons) || 0,
          totalFragments: Number(survivalStats[0]?.totalFragments) || 0,
        },
        timestamp: Date.now(),
      };

      await redisManager.setCache(cacheKey, JSON.stringify(overview), 300); // 5 min TTL
      res.json(overview);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/analytics/economy-distribution (Distribusi Kekayaan & Inflasi)
  router.get("/economy-distribution", async (req, res) => {
    try {
      const topProfiles = await UserProfile.findAll({
        attributes: ["userId", "economy_wallet", "economy_bank"],
        order: [[literal("economy_wallet + economy_bank"), "DESC"]],
        limit: 10,
        raw: true,
      });

      const topHolders = topProfiles.map((p) => ({
        userId: p.userId,
        totalWealth: (p.economy_wallet || 0) + (p.economy_bank || 0),
      }));

      res.json({
        topHolders,
        tiers: {
          tier1_whale: 5,
          tier2_middle: 45,
          tier3_starter: 50,
        },
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/analytics/command-usage (Statistik Perintah)
  router.get("/command-usage", async (req, res) => {
    try {
      const redisKey = "analytics:commands:daily";
      let usageData = {};
      if (redisManager.client && redisManager.client.isReady) {
        usageData = (await redisManager.client.hGetAll(redisKey)) || {};
      }
      res.json({ usage: usageData, timestamp: Date.now() });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
};
