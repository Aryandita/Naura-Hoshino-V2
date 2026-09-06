"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const projectRoot = path.resolve(__dirname, "..");
const distPath = path.join(projectRoot, "dashboard-v2", "dist");

// Sanitizer untuk mencegah token bocor di log console
function maskToken(str) {
  if (typeof str !== "string") return str;
  return str.replace(/https:\/\/[^@\s]+@/g, "https://***@");
}

// ── 1. Auto-update Git di Pterodactyl (Aktif saat npm start di server) ──
const isPterodactyl =
  Boolean(process.env.P_SERVER_UUID) ||
  fs.existsSync("/home/container") ||
  process.env.AUTO_UPDATE === "1";

if (isPterodactyl) {
  const token =
    process.env.GITHUB_TOKEN ||
    process.env.GIT_TOKEN ||
    process.env.GH_TOKEN ||
    "";
  let repoUrl =
    process.env.GIT_ADDRESS || "github.com/Aryandita/Naura-Hoshino-V2.git";

  if (!repoUrl.startsWith("http://") && !repoUrl.startsWith("https://")) {
    repoUrl = token ? `https://${token}@${repoUrl}` : `https://${repoUrl}`;
  } else if (token && !repoUrl.includes("@")) {
    repoUrl = repoUrl.replace("https://", `https://${token}@`);
  }

  const branch = process.env.BRANCH || "main";
  const safeEnv = {
    ...process.env,
    GIT_TERMINAL_PROMPT: "0",
    GIT_ASKPASS: "",
  };

  try {
    const gitDir = path.join(projectRoot, ".git");
    if (!fs.existsSync(gitDir)) {
      console.log("[STARTUP] Inisialisasi Git repository di server...");
      execSync("git init -b main 2>/dev/null || git init", {
        cwd: projectRoot,
        stdio: "ignore",
        timeout: 10000,
        env: safeEnv,
      });
    }

    // Pastikan remote origin selalu mengarah ke repository yang benar
    try {
      execSync(`git remote add origin ${repoUrl}`, {
        cwd: projectRoot,
        stdio: "ignore",
        timeout: 5000,
        env: safeEnv,
      });
    } catch (_) {
      execSync(`git remote set-url origin ${repoUrl}`, {
        cwd: projectRoot,
        stdio: "ignore",
        timeout: 5000,
        env: safeEnv,
      });
    }

    console.log(`[STARTUP] Memeriksa pembaruan GitHub (origin/${branch})...`);
    execSync(`git fetch origin ${branch}`, {
      cwd: projectRoot,
      stdio: "pipe",
      timeout: 15000,
      env: safeEnv,
    });
    execSync(`git checkout -f -B ${branch} origin/${branch}`, {
      cwd: projectRoot,
      stdio: "pipe",
      timeout: 15000,
      env: safeEnv,
    });
    console.log("[STARTUP] Sinkronisasi kode GitHub selesai.");
  } catch (err) {
    const safeMsg = maskToken(err.stderr ? err.stderr.toString() : err.message);
    console.warn(
      "[STARTUP] Pembaruan Git dilewati (repositori privat butuh token atau kendala jaringan):",
      safeMsg.trim(),
    );
  }
}

// ── 2. Bangun Frontend Dashboard bila belum ada ──
if (!fs.existsSync(distPath)) {
  console.log("[STARTUP] dashboard-v2/dist belum ada. Membangun frontend...");
  try {
    execSync("node scripts/build-dashboard-v2.js", {
      cwd: projectRoot,
      stdio: "inherit",
    });
  } catch (err) {
    console.warn("[STARTUP] Gagal membangun dashboard-v2:", err.message);
  }
}
