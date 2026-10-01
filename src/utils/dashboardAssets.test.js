"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  EXPRESSION_AVATARS,
  MODEL_3D,
} = require("../../dashboard/routes/dashboardAssetPaths");

// Latar belakang bug:
// Dashboard menunjuk ke asset yang tidak pernah ada di disk, sehingga
// requests selalu 404 dan pengguna melihat gambar rusak / model kosong.
//
//   1. api.js memakai "Surprised.png" dan "Salute.png", padahal file di
//      assets/Naura_Expression/ bernama "Shocked.png" dan tidak ada "Salute.png".
//   2. index.html memakai data-model="/models/naura NEW.vrm" dengan SPASI
//      mentah. Nama file di disk memang ber-spasi, jadi URL wajib %20.
//   3. loader.js menunjuk ke "/assets/3d/..." yang tidak pernah ada sebagai
//      folder, sehingga rantai fallback mati total.
//
// Test di bawah memverifikasi path terhadap disk sungguhan, bukan sekadar
// menjaga agar kode tidak berubah. Itulah satu-satunya cara menangkap file
// yang terhapus atau salah nama.

// Indeks nama file model yang tersaji lewat Express pada /models.
const MODELS_DIR = path.join(__dirname, "..", "..", "dashboard", "public", "models");
// Indeks nama file aset yang tersaji lewat Express pada /assets.
const ASSETS_DIR = path.join(__dirname, "..", "..", "assets");

/**
 * Ubah URL "/models/naura%20NEW.vrm" menjadi path disk yang bisa diuji.
 * Sengaja men-decode '%20' supaya spasi asli ikut diverifikasi.
 */
function urlToDiskPath(url) {
  const decoded = decodeURIComponent(url);
  if (decoded.startsWith("/models/")) {
    return path.join(MODELS_DIR, decoded.slice("/models/".length));
  }
  if (decoded.startsWith("/assets/")) {
    return path.join(ASSETS_DIR, decoded.slice("/assets/".length));
  }
  return null;
}

test("setiap avatar ekspresi yang dirujuk benar-benar ada di disk", () => {
  assert.ok(EXPRESSION_AVATARS.length > 0, "Daftar avatar tidak boleh kosong");

  for (const url of EXPRESSION_AVATARS) {
    const diskPath = urlToDiskPath(url);
    assert.ok(diskPath, `Path avatar di luar /assets dan /models: ${url}`);
    assert.ok(
      fs.existsSync(diskPath),
      `Avatar tidak ada di disk: ${url} (dicek ${diskPath})`,
    );
  }
});

test("avatar ekspresi memakai nama file yang memang ada (regresi Surprised/Salute)", () => {
  const basenames = EXPRESSION_AVATARS.map((u) => path.basename(u));

  // Dua nama yang pernah dipakai tapi tidak pernah ada sebagai file.
  assert.ok(
    !basenames.includes("Surprised.png"),
    "Surprised.png tidak ada; yang tersedia adalah Shocked.png",
  );
  assert.ok(
    !basenames.includes("Salute.png"),
    "Salute.png tidak pernah ada di assets/Naura_Expression/",
  );
});

test("setiap model 3D yang dirujuk benar-benar ada di disk", () => {
  assert.ok(MODEL_3D.length > 0, "Daftar model tidak boleh kosong");

  for (const url of MODEL_3D) {
    const diskPath = urlToDiskPath(url);
    assert.ok(diskPath, `Path model di luar /assets dan /models: ${url}`);
    assert.ok(
      fs.existsSync(diskPath),
      `Model tidak ada di disk: ${url} (dicek ${diskPath})`,
    );
  }
});

test("path model tidak pernah memakai spasi mentah (harus %20)", () => {
  for (const url of MODEL_3D) {
    assert.ok(
      !url.includes(" "),
      `Path model memuat spasi mentah, akan gagal dimuat browser: ${url}`,
    );
  }
});

test("halaman dashboard tidak merujuk model dengan spasi mentah", () => {
  const page = path.join(
    __dirname,
    "..",
    "..",
    "dashboard",
    "src",
    "pages",
    "index.html",
  );
  const source = fs.readFileSync(page, "utf8");

  const rawSpaceModels = source.match(/data-model="[^"]* [^"]*"/g) || [];
  assert.deepEqual(
    rawSpaceModels,
    [],
    `data-model dengan spasi mentah akan 404: ${rawSpaceModels.join(", ")}`,
  );
});

test("loader 3D tidak lagi menunjuk ke folder yang tidak pernah ada", () => {
  const loaderPath = path.join(
    __dirname,
    "..",
    "..",
    "dashboard",
    "src",
    "components",
    "NauraViewer",
    "loader.js",
  );
  const raw = fs.readFileSync(loaderPath, "utf8");

  // Komentar boleh menyebut path lama untuk menjelaskan alasan perbaikan,
  // jadi penilaian hanya dijalankan atas kode yang benar-benar dieksekusi.
  const source = raw
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");

  // "/assets/3d/..." pernah dipakai padahal folder assets bernama
  // "3D Model Naura" (kapital, spasi), sehingga tidak ada yang cocok.
  assert.ok(
    !source.includes("/assets/3d/"),
    "loader.js masih menunjuk /assets/3d/ yang tidak pernah ada sebagai folder",
  );

  // Semua kandidat model harus berada di /models/ dan bebas spasi mentah.
  const candidateBlock = source.slice(
    source.indexOf("const candidates"),
    source.indexOf("const uniqueCandidates"),
  );
  const candidates = candidateBlock.match(/"\/[^"]+"/g) || [];
  assert.ok(candidates.length > 0, "Blok kandidat fallback tidak terbaca");
  for (const raw2 of candidates) {
    const url = raw2.slice(1, -1);
    assert.ok(
      url.startsWith("/models/"),
      `Kandidat fallback harus berada di /models/: ${url}`,
    );
    assert.ok(
      !url.includes(" "),
      `Kandidat fallback memuat spasi mentah: ${url}`,
    );
  }
});
