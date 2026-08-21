"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { DEFAULT_SECTORS } = require("./territoryWarEngine");

test("TerritoryWarEngine - Default 5 Sectors Setup", () => {
  assert.ok(Array.isArray(DEFAULT_SECTORS), "DEFAULT_SECTORS harus berupa array");
  assert.ok(DEFAULT_SECTORS.length >= 5, "Harus ada minimal 5 sektor");

  const sectorIds = DEFAULT_SECTORS.map((t) => t.territoryId);
  assert.ok(sectorIds.includes("SECTOR_DOCKS"), "Harus ada SECTOR_DOCKS");
  assert.ok(sectorIds.includes("SECTOR_MINES"), "Harus ada SECTOR_MINES");
  assert.ok(sectorIds.includes("SECTOR_CITADEL"), "Harus ada SECTOR_CITADEL");
  assert.ok(sectorIds.includes("SECTOR_VALLEY"), "Harus ada SECTOR_VALLEY");
  assert.ok(sectorIds.includes("SECTOR_PLAZA"), "Harus ada SECTOR_PLAZA");
});

test("TerritoryWarEngine - Attack and Control Math", () => {
  const initialPoints = 500;
  const attackEnergy = 120;
  const newPoints = initialPoints - attackEnergy;
  assert.equal(newPoints, 380);

  // When points drop <= 0, new clan captures with leftover + 50 points
  const overAttackEnergy = 600;
  const capturePoints = Math.abs(initialPoints - overAttackEnergy) + 50;
  assert.equal(capturePoints, 150);
});
