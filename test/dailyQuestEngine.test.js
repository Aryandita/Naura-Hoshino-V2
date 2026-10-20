"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getTierByLevel,
  calculateNewStreak,
  getStreakBonusPercent,
  actionMatches,
  getWeeklyResetString,
  STREAK_MILESTONES,
  STREAK_BONUS_TIERS,
} = require("../src/survival/engines/dailyQuestEngine");

test("DailyQuestEngine - getTierByLevel() scales difficulty properly", () => {
  const t1 = getTierByLevel(1);
  assert.equal(t1.tier, 1);
  assert.equal(t1.name, "Pemula");
  assert.equal(t1.multiplier, 1.0);

  const t2 = getTierByLevel(15);
  assert.equal(t2.tier, 2);
  assert.equal(t2.name, "Petualang");
  assert.equal(t2.multiplier, 1.5);

  const t3 = getTierByLevel(30);
  assert.equal(t3.tier, 3);
  assert.equal(t3.name, "Veteran");
  assert.equal(t3.multiplier, 2.2);

  const t4 = getTierByLevel(45);
  assert.equal(t4.tier, 4);
  assert.equal(t4.name, "Legenda");
  assert.equal(t4.multiplier, 3.0);
  assert.equal(t4.couponChance, 1.0);
});

test("DailyQuestEngine - calculateNewStreak() handles dates and gaps", () => {
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString().split("T")[0];

  // First claim
  const first = calculateNewStreak({ currentStreak: 0, maxStreak: 0 }, null);
  assert.equal(first.currentStreak, 1);

  // Consecutive day
  const next = calculateNewStreak({ currentStreak: 5, maxStreak: 5 }, yesterday);
  assert.equal(next.currentStreak, 6);
  assert.equal(next.maxStreak, 6);

  // Same day
  const same = calculateNewStreak({ currentStreak: 6, maxStreak: 6 }, today);
  assert.equal(same.currentStreak, 6);

  // Missed day
  const reset = calculateNewStreak({ currentStreak: 10, maxStreak: 10 }, twoDaysAgo);
  assert.equal(reset.currentStreak, 1);
  assert.equal(reset.maxStreak, 10);
});

test("DailyQuestEngine - getStreakBonusPercent() matches bonus tiers", () => {
  assert.equal(getStreakBonusPercent(1).bonusPercent, 0);
  assert.equal(getStreakBonusPercent(3).bonusPercent, 25);
  assert.equal(getStreakBonusPercent(7).bonusPercent, 50);
  assert.equal(getStreakBonusPercent(15).bonusPercent, 75);
  assert.equal(getStreakBonusPercent(25).bonusPercent, 100);
});

test("DailyQuestEngine - actionMatches() matches aliases correctly", () => {
  assert.equal(actionMatches("gather", "chop"), true);
  assert.equal(actionMatches("gather", "collect"), true);
  assert.equal(actionMatches("mine", "mine"), true);
  assert.equal(actionMatches("fish", "fish"), true);
  assert.equal(actionMatches("consume", "eat"), true);
  assert.equal(actionMatches("work", "work_office"), true);
  assert.equal(actionMatches("work", "cafe_serve"), true);
  assert.equal(actionMatches("dungeon", "dungeon"), true);
  assert.equal(actionMatches("pet", "pet_feed"), true);
  assert.equal(actionMatches("adventure", "dungeon"), true);
  assert.equal(actionMatches("adventure", "pet_play"), true);
  assert.equal(actionMatches("craft", "alchemy"), false);
});

test("DailyQuestEngine - getWeeklyResetString() returns valid Monday date", () => {
  const resetKey = getWeeklyResetString();
  assert.match(resetKey, /^\d{4}-\d{2}-\d{2}$/);
});

test("DailyQuestEngine - STREAK_MILESTONES has 3, 7, 14, 30 days configured", () => {
  assert.ok(STREAK_MILESTONES[3]);
  assert.ok(STREAK_MILESTONES[7]);
  assert.ok(STREAK_MILESTONES[14]);
  assert.ok(STREAK_MILESTONES[30]);
  assert.ok(STREAK_MILESTONES[3].coupons >= 1);
  assert.ok(STREAK_MILESTONES[3].bonusNsf >= 100);
  assert.ok(STREAK_MILESTONES[7].coupons >= 1);
  assert.ok(STREAK_MILESTONES[14].bonusNsf > STREAK_MILESTONES[7].bonusNsf);
  assert.ok(STREAK_MILESTONES[30].bonusNsf > STREAK_MILESTONES[14].bonusNsf);
  assert.ok(STREAK_MILESTONES[30].coupons > STREAK_MILESTONES[14].coupons);

  assert.ok(Array.isArray(STREAK_BONUS_TIERS));
  assert.ok(STREAK_BONUS_TIERS.length > 0);
});
