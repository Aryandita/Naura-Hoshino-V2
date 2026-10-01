"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { clampVitalPercent, vitalTone } = require("./vitalPercent");

// Latar belakang bug:
// Dashboard menampilkan vital pemain (HP, haus, lapar, energi) sebagai bar
// persen. Implementasi lama menulis `Math.round(Number(value) ?? 100)` dengan
// alasan "`??` akan memberi default 100 bila nilainya kosong".
//
// Padahal operator `??` hanya bereaksi pada `null` dan `undefined`, sedangkan
// `Number(...)` sudah mengubahnya lebih dulu:
//   Number(undefined) -> NaN, lalu NaN ?? 100 -> NaN (NaN bukan nullish)
//   Number(null)      -> 0,   lalu 0   ?? 100 -> 0   (0 bukan nullish)
// Akibatnya bar menampilkan "NaN%" untuk kolom yang hilang, dan 0% (merah
// kritis) untuk kolom NULL di database. Test di bawah mengunci perilaku yang
// benar supaya regresi ini tidak bisa masuk lagi diam-diam.

test("clampVitalPercent mengembalikan 100 untuk null (bukan 0)", () => {
  // Kolom INTEGER tanpa allowNull:false sah menyimpan NULL di database.
  assert.equal(clampVitalPercent(null), 100);
});

test("clampVitalPercent mengembalikan 100 untuk undefined (bukan NaN)", () => {
  assert.equal(clampVitalPercent(undefined), 100);
});

test("clampVitalPercent mengembalikan 100 untuk NaN dan string non-numerik", () => {
  assert.equal(clampVitalPercent(NaN), 100);
  assert.equal(clampVitalPercent("abc"), 100);
  assert.equal(clampVitalPercent({}), 100);
  assert.equal(clampVitalPercent([]), 100);
});

test("clampVitalPercent mengembalikan 0 hanya untuk angka 0 yang sah", () => {
  // 0 adalah nilai vital yang valid (pemain benar-benar pingsan), jadi tidak
  // boleh tertukar dengan nilai default 100.
  assert.equal(clampVitalPercent(0), 0);
  assert.equal(clampVitalPercent("0"), 0);
});

test("clampVitalPercent membulatkan pecahan ke bilangan bulat terdekat", () => {
  assert.equal(clampVitalPercent(55.4), 55);
  assert.equal(clampVitalPercent(55.5), 56);
  assert.equal(clampVitalPercent(55.6), 56);
});

test("clampVitalPercent menjepit nilai di luar rentang 0..100", () => {
  assert.equal(clampVitalPercent(-25), 0);
  assert.equal(clampVitalPercent(140), 100);
  assert.equal(clampVitalPercent(Number.MAX_SAFE_INTEGER), 100);
});

test("clampVitalPercent meneruskan nilai valid apa adanya", () => {
  assert.equal(clampVitalPercent(100), 100);
  assert.equal(clampVitalPercent(73), 73);
  assert.equal(clampVitalPercent("42"), 42);
});

test("clampVitalPercent menghormati batas dan fallback kustom", () => {
  assert.equal(clampVitalPercent(5, { max: 200 }), 5);
  assert.equal(clampVitalPercent(500, { max: 200 }), 200);
  assert.equal(clampVitalPercent(null, { fallback: 80 }), 80);
  assert.equal(clampVitalPercent(null, { min: 10, fallback: 50 }), 50);
});

test("vitalTone memberi status kritis, hati-hati, dan sehat sesuai ambang", () => {
  assert.equal(vitalTone(0), "critical");
  assert.equal(vitalTone(29), "critical");
  assert.equal(vitalTone(30), "warning");
  assert.equal(vitalTone(59), "warning");
  assert.equal(vitalTone(60), "healthy");
  assert.equal(vitalTone(100), "healthy");
});

test("vitalTone memakai ambang kustom dan tetap aman untuk NaN", () => {
  assert.equal(vitalTone(75, { warning: 80 }), "warning");
  assert.equal(vitalTone(NaN), "healthy");
});

// ── Penjaga regresi statis ────────────────────────────────────────────────
// Helper di atas sudah teruji, tetapi dasbor memuatnya lewat <script> sehingga
// tidak selalu lewat runner Node. Test di bawah membaca berkas dasbor secara
// langsung untuk memastikan tidak ada lagi clamping vital yang ditulis ulang
// di sana. Tanpa ini, pola `Number(x) ?? 100` bisa dikembalikan ke halaman
// tanpa menggagalkan satu pun test.

const DASHBOARD_VITAL_SOURCES = [
  "dashboard/src/pages/index.html",
  "dashboard/src/js/authManager.js",
];

test("berkas dasbor tidak lagi menulis clamping vital secara manual", () => {
  for (const relPath of DASHBOARD_VITAL_SOURCES) {
    const abs = path.join(__dirname, "..", "..", relPath);
    const source = fs.readFileSync(abs, "utf8");

    // Hanya pola yang memang menghitung persentase vital yang dilarang.
    // `Number(saldo) || 0` untuk nominal uang tetap sah dan tidak boleh
    // ikut tertangkap, jadi pencocokan dibatasi pada fungsi updateVital.
    // Lebar indentasi tidak dikunci karena kedua berkas memakai level berbeda.
    const updateVitalBlocks = source.match(
      /const updateVital = [\s\S]*?\n\s*};/g,
    );
    assert.ok(
      updateVitalBlocks && updateVitalBlocks.length > 0,
      `${relPath} expected to define updateVital().`,
    );

    for (const rawBlock of updateVitalBlocks) {
      // Komentar di dalam blok sengaja menjelaskan bug lamanya, jadi harus
      // dilepas dulu agar penjaga tidak salah menangkap pola di komentar.
      const block = rawBlock
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/[^\n]*/g, "");

      assert.doesNotMatch(
        block,
        /Number\([^)]*\)\s*(\?\?|\|\|)/,
        `${relPath} masih menghitung persentase vital secara manual. ` +
          "Pakai window.NauraVitalPercent.clampVitalPercent sebagai gantinya.",
      );
      assert.match(
        block,
        /NauraVitalPercent\.clampVitalPercent/,
        `${relPath} harus menghitung vital melalui helper yang sama.`,
      );
    }
  }
});

test("tidak ada sisa pola Number(x) ?? pada vital di seluruh dasbor", () => {
  // Pola `Number(x) ?? 100` pernah muncul di tiga tempat: blok updateVital
  // index.html, blok updateVital authManager.js, dan saat session vital
  // dibentuk di initServerSync(). Yang ketiga paling halus karena tidak
  // terlihat di widget, tapi nilainya sudah rusak sebelum sampai ke clamp.
  for (const relPath of DASHBOARD_VITAL_SOURCES) {
    const abs = path.join(__dirname, "..", "..", relPath);
    const code = fs
      .readFileSync(abs, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");

    const offenders = code.match(/Number\([^)]*\)\s*\?\?/g) || [];
    assert.deepEqual(
      offenders,
      [],
      `${relPath} masih memakai pola "Number(x) ??" yang tidak pernah ` +
        "memberikan nilai cadangan untuk null maupun undefined.",
    );
  }
});

test("portfolio.js tidak lagi memaksa vital 0 menjadi 100", () => {
  const abs = path.join(__dirname, "..", "..", "dashboard", "routes", "portfolio.js");
  const code = fs
    .readFileSync(abs, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");

  // `(survival && survival.hp) || 100` membuat hp 0 (pingsan) tampil 100.
  const offenders = code.match(
    /(?:survival\s*&&\s*survival\s*\.\s*\w+)\s*\|\|\s*\d+/g,
  ) || [];
  assert.deepEqual(
    offenders,
    [],
    `portfolio.js masih memaksa nilai vital falsy menjadi angka: ${offenders.join(", ")}`,
  );
});

test("sharedNav memuat helper vital sebelum authManager", () => {
  const abs = path.join(__dirname, "..", "..", "dashboard/src/js/sharedNav.js");
  const source = fs.readFileSync(abs, "utf8");

  const vitalAt = source.indexOf("/shared/vitalPercent.js");
  const authAt = source.indexOf("/src/js/authManager.js");

  assert.ok(vitalAt > -1, "sharedNav.js harus menyuntik /shared/vitalPercent.js");
  assert.ok(authAt > -1, "sharedNav.js harus menyuntik /src/js/authManager.js");
  assert.ok(
    vitalAt < authAt,
    "Helper vital harus disuntik sebelum authManager.js memakainya.",
  );
});
