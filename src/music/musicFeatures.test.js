"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  formatDuration,
  parseTimestampToMs,
  clampSeekPosition,
} = require("../../plugin/music/helpers/musicShared");
const MusicManager = require("../managers/musicManager");
const playbackControls = require("../../plugin/music/subcommands/playbackControls");

describe("R1 Advanced Music System - Timestamp Parsing & Clamping", () => {
  describe("parseTimestampToMs", () => {
    it("mem-parsing format mm:ss dengan benar", () => {
      assert.strictEqual(parseTimestampToMs("01:30"), 90000);
      assert.strictEqual(parseTimestampToMs("1:30"), 90000);
      assert.strictEqual(parseTimestampToMs("02:15"), 135000);
      assert.strictEqual(parseTimestampToMs("00:45"), 45000);
      assert.strictEqual(parseTimestampToMs("0:00"), 0);
      assert.strictEqual(parseTimestampToMs("10:00"), 600000);
    });

    it("mem-parsing format hh:mm:ss dengan benar", () => {
      assert.strictEqual(parseTimestampToMs("01:02:03"), 3723000);
      assert.strictEqual(parseTimestampToMs("1:00:00"), 3600000);
      assert.strictEqual(parseTimestampToMs("00:01:30"), 90000);
      assert.strictEqual(parseTimestampToMs("02:15:30"), 8130000);
    });

    it("mem-parsing detik murni (string dan number)", () => {
      assert.strictEqual(parseTimestampToMs("90"), 90000);
      assert.strictEqual(parseTimestampToMs("120"), 120000);
      assert.strictEqual(parseTimestampToMs("0"), 0);
      assert.strictEqual(parseTimestampToMs(90), 90000);
      assert.strictEqual(parseTimestampToMs(0), 0);
      assert.strictEqual(parseTimestampToMs(45.5), 45500);
    });

    it("mem-parsing durasi berlabel (1h2m3s, 1m30s, 45s)", () => {
      assert.strictEqual(parseTimestampToMs("1m30s"), 90000);
      assert.strictEqual(parseTimestampToMs("45s"), 45000);
      assert.strictEqual(parseTimestampToMs("1h"), 3600000);
      assert.strictEqual(parseTimestampToMs("1h2m3s"), 3723000);
    });

    it("menolak format yang tidak valid", () => {
      assert.strictEqual(parseTimestampToMs(""), null);
      assert.strictEqual(parseTimestampToMs("   "), null);
      assert.strictEqual(parseTimestampToMs(null), null);
      assert.strictEqual(parseTimestampToMs(undefined), null);
      assert.strictEqual(parseTimestampToMs("bukan-waktu"), null);
      assert.strictEqual(parseTimestampToMs("-10"), null);
      assert.strictEqual(parseTimestampToMs(-50), null);
      assert.strictEqual(parseTimestampToMs("01:60"), null); // detik >= 60 tidak valid
      assert.strictEqual(parseTimestampToMs("01:75"), null);
      assert.strictEqual(parseTimestampToMs("01:60:00"), null); // menit >= 60 pada hh:mm:ss tidak valid
      assert.strictEqual(parseTimestampToMs("1:2:3:4"), null); // bagian terlalu banyak
    });
  });

  describe("clampSeekPosition", () => {
    it("membatasi nilai negatif ke 0", () => {
      assert.strictEqual(clampSeekPosition(-5000, 180000), 0);
      assert.strictEqual(clampSeekPosition(-1, 60000), 0);
    });

    it("membatasi nilai yang melebihi panjang lagu ke panjang lagu maksimal", () => {
      assert.strictEqual(clampSeekPosition(250000, 180000), 180000);
      assert.strictEqual(clampSeekPosition(9999999, 120000), 120000);
    });

    it("mempertahankan nilai yang berada dalam batas durasi", () => {
      assert.strictEqual(clampSeekPosition(90000, 180000), 90000);
      assert.strictEqual(clampSeekPosition(0, 180000), 0);
      assert.strictEqual(clampSeekPosition(180000, 180000), 180000);
    });

    it("menangani input non-numerik secara defensif", () => {
      assert.strictEqual(clampSeekPosition("invalid", 180000), 0);
      assert.strictEqual(clampSeekPosition(50000, "invalid"), 0);
    });
  });

  describe("formatDuration", () => {
    it("memformat milidetik ke representasi waktu manusia", () => {
      assert.strictEqual(formatDuration(0), "0:00");
      assert.strictEqual(formatDuration(90000), "1:30");
      assert.strictEqual(formatDuration(3723000), "1:02:03");
      assert.strictEqual(formatDuration(null), "0:00");
    });
  });
});

describe("R1 Advanced Music System - Seek Subcommand Handler", () => {
  it("menolak seek jika tidak ada pemutar aktif", async () => {
    let sentPayload = null;
    let isEphemeral = false;

    const ctx = {
      player: null,
      args: { posisi: "1:30" },
      sendReply: async (payload, ephemeral) => {
        sentPayload = payload;
        isEphemeral = ephemeral;
        return payload;
      },
    };

    await playbackControls.seek(ctx);
    assert.ok(sentPayload);
    assert.strictEqual(isEphemeral, true);
  });

  it("menolak seek jika lagu merupakan live stream atau isSeekable bernilai false", async () => {
    let sentPayload = null;

    const ctx = {
      player: {
        isPlaying: true,
        currentTrack: {
          info: {
            title: "Live Stream 24/7",
            length: 0,
            isStream: true,
            isSeekable: false,
          },
        },
      },
      args: { posisi: "1:30" },
      sendReply: async (payload) => {
        sentPayload = payload;
        return payload;
      },
    };

    await playbackControls.seek(ctx);
    assert.ok(sentPayload);
  });

  it("menolak seek jika format timestamp salah atau di luar batas lagu", async () => {
    let sentPayload = null;

    const ctx = {
      player: {
        isPlaying: true,
        currentTrack: {
          info: {
            title: "Short Song",
            length: 60000, // 1 menit
            isStream: false,
            isSeekable: true,
          },
        },
      },
      args: { posisi: "5:00" }, // 5 menit melebihi 1 menit
      sendReply: async (payload) => {
        sentPayload = payload;
        return payload;
      },
    };

    await playbackControls.seek(ctx);
    assert.ok(sentPayload);
  });

  it("berhasil melakukan seek ke posisi yang valid", async () => {
    let seekedPosition = null;
    let sentPayload = null;

    const ctx = {
      client: {},
      guild: { id: "guild_123" },
      player: {
        isPlaying: true,
        position: 0,
        currentTrack: {
          info: {
            title: "Cyberpunk Melancholy",
            length: 180000, // 3 menit
            isStream: false,
            isSeekable: true,
          },
        },
        seekTo: async (pos) => {
          seekedPosition = pos;
        },
        queue: [],
      },
      args: { posisi: "1:30" }, // 90000 ms
      sendReply: async (payload) => {
        sentPayload = payload;
        return payload;
      },
    };

    await playbackControls.seek(ctx);
    assert.strictEqual(seekedPosition, 90000);
    assert.strictEqual(ctx.player.position, 90000);
    assert.ok(sentPayload);
  });

  it("mendukung pemanggilan via handleSeek wrapper", async () => {
    let seekedPosition = null;
    const mockPlayer = {
      isPlaying: true,
      position: 0,
      currentTrack: {
        info: {
          title: "Tokyo Skyline",
          length: 200000,
          isStream: false,
          isSeekable: true,
        },
      },
      seekTo: async (pos) => {
        seekedPosition = pos;
      },
      queue: [],
    };

    const mockClient = {
      musicManager: {
        poru: {
          players: new Map([["g_456", mockPlayer]]),
        },
      },
    };

    let replyPayload = null;
    const mockInteraction = {
      guildId: "g_456",
      guild: { id: "g_456" },
      user: { id: "u_1" },
      member: { voice: { channel: { id: "vc_1" } } },
      channel: { id: "c_1" },
      options: {
        getString: (name) => (name === "posisi" ? "02:00" : null),
      },
      reply: async (payload) => {
        replyPayload = payload;
        return payload;
      },
    };

    await playbackControls.handleSeek(mockInteraction, mockClient);
    assert.strictEqual(seekedPosition, 120000);
    assert.ok(replyPayload);
  });
});

describe("R1 Advanced Music System - Sleep Timer Lifecycle & Fade-Out", () => {
  const dummyClient = {
    guilds: { cache: new Map() },
    channels: { cache: new Map() },
  };

  it("mendaftarkan sleep timer baru dan membaca statusnya", () => {
    const manager = new MusicManager(dummyClient);
    const timer = manager.setSleepTimer("guild_test_sleep", 30);

    assert.ok(timer);
    assert.strictEqual(timer.guildId, "guild_test_sleep");
    assert.strictEqual(timer.minutes, 30);
    assert.ok(timer.endsAt > Date.now());

    const status = manager.getSleepTimer("guild_test_sleep");
    assert.ok(status);
    assert.strictEqual(status.minutes, 30);
    assert.ok(status.remainingMs > 0);
    assert.ok(status.remainingSeconds > 0);
    assert.strictEqual(status.isFading, false);

    // Bersihkan
    manager.cancelSleepTimer("guild_test_sleep");
    assert.strictEqual(manager.getSleepTimer("guild_test_sleep"), null);
  });

  it("membersihkan timer lama jika timer baru didaftarkan untuk guild yang sama", () => {
    const manager = new MusicManager(dummyClient);
    const timer1 = manager.setSleepTimer("guild_replace", 15);
    const timeout1 = timer1.timeoutId;

    const timer2 = manager.setSleepTimer("guild_replace", 45);
    assert.strictEqual(timer2.minutes, 45);
    assert.notStrictEqual(timer2.timeoutId, timeout1);

    manager.cancelSleepTimer("guild_replace");
    assert.strictEqual(manager.getSleepTimer("guild_replace"), null);
  });

  it("membatalkan timer saat durasi disetel ke 0", () => {
    const manager = new MusicManager(dummyClient);
    manager.setSleepTimer("guild_zero", 20);
    assert.ok(manager.getSleepTimer("guild_zero"));

    const cancelRes = manager.setSleepTimer("guild_zero", 0);
    assert.strictEqual(cancelRes.cancelled, true);
    assert.strictEqual(manager.getSleepTimer("guild_zero"), null);
  });

  it("menjalankan callback fade-out volume bertahap dan mematikan pemutar saat timer berakhir", (t, done) => {
    const manager = new MusicManager(dummyClient);

    const volumeHistory = [];
    let destroyed = false;

    const mockPlayer = {
      guildId: "guild_fade_test",
      volume: 100,
      setVolume: (v) => {
        mockPlayer.volume = v;
        volumeHistory.push(v);
      },
      destroy: () => {
        destroyed = true;
      },
    };

    manager._poru = {
      players: new Map([["guild_fade_test", mockPlayer]]),
    };

    // Jalankan timer singkat (0.005 menit = 300 ms) untuk menguji kalkulasi fade-out
    let fadeStarted = false;
    manager.setSleepTimer(
      "guild_fade_test",
      0.005,
      {
        onFadeStart: () => {
          fadeStarted = true;
        },
        onExpire: () => {
          assert.strictEqual(fadeStarted, true);
          assert.strictEqual(destroyed, true);
          // Volume harus menurun bertahap menuju 0
          assert.ok(volumeHistory.length > 0);
          assert.strictEqual(mockPlayer.volume, 0);
          // Map harus bersih dari guildId
          assert.strictEqual(manager.getSleepTimer("guild_fade_test"), null);
          done();
        },
      },
    );
  });

  it("membersihkan sleep timer saat cancelSleepTimer dipanggil", () => {
    const manager = new MusicManager(dummyClient);
    manager.setSleepTimer("guild_clean", 60);

    const cancelled = manager.cancelSleepTimer("guild_clean");
    assert.strictEqual(cancelled, true);
    assert.strictEqual(manager.sleepTimers.has("guild_clean"), false);

    // Pembatalan kedua harus bernilai false karena sudah bersih
    const cancelledAgain = manager.cancelSleepTimer("guild_clean");
    assert.strictEqual(cancelledAgain, false);
  });

  it("subcommand sleep merespons perintah membatalkan timer jika menit === 0", async () => {
    const manager = new MusicManager(dummyClient);
    manager.setSleepTimer("g_sub_sleep", 30);

    let sentPayload = null;
    const ctx = {
      client: { musicManager: manager },
      guild: { id: "g_sub_sleep" },
      player: { isPlaying: true },
      args: { menit: 0 },
      sendReply: async (payload) => {
        sentPayload = payload;
        return payload;
      },
    };

    await playbackControls.sleep(ctx);
    assert.ok(sentPayload);
    assert.strictEqual(manager.getSleepTimer("g_sub_sleep"), null);
  });

  it("subcommand sleep merespons perintah mengaktifkan timer jika menit > 0", async () => {
    const manager = new MusicManager(dummyClient);

    let sentPayload = null;
    const ctx = {
      client: { musicManager: manager },
      guild: { id: "g_sub_sleep_2" },
      player: { isPlaying: true },
      args: { menit: 45 },
      sendReply: async (payload) => {
        sentPayload = payload;
        return payload;
      },
    };

    await playbackControls.sleep(ctx);
    assert.ok(sentPayload);
    const timer = manager.getSleepTimer("g_sub_sleep_2");
    assert.ok(timer);
    assert.strictEqual(timer.minutes, 45);

    manager.cancelSleepTimer("g_sub_sleep_2");
  });
});
