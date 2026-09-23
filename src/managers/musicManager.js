"use strict";

// Lokasi: src/managers/musicManager.js
const fs = require("fs");
const path = require("path");
const { Collection } = require("discord.js");
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
          console.error(
            "\x1b[41m\x1b[37m 🎵 MUSIC \x1b[0m \x1b[31mGagal parse LAVA_NODES, kembali ke mode multi-env / fallback.\x1b[0m",
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

    return this._poru;
  }

  initialize() {
    console.log(
      "\x1b[45m\x1b[37m 🎵 AUDIO \x1b[0m \x1b[35mMemulai Ekosistem Lavalink (Native Mode)...\x1b[0m",
    );

    const poru = this.ensurePoru();

    const connectPoru = () => {
      try {
        poru.init(this.client);
      } catch (e) {
        console.error("[Poru Init Error]", e);
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
        console.error(`[Poru Event Error] Gagal memuat ${file}:`, err);
      }
    }

    console.log(
      "\x1b[42m\x1b[30m 📂 SYSTEM \x1b[0m \x1b[32m" +
        eventFiles.length +
        " Poru Events dimuat.\x1b[0m",
    );
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
    } catch (e) {}
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
      title: String(info.title || "")
        .toLowerCase()
        .trim(),
      author: String(info.author || "")
        .toLowerCase()
        .trim(),
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
    const newTitle = String(track.info.title || "")
      .toLowerCase()
      .trim();
    const newUri = String(track.info.uri || "");
    const newId = String(track.info.identifier || "");

    return recent.some((past) => {
      if (newId && past.identifier && newId === past.identifier) return true;
      if (newUri && past.uri && newUri === past.uri) return true;
      if (newTitle && past.title && newTitle === past.title) return true;
      return false;
    });
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
