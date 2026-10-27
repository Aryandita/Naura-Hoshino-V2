"use strict";

/**
 * 📡 Two-tier Mediator EventBus - Naura Hoshino V2
 * -------------------------------------------------
 * Provides event-driven communication between modules with two tiers:
 * - Tier 1: In-Memory EventEmitter (zero latency for local modules)
 * - Tier 2: Redis Pub/Sub bridge (cross-process & shard synchronization)
 *
 * @module src/core/eventBus
 * @example
 * // Local event (Tier 1 only)
 * eventBus.emit('user:levelUp', { userId: '123', newLevel: 5 });
 *
 * // Broadcast to all shards (Tier 1 + Tier 2)
 * eventBus.broadcast('system:shutdown', { reason: 'maintenance' });
 */

const { EventEmitter } = require("node:events");
const env = require("../config/env");

// ============================================================================
// CONSTANTS
// ============================================================================

/** Redis channel name for cross-process event bridge */
const REDIS_EVENT_CHANNEL = "naura:events:bridge";

/** Unique identifier for this process instance (format: proc-{shardId}-{pid}) */
const PROCESS_ORIGIN = `proc-${env.SHARD_ID ?? "0"}-${process.pid}`;

/** Default maximum number of listeners per event (prevents memory leak warnings) */
const DEFAULT_MAX_LISTENERS = 100;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * @typedef {Object} EventPacket
 * @property {string} origin - Process identifier that sent the event
 * @property {string} event - Event name
 * @property {any} data - Event payload
 * @property {number} timestamp - Unix timestamp in milliseconds
 */

/**
 * @typedef {Object} EmitOptions
 * @property {boolean} [broadcast=false] - If true, also publish to Redis Pub/Sub
 */

// ============================================================================
// EVENTBUS CLASS
// ============================================================================

/**
 * Two-tier event mediator supporting local and distributed event propagation.
 * Extends Node.js EventEmitter with Redis Pub/Sub bridge for multi-shard sync.
 */
class EventBus extends EventEmitter {
  /**
   * Create a new EventBus instance.
   * @param {Object} [options={}] - Configuration options
   * @param {number} [options.maxListeners=100] - Maximum listeners per event
   */
  constructor(options = {}) {
    super();
    this.setMaxListeners(options.maxListeners || DEFAULT_MAX_LISTENERS);
    this.origin = PROCESS_ORIGIN;
    this.redisManager = null;
    this._isBridgeActive = false;
  }

  /**
   * Connect event bus to Redis for Tier 2 distributed bridge.
   * Enables cross-process and cross-shard event synchronization.
   * @param {object} redisManager - Redis manager instance with initPubSub method
   * @returns {Promise<void>}
   */
  async attachRedisBridge(redisManager) {
    if (!redisManager || !redisManager.isReady) return;
    this.redisManager = redisManager;

    if (!this._isBridgeActive) {
      await this.redisManager.initPubSub(REDIS_EVENT_CHANNEL, (message) => {
        try {
          // Parse message if string, otherwise use as-is (already parsed)
          const packet = typeof message === "string" ? JSON.parse(message) : message;

          // Ignore messages from this process to prevent echo loops
          if (packet && packet.origin === this.origin) return;

          // Re-emit remote events locally with fromRemote flag
          if (packet && packet.event) {
            super.emit(packet.event, packet.data, { fromRemote: true });
          }
        } catch (error) {
          // Log malformed packets in development for debugging
          if (env.NODE_ENV !== "production") {
            console.debug("[EventBus] Malformed packet received:", error.message);
          }
        }
      });
      this._isBridgeActive = true;
    }
  }

  /**
   * Disconnect Redis Pub/Sub bridge.
   * Stops receiving remote events but keeps local event functionality.
   */
  detachRedisBridge() {
    this._isBridgeActive = false;
    this.redisManager = null;
  }

  /**
   * Emit event locally and optionally broadcast to all shards via Redis.
   * @param {string} event - Event name (e.g., 'user:levelUp', 'system:shutdown')
   * @param {any} data - Event payload
   * @param {EmitOptions} [options={}] - Emit options
   * @returns {boolean} True if event had listeners
   * @example
   * // Local only (Tier 1)
   * eventBus.emit('cache:invalidate', { key: 'user:123' });
   *
   * // Broadcast to all shards (Tier 1 + Tier 2)
   * eventBus.emit('config:update', { setting: 'maintenance' }, { broadcast: true });
   */
  emit(event, data, options = {}) {
    // Tier 1: Emit to local listeners (in-memory, zero latency)
    const result = super.emit(event, data, options);

    // Tier 2: Broadcast to Redis if requested and Redis is ready
    if (options.broadcast && this.redisManager && this.redisManager.isReady) {
      /** @type {EventPacket} */
      const packet = {
        origin: this.origin,
        event,
        data,
        timestamp: Date.now(),
      };

      // Publish to Redis channel (fire-and-forget, errors are non-fatal)
      this.redisManager.publish(REDIS_EVENT_CHANNEL, packet).catch((error) => {
        if (env.NODE_ENV !== "production") {
          console.debug("[EventBus] Failed to publish to Redis:", error.message);
        }
      });
    }

    return result;
  }

  /**
   * Explicit helper for broadcasting events across all processes/shards.
   * Equivalent to calling emit() with { broadcast: true }.
   * @param {string} event - Event name
   * @param {any} data - Event payload
   * @returns {boolean} True if event had local listeners
   * @example
   * eventBus.broadcast('announcement', { message: 'Server maintenance at 3AM' });
   */
  broadcast(event, data) {
    return this.emit(event, data, { broadcast: true });
  }

  /**
   * Remove all listeners and disconnect Redis bridge.
   * Primarily used for testing and graceful shutdown.
   */
  clear() {
    this.removeAllListeners();
    this.detachRedisBridge();
  }
}

// ============================================================================
// GLOBAL INSTANCE & EXPORTS
// ============================================================================

/**
 * Global EventBus instance for application-wide event mediation.
 * Use this singleton instead of creating new instances.
 * @type {EventBus}
 */
const eventBus = new EventBus();

// Expose class for testing and type checking
eventBus.EventBus = EventBus;

module.exports = eventBus;
