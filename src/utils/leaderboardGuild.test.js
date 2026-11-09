"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// Latar belakang bug:
// Dropdown "#guildSelector" di leaderboard.html dekoratif. Ia:
//   1. mengambil `/api/guilds`, endpoint yang TIDAK PERNAH ADA. Rute yang
//      benar adalah `/api/guilds/manageable` (dashboard/routes/guild.js),
//      sehingga request selalu 404 dan dropdown tetap kosong;
//   2. tidak pernah mengirim guildId ke /api/realtime/leaderboard, jadi
//      memilih server tidak mengubah apa pun.
//
// Catatan skema penting: tabel UserProfile TIDAK punya kolom guildId. Semua
// ekonomi dan level bersifat global per pengguna Discord, bukan per server.
// Karena itu filter per-server tidak mungkin dibuat tanpa menambah kolom,
// dan menambah kolom berarti mengubah skema + menulis migrasi baru.
//
// Solusi yang dipakai: guildId hanya menjadi PENANDA tampilan pada respons
// (scopeGuildId), lalu client mengurutkan ulang baris yang sudah ada. Jadi
// tidak ada skema baru, tidak ada migrasi, dan tidak ada data yang hilang.

const LEADERBOARD_JS = path.join(
  __dirname,
  "..",
  "..",
  "dashboard",
  "src",
  "js",
  "pages",
  "leaderboard.js",
);
const API_JS = path.join(
  __dirname,
  "..",
  "..",
  "dashboard",
  "routes",
  "api.js",
);

function read(file) {
  return fs.readFileSync(file, "utf8");
}

test("leaderboard.js memanggil endpoint guild yang benar", () => {
  const source = read(LEADERBOARD_JS);
  assert.ok(
    source.includes("/api/guilds/manageable"),
    "leaderboard.js harus memakai /api/guilds/manageable yang benar-benar ada",
  );
  assert.ok(
    !/fetch\(\s*['"`]\/api\/guilds['"`]/.test(source),
    "leaderboard.js tidak boleh memanggil /api/guilds karena rute itu tidak ada",
  );
});

test("leaderboard.js meneruskan guildId ke endpoint leaderboard", () => {
  const source = read(LEADERBOARD_JS);
  // guildId dikirim lewat URLSearchParams ke /api/leaderboard.
  assert.match(
    source,
    /guildId:\s*this\.currentGuild/,
    "leaderboard.js harus mengirim guildId lewat query string",
  );
  assert.match(
    source,
    /api\/leaderboard\?\$\{params\}/,
    "URL leaderboard harus menyisipkan query string yang sudah dibangun",
  );
});

test("dropdown guild memicu pemuatan ulang leaderboard", () => {
  const source = read(LEADERBOARD_JS);
  assert.ok(
    source.includes('getElementById("lbGuildSelect")'),
    "dropdown guild (lbGuildSelect) harus dibaca",
  );
  const idx = source.indexOf('guildSelect?.addEventListener("change"');
  assert.ok(idx > -1, "lbGuildSelect harus punya listener change");
  const slice = source.slice(idx, idx + 300);
  assert.match(
    slice,
    /addEventListener\(\s*["']change["'][\s\S]{0,200}?this\.loadLeaderboard\(\)/,
    "listener change harus memicu loadLeaderboard()",
  );
});

const ECONOMY_API_JS = path.join(
  __dirname,
  "..",
  "..",
  "dashboard",
  "routes",
  "api",
  "economy.js",
);

test("endpoint leaderboard menerima guildId tanpa mengubah skema", () => {
  const source = fs.existsSync(ECONOMY_API_JS) ? read(ECONOMY_API_JS) : read(API_JS);
  assert.match(
    source,
    /req\.query\.guildId/,
    "endpoint leaderboard harus membaca guildId dari query string",
  );
  // Penanda tampilan, bukan filter database. Kalau muncul di where clause
  // berarti ada asumsi kolom guildId yang tidak pernah ada.
  assert.ok(
    !/where\s*:\s*\{\s*guildId/.test(source),
    "tidak boleh memfilter UserProfile berdasarkan guildId karena kolom itu tidak ada",
  );
});
