"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  getXpMultiplier,
  getMinigameMultiplier,
  getWorkWageBonus,
  getMaxPlaylists,
  getDurabilityDiscount,
  getMarketTaxDiscount,
  getCooldownReduction,
  getMaxEnergy,
  getDailyStipend,
  getCustomPersona,
} = require("./premiumHelper");

test("PremiumHelper - Multipliers & Bonuses per Tier", () => {
  // XP Multipliers
  assert.equal(getXpMultiplier("vip"), 2.0);
  assert.equal(getXpMultiplier("friends"), 1.75);
  assert.equal(getXpMultiplier("supporter"), 1.5);
  assert.equal(getXpMultiplier("starter"), 1.25);
  assert.equal(getXpMultiplier("voter"), 1.15);
  assert.equal(getXpMultiplier("none"), 1.0);

  // Minigame Multipliers
  assert.equal(getMinigameMultiplier("vip"), 2.0);
  assert.equal(getMinigameMultiplier("friends"), 1.5);
  assert.equal(getMinigameMultiplier("supporter"), 1.25);
  assert.equal(getMinigameMultiplier("none"), 1.0);

  // Work Wage Bonus
  assert.equal(getWorkWageBonus("vip"), 1.0); // +100%
  assert.equal(getWorkWageBonus("friends"), 0.5); // +50%
  assert.equal(getWorkWageBonus("supporter"), 0.25); // +25%
  assert.equal(getWorkWageBonus("starter"), 0.15); // +15%
  assert.equal(getWorkWageBonus("voter"), 0.1); // +10%
  assert.equal(getWorkWageBonus("none"), 0.0);

  // Max Playlists
  assert.equal(getMaxPlaylists("vip"), Infinity);
  assert.equal(getMaxPlaylists("friends"), Infinity);
  assert.equal(getMaxPlaylists("supporter"), 10);
  assert.equal(getMaxPlaylists("starter"), 5);
  assert.equal(getMaxPlaylists("none"), 3);
});

test("PremiumHelper - Durability Shield & Tax Haven", () => {
  // Durability Shield (15% to 50% slower wear)
  assert.equal(getDurabilityDiscount("vip"), 0.5);
  assert.equal(getDurabilityDiscount("friends"), 0.4);
  assert.equal(getDurabilityDiscount("supporter"), 0.3);
  assert.equal(getDurabilityDiscount("starter"), 0.15);
  assert.equal(getDurabilityDiscount("none"), 0.0);

  // Tax Haven (25% to 50% discount on Market Tax)
  assert.equal(getMarketTaxDiscount("vip"), 0.5);
  assert.equal(getMarketTaxDiscount("friends"), 0.5);
  assert.equal(getMarketTaxDiscount("supporter"), 0.5);
  assert.equal(getMarketTaxDiscount("starter"), 0.25);
  assert.equal(getMarketTaxDiscount("none"), 0.0);
});

test("PremiumHelper - Cooldown Rush & Max Energy Cap", () => {
  // Cooldown Reduction
  assert.equal(getCooldownReduction("vip"), 0.4); // 40%
  assert.equal(getCooldownReduction("friends"), 0.3); // 30%
  assert.equal(getCooldownReduction("supporter"), 0.2); // 20%
  assert.equal(getCooldownReduction("starter"), 0.1); // 10%
  assert.equal(getCooldownReduction("none"), 0.0);

  // Max Energy Cap (Normal is 100, VIP expands to 150)
  assert.equal(getMaxEnergy("vip"), 150);
  assert.equal(getMaxEnergy("friends"), 135);
  assert.equal(getMaxEnergy("supporter"), 125);
  assert.equal(getMaxEnergy("starter"), 115);
  assert.equal(getMaxEnergy("none"), 100);
});

test("PremiumHelper - Daily Stipend Package (/premium claim)", () => {
  const vipStipend = getDailyStipend("vip");
  assert.ok(vipStipend);
  assert.equal(vipStipend.coupons, 3);
  assert.equal(vipStipend.nsf, 2000);
  assert.equal(vipStipend.mysteryBox, "legendary_relic_box");
  assert.equal(vipStipend.dungeonKeys, 2);

  const friendsStipend = getDailyStipend("friends");
  assert.ok(friendsStipend);
  assert.equal(friendsStipend.coupons, 2);
  assert.equal(friendsStipend.nsf, 800);
  assert.equal(friendsStipend.mysteryBox, "rare_mystery_box");

  const supporterStipend = getDailyStipend("supporter");
  assert.ok(supporterStipend);
  assert.equal(supporterStipend.coupons, 1);
  assert.equal(supporterStipend.nsf, 350);

  const starterStipend = getDailyStipend("starter");
  assert.ok(starterStipend);
  assert.equal(starterStipend.coupons, 0);
  assert.equal(starterStipend.nsf, 150);

  assert.equal(getDailyStipend("voter"), null);
  assert.equal(getDailyStipend("none"), null);
});

test("PremiumHelper - Custom AI Persona Tuning", () => {
  assert.equal(getCustomPersona(null), "default");
  assert.equal(getCustomPersona({ isPremium: false }), "default");
  assert.equal(
    getCustomPersona({ isPremium: true, customPersona: "tsundere" }),
    "tsundere",
  );
});
