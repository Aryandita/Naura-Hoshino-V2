"use strict";

// Lokasi: src/managers/musicManager.js
const fs = require("fs");
const path = require("path");
const { Collection } = require("discord.js");
const { logger } = require("./logger");
const ui = require("../config/ui");
const { lavalinkClusterManager } = require("./lavalinkClusterManager");

let PoruCtor = null;

function loadPoru() {
  if (!PoruCtor) {
    ({ Poru: PoruCtor } = require("poru"));
  }
  return PoruCtor;
}

class MusicManager {
  constructor(client) {
    this.client = client;
    this.ui = ui;
    this.uiCache = new Collection();
    this._poru = null;
    this._eventsLoaded = false;
    this.duplicateFilterStates = new Map();
    this.trackHistories = new Map();
    this.savedQueues = new Map();
    this.skipVotes = new Map();
    this.sleepTimers = new Map();
    this.stay24_7States = new Map();
  }

  get poru() {
    return this.ensurePoru();
  }

  buildNodes() {
    const env = require("../config/env");
    const rawNodes = env.LAVA_NODES;
    let configuredNodes = [];

    if (rawNodes) {
      // 1. Format JSON Array: [{"name":"...","host":"...","port":2333,"password":"...","secure":false}]
      try {
        const nodes = JSON.parse(rawNodes);
        if (Array.isArray(nodes) && nodes.length > 0) {
          configuredNodes = nodes.map((node, index) => ({
            name: node.name || `Naura Node ${index + 1}`,
            host: String(node.host || "localhost").trim(),
            port: parseInt(node.port, 10) || 2333,
            password: String(node.password || "youshallnotpass").trim(),
            secure:
              node.secure === true || String(node.secure).trim() === "true",
          }));
        }
      } catch (_) {
        // 2. Format Comma-Separated: "Node1@host1:port1:pass1:false,Node2@host2:port2:pass2:true"
        if (typeof rawNodes === "string" && rawNodes.includes(":")) {
          const list = rawNodes
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);
          if (list.length > 0) {
            const parsed = [];
            list.forEach((item, idx) => {
              let name = `Naura Node ${idx + 1}`;
              let target = item;
              if (target.includes("@")) {
                const parts = target.split("@");
                name = parts[0];
                target = parts[1];
              }
              const segments = target.split(":");
              if (segments.length >= 2) {
                const host = segments[0];
                const port = parseInt(segments[1], 10) || 2333;
                const password = segments[2] || "youshallnotpass";
                const secure = segments[3] === "true" || port === 443;
                parsed.push({ name, host, port, password, secure });
              }
            });
            if (parsed.length > 0) configuredNodes = parsed;
          }
        }
        if (configuredNodes.length === 0) {
          logger.error(
            "[Music] Gagal parse LAVA_NODES, kembali ke mode multi-env / fallback.",
          );
        }
      }
    }

    if (configuredNodes.length === 0) {
      // 3. Scan numbered environment variables via centralized env manager
      configuredNodes = env.getLavalinkNumberedNodes();
    }

    // Bangun daftar node bertingkat (Tier 1: Private, Tier 2: Sekunder, Tier 3: Public Fallback Pool)
    return lavalinkClusterManager.buildTieredNodeList(configuredNodes);
  }

  ensurePoru() {
    if (this._poru) return this._poru;

    const Poru = loadPoru();

    const env = require("../config/env");
    const options = {
      library: "discord.js",
      defaultPlatform: env.MUSIC_DEFAULT_SEARCH || "scsearch",
      clientName: "Naura-Hoshino-Music-System/3.1",
      plugins: [],
    };

    // Inisialisasi Poru Native Mode (Lavalink v4 / LavaSrc)
    this._poru = new Poru(this.client, this.buildNodes(), options);
    this.loadPoruEvents();

    lavalinkClusterManager.setPoru(this._poru);
    return this._poru;
  }

  initialize() {
    logger.info("Memulai Ekosistem Lavalink (Native Mode)...");

    const poru = this.ensurePoru();

    const connectPoru = () => {
      try {
        poru.init(this.client);
      } catch (e) {
        logger.error("[Poru Init Error]", e);
      }
    };

    if (this.client.isReady()) {
      connectPoru();
    } else {
      this.client.once("ready", connectPoru);
      this.client.once("clientReady", connectPoru);
    }
  }

  loadPoruEvents() {
    if (this._eventsLoaded || !this._poru) return;
    this._eventsLoaded = true;

    const poru = this._poru;
    const eventsPath = path.join(__dirname, "../music/poru_events");
    if (!fs.existsSync(eventsPath)) return;

    const eventFiles = fs
      .readdirSync(eventsPath)
      .filter((file) => file.endsWith(".js"));

    for (const file of eventFiles) {
      try {
        const event = require(`../music/poru_events/${file}`);
        const eventName = file.split(".")[0];
        if (typeof event.execute === "function") {
          poru.on(eventName, (...args) => event.execute(this, ...args));
        }
      } catch (err) {
        logger.error(`[Poru Event Error] Gagal memuat ${file}:`, err);
      }
    }

    logger.info(`[Music] ${eventFiles.length} Poru Events dimuat.`);
  }

  async updatePanelEmbed(player) {
    if (!player) return;
    try {
      const cached = this.uiCache.get(player.guildId);
      if (
        !cached ||
        !cached.messageId ||
        typeof cached.generatePayload !== "function"
      )
        return;

      const channel = this.client.channels.cache.get(player.textChannel);
      if (!channel) return;

      const msg = await channel.messages
        .fetch(cached.messageId)
        .catch(() => null);
      if (!msg) return;

      const payload = await cached.generatePayload(player.position || 0, true);
      await msg.edit(payload).catch(() => {});
    } catch (e) {
      logger.debug("[musicManager:updatePanelEmbed] Operasi audio/voice gagal: " + (e?.message || e));
    }
  }

  /**
   * Cek apakah filter deteksi lagu duplikat aktif di guild tertentu.
   * @param {string} guildId
   * @returns {boolean}
   */
  isDuplicateFilterEnabled(guildId) {
    if (!guildId) return true;
    if (this.duplicateFilterStates.has(guildId)) {
      return this.duplicateFilterStates.get(guildId);
    }
    return true; // Default aktif demi menjaga keragaman musik
  }

  /**
   * Atur status filter deteksi lagu duplikat untuk guild tertentu.
   * @param {string} guildId
   * @param {boolean} enabled
   */
  setDuplicateFilterEnabled(guildId, enabled) {
    if (!guildId) return;
    this.duplicateFilterStates.set(guildId, Boolean(enabled));
  }

  /**
   * Catat lagu yang baru saja dimainkan ke dalam riwayat 10 lagu terakhir guild.
   * @param {string} guildId
   * @param {object} track
   */
  recordPlayedTrack(guildId, track) {
    if (!guildId || !track || !track.info) return;
    const history = this.trackHistories.get(guildId) || [];
    const info = track.info;
    history.unshift({
      title: String(info.title || "").toLowerCase().trim(),
      author: String(info.author || "").toLowerCase().trim(),
      uri: String(info.uri || ""),
      identifier: String(info.identifier || ""),
      timestamp: Date.now(),
    });
    if (history.length > 10) history.pop();
    this.trackHistories.set(guildId, history);
  }

  /**
   * Cek apakah lagu ini pernah diputar dalam 5 lagu terakhir di guild ini.
   * @param {string} guildId
   * @param {object} track
   * @returns {boolean}
   */
  isRecentDuplicate(guildId, track) {
    if (!guildId || !track || !track.info) return false;
    const history = this.trackHistories.get(guildId);
    if (!history || history.length === 0) return false;

    const recent = history.slice(0, 5);
    const newTitle = String(track.info.title || "").toLowerCase().trim();
    const newUri = String(track.info.uri || "");
    const newId = String(track.info.identifier || "");

    return recent.some((past) => {
      if (newId && past.identifier && newId === past.identifier) return true;
      if (newUri && past.uri && newUri === past.uri) return true;
      if (newTitle && past.title && newTitle === past.title) return true;
      return false;
    });
  }

  /**
   * Menyimpan antrean aktif ke Redis dan fallback memori.
   * @param {string} guildId
   * @param {object} player
   */
  async saveQueueState(guildId, player) {
    if (!guildId || !player) return;
    if (!player.currentTrack && (!player.queue || player.queue.length === 0)) {
      return;
    }

    const payload = {
      guildId,
      voiceChannel: player.voiceChannel,
      textChannel: player.textChannel,
      currentTrack: player.currentTrack
        ? {
            track: player.currentTrack.track,
            info: player.currentTrack.info,
          }
        : null,
      position: player.position || 0,
      queue: (player.queue || []).map((t) => ({
        track: t.track,
        info: t.info,
      })),
      volume: player.volume || 100,
      savedAt: Date.now(),
    };

    this.savedQueues.set(guildId, payload);

    try {
      const redis = require("./redisManager").client;
      if (redis?.isReady) {
        await redis.set(
          `lavalink:queue:${guildId}`,
          JSON.stringify(payload),
          "EX",
          3600,
        );
      }
    } catch (err) {
      logger.warn("[musicManager:saveQueueState] Operasi cache Redis gagal: " + (err?.message || err));
    }
  }

  /**
   * Mengambil antrean tersimpan dari Redis atau memori.
   * @param {string} guildId
   * @returns {Promise<object|null>}
   */
  async getSavedQueueState(guildId) {
    if (!guildId) return null;

    try {
      const redis = require("./redisManager").client;
      if (redis?.isReady) {
        const raw = await redis.get(`lavalink:queue:${guildId}`);
        if (raw) return JSON.parse(raw);
      }
    } catch (err) {
      logger.warn("[musicManager:getSavedQueueState] Operasi cache Redis gagal: " + (err?.message || err));
    }

    return this.savedQueues.get(guildId) || null;
  }

  /**
   * Menghapus antrean tersimpan setelah musik selesai atau dihentikan.
   * @param {string} guildId
   */
  async clearSavedQueueState(guildId) {
    if (!guildId) return;
    this.savedQueues.delete(guildId);

    try {
      const redis = require("./redisManager").client;
      if (redis?.isReady) {
        await redis.del(`lavalink:queue:${guildId}`);
      }
    } catch (err) {
      logger.warn("[musicManager:clearSavedQueueState] Operasi cache Redis gagal: " + (err?.message || err));
    }
  }

  /**
   * Mengambil suara vote skip yang sedang aktif di guild.
   * @param {string} guildId
   * @returns {Set<string>}
   */
  getSkipVotes(guildId) {
    if (!guildId) return new Set();
    if (!this.skipVotes.has(guildId)) {
      this.skipVotes.set(guildId, new Set());
    }
    return this.skipVotes.get(guildId);
  }

  /**
   * Menambahkan vote skip seorang anggota.
   * @param {string} guildId
   * @param {string} userId
   * @returns {{added: boolean, votes: Set<string>}}
   */
  addSkipVote(guildId, userId) {
    const votes = this.getSkipVotes(guildId);
    if (votes.has(userId)) {
      return { added: false, votes };
    }
    votes.add(userId);
    return { added: true, votes };
  }

  /**
   * Mengosongkan suara vote skip (misal saat lagu berganti).
   * @param {string} guildId
   */
  clearSkipVotes(guildId) {
    if (!guildId) return;
    this.skipVotes.delete(guildId);
  }

  /**
   * Memasang sleep timer terpusat dengan efek audio fade-out 15 detik sebelum pemutusan.
   * @param {string} guildId - ID server discord.
   * @param {number} minutes - Durasi dalam menit (0 untuk membatalkan).
   * @param {object} [options={}] - Opsi callback pengujian dan event lifecycle.
   * @param {Function} [options.onFadeStart] - Callback saat fase fade-out dimulai.
   * @param {Function} [options.onExpire] - Callback saat timer selesai dan player diputus.
   * @returns {object|null} Informasi timer yang terdaftar.
   */
  setSleepTimer(guildId, minutes, options = {}) {
    if (!guildId) return null;

    // Bersihkan timer sebelumnya jika ada
    this.cancelSleepTimer(guildId);

    const numMinutes = Number(minutes);
    if (isNaN(numMinutes) || numMinutes <= 0) {
      return { success: true, cancelled: true };
    }

    const totalMs = Math.round(numMinutes * 60 * 1000);
    const fadeDurationMs = Math.min(15000, totalMs);
    const normalDurationMs = totalMs - fadeDurationMs;
    const endsAt = Date.now() + totalMs;

    const player = this._poru?.players?.get(guildId);
    const initialVolume =
      player && typeof player.volume === "number" ? player.volume : 100;

    const entry = {
      guildId,
      minutes: numMinutes,
      endsAt,
      totalMs,
      fadeDurationMs,
      normalDurationMs,
      initialVolume,
      timeoutId: null,
      fadeIntervalId: null,
      isFading: false,
    };

    const startFadeOut = () => {
      entry.isFading = true;
      if (typeof options.onFadeStart === "function") {
        try {
          options.onFadeStart();
        } catch (e) {
          logger.debug("[MusicManager] onFadeStart error: " + e.message);
        }
      }

      const totalSteps = 15;
      const stepIntervalMs = Math.max(
        100,
        Math.floor(fadeDurationMs / totalSteps),
      );
      let currentStep = totalSteps;

      entry.fadeIntervalId = setInterval(() => {
        currentStep--;
        const activePlayer = this._poru?.players?.get(guildId);
        if (activePlayer && typeof activePlayer.setVolume === "function") {
          const newVol = Math.max(
            0,
            Math.round((initialVolume * currentStep) / totalSteps),
          );
          activePlayer.setVolume(newVol);
        }

        if (currentStep <= 0) {
          if (entry.fadeIntervalId) {
            clearInterval(entry.fadeIntervalId);
            entry.fadeIntervalId = null;
          }
          this.sleepTimers.delete(guildId);

          const finalPlayer = this._poru?.players?.get(guildId);
          if (finalPlayer) {
            const textChannelId = finalPlayer.textChannel;
            if (typeof finalPlayer.destroy === "function") {
              finalPlayer.destroy();
            }

            if (textChannelId && this.client) {
              const textChan = this.client.channels?.cache?.get(textChannelId);
              if (textChan && typeof textChan.send === "function") {
                const {
                  buildContainerV2,
                } = require("../utils/NauraContainerBuilder");
                const sleepEndPayload = buildContainerV2({
                  accentColorHex: ui.getColor("primary") || "#FFB6C1",
                  title: "😴 Sleep Timer Selesai",
                  description:
                    "Waktu sleep timer telah habis. Pemutaran musik dihentikan dan Naura pamit dari Voice Channel. Selamat beristirahat! 💤\n-# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
                  expression: "sleepy",
                  footerText: ui.getFooter("music"),
                });
                textChan.send(sleepEndPayload).catch(() => {});
              }
            }
          }

          if (typeof options.onExpire === "function") {
            try {
              options.onExpire();
            } catch (e) {
              logger.debug("[MusicManager] onExpire error: " + e.message);
            }
          }
        }
      }, stepIntervalMs);

      if (entry.fadeIntervalId.unref) entry.fadeIntervalId.unref();
    };

    if (normalDurationMs <= 0) {
      startFadeOut();
    } else {
      entry.timeoutId = setTimeout(() => {
        startFadeOut();
      }, normalDurationMs);
      if (entry.timeoutId.unref) entry.timeoutId.unref();
    }

    this.sleepTimers.set(guildId, entry);
    return entry;
  }

  /**
   * Membatalkan sleep timer aktif pada suatu guild dan memulihkan volume jika perlu.
   * @param {string} guildId - ID server discord.
   * @returns {boolean} True jika ada timer yang berhasil dibatalkan.
   */
  cancelSleepTimer(guildId) {
    if (!guildId || !this.sleepTimers.has(guildId)) return false;

    const entry = this.sleepTimers.get(guildId);
    if (entry.timeoutId) clearTimeout(entry.timeoutId);
    if (entry.fadeIntervalId) clearInterval(entry.fadeIntervalId);

    // Pulihkan volume jika sebelumnya sedang dalam fase fade
    if (entry.isFading && typeof entry.initialVolume === "number") {
      const player = this._poru?.players?.get(guildId);
      if (
        player &&
        typeof player.setVolume === "function" &&
        player.volume < entry.initialVolume
      ) {
        player.setVolume(entry.initialVolume);
      }
    }

    this.sleepTimers.delete(guildId);
    return true;
  }

  /**
   * Mengambil status sleep timer aktif di guild.
   * @param {string} guildId - ID server discord.
   * @returns {object|null} Status timer tidur atau null jika tidak aktif.
   */
  getSleepTimer(guildId) {
    if (!guildId || !this.sleepTimers.has(guildId)) return null;

    const entry = this.sleepTimers.get(guildId);
    const remainingMs = Math.max(0, entry.endsAt - Date.now());

    return {
      guildId,
      minutes: entry.minutes,
      endsAt: entry.endsAt,
      remainingMs,
      remainingSeconds: Math.ceil(remainingMs / 1000),
      isFading: entry.isFading || remainingMs <= 15000,
      initialVolume: entry.initialVolume,
    };
  }

  /**
   * Cek apakah server mengaktifkan mode standby 24/7 (Guild Patron Tier 3).
   * @param {string} guildId
   * @returns {boolean}
   */
  isStay24_7(guildId) {
    if (!guildId) return false;
    const gid = String(guildId);
    if (this.stay24_7States.has(gid)) {
      return this.stay24_7States.get(gid);
    }
    return false;
  }

  /**
   * Mengatur status mode standby 24/7 untuk server.
   * @param {string} guildId
   * @param {boolean} enabled
   * @returns {boolean}
   */
  setStay24_7(guildId, enabled) {
    if (!guildId) return false;
    const gid = String(guildId);
    const val = Boolean(enabled);
    this.stay24_7States.set(gid, val);
    const activePlayer = this._poru?.players?.get(gid);
    if (activePlayer) {
      activePlayer.is24_7 = val;
    }
    return val;
  }
}


/**
 * Pilih node Lavalink terbaik yang non-fallback.
 *
 * Jika semua node private down, kembalikan node publik (Serenetia)
 * sebagai cadangan terakhir. Fungsi ini dipanggil oleh plugin musik
 * saat createConnection() agar Poru tidak memilih Serenetia saat ada
 * node yang lebih stabil.
 *
 * @param {Poru} poru - Instance Poru yang sudah terhubung.
 * @returns {string|undefined} Nama node terpilih, atau undefined (biarkan Poru auto-pilih).
 */
MusicManager.getPreferredNode = function (poru, options = {}) {
  return lavalinkClusterManager.getPreferredNode(poru, options);
};

module.exports = MusicManager;
