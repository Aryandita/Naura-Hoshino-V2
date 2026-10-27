"use strict";

/**
 * 🎯 Node Selector - Lavalink Cluster - Naura Hoshino V2
 * ------------------------------------------------------
 * Handles tiered node selection with capability discovery and Hi-Fi federation.
 * Implements multi-tier priority selection with latency-based sorting.
 *
 * @module src/managers/lavalink/nodeSelector
 */

const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");
const { logger } = require("../logger");
const { logWithBanner } = require("../../utils/loggerBanner");

// ============================================================================
// CONSTANTS
// ============================================================================

/** Node tier definitions */
const NODE_TIERS = {
  PRIMARY: 1,       // Private main node (lowest latency)
  SECONDARY: 2,     // Private backup node
  FALLBACK: 3,      // Public fallback pool
};

/** Latency thresholds for node quality assessment */
const LATENCY_THRESHOLDS = {
  EXCELLENT: 100,   // < 100ms - optimal
  GOOD: 200,        // < 200ms - acceptable
  FAIR: 450,        // < 450ms - usable (threshold for warnings)
  POOR: Infinity,   // > 450ms - degraded
};

/** Maximum guilds per node before load balancing kicks in */
const MAX_GUILDS_PER_NODE = 1500;

/** Region bonus for Hi-Fi node selection (ms penalty reduction) */
const REGION_MATCH_BONUS = -40;

// ============================================================================
// NODE SELECTOR CLASS
// ============================================================================

/**
 * Manages node selection, capability discovery, and Hi-Fi federation.
 */
class NodeSelector {
  /**
   * @param {import('./circuitBreaker').CircuitBreakerManager} circuitBreaker - CB manager instance
   */
  constructor(circuitBreaker) {
    this.circuitBreaker = circuitBreaker;

    /** @type {Map<string, number>} Node name → tier number */
    this.nodeTiers = new Map();

    /** @type {Map<string, NodeCapabilities>} Node name → capabilities */
    this.nodeCapabilities = new Map();

    /** @type {Map<string, HiFiConfig>} Node name → Hi-Fi configuration */
    this.hiFiNodes = new Map();

    /** @type {Map<string, GuildQuality>} Guild ID → audio quality preference */
    this.guildAudioQualities = new Map();

    /** @type {Map<string, LatencyRecord>} Node name → latency measurement */
    this.nodeLatencies = new Map();
  }

  /**
   * Load public fallback nodes from config file or hardcoded defaults.
   * @returns {Array<NodeConfig>} Array of public node configurations
   */
  loadPublicFallbackNodes() {
    const configPath = path.join(__dirname, "../../config/lavalink-fallbacks.json");

    if (fs.existsSync(configPath)) {
      try {
        const content = fs.readFileSync(configPath, "utf8");
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {
        logger.warn(`[NodeSelector] Failed to read lavalink-fallbacks.json: ${e.message}`);
      }
    }

    // Hardcoded fallback if config file unavailable
    return [
      {
        name: "Millohost Public Node",
        host: "lava-v4.millohost.my.id",
        port: 443,
        password: "https://discord.gg/mjS5J2K3ep",
        secure: true,
        tier: NODE_TIERS.FALLBACK,
        isPrimaryFallback: true,
      },
      {
        name: "Serenetia Public Node",
        host: "lavalinkv4.serenetia.com",
        port: 443,
        password: "https://seretia.link/discord",
        secure: true,
        tier: NODE_TIERS.FALLBACK,
        isPrimaryFallback: false,
      },
    ];
  }

  /**
   * Build complete tiered node list combining private and public nodes.
   * @param {Array<NodeConfig>} configuredPrivateNodes - Nodes from .env config
   * @returns {Array<NodeConfig>} Complete node list with tiers assigned
   */
  buildTieredNodeList(configuredPrivateNodes = []) {
    const finalNodes = [];
    const seen = new Set();

    // Register private nodes (Tier 1 & 2)
    configuredPrivateNodes.forEach((node, idx) => {
      const key = `${node.host}:${node.port}`.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        const tier = idx === 0 ? NODE_TIERS.PRIMARY : NODE_TIERS.SECONDARY;
        this.nodeTiers.set(node.name, tier);
        finalNodes.push({ ...node, tier, isFallback: false });
      }
    });

    // Always register public fallback nodes (Tier 3)
    const publicNodes = this.loadPublicFallbackNodes();
    for (const pub of publicNodes) {
      const key = `${pub.host}:${pub.port}`.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        this.nodeTiers.set(pub.name, NODE_TIERS.FALLBACK);
        finalNodes.push({
          name: pub.name,
          host: String(pub.host).trim(),
          port: parseInt(pub.port, 10) || 443,
          password: String(pub.password).trim(),
          secure: pub.secure === true,
          tier: NODE_TIERS.FALLBACK,
          isFallback: true,
        });
      }
    }

    logWithBanner(
      "info",
      "🎵 AUDIO CLUSTER",
      `Registered ${finalNodes.length} Lavalink nodes (${configuredPrivateNodes.length} Private, ${finalNodes.length - configuredPrivateNodes.length} Public Fallback).`,
    );

    return finalNodes;
  }

  /**
   * Probe node capabilities via REST /v4/info endpoint.
   * Detects LavaSrc plugin, YouTube source, and DSP filters.
   * @param {NodeConfig} node - Node configuration object
   * @returns {Promise<NodeCapabilities|null>} Capabilities or null on failure
   */
  async probeNodeCapabilities(node) {
    if (!node || !node.host) return null;

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
                  (Array.isArray(info.sourceManagers) && info.sourceManagers.includes("youtube"));

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
                  `✨ [NodeSelector] Node "${node.name}" verified (v${caps.version}, LavaSrc: ${hasLavaSrc ? "YES" : "NO"}, YT: ${hasYoutube ? "YES" : "NO"}).`,
                );
                return resolve(caps);
              }
            } catch (err) {
              logger.debug(`[NodeSelector:probeNodeCapabilities] Parse failed: ${err?.message || err}`);
            }
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
   * Get stored capabilities for a node.
   * @param {string} nodeName - Node identifier
   * @returns {NodeCapabilities|null}
   */
  getCapabilities(nodeName) {
    return this.nodeCapabilities.get(nodeName) || null;
  }

  /**
   * Select best available node based on tier priority, latency, and requirements.
   *
   * Selection Algorithm:
   * 1. Filter connected nodes not in quarantine
   * 2. Group by tier (1 → 2 → 3)
   * 3. Sort each tier by: LavaSrc capability → latency → region match → penalties
   * 4. Return first node from highest available tier
   *
   * @param {object} poru - Poru instance with nodes map
   * @param {SelectionOptions} [options={}] - Selection criteria
   * @returns {string|undefined} Selected node name or undefined if none available
   */
  getPreferredNode(poru, options = {}) {
    if (!poru || !poru.nodes) return undefined;

    const { excludeNode = null, requireLavaSrc = false, region = null } = options;

    // Collect connected, non-quarantined nodes
    const connected = [...poru.nodes.values()].filter(
      (n) => n.connected && n.name !== excludeNode && !this.circuitBreaker.isNodeQuarantined(n.name),
    );

    if (connected.length === 0) {
      // Emergency fallback: any connected node regardless of quarantine
      const emergency = [...poru.nodes.values()].filter(
        (n) => n.connected && n.name !== excludeNode,
      );
      return emergency[0]?.name;
    }

    // Group nodes by tier
    const tier1 = [];
    const tier2 = [];
    const tier3 = [];

    for (const node of connected) {
      const tier = this.nodeTiers.get(node.name) || NODE_TIERS.FALLBACK;
      if (tier === NODE_TIERS.PRIMARY) tier1.push(node);
      else if (tier === NODE_TIERS.SECONDARY) tier2.push(node);
      else tier3.push(node);
    }

    // Sort helper: prioritize by capability, latency, region match, then penalties
    const sortByLatencyAndPenalty = (list) => {
      list.sort((a, b) => {
        // Prioritize LavaSrc if required
        if (requireLavaSrc) {
          const capA = this.nodeCapabilities.get(a.name)?.hasLavaSrc ? 1 : 0;
          const capB = this.nodeCapabilities.get(b.name)?.hasLavaSrc ? 1 : 0;
          if (capA !== capB) return capB - capA;
        }

        const latA = this.getNodeLatency(a.name);
        const latB = this.getNodeLatency(b.name);

        // Region match bonus for Hi-Fi nodes
        const hiFiA = this.hiFiNodes.get(a.name);
        const hiFiB = this.hiFiNodes.get(b.name);
        const regionMatchA = region && hiFiA?.region === String(region).toLowerCase() ? REGION_MATCH_BONUS : 0;
        const regionMatchB = region && hiFiB?.region === String(region).toLowerCase() ? REGION_MATCH_BONUS : 0;

        const scoreA = (a.penalties || 0) + latA + regionMatchA;
        const scoreB = (b.penalties || 0) + latB + regionMatchB;

        return scoreA - scoreB;
      });
      return list[0]?.name;
    };

    // Priority: Tier 1 → Tier 2 → Tier 3
    if (tier1.length > 0) return sortByLatencyAndPenalty(tier1);
    if (tier2.length > 0) return sortByLatencyAndPenalty(tier2);

    if (tier3.length > 0) {
      logger.warn("[NodeSelector] All private nodes offline! Falling back to Public Fallback Pool.");
      return sortByLatencyAndPenalty(tier3);
    }

    return undefined;
  }

  /**
   * Get measured latency for a node.
   * @param {string} nodeName - Node identifier
   * @returns {number} Latency in ms (default 0 if unknown)
   */
  getNodeLatency(nodeName) {
    const record = this.nodeLatencies.get(nodeName);
    return record?.latencyMs || 0;
  }

  /**
   * Update latency measurement for a node.
   * @param {string} nodeName - Node identifier
   * @param {number} latencyMs - Measured RTT in milliseconds
   */
  updateNodeLatency(nodeName, latencyMs) {
    this.nodeLatencies.set(nodeName, {
      latencyMs,
      timestamp: Date.now(),
    });
  }

  /**
   * Register a node as Hi-Fi capable with lossless audio support.
   * @param {string} nodeName - Node identifier
   * @param {HiFiOptions} [options={}] - Hi-Fi configuration
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
   * Set audio quality preference for a guild.
   * @param {string} guildId - Guild identifier
   * @param {'standard'|'hd'|'lossless'} quality - Quality level
   */
  setGuildAudioQuality(guildId, quality = "hd") {
    if (!guildId) return;
    const validQualities = ["standard", "hd", "lossless"];
    const q = validQualities.includes(quality) ? quality : "hd";
    this.guildAudioQualities.set(guildId, q);
  }

  /**
   * Get audio quality preference for a guild.
   * @param {string} guildId - Guild identifier
   * @returns {'standard'|'hd'|'lossless'}
   */
  getGuildAudioQuality(guildId) {
    if (!guildId) return "hd";
    return this.guildAudioQualities.get(guildId) || "hd";
  }

  /**
   * Select optimal Hi-Fi node with geographic auto-balancing.
   * @param {object} poru - Poru instance
   * @param {string} preferredRegion - Preferred region code
   * @returns {string|undefined} Best Hi-Fi node name
   */
  getOptimalHiFiNode(poru, preferredRegion = "singapore") {
    if (!poru || !poru.nodes) return undefined;

    const region = (preferredRegion || "singapore").toLowerCase();

    const connectedNodes = [...poru.nodes.values()].filter(
      (n) => n.connected && !this.circuitBreaker.isNodeQuarantined(n.name),
    );

    // Find Hi-Fi nodes matching requested region
    const matchingRegion = connectedNodes.filter((n) => {
      const hiFi = this.hiFiNodes.get(n.name);
      return hiFi && hiFi.region === region && hiFi.lossless;
    });

    if (matchingRegion.length > 0) {
      // Sort by latency within matching region
      matchingRegion.sort((a, b) => {
        const latA = this.getNodeLatency(a.name);
        const latB = this.getNodeLatency(b.name);
        return latA - latB;
      });
      return matchingRegion[0].name;
    }

    // Fallback: any lossless Hi-Fi node if no region match
    const anyLossless = connectedNodes.filter((n) => {
      const hiFi = this.hiFiNodes.get(n.name);
      return hiFi && hiFi.lossless;
    });

    if (anyLossless.length > 0) {
      logger.info(`[NodeSelector] No Hi-Fi node in "${region}", using nearest lossless node.`);
      anyLossless.sort((a, b) => this.getNodeLatency(a.name) - this.getNodeLatency(b.name));
      return anyLossless[0].name;
    }

    return undefined;
  }
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * @typedef {Object} NodeConfig
 * @property {string} name - Node display name
 * @property {string} host - Hostname or IP
 * @property {number} port - Port number
 * @property {string} password - Authentication password
 * @property {boolean} secure - Use TLS/WSS
 * @property {number} tier - Tier level (1, 2, or 3)
 * @property {boolean} [isFallback] - Is public fallback node
 */

/**
 * @typedef {Object} NodeCapabilities
 * @property {string} version - Lavalink version
 * @property {boolean} hasLavaSrc - Supports LavaSrc plugin
 * @property {boolean} hasYoutube - Supports YouTube source
 * @property {boolean} hasSpotify - Supports Spotify (via LavaSrc)
 * @property {string[]} plugins - List of installed plugins
 * @property {string[]} filters - Available DSP filters
 */

/**
 * @typedef {Object} HiFiConfig
 * @property {string} region - Geographic region code
 * @property {boolean} lossless - Supports lossless audio
 * @property {number} maxBitrate - Maximum bitrate in bps
 * @property {string} codec - Supported codec format
 */

/**
 * @typedef {Object} LatencyRecord
 * @property {number} latencyMs - Round-trip time in milliseconds
 * @property {number} timestamp - Measurement timestamp
 */

/**
 * @typedef {Object} SelectionOptions
 * @property {string} [excludeNode] - Node to exclude from selection
 * @property {boolean} [requireLavaSrc] - Require LavaSrc capability
 * @property {string} [region] - Preferred geographic region
 */

/**
 * @typedef {'standard'|'hd'|'lossless'} GuildQuality
 */

/**
 * @typedef {Object} HiFiOptions
 * @property {string} [region='singapore'] - Geographic region
 * @property {boolean} [lossless=true] - Lossless support flag
 * @property {number} [maxBitrate=384000] - Max bitrate in bps
 * @property {string} [codec='FLAC/OPUS_HD'] - Codec format
 */

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  NodeSelector,
  NODE_TIERS,
  LATENCY_THRESHOLDS,
  MAX_GUILDS_PER_NODE,
};
