"use strict";

const { EventEmitter } = require("node:events");
const env = require("../config/env");

const REDIS_EVENT_CHANNEL = "naura:events:bridge";
const PROCESS_ORIGIN = `proc-${env.SHARD_ID ?? "0"}-${process.pid}`;

/**
 * Two-tier Mediator EventBus
 * Tier 1: In-Memory EventEmitter (latensi nol antar-modul lokal)
 * Tier 2: Redis Pub/Sub bridge (sinkronisasi lintas-proses & shard)
 */
class EventBus extends EventEmitter {
  constructor(options = {}) {
    super();
    this.setMaxListeners(options.maxListeners || 100);
    this.origin = PROCESS_ORIGIN;
    this.redisManager = null;
    this._isBridgeActive = false;
  }

  /**
   * Hubungkan event bus ke redisManager untuk Tier 2 Distributed Bridge.
   * @param {object} redisManager
   */
  async attachRedisBridge(redisManager) {
    if (!redisManager || !redisManager.isReady) return;
    this.redisManager = redisManager;

    if (!this._isBridgeActive) {
      await this.redisManager.initPubSub(REDIS_EVENT_CHANNEL, (message) => {
        try {
          const packet = typeof message === "string" ? JSON.parse(message) : message;
          // Abaikan pesan yang berasal dari proses ini sendiri (mencegah echo loop)
          if (packet && packet.origin === this.origin) return;
          if (packet && packet.event) {
            super.emit(packet.event, packet.data, { fromRemote: true });
          }
        } catch (_) {
          // Tangani malformed packet secara defensif
        }
      });
      this._isBridgeActive = true;
    }
  }

  /**
   * Putus jembatan Redis Pub/Sub.
   */
  detachRedisBridge() {
    this._isBridgeActive = false;
    this.redisManager = null;
  }

  /**
   * Pancarkan event lokal. Jika options.broadcast: true, sebar juga ke Redis Pub/Sub.
   * @param {string} event
   * @param {any} data
   * @param {{ broadcast?: boolean }} [options]
   * @returns {boolean}
   */
  emit(event, data, options = {}) {
    // 1. Tier 1: In-Memory lokal
    const result = super.emit(event, data, options);

    // 2. Tier 2: Redis Bridge (jika diminta dan Redis siap)
    if (options.broadcast && this.redisManager && this.redisManager.isReady) {
      const packet = {
        origin: this.origin,
        event,
        data,
        timestamp: Date.now(),
      };
      this.redisManager.publish(REDIS_EVENT_CHANNEL, packet).catch(() => {});
    }

    return result;
  }

  /**
   * Helper eksplisit untuk broadcast lintas proses/shard.
   * @param {string} event
   * @param {any} data
   * @returns {boolean}
   */
  broadcast(event, data) {
    return this.emit(event, data, { broadcast: true });
  }

  /**
   * Bersihkan semua listener (untuk pengujian).
   */
  clear() {
    this.removeAllListeners();
    this.detachRedisBridge();
  }
}

const eventBus = new EventBus();
eventBus.EventBus = EventBus;

module.exports = eventBus;
