"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const env = require("../config/env");

const logsDir = path.resolve(__dirname, "../../logs");
const centralLogFile = path.join(logsDir, "naura.log");
const MAX_LOG_SIZE_BYTES = 20 * 1024 * 1024;

let sessionHeaderWritten = false;

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
  const botVer = env.BOT_VERSION || "2.4.0";
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
 * Menulis rincian error ke file log harian khusus error (error-YYYY-MM-DD.log).
 * @param {object} param0
 */
function writeErrorToFile({ message, err, context, origin }) {
  try {
    const dir = ensureLogsDir();
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
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

module.exports = {
  stripAnsi,
  formatLogTimestamp,
  ensureLogsDir,
  checkRotateCentralLog,
  buildSessionHeader,
  writeToCentralLog,
  writeErrorToFile,
  logsDir,
  centralLogFile,
};

