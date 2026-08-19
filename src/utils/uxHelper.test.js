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
  assert.equal(result.remaining, 50);
  assert.ok(result.cheerMessage.includes("Kak Aryandita"));
  assert.ok(result.cheerMessage.includes("Progresmu mantap"));
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
