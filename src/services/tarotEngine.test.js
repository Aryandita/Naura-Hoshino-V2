"use strict";

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const tarotEngine = require("./tarotEngine");
const cacheManager = require("../managers/cacheManager");

describe("Astral Tarot Spread Engine", () => {
  let originalMutateUserSurvivalJson;
  let originalGetUserSurvival;
  let mutatedState = null;

  beforeEach(() => {
    originalMutateUserSurvivalJson = cacheManager.mutateUserSurvivalJson;
    originalGetUserSurvival = cacheManager.getUserSurvival;

    cacheManager.mutateUserSurvivalJson = async (userId, field, mutator) => {
      mutatedState = await mutator({});
      return { ok: true, value: mutatedState };
    };

    cacheManager.getUserSurvival = async () => ({
      userId: "test_user_123",
      rpg_state: mutatedState || {},
    });
  });

  afterEach(() => {
    cacheManager.mutateUserSurvivalJson = originalMutateUserSurvivalJson;
    cacheManager.getUserSurvival = originalGetUserSurvival;
    mutatedState = null;
  });

  it("harus memiliki 22 kartu Major Arcana lengkap (nomor 0 hingga 21)", () => {
    const deck = tarotEngine.getMajorArcanaDeck();
    assert.equal(deck.length, 22);

    const numbers = deck.map((c) => c.number).sort((a, b) => a - b);
    assert.deepEqual(numbers, Array.from({ length: 22 }, (_, i) => i));

    // Setiap kartu harus memiliki field wajib termasuk arketipe dan elemen
    for (const card of deck) {
      assert.ok(card.id, "id kartu wajib ada");
      assert.ok(card.name, "name kartu wajib ada");
      assert.ok(card.title, "title kartu wajib ada");
      assert.ok(card.archetype, "archetype kartu wajib ada");
      assert.ok(card.element, "element kartu wajib ada");
      assert.ok(card.uprightMeaning, "uprightMeaning wajib ada");
      assert.ok(card.reversedMeaning, "reversedMeaning wajib ada");
      assert.ok(card.buff && card.buff.type, "buff type wajib ada");
      assert.equal(card.buff.durationHours, 24, "durasi buff wajib 24 jam");
    }
  });

  it("harus menarik 3 kartu unik dalam tebaran (Past, Present, Future)", async () => {
    const result = await tarotEngine.drawThreeCardSpread("test_user_123", {
      bypassCooldown: true,
    });

    assert.equal(result.canDraw, true);
    assert.equal(result.cards.length, 3);

    // Kartu harus unik
    const cardIds = new Set(result.cards.map((c) => c.card.id));
    assert.equal(cardIds.size, 3);

    // Posisi kartu harus tepat
    assert.equal(result.cards[0].position.key, "past");
    assert.equal(result.cards[1].position.key, "present");
    assert.equal(result.cards[2].position.key, "future");

    // Buff aktif harus ada dan berdurasi 24 jam
    assert.ok(result.activeBuff);
    assert.ok(result.activeBuff.type);
    assert.ok(result.activeBuff.bonusPercent > 0);
    assert.equal(result.activeBuff.durationHours, 24);
    assert.ok(result.summaryAdvice.length > 20);

    // Mutasi database harus terpanggil
    assert.ok(mutatedState);
    assert.ok(mutatedState.tarot_reading);
    assert.equal(mutatedState.tarot_buff.id, result.activeBuff.id);
  });

  it("harus mendukung kartu terbalik (~35% chance) dengan deterministik RNG", async () => {
    // RNG < 0.35 menghasilkan kartu terbalik
    const reversedResult = await tarotEngine.drawThreeCardSpread("test_user_123", {
      bypassCooldown: true,
      rng: () => 0.2, // 0.2 < 0.35 -> terbalik
    });

    assert.equal(reversedResult.canDraw, true);
    for (const card of reversedResult.cards) {
      assert.equal(card.isReversed, true);
      assert.match(card.orientation, /Terbalik/);
    }

    // RNG >= 0.35 menghasilkan kartu tegak
    const uprightResult = await tarotEngine.drawThreeCardSpread("test_user_123", {
      bypassCooldown: true,
      rng: () => 0.5, // 0.5 >= 0.35 -> tegak
    });

    assert.equal(uprightResult.canDraw, true);
    for (const card of uprightResult.cards) {
      assert.equal(card.isReversed, false);
      assert.match(card.orientation, /Tegak/);
    }
  });

  it("generateSpreadAdvice harus merangkum ketiga kartu secara benar tanpa em-dash", () => {
    const mockCards = [
      { card: { title: "The Fool" }, orientation: "Tegak (Upright)" },
      { card: { title: "The Magician" }, orientation: "Tegak (Upright)" },
      { card: { title: "The Star" }, orientation: "Tegak (Upright)" },
    ];
    const advice = tarotEngine.generateSpreadAdvice(mockCards);
    assert.match(advice, /The Fool/);
    assert.match(advice, /The Magician/);
    assert.match(advice, /The Star/);
    assert.equal(advice.includes("\u2014"), false, "Nasehat tidak boleh mengandung em-dash");
  });

  it("getActiveTarotBuff harus membaca buff aktif yang tersimpan", async () => {
    await tarotEngine.drawThreeCardSpread("test_user_123", { bypassCooldown: true });
    const active = await tarotEngine.getActiveTarotBuff("test_user_123");
    assert.ok(active);
    assert.ok(active.type);
    assert.ok(active.expiresAt > Date.now());
  });
});
