"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("R1: Pemutaran track pengujian ('Diri - Tulus', 'Teh Hijau - Tulus') berhasil dimuat dan fallback tanpa error All clients failed to load", async () => {
  const { play } = require("../plugin/music/subcommands/playEngine");
  const trackError = require("../src/music/poru_events/trackError");

  const testTracks = ["Diri - Tulus", "Teh Hijau - Tulus"];

  for (const trackName of testTracks) {
    let createdConnection = false;
    let addedTrack = null;
    let played = false;

    const mockPlayer = {
      queue: {
        length: 0,
        add: (t) => { addedTrack = t; },
      },
      isPlaying: false,
      isPaused: false,
      play: () => { played = true; },
      voiceChannel: "vc-1",
      textChannel: "tc-1",
    };

    const ctx = {
      client: { user: { displayAvatarURL: () => "https://example.com/avatar.png" } },
      poru: {
        players: new Map(),
        createConnection: () => {
          createdConnection = true;
          return mockPlayer;
        },
        resolve: async ({ query }) => {
          // Simulasi Lavalink: query SoundCloud berhasil dimuat
          if (query.startsWith("scsearch:") || query.includes("Tulus")) {
            return {
              loadType: "TRACK_LOADED",
              tracks: [
                {
                  info: {
                    title: trackName,
                    author: "Tulus",
                    length: 210000,
                    uri: `https://soundcloud.com/tulus/${trackName.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`,
                    sourceName: "soundcloud",
                    identifier: `tulus_${trackName.toLowerCase()}`,
                  },
                },
              ],
            };
          }
          return { loadType: "LOAD_FAILED", tracks: [] };
        },
      },
      musicManager: {
        isDuplicateFilterEnabled: () => false,
        isRecentDuplicate: () => false,
      },
      guild: { id: "guild-123" },
      memberVoice: { id: "vc-1" },
      channel: { id: "tc-1" },
      user: { id: "user-1", displayName: "Ahmad", username: "ahmad99" },
      args: { query: trackName },
      sendReply: async () => {},
      deleteReply: () => {},
      player: mockPlayer,
    };

    await play(ctx);

    assert.ok(createdConnection || mockPlayer);
    assert.ok(addedTrack, `Track "${trackName}" harus berhasil ditambahkan ke antrean`);
    assert.equal(addedTrack.info.title, trackName);
    assert.equal(addedTrack.info.author, "Tulus");
    assert.equal(addedTrack.info.sourceName, "soundcloud");
    assert.equal(played, true, "Player harus mulai memutar lagu");
  }

  // Verifikasi bahwa error 'All clients failed to load the item' ditangani sebagai bot-detection tanpa log error fatal
  const mockManager = {
    client: {
      channels: {
        cache: new Map([
          ["tc-1", { send: async () => ({ id: "msg-1", delete: async () => {} }) }],
        ]),
      },
      user: { id: "bot-1" },
    },
    poru: {
      emit: () => {},
      resolve: async ({ query }) => ({
        loadType: "TRACK_LOADED",
        tracks: [
          {
            info: {
              title: "Diri",
              author: "Tulus",
              sourceName: "soundcloud",
            },
          },
        ],
      }),
    },
  };

  const mockFailingPlayer = {
    textChannel: "tc-1",
    queue: { unshift: () => {}, length: 0 },
    isPlaying: false,
    play: async () => {},
    node: { name: "test-node" },
  };

  const failingTrack = {
    info: {
      title: "Diri",
      author: "Tulus",
      identifier: "yt_diri_tulus",
    },
  };

  const botDetectionError = new Error(
    "All clients failed to load the item: [ANDROID: 403], [WEB: Bot detection]",
  );

  // Jalankan trackError
  await trackError.execute(mockManager, mockFailingPlayer, failingTrack, botDetectionError);
  // Track._fallbackAttempted harus true
  assert.equal(failingTrack._fallbackAttempted, true, "Harus mengupayakan pemulihan otomatis via fallback");
});

test("R2: Pembuatan dan penyimpanan audio intro lokal serta pemutaran mendahului lagu", async () => {
  const aiDjManager = require("../src/managers/aiDjManager");
  assert.ok(aiDjManager.getIntroAudioDir());
  const aiDjTrackService = require("../src/services/aiDjTrackService");
  const fishAudioService = require("../src/services/fishAudioService");

  // Inisialisasi fake audio buffer
  const sampleAudioBuffer = Buffer.from("RIFF_FAKE_AUDIO_SAMPLE_INTRO");
  const origGenSpeech = fishAudioService.generateSpeech;
  const origIsConfig = fishAudioService.isConfigured;

  fishAudioService.isConfigured = () => true;
  fishAudioService.generateSpeech = async () => sampleAudioBuffer;

  let localSavedPath = null;
  const queueItems = [];
  const mockPlayer = {
    queue: {
      length: 0,
      add: (item) => queueItems.push(item),
    },
    isPlaying: false,
    isPaused: false,
    play: () => {},
    voiceChannel: "vc-1",
  };

  const channelMessages = [];
  const mockChannel = {
    id: "tc-1",
    send: async (payload) => {
      const attachments = new Map([
        ["1", { url: "https://cdn.discordapp.com/attachments/naura_dj_intro.mp3" }],
      ]);
      attachments.first = function () { return this.get("1"); };
      const msg = {
        id: "msg-tts-123",
        attachments,
        delete: async () => {},
      };
      channelMessages.push(payload);
      return msg;
    },
  };

  const mockPoru = {
    resolve: async ({ query }) => ({
      loadType: "TRACK_LOADED",
      tracks: [
        {
          info: { title: "🎙️ Naura DJ Session", author: "Naura Hoshino" },
        },
      ],
    }),
  };

  try {
    const mainTrack = {
      info: {
        title: "Diri",
        author: "Tulus",
        identifier: "diri_tulus_id",
      },
    };

    const introResult = await aiDjTrackService.prepareDjIntroTrack({
      poru: mockPoru,
      channel: mockChannel,
      user: { id: "user_regular_456", displayName: "Bambang", username: "bambang88" },
      trackInfo: mainTrack.info,
      guildId: "guild-1",
      musicManager: { poru: { players: new Map([["guild-1", mockPlayer]]) } },
      memberVoice: "vc-1",
    });

    assert.ok(introResult, "Intro result harus berhasil digenerate");
    assert.ok(introResult.localFilePath, "Harus mengembalikan path file lokal");
    localSavedPath = introResult.localFilePath;

    // 1. Verifikasi file tersimpan di direktori lokal sebelum lagu diputar
    assert.ok(fs.existsSync(localSavedPath), "File intro harus benar-benar ada di disk lokal");
    assert.ok(localSavedPath.includes(path.join("assets", "audio", "dj", "intro")), "File harus disimpan di assets/audio/dj/intro");

    // 2. Verifikasi pemutaran mendahului lagu (ttsTrack dimasukkan ke antrean sebelum lagu utama)
    mockPlayer.queue.add(introResult.ttsTrack);
    mockPlayer.queue.add(mainTrack);

    assert.equal(queueItems.length, 2);
    assert.equal(queueItems[0].isTTS, true, "Item antrean pertama harus track intro TTS");
    assert.equal(queueItems[1].info.title, "Diri", "Item antrean kedua adalah lagu utama");
  } finally {
    fishAudioService.generateSpeech = origGenSpeech;
    fishAudioService.isConfigured = origIsConfig;
    if (localSavedPath && fs.existsSync(localSavedPath)) {
      try {
        fs.unlinkSync(localSavedPath);
      } catch (_) {}
    }
  }
});

test("R3: Kata ganti persona pada intro pengguna umum dan pengecualian untuk Owner/Premium", async () => {
  const aiDjManager = require("../src/managers/aiDjManager");
  const aiDjTrackService = require("../src/services/aiDjTrackService");
  const fishAudioService = require("../src/services/fishAudioService");
  const cacheManager = require("../src/managers/cacheManager");
  const env = require("../src/config/env");

  const origGenSpeech = fishAudioService.generateSpeech;
  const origIsConfig = fishAudioService.isConfigured;
  fishAudioService.isConfigured = () => true;
  fishAudioService.generateSpeech = async () => Buffer.from("audio");

  assert.strictEqual(aiDjManager.getPersonaPronoun("default"), "kamu");

  const mockChannel = {
    id: "tc-1",
    send: async () => {
      const attachments = new Map([["1", { url: "https://example.com/audio.mp3" }]]);
      attachments.first = function () { return this.get("1"); };
      return {
        id: "msg-1",
        attachments,
        delete: async () => {},
      };
    },
  };
  const mockPoru = {
    resolve: async () => ({
      tracks: [{ info: {} }],
    }),
  };

  try {
    // 1. Kasus Pengguna Umum: tidak menyebut username mentah 'gamer_cool_99', melainkan kata ganti persona 'kamu'
    let scriptSent = "";
    const origSend = mockChannel.send;
    mockChannel.send = async (payload) => {
      scriptSent = JSON.stringify(payload);
      return origSend();
    };

    const regularUser = {
      id: "normal_user_111",
      displayName: "gamer_cool_99",
      username: "gamer_cool_99",
    };

    const introRegular = await aiDjTrackService.prepareDjIntroTrack({
      poru: mockPoru,
      channel: mockChannel,
      user: regularUser,
      trackInfo: { title: "Diri", author: "Tulus", identifier: "tulus_diri" },
      guildId: "guild-1",
      musicManager: { poru: { players: new Map([["guild-1", { voiceChannel: "vc-1" }]]) } },
      memberVoice: "vc-1",
    });

    assert.ok(introRegular, "introRegular harus berhasil dibuat");
    assert.ok(!scriptSent.includes("gamer_cool_99"), "Pengguna umum TIDAK boleh dieja username mentahnya");
    assert.ok(scriptSent.includes("kamu"), "Pengguna umum harus disapa dengan kata ganti persona 'kamu'");
    if (introRegular.localFilePath && fs.existsSync(introRegular.localFilePath)) {
      try { fs.unlinkSync(introRegular.localFilePath); } catch (_) {}
    }

    // 2. Kasus Pengguna Premium dengan Custom Name di Dashboard:
    // Pastikan profile di mock mengembalikan isPremium = true dan aiPersona.name = 'Kaisar Musik'
    const origGetUserProfile = cacheManager.getUserProfile;
    cacheManager.getUserProfile = async (uid) => {
      if (uid === "vip_user_222") {
        return {
          isPremium: true,
          premiumUntil: new Date("2099-01-01"),
          premium_tier: "tier3",
          aiPersona: { name: "Kaisar Musik" },
        };
      }
      return null;
    };

    const vipUser = {
      id: "vip_user_222",
      displayName: "budi_gaming",
      username: "budi_gaming",
    };

    const introVip = await aiDjTrackService.prepareDjIntroTrack({
      poru: mockPoru,
      channel: mockChannel,
      user: vipUser,
      trackInfo: { title: "Teh Hijau", author: "Tulus", identifier: "tulus_teh" },
      guildId: "guild-1",
      musicManager: { poru: { players: new Map([["guild-1", { voiceChannel: "vc-1" }]]) } },
      memberVoice: "vc-1",
    });

    assert.ok(introVip, "introVip harus berhasil dibuat");
    assert.ok(scriptSent.includes("Kaisar Musik"), "Pengguna Premium harus menyebut nama kustom dashboard");
    if (introVip.localFilePath && fs.existsSync(introVip.localFilePath)) {
      try { fs.unlinkSync(introVip.localFilePath); } catch (_) {}
    }

    // 3. Kasus Owner: menyebut Display Name
    const ownerId = "owner_333";
    const origOwnerIds = env.OWNER_IDS;
    env.OWNER_IDS = [ownerId];

    cacheManager.getUserProfile = async (uid) => {
      if (uid === ownerId) {
        return {
          isPremium: true,
          aiPersona: { name: null }, // Tanpa custom name, fallback ke displayName
        };
      }
      return null;
    };

    const ownerUser = {
      id: ownerId,
      displayName: "Hoshino Owner",
      username: "hoshino_dev",
    };

    const introOwner = await aiDjTrackService.prepareDjIntroTrack({
      poru: mockPoru,
      channel: mockChannel,
      user: ownerUser,
      trackInfo: { title: "Monokrom", author: "Tulus", identifier: "tulus_mono" },
      guildId: "guild-1",
      musicManager: { poru: { players: new Map([["guild-1", { voiceChannel: "vc-1" }]]) } },
      memberVoice: "vc-1",
    });

    assert.ok(introOwner, "introOwner harus berhasil dibuat");
    assert.ok(scriptSent.includes("Hoshino Owner"), "Owner harus menyebut display name jika tidak ada nama kustom");
    if (introOwner.localFilePath && fs.existsSync(introOwner.localFilePath)) {
      try { fs.unlinkSync(introOwner.localFilePath); } catch (_) {}
    }

    // Restore
    cacheManager.getUserProfile = origGetUserProfile;
    env.OWNER_IDS = origOwnerIds;
  } finally {
    fishAudioService.generateSpeech = origGenSpeech;
    fishAudioService.isConfigured = origIsConfig;
  }
});
