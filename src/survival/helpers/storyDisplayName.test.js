"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  resolveStoryDisplayName,
  replaceStoryPlayer,
} = require("./storyDisplayName");

test("nama anggota mengikuti masing-masing server", () => {
  const user = { username: "username", globalName: "Global" };
  assert.equal(
    resolveStoryDisplayName({
      guildId: "1",
      user,
      member: { displayName: "Nama Desa" },
    }),
    "Nama Desa",
  );
  assert.equal(
    resolveStoryDisplayName({
      guildId: "2",
      user,
      member: { nick: "Nama Kota" },
    }),
    "Nama Kota",
  );
});

test("DM menggunakan nama global lalu username", () => {
  assert.equal(
    resolveStoryDisplayName({
      user: { username: "akun", globalName: "Global" },
    }),
    "Global",
  );
  assert.equal(resolveStoryDisplayName({ user: { username: "akun" } }), "akun");
  assert.equal(resolveStoryDisplayName({}), "Petualang");
});

test("placeholder berulang aman dan nama tidak mengubah markdown atau mention", () => {
  const name = resolveStoryDisplayName({
    user: { globalName: "@everyone **Halo**\n" },
  });
  const result = replaceStoryPlayer("[Player] dan {player}", name);
  assert.ok(result.includes("@\u200beveryone"));
  assert.ok(result.includes("\\*\\*Halo\\*\\*"));
  assert.equal(result.includes("[Player]"), false);
  assert.equal(result.includes("{player}"), false);
  assert.ok(
    Array.from(resolveStoryDisplayName({ user: { username: "a".repeat(100) } }))
      .length <= 32,
  );
});
