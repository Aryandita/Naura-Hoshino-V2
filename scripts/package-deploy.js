"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const ROOT_DIR = path.resolve(__dirname, "..");
const STAGING_DIR = path.join(ROOT_DIR, "tmp_deploy_staging");
const OUTPUT_ZIP = path.join(ROOT_DIR, "Naura_Hoshino_V2_Deploy_Package.zip");

console.log("==================================================");
console.log("📦 Packaging Naura Hoshino V2 Deployment Archive");
console.log("==================================================");

// 1. Bersihkan staging dan zip lama jika ada
if (fs.existsSync(STAGING_DIR)) {
  fs.rmSync(STAGING_DIR, { recursive: true, force: true });
}
if (fs.existsSync(OUTPUT_ZIP)) {
  fs.unlinkSync(OUTPUT_ZIP);
}
fs.mkdirSync(STAGING_DIR, { recursive: true });

// 2. Daftar folder yang akan disalin
const DIRS_TO_COPY = [
  ".agents",
  ".github",
  "assets",
  "dashboard",
  "devtools",
  "docker",
  "docs",
  "pending_plugin",
  "plugin",
  "scripts",
  "src",
  "tools",
];

// Daftar file root yang akan disalin
const FILES_TO_COPY = [
  ".env",
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
  "index.js",
  "LICENSE",
  "metadata.json",
  "package.json",
  "package-lock.json",
  "PRD.md",
  "README.md",
  "RULES.md",
  "shard.js",
  "TODO.md",
];

function shouldExclude(srcPath) {
  const rel = path.relative(ROOT_DIR, srcPath).replace(/\\/g, "/");
  
  if (rel.includes("node_modules")) return true;
  if (rel.includes(".git/") || rel === ".git") return true;
  if (rel.includes(".cache/") || rel === ".cache") return true;
  if (rel.includes(".codegraph/") || rel === ".codegraph") return true;
  if (rel.includes("backups/") || rel === "backups") return true;
  if (rel.includes("scratch/") || rel === "scratch") return true;
  if (rel.includes("testsprite_tests/")) return true;
  if (rel.endsWith(".zip") || rel.endsWith(".tar.gz") || rel.endsWith(".rar") || rel.endsWith(".7z")) return true;
  if (rel.endsWith(".obj")) return true;
  if (rel.includes("assets/3D Model Naura/extracted")) return true;
  if (rel.endsWith(".sqlite") || rel.endsWith(".sqlite3") || rel.endsWith(".db")) return true;
  if (rel.endsWith(".log")) return true;
  
  return false;
}

function copyRecursive(src, dest) {
  if (shouldExclude(src)) return;

  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    const items = fs.readdirSync(src);
    for (const item of items) {
      copyRecursive(path.join(src, item), path.join(dest, item));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

// 3. Salin direktori ke staging
console.log("\n📁 Menyalin folder terpilih ke area staging...");
for (const dirName of DIRS_TO_COPY) {
  const src = path.join(ROOT_DIR, dirName);
  const dest = path.join(STAGING_DIR, dirName);
  if (fs.existsSync(src)) {
    process.stdout.write(`  • Menyalin ${dirName}... `);
    copyRecursive(src, dest);
    console.log("OK");
  }
}

// 4. Salin file root ke staging
console.log("\n📄 Menyalin file root terpilih ke area staging...");
for (const fileName of FILES_TO_COPY) {
  const src = path.join(ROOT_DIR, fileName);
  const dest = path.join(STAGING_DIR, fileName);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`  • Menyalin ${fileName}`);
  } else {
    console.log(`  - Melewati ${fileName} (tidak ditemukan)`);
  }
}

// 5. Kompresi menggunakan tar bsdtar bawaan Windows ke format zip
console.log("\n🗜️  Membuat file arsip ZIP...");
try {
  execSync(`tar -a -c -f "${OUTPUT_ZIP}" *`, {
    cwd: STAGING_DIR,
    stdio: "inherit",
  });
  console.log("✅ Arsip ZIP berhasil dibuat.");
} catch (err) {
  console.error("❌ Gagal membuat zip dengan tar:", err.message);
  process.exit(1);
}

// 6. Bersihkan area staging
console.log("\n🧹 Membersihkan area staging...");
fs.rmSync(STAGING_DIR, { recursive: true, force: true });

// 7. Tampilkan info ukuran file zip
const zipStats = fs.statSync(OUTPUT_ZIP);
const sizeMB = (zipStats.size / (1024 * 1024)).toFixed(2);
console.log("\n🎉 SELESAI!");
console.log(`📦 Lokasi Arsip: ${OUTPUT_ZIP}`);
console.log(`📊 Ukuran File : ${sizeMB} MB (${zipStats.size.toLocaleString("id-ID")} bytes)`);
console.log("==================================================");
