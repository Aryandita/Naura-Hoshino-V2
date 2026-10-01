"use strict";

/**
 * verify-copy-quality.js - Menjalankan seluruh pemeriksaan kualitas copy dan
 * menuliskan hasilnya ke JSON supaya tidak bergantung pada output terminal.
 *
 * Yang diperiksa:
 *   1. audit display text (scripts/audit-display-text.js)
 *   2. test regresi copy di src/utils/heroViewerBoot.test.js
 *   3. scan karakter asing di seluruh berkas yang diubah
 *
 * Jalankan: node scripts/verify-copy-quality.js
 */

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "dashboard", "public", "verify_3d", "copy_quality.json");

/**
 * Menjalankan perintah anak dan mengembalikan ringkasannya.
 * @param {string} label - Nama pemeriksaan.
 * @param {string[]} args - Argumen perintah.
 * @returns {{label: string, code: number, tail: string}} Hasil pemeriksaan.
 */
function run(label, args) {
  const res = spawnSync("node", args, { cwd: ROOT, encoding: "utf8" });
  const output = `${res.stdout || ""}${res.stderr || ""}`;
  const tail = output.split("\n").filter(Boolean).slice(-6).join("\n");
  return { label, code: res.status, tail };
}

/** Menjalankan seluruh pemeriksaan dan menulis JSON. */
function main() {
  const checks = [
    run("display-text", ["scripts/audit-display-text.js"]),
    run("copy-regression-test", [
      "--test",
      "src/utils/heroViewerBoot.test.js",
    ]),
  ];

  // Scan karakter asing pada berkas yang berubah.
  const CJK = /[\u4E00-\u9FFF\u3400-\u4DBF]/;
  const dirty = spawnSync("git", ["status", "--porcelain"], { cwd: ROOT, encoding: "utf8" });
  const files = (dirty.stdout || "")
    .split("\n")
    .filter(Boolean)
    .map((l) => l.slice(3).trim())
    .filter((f) => fs.existsSync(f) && fs.statSync(f).isFile());

  const foreign = [];
  for (const f of files) {
    const text = fs.readFileSync(path.join(ROOT, f), "utf8");
    text.split("\n").forEach((line, i) => {
      if (CJK.test(line)) foreign.push(`${f}:${i + 1}`);
    });
  }
  checks.push({
    label: "karakter-asing",
    code: foreign.length ? 1 : 0,
    tail: foreign.length ? foreign.join(", ") : `bersih di ${files.length} berkas`,
  });

  const passed = checks.every((c) => c.code === 0);
  const report = { passed, checkedFiles: files.length, checks };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2), "utf8");

  for (const c of checks) {
    console.log(`${c.code === 0 ? "PASS" : "FAIL"}  ${c.label}`);
  }
  console.log(`\nHASIL: ${passed ? "LULUS" : "GAGAL"} (disimpan ke ${OUT})`);
  return report;
}

if (require.main === module) process.exit(main().passed ? 0 : 1);
module.exports = main;