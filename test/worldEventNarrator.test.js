"use strict";

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");

const WorldEventNarrator = require("../src/services/worldEventNarrator");
const { defaultEventNarrator } = require("../src/services/worldEventNarrator");
const aiEnsembleRouter = require("../src/ai/aiEnsembleRouter");

describe("WorldEventNarrator Suite", () => {
  let originalGenerate;

  beforeEach(() => {
    originalGenerate = aiEnsembleRouter.generate;
  });

  afterEach(() => {
    aiEnsembleRouter.generate = originalGenerate;
  });

  describe("TC-WEN-01: Instantiation and Supported Narrative Styles", () => {
    it("should instantiate with default configuration", () => {
      const narrator = new WorldEventNarrator();
      assert.strictEqual(narrator.narratorId, "default_narrator");
      assert.strictEqual(narrator.name, "AI Lore Narrator");
      assert.ok(narrator.eventTemplates instanceof Map);
      assert.strictEqual(narrator.eventTemplates.size, 0);

      // Verify all 5 supported narrative styles exist
      assert.ok(narrator.narrativeStyles.epic);
      assert.ok(narrator.narrativeStyles.mysterious);
      assert.ok(narrator.narrativeStyles.cheerful);
      assert.ok(narrator.narrativeStyles.dramatic);
      assert.ok(narrator.narrativeStyles.poetic);
    });

    it("should instantiate with custom configuration", () => {
      const narrator = new WorldEventNarrator("chronicler_arch", {
        name: "Arch Chronicler Eldrin",
      });

      assert.strictEqual(narrator.narratorId, "chronicler_arch");
      assert.strictEqual(narrator.name, "Arch Chronicler Eldrin");
    });

    it("should export defaultEventNarrator singleton instance", () => {
      assert.ok(defaultEventNarrator instanceof WorldEventNarrator);
      assert.strictEqual(defaultEventNarrator.narratorId, "default_narrator");
    });
  });

  describe("TC-WEN-02: Custom Event Template Registration", () => {
    it("should register custom event templates into internal Map", () => {
      const narrator = new WorldEventNarrator("template_narrator");
      const templateStr = "Di bawah langit gerhana {location}, {participants} bertempur!";

      narrator.registerEventTemplate("solar_eclipse", templateStr);

      assert.ok(narrator.eventTemplates.has("solar_eclipse"));
      assert.strictEqual(narrator.eventTemplates.get("solar_eclipse"), templateStr);
    });
  });

  describe("TC-WEN-03: Simulated Procedural Narration Across Event Types", () => {
    it("should generate simulated narration for boss_defeat in epic style", () => {
      const narrator = new WorldEventNarrator();
      const res = narrator._generateSimulatedNarration(
        "boss_defeat",
        ["Alice", "Bob"],
        "victory",
        "epic",
        "Gunung Api Purba"
      );

      assert.ok(res.title.includes("Gunung Api Purba"));
      assert.ok(res.text.includes("Alice, Bob"));
      assert.ok(res.text.includes("menumbangkan"));
    });

    it("should generate simulated narration for boss_defeat in dramatic style", () => {
      const narrator = new WorldEventNarrator();
      const res = narrator._generateSimulatedNarration(
        "boss_defeat",
        ["Hero"],
        "victory",
        "dramatic",
        "Lembah Bayangan"
      );

      assert.ok(res.title.includes("Lembah Bayangan"));
      assert.ok(res.text.includes("Hero"));
      assert.ok(res.text.includes("Darah dan keringat"));
    });

    it("should generate simulated narration for festival in cheerful style", () => {
      const narrator = new WorldEventNarrator();
      const res = narrator._generateSimulatedNarration(
        "festival",
        ["Warga Desa"],
        "success",
        "cheerful",
        "Alun-alun Kota"
      );

      assert.ok(res.title.includes("Alun-alun Kota"));
      assert.ok(res.text.includes("Sorak sorai"));
    });

    it("should generate simulated narration for trade_milestone event", () => {
      const narrator = new WorldEventNarrator();
      const res = narrator._generateSimulatedNarration(
        "trade_milestone",
        ["Pedagang Kaya"],
        "profit",
        "epic",
        "Pasar Pusat"
      );

      assert.ok(res.title.includes("Era Kemakmuran Ekonomi"));
      assert.ok(res.text.includes("Pasar Pusat"));
    });

    it("should generate simulated narration for generic fallback events", () => {
      const narrator = new WorldEventNarrator();
      const res = narrator._generateSimulatedNarration(
        "unknown_event_type",
        [],
        "done",
        "epic",
        "Hutan Belantara"
      );

      assert.ok(res.title.includes("Hutan Belantara"));
      assert.ok(res.text.includes("para petualang pemberani"));
    });
  });

  describe("TC-WEN-04: Narration Contract and Dual Signatures", () => {
    it("should support Signature 1: narrateWorldEvent(guildId, eventData, narrativeStyle)", async () => {
      const narrator = new WorldEventNarrator("sig1_narrator");
      const eventData = {
        type: "dungeon_clear",
        location: "Katakombe Sunyi",
        participants: ["Kael", "Lyra"],
        outcome: "cleared",
      };

      const res = await narrator.narrateWorldEvent("guild_12345", eventData, "epic");

      assert.strictEqual(res.narratorId, "sig1_narrator");
      assert.strictEqual(res.narratorName, "AI Lore Narrator");
      assert.ok(typeof res.promptPrepared === "string");
      assert.ok(res.promptPrepared.includes("Katakombe Sunyi"));
      assert.ok(typeof res.title === "string");
      assert.ok(typeof res.narration === "string");
      assert.strictEqual(res.narration, res.text);
      assert.strictEqual(res.style, "epic");
      assert.strictEqual(res.embedReady, true);
      assert.strictEqual(res.readyForAiActivation, true);
    });

    it("should support Signature 2: narrateWorldEvent(eventData, narrativeStyle)", async () => {
      const narrator = new WorldEventNarrator("sig2_narrator");
      const eventData = {
        guildId: "guild_67890",
        type: "clan_war",
        location: "Benteng Batu",
        participants: ["Klan Phoenix", "Klan Naga"],
        outcome: "victory",
      };

      const res = await narrator.narrateWorldEvent(eventData, "dramatic");

      assert.strictEqual(res.narratorId, "sig2_narrator");
      assert.strictEqual(res.style, "dramatic");
      assert.ok(res.title.includes("Benteng Batu"));
      assert.strictEqual(res.embedReady, true);
      assert.strictEqual(res.readyForAiActivation, true);
    });
  });

  describe("TC-WEN-05: OpenRouter Active Integration and Story Parsing", () => {
    it("should parse OpenRouter response with 'Judul: ...' format", async () => {
      const narrator = new WorldEventNarrator("ai_narrator");

      aiEnsembleRouter.generate = async () => ({
        text: "Judul: Terbitnya Mentari di Atas Benteng\n\nSetelah malam panjang penuh pertempuran, kabut hitam akhirnya menghilang. Para petualang saling merangkul, menyambut pagi yang damai.",
        provider: "openrouter",
        model: "meta-llama/llama-3.3-70b-instruct:free",
        isPremiumRestricted: false,
      });

      const res = await narrator.narrateWorldEvent("guild_ai", {
        type: "boss_defeat",
        location: "Benteng Utama",
        participants: ["Fighter", "Mage"],
      });

      assert.strictEqual(res.isAiGenerated, true);
      assert.strictEqual(res.title, "Terbitnya Mentari di Atas Benteng");
      assert.ok(res.narration.includes("Setelah malam panjang"));
    });

    it("should parse OpenRouter response with markdown heading '# Title' format", async () => {
      const narrator = new WorldEventNarrator("ai_narrator_md");

      aiEnsembleRouter.generate = async () => ({
        text: "# Penaklukan Puncak Es Abadi\n\nAngin dingin menusuk tulang, tetapi bara semangat mereka tak pernah padam. Di puncak tertinggi, sang naga es akhirnya tunduk.",
        provider: "openrouter",
        isPremiumRestricted: false,
      });

      const res = await narrator.narrateWorldEvent("guild_ai_md", {
        type: "boss_defeat",
        location: "Puncak Es",
      });

      assert.strictEqual(res.isAiGenerated, true);
      assert.strictEqual(res.title, "Penaklukan Puncak Es Abadi");
      assert.ok(res.narration.includes("Angin dingin menusuk tulang"));
    });

    it("should sanitize em-dash characters in title and narration", async () => {
      const narrator = new WorldEventNarrator("ai_narrator_dash");

      aiEnsembleRouter.generate = async () => ({
        text: "Judul: Pertempuran Takdir \u2014 Babak Akhir\n\nPedang mereka beradu \u2014 memancarkan kilat cahaya di kegelapan malam.",
        provider: "openrouter",
        isPremiumRestricted: false,
      });

      const res = await narrator.narrateWorldEvent("guild_dash", {
        type: "boss_defeat",
      });

      assert.strictEqual(res.isAiGenerated, true);
      assert.ok(!res.title.includes("\u2014"));
      assert.ok(res.title.includes("-"));
      assert.ok(!res.narration.includes("\u2014"));
      assert.ok(res.narration.includes("-"));
    });

    it("should gracefully fallback to simulated narration if OpenRouter throws", async () => {
      const narrator = new WorldEventNarrator("ai_narrator_err");

      aiEnsembleRouter.generate = async () => {
        throw new Error("HTTP 500 Internal Server Error");
      };

      const res = await narrator.narrateWorldEvent("guild_err", {
        type: "festival",
        location: "Dermaga Pelabuhan",
      }, "cheerful");

      assert.strictEqual(res.isAiGenerated, false);
      assert.ok(res.title.includes("Dermaga Pelabuhan"));
      assert.strictEqual(res.embedReady, true);
      assert.strictEqual(res.readyForAiActivation, true);
    });
  });

  describe("TC-WEN-06: Error Handling and Edge Case Resilience", () => {
    it("should handle empty eventData object with safe defaults", async () => {
      const narrator = new WorldEventNarrator("empty_narrator");

      const res = await narrator.narrateWorldEvent("guild_empty", {});

      assert.strictEqual(res.narratorId, "empty_narrator");
      assert.ok(res.promptPrepared.includes("Lokasi: Naura Wilds"));
      assert.ok(res.promptPrepared.includes("Partisipan (0): para petualang"));
      assert.strictEqual(res.embedReady, true);
      assert.strictEqual(res.readyForAiActivation, true);
    });

    it("should fallback to epic style when an unknown narrativeStyle is passed", async () => {
      const narrator = new WorldEventNarrator("unknown_style_narrator");

      const res = await narrator.narrateWorldEvent("guild_style", {
        type: "generic",
      }, "non_existent_style");

      assert.strictEqual(res.readyForAiActivation, true);
      assert.ok(res.promptPrepared.includes("Gaya epik seperti kronik kerajaan kuno"));
    });

    it("should handle null or invalid parameters safely", async () => {
      const narrator = new WorldEventNarrator("null_param_narrator");

      const res = await narrator.narrateWorldEvent(null);

      assert.strictEqual(res.narratorId, "null_param_narrator");
      assert.strictEqual(res.embedReady, true);
      assert.strictEqual(res.readyForAiActivation, true);
    });
  });
});
