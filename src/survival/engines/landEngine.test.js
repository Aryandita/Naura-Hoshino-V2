"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const landEngine = require("./landEngine");
const GuildClan = require("../../models/GuildClan");

test("LandEngine - harus menolak koordinat di luar batas grid 1..8", async () => {
  const res = await landEngine.claimPlot({
    guildId: "g1",
    clanId: "c1",
    x: 9,
    y: 1,
  });
  assert.equal(res.success, false);
  assert.match(res.error, /rentang grid/);
});

test("LandEngine - harus berhasil mengklaim kapling tanah jika saldo kas klan cukup", async () => {
  const originalFindByPk = GuildClan.findByPk;
  GuildClan.findByPk = async () => ({
    id: "c1",
    name: "Cyber Knights",
    vault: 5000,
    save: async () => true,
  });

  try {
    const res = await landEngine.claimPlot({
      guildId: "g1",
      clanId: "c1",
      x: 3,
      y: 4,
    });

    assert.equal(res.success, true);
    assert.equal(res.plot.x, 3);
    assert.equal(res.plot.y, 4);
    assert.equal(res.plot.structures.castle, 1);
  } finally {
    GuildClan.findByPk = originalFindByPk;
  }
});

test("LandEngine - harus dapat meng-upgrade struktur istana atau riset", async () => {
  const originalFindByPk = GuildClan.findByPk;
  GuildClan.findByPk = async () => ({
    id: "c1",
    name: "Cyber Knights",
    vault: 10000,
    save: async () => true,
  });

  try {
    const upRes = await landEngine.upgradeStructure({
      guildId: "g1",
      clanId: "c1",
      x: 3,
      y: 4,
      structureType: "castle",
    });

    assert.equal(upRes.success, true);
    assert.equal(upRes.newLevel, 2);
    assert.equal(upRes.structureName, "Iron Fortress");
  } finally {
    GuildClan.findByPk = originalFindByPk;
  }
});

test("LandEngine - harus menghitung total stats dan buff kapling klan", async () => {
  const stats = await landEngine.getClanLandStats("g1", "c1");
  assert.equal(stats.plotsOwned, 1);
  assert.ok(stats.totalVaultBonus > 0);
});

test("LandEngine - 3D Spatial Voice Proximity & Avatar Coordinates Math", async () => {
  // 1. Simpan posisi avatar
  const pos1 = await landEngine.updatePlayerPosition("g_spatial", "user_a", {
    x: 3,
    y: 3,
    username: "Alice",
  });
  assert.equal(pos1.x, 3);
  assert.equal(pos1.y, 3);

  // 2. Dekat (1 ubin): volume 100%
  const proxClose = landEngine.calculateSpatialProximity(
    { x: 3, y: 3 },
    { x: 3, y: 4 },
  );
  assert.equal(proxClose.distance, 1);
  assert.equal(proxClose.volume, 1.0);
  assert.equal(proxClose.audible, true);

  // 3. Jauh (5 ubin): di luar jangkauan (audible: false, volume: 0)
  const proxFar = landEngine.calculateSpatialProximity(
    { x: 1, y: 1 },
    { x: 7, y: 7 },
  );
  assert.ok(proxFar.distance > 4.5);
  assert.equal(proxFar.volume, 0);
  assert.equal(proxFar.audible, false);

  // 4. Stereo pan: pembicara di sebelah kanan
  const proxRight = landEngine.calculateSpatialProximity(
    { x: 2, y: 2 },
    { x: 4, y: 2 },
  );
  assert.ok(proxRight.pan > 0, "Pembicara di kanan harus memiliki pan > 0");

  // 5. Peta audio spasial untuk listener
  const knownPlayers = [
    { userId: "user_b", username: "Bob", x: 4, y: 3 },
    { userId: "user_c", username: "Charlie", x: 8, y: 8 },
  ];
  const audioMap = await landEngine.getProximityAudioMap(
    "g_spatial",
    "user_a",
    knownPlayers,
  );
  assert.equal(audioMap.length, 2);
  assert.equal(audioMap[0].userId, "user_b");
  assert.equal(audioMap[0].audible, true);
  assert.equal(audioMap[1].userId, "user_c");
  assert.equal(audioMap[1].audible, false);
});
