"use strict";

const os = require("os");
const env = require("../config/env");

// ═══════════════════════════════════════════════════════════════════════════
//  Palet warna ANSI 256, sesuai Design Identity "Cyber-Anime Glassmorphism"
//  dari AGENTS.md §1.6 (primary #FFB6C1, accent-gold #FFD700, cyan #93C5FD)
// ═══════════════════════════════════════════════════════════════════════════
const C = {
  r: "\x1b[0m", // reset
  b: "\x1b[1m", // bold
  // ── Gradient pink (identitas utama Naura) ─────────────────────────────
  p0: "\x1b[38;5;225m", // very light pink  (baris 1)
  p1: "\x1b[38;5;218m", // #FFB6C1 light pink (baris 2)
  p2: "\x1b[38;5;213m", // hot pink          (baris 3)
  p3: "\x1b[38;5;205m", // deeper rose       (baris 4)
  p4: "\x1b[38;5;199m", // vivid magenta     (baris 5)
  p5: "\x1b[38;5;197m", // deep rose         (baris 6)
  p6: "\x1b[38;5;161m", // crimson-rose      (baris 7)
  // ── Aksen ─────────────────────────────────────────────────────────────
  gold: "\x1b[38;5;220m", // #FFD700 premium gold
  gol2: "\x1b[38;5;214m", // amber gold
  cyan: "\x1b[38;5;87m", // bright cyan (box border)
  sky: "\x1b[38;5;153m", // accent-blue #93C5FD
  mint: "\x1b[38;5;122m", // accent-green #86EFAC
  purp: "\x1b[38;5;183m", // accent-purple #C084FC
  // ── Netral ────────────────────────────────────────────────────────────
  w: "\x1b[38;5;255m", // bright white
  g1: "\x1b[38;5;252m", // light grey
  g2: "\x1b[38;5;245m", // mid grey
  g3: "\x1b[38;5;240m", // dim grey
  g4: "\x1b[38;5;235m", // very dim
  // ── Status ────────────────────────────────────────────────────────────
  ok: "\x1b[38;5;82m", // connected / ok
  warn: "\x1b[38;5;226m", // warning / skipped
  err: "\x1b[38;5;196m", // error
  // ── Background badges ─────────────────────────────────────────────────
  bgOk: "\x1b[48;5;28m\x1b[38;5;255m",
  bgPink: "\x1b[48;5;218m\x1b[38;5;16m",
  bgGold: "\x1b[48;5;220m\x1b[38;5;16m",
};

// ═══════════════════════════════════════════════════════════════════════════
//  Dimensi box, 80 karakter lebar total (visible)
// ═══════════════════════════════════════════════════════════════════════════
const BOX_W = 80; // lebar total termasuk '║' kiri-kanan
const INNER = BOX_W - 4; // inner width (setelah '║ ' dan ' ║')

// ── Karakter box-drawing ──────────────────────────────────────────────────
const TL = "╔",
  TR = "╗",
  BL = "╚",
  BR = "╝";
const HL = "═",
  VL = "║",
  SL = "╠",
  SR = "╣";

// ── Helpers ───────────────────────────────────────────────────────────────

/** Strip semua ANSI escape codes → hitung panjang visible */
const vLen = (s) => s.replace(/\x1b\[[0-9;]*m/g, "").length;

/** Garis horizontal penuh */
const hLine = (l, r, ch, color = C.cyan) =>
  `${color}${l}${ch.repeat(BOX_W - 2)}${r}${C.r}`;

/**
 * Satu baris box, padding kanan otomatis.
 * @param {string} content  - sudah mengandung ANSI codes
 * @param {number} vis      - panjang VISIBLE dari content
 */
const row = (content, vis) => {
  const pad = Math.max(0, INNER - vis);
  return `${C.cyan}${VL}${C.r} ${content}${" ".repeat(pad)} ${C.cyan}${VL}${C.r}`;
};

/** Baris kosong */
const blank = () => row("", 0);

/** Format timestamp */
const nowStr = () => {
  const d = new Date(),
    z = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}:${z(d.getSeconds())}`;
};

/** Buat dua-kolom sejajar, padding tengah otomatis */
const dual = (lbl1, val1, lbl2, val2, totalWidth = INNER) => {
  const left = `${C.g2}${lbl1}${C.r} ${val1}`;
  const right = `${C.g2}${lbl2}${C.r} ${val2}`;
  const lv = vLen(lbl1) + 1 + vLen(val1);
  const rv = vLen(lbl2) + 1 + vLen(val2);
  const mid = Math.max(1, totalWidth - lv - rv);
  return { content: `${left}${" ".repeat(mid)}${right}`, vis: lv + mid + rv };
};

/** Heading seksi dengan glow style */
const secHead = (icon, title, color = C.gold) => {
  const txt = `${icon}  ${color}${C.b}${title}${C.r}`;
  const vis = 3 + title.length; // icon(1) + '  ' + title
  return { content: txt, vis };
};

// ═══════════════════════════════════════════════════════════════════════════
//  ASCII Art Banner, "NAURA HOSHINO"
//  Font: ANSI Shadow (bold block) dengan gradient pink 7-baris
//  Setiap baris: [ansi_string, visible_length]
// ═══════════════════════════════════════════════════════════════════════════
//
//   ██╗  ██╗ █████╗ ██╗   ██╗██████╗  █████╗
//   ███╗  ██║██╔══██╗██║   ██║██╔══██╗██╔══██╗
//   ██╔██╗ ██║███████║██║   ██║██████╔╝███████║
//   ██║╚██╗██║██╔══██║██║   ██║██╔══██╗██╔══██║
//   ██║ ╚████║██║  ██║╚██████╔╝██║  ██║██║  ██║
//   ╚═╝  ╚═══╝╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝
//
const BANNER_LINES = [
  // baris 1
  [`${C.p0}  ██╗  ██╗  █████╗  ██╗   ██╗ ██████╗   █████╗  ${C.r}`, 50],
  // baris 2
  [`${C.p1}  ███╗ ██║ ██╔══██╗ ██║   ██║ ██╔══██╗ ██╔══██╗ ${C.r}`, 50],
  // baris 3
  [`${C.p2}  ██╔██╗██║ ███████║ ██║   ██║ ██████╔╝ ███████║ ${C.r}`, 50],
  // baris 4
  [`${C.p3}  ██║╚████║ ██╔══██║ ██║   ██║ ██╔══██╗ ██╔══██║ ${C.r}`, 50],
  // baris 5
  [`${C.p4}  ██║ ╚███║ ██║  ██║ ╚██████╔╝ ██║  ██║ ██║  ██║ ${C.r}`, 50],
  // baris 6
  [`${C.p5}  ╚═╝  ╚══╝ ╚═╝  ╚═╝  ╚═════╝  ╚═╝  ╚═╝ ╚═╝  ╚═╝ ${C.r}`, 51],
  // baris 7, sub-title "H O S H I N O"
  [
    `${C.g3}  ──────────────────────────── ${C.gold}H  O  S  H  I  N  O${C.r}${C.g3} ───${C.r}`,
    56,
  ],
];

// ═══════════════════════════════════════════════════════════════════════════
//  Label kolom kanan di samping banner
//  [ansi_string, visible_length]
// ═══════════════════════════════════════════════════════════════════════════
const buildRightLabels = (botVer, botTag, nodeVer) => {
  const engVer = env.ENGINE_VERSION || botVer;
  // Potong tag max 16 char agar label kanan tidak overflow di baris banner
  const tag16 = botTag.length > 16 ? botTag.substring(0, 14) + "…" : botTag;
  return [
    [`${C.p1}✿ ${C.w}${C.b}Naura Hoshino${C.r}`, 15],
    [`${C.g2}version  ${C.gold}${C.b}v${botVer}${C.r}`, 9 + botVer.length],
    [`${C.g2}engine   ${C.gol2}v${engVer}${C.r}`, 9 + engVer.length],
    [`${C.g2}discord  ${C.purp}${tag16}${C.r}`, 9 + tag16.length],
    [`${C.g2}runtime  ${C.sky}${nodeVer}${C.r}`, 9 + nodeVer.length],
    [`${C.g2}platform ${C.mint}Pterodactyl${C.r}`, 20],
    [`${C.g4}by ${C.g2}Aryandita Praftian${C.r}`, 21],
  ];
};

/**
 * Render baris banner + kolom kanan dalam satu baris box
 */
const bannerRow = (bannerStr, bannerVis, rightStr, rightVis) => {
  const gap = INNER - bannerVis - rightVis;
  const spaces = gap > 0 ? " ".repeat(gap) : " ";
  return `${C.cyan}${VL}${C.r} ${bannerStr}${spaces}${rightStr} ${C.cyan}${VL}${C.r}`;
};

// ═══════════════════════════════════════════════════════════════════════════
//  Fungsi utama
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Menampilkan boot screen ke stdout saat bot siap.
 * @param {import('discord.js').Client} client
 * @param {Object} sysStatus
 */
const displayBootScreen = (client, sysStatus) => {
  // ── Data runtime ──────────────────────────────────────────────────────
  const botVer = env.BOT_VERSION || "2.3.0";
  const botTag = client.user ? client.user.tag : "Naura Hoshino#0000";
  const nodeVer = process.version;
  const cpuRaw = os.cpus()[0].model.trim().replace(/\s+/g, " ");
  const cpuCores = os.cpus().length;
  const cpuDisp = cpuRaw.length > 32 ? cpuRaw.substring(0, 30) + "…" : cpuRaw;
  const totalRam = (os.totalmem() / 1073741824).toFixed(1);
  const usedRam = ((os.totalmem() - os.freemem()) / 1073741824).toFixed(1);
  const ramPct = Math.round(
    ((os.totalmem() - os.freemem()) / os.totalmem()) * 100,
  );
  const platform = `${os.platform()} / ${os.arch()}`;
  const shardTxt =
    env.SHARD_ID != null ? `Shard #${env.SHARD_ID}` : "Standalone";
  const bootTime = nowStr();

  // ── URL dashboard & webhook ───────────────────────────────────────────
  const dashPort = env.DASHBOARD_PORT;
  const webhPort = env.WEBHOOK_PORT;
  const originList = String(env.DASHBOARD_ORIGIN || "")
    .split(/[\s,]+/)
    .filter(Boolean);
  const dashUrl =
    originList.length > 0 ? originList[0] : `http://localhost:${dashPort}`;
  const webhUrl = `http://localhost:${webhPort}`;

  // ── RAM bar visual (10 segmen) ────────────────────────────────────────
  const barFill = Math.round(ramPct / 10);
  const ramBar = `[${C.p2}${"█".repeat(barFill)}${C.g3}${"░".repeat(10 - barFill)}${C.r}]`;

  // ── Label banner kanan ────────────────────────────────────────────────
  const rLabels = buildRightLabels(botVer, botTag, nodeVer);

  // ── Mulai menyusun baris ──────────────────────────────────────────────
  const L = [];

  // ┌─ Top border ─────────────────────────────────────────────────────┐
  L.push(hLine(TL, TR, HL));

  // ┌─ Banner + label kanan ───────────────────────────────────────────┐
  const numBannerRows = BANNER_LINES.length;
  for (let i = 0; i < numBannerRows; i++) {
    const [bc, bv] = BANNER_LINES[i];
    const [rc, rv] = rLabels[i] || ["", 0];
    L.push(bannerRow(bc, bv, rc, rv));
  }

  // ┌─ Divider seksi ─────────────────────────────────────────────────┐
  L.push(hLine(SL, SR, HL));

  // ┌─ SISTEM & RUNTIME ──────────────────────────────────────────────┐
  const sh = secHead("⬡", "SISTEM  &  RUNTIME");
  L.push(row(sh.content, sh.vis));
  L.push(blank());

  // Bot identity
  const botLine = `${C.g2}╭ Bot      ${C.r}${C.p1}${botTag}${C.r}`;
  L.push(row(botLine, 10 + botTag.length));

  // CPU
  const cpuLine = `${C.g2}├ CPU      ${C.r}${C.w}${cpuDisp}${C.r}  ${C.g3}(${cpuCores} cores)${C.r}`;
  L.push(
    row(cpuLine, 10 + cpuDisp.length + 2 + 1 + cpuCores.toString().length + 7),
  );

  // RAM dengan bar
  const ramLabel = `${C.g2}├ RAM      ${C.r}${C.w}${usedRam} / ${totalRam} GB${C.r}  ${ramBar}  ${C.g3}${ramPct}%${C.r}`;
  const ramVis =
    10 +
    (usedRam + " / " + totalRam + " GB").length +
    2 +
    14 +
    2 +
    String(ramPct).length +
    1;
  L.push(row(ramLabel, ramVis));

  // Platform + Shard (dual column)
  const d1 = dual(
    "├ Platform",
    `${C.sky}${platform}${C.r}`,
    "Shard",
    `${C.purp}${shardTxt}${C.r}`,
  );
  L.push(row(d1.content, d1.vis));

  // Node version + Boot time (dual)
  const d2 = dual(
    "╰ Node.js ",
    `${C.mint}${nodeVer}${C.r}`,
    "Boot",
    `${C.g3}${bootTime}${C.r}`,
  );
  L.push(row(d2.content, d2.vis));

  L.push(blank());

  // ┌─ Divider seksi ─────────────────────────────────────────────────┐
  L.push(hLine(SL, SR, HL));

  // ┌─ MODUL & KONEKSI ───────────────────────────────────────────────┐
  const mh = secHead("⬡", "MODUL  &  KONEKSI");
  L.push(row(mh.content, mh.vis));
  L.push(blank());

  // Database + Redis
  const ms1 = dual("╭ Supabase", sysStatus.db, "Redis  ", sysStatus.redis);
  L.push(row(ms1.content, ms1.vis));

  // MongoDB + Lavalink
  const mongoVal = sysStatus.mongo || `${C.warn}⏭  SKIPPED${C.r}`;
  const ms2 = dual("├ MongoDB ", mongoVal, "Lavalink", sysStatus.music);
  L.push(row(ms2.content, ms2.vis));

  // Commands + RSS
  const ms3 = dual("├ Commands", sysStatus.cmds, "RSS Feed", sysStatus.rss);
  L.push(row(ms3.content, ms3.vis));

  // Discord (full width)
  const discLine = `${C.g2}╰ Discord   ${C.r}${C.ok}🟢 CONNECTED${C.r}`;
  L.push(row(discLine, 12 + 12));

  L.push(blank());

  // ── Seksi: Alamat Server ─────────────────────────────────────────────────
  L.push(hLine(SL, SR, HL));

  const ah = secHead("⧡", "ALAMAT  AKSES", C.sky);
  L.push(row(ah.content, ah.vis));
  L.push(blank());

  // Dashboard URL
  const da = dual(
    "╭ Dashboard",
    `${C.sky}${C.b}${dashUrl}${C.r}`,
    "port",
    `${C.gold}${C.b}:${dashPort}${C.r}`,
  );
  L.push(row(da.content, da.vis));

  // Webhook URL
  const wa = dual(
    "╰ Webhook  ",
    `${C.purp}${webhUrl}${C.r}`,
    "port",
    `${C.gold}:${webhPort}${C.r}`,
  );
  L.push(row(wa.content, wa.vis));

  L.push(blank());

  // ┌─ Bottom border ─────────────────────────────────────────────────┐
  L.push(hLine(BL, BR, HL));

  // ┌─ Ready badge ───────────────────────────────────────────────────┐
  L.push(
    `\n ` +
      `${C.bgOk} ✨ ONLINE ${C.r}  ` +
      `${C.p1}${C.b}Naura Hoshino${C.r} ` +
      `${C.g2}v${botVer}${C.r} ` +
      `${C.g2}sudah mengudara dan siap melayani!${C.r}` +
      `\n ${C.g4}${"─".repeat(BOX_W - 2)}${C.r}` +
      `\n ${C.g3}Dashboard: ${C.sky}${dashUrl}${C.r}${C.g3}  ·  Webhook: ${C.purp}:${webhPort}${C.r}${C.g3}  ·  ${bootTime}  ·  ${shardTxt}${C.r}\n`,
  );

  console.log("\n" + L.join("\n"));
};

/**
 * Menampilkan boot screen khusus Web Dashboard lokal dengan ASCII banner.
 * @param {Object} [options={}]
 * @param {number} [options.port=3000]
 * @param {string[]} [options.modelPaths=[]]
 * @param {boolean} [options.dbConnected=true]
 */
const displayDashboardBootScreen = (options = {}) => {
  const port = options.port || env.DASHBOARD_PORT || 3000;
  const botVer = env.BOT_VERSION || "2.3.0";
  const nodeVer = process.version;
  const bootTime = nowStr();
  const dbStatus =
    options.dbConnected !== false
      ? `${C.ok}🟢 CONNECTED${C.r}`
      : `${C.warn}🟡 FALLBACK MOCK${C.r}`;

  const rightLabels = [
    [`${C.p1}✿ ${C.w}${C.b}Naura Dashboard${C.r}`, 17],
    [`${C.g2}version  ${C.gold}${C.b}v${botVer}${C.r}`, 9 + botVer.length],
    [`${C.g2}mode     ${C.mint}Standalone${C.r}`, 19],
    [`${C.g2}port     ${C.gold}:${port}${C.r}`, 9 + String(port).length + 1],
    [`${C.g2}runtime  ${C.sky}${nodeVer}${C.r}`, 9 + nodeVer.length],
    [`${C.g2}database ${dbStatus}`, 9 + 12],
    [`${C.g4}by ${C.g2}Aryandita Praftian${C.r}`, 21],
  ];

  const L = [];
  L.push(hLine(TL, TR, HL));
  L.push(blank());

  for (let i = 0; i < BANNER_LINES.length; i++) {
    const [bStr, bVis] = BANNER_LINES[i];
    const [rStr, rVis] = rightLabels[i] || ["", 0];
    L.push(bannerRow(bStr, bVis, rStr, rVis));
  }

  L.push(blank());
  L.push(hLine(SL, SR, HL));

  const ah = secHead("⧡", "ALAMAT  AKSES  DASHBOARD  LOKAL", C.sky);
  L.push(row(ah.content, ah.vis));
  L.push(blank());

  const r1 = dual(
    "╭ Dashboard Utama",
    `${C.sky}${C.b}http://localhost:${port}${C.r}`,
    "port",
    `${C.gold}:${port}${C.r}`,
  );
  L.push(row(r1.content, r1.vis));

  const r2 = dual(
    "├ 3D AI Lounge   ",
    `${C.purp}http://localhost:${port}/lounge${C.r}`,
    "Three.js",
    `${C.mint}VRM/GLTF${C.r}`,
  );
  L.push(row(r2.content, r2.vis));

  const r3 = dual(
    "├ Activity & Mini",
    `${C.mint}http://localhost:${port}/activity${C.r}`,
    "Casino",
    `${C.gold}Gacha/Slot${C.r}`,
  );
  L.push(row(r3.content, r3.vis));

  const r4 = dual(
    "├ Member Portfolio",
    `${C.sky}http://localhost:${port}/portfolio${C.r}`,
    "Creator",
    `${C.p2}Profile${C.r}`,
  );
  L.push(row(r4.content, r4.vis));

  const r5 = dual(
    "╰ Tiket & Bantuan",
    `${C.gol2}http://localhost:${port}/tickets${C.r}`,
    "MongoDB",
    `${C.ok}Active${C.r}`,
  );
  L.push(row(r5.content, r5.vis));

  L.push(blank());

  const modelPaths = Array.isArray(options.modelPaths)
    ? options.modelPaths
    : ["/models/naura.vrm", "/models/naura.glb"];
  if (modelPaths.length > 0) {
    L.push(hLine(SL, SR, HL));
    const mh = secHead("💎", "ASET  MODEL  3D  TERDAFTAR", C.gold);
    L.push(row(mh.content, mh.vis));
    L.push(blank());

    for (let i = 0; i < modelPaths.length; i++) {
      const p = modelPaths[i];
      const prefix = i === 0 ? "╭" : i === modelPaths.length - 1 ? "╰" : "├";
      const lbl = `${prefix} Model [${i + 1}]`;
      const url = `http://localhost:${port}${p}`;
      const line = `${C.g2}${lbl}${C.r} ${C.mint}${url}${C.r}`;
      L.push(row(line, vLen(lbl) + 1 + vLen(url)));
    }
    L.push(blank());
  }

  L.push(hLine(BL, BR, HL));
  L.push(
    `\n ` +
      `${C.bgOk} ✨ ONLINE ${C.r}  ` +
      `${C.p1}${C.b}Naura Web Dashboard${C.r} ` +
      `${C.g2}v${botVer}${C.r} ` +
      `${C.g2}siap diakses di browser!${C.r}` +
      `\n ${C.g4}${"─".repeat(BOX_W - 2)}${C.r}` +
      `\n ${C.g3}URL Utama: ${C.sky}http://localhost:${port}${C.r}${C.g3}  ·  Lounge 3D: ${C.purp}http://localhost:${port}/lounge${C.r}${C.g3}  ·  ${bootTime}${C.r}\n`,
  );

  console.log("\n" + L.join("\n"));
};

/**
 * Menampilkan boot screen khusus Multi-Core Cluster & Shard Manager.
 * @param {Object} [options={}]
 * @param {boolean} [options.useClustering=false]
 * @param {string|number} [options.totalShards="auto"]
 */
const displayClusterBootScreen = (options = {}) => {
  const botVer = env.BOT_VERSION || "2.3.0";
  const nodeVer = process.version;
  const bootTime = nowStr();
  const engineType = options.useClustering
    ? "Hybrid Clustering"
    : "Process Sharding";

  const rightLabels = [
    [`${C.p1}✿ ${C.w}${C.b}Naura Cluster${C.r}`, 15],
    [`${C.g2}version  ${C.gold}${C.b}v${botVer}${C.r}`, 9 + botVer.length],
    [
      `${C.g2}engine   ${C.sky}${options.useClustering ? "Hybrid" : "Sharding"}${C.r}`,
      options.useClustering ? 15 : 17,
    ],
    [`${C.g2}mode     ${C.mint}Multi-Process${C.r}`, 22],
    [`${C.g2}runtime  ${C.sky}${nodeVer}${C.r}`, 9 + nodeVer.length],
    [`${C.g2}platform ${C.mint}Node.js IPC${C.r}`, 20],
    [`${C.g4}by ${C.g2}Aryandita Praftian${C.r}`, 21],
  ];

  const L = [];
  L.push(hLine(TL, TR, HL));
  L.push(blank());

  for (let i = 0; i < BANNER_LINES.length; i++) {
    const [bStr, bVis] = BANNER_LINES[i];
    const [rStr, rVis] = rightLabels[i] || ["", 0];
    L.push(bannerRow(bStr, bVis, rStr, rVis));
  }

  L.push(blank());
  L.push(hLine(SL, SR, HL));

  const ch = secHead("⚙️", "MULTI-CORE  CLUSTER  ORCHESTRATION", C.sky);
  L.push(row(ch.content, ch.vis));
  L.push(blank());

  const c1 = dual(
    "╭ Cluster Engine",
    `${C.sky}${C.b}${engineType}${C.r}`,
    "Worker",
    `${C.gold}Child Process${C.r}`,
  );
  L.push(row(c1.content, c1.vis));

  const c2 = dual(
    "├ Shard Strategy",
    `${C.purp}Auto-Scaling Dynamic${C.r}`,
    "Status",
    `${C.ok}Initializing...${C.r}`,
  );
  L.push(row(c2.content, c2.vis));

  const c3 = dual(
    "╰ Respawn Guard ",
    `${C.mint}Active (Auto-Healing)${C.r}`,
    "IPC",
    `${C.gol2}Event-Driven${C.r}`,
  );
  L.push(row(c3.content, c3.vis));

  L.push(blank());
  L.push(hLine(BL, BR, HL));

  L.push(
    `\n ` +
      `${C.bgGold} ⚙️ CLUSTER READY ${C.r}  ` +
      `${C.p1}${C.b}Naura Hoshino Cluster Manager${C.r} ` +
      `${C.g2}v${botVer}${C.r} ` +
      `${C.g2}mengorkestrasi proses bot Discord.${C.r}` +
      `\n ${C.g4}${"─".repeat(BOX_W - 2)}${C.r}` +
      `\n ${C.g3}Mode: ${C.sky}${engineType}${C.r}${C.g3}  ·  Waktu Mulai: ${C.mint}${bootTime}${C.r}\n`,
  );

  console.log("\n" + L.join("\n"));
};

module.exports = {
  displayBootScreen,
  displayDashboardBootScreen,
  displayClusterBootScreen,
};
