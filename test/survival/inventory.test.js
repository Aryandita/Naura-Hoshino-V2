"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  safeParseInventory,
  findItem,
  hasItem,
  removeItem,
  addOrStackItem,
  countStack,
  takeStack,
} = require("../../src/survival/engines/inventoryHelper");

test.describe("InventoryHelper - safeParseInventory()", () => {
  test("should return array as-is", () => {
    const input = [{ id: "sword", amount: 1 }];
    const result = safeParseInventory(input);
    assert.deepEqual(result, input);
  });

  test("should return empty array for null", () => {
    const result = safeParseInventory(null);
    assert.deepEqual(result, []);
  });

  test("should return empty array for undefined", () => {
    const result = safeParseInventory(undefined);
    assert.deepEqual(result, []);
  });

  test("should parse valid JSON string", () => {
    const input = '[{"id":"potion","amount":5}]';
    const result = safeParseInventory(input);
    assert.equal(result.length, 1);
    assert.equal(result[0].id, "potion");
    assert.equal(result[0].amount, 5);
  });

  test("should return empty array for invalid JSON string", () => {
    const result = safeParseInventory("not valid json");
    assert.deepEqual(result, []);
  });

  test("should return empty array for non-array JSON", () => {
    const result = safeParseInventory('{"id":"item"}');
    assert.deepEqual(result, []);
  });

  test("should return empty array for number", () => {
    const result = safeParseInventory(123);
    assert.deepEqual(result, []);
  });

  test("should return empty array for object", () => {
    const result = safeParseInventory({ id: "item" });
    assert.deepEqual(result, []);
  });
});

test.describe("InventoryHelper - findItem()", () => {
  test("should find existing item", () => {
    const inv = [
      { id: "sword", name: "Pedang", amount: 1 },
      { id: "shield", name: "Perisai", amount: 1 },
    ];
    const item = findItem(inv, "sword");
    assert.ok(item);
    assert.equal(item.id, "sword");
    assert.equal(item.name, "Pedang");
  });

  test("should return undefined for missing item", () => {
    const inv = [{ id: "sword", name: "Pedang", amount: 1 }];
    const item = findItem(inv, "potion");
    assert.equal(item, undefined);
  });

  test("should handle empty inventory", () => {
    const item = findItem([], "sword");
    assert.equal(item, undefined);
  });

  test("should skip null entries", () => {
    const inv = [null, { id: "sword", amount: 1 }, null];
    const item = findItem(inv, "sword");
    assert.ok(item);
    assert.equal(item.id, "sword");
  });
});

test.describe("InventoryHelper - hasItem()", () => {
  test("should return true for existing item", () => {
    const inv = [{ id: "sword", amount: 1 }];
    assert.ok(hasItem(inv, "sword"));
  });

  test("should return false for missing item", () => {
    const inv = [{ id: "sword", amount: 1 }];
    assert.ok(!hasItem(inv, "potion"));
  });

  test("should return false for empty inventory", () => {
    assert.ok(!hasItem([], "sword"));
  });
});

test.describe("InventoryHelper - removeItem()", () => {
  test("should remove single item", () => {
    const inv = [
      { id: "sword", amount: 1 },
      { id: "potion", amount: 5 },
    ];
    const result = removeItem(inv, "sword");
    assert.equal(result.length, 1);
    assert.equal(result[0].id, "potion");
  });

  test("should remove multiple items by amount", () => {
    const inv = [
      { id: "potion", amount: 1 },
      { id: "potion", amount: 1 },
      { id: "potion", amount: 1 },
    ];
    const result = removeItem(inv, "potion", 2);
    assert.equal(result.length, 1);
  });

  test("should not modify original array", () => {
    const inv = [{ id: "sword", amount: 1 }];
    const result = removeItem(inv, "sword");
    assert.equal(inv.length, 1);
    assert.equal(result.length, 0);
  });

  test("should handle removing non-existent item", () => {
    const inv = [{ id: "sword", amount: 1 }];
    const result = removeItem(inv, "potion");
    assert.equal(result.length, 1);
  });

  test("should handle empty inventory", () => {
    const result = removeItem([], "sword");
    assert.deepEqual(result, []);
  });
});

test.describe("InventoryHelper - addOrStackItem()", () => {
  test("should add new item to inventory", () => {
    const inv = [{ id: "sword", amount: 1 }];
    const newItem = { id: "potion", name: "Ramuan", amount: 5 };
    const result = addOrStackItem(inv, newItem);
    assert.equal(result.length, 2);
    assert.ok(result.some((i) => i.id === "potion"));
  });

  test("should stack existing item", () => {
    const inv = [{ id: "potion", amount: 3 }];
    const newItem = { id: "potion", amount: 2 };
    const result = addOrStackItem(inv, newItem);
    assert.equal(result.length, 1);
    assert.equal(result[0].amount, 5);
  });

  test("should default amount to 1", () => {
    const inv = [];
    const newItem = { id: "herb" };
    const result = addOrStackItem(inv, newItem);
    assert.equal(result.length, 1);
  });

  test("should stack with default amounts", () => {
    const inv = [{ id: "herb", amount: 1 }];
    const newItem = { id: "herb" };
    const result = addOrStackItem(inv, newItem);
    assert.equal(result[0].amount, 2);
  });

  test("should not modify original array when adding new item", () => {
    const inv = [{ id: "sword", amount: 1 }];
    const newItem = { id: "potion", amount: 1 };
    const result = addOrStackItem(inv, newItem);
    assert.equal(inv.length, 1);
    assert.equal(result.length, 2);
  });
});

test.describe("InventoryHelper - countStack()", () => {
  test("should count total amount across stacks", () => {
    const inv = [
      { id: "potion", amount: 5 },
      { id: "potion", amount: 3 },
      { id: "sword", amount: 1 },
    ];
    assert.equal(countStack(inv, "potion"), 8);
  });

  test("should return 0 for missing item", () => {
    const inv = [{ id: "sword", amount: 1 }];
    assert.equal(countStack(inv, "potion"), 0);
  });

  test("should handle items without amount field", () => {
    const inv = [{ id: "herb" }, { id: "herb", amount: 3 }];
    assert.equal(countStack(inv, "herb"), 4);
  });

  test("should handle empty inventory", () => {
    assert.equal(countStack([], "potion"), 0);
  });

  test("should parse string inventory", () => {
    const inv = '[{"id":"potion","amount":5}]';
    assert.equal(countStack(inv, "potion"), 5);
  });
});

test.describe("InventoryHelper - takeStack()", () => {
  test("should take exact amount from single stack", () => {
    const inv = [{ id: "potion", amount: 10 }];
    const result = takeStack(inv, "potion", 5);
    assert.ok(result);
    assert.equal(result.length, 1);
    assert.equal(result[0].amount, 5);
  });

  test("should take from multiple stacks", () => {
    const inv = [
      { id: "potion", amount: 3 },
      { id: "potion", amount: 5 },
    ];
    const result = takeStack(inv, "potion", 5);
    assert.ok(result);
    const totalLeft = result.reduce((sum, i) => sum + (i.amount || 1), 0);
    assert.equal(totalLeft, 3);
  });

  test("should return null if insufficient", () => {
    const inv = [{ id: "potion", amount: 3 }];
    const result = takeStack(inv, "potion", 5);
    assert.equal(result, null);
  });

  test("should take all if exact amount", () => {
    const inv = [{ id: "potion", amount: 5 }];
    const result = takeStack(inv, "potion", 5);
    assert.ok(result);
    assert.equal(result.length, 0);
  });

  test("should preserve other items", () => {
    const inv = [
      { id: "sword", amount: 1 },
      { id: "potion", amount: 10 },
      { id: "shield", amount: 1 },
    ];
    const result = takeStack(inv, "potion", 5);
    assert.ok(result);
    assert.ok(result.some((i) => i.id === "sword"));
    assert.ok(result.some((i) => i.id === "shield"));
  });

  test("should handle taking 0 or negative as 1", () => {
    const inv = [{ id: "potion", amount: 10 }];
    const result = takeStack(inv, "potion", 0);
    assert.ok(result);
    assert.equal(result[0].amount, 9);
  });

  test("should return null for missing item", () => {
    const inv = [{ id: "sword", amount: 1 }];
    const result = takeStack(inv, "potion", 1);
    assert.equal(result, null);
  });
});

test.describe("InventoryHelper - Integration Scenarios", () => {
  test("add then remove should restore original state", () => {
    let inv = [{ id: "sword", amount: 1 }];
    inv = addOrStackItem(inv, { id: "potion", amount: 5 });
    assert.equal(inv.length, 2);

    inv = removeItem(inv, "potion");
    assert.equal(inv.length, 1);
    assert.equal(inv[0].id, "sword");
  });

  test("stacking multiple times should accumulate", () => {
    let inv = [];
    inv = addOrStackItem(inv, { id: "herb", amount: 1 });
    inv = addOrStackItem(inv, { id: "herb", amount: 2 });
    inv = addOrStackItem(inv, { id: "herb", amount: 3 });
    assert.equal(inv.length, 1);
    assert.equal(inv[0].amount, 6);
  });

  test("takeStack should work after addOrStackItem", () => {
    let inv = [];
    inv = addOrStackItem(inv, { id: "potion", amount: 10 });
    const result = takeStack(inv, "potion", 4);
    assert.ok(result);
    assert.equal(result[0].amount, 6);
  });

  test("complex inventory operations", () => {
    let inv = [
      { id: "sword", amount: 1 },
      { id: "potion", amount: 5 },
    ];

    inv = addOrStackItem(inv, { id: "shield", amount: 1 });
    assert.equal(inv.length, 3);

    inv = addOrStackItem(inv, { id: "potion", amount: 3 });
    assert.equal(inv.length, 3);
    assert.equal(countStack(inv, "potion"), 8);

    inv = takeStack(inv, "potion", 4);
    assert.ok(inv);
    assert.equal(countStack(inv, "potion"), 4);

    inv = removeItem(inv, "sword");
    assert.equal(inv.length, 2);
    assert.ok(!hasItem(inv, "sword"));
  });
});

test.describe("InventoryHelper - Edge Cases", () => {
  test("should handle items with null id", () => {
    const inv = [{ id: null, amount: 1 }, { id: "sword", amount: 1 }];
    assert.ok(hasItem(inv, "sword"));
  });

  test("should handle very large amounts", () => {
    const inv = [{ id: "gold", amount: 999999999 }];
    assert.equal(countStack(inv, "gold"), 999999999);
  });

  test("should handle zero amount items", () => {
    const inv = [{ id: "empty_bottle", amount: 0 }];
    assert.equal(countStack(inv, "empty_bottle"), 1);
  });

  test("removeItem with amount larger than available", () => {
    const inv = [
      { id: "potion", amount: 1 },
      { id: "potion", amount: 1 },
    ];
    const result = removeItem(inv, "potion", 10);
    assert.equal(result.length, 0);
  });
});
