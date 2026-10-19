"use strict";

/**
 * sync-android-assets.js
 *
 * Compiles the mobile dashboard PWA and synchronizes built web assets into the
 * Android project (android/app/src/main/assets/www).
 * Generates an offline fallback screen (offline.html) and adaptive launcher icons.
 */

const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const mobileDir = path.join(projectRoot, "dashboard", "mobile");
const mobileDistDir = path.join(mobileDir, "dist");
const androidAssetsDir = path.join(projectRoot, "android", "app", "src", "main", "assets", "www");
const publicDir = path.join(projectRoot, "dashboard", "public");

function log(msg) {
  console.log(`[SYNC-ANDROID] ${msg}`);
}

function buildMobile() {
  log("Building mobile dashboard with Vite...");
  execSync("npm run mobile:build", {
    cwd: projectRoot,
    stdio: "inherit",
  });
}

function copyDirectory(src, dest) {
  if (!fs.existsSync(src)) {
    throw new Error(`Source directory does not exist: ${src}`);
  }
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function generateOfflineHtml() {
  const offlineHtmlContent = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <title>Naura OS - Mode Offline</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-tap-highlight-color: transparent;
      user-select: none;
    }
    body {
      background-color: #0B0F19;
      color: #E2E8F0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
      overflow: hidden;
    }
    .background-glow {
      position: fixed;
      width: 320px;
      height: 320px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(255, 182, 193, 0.12) 0%, rgba(0, 255, 255, 0.05) 50%, transparent 80%);
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
      z-index: 0;
    }
    .card {
      position: relative;
      z-index: 1;
      width: 100%;
      max-width: 360px;
      background: #121826;
      border: 1px solid rgba(255, 182, 193, 0.2);
      border-radius: 20px;
      padding: 32px 24px;
      text-align: center;
      box-shadow: 0 16px 32px rgba(0, 0, 0, 0.6), 0 0 24px rgba(255, 182, 193, 0.08);
      backdrop-filter: blur(12px);
    }
    .icon-container {
      width: 72px;
      height: 72px;
      margin: 0 auto 20px auto;
      border-radius: 50%;
      background: rgba(255, 182, 193, 0.08);
      border: 1px solid rgba(255, 182, 193, 0.25);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 16px rgba(255, 182, 193, 0.2);
    }
    .icon-container svg {
      width: 36px;
      height: 36px;
      fill: none;
      stroke: #FFB6C1;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1.5px;
      color: #00FFFF;
      background: rgba(0, 255, 255, 0.1);
      border: 1px solid rgba(0, 255, 255, 0.3);
      border-radius: 9999px;
      margin-bottom: 16px;
      text-transform: uppercase;
    }
    h1 {
      font-size: 20px;
      font-weight: 800;
      color: #FFFFFF;
      margin-bottom: 10px;
      letter-spacing: -0.3px;
    }
    p {
      font-size: 13.5px;
      line-height: 1.5;
      color: #94A3B8;
      margin-bottom: 24px;
    }
    .btn-retry {
      width: 100%;
      padding: 13px 20px;
      background: linear-gradient(135deg, #FFB6C1 0%, #F472B6 100%);
      color: #0B0F19;
      font-size: 14px;
      font-weight: 700;
      border: none;
      border-radius: 12px;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(244, 114, 182, 0.35);
      transition: transform 0.15s ease, opacity 0.15s ease;
    }
    .btn-retry:active {
      transform: scale(0.97);
      opacity: 0.9;
    }
    .status-hint {
      margin-top: 18px;
      font-size: 11px;
      color: #64748B;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    .dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #EF4444;
      box-shadow: 0 0 6px #EF4444;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.85); }
    }
  </style>
</head>
<body>
  <div class="background-glow"></div>
  <div class="card">
    <div class="icon-container">
      <svg viewBox="0 0 24 24">
        <line x1="1" y1="1" x2="23" y2="23"></line>
        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"></path>
        <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"></path>
        <path d="M10.71 5.05A16 16 0 0 1 22.58 9"></path>
        <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"></path>
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
        <line x1="12" y1="20" x2="12.01" y2="20"></line>
      </svg>
    </div>
    <div class="badge">Koneksi Terputus</div>
    <h1>Mode Luar Jaringan</h1>
    <p>Naura OS memerlukan sambungan jaringan untuk memuat pembaruan terkini. Aplikasi akan otomatis terhubung kembali saat internet tersedia.</p>
    <button class="btn-retry" id="retryBtn" onclick="handleRetry()">Coba Muat Ulang</button>
    <div class="status-hint">
      <span class="dot" id="statusDot"></span>
      <span id="statusText">Menunggu sinyal jaringan...</span>
    </div>
  </div>

  <script>
    function handleRetry() {
      const btn = document.getElementById('retryBtn');
      btn.innerText = 'Menghubungkan...';
      btn.disabled = true;

      if (window.NauraNative && typeof window.NauraNative.vibrate === 'function') {
        window.NauraNative.vibrate(30);
      }

      setTimeout(function() {
        if (window.NauraNative && typeof window.NauraNative.reload === 'function') {
          window.NauraNative.reload();
        } else {
          window.location.reload();
        }
      }, 350);
    }

    window.addEventListener('online', function() {
      const dot = document.getElementById('statusDot');
      const text = document.getElementById('statusText');
      if (dot) {
        dot.style.background = '#10B981';
        dot.style.boxShadow = '0 0 6px #10B981';
      }
      if (text) {
        text.innerText = 'Jaringan terdeteksi! Memuat...';
      }
      setTimeout(handleRetry, 600);
    });
  </script>
</body>
</html>
`;
  const offlinePath = path.join(androidAssetsDir, "offline.html");
  fs.writeFileSync(offlinePath, offlineHtmlContent, "utf8");
  log(`Generated offline fallback screen at ${offlinePath}`);
}

async function generateAppIcons() {
  const iconSource = path.join(publicDir, "naura_3d_closeup.png");
  if (!fs.existsSync(iconSource)) {
    log("Icon source naura_3d_closeup.png not found, keeping vector adaptive icons.");
    return;
  }

  try {
    const { createCanvas, loadImage } = require("../src/canvas/canvasRuntime");
    const sourceImage = await loadImage(iconSource);

    const iconSizes = [
      { folder: "mipmap-mdpi", size: 48 },
      { folder: "mipmap-hdpi", size: 72 },
      { folder: "mipmap-xhdpi", size: 96 },
      { folder: "mipmap-xxhdpi", size: 144 },
      { folder: "mipmap-xxxhdpi", size: 192 },
    ];

    const resDir = path.join(projectRoot, "android", "app", "src", "main", "res");

    for (const { folder, size } of iconSizes) {
      const targetFolder = path.join(resDir, folder);
      if (!fs.existsSync(targetFolder)) continue;

      // Clean up any existing webp launcher icons to prevent duplicate resources error
      const webpFiles = ["ic_launcher.webp", "ic_launcher_round.webp"];
      for (const webpFile of webpFiles) {
        const fullWebpPath = path.join(targetFolder, webpFile);
        if (fs.existsSync(fullWebpPath)) {
          fs.unlinkSync(fullWebpPath);
        }
      }

      // Square launcher icon
      const canvas = createCanvas(size, size);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(sourceImage, 0, 0, size, size);
      const pngBuffer = canvas.toBuffer("image/png");
      fs.writeFileSync(path.join(targetFolder, "ic_launcher.png"), pngBuffer);

      // Round launcher icon with circular clip
      const roundCanvas = createCanvas(size, size);
      const roundCtx = roundCanvas.getContext("2d");
      roundCtx.save();
      roundCtx.beginPath();
      roundCtx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2, true);
      roundCtx.closePath();
      roundCtx.clip();
      roundCtx.drawImage(sourceImage, 0, 0, size, size);
      roundCtx.restore();
      const roundBuffer = roundCanvas.toBuffer("image/png");
      fs.writeFileSync(path.join(targetFolder, "ic_launcher_round.png"), roundBuffer);
    }

    log("Generated launcher icons across all mipmap densities.");
  } catch (err) {
    log(`Notice: Icon generation skipped (${err.message}), using adaptive icons.`);
  }
}

async function main() {
  log("Starting Android asset synchronization...");

  // 1. Compile Mobile PWA
  buildMobile();

  // 2. Prepare Android assets directory
  if (fs.existsSync(androidAssetsDir)) {
    fs.rmSync(androidAssetsDir, { recursive: true, force: true });
  }
  fs.mkdirSync(androidAssetsDir, { recursive: true });

  // 3. Copy mobile dist files to assets/www
  log(`Copying mobile dist to ${androidAssetsDir}...`);
  copyDirectory(mobileDistDir, androidAssetsDir);

  // Ensure root index.html exists in www
  const mobilePageIndex = path.join(androidAssetsDir, "src", "pages", "index.html");
  const wwwRootIndex = path.join(androidAssetsDir, "index.html");
  if (fs.existsSync(mobilePageIndex)) {
    fs.copyFileSync(mobilePageIndex, wwwRootIndex);
  }

  // Also synchronize to assets/ root so /mobile/ path handler can resolve assets directly
  const androidRootAssets = path.join(projectRoot, "android", "app", "src", "main", "assets");
  copyDirectory(mobileDistDir, androidRootAssets);

  // 4. Copy manifest and public assets
  const filesToCopy = ["manifest.json", "favicon.ico", "naura_3d_closeup.png"];
  for (const fileName of filesToCopy) {
    const srcFile = path.join(publicDir, fileName);
    if (fs.existsSync(srcFile)) {
      fs.copyFileSync(srcFile, path.join(androidAssetsDir, fileName));
      fs.copyFileSync(srcFile, path.join(androidRootAssets, fileName));
    }
  }

  // 5. Generate offline fallback screen
  generateOfflineHtml();
  const rootOfflinePath = path.join(androidRootAssets, "offline.html");
  const wwwOfflinePath = path.join(androidAssetsDir, "offline.html");
  if (fs.existsSync(wwwOfflinePath)) {
    fs.copyFileSync(wwwOfflinePath, rootOfflinePath);
  }

  // 6. Generate Android app icons
  await generateAppIcons();

  log("Android asset synchronization completed successfully!");
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`[SYNC-ANDROID] Failed: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { main };
