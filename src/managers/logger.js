const fs = require("fs");
const path = require("path");

// Tentukan lokasi folder 'logs' di folder utama (sejajar dengan index.js)
const logsDir = path.join(__dirname, "../../logs");

// Fitur Otomatis: Jika folder 'logs' belum ada, bot akan membuatnya!
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
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
  error: (message, err = null) => {
    console.error(
      `\x1b[41m\x1b[37m 💥 ERROR \x1b[0m \x1b[31m${message}\x1b[0m`,
    );
    if (err) console.error(err);
    broadcastLog("error", `${message}${err ? " | " + err.message : ""}`);
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
};

// Sentry Integration (Optional)
let Sentry = null;
try {
  if (process.env.SENTRY_DSN) {
    Sentry = require("@sentry/node");
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 1.0,
    });
    logger.system("[SENTRY] Sentry initialized for error tracking.");
  }
} catch (err) {
  // Ignore if not installed or failed to load
}

function logError(type, error) {
  try {
    const now = new Date();

    // Sentry Reporting
    if (Sentry && error instanceof Error) {
      Sentry.captureException(error, {
        tags: { type },
      });
    }

    // Membentuk format waktu untuk NAMA FILE (Tidak boleh ada tanda titik dua : atau slash /)
    // Hasil: "2026-03-21_10-01-00"
    const dateStr = now
      .toISOString()
      .replace(/T/, "_")
      .replace(/:/g, "-")
      .substring(0, 19);

    // Membersihkan nama tipe error dari karakter aneh agar aman dijadikan nama file
    const safeType = type.replace(/[^a-zA-Z0-9_\-]/g, "_");

    // Nama file final: misal [2026-03-21_10-01-00]_Command_Error.log
    const fileName = `[${dateStr}]_${safeType}.log`;
    const filePath = path.join(logsDir, fileName);

    // Membentuk ISI teks dari file log
    const timestamp = `[${now.toISOString().replace("T", " ").substring(0, 19)}]`;
    const errorMessage = error instanceof Error ? error.stack : error;

    const logEntry =
      `==================================================\n` +
      `WAKTU      : ${timestamp}\n` +
      `TIPE ERROR : ${type}\n` +
      `==================================================\n\n` +
      `=== DETAIL ERROR ===\n${errorMessage}\n`;

    // Menulis langsung ke file baru! (writeFileSync = membuat file baru / menimpa)
    fs.writeFileSync(filePath, logEntry, "utf8");

    // FORMAT BARU: Log File Creation (Hijau)
    logger.success(`Error telah dicatat dengan rapi di: logs/${fileName}`);
  } catch (e) {
    // FORMAT BARU: Log Fatal Error (Merah)
    logger.error(
      "\x1b[41m\x1b[37m 💥 LOGGER FATAL \x1b[0m \x1b[31mGagal menulis ke sistem file log:\x1b[0m",
      e,
    );
  }
}

// Global Promise Rejection handler
process.on("unhandledRejection", (reason, promise) => {
  logError("Unhandled_Rejection", reason || "Unknown Rejection");
});
process.on("uncaughtException", (error) => {
  logError("Uncaught_Exception", error);
  // Important: allow it to crash gracefully or let PM2 restart
});

module.exports = { logError, logger, Sentry };
