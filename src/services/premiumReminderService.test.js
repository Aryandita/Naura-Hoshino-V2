"use strict";

process.env.NODE_ENV = "test";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const premiumReminderService = require("./premiumReminderService");
const UserProfile = require("../models/UserProfile");
const cacheManager = require("../managers/cacheManager");

describe("Premium Expiration Reminder Service Suite", () => {
  it("buildReminderPayload menyusun pesan Container V2 dengan format waktu dan tombol interaktif", () => {
    const expiry = new Date(Date.now() + 18 * 3600 * 1000);
    const payload = premiumReminderService.buildReminderPayload({
      username: "NauraTester",
      expiryDate: expiry,
      tier: "tier2",
    });

    assert.ok(payload);
    assert.ok(payload.flags);
    assert.ok(Array.isArray(payload.components));
    // Validasi judul dan author
    const textPayload = JSON.stringify(payload);
    assert.ok(textPayload.includes("Masa Aktif VIP Kamu Segera Berakhir"));
    assert.ok(textPayload.includes("NauraTester"));
    assert.ok(textPayload.includes("Perpanjang VIP"));
    assert.ok(textPayload.includes("Cek Keuntungan VIP"));
  });

  it("sendExpirationReminder menangani kasus user atau client tidak valid secara aman", async () => {
    assert.strictEqual(await premiumReminderService.sendExpirationReminder(null, "123", new Date()), false);
    assert.strictEqual(await premiumReminderService.sendExpirationReminder({}, null, new Date()), false);
    assert.strictEqual(await premiumReminderService.sendExpirationReminder({}, "123", null), false);

    const mockClientThrow = {
      users: {
        fetch: async () => {
          throw new Error("DiscordAPIError: Cannot send messages to this user");
        },
      },
    };
    const res = await premiumReminderService.sendExpirationReminder(
      mockClientThrow,
      "123456789012345678",
      new Date(),
    );
    assert.strictEqual(res, false);
  });

  it("sendExpirationReminder berhasil mengirimkan DM ke user Discord", async () => {
    let sentPayload = null;
    const mockClient = {
      users: {
        fetch: async (id) => ({
          id,
          username: "SobatVip",
          send: async (p) => {
            sentPayload = p;
            return true;
          },
        }),
      },
    };

    const expiry = new Date(Date.now() + 20 * 3600 * 1000);
    const res = await premiumReminderService.sendExpirationReminder(
      mockClient,
      "998877665544332211",
      expiry,
      "tier3",
      "SobatVip",
    );

    assert.strictEqual(res, true);
    assert.ok(sentPayload);
    const serialized = JSON.stringify(sentPayload);
    assert.ok(serialized.includes("Naura VIP Bestie"));
  });

  it("checkExpiringSubscriptions memindai langganan yang akan habis dan mencegah spam berulang", async () => {
    const now = new Date("2026-10-17T12:00:00Z");
    const expiry1 = new Date("2026-10-18T06:00:00Z"); // 18 jam lagi (dalam jendela 24h)
    const expiry2 = new Date("2026-10-18T08:00:00Z"); // 20 jam lagi (dalam jendela 24h)

    const sentUsers = [];
    const mockClient = {
      users: {
        fetch: async (id) => ({
          id,
          username: `User_${id}`,
          send: async () => {
            sentUsers.push(id);
            return true;
          },
        }),
      },
    };

    const mockProfiles = [
      {
        userId: "100000000000000001",
        username: "UserOne",
        isPremium: true,
        premiumUntil: expiry1,
        premium_tier: "tier1",
        notification_prefs: {}, // Belum pernah diingatkan
      },
      {
        userId: "100000000000000002",
        username: "UserTwo",
        isPremium: true,
        premiumUntil: expiry2,
        premium_tier: "tier2",
        notification_prefs: {
          // Sudah pernah diingatkan untuk expiry ini
          reminded_premium_expiry: expiry2.toISOString(),
        },
      },
    ];

    const origFindAll = UserProfile.findAll;
    const origMutate = cacheManager.mutateUserProfileJson;

    UserProfile.findAll = async () => mockProfiles;
    cacheManager.mutateUserProfileJson = async (uid, field, fn) => {
      const target = mockProfiles.find((p) => p.userId === uid);
      if (target) {
        target.notification_prefs = fn(target.notification_prefs || {});
      }
      return true;
    };

    try {
      const stats = await premiumReminderService.checkExpiringSubscriptions(mockClient, { now });

      assert.strictEqual(stats.checked, 2);
      assert.strictEqual(stats.notified, 1);
      assert.strictEqual(stats.skipped, 1);
      assert.strictEqual(stats.errors, 0);

      assert.deepStrictEqual(sentUsers, ["100000000000000001"]);
      // Pastikan UserOne sekarang tercatat sudah diingatkan
      assert.strictEqual(
        mockProfiles[0].notification_prefs.reminded_premium_expiry,
        expiry1.toISOString(),
      );
    } finally {
      UserProfile.findAll = origFindAll;
      cacheManager.mutateUserProfileJson = origMutate;
    }
  });
});
