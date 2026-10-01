"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// ── Routing halaman dashboard ─────────────────────────────────────────────
//
// Dua bug nyata yang ditemukan lewat verifikasi browser:
//
//  1. `express.static(dist)` disajikan TANPA `index: false`, jadi berkas
//     dist/index.html dilayani untuk path "/" sebelum handler view() sempat
//     berjalan. Akibatnya perbandingan mtime di view() tidak pernah dipakai
//     dan halaman "/" selalu menampilkan build lama, berapa kali pun src/
//     diperbarui. Inilah alasan dashboard utama menampilkan model 3D "loading
//     tanpa henti" padahal source-nya sudah diperbaiki.
//
//  2. Setelah `index: false` dipasang, view() menjadi satu-satunya penyaji
//     HTML. Kalau view() melempar atau salah urutan, semua halaman mati
//     bersamaan karena keduanya berada di berkas yang sama.
//
// Test di bawah mengunci kedua hal pada level source, karena test ini tidak
// menyalakan server.

const SERVER = path.join(
  __dirname,
  "..",
  "..",
  "dashboard",
  "server.js",
);
const INDEX_HTML = path.join(
  __dirname,
  "..",
  "..",
  "dashboard",
  "src",
  "pages",
  "index.html",
);
const HERO_CONTROLLER = path.join(
  __dirname,
  "..",
  "..",
  "dashboard",
  "src",
  "components",
  "NauraHeroViewer",
  "heroController.js",
);

function read(file) {
  return fs.readFileSync(file, "utf8");
}

test("express.static untuk dist memakai index: false", () => {
  const source = read(SERVER);
  const line = source
    .split("\n")
    .find((l) => /express\.static\(\s*path\.join\(__dirname,\s*"dist"\)/.test(l));
  assert.ok(line, "static handler untuk dist harus ada");
  assert.ok(
    /index:\s*false/.test(line),
    "dist WAJIB memakai { index: false } supaya tidak memblokir handler view()",
  );
});

test("view memakai helper pickPage yang aman terhadap stat gagal", () => {
  const source = read(SERVER);
  assert.ok(/const pickPage\s*=/.test(source), "helper pickPage harus ada");
  // statSync bisa melempar bila file dihapus saat server berjalan. Harus
  // dibungkus try/catch, kalau tidak satu request bisa menjatuhkan seluruh
  // router halaman.
  const start = source.indexOf("const pickPage");
  const body = source.slice(start, source.indexOf("const view =", start));
  assert.ok(
    /try\s*\{[\s\S]*?\}\s*catch/.test(body),
    "pickPage harus membungkus statSync dalam try/catch",
  );
  assert.ok(
    /return\s+null/.test(body),
    "pickPage harus mengembalikan null bila berkas tidak ada",
  );
});

test("tidak ada penutup IIFE yang salah pada blok addEventListener", () => {
  // Regresi nyata yang ditemukan lewat verifikasi browser: handler load
  // ditulis `})();` alih-alih `});`. Pola `})()` adalah penutup IIFE,
  // sehingga addEventListener yang mengembalikan undefined langsung
  // dipanggil sebagai fungsi dan melempar
  // "TypeError: window.addEventListener(...) is not a function".
  // Akibatnya seluruh pemuatan data dashboard berhenti di halaman utama.
  const source = read(INDEX_HTML);

  assert.ok(
    !/window\.addEventListener\([^)]*=>\s*\{[\s\S]{0,40000}?\}\)\(\);/.test(source),
    "window.addEventListener tidak boleh ditutup dengan `})();`, harus `});`",
  );

  // Pastikan penutup yang benar benar-benar dipakai.
  assert.ok(
    /window\.addEventListener\('load'[\s\S]{0,40000}?\}\);/.test(source),
    "penutup window.addEventListener('load', ...) harus `});`",
  );
});

test("halaman utama memuat model hero dengan URL ter-encode", () => {
  // Nama berkas model aslinya memuat SPASI. Path dengan spasi mentah akan 404
  // dan membuat overlay loading tidak pernah selesai.
  const source = read(INDEX_HTML);
  assert.ok(
    /naura%20NEW\.vrm/.test(source) || /naura%20NEW\.vrm/.test(read(HERO_CONTROLLER)),
    "path model hero harus ter-encode dengan %20",
  );
});

test("setiap halaman terdaftar punya berkas sumber yang ada", () => {
  const source = read(SERVER);
  // Tangkap nama berkas yang benar-benar dipakai view(), bukan nama route,
  // karena beberapa route memang alias ke berkas yang sama
  // (misalnya /room dan /realm sama-sama memakai world.html).
  const files = new Set(
    [...source.matchAll(/view\(\s*"([^"]+\.html)"\s*\)/g)].map((m) => m[1]),
  );
  assert.ok(files.size > 5, `harus ada banyak halaman, dapat ${files.size}`);

  const pagesDir = path.join(__dirname, "..", "..", "dashboard", "src", "pages");
  for (const name of files) {
    assert.ok(
      fs.existsSync(path.join(pagesDir, name)),
      `view() memakai ${name} yang tidak ada di dashboard/src/pages`,
    );
  }
});
