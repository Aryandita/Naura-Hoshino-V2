"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");

const { GIFT_TIERS, evaluateGift } = require("./npcGiftPreferences");

test("GIFT_TIERS memiliki skala poin afeksi yang benar (-5 hingga +25)", () => {
  assert.equal(GIFT_TIERS.DISLIKED.rp, -5);
  assert.equal(GIFT_TIERS.SIMPLE.rp, 5);
  assert.equal(GIFT_TIERS.SPECIAL.rp, 10);
  assert.equal(GIFT_TIERS.LOVED.rp, 15);
  assert.equal(GIFT_TIERS.MYTHIC.rp, 25);
});

test("evaluateGift memberikan Loved (+15) untuk item kesukaan Ningsih", () => {
  const reaction = evaluateGift("ningsih", "celestial_seed");
  assert.equal(reaction.tier, "loved");
  assert.equal(reaction.rp, 15);
  assert.ok(reaction.quote.length > 0);
});

test("evaluateGift memberikan penolakan Disliked (-5) untuk item sampah atau yang dibenci Ningsih", () => {
  const reaction = evaluateGift("ningsih", "trash");
  assert.equal(reaction.tier, "disliked");
  assert.equal(reaction.rp, -5);
  assert.ok(reaction.quote.length > 0);
});

test("evaluateGift memberikan Mythic (+25) untuk item relik Istana Draken / Khul'Khas", () => {
  const reaction = evaluateGift("wulan", "draken_dragon_tear");
  assert.equal(reaction.tier, "mythic");
  assert.equal(reaction.rp, 25);
  assert.ok(reaction.quote.length > 0);
});

test("evaluateGift memberikan default Simple (+5) untuk item biasa lainnya", () => {
  const reaction = evaluateGift("ningsih", "item_acak_yang_wajar");
  assert.equal(reaction.tier, "simple");
  assert.equal(reaction.rp, 5);
  assert.ok(reaction.quote.length > 0);
});

test("evaluateGift menangani NPC tak dikenal dengan respon umum", () => {
  const reaction = evaluateGift("npc_fiktif_123", "apel");
  assert.equal(reaction.tier, "simple");
  assert.equal(reaction.rp, 5);
});
