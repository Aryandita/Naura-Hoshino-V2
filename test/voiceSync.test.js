"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const VoiceManager = require("../src/managers/voiceManager");
const MusicManager = require("../src/managers/musicManager");

test("M1 Voice Mutex: acquireVoiceLock and releaseVoiceLock state transitions", async () => {
  const guildId = "guild-sync-1";

  assert.equal(
    VoiceManager.isVoiceLocked(guildId),
    false,
    "Voice lock default should be free",
  );
  assert.equal(
    VoiceManager.getVoiceLockOwner(guildId),
    null,
    "Voice lock owner should be null initially",
  );

  const acquired = await VoiceManager.acquireVoiceLock(guildId, "native_intro");
  assert.equal(acquired, true, "First acquireVoiceLock should succeed");
  assert.equal(
    VoiceManager.isVoiceLocked(guildId),
    true,
    "Guild should be locked",
  );
  assert.equal(
    VoiceManager.getVoiceLockOwner(guildId),
    "native_intro",
    "Owner should be native_intro",
  );

  // Re-entrant lock by same owner
  const reacquired = await VoiceManager.acquireVoiceLock(
    guildId,
    "native_intro",
  );
  assert.equal(reacquired, true, "Re-entrant acquireVoiceLock should succeed");

  await VoiceManager.releaseVoiceLock(guildId, "native_intro");
  assert.equal(
    VoiceManager.isVoiceLocked(guildId),
    true,
    "Lock should still be held after 1st nested release",
  );

  await VoiceManager.releaseVoiceLock(guildId, "native_intro");
  assert.equal(
    VoiceManager.isVoiceLocked(guildId),
    false,
    "Lock should be free after 2nd release",
  );
  assert.equal(
    VoiceManager.getVoiceLockOwner(guildId),
    null,
    "Owner should be null after release",
  );
});

test("M1 Voice Mutex: FIFO sequential lock handover between native voice and music", async () => {
  const guildId = "guild-sync-2";
  const events = [];

  // 1. Native voice acquires lock
  await VoiceManager.acquireVoiceLock(guildId, "native_intro");
  events.push("native:acquired");

  // 2. Music requests lock in background (must wait)
  const musicPromise = VoiceManager.acquireVoiceLock(
    guildId,
    "music_player",
  ).then((res) => {
    events.push("music:acquired");
    return res;
  });

  events.push("native:playing");
  // Simulate native intro playback time
  await new Promise((r) => setTimeout(r, 50));

  events.push("native:releasing");
  await VoiceManager.releaseVoiceLock(guildId, "native_intro");

  // 3. Await music acquire
  const musicAcquired = await musicPromise;
  assert.equal(
    musicAcquired,
    true,
    "Music should acquire lock after native releases",
  );
  assert.equal(
    VoiceManager.getVoiceLockOwner(guildId),
    "music_player",
    "Music should now be owner",
  );

  await VoiceManager.releaseVoiceLock(guildId, "music_player");
  assert.equal(
    VoiceManager.isVoiceLocked(guildId),
    false,
    "Lock should be free",
  );

  assert.deepEqual(events, [
    "native:acquired",
    "native:playing",
    "native:releasing",
    "music:acquired",
  ]);
});

test("M1 Voice Mutex: acquireVoiceLock timeout when busy returns false gracefully", async () => {
  const guildId = "guild-sync-3";

  await VoiceManager.acquireVoiceLock(guildId, "owner_a");

  const start = Date.now();
  const acquired = await VoiceManager.acquireVoiceLock(guildId, "owner_b", 60);
  const duration = Date.now() - start;

  assert.equal(acquired, false, "Should return false on timeout");
  assert.ok(duration >= 50, "Should have waited for the timeout duration");
  assert.equal(
    VoiceManager.getVoiceLockOwner(guildId),
    "owner_a",
    "Owner A should still hold lock",
  );

  await VoiceManager.releaseVoiceLock(guildId, "owner_a");
  assert.equal(
    VoiceManager.isVoiceLocked(guildId),
    false,
    "Lock should be released",
  );
});

test("M1 Synchronization: VoiceManager and MusicManager share unified state guard", async () => {
  const guildId = "guild-sync-4";
  const musicManager = new MusicManager({});

  assert.strictEqual(
    VoiceManager.voiceConnectionGuard,
    MusicManager.voiceConnectionGuard,
    "Static voiceConnectionGuard should be identical reference",
  );
  assert.strictEqual(
    musicManager.voiceConnectionGuard,
    VoiceManager.voiceConnectionGuard,
    "Instance voiceConnectionGuard should be identical reference",
  );

  // Acquire via VoiceManager
  await VoiceManager.acquireVoiceLock(guildId, "native_test");
  assert.equal(
    MusicManager.isVoiceLocked(guildId),
    true,
    "MusicManager static should detect lock",
  );
  assert.equal(
    musicManager.isVoiceLocked(guildId),
    true,
    "musicManager instance should detect lock",
  );
  assert.equal(
    musicManager.getVoiceLockOwner(guildId),
    "native_test",
    "Owner matches",
  );

  // Release via musicManager instance with force
  await musicManager.releaseVoiceLock(guildId, "force");
  assert.equal(
    VoiceManager.isVoiceLocked(guildId),
    false,
    "Lock should be released across both",
  );
});

test("M1 Clean Teardown: cleanTeardownConnection stops player, removes listeners, destroys connection", () => {
  const guildId = "guild-sync-5";

  let playerStopped = false;
  let playerListenersRemoved = false;
  let connectionDestroyed = false;
  let connectionListenersRemoved = false;

  const mockPlayer = {
    stop: (force) => {
      if (force) playerStopped = true;
    },
    removeAllListeners: () => {
      playerListenersRemoved = true;
    },
  };

  const mockConnection = {
    destroy: () => {
      connectionDestroyed = true;
    },
    removeAllListeners: () => {
      connectionListenersRemoved = true;
    },
  };

  VoiceManager.connections.set(guildId, {
    guildId,
    player: mockPlayer,
    connection: mockConnection,
    keepaliveTimer: setTimeout(() => {}, 100000),
  });

  assert.equal(VoiceManager.hasActiveConnection(guildId), true);

  VoiceManager.cleanTeardownConnection(guildId);

  assert.equal(playerStopped, true, "Player should be stopped with force=true");
  assert.equal(
    playerListenersRemoved,
    true,
    "Player listeners should be removed",
  );
  assert.equal(connectionDestroyed, true, "Connection should be destroyed");
  assert.equal(
    connectionListenersRemoved,
    true,
    "Connection listeners should be removed",
  );
  assert.equal(
    VoiceManager.hasActiveConnection(guildId),
    false,
    "Session should be deleted from connections",
  );
});

test("M1 Yield To Music: yieldToMusic cleans active session and releases voice lock", async () => {
  const guildId = "guild-sync-6";

  let destroyed = false;
  const mockConnection = {
    destroy: () => {
      destroyed = true;
    },
    removeAllListeners: () => {},
  };

  VoiceManager.connections.set(guildId, {
    guildId,
    connection: mockConnection,
  });
  await VoiceManager.acquireVoiceLock(guildId, "native");

  assert.equal(VoiceManager.isVoiceLocked(guildId), true);
  assert.equal(VoiceManager.hasActiveConnection(guildId), true);

  await VoiceManager.yieldToMusic(guildId);

  assert.equal(destroyed, true, "Connection should be destroyed");
  assert.equal(
    VoiceManager.hasActiveConnection(guildId),
    false,
    "Session deleted",
  );
  assert.equal(
    VoiceManager.isVoiceLocked(guildId),
    false,
    "Voice lock should be released",
  );
});

test("M1 Pre-buffering & Guarded Connection: MusicManager handles prebuffer delay and connection guard", async () => {
  const musicManager = new MusicManager({});

  // Default prebuffer delay is 300ms
  assert.equal(musicManager.getPrebufferDelay(), 300);

  musicManager.setPrebufferDelay(450);
  assert.equal(musicManager.getPrebufferDelay(), 450);

  musicManager.setPrebufferDelay(-10);
  assert.equal(
    musicManager.getPrebufferDelay(),
    0,
    "Negative delay clamped to 0",
  );

  musicManager.setPrebufferDelay(300);

  // Test guarded connection waiting on active voice lock
  const guildId = "guild-sync-7";
  let poruConnectionCreated = false;

  const mockPoru = {
    createConnection: (options) => {
      poruConnectionCreated = true;
      return { guildId: options.guildId, isConnected: true };
    },
  };
  musicManager._poru = mockPoru;

  // Lock guild with native intro
  await VoiceManager.acquireVoiceLock(guildId, "native_intro");

  // Call createGuardedConnection in background
  const connPromise = musicManager.createGuardedConnection({ guildId });

  // Simulate active intro playback, then release
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(
    poruConnectionCreated,
    false,
    "Poru should NOT connect while lock is held",
  );

  await VoiceManager.releaseVoiceLock(guildId, "native_intro");
  const conn = await connPromise;

  assert.equal(poruConnectionCreated, true, "Poru connects after lock release");
  assert.equal(conn.guildId, guildId);
});

test("M1 playIntroClipSafe contract: handles parameters, acquires lock, executes teardown", async () => {
  const guildId = "guild-sync-8";

  // When voice channel or lib is unavailable in mock env, returns graceful error and releases lock
  const res = await VoiceManager.playIntroClipSafe({
    guildId,
    filePath: "non-existent-intro.mp3",
    timeoutMs: 100,
  });

  assert.equal(res.success, false);
  // Ensure the lock was released in finally block
  assert.equal(
    VoiceManager.isVoiceLocked(guildId),
    false,
    "Lock must be released even on failure",
  );
});
