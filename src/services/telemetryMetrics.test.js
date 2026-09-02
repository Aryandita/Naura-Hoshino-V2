"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const telemetryMetrics = require("./telemetryMetrics");

test("TelemetryMetrics - Prometheus Format Standard Output", () => {
  const mockClient = {
    guilds: { cache: { size: 12 } },
    users: { cache: { size: 2400 } },
    ws: { ping: 45 },
    poru: { players: { size: 3 } },
  };

  telemetryMetrics.incrementCommandExecution();
  const metrics = telemetryMetrics.generatePrometheusMetrics(mockClient);

  assert.ok(typeof metrics === "string", "Metrics output should be string");
  assert.ok(metrics.includes("naura_uptime_seconds"), "Must include uptime metric");
  assert.ok(metrics.includes("naura_memory_bytes"), "Must include memory metric");
  assert.ok(metrics.includes("naura_discord_guilds_total 12"), "Must include guild count");
  assert.ok(metrics.includes("naura_discord_users_total 2400"), "Must include user count");
  assert.ok(metrics.includes("naura_discord_ws_ping_ms 45"), "Must include ping metric");
  assert.ok(metrics.includes("naura_lavalink_players_active 3"), "Must include lavalink player count");
});
