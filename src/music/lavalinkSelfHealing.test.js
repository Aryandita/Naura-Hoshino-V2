"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { LavalinkClusterManager } = require("../managers/lavalinkClusterManager");

test("LavalinkClusterManager - calculatePacketDropRate Math", () => {
  const manager = new LavalinkClusterManager();

  // Edge case: null node or no frameStats
  assert.equal(manager.calculatePacketDropRate(null), 0);
  assert.equal(manager.calculatePacketDropRate({ stats: {} }), 0);

  // Normal: 0 lost frames
  const nodeZero = {
    stats: {
      frameStats: { sent: 1000, nulled: 0, deficit: 0 },
    },
  };
  assert.equal(manager.calculatePacketDropRate(nodeZero), 0);

  // 10% packet drop (100 lost out of 1000 total)
  const nodeTenPct = {
    stats: {
      frameStats: { sent: 900, nulled: 60, deficit: 40 },
    },
  };
  assert.equal(manager.calculatePacketDropRate(nodeTenPct), 10.0);

  // 4.5% packet drop (below 5% threshold)
  const nodeLow = {
    stats: {
      frameStats: { sent: 955, nulled: 30, deficit: 15 },
    },
  };
  assert.equal(manager.calculatePacketDropRate(nodeLow), 4.5);
});

test("LavalinkClusterManager - detectPacketDropAnomalies & Zero-Downtime Migration", async () => {
  const manager = new LavalinkClusterManager();

  const healthyNode = {
    name: "Node-Healthy",
    connected: true,
    stats: { frameStats: { sent: 1000, nulled: 5, deficit: 5 } }, // 1.0% drop
  };

  const degradedNode = {
    name: "Node-Degraded",
    connected: true,
    stats: { frameStats: { sent: 900, nulled: 50, deficit: 30 } }, // 8.16% drop (> 5%)
  };

  // Mock player currently streaming on the degraded node
  let migratedPlayer = null;
  let migrationReason = "";

  const mockPlayer = {
    guildId: "guild_stream_101",
    node: degradedNode,
    voiceChannel: "vc_voice_1",
    textChannel: "tc_chat_1",
    currentTrack: { info: { title: "Stellar Melody" } },
    position: 45000,
    queue: [],
  };

  const mockPoru = {
    nodes: new Map([
      ["Node-Healthy", healthyNode],
      ["Node-Degraded", degradedNode],
    ]),
    players: new Map([["guild_stream_101", mockPlayer]]),
  };

  // Intercept migratePlayer
  manager.migratePlayer = async (poru, player, node, reason) => {
    migratedPlayer = player;
    migrationReason = reason;
    return true;
  };

  const result = await manager.detectPacketDropAnomalies(mockPoru, 5.0);

  assert.equal(result.anomalies.length, 1);
  assert.equal(result.anomalies[0].nodeName, "Node-Degraded");
  assert.ok(result.anomalies[0].dropRate > 5.0);
  assert.equal(result.migratedCount, 1);
  assert.equal(migratedPlayer, mockPlayer);
  assert.ok(migrationReason.includes("Packet drop anomali"));
});

test("LavalinkClusterManager - startHealthProbe and stopHealthProbe Lifecycle", () => {
  const manager = new LavalinkClusterManager();
  const mockPoru = { nodes: new Map(), players: new Map() };

  assert.equal(manager.healthProbeInterval, null);

  manager.startHealthProbe(mockPoru, 60000);
  assert.ok(manager.healthProbeInterval);

  manager.stopHealthProbe();
  assert.equal(manager.healthProbeInterval, null);
});

test("LavalinkClusterManager - evaluateShardHealth Predictive Autoscaler", () => {
  const manager = new LavalinkClusterManager();

  // 1. Empty telemetry
  const emptyRes = manager.evaluateShardHealth([]);
  assert.equal(emptyRes.healthy, true);
  assert.equal(emptyRes.recommendedShards, 1);

  // 2. Healthy cluster (2 shards, low ping, moderate guilds)
  const healthyShards = [
    { id: 0, status: "READY", ping: 45, guilds: 500 },
    { id: 1, status: "READY", ping: 50, guilds: 600 },
  ];
  const healthyRes = manager.evaluateShardHealth(healthyShards);
  assert.equal(healthyRes.healthy, true);
  assert.equal(healthyRes.bottleneckDetected, false);
  assert.equal(healthyRes.highPingShards, 0);

  // 3. Bottleneck detected: High ping on shard 1 (> 250ms)
  const laggyShards = [
    { id: 0, status: "READY", ping: 40, guilds: 600 },
    { id: 1, status: "READY", ping: 320, guilds: 800 },
  ];
  const laggyRes = manager.evaluateShardHealth(laggyShards);
  assert.equal(laggyRes.bottleneckDetected, true);
  assert.equal(laggyRes.highPingShards, 1);
  assert.ok(laggyRes.recommendedShards >= 3, "Harus merekomendasikan penambahan shard saat bottleneck");

  // 4. Disconnected shard
  const downShards = [
    { id: 0, status: "DISCONNECTED", ping: 999, guilds: 400 },
    { id: 1, status: "READY", ping: 35, guilds: 500 },
  ];
  const downRes = manager.evaluateShardHealth(downShards);
  assert.equal(downRes.healthy, false);
  assert.equal(downRes.disconnectedShards, 1);
});
