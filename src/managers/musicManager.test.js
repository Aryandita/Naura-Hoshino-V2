"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const MusicManager = require("./musicManager");

describe("MusicManager - Redis Queue Persistence & Vote Skip", () => {
  const dummyClient = { guilds: { cache: new Map() } };
  const manager = new MusicManager(dummyClient);

  it("menyimpan dan membaca state antrean aktif", async () => {
    const mockPlayer = {
      voiceChannel: "vc_101",
      textChannel: "tc_202",
      position: 45000,
      volume: 80,
      currentTrack: {
        track: "encoded_base64_track_data",
        info: { title: "Cyber Lo-Fi City", uri: "https://example.com/track" },
      },
      queue: [
        {
          track: "encoded_next_track",
          info: { title: "Neon Tokyo Sunset", uri: "https://example.com/next" },
        },
      ],
    };

    await manager.saveQueueState("guild_test_1", mockPlayer);
    const saved = await manager.getSavedQueueState("guild_test_1");

    assert.ok(saved);
    assert.strictEqual(saved.guildId, "guild_test_1");
    assert.strictEqual(saved.voiceChannel, "vc_101");
    assert.strictEqual(saved.currentTrack.info.title, "Cyber Lo-Fi City");
    assert.strictEqual(saved.queue.length, 1);
    assert.strictEqual(saved.position, 45000);

    // Bersihkan antrean
    await manager.clearSavedQueueState("guild_test_1");
    const empty = await manager.getSavedQueueState("guild_test_1");
    assert.strictEqual(empty, null);
  });

  it("mengelola suara voting skip secara akurat", () => {
    manager.clearSkipVotes("guild_vote_1");

    const vote1 = manager.addSkipVote("guild_vote_1", "user_1");
    assert.strictEqual(vote1.added, true);
    assert.strictEqual(vote1.votes.size, 1);

    // Vote duplikat
    const voteDuplicate = manager.addSkipVote("guild_vote_1", "user_1");
    assert.strictEqual(voteDuplicate.added, false);
    assert.strictEqual(voteDuplicate.votes.size, 1);

    // Vote pengguna kedua
    const vote2 = manager.addSkipVote("guild_vote_1", "user_2");
    assert.strictEqual(vote2.added, true);
    assert.strictEqual(vote2.votes.size, 2);

    manager.clearSkipVotes("guild_vote_1");
    assert.strictEqual(manager.getSkipVotes("guild_vote_1").size, 0);
  });
});
