"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

// R1: Audio Voice Gateway & Music Synchronization
const VoiceManager = require("../src/managers/voiceManager");
const MusicManager = require("../src/managers/musicManager");

// R2: Media Search Relevance (Movie & Anime)
const movie = require("../plugin/utility/movie");
const anime = require("../plugin/utility/anime");

// R3: Minecraft Canvas Multi-Provider Fallback
const {
  fetchSkinTextureWithFallback,
  getDefaultAvatarBuffer,
  getDefaultBodyBuffer,
  renderMinecraftPlayer,
  renderMinecraftStats,
} = require("../src/canvas/minecraftCanvas");

// R4: Discord Message & Container Total Deletion
const {
  safeDeleteMessage,
  deleteAfterDelay,
  dismissMessage,
  isUnknownMessageError,
  cleanGhostContainers,
  UNKNOWN_MESSAGE_CODES,
} = require("../src/utils/messageHelper");
const messageCleaner = require("../src/utils/messageCleaner");
const { createManagedCollector } = require("../src/utils/interactionPipeline");

test("R1 Audio Synchronization: Gateway mutex enforces exclusive lock and clean handover", async () => {
  const guildId = "op-fix-guild-audio";
  const executionOrder = [];

  // Verify initial free state
  assert.equal(VoiceManager.isVoiceLocked(guildId), false);
  assert.equal(VoiceManager.getVoiceLockOwner(guildId), null);

  // 1. Acquire lock for native intro speech
  const nativeLock = await VoiceManager.acquireVoiceLock(
    guildId,
    "native_intro",
  );
  assert.equal(nativeLock, true, "Native intro should acquire lock");
  assert.equal(VoiceManager.isVoiceLocked(guildId), true);
  assert.equal(VoiceManager.getVoiceLockOwner(guildId), "native_intro");
  executionOrder.push("native:locked");

  // 2. MusicManager requests connection while native intro holds lock
  const musicLockPromise = VoiceManager.acquireVoiceLock(
    guildId,
    "music_player",
    1500,
  ).then((res) => {
    executionOrder.push("music:acquired");
    return res;
  });

  // Simulate native intro playback time
  executionOrder.push("native:playing");
  await new Promise((r) => setTimeout(r, 40));

  // Release native intro lock
  executionOrder.push("native:released");
  await VoiceManager.releaseVoiceLock(guildId, "native_intro");

  // MusicManager should now acquire the lock
  const musicLock = await musicLockPromise;
  assert.equal(
    musicLock,
    true,
    "Music player must acquire lock after native release",
  );
  assert.equal(VoiceManager.getVoiceLockOwner(guildId), "music_player");

  // Clean teardown from music player
  await VoiceManager.releaseVoiceLock(guildId, "music_player");
  assert.equal(VoiceManager.isVoiceLocked(guildId), false);
  assert.equal(VoiceManager.getVoiceLockOwner(guildId), null);

  assert.deepEqual(executionOrder, [
    "native:locked",
    "native:playing",
    "native:released",
    "music:acquired",
  ]);
});

test("R1 Audio Pre-buffering: MusicManager configures buffer delay and respects active lock", async () => {
  const musicManager = new MusicManager({});
  const guildId = "op-fix-guild-prebuffer";

  // Prebuffer delay bounds
  assert.equal(musicManager.getPrebufferDelay(), 300);
  musicManager.setPrebufferDelay(500);
  assert.equal(musicManager.getPrebufferDelay(), 500);
  musicManager.setPrebufferDelay(300);

  let poruConnected = false;
  musicManager._poru = {
    createConnection: (options) => {
      poruConnected = true;
      return { guildId: options.guildId, isConnected: true };
    },
  };

  // Lock guild under native intro
  await VoiceManager.acquireVoiceLock(guildId, "native_intro");

  // Attempt guarded connection
  const connPromise = musicManager.createGuardedConnection({ guildId });

  // Verify connection is not created while locked
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(
    poruConnected,
    false,
    "Poru must wait for voice lock to be freed",
  );

  // Free lock
  await VoiceManager.releaseVoiceLock(guildId, "native_intro");
  const conn = await connPromise;

  assert.equal(poruConnected, true);
  assert.equal(conn.guildId, guildId);
});

test("R2 Media Search: Movie relevance prioritizes exact movie match over TV shows", () => {
  const query = "cars 2";
  const movieExact = {
    id: "tt1216475",
    l: "Cars 2",
    y: 2011,
    qid: "movie",
    q: "feature",
    rank: 3860,
    s: "Owen Wilson, Larry the Cable Guy",
  };
  const tvShow = {
    id: "tt1990423",
    l: "Counting Cars",
    y: 2012,
    qid: "tvSeries",
    q: "TV series",
    rank: 15000,
  };

  const movieScore = movie.calculateMovieRelevance(movieExact, query);
  const tvScore = movie.calculateMovieRelevance(tvShow, query);

  assert.ok(
    movieScore > tvScore,
    "Cars 2 feature film must outrank Counting Cars TV series",
  );
  assert.ok(movieScore >= 150, "Exact match score should be high");
});

test("R2 Media Search: Live searchMovie resolves Cars 2 film metadata accurately", async () => {
  const result = await movie.searchMovie("cars 2");
  assert.ok(result, "Must return valid movie object");
  assert.ok(
    result.title.toLowerCase().includes("cars 2"),
    "Title must contain Cars 2",
  );
  assert.equal(result.year, "2011", "Year must be 2011");
  assert.equal(result.type, "movie", "Type must be movie");
  assert.ok(result.posterUrl, "Must have posterUrl");
  assert.ok(result.posterURL, "Must have posterURL for canvas renderer");
  assert.ok(result.url.includes("imdb.com"), "Must link to imdb.com");
  assert.ok(
    result.actors.some((act) => act.toLowerCase().includes("owen wilson")),
    "Actors must include Owen Wilson",
  );
});

test("R2 Media Search: Anime relevance scoring prioritizes canonical exact match over sequels", () => {
  const query = "Naruto";
  const naruto = {
    title: "Naruto",
    titleEnglish: "Naruto",
    titleRomaji: "Naruto",
    score: "8.0",
    type: "TV",
  };
  const narutoShippuden = {
    title: "Naruto: Shippuuden",
    titleEnglish: "Naruto: Shippuden",
    titleRomaji: "Naruto: Shippuuden",
    score: "8.2",
    type: "TV",
  };
  const unrelated = {
    title: "HeatGuy J Special",
    titleEnglish: "HeatGuy J Special",
    score: "6.0",
    type: "SPECIAL",
  };

  const ranked = anime.rankAnimeResults(
    [narutoShippuden, unrelated, naruto],
    query,
  );
  assert.ok(ranked.length >= 2);
  assert.equal(
    ranked[0].title,
    "Naruto",
    "Exact title Naruto must be ranked first",
  );
  assert.equal(
    ranked[1].title,
    "Naruto: Shippuuden",
    "Sequel must be ranked second",
  );
  assert.ok(
    !ranked.some((x) => x.title === "HeatGuy J Special"),
    "Unrelated show must be filtered",
  );
});

test("R3 Minecraft Canvas: Multi-provider cascade returns valid PNG buffer at every tier", async () => {
  const sampleUuid = "069a79f444e94726a5befca90e38aaf5";

  // Tier 1: Default Steve avatars
  const defaultAvatar = getDefaultAvatarBuffer();
  assert(Buffer.isBuffer(defaultAvatar));
  assert.strictEqual(defaultAvatar[0], 0x89);
  assert.strictEqual(defaultAvatar[1], 0x50);
  assert.strictEqual(defaultAvatar[2], 0x4e);
  assert.strictEqual(defaultAvatar[3], 0x47);

  const defaultBody = getDefaultBodyBuffer();
  assert(Buffer.isBuffer(defaultBody));
  assert.strictEqual(defaultBody[0], 0x89);
  assert.strictEqual(defaultBody[1], 0x50);

  // Tier 2: Cascade fallback logic with simulated failures
  const fallbackPng = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(32, 0x11),
  ]);

  const fakeAxios = {
    async get(url) {
      if (url.includes("mc-heads.net")) {
        throw new Error("mc-heads timeout");
      }
      if (url.includes("minotar.net")) {
        return { data: fallbackPng, status: 200 };
      }
      throw new Error("Unexpected provider called");
    },
  };

  const cascadedAvatar = await fetchSkinTextureWithFallback(
    sampleUuid,
    "avatar",
    {
      axiosInstance: fakeAxios,
      timeout: 1000,
    },
  );

  assert(Buffer.isBuffer(cascadedAvatar));
  assert.deepStrictEqual(cascadedAvatar, fallbackPng);

  // Tier 3: Complete canvas rendering under total provider outage
  const cardBuf = await renderMinecraftPlayer({
    uuid: "offline-player-card-uuid",
    realName: "OperationalPlayer",
  });
  assert(Buffer.isBuffer(cardBuf));
  assert.ok(
    cardBuf.length > 5000,
    "Rendered card must contain full image data",
  );
  assert.strictEqual(cardBuf[0], 0x89);

  const statsBuf = await renderMinecraftStats({
    username: "OperationalPlayer",
    playDays: 5,
    playHours: 12,
    playMinutes: 30,
    uuid: "offline-player-card-uuid",
  });
  assert(Buffer.isBuffer(statsBuf));
  assert.ok(statsBuf.length > 5000);
  assert.strictEqual(statsBuf[0], 0x89);
});

test("R4 Total Message Cleanup: Eliminates message entirely without leaving ghost containers", async () => {
  let messageDeleted = false;
  let interactionDeleteReply = false;
  let interactionEditReply = false;

  // 1. Message deletion
  const mockMsg = {
    id: "op-msg-01",
    delete: async () => {
      messageDeleted = true;
    },
    edit: async () => {
      throw new Error("edit() should never be called during safeDeleteMessage");
    },
  };
  const msgResult = await safeDeleteMessage(mockMsg);
  assert.equal(msgResult, true);
  assert.equal(messageDeleted, true);

  // 2. Interaction deletion via deleteReply()
  const mockInt = {
    id: "op-int-01",
    deferred: true,
    deleteReply: async () => {
      interactionDeleteReply = true;
    },
    editReply: async () => {
      interactionEditReply = true;
    },
  };
  const intResult = await safeDeleteMessage(mockInt);
  assert.equal(intResult, true);
  assert.equal(interactionDeleteReply, true);
  assert.equal(interactionEditReply, false, "Must never call editReply");

  // 3. Error suppression for standard DiscordAPIError codes
  const err10008 = new Error("Unknown Message");
  err10008.code = 10008;
  const mockAlreadyDeleted = {
    delete: async () => {
      throw err10008;
    },
  };
  assert.equal(await safeDeleteMessage(mockAlreadyDeleted), true);
  assert.equal(isUnknownMessageError(err10008), true);

  // 4. Ghost container shell purge
  const purged = [];
  const fakeChannel = {
    messages: {
      fetch: async () =>
        new Map([
          [
            "ghost-shell-1",
            {
              id: "ghost-shell-1",
              author: { bot: true, id: "bot-system" },
              content: "",
              embeds: [],
              attachments: new Map(),
              components: [],
              delete: async () => {
                purged.push("ghost-shell-1");
              },
            },
          ],
        ]),
    },
  };
  const cleanupReport = await cleanGhostContainers(fakeChannel, {
    botId: "bot-system",
  });
  assert.equal(cleanupReport.cleaned, 1);
  assert.deepEqual(purged, ["ghost-shell-1"]);

  // 5. Cleanup aliases, delays, and managed collector contracts
  assert.ok(UNKNOWN_MESSAGE_CODES.has(10008));
  let dismissCalled = false;
  await dismissMessage({
    delete: async () => {
      dismissCalled = true;
    },
  });
  assert.equal(dismissCalled, true);

  const cancelDelay = deleteAfterDelay(mockMsg, 5000);
  assert.equal(typeof cancelDelay, "function");
  cancelDelay();

  const cancelCleaner = messageCleaner.registerAutoDelete(
    { id: "cleaner-op-1" },
    5000,
  );
  assert.equal(typeof cancelCleaner, "function");
  cancelCleaner();

  let collectorEndFired = false;
  const dummyCollectorMsg = {
    createMessageComponentCollector: () => ({
      on: (ev, fn) => {
        if (ev === "end") {
          collectorEndFired = true;
        }
      },
    }),
  };
  createManagedCollector(dummyCollectorMsg, null, { deleteOnTimeout: true });
  assert.equal(collectorEndFired, true);
});

test("Cross-Domain Integration: Concurrent execution of R1, R2, R3, and R4 without side effects", async () => {
  const guildId = "concurrent-op-guild";

  // Run all 4 domain operations concurrently
  const [voiceResult, movieResult, skinResult, cleanupResult] =
    await Promise.all([
      // Domain 1: Acquire and release voice lock
      (async () => {
        const lock = await VoiceManager.acquireVoiceLock(
          guildId,
          "concurrent_test",
        );
        await new Promise((r) => setTimeout(r, 20));
        await VoiceManager.releaseVoiceLock(guildId, "concurrent_test");
        return lock && !VoiceManager.isVoiceLocked(guildId);
      })(),

      // Domain 2: Search movie
      (async () => {
        const res = await movie.searchMovie("cars 2");
        return res && res.type === "movie" && res.year === "2011";
      })(),

      // Domain 3: Render fallback avatar
      (async () => {
        const buf = await fetchSkinTextureWithFallback(null, "avatar");
        return Buffer.isBuffer(buf) && buf[0] === 0x89;
      })(),

      // Domain 4: Safe delete mock message
      (async () => {
        let deleted = false;
        const res = await safeDeleteMessage({
          delete: async () => {
            deleted = true;
          },
        });
        return res && deleted;
      })(),
    ]);

  assert.equal(voiceResult, true, "R1 Voice mutex concurrent execution passed");
  assert.equal(
    movieResult,
    true,
    "R2 Movie search concurrent execution passed",
  );
  assert.equal(
    skinResult,
    true,
    "R3 Skin fallback concurrent execution passed",
  );
  assert.equal(
    cleanupResult,
    true,
    "R4 Message cleanup concurrent execution passed",
  );
});
