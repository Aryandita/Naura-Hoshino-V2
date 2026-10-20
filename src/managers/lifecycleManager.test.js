"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const lifecycleManager = require("./lifecycleManager");

test("lifecycleManager - getSystemHealth returns expected metric structure", () => {
  const mockClient = {
    guilds: {
      cache: new Map([
        ["1", { memberCount: 50 }],
        ["2", { memberCount: 150 }],
      ]),
    },
    musicManager: {
      poru: {
        players: new Map([["1", {}]]),
        nodes: new Map([["node-1", { isConnected: true }]]),
      },
    },
  };

  const health = lifecycleManager.getSystemHealth(mockClient);

  assert.ok(health);
  assert.equal(typeof health.uptimeSec, "number");
  assert.equal(typeof health.uptimeFormatted, "string");
  assert.ok(health.memory);
  assert.equal(typeof health.memory.rssMb, "number");
  assert.ok(health.databases);
  assert.equal(typeof health.databases.postgres, "boolean");
  assert.ok(health.audio);
  assert.equal(health.audio.activePlayers, 1);
  assert.equal(health.audio.connectedNodes, 1);
  assert.equal(health.shards.guildCount, 2);
  assert.equal(health.shards.userCount, 200);
});

test("lifecycleManager - setMaintenanceMode toggles maintenance state and presence", async () => {
  let presenceSet = null;
  const mockClient = {
    user: {
      setPresence: (presence) => {
        presenceSet = presence;
      },
    },
  };

  // Turn ON maintenance mode
  await lifecycleManager.setMaintenanceMode(mockClient, true, "Testing maintenance");
  assert.equal(lifecycleManager.isMaintenanceMode(), true);
  assert.equal(mockClient.isMaintenance, true);
  assert.equal(mockClient.maintenanceReason, "Testing maintenance");
  assert.ok(presenceSet);
  assert.equal(presenceSet.status, "dnd");

  // Turn OFF maintenance mode
  await lifecycleManager.setMaintenanceMode(mockClient, false);
  assert.equal(lifecycleManager.isMaintenanceMode(), false);
  assert.equal(mockClient.isMaintenance, false);
});

test("lifecycleManager - flushAllData executes successfully without errors", async () => {
  const result = await lifecycleManager.flushAllData();
  assert.ok(result);
  assert.equal(result.success, true);
  assert.equal(typeof result.flushedWrites, "number");
});

test("lifecycleManager - applyMaintenanceLocally applies maintenance and presence updates", () => {
  let presenceSet = null;
  const mockClient = {
    user: {
      setPresence: (p) => {
        presenceSet = p;
      },
    },
  };

  lifecycleManager.applyMaintenanceLocally(mockClient, true, "Sync from shard");
  assert.equal(lifecycleManager.isMaintenanceMode(), true);
  assert.equal(mockClient.isMaintenance, true);
  assert.equal(mockClient.maintenanceReason, "Sync from shard");
  assert.equal(presenceSet.status, "dnd");

  lifecycleManager.applyMaintenanceLocally(mockClient, false);
  assert.equal(lifecycleManager.isMaintenanceMode(), false);
  assert.equal(mockClient.isMaintenance, false);
});

test("lifecycleManager - gracefulTeardown deduplicates concurrent calls and destroys Map poru.nodes", async () => {
  let nodeDestroyed = false;
  let playerDestroyed = false;

  const mockClient = {
    musicManager: {
      poru: {
        players: new Map([
          ["p1", { destroy: () => { playerDestroyed = true; } }],
        ]),
        nodes: new Map([
          ["node-lavalink-1", { destroy: () => { nodeDestroyed = true; } }],
        ]),
      },
    },
    destroy: () => {},
  };

  // Panggil dua kali secara konkuren
  const promise1 = lifecycleManager.gracefulTeardown(mockClient, { mode: "shutdown", reason: "Test concurrent" });
  const promise2 = lifecycleManager.gracefulTeardown(mockClient, { mode: "shutdown", reason: "Test concurrent" });

  // Harus mengembalikan promise yang sama
  assert.equal(promise1, promise2);

  await promise1;
  assert.equal(nodeDestroyed, true);
  assert.equal(playerDestroyed, true);
});

