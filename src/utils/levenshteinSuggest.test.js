"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");
const { levenshteinDistance, findClosestCommand } = require("./levenshteinSuggest");

describe("LevenshteinSuggest Utility", () => {
  it("levenshteinDistance menghitung jarak edit string secara presisi", () => {
    assert.strictEqual(levenshteinDistance("ping", "ping"), 0);
    assert.strictEqual(levenshteinDistance("ping", "pong"), 1);
    assert.strictEqual(levenshteinDistance("play", "paly"), 2);
    assert.strictEqual(levenshteinDistance("", "cat"), 3);
  });

  it("findClosestCommand mendeteksi typo dan memberikan rekomendasi yang tepat", () => {
    const commands = ["help", "play", "pause", "profile", "survival", "inventory", "daily"];

    const match1 = findClosestCommand("ply", commands, 2);
    assert.ok(match1);
    assert.strictEqual(match1.name, "play");

    const match2 = findClosestCommand("profil", commands, 2);
    assert.ok(match2);
    assert.strictEqual(match2.name, "profile");

    const match3 = findClosestCommand("dauly", commands, 2);
    assert.ok(match3);
    assert.strictEqual(match3.name, "daily");

    // Kata yang terlalu jauh tidak boleh dicocokkan
    const match4 = findClosestCommand("xyzabcdef", commands, 2);
    assert.strictEqual(match4, null);
  });
});
