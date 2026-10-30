"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const hub = require("./hub");
const survival = require("../survival");
const cacheManager = require("../../../src/managers/cacheManager");

describe("Survival Command Center Hub (Components V2)", () => {
  it("renders onboarding prompt when player has not started", async () => {
    const origGetProfile = cacheManager.getUserProfile;
    cacheManager.getUserProfile = async () => ({
      inventory: JSON.stringify([]),
    });

    try {
      let result = null;
      const mockInteraction = {
        user: { id: "user_unstarted_123", username: "Newbie", displayAvatarURL: () => "https://example.com/avatar.png" },
        localeLang: "id",
        deferred: true,
        replied: false,
        editReply: async (payload) => {
          result = payload;
          return payload;
        },
      };

      await hub.execute(mockInteraction);
      assert.ok(result);
      assert.ok(result.components);
      assert.ok(result.flags);
    } finally {
      cacheManager.getUserProfile = origGetProfile;
    }
  });

  it("renders 5-layer Container V2 with 2 rows of action buttons for started player", async () => {
    const origGetProfile = cacheManager.getUserProfile;
    const origGetSurvival = cacheManager.getUserSurvival;

    cacheManager.getUserProfile = async () => ({
      inventory: JSON.stringify([{ id: "survival_started" }]),
      cash: 25000,
    });
    cacheManager.getUserSurvival = async () => ({
      health: 100,
      energy: 90,
      hunger: 80,
      thirst: 75,
      currentLocation: "Desa Sukamaju",
    });

    try {
      let result = null;
      const mockInteraction = {
        user: {
          id: "user_started_456",
          username: "Adventurer",
          displayName: "Kak Adventurer",
          displayAvatarURL: () => "https://example.com/avatar.png",
        },
        localeLang: "id",
        deferred: true,
        replied: false,
        editReply: async (payload) => {
          result = payload;
          return payload;
        },
      };

      await hub.execute(mockInteraction);
      assert.ok(result);
      assert.ok(result.components);
      assert.equal(result.components[0].type, 17); // Container V2

      const container = result.components[0];
      const actionRows = container.components.filter((c) => c.type === 1);
      assert.equal(actionRows.length, 2);

      // Row 1 buttons: Inventaris, Tambang, Tebang, Mancing, Jelajah
      const row1Labels = actionRows[0].components.map((b) => b.label);
      assert.deepEqual(row1Labels, [
        "Inventaris",
        "Tambang",
        "Tebang",
        "Mancing",
        "Jelajah",
      ]);

      // Row 2 buttons: Dungeon, Toko, Tempa & Craft, Quest, Status Lengkap
      const row2Labels = actionRows[1].components.map((b) => b.label);
      assert.deepEqual(row2Labels, [
        "Dungeon",
        "Toko",
        "Tempa & Craft",
        "Quest",
        "Status Lengkap",
      ]);
    } finally {
      cacheManager.getUserProfile = origGetProfile;
      cacheManager.getUserSurvival = origGetSurvival;
    }
  });

  it("routes prefix command n!survival with empty args to hub", async () => {
    const origGetProfile = cacheManager.getUserProfile;
    const origGetSurvival = cacheManager.getUserSurvival;
    
    cacheManager.getUserProfile = async () => ({
      inventory: JSON.stringify([{ id: "survival_started" }]),
      cash: 10000,
    });
    cacheManager.getUserSurvival = async () => ({
      health: 100,
      energy: 100,
      hunger: 100,
      thirst: 100,
      currentLocation: "Desa Sukamaju",
    });

    try {
      let capturedPayload = null;
      const mockMessage = {
        author: { id: "user_prefix_789", username: "PrefixTester", displayAvatarURL: () => "https://example.com/avatar.png" },
        channel: { send: async () => {} },
        reply: async (payload) => {
          capturedPayload = payload;
          return {
            edit: async (edited) => {
              capturedPayload = edited;
              return edited;
            },
          };
        },
      };

      await survival.executePrefix(mockMessage, [], {});
      assert.ok(capturedPayload);
      assert.ok(capturedPayload.components);
    } finally {
      cacheManager.getUserProfile = origGetProfile;
      cacheManager.getUserSurvival = origGetSurvival;
    }
  });
});
