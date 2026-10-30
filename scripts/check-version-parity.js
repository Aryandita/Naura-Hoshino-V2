"use strict";

/**
 * check-version-parity.js
 *
 * Automated SSOT Version Parity Validator for Naura Hoshino V2.
 * Validates 100% agreement between canonical package.json version and:
 * 1. package-lock.json root and packages[""] definitions
 * 2. .env.example configuration and SSOT references
 * 3. Native Android wrapper (build.gradle.kts, NauraNativeBridge.kt, MainActivity.kt, README.md)
 * 4. Dashboard Web HTML pages (dashboard/src/pages/*.html and public templates)
 * 5. Dashboard 3D Component badge (NauraViewer) and mobile tokens (tokens.css)
 * 6. Operational scripts (view-logs.js, build_naura_model_new.js)
 * 7. Active documentation and guides (PRD.md, DASHBOARD_AUDIT.md, CHANGELOG.md, LICENSE)
 * 8. Core JSDoc @version annotations in plugin and canvas modules
 *
 * Usage:
 *   node scripts/check-version-parity.js
 */

const fs = require("node:fs");
const path = require("node:path");

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
  gray: "\x1b[90m",
};

const projectRoot = path.resolve(__dirname, "..");

function readFileSafe(relPath) {
  const fullPath = path.join(projectRoot, relPath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File tidak ditemukan: ${relPath}`);
  }
  return fs.readFileSync(fullPath, "utf8");
}

function checkVersionParity() {
  const startTime = Date.now();
  console.log(`\n${C.bold}${C.cyan}╔══════════════════════════════════════════════════════════════════════════╗${C.reset}`);
  console.log(`${C.bold}${C.cyan}║   NAURA HOSHINO V2 - SSOT REPOSITORY VERSION PARITY CHECKER             ║${C.reset}`);
  console.log(`${C.bold}${C.cyan}╚══════════════════════════════════════════════════════════════════════════╝${C.reset}\n`);

  // 1. Read Canonical Version SSOT
  const pkgPath = path.join(projectRoot, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const expectedVer = pkg.version;

  if (!expectedVer) {
    console.error(`${C.red}✖ package.json tidak memiliki properti "version"${C.reset}`);
    process.exit(1);
  }

  console.log(`[SSOT] Versi Referensi Resmi (package.json): ${C.bold}${C.green}v${expectedVer}${C.reset}\n`);

  const checks = [];
  function assert(name, condition, details) {
    checks.push({ name, passed: Boolean(condition), details: details || "" });
  }

  // 2. package-lock.json
  try {
    const lock = JSON.parse(readFileSafe("package-lock.json"));
    assert(
      "package-lock.json (root version)",
      lock.version === expectedVer,
      `Diharapkan "${expectedVer}", ditemukan "${lock.version}"`,
    );
    assert(
      "package-lock.json (packages[''].version)",
      lock.packages && lock.packages[""] && lock.packages[""].version === expectedVer,
      `Diharapkan "${expectedVer}", ditemukan "${lock.packages && lock.packages[""] && lock.packages[""].version}"`,
    );
  } catch (err) {
    assert("package-lock.json", false, err.message);
  }

  // 3. .env.example
  try {
    const envExample = readFileSafe(".env.example");
    const hasOutdated = envExample.includes('BOT_VERSION="2.3.0"') || envExample.includes('ENGINE_VERSION="2.3.0"');
    const hasSSOTNote = envExample.includes(expectedVer);
    assert(
      ".env.example (tidak memuat versi usang 2.3.0 & menyelaraskan SSOT)",
      !hasOutdated && hasSSOTNote,
      hasOutdated ? "Masih memuat BOT_VERSION/ENGINE_VERSION 2.3.0" : `Tidak memuat referensi v${expectedVer}`,
    );
  } catch (err) {
    assert(".env.example", false, err.message);
  }

  // 4. Android Native Project
  try {
    const gradleKts = readFileSafe("android/app/build.gradle.kts");
    assert(
      "android/app/build.gradle.kts (versionName)",
      gradleKts.includes(`versionName = "${expectedVer}"`),
      `Harus memuat: versionName = "${expectedVer}"`,
    );

    const bridgeKt = readFileSafe("android/app/src/main/java/com/naura/dashboard/NauraNativeBridge.kt");
    assert(
      "NauraNativeBridge.kt (getAppVersion)",
      bridgeKt.includes(`return "${expectedVer}"`),
      `Harus mengembalikan: "${expectedVer}"`,
    );

    const mainKt = readFileSafe("android/app/src/main/java/com/naura/dashboard/MainActivity.kt");
    assert(
      "MainActivity.kt (userAgentString)",
      mainKt.includes(`NauraOS-Android/${expectedVer}`),
      `Harus memuat: NauraOS-Android/${expectedVer}`,
    );

    const androidReadme = readFileSafe("android/README.md");
    assert(
      "android/README.md (version string)",
      androidReadme.includes(`(${expectedVer})`) || androidReadme.includes(`(\`${expectedVer}\`)`),
      `Harus memuat: (${expectedVer}) atau (\`${expectedVer}\`)`,
    );
  } catch (err) {
    assert("Android Project Files", false, err.message);
  }

  // 5. Dashboard Pages (dashboard/src/pages/*.html)
  try {
    const pagesDir = path.join(projectRoot, "dashboard", "src", "pages");
    if (fs.existsSync(pagesDir)) {
      const pageFiles = fs.readdirSync(pagesDir).filter((f) => f.endsWith(".html"));
      let outdatedCount = 0;
      const failedPages = [];

      for (const file of pageFiles) {
        const content = fs.readFileSync(path.join(pagesDir, file), "utf8");
        if (content.includes("v2.3.0") || content.includes("v2.2.0") || content.includes("v2.1 3D")) {
          outdatedCount++;
          failedPages.push(file);
        }
      }

      assert(
        `dashboard/src/pages/*.html (${pageFiles.length} file bebas versi usang)`,
        outdatedCount === 0,
        outdatedCount > 0 ? `Halaman berikut memuat versi usang: ${failedPages.join(", ")}` : "",
      );
    }
  } catch (err) {
    assert("dashboard/src/pages/*.html", false, err.message);
  }

  // 6. Dashboard Components & Mobile Tokens
  try {
    const viewerIdx = readFileSafe("dashboard/src/components/NauraViewer/index.js");
    assert(
      "dashboard/src/components/NauraViewer/index.js (3D AI badge)",
      viewerIdx.includes(`v${expectedVer} 3D AI`) || viewerIdx.includes(`v${expectedVer.slice(0, 3)} 3D AI`),
      `Harus memuat badge v${expectedVer} 3D AI`,
    );

    const mobileTokens = readFileSafe("dashboard/mobile/src/css/tokens.css");
    assert(
      "dashboard/mobile/src/css/tokens.css (DESIGN.md header version)",
      mobileTokens.includes(`versi ${expectedVer}-naura-os`),
      `Harus memuat: versi ${expectedVer}-naura-os`,
    );
  } catch (err) {
    assert("Dashboard Components", false, err.message);
  }

  // 7. Operational Scripts
  try {
    const viewLogs = readFileSafe("scripts/view-logs.js");
    assert(
      "scripts/view-logs.js (fallback BOT_VERSION)",
      viewLogs.includes(`env.BOT_VERSION || "${expectedVer}"`),
      `Harus memuat: env.BOT_VERSION || "${expectedVer}"`,
    );

    const buildModel = readFileSafe("scripts/build_naura_model_new.js");
    assert(
      "scripts/build_naura_model_new.js (exporter & meta version)",
      buildModel.includes(`exporterVersion: "NauraEngine-${expectedVer}-NEW"`) &&
        buildModel.includes(`version: "${expectedVer}"`),
      `Harus memuat: exporterVersion "NauraEngine-${expectedVer}-NEW" & version "${expectedVer}"`,
    );
  } catch (err) {
    assert("Operational Scripts", false, err.message);
  }

  // 8. Documentation & Guides
  try {
    const prd = readFileSafe("PRD.md");
    assert(
      "PRD.md (MoSCoW version targets)",
      prd.includes(`Wajib Ada di v${expectedVer.slice(0, 3)}`) &&
        prd.includes(`Di Luar Cakupan v${expectedVer.slice(0, 3)}`),
      `Harus memuat target v${expectedVer.slice(0, 3)}`,
    );

    const dashAudit = readFileSafe("docs/DASHBOARD_AUDIT.md");
    assert(
      "docs/DASHBOARD_AUDIT.md (Version header)",
      dashAudit.includes(`**Version:** ${expectedVer}`),
      `Harus memuat: **Version:** ${expectedVer}`,
    );

    const dashPhase3 = readFileSafe("docs/DASHBOARD_MODERNIZATION_PHASE3.md");
    assert(
      "docs/DASHBOARD_MODERNIZATION_PHASE3.md (Version header)",
      dashPhase3.includes(`**Version:** ${expectedVer}`),
      `Harus memuat: **Version:** ${expectedVer}`,
    );

    const itemOverhaul = readFileSafe("tasks/prd-item-overhaul.md");
    assert(
      "tasks/prd-item-overhaul.md (Title version)",
      itemOverhaul.includes(`(v${expectedVer})`),
      `Harus memuat: (v${expectedVer})`,
    );

    const changelog = readFileSafe("CHANGELOG.md");
    assert(
      "CHANGELOG.md (Latest release header)",
      changelog.includes(`## [${expectedVer}]`),
      `Harus memuat: ## [${expectedVer}]`,
    );

    const license = readFileSafe("LICENSE");
    assert(
      "LICENSE (Copyright version)",
      license.includes(`(v${expectedVer}+)`),
      `Harus memuat: (v${expectedVer}+)`,
    );
  } catch (err) {
    assert("Documentation Files", false, err.message);
  }

  // 9. Plugin & Canvas JSDoc @version Annotations
  try {
    const searchCmd = readFileSafe("plugin/utility/search.js");
    assert(
      "plugin/utility/search.js (@version)",
      searchCmd.includes(`* @version ${expectedVer}`),
      `Harus memuat: * @version ${expectedVer}`,
    );

    const knowledgeCmd = readFileSafe("plugin/utility/knowledge.js");
    assert(
      "plugin/utility/knowledge.js (@version)",
      knowledgeCmd.includes(`* @version ${expectedVer}`),
      `Harus memuat: * @version ${expectedVer}`,
    );

    const forgeSubcmd = readFileSafe("plugin/survival/subcommands/forge.js");
    assert(
      "plugin/survival/subcommands/forge.js (@version)",
      forgeSubcmd.includes(`* @version ${expectedVer}`),
      `Harus memuat: * @version ${expectedVer}`,
    );

    const storyCanvas = readFileSafe("src/canvas/storySceneCanvas.js");
    assert(
      "src/canvas/storySceneCanvas.js (@version)",
      storyCanvas.includes(`* @version ${expectedVer}`),
      `Harus memuat: * @version ${expectedVer}`,
    );
  } catch (err) {
    assert("Plugin & Canvas @version tags", false, err.message);
  }

  // Print Results
  let allPassed = true;
  for (const check of checks) {
    if (check.passed) {
      console.log(`  ${C.green}✔${C.reset} ${check.name}`);
    } else {
      allPassed = false;
      console.log(`  ${C.red}✖${C.reset} ${C.bold}${check.name}${C.reset}`);
      if (check.details) {
        console.log(`    ${C.red}↳ ${check.details}${C.reset}`);
      }
    }
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n${C.cyan}──────────────────────────────────────────────────────────────────────${C.reset}`);
  if (allPassed) {
    console.log(`${C.green}${C.bold}✔ PARITAS VERSI 100% TERCAPAI across ${checks.length} checks (${durationSec}s)${C.reset}\n`);
    process.exit(0);
  } else {
    console.error(`${C.red}${C.bold}✖ DITEMUKAN DISKREPANSI VERSI PADA REPOSITORI (${durationSec}s)${C.reset}\n`);
    process.exit(1);
  }
}

if (require.main === module) {
  checkVersionParity();
}

module.exports = { checkVersionParity };
