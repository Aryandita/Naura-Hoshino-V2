"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const projectRoot = path.resolve(__dirname, "..");
const distPath = path.join(projectRoot, "dashboard-v2", "dist");

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
