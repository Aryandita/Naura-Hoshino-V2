"use strict";

/**
 * scripts/view-logs.js - Centralized Log Monitor & Terminal Viewer
 * Naura Hoshino V2 - Cyber-Anime Glassmorphism Console Utility
 *
 * Menampilkan, memfilter, dan memantau log terpusat (logs/naura.log)
 * dengan ASCII Art banner, penataan kolom rapi, dan warna ANSI cerah.
 *
 * Penggunaan:
 *   node scripts/view-logs.js [opsi]
 *   npm run logs
 *   npm run logs:tail
 *   npm run logs:errors
 *
 * Opsi:
 *   --tail, -n <jumlah>   Tampilkan N baris terakhir (default: 50)
 *   --level, -l <level>   Filter berdasarkan level (error, warn, info, system, audio, db, debug)
 *   --errors              Shortcut filter untuk level error saja
 *   --search, -s <teks>   Cari log yang memuat kata kunci tertentu
 *   --follow, -f          Pantau log secara real-time (live stream tail)
 *   --stats               Tampilkan hanya kartu statistik file log
 *   --clear               Arsipkan dan bersihkan log terpusat saat ini
 *   --all, -a             Tampilkan seluruh isi file log
 *   --help, -h            Tampilkan bantuan ini
 */

const fs = require("fs");
const env = require("../src/config/env");
const {
  logger,
  getLogStats,
  getLogFilePath,
  clearLogs,
} = require("../src/managers/logger");

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[90m",
  white: "\x1b[97m",
  cyan: "\x1b[36m",
  brightCyan: "\x1b[38;5;87m",
  sky: "\x1b[38;5;153m",
  gold: "\x1b[38;5;220m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  purple: "\x1b[35m",
  blue: "\x1b[34m",
  pink: "\x1b[38;5;218m",
  lightPink: "\x1b[38;5;225m",
  magenta: "\x1b[38;5;213m",
  bgCyan: "\x1b[46m\x1b[30m",
  bgGreen: "\x1b[42m\x1b[30m",
  bgYellow: "\x1b[43m\x1b[30m",
  bgRed: "\x1b[41m\x1b[97m",
  bgPink: "\x1b[48;5;218m\x1b[30m",
  bgPurple: "\x1b[45m\x1b[97m",
  bgBlue: "\x1b[44m\x1b[97m",
  bgDim: "\x1b[100m\x1b[97m",
};

/**
 * Menampilkan ASCII Art Banner sistem log ke terminal.
 */
function displayAsciiArtBanner() {
  const botVer = env.BOT_VERSION || "2.3.0";
  const shardTxt = env.SHARD_ID != null ? `Shard #${env.SHARD_ID}` : "Standalone";

  const lines = [
    `${C.brightCyan}╔══════════════════════════════════════════════════════════════════════════════╗${C.reset}`,
    `${C.brightCyan}║${C.lightPink}  ██╗  ██╗  █████╗  ██╗   ██╗ ██████╗   █████╗   ${C.reset} ${C.gold}${C.bold}NAURA HOSHINO V${botVer}${C.reset}     ${C.brightCyan}║${C.reset}`,
    `${C.brightCyan}║${C.pink}  ███╗ ██║ ██╔══██╗ ██║   ██║ ██╔══██╗ ██╔══██╗  ${C.reset} ${C.white}CENTRALIZED SYSTEM LOG${C.reset}       ${C.brightCyan}║${C.reset}`,
    `${C.brightCyan}║${C.magenta}  ██╔██╗██║ ███████║ ██║   ██║ ██████╔╝ ███████║  ${C.reset} ${C.sky}Live Terminal Monitor${C.reset}        ${C.brightCyan}║${C.reset}`,
    `${C.brightCyan}║${C.purple}  ██║╚████║ ██╔══██║ ██║   ██║ ██╔══██╗ ██╔══██║  ${C.reset} ${C.dim}Cluster: ${shardTxt.padEnd(20)}${C.reset}${C.brightCyan}║${C.reset}`,
    `${C.brightCyan}║${C.pink}  ██║ ╚███║ ██║  ██║ ╚██████╔╝ ██║  ██║ ██║  ██║  ${C.reset} ${C.dim}Active: logs/naura.log       ${C.reset}${C.brightCyan}║${C.reset}`,
    `${C.brightCyan}║${C.purple}  ╚═╝  ╚══╝ ╚═╝  ╚═╝  ╚═════╝  ╚═╝  ╚═╝ ╚═╝  ╚═╝  ${C.reset}                              ${C.brightCyan}║${C.reset}`,
    `${C.brightCyan}╚══════════════════════════════════════════════════════════════════════════════╝${C.reset}`,
  ];
  console.log("\n" + lines.join("\n") + "\n");
}

/**
 * Menampilkan ringkasan statistik file log terpusat.
 * @param {object} stats
 */
function displayStatsCard(stats) {
  const BOX_W = 78;
  const top = `${C.brightCyan}╭─${" STATISTIK LOG TERPUSAT ".padEnd(BOX_W - 4, "─")}─╮${C.reset}`;
  const bot = `${C.brightCyan}╰${"─".repeat(BOX_W - 2)}╯${C.reset}`;

  const row1 = `  ${C.dim}Lokasi File:${C.reset} ${C.white}${stats.path}${C.reset}`;
  const row2 = `  ${C.dim}Ukuran:${C.reset} ${C.gold}${stats.sizeFormatted}${C.reset}   ${C.dim}Total Baris:${C.reset} ${C.sky}${stats.totalLines.toLocaleString()}${C.reset}   ${C.dim}Status:${C.reset} ${stats.exists ? `${C.green}● Aktif${C.reset}` : `${C.yellow}○ Kosong${C.reset}`}`;
  const row3 = `  ${C.dim}Rincian:${C.reset}  ${C.red}💥 ${stats.errorCount} Galat${C.reset}   ${C.yellow}⚠️ ${stats.warnCount} Peringatan${C.reset}   ${C.cyan}ℹ️ ${stats.infoCount} Info${C.reset}`;

  console.log(top);
  console.log(row1);
  console.log(row2);
  console.log(row3);
  console.log(bot + "\n");
}

/**
 * Memformat dan mewarnai satu baris log untuk konsol terminal.
 * @param {string} rawLine
 * @returns {string}
 */
function colorizeLogLine(rawLine) {
  if (!rawLine) return "";

  // Garis separator pembuka sesi / ASCII Banner
  if (rawLine.startsWith("==") || rawLine.startsWith("╔═") || rawLine.startsWith("╚═")) {
    return `${C.brightCyan}${rawLine}${C.reset}`;
  }
  if (rawLine.includes("██╗") || rawLine.includes("NAURA HOSHINO")) {
    return `${C.pink}${C.bold}${rawLine}${C.reset}`;
  }

  // Baris log terstruktur: [YYYY-MM-DD HH:mm:ss.SSS] [LEVEL   ] [Origin: ...] Message
  const match = rawLine.match(/^\[(.*?)\]\s+\[([A-Z]+)\s*\](?:\s+\[Origin:\s*(.*?)\])?\s*(.*)$/);
  if (match) {
    const timestamp = match[1];
    const level = match[2];
    const origin = match[3];
    const message = match[4];

    let badge = "";
    let msgColor = C.white;

    switch (level) {
      case "ERROR":
        badge = `${C.bgRed} 💥 ERROR    ${C.reset}`;
        msgColor = C.red;
        break;
      case "WARN":
        badge = `${C.bgYellow} ⚠️  WARNING  ${C.reset}`;
        msgColor = C.yellow;
        break;
      case "INFO":
        badge = `${C.bgCyan} ℹ️  INFO     ${C.reset}`;
        msgColor = C.cyan;
        break;
      case "SUCCESS":
        badge = `${C.bgGreen} ✨ SUCCESS  ${C.reset}`;
        msgColor = C.green;
        break;
      case "SYSTEM":
        badge = `${C.bgPink} 🌸 SYSTEM   ${C.reset}`;
        msgColor = C.lightPink;
        break;
      case "AUDIO":
        badge = `${C.bgPurple} 🎵 AUDIO    ${C.reset}`;
        msgColor = C.purple;
        break;
      case "DATABASE":
        badge = `${C.bgBlue} 🗄️  DATABASE ${C.reset}`;
        msgColor = C.blue;
        break;
      case "DEBUG":
        badge = `${C.bgDim} 🔍 DEBUG    ${C.reset}`;
        msgColor = C.dim;
        break;
      default:
        badge = `${C.dim}[${level.padEnd(8)}]${C.reset}`;
        msgColor = C.white;
    }

    const timeFmt = `${C.dim}[${timestamp}]${C.reset}`;
    const originFmt = origin ? ` ${C.gold}[${origin}]${C.reset}` : "";
    return `${timeFmt} ${badge}${originFmt} ${msgColor}${message}${C.reset}`;
  }

  // Baris lanjutan error (ERROR, STACK, CONTEXT)
  if (rawLine.startsWith("  ERROR  :")) {
    return `${C.red}${C.bold}${rawLine}${C.reset}`;
  }
  if (rawLine.startsWith("  STACK  :") || rawLine.startsWith("    at ")) {
    return `${C.dim}${rawLine}${C.reset}`;
  }
  if (rawLine.startsWith("  CONTEXT:")) {
    return `${C.sky}${rawLine}${C.reset}`;
  }

  return rawLine;
}

/**
 * Mode Streaming / Follow (Live Tail).
 * @param {string} filePath
 * @param {object} filterOptions
 */
function startFollowMode(filePath, filterOptions) {
  console.log(`${C.green}⚡ Memulai mode pantau real-time (Live Tail)...${C.reset}`);
  console.log(`${C.dim}Menunggu baris log baru di ${filePath} (Tekan Ctrl+C untuk berhenti)${C.reset}\n`);

  let currentSize = 0;
  if (fs.existsSync(filePath)) {
    currentSize = fs.statSync(filePath).size;
  }

  const checkInterval = 500; // ms
  setInterval(() => {
    try {
      if (!fs.existsSync(filePath)) return;
      const stats = fs.statSync(filePath);

      if (stats.size < currentSize) {
        // File dipotong atau dirotasi
        currentSize = 0;
      }

      if (stats.size > currentSize) {
        const stream = fs.createReadStream(filePath, {
          start: currentSize,
          end: stats.size,
          encoding: "utf8",
        });

        let buffer = "";
        stream.on("data", (chunk) => {
          buffer += chunk;
        });

        stream.on("end", () => {
          currentSize = stats.size;
          const newLines = buffer.split("\n");
          for (const line of newLines) {
            if (!line.trim()) continue;

            if (filterOptions.level) {
              const lvlUpper = filterOptions.level.toUpperCase();
              if (!line.includes(`[${lvlUpper}`)) continue;
            }

            if (filterOptions.search) {
              const sLower = filterOptions.search.toLowerCase();
              if (!line.toLowerCase().includes(sLower)) continue;
            }

            console.log(colorizeLogLine(line));
          }
        });
      }
    } catch (_) {
      // Non-fatal stream error
    }
  }, checkInterval);
}

/**
 * Menampilkan panduan bantuan CLI.
 */
function printHelp() {
  console.log(`${C.bold}${C.brightCyan}Naura Hoshino V2 - Centralized Log Monitor${C.reset}`);
  console.log(`\n${C.white}Perintah & Penggunaan:${C.reset}`);
  console.log(`  node scripts/view-logs.js [opsi]`);
  console.log(`  npm run logs                 Tampilkan 50 log terakhir`);
  console.log(`  npm run logs:tail            Pantau log langsung (streaming tail)`);
  console.log(`  npm run logs:errors          Tampilkan hanya daftar galat`);
  console.log(`\n${C.white}Opsi Argumen:${C.reset}`);
  console.log(`  --tail, -n <angka>   Jumlah baris yang diambil (default: 50)`);
  console.log(`  --level, -l <level>  Filter level: error, warn, info, system, audio, db, debug`);
  console.log(`  --errors             Shortcut cepat untuk --level error`);
  console.log(`  --search, -s <teks>  Cari pesan yang memuat kata kunci tertentu`);
  console.log(`  --follow, -f         Pantau penambahan baris secara langsung (live tail)`);
  console.log(`  --stats              Tampilkan hanya kartu statistik file log`);
  console.log(`  --clear              Arsipkan dan buat file log terpusat baru`);
  console.log(`  --all, -a            Tampilkan seluruh entri dari awal`);
  console.log(`  --help, -h           Tampilkan informasi bantuan ini\n`);
}

/**
 * Fungsi utama eksekusi CLI.
 */
function main() {
  const args = process.argv.slice(2);

  let tailCount = 50;
  let levelFilter = null;
  let searchQuery = null;
  let isFollow = false;
  let isStatsOnly = false;
  let isClear = false;
  let isAll = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") {
      printHelp();
      return;
    }
    if (arg === "--tail" || arg === "-n") {
      const next = args[i + 1];
      if (next && !isNaN(Number(next))) {
        tailCount = Number(next);
        i++;
      }
    } else if (arg === "--level" || arg === "-l") {
      const next = args[i + 1];
      if (next && !next.startsWith("-")) {
        levelFilter = next.toUpperCase();
        i++;
      }
    } else if (arg === "--errors") {
      levelFilter = "ERROR";
    } else if (arg === "--search" || arg === "-s") {
      const next = args[i + 1];
      if (next && !next.startsWith("-")) {
        searchQuery = next;
        i++;
      }
    } else if (arg === "--follow" || arg === "-f") {
      isFollow = true;
    } else if (arg === "--stats") {
      isStatsOnly = true;
    } else if (arg === "--clear") {
      isClear = true;
    } else if (arg === "--all" || arg === "-a") {
      isAll = true;
    }
  }

  // Tampilkan banner ASCII Art utama
  displayAsciiArtBanner();

  if (isClear) {
    clearLogs();
    console.log(`${C.green}✔ File log terpusat berhasil diarsipkan dan dibersihkan.${C.reset}\n`);
    return;
  }

  const stats = getLogStats();
  displayStatsCard(stats);

  if (isStatsOnly) return;

  const logFile = getLogFilePath();
  if (!fs.existsSync(logFile)) {
    console.log(`${C.yellow}ℹ️ File logs/naura.log belum terbentuk.${C.reset}`);
    console.log(`${C.dim}Menjalankan logger uji coba untuk inisialisasi awal...${C.reset}`);
    logger.system("Inisialisasi monitor log terpusat via scripts/view-logs.js");
  }

  // Jika follow mode aktif, mulai streaming
  if (isFollow) {
    startFollowMode(logFile, { level: levelFilter, search: searchQuery });
    return;
  }

  // Baca entri file log
  try {
    const rawContent = fs.readFileSync(logFile, "utf8");
    let lines = rawContent.split("\n").filter((l) => l.trim().length > 0);

    if (levelFilter) {
      lines = lines.filter((l) => l.includes(`[${levelFilter}`));
    }

    if (searchQuery) {
      const sLower = searchQuery.toLowerCase();
      lines = lines.filter((l) => l.toLowerCase().includes(sLower));
    }

    if (!isAll && typeof tailCount === "number" && tailCount > 0) {
      lines = lines.slice(-tailCount);
    }

    if (lines.length === 0) {
      console.log(`${C.dim}(Tidak ada entri log yang cocok dengan kriteria filter)${C.reset}\n`);
      return;
    }

    console.log(`${C.dim}── Menampilkan ${lines.length} baris log terbaru ──${C.reset}\n`);
    for (const line of lines) {
      console.log(colorizeLogLine(line));
    }
    console.log(`\n${C.dim}── Akhir dari log terpusat (Gunakan --follow atau -f untuk live monitoring) ──${C.reset}\n`);
  } catch (readErr) {
    console.error(`${C.red}✖ Gagal membaca file log: ${readErr.message}${C.reset}\n`);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  displayAsciiArtBanner,
  displayStatsCard,
  colorizeLogLine,
};
