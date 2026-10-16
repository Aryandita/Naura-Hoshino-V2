"use strict";

const UserGreenhouse = require("../../models/UserGreenhouse");
const greenhouseEngine = require("./greenhouseEngine");
const inventoryHelper = require("./inventoryHelper");
const recyclingPoolEngine = require("./recyclingPoolEngine");
const cacheManager = require("../../managers/cacheManager");
const { logger } = require("../../managers/logger");

const MAX_BATTERY = 100;
const MAX_DURABILITY = 220;
const WATER_BATTERY_COST = 5; // 5% daya baterai per slot
const HARVEST_BATTERY_COST = 8; // 8% daya baterai per slot
const WATER_DURABILITY_COST = 1; // 1 poin ketahanan per penyiraman
const HARVEST_DURABILITY_COST = 1; // 1 poin ketahanan per pemanenan
const DRONE_YIELD_BONUS = 0.18; // +18% bonus panen dari drone
const RECHARGE_COAL_BATTERY = 40; // 1 coal_lump memulihkan 40% baterai
const RECHARGE_NSF_COST = 50; // 50 NSF untuk isi ulang penuh 100% baterai
const REPAIR_NSF_COST = 150; // 150 NSF untuk servis penuh durabilitas 220
const DEFAULT_DRONE_ID = "sprinkler_drone";
const DEFAULT_DRONE_NAME = "Drone Penyiram Sawah Pratama";

class FarmingDroneEngine {
  constructor() {
    this.MAX_BATTERY = MAX_BATTERY;
    this.MAX_DURABILITY = MAX_DURABILITY;
    this.WATER_BATTERY_COST = WATER_BATTERY_COST;
    this.HARVEST_BATTERY_COST = HARVEST_BATTERY_COST;
    this.DRONE_YIELD_BONUS = DRONE_YIELD_BONUS;
    this.RECHARGE_NSF_COST = RECHARGE_NSF_COST;
    this.REPAIR_NSF_COST = REPAIR_NSF_COST;
  }

  /**
   * Fungsi murni: menghitung hasil panen drone dengan bonus +18%.
   * @param {object} seed
   * @param {boolean} isFertilized
   * @param {number} [droneYieldBonus=0.18]
   * @param {number} [randomRoll=Math.random()]
   * @returns {object}
   */
  calculateDroneHarvestYield(seed, isFertilized, droneYieldBonus = DRONE_YIELD_BONUS, randomRoll = Math.random()) {
    if (!seed || !seed.harvestYield) {
      return { itemId: "crop_generic", itemName: "Hasil Panen", amount: 1, baseAmount: 1, xp: 10, isFertilized: false, bonusApplied: 0 };
    }
    const { itemId, itemName, amountMin, amountMax, xp } = seed.harvestYield;
    const baseAmount = Math.floor(randomRoll * (amountMax - amountMin + 1)) + amountMin;
    const fertMultiplier = isFertilized ? 1.5 : 1.0;
    const droneMultiplier = 1.0 + (Number(droneYieldBonus) || 0);
    const finalAmount = Math.max(1, Math.round(baseAmount * fertMultiplier * droneMultiplier));
    return {
      itemId,
      itemName,
      amount: finalAmount,
      baseAmount,
      xp: Number(xp) || 10,
      isFertilized: Boolean(isFertilized),
      bonusApplied: Math.round((finalAmount - baseAmount) * 10) / 10,
    };
  }

  /**
   * Fungsi murni: menghitung kebutuhan energi baterai untuk penyiraman dan panen.
   * @param {number} plotsToWaterCount
   * @param {number} plotsToHarvestCount
   * @returns {{ waterCost: number, harvestCost: number, totalCost: number }}
   */
  calculateSweepEnergyCost(plotsToWaterCount, plotsToHarvestCount) {
    const waterCost = Math.max(0, plotsToWaterCount) * WATER_BATTERY_COST;
    const harvestCost = Math.max(0, plotsToHarvestCount) * HARVEST_BATTERY_COST;
    return {
      waterCost,
      harvestCost,
      totalCost: waterCost + harvestCost,
    };
  }

  /**
   * Fungsi murni: menghitung pengurangan durabilitas berdasarkan aksi.
   * @param {number} wateredCount
   * @param {number} harvestedCount
   * @returns {number}
   */
  calculateDurabilityDeduction(wateredCount, harvestedCount) {
    return (Math.max(0, wateredCount) * WATER_DURABILITY_COST) + (Math.max(0, harvestedCount) * HARVEST_DURABILITY_COST);
  }

  /**
   * Mengambil status drone dan fasilitas kebun pengguna.
   * @param {string} userId
   * @returns {Promise<{ ok: boolean, hasDrone: boolean, drone: object, greenhouse: object }>}
   */
  async getDroneStatus(userId) {
    if (!userId) return { ok: false, hasDrone: false, drone: null, greenhouse: null };

    let drone = null;
    try {
      const survival = await cacheManager.getUserSurvival(userId);
      const droneData = survival?.rpg_state?.farming_drone;
      if (droneData && typeof droneData === "object") {
        drone = {
          id: droneData.id || DEFAULT_DRONE_ID,
          name: droneData.name || DEFAULT_DRONE_NAME,
          battery: typeof droneData.battery === "number" ? Math.max(0, Math.min(MAX_BATTERY, droneData.battery)) : MAX_BATTERY,
          maxBattery: MAX_BATTERY,
          durability: typeof droneData.durability === "number" ? Math.max(0, Math.min(MAX_DURABILITY, droneData.durability)) : MAX_DURABILITY,
          maxDurability: MAX_DURABILITY,
          yieldBonus: typeof droneData.yieldBonus === "number" ? droneData.yieldBonus : DRONE_YIELD_BONUS,
          autoWater: droneData.autoWater !== false,
          autoHarvest: droneData.autoHarvest !== false,
          isDocked: droneData.isDocked !== false,
          lastSweepAt: droneData.lastSweepAt || null,
        };
      }
    } catch (_) {}

    if (!drone) {
      drone = {
        id: DEFAULT_DRONE_ID,
        name: DEFAULT_DRONE_NAME,
        battery: MAX_BATTERY,
        maxBattery: MAX_BATTERY,
        durability: MAX_DURABILITY,
        maxDurability: MAX_DURABILITY,
        yieldBonus: DRONE_YIELD_BONUS,
        autoWater: true,
        autoHarvest: true,
        isDocked: true,
        lastSweepAt: null,
      };
    }

    let greenhouse = null;
    try {
      greenhouse = await greenhouseEngine.getGreenhouse(userId);
    } catch (_) {}

    return {
      ok: true,
      hasDrone: true,
      drone,
      greenhouse,
    };
  }

  /**
   * Menyiram seluruh petak tanaman yang membutuhkan air menggunakan drone.
   * @param {string} userId
   * @param {object} [options]
   * @returns {Promise<object>}
   */
  async autoWater(userId, options = {}) {
    return cacheManager.withLock(`farm:drone:${userId}`, 10000, async () => {
      const status = await this.getDroneStatus(userId);
      const drone = status.drone;

      if (drone.durability <= 0) {
        return {
          ok: false,
          reason: "DRONE_BROKEN",
          message: "Drone mengalami kerusakan mekanis (durabilitas 0/220). Lakukan servis perbaikan terlebih dahulu!",
        };
      }

      if (drone.battery < WATER_BATTERY_COST) {
        return {
          ok: false,
          reason: "BATTERY_DEPLETED",
          message: "Daya baterai drone tidak mencukupi (butuh minimal 5%). Harap isi ulang daya terlebih dahulu!",
        };
      }

      const gh = status.greenhouse;
      if (!gh || !Array.isArray(gh.slots)) {
        return { ok: false, reason: "NO_GREENHOUSE", message: "Fasilitas kebun hidroponik belum terdaftar." };
      }

      const drySlots = gh.slots.filter((s) => !s.isEmpty && (s.moisture === undefined || s.moisture < 100));
      if (drySlots.length === 0) {
        return {
          ok: true,
          wateredCount: 0,
          reason: "NO_SLOTS_NEED_WATER",
          message: "Seluruh petak tanaman hidroponik sudah memiliki kelembaban optimal 100%.",
        };
      }

      let currentBattery = drone.battery;
      let currentDurability = drone.durability;
      let wateredCount = 0;
      const wateredIndices = new Set();

      for (const slot of drySlots) {
        if (currentBattery < WATER_BATTERY_COST || currentDurability <= 0) break;
        currentBattery -= WATER_BATTERY_COST;
        currentDurability -= WATER_DURABILITY_COST;
        wateredIndices.add(slot.slotIndex);
        wateredCount++;
      }

      const updatedRawSlots = gh.slots.map((s) => {
        if (wateredIndices.has(s.slotIndex)) {
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

      await UserGreenhouse.update({ slots: updatedRawSlots }, { where: { userId } });

      await cacheManager.mutateUserSurvivalJson(userId, "rpg_state", (state) => {
        const next = state && typeof state === "object" ? { ...state } : {};
        next.farming_drone = {
          ...(next.farming_drone || drone),
          battery: currentBattery,
          durability: currentDurability,
          lastWaterAt: new Date().toISOString(),
        };
        return next;
      });

      return {
        ok: true,
        wateredCount,
        batteryUsed: wateredCount * WATER_BATTERY_COST,
        durabilityUsed: wateredCount * WATER_DURABILITY_COST,
        remainingBattery: currentBattery,
        remainingDurability: currentDurability,
      };
    });
  }

  /**
   * Memanen seluruh petak tanaman yang sudah matang menggunakan drone (+18% bonus yield).
   * @param {string} userId
   * @param {object} [options]
   * @returns {Promise<object>}
   */
  async autoHarvest(userId, options = {}) {
    return cacheManager.withLock(`farm:drone:${userId}`, 10000, async () => {
      const status = await this.getDroneStatus(userId);
      const drone = status.drone;

      if (drone.durability <= 0) {
        return {
          ok: false,
          reason: "DRONE_BROKEN",
          message: "Drone mengalami kerusakan mekanis (durabilitas 0/220). Lakukan servis perbaikan terlebih dahulu!",
        };
      }

      if (drone.battery < HARVEST_BATTERY_COST) {
        return {
          ok: false,
          reason: "BATTERY_DEPLETED",
          message: "Daya baterai drone tidak mencukupi untuk memanen (butuh minimal 8%). Harap isi ulang daya terlebih dahulu!",
        };
      }

      const gh = status.greenhouse;
      if (!gh || !Array.isArray(gh.slots)) {
        return { ok: false, reason: "NO_GREENHOUSE", message: "Fasilitas kebun hidroponik belum terdaftar." };
      }

      const matureSlots = gh.slots.filter((s) => !s.isEmpty && s.isMature === true);
      if (matureSlots.length === 0) {
        return {
          ok: true,
          harvestedCount: 0,
          reason: "NO_MATURE_CROPS",
          message: "Belum ada tanaman yang cukup matang untuk dipanen.",
        };
      }

      let currentBattery = drone.battery;
      let currentDurability = drone.durability;
      let harvestedCount = 0;
      const harvestedIndices = new Set();
      const harvestItems = [];
      let totalCoins = 0;
      let totalXp = 0;

      for (const slot of matureSlots) {
        if (currentBattery < HARVEST_BATTERY_COST || currentDurability <= 0) break;

        const yieldData = this.calculateDroneHarvestYield(
          slot.seed,
          slot.isFertilized,
          drone.yieldBonus || DRONE_YIELD_BONUS,
        );

        harvestItems.push({
          id: yieldData.itemId,
          name: yieldData.itemName,
          amount: yieldData.amount,
          type: "MATERIAL",
        });

        totalXp += yieldData.xp;
        totalCoins += yieldData.xp * 2;
        currentBattery -= HARVEST_BATTERY_COST;
        currentDurability -= HARVEST_DURABILITY_COST;
        harvestedIndices.add(slot.slotIndex);
        harvestedCount++;
      }

      if (harvestedCount === 0) {
        return {
          ok: false,
          reason: "INSUFFICIENT_POWER_FOR_HARVEST",
          message: "Daya atau durabilitas drone habis sebelum dapat memanen.",
        };
      }

      // Tambahkan seluruh item hasil panen ke inventory secara atomik
      await cacheManager.addItemsAtomic(userId, harvestItems);

      // Tambahkan perolehan koin ekonomi secara atomik
      if (totalCoins > 0) {
        await cacheManager.incrementUserProfile(userId, "economy_wallet", totalCoins);
      }

      // Tambahkan Season Pass XP jika ada
      try {
        const seasonEngine = require("../../services/seasonEngine");
        if (typeof seasonEngine.addSeasonXp === "function") {
          await seasonEngine.addSeasonXp(userId, 15 * harvestedCount);
        }
      } catch (_) {}

      const updatedRawSlots = gh.slots.map((s) => {
        if (harvestedIndices.has(s.slotIndex)) {
          return { slotIndex: s.slotIndex, seedId: null, plantedAt: null, moisture: 100, isFertilized: false };
        }
        return {
          slotIndex: s.slotIndex,
          seedId: s.seedId || null,
          plantedAt: s.plantedAt || null,
          moisture: s.moisture || 100,
          isFertilized: s.isFertilized || false,
        };
      });

      await UserGreenhouse.increment("totalHarvests", { by: harvestedCount, where: { userId } });
      await UserGreenhouse.update({ slots: updatedRawSlots }, { where: { userId } });

      await cacheManager.mutateUserSurvivalJson(userId, "rpg_state", (state) => {
        const next = state && typeof state === "object" ? { ...state } : {};
        next.farming_drone = {
          ...(next.farming_drone || drone),
          battery: currentBattery,
          durability: currentDurability,
          lastHarvestAt: new Date().toISOString(),
        };
        return next;
      });

      return {
        ok: true,
        harvestedCount,
        items: harvestItems,
        totalXp,
        totalCoins,
        batteryUsed: harvestedCount * HARVEST_BATTERY_COST,
        durabilityUsed: harvestedCount * HARVEST_DURABILITY_COST,
        remainingBattery: currentBattery,
        remainingDurability: currentDurability,
      };
    });
  }

  /**
   * Menjalankan pembersihan dan perawatan penuh (siram + panen sekaligus) dalam satu pass terkunci.
   * @param {string} userId
   * @param {object} [options]
   * @returns {Promise<object>}
   */
  async sweepGreenhouse(userId, options = {}) {
    return cacheManager.withLock(`farm:drone:${userId}`, 10000, async () => {
      const status = await this.getDroneStatus(userId);
      const drone = status.drone;

      if (drone.durability <= 0) {
        return {
          ok: false,
          reason: "DRONE_BROKEN",
          message: "Drone mengalami kerusakan struktural (0/220). Lakukan servis perbaikan terlebih dahulu!",
        };
      }

      if (drone.battery < WATER_BATTERY_COST && drone.battery < HARVEST_BATTERY_COST) {
        return {
          ok: false,
          reason: "BATTERY_DEPLETED",
          message: "Baterai drone habis total. Isi daya terlebih dahulu!",
        };
      }

      const gh = status.greenhouse;
      if (!gh || !Array.isArray(gh.slots)) {
        return { ok: false, reason: "NO_GREENHOUSE", message: "Fasilitas kebun hidroponik belum terdaftar." };
      }

      let currentBattery = drone.battery;
      let currentDurability = drone.durability;
      let wateredCount = 0;
      let harvestedCount = 0;
      const harvestedIndices = new Set();
      const wateredIndices = new Set();
      const harvestItems = [];
      let totalCoins = 0;
      let totalXp = 0;

      // 1. Panen tanaman matang terlebih dahulu
      const matureSlots = gh.slots.filter((s) => !s.isEmpty && s.isMature === true);
      for (const slot of matureSlots) {
        if (currentBattery < HARVEST_BATTERY_COST || currentDurability <= 0) break;

        const yieldData = this.calculateDroneHarvestYield(
          slot.seed,
          slot.isFertilized,
          drone.yieldBonus || DRONE_YIELD_BONUS,
        );

        harvestItems.push({
          id: yieldData.itemId,
          name: yieldData.itemName,
          amount: yieldData.amount,
          type: "MATERIAL",
        });

        totalXp += yieldData.xp;
        totalCoins += yieldData.xp * 2;
        currentBattery -= HARVEST_BATTERY_COST;
        currentDurability -= HARVEST_DURABILITY_COST;
        harvestedIndices.add(slot.slotIndex);
        harvestedCount++;
      }

      // 2. Siram petak yang masih tertanam dan butuh air
      const drySlots = gh.slots.filter(
        (s) => !s.isEmpty && !harvestedIndices.has(s.slotIndex) && (s.moisture === undefined || s.moisture < 100),
      );
      for (const slot of drySlots) {
        if (currentBattery < WATER_BATTERY_COST || currentDurability <= 0) break;
        currentBattery -= WATER_BATTERY_COST;
        currentDurability -= WATER_DURABILITY_COST;
        wateredIndices.add(slot.slotIndex);
        wateredCount++;
      }

      // Berikan item panen ke inventory jika ada
      if (harvestItems.length > 0) {
        await cacheManager.addItemsAtomic(userId, harvestItems);
      }

      // Berikan koin jika ada
      if (totalCoins > 0) {
        await cacheManager.incrementUserProfile(userId, "economy_wallet", totalCoins);
      }

      // Season XP
      if (harvestedCount > 0) {
        try {
          const seasonEngine = require("../../services/seasonEngine");
          if (typeof seasonEngine.addSeasonXp === "function") {
            await seasonEngine.addSeasonXp(userId, 15 * harvestedCount);
          }
        } catch (_) {}
      }

      // Perbarui slot kebun
      const updatedRawSlots = gh.slots.map((s) => {
        if (harvestedIndices.has(s.slotIndex)) {
          return { slotIndex: s.slotIndex, seedId: null, plantedAt: null, moisture: 100, isFertilized: false };
        }
        if (wateredIndices.has(s.slotIndex)) {
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

      if (harvestedCount > 0) {
        await UserGreenhouse.increment("totalHarvests", { by: harvestedCount, where: { userId } });
      }
      await UserGreenhouse.update({ slots: updatedRawSlots }, { where: { userId } });

      const nowIso = new Date().toISOString();
      await cacheManager.mutateUserSurvivalJson(userId, "rpg_state", (state) => {
        const next = state && typeof state === "object" ? { ...state } : {};
        next.farming_drone = {
          ...(next.farming_drone || drone),
          battery: currentBattery,
          durability: currentDurability,
          lastSweepAt: nowIso,
        };
        return next;
      });

      return {
        ok: true,
        summary: {
          wateredCount,
          harvestedCount,
          itemsHarvested: harvestItems,
          totalXp,
          totalCoins,
          batteryUsed: (wateredCount * WATER_BATTERY_COST) + (harvestedCount * HARVEST_BATTERY_COST),
          durabilityUsed: (wateredCount * WATER_DURABILITY_COST) + (harvestedCount * HARVEST_DURABILITY_COST),
          drone: {
            id: drone.id,
            name: drone.name,
            battery: currentBattery,
            durability: currentDurability,
            maxBattery: MAX_BATTERY,
            maxDurability: MAX_DURABILITY,
            lastSweepAt: nowIso,
          },
        },
      };
    });
  }

  /**
   * Mengisi ulang daya baterai drone (menggunakan coal_lump atau NSF).
   * @param {string} userId
   * @param {"fuel"|"nsf"} method - "fuel" (coal_lump) atau "nsf" (listrik server)
   * @returns {Promise<object>}
   */
  async rechargeDrone(userId, method = "fuel") {
    return cacheManager.withLock(`farm:drone:${userId}`, 10000, async () => {
      const status = await this.getDroneStatus(userId);
      const drone = status.drone;

      if (drone.battery >= MAX_BATTERY) {
        return {
          ok: false,
          reason: "ALREADY_FULL",
          message: "Baterai drone sudah terisi penuh (100%)!",
        };
      }

      let newBattery = drone.battery;
      let costInfo = 0;

      if (method === "fuel") {
        const takeRes = await inventoryHelper.takeItemsAtomic(userId, [{ id: "coal_lump", amount: 1 }]);
        if (!takeRes.ok) {
          return {
            ok: false,
            reason: "NO_FUEL",
            message: "Bahan bakar Arang Batok (coal_lump) tidak mencukupi di ranselmu!",
          };
        }
        newBattery = Math.min(MAX_BATTERY, drone.battery + RECHARGE_COAL_BATTERY);
        costInfo = 1;
      } else {
        const debit = await cacheManager.debitUserSurvival(userId, "starFragments", RECHARGE_NSF_COST);
        if (!debit.ok) {
          return {
            ok: false,
            reason: "INSUFFICIENT_NSF",
            message: `Saldo Star Fragments (NSF) tidak mencukupi! Butuh ${RECHARGE_NSF_COST} NSF.`,
          };
        }
        await recyclingPoolEngine.allocateSinkFunds(RECHARGE_NSF_COST);
        await recyclingPoolEngine.awardLotteryTickets(userId, RECHARGE_NSF_COST);
        newBattery = MAX_BATTERY;
        costInfo = RECHARGE_NSF_COST;
      }

      await cacheManager.mutateUserSurvivalJson(userId, "rpg_state", (state) => {
        const next = state && typeof state === "object" ? { ...state } : {};
        next.farming_drone = {
          ...(next.farming_drone || drone),
          battery: newBattery,
        };
        return next;
      });

      logger.info(`[FarmingDrone] User ${userId} cas baterai drone via ${method} -> ${newBattery}%`);

      return {
        ok: true,
        newBattery,
        method,
        cost: costInfo,
      };
    });
  }

  /**
   * Memperbaiki durabilitas drone yang aus/rusak dengan NSF dan saluran ServerTreasury.
   * @param {string} userId
   * @returns {Promise<object>}
   */
  async repairDrone(userId) {
    return cacheManager.withLock(`farm:drone:${userId}`, 10000, async () => {
      const status = await this.getDroneStatus(userId);
      const drone = status.drone;

      if (drone.durability >= MAX_DURABILITY) {
        return {
          ok: false,
          reason: "ALREADY_REPAIRED",
          message: "Drone masih dalam kondisi prima (220/220), tidak memerlukan servis perbaikan!",
        };
      }

      const debit = await cacheManager.debitUserSurvival(userId, "starFragments", REPAIR_NSF_COST);
      if (!debit.ok) {
        return {
          ok: false,
          reason: "INSUFFICIENT_NSF",
          message: `Saldo Star Fragments (NSF) tidak mencukupi untuk servis drone! Butuh ${REPAIR_NSF_COST} NSF.`,
        };
      }

      await recyclingPoolEngine.allocateSinkFunds(REPAIR_NSF_COST);
      await recyclingPoolEngine.awardLotteryTickets(userId, REPAIR_NSF_COST);

      await cacheManager.mutateUserSurvivalJson(userId, "rpg_state", (state) => {
        const next = state && typeof state === "object" ? { ...state } : {};
        next.farming_drone = {
          ...(next.farming_drone || drone),
          durability: MAX_DURABILITY,
        };
        return next;
      });

      logger.info(`[FarmingDrone] User ${userId} perbaiki drone -> ${MAX_DURABILITY}/${MAX_DURABILITY}`);

      return {
        ok: true,
        newDurability: MAX_DURABILITY,
        cost: REPAIR_NSF_COST,
      };
    });
  }

  /**
   * Memasang (dock) atau melepas (undock) drone ke fasilitas greenhouse.
   * @param {string} userId
   * @param {boolean} [dock=true]
   * @returns {Promise<object>}
   */
  async setDroneDock(userId, dock = true) {
    return cacheManager.withLock(`farm:drone:${userId}`, 10000, async () => {
      const status = await this.getDroneStatus(userId);
      const isDocked = Boolean(dock);

      await cacheManager.mutateUserSurvivalJson(userId, "rpg_state", (state) => {
        const next = state && typeof state === "object" ? { ...state } : {};
        next.farming_drone = {
          ...(next.farming_drone || status.drone),
          isDocked,
        };
        return next;
      });

      return {
        ok: true,
        isDocked,
      };
    });
  }
}

const farmingDroneEngine = new FarmingDroneEngine();

farmingDroneEngine.FarmingDroneEngine = FarmingDroneEngine;

module.exports = farmingDroneEngine;
