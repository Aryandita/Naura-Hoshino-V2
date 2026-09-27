"use strict";

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const aliasService = require("./aliasService");

describe("AliasService - Per-User Custom Command Aliases", () => {
  beforeEach(() => {
    aliasService.clearCache();
  });

  it("sanitizeName membersihkan slash, prefix, dan spasi", () => {
    assert.strictEqual(aliasService.sanitizeName("/farm"), "farm");
    assert.strictEqual(aliasService.sanitizeName("n!daily"), "daily");
    assert.strictEqual(aliasService.sanitizeName("  HeLp  "), "help");
  });

  it("setAlias menolak shortcut rekursif yang sama dengan perintah target", async () => {
    const res = await aliasService.setAlias("user_1", "farm", "farm");
    assert.strictEqual(res.success, false);
    assert.ok(res.message.includes("tidak boleh sama"));
  });

  it("setAlias dan resolveAlias berhasil mendaftarkan dan menyelesaikan shortcut", async () => {
    const res = await aliasService.setAlias("user_1", "f", "farm status");
    assert.strictEqual(res.success, true);

    const resolved = await aliasService.resolveAlias("user_1", "f");
    assert.strictEqual(resolved, "farm status");

    const nonExistent = await aliasService.resolveAlias("user_1", "xyz");
    assert.strictEqual(nonExistent, null);
  });

  it("removeAlias menghapus alias yang sudah didaftarkan", async () => {
    await aliasService.setAlias("user_2", "lb", "leaderboard");
    assert.strictEqual(await aliasService.resolveAlias("user_2", "lb"), "leaderboard");

    const delRes = await aliasService.removeAlias("user_2", "lb");
    assert.strictEqual(delRes.success, true);

    assert.strictEqual(await aliasService.resolveAlias("user_2", "lb"), null);
  });
});
