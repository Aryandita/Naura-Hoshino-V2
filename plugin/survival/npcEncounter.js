'use strict';

// Perjumpaan NPC secara acak. Dipakai supaya pemain bisa bertemu penduduk
// hanya dengan berjalan-jalan, bukan harus memanggil /survival npc.
//
// Sumber kebenaran lokasi tetap npcs.js. NPC berjadwal memakai getLocation(hour),
// jadi orang yang kamu temui pagi di desa bisa berbeda dengan yang muncul malam.

const npcs = require('./npcs');

const BASE_CHANCE = 0.55;
const LUCK_STEP = 0.01;
const MAX_LUCK_BONUS = 0.2;
const AFFECTION_GAIN = 3;
const STAMINA_COST = 5;

// Hanya alias yang benar-benar tempat yang sama. Academy sengaja dibiarkan
// terpisah dari kota supaya dosen tidak berkeliaran di jalan.
const LOCATION_ALIAS = {
    village: 'desa',
    city: 'kota'
};

const LOCATION_NAMES = {
    desa: 'Desa',
    kota: 'Kota',
    hutan: 'Hutan',
    tambang: 'Tambang',
    laut: 'Laut',
    pantai: 'Pantai',
    sawah: 'Sawah',
    gunung: 'Gunung',
    jalanan: 'Jalanan',
    academy: 'Naura Academy'
};

// Kegiatan latar per lokasi supaya perjumpaan terasa hidup.
const ACTIVITIES = {
    desa: [
        'sedang menyapu halaman sambil bersenandung',
        'sedang menjemur padi di pelataran',
        'sedang bersandar di pagar bambu menatap sawah',
        'sedang menawar harga cabai di lapak sebelah'
    ],
    kota: [
        'sedang menunggu lampu penyeberangan',
        'sedang menyeruput kopi di kedai pinggir jalan',
        'sedang membenahi tas kerjanya yang kelebihan muatan',
        'sedang berteduh di depan pertokoan'
    ],
    hutan: [
        'sedang memilah dedaunan obat',
        'sedang mengikat ranting kering jadi satu berkas',
        'sedang mendengarkan suara burung dengan mata terpejam'
    ],
    tambang: [
        'sedang mengetuk-ngetuk dinding batu mencari urat bijih',
        'sedang mengibaskan debu dari topi kerjanya',
        'sedang menghitung hasil galian hari ini'
    ],
    laut: [
        'sedang membetulkan jaring yang berlubang',
        'sedang mengangin-anginkan ikan hasil tangkapan'
    ],
    pantai: [
        'sedang mengumpulkan kerang di garis pasang',
        'sedang menyeret perahu kecil ke tempat aman'
    ],
    sawah: [
        'sedang mengatur aliran air di pematang',
        'sedang mengusir burung dengan kaleng berisik'
    ],
    jalanan: [
        'sedang duduk di bangku pinggir jalan',
        'sedang memandangi kendaraan yang lalu-lalang'
    ],
    academy: [
        'sedang membawa setumpuk berkas kuliah',
        'sedang menempel pengumuman di papan koridor'
    ]
};

const DEFAULT_ACTIVITY = ['sedang berdiri sambil melamun sebentar'];

// Sapaan pembuka. Dibedakan menurut tipe hubungan dan bagian hari.
const GREETINGS = {
    teman: {
        pagi: ['Eh, {nama}! Pagi-pagi sudah keliling, ya?', 'Wah, {nama}. Baru bangun langsung jalan-jalan?'],
        siang: ['{nama}! Panas-panas begini kok masih kuat jalan.', 'Halo, {nama}. Mampir dulu, teduhan sini.'],
        sore: ['Sore, {nama}. Enak ya udaranya sekarang.', 'Eh {nama}, mau pulang atau baru mulai jalan?'],
        malam: ['Malam, {nama}. Hati-hati kalau jalan sendirian.', 'Masih di luar, {nama}? Jangan kemalaman, ya.']
    },
    romansa: {
        pagi: ['Selamat pagi, {nama}~ Kebetulan sekali kita bertemu.', 'Eh, {nama}! Aku baru saja memikirkan kamu, lho.'],
        siang: ['{nama}? Wah, senang bisa lihat kamu di jam sesibuk ini.', 'Halo, {nama}. Sudah makan belum? Jangan dilewatkan, ya.'],
        sore: ['Sore, {nama}. Mau jalan bareng sebentar?', '{nama}, langit sore ini bagus. Sayang kalau dilihat sendirian.'],
        malam: ['Malam, {nama}. Hati-hati di jalan, nanti aku khawatir.', 'Kamu masih di luar, {nama}? Setidaknya sekarang ada aku di sini.']
    }
};

const NOBODY = [
    'Sepi. Hanya suara angin dan langkah kakimu sendiri yang terdengar.',
    'Tidak ada siapa-siapa. Mungkin semua orang sedang sibuk di dalam rumah.',
    'Kamu berjalan cukup jauh, tetapi tidak menemukan seorang pun untuk diajak bicara.'
];

function pick(list) {
    const pool = Array.isArray(list) && list.length > 0 ? list : DEFAULT_ACTIVITY;
    return pool[Math.floor(Math.random() * pool.length)];
}

function fill(text, vars) {
    return String(text).replace(/\{(\w+)\}/g, (match, key) => (
        Object.prototype.hasOwnProperty.call(vars || {}, key) ? String(vars[key]) : match
    ));
}

function normalizeLocation(location) {
    const key = String(location || '').toLowerCase();
    return LOCATION_ALIAS[key] || key;
}

function locationName(location) {
    const key = normalizeLocation(location);
    return LOCATION_NAMES[key] || (key ? key.charAt(0).toUpperCase() + key.slice(1) : 'Entah di mana');
}

/** Bagian hari, dipakai memilih nada sapaan. */
function dayPart(hour) {
    const now = Number(hour) || 0;
    if (now >= 5 && now < 11) return 'pagi';
    if (now >= 11 && now < 15) return 'siang';
    if (now >= 15 && now < 19) return 'sore';
    return 'malam';
}

/** Lokasi NPC saat ini. NPC berjadwal dihitung dari jam dalam game. */
function effectiveLocation(npc, hour) {
    if (!npc) return null;
    if (typeof npc.getLocation === 'function') {
        try {
            return normalizeLocation(npc.getLocation(Number(hour) || 0));
        } catch (error) {
            return normalizeLocation(npc.location);
        }
    }
    return normalizeLocation(npc.location);
}

/** Semua NPC yang benar-benar berada di lokasi ini pada jam ini. */
function npcsAt(location, hour) {
    const target = normalizeLocation(location);
    if (!target) return [];
    return Object.values(npcs).filter((npc) => npc && npc.id && effectiveLocation(npc, hour) === target);
}

/** Peluang bertemu seseorang, naik sedikit mengikuti keberuntungan pemain. */
function encounterChance(luck) {
    const bonus = Math.min(MAX_LUCK_BONUS, (Number(luck) || 0) * LUCK_STEP);
    return Math.min(0.95, BASE_CHANCE + bonus);
}

/**
 * Undi satu perjumpaan.
 *
 * @param {Object} args
 * @param {string} args.location lokasi pemain saat ini
 * @param {number} args.hour jam dalam game
 * @param {number} [args.luck] nilai luck pemain
 * @param {string[]} [args.exclude] id NPC yang baru saja ditemui
 * @param {string} [args.playerName] nama panggilan pemain untuk sapaan
 * @returns {{ found: boolean, npc?: Object, activity?: string, greeting?: string, note?: string, locationName: string, dayPart: string }}
 */
function rollEncounter({ location, hour, luck, exclude, playerName } = {}) {
    const part = dayPart(hour);
    const label = locationName(location);
    const skip = new Set(Array.isArray(exclude) ? exclude : []);
    const present = npcsAt(location, hour).filter((npc) => !skip.has(npc.id));

    if (present.length === 0 || Math.random() > encounterChance(luck)) {
        return { found: false, note: pick(NOBODY), locationName: label, dayPart: part };
    }

    const npc = pick(present);
    const greetingSet = GREETINGS[npc.type === 'romansa' ? 'romansa' : 'teman'];
    const vars = { nama: playerName || 'kamu', npc: npc.name };

    return {
        found: true,
        npc,
        activity: pick(ACTIVITIES[normalizeLocation(location)]),
        greeting: fill(pick(greetingSet[part] || greetingSet.pagi), vars),
        locationName: label,
        dayPart: part
    };
}

module.exports = {
    BASE_CHANCE,
    AFFECTION_GAIN,
    STAMINA_COST,
    LOCATION_NAMES,
    normalizeLocation,
    locationName,
    dayPart,
    effectiveLocation,
    npcsAt,
    encounterChance,
    rollEncounter
};
