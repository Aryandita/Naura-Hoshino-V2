"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const currencyHelper = require("./currency");
const durabilityEngine = require("./durabilityEngine");

test("Currency V2: One-Way Bridge & Dynamic Spread", async (t) => {
  await t.test(
    "convert() menolak penukaran COIN ke FRAGMENT (One-Way Bridge)",
    () => {
      const result = currencyHelper.convert(
        10,
        currencyHelper.COIN,
        currencyHelper.FRAGMENT,
      );
      assert.strictEqual(
        result,
        null,
        "Penukaran Coin ke NSF harus diblokir (null)",
      );
    },
  );

  await t.test("convert() mengizinkan penukaran FRAGMENT ke COIN", () => {
    const result = currencyHelper.convert(
      2500,
      currencyHelper.FRAGMENT,
      currencyHelper.COIN,
    );
    assert.strictEqual(result, 2, "2500 NSF harus bernilai 2 Coin");
  });

  await t.test(
    "exchange() menolak penukaran COIN ke FRAGMENT dengan alasan one_way_restricted",
    async () => {
      const mockHolders = {
        profile: { userId: "test_user_1", economy_wallet: 100 },
        survival: { userId: "test_user_1", starFragments: 500 },
      };

      const res = await currencyHelper.exchange(
        mockHolders,
        currencyHelper.COIN,
        currencyHelper.FRAGMENT,
        10,
      );

      assert.strictEqual(res.ok, false);
      assert.strictEqual(res.reason, "one_way_restricted");
    },
  );

  await t.test(
    "getDynamicRateAndFee() menghitung fee progresif dengan tepat",
    async () => {
      const quoteStandard = await currencyHelper.getDynamicRateAndFee(10000);
      assert.strictEqual(
        quoteStandard.feePercent,
        0.05,
        "Biaya standar harus 5%",
      );

      const quoteMedium = await currencyHelper.getDynamicRateAndFee(75000);
      assert.strictEqual(
        quoteMedium.feePercent,
        0.1,
        "Biaya > 50.000 harus 10%",
      );

      const quoteWhale = await currencyHelper.getDynamicRateAndFee(250000);
      assert.strictEqual(
        quoteWhale.feePercent,
        0.15,
        "Biaya > 200.000 harus 15%",
      );
    },
  );
});

test("Currency V2: Closed-Loop 4-Channel Recycling Pool", async (t) => {
  await t.test(
    "Alokasi 100% tepat: 40% Infra, 25% Undian, 20% Subsidi, 15% Pedagang",
    () => {
      const total = 10000;
      const infrastructure = Math.floor(total * 0.4);
      const lottery = Math.floor(total * 0.25);
      const noviceAid = Math.floor(total * 0.2);
      const wanderingMerchant = total - (infrastructure + lottery + noviceAid);

      assert.strictEqual(infrastructure, 4000);
      assert.strictEqual(lottery, 2500);
      assert.strictEqual(noviceAid, 2000);
      assert.strictEqual(wanderingMerchant, 1500);
      assert.strictEqual(
        infrastructure + lottery + noviceAid + wanderingMerchant,
        total,
        "Total alokasi harus persis 100%",
      );
    },
  );
});

test("Currency V2: Durability & Wear & Tear Surcharge", async (t) => {
  await t.test(
    "calculateRepairCost() mengembalikan 0 untuk alat dengan durabilitas penuh",
    () => {
      const itemFull = { id: "wooden_pickaxe", price: 1000, durability: 100 };
      const cost = durabilityEngine.calculateRepairCost(itemFull);
      assert.strictEqual(cost, 0);
    },
  );

  await t.test(
    "calculateRepairCost() menghitung biaya perbaikan dasar dan surcharge keausan",
    () => {
      const itemDamaged = { id: "iron_pickaxe", price: 2000, durability: 50 };
      const costDamaged = durabilityEngine.calculateRepairCost(itemDamaged);
      assert.ok(costDamaged > 0, "Biaya perbaikan harus lebih dari 0");

      const itemSeverelyDamaged = {
        id: "iron_pickaxe",
        price: 2000,
        durability: 10,
      };
      const costSevere =
        durabilityEngine.calculateRepairCost(itemSeverelyDamaged);
      assert.ok(
        costSevere > costDamaged,
        "Biaya kerusakan parah (<20%) harus lebih mahal karena surcharge",
      );
    },
  );

  await t.test(
    "salvageAllDamagedItems() mendaur ulang seluruh item dengan durabilitas 0",
    async () => {
      const cacheManager = require("../../managers/cacheManager");
      const origGetProfile = cacheManager.getUserProfile;
      const origMutate = cacheManager.mutateUserProfileJson;
      const origGetSurvival = cacheManager.getUserSurvival;
      const origIncSurvival = cacheManager.incrementUserSurvival;

      let savedInv = null;
      const initialInv = [
        { id: "pickaxe_1", name: "Beliung Rusak", durability: 0, tier: 1 },
        { id: "axe_1", name: "Kapak Rusak", durability: 0, tier: 2 },
        { id: "sword_fine", name: "Pedang Bagus", durability: 100, tier: 2 },
      ];
      cacheManager.getUserProfile = async () => ({
        inventory: JSON.stringify(initialInv),
      });
      cacheManager.getUserSurvival = async () => ({
        userId: "user_salvage_test",
        starFragments: 500,
      });
      cacheManager.incrementUserSurvival = async () => true;
      cacheManager.mutateUserProfileJson = async (uid, field, updater) => {
        savedInv = updater(initialInv);
        return { ok: true, value: savedInv };
      };

      try {
        const res =
          await durabilityEngine.salvageAllDamagedItems("user_salvage_test");
        assert.strictEqual(res.ok, true);
        assert.strictEqual(res.count, 2);
        assert.ok(res.nsfAwarded > 0);
        assert.strictEqual(
          savedInv.some((it) => it.id === "sword_fine"),
          true,
        );
        assert.strictEqual(
          savedInv.some((it) => it.id === "pickaxe_1"),
          false,
        );
        assert.strictEqual(
          savedInv.some((it) => it.id === "axe_1"),
          false,
        );
        assert.strictEqual(
          savedInv.some((it) => it.id === "copper_ingot"),
          true,
        );
      } finally {
        cacheManager.getUserProfile = origGetProfile;
        cacheManager.mutateUserProfileJson = origMutate;
        cacheManager.getUserSurvival = origGetSurvival;
        cacheManager.incrementUserSurvival = origIncSurvival;
      }
    },
  );
});
