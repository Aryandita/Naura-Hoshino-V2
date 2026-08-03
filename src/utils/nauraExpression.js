/**
 * Naura Expression Helper
 * ------------------------------------------------------------
 * Menghadirkan ekspresi Naura secara visual di dalam embed dan Container V2.
 * Gambar diambil dari assets/Naura_Expression dan dikirim sebagai lampiran,
 * lalu dirujuk memakai skema attachment:// sehingga tidak perlu hosting eksternal.
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
 * Pemetaan makna -> ekspresi. Perintah cukup menyebut suasana yang diinginkan
 * ('success', 'error', 'loading') tanpa perlu tahu nama berkasnya.
 */
const MOOD_MAP = {
    success: 'Cheers',
    error: 'Shocked',
    warning: 'Annoy',
    info: 'Think',
    loading: 'Sleepy',
    thinking: 'Think',
    welcome: 'Happy',
    levelup: 'Impressed',
    reward: 'Impressed',
    economy: 'Cheers',
    food: 'Eat',
    music: 'Chirping',
    love: 'Kiss',
    romance: 'Kiss',
    shy: 'Shy',
    sad: 'Cry',
    fail: 'Cry',
    cooldown: 'Sleepy',
    denied: 'Hmph',
    forbidden: 'Hmph',
    confused: 'Akward',
    help: 'Read',
    docs: 'Read',
    default: 'Happy'
};

/** Pencocokan nama tanpa peduli huruf besar/kecil. */
const LOOKUP = new Map(EXPRESSIONS.map(name => [name.toLowerCase(), name]));

/**
 * Ubah nama ekspresi atau mood menjadi nama berkas yang valid.
 * Selalu mengembalikan ekspresi yang ada, tidak pernah null.
 */
function resolveExpression(nameOrMood) {
    if (typeof nameOrMood !== 'string' || !nameOrMood.trim()) return MOOD_MAP.default;

    const key = nameOrMood.trim().toLowerCase();
    if (LOOKUP.has(key)) return LOOKUP.get(key);
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
 * @param {string} nameOrMood nama ekspresi ('Cheers') atau mood ('success')
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

/** Daftar mood yang bisa dipakai beserta ekspresi tujuannya. */
function moods() {
    return { ...MOOD_MAP };
}

/** Ekspresi acak, berguna untuk perintah santai seperti /naura. */
function random() {
    return EXPRESSIONS[Math.floor(Math.random() * EXPRESSIONS.length)];
}

module.exports = {
    EXPRESSION_DIR,
    EXPRESSIONS,
    MOOD_MAP,
    resolveExpression,
    getPath,
    exists,
    getAttachment,
    decorate,
    list,
    moods,
    random
};
