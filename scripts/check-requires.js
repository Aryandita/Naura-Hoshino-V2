"use strict";

const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const directoriesToCheck = ["src", "plugin", "scripts", "dashboard"];
const rootFiles = ["index.js", "shard.js"];

let hasError = false;

function checkFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");

  // Match require('...') or require("...")
  const requireRegex = /require\(['"]([^'"]+)['"]\)/g;
  let match;
  while ((match = requireRegex.exec(content)) !== null) {
    const importPath = match[1];
    // Only check relative local imports
    if (importPath.startsWith("./") || importPath.startsWith("../")) {
      const resolvedPath = path.resolve(path.dirname(filePath), importPath);

      let found = false;
      // Test possible extensions and directory index
      const possibilities = [
        resolvedPath,
        resolvedPath + ".js",
        resolvedPath + ".json",
        path.join(resolvedPath, "index.js"),
      ];

      for (const p of possibilities) {
        if (fs.existsSync(p)) {
          found = true;
          break;
        }
      }

      if (!found) {
        console.error(
          `[ERROR] Broken require in ${path.relative(rootDir, filePath)}: Cannot find module '${importPath}'`,
        );
        hasError = true;
      }
    }
  }
}

function traverseDir(dir) {
  const fullDir = path.join(rootDir, dir);
  if (!fs.existsSync(fullDir)) return;
  const files = fs.readdirSync(fullDir);
  for (const file of files) {
    const fullPath = path.join(fullDir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== "node_modules" && file !== ".git" && file !== "dist") {
        traverseDir(path.relative(rootDir, fullPath));
      }
    } else if (fullPath.endsWith(".js")) {
      checkFile(fullPath);
    }
  }
}

function stripComments(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*/g, "");
}

function checkCrossModuleMethods() {
  console.log("Checking cross-module method integrity across critical services...");

  let criticalModules = {};
  try {
    criticalModules = {
      cacheManager: require(path.join(rootDir, "src/managers/cacheManager")),
      redisManager: require(path.join(rootDir, "src/managers/redisManager")),
      mongoManager: require(path.join(rootDir, "src/managers/mongoManager")),
      languageManager: require(path.join(rootDir, "src/managers/languageManager")),
      ui: require(path.join(rootDir, "src/config/ui")),
      duelEngine: require(path.join(rootDir, "src/survival/engines/duelEngine")),
      petActions: require(path.join(rootDir, "src/survival/helpers/petActions")),
      geminiClient: require(path.join(rootDir, "src/ai/geminiClient")),
      tempVoiceRegistry: require(path.join(rootDir, "src/managers/tempVoiceRegistry")),
      canvasWorkerPool: require(path.join(rootDir, "src/canvas/canvasWorkerPool")),
      lavalinkClusterManager: require(path.join(rootDir, "src/managers/lavalinkClusterManager")),
    };
  } catch (err) {
    console.error(`[WARN] Gagal memuat modul kritis untuk pemindaian metode: ${err.message}`);
    return;
  }

  const dirsToScan = ["src", "plugin", "dashboard/routes"];
  const criticalKeys = Object.keys(criticalModules);
  let checkedCount = 0;

  function scanFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    const rawContent = fs.readFileSync(filePath, "utf8");
    if (!criticalKeys.some((k) => rawContent.includes(k))) return;
    const cleanContent = stripComments(rawContent);

    for (const [modName, modObj] of Object.entries(criticalModules)) {
      if (!cleanContent.includes(modName)) continue;

      const regex = new RegExp(`\\b${modName}\\.([a-zA-Z0-9_]+)\\s*\\(`, "g");
      let m;
      while ((m = regex.exec(cleanContent)) !== null) {
        const methodName = m[1];
        checkedCount++;
        const targetVal = modObj ? modObj[methodName] : undefined;
        const isFn = typeof targetVal === "function";
        const isProtoFn = typeof modObj?.prototype?.[methodName] === "function";

        if (!isFn && !isProtoFn) {
          console.error(
            `[ERROR] Missing method in ${path.relative(rootDir, filePath)}: ${modName}.${methodName}() is not defined on target module!`,
          );
          hasError = true;
        }
      }
    }
  }

  function walk(dir) {
    const fullDir = path.join(rootDir, dir);
    if (!fs.existsSync(fullDir)) return;
    const entries = fs.readdirSync(fullDir, { withFileTypes: true });
    for (const ent of entries) {
      const fullPath = path.join(fullDir, ent.name);
      if (ent.isDirectory()) {
        if (ent.name !== "node_modules" && ent.name !== ".git" && ent.name !== "dist") {
          walk(path.relative(rootDir, fullPath));
        }
      } else if (ent.name.endsWith(".js") && !ent.name.endsWith(".test.js")) {
        scanFile(fullPath);
      }
    }
  }

  for (const d of dirsToScan) {
    walk(d);
  }

  console.log(`OK: ${checkedCount} method calls verified across core modules.`);
}

console.log("Checking internal module resolution...");

for (const f of rootFiles) {
  checkFile(path.join(rootDir, f));
}
for (const d of directoriesToCheck) {
  traverseDir(d);
}

checkCrossModuleMethods();

if (hasError) {
  console.error("\nFAILED: Module resolution or method export errors detected.");
  process.exit(1);
} else {
  console.log("OK: All local requires and critical methods resolved successfully.");
  process.exit(0);
}


