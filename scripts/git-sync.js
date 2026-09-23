"use strict";

/**
 * git-sync.js - Script Otomatisasi Git Commit & Push ke GitHub
 *
 * Menjamin setiap pembaruan tugas atau fitur langsung tersimpan dan tersinkronisasi
 * ke repositori remote GitHub (Zero-Lag GitHub Sync) tanpa ada perubahan yang tertinggal di staging.
 *
 * Penggunaan:
 *   node scripts/git-sync.js "feat(voice): implement full-duplex webrtc companion"
 *   npm run sync:github -- "fix(economy): resolve auction fee rounding"
 */

const { execSync } = require("node:child_process");

function runGit(cmd) {
  try {
    return execSync(cmd, {
      stdio: ["pipe", "pipe", "pipe"],
      encoding: "utf8",
    }).trim();
  } catch (err) {
    const stderr = err.stderr ? err.stderr.toString() : err.message;
    throw new Error(`Git command failed: "${cmd}"\n${stderr}`);
  }
}

function main() {
  console.log(
    "🚀 [GitSync] Memulai pemeriksaan sinkronisasi repositori GitHub...",
  );

  // 1. Dapatkan status perubahan
  const status = runGit("git status --porcelain");
  if (!status) {
    console.log(
      "✅ [GitSync] Repositori sudah bersih (working tree clean). Tidak ada perubahan untuk di-commit.",
    );
    return;
  }

  // 2. Dapatkan branch saat ini
  let currentBranch = "main";
  try {
    currentBranch = runGit("git rev-parse --abbrev-ref HEAD") || "main";
  } catch (_) {
    currentBranch = "main";
  }

  // 3. Tentukan pesan commit dari argumen CLI atau default semantik
  const customMessage = process.argv
    .slice(2)
    .filter((arg) => !arg.startsWith("--"))
    .join(" ")
    .trim();
  const commitMessage =
    customMessage ||
    `chore(update): sync repository updates and milestone progress [${new Date().toISOString().split("T")[0]}]`;

  console.log(
    `📦 [GitSync] Perubahan terdeteksi pada branch "${currentBranch}". Menyiapkan commit...`,
  );
  console.log(`📝 [GitSync] Pesan commit: "${commitMessage}"`);

  // 4. Staging seluruh perubahan (git add -A)
  runGit("git add -A");
  console.log("➕ [GitSync] Seluruh file berhasil dimasukkan ke staging area.");

  // 5. Commit perubahan
  const commitOutput = runGit(
    `git commit -m "${commitMessage.replace(/"/g, '\\"')}"`,
  );
  console.log(`💾 [GitSync] Commit berhasil dibuat:\n${commitOutput}`);

  // 6. Push ke remote origin
  console.log(
    `🌐 [GitSync] Mengirimkan perubahan ke remote origin/${currentBranch}...`,
  );
  try {
    const pushOutput = runGit(`git push origin ${currentBranch}`);
    if (pushOutput) {
      console.log(pushOutput);
    }
    console.log(
      `🎉 [GitSync] Sinkronisasi ke GitHub selesai dengan sukses! Branch: ${currentBranch}`,
    );
  } catch (pushErr) {
    console.warn(
      `⚠️ [GitSync] Peringatan: Push gagal atau jaringan bermasalah:\n${pushErr.message}`,
    );
    console.warn("Commit lokal tetap aman tersimpan di git history.");
  }
}

main();
