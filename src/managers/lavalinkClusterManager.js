"use strict";

/**
 * lavalinkClusterManager.js - Pengendali Kluster Node Lavalink Adaptif dan Resilien.
 *
 * Modul ini mengintegrasikan komponen modular dari ./lavalink/:
 *   - CircuitBreakerManager: State machine untuk fault tolerance (CLOSED -> OPEN -> HALF_OPEN)
 *   - NodeSelector: Seleksi node tiered dengan capability discovery dan Hi-Fi federation
 *   - PlayerMigrator: Migrasi player zero-drop saat node failure
 *
 * Fitur Utama:
 *   1. Tiered Node Orchestration (Private -> Public Fallback)
 *   2. Server Capability Discovery via REST /v4/info
 *   3. Circuit Breaker dan Node Quarantine (5 menit isolasi otomatis)
 *   4. Zero-Drop Player Migration (migrasi tanpa putus voice)
 *   5. Self-Healing Health Probe (deteksi anomali packet drop dan latensi)
 *   6. Hi-Fi Lossless Federation (multi-region geo-balancing)
 *   7. Shard Autoscaler Evaluator (prediksi bottleneck dan rekomendasi skala)
 *
 * @module src/managers/lavalinkClusterManager
 */

const http = require("http");
const https = require("https");
const { logger } = require("./logger");
const { ExternalAPIError } = require("../errors/DomainError");

// Import modular components
const { CircuitBreakerManager } = require("./lavalink/circuitBreaker");
const { NodeSelector, LATENCY_THRESHOLDS } = require("./lavalink/nodeSelector");
const { PlayerMigrator } = require("./lavalink/playerMigrator");

// ============================================================================
// LAVALINK CLUSTER MANAGER CLASS
// ============================================================================

class LavalinkClusterManager {
  constructor() {
    // Initialize modular components with dependency injection
    this.circuitBreaker = new CircuitBreakerManager();
    this.nodeSelector = new NodeSelector(this.circuitBreaker);
    this.playerMigrator = new PlayerMigrator(this.nodeSelector);

    // Internal state for health monitoring
    this.heartbeatFailures = new Map();
    this.pingInterval = null;
    this.healthProbeInterval = null;
    this._poru = null;
  }

  get nodeTiers() {
    return this.nodeSelector.nodeTiers;
  }

  set nodeTiers(val) {
    this.nodeSelector.nodeTiers = val;
  }

  get nodeLatencies() {
    return this.nodeSelector.nodeLatencies;
  }

  set nodeLatencies(val) {
    this.nodeSelector.nodeLatencies = val;
  }

  get hiFiNodes() {
    return this.nodeSelector.hiFiNodes;
  }

  set hiFiNodes(val) {
    this.nodeSelector.hiFiNodes = val;
  }

  get nodeCapabilities() {
    return this.nodeSelector.nodeCapabilities;
  }

  set nodeCapabilities(val) {
    this.nodeSelector.nodeCapabilities = val;
  }

  get guildAudioQualities() {
    return this.nodeSelector.guildAudioQualities;
  }

  set guildAudioQualities(val) {
    this.nodeSelector.guildAudioQualities = val;
  }

  get circuitBreakers() {
    return this.circuitBreaker.circuitBreakers;
  }

  set circuitBreakers(val) {
    this.circuitBreaker.circuitBreakers = val;
  }

  get quarantinedNodes() {
    return this.circuitBreaker.quarantinedNodes;
  }

  set quarantinedNodes(val) {
    this.circuitBreaker.quarantinedNodes = val;
  }

  // ============================================================================
  // DELEGATED METHODS - Circuit Breaker
  // ============================================================================

  /**
   * Catat kegagalan/error pada node dan evaluasi Circuit Breaker.
   * @param {string} nodeName
   * @param {Error|string} error
   */
  recordNodeError(nodeName, error) {
    return this.circuitBreaker.recordNodeError(nodeName, error);
  }

  /**
   * Catat kegagalan node (alias untuk recordNodeError).
   * @param {string} nodeName
   * @param {Error|string} [error]
   */
  recordFailure(nodeName, error) {
    return this.circuitBreaker.recordFailure(nodeName, error);
  }

  /**
   * Catat keberhasilan koneksi / pemutaran pada node (reset circuit breaker).
   * @param {string} nodeName
   */
  recordNodeSuccess(nodeName) {
    return this.circuitBreaker.recordNodeSuccess(nodeName);
  }

  /**
   * Cek apakah node sedang dalam masa isolasi karantina.
   * @param {string} nodeName
   * @returns {boolean}
   */
  isNodeQuarantined(nodeName) {
    return this.circuitBreaker.isNodeQuarantined(nodeName);
  }

  // ============================================================================
  // DELEGATED METHODS - Node Selector
  // ============================================================================

  /**
   * Muat daftar node publik terverifikasi dari config atau fallback lokal.
   * @returns {Array<object>}
   */
  loadPublicFallbackNodes() {
    return this.nodeSelector.loadPublicFallbackNodes();
  }

  /**
   * Susun seluruh node berjenjang: gabungkan node private pengguna dengan pool publik.
   * @param {Array<object>} configuredPrivateNodes - Node yang dibaca dari .env
   * @returns {Array<object>}
   */
  buildTieredNodeList(configuredPrivateNodes = []) {
    return this.nodeSelector.buildTieredNodeList(configuredPrivateNodes);
  }

  /**
   * Probe kapabilitas server via GET /v4/info.
   * @param {object} node - Objek Node Poru
   * @returns {Promise<object|null>}
   */
  async probeNodeCapabilities(node) {
    return this.nodeSelector.probeNodeCapabilities(node);
  }

  /**
   * Ambil kapabilitas node yang tersimpan.
   * @param {string} nodeName
   * @returns {object|null}
   */
  getCapabilities(nodeName) {
    return this.nodeSelector.getCapabilities(nodeName);
  }

  /**
   * Pilih node Lavalink terbaik berdasarkan Tier, beban penalti, dan status karantina.
   * @param {object} poru - Instance Poru aktif
   * @param {object} [options]
   * @param {string} [options.excludeNode] - Abaikan node tertentu
   * @param {boolean} [options.requireLavaSrc] - Prioritaskan node dengan LavaSrc
   * @param {string} [options.region] - Wilayah geografis preferensi
   * @returns {string|undefined}
   */
  getPreferredNode(poru, options = {}) {
    return this.nodeSelector.getPreferredNode(poru, options);
  }

  /**
   * Daftarkan node ke dalam Lossless Hi-Fi Federation pool.
   * @param {string} nodeName
   * @param {object} options
   * @param {string} [options.region="singapore"]
   * @param {boolean} [options.lossless=true]
   * @param {number} [options.maxBitrate=384000]
   * @param {string} [options.codec="FLAC/OPUS_HD"]
   */
  registerHiFiNode(nodeName, options = {}) {
    return this.nodeSelector.registerHiFiNode(nodeName, options);
  }

  /**
   * Mengatur mode kualitas audio per guild.
   * @param {string} guildId
   * @param {string} quality - "standard" | "hd" | "lossless"
   */
  setGuildAudioQuality(guildId, quality = "hd") {
    return this.nodeSelector.setGuildAudioQuality(guildId, quality);
  }

  /**
   * Mengambil mode kualitas audio guild.
   * @param {string} guildId
   * @returns {string}
   */
  getGuildAudioQuality(guildId) {
    return this.nodeSelector.getGuildAudioQuality(guildId);
  }

  /**
   * Memilih node Hi-Fi terbaik dengan auto-balancing geografis.
   * @param {object} poru
   * @param {string} preferredRegion
   * @returns {string|undefined}
   */
  getOptimalHiFiNode(poru, preferredRegion = "singapore") {
    const result = this.nodeSelector.getOptimalHiFiNode(poru, preferredRegion);
    if (result) return result;
    return this.getPreferredNode(poru);
  }

  /**
   * Mengambil estimasi latensi ping untuk node tertentu.
   * @param {string} nodeName
   * @returns {number}
   */
  getNodeLatency(nodeName) {
    const latency = this.nodeSelector.getNodeLatency(nodeName);
    return latency || 50;
  }

  // ============================================================================
  // DELEGATED METHODS - Player Migrator
  // ============================================================================

  /**
   * Migrasi sesi pemutaran audio aktif secara mulus saat node mengalami disconnect.
   * @param {object} poru - Instance Poru aktif
   * @param {object} player - Player yang terdampak
   * @param {object} failedNode - Node yang mengalami kegagalan
   * @param {string} reason - Alasan migrasi
   * @returns {Promise<boolean>}
   */
  async migratePlayer(poru, player, failedNode, reason = "Node disconnect") {
    return this.playerMigrator.migratePlayer(poru, player, failedNode, reason);
  }

  // ============================================================================
  // HEALTH MONITORING METHODS
  // ============================================================================

  /**
   * Mengukur Round-Trip Time (RTT latency) ke node Lavalink.
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
          this.nodeSelector.updateNodeLatency(node.name, latency);
          resolve(latency);
        },
      );

      req.on("error", () => {
        const fallbackLat = 999;
        this.nodeSelector.updateNodeLatency(node.name, fallbackLat);
        resolve(fallbackLat);
      });

      req.on("timeout", () => {
        req.destroy();
        const fallbackLat = 999;
        this.nodeSelector.updateNodeLatency(node.name, fallbackLat);
        resolve(fallbackLat);
      });

      req.end();
    });
  }

  /**
   * Menjalankan pengukuran latensi ke seluruh node aktif.
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
          this.recordFailure(node.name, new ExternalAPIError("Heartbeat timeout (Socket Unresponsive)"));

          if (poru.players) {
            for (const player of poru.players.values()) {
              if (player && player.node && player.node.name === node.name) {
                this.migratePlayer(poru, player, node, "Heartbeat timeout (Socket Unresponsive)").catch(() => {});
              }
            }
          }
        }
      } else {
        this.heartbeatFailures.set(node.name, 0);
        const cbState = this.circuitBreaker.getState(node.name);
        if (cbState && cbState.state === "HALF_OPEN") {
          this.recordNodeSuccess(node.name);
          logger.info(
            `\x1b[43m\x1b[30m \ud83d\udd04 CIRCUIT BREAKER \x1b[0m Node "${node.name}" lulus uji pemulihan health probe. Kembali ke status CLOSED.`,
          );
        }
      }
    });

    await Promise.allSettled(probePromises);
    return results;
  }

  /**
   * Menghitung persentase packet drop (lost frames) pada node Lavalink.
   * @param {object} node
   * @returns {number} Persentase packet drop (0.00 - 100.00)
   */
  calculatePacketDropRate(node) {
    if (!node || !node.stats || !node.stats.frameStats) return 0;
    const { sent = 0, nulled = 0, deficit = 0 } = node.stats.frameStats;
    const lost = Number(nulled) + Number(deficit);
    const total = Number(sent) + lost;
    if (total <= 0) return 0;
    return Number(((lost / total) * 100).toFixed(2));
  }

  /**
   * Deteksi anomali packet drop (> 5%) atau latensi tinggi pada seluruh node,
   * dan jalankan migrasi failover otomatis (Self-Healing).
   * @param {object} poru
   * @param {number} [packetDropThreshold=5.0]
   * @returns {Promise<{ anomalies: Array<object>, migratedCount: number }>}
   */
  async detectPacketDropAnomalies(poru, packetDropThreshold = 5.0) {
    const anomalies = [];
    let migratedCount = 0;
    if (!poru || !poru.nodes) return { anomalies, migratedCount };

    const nodes = [...poru.nodes.values()].filter((n) => n.connected);

    for (const node of nodes) {
      const dropRate = this.calculatePacketDropRate(node);
      const latency = this.getNodeLatency(node.name);

      if (dropRate > packetDropThreshold || latency > LATENCY_THRESHOLDS.FAIR) {
        const reason =
          dropRate > packetDropThreshold
            ? `Packet drop anomali: ${dropRate}% (> ${packetDropThreshold}%)`
            : `Latensi anomali: ${latency}ms (> ${LATENCY_THRESHOLDS.FAIR}ms)`;

        logger.warn(
          `\x1b[41m\x1b[37m \ud83d\udea8 CLUSTER ANOMALY \x1b[0m Node "${node.name}" mengalami ${reason}. Memulai migrasi mandiri zero-downtime...`,
        );

        this.recordNodeError(node.name, new ExternalAPIError(reason));

        const affectedPlayers = [];
        if (poru.players) {
          for (const player of poru.players.values()) {
            const playerNodeName = player.node?.name || player.node;
            if (player && playerNodeName === node.name) {
              affectedPlayers.push(player);
            }
          }
        }

        for (const player of affectedPlayers) {
          try {
            const success = await this.migratePlayer(poru, player, node, reason);
            if (success) migratedCount++;
          } catch (migErr) {
            logger.error(`[LavalinkClusterManager] Gagal self-healing migrasi: ${migErr.message}`);
          }
        }

        anomalies.push({
          nodeName: node.name,
          dropRate,
          latency,
          reason,
          affectedCount: affectedPlayers.length,
          migratedCount,
        });
      }
    }

    return { anomalies, migratedCount };
  }

  /**
   * Memulai health probe otomatis berkala (Self-Healing Lavalink Cluster).
   * @param {object} poru
   * @param {number} [intervalMs=15000]
   */
  startHealthProbe(poru, intervalMs = 15000) {
    if (this.healthProbeInterval) return;
    this.detectPacketDropAnomalies(poru).catch(() => {});
    this.healthProbeInterval = setInterval(() => {
      this.probeNodeLatencies(poru).catch(() => {});
      this.detectPacketDropAnomalies(poru).catch(() => {});
    }, intervalMs);
    if (this.healthProbeInterval.unref) this.healthProbeInterval.unref();
    logger.info(`[LavalinkClusterManager] Self-Healing Health Probe diaktifkan (${intervalMs}ms).`);
  }

  /**
   * Menghentikan health probe otomatis.
   */
  stopHealthProbe() {
    if (this.healthProbeInterval) {
      clearInterval(this.healthProbeInterval);
      this.healthProbeInterval = null;
    }
  }

  // ============================================================================
  // SHARD AUTOSCALER EVALUATOR
  // ============================================================================

  /**
   * Evaluator Prediktif Shard Autoscaler:
   * Menganalisis telemetri shard untuk deteksi bottleneck dan rekomendasi penskalaan.
   * @param {Array<object>} shardsTelemetry - [{ id, status, ping, guilds, memoryUsage }]
   * @returns {object} Status kesehatan shard dan rekomendasi skala
   */
  evaluateShardHealth(shardsTelemetry = []) {
    if (!Array.isArray(shardsTelemetry) || shardsTelemetry.length === 0) {
      return {
        healthy: true,
        bottleneckDetected: false,
        recommendedShards: 1,
        details: [],
      };
    }

    let totalGuilds = 0;
    let highPingCount = 0;
    let disconnectedCount = 0;
    const details = [];

    for (const s of shardsTelemetry) {
      const ping = Number(s.ping) || 0;
      const guilds = Number(s.guilds) || 0;
      const status = s.status || "READY";
      totalGuilds += guilds;

      const isHighPing = ping > 250;
      const isDisconnected = status === "DISCONNECTED" || status === "RECONNECTING";

      if (isHighPing) highPingCount++;
      if (isDisconnected) disconnectedCount++;

      details.push({
        id: s.id,
        ping,
        guilds,
        status,
        hasBottleneck: isHighPing || isDisconnected || guilds > 1500,
      });
    }

    const calculatedShardDemand = Math.max(1, Math.ceil(totalGuilds / 1200));
    const bottleneckDetected =
      highPingCount > 0 || disconnectedCount > 0 || details.some((d) => d.guilds > 1500);

    const recommendedShards = bottleneckDetected
      ? Math.max(shardsTelemetry.length + 1, calculatedShardDemand)
      : calculatedShardDemand;

    return {
      healthy: !bottleneckDetected && disconnectedCount === 0,
      bottleneckDetected,
      totalGuilds,
      totalCurrentShards: shardsTelemetry.length,
      recommendedShards,
      highPingShards: highPingCount,
      disconnectedShards: disconnectedCount,
      details,
    };
  }

  // ============================================================================
  // PING PROBER (Multi-Region Geo-Federation)
  // ============================================================================

  /**
   * Memulai probe ping periodik setiap 30 detik.
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
   * Menghentikan probe ping periodik.
   */
  stopPingProber() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  // ============================================================================
  // FEDERATION STATUS & TELEMETRY
  // ============================================================================

  /**
   * Mengambil status telemetri Hi-Fi Node Federation.
   * @param {object} poru
   * @returns {object}
   */
  getFederationStatus(poru) {
    const nodes = poru && poru.nodes ? [...poru.nodes.values()] : [];
    const totalConnected = nodes.filter((n) => n.connected).length;
    const registeredHiFi = [];

    for (const [name, meta] of this.nodeSelector.hiFiNodes.entries()) {
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

  /**
   * Set Poru instance reference.
   * @param {object} poru
   */
  setPoru(poru) {
    this._poru = poru;
  }

  /**
   * Cek apakah player atau server terdaftar dalam mode standby 24/7.
   * @param {string} guildId
   * @returns {boolean}
   */
  isStay24_7(guildId) {
    if (!guildId) return false;
    try {
      const container = require("../core/container");
      if (container && container.has("musicManager")) {
        const musicManager = container.resolve("musicManager");
        if (musicManager && typeof musicManager.isStay24_7 === "function") {
          return musicManager.isStay24_7(guildId);
        }
      }
    } catch (_) {}
    return false;
  }

  /**
   * Mengambil status kluster Lavalink untuk telemetri insiden / health check.
   * @param {object} [poru]
   * @returns {object}
   */
  getStatus(poru = null) {
    if (!poru) {
      poru = this._poru || null;
      if (!poru) {
        try {
          const container = require("../core/container");
          if (container && container.has("musicManager")) {
            poru = container.resolve("musicManager")?.poru || null;
          }
        } catch (_) {}
      }
    }
    const nodes = poru && poru.nodes ? [...poru.nodes.values()] : [];
    const totalConnected = nodes.filter((n) => n.connected).length;
    return {
      totalNodes: nodes.length,
      connectedNodes: totalConnected,
      circuitBreakers: Object.fromEntries(this.circuitBreaker.circuitBreakers),
      hiFiNodes: this.nodeSelector.hiFiNodes.size,
    };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

const lavalinkClusterManager = new LavalinkClusterManager();
lavalinkClusterManager.lavalinkClusterManager = lavalinkClusterManager;
lavalinkClusterManager.LavalinkClusterManager = LavalinkClusterManager;

module.exports = lavalinkClusterManager;
