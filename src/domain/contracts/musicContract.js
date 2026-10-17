"use strict";

const eventBus = require("../../core/eventBus");
const { lavalinkClusterManager } = require("../../managers/lavalinkClusterManager");

/**
 * Music Public Domain Contract
 * Menyediakan antarmuka publik terisolasi untuk manipulasi pemutaran audio,
 * antrean lagu Poru v5, node Lavalink v4, dan penyiaran telemetri status.
 */
class MusicContract {
  constructor() {
    this._musicManager = null;
  }

  /**
   * Suntikkan atau daftarkan instance MusicManager.
   * @param {object} manager
   */
  setMusicManager(manager) {
    this._musicManager = manager;
  }

  /**
   * Ambil instance MusicManager dari lokal atau ServiceContainer.
   * @returns {object|null}
   */
  getManager() {
    if (this._musicManager) return this._musicManager;
    try {
      const container = require("../../core/container");
      if (container && container.has("musicManager")) {
        this._musicManager = container.resolve("musicManager");
      }
    } catch (_) {}
    return this._musicManager;
  }

  /**
   * Mengambil instance Poru aktif.
   */
  getPoru() {
    const manager = this.getManager();
    return manager?.poru || null;
  }

  /**
   * Mengambil player Poru aktif di guild.
   * @param {string} guildId
   * @returns {object|null}
   */
  getPlayer(guildId) {
    if (!guildId) return null;
    const poru = this.getPoru();
    return poru?.players?.get(guildId) || null;
  }

  /**
   * Membaca status pemutaran audio saat ini di suatu guild.
   * @param {string} guildId
   * @returns {Readonly<object>}
   */
  getState(guildId) {
    const player = this.getPlayer(guildId);
    if (!player) {
      return Object.freeze({
        guildId,
        isActive: false,
        isPlaying: false,
        isPaused: false,
        currentTrack: null,
        position: 0,
        volume: 0,
        queueLength: 0,
      });
    }

    const current = player.currentTrack;
    return Object.freeze({
      guildId,
      isActive: true,
      isPlaying: player.isPlaying,
      isPaused: player.isPaused,
      currentTrack: current
        ? {
            title: current.info?.title || "Unknown",
            author: current.info?.author || "Unknown",
            uri: current.info?.uri || "",
            duration: current.info?.length || 0,
            identifier: current.info?.identifier || "",
          }
        : null,
      position: player.position || 0,
      volume: player.volume || 100,
      queueLength: player.queue?.length || 0,
    });
  }

  /**
   * Melewati lagu yang sedang diputar.
   * @param {string} guildId
   * @returns {Readonly<{ ok: boolean, reason?: string }>}
   */
  skip(guildId) {
    const player = this.getPlayer(guildId);
    if (!player) {
      return Object.freeze({ ok: false, reason: "NO_ACTIVE_PLAYER" });
    }

    if (typeof player.stop === "function") {
      player.stop();
    }

    eventBus.emit("music:skip", { guildId, timestamp: Date.now() });
    eventBus.emit("music:state", this.getState(guildId));

    return Object.freeze({ ok: true });
  }

  /**
   * Menjeda pemutaran musik di guild.
   * @param {string} guildId
   * @returns {Readonly<{ ok: boolean, reason?: string }>}
   */
  pause(guildId) {
    const player = this.getPlayer(guildId);
    if (!player) {
      return Object.freeze({ ok: false, reason: "NO_ACTIVE_PLAYER" });
    }

    if (typeof player.pause === "function") {
      player.pause(true);
    }

    eventBus.emit("music:state", this.getState(guildId));
    return Object.freeze({ ok: true });
  }

  /**
   * Melanjutkan pemutaran musik di guild.
   * @param {string} guildId
   * @returns {Readonly<{ ok: boolean, reason?: string }>}
   */
  resume(guildId) {
    const player = this.getPlayer(guildId);
    if (!player) {
      return Object.freeze({ ok: false, reason: "NO_ACTIVE_PLAYER" });
    }

    if (typeof player.pause === "function") {
      player.pause(false);
    }

    eventBus.emit("music:state", this.getState(guildId));
    return Object.freeze({ ok: true });
  }

  /**
   * Menghentikan pemutaran musik dan membersihkan antrean.
   * @param {string} guildId
   * @returns {Readonly<{ ok: boolean, reason?: string }>}
   */
  stop(guildId) {
    const player = this.getPlayer(guildId);
    if (!player) {
      return Object.freeze({ ok: false, reason: "NO_ACTIVE_PLAYER" });
    }

    if (player.queue && typeof player.queue.clear === "function") {
      player.queue.clear();
    }
    if (typeof player.destroy === "function") {
      player.destroy();
    }

    eventBus.emit("music:state", {
      guildId,
      isActive: false,
      isPlaying: false,
      isPaused: false,
      currentTrack: null,
      position: 0,
      volume: 0,
      queueLength: 0,
    });

    return Object.freeze({ ok: true });
  }

  /**
   * Mengatur volume pemutaran musik (0 - 100).
   * @param {string} guildId
   * @param {number} volume
   * @returns {Readonly<{ ok: boolean, volume: number, reason?: string }>>}
   */
  setVolume(guildId, volume) {
    const safeVol = Math.max(0, Math.min(100, Math.floor(Number(volume) || 0)));
    const player = this.getPlayer(guildId);
    if (!player) {
      return Object.freeze({ ok: false, volume: 0, reason: "NO_ACTIVE_PLAYER" });
    }

    if (typeof player.setVolume === "function") {
      player.setVolume(safeVol);
    }

    eventBus.emit("music:state", this.getState(guildId));
    return Object.freeze({ ok: true, volume: safeVol });
  }

  /**
   * Mengambil daftar lagu di dalam antrean.
   * @param {string} guildId
   * @returns {Readonly<{ currentTrack: object|null, queue: Array<object> }>}
   */
  getQueue(guildId) {
    const player = this.getPlayer(guildId);
    if (!player) {
      return Object.freeze({ currentTrack: null, queue: [] });
    }

    const queueList = player.queue ? Array.from(player.queue) : [];
    return Object.freeze({
      currentTrack: player.currentTrack || null,
      queue: queueList,
    });
  }

  /**
   * Mengambil status kluster node Lavalink.
   */
  getClusterStatus() {
    return lavalinkClusterManager.getStatus(this.getPoru());
  }
}

const musicContract = new MusicContract();
musicContract.MusicContract = MusicContract;

module.exports = musicContract;
