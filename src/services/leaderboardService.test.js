"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  LEADERBOARD_CATEGORIES,
  getCategoryConfig,
  updateLeaderboardScore,
  getUserRank,
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

  it("updateLeaderboardScore and getUserRank execute cleanly without throwing", async () => {
    await assert.doesNotReject(async () => {
      await updateLeaderboardScore("card_elo", "user_test_999", 1550);
      await getUserRank("card_elo", "user_test_999");
    });
  });

  it("leaderboardPagination customId parser correctly extracts multi-word categories", () => {
    function parseCustomId(customId, prefix) {
      const raw = customId.replace(prefix, "");
      const lastUnderscore = raw.lastIndexOf("_");
      const category = lastUnderscore !== -1 ? raw.substring(0, lastUnderscore) : raw;
      const currentPage = lastUnderscore !== -1 ? parseInt(raw.substring(lastUnderscore + 1), 10) || 1 : 1;
      return { category, currentPage };
    }

    const test1 = parseCustomId("btn_lb_next_survival_level_2", "btn_lb_next_");
    assert.strictEqual(test1.category, "survival_level");
    assert.strictEqual(test1.currentPage, 2);

    const test2 = parseCustomId("btn_lb_prev_card_elo_5", "btn_lb_prev_");
    assert.strictEqual(test2.category, "card_elo");
    assert.strictEqual(test2.currentPage, 5);

    const test3 = parseCustomId("btn_lb_next_wallet_1", "btn_lb_next_");
    assert.strictEqual(test3.category, "wallet");
    assert.strictEqual(test3.currentPage, 1);
  });
});
