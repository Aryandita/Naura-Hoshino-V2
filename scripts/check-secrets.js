"use strict";

/**
 * check-secrets.js - Automated Credential & Secret Leak Scanner
 *
 * Memindai repositori untuk mencegah kebocoran kredensial, token bot,
 * private key, dan API key pihak ketiga sebelum commit / QA gate.
 *
 * Penggunaan:
 *   node scripts/check-secrets.js
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");

const SUSPICIOUS_PATTERNS = [
  {
    name: "Discord Bot Token",
    regex: /(?:mfa\.[a-z0-9_-]{20,}|[a-z0-9_-]{24,28}\.[a-z0-9_-]{6}\.[a-z0-9_-]{27,38})/i,
    isIgnored: (match, content, file) =>
      match.includes("dummy") ||
      match.includes("placeholder") ||
      match.includes("example") ||
      match.includes("mock") ||
      file.includes(".test.") ||
      file.includes(".spec."),
  },
  {
    name: "Groq API Key",
    regex: /gsk_[a-zA-Z0-9]{20,}/,
    isIgnored: (match, content, file) =>
      match.includes("placeholder") || match.includes("example"),
  },
  {
    name: "OpenAI / Claude API Key",
    regex: /sk-(?:live|proj|ant)?[a-zA-Z0-9]{30,}/,
    isIgnored: (match, content, file) =>
      match.includes("placeholder") || match.includes("example"),
  },
  {
    name: "Google Gemini API Key",
    regex: /AIzaSy[a-zA-Z0-9_-]{33}/,
    isIgnored: (match, content, file) =>
      match.includes("placeholder") || match.includes("example"),
  },
  {
    name: "Private Key",
    regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/,
    isIgnored: (match, content, file) =>
      file.includes("test") || file.includes("fixture"),
  },
];

const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  ".cache",
  "dist",
  "build",
  "coverage",
  "logs",
  "backups",
  "scratch",
  ".kilo",
  ".agents",
]);

const IGNORED_FILES = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  ".env.example",
]);

function getTrackedAndSourceFiles() {
  try {
    const gitOutput = execSync("git ls-files", { cwd: ROOT, encoding: "utf8" });
    return gitOutput
      .split(/\r?\n/)
      .map((f) => f.trim())
      .filter((f) => f.length > 0);
  } catch (err) {
    // Fallback: telusuri direktori lokal
    const files = [];
    function scan(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (IGNORED_DIRS.has(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scan(full);
        } else if (entry.isFile()) {
          files.push(path.relative(ROOT, full));
        }
      }
    }
    scan(ROOT);
    return files;
  }
}

function checkTrackedEnv() {
  try {
    const tracked = execSync("git ls-files .env", { cwd: ROOT, encoding: "utf8" }).trim();
    if (tracked.includes(".env")) {
      return false;
    }
  } catch (_) {}
  return true;
}

function main() {
  console.log("Memulai pemindaian kebocoran kredensial (Secret Scanner)...");

  if (!checkTrackedEnv()) {
    console.error("❌ ERROR: File .env terdeteksi di dalam git index! Segera untrack.");
    process.exit(1);
  }

  const files = getTrackedAndSourceFiles();
  const violations = [];

  for (const relPath of files) {
    const norm = relPath.replace(/\\/g, "/");
    if (IGNORED_FILES.has(path.basename(norm))) continue;
    if (norm.startsWith(".env") && norm !== ".env.example") {
      violations.push({ file: norm, line: 1, name: "Untracked .env in tracked files", match: norm });
      continue;
    }

    const firstSegment = norm.split("/")[0];
    if (IGNORED_DIRS.has(firstSegment)) continue;

    const fullPath = path.join(ROOT, norm);
    if (!fs.existsSync(fullPath)) continue;

    // Lewati berkas biner
    const ext = path.extname(norm).toLowerCase();
    const binaryExts = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".glb", ".vrm", ".ico", ".woff", ".woff2", ".ttf", ".mp3", ".wav", ".ogg"]);
    if (binaryExts.has(ext)) continue;

    let content;
    try {
      content = fs.readFileSync(fullPath, "utf8");
    } catch {
      continue;
    }

    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const pattern of SUSPICIOUS_PATTERNS) {
        const match = line.match(pattern.regex);
        if (match) {
          const matchedStr = match[0];
          if (!pattern.isIgnored(matchedStr, line, norm)) {
            violations.push({
              file: norm,
              line: i + 1,
              name: pattern.name,
              match: matchedStr.slice(0, 10) + "...",
            });
          }
        }
      }
    }
  }

  if (violations.length > 0) {
    console.error(`\n❌ Terdeteksi ${violations.length} potensi kebocoran kredensial:`);
    for (const v of violations) {
      console.error(`  - ${v.file}:${v.line} [${v.name}] (${v.match})`);
    }
    console.error("\nSilakan pindahkan rahasia ke environment variable (.env)!\n");
    process.exit(1);
  }

  console.log("✔ Repositori aman: tidak ada kredensial atau token rahasia yang bocor.");
  process.exit(0);
}

main();
