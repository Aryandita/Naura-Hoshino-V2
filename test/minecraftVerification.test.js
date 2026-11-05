"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

describe("Minecraft Link & Verification Suite", () => {
  it("generateLinkCode, verifyAccount, dan adminVerifyAccount berfungsi dengan benar", async () => {
    const cacheManager = require("../src/managers/cacheManager");
    const MinecraftBridgeService = require("../src/services/minecraftBridge");
    const testUserId = "mc_test_user_" + Date.now();
    const testUsername = "Aryanz0607";

    // Pastikan UserProfile ada terlebih dahulu
    await cacheManager.getUserProfile(testUserId);

    // 1. Generate Link Code
    const code = await MinecraftBridgeService.generateLinkCode(testUserId, testUsername);
    assert.match(code, /^\d{6}$/, "Kode harus berupa 6 digit angka");

    // 2. Verifikasi dengan kode yang salah harus return null
    const invalidRes = await MinecraftBridgeService.verifyAccount("000000");
    assert.strictEqual(invalidRes, null, "Kode palsu harus mengembalikan null");

    // 3. Verifikasi dengan kode yang valid
    const verified = await MinecraftBridgeService.verifyAccount(code);
    assert.ok(verified, "Akun harus berhasil diverifikasi");
    assert.strictEqual(verified.userId, testUserId);
    assert.strictEqual(verified.mcUsername, testUsername);
    assert.strictEqual(verified.isVerified, true);
    assert.strictEqual(verified.verificationCode, null);

    // 4. Admin Verify
    const adminUser = "mc_admin_user_" + Date.now();
    await cacheManager.getUserProfile(adminUser);
    const adminVerified = await MinecraftBridgeService.adminVerifyAccount(adminUser, "Notch");
    assert.ok(adminVerified);
    assert.strictEqual(adminVerified.isVerified, true);
    assert.strictEqual(adminVerified.mcUsername, "Notch");
  });

  it("ensureComponentsV2Flags menyisipkan attachment yang hilang secara defensif", () => {
    const { MessageFlags } = require("discord.js");
    const interactionCreate = require("../src/events/interactionCreate");
    
    // Uji komponen V2 dengan accessory yang merujuk attachment://naura_cheers.png
    const mockOptions = {
      components: [
        {
          type: 17,
          components: [
            {
              type: 1,
              accessory: {
                media: {
                  url: "attachment://naura_cheers.png",
                },
              },
            },
          ],
        },
      ],
      files: [],
    };

    // Panggil replier melalui wrapped interaction
    let capturedOptions = null;
    const mockInteraction = {
      reply: (opts) => { capturedOptions = opts; },
      deferred: false,
      replied: false,
    };

    // Jalankan wrap
    // Trigger ensureComponentsV2Flags via wrapped interaction reply
    const wrapped = interactionCreate.wrapInteractionSafe
      ? interactionCreate.wrapInteractionSafe(mockInteraction)
      : mockInteraction;

    if (typeof wrapped.reply === "function") {
      wrapped.reply(mockOptions);
      assert.ok(capturedOptions, "Options harus tertangkap");
      assert.ok(
        (capturedOptions.flags & MessageFlags.IsComponentsV2) !== 0,
        "Flags harus menyertakan MessageFlags.IsComponentsV2",
      );
      assert.ok(Array.isArray(capturedOptions.files), "Files harus berupa array");
      assert.ok(
        capturedOptions.files.some((f) => f.name === "naura_cheers.png" || f.attachment?.name === "naura_cheers.png"),
        "Attachment naura_cheers.png harus disisipkan secara otomatis",
      );
    }
  });
});
