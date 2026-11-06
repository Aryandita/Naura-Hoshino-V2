"use strict";

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");

const SmartCraftingAdvisor = require("../src/services/smartCraftingAdvisor");
const { defaultCraftingAdvisor } = require("../src/services/smartCraftingAdvisor");
const aiEnsembleRouter = require("../src/ai/aiEnsembleRouter");

describe("SmartCraftingAdvisor Suite", () => {
  let originalGenerate;

  beforeEach(() => {
    originalGenerate = aiEnsembleRouter.generate;
  });

  afterEach(() => {
    aiEnsembleRouter.generate = originalGenerate;
  });

  describe("TC-SCA-01: Instantiation and Configuration Defaults", () => {
    it("should instantiate with default configuration", () => {
      const advisor = new SmartCraftingAdvisor();
      assert.strictEqual(advisor.advisorId, "default_advisor");
      assert.strictEqual(advisor.name, "AI Crafting Master");
      assert.deepStrictEqual(advisor.recipeDatabase, []);
      assert.ok(advisor.serverTrends instanceof Map);
      assert.strictEqual(advisor.serverTrends.size, 0);
    });

    it("should instantiate with custom configuration", () => {
      const customRecipes = [{ id: "mithril_armor", name: "Mithril Armor" }];
      const advisor = new SmartCraftingAdvisor("advisor_hephaestus", {
        name: "Master Hephaestus",
        recipeDatabase: customRecipes,
      });

      assert.strictEqual(advisor.advisorId, "advisor_hephaestus");
      assert.strictEqual(advisor.name, "Master Hephaestus");
      assert.strictEqual(advisor.recipeDatabase.length, 1);
      assert.strictEqual(advisor.recipeDatabase[0].id, "mithril_armor");
    });

    it("should export defaultCraftingAdvisor singleton instance", () => {
      assert.ok(defaultCraftingAdvisor instanceof SmartCraftingAdvisor);
      assert.strictEqual(defaultCraftingAdvisor.advisorId, "default_advisor");
    });
  });

  describe("TC-SCA-02: Level Filtering and Material Matching", () => {
    it("should filter basic recipes strictly by player level 1 (common only)", () => {
      const advisor = new SmartCraftingAdvisor();
      const suggestions = advisor._generateSimulatedSuggestions([], 1);

      assert.ok(Array.isArray(suggestions));
      assert.ok(suggestions.length <= 3);

      for (const recipe of suggestions) {
        assert.strictEqual(recipe.rarity, "common");
        assert.ok(recipe.name);
        assert.ok(recipe.materials);
        assert.ok(recipe.benefit);
      }
    });

    it("should unlock uncommon recipes for player level 5 and above", () => {
      const advisor = new SmartCraftingAdvisor();
      const suggestions = advisor._generateSimulatedSuggestions([], 5);

      assert.ok(Array.isArray(suggestions));
      assert.strictEqual(suggestions.length, 3);

      const rarities = suggestions.map((r) => r.rarity);
      assert.ok(rarities.includes("uncommon") || rarities.includes("common"));
    });

    it("should unlock rare recipes for player level 10 and above", () => {
      const advisor = new SmartCraftingAdvisor();
      const suggestions = advisor._generateSimulatedSuggestions([], 10);

      assert.ok(Array.isArray(suggestions));
      assert.strictEqual(suggestions.length, 3);

      const names = suggestions.map((r) => r.name);
      assert.ok(names.includes("Steel Broadsword") || names.includes("Health Potion"));
    });

    it("should format procedural explanation based on top recommendation", () => {
      const advisor = new SmartCraftingAdvisor();
      const mockSuggestions = [
        { name: "Pedang Perak", rarity: "rare", benefit: "+30 ATK" },
      ];

      const explanation = advisor._generateExplanation(mockSuggestions);
      assert.ok(explanation.includes("Pedang Perak"));
      assert.ok(explanation.includes("prioritas"));

      const emptyExplanation = advisor._generateExplanation([]);
      assert.strictEqual(emptyExplanation, "Material Anda belum cukup untuk crafting.");
    });
  });

  describe("TC-SCA-03: Server Trend Tracking and Bonus Detection", () => {
    it("should increment recipe craft counts in server trends map", () => {
      const advisor = new SmartCraftingAdvisor("trend_advisor");

      advisor.updateServerTrend("Iron Sword");
      assert.strictEqual(advisor.serverTrends.get("Iron Sword"), 1);

      advisor.updateServerTrend("Iron Sword", 4);
      assert.strictEqual(advisor.serverTrends.get("Iron Sword"), 5);

      advisor.updateServerTrend("Health Potion", 2);
      assert.strictEqual(advisor.serverTrends.get("Health Potion"), 2);
    });

    it("should detect trend bonus only when craft count strictly exceeds 10", () => {
      const advisor = new SmartCraftingAdvisor("trend_advisor");
      const mockSuggestions = [{ name: "Iron Sword" }];

      // Count <= 10 -> trendBonus: false
      advisor.updateServerTrend("Iron Sword", 10);
      assert.strictEqual(advisor._checkServerTrend(mockSuggestions), false);

      // Count 11 (> 10) -> trendBonus: true
      advisor.updateServerTrend("Iron Sword", 1);
      assert.strictEqual(advisor._checkServerTrend(mockSuggestions), true);
    });

    it("should reflect trend bonus in generateCraftingSuggestions output", async () => {
      const advisor = new SmartCraftingAdvisor("trend_advisor");
      advisor.updateServerTrend("Health Potion", 15);

      const res = await advisor.generateCraftingSuggestions("user_trend", { herb: 10, water: 5 }, { level: 1 });

      assert.strictEqual(res.trendBonus, true);
      assert.ok(res.suggestions.some((s) => s.name === "Health Potion"));
    });
  });

  describe("TC-SCA-04: Suggestion Generation Contract and Inventory Formats", () => {
    it("should accept playerInventory as an Object with amounts", async () => {
      const advisor = new SmartCraftingAdvisor("format_advisor");
      const inventoryObj = {
        iron_ore: 5,
        wood: 3,
        herb: 2,
      };

      const res = await advisor.generateCraftingSuggestions("user_obj", inventoryObj, { level: 5 });

      assert.strictEqual(res.advisorId, "format_advisor");
      assert.strictEqual(res.advisorName, "AI Crafting Master");
      assert.ok(typeof res.promptPrepared === "string");
      assert.ok(res.promptPrepared.includes("iron_ore"));
      assert.ok(Array.isArray(res.suggestions));
      assert.ok(res.suggestions.length > 0);
      assert.ok(typeof res.explanation === "string");
      assert.strictEqual(res.readyForAiActivation, true);
    });

    it("should accept playerInventory as an Array of items", async () => {
      const advisor = new SmartCraftingAdvisor("format_advisor");
      const inventoryArr = [
        { name: "iron_ore", amount: 4 },
        { id: "leather", amount: 2 },
      ];

      const res = await advisor.generateCraftingSuggestions("user_arr", inventoryArr, { level: 5 });

      assert.strictEqual(res.advisorId, "format_advisor");
      assert.ok(res.promptPrepared.includes("iron_ore"));
      assert.ok(Array.isArray(res.suggestions));
      assert.strictEqual(res.readyForAiActivation, true);
    });
  });

  describe("TC-SCA-05: OpenRouter Active Integration and JSON Response Parsing", () => {
    it("should parse pure JSON array returned from OpenRouter", async () => {
      const advisor = new SmartCraftingAdvisor("ai_advisor");

      aiEnsembleRouter.generate = async () => ({
        text: JSON.stringify([
          {
            name: "Dragon Slayer Katana",
            materials: "Dragon Bone x3, Fire Core x1",
            rarity: "Mythic",
            benefit: "+150 Serangan Api",
          },
        ]),
        provider: "openrouter",
        model: "deepseek/deepseek-chat:free",
        isPremiumRestricted: false,
      });

      const res = await advisor.generateCraftingSuggestions("user_ai", { dragon_bone: 3 }, { level: 20 });

      assert.strictEqual(res.isAiGenerated, true);
      assert.strictEqual(res.suggestions.length, 1);
      assert.strictEqual(res.suggestions[0].name, "Dragon Slayer Katana");
      assert.strictEqual(res.suggestions[0].rarity, "Mythic");
      assert.ok(res.explanation.includes("Dragon Slayer Katana"));
    });

    it("should extract JSON array enclosed in markdown fences from OpenRouter", async () => {
      const advisor = new SmartCraftingAdvisor("ai_advisor_fences");

      aiEnsembleRouter.generate = async () => ({
        text: "```json\n[\n  {\n    \"name\": \"Tongkat Petir Elven\",\n    \"materials\": \"Kayu Purba x2, Permata Listrik x1\",\n    \"rarity\": \"Epic\",\n    \"benefit\": \"+80 Serangan Listrik\"\n  }\n]\n```",
        provider: "openrouter",
        isPremiumRestricted: false,
      });

      const res = await advisor.generateCraftingSuggestions("user_fences", { wood: 5 }, { level: 15 });

      assert.strictEqual(res.isAiGenerated, true);
      assert.strictEqual(res.suggestions.length, 1);
      assert.strictEqual(res.suggestions[0].name, "Tongkat Petir Elven");
      assert.strictEqual(res.suggestions[0].rarity, "Epic");
    });

    it("should sanitize em-dash characters in AI generated craft suggestions", async () => {
      const advisor = new SmartCraftingAdvisor("ai_advisor_dash");

      aiEnsembleRouter.generate = async () => ({
        text: JSON.stringify([
          {
            name: "Zirah Obsidian \u2014 Edisi Terbatas",
            materials: "Obsidian x5 \u2014 Murni",
            rarity: "Legendary \u2014 Unik",
            benefit: "Ketahanan absolut \u2014 tanpa batas",
          },
        ]),
        provider: "openrouter",
        isPremiumRestricted: false,
      });

      const res = await advisor.generateCraftingSuggestions("user_dash", { obsidian: 5 }, { level: 25 });

      assert.strictEqual(res.isAiGenerated, true);
      assert.ok(!res.suggestions[0].name.includes("\u2014"));
      assert.ok(!res.suggestions[0].materials.includes("\u2014"));
      assert.ok(!res.suggestions[0].rarity.includes("\u2014"));
      assert.ok(!res.suggestions[0].benefit.includes("\u2014"));
      assert.ok(!res.explanation.includes("\u2014"));
    });

    it("should gracefully fallback to simulated suggestions if OpenRouter throws", async () => {
      const advisor = new SmartCraftingAdvisor("ai_advisor_err");

      aiEnsembleRouter.generate = async () => {
        throw new Error("HTTP 503 Service Unavailable");
      };

      const res = await advisor.generateCraftingSuggestions("user_err", { herb: 5 }, { level: 1 });

      assert.strictEqual(res.isAiGenerated, false);
      assert.ok(Array.isArray(res.suggestions));
      assert.strictEqual(res.readyForAiActivation, true);
      assert.ok(res.suggestions.length > 0);
    });
  });

  describe("TC-SCA-06: Error Handling and Edge Case Resilience", () => {
    it("should handle empty player inventory gracefully without throwing", async () => {
      const advisor = new SmartCraftingAdvisor("empty_advisor");

      const res = await advisor.generateCraftingSuggestions("user_empty", {});

      assert.strictEqual(res.advisorId, "empty_advisor");
      assert.ok(res.promptPrepared.includes("Material tersedia: tidak ada"));
      assert.ok(Array.isArray(res.suggestions));
      assert.strictEqual(res.readyForAiActivation, true);
    });

    it("should handle undefined craftingContext with safe defaults", async () => {
      const advisor = new SmartCraftingAdvisor("default_ctx_advisor");

      const res = await advisor.generateCraftingSuggestions("user_ctx", { iron_ore: 2 });

      assert.strictEqual(res.readyForAiActivation, true);
      assert.ok(res.promptPrepared.includes("Level pemain: 1"));
      assert.ok(Array.isArray(res.suggestions));
    });

    it("should handle null craftingContext gracefully with safe fallback", async () => {
      const advisor = new SmartCraftingAdvisor("null_ctx_advisor");

      const res = await advisor.generateCraftingSuggestions("user_null_ctx", { iron_ore: 2 }, null);

      assert.strictEqual(res.readyForAiActivation, false);
      assert.strictEqual(res.advisorId, "null_ctx_advisor");
      assert.strictEqual(res.explanation, "Maaf, saya tidak dapat memberikan saran saat ini.");
    });

    it("should handle null player inventory safely", async () => {
      const advisor = new SmartCraftingAdvisor("null_inv_advisor");

      const res = await advisor.generateCraftingSuggestions("user_null_inv", null);

      assert.strictEqual(res.readyForAiActivation, true);
      assert.ok(Array.isArray(res.suggestions));
    });
  });
});
