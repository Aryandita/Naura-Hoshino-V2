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

const LEADERBOARD_HTML = path.join(
  __dirname,
  "..",
  "..",
  "dashboard",
  "src",
  "pages",
  "leaderboard.html",
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

test("leaderboard.html memanggil endpoint guild yang benar", () => {
  const source = read(LEADERBOARD_HTML);
  assert.ok(
    source.includes("/api/guilds/manageable"),
    "leaderboard.html harus memakai /api/guilds/manageable yang benar-benar ada",
  );
  assert.ok(
    !/fetch\(\s*['"`]\/api\/guilds['"`]/.test(source),
    "leaderboard.html tidak boleh memanggil /api/guilds karena rute itu tidak ada",
  );
});

test("leaderboard.html meneruskan guildId ke endpoint leaderboard", () => {
  const source = read(LEADERBOARD_HTML);
  // guildId harus benar-benar dikirim. Pola yang dipakai adalah
  // URLSearchParams + params.set('guildId', ...), bukan string literal
  // di dalam template URL, jadi cukup dicek keduanya.
  assert.match(
    source,
    /params\.set\(\s*['"]guildId['"]/,
    "leaderboard.html harus mengirim guildId lewat query string",
  );
  assert.match(
    source,
    /api\/realtime\/leaderboard\?\$\{/,
    "URL leaderboard harus menyisipkan query string yang sudah dibangun",
  );
});

test("dropdown guild memicu pemuatan ulang leaderboard", () => {
  const source = read(LEADERBOARD_HTML);
  const idx = source.indexOf("getElementById('guildSelector')?.addEventListener");
  assert.ok(
    idx > -1,
    "#guildSelector harus punya listener change",
  );
  const slice = source.slice(idx, idx + 300);
  assert.match(
    slice,
    /addEventListener\(\s*'change'[\s\S]{0,200}?fetchLeaderboard\(\)/,
    "listener change harus memicu fetchLeaderboard()",
  );
});

test("endpoint leaderboard menerima guildId tanpa mengubah skema", () => {
  const source = read(API_JS);
  assert.match(
    source,
    /req\.query\.guildId/,
    "api.js harus membaca guildId dari query string",
  );
  // Penanda tampilan, bukan filter database. Kalau muncul di where clause
  // berarti ada asumsi kolom guildId yang tidak pernah ada.
  assert.ok(
    !/where\s*:\s*\{\s*guildId/.test(source),
    "tidak boleh memfilter UserProfile berdasarkan guildId karena kolom itu tidak ada",
  );
});
