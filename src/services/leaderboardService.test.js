"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  LEADERBOARD_CATEGORIES,
  getCategoryConfig,
} = require("./leaderboardService");

describe("LeaderboardService - Multi-Category Configuration", () => {
  it("memiliki minimal 5 kategori peringkat resmi", () => {
    assert.ok(LEADERBOARD_CATEGORIES.length >= 5);
    const categoryIds = LEADERBOARD_CATEGORIES.map((c) => c.id);
    assert.ok(categoryIds.includes("wallet"));
    assert.ok(categoryIds.includes("bank"));
    assert.ok(categoryIds.includes("fragments"));
    assert.ok(categoryIds.includes("level"));
    assert.ok(categoryIds.includes("card_elo"));
  });

  it("getCategoryConfig mengembalikan fallback default wallet bila kategori tidak dikenal", () => {
    const config = getCategoryConfig("unknown_category_xyz");
    assert.strictEqual(config.id, "wallet");
  });

  it("formatScore menghasilkan representasi teks yang tepat", () => {
    const walletConfig = getCategoryConfig("wallet");
    const formatted = walletConfig.formatScore({ economy_wallet: 150000 });
    assert.ok(formatted.includes("150.000 NC") || formatted.includes("150,000 NC"));

    const cardConfig = getCategoryConfig("card_elo");
    const formattedCard = cardConfig.formatScore({ eloRating: 1450, wins: 25 });
    assert.ok(formattedCard.includes("1450 ELO"));
    assert.ok(formattedCard.includes("25 Menang"));
  });
});
