"use strict";

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { MessageFlags } = require("discord.js");

const notificationCenter = require("../../src/services/notificationCenter");
const {
  generateProgressBar,
  aggregateUserReadiness,
  buildAdventureDigestContainer,
  checkAndDispatchAdventureDigest,
  ensureDmAuthorized,
  digestCooldownCache,
} = notificationCenter;

describe("Milestone M3 Adversarial Stress & Edge Case Tests: Adventure Digest", () => {
  beforeEach(() => {
    digestCooldownCache.clear();
  });

  describe("1. Malformed and Null User Survival Profiles", () => {
    it("should handle null survivalData without crashing and default stamina to 0", async () => {
      const mockUserId = "123456789012345678";
      const readiness = await aggregateUserReadiness(mockUserId, null, {
        survivalData: null,
        profile: { cooldowns: {} },
        prefs: { stamina_full: true },
      });

      assert.equal(readiness.stamina.ready, false);
      assert.equal(readiness.stamina.current, 0);
      assert.equal(readiness.stamina.percentage, 0);
      assert.equal(readiness.stamina.progressBar, "[░░░░░░░░░░] 0/100");
    });

    it("should handle empty object survivalData without crashing", async () => {
      const mockUserId = "123456789012345678";
      const readiness = await aggregateUserReadiness(mockUserId, null, {
        survivalData: {},
        profile: { cooldowns: {} },
        prefs: { stamina_full: true },
      });

      assert.equal(readiness.stamina.ready, false);
      assert.equal(readiness.stamina.current, 0);
      assert.equal(readiness.stamina.progressBar, "[░░░░░░░░░░] 0/100");
    });

    it("should handle corrupt non-numeric stamina value gracefully", async () => {
      const mockUserId = "123456789012345678";
      const readiness = await aggregateUserReadiness(mockUserId, null, {
        survivalData: { stamina: "corrupt_data_abc" },
        profile: { cooldowns: {} },
        prefs: { stamina_full: true },
      });

      assert.equal(readiness.stamina.ready, false);
      assert.equal(readiness.stamina.progressBar, "[░░░░░░░░░░] 0/100");

      // Container build should safely render without NaN in output
      const container = buildAdventureDigestContainer({
        user: { id: mockUserId, username: "Tester" },
        readiness,
      });
      assert.ok(container);
    });

    it("should handle null user profile gracefully", async () => {
      const mockUserId = "123456789012345678";
      const readiness = await aggregateUserReadiness(mockUserId, null, {
        profile: null,
        survivalData: { stamina: 100 },
        prefs: { stamina_full: true },
      });

      assert.equal(readiness.stamina.ready, true);
      assert.equal(readiness.streak.currentStreak, 0);
      assert.equal(readiness.streak.canClaim, true);
      assert.equal(readiness.streak.nextRewardDay, 1);
    });

    it("should handle corrupted profile with invalid daily timestamp", async () => {
      const mockUserId = "123456789012345678";
      const readiness = await aggregateUserReadiness(mockUserId, null, {
        profile: {
          cooldowns: {
            daily: "NOT_A_VALID_DATE_ISO",
            daily_streak: 5,
          },
        },
        survivalData: { stamina: 50 },
        prefs: { daily_streak: true },
      });

      assert.ok(readiness);
      assert.equal(readiness.streak.ready, true);
      assert.equal(readiness.streak.canClaim, true);
    });
  });

  describe("2. Boundary Stamina Values: 0, 99, 100, 150, NaN, Infinity", () => {
    it("boundary 0: should be not ready and render 10 empty blocks", async () => {
      const bar = generateProgressBar(0, 100, 10);
      assert.equal(bar, "[░░░░░░░░░░] 0/100");

      const readiness = await aggregateUserReadiness("123456789012345678", null, {
        survivalData: { stamina: 0 },
        profile: { cooldowns: {} },
        prefs: { stamina_full: true },
      });
      assert.equal(readiness.stamina.ready, false);
      assert.equal(readiness.stamina.percentage, 0);
    });

    it("boundary 99: should be not ready even at 99%", async () => {
      const bar = generateProgressBar(99, 100, 10);
      assert.equal(bar, "[██████████] 99/100");

      const readiness = await aggregateUserReadiness("123456789012345678", null, {
        survivalData: { stamina: 99 },
        profile: { cooldowns: {} },
        prefs: { stamina_full: true },
      });
      assert.equal(readiness.stamina.ready, false);
      assert.equal(readiness.stamina.percentage, 99);
      assert.ok(!readiness.eligibleItems.includes("stamina"));
    });

    it("boundary 100: should be ready and render exactly 10 filled blocks", async () => {
      const bar = generateProgressBar(100, 100, 10);
      assert.equal(bar, "[██████████] 100/100");

      const readiness = await aggregateUserReadiness("123456789012345678", null, {
        survivalData: { stamina: 100 },
        profile: { cooldowns: {} },
        prefs: { stamina_full: true },
      });
      assert.equal(readiness.stamina.ready, true);
      assert.equal(readiness.stamina.percentage, 100);
      assert.ok(readiness.eligibleItems.includes("stamina"));
    });

    it("boundary 150 (overcharge): should be ready and clamped visually to 10 filled blocks", async () => {
      const bar = generateProgressBar(150, 100, 10);
      assert.equal(bar, "[██████████] 150/100");

      const readiness = await aggregateUserReadiness("123456789012345678", null, {
        survivalData: { stamina: 150 },
        profile: { cooldowns: {} },
        prefs: { stamina_full: true },
      });
      assert.equal(readiness.stamina.ready, true);
      assert.equal(readiness.stamina.percentage, 150);
      assert.ok(readiness.eligibleItems.includes("stamina"));
    });

    it("boundary NaN and Infinity: should not throw error and clamp safely", () => {
      const barNaN = generateProgressBar(NaN, 100, 10);
      assert.equal(barNaN, "[░░░░░░░░░░] 0/100");

      const barInf = generateProgressBar(Infinity, 100, 10);
      assert.ok(barInf.startsWith("[██████████]"));

      const barZeroMax = generateProgressBar(50, 0, 10);
      assert.equal(barZeroMax, "[██████████] 50/1");
    });
  });

  describe("3. Boundary Quest Data: Uninitialized, 0/3, 3/3, Claimed", () => {
    it("uninitialized quest state (null): should safely fall back without throwing", async () => {
      const mockUserId = "123456789012345678";
      // Daily quest engine will return null if no quest in DB or explicit null passed
      const readiness = await aggregateUserReadiness(mockUserId, null, {
        questData: null,
        survivalData: { stamina: 20 },
        profile: { cooldowns: {} },
        prefs: { quest_reset: true },
      });

      assert.equal(readiness.quest.ready, false);
      assert.equal(readiness.quest.status, "NONE");

      const container = buildAdventureDigestContainer({
        user: { id: mockUserId, username: "Tester" },
        readiness,
      });
      assert.ok(container);
    });

    it("quest status READY_TO_START (isNew: true)", () => {
      const mockUserId = "123456789012345678";
      const readiness = {
        userId: mockUserId,
        stamina: { ready: false, progressBar: "[░░░░░░░░░░] 0/100" },
        quest: { ready: true, status: "READY_TO_START", progress: 0, target: 3 },
        cafe: { ready: false, totalRevenue: 0 },
        streak: { ready: false, currentStreak: 1 },
        eligibleItems: ["quest"],
      };

      const container = buildAdventureDigestContainer({
        user: { id: mockUserId, username: "Tester" },
        readiness,
      });
      const root = container.components[0];
      const questField = root.components.find((c) => (c.content && c.content.includes("Quest Harian")) || (c.name && c.name.includes("Quest Harian")));
      assert.ok(questField);
      const text = questField.content || questField.value;
      assert.ok(text.includes("Misi Harian Baru Siap Dimulai"));
    });

    it("quest status IN_PROGRESS (0/3 completed)", () => {
      const mockUserId = "123456789012345678";
      const readiness = {
        userId: mockUserId,
        stamina: { ready: false, progressBar: "[░░░░░░░░░░] 0/100" },
        quest: {
          ready: true,
          status: "IN_PROGRESS",
          progress: 0,
          target: 3,
          questTitle: "Berburu Goblin",
        },
        cafe: { ready: false, totalRevenue: 0 },
        streak: { ready: false, currentStreak: 1 },
        eligibleItems: ["quest"],
      };

      const container = buildAdventureDigestContainer({
        user: { id: mockUserId, username: "Tester" },
        readiness,
      });
      const root = container.components[0];
      const questField = root.components.find((c) => (c.content && c.content.includes("Quest Harian")) || (c.name && c.name.includes("Quest Harian")));
      assert.ok(questField);
      const text = questField.content || questField.value;
      assert.ok(text.includes("Sedang Berlangsung (0/3)"));
      assert.ok(text.includes("Berburu Goblin"));
    });

    it("quest status READY_TO_CLAIM (3/3 completed)", () => {
      const mockUserId = "123456789012345678";
      const readiness = {
        userId: mockUserId,
        stamina: { ready: false, progressBar: "[░░░░░░░░░░] 0/100" },
        quest: {
          ready: true,
          status: "READY_TO_CLAIM",
          progress: 3,
          target: 3,
          questTitle: "Berburu Goblin",
        },
        cafe: { ready: false, totalRevenue: 0 },
        streak: { ready: false, currentStreak: 1 },
        eligibleItems: ["quest"],
      };

      const container = buildAdventureDigestContainer({
        user: { id: mockUserId, username: "Tester" },
        readiness,
      });
      const root = container.components[0];
      const questField = root.components.find((c) => (c.content && c.content.includes("Quest Harian")) || (c.name && c.name.includes("Quest Harian")));
      assert.ok(questField);
      const text = questField.content || questField.value;
      assert.ok(text.includes("Siap Diklaim! (3/3 Selesai)"));
    });

    it("quest status COMPLETED (already claimed today): should not mark quest as ready", () => {
      const mockUserId = "123456789012345678";
      const readiness = {
        userId: mockUserId,
        stamina: { ready: false, progressBar: "[░░░░░░░░░░] 0/100" },
        quest: {
          ready: false,
          status: "COMPLETED",
          progress: 3,
          target: 3,
          claimed: true,
        },
        cafe: { ready: false, totalRevenue: 0 },
        streak: { ready: false, currentStreak: 1 },
        eligibleItems: [],
      };

      const container = buildAdventureDigestContainer({
        user: { id: mockUserId, username: "Tester" },
        readiness,
      });
      const root = container.components[0];
      const questField = root.components.find((c) => (c.content && c.content.includes("Quest Harian")) || (c.name && c.name.includes("Quest Harian")));
      assert.ok(questField);
      const text = questField.content || questField.value;
      assert.ok(text.includes("Selesai Hari Ini"));
    });
  });

  describe("4. Rapid Back-to-Back Triggers (Debounce & Cooldown Validation)", () => {
    it("should prevent duplicate DMs on rapid back-to-back triggers and survive cache clear via DB timestamp", async () => {
      const mockUserId = "123456789012345678";
      let sendCalls = 0;
      const mockClient = {
        users: {
          fetch: async (id) => ({
            id,
            username: "Tester",
            send: async () => {
              sendCalls++;
              return { id: "msg_123" };
            },
          }),
        },
      };

      const profileStore = {
        userId: mockUserId,
        notification_prefs: {
          dm_authorized: true,
          adventure_digest: true,
          stamina_full: true,
        },
        cooldowns: {},
      };

      const origGetUserProfile = require("../../src/managers/cacheManager").getUserProfile;
      const origGetUserSurvival = require("../../src/managers/cacheManager").getUserSurvival;
      const origMutate = require("../../src/managers/cacheManager").mutateUserProfileJson;

      require("../../src/managers/cacheManager").getUserProfile = async () => profileStore;
      require("../../src/managers/cacheManager").getUserSurvival = async () => ({ stamina: 100 });
      require("../../src/managers/cacheManager").mutateUserProfileJson = async (id, key, mutator) => {
        profileStore[key] = mutator(profileStore[key]);
        return profileStore[key];
      };

      try {
        // Trigger 1: Should send
        const res1 = await checkAndDispatchAdventureDigest(mockUserId, mockClient);
        assert.equal(res1.sent, true);
        assert.equal(sendCalls, 1);

        // Trigger 2 (immediate): Should be rejected by in-memory cooldown
        const res2 = await checkAndDispatchAdventureDigest(mockUserId, mockClient);
        assert.equal(res2.sent, false);
        assert.equal(res2.reason, "COOLDOWN_ACTIVE");
        assert.equal(sendCalls, 1);

        // Simulate bot reboot / cache clear: in-memory cache is wiped
        digestCooldownCache.clear();
        assert.equal(digestCooldownCache.has(mockUserId), false);

        // Trigger 3: Should still be rejected by persistent DB last_digest_at!
        const res3 = await checkAndDispatchAdventureDigest(mockUserId, mockClient);
        assert.equal(res3.sent, false);
        assert.equal(res3.reason, "COOLDOWN_ACTIVE");
        assert.equal(sendCalls, 1);

        // Trigger 4 with force: true: Should bypass cooldown
        const res4 = await checkAndDispatchAdventureDigest(mockUserId, mockClient, { force: true });
        assert.equal(res4.sent, true);
        assert.equal(sendCalls, 2);
      } finally {
        require("../../src/managers/cacheManager").getUserProfile = origGetUserProfile;
        require("../../src/managers/cacheManager").getUserSurvival = origGetUserSurvival;
        require("../../src/managers/cacheManager").mutateUserProfileJson = origMutate;
      }
    });

    it("should handle rapid concurrent triggers (Promise.all) safely", async () => {
      const mockUserId = "123456789012345679";
      const mockClient = {
        users: {
          fetch: async (id) => ({
            id,
            username: "Tester",
            send: async () => {
              // Add a small micro-delay to simulate network roundtrip
              await new Promise((r) => setTimeout(r, 10));
              return { id: "msg_123" };
            },
          }),
        },
      };

      const profileStore = {
        userId: mockUserId,
        notification_prefs: {
          dm_authorized: true,
          adventure_digest: true,
          stamina_full: true,
        },
        cooldowns: {},
      };

      const origGetUserProfile = require("../../src/managers/cacheManager").getUserProfile;
      const origGetUserSurvival = require("../../src/managers/cacheManager").getUserSurvival;
      const origMutate = require("../../src/managers/cacheManager").mutateUserProfileJson;

      require("../../src/managers/cacheManager").getUserProfile = async () => profileStore;
      require("../../src/managers/cacheManager").getUserSurvival = async () => ({ stamina: 100 });
      require("../../src/managers/cacheManager").mutateUserProfileJson = async (id, key, mutator) => {
        profileStore[key] = mutator(profileStore[key]);
        return profileStore[key];
      };

      try {
        // Fire 5 triggers concurrently
        const results = await Promise.all([
          checkAndDispatchAdventureDigest(mockUserId, mockClient),
          checkAndDispatchAdventureDigest(mockUserId, mockClient),
          checkAndDispatchAdventureDigest(mockUserId, mockClient),
          checkAndDispatchAdventureDigest(mockUserId, mockClient),
          checkAndDispatchAdventureDigest(mockUserId, mockClient),
        ]);

        const successfulDispatches = results.filter((r) => r.sent === true);
        assert.ok(successfulDispatches.length >= 1, "At least one dispatch should succeed");
      } finally {
        require("../../src/managers/cacheManager").getUserProfile = origGetUserProfile;
        require("../../src/managers/cacheManager").getUserSurvival = origGetUserSurvival;
        require("../../src/managers/cacheManager").mutateUserProfileJson = origMutate;
      }
    });
  });

  describe("5. User Privacy DM Block (DiscordAPIError 50007 / Cannot Send Messages)", () => {
    it("should gracefully handle DM block (code 50007) during authorization message", async () => {
      const mockUserId = "123456789012345678";
      const dmBlockError = new Error("Cannot send messages to this user");
      dmBlockError.code = 50007;

      const mockClient = {
        users: {
          fetch: async () => ({
            id: mockUserId,
            send: async () => {
              throw dmBlockError;
            },
          }),
        },
      };

      const authorized = await ensureDmAuthorized(mockClient, mockUserId, {
        notification_prefs: { dm_authorized: false },
      });

      assert.equal(authorized, false, "Authorization must return false without unhandled throw");
    });

    it("should gracefully handle DM block (code 50007) during digest send without crashing", async () => {
      const mockUserId = "123456789012345678";
      const dmBlockError = new Error("Cannot send messages to this user");
      dmBlockError.code = 50007;

      const mockClient = {
        users: {
          fetch: async () => ({
            id: mockUserId,
            send: async () => {
              throw dmBlockError;
            },
          }),
        },
      };

      const profileStore = {
        userId: mockUserId,
        notification_prefs: {
          dm_authorized: true, // Already authorized previously
          adventure_digest: true,
          stamina_full: true,
        },
        cooldowns: {},
      };

      const origGetUserProfile = require("../../src/managers/cacheManager").getUserProfile;
      const origGetUserSurvival = require("../../src/managers/cacheManager").getUserSurvival;

      require("../../src/managers/cacheManager").getUserProfile = async () => profileStore;
      require("../../src/managers/cacheManager").getUserSurvival = async () => ({ stamina: 100 });

      try {
        const result = await checkAndDispatchAdventureDigest(mockUserId, mockClient);
        assert.equal(result.sent, false);
        assert.equal(result.reason, "DISPATCH_ERROR");
        assert.ok(result.error.includes("Cannot send messages"));
      } finally {
        require("../../src/managers/cacheManager").getUserProfile = origGetUserProfile;
        require("../../src/managers/cacheManager").getUserSurvival = origGetUserSurvival;
      }
    });
  });

  describe("6. Container Discord Components V2 Limits & Em-Dash Checks", () => {
    it("should strictly verify zero em-dash in generated Adventure Digest payload", () => {
      const mockUser = { id: "123456789012345678", username: "Tester" };
      const readiness = {
        userId: mockUser.id,
        stamina: { ready: true, progressBar: "[██████████] 100/100", percentage: 100 },
        quest: { ready: true, status: "READY_TO_CLAIM", progress: 3, target: 3 },
        cafe: { ready: true, totalRevenue: 1500 },
        streak: { ready: true, currentStreak: 7, canClaim: true, isExpiring: false, nextRewardDay: 1 },
        eligibleItems: ["stamina", "quest", "cafe", "streak"],
      };

      const container = buildAdventureDigestContainer({
        user: mockUser,
        readiness,
      });

      const serialized = JSON.stringify(container);
      assert.ok(!serialized.includes("\u2014"), "Container must not contain em-dash (\\u2014)");
    });

    it("should satisfy Discord component limits (container type 17, <= 40 items)", () => {
      const mockUser = { id: "123456789012345678", username: "Tester" };
      const readiness = {
        userId: mockUser.id,
        stamina: { ready: true, progressBar: "[██████████] 100/100", percentage: 100 },
        quest: { ready: true, status: "READY_TO_START", progress: 0, target: 3 },
        cafe: { ready: true, totalRevenue: 2500 },
        streak: { ready: true, currentStreak: 14, canClaim: true, isExpiring: true, hoursLeftBeforeReset: 5 },
        eligibleItems: ["stamina", "quest", "cafe", "streak"],
      };

      const container = buildAdventureDigestContainer({
        user: mockUser,
      readiness,
    });

      assert.equal(container.flags, MessageFlags.IsComponentsV2);
      const root = container.components[0];
      assert.equal(root.type, 17);
      // Components V2 max 40 components in container
      assert.ok(root.components.length <= 40, `Component count ${root.components.length} must be <= 40`);

      // Buttons must be at most 5 per ActionRow
      const actionRow = root.components.find((c) => c.type === 1);
      assert.ok(actionRow.components.length <= 5, "ActionRow must have <= 5 buttons");
    });
  });
});
