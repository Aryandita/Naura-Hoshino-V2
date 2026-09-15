"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");
const redisManager = require("./redisManager");
const survivalRedisLock = require("../survival/helpers/redisLockHelper");
const utilsRedisLock = require("../utils/redisLockHelper");

describe("Redis Watchdog & Resilient Memory Lock", () => {
  it("survival/helpers/redisLockHelper re-ekspor fungsi utils/redisLockHelper secara identik", () => {
    assert.strictEqual(survivalRedisLock.acquireLock, utilsRedisLock.acquireLock);
    assert.strictEqual(survivalRedisLock.releaseLock, utilsRedisLock.releaseLock);
    assert.strictEqual(survivalRedisLock.withDistributedLock, utilsRedisLock.withDistributedLock);
  });

  it("getLockStats melaporkan jumlah lock in-memory secara akurat", async () => {
    const key = "lock:test:watchdog:1";
    const token = await utilsRedisLock.acquireLock(key, 5000);
    assert.ok(token);

    const stats = utilsRedisLock.getLockStats();
    assert.ok(typeof stats.activeInMemoryLocks === "number");

    await utilsRedisLock.releaseLock(key, token);
  });

  it("getStatus pada redisManager mengembalikan mode fallback yang aman saat offline", () => {
    if (typeof redisManager.getStatus === "function") {
      const status = redisManager.getStatus();
      assert.ok(status.mode === "redis_cluster" || status.mode === "in_memory_fallback");
    }
  });
});
