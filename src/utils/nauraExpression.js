/**
 * Naura Expression Helper
 * ------------------------------------------------------------
 * Menghadirkan ekspresi Naura secara visual di dalam embed dan Container V2,
 * lewat dua jalur yang saling melengkapi:
 *
 *   1. Gambar  — diambil dari assets/Naura_Expression, dikirim sebagai lampiran
 *                dan dirujuk memakai skema attachment://
 *   2. Emoji   — emoji kustom Discord untuk dipakai di judul, field, dan tombol
 *
 * Gambar dikirim apa adanya tanpa kompresi ulang, jadi kualitas aslinya utuh.
 *
 * Contoh pemakaian:
 *
 *   const naura = require('../../src/utils/nauraExpression');
 *   const { embed, files } = naura.decorate(myEmbed, 'success');
 *   await interaction.reply({ embeds: [embed], files });
 *
 *   embed.setTitle(`${naura.getEmoji('success')} Berhasil!`);
 */

const fs = require('fs');
const path = require('path');
const { AttachmentBuilder } = require('discord.js');

const EXPRESSION_DIR = path.join(__dirname, '..', '..', 'assets', 'Naura_Expression');

/**
 * Urutan format yang dicoba. PNG dan WebP didahulukan karena mendukung latar
 * transparan, sehingga karakter Naura terlihat lebih tegas di dalam embed.
 * JPEG tetap didukung sebagai cadangan untuk aset lama.
 */
const EXTENSIONS = ['.png', '.webp', '.jpeg', '.jpg'];

/** Seluruh ekspresi yang tersedia di assets/Naura_Expression. */
const EXPRESSIONS = [
    'Akward',
    'Annoy',
    'Cheers',
    'Chirping',
    'Cry',
    'Eat',
    'Happy',
    'Hmph',
    'Impressed',
    'Kiss',
    'Read',
    'Shocked',
    'Shy',
    'Sleepy',
    'Think'
];

/**
 * Emoji kustom Discord untuk tiap ekspresi.
 * Dua nama emoji sengaja berbeda dari nama berkasnya:
 *   Kiss  -> Blowkiss
 *   Think -> Thinking
 */
const EMOJIS = {
    Akward: '<:Akward:1533824815725805668>',
    Annoy: '<:Annoy:1533824819123064953>',
    Cheers: '<:Cheers:1533824826077085759>',
    Chirping: '<:Chirping:1533824829176807464>',
    Cry: '<:Cry:1533824832938967130>',
    Eat: '<:Eat:1533824836676358154>',
    Happy: '<:Happy:1533824839704641546>',
    Hmph: '<:Hmph:1533824842816688248>',
    Impressed: '<:Impressed:1533825168974151730>',
    Kiss: '<:Blowkiss:1533824822768046170>',
    Read: '<:Read:1533824846604009482>',
    Shocked: '<:Shocked:1533824850051993601>',
    Shy: '<:Shy:1533824853482934444>',
    Sleepy: '<:Sleepy:1533824857090035764>',
    Think: '<:Thinking:1533824864367149096>'
};

/**
 * Mood yang memiliki BEBERAPA ekspresi. Setiap pemanggilan mengambil satu secara
 * acak, supaya Naura tidak terasa mengulang wajah yang sama terus-menerus.
 */
const MOOD_GROUPS = {
    afk: ['Eat', 'Sleepy', 'Chirping'],
    idle: ['Eat', 'Sleepy', 'Chirping'],
    idling: ['Eat', 'Sleepy', 'Chirping'],
    away: ['Eat', 'Sleepy', 'Chirping'],
    resting: ['Eat', 'Sleepy', 'Chirping']
};

/**
 * Pemetaan makna -> satu ekspresi tetap. Perintah cukup menyebut suasana yang
 * diinginkan ('success', 'error', 'loading') tanpa perlu tahu nama berkasnya.
 */
const MOOD_MAP = {
    // --- Status inti ---
    success: 'Cheers',
    loading: 'Think',
    error: 'Cry',

    // --- Turunan status ---
    warning: 'Annoy',
    info: 'Read',
    thinking: 'Think',
    processing: 'Think',
    fail: 'Cry',
    denied: 'Hmph',
    forbidden: 'Hmph',
    cooldown: 'Sleepy',

    // --- Momen menyenangkan ---
    welcome: 'Happy',
    levelup: 'Impressed',
    reward: 'Impressed',
    achievement: 'Impressed',
    economy: 'Cheers',
    celebrate: 'Cheers',

    // --- Nuansa lain ---
    food: 'Eat',
    music: 'Chirping',
    love: 'Kiss',
    romance: 'Kiss',
    kiss: 'Kiss',
    shy: 'Shy',
    sad: 'Cry',
    crying: 'Cry',
    confused: 'Akward',
    surprised: 'Shocked',
    angry: 'Hmph',
    happy: 'Happy',
    smile: 'Happy',
    sleepy: 'Sleepy',
    help: 'Read',
    docs: 'Read',
    read: 'Read',

    default: 'Happy'
};

/** Pencocokan nama tanpa peduli huruf besar/kecil. */
const LOOKUP = new Map(EXPRESSIONS.map(name => [name.toLowerCase(), name]));

// Nama emoji juga boleh dipakai sebagai nama ekspresi, mis. 'Blowkiss', 'Thinking'.
LOOKUP.set('blowkiss', 'Kiss');
LOOKUP.set('thinking', 'Think');

/** Cache hasil pencarian berkas agar tidak menyentuh disk berulang kali. */
const PATH_CACHE = new Map();

function pickRandom(list) {
    return list[Math.floor(Math.random() * list.length)];
}

/**
 * Ubah nama ekspresi atau mood menjadi nama berkas yang valid.
 * Selalu mengembalikan ekspresi yang ada, tidak pernah null.
 */
function resolveExpression(nameOrMood) {
    if (typeof nameOrMood !== 'string' || !nameOrMood.trim()) return MOOD_MAP.default;

    const key = nameOrMood.trim().toLowerCase();

    if (key === 'random') return pickRandom(EXPRESSIONS);
    if (LOOKUP.has(key)) return LOOKUP.get(key);
    if (MOOD_GROUPS[key]) return pickRandom(MOOD_GROUPS[key]);
    if (MOOD_MAP[key]) return MOOD_MAP[key];

    return MOOD_MAP.default;
}

/**
 * Cari berkas gambar sebuah ekspresi dengan menelusuri EXTENSIONS berurutan.
 * @returns {string|null} path absolut, atau null bila tidak ada satu pun format
 */
function findFile(name) {
    if (PATH_CACHE.has(name)) return PATH_CACHE.get(name);

    let found = null;
    for (const ext of EXTENSIONS) {
        const candidate = path.join(EXPRESSION_DIR, `${name}${ext}`);
        try {
            if (fs.existsSync(candidate)) {
                found = candidate;
                break;
            }
        } catch (error) {
            // Kegagalan akses disk diperlakukan sama seperti berkas tidak ada,
            // supaya perintah tetap berjalan tanpa gambar.
        }
    }

    PATH_CACHE.set(name, found);
    return found;
}

/** Kosongkan cache path. Berguna setelah aset diganti saat bot sedang hidup. */
function clearCache() {
    PATH_CACHE.clear();
}

/** Path absolut sebuah ekspresi, atau null bila berkasnya belum ada. */
function getPath(nameOrMood) {
    return findFile(resolveExpression(nameOrMood));
}

/** Apakah berkas gambarnya benar-benar ada di disk. */
function exists(nameOrMood) {
    return getPath(nameOrMood) !== null;
}

/**
 * Emoji kustom Discord untuk sebuah ekspresi atau mood.
 * Dipakai untuk menggantikan emoji hardcoded di judul dan field embed.
 *
 * @param {string} nameOrMood - 'Cheers', 'success', 'afk', dan sebagainya
 * @returns {string|null} string emoji, atau null bila tidak terdaftar
 *
 * @example
 * embed.setTitle(`${naura.getEmoji('success')} Berhasil!`);
 */
function getEmoji(nameOrMood) {
    return EMOJIS[resolveExpression(nameOrMood)] || null;
}

/**
 * Bangun lampiran gambar untuk sebuah ekspresi.
 * AttachmentBuilder dibuat baru setiap pemanggilan karena satu instance tidak
 * boleh dikirim ulang pada pesan yang berbeda.
 *
 * @returns {{ name: string, fileName: string, url: string, emoji: string|null, attachment: AttachmentBuilder } | null}
 */
function getAttachment(nameOrMood) {
    const name = resolveExpression(nameOrMood);
    const filePath = findFile(name);

    if (!filePath) return null;

    // Ekstensi mengikuti berkas yang benar-benar ditemukan, sehingga pergantian
    // aset dari JPEG ke PNG transparan tidak memerlukan perubahan kode.
    const fileName = `naura_${name.toLowerCase()}${path.extname(filePath)}`;
    return {
        name,
        fileName,
        url: `attachment://${fileName}`,
        emoji: EMOJIS[name] || null,
        attachment: new AttachmentBuilder(filePath, { name: fileName })
    };
}

/**
 * Tempelkan ekspresi ke sebuah EmbedBuilder.
 *
 * @param {import('discord.js').EmbedBuilder} embed
 * @param {string} nameOrMood nama ekspresi ('Cheers') atau mood ('success', 'afk')
 * @param {{ as?: 'thumbnail'|'image'|'author', authorName?: string, authorUrl?: string }} [options]
 * @returns {{ embed: object, files: AttachmentBuilder[], expression: string|null }}
 */
function decorate(embed, nameOrMood, options = {}) {
    const { as = 'thumbnail', authorName, authorUrl } = options;
    const face = getAttachment(nameOrMood);

    // Bila gambar tidak ditemukan, embed dikembalikan apa adanya agar perintah
    // tetap berjalan normal alih-alih gagal total.
    if (!face) return { embed, files: [], expression: null };

    if (as === 'image' && typeof embed.setImage === 'function') {
        embed.setImage(face.url);
    } else if (as === 'author' && typeof embed.setAuthor === 'function') {
        embed.setAuthor({
            name: authorName || 'Naura Hoshino',
            iconURL: face.url,
            ...(authorUrl ? { url: authorUrl } : {})
        });
    } else if (typeof embed.setThumbnail === 'function') {
        embed.setThumbnail(face.url);
    }

    return { embed, files: [face.attachment], expression: face.name };
}

/** Daftar seluruh nama ekspresi yang tersedia. */
function list() {
    return [...EXPRESSIONS];
}

/** Daftar mood tunggal beserta ekspresi tujuannya. */
function moods() {
    return { ...MOOD_MAP };
}

/** Daftar mood yang berisi beberapa ekspresi acak. */
function moodGroups() {
    return { ...MOOD_GROUPS };
}

/** Ekspresi acak dari seluruh koleksi. */
function random() {
    return pickRandom(EXPRESSIONS);
}

/** Ekspresi acak khusus suasana AFK / idle. */
function randomAfk() {
    return pickRandom(MOOD_GROUPS.afk);
}

module.exports = {
    EXPRESSION_DIR,
    EXTENSIONS,
    EXPRESSIONS,
    EMOJIS,
    MOOD_MAP,
    MOOD_GROUPS,
    resolveExpression,
    getPath,
    exists,
    getEmoji,
    getAttachment,
    decorate,
    clearCache,
    list,
    moods,
    moodGroups,
    random,
    randomAfk
};
