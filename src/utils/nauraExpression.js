/**
 * Naura Expression Helper
 * ------------------------------------------------------------
 * Menghadirkan ekspresi Naura secara visual di dalam embed dan Container V2.
 * Gambar diambil dari assets/Naura_Expression dan dikirim sebagai lampiran,
 * lalu dirujuk memakai skema attachment:// sehingga tidak perlu hosting eksternal.
 *
 * Gambar dikirim apa adanya tanpa kompresi ulang, jadi kualitas aslinya utuh.
 *
 * Contoh pemakaian:
 *
 *   const naura = require('../../src/utils/nauraExpression');
 *   const { embed, files } = naura.decorate(myEmbed, 'success');
 *   await interaction.reply({ embeds: [embed], files });
 *
 * Atau secara manual:
 *
 *   const face = naura.getAttachment('Cheers');
 *   embed.setThumbnail(face.url);
 *   await interaction.reply({ embeds: [embed], files: [face.attachment] });
 */

const fs = require('fs');
const path = require('path');
const { AttachmentBuilder } = require('discord.js');

const EXPRESSION_DIR = path.join(__dirname, '..', '..', 'assets', 'Naura_Expression');
const EXTENSION = '.jpeg';

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
    shy: 'Shy',
    sad: 'Cry',
    confused: 'Akward',
    surprised: 'Shocked',
    help: 'Read',
    docs: 'Read',

    default: 'Happy'
};

/** Pencocokan nama tanpa peduli huruf besar/kecil. */
const LOOKUP = new Map(EXPRESSIONS.map(name => [name.toLowerCase(), name]));

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

/** Path absolut sebuah ekspresi. */
function getPath(nameOrMood) {
    return path.join(EXPRESSION_DIR, `${resolveExpression(nameOrMood)}${EXTENSION}`);
}

/** Apakah berkas gambarnya benar-benar ada di disk. */
function exists(nameOrMood) {
    try {
        return fs.existsSync(getPath(nameOrMood));
    } catch (error) {
        return false;
    }
}

/**
 * Bangun lampiran gambar untuk sebuah ekspresi.
 * AttachmentBuilder dibuat baru setiap pemanggilan karena satu instance tidak
 * boleh dikirim ulang pada pesan yang berbeda.
 *
 * @returns {{ name: string, fileName: string, url: string, attachment: AttachmentBuilder } | null}
 */
function getAttachment(nameOrMood) {
    const name = resolveExpression(nameOrMood);
    const filePath = getPath(name);

    if (!fs.existsSync(filePath)) return null;

    const fileName = `naura_${name.toLowerCase()}${EXTENSION}`;
    return {
        name,
        fileName,
        url: `attachment://${fileName}`,
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
    EXPRESSIONS,
    MOOD_MAP,
    MOOD_GROUPS,
    resolveExpression,
    getPath,
    exists,
    getAttachment,
    decorate,
    list,
    moods,
    moodGroups,
    random,
    randomAfk
};
