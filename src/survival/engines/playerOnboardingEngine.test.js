"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  ARCHETYPES,
  BASE_STARTER_KIT,
  STARTING_LOCATIONS,
  QUIZ_STEPS,
  evaluateQuizAnswers,
  renderOnboardingPrompt,
  renderQuizStep,
  renderQuizVerdict,
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

  it("STARTING_LOCATIONS dan QUIZ_STEPS memiliki konfigurasi lengkap", () => {
    assert.ok(STARTING_LOCATIONS.balai_desa);
    assert.equal(QUIZ_STEPS.length, 3);
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

  it("evaluateQuizAnswers() mengevaluasi pilihan kuis menjadi arketipe dan lokasi yang tepat", () => {
    const resFarmer = evaluateQuizAnswers({ 1: "farmer", 2: "farmer", 3: "balai_desa" });
    assert.equal(resFarmer.archetypeKey, "farmer");
    assert.equal(resFarmer.locationKey, "balai_desa");

    const resMiner = evaluateQuizAnswers({ 1: "miner", 2: "miner", 3: "tambang_gua" });
    assert.equal(resMiner.archetypeKey, "miner");
    assert.equal(resMiner.locationKey, "tambang_gua");

    const resWarrior = evaluateQuizAnswers({ 1: "warrior", 2: "warrior", 3: "hutan_pinus" });
    assert.equal(resWarrior.archetypeKey, "warrior");
    assert.equal(resWarrior.locationKey, "hutan_pinus");
  });

  it("renderQuizStep() dan renderQuizVerdict() menghasilkan struktur UI valid", () => {
    const mockUser = {
      username: "NauraTraveler",
      displayAvatarURL: () => "https://example.com/naura.png",
    };

    const stepPayload = renderQuizStep(mockUser, 1, {});
    assert.ok(stepPayload);
    assert.ok(stepPayload.components.length > 0);

    const verdictPayload = renderQuizVerdict(mockUser, { 1: "farmer", 2: "farmer", 3: "balai_desa" });
    assert.ok(verdictPayload);
    assert.ok(verdictPayload.components.length > 0);
  });
});
