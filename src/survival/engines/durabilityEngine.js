"use strict";

const cacheManager = require("../../managers/cacheManager");
const recyclingPoolEngine = require("./recyclingPoolEngine");
const { logger } = require("../../managers/logger");

class DurabilityEngine {
  /**
   * Menghitung estimasi biaya perbaikan alat berdasarkan formula 5% nilai barang + surcharge keausan
   * @param {object} item - Objek item dari inventaris (misal: pickaxe, axe, fishing_rod)
   * @returns {number} Biaya NSF yang dibutuhkan
   */
  static calculateRepairCost(item) {
    if (!item) return 0;
    const baseValue = Number(
      item.price || item.value || (item.tier ? item.tier * 200 : 300),
    );
    const currentDurability = Math.max(
      0,
      Math.min(
        100,
        Number(item.durability !== undefined ? item.durability : 100),
      ),
    );

    if (currentDurability >= 100) return 0;

    // Persentase kerusakan (0.0 sampai 1.0)
    const damagePercent = (100 - currentDurability) / 100;
    const baseRepairCost = Math.max(
      10,
      Math.floor(baseValue * 0.05 * damagePercent),
    );

    // Wear & Tear Surcharge: +10% surcharge jika durabilitas di bawah 20%
    let surcharge = 1.0;
    if (currentDurability < 20) {
      surcharge = 1.2; // +20% biaya jika rusak parah
    } else if (currentDurability < 40) {
      surcharge = 1.1; // +10% biaya jika aus
    }

    return Math.floor(baseRepairCost * surcharge);
  }

  /**
   * Memperbaiki alat yang aus di inventaris pemain secara atomik
   * @param {string} userId
   * @param {string} itemInstanceId - ID atau nama item yang diperbaiki
   * @returns {Promise<object>}
   */
  static async repairItem(userId, itemInstanceId) {
    if (!userId || !itemInstanceId) {
      return { ok: false, reason: "INVALID_PARAMS" };
    }

    const profile = await cacheManager.getUserProfile(userId);
    if (!profile) return { ok: false, reason: "PROFILE_NOT_FOUND" };

    const { safeParseInventory } = require("./inventoryHelper");
    const inv = safeParseInventory(profile.inventory);
    const itemIndex = inv.findIndex(
      (it) =>
        it &&
        (it.id === itemInstanceId ||
          it.instanceId === itemInstanceId ||
          it.name === itemInstanceId),
    );

    if (itemIndex === -1) {
      return { ok: false, reason: "ITEM_NOT_FOUND" };
    }

    const item = inv[itemIndex];
    const cost = this.calculateRepairCost(item);
    if (cost === 0) {
      return { ok: false, reason: "ALREADY_FULL_DURABILITY" };
    }

    // Pemotongan NSF secara atomik
    const debit = await cacheManager.debitUserSurvival(
      userId,
      "starFragments",
      cost,
    );
    if (!debit.ok) {
      return { ok: false, reason: "INSUFFICIENT_FUNDS", cost };
    }

    // Perbaiki durabilitas ke 100
    item.durability = 100;
    inv[itemIndex] = item;

    await cacheManager.mutateUserProfileJson(userId, "inventory", () => inv);

    // Alirkan dana penarikan ke sistem daur ulang 4 saluran
    await recyclingPoolEngine.allocateSinkFunds(cost);
    const ticketsAwarded = await recyclingPoolEngine.awardLotteryTickets(
      userId,
      cost,
    );

    logger.info(
      `[DurabilityEngine] User ${userId} memperbaiki item ${item.name || item.id} seharga ${cost} NSF (+${ticketsAwarded} tiket undian)`,
    );

    return {
      ok: true,
      cost,
      ticketsAwarded,
      item: { ...item },
    };
  }

  /**
   * Mendaur ulang (salvage) perlengkapan rusak/aus menjadi material mentah dan bonus NSF secara atomik.
   * @param {string} userId
   * @param {string} itemInstanceId
   * @returns {Promise<object>}
   */
  static async salvageItem(userId, itemInstanceId) {
    if (!userId || !itemInstanceId) {
      return { ok: false, reason: "INVALID_PARAMS" };
    }

    const profile = await cacheManager.getUserProfile(userId);
    if (!profile) return { ok: false, reason: "PROFILE_NOT_FOUND" };

    const { safeParseInventory, addItemsAtomic } = require("./inventoryHelper");
    const inv = safeParseInventory(profile.inventory);
    const itemIndex = inv.findIndex(
      (it) =>
        it &&
        (it.id === itemInstanceId ||
          it.instanceId === itemInstanceId ||
          it.name === itemInstanceId),
    );

    if (itemIndex === -1) {
      return {
        ok: false,
        reason: "ITEM_NOT_FOUND",
        message: "Barang tidak ditemukan di tas petualang.",
      };
    }

    const item = inv[itemIndex];
    const currentDurability = Number(
      item.durability !== undefined ? item.durability : 100,
    );

    // Hapus 1 unit barang dari inventaris
    inv.splice(itemIndex, 1);
    await cacheManager.mutateUserProfileJson(userId, "inventory", () => inv);

    // Tentukan material mentah hasil bongkaran
    const idStr = String(item.id || item.name || "").toLowerCase();
    let mainMaterial = {
      id: "copper_ingot",
      name: "Batangan Tembaga",
      amount: 1,
    };
    if (
      item.tier >= 4 ||
      idStr.includes("diamond") ||
      idStr.includes("mythic") ||
      idStr.includes("celestial")
    ) {
      mainMaterial = {
        id: "steel_ingot",
        name: "Batangan Baja Tempa",
        amount: 2,
      };
    } else if (
      item.tier >= 2 ||
      idStr.includes("iron") ||
      idStr.includes("steel")
    ) {
      mainMaterial = { id: "iron_ingot", name: "Batangan Besi", amount: 1 };
    }

    const crystalBonus = {
      id: "herb",
      name: "Serbuk Kristal Kosmik",
      amount: 1,
    };
    const salvagedList = [mainMaterial, crystalBonus];

    // Masukkan material ke tas
    await addItemsAtomic(userId, salvagedList);

    // Bonus Star Fragments dari nilai sisa daur ulang
    const scrapNsf = Math.max(25, Math.floor(Number(item.price || 200) * 0.25));
    await cacheManager
      .incrementUserSurvival(userId, { starFragments: scrapNsf })
      .catch(() => {});

    logger.info(
      `[DurabilityEngine] User ${userId} berhasil mendaur ulang item ${item.name || item.id} (durability: ${currentDurability}%) menjadi material mentah & +${scrapNsf} NSF`,
    );

    return {
      ok: true,
      salvagedItem: item,
      materials: salvagedList,
      nsfAwarded: scrapNsf,
    };
  }

  /**
   * Mendaur ulang (salvage massal) seluruh perlengkapan rusak (durabilitas 0) di inventaris pemain secara atomik
   * @param {string} userId
   * @returns {Promise<object>}
   */
  static async salvageAllDamagedItems(userId) {
    if (!userId) return { ok: false, reason: "INVALID_PARAMS" };

    const { safeParseInventory, addOrStackItem } = require("./inventoryHelper");

    let salvagedItems = [];
    let totalNsf = 0;
    let gatheredMaterials = [];

    const mutateRes = await cacheManager.mutateUserProfileJson(
      userId,
      "inventory",
      (raw) => {
        let inv = safeParseInventory(raw);
        const damagedIndices = [];
        for (let i = 0; i < inv.length; i++) {
          const it = inv[i];
          if (it && it.durability !== undefined && Number(it.durability) <= 0) {
            damagedIndices.push(i);
          }
        }

        if (damagedIndices.length === 0) {
          return inv;
        }

        salvagedItems = [];
        totalNsf = 0;
        const materialMap = new Map();

        for (let i = damagedIndices.length - 1; i >= 0; i--) {
          const idx = damagedIndices[i];
          const item = inv[idx];
          inv.splice(idx, 1);
          salvagedItems.push(item);

          const idStr = String(item.id || item.name || "").toLowerCase();
          let mainMatId = "copper_ingot";
          let mainMatName = "Batangan Tembaga";
          let mainMatAmount = 1;

          if (
            item.tier >= 4 ||
            idStr.includes("diamond") ||
            idStr.includes("mythic") ||
            idStr.includes("celestial")
          ) {
            mainMatId = "steel_ingot";
            mainMatName = "Batangan Baja Tempa";
            mainMatAmount = 2;
          } else if (
            item.tier >= 2 ||
            idStr.includes("iron") ||
            idStr.includes("steel")
          ) {
            mainMatId = "iron_ingot";
            mainMatName = "Batangan Besi";
            mainMatAmount = 1;
          }

          materialMap.set(mainMatId, {
            id: mainMatId,
            name: mainMatName,
            amount: (materialMap.get(mainMatId)?.amount || 0) + mainMatAmount,
          });

          materialMap.set("herb", {
            id: "herb",
            name: "Serbuk Kristal Kosmik",
            amount: (materialMap.get("herb")?.amount || 0) + 1,
          });

          totalNsf += Math.max(
            25,
            Math.floor(Number(item.price || 200) * 0.25),
          );
        }

        gatheredMaterials = Array.from(materialMap.values());
        for (const mat of gatheredMaterials) {
          inv = addOrStackItem(inv, mat);
        }

        return inv;
      },
    );

    if (!mutateRes || !mutateRes.ok) {
      return { ok: false, reason: mutateRes?.reason || "MUTATION_FAILED" };
    }

    if (salvagedItems.length === 0) {
      return {
        ok: false,
        reason: "NO_DAMAGED_ITEMS",
        message:
          "Tidak ada perlengkapan rusak (durabilitas 0%) di dalam tasmu.",
      };
    }

    if (totalNsf > 0) {
      await cacheManager
        .incrementUserSurvival(userId, { starFragments: totalNsf })
        .catch(() => {});
    }

    logger.info(
      `[DurabilityEngine] User ${userId} mendaur ulang massal ${salvagedItems.length} alat rusak (+${totalNsf} NSF)`,
    );

    return {
      ok: true,
      count: salvagedItems.length,
      salvagedItems,
      materials: gatheredMaterials,
      nsfAwarded: totalNsf,
    };
  }
}

module.exports = DurabilityEngine;
