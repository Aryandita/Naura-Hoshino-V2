"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

test("CacheManager - Aliases, invalidators and atomic helpers exist", () => {
  const cacheManager = require("./cacheManager");
  assert.equal(typeof cacheManager.creditUserProfile, "function");
  assert.equal(typeof cacheManager.incrementProfile, "function");
  assert.equal(typeof cacheManager.incrementSurvival, "function");
  assert.equal(typeof cacheManager.updateProfile, "function");
  assert.equal(typeof cacheManager.mutateProfileJson, "function");
  assert.equal(typeof cacheManager.invalidateUserProfile, "function");
  assert.equal(typeof cacheManager.invalidateUserSurvival, "function");
  assert.equal(typeof cacheManager.smartInvalidateUserCanvas, "function");
  assert.equal(typeof cacheManager.addItemsAtomic, "function");
  assert.equal(typeof cacheManager.del, "function");
});

test("Canvas Modules - renderBattle and renderNowPlayingCard aliases exist", () => {
  const battleCanvas = require("../canvas/battleCanvas");
  const nowplayingCanvas = require("../canvas/nowplayingCanvas");
  assert.equal(typeof battleCanvas.renderBattle, "function");
  assert.equal(battleCanvas.renderBattle, battleCanvas.drawBattle);
  assert.equal(typeof nowplayingCanvas.renderNowPlayingCard, "function");
  assert.equal(nowplayingCanvas.renderNowPlayingCard, nowplayingCanvas.drawNowPlayingCard);
});

test("CanvasWorkerPool - getStats() returns comprehensive worker statistics", () => {
  const canvasWorkerPool = require("../canvas/canvasWorkerPool");
  assert.equal(typeof canvasWorkerPool.getStats, "function");
  const stats = canvasWorkerPool.getStats();
  assert.ok(stats, "Stats object must be returned");
  assert.equal(typeof stats.poolSize, "number");
  assert.equal(typeof stats.totalWorkers, "number");
  assert.equal(typeof stats.freeWorkers, "number");
  assert.equal(typeof stats.activeWorkers, "number");
  assert.equal(typeof stats.queuedTasks, "number");
  assert.equal(typeof stats.queueLength, "number");
});

test("CardEngine - claimDailyCard and awakenCard alias exist", () => {
  const CardEngine = require("../card/cardEngine");
  assert.equal(typeof CardEngine.claimDailyCard, "function");
  assert.equal(typeof CardEngine.awakenCard, "function");
});

test("LanguageManager and UI - getString and getBrandColor exist", () => {
  const languageManager = require("./languageManager");
  const ui = require("../config/ui");
  assert.equal(typeof languageManager.getString, "function");
  assert.equal(typeof ui.getBrandColor, "function");
  const primaryColor = ui.getBrandColor("primary");
  assert.ok(primaryColor, "Brand color primary must return a color string");
});

test("Survival Duel & Pet Actions - runDuel and getPassiveBuffs exist", () => {
  const duelEngine = require("../survival/engines/duelEngine");
  const petActions = require("../survival/helpers/petActions");
  assert.equal(typeof duelEngine.runDuel, "function");
  assert.equal(typeof petActions.getPassiveBuffs, "function");
  assert.equal(petActions.getPassiveBuffs, petActions.getBuffs);
});

test("TempVoice & GeminiClient - getOwner, setOwner, and generateText exist", () => {
  const tempVoiceRegistry = require("./tempVoiceRegistry");
  const geminiClient = require("../ai/geminiClient");
  assert.equal(typeof tempVoiceRegistry.getOwner, "function");
  assert.equal(typeof tempVoiceRegistry.setOwner, "function");
  assert.equal(typeof geminiClient.generateText, "function");
});

test("Redis, Mongo, and Lavalink Managers - Extended helpers and status exist", () => {
  const redisManager = require("./redisManager");
  const mongoManager = require("./mongoManager");
  const lavalinkClusterManager = require("./lavalinkClusterManager");

  assert.equal(typeof redisManager.lpush, "function");
  assert.equal(typeof redisManager.ltrim, "function");
  assert.equal(typeof redisManager.lrange, "function");
  assert.equal(typeof redisManager.get, "function");
  assert.equal(typeof redisManager.set, "function");
  assert.equal(typeof redisManager.del, "function");

  assert.equal(typeof mongoManager.isConnected, "function");
  assert.equal(typeof mongoManager.getDb, "function");

  assert.equal(typeof lavalinkClusterManager.getStatus, "function");
  assert.equal(typeof lavalinkClusterManager.recordFailure, "function");
  const status = lavalinkClusterManager.getStatus();
  assert.ok(status, "Status object must be returned");
  assert.equal(typeof status.totalNodes, "number");
  assert.equal(typeof status.connectedNodes, "number");
});
