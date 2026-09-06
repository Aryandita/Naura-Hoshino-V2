"use strict";

const { execSync, spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");

function maskToken(str) {
  if (typeof str !== "string") return str;
  return str.replace(/https:\/\/[^@\s]+@/g, "https://***@");
}

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
    execSync(`git remote add origin ${repoUrl}`, {
      cwd: rootDir,
      stdio: "ignore",
      timeout: 5000,
      env: safeEnv,
    });
  } catch (_) {
    execSync(`git remote set-url origin ${repoUrl}`, {
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
