"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const gemSocketEngine = require("./gemSocketEngine");

test("GemSocketEngine - Available Gems and Socketing Logic", () => {
  const gems = gemSocketEngine.getAvailableGems();
  assert.ok(gems.RUBY_LIFESTEAL, "Ruby should be available");
  assert.ok(gems.SAPPHIRE_CRIT, "Sapphire should be available");
  assert.ok(gems.EMERALD_STAMINA, "Emerald should be available");
  assert.ok(gems.AMETHYST_BOSS, "Amethyst should be available");

  const mockCard = {
    cardCode: "CRD_TEST_1",
    maxSockets: 2,
    cosmic_sockets: [],
  };

  const res = gemSocketEngine.socketGem(mockCard, "RUBY_LIFESTEAL");
  assert.equal(res.success, true);
  assert.equal(res.updatedSockets.length, 1);
  assert.equal(res.gem.effect, "LIFESTEAL");

  const res2 = gemSocketEngine.socketGem(
    { ...mockCard, cosmic_sockets: res.updatedSockets },
    "SAPPHIRE_CRIT",
  );
  assert.equal(res2.success, true);
  assert.equal(res2.updatedSockets.length, 2);

  // Soket penuh (max 2)
  const res3 = gemSocketEngine.socketGem(
    { ...mockCard, cosmic_sockets: res2.updatedSockets },
    "EMERALD_STAMINA",
  );
  assert.equal(res3.success, false);
  assert.equal(res3.reason, "SOCKETS_FULL");
});

test("GemSocketEngine - Extract Gem from Socket", () => {
  const mockCard = {
    cardCode: "CRD_TEST_2",
    cosmic_sockets: [
      { gemId: "RUBY_LIFESTEAL", gemName: "Ruby" },
      { gemId: "SAPPHIRE_CRIT", gemName: "Sapphire" },
    ],
  };

  const res = gemSocketEngine.extractGem(mockCard, 0);
  assert.equal(res.success, true);
  assert.equal(res.removedGem.gemId, "RUBY_LIFESTEAL");
  assert.equal(res.updatedSockets.length, 1);
  assert.equal(res.updatedSockets[0].gemId, "SAPPHIRE_CRIT");
});
