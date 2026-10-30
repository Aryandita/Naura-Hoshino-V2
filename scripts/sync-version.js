#!/usr/bin/env node
"use strict";

/**
 * scripts/sync-version.js
 * Sinkronisasi versi dari package.json ke seluruh codebase.
 * Jalankan: node scripts/sync-version.js [--check]
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PKG_PATH = path.join(ROOT, "package.json");
const MANIFEST_PATH = path.join(ROOT, "src/config/discordActivityManifest.json");
const DASHBOARD_SRC = path.join(ROOT, "dashboard/src");

function readPkgVersion() {
  const pkg = JSON.parse(fs.readFileSync(PKG_PATH, "utf8"));
  return pkg.version;
}

function walk(dir, exts = [".js", ".mjs", ".json", ".html"], skipDirs = ["node_modules", ".git", "dist", ".kilo"]) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.isDirectory()) {
      if (!skipDirs.includes(e.name)) {
        files.push(...walk(path.join(dir, e.name), exts, skipDirs));
      }
    } else if (exts.some(ext => e.name.endsWith(ext))) {
      files.push(path.join(dir, e.name));
    }
  }
  return files;
}

function replaceVersionInFile(filePath, oldVer, newVer, dryRun = false) {
  let content = fs.readFileSync(filePath, "utf8");
  const oldV = `v${oldVer}`;
  const newV = `v${newVer}`;
  const oldNoV = oldVer;
  const newNoV = newVer;

  let changed = false;

  // 1. Replace v2.4.0 patterns (version with v prefix) - most common in dashboard
  if (content.includes(oldV)) {
    content = content.replaceAll(oldV, newV);
    changed = true;
  }

  // 2. Replace bare version in known contexts
  const patterns = [
    // User-Agent headers: NauraBot/2.4.0 or NauraHoshinoBot/2.4.0
    { re: new RegExp(`Naura(Bot|HoshinoBot)/${oldNoV.replace(/\./g, "\\.")}`, "g"), rep: `Naura$1/${newNoV}` },
    // Manifest version field: "version": "2.4.0"
    { re: new RegExp(`"version"\\s*:\\s*"${oldNoV.replace(/\./g, "\\.")}"`, "g"), rep: `"version": "${newNoV}"` },
    // JSDoc @version 2.4.0
    { re: new RegExp(`@version\\s+${oldNoV.replace(/\./g, "\\.")}`, "g"), rep: `@version ${newNoV}` },
    // query cache busting ?v=2.4.0 or &v=2.4.0
    { re: new RegExp(`[?&]v=${oldNoV.replace(/\./g, "\\.")}`, "g"), rep: `?v=${newNoV}` },
    // fallback: env.BOT_VERSION || "2.4.0"  -> env.BOT_VERSION
    { re: new RegExp(`env\\.(BOT_VERSION|ENGINE_VERSION|BASE_VERSION)\\s*\\|\\|\\s*["']${oldNoV.replace(/\./g, "\\.")}["']`, "g"), rep: `env.$1` },
    // fallback: BOT_VERSION || "2.4.0"
    { re: new RegExp(`(BOT_VERSION|ENGINE_VERSION|BASE_VERSION)\\s*\\|\\|\\s*["']${oldNoV.replace(/\./g, "\\.")}["']`, "g"), rep: `$1` },
    // fallback: packageJson.version || "2.4.0"
    { re: new RegExp(`packageJson\\.version\\s*\\|\\|\\s*["']${oldNoV.replace(/\./g, "\\.")}["']`, "g"), rep: `packageJson.version` },
    // fallback: "2.4.0" in version.js try/catch
    { re: new RegExp(`packageJson = \\{ version: ["']${oldNoV.replace(/\./g, "\\.")}["'] \\}`, "g"), rep: `packageJson = { version: "${newNoV}" }` },
  ];

  for (const p of patterns) {
    if (p.re.test(content)) {
      content = content.replace(p.re, p.rep);
      changed = true;
    }
  }

  if (changed && !dryRun) {
    fs.writeFileSync(filePath, content, "utf8");
  }
  return changed;
}

function syncAll(newVer, dryRun = false) {
  const oldVer = readPkgVersion(); // will be old if package.json not yet bumped
  // Actually, if package.json already updated, oldVer from existing files may differ.
  // We need to find the "drift" version in files. Simpler: we know current files say 2.4.0.
  // For safety, we detect the most common version string in codebase (excluding package.json).
  // But for this run, we know target is 2.4.0. We'll use that as old baseline.

  // Find version actually used in source (excluding package.json, version.js fallback)
  const sourceFiles = [
    ...walk(path.join(ROOT, "src"), [".js", ".mjs", ".json"]),
    ...walk(path.join(ROOT, "plugin"), [".js"]),
    ...walk(DASHBOARD_SRC, [".html", ".js"]),
    MANIFEST_PATH,
  ].filter(f => !f.includes("node_modules") && !f.includes(".kilo") && !f.includes("dist"));

  let changedCount = 0;
  for (const f of sourceFiles) {
    try {
      if (replaceVersionInFile(f, oldVer, newVer, dryRun)) {
        changedCount++;
        console.log(`${dryRun ? "[CHECK] " : "[SYNC] "} ${path.relative(ROOT, f)}`);
      }
    } catch (e) {
      console.error(`Error processing ${f}:`, e.message);
    }
  }

  console.log(`\n${dryRun ? "Files needing sync" : "Files synced"}: ${changedCount}`);
  return changedCount;
}

const isCheck = process.argv.includes("--check");
const targetVersion = readPkgVersion();

console.log(`Target version: ${targetVersion}`);
console.log(`Mode: ${isCheck ? "CHECK (dry-run)" : "SYNC (write)"}\n`);

const changes = syncAll(targetVersion, isCheck);
process.exit(changes > 0 && isCheck ? 1 : 0);