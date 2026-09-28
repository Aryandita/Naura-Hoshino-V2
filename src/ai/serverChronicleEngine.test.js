"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  synthesizeChronicle,
  recordMessageActivity,
  generateChronicleData,
} = require("./serverChronicleEngine");

test("ServerChronicleEngine - menghasilkan edisi damai saat data kosong", () => {
  const result = synthesizeChronicle({});
  assert.match(result.editionTitle, /Warta Mingguan/);
  assert.match(result.headline, /KOTA HOSHINO DAMAI/);
  assert.ok(result.economySection);
  assert.ok(result.weatherForecast);
});

test("ServerChronicleEngine - mengangkat pemenang lotre sebagai headline utama", () => {
  const result = synthesizeChronicle({
    guildName: "Cyber Knights",
    lotteryWinners: [{ username: "Aria", prize: 500000 }],
  });
  assert.match(result.headline, /Aria/i);
  assert.match(result.headline, /500\.000/);
  assert.match(result.leadStory, /Aria/i);
});

test("ServerChronicleEngine - mengangkat boss kill jika ada dan tidak ada pemenang lotre", () => {
  const result = synthesizeChronicle({
    bossKills: [{ bossName: "Void Leviathan" }],
  });
  assert.match(result.headline, /Void Leviathan/i);
});

test("ServerChronicleEngine - menyajikan pergerakan komoditas pasar bullish", () => {
  const result = synthesizeChronicle({
    marketItems: [{ name: "Cyber Ruby", trend: "bullish", priceChangePercent: 25 }],
  });
  assert.match(result.economySection, /Cyber Ruby/);
  assert.match(result.economySection, /\+25%/);
});

test("ServerChronicleEngine - mencantumkan klan teratas dalam kolom klan", () => {
  const result = synthesizeChronicle({
    topClans: [{ name: "Shadow Guild" }],
  });
  assert.match(result.guildSection, /Shadow Guild/);
});

test("ServerChronicleEngine - recordMessageActivity menangani parameter kosong dengan aman", async () => {
  await assert.doesNotReject(async () => {
    await recordMessageActivity(null, null);
    await recordMessageActivity("guild_123", "user_456", "tester", "Pesan halo dunia");
  });
});

test("ServerChronicleEngine - generateChronicleData menghasilkan struktur koran valid", async () => {
  const mockGuild = {
    id: "guild_test_123",
    name: "Sanctuary Cyber",
    ownerId: "owner_123",
    memberCount: 50,
    iconURL: () => "https://example.com/icon.png",
  };
  const data = await generateChronicleData(mockGuild);
  assert.equal(data.guildName, "Sanctuary Cyber");
  assert.ok(data.headline);
  assert.ok(data.topUser);
  assert.ok(data.date);
});
