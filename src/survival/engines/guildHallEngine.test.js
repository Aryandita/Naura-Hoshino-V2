"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { FURNITURE_CATALOG } = require("./guildHallEngine");

test("GuildHallEngine - Furniture Catalog Data Integrity", () => {
  assert.ok(Array.isArray(FURNITURE_CATALOG), "FURNITURE_CATALOG harus berupa array");
  assert.ok(FURNITURE_CATALOG.length >= 5, "Harus ada minimal 5 furnitur");

  for (const item of FURNITURE_CATALOG) {
    assert.ok(item.id, "Harus ada id");
    assert.ok(item.name, "Harus ada nama");
    assert.ok(item.cost > 0, "Harga harus > 0");
    assert.ok(item.emoji, "Harus ada emoji");
    assert.ok(item.desc, "Harus ada deskripsi");
  }

  const coffee = FURNITURE_CATALOG.find((f) => f.id === "coffee_maker");
  assert.ok(coffee, "Harus ada coffee maker");
  assert.equal(coffee.cost, 3000);
});
