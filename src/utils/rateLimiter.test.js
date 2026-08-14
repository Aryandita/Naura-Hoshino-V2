const test = require("node:test");
const assert = require("node:assert");
const RateLimiter = require("./rateLimiter");
const redisManager = require("../managers/redisManager");

test("RateLimiter in-memory fallback", async (t) => {
  // Override isReady to force in-memory fallback
  const originalIsReady = redisManager.isReady;
  Object.defineProperty(redisManager, "isReady", {
    value: false,
    writable: true,
  });

  t.after(() => {
    redisManager.isReady = originalIsReady;
  });

  await t.test("allows requests within limit", async () => {
    const userId = "user1";
    const cmd = "testcmd1";

    let result = await RateLimiter.consume(userId, cmd, 2, 10);
    assert.strictEqual(result.limited, false);
    assert.strictEqual(result.remaining, 1);

    result = await RateLimiter.consume(userId, cmd, 2, 10);
    assert.strictEqual(result.limited, false);
    assert.strictEqual(result.remaining, 0);
  });

  await t.test("blocks requests over limit", async () => {
    const userId = "user2";
    const cmd = "testcmd2";

    await RateLimiter.consume(userId, cmd, 1, 10);
    const result = await RateLimiter.consume(userId, cmd, 1, 10);

    assert.strictEqual(result.limited, true);
    assert.strictEqual(result.remaining, 0);
    assert.ok(result.retryAfter > 0);
  });

  await t.test("isRateLimited returns boolean correctly", async () => {
    const userId = "user3";
    const cmd = "testcmd3";

    let limited = await RateLimiter.isRateLimited(userId, cmd, 1, 10);
    assert.strictEqual(limited, false);

    limited = await RateLimiter.isRateLimited(userId, cmd, 1, 10);
    assert.strictEqual(limited, true);
  });
});
