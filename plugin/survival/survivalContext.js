// Konteks eksekusi /survival: interceptor auto-delete untuk jalur slash, dan
// pembuat objek tiruan interaction untuk jalur prefix (n!survival ...).
//
// Objek tiruan sengaja dilengkapi localeLang, lang, t(), dan fetchLang() karena
// penambal prototipe di src/utils/localePatch.js hanya menjangkau instance asli
// discord.js, bukan objek biasa seperti ini. Tanpa pelengkap ini, pemakai
// perintah prefix akan selalu menerima Bahasa Indonesia walaupun sudah memilih
// Bahasa Inggris.

const { buildLoadingContainerV2 } = require('../../src/utils/NauraContainerBuilder');
const languageManager = require('../../src/managers/languageManager');
const { resolveLanguageSync, resolveLanguage } = require('../../src/utils/localePatch');

const AUTO_DELETE_MS = 90000; // 90 detik (1 menit 30 detik)

/**
 * Pasang interceptor auto-delete pada interaction slash.
 * Perilakunya dipertahankan sama seperti sebelum pemecahan berkas.
 */
function attachAutoDelete(interaction) {
    const origReply = interaction.reply.bind(interaction);
    const origEditReply = interaction.editReply.bind(interaction);
    const origFollowUp = interaction.followUp.bind(interaction);

    interaction.reply = async (options) => {
        const opts = typeof options === 'string' ? { content: options } : { ...options };
        opts.fetchReply = true;
        let res;

        if (interaction.deferred || interaction.replied) {
            if (opts.ephemeral && !interaction.ephemeral) {
                res = await origFollowUp(opts);
                interaction.deleteReply().catch(() => {});
            } else {
                res = await origEditReply(opts);
            }
        } else {
            res = await origReply(opts);
        }

        if (!opts.ephemeral && !interaction.ephemeral) {
            setTimeout(() => interaction.deleteReply().catch(() => {}), AUTO_DELETE_MS);
        }
        return res;
    };

    interaction.editReply = async (options) => {
        const opts = typeof options === 'string' ? { content: options } : { ...options };
        const res = await origEditReply(opts);
        if (!interaction.ephemeral) {
            setTimeout(() => interaction.deleteReply().catch(() => {}), AUTO_DELETE_MS);
        }
        return res;
    };

    return interaction;
}

// Nilai bawaan opsi untuk jalur prefix, menggantikan rantai if berurutan.
const PREFIX_OPTION_DEFAULTS = {
    travel: { lokasi: 'kota' },
    collect: { lokasi: 'hutan' },
    work: { pekerjaan: 'janitor' },
    pet: { aksi: 'view' },
    class: { nama: 'warrior' }
};

/** Bangun objek yang menyerupai interaction untuk perintah prefix. */
function createMockInteraction({ message, client, subCmdName, args }) {
    let loadingMsg = null;

    const mock = {
        user: message.author,
        member: message.member,
        guild: message.guild,
        channel: message.channel,
        client: client,
        deferReply: async () => {
            const loadingPayload = buildLoadingContainerV2({
                title: 'Naura Loading System...',
                loadingMessage: 'Naura sedang menyiapkan semuanya buat kamu, tunggu sebentar yaa~ \u26fa\u2728',
                footerText: `Sedang menyiapkan untuk ${message.author.username}`
            });
            loadingMsg = await message.reply(loadingPayload);
        },
        reply: async (data) => await message.reply(data),
        editReply: async (data) => {
            if (loadingMsg) return await loadingMsg.edit(data);
            return await message.reply(data);
        },
        followUp: async (data) => await message.reply(data),
        options: {
            getSubcommand: () => subCmdName,
            getString: (name) => {
                const fallback = PREFIX_OPTION_DEFAULTS[subCmdName];
                if (fallback && fallback[name]) return args[1] || fallback[name];
                return args[1];
            },
            // Stub aman: perintah prefix tidak membawa opsi terstruktur, jadi
            // pembacaannya mengembalikan null alih-alih melempar TypeError.
            getInteger: () => null,
            getNumber: () => null,
            getBoolean: () => null,
            getUser: () => null,
            getMember: () => null,
            getChannel: () => null,
            getRole: () => null,
            getAttachment: () => null
        },
        // Dipakai builder embed maupun subcommand untuk menerjemahkan teks.
        t: (key, placeholders) => languageManager.translateSync(resolveLanguageSync(message), key, placeholders || {}),
        fetchLang: () => resolveLanguage(message)
    };

    // Getter, bukan nilai tetap, agar bahasa yang baru saja masuk cache langsung terpakai.
    Object.defineProperty(mock, 'localeLang', {
        get() { return resolveLanguageSync(message); },
        configurable: true
    });
    Object.defineProperty(mock, 'lang', {
        get() { return resolveLanguageSync(message); },
        configurable: true
    });

    return mock;
}

module.exports = { attachAutoDelete, createMockInteraction, AUTO_DELETE_MS };
