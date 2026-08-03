/**
 * Naura Expression Helper
 * ------------------------------------------------------------
 * Menghadirkan ekspresi Naura secara visual di dalam embed dan Container V2,
 * lewat dua jalur yang saling melengkapi:
 *
 *   1. Emoji   — emoji kustom Discord, ringan dan dipakai di mana saja
 *   2. Gambar  — PNG transparan dari assets/Naura_Expression, dikirim sebagai
 *                lampiran dan dirujuk memakai skema attachment://
 *
 * Berkas gambarnya besar (sekitar setengah megabita per ekspresi), jadi gambar
 * TIDAK dikirim di setiap embed. Hanya momen yang layak yang mendapatkannya —
 * lihat IMAGE_MOMENTS di bawah. Embed rutin cukup memakai emoji, yang sama
 * ekspresifnya tanpa biaya bandwidth sama sekali.
 *
 * Contoh pemakaian:
 *
 *   const naura = require('../../src/utils/nauraExpression');
 *   embed.setTitle(`${naura.getEmoji('success')} Berhasil!`);
 *
 *   const { embed, files } = naura.decorate(myEmbed, 'success');
 *   await interaction.reply({ embeds: [embed], files });
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

/**
 * Seluruh ekspresi yang tersedia, ditulis PERSIS seperti nama berkasnya di
 * assets/Naura_Expression. Perhatikan 'Blow kiss' memakai spasi.
 */
const EXPRESSIONS = [
    'Akward',
    'Annoy',
    'Blow kiss',
    'Cheers',
    'Chirping',
    'Cry',
    'Eat',
    'Happy',
    'Hmph',
    'Impressed',
    'Read',
    'Shocked',
    'Shy',
    'Sleepy',
    'Thinking'
];

/** Emoji kustom Discord untuk tiap ekspresi. */
const EMOJIS = {
    'Akward': '<:Akward:1533824815725805668>',
    'Annoy': '<:Annoy:1533824819123064953>',
    'Blow kiss': '<:Blowkiss:1533824822768046170>',
    'Cheers': '<:Cheers:1533824826077085759>',
    'Chirping': '<:Chirping:1533824829176807464>',
    'Cry': '<:Cry:1533824832938967130>',
    'Eat': '<:Eat:1533824836676358154>',
    'Happy': '<:Happy:1533824839704641546>',
    'Hmph': '<:Hmph:1533824842816688248>',
    'Impressed': '<:Impressed:1533825168974151730>',
    'Read': '<:Read:1533824846604009482>',
    'Shocked': '<:Shocked:1533824850051993601>',
    'Shy': '<:Shy:1533824853482934444>',
    'Sleepy': '<:Sleepy:1533824857090035764>',
    'Thinking': '<:Thinking:1533824864367149096>'
};

/**
 * Momen yang layak mendapat GAMBAR, bukan sekadar emoji.
 *
 * Daftar ini sengaja pendek. Menambah satu entri berarti setiap pemanggilan
 * mood tersebut mengirim lampiran sekitar setengah megabita, jadi pertimbangkan
 * seberapa sering mood itu muncul sebelum memasukkannya.
 *
 * Perhatikan bahwa penilaian dilakukan pada MOOD, bukan pada ekspresi hasilnya.
 * 'success' dan 'economy' sama-sama berujung ke Cheers, tapi hanya 'success'
 * yang layak tampil bergambar.
 */
const IMAGE_MOMENTS = new Set([
    'success',
    'error',
    'fail',
    'levelup',
    'reward',
    'achievement',
    'welcome',
    'celebrate',
    'afk',
    'idle',
    'idling',
    'away',
    'resting'
]);

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
    loading: 'Thinking',
    error: 'Cry',

    // --- Turunan status ---
    warning: 'Annoy',
    info: 'Read',
    thinking: 'Thinking',
    processing: 'Thinking',
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
    love: 'Blow kiss',
    romance: 'Blow kiss',
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

    default: 'Happy'
};

/** Pencocokan nama tanpa peduli huruf besar/kecil maupun spasi. */
const LOOKUP = new Map(EXPRESSIONS.map(name => [name.toLowerCase(), name]));

// Alias supaya penamaan lama dan variasi penulisan tetap dikenali.
LOOKUP.set('blowkiss', 'Blow kiss');
LOOKUP.set('blow_kiss', 'Blow kiss');
LOOKUP.set('kiss', 'Blow kiss');
LOOKUP.set('think', 'Thinking');
LOOKUP.set('awkward', 'Akward');

/** Cache hasil pencarian berkas agar tidak menyentuh disk berulang kali. */
const PATH_CACHE = new Map();

function pickRandom(list) {
    return list[Math.floor(Math.random() * list.length)];
}

function normalizeKey(nameOrMood) {
    return typeof nameOrMood === 'string' ? nameOrMood.trim().toLowerCase() : '';
}

/**
 * Ubah nama ekspresi atau mood menjadi nama berkas yang valid.
 * Selalu mengembalikan ekspresi yang ada, tidak pernah null.
 */
function resolveExpression(nameOrMood) {
    const key = normalizeKey(nameOrMood);
    if (!key) return MOOD_MAP.default;

    if (key === 'random') return pickRandom(EXPRESSIONS);
    if (LOOKUP.has(key)) return LOOKUP.get(key);
    if (MOOD_GROUPS[key]) return pickRandom(MOOD_GROUPS[key]);
    if (MOOD_MAP[key]) return MOOD_MAP[key];

    return MOOD_MAP.default;
}

/**
 * Apakah mood ini layak dikirim bersama gambar, atau cukup emoji saja.
 *
 * @param {string} nameOrMood
 * @returns {boolean}
 *
 * @example
 * shouldAttachImage('success'); // true  — momen penting
 * shouldAttachImage('loading'); // false — terlalu sering muncul
 */
function shouldAttachImage(nameOrMood) {
    return IMAGE_MOMENTS.has(normalizeKey(nameOrMood));
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

/**
 * Nama lampiran yang aman untuk skema attachment://.
 * Spasi dan karakter non-alfanumerik diganti garis bawah, karena rujukan
 * attachment:// tidak menangani spasi dengan andal.
 * 'Blow kiss' -> 'naura_blow_kiss.png'
 */
function buildFileName(name, ext) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    return `naura_${slug}${ext}`;
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
 * Inilah jalur utama untuk menampilkan perasaan Naura, karena ringan dan bisa
 * dipakai di judul, field, tombol, maupun teks biasa.
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
 * Fungsi ini TIDAK memeriksa kelayakan momen. Pemanggil yang menentukan, lewat
 * shouldAttachImage() atau keputusannya sendiri.
 *
 * @returns {{ name: string, fileName: string, url: string, emoji: string|null, attachment: AttachmentBuilder } | null}
 */
function getAttachment(nameOrMood) {
    const name = resolveExpression(nameOrMood);
    const filePath = findFile(name);

    if (!filePath) return null;

    // Ekstensi mengikuti berkas yang benar-benar ditemukan, sehingga pergantian
    // aset dari JPEG ke PNG transparan tidak memerlukan perubahan kode.
    const fileName = buildFileName(name, path.extname(filePath));
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
 * Secara bawaan gambar hanya dipasang bila momennya layak; selebihnya embed
 * dikembalikan tanpa lampiran dan pemanggil cukup memakai getEmoji().
 *
 * @param {import('discord.js').EmbedBuilder} embed
 * @param {string} nameOrMood nama ekspresi ('Cheers') atau mood ('success', 'afk')
 * @param {{ as?: 'thumbnail'|'image'|'author', authorName?: string, authorUrl?: string, force?: boolean }} [options]
 *        force: true memaksa gambar terpasang meski momennya tidak masuk daftar
 * @returns {{ embed: object, files: AttachmentBuilder[], expression: string|null }}
 */
function decorate(embed, nameOrMood, options = {}) {
    const { as = 'thumbnail', authorName, authorUrl, force = false } = options;

    if (!force && !shouldAttachImage(nameOrMood)) {
        return { embed, files: [], expression: null };
    }

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

/** Daftar mood yang layak tampil bergambar. */
function imageMoments() {
    return [...IMAGE_MOMENTS];
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
    IMAGE_MOMENTS,
    resolveExpression,
    shouldAttachImage,
    getPath,
    exists,
    getEmoji,
    getAttachment,
    decorate,
    clearCache,
    list,
    moods,
    moodGroups,
    imageMoments,
    random,
    randomAfk
};
