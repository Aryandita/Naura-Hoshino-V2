"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const ServerChronicleEngine = require("./serverChronicleEngine");

test("Server Chronicle Engine - Format and Structure", async () => {
  const mockGuild = {
    id: "guild_test_123",
    name: "Neo-Hoshino City",
    ownerId: "owner_123",
    memberCount: 150,
    iconURL: () => "https://example.com/icon.png",
  };

  const data = await ServerChronicleEngine.generateChronicleData(mockGuild);

  assert.ok(data, "Chronicle data harus terbentuk");
  assert.equal(data.guildName, "Neo-Hoshino City");
  assert.ok(data.date, "Harus memiliki tanggal terbit");
  assert.ok(data.headline, "Harus memiliki judul headline");
  assert.ok(data.topUser, "Harus memiliki top user");
});
