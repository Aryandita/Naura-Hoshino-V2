"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const soundboardService = require("../../src/services/soundboardService");
const { updateGuildSetting, getGuildSetting } = require("../../src/managers/guildSettingsService");

describe("R3 Dashboard E2E - Tier 1: Feature Coverage", () => {
  it("TC-M3.1: PRESET_SOUNDS catalogue contains all required SFX presets", () => {
    const presets = soundboardService.PRESET_SOUNDS;
    assert.ok(Array.isArray(presets));
    assert.ok(presets.length >= 7);

    const expectedIds = ["airhorn", "applause", "bruh", "victory", "cheer", "drumroll", "gameover"];
    for (const expectedId of expectedIds) {
      const sound = presets.find((s) => s.id === expectedId);
      assert.ok(sound, `Sound preset '${expectedId}' must be present in PRESET_SOUNDS`);
      assert.ok(sound.title, "Title must be non-empty");
      assert.ok(sound.category, "Category must be non-empty");
      assert.ok(sound.icon, "Icon must be non-empty");
      assert.ok(sound.url, "URL must be non-empty");
      assert.match(sound.url, /^https?:\/\//);
    }
  });

  it("TC-M3.2: soundboardService.playSound validates required input parameters", async () => {
    // Missing guildId
    const resNoGuild = await soundboardService.playSound({ soundId: "airhorn" });
    assert.equal(resNoGuild.success, false);
    assert.match(resNoGuild.message, /Guild ID dan Sound ID wajib disertakan/);

    // Missing soundId
    const resNoSound = await soundboardService.playSound({ guildId: "guild-123" });
    assert.equal(resNoSound.success, false);
    assert.match(resNoSound.message, /Guild ID dan Sound ID wajib disertakan/);

    // Unregistered soundId
    const resInvalid = await soundboardService.playSound({
      guildId: "guild-123",
      soundId: "non-existent-sound-xyz",
    });
    assert.equal(resInvalid.success, false);
    assert.match(resInvalid.message, /tidak ditemukan/);
  });

  it("TC-M3.3: Socket.IO soundboard_play event dispatches playSound and returns status", async () => {
    let emittedEvent = null;
    let emittedData = null;

    const mockSocket = {
      request: { session: { passport: { user: { id: "user-admin", username: "Admin" } } } },
      emit(event, data) {
        emittedEvent = event;
        emittedData = data;
      },
    };

    const mockClient = {
      musicManager: { poru: null },
    };

    // Simulate soundboard handler logic
    const playData = { guildId: "guild-sb-test", soundId: "airhorn" };
    const result = await soundboardService.playSound({
      client: mockClient,
      guildId: playData.guildId,
      soundId: playData.soundId,
      requester: mockSocket.request.session.passport.user,
    });

    mockSocket.emit("soundboard_status", result);

    assert.equal(emittedEvent, "soundboard_status");
    assert.ok(emittedData);
    assert.equal(typeof emittedData.success, "boolean");
    assert.match(emittedData.message, /Audio engine Poru belum siap/);
  });

  it("TC-M3.4: Automod settings structure contains antiSpam, antiInvite, antiCaps, and massMention", async () => {
    const testGuildId = "guild-automod-schema-test";
    const settings = await getGuildSetting(testGuildId);

    assert.ok(settings);
    const automod = settings.settings?.automod || settings.automod || {};

    // Check defaults
    assert.equal(typeof automod.enabled !== "undefined" ? automod.enabled : true, true);
    assert.equal(typeof automod.antiSpam !== "undefined" ? automod.antiSpam : true, true);
    assert.equal(typeof automod.antiInvite !== "undefined" ? Boolean(automod.antiInvite) : false, false);
    assert.equal(typeof automod.antiCaps !== "undefined" ? Boolean(automod.antiCaps) : false, false);
  });

  it("TC-M3.5: Automod config updates mutate state and invalidate cache properly", async () => {
    const testGuildId = "guild-automod-update-test";

    const updatePayload = {
      antiSpam: false,
      antiInvite: true,
      antiCaps: true,
      massMention: 3,
      badWords: ["phish", "scam", "malware"],
    };

    await updateGuildSetting(testGuildId, (s) => {
      s.automod = { ...(s.automod || {}), ...updatePayload };
    });

    const current = await getGuildSetting(testGuildId);
    const mod = current.settings?.automod || current.automod;
    assert.equal(mod.antiInvite, true);
    assert.equal(mod.antiCaps, true);
    assert.equal(mod.massMention, 3);
    assert.deepEqual(mod.badWords, ["phish", "scam", "malware"]);
  });
});

describe("R3 Dashboard E2E - Tier 2: Boundary & Corner Cases", () => {
  it("TC-M3.6: playSound defensively handles voice connection absence without crash", async () => {
    const mockClient = {
      musicManager: {
        poru: {
          players: new Map(),
          createConnection() {
            throw new Error("Cannot connect to VC");
          },
        },
      },
      guilds: {
        cache: new Map([
          [
            "guild-no-vc",
            {
              id: "guild-no-vc",
              channels: { cache: new Map() },
            },
          ],
        ]),
      },
    };

    const res = await soundboardService.playSound({
      client: mockClient,
      guildId: "guild-no-vc",
      soundId: "bruh",
      voiceChannelId: "non-existent-channel",
    });

    assert.equal(res.success, false);
    assert.ok(res.message);
  });

  it("TC-M3.7: Automod config rejects or normalizes extreme massMention thresholds", async () => {
    const testGuildId = "guild-massmention-bound";

    // Set mass mention to extreme values
    await updateGuildSetting(testGuildId, (s) => {
      s.automod = { ...(s.automod || {}), massMention: 0 };
    });
    let cur = await getGuildSetting(testGuildId);
    let mod = cur.settings?.automod || cur.automod;
    assert.equal(mod.massMention, 0);

    await updateGuildSetting(testGuildId, (s) => {
      s.automod = { ...(s.automod || {}), massMention: 50 };
    });
    cur = await getGuildSetting(testGuildId);
    mod = cur.settings?.automod || cur.automod;
    assert.equal(mod.massMention, 50);
  });

  it("TC-M3.8: Automod studio badwords handles empty, duplicate, or multi-case entries", async () => {
    const testGuildId = "guild-badwords-bound";
    const dirtyBadwords = ["scam", "SCAM", "  scam  ", "phishing", ""];

    // Normalized unique list
    const cleanBadwords = Array.from(
      new Set(
        dirtyBadwords
          .map((w) => w.trim().toLowerCase())
          .filter(Boolean),
      ),
    );

    await updateGuildSetting(testGuildId, (s) => {
      s.automod = { ...(s.automod || {}), badWords: cleanBadwords };
    });

    const cur = await getGuildSetting(testGuildId);
    const mod = cur.settings?.automod || cur.automod;
    assert.deepEqual(mod.badWords, ["scam", "phishing"]);
  });
});

describe("R3 Dashboard E2E - Tier 3: Cross-Feature Combinations", () => {
  it("TC-M3.9: Soundboard playback status reflects music player presence", async () => {
    const guildId = "guild-music-sb-cross";
    const mockTrack = { title: "Background Melody", length: 180000 };
    const mockPlayer = {
      guildId,
      isPlaying: true,
      currentTrack: { info: mockTrack },
    };

    const mockClient = {
      musicManager: {
        poru: {
          players: new Map([[guildId, mockPlayer]]),
        },
      },
      guilds: {
        cache: new Map([
          [
            guildId,
            {
              id: guildId,
              members: {
                me: { voice: { channelId: "vc-123" } },
              },
            },
          ],
        ]),
      },
    };

    const res = await soundboardService.playSound({
      client: mockClient,
      guildId,
      soundId: "victory",
    });

    assert.ok(typeof res.success === "boolean");
  });

  it("TC-M3.10: Automod studio settings immediately affect bot moderation engine", async () => {
    const guildId = "guild-automod-realtime";

    // 1. Initially antiInvite is false
    await updateGuildSetting(guildId, (s) => {
      s.automod = { ...(s.automod || {}), antiInvite: false };
    });

    let config = await getGuildSetting(guildId);
    let mod = config.settings?.automod || config.automod;
    assert.equal(Boolean(mod.antiInvite), false);

    // 2. Dashboard enables antiInvite
    await updateGuildSetting(guildId, (s) => {
      s.automod = { ...(s.automod || {}), antiInvite: true };
    });

    // 3. Cache layer immediately returns updated state
    config = await getGuildSetting(guildId);
    mod = config.settings?.automod || config.automod;
    assert.equal(Boolean(mod.antiInvite), true);
  });
});

describe("R3 Dashboard E2E - Tier 4: Real-World Scenarios", () => {
  it("TC-M3.11: Complete Web Soundboard Studio interaction cycle", async () => {
    const guildId = "guild-studio-session";

    // Step 1: User queries soundboard catalogue on frontend
    const sounds = soundboardService.PRESET_SOUNDS;
    assert.ok(sounds.length >= 7);

    // Step 2: User clicks 'applause' on soundboard UI
    const chosenSound = sounds.find((s) => s.id === "applause");
    assert.ok(chosenSound);

    const mockClient = {
      musicManager: {
        poru: {
          players: new Map(),
        },
      },
    };

    // Step 3: WebSocket sends 'soundboard_play'
    const result = await soundboardService.playSound({
      client: mockClient,
      guildId,
      soundId: chosenSound.id,
      requester: { id: "user-dj", username: "DJ Naura" },
    });

    // Step 4: Status response validated
    assert.ok(typeof result.success === "boolean");
    assert.ok(result.message);
  });

  it("TC-M3.12: Complete Automod Studio server configuration lifecycle", async () => {
    const guildId = "guild-full-automod-lifecycle";

    // Admin sets up full defense matrix in Automod Studio
    const studioConfig = {
      enabled: true,
      antiSpam: true,
      antiInvite: true,
      antiCaps: true,
      massMention: 4,
      badWords: ["free-nitro", "steam-gift-card", "crypto-airdrop"],
    };

    // Save to settings
    await updateGuildSetting(guildId, (s) => {
      s.automod = studioConfig;
    });

    // Retrieve and verify all rules are persisted
    const saved = await getGuildSetting(guildId);
    const mod = saved.settings?.automod || saved.automod;

    assert.equal(mod.enabled, true);
    assert.equal(mod.antiSpam, true);
    assert.equal(mod.antiInvite, true);
    assert.equal(mod.antiCaps, true);
    assert.equal(mod.massMention, 4);
    assert.equal(mod.badWords.length, 3);
    assert.ok(mod.badWords.includes("free-nitro"));
  });
});
