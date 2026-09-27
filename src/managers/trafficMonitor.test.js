"use strict";

const test = require("node:test");
const assert = require("node:assert");
const trafficMonitor = require("./trafficMonitor");

test("TrafficMonitor records commands and rate limit spikes", () => {
  trafficMonitor.recordCommand("profile", "user-1");
  trafficMonitor.recordCommand("profile", "user-2");
  trafficMonitor.recordCommand("daily", "user-1");
  trafficMonitor.recordRateLimitSpike("daily", "user-1");

  const summary = trafficMonitor.getSummary();
  assert.ok(summary.totalCommands24h >= 3, "Total commands should be at least 3");
  assert.ok(summary.totalSpikes24h >= 1, "Total spikes should be at least 1");
  assert.ok(Array.isArray(summary.hourlyData), "hourlyData should be an array");
  assert.strictEqual(summary.hourlyData.length, 24, "Should have 24 hours of data");

  const currentHour = summary.hourlyData[summary.hourlyData.length - 1];
  assert.ok(currentHour.commands >= 3, "Current hour should have at least 3 commands");
  assert.ok(currentHour.rateLimitSpikes >= 1, "Current hour should have at least 1 spike");
  assert.ok(currentHour.uniqueUsers >= 2, "Current hour should have at least 2 unique users");
});
