"use strict";

const fs = require("fs");
const path = require("path");
const env = require("../config/env");
const {
  ensureLogsDir,
  writeToCentralLog,
  writeErrorToFile,
  centralLogFile,
} = require("./logWriter");

// ═══════════════════════════════════════════════════════════════════════════
//  Palet ANSI Styling (Cyber-Anime Glassmorphism Palette)
// ═══════════════════════════════════════════════════════════════════════════
const ANSI = {
  reset: "\x1b[0m",
  dim: "\x1b[90m",
  bold: "\x1b[1m",
  white: "\x1b[97m",
  cyan: "\x1b[36m",
  brightCyan: "\x1b[38;5;87m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  purple: "\x1b[35m",
  blue: "\x1b[34m",
  pink: "\x1b[38;5;218m",
  lightPink: "\x1b[38;5;225m",
  gold: "\x1b[38;5;220m",
  // Badge latar terstandarisasi untuk konsistensi lebar kolom console
  bgInfo: "\x1b[46m\x1b[30m ℹ️  INFO     \x1b[0m",
  bgSuccess: "\x1b[42m\x1b[30m ✨ SUCCESS  \x1b[0m",
  bgWarn: "\x1b[43m\x1b[30m ⚠️  WARNING  \x1b[0m",
  bgError: "\x1b[41m\x1b[97m 💥 ERROR    \x1b[0m",
  bgSystem: "\x1b[48;5;218m\x1b[30m 🌸 SYSTEM   \x1b[0m",
  bgAudio: "\x1b[45m\x1b[97m 🎵 AUDIO    \x1b[0m",
  bgDb: "\x1b[44m\x1b[97m 🗄️  DATABASE \x1b[0m",
  bgDebug: "\x1b[100m\x1b[97m 🔍 DEBUG    \x1b[0m",
};

/**
 * Format timestamp ringkas untuk terminal console dengan gaya cyber clock.
 * @returns {string} Timestamp dengan aksen cyan dan ikon jam
 */
function formatConsoleTimestamp() {
  const d = new Date();
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return ANSI.cyan + "⏰ " + h + ":" + m + ":" + s + ANSI.reset;
}

/**
 * Menyusun prefix baris console dengan timestamp abu-abu dan badge berwarna seragam.
 * @param {string} badge
 * @returns {string}
 */
function formatConsolePrefix(badge) {
  const time = formatConsoleTimestamp();
  return `${ANSI.dim}[${time}]${ANSI.reset} ${badge}`;
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

// Helper to broadcast log to socket clients dynamically
function broadcastLog(level, message) {
  try {
    const eventBus = require("../core/eventBus");
    eventBus.emit("system:log", {
      timestamp: new Date().toLocaleTimeString("id-ID"),
      level,
      message,
    });
  } catch (_) {
    // Abaikan kegagalan broadcast untuk mencegah rekursi tak berujung ke logger
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
  // Intentional: Ignore if not installed or failed to load
}

/**
 * Menampilkan ASCII Art Banner sistem log ke terminal console.
 */
function printBanner() {
  const p0 = "\x1b[38;5;225m";
  const p1 = "\x1b[38;5;218m";
  const p2 = "\x1b[38;5;213m";
  const p3 = "\x1b[38;5;205m";
  const p4 = "\x1b[38;5;199m";
  const p5 = "\x1b[38;5;197m";
  const gold = "\x1b[38;5;220m";
  const cyan = "\x1b[38;5;87m";
  const reset = "\x1b[0m";
  const dim = "\x1b[90m";
  const botVer = env.BOT_VERSION || "2.4.0";

  const lines = [
    `${cyan}╔══════════════════════════════════════════════════════════════════════════════╗${reset}`,
    `${cyan}║${p0}  ██╗  ██╗  █████╗  ██╗   ██╗ ██████╗   █████╗   ${reset} ${gold}NAURA HOSHINO V${botVer}     ${cyan}║${reset}`,
    `${cyan}║${p1}  ███╗ ██║ ██╔══██╗ ██║   ██║ ██╔══██╗ ██╔══██╗  ${reset} ${dim}CENTRALIZED SYSTEM LOG       ${cyan}║${reset}`,
    `${cyan}║${p2}  ██╔██╗██║ ███████║ ██║   ██║ ██████╔╝ ███████║  ${reset} ${dim}Integrated Terminal Monitor  ${cyan}║${reset}`,
    `${cyan}║${p3}  ██║╚████║ ██╔══██║ ██║   ██║ ██╔══██╗ ██╔══██║  ${reset} ${dim}Logs: logs/naura.log         ${cyan}║${reset}`,
    `${cyan}║${p4}  ██║ ╚███║ ██║  ██║ ╚██████╔╝ ██║  ██║ ██║  ██║  ${reset} ${dim}Status: Active & Streamed    ${cyan}║${reset}`,
    `${cyan}║${p5}  ╚═╝  ╚══╝ ╚═╝  ╚═╝  ╚═════╝  ╚═╝  ╚═╝ ╚═╝  ╚═╝  ${reset}                              ${cyan}║${reset}`,
    `${cyan}╚══════════════════════════════════════════════════════════════════════════════╝${reset}`,
  ];
  console.log("\n" + lines.join("\n") + "\n");
}

/**
 * Mengambil statistik file log terpusat saat ini.
 * @returns {object}
 */
function getLogStats() {
  if (!fs.existsSync(centralLogFile)) {
    return {
      exists: false,
      path: centralLogFile,
      sizeBytes: 0,
      sizeFormatted: "0 B",
      totalLines: 0,
      errorCount: 0,
      warnCount: 0,
      infoCount: 0,
      lastModified: null,
    };
  }

  const stat = fs.statSync(centralLogFile);
  const sizeBytes = stat.size;
  let sizeFormatted = `${sizeBytes} B`;
  if (sizeBytes >= 1024 * 1024) {
    sizeFormatted = `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`;
  } else if (sizeBytes >= 1024) {
    sizeFormatted = `${(sizeBytes / 1024).toFixed(2)} KB`;
  }

  let totalLines = 0;
  let errorCount = 0;
  let warnCount = 0;
  let infoCount = 0;

  try {
    const content = fs.readFileSync(centralLogFile, "utf8");
    const lines = content.split("\n");
    totalLines = lines.length;
    for (const line of lines) {
      if (line.includes("[ERROR   ]")) errorCount++;
      else if (line.includes("[WARN    ]")) warnCount++;
      else if (line.includes("[INFO    ]")) infoCount++;
    }
  } catch (_) {
    // Non-fatal
  }

  return {
    exists: true,
    path: centralLogFile,
    sizeBytes,
    sizeFormatted,
    totalLines,
    errorCount,
    warnCount,
    infoCount,
    lastModified: stat.mtime,
  };
}

/**
 * Membaca entri dari log terpusat dengan filter level, kata kunci, dan batas baris.
 * @param {object} [options={}]
 * @returns {string[]}
 */
function readLogs({ limit = 50, level = null, search = null } = {}) {
  if (!fs.existsSync(centralLogFile)) return [];

  try {
    const content = fs.readFileSync(centralLogFile, "utf8");
    let lines = content.split("\n").filter((l) => l.trim().length > 0);

    if (level) {
      const lvlUpper = String(level).toUpperCase();
      lines = lines.filter((l) => l.includes(`[${lvlUpper}`));
    }

    if (search) {
      const sLower = String(search).toLowerCase();
      lines = lines.filter((l) => l.toLowerCase().includes(sLower));
    }

    if (typeof limit === "number" && limit > 0) {
      lines = lines.slice(-limit);
    }

    return lines;
  } catch (_) {
    return [];
  }
}

/**
 * Membersihkan log terpusat dengan mengarsipkannya dan membuat sesi baru.
 * @returns {boolean}
 */
function clearLogs() {
  ensureLogsDir();
  if (fs.existsSync(centralLogFile)) {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toTimeString().split(" ")[0].replace(/:/g, "");
    const logsDir = path.dirname(centralLogFile);
    const archivePath = path.join(logsDir, `naura-archived-${dateStr}-${timeStr}.log`);
    try {
      fs.renameSync(centralLogFile, archivePath);
    } catch (_) {
      // Fallback truncate
      fs.writeFileSync(centralLogFile, "", "utf8");
    }
  }
  writeToCentralLog({ level: "SYSTEM", message: "Central log dibersihkan dan diinisialisasi ulang." });
  return true;
}

/**
 * Mengembalikan path absolut ke file log terpusat.
 * @returns {string}
 */
function getLogFilePath() {
  return centralLogFile;
}

// Standardized Logging Methods for Console and Central File
const logger = {
  info: (message) => {
    console.log(`${formatConsolePrefix(ANSI.bgInfo)} \x1b[36m${message}\x1b[0m`);
    writeToCentralLog({ level: "INFO", message });
    broadcastLog("info", message);
  },
  success: (message) => {
    console.log(`${formatConsolePrefix(ANSI.bgSuccess)} \x1b[32m${message}\x1b[0m`);
    writeToCentralLog({ level: "SUCCESS", message });
    broadcastLog("success", message);
  },
  warn: (message) => {
    console.log(`${formatConsolePrefix(ANSI.bgWarn)} \x1b[33m${message}\x1b[0m`);
    writeToCentralLog({ level: "WARN", message });
    broadcastLog("warn", message);
  },
  error: (message, err = null, context = null) => {
    console.error(`${formatConsolePrefix(ANSI.bgError)} \x1b[31m${message}\x1b[0m`);
    if (err) console.error(err);

    const origin = parseErrorOrigin(err);
    writeErrorToFile({ message, err, context, origin });
    writeToCentralLog({ level: "ERROR", message, err, context, origin });

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
    console.log(`${formatConsolePrefix(ANSI.bgSystem)} \x1b[38;5;225m${message}\x1b[0m`);
    writeToCentralLog({ level: "SYSTEM", message });
    broadcastLog("system", message);
  },
  music: (message) => {
    console.log(`${formatConsolePrefix(ANSI.bgAudio)} \x1b[35m${message}\x1b[0m`);
    writeToCentralLog({ level: "AUDIO", message });
    broadcastLog("music", message);
  },
  db: (message) => {
    console.log(`${formatConsolePrefix(ANSI.bgDb)} \x1b[34m${message}\x1b[0m`);
    writeToCentralLog({ level: "DATABASE", message });
    broadcastLog("db", message);
  },
  debug: (message) => {
    writeToCentralLog({ level: "DEBUG", message });
    if (env.DEBUG || env.NODE_ENV === "development") {
      console.log(`${formatConsolePrefix(ANSI.bgDebug)} \x1b[90m${message}\x1b[0m`);
    }
  },
  printBanner,
  getLogFilePath,
  getLogStats,
  readLogs,
  clearLogs,
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
  getLogFilePath,
  getLogStats,
  readLogs,
  clearLogs,
  printBanner,
};

