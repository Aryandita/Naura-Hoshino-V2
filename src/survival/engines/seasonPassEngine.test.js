"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  MAX_PASS_TIER,
  BASE_TIER_XP,
  TIER_XP_INCREMENT,
  getXpForTier,
  getTotalXpForTier,
  calculatePassProgress,
  getTierRewards,
  evaluateTierClaim,
} = require("./seasonPassEngine");

test("SeasonPassEngine - getXpForTier menghitung batas XP per tier dengan benar", () => {
  assert.equal(getXpForTier(1), BASE_TIER_XP);
  assert.equal(getXpForTier(2), BASE_TIER_XP + TIER_XP_INCREMENT);
  assert.equal(getXpForTier(10), BASE_TIER_XP + 9 * TIER_XP_INCREMENT);
});

test("SeasonPassEngine - getTotalXpForTier mengakumulasikan XP secara presisi", () => {
  assert.equal(getTotalXpForTier(1), 0);
  assert.equal(getTotalXpForTier(2), getXpForTier(1));
  assert.equal(getTotalXpForTier(3), getXpForTier(1) + getXpForTier(2));
});

test("SeasonPassEngine - calculatePassProgress menghitung tier saat ini dan persentase", () => {
  // 0 XP -> Tier 1, 0%
  const p0 = calculatePassProgress(0);
  assert.equal(p0.tier, 1);
  assert.equal(p0.currentTierXp, 0);
  assert.equal(p0.progressPercent, 0);
  assert.equal(p0.isMaxTier, false);

  // Setengah Tier 1 (250 XP dari 500 XP) -> Tier 1, 50%
  const pHalf = calculatePassProgress(250);
  assert.equal(pHalf.tier, 1);
  assert.equal(pHalf.currentTierXp, 250);
  assert.equal(pHalf.progressPercent, 50);

  // 500 XP -> Tier 2, 0%
  const pT2 = calculatePassProgress(500);
  assert.equal(pT2.tier, 2);
  assert.equal(pT2.currentTierXp, 0);
  assert.equal(pT2.progressPercent, 0);

  // XP sangat besar -> Cap di MAX_PASS_TIER (50)
  const pMax = calculatePassProgress(99999999);
  assert.equal(pMax.tier, MAX_PASS_TIER);
  assert.equal(pMax.isMaxTier, true);
  assert.equal(pMax.progressPercent, 100);
});

test("SeasonPassEngine - getTierRewards memberikan daftar hadiah deterministik", () => {
  const r1 = getTierRewards(1);
  assert.ok(r1.free.length > 0);
  assert.ok(r1.premium.length > 0);

  const r10 = getTierRewards(10);
  // Kelipatan 10 memberi coupon gratis
  const freeCoupon = r10.free.find((r) => r.type === "coupons");
  assert.ok(freeCoupon);

  const r50 = getTierRewards(50);
  // Tier 50 memberi title eksklusif di premium
  const premTitle = r50.premium.find((r) => r.type === "title");
  assert.ok(premTitle);
});

test("SeasonPassEngine - evaluateTierClaim menolak tier yang belum terbuka", () => {
  const result = evaluateTierClaim({
    playerTotalXp: 200, // masih tier 1
    targetTier: 5,
    track: "free",
  });
  assert.equal(result.ok, false);
  assert.match(result.error, /belum terbuka/);
});

test("SeasonPassEngine - evaluateTierClaim menolak jalur premium bila tidak memiliki pass", () => {
  const result = evaluateTierClaim({
    playerTotalXp: 10000,
    targetTier: 2,
    track: "premium",
    hasPremiumPass: false,
  });
  assert.equal(result.ok, false);
  assert.match(result.error, /Jalur Premium terkunci/);
});

test("SeasonPassEngine - evaluateTierClaim menolak klaim berulang (duplicate claim)", () => {
  const result = evaluateTierClaim({
    playerTotalXp: 10000,
    targetTier: 1,
    track: "free",
    claimedTiers: ["free_1"],
  });
  assert.equal(result.ok, false);
  assert.match(result.error, /sudah pernah diklaim/);
});

test("SeasonPassEngine - evaluateTierClaim berhasil mengklaim hadiah dan memperbarui daftar klaim", () => {
  const result = evaluateTierClaim({
    playerTotalXp: 10000,
    targetTier: 3,
    track: "free",
    claimedTiers: ["free_1", "free_2"],
  });
  assert.equal(result.ok, true);
  assert.ok(result.rewards.length > 0);
  assert.ok(result.updatedClaims.includes("free_3"));
});
