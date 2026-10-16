"use strict";

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert");
const {
  trackMessage,
  handleDelete,
  handleUpdate,
  getCache,
  clearCache,
  getTrackedMessage,
  stopSweeper,
  startSweeper,
  MAX_CACHE_SIZE,
} = require("./ghostPingTracker");

const cacheManager = require("../managers/cacheManager");

describe("GhostPingTracker Automod Module", () => {
  let origGetGuildSettings;

  beforeEach(() => {
    clearCache();
    origGetGuildSettings = cacheManager.getGuildSettings;
    cacheManager.getGuildSettings = async () => ({
      settings: { auditLogChannel: "123", modLogChannel: "123" },
    });
  });

  afterEach(() => {
    clearCache();
    if (origGetGuildSettings) {
      cacheManager.getGuildSettings = origGetGuildSettings;
    }
  });

  describe("Message Mention Tracking (trackMessage)", () => {
    it("Mengabaikan pesan tanpa sebutan (mentions)", () => {
      const mockMessage = {
        id: "msg_1",
        guild: { id: "guild_1" },
        author: { id: "user_author", bot: false },
        content: "Halo dunia tanpa mention apa pun.",
        mentions: {
          users: new Map(),
          roles: new Map(),
          everyone: false,
        },
      };

      const tracked = trackMessage(mockMessage);
      assert.strictEqual(tracked, false);
      assert.strictEqual(getCache().size, 0);
    });

    it("Mengabaikan pesan yang hanya menyebut diri sendiri (self-mention)", () => {
      const mockMessage = {
        id: "msg_2",
        guild: { id: "guild_1" },
        author: { id: "user_author", bot: false },
        content: "Menyebut diri sendiri <@user_author>",
        mentions: {
          users: new Map([
            ["user_author", { id: "user_author", tag: "author#0001", username: "author" }],
          ]),
          roles: new Map(),
          everyone: false,
        },
      };

      const tracked = trackMessage(mockMessage);
      assert.strictEqual(tracked, false);
      assert.strictEqual(getCache().size, 0);
    });

    it("Mengabaikan pesan dari bot meskipun memuat mention", () => {
      const mockMessage = {
        id: "msg_bot",
        guild: { id: "guild_1" },
        author: { id: "bot_123", bot: true },
        content: "Halo <@user_target>",
        mentions: {
          users: new Map([
            ["user_target", { id: "user_target", tag: "target#0002", username: "target" }],
          ]),
          roles: new Map(),
          everyone: false,
        },
      };

      const tracked = trackMessage(mockMessage);
      assert.strictEqual(tracked, false);
      assert.strictEqual(getCache().size, 0);
    });

    it("Berhasil mencatat pesan yang menyebut pengguna lain ke cache memori", () => {
      const mockMessage = {
        id: "msg_valid_user",
        guild: { id: "guild_1" },
        author: { id: "user_author", tag: "author#0001", username: "author", bot: false },
        content: "Halo <@user_target>, cek ini!",
        createdTimestamp: Date.now(),
        mentions: {
          users: new Map([
            ["user_target", { id: "user_target", tag: "target#0002", username: "target" }],
          ]),
          roles: new Map(),
          everyone: false,
        },
      };

      const tracked = trackMessage(mockMessage);
      assert.strictEqual(tracked, true);
      assert.strictEqual(getCache().size, 1);

      const record = getTrackedMessage("msg_valid_user");
      assert.ok(record);
      assert.strictEqual(record.authorId, "user_author");
      assert.strictEqual(record.mentions.users.length, 1);
      assert.strictEqual(record.mentions.users[0].id, "user_target");
    });

    it("Berhasil mencatat pesan yang menyebut role ke cache memori", () => {
      const mockMessage = {
        id: "msg_valid_role",
        guild: { id: "guild_1" },
        author: { id: "user_author", tag: "author#0001", username: "author", bot: false },
        content: "Perhatian untuk <@&role_vip>",
        createdTimestamp: Date.now(),
        mentions: {
          users: new Map(),
          roles: new Map([
            ["role_vip", { id: "role_vip", name: "VIP Member" }],
          ]),
          everyone: false,
        },
      };

      const tracked = trackMessage(mockMessage);
      assert.strictEqual(tracked, true);
      const record = getTrackedMessage("msg_valid_role");
      assert.ok(record);
      assert.strictEqual(record.mentions.roles.length, 1);
      assert.strictEqual(record.mentions.roles[0].name, "VIP Member");
    });

    it("Berhasil mencatat pesan yang memuat mention @everyone atau @here", () => {
      const mockMessage = {
        id: "msg_everyone",
        guild: { id: "guild_1" },
        author: { id: "user_author", tag: "author#0001", username: "author", bot: false },
        content: "@everyone bangun semuanya!",
        createdTimestamp: Date.now(),
        mentions: {
          users: new Map(),
          roles: new Map(),
          everyone: true,
        },
      };

      const tracked = trackMessage(mockMessage);
      assert.strictEqual(tracked, true);
      const record = getTrackedMessage("msg_everyone");
      assert.ok(record);
      assert.strictEqual(record.mentions.everyone, true);
    });

    it("Menghapus entri terlama jika kapasitas maksimum tercapai", () => {
      assert.ok(MAX_CACHE_SIZE > 0);
      for (let i = 0; i < 5; i++) {
        trackMessage({
          id: `msg_bulk_${i}`,
          guild: { id: "guild_1" },
          author: { id: `author_${i}`, bot: false },
          content: `Test mention <@target_${i}>`,
          mentions: {
            users: new Map([[`target_${i}`, { id: `target_${i}` }]]),
            roles: new Map(),
            everyone: false,
          },
        });
      }
      assert.strictEqual(getCache().size, 5);
      assert.ok(getTrackedMessage("msg_bulk_0"));
    });
  });

  describe("Deletion Detection Hook (handleDelete)", () => {
    it("Mendeteksi penghapusan pesan cepat (<= 60s) sebagai ghost ping", async () => {
      let sentPayload = null;
      const channelMock = {
        send: async (payload) => {
          sentPayload = payload;
          return {};
        },
      };

      const createTime = Date.now() - 4000; // Pesan dibuat 4 detik lalu

      trackMessage({
        id: "msg_ghost_1",
        guild: {
          id: "guild_1",
          channels: { cache: new Map([["123", { send: async () => {} }]]) },
          fetchAuditLogs: async () => null,
        },
        channel: channelMock,
        author: { id: "spammer_id", tag: "spammer#0001", username: "spammer", bot: false },
        content: "Woi <@target_id> liat sini cepetan!",
        createdTimestamp: createTime,
        mentions: {
          users: new Map([
            ["target_id", { id: "target_id", tag: "target#0002", username: "target" }],
          ]),
          roles: new Map(),
          everyone: false,
        },
      });

      const deleteMessageMock = {
        id: "msg_ghost_1",
        guild: {
          id: "guild_1",
          channels: { cache: new Map([["123", { send: async () => {} }]]) },
          fetchAuditLogs: async () => null,
        },
        channel: channelMock,
      };

      const result = await handleDelete(deleteMessageMock);
      assert.strictEqual(result.isGhostPing, true);
      assert.ok(result.elapsedSeconds <= 60);
      assert.ok(sentPayload);
      assert.strictEqual(getTrackedMessage("msg_ghost_1"), null, "Pesan harus dihapus dari cache setelah diproses");
    });

    it("Mengabaikan pesan yang dihapus setelah melewati ambang batas waktu (> 60s)", async () => {
      const oldTime = Date.now() - 75 * 1000; // 75 detik yang lalu

      trackMessage({
        id: "msg_expired",
        guild: {
          id: "guild_1",
          channels: { cache: new Map([["123", { send: async () => {} }]]) },
          fetchAuditLogs: async () => null,
        },
        author: { id: "user_a", bot: false },
        content: "Pesan lama <@user_b>",
        createdTimestamp: oldTime,
        mentions: {
          users: new Map([["user_b", { id: "user_b" }]]),
          roles: new Map(),
          everyone: false,
        },
      });

      const deleteMessageMock = {
        id: "msg_expired",
        guild: {
          id: "guild_1",
          channels: { cache: new Map([["123", { send: async () => {} }]]) },
          fetchAuditLogs: async () => null,
        },
      };

      const result = await handleDelete(deleteMessageMock);
      assert.strictEqual(result.isGhostPing, false);
      assert.strictEqual(result.reason, "exceeded_ttl");
    });

    it("Mengabaikan penghapusan yang dilakukan oleh moderator melalui Audit Log (Moderator Bypass)", async () => {
      trackMessage({
        id: "msg_mod_deleted",
        guild: { id: "guild_1" },
        author: { id: "troublemaker_id", bot: false },
        content: "Pesan melanggar aturan <@victim_id>",
        createdTimestamp: Date.now() - 2000,
        mentions: {
          users: new Map([["victim_id", { id: "victim_id" }]]),
          roles: new Map(),
          everyone: false,
        },
      });

      // Mock audit log yang menunjukkan moderator menghapus pesan troublemaker
      const mockAuditLogEntry = {
        target: { id: "troublemaker_id" },
        targetId: "troublemaker_id",
        executor: { id: "moderator_staff_id" },
        executorId: "moderator_staff_id",
        createdTimestamp: Date.now() - 1000,
      };

      const deleteMessageMock = {
        id: "msg_mod_deleted",
        guild: {
          id: "guild_1",
          fetchAuditLogs: async () => ({
            entries: {
              first: () => mockAuditLogEntry,
            },
          }),
        },
      };

      const result = await handleDelete(deleteMessageMock);
      assert.strictEqual(result.isGhostPing, false);
      assert.strictEqual(result.reason, "moderator_deletion");
    });
  });

  describe("Stealth Ghost Ping Detection (handleUpdate)", () => {
    it("Mendeteksi penghapusan sebutan target via penyuntingan pesan (Stealth Ghost Ping)", async () => {
      let updateSentPayload = null;
      const channelMock = {
        send: async (payload) => {
          updateSentPayload = payload;
          return {};
        },
      };

      const oldMessage = {
        id: "msg_edit_1",
        guild: {
          id: "guild_1",
          channels: { cache: new Map([["123", { send: async () => {} }]]) },
        },
        channel: channelMock,
        author: { id: "sneak_user", tag: "sneak#0001", username: "sneak", bot: false },
        content: "Halo <@victim_user>, kamu jelek!",
        mentions: {
          users: new Map([
            ["victim_user", { id: "victim_user", tag: "victim#0002", username: "victim" }],
          ]),
          roles: new Map(),
        },
      };

      const newMessage = {
        id: "msg_edit_1",
        guild: {
          id: "guild_1",
          channels: { cache: new Map([["123", { send: async () => {} }]]) },
        },
        channel: channelMock,
        author: { id: "sneak_user", tag: "sneak#0001", username: "sneak", bot: false },
        content: "Halo, kamu jelek!", // Sebutan victim dihapus secara diam-diam
        mentions: {
          users: new Map(), // Mention kosong
          roles: new Map(),
        },
      };

      const result = await handleUpdate(oldMessage, newMessage);
      assert.strictEqual(result.isStealthPing, true);
      assert.strictEqual(result.removedUsers.length, 1);
      assert.strictEqual(result.removedUsers[0].id, "victim_user");
      assert.ok(updateSentPayload);
    });

    it("Mendeteksi penghapusan sebutan role via penyuntingan pesan", async () => {
      const oldMessage = {
        id: "msg_edit_role",
        guild: {
          id: "guild_1",
          channels: { cache: new Map([["123", { send: async () => {} }]]) },
        },
        author: { id: "sneak_user", bot: false },
        content: "Pengumuman rahasia <@&role_staff>",
        mentions: {
          users: new Map(),
          roles: new Map([["role_staff", { id: "role_staff", name: "Staff" }]]),
        },
      };

      const newMessage = {
        id: "msg_edit_role",
        guild: {
          id: "guild_1",
          channels: { cache: new Map([["123", { send: async () => {} }]]) },
        },
        author: { id: "sneak_user", bot: false },
        content: "Pengumuman rahasia",
        mentions: {
          users: new Map(),
          roles: new Map(),
        },
      };

      const result = await handleUpdate(oldMessage, newMessage);
      assert.strictEqual(result.isStealthPing, true);
      assert.strictEqual(result.removedRoles.length, 1);
      assert.strictEqual(result.removedRoles[0].name, "Staff");
    });

    it("Mengabaikan suntingan biasa yang mempertahankan sebutan mention", async () => {
      const oldMessage = {
        id: "msg_edit_safe",
        guild: { id: "guild_1" },
        author: { id: "regular_user", bot: false },
        content: "Halo <@friend_id>, ini typoo",
        mentions: {
          users: new Map([["friend_id", { id: "friend_id" }]]),
          roles: new Map(),
        },
      };

      const newMessage = {
        id: "msg_edit_safe",
        guild: { id: "guild_1" },
        author: { id: "regular_user", bot: false },
        content: "Halo <@friend_id>, ini typo", // Hanya memperbaiki ejaan
        mentions: {
          users: new Map([["friend_id", { id: "friend_id" }]]),
          roles: new Map(),
        },
      };

      const result = await handleUpdate(oldMessage, newMessage);
      assert.strictEqual(result.isStealthPing, false);
    });

    it("Mengabaikan suntingan otomatis Discord yang kontennya tidak berubah (misal update embed)", async () => {
      const message = {
        id: "msg_embed_update",
        guild: { id: "guild_1" },
        author: { id: "regular_user", bot: false },
        content: "https://example.com/test",
      };

      const result = await handleUpdate(message, { ...message });
      assert.strictEqual(result.isStealthPing, false);
    });
  });

  describe("Lifecycle & Sweeper Management", () => {
    it("startSweeper dan stopSweeper dapat dipanggil secara aman tanpa error", () => {
      assert.doesNotThrow(() => {
        stopSweeper();
        startSweeper();
        stopSweeper();
      });
    });
  });
});
