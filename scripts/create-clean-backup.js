"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const ROOT_DIR = path.resolve(__dirname, "..");
const STAGING_DIR = path.join(ROOT_DIR, "tmp_clean_staging");
const GDRIVE_DIR = "D:\\Google Drive\\Kodingan Naura";
const ZIP_FILENAME = "Naura_Hoshino_V2_Clean_Source.zip";
const OUTPUT_ZIP = path.join(ROOT_DIR, ZIP_FILENAME);

console.log("==================================================");
console.log("📦 Naura Hoshino V2 - Ultra-Light Clean Source Packager");
console.log("   (Murni Kodingan - Tanpa Gambar, Media & File Berat)");
console.log("==================================================");

// 1. Bersihkan staging dan zip lama di lokal & Google Drive
if (fs.existsSync(STAGING_DIR)) {
  fs.rmSync(STAGING_DIR, { recursive: true, force: true });
}
if (fs.existsSync(OUTPUT_ZIP)) {
  console.log("🗑️  Menghapus arsip lama di direktori lokal...");
  fs.unlinkSync(OUTPUT_ZIP);
}
if (fs.existsSync(GDRIVE_DIR)) {
  const oldGdriveZip = path.join(GDRIVE_DIR, ZIP_FILENAME);
  if (fs.existsSync(oldGdriveZip)) {
    console.log("🗑️  Menghapus arsip lama di Google Drive...");
    fs.unlinkSync(oldGdriveZip);
  }
}
fs.mkdirSync(STAGING_DIR, { recursive: true });

// 2. Daftar folder yang akan diproses
const DIRS_TO_INCLUDE = [
  ".agents",
  ".github",
  ".planning",
  "assets",
  "dashboard",
  "devtools",
  "docker",
  "docs",
  "pending_plugin",
  "plugin",
  "scripts",
  "src",
  "tasks",
  "tools",
];

// Daftar file root yang akan disalin
const FILES_TO_INCLUDE = [
  ".env.example",
  ".gitignore",
  ".prettierignore",
  "AGENTS.md",
  "antislop.md",
  "DEPLOY_GUIDE.md",
  "DESIGN.md",
  "Dockerfile",
  "docker-compose.yml",
  "eslint.config.js",
  "generate_voice.js",
  "index.js",
  "LICENSE",
  "metadata.json",
  "package.json",
  "package-lock.json",
  "PRD.md",
  "README.md",
  "RULES.md",
  "shard.js",
  "skills-lock.json",
  "TODO.md",
];

// Ekstensi media, gambar, audio, font, dan file biner berat yang WAJIB DIBUANG
const BANNED_EXTENSIONS = new Set([
  // Gambar & Grafis
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico", ".bmp", ".tiff", ".avif", ".psd", ".ai",
  // Audio & Efek Suara
  ".mp3", ".wav", ".ogg", ".flac", ".m4a", ".aac", ".wma",
  // Video & Animasi
  ".mp4", ".webm", ".mkv", ".avi", ".mov", ".flv",
  // Model 3D & Aset
  ".glb", ".vrm", ".gltf", ".obj", ".fbx", ".blend", ".dae", ".3ds", ".stl", ".bin",
  // Font
  ".ttf", ".otf", ".woff", ".woff2", ".eot",
  // Arsip & Executable
  ".zip", ".tar.gz", ".rar", ".7z", ".exe", ".dll", ".node", ".iso", ".mcworld",
  // Database lokal
  ".sqlite", ".sqlite3", ".sqlite-wal", ".sqlite-shm", ".db",
  // Dokumen non-kode
  ".pdf", ".docx", ".doc", ".xlsx", ".pptx",
  // Temporary & Logs
  ".log", ".tmp", ".bak",
]);

// Folder yang isinya murni aset media berat
const BANNED_DIRS = [
  "assets/3D Model Naura",
  "assets/fonts",
  "assets/sounds",
  "assets/images",
  "assets/cache",
  "dashboard/public/verify_3d",
  "dashboard/dist",
  "dashboard/mobile/dist",
];

// Aturan pengecualian ketat
function isExcluded(filePath) {
  const rel = path.relative(ROOT_DIR, filePath).replace(/\\/g, "/");
  const base = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();

  // 1. Kredensial & Secrets
  if (base === ".env" || (base.startsWith(".env.") && base !== ".env.example")) return true;
  if (base === "mcp_config.json" || base === "mcp.json") return true;

  // 2. Folder sistem & dependensi besar
  if (rel === "node_modules" || rel.startsWith("node_modules/")) return true;
  if (rel === ".git" || rel.startsWith(".git/")) return true;
  if (rel === ".cache" || rel.startsWith(".cache/")) return true;
  if (rel === ".codegraph" || rel.startsWith(".codegraph/")) return true;
  if (rel === ".vscode" || rel.startsWith(".vscode/")) return true;
  if (rel === ".idea" || rel.startsWith(".idea/")) return true;
  if (rel === "tmp" || rel.startsWith("tmp/") || rel.startsWith("tmp_")) return true;
  if (rel === "scratch" || rel.startsWith("scratch/")) return true;
  if (rel === "backups" || rel.startsWith("backups/")) return true;
  if (rel === "testsprite_tests" || rel.startsWith("testsprite_tests/")) return true;

  // 3. Folder aset media berat
  for (const bannedDir of BANNED_DIRS) {
    if (rel === bannedDir || rel.startsWith(bannedDir + "/")) return true;
  }

  // 4. Ekstensi file media / biner terlarang
  if (BANNED_EXTENSIONS.has(ext)) return true;

  // 5. Database & log spesifik
  if (base.endsWith(".sqlite.synced") || base === "errorlog.md" || base === "extracted_strings.json" || base.startsWith("lint_output")) return true;

  // 6. Batasan ukuran file kode (maksimal 2MB untuk mencegah file data raksasa terselip)
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isDirectory() && stat.size > 2 * 1024 * 1024) {
      console.log(`  ⚠️  Melewati file besar (>2MB): ${rel} (${(stat.size / (1024 * 1024)).toFixed(2)} MB)`);
      return true;
    }
  } catch (_) {}

  return false;
}

let copiedFileCount = 0;
let totalBytesCopied = 0;

function copyClean(src, dest) {
  if (isExcluded(src)) return;

  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    const items = fs.readdirSync(src);
    for (const item of items) {
      copyClean(path.join(src, item), path.join(dest, item));
    }
  } else {
    const parentDir = path.dirname(dest);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.copyFileSync(src, dest);
    copiedFileCount++;
    totalBytesCopied += stat.size;
  }
}

// 3. Salin direktori ke staging
console.log("\n📁 Menyalin kodingan murni ke area staging...");
for (const dirName of DIRS_TO_INCLUDE) {
  const src = path.join(ROOT_DIR, dirName);
  const dest = path.join(STAGING_DIR, dirName);
  if (fs.existsSync(src)) {
    process.stdout.write(`  • Menyalin ${dirName}... `);
    const beforeCount = copiedFileCount;
    copyClean(src, dest);
    const added = copiedFileCount - beforeCount;
    console.log(`OK (${added} file kodingan)`);
  }
}

// 4. Salin file root terpilih ke staging
console.log("\n📄 Menyalin file root...");
for (const fileName of FILES_TO_INCLUDE) {
  const src = path.join(ROOT_DIR, fileName);
  const dest = path.join(STAGING_DIR, fileName);
  if (fs.existsSync(src)) {
    const stat = fs.statSync(src);
    fs.copyFileSync(src, dest);
    copiedFileCount++;
    totalBytesCopied += stat.size;
    console.log(`  • Menyalin ${fileName}`);
  }
}

// 5. Audit Keamanan & Media Pra-Kompresi
console.log("\n🛡️  Menjalankan Audit Integritas & Keamanan Pra-Kompresi...");
function auditStaging(dir) {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      auditStaging(fullPath);
    } else {
      const ext = path.extname(item).toLowerCase();
      if (item === ".env" || (item.startsWith(".env.") && item !== ".env.example")) {
        throw new Error(`BAHAYA: Ditemukan file secret '${item}' di staging!`);
      }
      if (item === "mcp_config.json" || item === "mcp.json") {
        throw new Error(`BAHAYA: Ditemukan file konfigurasi MCP '${item}' di staging!`);
      }
      if (BANNED_EXTENSIONS.has(ext)) {
        throw new Error(`TERDETEKSI MEDIA: File '${item}' bertipe media/biner lolos ke staging!`);
      }
    }
  }
}
auditStaging(STAGING_DIR);
console.log("  ✅ Audit Lolos: 0 secret, 0 gambar/media, 0 file biner berat.");

// 6. Kompresi menggunakan tar/bsdtar
const uncompressedMB = (totalBytesCopied / (1024 * 1024)).toFixed(2);
console.log(`\n🗜️  Mengompresi ${copiedFileCount} file kodingan (${uncompressedMB} MB mentah) menjadi ZIP...`);
try {
  execSync(`tar -a -c -f "${OUTPUT_ZIP}" *`, {
    cwd: STAGING_DIR,
    stdio: "inherit",
  });
  console.log("  ✅ Arsip ZIP murni kodingan berhasil dibuat.");
} catch (err) {
  console.error("  ❌ Gagal membuat zip:", err.message);
  process.exit(1);
}

// 7. Bersihkan area staging
console.log("\n🧹 Membersihkan area staging...");
fs.rmSync(STAGING_DIR, { recursive: true, force: true });

// 8. Salin ke Google Drive
let gdriveDestination = null;
if (fs.existsSync(GDRIVE_DIR)) {
  console.log(`\n☁️  Menyalin arsip baru ke Google Drive (${GDRIVE_DIR})...`);
  const gdriveZip = path.join(GDRIVE_DIR, ZIP_FILENAME);
  fs.copyFileSync(OUTPUT_ZIP, gdriveZip);
  gdriveDestination = gdriveZip;
  console.log("  ✅ Berhasil disalin ke Google Drive!");
}

// 9. Informasi akhir
const zipStats = fs.statSync(OUTPUT_ZIP);
const sizeMB = (zipStats.size / (1024 * 1024)).toFixed(2);
console.log("\n==================================================");
console.log("🎉 PENGARSIPAN ULTRA-RINGAN SELESAI!");
console.log(`📊 Total File      : ${copiedFileCount} file murni kode`);
console.log(`📦 Ukuran ZIP Baru : ${sizeMB} MB (${zipStats.size.toLocaleString("id-ID")} bytes)`);
console.log(`📁 Lokasi Lokal    : ${OUTPUT_ZIP}`);
if (gdriveDestination) {
  console.log(`☁️  Lokasi GDrive   : ${gdriveDestination}`);
}
console.log("==================================================");
