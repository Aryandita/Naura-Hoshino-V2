"use strict";

// Jalankan hanya pada checkout uji sekali pakai, bukan direktori bot produksi.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const expected = process.argv[2];
if (!/^[a-f0-9]{40}$/.test(expected || "")) throw new Error("Argumen harus berupa SHA-1 commit lengkap");
const markerPath = path.join(root, ".naura-story-test-checkout.json");
if (!fs.existsSync(markerPath)) throw new Error("Penanda checkout uji tidak ditemukan");
const marker = JSON.parse(fs.readFileSync(markerPath, "utf8"));
if (marker.purpose !== "disposable-story-test" || marker.commit !== expected) throw new Error("Penanda checkout tidak cocok");
for (const name of [".env", ".env ALPHA", ".env.local", ".env.production"]) {
  if (fs.existsSync(path.join(root, name))) throw new Error("Konfigurasi environment tidak boleh ada pada checkout uji");
}
const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
if (head !== expected) throw new Error("HEAD checkout uji berbeda dari commit yang diminta");
const changed = execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], { cwd: root, encoding: "utf8" });
if (changed.trim()) throw new Error("Checkout uji memiliki perubahan tracked");
const files = [
  "src/survival/helpers/storyDisplayName.test.js",
  "src/survival/engines/prologueDraft.test.js",
  "src/survival/engines/visualNovelAssets.test.js",
  "src/survival/engines/sliceOfLifeSession.test.js",
  "src/survival/engines/sliceOfLifeProgress.test.js",
  "src/survival/engines/storyIsolatedStore.test.js",
  "src/survival/engines/storyProgressCompatibility.test.js",
  "src/utils/interactionPipeline.test.js",
];
for (const file of files) {
  execFileSync("git", ["cat-file", "-e", `HEAD:${file}`], { cwd: root, stdio: "ignore" });
}
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "naura-story-test-"));
const env = { PATH: process.env.PATH || "", NODE_ENV: "test", USE_SQLITE: "true", TZ: "UTC" };
if (process.env.SystemRoot) env.SystemRoot = process.env.SystemRoot;
if (process.env.TEMP) env.TEMP = process.env.TEMP;
if (process.env.TMP) env.TMP = process.env.TMP;
console.log(`Prolog test commit=${head}; temporary directory=${tempDir}`);
const result = spawnSync(process.execPath, ["--test", "--test-timeout=30000", "--test-concurrency=1", ...files.map((file) => path.join(root, file))], { cwd: tempDir, env, stdio: "inherit" });
if (result.error) throw result.error;
process.exitCode = result.status === null ? 1 : result.status;