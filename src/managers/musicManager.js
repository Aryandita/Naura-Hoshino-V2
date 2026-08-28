"use strict";

// Lokasi: src/managers/musicManager.js
const fs = require("fs");
const path = require("path");
const { Collection } = require("discord.js");
const ui = require("../config/ui");

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
  }

  get poru() {
    return this.ensurePoru();
  }

  buildNodes() {
    const env = require("../config/env");
    const rawNodes = env.LAVA_NODES;

    if (rawNodes) {
      // 1. Format JSON Array: [{"name":"...","host":"...","port":2333,"password":"...","secure":false}]
      try {
        const nodes = JSON.parse(rawNodes);
        if (Array.isArray(nodes) && nodes.length > 0) {
          return nodes.map((node, index) => ({
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
            if (parsed.length > 0) return parsed;
          }
        }
        console.error(
          "\x1b[41m\x1b[37m 🎵 MUSIC \x1b[0m \x1b[31mGagal parse LAVA_NODES, kembali ke mode multi-env / fallback.\x1b[0m",
        );
      }
    }

    // 3. Scan numbered environment variables (LAVALINK_HOST_2, LAVALINK_HOST_3, dst.)
    const dynamicNodes = [];
    if (env.LAVA_HOST) {
      dynamicNodes.push({
        name: "Naura Node 1",
        host: String(env.LAVA_HOST || "localhost").trim(),
        port: parseInt(env.LAVA_PORT, 10) || 2333,
        password: String(env.LAVA_PASS || "youshallnotpass").trim(),
        secure: env.LAVA_SECURE || false,
      });
    }

    let nodeIndex = 2;
    while (
      process.env[`LAVALINK_HOST_${nodeIndex}`] ||
      process.env[`LAVA_HOST_${nodeIndex}`]
    ) {
      const host =
        process.env[`LAVALINK_HOST_${nodeIndex}`] ||
        process.env[`LAVA_HOST_${nodeIndex}`];
      const port =
        parseInt(
          process.env[`LAVALINK_PORT_${nodeIndex}`] ||
            process.env[`LAVA_PORT_${nodeIndex}`],
          10,
        ) || 2333;
      const password =
        process.env[`LAVALINK_PASSWORD_${nodeIndex}`] ||
        process.env[`LAVA_PASS_${nodeIndex}`] ||
        "youshallnotpass";
      const secure =
        process.env[`LAVALINK_SECURE_${nodeIndex}`] === "true" ||
        process.env[`LAVA_SECURE_${nodeIndex}`] === "true" ||
        port === 443;
      const name =
        process.env[`LAVALINK_NAME_${nodeIndex}`] ||
        process.env[`LAVA_NAME_${nodeIndex}`] ||
        `Naura Node ${nodeIndex}`;

      dynamicNodes.push({
        name,
        host: String(host).trim(),
        port,
        password: String(password).trim(),
        secure,
      });
      nodeIndex++;
    }

    if (dynamicNodes.length > 0) {
      return dynamicNodes;
    }

    // Mode fallback: 1 default node
    return [
      {
        name: "Naura Node 1",
        host: String(env.LAVA_HOST || "localhost").trim(),
        port: parseInt(env.LAVA_PORT, 10) || 2333,
        password: String(env.LAVA_PASS || "youshallnotpass").trim(),
        secure: env.LAVA_SECURE || false,
      },
    ];
  }

  ensurePoru() {
    if (this._poru) return this._poru;

    const Poru = loadPoru();

    const options = {
      library: "discord.js",
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
}

module.exports = MusicManager;
