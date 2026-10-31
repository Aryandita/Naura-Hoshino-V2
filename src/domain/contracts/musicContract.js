"use strict";

/**
 * @module musicContract
 * @description Music Public Domain Contract - Antarmuka publik terisolasi untuk
 * manipulasi pemputaran audio, antrean lagu Poru v5, node Lavalink v4, dan
 * penyiaran telemetri status musik melalui EventBus.
 *
 * ## Interface Methods
 * - `SetMusicManager(manager)` - Suntikkan instance MusicManager
 * - `getManager()` - Ambil instance MusicManager (lokal atau ServiceContainer)
 * - `getPoru()` - Ambil instance Poru aktif
 * - `getPlayer(guildId)` - Ambil player Poru di guild tertentu
 * - `getState(guildId)` - Baca status pemputaran audio di guild
 * - `skip(guildId)` - Lewati lagu yang sedang diputar
 * - `pause(guildId)` - Jeda pemputaran musik
 * - `resume(guildId)` - Lanjutkan pemputaran musik
 * - `stop(guildId)` - Hentikan pemputaran dan bersihkan antrean
 * - `setVolume(guildId, volume)` - Atur volume (0-100)
 * - `getQueue(guildId)` - Ambil daftar lagu di antrean
 * - `getClusterStatus()` - Ambil status kluster node Lavalink
 *
 * @example
 * const music = require("./musicContract");
 * const state = music.getState("guild-id-here");
 * music.skip("guild-id-here");
 * music.setVolume("guild-id-here", 75);
 */

const eventBus = require("../../core/eventBus");
const { lavalinkClusterManager } = require("../../managers/lavalinkClusterManager");

// ========================================================================
// CONSTANTS
// ========================================================================

/** @type {number} Volume minimum yang diizinkan */
const VOLUME_MIN = 0;

/** @type {number} Volume maksimum yang diizinkan */
const VOLUME_MAX = 100;

/** @type {number} Volume default saat player tidak tersedia */
const VOLUME_DEFAULT = 100;

/** @type {string} Kode alasan: tidak ada player aktif di guild */
const REASON_NO_ACTIVE_PLAYER = "NO_ACTIVE_PLAYER";

/**
 * @type {Readonly<object>} State musik default untuk guild tanpa player aktif
 */
const INACTIVE_STATE = Object.freeze({
  isActive: false,
  isPlaying: false,
  isPaused: false,
  currentTrack: null,
  position: 0,
  volume: 0,
  queueLength: 0,
});

/**
 * @type {Readonly<{currentTrack: null, queue: Array}>} Antrean kosong default
 */
const EMPTY_QUEUE = Object.freeze({ currentTrack: null, queue: Object.freeze([]) });

// =======================================================================
// INTERFACE DEFINITION
// =========================================================================

/**
 * Kelas kontrak domain musik yang menyediakan antarmuka publik terisolasi
 * untuk kontrol pemputaran audio, antrean Poru v5, dan node Lavalink v4.
 */
class MusicContract {
  constructor() {
    /** @type {object|null} Instance MusicManager lokal (lazy-loaded) */
    this._musicManager = null;
  }

  /**
   * Menyuntikkan atau mendaftarkan instance MusicManager secara manual.
   * Gunakan ini jika MusicManager sudah tersedia sebelum akses pertama.
   *
   * @param {object} manager - Instance MusicManager yang memiliki properti `poru`
   */
  setMusicManager(manager) {
    this._musicManager = manager;
  }

  /**
   * Mengambil instance MusicManager dari penyimpanan lokal atau ServiceContainer.
   * Jiba belum diset, mencoba resolve dari container secara lazy.
   *
   * @returns {object|null} Instance MusicManager atau null jika tidak tersedia
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
   * Mengambil instance Poru (Lavalink client wrapper) yang aktif.
   *
   * @returns {object|null} Instance Poru atau null jika MusicManager tidak tersedia
   */
  getPoru() {
    const manager = this.getManager();
    return manager?.poru || null;
  }

  /**
   * Mengambil player Poru aktif di guild tertentu.
   *
   * @param {string} guildId - Discord Guild Snowflake ID
   * @returns {object|null} Instance Poru Player atau null jika tidak ada player aktif
   */
  getPlayer(guildId) {
    if (!guildId) return null;
    const poru = this.getPoru();
    return poru?.players?.get(guildId) || null;
  }

  /**
   * Membaca status pemputaran audio saat ini di suatu guild.
   * Mengembalikan state inactive jika tidak ada player aktif.
   *
   * @param {string} guildId - Discord Guild Snowflake ID
   * @returns {Readonly<object>} Status pemputaran beku dengan properti:
   *   guildId, isActive, isPlaying, isPaused, currentTrack, position, volume, queueLength
   */
  getState(guildId) {
    const player = this.getPlayer(guildId);
    if (!player) {
      return Object.freeze({ guildId, ...INACTIVE_STATE });
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
      volume: player.volume || VOLUME_DEFAULT,
      queueLength: player.queue?.length || 0,
    });
  }

  /**
   * Melew_ti lagu yang sedang diputar di guild.
   * Memancarkan event music:skip dan music:state setelah skip.
   *
   * @param {string} guildId - Discord Guild Snowflake ID
   * @returns {Readonly<{ok: boolean, reason?: string}>} Hasil operasi
   */
  skip(guildId) {
    const player = this.getPlayer(guildId);
    if (!player) {
      return Object.freeze({ ok: false, reason: REASON_NO_ACTIVE_PLAYER });
    }

    if (typeof player.stop === "function") {
      player.stop();
    }

    eventBus.emit("music:skip", { guildId, timestamp: Date.now() });
    eventBus.emit("music:state", this.getState(guildId));

    return Object.freeze({ ok: true });
  }

  /**
   * Menjida pemputaran musik di guild.
   * Memancarkan event music:state setelah pause.
   *
   * @param {string} guildId - Discord Guild Snowflake ID
   * @returns {Readonly<{ok: boolean, reason?: string}>} Hasil operasi
   */
  pause(guildId) {
    const player = this.getPlayer(guildId);
    if (!player) {
      return Object.freeze({ ok: false, reason: REASON_NO_ACTIVE_PLAYER });
    }

    if (typeof player.pause === "function") {
      player.pause(true);
    }

    eventBus.emit("music:state", this.getState(guildId));
    return Object.freeze({ ok: true });
  }

  /**
   * Melajutkan pemputaran musik yang sedang dijeda di guild.
   * Memancarkan event music:state setelah resume.
   *
   * @param {string} guildId - Discord Guild Snowflake ID
   * @returns {Readonly<{ok: boolean, reason?: string}>} Hasil operasi
   */
  resume(guildId) {
    const player = this.getPlayer(guildId);
    if (!player) {
      return Object.freeze({ ok: false, reason: REASON_NO_ACTIVE_PLAYER });
    }

    if (typeof player.pause === "function") {
      player.pause(false);
    }

    eventBus.emit("music:state", this.getState(guildId));
    return Object.freeze({ ok: true });
  }

  /**
   * Menghentikan pemputaran musik dan mengbersihan antrean di guild.
   * Memanggil queue.clear() lalu player.destroy().
   * Memancarkan event music:state dengan status inactive.
   *
   * @param {string} guildId - Discord Guild Snowflake ID
   * @returns {Readonly<{ok: boolean, reason?: string}>} Hasil operasi
   */
  stop(guildId) {
    const player = this.getPlayer(guildId);
    if (!player) {
      return Object.freeze({ ok: false, reason: REASON_NO_ACTIVE_PLAYER });
    }

    if (player.queue && typeof player.queue.clear === "function") {
      player.queue.clear();
    }
    if (typeof player.destroy === "function") {
      player.destroy();
    }

    eventBus.emit("music:state", {
      guildId,
      ...INACTIVE_STATE,
    });

    return Object.freeze({ ok: true });
  }

  /**
   * Mengatur volume pemputaran musik di guild.
   * Nilai dijepit (clamped) antara 0-100 dan dibulatkan ke integer.
   *
   * @param {string} guildId - Discord Guild Snowflake ID
   * @param {number} volume - Tingkat volume yang diinginkan (0-100)
   * @returns {Readonly<{ok: boolean, volume: number, reason?: string}>}
   *   Hasil operasi dengan volume aktual yang diterapkan
   */
  setVolume(guildId, volume) {
    const safeVol = Math.max(VOLUME_MIN, Math.min(VOLUME_MAX, Math.floor(Number(volume) || 0)));
    const player = this.getPlayer(guildId);
    if (!player) {
      return Object.freeze({ ok: false, volume: 0, reason: REASON_NO_ACTIVE_PLAYER });
    }

    if (typeof player.setVolume === "function") {
      player.setVolume(safeVol);
    }

    eventBus.emit("music:state", this.getState(guildId));
    return Object.freeze({ ok: true, volume: safeVol });
  }

  /**
   * Mengambil daftar lagu di dalam antrean guild.
   *
   * @param {string} guildId - Discord Guild Snowflake ID
   * @returns {Readonly<{currentTrack: object|null, queue: Array<object>}>}
   *   Lagu yang sedang diputar dan array antrean yang dibekukan
   */
  getQueue(guildId) {
    const player = this.getPlayer(guildId);
    if (!player) {
      return EMPTY_QUEUE;
    }

    const queueList = player.queue ? Array.from(player.queue) : [];
    return Object.freeze({
      currentTrack: player.currentTrack || null,
      queue: queueList,
    });
  }

  /**
   * Mengambil status kluster node Lavalink dari lavalinkClusterManager.
   *
   * @returns {object} Status kluster node Lavalink
   */
  getClusterStatus() {
    return lavalinkClusterManager.getStatus(this.getPoru());
  }
}

// ========================================================================
// EXPORTS
// =======================================================================

const musicContract = new MusicContract();
musicContract.MusicContract = MusicContract;

module.exports = musicContract;