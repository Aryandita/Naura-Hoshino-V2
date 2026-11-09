"use strict";
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { States, genGameId, cid, parseCid, makeFilter, rewardOnce, withLock } = require("./arcadeSession");

describe("arcadeSession state machine", () => {
  test("cid/parseCid roundtrip contains gameId", () => {
    const gid = genGameId("trivia", "123");
    assert.match(gid, /^trivia_123_[0-9a-f]+$/);
    const c = cid(gid, "trivia_0");
    const p = parseCid(c);
    assert.equal(p.gameId, gid);
    assert.equal(p.action, "trivia_0");
  });
  test("makeFilter rejects other user/gameId", () => {
    const gid = genGameId("rps", "111");
    const f = makeFilter(gid, "111");
    assert.equal(f({ customId: cid(gid, "rps_batu"), user: { id: "111" } }), true);
    assert.equal(f({ customId: cid(gid, "rps_batu"), user: { id: "999" } }), false);
    assert.equal(f({ customId: cid("other_999_ab", "rps_batu"), user: { id: "111" } }), false);
  });
  test("rewardOnce idempotent", async () => {
    const gid = genGameId("test", "222");
    let calls = 0;
    const fn = async () => { calls++; return 42; };
    const r1 = await rewardOnce(gid, fn);
    assert.equal(r1.ok, true);
    const r2 = await rewardOnce(gid, fn);
    assert.equal(r2.ok, false);
    assert.equal(calls, 1);
  });
  test("withLock prevents concurrent same user (in-memory fallback passes)", async () => {
    const r = await withLock("333", async () => 7);
    assert.equal(r.ok, true);
    assert.equal(r.result, 7);
  });
});

