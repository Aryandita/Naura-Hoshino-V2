"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const guildFederationEngine = require("./guildFederationEngine");

test("GuildFederationEngine - harus dapat membuat aliansi federasi klan baru", async () => {
  const res = await guildFederationEngine.createFederation({
    name: "Starfall Alliance",
    tag: "STAR",
    leaderClanId: "clan_test_01",
    guildId: "guild_01",
  });

  assert.equal(res.success, true);
  assert.ok(res.federation);
  assert.equal(res.federation.name, "Starfall Alliance");
  assert.equal(res.federation.tag, "STAR");
  assert.equal(res.federation.memberClans.length, 1);
});

test("GuildFederationEngine - harus mengizinkan klan lain untuk bergabung ke federasi", async () => {
  const created = await guildFederationEngine.createFederation({
    name: "Eclipse Coalition",
    tag: "ECLIP",
    leaderClanId: "clan_alpha",
    guildId: "guild_alpha",
  });

  const joinRes = await guildFederationEngine.joinFederation(
    created.federation.id,
    "clan_beta",
    "guild_beta",
  );

  assert.equal(joinRes.success, true);
  assert.equal(joinRes.federation.memberClans.length, 2);
  assert.ok(joinRes.federation.prestige > 100);
});

test("GuildFederationEngine - harus menyajikan daftar Global Hall of Fame terurut prestise", async () => {
  const hof = await guildFederationEngine.getHallOfFame(5);
  assert.ok(Array.isArray(hof));
  assert.ok(hof.length > 0);
  assert.ok(hof[0].prestige !== undefined);
});

test("GuildFederationEngine - harus menangani serangan ke Alliance Raid Boss", async () => {
  const attackRes = await guildFederationEngine.attackAllianceBoss({
    federationId: "fed_mock",
    clanId: "clan_alpha",
    userId: "user_01",
    damage: 250,
  });

  assert.equal(attackRes.damage, 250);
  assert.ok(attackRes.remainingHp <= attackRes.maxHp);
});
