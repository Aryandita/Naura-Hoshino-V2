"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const projectRoot = path.resolve(__dirname, "..");
const distPath = path.join(projectRoot, "dashboard", "dist");

// Sanitizer untuk mencegah token bocor di log console
function maskToken(str) {
  if (typeof str !== "string") return str;
  return str.replace(/https:\/\/[^@\s]+@/g, "https://***@");
}

// Muat file .env secara mandiri agar variabel seperti GITHUB_TOKEN langsung terbaca
function loadDotEnv() {
  const envPath = path.join(projectRoot, ".env");
  try {
    process.loadEnvFile(envPath);
  } catch (_) {}

  try {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf8");
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          val = val.replace(/^["']|["']$/g, "").trim();
          if (!process.env[key] && val) {
            process.env[key] = val;
          }
        }
      }
    }
  } catch (_) {}
}
loadDotEnv();

// Bersihkan file usang jika masih tersisa di server
const deprecatedNotificationFile = path.join(
  projectRoot,
  "plugin",
  "utility",
  "notification.js",
);
if (fs.existsSync(deprecatedNotificationFile)) {
  try {
    fs.unlinkSync(deprecatedNotificationFile);
    console.log(
      "[STARTUP] Membersihkan file duplikat usang: plugin/utility/notification.js",
    );
  } catch (_) {}
}

// ── 1. Auto-update Git di Pterodactyl (Aktif saat npm start di server) ──
const isPterodactyl =
  Boolean(process.env.P_SERVER_UUID) ||
  fs.existsSync("/home/container") ||
  process.env.AUTO_UPDATE === "1";

if (isPterodactyl) {
  const rawToken =
    process.env.GITHUB_TOKEN ||
    process.env.GIT_TOKEN ||
    process.env.GH_TOKEN ||
    process.env.github_token ||
    process.env.git_token ||
    "";
  const token = rawToken.replace(/^["']|["']$/g, "").trim();

  let repoUrl =
    process.env.GIT_ADDRESS || "github.com/Aryandita/Naura-Hoshino-V2.git";
  repoUrl = repoUrl.replace(/^["']|["']$/g, "").trim();

  if (token) {
    const masked =
      token.length > 8 ? `${token.slice(0, 4)}...${token.slice(-4)}` : "***";
    console.log(
      `[STARTUP] GITHUB_TOKEN terdeteksi (${masked}). Mengaktifkan sinkronisasi otomatis.`,
    );
  } else {
    console.log(
      "[STARTUP] GITHUB_TOKEN tidak terdeteksi di .env maupun variabel hosting.",
    );
  }

  let authedUrl = repoUrl;
  if (token) {
    // Bersihkan prefix protokol atau kredensial lama bila ada
    const cleanAddress = repoUrl
      .replace(/^https?:\/\//, "")
      .replace(/^[^@]+@/, "");
    // Format universal GitHub token agar Git tidak memicu terminal prompt username
    authedUrl = `https://x-access-token:${token}@${cleanAddress}`;
  } else if (
    !authedUrl.startsWith("http://") &&
    !authedUrl.startsWith("https://")
  ) {
    authedUrl = `https://${authedUrl}`;
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
      execSync(`git remote add origin "${authedUrl}"`, {
        cwd: projectRoot,
        stdio: "ignore",
        timeout: 5000,
        env: safeEnv,
      });
    } catch (_) {
      execSync(`git remote set-url origin "${authedUrl}"`, {
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
  console.log("[STARTUP] dashboard/dist belum ada. Membangun frontend...");
  try {
    execSync("node scripts/build-dashboard.js", {
      cwd: projectRoot,
      stdio: "inherit",
    });
  } catch (err) {
    console.warn("[STARTUP] Gagal membangun dashboard:", err.message);
  }
}
