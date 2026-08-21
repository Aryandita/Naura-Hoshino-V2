'use strict';

const os = require('os');
const env = require('../config/env');

// ─── Konstanta Warna ANSI 256 ──────────────────────────────────────────────
const C = {
    reset:  '\x1b[0m',
    bold:   '\x1b[1m',
    // Palette utama: pink-ke-rose (identitas Naura)
    pink1:  '\x1b[38;5;218m',   // #FFB6C1 light pink
    pink2:  '\x1b[38;5;213m',   // hot pink
    pink3:  '\x1b[38;5;207m',   // deeper rose
    // Aksen & teks
    gold:   '\x1b[38;5;220m',   // #FFD700
    cyan:   '\x1b[38;5;51m',    // border/box
    white:  '\x1b[38;5;255m',
    grey:   '\x1b[38;5;245m',
    dim:    '\x1b[38;5;240m',
    // Status
    green:  '\x1b[38;5;82m',
    yellow: '\x1b[38;5;226m',
    red:    '\x1b[38;5;196m',
    // Background badge
    bgPink:  '\x1b[48;5;218m\x1b[38;5;16m',
    bgGreen: '\x1b[42m\x1b[30m',
};

// ─── Lebar inner box (62 char visible) ────────────────────────────────────
const W = 76;   // lebar total termasuk '║' kiri-kanan
const IW = W - 4; // inner width (tanpa '║ ' dan ' ║')

const box = {
    tl: '╔', tr: '╗', bl: '╚', br: '╝',
    h: '═', v: '║', sep: '╠', sepEnd: '╣',
    dotH: '·',
};

/**
 * Membuat garis horizontal penuh sesuai lebar box
 * @param {'solid'|'dot'} style
 */
const hLine = (left, right, char) =>
    `${C.cyan}${left}${char.repeat(W - 2)}${right}${C.reset}`;

/**
 * Membuat satu baris box dengan konten rata kiri, padding kanan otomatis.
 * Semua ANSI escape dihitung agar tidak mempengaruhi panjang visible.
 * @param {string} content  - string sudah mengandung kode warna ANSI
 * @param {number} visLen   - panjang visible (tanpa ANSI) dari content
 */
const row = (content, visLen) => {
    const pad = IW - visLen;
    const padding = pad > 0 ? ' '.repeat(pad) : '';
    return `${C.cyan}║${C.reset} ${content}${padding} ${C.cyan}║${C.reset}`;
};

/** Baris kosong */
const emptyRow = () => row('', 0);

/**
 * Format waktu ke string readable
 */
const nowStr = () => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
           `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

/**
 * Menghitung panjang visible string (strip ANSI escape codes)
 */
const vLen = (str) => str.replace(/\x1b\[[0-9;]*m/g, '').length;

/**
 * Membuat pasangan label + value dengan warna berbeda
 */
const field = (label, value, labelColor = C.grey, valueColor = C.white) => {
    const content = `${labelColor}${label}${C.reset}  ${valueColor}${value}${C.reset}`;
    const visible = vLen(label) + 2 + vLen(value);
    return { content, visible };
};

/**
 * Membuat dua kolom per baris (untuk status grid)
 */
const dualField = (l1, v1, l2, v2) => {
    const col1 = `${C.grey}${l1}${C.reset}  ${v1}`;
    const col2 = `${C.grey}${l2}${C.reset}  ${v2}`;
    const gap = ' '.repeat(4);
    const content = `${col1}${gap}${col2}`;
    const visible = vLen(col1) + 4 + vLen(col2);
    return { content, visible };
};

// ─── ASCII Banner "NAURA" (font: ANSI Shadow, compact) ─────────────────────
// Lebar visible setiap baris banner diukur manual (strip ANSI) untuk presisi
const banner = [
    [`${C.pink1} ██╗  ██╗ █████╗ ██╗   ██╗██████╗  █████╗ ${C.reset}`,  44],
    [`${C.pink2} ███╗  ██║██╔══██╗██║   ██║██╔══██╗██╔══██╗${C.reset}`, 45],
    [`${C.pink2} ██╔██╗ ██║███████║██║   ██║██████╔╝███████║${C.reset}`, 45],
    [`${C.pink3} ██║╚██╗██║██╔══██║██║   ██║██╔══██╗██╔══██║${C.reset}`,45],
    [`${C.pink3} ██║ ╚████║██║  ██║╚██████╔╝██║  ██║██║  ██║${C.reset}`,45],
    [`${C.dim}  ╚═╝  ╚═══╝╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝${C.reset}`,46],
];

/**
 * Render baris banner dengan sub-label di sisi kanan (inline dalam box)
 */
const bannerRow = (bannerContent, bannerVis, rightContent, rightVis) => {
    const gap = IW - bannerVis - rightVis;
    const spaces = gap > 0 ? ' '.repeat(gap) : ' ';
    return `${C.cyan}║${C.reset} ${bannerContent}${spaces}${rightContent} ${C.cyan}║${C.reset}`;
};

// ─── Label kanan yang muncul di samping banner ─────────────────────────────
const rightLabels = (ver, tag, owner, nodeVer) => {
    // Potong tag agar kolom kanan tidak overflow (maks 20 char)
    const shortTag = tag.length > 20 ? tag.substring(0, 18) + '…' : tag;
    const engVer = env.ENGINE_VERSION || '2.1.0';
    return [
        [`${C.gold}✦ H O S H I N O${C.reset}`,              16],
        [`${C.grey}ver ${C.white}${ver}${C.reset}`,          4 + ver.length],
        [`${C.grey}@${C.pink1}${shortTag}${C.reset}`,        1 + shortTag.length],
        [`${C.grey}by ${C.white}${owner}${C.reset}`,         3 + owner.length],
        [`${C.grey}node ${C.cyan}${nodeVer}${C.reset}`,      5 + nodeVer.length],
        [`${C.dim}engine v${engVer}${C.reset}`,              8 + engVer.length],
    ];
};

// ─── Entry Point ────────────────────────────────────────────────────────────
/**
 * Menampilkan boot screen ke stdout
 * @param {import('discord.js').Client} client
 * @param {Object} sysStatus
 */
const displayBootScreen = (client, sysStatus) => {
    // Data sistem
    const totalRam = (os.totalmem() / 1024 / 1024 / 1024).toFixed(1);
    const usedRam  = ((os.totalmem() - os.freemem()) / 1024 / 1024 / 1024).toFixed(1);
    const cpuModel = os.cpus()[0].model.trim().replace(/\s+/g, ' ');
    const cpuCores = os.cpus().length;
    const nodeVer  = process.version;
    const platform = `${os.platform()} ${os.arch()}`;
    const botVer   = env.BOT_VERSION || '2.1.0';
    const botTag   = client.user ? client.user.tag : 'Naura Hoshino#0000';
    const ownerName= 'Aryandita';
    const shardId  = env.SHARD_ID != null ? `Shard #${env.SHARD_ID}` : 'No Sharding';
    const bootTime = nowStr();

    // Potong nama CPU jika terlalu panjang
    const cpuDisplay = cpuModel.length > 38
        ? cpuModel.substring(0, 36) + '…'
        : cpuModel;

    // Label kanan banner (array dari fungsi)
    const rLabels = rightLabels(botVer, botTag, ownerName, nodeVer);

    // ─── Mulai render ───────────────────────────────────────────────────────
    const lines = [];

    // Top border
    lines.push(hLine(box.tl, box.tr, box.h));

    // Banner + label kanan
    for (let i = 0; i < banner.length; i++) {
        const [bc, bv] = banner[i];
        const [rc, rv] = rLabels[i] || ['', 0];
        lines.push(bannerRow(bc, bv, rc, rv));
    }

    // Separator tipis
    lines.push(hLine(box.sep, box.sepEnd, box.h));

    // ── Seksi: Identitas Sistem ──────────────────────────────────────────────
    const secSys = `${C.gold}${C.bold}  SISTEM & RUNTIME${C.reset}`;
    lines.push(row(secSys, 18));
    lines.push(emptyRow());

    // Bot tag
    const f1 = field('  ╭ Bot     :', botTag);
    lines.push(row(f1.content, f1.visible));

    // CPU
    const f2 = field('  ├ CPU     :', `${cpuDisplay} (${cpuCores} cores)`);
    lines.push(row(f2.content, f2.visible));

    // RAM + Platform dalam satu baris
    const ramStr  = `${usedRam} / ${totalRam} GB`;
    const f3 = dualField('  ├ RAM     :', `${C.white}${ramStr}${C.reset}`, 'Platform :', `${C.white}${platform}${C.reset}`);
    lines.push(row(f3.content, f3.visible));

    // Node + Shard
    const f4 = dualField('  ├ Node.js :', `${C.cyan}${nodeVer}${C.reset}`, 'Shard    :', `${C.white}${shardId}${C.reset}`);
    lines.push(row(f4.content, f4.visible));

    // Boot time
    const f5 = field('  ╰ Boot    :', bootTime, C.grey, C.dim);
    lines.push(row(f5.content, f5.visible));

    lines.push(emptyRow());

    // ── Separator & Seksi: Status Modul ─────────────────────────────────────
    lines.push(hLine(box.sep, box.sepEnd, box.h));

    const secMod = `${C.gold}${C.bold}  MODUL & KONEKSI${C.reset}`;
    lines.push(row(secMod, 17));
    lines.push(emptyRow());

    // Status baris 1: DB + Redis
    const s1 = dualField('  ╭ Database:', sysStatus.db, 'Redis    :', sysStatus.redis);
    lines.push(row(s1.content, s1.visible));

    // Status baris 2: MongoDB + Lavalink
    const mongoVal = sysStatus.mongo || `${C.yellow}⏭  SKIPPED${C.reset}`;
    const s2 = dualField('  ├ MongoDB :', mongoVal, 'Lavalink :', sysStatus.music);
    lines.push(row(s2.content, s2.visible));

    // Status baris 3: Commands + RSS
    const s3 = dualField('  ├ Commands:', sysStatus.cmds, 'RSS Alerts:', sysStatus.rss);
    lines.push(row(s3.content, s3.visible));

    // Discord status
    const discordVal = `${C.green}🟢 CONNECTED${C.reset}`;
    const f6 = field('  ╰ Discord :', discordVal, C.grey);
    lines.push(row(f6.content, f6.visible));

    lines.push(emptyRow());

    // Bottom border
    lines.push(hLine(box.bl, box.br, box.h));

    // Success badge
    lines.push(
        `\n ${C.bgGreen} ✨ READY ${C.reset}  ` +
        `${C.green}Naura Hoshino ${C.white}v${botVer}${C.green} berhasil mengudara${C.reset}  ` +
        `${C.dim}[ ${bootTime} ]${C.reset}\n`
    );

    console.log('\n' + lines.join('\n'));
};

module.exports = { displayBootScreen };
