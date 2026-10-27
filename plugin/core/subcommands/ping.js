"use strict";

/**
 * 🏓 Ping Command - System Diagnostics - Naura Hoshino V2
 * --------------------------------------------------------
 * Performs comprehensive latency diagnostics across all Naura systems.
 * Tests connectivity to databases, APIs, audio nodes, and third-party services.
 *
 * Diagnostic Categories:
 * - Core Systems: Discord WebSocket, Roundtrip API, Event Loop
 * - Memory Systems: PostgreSQL, MongoDB, Redis
 * - Intelligence Systems: Gemini AI, Verba API
 * - Third-Party: Top.gg, Saweria, Trakteer
 * - Audio Systems: Lavalink cluster nodes
 *
 * @module plugin/core/subcommands/ping
 */

const { AttachmentBuilder } = require("discord.js");
const { sequelize } = require("../../../src/managers/dbManager");
const ui = require("../../../src/config/ui");
const { logger } = require("../../../src/managers/logger");
const {
  buildContainerV2,
  buildLoadingContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");
const { e, face, createNavButtons } = require("../helpers/coreShared");

// ============================================================================
// CONSTANTS
// ============================================================================

/** Timeout for external API health checks (ms) */
const API_TIMEOUT_MS = 3000;

/** External services to monitor */
const EXTERNAL_SERVICES = [
  { name: "Verba API", url: "https://api.verba.ink/" },
  { name: "Google Gemini", url: "https://generativelanguage.googleapis.com/" },
  { name: "Saweria Gateway", url: "https://saweria.co" },
  { name: "Trakteer Support", url: "https://trakteer.id" },
  { name: "Top.gg Portal", url: "https://top.gg" },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Measure latency of an async operation.
 * @param {Function} operation - Async function to measure
 * @returns {Promise<{success: boolean, latency: number}>}
 */
async function measureLatency(operation) {
  const start = Date.now();
  try {
    await operation();
    return { success: true, latency: Date.now() - start };
  } catch {
    return { success: false, latency: 0 };
  }
}

/**
 * Check HTTP endpoint health with timeout.
 * @param {string} url - Endpoint URL
 * @returns {Promise<{success: boolean, latency: number}>}
 */
async function checkHttpHealth(url) {
  const start = Date.now();
  try {
    const response = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    }).catch(() => null);

    if (response) {
      return { success: true, latency: Date.now() - start };
    }
    return { success: false, latency: 0 };
  } catch {
    return { success: false, latency: 0 };
  }
}

/**
 * Format ping result as Discord emoji + status text.
 * @param {boolean} online - Is service online
 * @param {number} latencyMs - Latency in milliseconds
 * @param {string} onlineEmoji - Online status emoji
 * @param {string} offlineEmoji - Offline status emoji
 * @returns {string} Formatted status string
 */
function formatPingStatus(online, latencyMs, onlineEmoji, offlineEmoji) {
  if (!online) return `${offlineEmoji} Offline`;
  return `${onlineEmoji} \`${latencyMs}ms\``;
}

/**
 * Build Lavalink node status list.
 * @param {object} musicManager - Music manager instance
 * @param {string} dot - Dot emoji
 * @param {string} online - Online emoji
 * @param {string} offline - Offline emoji
 * @returns {string} Formatted node list
 */
function buildLavalinkStatus(musicManager, dot, online, offline) {
  try {
    if (!musicManager?.poru) return `${offline} Offline`;

    const nodes = musicManager.poru.nodes;
    if (nodes.size === 0) {
      return `\n${dot} ${face("warning", "⚠️")} Standby (No active nodes)`;
    }

    const nodeLines = [];
    let index = 1;
    nodes.forEach((node) => {
      const status = node.isConnected
        ? `${online} Online (Active)`
        : `${offline} Offline (Inactive)`;
      nodeLines.push(`${dot} **${node.name || `Naura Node ${index}`}:** ${status}`);
      index++;
    });

    return "\n" + nodeLines.join("\n");
  } catch (err) {
    logger.debug(`[core:handlePing] Audio operation failed: ${err?.message || err}`);
    return `${offline} Error`;
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

/**
 * Handle /core ping command execution.
 * Measures latency across all system components and displays diagnostic report.
 * @param {object} interaction - Discord interaction
 * @param {object} client - Discord client
 * @param {object} lang - Language dictionary
 * @returns {Promise<void>}
 */
async function handlePing(interaction, client, lang) {
  // Get emojis
  const dot = e("dot", "▶️");
  const online = e("online", "🟢");
  const offline = e("offline", "🔴");

  // Send loading message
  const loadingPayload = buildLoadingContainerV2({
    authorName: "Naura Latency Diagnostic",
    title: "Measuring Latency...",
    loadingMessage: lang.PING_LOADING || "Contacting shards and Discord gateway...",
    footerText: `Preparing diagnostics for ${interaction.user.username}`,
    withBanner: true,
  });

  let sent;
  if (interaction.reply && !interaction.deferred) {
    sent = await interaction.reply({ ...loadingPayload, fetchReply: true });
  } else {
    sent = await interaction.editReply(loadingPayload);
  }

  // Measure core latencies
  const roundtripLatency =
    sent?.createdTimestamp && interaction?.createdTimestamp
      ? Math.max(0, sent.createdTimestamp - interaction.createdTimestamp)
      : 0;
  const websocketLatency = client.ws?.ping != null ? Math.round(client.ws.ping) : 0;

  // Measure event loop delay
  const loopStart = Date.now();
  await new Promise((resolve) => setImmediate(resolve));
  const eventLoopDelay = Date.now() - loopStart;

  // Check database connections
  const dbResult = await measureLatency(() => sequelize.query("SELECT 1"));
  const dbPing = formatPingStatus(dbResult.success, dbResult.latency, online, offline);

  // Check Redis cache
  let redisPing = `${offline} Offline`;
  try {
    const redisManager = require("../../../src/managers/redisManager");
    if (redisManager.client?.isReady) {
      const redisResult = await measureLatency(() => redisManager.client.ping());
      redisPing = formatPingStatus(redisResult.success, redisResult.latency, online, offline);
    }
  } catch {
    redisPing = `${offline} Error`;
  }

  // Check MongoDB
  let mongoPing = `${offline} Offline`;
  try {
    const mongoose = require("mongoose");
    if (mongoose.connection?.readyState === 1) {
      const mongoResult = await measureLatency(() =>
        mongoose.connection.db.admin().ping(),
      );
      mongoPing = formatPingStatus(mongoResult.success, mongoResult.latency, online, offline);
    }
  } catch {
    mongoPing = `${offline} Error`;
  }

  // Check Lavalink nodes
  const lavalinkStr = buildLavalinkStatus(client.musicManager, dot, online, offline);

  // Check external services in parallel
  const externalChecks = await Promise.all(
    EXTERNAL_SERVICES.map(async (service) => ({
      name: service.name,
      result: await checkHttpHealth(service.url),
    })),
  );

  // Format external service statuses
  const externalStatuses = {};
  for (const check of externalChecks) {
    externalStatuses[check.name] = formatPingStatus(
      check.result.success,
      check.result.latency,
      online,
      offline,
    );
  }

  // Get section emojis
  const ePingTitle = e("ping", "🏓");
  const eCoreSystem = e("network_ping", "🌐");
  const eEventLoop = e("eventloop", "⚡");
  const eMemorySystem = e("database_ping", "🗄️");
  const eIntellSystem = e("intelligence", "🧠");
  const eThirdPartySystem = e("saweria", "🔌");
  const eAudioSystem = e("help_music", "🎵");

  // Build diagnostic report
  const pingBanner = ui.getBanner("ping");

  const payload = buildContainerV2({
    accentColorHex: ui.getColor("primary"),
    authorName: "Naura Telemetry System",
    title: `${ePingTitle} System Diagnostics & Latency`,
    iconURL: client.user.displayAvatarURL(),
    description:
      lang.PING_DESC ||
      "Real-time monitoring of Naura Hoshino's internal network and API connections.",
    fields: [
      {
        name: `${eCoreSystem} Naura Core Systems`,
        value: `${dot} **Discord WS:** ${online} \`${websocketLatency}ms\`\n${dot} **Roundtrip API:** ${online} \`${roundtripLatency}ms\`\n${dot} **Event Loop Delay:** ${eEventLoop} \`${eventLoopDelay}ms\``,
      },
      {
        name: `${eMemorySystem} Naura Memory Systems (Polyglot DB)`,
        value: `${dot} **Supabase (PostgreSQL):** ${dbPing}\n${dot} **MongoDB Atlas:** ${mongoPing}\n${dot} **Redis Cache:** ${redisPing}`,
      },
      {
        name: `${eIntellSystem} Naura Intelligent Systems`,
        value: `${dot} **Google Gemini:** ${externalStatuses["Google Gemini"]}\n${dot} **Verba API:** ${externalStatuses["Verba API"]}`,
      },
      {
        name: `${eThirdPartySystem} Third-Party & Integrations`,
        value: `${dot} **Top.gg Portal:** ${externalStatuses["Top.gg Portal"]}\n${dot} **Saweria Gateway:** ${externalStatuses["Saweria Gateway"]}\n${dot} **Trakteer Support:** ${externalStatuses["Trakteer Support"]}`,
      },
      {
        name: `${eAudioSystem} Naura Music & Audio Systems`,
        value: lavalinkStr,
      },
    ],
    bannerAttachmentName: pingBanner ? "banner.png" : null,
    buttonsRow: createNavButtons(),
    footerText: ui.getFooter("core"),
  });

  if (pingBanner) {
    payload.files = [new AttachmentBuilder(pingBanner, { name: "banner.png" })];
  }

  if (interaction.editReply) return interaction.editReply(payload);
  return interaction.reply(payload);
}

module.exports = handlePing;
