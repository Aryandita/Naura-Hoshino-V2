"use strict";

/**
 * build-apk.js
 *
 * Orchestrates the full Android APK compilation workflow:
 * 1. Synchronizes latest mobile web bundle and offline fallback assets.
 * 2. Compiles the native Android application via Gradle (assembleDebug).
 * 3. Verifies the generated APK and stages it to dashboard/dist/naura-os-mobile.apk.
 */

const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const androidDir = path.join(projectRoot, "android");
const apkSourcePath = path.join(
  androidDir,
  "app",
  "build",
  "outputs",
  "apk",
  "debug",
  "app-debug.apk"
);
const distDir = path.join(projectRoot, "dashboard", "dist");
const apkTargetPath = path.join(distDir, "naura-os-mobile.apk");

function log(msg) {
  console.log(`[BUILD-APK] ${msg}`);
}

function syncAssets() {
  log("Step 1/3: Synchronizing mobile assets into Android project...");
  const { main: syncMain } = require("./sync-android-assets");
  return syncMain();
}

function compileApk() {
  log("Step 2/3: Invoking Gradle assembleDebug...");
  const isWindows = process.platform === "win32";
  const gradlewCmd = isWindows ? ".\\gradlew.bat assembleDebug" : "./gradlew assembleDebug";

  execSync(gradlewCmd, {
    cwd: androidDir,
    stdio: "inherit",
    env: process.env,
  });
}

function stageArtifact() {
  log("Step 3/3: Verifying and staging generated APK...");
  if (!fs.existsSync(apkSourcePath)) {
    throw new Error(`Expected APK not found at: ${apkSourcePath}`);
  }

  const stat = fs.statSync(apkSourcePath);
  const sizeMb = (stat.size / (1024 * 1024)).toFixed(2);
  log(`Found compiled APK (${sizeMb} MB) at ${apkSourcePath}`);

  fs.mkdirSync(distDir, { recursive: true });
  fs.copyFileSync(apkSourcePath, apkTargetPath);

  log(`APK successfully staged to: ${apkTargetPath}`);
}

async function run() {
  const startTime = Date.now();
  try {
    await syncAssets();
    compileApk();
    stageArtifact();
    const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
    log(`Build completed successfully in ${elapsedSec}s!`);
  } catch (err) {
    console.error(`[BUILD-APK] Compilation failed: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  run();
}

module.exports = { run };
