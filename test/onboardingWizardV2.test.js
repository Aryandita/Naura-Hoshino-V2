"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  ARCHETYPES,
  STARTING_LOCATIONS,
  QUIZ_STEPS,
  evaluateQuizAnswers,
  renderOnboardingPrompt,
  renderQuizStep,
  renderQuizVerdict,
} = require("../src/survival/engines/playerOnboardingEngine");

test("Onboarding Engine V2 - ARCHETYPES and STARTING_LOCATIONS are well-defined", () => {
  assert.ok(ARCHETYPES.farmer);
  assert.ok(ARCHETYPES.miner);
  assert.ok(ARCHETYPES.warrior);
  assert.ok(ARCHETYPES.farmer.bonusItems.length > 0);

  assert.ok(STARTING_LOCATIONS.balai_desa);
  assert.ok(STARTING_LOCATIONS.tambang_gua);
  assert.ok(STARTING_LOCATIONS.hutan_pinus);

  assert.equal(QUIZ_STEPS.length, 3);
  assert.ok(QUIZ_STEPS[0]);
  assert.ok(QUIZ_STEPS[1]);
  assert.ok(QUIZ_STEPS[2]);
});

test("Onboarding Engine V2 - evaluateQuizAnswers evaluates preferences correctly", () => {
  // Test farmer tendency
  const res1 = evaluateQuizAnswers({ 1: "farmer", 2: "farmer", 3: "balai_desa" });
  assert.equal(res1.archetypeKey, "farmer");
  assert.equal(res1.locationKey, "balai_desa");

  // Test miner tendency
  const res2 = evaluateQuizAnswers({ 1: "miner", 2: "miner", 3: "tambang_gua" });
  assert.equal(res2.archetypeKey, "miner");
  assert.equal(res2.locationKey, "tambang_gua");

  // Test warrior tendency
  const res3 = evaluateQuizAnswers({ 1: "warrior", 2: "warrior", 3: "hutan_pinus" });
  assert.equal(res3.archetypeKey, "warrior");
  assert.equal(res3.locationKey, "hutan_pinus");
});

test("Onboarding Engine V2 - renderOnboardingPrompt and renderQuizStep return valid container payloads", () => {
  const fakeUser = {
    id: "test_user_onboard_123",
    username: "Adventurer",
    displayAvatarURL: () => "https://cdn.discordapp.com/avatars/123/avatar.png",
  };

  const prompt = renderOnboardingPrompt(fakeUser, "id");
  assert.ok(prompt);
  assert.ok(prompt.flags);

  const step1 = renderQuizStep(fakeUser, 1, {});
  assert.ok(step1);

  const verdict = renderQuizVerdict(fakeUser, { 1: "farmer", 2: "farmer", 3: "balai_desa" });
  assert.ok(verdict);
});
