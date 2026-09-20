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

test("PetHabitatEngine - breedPets validasi afeksi dan perkawinan silang", async () => {
  const PetHabitatEngine = require("./petHabitatEngine");
  const UserPet = require("../../models/UserPet");
  const origFindOne = UserPet.findOne;
  const origCreate = UserPet.create;

  // Mock pet dengan afeksi rendah (< 100)
  UserPet.findOne = async ({ where }) => {
    if (where.id === 1) return { id: 1, petType: "wolf", affection: 50, save: async () => {} };
    if (where.id === 2) return { id: 2, petType: "cat", affection: 80, save: async () => {} };
    return null;
  };

  try {
    const lowAffectionRes = await PetHabitatEngine.breedPets("u1", 1, 2);
    assert.equal(lowAffectionRes.success, false);
    assert.equal(lowAffectionRes.reason, "AFFECTION_TOO_LOW");

    // Mock pet dengan afeksi maksimal (100)
    UserPet.findOne = async ({ where }) => {
      if (where.id === 1) return { id: 1, petType: "wolf", affection: 100, save: async () => {} };
      if (where.id === 2) return { id: 2, petType: "cat", affection: 100, save: async () => {} };
      return null;
    };

    UserPet.create = async (payload) => ({
      id: 99,
      ...payload,
      toJSON: () => ({ id: 99, ...payload }),
    });

    const successRes = await PetHabitatEngine.breedPets("u1", 1, 2);
    assert.equal(successRes.success, true);
    assert.equal(successRes.offspring.petType, "hybrid_wolf_cat");
    assert.equal(successRes.offspring.isTamed, true);
  } finally {
    UserPet.findOne = origFindOne;
    UserPet.create = origCreate;
  }
});
