#!/usr/bin/env node
"use strict";

const { spawnSync } = require("node:child_process");
const path = require("node:path");

const SUITES = [
  {
    id: "r1",
    name: "R1: Advanced Music System (Seek, Sleep, WebSocket)",
    file: "r1_music.e2e.test.js",
  },
  {
    id: "r2",
    name: "R2: Arcade Minigames (Blackjack 52-Card & TypeRacer Modal)",
    file: "r2_minigames.e2e.test.js",
  },
  {
    id: "r3",
    name: "R3: Web Dashboard Studios (Soundboard WS & Automod Sync)",
    file: "r3_dashboard.e2e.test.js",
  },
  {
    id: "r4",
    name: "R4: Proactive Automod (Phishing Shield < 50ms & GhostPing)",
    file: "r4_automod.e2e.test.js",
  },
  {
    id: "r5",
    name: "R5: Smart Utilities (Carbon Codeview & High-Res Poll Chart)",
    file: "r5_utilities.e2e.test.js",
  },
];

const ROOT_DIR = path.resolve(__dirname, "../..");
const E2E_DIR = __dirname;

function parseArgs() {
  const args = process.argv.slice(2);
  let filter = null;

  for (const arg of args) {
    if (arg.startsWith("--suite=")) {
      filter = arg.split("=")[1].toLowerCase();
    } else if (arg.startsWith("--filter=")) {
      filter = arg.split("=")[1].toLowerCase();
    } else if (!arg.startsWith("-")) {
      filter = arg.toLowerCase();
    }
  }

  return { filter };
}

function runSuite(suite) {
  const testPath = path.join(E2E_DIR, suite.file);
  const startTime = Date.now();

  const result = spawnSync(process.execPath, [testPath], {
    cwd: ROOT_DIR,
    env: { ...process.env, NODE_ENV: "test" },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  const durationMs = Date.now() - startTime;
  const stdout = result.stdout || "";
  const stderr = result.stderr || "";

  // Parse pass/fail counts from node:test output
  const passMatch = stdout.match(/ℹ pass (\d+)/);
  const failMatch = stdout.match(/ℹ fail (\d+)/);
  const passCount = passMatch ? parseInt(passMatch[1], 10) : 0;
  const failCount = failMatch ? parseInt(failMatch[1], 10) : 0;
  const exitCode = result.status ?? (result.error ? 1 : 0);

  return {
    ...suite,
    exitCode,
    passed: exitCode === 0 && failCount === 0,
    passCount,
    failCount,
    durationMs,
    stdout,
    stderr,
  };
}

function main() {
  const { filter } = parseArgs();

  let selectedSuites = SUITES;
  if (filter) {
    selectedSuites = SUITES.filter(
      (s) =>
        s.id.toLowerCase() === filter ||
        s.file.toLowerCase().includes(filter) ||
        s.name.toLowerCase().includes(filter),
    );

    if (selectedSuites.length === 0) {
      console.error(`[Runner] Error: Tidak ada test suite yang cocok dengan filter "${filter}".`);
      console.log("Pilihan yang tersedia: r1, r2, r3, r4, r5");
      process.exit(1);
    }
  }

  console.log("================================================================================");
  console.log("        NAURA HOSHINO V2 - COMPREHENSIVE OPAQUE-BOX E2E TEST RUNNER");
  console.log("================================================================================");
  console.log(`Menjalankan ${selectedSuites.length} test suite E2E (Tiers 1-4)...\n`);

  const results = [];
  let totalPass = 0;
  let totalFail = 0;
  let hasFailure = false;
  const overallStart = Date.now();

  for (const suite of selectedSuites) {
    process.stdout.write(`[RUN] ${suite.name} ... `);
    const res = runSuite(suite);
    results.push(res);

    totalPass += res.passCount;
    totalFail += res.failCount;

    if (res.passed) {
      console.log(`\x1b[32mPASSED\x1b[0m (${res.passCount} tests, ${(res.durationMs / 1000).toFixed(2)}s)`);
    } else {
      hasFailure = true;
      console.log(`\x1b[31mFAILED\x1b[0m (exit: ${res.exitCode}, fails: ${res.failCount}, ${(res.durationMs / 1000).toFixed(2)}s)`);
      if (res.stderr) {
        console.error("\x1b[33m" + res.stderr.trim() + "\x1b[0m");
      }
      if (res.stdout) {
        console.error(res.stdout);
      }
    }
  }

  const overallDuration = ((Date.now() - overallStart) / 1000).toFixed(2);

  console.log("\n================================================================================");
  console.log("                           E2E TEST SUITE SUMMARY");
  console.log("================================================================================");
  console.log(`Total Suites : ${results.length}`);
  console.log(`Suites Passed: ${results.filter((r) => r.passed).length}`);
  console.log(`Suites Failed: ${results.filter((r) => !r.passed).length}`);
  console.log(`Total Tests  : ${totalPass + totalFail}`);
  console.log(`Tests Passed : \x1b[32m${totalPass}\x1b[0m`);
  console.log(`Tests Failed : ${totalFail > 0 ? `\x1b[31m${totalFail}\x1b[0m` : "0"}`);
  console.log(`Total Waktu  : ${overallDuration}s`);
  console.log("================================================================================");

  if (hasFailure) {
    console.error("\x1b[31m[FAILED] Satu atau lebih test suite E2E gagal.\x1b[0m\n");
    process.exit(1);
  } else {
    console.log("\x1b[32m[SUCCESS] Seluruh 5 pilar inovasi E2E lulus 100% tanpa cacat.\x1b[0m\n");
    process.exit(0);
  }
}

main();
