"use strict";

const crypto = require("crypto");
const path = require("path");
const { logger, parseErrorOrigin } = require("./logger");
const env = require("../config/env");
const ui = require("../config/ui");
const designTokens = require("../config/tokens/designTokens");
const { buildContainerV2 } = require("../utils/NauraContainerBuilder");
const metricsManager = require("./metricsManager");

// Sliding window and memory hygiene constants
const ERROR_DM_COOLDOWN_MS = 5 * 60 * 1000; // 5-minute sliding window
const ERROR_DM_TTL_MS = 15 * 60 * 1000; // 15-minute memory TTL
const MILESTONE_COUNTS = [5, 25, 100]; // Milestone notifications for recurring error bursts

// In-memory registry tracking active recurring error incidents
const incidentRegistry = new Map();

// Periodic cleanup timer to prevent memory leaks from expired incidents
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, incident] of incidentRegistry.entries()) {
    if (now - incident.lastSeen > ERROR_DM_TTL_MS) {
      if (incident.timer) clearTimeout(incident.timer);
      incidentRegistry.delete(key);
    }
  }
}, ERROR_DM_TTL_MS);
if (cleanupTimer.unref) cleanupTimer.unref();

/**
 * Normalizes dynamic parameters (Snowflake IDs, timestamps, memory addresses, UUIDs, IPs)
 * so repeating errors produce stable signatures.
 * @param {string} str
 * @returns {string}
 */
function normalizeErrorString(str) {
  if (!str) return "";
  return String(str)
    // Strip Discord Snowflake IDs (17-20 digits)
    .replace(/\b\d{17,20}\b/g, "[ID]")
    // Strip ISO timestamps
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?/gi, "[TIMESTAMP]")
    // Strip Hex memory addresses
    .replace(/0x[0-9a-fA-F]+/g, "[ADDR]")
    // Strip UUIDs
    .replace(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/gi, "[UUID]")
    // Strip IPv4 addresses
    .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, "[IP]")
    // Normalize whitespace
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Truncates and formats stack traces for clean Components V2 display.
 * @param {Error|any} err
 * @param {number} [maxChars=1200]
 * @returns {string}
 */
function formatTruncatedStack(err, maxChars = 1200) {
  const rawStack =
    err instanceof Error && err.stack
      ? err.stack
      : String(err?.stack || err || "No stack trace available");

  const lines = rawStack.split("\n");
  const cleanLines = [];

  for (const line of lines) {
    cleanLines.push(line);
    if (cleanLines.join("\n").length >= maxChars) break;
  }

  let result = cleanLines.join("\n");
  if (result.length > maxChars) {
    result = result.substring(0, maxChars);
    result += "\n// ... [cuplikan dipotong untuk kebersihan tampilan]";
  } else if (lines.length > cleanLines.length) {
    result += "\n// ... [cuplikan dipotong untuk kebersihan tampilan]";
  }

  return result;
}

/**
 * Classifies an error into standard categories with severity badges and accent colors.
 * @param {Error|any} err - The error object
 * @param {string} [type=""] - The error trigger context
 * @returns {{
 *   category: 'NETWORK_WS' | 'DATABASE' | 'AI_QUOTA_429' | 'FATAL_CRASH' | 'GENERIC',
 *   severity: string,
 *   badge: string,
 *   accentColor: number,
 *   accentColorHex: string,
 *   summary: string
 * }}
 */
function classifyError(err, type = "") {
  const errCode = String(err?.code || "");
  const errStatus = Number(err?.status || err?.statusCode || 0);
  const errName = String(err?.name || (err instanceof Error ? err.constructor?.name : "") || "");
  const errMsg = String(err?.message || (typeof err === "string" ? err : "") || "");
  const typeStr = String(type || "");

  // 1. AI 429 Quota Exhaustion / Rate Limits
  const isAiQuota =
    errStatus === 429 ||
    errCode === "429" ||
    errCode === "RESOURCE_EXHAUSTED" ||
    /429|quota|RESOURCE_EXHAUSTED|rate[_\s-]?limit/i.test(errMsg) ||
    /GoogleGenerativeAI|Groq|OpenAI|FishAudio/i.test(errName) ||
    /AI|Quota|429/i.test(typeStr);

  if (isAiQuota) {
    return {
      category: "AI_QUOTA_429",
      severity: "HIGH",
      badge: "[🧠 AI QUOTA 429]",
      accentColor: designTokens.STATUS.maintenance.int,
      accentColorHex: designTokens.STATUS.maintenance.hex,
      summary: "Kuota atau rate limit API AI telah terlampaui (HTTP 429). Permintaan ke model AI ditahan sementara.",
    };
  }

  // 2. Database & ORM Failures
  const isDatabase =
    /Sequelize|Mongo|Mongoose|Redis|ioredis|SQLITE/i.test(errName) ||
    /Sequelize|Mongo|Mongoose|Redis|ioredis|SQLITE|database|deadlock/i.test(errMsg) ||
    /Database|Sequelize|Mongo|Redis/i.test(typeStr);

  if (isDatabase) {
    return {
      category: "DATABASE",
      severity: "HIGH",
      badge: "[🗄️ DATABASE]",
      accentColor: designTokens.STATUS.idle.int,
      accentColorHex: designTokens.STATUS.idle.hex,
      summary: "Terjadi kegagalan koneksi, timeout, atau query pada database ekosistem.",
    };
  }

  // 3. Network & WebSocket / Gateway Disconnects
  const isNetwork =
    ["ETIMEDOUT", "ECONNRESET", "ECONNREFUSED", "EPIPE", "ENOTFOUND", "EAI_AGAIN"].includes(errCode) ||
    /ConnectTimeoutError|SocketError|WebSocketError/i.test(errName) ||
    /WebSocket|Gateway|Lavalink|Poru|socket|read ETIMEDOUT|ECONNRESET|ECONNREFUSED/i.test(errMsg) ||
    /Shard|WebSocket|Gateway|Network/i.test(typeStr);

  if (isNetwork) {
    return {
      category: "NETWORK_WS",
      severity: "HIGH",
      badge: "[🌐 NETWORK / GATEWAY]",
      accentColor: designTokens.STATUS.syncing.int,
      accentColorHex: designTokens.STATUS.syncing.hex,
      summary: "Koneksi gateway Discord, socket audio, atau jaringan eksternal terputus / mengalami timeout.",
    };
  }

  // 4. Fatal Runtime Logic Crash
  const isFatal =
    err instanceof TypeError ||
    errName === "TypeError" ||
    err instanceof ReferenceError ||
    errName === "ReferenceError" ||
    err instanceof RangeError ||
    errName === "RangeError" ||
    err instanceof SyntaxError ||
    errName === "SyntaxError" ||
    errName === "AssertionError" ||
    /Uncaught Exception|Fatal/i.test(typeStr);

  if (isFatal) {
    return {
      category: "FATAL_CRASH",
      severity: "CRITICAL",
      badge: "[🔴 FATAL CRASH]",
      accentColor: designTokens.STATUS.dnd.int,
      accentColorHex: designTokens.STATUS.dnd.hex,
      summary: "Terjadi kesalahan logika JavaScript fatal yang tidak tertangani.",
    };
  }

  // 5. Generic / Unhandled System Error
  return {
    category: "GENERIC",
    severity: "MEDIUM",
    badge: "[⚠️ GENERIC]",
    accentColor: designTokens.STATUS.idle.int,
    accentColorHex: designTokens.STATUS.idle.hex,
    summary: errMsg
      ? `Terjadi kesalahan sistem: ${errMsg.substring(0, 150)}`
      : "Terjadi unhandled rejection atau kesalahan sistem umum.",
  };
}

/**
 * Extracts a stable origin signature (relative path and function name without line/column numbers)
 * for normalized error fingerprinting.
 * @param {Error|any} err
 * @returns {string}
 */
function extractOriginForFingerprint(err) {
  const stack = err instanceof Error && err.stack ? err.stack : "";
  if (!stack) return "unknown";

  const lines = stack.split("\n");
  const rootDir = path.resolve(__dirname, "../../");

  for (const line of lines) {
    if (!/^\s+at\s+/.test(line)) continue;
    if (line.includes("node_modules")) continue;
    if (line.includes("node:internal") || line.includes("node:")) continue;
    if (
      line.includes(path.join("src", "managers", "logger.js")) ||
      line.includes("logger.js")
    )
      continue;
    if (line.includes("errorHandler.js")) continue;

    const match = line.match(
      /(?:at\s+(?:async\s+)?([^\s(]+)\s+\((.+):(\d+):(\d+)\)|at\s+(.+):(\d+):(\d+))/,
    );
    if (match) {
      const fnName = match[1] || "";
      const filePath = match[2] || match[5];
      let relPath = path.relative(rootDir, filePath).replace(/\\/g, "/");
      if (relPath.startsWith("..")) {
        relPath = path.basename(filePath);
      }
      return fnName ? `${relPath} (${fnName})` : relPath;
    }
  }

  return "unknown";
}

/**
 * Computes a normalized error fingerprint invariant to dynamic IDs, timestamps, and memory addresses.
 * @param {Error|any} err
 * @param {string} [type="Error"]
 * @returns {string} MD5 hash representing the normalized error fingerprint
 */
function getErrorFingerprint(err, type = "Error") {
  const classification = classifyError(err, type);
  const errName = String(
    err?.name || (err instanceof Error ? err.constructor?.name : "Error"),
  );
  const normalizedMsg = normalizeErrorString(
    err?.message || (typeof err === "string" ? err : JSON.stringify(err)),
  );
  const stableOrigin = extractOriginForFingerprint(err);
  const normalizedOrigin = normalizeErrorString(stableOrigin);

  const rawSignature = `${type}::${classification.category}::${errName}::${normalizedMsg}::${normalizedOrigin}`;
  return crypto.createHash("md5").update(rawSignature).digest("hex");
}

/**
 * Builds the Components V2 card and dispatches to webhook and configured developer DMs.
 * @param {object} params
 * @returns {Promise<object>}
 */
async function dispatchCrashAlert({
  err,
  type,
  client,
  classification,
  count = 1,
  isMilestone = false,
  isAggregated = false,
  timeWindowSec = null,
}) {
  const origin = parseErrorOrigin(err);
  const truncatedStack = formatTruncatedStack(err);

  let frequencyText;
  if (isAggregated) {
    if (isMilestone) {
      frequencyText = `🚨 **Pencapaian Milestone: ${count} kejadian** terdeteksi! (Ditekan selama cooldown)`;
    } else {
      frequencyText = `⚠️ **Agregasi Cooldown: ${count} kejadian** terulang${timeWindowSec ? ` dalam ${timeWindowSec} detik terakhir` : ""}.`;
    }
  } else {
    frequencyText = "Kejadian pertama (baru)";
  }

  const containerPayload = buildContainerV2({
    accentColorHex: classification.accentColorHex,
    authorName: "Naura Crash Reporter",
    title: `${classification.badge} ${type}`,
    description: classification.summary,
    fields: [
      {
        name: "🏷️ Klasifikasi & Keparahan",
        value: `**Kategori:** \`${classification.category}\`\n**Tingkat:** \`${classification.severity}\``,
        inline: true,
      },
      {
        name: "📍 Asal Error (Origin)",
        value: `\`${origin}\``,
        inline: true,
      },
      {
        name: "📊 Frekuensi Insiden",
        value: frequencyText,
        inline: false,
      },
      {
        name: "📋 Cuplikan Stack Trace",
        value: `\`\`\`js\n${truncatedStack}\n\`\`\``,
        inline: false,
      },
      {
        name: "🖥️ Lingkungan & Sistem",
        value: `Versi: \`v${env.BOT_VERSION}\` | Node: \`${process.version}\` | Shard: \`#${client?.shard?.ids?.[0] ?? env.SHARD_ID ?? 0}\``,
        inline: false,
      },
    ],
    footerCategory: "core",
    footerText: ui.getFooter("core"),
  });

  // 1. Dispatch to Webhook (if configured)
  if (env.ERROR_WEBHOOK_URL) {
    try {
      const { WebhookClient } = require("discord.js");
      const webhook = new WebhookClient({ url: env.ERROR_WEBHOOK_URL });
      await webhook.send({
        username: "Naura Crash Reporter",
        ...containerPayload,
      });
    } catch (webhookErr) {
      logger.error("[Webhook] Failed to send error log to webhook.", webhookErr);
    }
  }

  // 2. Multi-Developer DM Dispatch to all configured OWNER_IDS
  const rawOwnerIds = env.OWNER_IDS;
  const ownerIds = Array.isArray(rawOwnerIds)
    ? rawOwnerIds
    : rawOwnerIds
      ? [rawOwnerIds]
      : [];

  if (ownerIds.length > 0 && client?.users?.fetch) {
    for (const ownerId of ownerIds) {
      const cleanId = String(ownerId || "").trim();
      if (!/^\d{17,20}$/.test(cleanId)) continue;

      try {
        const owner = await client.users.fetch(cleanId).catch(() => null);
        if (owner && typeof owner.send === "function") {
          await owner.send(containerPayload).catch((dmErr) => {
            logger.warn(
              `[Anti-Crash] Gagal mengirim DM ke owner (${cleanId}): ${dmErr.message}`,
            );
          });
        }
      } catch (dmException) {
        logger.warn(
          `[Anti-Crash] Exception saat DM owner (${cleanId}): ${dmException.message}`,
        );
      }
    }
  }

  return containerPayload;
}

/**
 * Flushes an aggregated incident summary when cooldown expires.
 * @param {string} fingerprint
 * @param {import('discord.js').Client} client
 * @returns {Promise<object|null>}
 */
async function flushIncident(fingerprint, client) {
  const incident = incidentRegistry.get(fingerprint);
  if (!incident) return null;

  if (incident.timer) {
    clearTimeout(incident.timer);
    incident.timer = null;
  }

  const suppressedCount = incident.count;

  // Clean entry from registry so future occurrences trigger a fresh window
  incidentRegistry.delete(fingerprint);

  if (suppressedCount > 1) {
    const classification = classifyError(incident.error, incident.type);
    const timeWindowSec = Math.max(
      1,
      Math.round((incident.lastSeen - incident.firstSeen) / 1000),
    );

    return await dispatchCrashAlert({
      err: incident.error,
      type: incident.type,
      client,
      classification,
      count: suppressedCount,
      isMilestone: false,
      isAggregated: true,
      timeWindowSec,
    });
  }

  return null;
}

/**
 * Handle and log critical application errors with smart classification and throttling.
 * @param {Error|any} err - The error object
 * @param {string} type - The type of error
 * @param {import('discord.js').Client} client - The Discord client
 * @param {object} [options={}] - Optional tuning parameters for tests
 * @returns {Promise<{
 *   sent: boolean,
 *   throttled: boolean,
 *   incidentCount: number,
 *   isMilestone: boolean,
 *   classification: object,
 *   fingerprint: string,
 *   payload: object
 * }>}
 */
const sendErrorLog = async (err, type, client, options = {}) => {
  logger.error(`[Anti-Crash] ${type}`, err, {
    type,
    clientTag: client?.user?.tag,
  });

  // Sentry Error Tracking Integration
  if (env.SENTRY_DSN) {
    try {
      const Sentry = require("@sentry/node");
      Sentry.captureException(err, { tags: { type } });
    } catch (sentryErr) {
      logger.warn(`[Anti-Crash] Sentry capture failed: ${sentryErr.message}`);
    }
  }

  const classification = classifyError(err, type);
  const fingerprint = getErrorFingerprint(err, type);
  const cooldownMs = options.cooldownMs ?? ERROR_DM_COOLDOWN_MS;
  const forceDispatch = options.force ?? false;
  const now = Date.now();

  let incident = incidentRegistry.get(fingerprint);
  let shouldDispatchImmediate = false;
  let isMilestone = false;
  let isAggregated = false;
  let currentCount = 1;

  if (!incident || now - incident.lastAlertSentAt >= cooldownMs) {
    if (incident?.timer) {
      clearTimeout(incident.timer);
    }

    currentCount = 1;
    incident = {
      fingerprint,
      category: classification.category,
      severity: classification.severity,
      badge: classification.badge,
      accentColor: classification.accentColor,
      accentColorHex: classification.accentColorHex,
      summary: classification.summary,
      type,
      error: err,
      count: 1,
      firstSeen: now,
      lastSeen: now,
      lastAlertSentAt: now,
      timer: null,
    };

    shouldDispatchImmediate = true;
    isMilestone = false;
    isAggregated = false;

    // Schedule automatic cooldown flush
    incident.timer = setTimeout(async () => {
      await flushIncident(fingerprint, client);
    }, cooldownMs);
    if (incident.timer.unref) incident.timer.unref();

    incidentRegistry.set(fingerprint, incident);
  } else {
    // Within cooldown window: aggregate repeated occurrences
    incident.count++;
    incident.lastSeen = now;
    currentCount = incident.count;

    if (MILESTONE_COUNTS.includes(incident.count)) {
      shouldDispatchImmediate = true;
      isMilestone = true;
      isAggregated = true;
      incident.lastAlertSentAt = now;
    } else if (forceDispatch) {
      shouldDispatchImmediate = true;
      isMilestone = false;
      isAggregated = incident.count > 1;
    } else {
      shouldDispatchImmediate = false;
    }
  }

  let payload = null;
  if (shouldDispatchImmediate) {
    payload = await dispatchCrashAlert({
      err,
      type,
      client,
      classification,
      count: currentCount,
      isMilestone,
      isAggregated,
    });
  }

  return {
    sent: shouldDispatchImmediate,
    throttled: !shouldDispatchImmediate,
    incidentCount: currentCount,
    isMilestone,
    classification,
    fingerprint,
    payload,
  };
};

/**
 * Attach crash and client error handlers.
 * @param {import('discord.js').Client} client - The Discord client
 */
const setupErrorHandlers = (client) => {
  // Process-level unhandled rejection listener
  process.on("unhandledRejection", (reason) => {
    // Ignore Discord 10062 (Unknown Interaction token expiration)
    if (reason && reason.code === 10062) return;

    metricsManager.logError("unhandledRejection");
    sendErrorLog(reason, "Unhandled Rejection", client);
  });

  // Process-level uncaught exception listener
  process.on("uncaughtException", (err) => {
    metricsManager.logError("uncaughtException");
    sendErrorLog(err, "Uncaught Exception", client);
  });

  // Attach Discord client listeners (avoid duplicate attachment)
  if (client && typeof client.on === "function" && !client._errorHandlersAttached) {
    client._errorHandlersAttached = true;

    client.on("error", (error) => {
      logger.error("[Client Error]", error);
      metricsManager.logError("clientError");
      sendErrorLog(error, "Client Error", client);
    });

    client.on("shardError", (error, shardId) => {
      logger.error(`[Shard Error] Shard #${shardId}`, error);
      metricsManager.logError("shardError");
      sendErrorLog(error, `Shard Error (#${shardId})`, client);
    });

    client.on("shardDisconnect", (event, shardId) => {
      logger.warn(
        `[Shard Disconnect] Shard #${shardId} terputus (Kode: ${event?.code || "N/A"})`,
      );
      metricsManager.logError("shardDisconnect");
      const err = new Error(
        `Shard #${shardId} terputus dari Gateway (Kode: ${event?.code || "N/A"}, Alasan: ${event?.reason || "Koneksi tertutup"})`,
      );
      sendErrorLog(err, `Shard Disconnect (#${shardId})`, client);
    });
  }
};

/**
 * Resets the incident registry (useful for testing).
 */
function clearIncidents() {
  for (const incident of incidentRegistry.values()) {
    if (incident.timer) clearTimeout(incident.timer);
  }
  incidentRegistry.clear();
}

module.exports = {
  setupErrorHandlers,
  sendErrorLog,
  classifyError,
  getErrorFingerprint,
  extractOriginForFingerprint,
  normalizeErrorString,
  formatTruncatedStack,
  dispatchCrashAlert,
  flushIncident,
  clearIncidents,
  incidentRegistry,
  ERROR_DM_COOLDOWN_MS,
  ERROR_DM_TTL_MS,
  MILESTONE_COUNTS,
};
