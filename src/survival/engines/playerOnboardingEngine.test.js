"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  ARCHETYPES,
  BASE_STARTER_KIT,
  renderOnboardingPrompt,
} = require("./playerOnboardingEngine");

describe("PlayerOnboardingEngine - Archetypes & Onboarding Flow", () => {
  it("memiliki 3 arketipe resmi: farmer, miner, warrior", () => {
    assert.ok(ARCHETYPES.farmer);
    assert.ok(ARCHETYPES.miner);
    assert.ok(ARCHETYPES.warrior);

    assert.ok(ARCHETYPES.farmer.bonusItems.length > 0);
    assert.ok(ARCHETYPES.miner.bonusItems.length > 0);
    assert.ok(ARCHETYPES.warrior.bonusItems.length > 0);
  });

  it("BASE_STARTER_KIT memuat item fundamental survival_started dan perkakas awal", () => {
    const itemIds = BASE_STARTER_KIT.map((i) => i.id);
    assert.ok(itemIds.includes("survival_started"));
    assert.ok(itemIds.includes("wooden_axe"));
    assert.ok(itemIds.includes("wooden_pickaxe"));
    assert.ok(itemIds.includes("wooden_sword"));
  });

  it("renderOnboardingPrompt menghasilkan payload Container V2 dengan select menu dan tombol", () => {
    const mockUser = {
      username: "TestAdventurer",
      displayAvatarURL: () => "https://example.com/avatar.png",
    };

    const payload = renderOnboardingPrompt(mockUser);
    assert.ok(payload);
    assert.ok(Array.isArray(payload.components));
    assert.ok(payload.components.length > 0);
  });
});
