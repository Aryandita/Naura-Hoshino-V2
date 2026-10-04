"use strict";

/**
 * ralph.js - Windows/Cross-platform Runner for Ralph Autonomous Agent Loop
 *
 * Mengelola siklus iterasi PRD (prd.json), pelacakan progres (progress.txt),
 * dan transisi status task secara deterministik tanpa dependensi jq/bash eksternal.
 *
 * Penggunaan:
 *   node scripts/ralph/ralph.js --status
 *   node scripts/ralph/ralph.js --next
 *   node scripts/ralph/ralph.js --pass US-001
 *   node scripts/ralph/ralph.js --init
 */

const fs = require("fs");
const path = require("path");


const SCRIPT_DIR = __dirname;
const PRD_FILE = path.join(SCRIPT_DIR, "prd.json");
const PROGRESS_FILE = path.join(SCRIPT_DIR, "progress.txt");
const ARCHIVE_DIR = path.join(SCRIPT_DIR, "archive");
const LAST_BRANCH_FILE = path.join(SCRIPT_DIR, ".last-branch");

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
  gray: "\x1b[90m",
};

function readPrd() {
  if (!fs.existsSync(PRD_FILE)) {
    console.error(`${C.red}Error: File prd.json tidak ditemukan di ${PRD_FILE}${C.reset}`);
    console.log(`Gunakan 'node scripts/ralph/ralph.js --init' untuk membuat template awal.`);
    process.exit(1);
  }

  try {
    const raw = fs.readFileSync(PRD_FILE, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.error(`${C.red}Error membaca prd.json: ${err.message}${C.reset}`);
    process.exit(1);
  }
}

function writePrd(data) {
  fs.writeFileSync(PRD_FILE, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function appendProgress(line) {
  const timestamp = new Date().toISOString().replace("T", " ").substring(0, 19);
  const entry = `[${timestamp}] ${line}\n`;
  fs.appendFileSync(PROGRESS_FILE, entry, "utf8");
}

function ensureProgressFile() {
  if (!fs.existsSync(PROGRESS_FILE)) {
    const header = `# Ralph Progress Log\nCreated: ${new Date().toISOString()}\n---\n`;
    fs.writeFileSync(PROGRESS_FILE, header, "utf8");
  }
}

function checkBranchArchive(prd) {
  const currentBranch = prd.branchName || "";
  let lastBranch = "";

  if (fs.existsSync(LAST_BRANCH_FILE)) {
    lastBranch = fs.readFileSync(LAST_BRANCH_FILE, "utf8").trim();
  }

  if (currentBranch && lastBranch && currentBranch !== lastBranch) {
    if (!fs.existsSync(ARCHIVE_DIR)) {
      fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    const cleanName = lastBranch.replace(/^ralph\//, "").replace(/[^a-zA-Z0-9_-]/g, "_");
    const targetFolder = path.join(ARCHIVE_DIR, `${dateStr}-${cleanName}`);

    fs.mkdirSync(targetFolder, { recursive: true });
    if (fs.existsSync(PRD_FILE)) fs.copyFileSync(PRD_FILE, path.join(targetFolder, "prd.json"));
    if (fs.existsSync(PROGRESS_FILE)) fs.copyFileSync(PROGRESS_FILE, path.join(targetFolder, "progress.txt"));

    console.log(`${C.yellow}Mengarsipkan siklus lama (${lastBranch}) ke: ${targetFolder}${C.reset}`);
    fs.writeFileSync(PROGRESS_FILE, `# Ralph Progress Log\nReset: ${new Date().toISOString()}\n---\n`, "utf8");
  }

  if (currentBranch) {
    fs.writeFileSync(LAST_BRANCH_FILE, currentBranch, "utf8");
  }
}

function showStatus() {
  const prd = readPrd();
  ensureProgressFile();

  const stories = prd.userStories || [];
  const completed = stories.filter((s) => s.passes).length;
  const total = stories.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  console.log(`\n${C.bold}${C.cyan}=== STATUS SIKLUS RALPH ===${C.reset}`);
  console.log(`Project : ${prd.project || "Naura Hoshino V2"}`);
  console.log(`Branch  : ${prd.branchName || "(none)"}`);
  console.log(`Progres : ${completed}/${total} stories selesai (${pct}%)\n`);

  for (const s of stories) {
    const icon = s.passes ? `${C.green}[PASS]${C.reset}` : `${C.yellow}[PENDING]${C.reset}`;
    console.log(`  ${icon} ${C.bold}${s.id}${C.reset}: ${s.title}`);
  }
  console.log("");
}

function showNext() {
  const prd = readPrd();
  ensureProgressFile();

  const stories = prd.userStories || [];
  const pending = stories
    .filter((s) => !s.passes)
    .sort((a, b) => (a.priority || 999) - (b.priority || 999));

  if (pending.length === 0) {
    console.log(`\n${C.green}${C.bold}✔ Semua user stories telah berstatus PASS! Siklus Ralph selesai.${C.reset}\n`);
    console.log("<promise>COMPLETE</promise>");
    return;
  }

  const next = pending[0];
  console.log(`\n${C.bold}${C.cyan}=== STORY AKTIF BERIKUTNYA ===${C.reset}`);
  console.log(`ID       : ${C.bold}${next.id}${C.reset}`);
  console.log(`Judul    : ${next.title}`);
  console.log(`Prioritas: ${next.priority || 1}`);
  console.log(`Deskripsi: ${next.description}`);
  console.log(`\n${C.bold}Kriteria Penerimaan (Acceptance Criteria):${C.reset}`);
  for (const c of next.acceptanceCriteria || []) {
    console.log(`  [ ] ${c}`);
  }

  console.log(`\n${C.gray}Setelah selesai dan lulus verifikasi, tandai dengan:${C.reset}`);
  console.log(`  node scripts/ralph/ralph.js --pass ${next.id}\n`);
}

function markPass(storyId) {
  const prd = readPrd();
  ensureProgressFile();

  const story = (prd.userStories || []).find((s) => s.id.toLowerCase() === storyId.toLowerCase());
  if (!story) {
    console.error(`${C.red}Error: Story dengan ID '${storyId}' tidak ditemukan di prd.json.${C.reset}`);
    process.exit(1);
  }

  story.passes = true;
  writePrd(prd);
  appendProgress(`PASS: ${story.id} - ${story.title}`);
  console.log(`\n${C.green}✔ ${story.id} (${story.title}) ditandai sebagai PASS!${C.reset}`);

  // Hitung sisa
  const remaining = (prd.userStories || []).filter((s) => !s.passes).length;
  if (remaining === 0) {
    console.log(`\n${C.green}${C.bold}🎉 SELURUH USER STORIES TELAH SELESAI DIVERIFIKASI!${C.reset}\n`);
  } else {
    console.log(`Sisa ${remaining} story belum selesai. Jalankan '--next' untuk melihat langkah berikutnya.\n`);
  }
}

function initPrd() {
  if (fs.existsSync(PRD_FILE)) {
    console.log(`${C.yellow}prd.json sudah ada. Tidak menimpa file yang sudah ada.${C.reset}`);
    return;
  }

  const examplePath = path.join(SCRIPT_DIR, "prd.json.example");
  if (fs.existsSync(examplePath)) {
    fs.copyFileSync(examplePath, PRD_FILE);
  } else {
    const template = {
      project: "Naura Hoshino V2",
      branchName: "ralph/feature-name",
      description: "Deskripsi fitur baru",
      userStories: [
        {
          id: "US-001",
          title: "Contoh implementasi dasar",
          description: "Sebagai developer, saya ingin menginisialisasi skema.",
          acceptanceCriteria: [
            "Logika dasar terpasang",
            "npm run test:requires lolos",
            "npm run lint lolos",
          ],
          priority: 1,
          passes: false,
          notes: "",
        },
      ],
    };
    writePrd(template);
  }
  ensureProgressFile();
  console.log(`${C.green}✔ prd.json berhasil diinisialisasi di ${PRD_FILE}${C.reset}`);
}

function main() {
  const args = process.argv.slice(2);
  const prd = fs.existsSync(PRD_FILE) ? readPrd() : null;
  if (prd) checkBranchArchive(prd);

  if (args.includes("--status") || args.length === 0) {
    showStatus();
  } else if (args.includes("--next")) {
    showNext();
  } else if (args.includes("--pass")) {
    const idx = args.indexOf("--pass");
    const id = args[idx + 1];
    if (!id) {
      console.error(`${C.red}Error: Mohon sertakan ID story, misal: --pass US-001${C.reset}`);
      process.exit(1);
    }
    markPass(id);
  } else if (args.includes("--init")) {
    initPrd();
  } else {
    console.log(`Perintah tidak dikenal. Pilihan: --status, --next, --pass <ID>, --init`);
  }
}

main();
