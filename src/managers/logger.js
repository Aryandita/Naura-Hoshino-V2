"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const env = require("../config/env");

// Tentukan lokasi folder 'logs' di root repository (sejajar dengan index.js)
const logsDir = path.resolve(__dirname, "../../logs");
const centralLogFile = path.join(logsDir, "naura.log");
const MAX_LOG_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB rotasi otomatis

let sessionHeaderWritten = false;

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
 * Menghapus kode ANSI escape sequence agar file log tetap bersih dan terbaca.
 * @param {string} str
 * @returns {string}
 */
function stripAnsi(str) {
  if (typeof str !== "string") return String(str ?? "");
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

/**
 * Format timestamp ringkas untuk terminal console (HH:mm:ss).
 * @returns {string}
 */
function formatConsoleTimestamp() {
  const d = new Date();
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

/**
 * Format timestamp presisi untuk file log (YYYY-MM-DD HH:mm:ss.SSS).
 * @returns {string}
 */
function formatLogTimestamp() {
  const d = new Date();
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${y}-${mo}-${day} ${h}:${mi}:${s}.${ms}`;
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
 * Memastikan folder logs dibuat secara lazy hanya saat log pertama kali ditulis.
 * @returns {string} Path ke folder logs
 */
function ensureLogsDir() {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  return logsDir;
}

/**
 * Memeriksa ukuran file naura.log dan melakukan rotasi jika melebihi batas.
 */
function checkRotateCentralLog() {
  try {
    if (fs.existsSync(centralLogFile)) {
      const stats = fs.statSync(centralLogFile);
      if (stats.size >= MAX_LOG_SIZE_BYTES) {
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10);
        const timeStr = now.toTimeString().split(" ")[0].replace(/:/g, "");
        const backupPath = path.join(logsDir, `naura-${dateStr}-${timeStr}.log.bak`);
        fs.renameSync(centralLogFile, backupPath);
        sessionHeaderWritten = false;
      }
    }
  } catch (_) {
    // Non-fatal rotation error
  }
}

/**
 * Membuat header ASCII Art pembuka sesi untuk file log terpusat.
 * @returns {string}
 */
function buildSessionHeader() {
  const now = new Date();
  const timeIso = now.toISOString();
  const botVer = env.BOT_VERSION || "2.3.0";
  const nodeVer = process.version;
  const platform = `${os.platform()} ${os.arch()}`;
  const shardTxt = env.SHARD_ID != null ? `Shard #${env.SHARD_ID}` : "Standalone";

  let header = "\n" + "=".repeat(80) + "\n";
  header += `  ██╗  ██╗  █████╗  ██╗   ██╗ ██████╗   █████╗     NAURA HOSHINO v${botVer}\n`;
  header += `  ███╗ ██║ ██╔══██╗ ██║   ██║ ██╔══██╗ ██╔══██╗    CENTRALIZED SYSTEM LOG\n`;
  header += `  ██╔██╗██║ ███████║ ██║   ██║ ██████╔╝ ███████║    Session: ${timeIso}\n`;
  header += `  ██║╚████║ ██╔══██║ ██║   ██║ ██╔══██╗ ██╔══██║    Platform: ${platform} | Node: ${nodeVer}\n`;
  header += `  ██║ ╚███║ ██║  ██║ ╚██████╔╝ ██║  ██║ ██║  ██║    Identity: ${shardTxt} | PID: ${process.pid}\n`;
  header += `  ╚═╝  ╚══╝ ╚═╝  ╚═╝  ╚═════╝  ╚═╝  ╚═╝ ╚═╝  ╚═╝    Central Log: logs/naura.log\n`;
  header += "=".repeat(80) + "\n\n";
  return header;
}

/**
 * Menulis log ke file log terpusat (naura.log) lengkap dengan timestamp dan struktur rapi.
 * @param {object} param0
 */
function writeToCentralLog({ level, message, err = null, context = null, origin = null }) {
  try {
    ensureLogsDir();
    checkRotateCentralLog();

    const fileExists = fs.existsSync(centralLogFile);
    const isEmpty = fileExists ? fs.statSync(centralLogFile).size === 0 : true;

    if (!sessionHeaderWritten || !fileExists || isEmpty) {
      const sessionBanner = buildSessionHeader();
      fs.appendFileSync(centralLogFile, sessionBanner, "utf8");
      sessionHeaderWritten = true;
    }

    const timestamp = formatLogTimestamp();
    const cleanMsg = stripAnsi(message);
    const cleanOrigin = origin ? ` [Origin: ${origin}]` : "";

    let entry = `[${timestamp}] [${level.padEnd(8)}]${cleanOrigin} ${cleanMsg}\n`;
    if (err) {
      const errMsg = err.message || String(err);
      entry += `  ERROR  : ${stripAnsi(errMsg)}\n`;
      const stack = (err instanceof Error && err.stack) ? err.stack : (new Error()).stack;
      if (stack) {
        const indented = stack
          .split("\n")
          .slice(0, 8)
          .map((l) => `    ${l.trim()}`)
          .join("\n");
        entry += `  STACK  :\n${indented}\n`;
      }
    }
    if (context) {
      entry += `  CONTEXT: ${typeof context === "object" ? JSON.stringify(context) : context}\n`;
    }

    fs.appendFileSync(centralLogFile, entry, "utf8");
  } catch (fileErr) {
    // Non-fatal file logging failure
  }
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
 * Menulis rincian error ke file log harian khusus error (error-YYYY-MM-DD.log).
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
    const eventBus = require("../core/eventBus");
    eventBus.emit("system:log", {
      timestamp: new Date().toLocaleTimeString("id-ID"),
      level,
      message,
    });
  } catch (e) {
    logger.debug("[logger:broadcastLog] Galat pada rutinitas aplikasi: " + (e?.message || e));
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
  const botVer = env.BOT_VERSION || "2.3.0";

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
    const archivePath = path.join(logsDir, `naura-archived-${dateStr}-${timeStr}.log`);
    try {
      fs.renameSync(centralLogFile, archivePath);
    } catch (_) {
      // Fallback truncate
      fs.writeFileSync(centralLogFile, "", "utf8");
    }
  }
  sessionHeaderWritten = false;
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
