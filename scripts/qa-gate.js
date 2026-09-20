"use strict";

/**
 * qa-gate.js - Automated QA Gate Runner (Naura Hoshino V2)
 * Menjalankan 5 tahapan pengujian standar kualitas sesuai AGENTS.md:
 * 1. ESLint linter & styling check
 * 2. Em-dash prohibition check (\u2014)
 * 3. i18n Locales parity strict check (id.json vs en.json)
 * 4. Internal module require graph check
 * 5. Automated unit test suite (node --test)
 *
 * Penggunaan:
 *   node scripts/qa-gate.js
 *   npm run qa
 */

const { spawn } = require("child_process");
const path = require("path");

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
  gray: "\x1b[90m",
};

const projectRoot = path.resolve(__dirname, "..");

function runStep(name, command, args) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    console.log(`\n${C.bold}${C.blue}▶ [QA GATE] Menjalankan: ${name}...${C.reset}`);

    const isWindows = process.platform === "win32";
    const actualCmd = isWindows && command === "npm" ? "npm.cmd" : command;

    const proc = spawn(actualCmd, args, {
      cwd: projectRoot,
      stdio: "inherit",
      shell: isWindows,
    });

    proc.on("close", (code) => {
      const durationMs = Date.now() - startTime;
      const success = code === 0;
      if (success) {
        console.log(`${C.green}✔ ${name} LOLOS (${(durationMs / 1000).toFixed(2)}s)${C.reset}`);
      } else {
        console.log(`${C.red}✖ ${name} GAGAL dengan exit code ${code} (${(durationMs / 1000).toFixed(2)}s)${C.reset}`);
      }
      resolve({ name, success, code, durationMs });
    });

    proc.on("error", (err) => {
      const durationMs = Date.now() - startTime;
      console.log(`${C.red}✖ ${name} ERROR: ${err.message}${C.reset}`);
      resolve({ name, success: false, code: 1, durationMs, error: err.message });
    });
  });
}

async function run() {
  console.log(`\n${C.bold}${C.cyan}====================================================${C.reset}`);
  console.log(`${C.bold}${C.cyan}  NAURA HOSHINO V2 - MASTER QA GATE RUNNER          ${C.reset}`);
  console.log(`${C.bold}${C.cyan}====================================================${C.reset}`);

  const totalStart = Date.now();
  const results = [];

  // 1. ESLint
  results.push(await runStep("1/5 ESLint & Standar Kode", "npm", ["run", "lint"]));

  // 2. Em dash check
  results.push(await runStep("2/5 Cek Larangan Karakter Em Dash", "node", ["scripts/check-em-dash.js"]));

  // 3. Paritas Kamus Bahasa
  results.push(await runStep("3/5 Paritas Kamus Bahasa (Strict)", "node", ["scripts/validate-locales.js", "--strict"]));

  // 4. Resolusi Require
  results.push(await runStep("4/5 Integritas Resolusi Require", "node", ["scripts/check-requires.js"]));

  // 5. Automated Unit Tests
  results.push(await runStep("5/5 Automated Unit Test Suite", "node", ["--test", "src/**/*.test.js"]));

  const totalDuration = ((Date.now() - totalStart) / 1000).toFixed(2);
  const allPassed = results.every((r) => r.success);

  console.log(`\n${C.bold}${C.cyan}====================================================${C.reset}`);
  console.log(`${C.bold}${C.cyan}                 RINGKASAN QA GATE                  ${C.reset}`);
  console.log(`${C.bold}${C.cyan}====================================================${C.reset}\n`);

  for (const r of results) {
    const status = r.success ? `${C.green}[PASS]${C.reset}` : `${C.red}[FAIL]${C.reset}`;
    const time = `${(r.durationMs / 1000).toFixed(2)}s`;
    console.log(`  ${status} ${r.name.padEnd(40)} : ${C.gray}${time}${C.reset}`);
  }

  console.log(`\n  ${C.bold}Waktu Total:${C.reset} ${totalDuration} detik`);

  if (allPassed) {
    console.log(`\n  ${C.green}${C.bold}✨ SEMUA 5 TAHAPAN QA GATE 100% HIJAU! SIAP UNTUK COMMIT / DEPLOY ✨${C.reset}\n`);
    process.exit(0);
  } else {
    console.log(`\n  ${C.red}${C.bold}⚠️ QA GATE GAGAL. Harap perbaiki error di atas sebelum commit!${C.reset}\n`);
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Kesalahan tak terduga pada QA Gate:", err);
  process.exit(1);
});
