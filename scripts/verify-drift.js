"use strict";

/**
 * verify-drift.js - Codebase Drift & Convention Conformance Scanner
 *
 * Mengadopsi prinsip VibeDrift & Buildomator untuk mendeteksi degradasi arsitektur,
 * inkonsistensi konvensi, dan pola kode terlarang sesuai RULES.md & AGENTS.md.
 *
 * Pemakaian:
 *   node scripts/verify-drift.js
 *   npm run verify:drift
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

const SCAN_DIRS = ["src", "plugin"];
const SKIP_DIRS = new Set(["node_modules", ".git", "dashboard", "backups", "scratch", "dist"]);

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
  gray: "\x1b[90m",
};

const VIOLATIONS = [];

function record(type, file, line, message, severity = "ERROR") {
  VIOLATIONS.push({
    type,
    file: path.relative(ROOT, file),
    line,
    message,
    severity,
  });
}

function scanFile(filePath) {
  let content = "";
  try {
    content = fs.readFileSync(filePath, "utf8");
  } catch {
    return;
  }

  const lines = content.split("\n");
  const relPath = path.relative(ROOT, filePath).replace(/\\/g, "/");

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    const trimmed = line.trim();

    // 1. Larangan process.env langsung di luar src/config/
    if (
      trimmed.includes("process.env.") &&
      !relPath.startsWith("src/config/") &&
      !relPath.includes("test")
    ) {
      record(
        "ENV_LEAK",
        filePath,
        lineNum,
        "Akses 'process.env' langsung terdeteksi. Wajib impor { env } dari 'src/config/env.js'.",
        "ERROR",
      );
    }

    // 2. Larangan ephemeral: true (Wajib MessageFlags.Ephemeral)
    if (
      /ephemeral\s*:\s*true/i.test(trimmed) &&
      !trimmed.startsWith("//") &&
      !relPath.includes("test")
    ) {
      record(
        "EPHEMERAL_FLAG",
        filePath,
        lineNum,
        "Penggunaan 'ephemeral: true' terdeteksi. Gunakan 'flags: MessageFlags.Ephemeral'.",
        "WARNING",
      );
    }

    // 3. Deteksi em-dash (\u2014)
    if (line.includes("\u2014")) {
      record(
        "EM_DASH",
        filePath,
        lineNum,
        "Karakter em dash (\u2014) terdeteksi. Wajib gunakan tanda minus (-) atau koma.",
        "ERROR",
      );
    }

    // 4. Deteksi phantom stub / placeholder tanpa implementasi
    if (
      /\/\/\s*TODO:\s*(implement|fill|tbd|code here)/i.test(trimmed) ||
      /\/\/\s*PLACEHOLDER/i.test(trimmed)
    ) {
      record(
        "PHANTOM_SCAFFOLD",
        filePath,
        lineNum,
        `Stub placeholder terdeteksi: "${trimmed}". Selesaikan atau hapus.`,
        "WARNING",
      );
    }
  });
}

function traverse(dir) {
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      traverse(full);
    } else if (entry.isFile() && (entry.name.endsWith(".js") || entry.name.endsWith(".mjs"))) {
      scanFile(full);
    }
  }
}

function main() {
  console.log(`\n${C.bold}${C.cyan}=== PEMINDAI DRIFT & KESESUAIAN KONVENSI (BUILDOMATOR VIBEDRIFT) ===${C.reset}`);
  console.log(`Memindai direktori: ${SCAN_DIRS.join(", ")}...\n`);

  for (const dir of SCAN_DIRS) {
    const fullPath = path.join(ROOT, dir);
    if (fs.existsSync(fullPath)) {
      traverse(fullPath);
    }
  }

  const errors = VIOLATIONS.filter((v) => v.severity === "ERROR");
  const warnings = VIOLATIONS.filter((v) => v.severity === "WARNING");

  if (VIOLATIONS.length === 0) {
    console.log(`${C.green}${C.bold}✔ REPOSITORI BERSIH DARI DRIFT!${C.reset}`);
    console.log(`Tidak ada pelanggaran konvensi RULES.md, akses env liar, atau phantom code.\n`);
    process.exit(0);
  }

  console.log(`${C.bold}Hasil Analisis:${C.reset} ${errors.length} Error, ${warnings.length} Warning\n`);

  for (const v of VIOLATIONS) {
    const color = v.severity === "ERROR" ? C.red : C.yellow;
    console.log(`  ${color}[${v.severity}] [${v.type}]${C.reset} ${C.bold}${v.file}:${v.line}${C.reset}`);
    console.log(`    ${C.gray}L ${v.message}${C.reset}\n`);
  }

  if (errors.length > 0) {
    console.log(`${C.red}${C.bold}✖ Ditemukan pelanggaran konvensi tingkat kritis.${C.reset}`);
    process.exit(1);
  } else {
    console.log(`${C.yellow}${C.bold}⚠ Hanya ditemukan peringatan (non-fatal).${C.reset}\n`);
    process.exit(0);
  }
}

main();
