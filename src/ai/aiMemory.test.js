"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const AIMemory = require("./aiMemory");
const redisManager = require("../managers/redisManager");
const mongoManager = require("../managers/mongoManager");

test("AIMemory - extractAndSave nickname detection", async () => {
  let savedDoc = null;
  const originalSave = mongoManager.saveAiMemory;
  const originalSetCache = redisManager.setCache;
  const originalGetCache = redisManager.getCache;

  mongoManager.saveAiMemory = async (userId, data) => {
    savedDoc = { userId, ...data };
    return savedDoc;
  };
  redisManager.setCache = async () => true;
  redisManager.getCache = async () => ({});

  // User explicitly asks to be called "Ryo"
  await AIMemory.extractAndSave("user_test_99", "Halo Naura, panggil aku Ryo ya!");

  assert.ok(savedDoc);
  assert.equal(savedDoc.nickname, "Ryo");

  mongoManager.saveAiMemory = originalSave;
  redisManager.setCache = originalSetCache;
  redisManager.getCache = originalGetCache;
});

test("AIMemory - extractAndSave music preference detection", async () => {
  let savedDoc = null;
  const originalSave = mongoManager.saveAiMemory;
  const originalGet = mongoManager.getAiMemory;

  mongoManager.saveAiMemory = async (userId, data) => {
    savedDoc = { userId, ...data };
    return savedDoc;
  };
  mongoManager.getAiMemory = async () => ({ musicPrefs: ["J-Pop"] });

  await AIMemory.extractAndSave("user_test_music", "Aku paling suka lagu Lofi Hip Hop");

  assert.ok(savedDoc);
  assert.ok(savedDoc.musicPrefs.includes("Lofi Hip Hop"));

  mongoManager.saveAiMemory = originalSave;
  mongoManager.getAiMemory = originalGet;
});

test("AIMemory - getMemoryContext formats structured context", async () => {
  const originalGetMongo = mongoManager.getAiMemory;
  const originalGetCache = redisManager.getCache;

  redisManager.getCache = async () => null;
  mongoManager.getAiMemory = async (userId) => ({
    userId,
    nickname: "Ryo-kun",
    musicPrefs: ["Lofi", "Synthwave"],
    facts: ["Juara turnamen duel RPG"],
    summary: "Kemarin mengobrol tentang game petualangan.",
  });

  const context = await AIMemory.getMemoryContext("user_ctx_123");

  assert.ok(context.includes("[Catatan Ingatan AI tentang User]"));
  assert.ok(context.includes("Ryo-kun"));
  assert.ok(context.includes("Lofi, Synthwave"));
  assert.ok(context.includes("Juara turnamen duel RPG"));

  mongoManager.getAiMemory = originalGetMongo;
  redisManager.getCache = originalGetCache;
});
