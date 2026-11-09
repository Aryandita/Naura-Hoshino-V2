"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// ── Hero 3D Viewer di Dashboard Utama ──────────────────────────────────────
//
// Bug yang dilaporkan: kartu hero di halaman utama (/index) hanya menampilkan
// "Memuat Model 3D VRM..." tanpa henti. Model tidak pernah muncul.
//
// Penyebabnya ada dua, keduanya nyata:
//
//  1. initHeroViewer() di components/NauraHeroViewer/heroController.js TIDAK
//     PERNAH dipanggil dari index.html. Elemen canvas, wrapper, tombol model,
//     dan badge status semuanya ada di HTML, tapi tidak ada satu baris pun
//     yang memulai viewer. Hasilnya overlay "loading" tetap tampil selamanya
//     karena tidak ada yang menyembunyikannya.
//
//  2. Default modelPath di heroController.js memakai SPASI MENTAH
//     ('/models/naura NEW.vrm'). Nama file di disk memang ber-spasi, jadi
//     URL harus memakai %20. Dengan spasi mentah, fetch model 404.

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

// Pasca migrasi MPA, boot hero 3D halaman utama pindah dari script inline
// index.html ke modul eksternal ini. Penjaga boot membaca modul tersebut.
const HERO_BOOT_MODULE = path.join(
  __dirname,
  "..",
  "..",
  "dashboard",
  "src",
  "js",
  "three",
  "nauraHero3D.js",
);

const AUTH_MANAGER = path.join(
  __dirname,
  "..",
  "..",
  "dashboard",
  "src",
  "js",
  "authManager.js",
);

function read(file) {
  return fs.readFileSync(file, "utf8");
}

test("index.html menginisialisasi hero viewer", () => {
  const source = read(INDEX_HTML);
  assert.ok(
    /nauraHero3D/.test(source),
    "index.html harus memuat modul boot hero nauraHero3D, kalau tidak canvas tidak pernah hidup",
  );
  assert.ok(
    /type="module"[^>]*nauraHero3D|nauraHero3D[^>]*type="module"|src="[^"]*nauraHero3D/.test(source),
    "modul hero harus dimuat sebagai script module",
  );
});

test("heroController memakai path model yang ter-encode", () => {
  const source = read(HERO_CONTROLLER);
  // Hanya baris kode yang diperiksa. Komentar boleh menjelaskan nama file
  // mentah sebagai dokumentasi, jadi komentar dibuang lebih dulu.
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  // Path model dengan spasi mentah selalu gagal dimuat.
  // String.match mengembalikan null saat tidak cocok, jadi dinormalkan
  // menjadi array kosong agar bisa dibandingkan dengan deepStrictEqual.
  const raw = code.match(/["'`]\/models\/[^"'`]* [^"'`]*["'`]/g) || [];
  assert.deepStrictEqual(
    raw,
    [],
    `heroController masih memakai path model ber-spasi mentah: ${raw.join(", ")}`,
  );
  assert.ok(
    /currentActiveModel\s*=\s*['"`]\/models\/naura%20NEW\.vrm['"`]/.test(code),
    "default model harus memakai %20 untuk nama file yang ber-spasi",
  );
});

test("semua elemen yang dibutuhkan initHeroViewer ada di index.html", () => {
  const html = read(INDEX_HTML);
  const required = [
    "naura-hero-3d-canvas",
    "naura3d-canvas-wrapper",
    "naura3d-loading",
    "naura3d-loading-text",
    "naura3d-error",
    "naura3d-status-text",
    "naura3d-format-badge",
    "btn-model-new",
    "btn-model-vrm",
    "btn-model-glb",
  ];

  const missing = required.filter(
    (id) => !new RegExp(`id="${id}"`).test(html),
  );
  assert.deepStrictEqual(
    missing,
    [],
    `elemen ini wajib ada supaya viewer bisa controlling UI: ${missing.join(", ")}`,
  );
});

test("tombol model memakai path ter-encode", () => {
  const html = read(INDEX_HTML);
  const rawSpace = html.match(/data-model="[^"]* [^"]*"/g) || [];
  assert.deepStrictEqual(
    rawSpace,
    [],
    `data-model ber-spasi mentah akan 404: ${rawSpace.join(", ")}`,
  );
});

test("initHeroViewer dijalankan setelah DOM siap", () => {
  const source = read(HERO_BOOT_MODULE);
  // Boot harus menunggu DOM siap supaya canvas sudah ada saat viewer dibangun.
  assert.ok(
    /addEventListener\(\s*["']DOMContentLoaded["']/.test(source),
    "modul hero harus memasang listener DOMContentLoaded",
  );
  assert.ok(
    /DOMContentLoaded["'][\s\S]{0,200}?new NauraHero3D\(/.test(source),
    "viewer harus dibangun dari listener DOM-ready, bukan sebelum DOM ada",
  );
});

test("pesan gagal hero 3D bisa ditindaklanjuti user", () => {
  // Anti-slop: pesan error tidak boleh menyuruh user mendebug di konsol.
  // Pasca migrasi, pesan gagal ada di elemen #naura3d-error pada index.html
  // dan ditampilkan oleh showError() modul boot. Harus memberi langkah
  // pemulihan yang nyata (mis. buka studio 3D lengkap), bukan istilah internal.
  const source = read(INDEX_HTML);
  const idx = source.indexOf('id="naura3d-error"');
  assert.ok(idx > -1, "harus ada elemen error hero yang bisa ditampilkan");
  const block = source.slice(idx, idx + 700);

  assert.ok(
    !/periksa konsol|konsol browser|stack trace/i.test(block),
    "pesan error tidak boleh menyuruh user melakukan debugging",
  );
  assert.ok(
    !/\bcanvas\b/i.test(block),
    "pesan error tidak boleh membocorkan istilah internal 'canvas'",
  );
  // Minimal satu langkah pemulihan yang bisa diklik user.
  assert.ok(
    /href="\/lounge"|muat ulang|coba lagi|Studio 3D/i.test(block),
    "pesan gagal harus menyertakan langkah pemulihan yang bisa ditindaklanjuti",
  );
});

test("toast tidak mengulang aksi yang baru saja ditekan user", () => {
  // Reset kamera selalu bekerja, jadi toast "Kamera Berhasil Direset"
  // hanya mengulang apa yang baru saja diklik. Snapshot berbeda: unduhan
  // file tidak terlihat, jadi toast di sana tetap diperlukan.
  // Hanya string yang benar-benar tampil yang diperiksa, bukan komentar.
  const source = read(HERO_CONTROLLER);
  const shown = [...source.matchAll(/showToast\(\s*["'`]([^"'`]+)["'`]/g)].map((m) => m[1]);
  assert.ok(shown.length > 0, "harus ada toast yang bisa diperiksa");
  assert.ok(
    !shown.some((t) => /kamera/i.test(t)),
    `toast kamera hanya mengulang aksi user: ${shown.join(" | ")}`,
  );
  assert.ok(
    /takeSnapshot[\s\S]{0,300}?showToast/.test(source),
    "snapshot tetap perlu memberi tahu karena unduhan file tidak terlihat",
  );
});

test("pesan profil gagal menyertakan langkah pemulihannya", () => {
  const source = read(AUTH_MANAGER);
  // Hanya teks yang benar-benar dirender ke layar, bukan komentar kode.
  const shown = [...source.matchAll(/showToast\(\s*["'`]([^"'`]+)["'`]/g)].map((m) => m[1]);
  assert.ok(shown.length > 0, "harus ada toast profil");
  assert.ok(
    !shown.some((t) => /mungkin kosong/i.test(t)),
    `pesan tidak boleh berhenti pada "mungkin kosong": ${shown.join(" | ")}`,
  );
  // Pesan yang tersisa harus menyebut cara memulihkannya.
  assert.ok(
    shown.some((t) => /muat ulang|daftar ulang|login ulang/i.test(t)),
    `minimal satu pesan harus menyebut langkah pemulihan: ${shown.join(" | ")}`,
  );
});

test("script boot hero bebas syntax error", () => {
  // Regresi nyata: penutup "});" berlebih pernah membuat script boot mati
  // sehingga overlay "Memuat Model 3D VRM..." tampil tanpa henti. Pasca
  // migrasi, boot pindah ke modul eksternal nauraHero3D.js; parser JavaScript
  // sungguhan (esbuild) memastikan modul itu tetap valid secara sintaks.
  const esbuild = require("esbuild");
  const source = read(HERO_BOOT_MODULE);
  assert.ok(source.trim().length > 0, "modul boot hero harus ada isinya");
  let error = null;
  try {
    esbuild.transformSync(source, { loader: "js" });
  } catch (err) {
    error = String(err.message).split("\n")[0];
  }
  assert.equal(error, null, `modul boot hero punya syntax error: ${error}`);
});

test("heroController mengekspos handle error agar loading tidak menggantung", () => {
  const source = read(HERO_CONTROLLER);
  // Tanpa onError, model yang gagal dimuat membuat overlay loading tetap
  // tampil selamanya karena tidak ada yang menyembunyikannya.
  assert.ok(
    /onError\s*:/.test(source),
    "heroController harus menangani onError supaya overlay loading tidak menggantung",
  );
  const errIdx = source.indexOf("onError");
  const seg = source.slice(errIdx, errIdx + 500);
  assert.ok(
    /loadingBox[\s\S]{0,200}?display/.test(seg),
    "onError wajib menyembunyikan overlay loading",
  );
});

test("initHeroViewer dijaga agar tidak membangun viewer ganda", () => {
  // heroController.js punya blok auto-init sendiri di akhir berkas, DAN
  // index.html memanggilnya lagi dari script modul. Tanpa pagar di dalam
  // initHeroViewer(), dua mesin 3D akan berbagi satu canvas: render saling
  // menimpa, listener menumpuk, dan pergantian model mengalokasikan buffer
  // GPU terus-menerus.
  const source = read(HERO_CONTROLLER);
  assert.ok(
    /new WeakMap\(\)/.test(source),
    "harus ada WeakMap untuk menyimpan viewer per canvas",
  );
  assert.ok(
    /activeViewers\.has\(\s*canvasElement\s*\)/.test(source),
    "initHeroViewer harus mengecek apakah viewer sudah hidup",
  );
  assert.ok(
    /activeViewers\.set\(\s*canvasElement/.test(source),
    "viewer yang baru dibuat harus didaftarkan di WeakMap",
  );
});

test("watchdog hero punya jalur keluar dan tidak menggantung", () => {
  // Pasca migrasi, jalur keluar memakai try/catch pada loadModel yang memanggil
  // showError(), bukan interval watchdog. Invarian tetap: kegagalan wajib
  // menyembunyikan overlay loading dan menampilkan kotak error, sehingga
  // spinner tidak menggantung selamanya.
  const source = read(HERO_BOOT_MODULE);

  assert.ok(
    /catch\s*\([^)]*\)\s*\{[\s\S]{0,200}?this\.showError\(\)/.test(source),
    "loadModel harus punya catch yang memanggil showError agar loading tidak menggantung",
  );

  const idx = source.indexOf("showError() {");
  const body = source.slice(idx, idx + 300);
  assert.ok(
    /errorEl[\s\S]{0,120}?display\s*=\s*["']flex["']/.test(body),
    "showError wajib menampilkan kotak error",
  );
  assert.ok(
    /loadingEl[\s\S]{0,120}?display\s*=\s*["']none["']/.test(body),
    "showError wajib menyembunyikan overlay loading",
  );
});

