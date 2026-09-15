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
