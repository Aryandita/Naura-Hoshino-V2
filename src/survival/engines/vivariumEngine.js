"use strict";

const { getFishesByZone, getFishById } = require("../data/deepSeaFishes");
const cacheManager = require("../../managers/cacheManager");
const { logger } = require("../../managers/logger");

const VIVARIUM_KEY_PREFIX = "survival:vivarium:";

class VivariumEngine {
  /**
   * Lempar kail ke kedalaman laut dalam (Deep-Sea Fishing)
   */
  static async castDeepSea(userId, zone = "CORAL_REEF") {
    const energyCost = zone === "ABYSSAL_CORE" ? 25 : zone === "MIDNIGHT_TRENCH" ? 20 : 15;
    const debit = await cacheManager.debitUserSurvival(userId, "stamina", energyCost);
    if (!debit.ok) {
      return { success: false, reason: "INSUFFICIENT_ENERGY", cost: energyCost };
    }

    const availableFishes = getFishesByZone(zone);
    if (availableFishes.length === 0) return { success: false, reason: "ZONE_EMPTY" };

    // Bobot kelangkaan
    const roll = Math.random();
    let selectedFish = availableFishes[0];

    if (roll < 0.05) {
      const mythics = availableFishes.filter((f) => f.rarity === "MYTHIC");
      if (mythics.length > 0) selectedFish = mythics[Math.floor(Math.random() * mythics.length)];
    } else if (roll < 0.2) {
      const epics = availableFishes.filter((f) => f.rarity === "EPIC");
      if (epics.length > 0) selectedFish = epics[Math.floor(Math.random() * epics.length)];
    } else if (roll < 0.5) {
      const rares = availableFishes.filter((f) => f.rarity === "RARE");
      if (rares.length > 0) selectedFish = rares[Math.floor(Math.random() * rares.length)];
    } else {
      const commons = availableFishes.filter((f) => f.rarity === "COMMON");
      if (commons.length > 0) selectedFish = commons[Math.floor(Math.random() * commons.length)];
    }

    logger.info(`[Vivarium] User ${userId} memancing di zona ${zone} dan mendapatkan ${selectedFish.name} (${selectedFish.rarity})!`);
    return {
      success: true,
      fish: selectedFish,
      zone,
      energySpent: energyCost,
    };
  }

  /**
   * Ambil data akuarium vivarium milik pemain
   */
  static async getVivarium(userId) {
    const redisManager = require("../../managers/redisManager");
    let vivariumData = {
      fishes: ["neon_guppy", "prism_clownfish"],
      lastCollectedAt: Date.now() - 3600000,
    };

    if (redisManager.isReady) {
      const cached = await redisManager.getCache(`${VIVARIUM_KEY_PREFIX}${userId}`);
      if (cached) {
        vivariumData = typeof cached === "string" ? JSON.parse(cached) : cached;
      }
    }

    const detailedFishes = (vivariumData.fishes || []).map((id) => getFishById(id)).filter(Boolean);
    const hourlyIncome = detailedFishes.reduce((sum, f) => sum + (f.ticketYield || 5), 0);

    return {
      userId,
      fishes: detailedFishes,
      totalFishes: detailedFishes.length,
      hourlyIncome,
      lastCollectedAt: vivariumData.lastCollectedAt,
    };
  }

  /**
   * Tempatkan ikan ke dalam Vivarium Aquarium
   */
  static async depositFish(userId, fishId) {
    const redisManager = require("../../managers/redisManager");
    const fish = getFishById(fishId);
    if (!fish) return { success: false, reason: "INVALID_FISH" };

    const current = await this.getVivarium(userId);
    const fishIds = current.fishes.map((f) => f.id);

    if (fishIds.length >= 10) {
      return { success: false, reason: "VIVARIUM_FULL", max: 10 };
    }

    fishIds.push(fish.id);
    const updatedData = {
      fishes: fishIds,
      lastCollectedAt: current.lastCollectedAt || Date.now(),
    };

    if (redisManager.isReady) {
      await redisManager.setCache(`${VIVARIUM_KEY_PREFIX}${userId}`, JSON.stringify(updatedData), 86400 * 30);
    }

    logger.info(`[Vivarium] User ${userId} menempatkan ${fish.name} ke akuarium.`);
    return {
      success: true,
      fish,
      totalInTank: fishIds.length,
      newHourlyIncome: (current.hourlyIncome || 0) + (fish.ticketYield || 5),
    };
  }

  /**
   * Klaim akumulasi tiket pengunjung akuarium
   */
  static async claimTicketRevenue(userId) {
    const redisManager = require("../../managers/redisManager");
    const vivarium = await this.getVivarium(userId);

    const now = Date.now();
    const hoursPassed = Math.min(24, Math.max(0.1, (now - (vivarium.lastCollectedAt || now - 3600000)) / (1000 * 60 * 60)));
    const revenue = Math.floor(hoursPassed * (vivarium.hourlyIncome || 10));

    if (revenue <= 0) {
      return { success: false, reason: "NO_ACCUMULATED_REVENUE" };
    }

    await cacheManager.incrementUserSurvival(userId, "starFragments", revenue);

    if (redisManager.isReady) {
      await redisManager.setCache(
        `${VIVARIUM_KEY_PREFIX}${userId}`,
        JSON.stringify({
          fishes: vivarium.fishes.map((f) => f.id),
          lastCollectedAt: now,
        }),
        86400 * 30,
      );
    }

    logger.info(`[Vivarium] User ${userId} mengklaim ${revenue} ⭐ dari tiket Vivarium.`);
    return {
      success: true,
      revenue,
      hoursPassed: Math.floor(hoursPassed),
    };
  }
}

module.exports = VivariumEngine;
