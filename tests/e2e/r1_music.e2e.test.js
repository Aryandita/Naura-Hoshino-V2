"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  formatDuration,
  parseTimestampToMs,
  clampSeekPosition,
} = require("../../plugin/music/helpers/musicShared");
const playbackControls = require("../../plugin/music/subcommands/playbackControls");
const MusicManager = require("../../src/managers/musicManager");

function extractContainerText(payload) {
  if (!payload || !payload.components) return "";
  const root = payload.components[0]?.components || [];
  return root
    .map((c) => {
      if (c.content) return c.content;
      if (Array.isArray(c.components)) {
        return c.components.map((sub) => sub.content || "").join(" ");
      }
      return "";
    })
    .join(" ");
}

describe("R1 Music E2E - Tier 1: Feature Coverage", () => {
  it("TC-M1.1: parseTimestampToMs parses mm:ss colon format accurately", () => {
    assert.equal(parseTimestampToMs("0:00"), 0);
    assert.equal(parseTimestampToMs("0:45"), 45000);
    assert.equal(parseTimestampToMs("1:30"), 90000);
    assert.equal(parseTimestampToMs("01:30"), 90000);
    assert.equal(parseTimestampToMs("12:05"), 725000);
    assert.equal(parseTimestampToMs("59:59"), 3599000);
  });

  it("TC-M1.2: parseTimestampToMs parses hh:mm:ss long colon format accurately", () => {
    assert.equal(parseTimestampToMs("1:00:00"), 3600000);
    assert.equal(parseTimestampToMs("01:15:30"), 4530000);
    assert.equal(parseTimestampToMs("02:00:00"), 7200000);
  });

  it("TC-M1.3: parseTimestampToMs parses pure seconds (number and string)", () => {
    assert.equal(parseTimestampToMs(0), 0);
    assert.equal(parseTimestampToMs(45), 45000);
    assert.equal(parseTimestampToMs(90), 90000);
    assert.equal(parseTimestampToMs("90"), 90000);
    assert.equal(parseTimestampToMs("120.5"), 120500);
  });

  it("TC-M1.4: parseTimestampToMs parses unit label durations (h/m/s combinations)", () => {
    assert.equal(parseTimestampToMs("45s"), 45000);
    assert.equal(parseTimestampToMs("1m30s"), 90000);
    assert.equal(parseTimestampToMs("10m"), 600000);
    assert.equal(parseTimestampToMs("1h"), 3600000);
    assert.equal(parseTimestampToMs("1h2m3s"), 3723000);
  });

  it("TC-M1.5: formatDuration formats milliseconds to human readable string", () => {
    assert.equal(formatDuration(0), "0:00");
    assert.equal(formatDuration(45000), "0:45");
    assert.equal(formatDuration(90000), "1:30");
    assert.equal(formatDuration(3665000), "1:01:05");
    assert.equal(formatDuration(8640000000), "🔴 LIVE");
  });

  it("TC-M1.6: clampSeekPosition restricts seek within [0, trackLength]", () => {
    assert.equal(clampSeekPosition(50000, 180000), 50000);
    assert.equal(clampSeekPosition(250000, 180000), 180000);
    assert.equal(clampSeekPosition(-1000, 180000), 0);
  });

  it("TC-M1.7: /music seek subcommand moves player position and returns container", async () => {
    let soughtPosition = null;
    const mockTrack = {
      title: "Naura Cyberpunk Anthem",
      uri: "https://youtube.com/watch?v=mock123",
      length: 240000,
      isSeekable: true,
      isStream: false,
    };

    const mockPlayer = {
      isPlaying: true,
      isPaused: false,
      position: 15000,
      currentTrack: { info: mockTrack },
      queue: [],
      async seekTo(pos) {
        soughtPosition = pos;
        this.position = pos;
      },
    };

    let replyPayload = null;
    const mockCtx = {
      client: {},
      player: mockPlayer,
      args: { posisi: "1:30" },
      guild: { id: "guild-123" },
      sendReply(payload) {
        replyPayload = payload;
        return payload;
      },
    };

    await playbackControls.seek(mockCtx);

    assert.equal(soughtPosition, 90000);
    assert.equal(mockPlayer.position, 90000);
    assert.ok(replyPayload);
    const text = extractContainerText(replyPayload);
    assert.match(text, /Posisi Lagu Dipindahkan/);
    assert.match(text, /1:30/);
  });

  it("TC-M1.8: /music sleep activates centralized sleep timer in musicManager", () => {
    const musicManager = new MusicManager();
    const guildId = "guild-sleep-1";
    musicManager.cancelSleepTimer(guildId);

    const timer = musicManager.setSleepTimer(guildId, 15);
    assert.ok(timer);
    assert.equal(timer.guildId, guildId);
    assert.equal(timer.minutes, 15);
    assert.ok(timer.endsAt > Date.now());

    const status = musicManager.getSleepTimer(guildId);
    assert.ok(status);
    assert.equal(status.minutes, 15);
    assert.ok(status.remainingMs > 0);
    assert.equal(status.isFading, false);

    musicManager.cancelSleepTimer(guildId);
    assert.equal(musicManager.getSleepTimer(guildId), null);
  });
});

describe("R1 Music E2E - Tier 2: Boundary & Corner Cases", () => {
  it("TC-M1.9: parseTimestampToMs returns null for invalid inputs", () => {
    assert.equal(parseTimestampToMs(null), null);
    assert.equal(parseTimestampToMs(undefined), null);
    assert.equal(parseTimestampToMs(""), null);
    assert.equal(parseTimestampToMs("   "), null);
    assert.equal(parseTimestampToMs("abc"), null);
    assert.equal(parseTimestampToMs("1:2:3:4"), null);
    assert.equal(parseTimestampToMs("::"), null);
    assert.equal(parseTimestampToMs("-10"), null);
    assert.equal(parseTimestampToMs(-5), null);
  });

  it("TC-M1.10: parseTimestampToMs rejects seconds overflow (seconds >= 60)", () => {
    assert.equal(parseTimestampToMs("1:60"), null);
    assert.equal(parseTimestampToMs("0:99"), null);
    assert.equal(parseTimestampToMs("1:00:65"), null);
    assert.equal(parseTimestampToMs("1:75:30"), null);
  });

  it("TC-M1.11: seek rejects non-seekable live stream tracks", async () => {
    const livePlayer = {
      isPlaying: true,
      currentTrack: {
        info: {
          title: "Naura Radio Live 24/7",
          length: 0,
          isSeekable: false,
          isStream: true,
        },
      },
      async seekTo() {},
    };

    let replyPayload = null;
    const ctx = {
      player: livePlayer,
      args: { posisi: "1:00" },
      guild: { id: "guild-live" },
      sendReply(p) {
        replyPayload = p;
      },
    };

    await playbackControls.seek(ctx);
    assert.ok(replyPayload);
    const text = extractContainerText(replyPayload);
    assert.match(text, /Tidak Dapat Di-seek/);
  });

  it("TC-M1.12: seek rejects when no music is actively playing", async () => {
    let replyPayload = null;
    const ctx = {
      player: null,
      args: { posisi: "1:00" },
      sendReply(p) {
        replyPayload = p;
      },
    };

    await playbackControls.seek(ctx);
    assert.ok(replyPayload);
    const text = extractContainerText(replyPayload);
    assert.match(text, /Tidak Ada Musik/);
  });

  it("TC-M1.13: seek rejects timestamp beyond song duration", async () => {
    const player = {
      isPlaying: true,
      currentTrack: {
        info: {
          title: "Short Song",
          length: 60000, // 1 minute
          isSeekable: true,
          isStream: false,
        },
      },
      async seekTo() {},
    };

    let replyPayload = null;
    const ctx = {
      player,
      args: { posisi: "2:00" }, // 2 minutes (exceeds 1 min)
      sendReply(p) {
        replyPayload = p;
      },
    };

    await playbackControls.seek(ctx);
    assert.ok(replyPayload);
    const text = extractContainerText(replyPayload);
    assert.match(text, /Format Durasi Salah/);
  });

  it("TC-M1.14: sleep rejects negative or invalid minutes", async () => {
    let replyPayload = null;
    const ctx = {
      player: { isPlaying: true },
      args: { menit: -5 },
      sendReply(p) {
        replyPayload = p;
      },
    };

    await playbackControls.sleep(ctx);
    assert.ok(replyPayload);
    const text = extractContainerText(replyPayload);
    assert.match(text, /Durasi Tidak Valid/);
  });

  it("TC-M1.15: sleep cancels existing timer when menit is 0", async () => {
    const musicManager = new MusicManager();
    const guildId = "guild-cancel-0";
    musicManager.setSleepTimer(guildId, 20);
    assert.ok(musicManager.getSleepTimer(guildId));

    let replyPayload = null;
    const ctx = {
      client: { musicManager },
      player: { isPlaying: true },
      args: { menit: 0 },
      guild: { id: guildId },
      sendReply(p) {
        replyPayload = p;
      },
    };

    await playbackControls.sleep(ctx);
    assert.ok(replyPayload);
    const text = extractContainerText(replyPayload);
    assert.match(text, /Timer Tidur Dibatalkan/);
    assert.equal(musicManager.getSleepTimer(guildId), null);
  });
});

describe("R1 Music E2E - Tier 3: Cross-Feature Combinations", () => {
  it("TC-M1.16: seek while paused retains paused state and updates position", async () => {
    let seekTarget = null;
    const mockPlayer = {
      isPlaying: true,
      isPaused: true,
      position: 10000,
      currentTrack: {
        info: { title: "Track", length: 180000, isSeekable: true, isStream: false },
      },
      queue: [],
      async seekTo(pos) {
        seekTarget = pos;
        this.position = pos;
      },
    };

    const ctx = {
      client: {},
      player: mockPlayer,
      args: { posisi: "2:00" },
      guild: { id: "guild-paused" },
      sendReply(p) { return p; },
    };

    await playbackControls.seek(ctx);
    assert.equal(seekTarget, 120000);
    assert.equal(mockPlayer.isPaused, true);
    assert.equal(mockPlayer.position, 120000);
  });

  it("TC-M1.17: seek while sleep timer is active maintains timer integrity", async () => {
    const musicManager = new MusicManager();
    const guildId = "guild-seek-sleep";
    musicManager.setSleepTimer(guildId, 30);
    const initialTimer = musicManager.getSleepTimer(guildId);
    assert.ok(initialTimer);

    const mockPlayer = {
      isPlaying: true,
      isPaused: false,
      position: 0,
      currentTrack: {
        info: { title: "Track", length: 300000, isSeekable: true, isStream: false },
      },
      queue: [],
      async seekTo(pos) { this.position = pos; },
    };

    const ctx = {
      client: {},
      player: mockPlayer,
      args: { posisi: "1:00" },
      guild: { id: guildId },
      sendReply(p) { return p; },
    };

    await playbackControls.seek(ctx);
    assert.equal(mockPlayer.position, 60000);

    const timerAfterSeek = musicManager.getSleepTimer(guildId);
    assert.ok(timerAfterSeek);
    assert.equal(timerAfterSeek.endsAt, initialTimer.endsAt);

    musicManager.cancelSleepTimer(guildId);
  });

  it("TC-M1.18: volume restoration on sleep timer cancel during fade-out", () => {
    const musicManager = new MusicManager();
    const guildId = "guild-vol-restore";
    let currentVol = 100;
    const mockPlayer = {
      guildId,
      volume: 100,
      setVolume(v) {
        currentVol = v;
        this.volume = v;
      },
    };

    musicManager._poru = { players: new Map([[guildId, mockPlayer]]) };

    // Register a timer that starts fade immediately
    const entry = musicManager.setSleepTimer(guildId, 0.1); // ~6 seconds, pure fade
    assert.ok(entry);

    // Simulate volume dropped during fade
    mockPlayer.setVolume(30);
    assert.equal(currentVol, 30);

    // Cancel timer
    musicManager.cancelSleepTimer(guildId);

    // Volume must be restored to initial volume 100
    assert.equal(mockPlayer.volume, 100);
    assert.equal(currentVol, 100);
  });
});

describe("R1 Music E2E - Tier 4: Real-World Scenarios", () => {
  it("TC-M1.19: Complete DJ listening session with multi-seek and progress checks", async () => {
    const guildId = "guild-dj-session";
    const trackLength = 360000; // 6 minutes
    const mockTrack = {
      title: "Naura Cyber DJ Anthem",
      uri: "https://naura.hoshino/anthem",
      length: trackLength,
      isSeekable: true,
      isStream: false,
    };

    const player = {
      isPlaying: true,
      isPaused: false,
      position: 0,
      volume: 80,
      currentTrack: { info: mockTrack },
      queue: [],
      async seekTo(pos) { this.position = pos; },
    };

    const ctx = {
      client: {},
      player,
      args: {},
      guild: { id: guildId },
      sendReply(p) { return p; },
    };

    // 1. Jump to Intro climax (0:45)
    ctx.args = { posisi: "0:45" };
    await playbackControls.seek(ctx);
    assert.equal(player.position, 45000);

    // 2. Jump to Bridge (3:15)
    ctx.args = { posisi: "3:15" };
    await playbackControls.seek(ctx);
    assert.equal(player.position, 195000);

    // 3. Jump to Outro (5:30)
    ctx.args = { posisi: "5:30" };
    await playbackControls.seek(ctx);
    assert.equal(player.position, 330000);
  });

  it("TC-M1.20: Complete sleep timer lifecycle with fade-out callbacks and cleanup", async () => {
    const musicManager = new MusicManager();
    const guildId = "guild-bedtime-cycle";
    let fadeStarted = false;
    let expired = false;
    let playerDestroyed = false;

    const mockPlayer = {
      guildId,
      volume: 100,
      setVolume(v) { this.volume = v; },
      destroy() { playerDestroyed = true; },
      textChannel: "chan-123",
    };

    musicManager._poru = { players: new Map([[guildId, mockPlayer]]) };
    musicManager.client = {
      channels: {
        cache: new Map([
          [
            "chan-123",
            {
              async send(payload) {
                return payload;
              },
            },
          ],
        ]),
      },
    };

    // Trigger timer with mock callbacks
    musicManager.setSleepTimer(guildId, 0.05, { // 3 seconds total
      onFadeStart() {
        fadeStarted = true;
      },
      onExpire() {
        expired = true;
      },
    });

    assert.equal(fadeStarted, true);

    // Wait for fade interval to conclude (poll up to 6s for high-load test runners)
    const startTime = Date.now();
    while (!expired && Date.now() - startTime < 6000) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    assert.equal(expired, true);
    assert.equal(playerDestroyed, true);
    assert.equal(musicManager.getSleepTimer(guildId), null);
  });
});
