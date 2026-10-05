const fs = require("fs");
const path = require("path");
const { resolve } = require("../src/interactions/registry");

console.log("=== AUDIT INTERAKSI TOMBOL, DROPDOWN & MODAL NAURA HOSHINO V2 ===");

function walkDir(dir, filter = (f) => f.endsWith(".js")) {
  let files = [];
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules" && entry.name !== ".git") {
        files = files.concat(walkDir(full, filter));
      }
    } else if (filter(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

const pluginFiles = walkDir(path.resolve(__dirname, "../plugin"));

// Regex untuk menangkap deklarasi setCustomId dan custom_id
const idRegex = /setCustomId\s*\(\s*[`"']([^`"']+)`|custom_id\s*:\s*[`"']([^`"']+)`/g;

let totalErrors = 0;

// 1. Audit Bank Views & bank.js
console.log("\n--- AUDIT 1: BANK SUBCOMMAND & BANK VIEWS ---");
const bankViewContent = fs.readFileSync(path.resolve(__dirname, "../src/survival/helpers/bankViews.js"), "utf8");
const bankSubContent = fs.readFileSync(path.resolve(__dirname, "../plugin/survival/subcommands/bank.js"), "utf8");

const bankViewIds = [];
let m;
while ((m = idRegex.exec(bankViewContent)) !== null) {
  bankViewIds.push(m[1] || m[2]);
}

for (const rawId of bankViewIds) {
  const isTemplate = rawId.includes("${");
  const prefix = isTemplate ? rawId.split("${")[0] : rawId;
  const handled = bankSubContent.includes(prefix) || bankSubContent.includes(rawId);
  console.log(`Bank View Component: "${rawId}" -> Handled: ${handled ? "YES" : "NO (MISS!)"}`);
  if (!handled) totalErrors++;
}

// 2. Audit All Collectors in codebase
console.log("\n--- AUDIT 2: COLLECTOR COMPLETENESS ACROSS PLUGINS ---");
for (const file of pluginFiles) {
  const content = fs.readFileSync(file, "utf8");
  if (!content.includes("createMessageComponentCollector") && !content.includes("awaitMessageComponent")) continue;

  const rel = path.relative(path.resolve(__dirname, ".."), file).replace(/\\/g, "/");

  const createdIds = [];
  let cm;
  while ((cm = idRegex.exec(content)) !== null) {
    createdIds.push(cm[1] || cm[2]);
  }

  const unhandled = [];
  for (const cid of createdIds) {
    if (cid.startsWith("btn_lb_page_info")) continue; // label button
    if (cid.startsWith("done_") || cid.startsWith("exp_")) continue; // disabled buttons
    const isTmpl = cid.includes("${");
    const checkKey = isTmpl ? cid.split("${")[0] : cid;

    // Check if collector handles or awaitMessageComponent handles or registry handles
    const hasCollect = content.includes("collector.on(\"collect\"") || content.includes("gameCollector.on(\"collect\"");
    const hasAwait = content.includes("awaitMessageComponent");
    const inRegistry = Boolean(resolve("buttons", checkKey) || resolve("selects", checkKey) || resolve("modals", checkKey));

    let isHandled = inRegistry;
    if (!isHandled && hasAwait) {
      isHandled = content.includes(checkKey) || content.includes(cid);
    }
    if (!isHandled && hasCollect) {
      const collectIdx = content.indexOf("on(\"collect\"");
      const collectBlock = content.slice(collectIdx);
      isHandled = collectBlock.includes(checkKey) || collectBlock.includes(cid) || (rel.includes("poll.js") && collectBlock.includes("split(\"_\")"));
    }

    if (!isHandled) {
      unhandled.push(cid);
    }
  }

  if (unhandled.length > 0) {
    console.log(`[COLLECTOR MISS] ${rel}:`);
    for (const u of unhandled) {
      console.log(`  - customId "${u}" TIDAK ditangani di collector maupun registry!`);
      totalErrors++;
    }
  }
}

// 3. Audit Standalone Components (Context Menus, Global Chat, Reaction Role, Predict)
console.log("\n--- AUDIT 3: STANDALONE COMPONENTS IN REGISTRY ---");
const standaloneTargets = [
  path.resolve(__dirname, "../src/interactions/contextMenus/challengeDuelUser.js"),
  path.resolve(__dirname, "../src/interactions/contextMenus/reportMessage.js"),
  path.resolve(__dirname, "../src/events/messageCreate/globalChat.js"),
  path.resolve(__dirname, "../plugin/admin/reactionrole.js"),
  path.resolve(__dirname, "../plugin/utility/predict.js"),
];

for (const target of standaloneTargets) {
  if (!fs.existsSync(target)) continue;
  let content = fs.readFileSync(target, "utf8");

  // Ganti konstanta BUTTON_PREFIX jika ada di file
  if (content.includes('BUTTON_PREFIX = "gchat_add_"')) {
    content = content.replace(/\$\{BUTTON_PREFIX\}/g, "gchat_add_");
  }

  let cm;
  while ((cm = idRegex.exec(content)) !== null) {
    const rawId = cm[1] || cm[2];
    const isTmpl = rawId.includes("${");
    const checkKey = isTmpl ? rawId.split("${")[0] : rawId;
    const btnH = resolve("buttons", checkKey);
    const modH = resolve("modals", checkKey);
    const selH = resolve("selects", checkKey);
    const handled = Boolean(btnH || modH || selH);
    const rel = path.relative(path.resolve(__dirname, ".."), target).replace(/\\/g, "/");
    console.log(`Component in ${rel}: "${rawId}" -> Registered: ${handled ? "YES" : "NO (MISSING HANDLER!)"}`);
    if (!handled) totalErrors++;
  }
}

console.log("\n=== RINGKASAN AUDIT ===");
if (totalErrors === 0) {
  console.log("✅ SEMUA TOMBOL, DROPDOWN, DAN MODAL MEMILIKI PENANGAN VALID (0 ERROR)!");
} else {
  console.log(`❌ DITEMUKAN ${totalErrors} KOMPONEN TANPA PENANGAN!`);
  process.exit(1);
}
