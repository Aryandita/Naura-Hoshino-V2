"use strict";

/**
 * Inventarisasi dan pembersihan aman artefak pengujian prolog & TLS di hosting.
 *
 * Mode default adalah DRY-RUN (tidak menghapus apa pun).
 * Gunakan `--apply` untuk mengeksekusi penghapusan file/direktori sementara yang masuk whitelist.
 * Konfigurasi/data produksi (.env*, .loader_backup, .cache, backups, src/, dll.) dilindungi ketat.
 */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const RUNNER_PATTERN =
  /^story-(?:tls-check|checkpoint-preflight|pg-test-preflight|gemini-check|gemini-preflight)(?:-[a-z0-9._-]+)?\.cjs$/i;
const LOG_PATTERN =
  /^story-(?:tls|checkpoint|pg|gemini)-result(?:-[a-z0-9._-]+)?\.log$/i;
const MARKER_PATTERN = /^\.story-(?:tls|test|gemini|pg)-attempt-[a-z0-9._-]+$/i;
const CHECKOUT_MARKER_NAME = ".naura-story-test-checkout.json";
const TMP_CHECKOUT_DIR_PATTERN =
  /^(?:naura-story-(?:test|tls|hosted|gemini)|story-(?:test|tls|gemini))-[a-z0-9._-]+$/i;

const LOADER_HOOK_SIGNATURES = Object.freeze([
  { id: "tls_runner_ref", pattern: /story-tls-check/i },
  { id: "checkpoint_runner_ref", pattern: /story-checkpoint-preflight/i },
  { id: "pg_preflight_ref", pattern: /story-pg-test-preflight/i },
  { id: "tls_attempt_marker", pattern: /\.story-tls-attempt-/i },
  { id: "story_attempt_marker", pattern: /\.story-test-attempt-/i },
  { id: "gemini_attempt_marker", pattern: /\.story-gemini-attempt-/i },
  { id: "gemini_result_log", pattern: /story-gemini-result-/i },
  {
    id: "hosted_test_branch",
    pattern: /codex\/(?:story-(?:tls-hosted-test|prologue-test)|gemini-staging-checks)/i,
  },
  { id: "legacy_one_shot_hook", pattern: /one-shot.*(?:tls|story)|(?:tls|story).*one-shot/i },
]);

const PROTECTED_EXACT_NAMES = new Set([
  ".env",
  ".env alpha",
  ".env.local",
  ".env.production",
  ".env.staging",
  ".env.example",
  ".loader_backup",
  ".cache",
  ".git",
  "backups",
  "node_modules",
  "src",
  "plugin",
  "scripts",
  "dashboard",
  "assets",
  "docs",
  "test",
  "loader.js",
  "index.js",
  "shard.js",
  "package.json",
  "package-lock.json",
  "naura_fallback.sqlite",
]);

function isProtectedName(name) {
  const lower = String(name || "").trim().toLowerCase();
  if (!lower) return true;
  if (PROTECTED_EXACT_NAMES.has(lower)) return true;
  if (lower.startsWith(".env")) return true;
  if (
    lower.endsWith(".sqlite") ||
    lower.endsWith(".sqlite3") ||
    lower.endsWith(".db") ||
    lower.endsWith(".pem") ||
    lower.endsWith(".crt") ||
    lower.endsWith(".key")
  ) {
    return true;
  }
  return false;
}

function isInsideBase(baseDir, candidatePath) {
  const resolvedBase = path.resolve(baseDir);
  const resolvedCandidate = path.resolve(candidatePath);
  return (
    resolvedCandidate !== resolvedBase &&
    resolvedCandidate.startsWith(resolvedBase + path.sep)
  );
}

function directoryContainsProtectedEnv(dirPath) {
  try {
    const entries = fs.readdirSync(dirPath);
    return entries.some((entry) => String(entry).toLowerCase().startsWith(".env"));
  } catch {
    return true;
  }
}

function auditLoaderHooks(rootDir) {
  const loaderPath = path.join(rootDir, "loader.js");
  if (!fs.existsSync(loaderPath)) {
    return {
      exists: false,
      loaderPath,
      clean: true,
      findings: [],
    };
  }

  const content = fs.readFileSync(loaderPath, "utf8");
  const lines = content.split(/\r?\n/);
  const findings = [];

  lines.forEach((line, idx) => {
    for (const sig of LOADER_HOOK_SIGNATURES) {
      if (sig.pattern.test(line)) {
        findings.push({
          line: idx + 1,
          signature: sig.id,
          preview: line.trim().slice(0, 140),
        });
      }
    }
  });

  return {
    exists: true,
    loaderPath,
    clean: findings.length === 0,
    findings,
  };
}

function scanStoryHostedArtifacts({
  rootDir = process.cwd(),
  tmpDir = os.tmpdir(),
} = {}) {
  const resolvedRoot = path.resolve(rootDir);
  const resolvedTmp = path.resolve(tmpDir);

  const inventory = {
    rootDir: resolvedRoot,
    tmpDir: resolvedTmp,
    runners: [],
    logs: [],
    markers: [],
    checkoutMarkers: [],
    tempCheckouts: [],
    skippedProtected: [],
    loaderAudit: auditLoaderHooks(resolvedRoot),
  };

  if (fs.existsSync(resolvedRoot)) {
    const rootEntries = fs.readdirSync(resolvedRoot, { withFileTypes: true });
    for (const entry of rootEntries) {
      const name = entry.name;
      const fullPath = path.join(resolvedRoot, name);

      if (isProtectedName(name)) {
        if (name.toLowerCase().startsWith(".env") || name === ".loader_backup") {
          inventory.skippedProtected.push(fullPath);
        }
        continue;
      }

      if (!entry.isFile() && !entry.isSymbolicLink()) continue;

      if (RUNNER_PATTERN.test(name)) {
        inventory.runners.push(fullPath);
      } else if (LOG_PATTERN.test(name)) {
        inventory.logs.push(fullPath);
      } else if (MARKER_PATTERN.test(name)) {
        inventory.markers.push(fullPath);
      } else if (name === CHECKOUT_MARKER_NAME) {
        inventory.checkoutMarkers.push(fullPath);
      }
    }
  }

  if (fs.existsSync(resolvedTmp)) {
    let tmpEntries = [];
    try {
      tmpEntries = fs.readdirSync(resolvedTmp, { withFileTypes: true });
    } catch {
      tmpEntries = [];
    }
    for (const entry of tmpEntries) {
      if (!entry.isDirectory()) continue;
      const name = entry.name;
      if (isProtectedName(name)) continue;
      const dirPath = path.join(resolvedTmp, name);
      if (!isInsideBase(resolvedTmp, dirPath)) continue;

      let matched = TMP_CHECKOUT_DIR_PATTERN.test(name);
      if (!matched) {
        const markerFile = path.join(dirPath, CHECKOUT_MARKER_NAME);
        if (fs.existsSync(markerFile)) {
          try {
            const parsed = JSON.parse(fs.readFileSync(markerFile, "utf8"));
            if (parsed?.purpose === "disposable-story-test") {
              matched = true;
            }
          } catch {
            // Abaikan JSON tidak valid di temp dir milik alat lain
          }
        }
      }

      if (!matched) continue;

      if (directoryContainsProtectedEnv(dirPath)) {
        inventory.skippedProtected.push(dirPath);
        continue;
      }

      inventory.tempCheckouts.push(dirPath);
    }
  }

  return inventory;
}

function applyStoryHostedCleanup(options = {}) {
  const {
    apply = false,
    rootDir = process.cwd(),
    tmpDir = os.tmpdir(),
  } = options;
  const inventory = scanStoryHostedArtifacts({ rootDir, tmpDir });
  const deleted = [];
  const errors = [];

  const fileTargets = [
    ...inventory.runners,
    ...inventory.logs,
    ...inventory.markers,
    ...inventory.checkoutMarkers,
  ];

  if (!apply) {
    return {
      mode: "dry-run",
      inventory,
      candidateCount: fileTargets.length + inventory.tempCheckouts.length,
      deleted,
      errors,
    };
  }

  for (const target of fileTargets) {
    try {
      const base = path.basename(target);
      if (
        isProtectedName(base) ||
        !isInsideBase(inventory.rootDir, target)
      ) {
        inventory.skippedProtected.push(target);
        continue;
      }
      fs.unlinkSync(target);
      deleted.push(target);
    } catch (err) {
      errors.push({ path: target, error: err?.message || String(err) });
    }
  }

  for (const dirTarget of inventory.tempCheckouts) {
    try {
      if (
        !isInsideBase(inventory.tmpDir, dirTarget) ||
        directoryContainsProtectedEnv(dirTarget)
      ) {
        inventory.skippedProtected.push(dirTarget);
        continue;
      }
      fs.rmSync(dirTarget, { recursive: true, force: true });
      deleted.push(dirTarget);
    } catch (err) {
      errors.push({ path: dirTarget, error: err?.message || String(err) });
    }
  }

  return {
    mode: "apply",
    inventory,
    candidateCount: fileTargets.length + inventory.tempCheckouts.length,
    deleted,
    errors,
  };
}

function parseCliArgs(argv) {
  const args = Array.isArray(argv) ? argv : [];
  let apply = false;
  let json = false;
  let rootDir = path.resolve(__dirname, "..");
  let tmpDir = os.tmpdir();

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--apply") apply = true;
    else if (arg === "--json") json = true;
    else if (arg === "--root" && args[i + 1]) {
      rootDir = args[i + 1];
      i += 1;
    } else if (arg === "--tmp-dir" && args[i + 1]) {
      tmpDir = args[i + 1];
      i += 1;
    }
  }

  return { apply, json, rootDir, tmpDir };
}

if (require.main === module) {
  const opts = parseCliArgs(process.argv.slice(2));
  const result = applyStoryHostedCleanup(opts);

  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    const { inventory } = result;
    console.log(`[CLEANUP STORY HOSTING] Mode: ${result.mode.toUpperCase()}`);
    console.log(`Root: ${inventory.rootDir}`);
    console.log(`Temp: ${inventory.tmpDir}`);
    console.log(`- Runners        : ${inventory.runners.length}`);
    console.log(`- Logs           : ${inventory.logs.length}`);
    console.log(`- Markers        : ${inventory.markers.length}`);
    console.log(`- Checkout Marker: ${inventory.checkoutMarkers.length}`);
    console.log(`- Temp Checkouts : ${inventory.tempCheckouts.length}`);
    console.log(`- Protected Skip : ${inventory.skippedProtected.length}`);
    if (inventory.loaderAudit.clean) {
      console.log("- loader.js Audit: BERSIH (tidak ada pemicu TLS/story sekali jalan).");
    } else {
      console.warn(
        `- loader.js Audit: DITEMUKAN ${inventory.loaderAudit.findings.length} potensi pemicu sekali jalan:`,
      );
      for (const f of inventory.loaderAudit.findings) {
        console.warn(`  * Line ${f.line} [${f.signature}]: ${f.preview}`);
      }
    }
    if (result.mode === "apply") {
      console.log(`Dihapus: ${result.deleted.length} item.`);
      if (result.errors.length > 0) {
        console.error(`Gagal: ${result.errors.length} item.`);
        process.exitCode = 1;
      }
    } else if (result.candidateCount > 0) {
      console.log(
        "Jalankan ulang dengan `--apply` setelah meninjau daftar di atas untuk membersihkan.",
      );
    }
  }
}

module.exports = {
  isProtectedName,
  auditLoaderHooks,
  scanStoryHostedArtifacts,
  applyStoryHostedCleanup,
  parseCliArgs,
};
