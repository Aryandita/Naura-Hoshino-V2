"use strict";

/**
 * Memeriksa sintaks seluruh <script> inline pada halaman HTML dashboard.
 *
 * Dua jenis tag yang diperiksa:
 *  - script JavaScript  -> di-parse dengan acorn
 *  - script importmap  -> di-parse sebagai JSON (bukan JavaScript)
 *
 * Bug nyata yang dicegat oleh skrip ini: penutup `});` berlebih pada blok
 * EventSource SSE membuat seluruh script inline halaman mati, dan karena
 * initHeroViewer() dipanggil dari salah satu script itu, overlay "Memuat
 * Model 3D VRM..." tampil tanpa henti.
 *
 * Jalankan: node scripts/check-inline-scripts.js
 */

const fs = require("node:fs");
const path = require("node:path");
const acorn = require("acorn");

const PAGES_DIR = path.join(__dirname, "..", "dashboard", "src", "pages");

let checked = 0;
let importmaps = 0;
const failures = [];

const files = fs
  .readdirSync(PAGES_DIR)
  .filter((f) => f.endsWith(".html"))
  .map((f) => path.join(PAGES_DIR, f));

for (const file of files) {
  const html = fs.readFileSync(file, "utf8");
  const re = /<script(?![^>]*\bsrc\s*=)([^>]*)>([\s\S]*?)<\/script>/g;
  let match;
  let index = 0;

  while ((match = re.exec(html))) {
    index += 1;
    if (/\bsrc\s*=/.test(match[1])) continue;
    const body = match[2];
    const label = `${path.basename(file)} script #${index}`;

    if (/type\s*=\s*["']importmap["']/.test(match[1])) {
      importmaps += 1;
      try {
        JSON.parse(body);
      } catch (err) {
        failures.push(`${label}: importmap bukan JSON valid (${err.message})`);
      }
      continue;
    }

    checked += 1;
    try {
      acorn.parse(body, { ecmaVersion: "latest", sourceType: "module" });
    } catch (err) {
      failures.push(`${label}: ${err.message}`);
    }
  }
}

if (failures.length) {
  console.error(`Gagal: ${failures.length} script inline tidak valid`);
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}

console.log(
  `OK: ${checked} script JS valid, ${importmaps} importmap valid, ${files.length} halaman diperiksa`,
);
