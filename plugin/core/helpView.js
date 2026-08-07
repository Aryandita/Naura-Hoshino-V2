'use strict';

const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    MessageFlags
} = require('discord.js');

const ui = require('../../src/config/ui');
const { buildFeatureOverviewText, buildFeatureSummaryFields } = require('../../src/utils/featureRegistryView');

const HELP_CATEGORY_KEYS = ['overview', 'core', 'music', 'minigame', 'survival', 'admin'];

function e(name, fallback) {
    return ui.getEmoji(name) || fallback;
}

function formatHelpContent(text) {
    if (!text) return '';
    return text.replace(/{emoji:(\w+)(?:\|([^}]+))?}/g, (match, key, fallback) => {
        return ui.getEmoji(key) || fallback || match;
    });
}

function featureOverviewContent(lang) {
    const intro = formatHelpContent(lang.HELP_DESC);
    const overview = buildFeatureOverviewText();
    const registryFields = buildFeatureSummaryFields()
        .map(field => `**${field.name}**\n${field.value}`)
        .join('\n\n');

    return `${intro}\n\n${overview}\n\n${registryFields}`;
}

function buildHelpCategories(lang) {
    return {
        overview: {
            emoji: e('help', '📚'),
            label: lang.HELP_CAT_OVERVIEW_LABEL || 'Feature Overview',
            desc: lang.HELP_CAT_OVERVIEW_DESC || 'Modul utama Naura.',
            content: featureOverviewContent(lang)
        },
        core: {
            emoji: e('help_core', '⚙️'),
            label: lang.HELP_CAT_CORE_LABEL,
            desc: lang.HELP_CAT_CORE_DESC,
            content: formatHelpContent(lang.HELP_CONTENT_CORE)
        },
        music: {
            emoji: e('help_music', '🎵'),
            label: lang.HELP_CAT_MUSIC_LABEL,
            desc: lang.HELP_CAT_MUSIC_DESC,
            content: formatHelpContent(lang.HELP_CONTENT_MUSIC)
        },
        minigame: {
            emoji: e('help_game', '🎮'),
            label: lang.HELP_CAT_GAME_LABEL,
            desc: lang.HELP_CAT_GAME_DESC,
            content: formatHelpContent(lang.HELP_CONTENT_GAME)
        },
        survival: {
            emoji: e('help_survival', '🏕️'),
            label: lang.HELP_CAT_SURVIVAL_LABEL,
            desc: lang.HELP_CAT_SURVIVAL_DESC,
            content: formatHelpContent(lang.HELP_CONTENT_SURVIVAL)
        },
        admin: {
            emoji: e('help_admin', '🛠️'),
            label: lang.HELP_CAT_ADMIN_LABEL,
            desc: lang.HELP_CAT_ADMIN_DESC,
            content: formatHelpContent(lang.HELP_CONTENT_ADMIN)
        }
    };
}

function buildHelpPayload(lang, categoryIndex = 0, disabled = false) {
    const categoryKeys = HELP_CATEGORY_KEYS;
    const categories = buildHelpCategories(lang);
    const activeKey = categoryKeys[categoryIndex] || 'overview';
    const activeCat = categories[activeKey];
    const bodyContent = `${activeCat.emoji} **${activeCat.label}**\n\n${activeCat.content}`;

    const primaryHex = (ui.getColor('primary') || '#FFB6C1').replace('#', '');
    const accentColor = parseInt(primaryHex, 16);

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

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('help_category_select')
        .setPlaceholder(`📚 ${lang.HELP_PLACEHOLDER || 'Naura Help Menu'}`)
        .setDisabled(disabled)
        .addOptions(selectOptions);

    const selectRow = new ActionRowBuilder().addComponents(selectMenu);
    const prevBtn = new ButtonBuilder()
        .setCustomId('help_prev')
        .setLabel(lang.HELP_BTN_PREV || '« Categories')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled || categoryIndex <= 0);
    const nextBtn = new ButtonBuilder()
        .setCustomId('help_next')
        .setLabel(lang.HELP_BTN_NEXT || 'Categories »')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled || categoryIndex >= categoryKeys.length - 1);
    const navRow = new ActionRowBuilder().addComponents(prevBtn, nextBtn);

    const footerText = ui.stripCustomEmojis(ui.getFooter('core'));
    const eHelp = e('help', '📚');

    return {
        flags: MessageFlags.IsComponentsV2,
        components: [
            {
                type: 17,
                accent_color: accentColor,
                components: [
                    { type: 10, content: `## ${eHelp} ${lang.HELP_TITLE || 'Naura Help System'}` },
                    { type: 14, divider: true, spacing: 1 },
                    { type: 10, content: bodyContent },
                    { type: 14, divider: true, spacing: 1 },
                    selectRow.toJSON(),
                    navRow.toJSON(),
                    { type: 14, divider: false, spacing: 1 },
                    { type: 10, content: `-# ${footerText}` }
                ]
            }
        ],
        _categoryKeys: categoryKeys,
        _categories: categories
    };
}

module.exports = {
    HELP_CATEGORY_KEYS,
    formatHelpContent,
    featureOverviewContent,
    buildHelpCategories,
    buildHelpPayload
};
