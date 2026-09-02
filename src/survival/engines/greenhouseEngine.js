"use strict";

const UserGreenhouse = require("../../models/UserGreenhouse");
const { getSeedById, CROP_SEEDS } = require("../data/cropSeeds");
const cacheManager = require("../../managers/cacheManager");
const { logger } = require("../../managers/logger");

const MAX_GRID_LEVEL = 4; // level 1: 3 slots, level 2: 4 slots, level 3: 5 slots, level 4: 6 slots
const BASE_SLOTS_PER_LEVEL = {
  1: 3,
  2: 4,
  3: 5,
  4: 6,
};
const UPGRADE_COSTS = {
  2: 2500, // 2,500 coins
  3: 7500, // 7,500 coins
  4: 20000, // 20,000 coins
};

class GreenhouseEngine {
  /**
   * Menghitung status slot lahan hidroponik
   */
  computeSlotState(slot) {
    if (!slot || !slot.seedId) {
      return {
        ...slot,
        isEmpty: true,
        status: "EMPTY",
        progressPercent: 0,
      };
    }

    const seed = getSeedById(slot.seedId);
    if (!seed) {
      return {
        ...slot,
        isEmpty: true,
        status: "UNKNOWN_SEED",
        progressPercent: 0,
      };
    }

    const now = Date.now();
    const plantedTime = new Date(slot.plantedAt).getTime();
    const totalDurationMs =
      seed.growTimeMinutes * 60 * 1000 * (slot.isFertilized ? 0.75 : 1);
    const elapsedMs = Math.max(0, now - plantedTime);

    const progressPercent = Math.min(
      100,
      Math.floor((elapsedMs / totalDurationMs) * 100),
    );
    const isMature = elapsedMs >= totalDurationMs;

    let stage = "SEED";
    if (progressPercent >= 100) {
      stage = "MATURE";
    } else if (progressPercent >= 50) {
      stage = "GROWING";
    } else if (progressPercent >= 20) {
      stage = "SPROUT";
    }

    const remainingMinutes = Math.max(
      0,
      Math.ceil((totalDurationMs - elapsedMs) / 60000),
    );

    return {
      ...slot,
      seed,
      isEmpty: false,
      isMature,
      stage,
      progressPercent,
      remainingMinutes,
      readyAt: new Date(plantedTime + totalDurationMs).toISOString(),
    };
  }

  /**
   * Ambil data Greenhouse milik pengguna
   */
  async getGreenhouse(userId) {
    let [greenhouse] = await UserGreenhouse.findOrCreate({
      where: { userId },
      defaults: {
        userId,
        gridLevel: 1,
        slots: [
          { slotIndex: 0, seedId: null },
          { slotIndex: 1, seedId: null },
          { slotIndex: 2, seedId: null },
        ],
        totalHarvests: 0,
      },
    });

    const maxSlots = BASE_SLOTS_PER_LEVEL[greenhouse.gridLevel] || 3;
    let rawSlots = Array.isArray(greenhouse.slots) ? [...greenhouse.slots] : [];

    // Normalisasi jumlah slot jika belum cukup
    while (rawSlots.length < maxSlots) {
      rawSlots.push({ slotIndex: rawSlots.length, seedId: null });
    }

    const computedSlots = rawSlots
      .slice(0, maxSlots)
      .map((s) => this.computeSlotState(s));

    return {
      userId,
      gridLevel: greenhouse.gridLevel,
      maxSlots,
      slots: computedSlots,
      totalHarvests: greenhouse.totalHarvests,
      canUpgrade: greenhouse.gridLevel < MAX_GRID_LEVEL,
      nextUpgradeCost: UPGRADE_COSTS[greenhouse.gridLevel + 1] || null,
    };
  }

  /**
   * Menanam benih di slot tertentu
   */
  async plantSeed(userId, slotIndex, seedId) {
    const seed = getSeedById(seedId);
    if (!seed) return { success: false, reason: "INVALID_SEED" };

    const gh = await this.getGreenhouse(userId);
    if (slotIndex < 0 || slotIndex >= gh.maxSlots) {
      return { success: false, reason: "INVALID_SLOT_INDEX" };
    }

    const targetSlot = gh.slots[slotIndex];
    if (!targetSlot.isEmpty) {
      return { success: false, reason: "SLOT_OCCUPIED", current: targetSlot };
    }

    // Potong biaya koin benih dari wallet secara atomik
    const debit = await cacheManager.debitUserProfile(
      userId,
      "economy_wallet",
      seed.seedPrice,
    );
    if (!debit.ok) {
      return {
        success: false,
        reason: "INSUFFICIENT_FUNDS",
        cost: seed.seedPrice,
      };
    }

    const updatedRawSlots = gh.slots.map((s, idx) => {
      if (idx === slotIndex) {
        return {
          slotIndex,
          seedId: seed.id,
          plantedAt: new Date().toISOString(),
          moisture: 100,
          isFertilized: false,
        };
      }
      return {
        slotIndex: s.slotIndex,
        seedId: s.seedId || null,
        plantedAt: s.plantedAt || null,
        moisture: s.moisture || 100,
        isFertilized: s.isFertilized || false,
      };
    });

    await UserGreenhouse.update(
      { slots: updatedRawSlots },
      { where: { userId } },
    );

    logger.info(
      `[Greenhouse] User ${userId} menanam ${seed.name} di slot #${slotIndex + 1}`,
    );
    return {
      success: true,
      seed,
      slotIndex,
    };
  }

  /**
   * Menyiram tanaman hidroponik
   */
  async waterSlot(userId, slotIndex) {
    const gh = await this.getGreenhouse(userId);
    if (slotIndex < 0 || slotIndex >= gh.maxSlots) {
      return { success: false, reason: "INVALID_SLOT_INDEX" };
    }

    const slot = gh.slots[slotIndex];
    if (slot.isEmpty) return { success: false, reason: "SLOT_EMPTY" };

    const updatedRawSlots = gh.slots.map((s, idx) => {
      if (idx === slotIndex) {
        return {
          slotIndex: s.slotIndex,
          seedId: s.seedId,
          plantedAt: s.plantedAt,
          moisture: 100,
          isFertilized: s.isFertilized,
        };
      }
      return {
        slotIndex: s.slotIndex,
        seedId: s.seedId || null,
        plantedAt: s.plantedAt || null,
        moisture: s.moisture || 100,
        isFertilized: s.isFertilized || false,
      };
    });

    await UserGreenhouse.update(
      { slots: updatedRawSlots },
      { where: { userId } },
    );
    return { success: true, slotIndex };
  }

  /**
   * Memupuk slot tanaman (mempercepat tumbuh 25% dan bonus panen 50%)
   */
  async fertilizeSlot(userId, slotIndex) {
    const gh = await this.getGreenhouse(userId);
    if (slotIndex < 0 || slotIndex >= gh.maxSlots) {
      return { success: false, reason: "INVALID_SLOT_INDEX" };
    }

    const slot = gh.slots[slotIndex];
    if (slot.isEmpty) return { success: false, reason: "SLOT_EMPTY" };
    if (slot.isFertilized)
      return { success: false, reason: "ALREADY_FERTILIZED" };

    const fertilizerCost = 100;
    const debit = await cacheManager.debitUserProfile(
      userId,
      "economy_wallet",
      fertilizerCost,
    );
    if (!debit.ok) {
      return {
        success: false,
        reason: "INSUFFICIENT_FUNDS",
        cost: fertilizerCost,
      };
    }

    const updatedRawSlots = gh.slots.map((s, idx) => {
      if (idx === slotIndex) {
        return {
          slotIndex: s.slotIndex,
          seedId: s.seedId,
          plantedAt: s.plantedAt,
          moisture: s.moisture,
          isFertilized: true,
        };
      }
      return {
        slotIndex: s.slotIndex,
        seedId: s.seedId || null,
        plantedAt: s.plantedAt || null,
        moisture: s.moisture || 100,
        isFertilized: s.isFertilized || false,
      };
    });

    await UserGreenhouse.update(
      { slots: updatedRawSlots },
      { where: { userId } },
    );
    return { success: true, slotIndex };
  }

  /**
   * Panen hasil hidroponik
   */
  async harvestSlot(userId, slotIndex) {
    const gh = await this.getGreenhouse(userId);
    if (slotIndex < 0 || slotIndex >= gh.maxSlots) {
      return { success: false, reason: "INVALID_SLOT_INDEX" };
    }

    const slot = gh.slots[slotIndex];
    if (slot.isEmpty) return { success: false, reason: "SLOT_EMPTY" };
    if (!slot.isMature) {
      return {
        success: false,
        reason: "NOT_MATURE_YET",
        remainingMinutes: slot.remainingMinutes,
      };
    }

    const seed = slot.seed;
    const { itemId, itemName, amountMin, amountMax, xp } = seed.harvestYield;

    const baseAmount =
      Math.floor(Math.random() * (amountMax - amountMin + 1)) + amountMin;
    const finalAmount = slot.isFertilized
      ? Math.round(baseAmount * 1.5)
      : baseAmount;

    // Berikan item ke inventory secara atomik
    const harvestItem = {
      id: itemId,
      name: itemName,
      amount: finalAmount,
      type: "MATERIAL",
    };
    await cacheManager.addItemsAtomic(userId, [harvestItem]);

    // Berikan XP leveling jika ada
    await cacheManager.incrementUserProfile(userId, "economy_wallet", xp * 2);

    const updatedRawSlots = gh.slots.map((s, idx) => {
      if (idx === slotIndex) {
        return { slotIndex, seedId: null };
      }
      return {
        slotIndex: s.slotIndex,
        seedId: s.seedId || null,
        plantedAt: s.plantedAt || null,
        moisture: s.moisture || 100,
        isFertilized: s.isFertilized || false,
      };
    });

    await UserGreenhouse.increment("totalHarvests", {
      by: 1,
      where: { userId },
    });
    await UserGreenhouse.update(
      { slots: updatedRawSlots },
      { where: { userId } },
    );

    logger.info(
      `[Greenhouse] User ${userId} memanen ${finalAmount}x ${itemName} dari slot #${slotIndex + 1}`,
    );

    return {
      success: true,
      item: harvestItem,
      xpYield: xp,
      wasFertilized: slot.isFertilized,
    };
  }

  /**
   * Tingkatkan level greenhouse
   */
  async upgradeGrid(userId) {
    const gh = await this.getGreenhouse(userId);
    if (!gh.canUpgrade) return { success: false, reason: "ALREADY_MAX_LEVEL" };

    const cost = gh.nextUpgradeCost;
    const debit = await cacheManager.debitUserProfile(
      userId,
      "economy_wallet",
      cost,
    );
    if (!debit.ok) {
      return { success: false, reason: "INSUFFICIENT_FUNDS", cost };
    }

    const nextLevel = gh.gridLevel + 1;
    const newSlots = [...gh.slots, { slotIndex: gh.slots.length, seedId: null }];

    await UserGreenhouse.update(
      {
        gridLevel: nextLevel,
        slots: newSlots,
      },
      { where: { userId } },
    );

    return {
      success: true,
      newLevel: nextLevel,
      newMaxSlots: BASE_SLOTS_PER_LEVEL[nextLevel],
    };
  }
}

module.exports = new GreenhouseEngine();
