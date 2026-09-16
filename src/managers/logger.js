"use strict";

const fs = require("fs");
const path = require("path");
const env = require("../config/env");

// Tentukan lokasi folder 'logs' di root repository (sejajar dengan index.js)
const logsDir = path.resolve(__dirname, "../../logs");

/**
 * Memastikan folder logs dibuat secara lazy hanya saat error pertama kali terjadi.
 * @returns {string} Path ke folder logs
 */
function ensureLogsDir() {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  return logsDir;
}

/**
 * Mengekstrak lokasi asal error (file, baris, kolom, dan nama fungsi) dari stack trace.
 * Memfilter node_modules dan internal node untuk menemukan baris kode internal bot.
 * @param {Error|any} err
 * @returns {string} Format: "rel/path/file.js:line:col (functionName)"
 */
function parseErrorOrigin(err) {
  const stack = (err instanceof Error && err.stack) ? err.stack : (new Error()).stack;
  if (!stack) return "unknown:0:0";

  const lines = stack.split("\n");
  const rootDir = path.resolve(__dirname, "../../");

  for (const line of lines) {
    if (!line.includes("at ")) continue;
    if (line.includes("node_modules")) continue;
    if (line.includes("node:internal") || line.includes("node:")) continue;
    if (line.includes(path.join("src", "managers", "logger.js"))) continue;

    // Pattern 1: at functionName (path/to/file.js:12:34)
    // Pattern 2: at path/to/file.js:12:34
    const match = line.match(/(?:at\s+(?:async\s+)?([^\s(]+)\s+\((.+):(\d+):(\d+)\)|at\s+(.+):(\d+):(\d+))/);
    if (match) {
      const fnName = match[1] || "";
      const filePath = match[2] || match[5];
      const lineNo = match[3] || match[6];
      const colNo = match[4] || match[7];

      let relPath = path.relative(rootDir, filePath).replace(/\\/g, "/");
      if (relPath.startsWith("..")) {
        relPath = path.basename(filePath);
      }

      return fnName ? `${relPath}:${lineNo}:${colNo} (${fnName})` : `${relPath}:${lineNo}:${colNo}`;
    }
  }

  return "unknown:0:0";
}

/**
 * Menulis rincian error ke file log harian (error-YYYY-MM-DD.log).
 * @param {object} param0
 */
function writeErrorToFile({ message, err, context, origin }) {
  try {
    const dir = ensureLogsDir();
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const fileName = `error-${dateStr}.log`;
    const filePath = path.join(dir, fileName);

    const timeIso = now.toISOString();
    const localTime = now.toLocaleTimeString("id-ID");
    const stack = (err instanceof Error ? err.stack : err) || "No stack trace provided";

    let entry = `================================================================================\n`;
    entry += `TIMESTAMP : ${timeIso} [${localTime}]\n`;
    entry += `ORIGIN    : ${origin}\n`;
    entry += `MESSAGE   : ${message}\n`;
    if (err) {
      entry += `ERROR     : ${err.message || String(err)}\n`;
    }
    entry += `STACK     :\n${stack}\n`;
    if (context) {
      entry += `CONTEXT   : ${typeof context === "object" ? JSON.stringify(context) : context}\n`;
    }
    entry += `================================================================================\n\n`;

    fs.appendFileSync(filePath, entry, "utf8");
  } catch (fileErr) {
    console.error("[Logger] Gagal menulis ke file log:", fileErr.message);
  }
}

// Helper to broadcast log to socket clients dynamically
function broadcastLog(level, message) {
  try {
    if (global.client && global.client.dashboardIo) {
      global.client.dashboardIo.emit("system_log", {
        timestamp: new Date().toLocaleTimeString("id-ID"),
        level,
        message,
      });
    }
  } catch (e) {
    // Fail silent
  }
}

// Sentry Integration (Optional)
let Sentry = null;
try {
  if (env.SENTRY_DSN) {
    Sentry = require("@sentry/node");
    Sentry.init({
      dsn: env.SENTRY_DSN,
      tracesSampleRate: 1.0,
    });
  }
} catch (err) {
  // Ignore if not installed or failed to load
}

// Standardized Logging Methods for Console
const logger = {
  info: (message) => {
    console.log(`\x1b[46m\x1b[30m ℹ️ INFO \x1b[0m \x1b[36m${message}\x1b[0m`);
    broadcastLog("info", message);
  },
  success: (message) => {
    console.log(
      `\x1b[42m\x1b[30m ✨ SUCCESS \x1b[0m \x1b[32m${message}\x1b[0m`,
    );
    broadcastLog("success", message);
  },
  warn: (message) => {
    console.log(
      `\x1b[43m\x1b[30m ⚠️ WARNING \x1b[0m \x1b[33m${message}\x1b[0m`,
    );
    broadcastLog("warn", message);
  },
  error: (message, err = null, context = null) => {
    console.error(
      `\x1b[41m\x1b[37m 💥 ERROR \x1b[0m \x1b[31m${message}\x1b[0m`,
    );
    if (err) console.error(err);

    const origin = parseErrorOrigin(err);
    writeErrorToFile({ message, err, context, origin });

    broadcastLog(
      "error",
      `${message}${err ? " | " + (err.message || err) : ""} [Origin: ${origin}]`,
    );

    if (Sentry && err instanceof Error) {
      Sentry.captureException(err, {
        tags: { origin },
        extra: { message, context },
      });
    }
  },
  system: (message) => {
    console.log(`\x1b[40m\x1b[37m 🤖 SYSTEM \x1b[0m ${message}`);
    broadcastLog("system", message);
  },
  music: (message) => {
    console.log(`\x1b[45m\x1b[37m 🎵 AUDIO \x1b[0m \x1b[35m${message}\x1b[0m`);
    broadcastLog("music", message);
  },
  db: (message) => {
    console.log(
      `\x1b[44m\x1b[37m 🗄️ DATABASE \x1b[0m \x1b[34m${message}\x1b[0m`,
    );
    broadcastLog("db", message);
  },
  debug: (message) => {
    if (env.DEBUG || env.NODE_ENV === "development") {
      console.log(`\x1b[90m 🔍 DEBUG \x1b[0m \x1b[90m${message}\x1b[0m`);
    }
  },
};

/**
 * Backward compatibility wrapper untuk pencatatan error terstruktur.
 * @param {string} type
 * @param {Error|any} error
 * @param {object} [context=null]
 */
function logError(type, error, context = null) {
  logger.error(`[${type}] ${error?.message || error}`, error, context);
}

// Global Promise Rejection & Uncaught Exception fallbacks
process.on("unhandledRejection", (reason) => {
  if (process.listenerCount("unhandledRejection") <= 1) {
    logger.error("[Unhandled_Rejection] " + (reason?.message || reason), reason);
  }
});
process.on("uncaughtException", (error) => {
  if (process.listenerCount("uncaughtException") <= 1) {
    logger.error("[Uncaught_Exception] " + (error?.message || error), error);
  }
});

module.exports = {
  logError,
  logger,
  Sentry,
  parseErrorOrigin,
  ensureLogsDir,
};
