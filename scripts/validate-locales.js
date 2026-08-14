#!/usr/bin/env node
/**
 * Audit paritas kunci antara language/id.json dan language/en.json,
 * termasuk seluruh folder locales milik plugin (plugin/<kategori>/locales/).
 *
 * Pemakaian:
 *   node scripts/validate-locales.js           -> laporan saja (exit 0)
 *   node scripts/validate-locales.js --strict  -> exit 1 jika ada kunci yang hilang
 *
 * Dipakai CI supaya sistem bilingual tidak pelan-pelan jadi tidak sinkron.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const STRICT = process.argv.includes("--strict");

/** Kumpulkan seluruh folder yang berisi id.json dan/atau en.json. */
function findLocaleDirs(dir, found = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return found;
  }

  const names = entries.map((e) => e.name);
  if (names.includes("id.json") || names.includes("en.json")) found.push(dir);

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (["node_modules", ".git", "assets"].includes(entry.name)) continue;
    findLocaleDirs(path.join(dir, entry.name), found);
  }
  return found;
}

/** Ubah objek bersarang jadi daftar kunci datar: { help: { title: 'x' } } -> ['help.title'] */
function flatten(obj, prefix = "", out = []) {
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) return out;
  for (const [key, value] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      flatten(value, full, out);
    } else {
      out.push(full);
    }
  }
  return out;
}

function readJson(file) {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    console.error(
      `  [X] JSON tidak valid: ${path.relative(ROOT, file)} -> ${error.message}`,
    );
    return undefined; // undefined = rusak, null = tidak ada
  }
}

let totalMissing = 0;
let totalBroken = 0;

console.log("\n=== Audit Paritas Bahasa Naura Hoshino ===\n");

for (const dir of findLocaleDirs(ROOT)) {
  const rel = path.relative(ROOT, dir) || ".";
  const id = readJson(path.join(dir, "id.json"));
  const en = readJson(path.join(dir, "en.json"));

  if (id === undefined || en === undefined) {
    totalBroken++;
    continue;
  }

  const idKeys = new Set(flatten(id || {}));
  const enKeys = new Set(flatten(en || {}));

  const missingInEn = [...idKeys].filter((k) => !enKeys.has(k));
  const missingInId = [...enKeys].filter((k) => !idKeys.has(k));

  if (!missingInEn.length && !missingInId.length) {
    console.log(`  [OK] ${rel} (${idKeys.size} kunci, sinkron)`);
    continue;
  }

  console.log(`  [!] ${rel}`);
  if (missingInEn.length) {
    console.log(
      `      Hilang di en.json (${missingInEn.length}): ${missingInEn.slice(0, 15).join(", ")}${missingInEn.length > 15 ? ", ..." : ""}`,
    );
  }
  if (missingInId.length) {
    console.log(
      `      Hilang di id.json (${missingInId.length}): ${missingInId.slice(0, 15).join(", ")}${missingInId.length > 15 ? ", ..." : ""}`,
    );
  }
  totalMissing += missingInEn.length + missingInId.length;
}

console.log(`\nTotal kunci yang belum sinkron: ${totalMissing}`);
if (totalBroken) console.log(`File JSON rusak: ${totalBroken}`);

if (STRICT && (totalMissing > 0 || totalBroken > 0)) {
  console.error(
    "\nGagal: mode --strict aktif tetapi masih ada kunci yang hilang.\n",
  );
  process.exit(1);
}

if (totalBroken > 0) process.exit(1);
console.log("");
