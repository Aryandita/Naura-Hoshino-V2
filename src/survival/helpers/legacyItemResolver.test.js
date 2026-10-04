"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  resolveLegacyItemId,
  remapInventory,
  LEGACY_ID_MAP,
  RETIRED_COMPENSATION,
} = require("./legacyItemResolver");

test("legacyItemResolver - Resolving Canonical IDs", () => {
  assert.ok(Object.keys(LEGACY_ID_MAP).length > 20);
  assert.ok(Object.keys(RETIRED_COMPENSATION).length > 0);

  const result = resolveLegacyItemId("wooden_sword");
  assert.equal(result.id, "wooden_sword");
  assert.equal(result.isNew, false);
  assert.equal(result.compensationNsf, 0);
});

test("legacyItemResolver - Remapping Legacy IDs to Canonical IDs", () => {
  const swordResult = resolveLegacyItemId("wood_sword");
  assert.equal(swordResult.id, "wooden_sword");
  assert.equal(swordResult.isNew, true);

  const oreResult = resolveLegacyItemId("copper");
  assert.equal(oreResult.id, "copper_ore");
  assert.equal(oreResult.isNew, true);

  const potionResult = resolveLegacyItemId("health_potion");
  assert.equal(potionResult.id, "herbal_salve");
  assert.equal(potionResult.isNew, true);
});

test("legacyItemResolver - Retiring Obsolete Items with NSF Compensation", () => {
  const retired = resolveLegacyItemId("laptop_gaming");
  assert.equal(retired.id, null);
  assert.equal(retired.compensationNsf, 15000);
  assert.equal(retired.retiredName, "Laptop Gaming Antik");
});

test("legacyItemResolver - Whole Inventory Remapping & Consolidation", () => {
  const mockOldInventory = [
    { id: "wood", amount: 5 },
    { id: "raw_wood", amount: 3 }, // maps to oak_wood, should consolidate 5 + 3 = 8
    { id: "wooden_sword", amount: 1 },
    { id: "laptop_gaming", amount: 1 }, // retired: 15,000 NSF
    { id: "unknown_scrap_xxx", amount: 2 }, // fallback: 100 * 2 = 200 NSF
  ];

  const result = remapInventory(mockOldInventory);
  assert.equal(result.totalCompensationNsf, 15200);
  assert.equal(result.retiredCount, 3);
  assert.equal(result.migratedItems, 8); // 5 + 3 wood

  const oakWood = result.inventory.find((i) => i.id === "oak_wood");
  assert.ok(oakWood);
  assert.equal(oakWood.amount, 8);

  const sword = result.inventory.find((i) => i.id === "wooden_sword");
  assert.ok(sword);
  assert.equal(sword.amount, 1);

  // Retired items should not be in the inventory array
  assert.equal(result.inventory.some((i) => i.id === "laptop_gaming"), false);
});
