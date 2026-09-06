"use strict";

const { execSync, spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");

function maskToken(str) {
  if (typeof str !== "string") return str;
  return str.replace(/https:\/\/[^@\s]+@/g, "https://***@");
}

// Muat file .env secara mandiri agar variabel seperti GITHUB_TOKEN langsung terbaca
function loadDotEnv() {
  const envPath = path.join(rootDir, ".env");
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
  rootDir,
  "plugin",
  "utility",
  "notification.js",
);
if (fs.existsSync(deprecatedNotificationFile)) {
  try {
    fs.unlinkSync(deprecatedNotificationFile);
    console.log(
      "[AUTO-UPDATE] Membersihkan file duplikat usang: plugin/utility/notification.js",
    );
  } catch (_) {}
}

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

let authedUrl = repoUrl;
if (!authedUrl.startsWith("http://") && !authedUrl.startsWith("https://")) {
  authedUrl = token ? `https://${token}@${authedUrl}` : `https://${authedUrl}`;
} else if (token) {
  if (authedUrl.includes("@")) {
    authedUrl = authedUrl.replace(/https:\/\/[^@]+@/, `https://${token}@`);
  } else {
    authedUrl = authedUrl.replace("https://", `https://${token}@`);
  }
}

const branch = process.env.BRANCH || "main";
const safeEnv = {
  ...process.env,
  GIT_TERMINAL_PROMPT: "0",
  GIT_ASKPASS: "",
};

function run(command, timeout = 15000, stdio = "pipe") {
  try {
    execSync(command, { cwd: rootDir, stdio, timeout, env: safeEnv });
    return true;
  } catch (error) {
    const rawMsg = error.stderr ? error.stderr.toString() : error.message;
    console.warn(
      `[AUTO-UPDATE] Kendala pada command git:`,
      maskToken(rawMsg).trim(),
    );
    return false;
  }
}

function autoUpdate() {
  console.log("==================================================");
  console.log("🌸 [AUTO-UPDATE] Memeriksa sinkronisasi GitHub...");
  console.log("==================================================");

  if (token) {
    const masked =
      token.length > 8 ? `${token.slice(0, 4)}...${token.slice(-4)}` : "***";
    console.log(
      `📦 [AUTO-UPDATE] GITHUB_TOKEN terdeteksi (${masked}). Menggunakan otentikasi repo.`,
    );
  } else {
    console.log(
      "📦 [AUTO-UPDATE] GITHUB_TOKEN tidak terdeteksi di .env atau variabel hosting.",
    );
  }

  const gitDir = path.join(rootDir, ".git");

  if (!fs.existsSync(gitDir)) {
    console.log("📦 [AUTO-UPDATE] Folder .git belum terdeteksi.");
    console.log(
      `📦 [AUTO-UPDATE] Menghubungkan direktori ke remote (branch: ${branch})...`,
    );
    run("git init -b main 2>/dev/null || git init", 10000, "ignore");
  }

  // Pastikan remote origin selalu terpasang
  try {
    execSync(`git remote add origin "${authedUrl}"`, {
      cwd: rootDir,
      stdio: "ignore",
      timeout: 5000,
      env: safeEnv,
    });
  } catch (_) {
    execSync(`git remote set-url origin "${authedUrl}"`, {
      cwd: rootDir,
      stdio: "ignore",
      timeout: 5000,
      env: safeEnv,
    });
  }

  console.log(
    `🔄 [AUTO-UPDATE] Menarik pembaruan terbaru dari origin/${branch}...`,
  );
  const fetched = run(`git fetch origin ${branch}`);
  if (fetched) {
    run(`git checkout -f -B ${branch} origin/${branch}`);
    console.log(
      "✅ [AUTO-UPDATE] Berhasil menyinkronkan kode ke commit terbaru!",
    );
  } else {
    console.warn(
      "⚠️ [AUTO-UPDATE] Melewati sinkronisasi (repositori privat butuh token atau kendala jaringan).",
    );
  }
}

try {
  autoUpdate();
} catch (err) {
  console.warn(
    "⚠️ [AUTO-UPDATE] Terjadi kendala saat update:",
    maskToken(err.message),
  );
}

console.log("🚀 [AUTO-UPDATE] Menjalankan Naura Hoshino via npm start...\n");
const child = spawn("npm", ["start"], {
  cwd: rootDir,
  stdio: "inherit",
  shell: true,
});

child.on("exit", (code) => {
  process.exit(code || 0);
});
