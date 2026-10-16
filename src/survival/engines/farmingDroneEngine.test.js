"use strict";

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const farmingDroneEngine = require("./farmingDroneEngine");
const greenhouseEngine = require("./greenhouseEngine");
const cacheManager = require("../../managers/cacheManager");
const inventoryHelper = require("./inventoryHelper");
const recyclingPoolEngine = require("./recyclingPoolEngine");
const UserGreenhouse = require("../../models/UserGreenhouse");
const seasonEngine = require("../../services/seasonEngine");

describe("Cyber-Agronomy Farming Drone Engine", () => {
  let originalWithLock;
  let originalGetUserSurvival;
  let originalMutateUserSurvivalJson;
  let originalDebitUserSurvival;
  let originalAddItemsAtomic;
  let originalTakeItemsAtomic;
  let originalIncrementUserProfile;
  let originalGetGreenhouse;
  let originalGreenhouseUpdate;
  let originalGreenhouseIncrement;
  let originalAllocateSinkFunds;
  let originalAwardLotteryTickets;
  let originalAddSeasonXp;

  let mockRpgState = {};
  let mockGreenhouseSlots = [];
  let allocatedSink = 0;
  let awardedTickets = 0;
  let inventoryDeposits = [];
  let walletIncrements = 0;

  beforeEach(() => {
    originalWithLock = cacheManager.withLock;
    originalGetUserSurvival = cacheManager.getUserSurvival;
    originalMutateUserSurvivalJson = cacheManager.mutateUserSurvivalJson;
    originalDebitUserSurvival = cacheManager.debitUserSurvival;
    originalAddItemsAtomic = cacheManager.addItemsAtomic;
    originalTakeItemsAtomic = inventoryHelper.takeItemsAtomic;
    originalIncrementUserProfile = cacheManager.incrementUserProfile;
    originalGetGreenhouse = greenhouseEngine.getGreenhouse;
    originalGreenhouseUpdate = UserGreenhouse.update;
    originalGreenhouseIncrement = UserGreenhouse.increment;
    originalAllocateSinkFunds = recyclingPoolEngine.allocateSinkFunds;
    originalAwardLotteryTickets = recyclingPoolEngine.awardLotteryTickets;
    originalAddSeasonXp = seasonEngine.addSeasonXp;
    seasonEngine.addSeasonXp = async () => ({ ok: true });

    mockRpgState = {
      farming_drone: {
        id: "sprinkler_drone",
        name: "Drone Penyiram Sawah Pratama",
        battery: 100,
        maxBattery: 100,
        durability: 220,
        maxDurability: 220,
        yieldBonus: 0.18,
        isDocked: true,
      },
    };

    mockGreenhouseSlots = [
      {
        slotIndex: 0,
        seedId: "astral_strawberry",
        seed: {
          id: "astral_strawberry",
          name: "Astral Strawberry",
          harvestYield: { itemId: "berry", itemName: "Astral Strawberry", amountMin: 4, amountMax: 4, xp: 25 },
        },
        isEmpty: false,
        isMature: true,
        moisture: 100,
        isFertilized: false,
      },
      {
        slotIndex: 1,
        seedId: "cyber_mint",
        seed: {
          id: "cyber_mint",
          name: "Cyber Mint",
          harvestYield: { itemId: "herb", itemName: "Cyber Mint Leaf", amountMin: 3, amountMax: 3, xp: 45 },
        },
        isEmpty: false,
        isMature: false,
        moisture: 50,
        isFertilized: false,
      },
      {
        slotIndex: 2,
        seedId: null,
        isEmpty: true,
        isMature: false,
        moisture: 100,
        isFertilized: false,
      },
    ];

    allocatedSink = 0;
    awardedTickets = 0;
    inventoryDeposits = [];
    walletIncrements = 0;

    // Mock withLock to execute workFn directly
    cacheManager.withLock = async (_key, _ttl, workFn) => workFn();

    cacheManager.getUserSurvival = async () => ({
      userId: "test_drone_user",
      rpg_state: mockRpgState,
    });

    cacheManager.mutateUserSurvivalJson = async (userId, field, mutator) => {
      mockRpgState = await mutator(mockRpgState);
      return { ok: true, value: mockRpgState };
    };

    cacheManager.debitUserSurvival = async (userId, field, amount) => ({ ok: true, amount });

    cacheManager.addItemsAtomic = async (userId, items) => {
      inventoryDeposits.push(...items);
      return { ok: true };
    };

    inventoryHelper.takeItemsAtomic = async (userId, reqs) => ({ ok: true });

    cacheManager.incrementUserProfile = async (userId, field, amount) => {
      walletIncrements += amount;
      return { ok: true };
    };

    greenhouseEngine.getGreenhouse = async () => ({
      userId: "test_drone_user",
      gridLevel: 1,
      maxSlots: 3,
      slots: mockGreenhouseSlots,
      totalHarvests: 5,
    });

    UserGreenhouse.update = async (fields) => {
      if (fields.slots) mockGreenhouseSlots = fields.slots;
      return [1];
    };

    UserGreenhouse.increment = async () => [1];

    recyclingPoolEngine.allocateSinkFunds = async (amt) => {
      allocatedSink += amt;
      return { ok: true, allocated: amt };
    };

    recyclingPoolEngine.awardLotteryTickets = async (userId, amt) => {
      awardedTickets += Math.floor(amt / 250);
      return awardedTickets;
    };
  });

  afterEach(() => {
    cacheManager.withLock = originalWithLock;
    cacheManager.getUserSurvival = originalGetUserSurvival;
    cacheManager.mutateUserSurvivalJson = originalMutateUserSurvivalJson;
    cacheManager.debitUserSurvival = originalDebitUserSurvival;
    cacheManager.addItemsAtomic = originalAddItemsAtomic;
    inventoryHelper.takeItemsAtomic = originalTakeItemsAtomic;
    cacheManager.incrementUserProfile = originalIncrementUserProfile;
    greenhouseEngine.getGreenhouse = originalGetGreenhouse;
    UserGreenhouse.update = originalGreenhouseUpdate;
    UserGreenhouse.increment = originalGreenhouseIncrement;
    recyclingPoolEngine.allocateSinkFunds = originalAllocateSinkFunds;
    recyclingPoolEngine.awardLotteryTickets = originalAwardLotteryTickets;
    seasonEngine.addSeasonXp = originalAddSeasonXp;
  });

  it("calculateDroneHarvestYield harus memberikan bonus +18% panen", () => {
    const seed = {
      harvestYield: {
        itemId: "berry",
        itemName: "Astral Strawberry",
        amountMin: 10,
        amountMax: 10,
        xp: 50,
      },
    };

    // Tanpa pupuk: base 10 * 1.0 * 1.18 = 11.8 -> round = 12
    const yieldUnfert = farmingDroneEngine.calculateDroneHarvestYield(seed, false, 0.18, 0);
    assert.equal(yieldUnfert.baseAmount, 10);
    assert.equal(yieldUnfert.amount, 12);
    assert.equal(yieldUnfert.bonusApplied, 2);

    // Dengan pupuk: base 10 * 1.5 * 1.18 = 17.7 -> round = 18
    const yieldFert = farmingDroneEngine.calculateDroneHarvestYield(seed, true, 0.18, 0);
    assert.equal(yieldFert.amount, 18);
    assert.equal(yieldFert.isFertilized, true);
  });

  it("calculateSweepEnergyCost dan calculateDurabilityDeduction harus akurat", () => {
    const energy = farmingDroneEngine.calculateSweepEnergyCost(3, 2);
    assert.equal(energy.waterCost, 15); // 3 * 5
    assert.equal(energy.harvestCost, 16); // 2 * 8
    assert.equal(energy.totalCost, 31);

    const dur = farmingDroneEngine.calculateDurabilityDeduction(3, 2);
    assert.equal(dur, 5); // 3 + 2
  });

  it("getDroneStatus harus mengembalikan data drone dan ringkasan greenhouse", async () => {
    const status = await farmingDroneEngine.getDroneStatus("test_drone_user");
    assert.equal(status.ok, true);
    assert.equal(status.hasDrone, true);
    assert.equal(status.drone.battery, 100);
    assert.equal(status.drone.durability, 220);
    assert.equal(status.drone.yieldBonus, 0.18);
    assert.ok(status.greenhouse);
  });

  it("autoWater harus menyiram petak kering dan mengurangi baterai serta durabilitas", async () => {
    const res = await farmingDroneEngine.autoWater("test_drone_user");
    assert.equal(res.ok, true);
    assert.equal(res.wateredCount, 1); // Slot 1 had moisture 50
    assert.equal(res.batteryUsed, 5);
    assert.equal(res.durabilityUsed, 1);
    assert.equal(res.remainingBattery, 95);
    assert.equal(res.remainingDurability, 219);

    // Verifikasi penyimpanan mutasi
    assert.equal(mockRpgState.farming_drone.battery, 95);
    assert.equal(mockRpgState.farming_drone.durability, 219);
  });

  it("autoHarvest harus memanen tanaman matang dengan bonus +18% dan deposit inventory", async () => {
    const res = await farmingDroneEngine.autoHarvest("test_drone_user");
    assert.equal(res.ok, true);
    assert.equal(res.harvestedCount, 1); // Slot 0 is mature
    assert.equal(res.batteryUsed, 8);
    assert.equal(res.durabilityUsed, 1);
    assert.equal(res.remainingBattery, 92);
    assert.equal(res.remainingDurability, 219);

    // Verifikasi item panen diserahkan ke inventory
    assert.equal(inventoryDeposits.length, 1);
    assert.equal(inventoryDeposits[0].id, "berry");
    assert.ok(inventoryDeposits[0].amount >= 4);

    // Verifikasi koin ditambahkan
    assert.ok(walletIncrements > 0);
  });

  it("sweepGreenhouse harus menjalankan panen dan penyiraman dalam satu pass", async () => {
    const res = await farmingDroneEngine.sweepGreenhouse("test_drone_user");
    assert.equal(res.ok, true);
    assert.equal(res.summary.harvestedCount, 1);
    assert.equal(res.summary.wateredCount, 1);
    assert.equal(res.summary.batteryUsed, 13); // 8 + 5
    assert.equal(res.summary.durabilityUsed, 2); // 1 + 1
    assert.equal(res.summary.drone.battery, 87);
    assert.equal(res.summary.drone.durability, 218);
  });

  it("rechargeDrone via NSF harus memotong dana dan menyalurkan ke ServerTreasury", async () => {
    mockRpgState.farming_drone.battery = 30;

    const res = await farmingDroneEngine.rechargeDrone("test_drone_user", "nsf");
    assert.equal(res.ok, true);
    assert.equal(res.newBattery, 100);
    assert.equal(res.cost, 50);
    assert.equal(allocatedSink, 50);
    assert.equal(mockRpgState.farming_drone.battery, 100);
  });

  it("rechargeDrone via fuel (arang) harus mengisi 40% baterai", async () => {
    mockRpgState.farming_drone.battery = 30;

    const res = await farmingDroneEngine.rechargeDrone("test_drone_user", "fuel");
    assert.equal(res.ok, true);
    assert.equal(res.newBattery, 70); // 30 + 40
    assert.equal(mockRpgState.farming_drone.battery, 70);
  });

  it("repairDrone harus memperbaiki durabilitas ke 220 dan mengalirkan dana ke ServerTreasury", async () => {
    mockRpgState.farming_drone.durability = 100;

    const res = await farmingDroneEngine.repairDrone("test_drone_user");
    assert.equal(res.ok, true);
    assert.equal(res.newDurability, 220);
    assert.equal(res.cost, 150);
    assert.equal(allocatedSink, 150);
    assert.equal(mockRpgState.farming_drone.durability, 220);
  });

  it("harus menolak operasi bila drone rusak (durabilitas 0)", async () => {
    mockRpgState.farming_drone.durability = 0;

    const waterRes = await farmingDroneEngine.autoWater("test_drone_user");
    assert.equal(waterRes.ok, false);
    assert.equal(waterRes.reason, "DRONE_BROKEN");

    const harvestRes = await farmingDroneEngine.autoHarvest("test_drone_user");
    assert.equal(harvestRes.ok, false);
    assert.equal(harvestRes.reason, "DRONE_BROKEN");
  });

  it("harus menolak operasi bila baterai habis", async () => {
    mockRpgState.farming_drone.battery = 2;

    const waterRes = await farmingDroneEngine.autoWater("test_drone_user");
    assert.equal(waterRes.ok, false);
    assert.equal(waterRes.reason, "BATTERY_DEPLETED");
  });
});
