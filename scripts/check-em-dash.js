#!/usr/bin/env node
"use strict";

/**
 * Pemindai em dash.
 *
 * Karakter em dash (U+2014) membuat teks terasa seperti hasil generator.
 * Skrip ini menelusuri seluruh repo, melaporkan setiap kemunculannya, dan
 * bila dijalankan dengan --fix akan menggantinya dengan tanda baca biasa.
 *
 * Pemakaian:
 *   node scripts/check-em-dash.js          # hanya melapor, keluar dengan kode 1 bila ketemu
 *   node scripts/check-em-dash.js --fix    # perbaiki di tempat
 *   node scripts/check-em-dash.js --fix --dry-run
 */

const fs = require("fs");
const path = require("path");

const EM_DASH = "\u2014";

const ROOT = path.resolve(__dirname, "..");

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".github/ISSUE_TEMPLATE",
  "assets",
  "bin",
  "coverage",
  "dist",
  "build",
  "logs",
  "backups",
]);

const SKIP_FILES = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
]);

// Hanya berkas teks yang kita pedulikan. Sengaja dibuat allowlist supaya
// tidak ada kemungkinan merusak berkas biner.
const TEXT_EXTENSIONS = new Set([
  ".js",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".yml",
  ".yaml",
  ".txt",
  ".html",
  ".css",
  ".ejs",
  ".sql",
  ".example",
]);

const args = process.argv.slice(2);
const shouldFix = args.includes("--fix");
const dryRun = args.includes("--dry-run");
const verbose = args.includes("--verbose");

/**
 * Ganti em dash dengan tanda baca yang wajar menurut konteksnya.
 *
 * Urutan aturan penting. Kasus paling spesifik didahulukan.
 */
function replaceEmDashes(line) {
  let out = line;

  // Sel tabel markdown yang isinya cuma em dash, dipakai sebagai penanda kosong.
  out = out.replace(/\|\s*\u2014\s*\|/g, "| - |");
  out = out.replace(/\|\s*\u2014\s*$/g, "| -");

  // Em dash di awal baris, biasanya penanda daftar.
  out = out.replace(/^(\s*)\u2014\s+/g, "$1- ");

  // Em dash yang diapit spasi di tengah kalimat. Koma paling aman.
  out = out.replace(/\s+\u2014\s+/g, ", ");

  // Em dash yang menempel tanpa spasi, misal rentang angka.
  out = out.replace(/\u2014/g, "-");

  // Bereskan tanda baca ganda yang mungkin muncul dari penggantian di atas.
  out = out.replace(/,\s*,/g, ",");
  out = out.replace(/([.:;!?]),\s+/g, "$1 ");

  return out;
}

function shouldSkipDir(relDir) {
  const parts = relDir.split(path.sep);
  return parts.some((part) => SKIP_DIRS.has(part)) || SKIP_DIRS.has(relDir);
}

function collectFiles(dir, acc) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(ROOT, full);

    if (entry.isDirectory()) {
      if (shouldSkipDir(rel)) continue;
      collectFiles(full, acc);
      continue;
    }

    if (!entry.isFile()) continue;
    if (SKIP_FILES.has(entry.name)) continue;

    const ext = path.extname(entry.name).toLowerCase();
    const isDotfileText = entry.name.startsWith(".env");
    if (!TEXT_EXTENSIONS.has(ext) && !isDotfileText) continue;

    acc.push(full);
  }

  return acc;
}

function main() {
  const files = collectFiles(ROOT, []);
  const findings = [];
  let fixedFiles = 0;
  let fixedOccurrences = 0;

  for (const file of files) {
    let content;
    try {
      content = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }

    if (!content.includes(EM_DASH)) continue;

    const rel = path.relative(ROOT, file);
    // Pertahankan gaya akhir baris asli. Sebagian berkas memakai CRLF.
    const lines = content.split("\n");
    let changedInFile = 0;

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (!line.includes(EM_DASH)) continue;

      const occurrences = (line.match(/\u2014/g) || []).length;
      changedInFile += occurrences;
      findings.push({ file: rel, line: i + 1, text: line.trim() });

      if (shouldFix) lines[i] = replaceEmDashes(line);
    }

    if (shouldFix && changedInFile > 0) {
      fixedFiles += 1;
      fixedOccurrences += changedInFile;
      if (!dryRun) fs.writeFileSync(file, lines.join("\n"), "utf8");
    }
  }

  if (findings.length === 0) {
    console.log("Bersih. Tidak ada em dash di seluruh repo.");
    return 0;
  }

  if (shouldFix) {
    const label = dryRun ? "Akan diperbaiki" : "Diperbaiki";
    if (verbose) {
      for (const f of findings) {
        console.log(`  ${f.file}:${f.line}  ${f.text}`);
      }
    }
    console.log(
      `${label}: ${fixedOccurrences} em dash pada ${fixedFiles} berkas.`,
    );
    if (!dryRun) {
      console.log(
        "Periksa diff sebelum commit. Penggantian otomatis tidak selalu pas secara tata bahasa.",
      );
    }
    return 0;
  }

  console.log(`Ditemukan ${findings.length} baris mengandung em dash:\n`);
  let current = "";
  for (const f of findings) {
    if (f.file !== current) {
      current = f.file;
      console.log(`  ${current}`);
    }
    console.log(`    baris ${f.line}: ${f.text}`);
  }
  console.log(
    "\nJalankan `node scripts/check-em-dash.js --fix` untuk memperbaiki.",
  );
  return 1;
}

process.exitCode = main();
