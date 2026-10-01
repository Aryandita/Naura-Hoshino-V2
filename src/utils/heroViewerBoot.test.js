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

function read(file) {
  return fs.readFileSync(file, "utf8");
}

test("index.html menginisialisasi hero viewer", () => {
  const source = read(INDEX_HTML);
  assert.ok(
    /initHeroViewer\s*\(/.test(source),
    "index.html harus memanggil initHeroViewer(), kalau tidak canvas tidak pernah hidup",
  );
  assert.ok(
    /NauraHeroViewer|heroController/.test(source),
    "index.html harus mengimpor modul NauraHeroViewer",
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
  const source = read(INDEX_HTML);
  assert.ok(
    /type="module"[\s\S]{0,3000}initHeroViewer\s*\(/.test(source),
    "initHeroViewer harus dipanggil dari script module",
  );

  // Pola yang benar: deklarasi fungsi terpisah, lalu pemanggilan dari
  // DOMContentLoaded atau langsung bila readyState sudah di luar "loading".
  // Memanggilnya di script paling atas sebelum DOM selesai akan mendapat null
  // karena canvas belum ada.
  assert.ok(
    /DOMContentLoaded/.test(source),
    "halaman harus memasang listener DOMContentLoaded",
  );
  assert.ok(
    /readyState\s*===\s*['"]loading['"]/.test(source),
    "pemeriksaan readyState memastikan startHero tidak jalan sebelum DOM siap",
  );
  assert.ok(
    /startHero\s*\(\s*\)/.test(source),
    "startHero harus benar-benar dipanggil",
  );
});

test("semua script inline di index.html bebas syntax error", () => {
  // Regresi nyata: ada penutup "});" berlebih di blok EventSource SSE yang
  // membuat seluruh script inline halaman mati. Akibatnya modul hero 3D ikut
  // gagal karena dipanggil dari script yang tidak pernah dieksekusi, dan
  // overlay "Memuat Model 3D VRM..." tampil tanpa henti.
  //
  // Pemeriksaan memakai parser JavaScript sungguhan lewat esbuild, bukan
  // sekadar menghitung kurung kurawal, karena kurung yang seimbang pun bisa
  // membentuk blok yang salah.
  const esbuild = require("esbuild");

  const re = /<script(?![^>]*\ssrc=)(?![^>]*\stype=)[^>]*>([\s\S]*?)<\/script>/g;
  const failures = [];
  let m;
  let n = 0;

  while ((m = re.exec(read(INDEX_HTML)))) {
    n += 1;
    try {
      esbuild.transformSync(m[1], { loader: "js" });
    } catch (err) {
      failures.push(`script #${n}: ${String(err.message).split("\n")[0]}`);
    }
  }

  assert.ok(n > 0, "harus ada script inline untuk diperiksa");
  assert.deepStrictEqual(
    failures,
    [],
    `script inline punya syntax error sehingga tidak pernah jalan:\n${failures.join("\n")}`,
  );
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
  const source = read(INDEX_HTML);
  const idx = source.indexOf("startHero");
  const body = source.slice(idx, idx + 2600);

  // Setiap interval harus punya clearInterval, kalau tidak timer berjalan
  // sepanjang halaman hidup even setelah overlay tertutup.
  const intervals = (body.match(/setInterval\(/g) || []).length;
  const clears = (body.match(/clearInterval\(/g) || []).length;
  assert.ok(
    intervals > 0,
    "harus ada watchdog berbasis interval untuk menutup overlay",
  );
  assert.ok(
    clears >= intervals,
    `tiap setInterval harus punya clearInterval (interval=${intervals}, clear=${clears})`,
  );

  // Kegagalan harus selalu menyembunyikan overlay, bukan hanya mengubah teks.
  assert.ok(
    /showFailure\s*=\s*\([^)]*\)\s*=>[\s\S]{0,400}?display\s*=\s*['"]none['"]/.test(body),
    "showFailure wajib menyembunyikan overlay loading",
  );
  assert.ok(
    /showFailure[\s\S]{0,600}?errorBox[\s\S]{0,200}?display\s*=\s*['"]flex['"]/.test(body),
    "kegagalan harus menampilkan kotak error, bukan spinner yang menggantung",
  );
});

