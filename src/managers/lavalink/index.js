"use strict";

/**
 * 🎵 Lavalink Cluster Modules - Naura Hoshino V2
 * -----------------------------------------------
 * Modular components for Lavalink cluster management.
 *
 * @module src/managers/lavalink
 */

const { CircuitBreakerManager, CB_CONFIG, CB_STATE } = require("./circuitBreaker");
const { NodeSelector, NODE_TIERS, LATENCY_THRESHOLDS, MAX_GUILDS_PER_NODE } = require("./nodeSelector");
const { PlayerMigrator } = require("./playerMigrator");

module.exports = {
  // Circuit Breaker
  CircuitBreakerManager,
  CB_CONFIG,
  CB_STATE,

  // Node Selector
  NodeSelector,
  NODE_TIERS,
  LATENCY_THRESHOLDS,
  MAX_GUILDS_PER_NODE,

  // Player Migrator
  PlayerMigrator,
};
