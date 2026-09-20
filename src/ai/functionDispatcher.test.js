"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  tools,
  dispatchFunction,
  validateFunctionArgs,
} = require("./functionDispatcher");
const cacheManager = require("../managers/cacheManager");
const redisManager = require("../managers/redisManager");
const UserReminder = require("../models/UserReminder");

test("functionDispatcher - tools declaration schema", () => {
  assert.equal(tools.length, 11);
  const toolNames = tools.map((t) => t.name);

  assert.ok(toolNames.includes("check_balance"));
  assert.ok(toolNames.includes("get_user_info"));
  assert.ok(toolNames.includes("play_music"));
  assert.ok(toolNames.includes("get_inventory"));
  assert.ok(toolNames.includes("get_leaderboard"));
  assert.ok(toolNames.includes("get_server_stats"));
  assert.ok(toolNames.includes("create_reminder"));
  assert.ok(toolNames.includes("give_daily"));
  assert.ok(toolNames.includes("harvest_greenhouse"));
  assert.ok(toolNames.includes("check_omikuji"));
  assert.ok(toolNames.includes("check_stock_market"));


  for (const tool of tools) {
    assert.equal(tool.parameters.type, "OBJECT");
    assert.ok(tool.description.length > 10);
  }
});

test("functionDispatcher - dispatch check_balance", async () => {
  const originalGetProfile = cacheManager.getUserProfile;
  const originalGetSurvival = cacheManager.getUserSurvival;

  cacheManager.getUserProfile = async () => ({
    economy_wallet: 1500,
    economy_bank: 5000,
  });
  cacheManager.getUserSurvival = async () => ({
    starFragments: 250,
    coupons: 3,
  });

  const mockMsg = { author: { id: "test_user_1", username: "NauraTester" } };
  const res = await dispatchFunction("check_balance", {}, mockMsg);

  assert.equal(res.economyWallet, 1500);
  assert.equal(res.economyBank, 5000);
  assert.equal(res.totalCoins, 6500);
  assert.equal(res.starFragments, 250);
  assert.equal(res.coupons, 3);

  // Restore
  cacheManager.getUserProfile = originalGetProfile;
  cacheManager.getUserSurvival = originalGetSurvival;
});

test("functionDispatcher - dispatch get_user_info", async () => {
  const originalGetProfile = cacheManager.getUserProfile;
  const originalGetSurvival = cacheManager.getUserSurvival;

  cacheManager.getUserProfile = async () => ({
    leveling_level: 12,
    leveling_xp: 450,
    reputation: 99,
    characterClass: "Mage",
    isPremium: true,
    premiumUntil: new Date(Date.now() + 86400000),
    language: "id",
  });
  cacheManager.getUserSurvival = async () => ({
    survival_level: 5,
    survival_xp: 120,
  });

  const mockMsg = { author: { id: "test_user_2", username: "MagePlayer" } };
  const res = await dispatchFunction("get_user_info", {}, mockMsg);

  assert.equal(res.username, "MagePlayer");
  assert.equal(res.chatLevel, 12);
  assert.equal(res.survivalLevel, 5);
  assert.equal(res.isPremium, true);
  assert.equal(res.characterClass, "Mage");

  cacheManager.getUserProfile = originalGetProfile;
  cacheManager.getUserSurvival = originalGetSurvival;
});

test("functionDispatcher - dispatch get_inventory", async () => {
  const originalGetProfile = cacheManager.getUserProfile;

  cacheManager.getUserProfile = async () => ({
    inventory: [
      { id: "wood", name: "Kayu Oak", amount: 15 },
      { id: "iron_ore", name: "Bijih Besi", amount: 5 },
    ],
  });

  const mockMsg = { author: { id: "test_user_inv", username: "Lumberjack" } };
  const res = await dispatchFunction("get_inventory", {}, mockMsg);

  assert.equal(res.totalItemTypes, 2);
  assert.equal(res.items[0].name, "Kayu Oak");
  assert.equal(res.items[0].amount, 15);
  assert.equal(res.isEmpty, false);

  cacheManager.getUserProfile = originalGetProfile;
});

test("functionDispatcher - dispatch get_server_stats", async () => {
  const mockMsg = {
    author: { id: "user_srv", username: "GuildOwner" },
    guild: {
      name: "Naura Sanctuary",
      memberCount: 250,
      channels: { cache: { size: 15 } },
      roles: { cache: { size: 8 } },
      premiumTier: 2,
      premiumSubscriptionCount: 7,
    },
  };

  const res = await dispatchFunction("get_server_stats", {}, mockMsg);
  assert.equal(res.serverName, "Naura Sanctuary");
  assert.equal(res.memberCount, 250);
  assert.equal(res.channelsCount, 15);
  assert.equal(res.boostTier, 2);
});

test("functionDispatcher - dispatch create_reminder", async () => {
  const originalCreate = UserReminder.create;
  let savedData = null;
  UserReminder.create = async (data) => {
    savedData = data;
    return data;
  };

  const mockMsg = {
    author: { id: "user_remind", username: "BusyUser" },
    channel: { id: "channel_123" },
  };

  const res = await dispatchFunction(
    "create_reminder",
    { duration: "30m", message: "Kerjakan PR Matematika" },
    mockMsg,
  );

  assert.equal(res.status, "success");
  assert.ok(savedData);
  assert.equal(savedData.message, "Kerjakan PR Matematika");
  assert.equal(savedData.userId, "user_remind");

  UserReminder.create = originalCreate;
});

test("functionDispatcher - dispatch give_daily", async () => {
  const originalIncrement = cacheManager.incrementUserSurvival;
  const originalGetProfile = cacheManager.getUserProfile;
  const originalGetCache = redisManager.getCache;
  const originalSetCache = redisManager.setCache;

  const increments = [];
  cacheManager.incrementUserSurvival = async (userId, field, amount) => {
    increments.push({ field, amount });
    return true;
  };
  cacheManager.getUserProfile = async () => ({ isPremium: false });
  redisManager.getCache = async () => null; // No cooldown
  redisManager.setCache = async () => true;

  const mockMsg = { author: { id: "user_daily", username: "DailyHunter" } };
  const res = await dispatchFunction("give_daily", {}, mockMsg);

  assert.equal(res.status, "success");
  assert.equal(res.rewardFragments, 200);
  assert.equal(res.rewardXp, 50);
  assert.equal(increments.length, 2);

  // Restore
  cacheManager.incrementUserSurvival = originalIncrement;
  cacheManager.getUserProfile = originalGetProfile;
  redisManager.getCache = originalGetCache;
  redisManager.setCache = originalSetCache;
});

test("functionDispatcher - strict JSON schema validation", () => {
  const missingRequired = validateFunctionArgs("create_reminder", {});
  assert.equal(missingRequired.valid, false);
  assert.ok(missingRequired.error.includes("Parameter wajib"));

  const validArgs = validateFunctionArgs("create_reminder", {
    duration: "10m",
    message: "Meeting tim",
  });
  assert.equal(validArgs.valid, true);
  assert.equal(validArgs.sanitizedArgs.duration, "10m");

  const invalidFunc = validateFunctionArgs("invalid_function_call", {});
  assert.equal(invalidFunc.valid, false);
});
