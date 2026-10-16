"use strict";

/**
 * api.js - Router Pusat API Web Dashboard Naura OS (Modular V2).
 *
 * Mengoordinasikan seluruh sub-modul API:
 * - api/telemetry.js: Health, SSE, overview, topology, status, and metrics
 * - api/economy.js: Atomic deposit/withdraw/transfer, leaderboard, stocks, marketplace
 * - api/music.js: Poru state, music control, now-playing, queue, soundboard
 * - api/activity.js: Chat, clan war room, radar, spatial positioning, world POIs, arcade
 * - api/admin.js: Discord token exchange, entitlements webhook, push alerts, system admin
 */

const express = require("express");
const telemetry = require("./api/telemetry");
const economy = require("./api/economy");
const music = require("./api/music");
const activity = require("./api/activity");
const admin = require("./api/admin");

module.exports = function (client) {
  const router = express.Router();

  telemetry.register(router, client);
  economy.register(router, client);
  music.register(router, client);
  activity.register(router, client);
  admin.register(router, client);

  return router;
};
