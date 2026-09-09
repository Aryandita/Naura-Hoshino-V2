"use strict";

/**
 * Wrapper build dashboard.
 *
 * Vite memiliki bug html-inline-proxy ("No matching HTML proxy module
 * found") saat REALPATH proyek Windows mengandung SPASI, contoh:
 * "d:/Naura Hoshino V2".
 *
 * Solusi: salin sumber frontend (src, public, vite.config.mjs) ke folder build
 * tanpa spasi di %TEMP%, junction-kan node_modules root agar dependensi tidak diduplikasi,
 * jalankan build di sana, lalu salin dist/ kembali ke dashboard/dist.
 */

const { execFileSync, execSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const dashboardDir = path.join(projectRoot, "dashboard");
const buildRoot =
  process.env.NAURA_BUILD_DIR || path.join(os.tmpdir(), "naura-dashboard-build");

const COPY_FILES = ["vite.config.mjs"];
const COPY_DIRS = ["src", "public"];

function resetInside(parent, name) {
  fs.rmSync(path.join(parent, name), { recursive: true, force: true });
}

function ensureNodeModulesLink() {
  const link = path.join(buildRoot, "node_modules");
  const realTarget = path.join(projectRoot, "node_modules");

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
        console.warn(`[BUILD] Symlink failed: ${err.message}`);
      }
    }
    console.log(`[BUILD] Junction/symlink node_modules dibuat.`);
  }
}

function main() {
  if (!fs.existsSync(dashboardDir)) {
    console.error("[BUILD] Folder dashboard tidak ditemukan.");
    process.exit(1);
  }

  // Kompilasi Tailwind CSS terlebih dahulu
  console.log("[BUILD] Mengompilasi Tailwind CSS...");
  try {
    execSync("npm run build:css", {
      cwd: projectRoot,
      stdio: "inherit",
    });
  } catch (err) {
    console.warn(`[BUILD] Peringatan: build:css gagal (${err.message}).`);
  }

  // Jika path tidak mengandung spasi, bangun langsung di folder dashboard
  if (!projectRoot.includes(" ")) {
    console.log(`[BUILD] Membangun langsung di ${dashboardDir}...`);
    try {
      execSync("npx vite build --config vite.config.mjs", {
        cwd: dashboardDir,
        stdio: "inherit",
      });
    } catch (err) {
      console.warn(`[BUILD] Peringatan: Build dashboard gagal (${err.message}).`);
      console.warn("[BUILD] Melanjutkan startup bot (dashboard akan fallback ke src/pages)...");
    }
    return;
  }

  // 1. Siapkan area build bersih (node_modules junction dipertahankan).
  fs.mkdirSync(buildRoot, { recursive: true });
  for (const dir of COPY_DIRS) resetInside(buildRoot, dir);
  resetInside(buildRoot, "dist");
  for (const file of COPY_FILES) {
    const srcFile = path.join(dashboardDir, file);
    if (fs.existsSync(srcFile)) {
      fs.copyFileSync(srcFile, path.join(buildRoot, file));
    }
  }
  for (const dir of COPY_DIRS) {
    const srcDir = path.join(dashboardDir, dir);
    if (fs.existsSync(srcDir)) {
      fs.cpSync(srcDir, path.join(buildRoot, dir), {
        recursive: true,
      });
    }
  }
  ensureNodeModulesLink();

  // 2. Build di path tanpa spasi.
  console.log(`[BUILD] Build dari: ${buildRoot}`);
  execSync("npx vite build --config vite.config.mjs", {
    cwd: buildRoot,
    stdio: "inherit",
  });

  // 3. Salin hasil build kembali ke lokasi dashboard/dist asli.
  resetInside(dashboardDir, "dist");
  fs.cpSync(path.join(buildRoot, "dist"), path.join(dashboardDir, "dist"), {
    recursive: true,
  });

  // 4. Pastikan dist/index.html tersedia untuk root routing di preview dan server statis
  const distSrcIndex = path.join(
    dashboardDir,
    "dist",
    "src",
    "pages",
    "index.html",
  );
  const distRootIndex = path.join(dashboardDir, "dist", "index.html");
  if (fs.existsSync(distSrcIndex)) {
    fs.copyFileSync(distSrcIndex, distRootIndex);
  }

  console.log(
    `[BUILD] dist tersalin ke ${path.join(dashboardDir, "dist")} (termasuk root index.html)`,
  );
}

main();
