"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { AVAILABLE_TOYS } = require("./petHabitatEngine");

test("PetHabitatEngine - Available Toys and Structure", () => {
  assert.ok(Array.isArray(AVAILABLE_TOYS), "AVAILABLE_TOYS harus berupa array");
  assert.equal(AVAILABLE_TOYS.length, 3, "Harus ada 3 jenis mainan");

  const laser = AVAILABLE_TOYS.find((t) => t.id === "laser_pointer");
  assert.ok(laser, "Harus ada laser pointer");
  assert.equal(laser.moodBoost, "energized");

  const boba = AVAILABLE_TOYS.find((t) => t.id === "catnip_circuit");
  assert.ok(boba, "Harus ada catnip circuit");
  assert.equal(boba.moodBoost, "ascended");
});
