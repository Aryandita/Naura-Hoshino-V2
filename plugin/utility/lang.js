// Pemilih bahasa Naura.
//
// Catatan penting: pilihan bahasa WAJIB disimpan lewat languageManager.setUserLanguage.
// Versi sebelumnya menyimpannya langsung lewat cacheManager, padahal languageManager
// memegang cache pilihan bahasanya sendiri selama lima menit. Akibatnya bahasa baru
// baru terasa setelah cache kedaluwarsa, dan pesan konfirmasinya pun ikut memakai
// bahasa lama.

const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { logger } = require('../../src/managers/logger');
const ui = require('../../src/config/ui');
const languageManager = require('../../src/managers/languageManager');
const cacheManager = require('../../src/managers/cacheManager');
const { buildContainerV2 } = require('../../src/utils/NauraContainerBuilder');

// Kata yang diterima pada jalur prefix (n!lang inggris, n!lang en, dst).
const PREFIX_ALIASES = {
    id: 'id',
    ind: 'id',
    indo: 'id',
    indonesia: 'id',
    en: 'en',
    eng: 'en',
    english: 'en',
    inggris: 'en'
};

// Kalimat penutup bernuansa Naura, ditulis dalam bahasa yang baru dipilih.
const CLOSING_NOTE = {
    id: 'Mulai sekarang Naura bakal ngobrol sama kamu pakai Bahasa Indonesia yaa~ Kalau sewaktu-waktu mau ganti lagi, tinggal panggil `/lang` kapan pun, Naura siap menyesuaikan \ud83d\udc95',
    en: 'From now on Naura will chat with you in English~ Whenever you feel like switching back, just call `/lang` again and Naura will happily adjust \ud83d\udc95'
};

const TITLE = {
    id: 'Bahasa Berhasil Diganti',
    en: 'Language Updated'
};

const INVALID_HINT = {
    id: 'Naura belum mengenali bahasa itu. Coba tulis `n!lang id` untuk Bahasa Indonesia atau `n!lang en` untuk Bahasa Inggris yaa~',
    en: 'Naura does not recognise that language yet. Try `n!lang id` for Indonesian or `n!lang en` for English~'
};

function ephemeral(payload) {
    return { ...payload, flags: (payload.flags || 0) | MessageFlags.Ephemeral };
}

/**
 * Simpan pilihan bahasa lalu selaraskan seluruh lapisan penyimpanan.
 * setUserLanguage menulis ke database sekaligus menyegarkan cache languageManager;
 * pembaruan cacheManager menyusul supaya profil yang sudah terlanjur di-cache
 * tidak menyimpan bahasa lama.
 */
async function applyLanguage(userId, choice) {
    const normalized = await languageManager.setUserLanguage(userId, choice);

    try {
        await cacheManager.updateUserProfile(userId, { language: normalized });
    } catch (error) {
        logger.warn(`[Lang] Gagal menyegarkan cache profil ${userId}: ${error.message}`);
    }

    return normalized;
}

function buildSuccessPayload(lang) {
    const body = languageManager.translateSync(lang, 'lang_success');
    const note = CLOSING_NOTE[lang] || CLOSING_NOTE.id;

    return buildContainerV2({
        accentColorHex: ui.getColor('accent') || '#FF69B4',
        expression: 'success',
        title: TITLE[lang] || TITLE.id,
        description: `${body}\n\n${note}`,
        footerText: ui.getFooter('utility')
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lang')
        .setDescription('Ubah bahasa bot / Change bot language')
        .addStringOption(option =>
            option.setName('bahasa')
                .setDescription('Pilih bahasa / Select language')
                .setRequired(true)
                .addChoices(
                    { name: '\ud83c\uddee\ud83c\udde9 Indonesia', value: 'id' },
                    { name: '\ud83c\uddec\ud83c\udde7 English', value: 'en' }
                )),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const selected = interaction.options.getString('bahasa');
            const lang = await applyLanguage(interaction.user.id, selected);
            await interaction.editReply(ephemeral(buildSuccessPayload(lang)));
        } catch (error) {
            logger.error('[Lang] Gagal mengubah bahasa:', error);
            await ui.sendError(interaction, 'Gagal mengubah pengaturan bahasa / Failed to change language settings.', true);
        }
    },

    async executePrefix(message, args) {
        const input = args[0] ? args[0].toLowerCase() : null;
        const choice = input ? PREFIX_ALIASES[input] : null;

        if (!choice) {
            const current = await languageManager.getUserLanguage(message.author.id);
            return ui.sendError(message, INVALID_HINT[current] || INVALID_HINT.id);
        }

        try {
            const lang = await applyLanguage(message.author.id, choice);
            await message.reply(buildSuccessPayload(lang));
        } catch (error) {
            logger.error('[Lang Prefix] Gagal mengubah bahasa:', error);
            await ui.sendError(message, 'Gagal mengubah pengaturan bahasa / Failed to change language settings.');
        }
    }
};
