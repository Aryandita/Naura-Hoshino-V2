"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const celestialRaidEngine = require("./celestialRaidEngine");

test("celestialRaidEngine: inisialisasi party raid dengan validasi ukuran party", () => {
  // Party kurang dari 2 orang harus gagal
  assert.throws(
    () =>
      celestialRaidEngine.createRaidInstance({
        leaderId: "user-1",
        members: [{ userId: "user-1", username: "Solo" }],
      }),
    /minimal 2 anggota/,
  );

  // Party valid (3 orang)
  const session = celestialRaidEngine.createRaidInstance({
    leaderId: "u1",
    bossId: "ASTRAL_LEVIATHAN",
    members: [
      { userId: "u1", username: "Tanker", role: "GUARDIAN" },
      { userId: "u2", username: "Striker", role: "VANGUARD" },
      { userId: "u3", username: "Healer", role: "APOTHECARY" },
    ],
  });

  assert.ok(session.instanceId);
  assert.equal(session.members.length, 3);
  assert.equal(session.boss.name, "Astral Leviathan 🐋");
  assert.equal(session.status, "IN_PROGRESS");
});

test("celestialRaidEngine: eksekusi giliran pertempuran dan sinergi peran", () => {
  const session = celestialRaidEngine.createRaidInstance({
    leaderId: "u1",
    bossId: "ASTRAL_LEVIATHAN",
    members: [
      { userId: "u1", username: "Tanker", role: "GUARDIAN" },
      { userId: "u2", username: "Striker", role: "VANGUARD" },
    ],
  });

  const updated = celestialRaidEngine.executeTurn(session.instanceId, [
    { userId: "u1", actionType: "SKILL" }, // Guardian Barrier
    { userId: "u2", actionType: "ATTACK" }, // Vanguard DPS
  ]);

  assert.ok(updated.boss.currentHp < 15000);
  assert.equal(updated.turn, 2);
  assert.ok(updated.combatLog.length > 2);
});

test("celestialRaidEngine: distribusi hadiah secara merata ke seluruh anggota tim", async () => {
  const session = celestialRaidEngine.createRaidInstance({
    leaderId: "u1",
    bossId: "ASTRAL_LEVIATHAN",
    members: [
      { userId: "u1", username: "P1", role: "VANGUARD" },
      { userId: "u2", username: "P2", role: "APOTHECARY" },
    ],
  });

  // Buat HP bos 0 (kemenangan)
  session.boss.currentHp = 0;
  session.status = "VICTORY";

  const awarded = [];
  const mockIncrement = async (userId, data) => {
    awarded.push({ userId, data });
  };

  const dist = await celestialRaidEngine.distributeRewards(session.instanceId, mockIncrement);
  assert.equal(dist.distributed, true);
  assert.equal(dist.rewardPerMember.nsf, 800);
  assert.equal(awarded.length, 2);
  assert.equal(awarded[0].data.starFragments, 800);
  assert.equal(awarded[1].data.starFragments, 800);
});
