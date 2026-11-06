"use strict";

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");

const DynamicMerchantTrader = require("../src/services/dynamicMerchantTrader");
const { defaultMerchantTrader } = require("../src/services/dynamicMerchantTrader");
const aiEnsembleRouter = require("../src/ai/aiEnsembleRouter");

describe("DynamicMerchantTrader Suite", () => {
  let originalGenerate;

  beforeEach(() => {
    originalGenerate = aiEnsembleRouter.generate;
  });

  afterEach(() => {
    aiEnsembleRouter.generate = originalGenerate;
  });

  describe("TC-DMT-01: Instantiation and Configuration Defaults", () => {
    it("should instantiate with default configuration", () => {
      const merchant = new DynamicMerchantTrader();
      assert.strictEqual(merchant.merchantId, "default_merchant");
      assert.strictEqual(merchant.name, "Pedagang Desa");
      assert.strictEqual(merchant.specialty, "general");
      assert.strictEqual(merchant.greetingStyle, "ramah");
      assert.strictEqual(merchant.priceMultiplier, 1.0);
      assert.ok(merchant.transactionMemory instanceof Map);
      assert.strictEqual(merchant.transactionMemory.size, 0);
    });

    it("should instantiate with custom configuration", () => {
      const customConfig = {
        name: "Garrick si Pandai Besi",
        specialty: "weapons",
        greetingStyle: "tegas dan lugas",
        priceMultiplier: 1.25,
      };
      const merchant = new DynamicMerchantTrader("merchant_garrick", customConfig);
      assert.strictEqual(merchant.merchantId, "merchant_garrick");
      assert.strictEqual(merchant.name, "Garrick si Pandai Besi");
      assert.strictEqual(merchant.specialty, "weapons");
      assert.strictEqual(merchant.greetingStyle, "tegas dan lugas");
      assert.strictEqual(merchant.priceMultiplier, 1.25);
    });

    it("should export defaultMerchantTrader singleton instance", () => {
      assert.ok(defaultMerchantTrader instanceof DynamicMerchantTrader);
      assert.strictEqual(defaultMerchantTrader.merchantId, "default_merchant");
    });
  });

  describe("TC-DMT-02: Price and Discount Calculations", () => {
    it("should calculate base price with zero reputation and zero transactions", () => {
      const merchant = new DynamicMerchantTrader("pricing_merchant");
      const price = merchant._calculateAdjustedPrice(100, 0, 0);
      assert.strictEqual(price, 100);
    });

    it("should calculate progressive loyalty discount up to 15% cap", () => {
      const merchant = new DynamicMerchantTrader("pricing_merchant");
      // 5 tx * 0.02 = 0.10 discount -> 90
      const price5 = merchant._calculateAdjustedPrice(100, 0, 5);
      assert.strictEqual(price5, 90);

      // 10 tx * 0.02 = 0.20 -> capped at 0.15 discount -> 85
      const price10 = merchant._calculateAdjustedPrice(100, 0, 10);
      assert.strictEqual(price10, 85);

      // 30 tx -> still capped at 0.15 discount -> 85
      const price30 = merchant._calculateAdjustedPrice(100, 0, 30);
      assert.strictEqual(price30, 85);
    });

    it("should calculate progressive reputation bonus up to 10% cap", () => {
      const merchant = new DynamicMerchantTrader("pricing_merchant");
      // 50 rep * 0.001 = 0.05 bonus -> 95
      const price50 = merchant._calculateAdjustedPrice(100, 50, 0);
      assert.strictEqual(price50, 95);

      // 100 rep * 0.001 = 0.10 bonus -> 90
      const price100 = merchant._calculateAdjustedPrice(100, 100, 0);
      assert.strictEqual(price100, 90);

      // 300 rep -> capped at 0.10 bonus -> 90
      const price300 = merchant._calculateAdjustedPrice(100, 300, 0);
      assert.strictEqual(price300, 90);
    });

    it("should combine loyalty and reputation discounts (max 25% combined)", () => {
      const merchant = new DynamicMerchantTrader("pricing_merchant");
      // tx 10 (0.15) + rep 100 (0.10) -> total discount 0.25 -> multiplier 0.75 -> 75
      const combinedPrice = merchant._calculateAdjustedPrice(100, 100, 10);
      assert.strictEqual(combinedPrice, 75);
    });

    it("should enforce the minimum floor multiplier limit of 0.7x", () => {
      // priceMultiplier 0.8 * (1 - 0.25) = 0.60 -> floored to 0.70 -> 70
      const merchant = new DynamicMerchantTrader("discounted_merchant", {
        priceMultiplier: 0.8,
      });
      const flooredPrice = merchant._calculateAdjustedPrice(100, 100, 10);
      assert.strictEqual(flooredPrice, 70);
    });
  });

  describe("TC-DMT-03: Transaction Memory Recording", () => {
    it("should record transactions into memory with timestamps", () => {
      const merchant = new DynamicMerchantTrader("memory_merchant");
      const userId = "user_test_123";

      merchant.recordTransaction(userId, { item: "iron_sword", price: 150 });
      assert.ok(merchant.transactionMemory.has(userId));

      const records = merchant.transactionMemory.get(userId);
      assert.strictEqual(records.length, 1);
      assert.strictEqual(records[0].item, "iron_sword");
      assert.strictEqual(records[0].price, 150);
      assert.ok(typeof records[0].timestamp === "number");
      assert.ok(records[0].timestamp > 0);

      merchant.recordTransaction(userId, { item: "health_potion", price: 25 });
      assert.strictEqual(records.length, 2);
      assert.strictEqual(records[1].item, "health_potion");
    });

    it("should influence repeat transaction pricing via memory history", async () => {
      const merchant = new DynamicMerchantTrader("memory_merchant");
      const userId = "loyal_trader_456";

      // Initial trade without previous history
      const firstTrade = await merchant.generateTradeInteraction(userId, "buy", {
        name: "Batu Permata",
        basePrice: 1000,
      });
      assert.strictEqual(firstTrade.adjustedPrice, 1000);

      // Record 10 transactions to hit the 15% max loyalty discount
      for (let i = 0; i < 10; i++) {
        merchant.recordTransaction(userId, { item: "ore", price: 50 });
      }

      // Next trade should reflect loyalty discount (1000 * 0.85 = 850)
      const repeatTrade = await merchant.generateTradeInteraction(userId, "buy", {
        name: "Batu Permata",
        basePrice: 1000,
      });
      assert.strictEqual(repeatTrade.adjustedPrice, 850);
    });
  });

  describe("TC-DMT-04: Trade Actions and Procedural Dialogue Fallbacks", () => {
    it("should return valid contract shape on standard trade actions", async () => {
      const merchant = new DynamicMerchantTrader("action_merchant");
      const actions = ["buy", "sell", "bargain", "inquire", "unknown_action"];

      for (const action of actions) {
        const res = await merchant.generateTradeInteraction("user_action", action, {
          name: "Belati Besi",
          basePrice: 200,
        });

        assert.strictEqual(res.merchantId, "action_merchant");
        assert.strictEqual(res.merchantName, "Pedagang Desa");
        assert.ok(typeof res.promptPrepared === "string");
        assert.ok(res.promptPrepared.includes("Belati Besi"));
        assert.ok(typeof res.dialogue === "string");
        assert.ok(res.dialogue.length > 0);
        assert.strictEqual(res.dealAccepted, true);
        assert.strictEqual(res.readyForAiActivation, true);
      }
    });

    it("should generate proper simulated dialogue for each trade action", () => {
      const merchant = new DynamicMerchantTrader();

      assert.strictEqual(
        merchant._generateSimulatedDialogue("buy", "Potion"),
        "Tentu, Potion tersedia! Harga spesial untukmu."
      );
      assert.strictEqual(
        merchant._generateSimulatedDialogue("sell", "Kayu"),
        "Saya bisa beli Kayu darimu dengan harga wajar."
      );
      assert.strictEqual(
        merchant._generateSimulatedDialogue("bargain", "Zirah"),
        "Hmm, mari kita negosiasi. Saya beri diskon kecil karena kamu pelanggan setia."
      );
      assert.strictEqual(
        merchant._generateSimulatedDialogue("inquire", "Peta"),
        "Peta? Kualitas terbaik dari supplier terpercaya!"
      );
      assert.strictEqual(
        merchant._generateSimulatedDialogue("unknown", "Barang"),
        "Ada yang bisa saya bantu hari ini?"
      );
    });
  });

  describe("TC-DMT-05: OpenRouter Active Integration and Response Normalization", () => {
    it("should parse and normalize valid OpenRouter response", async () => {
      const merchant = new DynamicMerchantTrader("ai_merchant");

      // Mock aiEnsembleRouter.generate to simulate successful OpenRouter response
      aiEnsembleRouter.generate = async () => ({
        text: '"Pilihan yang sangat bijak! Pedang ini dibuat dengan baja pilihan desa."',
        provider: "openrouter",
        model: "meta-llama/llama-3.3-70b-instruct:free",
        isPremiumRestricted: false,
      });

      const res = await merchant.generateTradeInteraction("user_ai", "buy", {
        name: "Pedang Damaskus",
        basePrice: 500,
      });

      assert.strictEqual(res.isAiGenerated, true);
      assert.strictEqual(
        res.dialogue,
        "Pilihan yang sangat bijak! Pedang ini dibuat dengan baja pilihan desa."
      );
      assert.strictEqual(res.simulatedDialogue, res.dialogue);
      assert.strictEqual(res.dealAccepted, true);
    });

    it("should sanitize em-dash characters from AI responses", async () => {
      const merchant = new DynamicMerchantTrader("sanitize_merchant");

      aiEnsembleRouter.generate = async () => ({
        text: "Pedang ini sangat tajam \u2014 dibuat langsung oleh pandai besi legendaris.",
        provider: "openrouter",
        isPremiumRestricted: false,
      });

      const res = await merchant.generateTradeInteraction("user_dash", "inquire", {
        name: "Pedang Mistis",
        basePrice: 750,
      });

      assert.strictEqual(res.isAiGenerated, true);
      assert.ok(!res.dialogue.includes("\u2014"));
      assert.ok(res.dialogue.includes("-"));
    });

    it("should gracefully fallback to procedural dialogue when OpenRouter throws", async () => {
      const merchant = new DynamicMerchantTrader("fallback_merchant");

      aiEnsembleRouter.generate = async () => {
        throw new Error("HTTP 429 Rate Limit Exceeded");
      };

      const res = await merchant.generateTradeInteraction("user_err", "buy", {
        name: "Ramuan Penyembuh",
        basePrice: 150,
      });

      assert.strictEqual(res.isAiGenerated, false);
      assert.strictEqual(
        res.dialogue,
        "Tentu, Ramuan Penyembuh tersedia! Harga spesial untukmu."
      );
      assert.strictEqual(res.dealAccepted, true);
      assert.strictEqual(res.readyForAiActivation, true);
    });

    it("should fallback to procedural dialogue when AI response is empty or from fallback provider", async () => {
      const merchant = new DynamicMerchantTrader("fallback_provider_merchant");

      aiEnsembleRouter.generate = async () => ({
        text: "   ",
        provider: "fallback",
        isPremiumRestricted: false,
      });

      const res = await merchant.generateTradeInteraction("user_fb", "sell", {
        name: "Biji Besi",
        basePrice: 80,
      });

      assert.strictEqual(res.isAiGenerated, false);
      assert.strictEqual(
        res.dialogue,
        "Saya bisa beli Biji Besi darimu dengan harga wajar."
      );
    });
  });

  describe("TC-DMT-06: Error Handling and Edge Case Resilience", () => {
    it("should handle null playerProfile without crashing and return safe fallback", async () => {
      const merchant = new DynamicMerchantTrader("edge_merchant");

      const res = await merchant.generateTradeInteraction("user_null_profile", "buy", {
        name: "Tameng Kayu",
        basePrice: 120,
      }, null);

      assert.strictEqual(res.merchantId, "edge_merchant");
      assert.strictEqual(res.dealAccepted, false);
      assert.strictEqual(res.readyForAiActivation, false);
      assert.strictEqual(res.dialogue, "Selamat datang di toko saya!");
    });

    it("should handle undefined and empty itemData with safe defaults", async () => {
      const merchant = new DynamicMerchantTrader("edge_merchant");

      const res = await merchant.generateTradeInteraction("user_empty_item", "inquire");

      assert.strictEqual(res.dealAccepted, true);
      assert.strictEqual(res.adjustedPrice, 100); // Default basePrice 100
      assert.ok(res.dialogue.includes("Barang itu") || res.dialogue.includes("barang"));
    });
  });
});
