"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// ── Batas sendi & integritas keyframe animasi 3D ──────────────────────────
//
// KOREKSI TERHUBUNG: klaim awal bahwa "7 part tidak punya batas" SALAH.
// Setelah ditelusuri, SEMUA 19 part sudah punya batas. Yang membedakan
// hanya jenisnya:
//
//   softClampAngle  -> kompresi eksponensial, mulus saat mencapai batas
//   MathUtils.clamp -> potong keras, menghasilkan sedikit "snapping"
//   clampToLimits   -> wrapper dengan RIG_LIMITS per-bagian
//
// Test di bawah mengunci dua hal yang benar-benar bermasalah:
//
//  1. Setiap part WAJIB punya salah satu dari tiga mekanisme clamp di atas.
//     Ini mencegah part baru ditulis tanpa batas.
//
//  2. Setiap sequence keyframe harus punya t naik monoton, mulai dari 0 dan
//     berakhir TEPAT di 1. Bug nyata ditemukan di sini: morph "Talk" pada
//     wave.js berakhir di t=0.9 sehingga mulut tidak pernah menutup
//     kembali setelah animasi selesai.

const PARTS_DIR = path.join(
  __dirname,
  "..",
  "..",
  "dashboard",
  "src",
  "components",
  "NauraViewer",
  "animations",
  "parts",
);
const SEQ_DIR = path.join(
  __dirname,
  "..",
  "..",
  "dashboard",
  "src",
  "components",
  "NauraViewer",
  "animations",
  "sequences",
);

// Part yang memutar sendi tubuh. Wajib punya batas sudut.
// Part kosmetik dikecualikan dengan alasan, bukan sekadar konVENsi:
//   blink.js -> hanya mengatur morph kelopak mata, tidak memutar sendi
//   hair.js  -> pegasponytail, operates via VRM spring bone
//   face.js  -> hanya blendshape/viseme, tidak ada rotasi sendi
const COSMETIC_PARTS = ["blink.js", "hair.js", "face.js"];

const JOINT_PARTS = fs
  .readdirSync(PARTS_DIR)
  .filter((f) => f.endsWith(".js") && !COSMETIC_PARTS.includes(f))
  .sort();

// Pola yang dianggap sebagai clamp. softClampAngle adalah yang paling baik
// (kompresi mulus), tapi MathUtils.clamp dan clampToLimits juga sah karena
// keduanya membatasi rotasi agar mesh tidak saling menembus.
const CLAMP_PATTERNS = [
  /softClampAngle\s*\(/,
  /MathUtils\.clamp\s*\(/,
  /clampToLimits\s*\(/,
];

test("setiap part sendi tubuh punya mekanisme batas sudut", () => {
  const missing = [];
  for (const f of JOINT_PARTS) {
    // Buang baris komentar supaya penyebutan di dokumentasi tidak dihitung.
    const src = fs
      .readFileSync(path.join(PARTS_DIR, f), "utf8")
      .replace(/^\s*\*.*$/gm, "")
      .replace(/\/\/.*$/gm, "");

    if (!CLAMP_PATTERNS.some((re) => re.test(src))) missing.push(f);
  }
  assert.deepStrictEqual(
    missing,
    [],
    `part ini tidak punya batas sudut, rotasi bisa membuat mesh saling menembus: ${missing.join(", ")}`,
  );
});

test("part yang mengimpor softClampAngle benar-benar memanggilnya", () => {
  // Mengimpor tanpa memakai (atau sebaliknya) menandakan refactor setengah
  // selesai dan bisa menghasilkan batas yang diam-diam tidak aktif.
  const bad = [];
  for (const f of JOINT_PARTS) {
    const src = fs.readFileSync(path.join(PARTS_DIR, f), "utf8");
    const imported = /import\s*\{[^}]*\bsoftClampAngle\b[^}]*\}/.test(src);
    const called = /softClampAngle\s*\(/.test(src);
    if (imported !== called) bad.push(f);
  }
  assert.deepStrictEqual(
    bad,
    [],
    `impor dan pemanggilan softClampAngle tidak seimbang di: ${bad.join(", ")}`,
  );
});

test("setiap sequence punya t monoton naik dari 0 ke 1", () => {
  const problems = [];

  for (const f of fs.readdirSync(SEQ_DIR)) {
    if (f === "index.js" || !f.endsWith(".js")) continue;
    const src = fs.readFileSync(path.join(SEQ_DIR, f), "utf8");

    // Setiap larik keyframe punya bentuk [{ "t": x, "val": [...] }, ...]
    const blocks = src.match(/\[\s*\{\s*"t"[\s\S]*?\n\s*\]/g) || [];
    if (blocks.length === 0) continue;

    for (const block of blocks) {
      const ts = [...block.matchAll(/"t"\s*:\s*([0-9.]+)/g)].map((m) => Number(m[1]));
      if (ts.length < 2) continue;
      if (ts[0] !== 0) problems.push(`${f}: keyframe tidak mulai dari t=0 (mulai ${ts[0]})`);
      if (ts[ts.length - 1] !== 1) {
        problems.push(`${f}: keyframe tidak berakhir di t=1 (berakhir ${ts[ts.length - 1]})`);
      }
      for (let i = 1; i < ts.length; i += 1) {
        if (ts[i] < ts[i - 1]) {
          problems.push(`${f}: t tidak monoton di indeks ${i} (${ts[i - 1]} lalu ${ts[i]})`);
          break;
        }
      }
    }
  }

  assert.deepStrictEqual(problems, [], `keyframe bermasalah:\n${problems.join("\n")}`);
});

test("tiada sequence memakai nilai t di luar rentang 0..1", () => {
  const problems = [];
  for (const f of fs.readdirSync(SEQ_DIR)) {
    if (f === "index.js" || !f.endsWith(".js")) continue;
    const src = fs.readFileSync(path.join(SEQ_DIR, f), "utf8");
    for (const m of src.matchAll(/"t"\s*:\s*([0-9.]+)/g)) {
      const t = Number(m[1]);
      if (!(t >= 0 && t <= 1)) problems.push(`${f}: t=${t} di luar 0..1`);
    }
  }
  assert.deepStrictEqual(problems, [], problems.join("\n"));
});

test("nama bone di sequence memakai kunci rig yang valid", () => {
  // Kunci ini harus cocok dengan VRM_TO_GLB_BONE di core/rigProfile.js agar
  // rotasi benar-benar sampai ke bone, bukan diam-diam diabaikan.
  const profile = fs.readFileSync(
    path.join(PARTS_DIR, "..", "core", "rigProfile.js"),
    "utf8",
  );
  const mapBlock = profile.slice(
    profile.indexOf("VRM_TO_GLB_BONE"),
    profile.indexOf("OPTIONAL_BONES"),
  );
  const valid = new Set(
    [...mapBlock.matchAll(/(\w+)\s*:\s*"[A-Za-z]/g)].map((m) => m[1]),
  );
  assert.ok(valid.size > 5, `pemetaan rig harus terbaca (dapat ${valid.size})`);

  // Ambil blok "bones" lalu hanya kunci yang level-1 (indent 8 spasi) dan
  // diikuti larik keyframe. Kunci keyframe seperti "val" tidak ikut karena
  // indentasinya lebih dalam.
  const unknown = [];
  for (const f of fs.readdirSync(SEQ_DIR)) {
    if (f === "index.js" || !f.endsWith(".js")) continue;
    const src = fs.readFileSync(path.join(SEQ_DIR, f), "utf8");

    const bonesIdx = src.indexOf('"bones"');
    if (bonesIdx < 0) continue;
    const block = src.slice(bonesIdx, src.indexOf("\"morphs\"", bonesIdx) < 0 ? undefined : src.indexOf("\"morphs\"", bonesIdx));

    for (const line of block.split("\n")) {
      // Bone key selalu di kedalaman indent yang sama danbukankunci "t"/"val".
      const m = line.match(/^\s{8}"(\w+)"\s*:\s*\[\s*$/);
      if (m && !valid.has(m[1])) unknown.push(`${f}: bone "${m[1]}"`);
    }
  }
  assert.deepStrictEqual(unknown, [], `bone tidak dikenal: ${unknown.join(", ")}`);
});
