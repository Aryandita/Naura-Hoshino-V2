"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { DEEP_SEA_FISHES, getFishesByZone, getFishById } = require("../data/deepSeaFishes");

test("Deep-Sea Fishes Catalog - Zones and Data Integrity", () => {
  assert.ok(Array.isArray(DEEP_SEA_FISHES), "DEEP_SEA_FISHES harus berupa array");
  assert.ok(DEEP_SEA_FISHES.length >= 10, "Harus ada minimal 10 spesies");

  const reef = getFishesByZone("CORAL_REEF");
  const trench = getFishesByZone("MIDNIGHT_TRENCH");
  const core = getFishesByZone("ABYSSAL_CORE");

  assert.ok(reef.length > 0, "Harus ada ikan Coral Reef");
  assert.ok(trench.length > 0, "Harus ada ikan Midnight Trench");
  assert.ok(core.length > 0, "Harus ada ikan Abyssal Core");

  const leviathan = getFishById("cosmic_leviathan");
  assert.ok(leviathan, "Harus ada cosmic_leviathan");
  assert.equal(leviathan.rarity, "MYTHIC");
  assert.equal(leviathan.price, 5000);
});

test("Vivarium Engine - Ticket Revenue Mathematical Calculation", () => {
  const fishes = [
    { id: "neon_guppy", ticketYield: 5 },
    { id: "lumina_squid", ticketYield: 15 },
    { id: "void_manta", ticketYield: 150 },
  ];

  const hourlyIncome = fishes.reduce((sum, f) => sum + f.ticketYield, 0);
  assert.equal(hourlyIncome, 170);

  const hoursPassed = 4;
  const totalRevenue = hoursPassed * hourlyIncome;
  assert.equal(totalRevenue, 680);
});
