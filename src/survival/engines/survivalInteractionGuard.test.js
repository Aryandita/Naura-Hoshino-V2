"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const consumeSub = require("../../../plugin/survival/subcommands/consume");
const cacheManager = require("../../managers/cacheManager");

describe("Survival Subcommands Interaction Defer Guard", () => {
  it("otomatis memanggil deferUpdate saat menerima ButtonInteraction yang belum di-defer", async () => {
    let deferUpdateCalled = false;
    let editReplyCalled = false;

    // Mock cacheManager
    const originalGetUserProfile = cacheManager.getUserProfile;
    const originalGetUserSurvival = cacheManager.getUserSurvival;

    cacheManager.getUserProfile = async () => ({
      inventory: JSON.stringify([{ id: "apple", amount: 2 }]),
    });
    cacheManager.getUserSurvival = async () => ({
      hunger: 50,
      thirst: 50,
      stamina: 50,
    });

    try {
      const mockInteraction = {
        deferred: false,
        replied: false,
        user: {
          id: "test-user-123",
          displayName: "Tester",
          username: "tester",
          displayAvatarURL: () => "https://example.com/avatar.png",
        },
        async deferUpdate() {
          deferUpdateCalled = true;
          this.deferred = true;
        },
        async editReply(payload) {
          assert.strictEqual(this.deferred, true);
          editReplyCalled = true;
          return {
            createMessageComponentCollector: () => ({
              on: () => {},
            }),
          };
        },
      };

      await consumeSub.execute(mockInteraction);

      assert.strictEqual(deferUpdateCalled, true);
      assert.strictEqual(editReplyCalled, true);
    } finally {
      cacheManager.getUserProfile = originalGetUserProfile;
      cacheManager.getUserSurvival = originalGetUserSurvival;
    }
  });

  it("otomatis memanggil deferReply saat menerima ChatInputCommandInteraction yang belum di-defer", async () => {
    let deferReplyCalled = false;
    let editReplyCalled = false;

    const originalGetUserProfile = cacheManager.getUserProfile;
    const originalGetUserSurvival = cacheManager.getUserSurvival;

    cacheManager.getUserProfile = async () => ({
      inventory: JSON.stringify([]),
    });
    cacheManager.getUserSurvival = async () => ({
      hunger: 50,
      thirst: 50,
      stamina: 50,
    });

    try {
      const mockInteraction = {
        deferred: false,
        replied: false,
        user: {
          id: "test-user-456",
          displayName: "Tester2",
          username: "tester2",
          displayAvatarURL: () => "https://example.com/avatar.png",
        },
        async deferReply() {
          deferReplyCalled = true;
          this.deferred = true;
        },
        async editReply(payload) {
          assert.strictEqual(this.deferred, true);
          editReplyCalled = true;
          return {};
        },
      };

      await consumeSub.execute(mockInteraction);

      assert.strictEqual(deferReplyCalled, true);
      assert.strictEqual(editReplyCalled, true);
    } finally {
      cacheManager.getUserProfile = originalGetUserProfile;
      cacheManager.getUserSurvival = originalGetUserSurvival;
    }
  });

  it("tidak memanggil defer ganda jika interaction sudah berstatus deferred", async () => {
    let deferCount = 0;
    let editReplyCalled = false;

    const originalGetUserProfile = cacheManager.getUserProfile;
    const originalGetUserSurvival = cacheManager.getUserSurvival;

    cacheManager.getUserProfile = async () => ({
      inventory: JSON.stringify([]),
    });
    cacheManager.getUserSurvival = async () => ({
      hunger: 50,
      thirst: 50,
      stamina: 50,
    });

    try {
      const mockInteraction = {
        deferred: true,
        replied: false,
        user: {
          id: "test-user-789",
          displayName: "Tester3",
          username: "tester3",
          displayAvatarURL: () => "https://example.com/avatar.png",
        },
        async deferUpdate() {
          deferCount++;
        },
        async deferReply() {
          deferCount++;
        },
        async editReply(payload) {
          editReplyCalled = true;
          return {};
        },
      };

      await consumeSub.execute(mockInteraction);

      assert.strictEqual(deferCount, 0);
      assert.strictEqual(editReplyCalled, true);
    } finally {
      cacheManager.getUserProfile = originalGetUserProfile;
      cacheManager.getUserSurvival = originalGetUserSurvival;
    }
  });
});
