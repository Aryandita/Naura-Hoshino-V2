"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");
const guildFederationEngine = require("./guildFederationEngine");

describe("Cross-Server Federation War & Territory Siege Engine (Phase 2)", () => {
  it("getRelicTowers mengembalikan seluruh Menara Relik Kuno terkonfigurasi", () => {
    const towers = guildFederationEngine.getRelicTowers();
    assert.ok(Array.isArray(towers));
    assert.ok(towers.length >= 3);

    const chrono = towers.find((t) => t.id === "chrono_siphon");
    assert.ok(chrono);
    assert.strictEqual(chrono.maxHp, 12000);
    assert.ok(typeof chrono.controlPercent === "number");
  });

  it("siegeRelicTower dapat menyerang dan menaklukkan menara relik", async () => {
    const created = await guildFederationEngine.createFederation({
      name: "Valkyrie Legion",
      tag: "VALK",
      leaderClanId: "clan_valk_1",
      guildId: "guild_valk",
    });

    const fedId = created.federation.id;

    // Serang Void Citadel (menara netral)
    const res = await guildFederationEngine.siegeRelicTower({
      federationId: fedId,
      clanId: "clan_valk_1",
      towerId: "void_citadel",
      siegePower: 500,
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.action, "SIEGE");
    assert.ok(res.damage >= 50);
  });

  it("claimTowerDividends menolak klaim bila aliansi bukan pengontrol resmi", async () => {
    const res = await guildFederationEngine.claimTowerDividends({
      federationId: "fed_random_fake",
      towerId: "chrono_siphon",
    });

    assert.strictEqual(res.success, false);
    assert.ok(res.error);
  });
});
