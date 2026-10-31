"use strict";

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { MessageFlags } = require("discord.js");

const notificationCenter = require("../src/services/notificationCenter");
const {
  generateProgressBar,
  aggregateUserReadiness,
  buildAdventureDigestContainer,
  checkAndDispatchAdventureDigest,
  DEFAULT_DIGEST_COOLDOWN_MS,
  digestCooldownCache,
} = notificationCenter;

const dailyButtons = require("../src/interactions/buttons/dailyButtons");
const notificationButtons = require("../src/interactions/buttons/notificationButtons");

describe("Adventure Digest Unit & Integration Tests", () => {
  beforeEach(() => {
    // Bersihkan in-memory cooldown cache sebelum setiap pengujian
    digestCooldownCache.clear();
  });

  describe("Progress Bar Generation", () => {
    it("should render full stamina (100/100) with all filled blocks", () => {
      const bar = generateProgressBar(100, 100, 10);
      assert.equal(bar, "[██████████] 100/100");
    });

    it("should render partial stamina (50/100) with half filled and half empty blocks", () => {
      const bar = generateProgressBar(50, 100, 10);
      assert.equal(bar, "[█████░░░░░] 50/100");
    });

    it("should render empty stamina (0/100) with all empty blocks", () => {
      const bar = generateProgressBar(0, 100, 10);
      assert.equal(bar, "[░░░░░░░░░░] 0/100");
    });

    it("should clamp progress bar visual to full when overcharged (> 100)", () => {
      const bar = generateProgressBar(120, 100, 10);
      assert.equal(bar, "[██████████] 120/100");
    });

    it("should handle negative stamina safely without throwing", () => {
      const bar = generateProgressBar(-10, 100, 10);
      assert.equal(bar, "[░░░░░░░░░░] 0/100");
    });

    it("should handle NaN safely without throwing", () => {
      const bar = generateProgressBar("abc", 100, 10);
      assert.equal(bar, "[░░░░░░░░░░] 0/100");
    });
  });

  describe("Readiness Detection & Aggregation", () => {
    it("should detect stamina ready when stamina >= 100", async () => {
      const mockUserId = "123456789012345678";
      const readiness = await aggregateUserReadiness(mockUserId, null, {
        survivalData: { stamina: 100 },
        profile: { cooldowns: {} },
        prefs: { stamina_full: true, quest_reset: false, idle_revenue: false, daily_streak: false },
      });

      assert.equal(readiness.stamina.ready, true);
      assert.equal(readiness.stamina.current, 100);
      assert.ok(readiness.readyItems.includes("stamina"));
      assert.ok(readiness.eligibleItems.includes("stamina"));
    });

    it("should detect cafe ready when uncollected revenue >= 500", async () => {
      const mockUserId = "123456789012345678";
      const readiness = await aggregateUserReadiness(mockUserId, null, {
        survivalData: { stamina: 20 },
        profile: { cooldowns: {} },
        cafeData: {
          cafeName: "Cyber Maid Lounge",
          level: 2,
          reputation: 50,
          uncollectedRevenue: 600,
          lastCollectedAt: new Date(),
        },
        prefs: { stamina_full: false, quest_reset: false, idle_revenue: true, daily_streak: false },
      });

      assert.equal(readiness.cafe.ready, true);
      assert.ok(readiness.cafe.totalRevenue >= 600);
      assert.ok(readiness.readyItems.includes("cafe"));
      assert.ok(readiness.eligibleItems.includes("cafe"));
    });

    it("should detect daily streak ready when 24h passed", async () => {
      const mockUserId = "123456789012345678";
      const now = Date.now();
      const lastDaily = new Date(now - 25 * 60 * 60 * 1000).toISOString(); // 25 jam lalu

      const readiness = await aggregateUserReadiness(mockUserId, null, {
        survivalData: { stamina: 20 },
        profile: {
          cooldowns: {
            daily: lastDaily,
            daily_streak: 5,
          },
        },
        prefs: { stamina_full: false, quest_reset: false, idle_revenue: false, daily_streak: true },
      });

      assert.equal(readiness.streak.ready, true);
      assert.equal(readiness.streak.canClaim, true);
      assert.equal(readiness.streak.isExpiring, false);
      assert.ok(readiness.readyItems.includes("streak"));
      assert.ok(readiness.eligibleItems.includes("streak"));
    });

    it("should detect daily streak as expiring when between 36h and 48h", async () => {
      const mockUserId = "123456789012345678";
      const now = Date.now();
      const lastDaily = new Date(now - 40 * 60 * 60 * 1000).toISOString(); // 40 jam lalu (sisa 8 jam)

      const readiness = await aggregateUserReadiness(mockUserId, null, {
        survivalData: { stamina: 20 },
        profile: {
          cooldowns: {
            daily: lastDaily,
            daily_streak: 7,
          },
        },
        prefs: { stamina_full: false, quest_reset: false, idle_revenue: false, daily_streak: true },
      });

      assert.equal(readiness.streak.ready, true);
      assert.equal(readiness.streak.isExpiring, true);
      assert.ok(readiness.streak.hoursLeftBeforeReset <= 8);
    });

    it("should omit disabled preferences from eligibleItems even if system is ready", async () => {
      const mockUserId = "123456789012345678";
      const readiness = await aggregateUserReadiness(mockUserId, null, {
        survivalData: { stamina: 100 },
        profile: { cooldowns: {} },
        prefs: {
          stamina_full: false, // user menonaktifkan notif stamina
          quest_reset: false,
          idle_revenue: false,
          daily_streak: false,
        },
      });

      assert.equal(readiness.stamina.ready, true);
      assert.ok(readiness.readyItems.includes("stamina"));
      assert.ok(!readiness.eligibleItems.includes("stamina"));
      assert.equal(readiness.hasAnyEligible, false);
    });
  });

  describe("Components V2 Container Structure & Compliance", () => {
    it("should construct valid Discord Components V2 payload with 4 quick action buttons", () => {
      const mockUser = {
        id: "123456789012345678",
        username: "Ryaa",
        displayName: "Ryaa Hoshino",
      };

      const readiness = {
        userId: mockUser.id,
        stamina: { ready: true, progressBar: "[██████████] 100/100", percentage: 100 },
        quest: { ready: true, status: "READY_TO_CLAIM", progress: 3, target: 3, questTitle: "Dungeon Master" },
        cafe: { ready: true, totalRevenue: 1250 },
        streak: { ready: true, currentStreak: 7, canClaim: true, isExpiring: false, nextRewardDay: 1 },
        eligibleItems: ["stamina", "quest", "cafe", "streak"],
      };

      const container = buildAdventureDigestContainer({
        user: mockUser,
        readiness,
        displayName: mockUser.displayName,
      });

      // Validasi bendera Components V2
      assert.equal(container.flags, MessageFlags.IsComponentsV2);
      assert.ok(Array.isArray(container.components));
      assert.equal(container.components.length, 1);

      // Validasi root container type 17
      const rootContainer = container.components[0];
      assert.equal(rootContainer.type, 17);
      assert.ok(Array.isArray(rootContainer.components));

      // Temukan action row (type 1)
      const actionRow = rootContainer.components.find((comp) => comp.type === 1);
      assert.ok(actionRow, "ActionRow (type 1) harus ditemukan");
      assert.equal(actionRow.components.length, 4, "ActionRow harus memuat tepat 4 tombol cepat");

      // Validasi 4 tombol sesuai kontrak
      const customIds = actionRow.components.map((btn) => btn.custom_id);
      assert.ok(customIds.includes("btn_dailyquest_view"), "Tombol Buka Quest harus ada");
      assert.ok(customIds.includes(`survival_act_info:${mockUser.id}`), "Tombol Masuk RPG harus ada");
      assert.ok(customIds.includes("btn_daily_claim"), "Tombol Daily harus ada");
      assert.ok(customIds.includes("btn_notif_manage"), "Tombol Kelola Notif harus ada");

      // Validasi tombol style
      const questBtn = actionRow.components.find((b) => b.custom_id === "btn_dailyquest_view");
      const dailyBtn = actionRow.components.find((b) => b.custom_id === "btn_daily_claim");
      assert.equal(questBtn.style, 1, "Buka Quest harus Primary (style 1)");
      assert.equal(dailyBtn.style, 3, "Daily Claim harus Success (style 3)");
    });

    it("should dynamically set amber accent color and wink expression when streak is expiring", () => {
      const mockUser = { id: "123456789012345678", username: "Ryaa" };
      const readiness = {
        userId: mockUser.id,
        stamina: { ready: false, progressBar: "[██░░░░░░░░] 20/100" },
        quest: { ready: false, status: "IN_PROGRESS" },
        cafe: { ready: false, totalRevenue: 50 },
        streak: { ready: true, currentStreak: 5, isExpiring: true, hoursLeftBeforeReset: 4 },
        eligibleItems: ["streak"],
      };

      const container = buildAdventureDigestContainer({
        user: mockUser,
        readiness,
      });

      const root = container.components[0];
      // Accent color F59E0B dalam desimal adalah 16096779
      assert.equal(root.accent_color, 16096779);
    });
  });

  describe("Sliding Cooldown Batching & Throttling Logic", () => {
    it("should throttle subsequent triggers within cooldown window and prevent duplicate DMs", async () => {
      const mockUserId = "123456789012345678";
      let sentCount = 0;
      const sentPayloads = [];

      const mockClient = {
        users: {
          fetch: async (id) => ({
            id,
            username: "Ryaa",
            displayName: "Ryaa Hoshino",
            send: async (payload) => {
              sentCount++;
              sentPayloads.push(payload);
              return { id: "msg_dm_123" };
            },
          }),
        },
      };

      // Mock cacheManager untuk profil yang sudah autorisasi DM dan memiliki status stamina penuh
      const origGetUserProfile = require("../src/managers/cacheManager").getUserProfile;
      const origGetUserSurvival = require("../src/managers/cacheManager").getUserSurvival;
      const origMutate = require("../src/managers/cacheManager").mutateUserProfileJson;

      const profileStore = {
        [mockUserId]: {
          userId: mockUserId,
          notification_prefs: {
            dm_authorized: true,
            adventure_digest: true,
            stamina_full: true,
            quest_reset: true,
            idle_revenue: true,
            daily_streak: true,
          },
          cooldowns: {},
        },
      };

      require("../src/managers/cacheManager").getUserProfile = async (id) => profileStore[id];
      require("../src/managers/cacheManager").getUserSurvival = async () => ({ stamina: 100 });
      require("../src/managers/cacheManager").mutateUserProfileJson = async (id, key, mutator) => {
        profileStore[id][key] = mutator(profileStore[id][key]);
        return profileStore[id][key];
      };

      try {
        // Trigger pertama: Berhasil kirim DM
        const firstDispatch = await checkAndDispatchAdventureDigest(mockUserId, mockClient, {
          trigger: "stamina_full",
        });

        assert.equal(firstDispatch.sent, true);
        assert.equal(sentCount, 1, "DM pertama harus berhasil dikirim");

        // Trigger kedua beberapa detik kemudian: Harus tertahan oleh cooldown window
        const secondDispatch = await checkAndDispatchAdventureDigest(mockUserId, mockClient, {
          trigger: "cafe_revenue",
        });

        assert.equal(secondDispatch.sent, false);
        assert.equal(secondDispatch.reason, "COOLDOWN_ACTIVE");
        assert.equal(sentCount, 1, "DM kedua tidak boleh dikirim karena cooldown aktif");

        // Trigger ketiga dengan force: true: Harus bisa melewati cooldown
        const forcedDispatch = await checkAndDispatchAdventureDigest(mockUserId, mockClient, {
          trigger: "manual_test",
          force: true,
        });

        assert.equal(forcedDispatch.sent, true);
        assert.equal(sentCount, 2, "Force dispatch harus mengirim DM");
      } finally {
        require("../src/managers/cacheManager").getUserProfile = origGetUserProfile;
        require("../src/managers/cacheManager").getUserSurvival = origGetUserSurvival;
        require("../src/managers/cacheManager").mutateUserProfileJson = origMutate;
      }
    });

    it("should respect master toggle adventure_digest: false and suppress dispatch", async () => {
      const mockUserId = "123456789012345678";
      const mockClient = { users: { fetch: async () => ({}) } };

      const origGetUserProfile = require("../src/managers/cacheManager").getUserProfile;
      require("../src/managers/cacheManager").getUserProfile = async () => ({
        userId: mockUserId,
        notification_prefs: {
          dm_authorized: true,
          adventure_digest: false, // Master toggle OFF
        },
      });

      try {
        const result = await checkAndDispatchAdventureDigest(mockUserId, mockClient);
        assert.equal(result.sent, false);
        assert.equal(result.reason, "DIGEST_DISABLED");
      } finally {
        require("../src/managers/cacheManager").getUserProfile = origGetUserProfile;
      }
    });
  });

  describe("Persistent Button Handlers Integrity", () => {
    it("should export daily claim buttons and sub-actions in dailyButtons.js", () => {
      assert.ok(Array.isArray(dailyButtons));
      const ids = dailyButtons.map((b) => b.id);
      assert.ok(ids.includes("btn_daily_claim"), "btn_daily_claim harus terdaftar");
      assert.ok(ids.includes("daily_btn_claim"), "daily_btn_claim harus terdaftar");
      assert.ok(ids.includes("digest_btn_daily"), "digest_btn_daily alias harus terdaftar");
      assert.ok(ids.includes("daily_btn_quests"), "daily_btn_quests harus terdaftar");
      assert.ok(ids.includes("daily_btn_shield"), "daily_btn_shield harus terdaftar");

      for (const entry of dailyButtons) {
        assert.equal(typeof entry.handler, "function");
      }
    });

    it("should export notification management buttons in notificationButtons.js", () => {
      assert.ok(Array.isArray(notificationButtons));
      const ids = notificationButtons.map((b) => b.id).filter(Boolean);
      const prefixes = notificationButtons.map((b) => b.prefix).filter(Boolean);

      assert.ok(ids.includes("btn_notif_manage"), "btn_notif_manage harus terdaftar");
      assert.ok(prefixes.includes("toggle_notif_"), "toggle_notif_ prefix harus terdaftar");

      for (const entry of notificationButtons) {
        assert.equal(typeof entry.handler, "function");
      }
    });
  });
});
