"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const uxHelper = require("./uxHelper");

test("uxHelper - resolveUserName handles various input formats", () => {
  // Direct string
  assert.equal(uxHelper.resolveUserName("Arya"), "Arya");

  // Discord Interaction structure with member displayName
  const mockInteraction = {
    member: { displayName: "Arya Prime" },
    user: { globalName: "Arya Global", username: "arya123" },
  };
  assert.equal(uxHelper.resolveUserName(mockInteraction), "Arya Prime");

  // Discord User object
  const mockUser = { globalName: "Naura Fan", username: "naurafan" };
  assert.equal(uxHelper.resolveUserName(mockUser), "Naura Fan");

  // Fallback
  assert.equal(uxHelper.resolveUserName(null), "Sobat Naura");
});

test("uxHelper - buildGoalGradientBar with head start and encouragement", () => {
  const result = uxHelper.buildGoalGradientBar({
    current: 30,
    target: 100,
    headStart: 20, // Total 50%
    length: 10,
    user: "Aryandita",
    lang: "id",
  });

  assert.equal(result.percent, 50);
  assert.equal(result.bar, "▰▰▰▰▰▱▱▱▱▱");
  assert.ok(result.customBar.includes("<:AfterDot:"));
  assert.ok(result.customBar.includes("<:BeforeDot:"));
  assert.equal(result.remaining, 50);
  assert.ok(result.cheerMessage.includes("Kak Aryandita"));
  assert.ok(result.cheerMessage.includes("Progresmu mantap"));

  // Test useCustomEmojis: true
  const customResult = uxHelper.buildGoalGradientBar({
    current: 50,
    target: 100,
    useCustomEmojis: true,
    length: 4,
  });
  assert.equal(customResult.bar, "<:AfterDot:1488166236004159509><:AfterDot:1488166236004159509><:BeforeDot:1488166108081950882><:BeforeDot:1488166108081950882>");
});

test("uxHelper - formatRecommendationBadge adds smart highlight", () => {
  assert.equal(
    uxHelper.formatRecommendationBadge("Putar Musik", true),
    "⭐ Putar Musik (Rekomendasi Naura)",
  );
  assert.equal(
    uxHelper.formatRecommendationBadge("Putar Musik", false),
    "Putar Musik",
  );
});

test("uxHelper - buildPriceAnchor displays visual comparison & discount badge", () => {
  const anchored = uxHelper.buildPriceAnchor({
    originalPrice: 1000,
    discountedPrice: 750,
    unit: "Star Fragments",
  });
  assert.ok(anchored.includes("~~1,000~~"));
  assert.ok(anchored.includes("**750**"));
  assert.ok(anchored.includes("[HEMAT 25%]"));
});

test("uxHelper - getPersonalityResponse produces personalized anime voice without Master", () => {
  const cooldownRes = uxHelper.getPersonalityResponse("cooldown", {
    user: "Ryaa",
    context: { retryAfter: 5 },
    lang: "id",
  });
  assert.ok(cooldownRes.includes("Kak Ryaa"));
  assert.ok(!cooldownRes.includes("Master"));

  const levelUpRes = uxHelper.getPersonalityResponse("levelUp", {
    user: "Ryaa",
    context: { level: 10 },
    lang: "en",
  });
  assert.ok(levelUpRes.includes("Ryaa"));
  assert.ok(levelUpRes.includes("Level 10"));
  assert.ok(!levelUpRes.includes("Master"));

  const ikeaRes = uxHelper.getPersonalityResponse("ikeaAppreciation", {
    user: "Ryaa",
    lang: "id",
  });
  assert.ok(ikeaRes.includes("Kak Ryaa"));
  assert.ok(ikeaRes.includes("estetik banget"));
});

test("uxHelper - buildTimelineStepTracker renders progressive visual steps", () => {
  const steps = [
    { label: "Buka Tiket" },
    { label: "Pemeriksaan Staff" },
    { label: "Tuntas" },
  ];

  const inProgress = uxHelper.buildTimelineStepTracker({
    steps,
    currentStepIndex: 1,
    user: "Aryandita",
    lang: "id",
  });

  assert.equal(inProgress.isComplete, false);
  assert.ok(inProgress.timeline.includes("Buka Tiket"));
  assert.ok(inProgress.timeline.includes("**[Pemeriksaan Staff]**"));
  assert.ok(inProgress.message.includes("Pemeriksaan Staff"));
  assert.ok(inProgress.message.includes("Kak Aryandita"));

  const completed = uxHelper.buildTimelineStepTracker({
    steps,
    currentStepIndex: 3,
    user: "Aryandita",
    lang: "id",
  });
  assert.equal(completed.isComplete, true);
  assert.ok(completed.message.includes("selesai tuntas"));
});

test("uxHelper - getModuleCategoryColor returns cohesive module colors", () => {
  assert.equal(uxHelper.getModuleCategoryColor("core"), "#FFC0CB");
  assert.equal(uxHelper.getModuleCategoryColor("music"), "#8A2BE2");
  assert.equal(uxHelper.getModuleCategoryColor("economy"), "#FFD700");
  assert.equal(uxHelper.getModuleCategoryColor("survival"), "#228B22");
  assert.equal(uxHelper.getModuleCategoryColor("admin"), "#9400D3");
});

test("uxHelper - buildAdaptiveDensityView separates beginner vs veteran views", () => {
  const newbie = uxHelper.buildAdaptiveDensityView({
    level: 2,
    user: "NewbiePlayer",
    lang: "id",
  });
  assert.equal(newbie.isVeteran, false);
  assert.ok(newbie.modeBadge.includes("Panduan Pemula"));

  const veteran = uxHelper.buildAdaptiveDensityView({
    level: 15,
    user: "ProPlayer",
    lang: "id",
  });
  assert.equal(veteran.isVeteran, true);
  assert.ok(veteran.modeBadge.includes("Mode Veteran"));
});

test("uxHelper - filterPredictiveSearch finds matches and falls back gracefully", () => {
  const catalog = [
    { name: "Kapak Kayu", value: "axe_wood", category: "tools" },
    { name: "Pedang Besi", value: "sword_iron", category: "weapons" },
    { name: "Apel Merah", value: "apple_red", category: "food" },
  ];

  const matched = uxHelper.filterPredictiveSearch({
    query: "pedang",
    items: catalog,
  });
  assert.equal(matched.length, 1);
  assert.equal(matched[0].value, "sword_iron");

  const fallback = uxHelper.filterPredictiveSearch({
    query: "pesawat",
    items: catalog,
    fallbackRecommendations: [{ name: "⭐ Rekomendasi: Kapak Kayu", value: "axe_wood" }],
  });
  assert.equal(fallback.length, 1);
  assert.equal(fallback[0].value, "axe_wood");
});
