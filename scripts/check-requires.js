const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const directoriesToCheck = ["src", "plugin", "scripts"];
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
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      traverseDir(fullPath);
    } else if (fullPath.endsWith(".js")) {
      checkFile(fullPath);
    }
  }
}

console.log("Checking internal module resolution...");

for (const f of rootFiles) {
  checkFile(path.join(rootDir, f));
}
for (const d of directoriesToCheck) {
  traverseDir(path.join(rootDir, d));
}

if (hasError) {
  console.error("\nFAILED: One or more local requires are broken.");
  process.exit(1);
} else {
  console.log("OK: All local requires resolved successfully.");
  process.exit(0);
}
