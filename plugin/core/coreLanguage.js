/**
 * @namespace: plugin/core/coreLanguage.js
 * @type: Handler
 * @copyright (c) 2026 Aryandita Praftian
 * @assistant Naura Hoshino
 * @description Mengatur bahasa bawaan server dan menyelaraskannya dengan bahasa pribadi.
 */

const { MessageFlags, PermissionFlagsBits } = require('discord.js');
const ui = require('../../src/config/ui');
const GuildSettings = require('../../src/models/GuildSettings');
const { buildContainerV2, buildErrorContainerV2 } = require('../../src/utils/NauraContainerBuilder');
const { locales, SUPPORTED, face, persistUserLanguage } = require('./coreCommon');

/** Menggabungkan flag Ephemeral tanpa menghapus flag Components V2. */
function ephemeral(payload) {
    return { ...payload, flags: (payload.flags || 0) | MessageFlags.Ephemeral };
}

async function respond(interaction, payload, isEphemeral = false) {
    const finalPayload = isEphemeral ? ephemeral(payload) : payload;
    if (interaction.deferred || (interaction.editReply && !interaction.reply)) {
        return interaction.editReply(payload);
    }
    return interaction.reply(finalPayload);
}

async function handleLanguage(interaction, guildId, newLang, currentLang) {
    const hasAdmin = interaction.member
        && interaction.member.permissions
        && interaction.member.permissions.has(PermissionFlagsBits.Administrator);

    if (!hasAdmin) {
        const payload = buildErrorContainerV2({
            authorName: 'Naura Language System',
            description: currentLang.ERROR_PERMISSION_DENIED
                || `${face('denied', '\\u274C')} Maaf yaa, cuma Administrator yang boleh ganti bahasa server. Tapi kamu tetap bisa atur bahasa pribadimu lewat \\`/lang\\` kok~`,
            footerText: ui.getFooter('core')
        });
        return respond(interaction, payload, true);
    }

    if (!guildId) {
        const payload = buildErrorContainerV2({
            authorName: 'Naura Language System',
            description: `${face('error', '\\u274C')} Perintah ini cuma bisa dipakai di dalam server yaa / Only available in servers.`,
            footerText: ui.getFooter('core')
        });
        return respond(interaction, payload, true);
    }

    if (!newLang || !SUPPORTED.includes(newLang)) {
        const payload = buildErrorContainerV2({
            authorName: 'Naura Language System',
            description: currentLang.LANG_NOT_FOUND
                || `${face('confused', '\\u2753')} Hmm, Naura belum kenal bahasa itu. Pilih \\`id\\` atau \\`en\\` yaa~`,
            footerText: ui.getFooter('core')
        });
        return respond(interaction, payload, true);
    }

    const [settings] = await GuildSettings.findOrCreate({ where: { guildId } });

    if (!settings.system) settings.system = { prefix: 'n!', language: 'id' };
    settings.system = { ...settings.system, language: newLang };
    settings.changed('system', true);
    await settings.save();

    // Administrator yang mengubah bahasa server ikut memakai bahasa itu,
    // supaya balasan berikutnya tidak terasa berpindah-pindah.
    const userId = interaction.user ? interaction.user.id : null;
    if (userId) await persistUserLanguage(userId, newLang);

    const successMsg = locales[newLang].LANG_SUCCESS
        || (newLang === 'id'
            ? 'Bahasa server sekarang Bahasa Indonesia yaa~'
            : 'The server language is now English.');

    const payload = buildContainerV2({
        accentColorHex: ui.getColor('success') || '#22C55E',
        authorName: 'Naura Language System',
        title: `${face('success', '\\u2705')} ${newLang === 'id' ? 'Bahasa Server Diperbarui' : 'Server Language Updated'}`,
        expression: 'success',
        description: successMsg,
        footerText: ui.getFooter('core')
    });

    return respond(interaction, payload, false);
}

module.exports = { handleLanguage, ephemeral };
