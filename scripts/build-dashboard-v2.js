"use strict";

/**
 * Wrapper build dashboard-v2.
 *
 * Vite memiliki bug html-inline-proxy ("No matching HTML proxy module
 * found") saat REALPATH proyek Windows mengandung SPASI, contoh:
 * "d:/Naura Hoshino V2". Sudah diverifikasi dengan proyek probe identik:
 * sukses di path tanpa spasi, gagal konsisten di path ber-spasi (v6.3.5
 * sampai v7.x). NTFS junction pun tidak menolong karena Node me-resolve
 * junction kembali ke realpath asli.
 *
 * Solusi: salin sumber frontend ke folder build tanpa spasi di %TEMP%,
 * junction-kan node_modules agar dependensi tidak diduplikasi, jalankan
 * build di sana, lalu salin dist/ kembali ke dashboard-v2/dist.
 *
 * Lokasi folder build bisa ditimpa lewat env NAURA_V2_BUILD_DIR.
 */

const { execFileSync, execSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const dashboardDir = path.join(projectRoot, "dashboard-v2");
const buildRoot =
  process.env.NAURA_V2_BUILD_DIR || path.join(os.tmpdir(), "naura-v2-build");

/** File/folder yang ikut disalin ke area build. */
const COPY_FILES = ["vite.config.js", "package.json"];
const COPY_DIRS = ["src", "public"];

function resetInside(parent, name) {
  fs.rmSync(path.join(parent, name), { recursive: true, force: true });
}

function ensureNodeModulesLink() {
  const link = path.join(buildRoot, "node_modules");
  const realTarget = path.join(dashboardDir, "node_modules");

  let existing = null;
  try {
    existing = fs.readlinkSync(link);
  } catch {
    // Belum ada; akan dibuat.
  }

  if (!existing && !fs.existsSync(link)) {
    if (process.platform === "win32") {
      execFileSync("cmd.exe", ["/d", "/c", "mklink", "/J", link, realTarget]);
    } else {
      try {
        fs.symlinkSync(realTarget, link);
      } catch (err) {
        console.warn(`[BUILD-V2] Symlink failed: ${err.message}`);
      }
    }
    console.log(`[BUILD-V2] Junction/symlink node_modules dibuat.`);
  }
}

function main() {
  if (!fs.existsSync(dashboardDir)) {
    console.error("[BUILD-V2] Folder dashboard-v2 tidak ditemukan.");
    process.exit(1);
  }

  // Di Linux/Unix, pastikan biner di node_modules/.bin memiliki izin eksekusi (+x)
  if (process.platform !== "win32") {
    try {
      execSync("chmod +x node_modules/.bin/* 2>/dev/null || true", {
        cwd: projectRoot,
      });
      execSync("chmod +x node_modules/.bin/* 2>/dev/null || true", {
        cwd: dashboardDir,
      });
    } catch {
      // Abaikan jika chmod gagal
    }
  }

  // Jika path tidak mengandung spasi, bangun langsung di folder dashboard-v2
  if (!projectRoot.includes(" ")) {
    console.log(`[BUILD-V2] Membangun langsung di ${dashboardDir}...`);
    try {
      execSync("npm run build", {
        cwd: dashboardDir,
        stdio: "inherit",
      });
    } catch (err) {
      console.warn(`[BUILD-V2] Peringatan: Build dashboard gagal (${err.message}).`);
      console.warn("[BUILD-V2] Melanjutkan startup bot (dashboard akan fallback ke src/pages)...");
    }
    return;
  }

  // 1. Siapkan area build bersih (node_modules junction dipertahankan).
  fs.mkdirSync(buildRoot, { recursive: true });
  for (const dir of COPY_DIRS) resetInside(buildRoot, dir);
  resetInside(buildRoot, "dist");
  for (const file of COPY_FILES) {
    fs.copyFileSync(path.join(dashboardDir, file), path.join(buildRoot, file));
  }
  for (const dir of COPY_DIRS) {
    fs.cpSync(path.join(dashboardDir, dir), path.join(buildRoot, dir), {
      recursive: true,
    });
  }
  ensureNodeModulesLink();

  // 2. Build di path tanpa spasi.
  console.log(`[BUILD-V2] Build dari: ${buildRoot}`);
  execSync("npm run build", {
    cwd: buildRoot,
    stdio: "inherit",
  });

  // 3. Salin hasil build kembali ke lokasi asli.
  resetInside(dashboardDir, "dist");
  fs.cpSync(path.join(buildRoot, "dist"), path.join(dashboardDir, "dist"), {
    recursive: true,
  });

  // 4. Pastikan dist/index.html tersedia untuk root routing di preview dan server statis
  const distSrcIndex = path.join(dashboardDir, "dist", "src", "pages", "index.html");
  const distRootIndex = path.join(dashboardDir, "dist", "index.html");
  if (fs.existsSync(distSrcIndex)) {
    fs.copyFileSync(distSrcIndex, distRootIndex);
  }

  console.log(`[BUILD-V2] dist tersalin ke ${path.join(dashboardDir, "dist")} (termasuk root index.html)`);
}

main();
