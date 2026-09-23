"use strict";

/**
 * lavalinkClusterManager.js - Pengendali Kluster Node Lavalink Adaptif & Resilien.
 *
 * Mengelola:
 *   1. Tiered Node Orchestration:
 *      - Tier 1: Private Node Utama (Lokal / VPS Pribadi)
 *      - Tier 2: Private Node Sekunder
 *      - Tier 3: Public Fallback Pool (Millohost, Serenetia, Invert, dll.)
 *   2. Server Capability Discovery:
 *      - Probe REST /v4/info untuk deteksi plugin LavaSrc, YouTube, dan filter DSP.
 *   3. Circuit Breaker & Node Quarantine:
 *      - Isolasi otomatis (5 menit) bagi node yang melempar 3 error beruntun.
 *   4. Zero-Drop Player Migration:
 *      - Migrasi otomatis sesi pemutaran aktif saat node disconnect tanpa putus voice.
 *   5. Defensive Error Boundary:
 *      - Isolasi error jaringan socket agar tidak memicu uncaughtException / bot crash.
 */

const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");
const { logger } = require("./logger");

// Konfigurasi Default Circuit Breaker
const CB_CONFIG = {
  ERROR_THRESHOLD: 3, // Maksimal 3 error beruntun
  WINDOW_MS: 30000, // Dalam jendela 30 detik
  QUARANTINE_MS: 300000, // Karantina 5 menit (300.000 ms)
};

class LavalinkClusterManager {
  constructor() {
    this.nodeTiers = new Map(); // nodeName -> tier number (1, 2, 3)
    this.circuitBreakers = new Map(); // nodeName -> { state, failures, lastFailureTime, quarantineUntil }
    this.nodeCapabilities = new Map(); // nodeName -> { hasLavaSrc, hasYoutube, hasSpotify, plugins, version }
    this.migrationLocks = new Set(); // guildId set untuk mencegah duplikasi migrasi
    this.hiFiNodes = new Map(); // nodeName -> { region, lossless, maxBitrate, codec }
    this.guildAudioQualities = new Map(); // guildId -> "standard" | "hd" | "lossless"
    this.nodeLatencies = new Map(); // nodeName -> { latencyMs, timestamp }
    this.heartbeatFailures = new Map(); // nodeName -> consecutive timeout count
    this.pingInterval = null; // Periodic RTT prober timer
  }

  /**
   * Muat daftar node publik terverifikasi dari config atau fallback lokal.
   * @returns {Array<object>}
   */
  loadPublicFallbackNodes() {
    const configPath = path.join(
      __dirname,
      "../config/lavalink-fallbacks.json",
    );
    if (fs.existsSync(configPath)) {
      try {
        const content = fs.readFileSync(configPath, "utf8");
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {
        logger.warn(
          `[LavalinkClusterManager] Gagal membaca lavalink-fallbacks.json: ${e.message}`,
        );
      }
    }

    // Default hardcoded fallback jika file belum ada
    return [
      {
        name: "Millohost Public Node",
        host: "lava-v4.millohost.my.id",
        port: 443,
        password: "https://discord.gg/mjS5J2K3ep",
        secure: true,
        tier: 3,
        isPrimaryFallback: true,
      },
      {
        name: "Serenetia Public Node",
        host: "lavalinkv4.serenetia.com",
        port: 443,
        password: "https://seretia.link/discord",
        secure: true,
        tier: 3,
        isPrimaryFallback: false,
      },
    ];
  }

  /**
   * Susun seluruh node berjenjang: gabungkan node private pengguna dengan pool publik.
   * @param {Array<object>} configuredPrivateNodes - Node yang dibaca dari .env
   * @returns {Array<object>}
   */
  buildTieredNodeList(configuredPrivateNodes = []) {
    const finalNodes = [];
    const seen = new Set();

    // 1. Daftarkan Private Nodes (Tier 1 & Tier 2)
    configuredPrivateNodes.forEach((node, idx) => {
      const key = `${node.host}:${node.port}`.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        const tier = idx === 0 ? 1 : 2;
        this.nodeTiers.set(node.name, tier);
        finalNodes.push({
          ...node,
          tier,
          isFallback: false,
        });
      }
    });

    // 2. Selalu daftarkan Public Fallback Nodes (Tier 3) ke pool
    const publicNodes = this.loadPublicFallbackNodes();
    for (const pub of publicNodes) {
      const key = `${pub.host}:${pub.port}`.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        this.nodeTiers.set(pub.name, 3);
        finalNodes.push({
          name: pub.name,
          host: String(pub.host).trim(),
          port: parseInt(pub.port, 10) || 443,
          password: String(pub.password).trim(),
          secure: pub.secure === true,
          tier: 3,
          isFallback: true,
        });
      }
    }

    logger.info(
      `\x1b[45m\x1b[37m 🎵 AUDIO CLUSTER \x1b[0m Terdaftar ${finalNodes.length} node Lavalink (${configuredPrivateNodes.length} Private, ${finalNodes.length - configuredPrivateNodes.length} Public Fallback).`,
    );

    return finalNodes;
  }

  /**
   * Catat kegagalan/error pada node dan evaluasi Circuit Breaker.
   * @param {string} nodeName
   * @param {Error|string} error
   */
  recordNodeError(nodeName, error) {
    if (!nodeName) return;
    const now = Date.now();
    let cb = this.circuitBreakers.get(nodeName);

    if (!cb) {
      cb = {
        state: "CLOSED",
        failures: 0,
        lastFailureTime: 0,
        quarantineUntil: 0,
      };
      this.circuitBreakers.set(nodeName, cb);
    }

    // Reset hitungan jika di luar jendela sliding window
    if (now - cb.lastFailureTime > CB_CONFIG.WINDOW_MS) {
      cb.failures = 1;
    } else {
      cb.failures += 1;
    }

    cb.lastFailureTime = now;

    // Jika melebihi ambang batas, aktifkan isolasi karantina
    if (cb.failures >= CB_CONFIG.ERROR_THRESHOLD && cb.state !== "OPEN") {
      cb.state = "OPEN";
      cb.quarantineUntil = now + CB_CONFIG.QUARANTINE_MS;
      logger.warn(
        `\x1b[41m\x1b[37m 🚨 CIRCUIT BREAKER \x1b[0m Node "${nodeName}" di-karantina selama 5 menit karena ${cb.failures} error beruntun: ${error?.message || error}`,
      );
    }
  }

  /**
   * Catat keberhasilan koneksi / pemutaran pada node (reset circuit breaker).
   * @param {string} nodeName
   */
  recordNodeSuccess(nodeName) {
    if (!nodeName) return;
    const cb = this.circuitBreakers.get(nodeName);
    if (cb) {
      cb.state = "CLOSED";
      cb.failures = 0;
      cb.quarantineUntil = 0;
    }
  }

  /**
   * Cek apakah node sedang dalam masa isolasi karantina.
   * @param {string} nodeName
   * @returns {boolean}
   */
  isNodeQuarantined(nodeName) {
    if (!nodeName) return false;
    const cb = this.circuitBreakers.get(nodeName);
    if (!cb || cb.state !== "OPEN") return false;

    if (Date.now() > cb.quarantineUntil) {
      // Masa karantina habis, uji coba pemulihan (HALF_OPEN)
      cb.state = "HALF_OPEN";
      cb.failures = 0;
      logger.info(
        `\x1b[43m\x1b[30m 🔄 CIRCUIT BREAKER \x1b[0m Masa karantina node "${nodeName}" selesai. Masuk tahap uji pemulihan (HALF_OPEN).`,
      );
      return false;
    }

    return true;
  }

  /**
   * Probe kapabilitas server via GET /v4/info.
   * @param {object} node - Objek Node Poru
   */
  async probeNodeCapabilities(node) {
    if (!node || !node.host) return;

    return new Promise((resolve) => {
      try {
        const protocol = node.secure ? https : http;
        const port = node.port || (node.secure ? 443 : 2333);
        const options = {
          hostname: node.host,
          port,
          path: "/v4/info",
          method: "GET",
          headers: {
            Authorization: node.password || "youshallnotpass",
            "User-Agent": "Naura-Hoshino-Audio/3.1",
          },
          timeout: 4000,
        };

        const req = protocol.request(options, (res) => {
          let body = "";
          res.on("data", (chunk) => (body += chunk));
          res.on("end", () => {
            try {
              if (res.statusCode >= 200 && res.statusCode < 300) {
                const info = JSON.parse(body);
                const plugins = Array.isArray(info.plugins)
                  ? info.plugins.map((p) => (p.name || "").toLowerCase())
                  : [];
                const hasLavaSrc = plugins.some((p) => p.includes("lavasrc"));
                const hasYoutube =
                  plugins.some((p) => p.includes("youtube")) ||
                  (Array.isArray(info.sourceManagers) &&
                    info.sourceManagers.includes("youtube"));

                const caps = {
                  version: info.version?.semver || "4.x",
                  hasLavaSrc,
                  hasYoutube,
                  hasSpotify: hasLavaSrc,
                  plugins,
                  filters: Array.isArray(info.filters) ? info.filters : [],
                };

                this.nodeCapabilities.set(node.name, caps);
                logger.info(
                  `✨ [LavalinkClusterManager] Node "${node.name}" terverifikasi (v${caps.version}, LavaSrc: ${hasLavaSrc ? "YA" : "TIDAK"}, YT: ${hasYoutube ? "YA" : "TIDAK"}).`,
                );
                return resolve(caps);
              }
            } catch (_) {}
            resolve(null);
          });
        });

        req.on("error", () => resolve(null));
        req.on("timeout", () => {
          req.destroy();
          resolve(null);
        });
        req.end();
      } catch (_) {
        resolve(null);
      }
    });
  }

  /**
   * Ambil kapabilitas node yang tersimpan.
   * @param {string} nodeName
   * @returns {object|null}
   */
  getCapabilities(nodeName) {
    return this.nodeCapabilities.get(nodeName) || null;
  }

  /**
   * Pilih node Lavalink terbaik berdasarkan Tier, beban penalti, dan status karantina.
   * @param {object} poru - Instance Poru aktif
   * @param {object} [options]
   * @param {string} [options.excludeNode] - Abaikan node tertentu (misal saat migrasi failover)
   * @param {boolean} [options.requireLavaSrc] - Prioritaskan node yang mendukung LavaSrc
   * @returns {string|undefined} Nama node terpilih, atau undefined
   */
  getPreferredNode(poru, options = {}) {
    if (!poru || !poru.nodes) return undefined;

    const {
      excludeNode = null,
      requireLavaSrc = false,
      region = null,
    } = options;

    // Kumpulkan node yang terkoneksi dan tidak sedang di-karantina
    const connected = [...poru.nodes.values()].filter(
      (n) =>
        n.connected &&
        n.name !== excludeNode &&
        !this.isNodeQuarantined(n.name),
    );

    if (connected.length === 0) {
      // Fallback darurat jika semua node normal down: cari node yang connected apapun statusnya
      const emergency = [...poru.nodes.values()].filter(
        (n) => n.connected && n.name !== excludeNode,
      );
      return emergency[0]?.name;
    }

    // Kelompokkan node berdasarkan Tier (1, 2, 3)
    const tier1 = [];
    const tier2 = [];
    const tier3 = [];

    for (const node of connected) {
      const tier = this.nodeTiers.get(node.name) || 3;
      if (tier === 1) tier1.push(node);
      else if (tier === 2) tier2.push(node);
      else tier3.push(node);
    }

    // Sort helper: urutkan berdasarkan penalti beban, latensi ping RTT, dan kesesuaian wilayah
    const sortByLatencyAndPenalty = (list) => {
      list.sort((a, b) => {
        // Bila membutuhkan LavaSrc, utamakan yang memiliki LavaSrc
        if (requireLavaSrc) {
          const capA = this.nodeCapabilities.get(a.name)?.hasLavaSrc ? 1 : 0;
          const capB = this.nodeCapabilities.get(b.name)?.hasLavaSrc ? 1 : 0;
          if (capA !== capB) return capB - capA;
        }

        const latA = this.getNodeLatency(a.name);
        const latB = this.getNodeLatency(b.name);

        const hiFiA = this.hiFiNodes.get(a.name);
        const hiFiB = this.hiFiNodes.get(b.name);
        const regionMatchA =
          region && hiFiA?.region === String(region).toLowerCase() ? -40 : 0;
        const regionMatchB =
          region && hiFiB?.region === String(region).toLowerCase() ? -40 : 0;

        const scoreA = (a.penalties || 0) + latA + regionMatchA;
        const scoreB = (b.penalties || 0) + latB + regionMatchB;

        return scoreA - scoreB;
      });
      return list[0]?.name;
    };

    // Prioritaskan Tier 1 (Private Utama)
    if (tier1.length > 0) return sortByLatencyAndPenalty(tier1);

    // Jika Tier 1 down, gunakan Tier 2 (Private Sekunder)
    if (tier2.length > 0) return sortByLatencyAndPenalty(tier2);

    // Jika semua private down, gunakan Tier 3 (Public Fallback Pool)
    if (tier3.length > 0) {
      logger.warn(
        "[LavalinkClusterManager] Semua private node offline! Mengalihkan ke Public Fallback Node.",
      );
      return sortByLatencyAndPenalty(tier3);
    }

    return undefined;
  }

  /**
   * Migrasi sesi pemutaran audio aktif secara mulus saat sebuah node mengalami disconnect atau error.
   * @param {object} poru - Instance Poru aktif
   * @param {object} player - Player yang terdampak
   * @param {object} failedNode - Node yang mengalami kegagalan
   * @param {string} reason - Alasan migrasi
   * @returns {Promise<boolean>}
   */
  async migratePlayer(poru, player, failedNode, reason = "Node disconnect") {
    if (!player || !poru) return false;
    const guildId = player.guildId;

    // Cegah duplikasi eksekusi migrasi untuk guild yang sama
    if (this.migrationLocks.has(guildId)) return false;
    this.migrationLocks.add(guildId);

    try {
      logger.warn(
        `\x1b[43m\x1b[30m 🔄 AUDIO FAILOVER \x1b[0m Memulai migrasi player guild ${guildId} dari node "${failedNode?.name || "Unknown"}" (${reason})...`,
      );

      // 1. Ambil snapshot data pemutaran
      const currentTrack = player.currentTrack;
      const position = Math.max(0, player.position || 0);
      const queueTracks = player.queue ? [...player.queue] : [];
      const voiceChannel = player.voiceChannel;
      const textChannel = player.textChannel;
      const isLoop = player.loop;
      const volume = player.volume;

      if (!voiceChannel) {
        this.migrationLocks.delete(guildId);
        return false;
      }

      // 2. Pilih node pengganti yang sehat
      const targetNodeName = this.getPreferredNode(poru, {
        excludeNode: failedNode?.name,
      });

      if (!targetNodeName) {
        logger.error(
          `[LavalinkClusterManager] Gagal migrasi: Tidak ada node pengganti yang terhubung untuk guild ${guildId}.`,
        );
        this.migrationLocks.delete(guildId);
        return false;
      }

      logger.info(
        `✨ [LavalinkClusterManager] Memindahkan player guild ${guildId} ke node "${targetNodeName}"...`,
      );

      // 3. Bersihkan koneksi internal player lama tanpa menghancurkan data Discord
      try {
        if (typeof player.destroy === "function") {
          player.destroy();
        }
      } catch (_) {}

      // 4. Hubungkan ulang player ke node pengganti
      const newPlayer = poru.createConnection({
        guildId,
        voiceChannel,
        textChannel,
        deaf: true,
        node: targetNodeName,
      });

      if (!newPlayer) {
        this.migrationLocks.delete(guildId);
        return false;
      }

      // Pulihkan status antrean dan volume
      newPlayer.volume = volume;
      newPlayer.loop = isLoop;
      if (queueTracks.length > 0) {
        newPlayer.queue.add(queueTracks);
      }

      // 5. Lanjutkan pemutaran lagu tepat di posisi milidetik terakhir
      if (currentTrack) {
        newPlayer.queue.unshift(currentTrack);
        await newPlayer.play({ startTime: position });
        logger.info(
          `✨ [LavalinkClusterManager] Pemutaran lagu [${currentTrack.info?.title || "Track"}] berhasil dilanjutkan pada posisi ${Math.round(position / 1000)}s di node "${targetNodeName}".`,
        );
      }

      this.migrationLocks.delete(guildId);
      return true;
    } catch (err) {
      logger.error(
        `[LavalinkClusterManager] Eksepsi saat migrasi player guild ${guildId}:`,
        err,
      );
      this.migrationLocks.delete(guildId);
      return false;
    }
  }

  /**
   * Daftarkan node ke dalam Lossless Hi-Fi Federation pool.
   * @param {string} nodeName
   * @param {object} options
   * @param {string} [options.region="singapore"] - "singapore", "tokyo", "us-east", "frankfurt"
   * @param {boolean} [options.lossless=true]
   * @param {number} [options.maxBitrate=384000]
   * @param {string} [options.codec="FLAC/OPUS_HD"]
   */
  registerHiFiNode(nodeName, options = {}) {
    if (!nodeName) return;
    this.hiFiNodes.set(nodeName, {
      region: (options.region || "singapore").toLowerCase(),
      lossless: options.lossless !== false,
      maxBitrate: options.maxBitrate || 384000,
      codec: options.codec || "FLAC/OPUS_HD",
    });
  }

  /**
   * Mengatur mode kualitas audio per guild.
   * @param {string} guildId
   * @param {string} quality - "standard" | "hd" | "lossless"
   */
  setGuildAudioQuality(guildId, quality = "hd") {
    if (!guildId) return;
    const q = ["standard", "hd", "lossless"].includes(quality) ? quality : "hd";
    this.guildAudioQualities.set(guildId, q);
  }

  /**
   * Mengambil mode kualitas audio guild.
   * @param {string} guildId
   * @returns {string}
   */
  getGuildAudioQuality(guildId) {
    if (!guildId) return "hd";
    return this.guildAudioQualities.get(guildId) || "hd";
  }

  /**
   * Memilih node Hi-Fi terbaik dengan auto-balancing geografis.
   * @param {object} poru
   * @param {string} preferredRegion
   * @returns {string|undefined}
   */
  getOptimalHiFiNode(poru, preferredRegion = "singapore") {
    if (!poru || !poru.nodes) return undefined;
    const region = (preferredRegion || "singapore").toLowerCase();

    const connectedNodes = [...poru.nodes.values()].filter(
      (n) => n.connected && !this.isNodeQuarantined(n.name),
    );

    // Cari node Hi-Fi yang cocok dengan wilayah geografis
    const matchingRegion = connectedNodes.filter((n) => {
      const hiFi = this.hiFiNodes.get(n.name);
      return hiFi && hiFi.region === region && hiFi.lossless;
    });

    if (matchingRegion.length > 0) {
      matchingRegion.sort((a, b) => (a.penalties || 0) - (b.penalties || 0));
      return matchingRegion[0].name;
    }

    // Fallback: Node Hi-Fi aktif di wilayah mana pun
    const anyHiFi = connectedNodes.filter((n) => {
      const hiFi = this.hiFiNodes.get(n.name);
      return hiFi && hiFi.lossless;
    });

    if (anyHiFi.length > 0) {
      anyHiFi.sort((a, b) => (a.penalties || 0) - (b.penalties || 0));
      return anyHiFi[0].name;
    }

    // Fallback terakhir: Preferred standard node
    return this.getPreferredNode(poru);
  }

  /**
   * Mengukur Round-Trip Time (RTT latency) ke node Lavalink
   * @param {object} node
   * @returns {Promise<number>}
   */
  async measureNodeLatency(node) {
    if (!node || !node.host) return 999;
    const protocol = node.secure ? https : http;
    const startTime = Date.now();
    return new Promise((resolve) => {
      const req = protocol.request(
        {
          hostname: node.host,
          port: node.port || (node.secure ? 443 : 2333),
          path: "/version",
          method: "GET",
          headers: {
            Authorization: node.password || "youshallnotpass",
          },
          timeout: 3000,
        },
        (res) => {
          res.resume();
          const latency = Math.max(1, Date.now() - startTime);
          this.nodeLatencies.set(node.name, {
            latencyMs: latency,
            timestamp: Date.now(),
          });
          resolve(latency);
        },
      );
      req.on("error", () => {
        const fallbackLat = 999;
        this.nodeLatencies.set(node.name, {
          latencyMs: fallbackLat,
          timestamp: Date.now(),
        });
        resolve(fallbackLat);
      });
      req.on("timeout", () => {
        req.destroy();
        const fallbackLat = 999;
        this.nodeLatencies.set(node.name, {
          latencyMs: fallbackLat,
          timestamp: Date.now(),
        });
        resolve(fallbackLat);
      });
      req.end();
    });
  }

  /**
   * Mengambil estimasi latensi ping untuk node tertentu
   * @param {string} nodeName
   * @returns {number}
   */
  getNodeLatency(nodeName) {
    if (!nodeName) return 50;
    const record = this.nodeLatencies.get(nodeName);
    return record?.latencyMs || 50;
  }

  /**
   * Menjalankan pengukuran latensi ke seluruh node aktif
   * @param {object} poru
   * @returns {Promise<Map<string, number>>}
   */
  async probeNodeLatencies(poru) {
    const results = new Map();
    if (!poru || !poru.nodes) return results;

    const probePromises = [...poru.nodes.values()].map(async (node) => {
      if (!node.connected) return;
      const lat = await this.measureNodeLatency(node);
      results.set(node.name, lat);

      if (lat >= 990) {
        const fails = (this.heartbeatFailures.get(node.name) || 0) + 1;
        this.heartbeatFailures.set(node.name, fails);
        if (fails >= 3) {
          logger.warn(
            `[LavalinkClusterManager] Node "${node.name}" mengalami 3x heartbeat timeout berturut-turut. Mengaktifkan auto-recover failover...`,
          );
          this.recordFailure(
            node.name,
            new Error("Heartbeat timeout (Socket Unresponsive)"),
          );
          if (poru.players) {
            for (const player of poru.players.values()) {
              if (player && player.node && player.node.name === node.name) {
                this.migratePlayer(player, poru).catch(() => {});
              }
            }
          }
        }
      } else {
        this.heartbeatFailures.set(node.name, 0);
      }
    });

    await Promise.allSettled(probePromises);
    return results;
  }

  /**
   * Memulai probe ping periodik setiap 30 detik (Multi-Region Geo-Federation)
   * @param {object} poru
   * @param {number} [intervalMs=30000]
   */
  startPingProber(poru, intervalMs = 30000) {
    if (this.pingInterval) return;
    this.probeNodeLatencies(poru).catch(() => {});
    this.pingInterval = setInterval(() => {
      this.probeNodeLatencies(poru).catch(() => {});
    }, intervalMs);
    if (this.pingInterval.unref) this.pingInterval.unref();
  }

  /**
   * Menghentikan probe ping periodik
   */
  stopPingProber() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Mengambil status telemetri Hi-Fi Node Federation.
   * @param {object} poru
   * @returns {object}
   */
  getFederationStatus(poru) {
    const nodes = poru && poru.nodes ? [...poru.nodes.values()] : [];
    const totalConnected = nodes.filter((n) => n.connected).length;
    const registeredHiFi = [];

    for (const [name, meta] of this.hiFiNodes.entries()) {
      const liveNode = nodes.find((n) => n.name === name);
      registeredHiFi.push({
        name,
        connected: liveNode ? liveNode.connected : false,
        region: meta.region,
        maxBitrate: meta.maxBitrate,
        codec: meta.codec,
        lossless: meta.lossless,
      });
    }

    return {
      totalNodes: nodes.length,
      connectedNodes: totalConnected,
      hiFiNodes: registeredHiFi,
      supportedCodecs: ["FLAC 24-bit", "OPUS 384kbps HD", "PCM Stereo"],
    };
  }
}

// Singleton Instance
const lavalinkClusterManager = new LavalinkClusterManager();

module.exports = {
  lavalinkClusterManager,
  LavalinkClusterManager,
};
