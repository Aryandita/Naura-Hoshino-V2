"use strict";

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");

const UserNPC = require("../../models/UserNPC");
const {
  RELATIONSHIP_TITLES,
  getNpcRelationship,
  calculateDiscount,
  applyPassiveBonus,
  getUserActivePerksSummary,
} = require("./npcPerksEngine");

let origFindOne;
let origFindAll;

before(() => {
  origFindOne = UserNPC.findOne;
  origFindAll = UserNPC.findAll;
});

after(() => {
  UserNPC.findOne = origFindOne;
  UserNPC.findAll = origFindAll;
});

test("RELATIONSHIP_TITLES memiliki 5 tingkatan hubungan resmi", () => {
  assert.equal(RELATIONSHIP_TITLES.length, 5);
  assert.equal(RELATIONSHIP_TITLES[0], "Kenalan");
  assert.equal(RELATIONSHIP_TITLES[4], "Pasangan Hidup");
});

test("getNpcRelationship mengembalikan status hubungan pemain dengan NPC", async () => {
  UserNPC.findOne = async () => ({
    relationshipLevel: 1,
    affection: 120,
  });
  const rel = await getNpcRelationship("dummy_user_0", "ningsih");
  assert.equal(rel.level, 1);
  assert.equal(rel.title, "Teman");
  assert.equal(rel.isMarried, false);
});

test("calculateDiscount menghitung harga diskon berdasarkan level hubungan", async () => {
  // Mock level 0 (Kenalan) -> Diskon 0%
  UserNPC.findOne = async () => null;
  const noDiscount = await calculateDiscount("dummy_user_0", "mbak_siti", 1000);
  assert.equal(noDiscount.discountPercent, 0);
  assert.equal(noDiscount.discountedPrice, 1000);
  assert.equal(noDiscount.savedAmount, 0);

  // Mock level 2 (Sahabat) -> Diskon 15%
  UserNPC.findOne = async () => ({
    relationshipLevel: 2,
    affection: 350,
  });
  const sahabatDiscount = await calculateDiscount(
    "dummy_user_0",
    "mbak_siti",
    1000,
  );
  assert.equal(sahabatDiscount.discountPercent, 15);
  assert.equal(sahabatDiscount.discountedPrice, 850);
  assert.equal(sahabatDiscount.savedAmount, 150);

  // Mock level 4 (Pasangan) -> Diskon 25%
  UserNPC.findOne = async () => ({
    relationshipLevel: 4,
    affection: 500,
  });
  const spouseDiscount = await calculateDiscount(
    "dummy_user_0",
    "mbak_siti",
    1000,
  );
  assert.equal(spouseDiscount.discountPercent, 25);
  assert.equal(spouseDiscount.discountedPrice, 750);
  assert.equal(spouseDiscount.savedAmount, 250);
});

test("applyPassiveBonus menerapkan bonus pasif relasi secara tepat", async () => {
  // Mock persahabatan aktif: Bagas Level 3 (-25% durability loss), Kang Deden Level 2 (+20% mining)
  UserNPC.findAll = async () => [
    { npcId: "bagas", relationshipLevel: 3 },
    { npcId: "kang_deden", relationshipLevel: 2 },
  ];

  const durability = await applyPassiveBonus(
    "dummy_user_0",
    "durability_loss",
    100,
  );
  assert.equal(durability, 75); // 100 * 0.75 = 75

  const mining = await applyPassiveBonus("dummy_user_0", "mining_ore", 10);
  assert.equal(mining, 12); // 10 * 1.2 = 12
});

test("getUserActivePerksSummary merangkum seluruh keuntungan aktif", async () => {
  UserNPC.findAll = async () => [
    { npcId: "wulan", relationshipLevel: 4 },
    { npcId: "laras", relationshipLevel: 2 },
  ];

  const perks = await getUserActivePerksSummary("dummy_user_0");
  assert.ok(Array.isArray(perks));
  assert.equal(perks.length, 2);
  assert.ok(perks.some((p) => p.npcName.includes("Wulan")));
  assert.ok(perks.some((p) => p.npcName.includes("Laras")));
});
