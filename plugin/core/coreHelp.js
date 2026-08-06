/**
 * @namespace: plugin/core/coreHelp.js
 * @type: Handler
 * @copyright (c) 2026 Aryandita Praftian
 * @assistant Naura Hoshino
 * @description Help menu interaktif Components V2 dengan pemilih bahasa persisten.
 */

const { ComponentType, MessageFlags } = require('discord.js');
const logger = require('../../src/managers/logger');
const { locales, face, persistUserLanguage } = require('./coreCommon');
const { buildHelpPayload, buildLanguagePayload } = require('./coreHelpView');

const LANG_PICK_TIME = 60000;
const MENU_TIME = 180000;

/** Pesan konfirmasi singkat setelah bahasa dipilih. */
function confirmText(code) {
    const ok = face('success', '\\u2705');
    return code === 'id'
        ? `${ok} Siap! Mulai sekarang Naura ngobrol pakai Bahasa Indonesia yaa~ Pilihan ini Naura simpan buat semua fitur.`
        : `${ok} Got it! Naura will speak English with you from now on, and this choice is saved across every feature.`;
}

/**
 * Langkah pertama: pemilih bahasa. Berbeda dengan versi lama, kegagalan
 * memilih tidak lagi memaksa Bahasa Inggris, melainkan mempertahankan bahasa
 * yang sedang berlaku untuk user tersebut.
 */
async function handleHelp(interaction, client, lang, code = 'id') {
    const langPayload = buildLanguagePayload(client, code);

    let response;
    if (interaction.deferred || (interaction.editReply && !interaction.reply)) {
        response = await interaction.editReply(langPayload);
    } else {
        const replied = await interaction.reply(langPayload);
        if (replied && replied.createMessageComponentCollector) response = replied;
        else if (interaction.fetchReply) response = await interaction.fetchReply().catch(() => null);
    }

    if (!response || !response.createMessageComponentCollector) return;

    let activeLang = lang;
    try {
        const picked = await response.awaitMessageComponent({
            componentType: ComponentType.StringSelect,
            time: LANG_PICK_TIME,
            filter: i => i.user.id === interaction.user.id && i.customId === 'help_lang_select'
        });
        const selected = picked.values[0];
        activeLang = locales[selected] || lang;
        await persistUserLanguage(interaction.user.id, selected);
        await picked.reply({ content: confirmText(selected), flags: MessageFlags.Ephemeral }).catch(() => { });
    } catch (err) {
        // Timeout: pertahankan bahasa yang sedang berlaku
    }

    await renderHelpMenuV2(interaction, client, activeLang, response);
}

/** Langkah kedua: menu kategori dengan navigasi dan tombol ganti bahasa. */
async function renderHelpMenuV2(interaction, client, lang, existingResponse = null) {
    let currentIndex = -1; // -1 = halaman default (deskripsi umum)
    let activeLang = lang;
    let showingPicker = false;

    const payload = buildHelpPayload(activeLang, client, currentIndex, false);

    let response = existingResponse;
    try {
        if (existingResponse) {
            response = await existingResponse.edit(payload);
        } else if (interaction.deferred) {
            response = await interaction.editReply(payload);
        } else {
            const replied = await interaction.reply(payload);
            response = (replied && replied.createMessageComponentCollector)
                ? replied
                : (interaction.fetchReply ? await interaction.fetchReply().catch(() => null) : null);
        }
    } catch (err) {
        try {
            response = await interaction.editReply(payload);
        } catch (innerErr) {
            logger.warn(`[Core] Help menu tidak bisa dirender: ${innerErr.message}`);
            return;
        }
    }

    if (!response || !response.createMessageComponentCollector) return;

    const collector = response.createMessageComponentCollector({
        time: MENU_TIME,
        filter: i => i.user.id === interaction.user.id
    });

    collector.on('collect', async i => {
        try {
            // --- Ganti bahasa di tengah jalan ---
            if (i.customId === 'help_lang_switch') {
                showingPicker = true;
                const code = activeLang === locales.en ? 'en' : 'id';
                await i.update(buildLanguagePayload(client, code));
                return;
            }

            if (i.customId === 'help_lang_select') {
                const selected = i.values[0];
                activeLang = locales[selected] || activeLang;
                showingPicker = false;
                await persistUserLanguage(i.user.id, selected);
                await i.update(buildHelpPayload(activeLang, client, currentIndex, false));
                await i.followUp({ content: confirmText(selected), flags: MessageFlags.Ephemeral }).catch(() => { });
                return;
            }

            // --- Navigasi kategori ---
            if (i.componentType === ComponentType.StringSelect && i.customId === 'help_category_select') {
                const { HELP_CATEGORY_KEYS } = require('./coreCommon');
                const picked = HELP_CATEGORY_KEYS.indexOf(i.values[0]);
                if (picked === -1) return;
                currentIndex = picked;
            } else if (i.componentType === ComponentType.Button) {
                const { HELP_CATEGORY_KEYS } = require('./coreCommon');
                if (i.customId === 'help_prev') {
                    currentIndex = Math.max(0, currentIndex === -1 ? 0 : currentIndex - 1);
                } else if (i.customId === 'help_next') {
                    currentIndex = Math.min(HELP_CATEGORY_KEYS.length - 1, currentIndex === -1 ? 0 : currentIndex + 1);
                } else {
                    return; // bukan tombol milik kita
                }
            } else {
                return;
            }

            await i.update(buildHelpPayload(activeLang, client, currentIndex, false));
        } catch (err) {
            // Interaction kemungkinan sudah kedaluwarsa
        }
    });

    collector.on('end', async () => {
        try {
            // Container V2 tetap ditampilkan utuh, hanya komponennya dinonaktifkan.
            // Mengosongkan components akan membuat pesan tampak kosong.
            if (showingPicker) return;
            const disabledPayload = buildHelpPayload(activeLang, client, currentIndex, true);
            const target = existingResponse || response;
            if (target && target.edit) await target.edit(disabledPayload).catch(() => { });
        } catch (err) { /* pesan mungkin sudah dihapus */ }
    });
}

module.exports = { handleHelp, renderHelpMenuV2 };
