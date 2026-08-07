/**
 * @namespace: src/commands/Core/core.js
 * @type: Command
 * @copyright (c) 2026 Aryandita Praftian
 * @assistant Naura Hoshino
 * @version 1.1.0
 * @description Core system, statistics, and interactive help menu for Naura with Localization.
 */

const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    AttachmentBuilder,
    ComponentType,
    MessageFlags,
    version: djsVersion
} = require('discord.js');
const os = require('node:os');
const { sequelize } = require('../../src/managers/dbManager');
const GuildSettings = require('../../src/models/GuildSettings');
const ui = require('../../src/config/ui');
const env = require('../../src/config/env');
const nauraExpression = require('../../src/utils/nauraExpression');
const { buildContainerV2, buildLoadingContainerV2 } = require('../../src/utils/NauraContainerBuilder');
const { buildFeatureOverviewText, buildFeatureSummaryFields } = require('../../src/utils/featureRegistryView');

const locales = {
    id: require('./locales/id.json'),
    en: require('./locales/en.json')
};

const rawDashboard = ui.dashboards || 'http://92.118.206.166:30398';
const LINKS = {
    SUPPORT: ui.support_server || 'https://dsc.gg/naura-hoshino',
    DASHBOARD: rawDashboard.startsWith('http') ? rawDashboard : `{{http://${rawDashboard}}}`,
    INVITE: ui.invite || 'https://discord.com/api/oauth2/authorize?client_id=1483665745727721543&permissions=8&scope=bot%20applications.commands'
};

const HELP_CATEGORY_KEYS = ['overview', 'core', 'music', 'minigame', 'survival', 'admin'];

function e(name, fallback) {
    return ui.getEmoji(name) || fallback;
}

function face(mood, fallback) {
    return nauraExpression.getEmoji(mood) || ui.getEmoji(mood) || fallback;
}

function formatUptime(ms) {
    const sparkle = e('sparkle', '\u2728');
    if (ms < 1000) return `Baru saja mulai ${sparkle}`;

    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((ms % (1000 * 60)) / 1000);

    const result = [];
    if (days > 0) result.push(`${days}d`);
    if (hours > 0) result.push(`${hours}h`);
    if (minutes > 0) result.push(`${minutes}m`);
    if (seconds > 0) result.push(`${seconds}s`);

    return result.length > 0 ? result.join(' ') : `Baru saja mulai ${sparkle}`;
}

function createNavButtons() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('Support Server').setURL(LINKS.SUPPORT).setStyle(ButtonStyle.Link).setEmoji(e('support', '\uD83D\uDCAC')),
        new ButtonBuilder().setLabel('Web Dashboard').setURL(LINKS.DASHBOARD).setStyle(ButtonStyle.Link).setEmoji(e('dashboard', '\uD83C\uDF10')),
        new ButtonBuilder().setLabel('Invite Naura').setURL(LINKS.INVITE).setStyle(ButtonStyle.Link).setEmoji(e('invite', '\uD83D\uDCE9'))
    );
}

function formatHelpContent(text) {
    if (!text) return '';
    return text.replace(/{emoji:(\w+)(?:\|([^}]+))?}/g, (match, key, fallback) => {
        return ui.getEmoji(key) || fallback || match;
    });
}

function featureOverviewContent(lang) {
    const header = formatHelpContent(lang.HELP_DESC);
    const overview = buildFeatureOverviewText();
    const fields = buildFeatureSummaryFields()
        .map(field => `**${field.name}**\n${field.value}`)
        .join('\n\n');

    return `${header}\n\n${overview}\n\n${fields}`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('core')
        .setDescription('Pusat Informasi & Sistem Inti Naura Hoshino / Core System')
        .addSubcommand(sub => sub.setName('ping').setDescription('Cek respons latensi Discord, Database MySQL, & Lavalink.'))
        .addSubcommand(sub => sub.setName('stats').setDescription('Lihat diagnostik spesifikasi server, RAM, dan OS Naura.'))
        .addSubcommand(sub => sub.setName('info').setDescription('Tampilkan info spesifik server saat ini atau info bot secara umum.'))
        .addSubcommand(sub => sub.setName('about').setDescription('Kenalan lebih dekat dengan Naura dan Aryandita!'))
        .addSubcommand(sub => sub.setName('help').setDescription('Buka panduan perintah interaktif Naura.'))
        .addSubcommand(sub => sub.setName('language').setDescription('Ubah bahasa bot di server ini / Change bot language')
            .addStringOption(opt => opt.setName('lang').setDescription('Pilih bahasa / Select language').setRequired(true).addChoices(
                { name: 'Indonesian', value: 'id' },
                { name: 'English', value: 'en' }
            ))),

    aliases: ['ping', 'stats', 'info', 'about', 'help', 'language', 'lang'],

    async executePrefix(message, args, client) {
        const prefix = env.PREFIX || 'n!';
        const cmdName = message.content.slice(prefix.length).trim().split(/ +/)[0].toLowerCase();

        let subcommand = cmdName === 'core' ? (args[0] ? args[0].toLowerCase() : null) : cmdName;
        if (subcommand === 'lang') subcommand = 'language';

        let replyMsg = null;
        const mockInteraction = {
            client,
            user: message.author,
            guild: message.guild,
            member: message.member,
            createdTimestamp: message.createdTimestamp,
            deferReply: async () => {
                const loadingPayload = buildLoadingContainerV2({
                    authorName: 'Naura Loading System...',
                    description: `${face('loading', '\u23F3')} Tunggu sebentar yaa, Naura lagi siapin semuanya buat kamu~ ${e('sparkle', '\u2728')}`,
                    footerText: `Sedang menyiapkan untuk ${message.author.username}`
                });
                replyMsg = await message.reply(loadingPayload);
            },
            reply: async (payload) => {
                replyMsg = await message.reply(payload);
                return replyMsg;
            },
            editReply: async (payload) => {
                if (replyMsg) return await replyMsg.edit(payload);
                replyMsg = await message.reply(payload);
                return replyMsg;
            }
        };

        const guildId = message.guild ? message.guild.id : null;
        let langCode = 'id';
        if (guildId) {
            const settings = await GuildSettings.findOne({ where: { guildId } });
            if (settings && settings.system && settings.system.language) langCode = settings.system.language;
        }
        const lang = locales[langCode] || locales.id;

        switch (subcommand) {
            case 'ping': return await handlePing(mockInteraction, client, lang);
            case 'stats': return await handleStats(mockInteraction, client, lang);
            case 'info': return await handleInfo(mockInteraction, client, lang);
            case 'about': return await handleAbout(mockInteraction, client, lang);
            case 'help': return await handleHelp(mockInteraction, client, lang);
            case 'language': {
                let newLang = null;
                if (cmdName === 'core' && args[1]) newLang = args[1].toLowerCase();
                else if (cmdName !== 'core' && args[0]) newLang = args[0].toLowerCase();
                return await handleLanguage(mockInteraction, guildId, newLang, lang);
            }
            default:
                return message.reply(lang.ERROR_INVALID_SUBCOMMAND || `${face('error', '\u274C')} Aduh, Naura belum kenal perintah itu. Coba cek lewat menu help yaa~`);
        }
    },

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const client = interaction.client;

        const guildId = interaction.guild ? interaction.guild.id : null;
        let langCode = 'id';
        if (guildId) {
            const settings = await GuildSettings.findOne({ where: { guildId } });
            if (settings && settings.system && settings.system.language) langCode = settings.system.language;
        }
        const lang = locales[langCode] || locales.id;

        switch (subcommand) {
            case 'ping': return await handlePing(interaction, client, lang);
            case 'stats': return await handleStats(interaction, client, lang);
            case 'info': return await handleInfo(interaction, client, lang);
            case 'about': return await handleAbout(interaction, client, lang);
            case 'help': return await handleHelp(interaction, client, lang);
            case 'language': return await handleLanguage(interaction, guildId, interaction.options.getString('lang'), lang);
            default:
                return interaction.reply({ content: lang.ERROR_INVALID_SUBCOMMAND || `${face('error', '\u274C')} Aduh, Naura belum kenal perintah itu. Coba cek lewat menu help yaa~`, ephemeral: true });
        }
    }
};

// NOTE: Bagian handler ping/stats/info/about/language tetap sama seperti main.
// Patch ini hanya mengubah fondasi help payload. Saat merge, pertahankan handler
// existing di bawah ini dari versi main bila conflict muncul.

function buildHelpPayload(lang, client, categoryIndex = 0, disabled = false) {
    const categoryKeys = HELP_CATEGORY_KEYS;
    const categories = {
        overview: { emoji: e('help', '\uD83D\uDCDA'), label: lang.HELP_CAT_OVERVIEW_LABEL || 'Feature Overview', desc: lang.HELP_CAT_OVERVIEW_DESC || 'Modul utama Naura.', content: featureOverviewContent(lang) },
        core: { emoji: e('help_core', '\u2699\uFE0F'), label: lang.HELP_CAT_CORE_LABEL, desc: lang.HELP_CAT_CORE_DESC, content: formatHelpContent(lang.HELP_CONTENT_CORE) },
        music: { emoji: e('help_music', '\uD83C\uDFB5'), label: lang.HELP_CAT_MUSIC_LABEL, desc: lang.HELP_CAT_MUSIC_DESC, content: formatHelpContent(lang.HELP_CONTENT_MUSIC) },
        minigame: { emoji: e('help_game', '\uD83C\uDFAE'), label: lang.HELP_CAT_GAME_LABEL, desc: lang.HELP_CAT_GAME_DESC, content: formatHelpContent(lang.HELP_CONTENT_GAME) },
        survival: { emoji: e('help_survival', '\uD83C\uDFD5\uFE0F'), label: lang.HELP_CAT_SURVIVAL_LABEL, desc: lang.HELP_CAT_SURVIVAL_DESC, content: formatHelpContent(lang.HELP_CONTENT_SURVIVAL) },
        admin: { emoji: e('help_admin', '\uD83D\uDEE0\uFE0F'), label: lang.HELP_CAT_ADMIN_LABEL, desc: lang.HELP_CAT_ADMIN_DESC, content: formatHelpContent(lang.HELP_CONTENT_ADMIN) },
    };

    const activeKey = categoryKeys[categoryIndex] || 'overview';
    const activeCat = categories[activeKey];
    const bodyContent = `${activeCat.emoji} **${activeCat.label}**\n\n${activeCat.content}`;

    const primaryHex = (ui.getColor('primary') || '#FFB6C1').replace('#', '');
    const accentColor = parseInt(primaryHex, 16);

    const selectOptions = categoryKeys.map(key => {
        const option = { label: categories[key].label, description: categories[key].desc, value: key, default: key === activeKey };
        const parsedEmoji = ui.parseEmoji(categories[key].emoji);
        if (parsedEmoji) option.emoji = parsedEmoji;
        return option;
    });

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('help_category_select')
        .setPlaceholder(`\uD83D\uDCDA ${lang.HELP_PLACEHOLDER || 'Naura Help Menu'}`)
        .setDisabled(disabled)
        .addOptions(selectOptions);
    const selectRow = new ActionRowBuilder().addComponents(selectMenu);

    const prevBtn = new ButtonBuilder().setCustomId('help_prev').setLabel(lang.HELP_BTN_PREV || '\u00AB Categories').setStyle(ButtonStyle.Secondary).setDisabled(disabled || categoryIndex <= 0);
    const nextBtn = new ButtonBuilder().setCustomId('help_next').setLabel(lang.HELP_BTN_NEXT || 'Categories \u00BB').setStyle(ButtonStyle.Secondary).setDisabled(disabled || categoryIndex >= categoryKeys.length - 1);
    const navRow = new ActionRowBuilder().addComponents(prevBtn, nextBtn);

    const footerText = ui.stripCustomEmojis(ui.getFooter('core'));
    const eHelp = e('help', '\uD83D\uDCDA');

    return {
        flags: MessageFlags.IsComponentsV2,
        components: [{ type: 17, accent_color: accentColor, components: [
            { type: 10, content: `## ${eHelp} ${lang.HELP_TITLE || 'Naura Help System'}` },
            { type: 14, divider: true, spacing: 1 },
            { type: 10, content: bodyContent },
            { type: 14, divider: true, spacing: 1 },
            selectRow.toJSON(),
            navRow.toJSON(),
            { type: 14, divider: false, spacing: 1 },
            { type: 10, content: `-# ${footerText}` },
        ] }],
        _categoryKeys: categoryKeys,
        _categories: categories,
    };
}
