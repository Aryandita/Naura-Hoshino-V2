/**
 * @namespace: plugin/core/coreHelpView.js
 * @type: View
 * @copyright (c) 2026 Aryandita Praftian
 * @assistant Naura Hoshino
 * @description Perakit payload Components V2 untuk help menu dan pemilih bahasa.
 */

const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    MessageFlags
} = require('discord.js');
const ui = require('../../src/config/ui');
const { buildContainerV2 } = require('../../src/utils/NauraContainerBuilder');
const { e, HELP_CATEGORY_KEYS, formatHelpContent } = require('./coreCommon');

/** Menyusun peta kategori dari berkas lokalisasi yang aktif. */
function buildCategories(lang) {
    return {
        core: { emoji: e('help_core', '\\u2699\\uFE0F'), label: lang.HELP_CAT_CORE_LABEL, desc: lang.HELP_CAT_CORE_DESC, content: formatHelpContent(lang.HELP_CONTENT_CORE) },
        music: { emoji: e('help_music', '\\uD83C\\uDFB5'), label: lang.HELP_CAT_MUSIC_LABEL, desc: lang.HELP_CAT_MUSIC_DESC, content: formatHelpContent(lang.HELP_CONTENT_MUSIC) },
        minigame: { emoji: e('help_game', '\\uD83C\\uDFAE'), label: lang.HELP_CAT_GAME_LABEL, desc: lang.HELP_CAT_GAME_DESC, content: formatHelpContent(lang.HELP_CONTENT_GAME) },
        survival: { emoji: e('help_survival', '\\uD83C\\uDFD5\\uFE0F'), label: lang.HELP_CAT_SURVIVAL_LABEL, desc: lang.HELP_CAT_SURVIVAL_DESC, content: formatHelpContent(lang.HELP_CONTENT_SURVIVAL) },
        admin: { emoji: e('help_admin', '\\uD83D\\uDEE0\\uFE0F'), label: lang.HELP_CAT_ADMIN_LABEL, desc: lang.HELP_CAT_ADMIN_DESC, content: formatHelpContent(lang.HELP_CONTENT_ADMIN) }
    };
}

/**
 * Membangun payload Components V2 untuk help menu.
 * @param {object} lang - Objek bahasa yang aktif.
 * @param {object} client - Discord client.
 * @param {number} categoryIndex - Indeks kategori aktif, -1 untuk halaman awal.
 * @param {boolean} disabled - Menonaktifkan komponen saat collector berakhir.
 */
function buildHelpPayload(lang, client, categoryIndex = -1, disabled = false) {
    const categoryKeys = HELP_CATEGORY_KEYS;
    const categories = buildCategories(lang);

    const activeKey = categoryIndex >= 0 ? categoryKeys[categoryIndex] : null;
    const activeCat = activeKey ? categories[activeKey] : null;
    const bodyContent = activeCat
        ? `${activeCat.emoji} **${activeCat.label}**\\n\\n${activeCat.content}`
        : formatHelpContent(lang.HELP_DESC);

    const primaryHex = (ui.getColor('primary') || '#FFB6C1').replace('#', '');
    const accentColor = parseInt(primaryHex, 16);

    // Pakai ui.parseEmoji agar custom emoji tidak membuat select menu ditolak
    const selectOptions = categoryKeys.map(key => {
        const option = {
            label: categories[key].label,
            description: categories[key].desc,
            value: key,
            default: key === activeKey
        };
        const parsedEmoji = ui.parseEmoji(categories[key].emoji);
        if (parsedEmoji) option.emoji = parsedEmoji;
        return option;
    });

    // Placeholder select menu tidak merender custom emoji, jadi sengaja pakai
    // emoji unicode di sini saja.
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('help_category_select')
        .setPlaceholder(`\\uD83D\\uDCDA ${lang.HELP_PLACEHOLDER || 'Naura Help Menu'}`)
        .setDisabled(disabled)
        .addOptions(selectOptions);
    const selectRow = new ActionRowBuilder().addComponents(selectMenu);

    const prevBtn = new ButtonBuilder()
        .setCustomId('help_prev')
        .setLabel(lang.HELP_BTN_PREV || '\\u00AB Categories')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled || categoryIndex <= 0);
    const nextBtn = new ButtonBuilder()
        .setCustomId('help_next')
        .setLabel(lang.HELP_BTN_NEXT || 'Categories \\u00BB')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled || categoryIndex >= categoryKeys.length - 1);
    const langBtn = new ButtonBuilder()
        .setCustomId('help_lang_switch')
        .setLabel(lang.HELP_BTN_LANG || 'Bahasa / Language')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled);
    const navRow = new ActionRowBuilder().addComponents(prevBtn, nextBtn, langBtn);

    const footerText = ui.stripCustomEmojis(ui.getFooter('core'));
    const eHelp = e('help', '\\uD83D\\uDCDA');

    const containerComponents = [
        { type: 10, content: `## ${eHelp} ${lang.HELP_TITLE || 'Naura Help System'}` },
        { type: 14, divider: true, spacing: 1 },
        { type: 10, content: bodyContent },
        { type: 14, divider: true, spacing: 1 },
        selectRow.toJSON(),
        navRow.toJSON(),
        { type: 14, divider: false, spacing: 1 },
        { type: 10, content: `-# ${footerText}` }
    ];

    return {
        content: null,
        embeds: [],
        flags: MessageFlags.IsComponentsV2,
        components: [
            {
                type: 17,
                accent_color: accentColor,
                components: containerComponents
            }
        ]
    };
}

/**
 * Payload pemilih bahasa. Pilihan yang sedang berlaku ditandai default
 * supaya user langsung tahu bahasa apa yang sedang dipakai Naura.
 */
function buildLanguagePayload(client, currentCode) {
    const isIndo = currentCode !== 'en';

    const langSelectRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('help_lang_select')
            .setPlaceholder(isIndo ? 'Pilih bahasa / Choose a language' : 'Choose a language / Pilih bahasa')
            .addOptions(
                { label: 'Indonesia', description: 'Naura akan menemanimu dalam Bahasa Indonesia', value: 'id', emoji: '\\uD83C\\uDDEE\\uD83C\\uDDE9', default: isIndo },
                { label: 'English', description: 'Naura will guide you in English', value: 'en', emoji: '\\uD83C\\uDDEC\\uD83C\\uDDE7', default: !isIndo }
            )
    );

    return buildContainerV2({
        accentColorHex: ui.getColor('primary') || '#FFB6C1',
        authorName: 'Naura Help System',
        title: `${e('help', '\\uD83D\\uDCDA')} Naura Help System`,
        iconURL: client.user.displayAvatarURL(),
        expression: 'help',
        description: isIndo
            ? 'Halo! Sebelum kita mulai, pilih dulu bahasa yang paling nyaman buat kamu di bawah ini yaa~ Nanti Naura pandu semuanya pakai bahasa itu, dan pilihanmu Naura ingat terus di seluruh fitur.'
            : 'Hi there! Before we start, pick the language you feel most comfortable with below. Naura will guide you in that language and will remember your choice across every feature.',
        buttonsRow: langSelectRow,
        footerText: ui.getFooter('core')
    });
}

module.exports = { buildHelpPayload, buildLanguagePayload, buildCategories };
