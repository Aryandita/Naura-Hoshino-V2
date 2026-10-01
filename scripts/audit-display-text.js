"use strict";

/**
 * audit-display-text.js - Audit teks yang terlihat pengguna pada dashboard.
 *
 * Menarik semua string yang bisa sampai ke layar (textContent, innerHTML,
 * showToast, placeholder, title, aria-label, dan pesan error), lalu
 * menandainya kalau mengandung pola copy generik.
 *
 * Ini audit, bukan fixer: skrip hanya melaporkan. Perbaikannya dibaca manusia
 * supaya nuansa bahasa tetap terjaga.
 *
 * Jalankan: node scripts/audit-display-text.js
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");

const TARGETS = [
  "dashboard/src/pages/index.html",
  "dashboard/src/pages/leaderboard.html",
  "dashboard/src/js/authManager.js",
  "dashboard/src/js/sharedNav.js",
  "dashboard/src/components/NauraHeroViewer/heroController.js",
];

/**
 * Pola copy generik yang sering muncul dari keluaran AI.
 * Setiap entri adalah [label, regex, penjelasan].
 */
const SLOP_PATTERNS = [
  [
    "kataFruit",
    /\b(delicious|juicy|savor|taste the|indulge|treat yourself|feast)\b/i,
    "metafora makanan untuk produk digital",
  ],
  [
    "kataFriend",
    /\b(your loyal|best friend|trusted companion|always by your side)\b/i,
    "menggambarkan produk sebagai teman, bukan alat",
  ],
  [
    "kataElevate",
    /\b(elevate|supercharge|unleash|unlock the power|harness|empower)\b/i,
    "kata vb liftingJN yang dipakai berlebihan",
  ],
  [
    "kataSeamless",
    /\b(seamless|frictionless|effortlessly|simply|simply put)\b/i,
    "menghapus وجود hambatan tanpa menjelaskan apa yang berubah",
  ],
  [
    "kataJourney",
    /\b(embark|journey|dive in|deep dive|explore the)\b/i,
    "metafora perjalanan untuk navigasi biasa",
  ],
  [
    "kataSukses",
    /\b(it's all you need|all you need to|simply the best|the future of)\b/i,
    "klaim besar tanpa bukti",
  ],
  [
    "seruan",
    /^\s*(Get Started|Learn More|Explore|Discover|Dive In|Start Now|Join Now)\s*$/i,
    "CTA generik yang bisa dipakai produk apa saja",
  ],
  [
    "elipsisPanjang",
    /…{2,}|\.\.\.\s*$/,
    "elipsis berlebihan memberi kesan dramatis",
  ],
  [
    "seru",
    /\b(exciting|stunning|beautiful|amazing|incredible|awesome)\b/i,
    "puji tanpa isi, bisa dipakai untuk apa saja",
  ],
  [
    "kataBerhasil",
    /\b(Berhasil|berhasil)\b/,
    "biasanya mengulang aksi user; tetap perlu jika muncul setelah proses panjang atau aksi yang tidak dimulai user",
  ],
  [
    "teknisBerlebihan",
    /\b(periksa konsol|console|konsol browser|stack trace)\b/i,
    "menyuruh user melakukan debugging; salah tempat untuk mengribusiness diri",
  ],
  [
    "tanpaJalanKeluar",
    /\bmungkin kosong\b|\bmungkin akan\b|\bsebagian data\b/,
    "menyatakan keadaan tanpa memberi langkah pemulihannya",
  ],
  [
    "kataTeknisInternal",
    /\b(canvas|viewer|instance|WebGL)\b/i,
    "istilah internal yang tidak perlu dilihat pengguna akhir",
  ],
];

/**
 * Mengambil semua string yang masuk ke tampilan pengguna.
 * @param {string} source - Isi berkas.
 * @returns {{file: string, line: number, text: string, channel: string}[]} Daftar string.
 */
function extractStrings(file) {
  const abs = path.join(ROOT, file);
  if (!fs.existsSync(abs)) return [];
  const lines = fs.readFileSync(abs, "utf8").split("\n");
  const out = [];

  const CHANNELS = [
    ["textContent", /textContent\s*=\s*[`"'][^`"']+[`"']/],
    ["innerHTML", /innerHTML\s*=\s*[`"'][^`"']+[`"']/],
    ["showToast", /showToast\(\s*[`"'][^`"']+[`"']/],
    ["placeholder", /placeholder\s*=\s*[`"'][^`"']+[`"']/],
    ["attr", /\b(title|aria-label|placeholder|alt)\s*=\s*[`"'][^`"']+[`"']/],
    ["textContentTemplate", /textContent\s*=\s*`[^`]+`/],
  ];

  lines.forEach((line, i) => {
    for (const [channel, re] of CHANNELS) {
      const m = re.exec(line);
      if (m) out.push({ file, line: i + 1, text: m[0], channel });
    }
  });
  return out;
}

/** Menjalankan audit dan mencetak laporan. */
function main() {
  const files = TARGETS.flatMap(extractStrings);
  const findings = [];

  // Pola yang sudah ditinjau manual dan memang dibenarkan. Sengaja ditulis
  // eksplisit supaya audit tetap berguna untuk kasus baru, bukan diam-diam
  // diabaikan.
  const ALLOWLIST = [
    // Toast ini muncul setelah reconnect otomatis, bukan setelah user menekan
    // tombol, sehingga hasilnya memang perlu diberitahukan.
    /Koneksi berhasil dipulihkan secara otomatis/,
    // Toast logout muncul setelah navigasi, dan menyebut nama akun yang
    // baru saja keluar menambah informasi yang belum diketahui user.
    /Berhasil logout dari akun/,
  ];

  const isAllowed = (text) => ALLOWLIST.some((re) => re.test(text));

  for (const item of files) {
    for (const [label, re, why] of SLOP_PATTERNS) {
      if (re.test(item.text) && !isAllowed(item.text)) {
        findings.push({ ...item, label, why });
      }
    }
  }

  console.log(`Memindai ${TARGETS.length} berkas, ${files.length} string tampilan.\n`);

  if (!findings.length) {
    console.log("BERSIH: tidak ada pola copy generik yang terdeteksi.");
    return { findings, scanned: files.length };
  }

  console.log(`DITEMUKAN ${findings.length} pola yang perlu ditinjau:\n`);
  for (const f of findings) {
    console.log(`  ${f.file}:${f.line}  [${f.label}] ${f.why}`);
    console.log(`    ${f.text.slice(0, 110)}\n`);
  }
  return { findings, scanned: files.length };
}

if (require.main === module) main();
module.exports = { extractStrings, SLOP_PATTERNS, TARGETS };