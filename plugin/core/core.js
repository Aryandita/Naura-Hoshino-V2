/**
 * @namespace: plugin/core/core.js
 * @type: Command
 * @copyright (c) 2026 Aryandita Praftian
 * @assistant Naura Hoshino
 * @version 2.0.0
 * @description Orkestrator sistem inti Naura: ping, stats, info, about, help, dan bahasa.
 */

const env = require('../../src/config/env');
const ui = require('../../src/config/ui');
const logger = require('../../src/managers/logger');
const { buildLoadingContainerV2, buildErrorContainerV2 } = require('../../src/utils/NauraContainerBuilder');
const { data, aliases } = require('./coreCommand');
const { face, e, resolveLocale } = require('./coreCommon');
const { handlePing } = require('./corePing');
const { handleStats, handleInfo } = require('./coreStats');
const { handleAbout } = require('./coreAbout');
const { handleHelp } = require('./coreHelp');
const { handleLanguage } = require('./coreLanguage');

const HANDLERS = {
    ping: (ctx) => handlePing(ctx.interaction, ctx.client, ctx.lang),
    stats: (ctx) => handleStats(ctx.interaction, ctx.client, ctx.lang),
    info: (ctx) => handleInfo(ctx.interaction, ctx.client, ctx.lang),
    about: (ctx) => handleAbout(ctx.interaction, ctx.client, ctx.lang),
    help: (ctx) => handleHelp(ctx.interaction, ctx.client, ctx.lang, ctx.code),
    language: (ctx) => handleLanguage(ctx.interaction, ctx.guildId, ctx.newLang, ctx.lang)
};

function unknownPayload(lang) {
    return buildErrorContainerV2({
        authorName: 'Naura Core System',
        description: lang.ERROR_INVALID_SUBCOMMAND
            || `${face('error', '\\u274C')} Aduh, Naura belum kenal perintah itu. Coba cek lewat menu help yaa~`,
        footerText: ui.getFooter('core')
    });
}

/** Mock interaction untuk jalur prefix, lengkap dengan pewarisan localeLang. */
function createMockInteraction(message, client) {
    let replyMsg = null;

    const mock = {
        client,
        user: message.author,
        guild: message.guild,
        member: message.member,
        channel: message.channel,
        createdTimestamp: message.createdTimestamp,
        deferred: false,
        deferReply: async () => {
            const loadingPayload = buildLoadingContainerV2({
                authorName: 'Naura Loading System...',
                description: `${face('loading', '\\u23F3')} Tunggu sebentar yaa, Naura lagi siapin semuanya buat kamu~ ${e('sparkle', '\\u2728')}`,
                footerText: `Sedang menyiapkan untuk ${message.author.username}`
            });
            replyMsg = await message.reply(loadingPayload);
            mock.deferred = true;
            return replyMsg;
        },
        reply: async (payload) => {
            replyMsg = await message.reply(payload);
            return replyMsg;
        },
        editReply: async (payload) => {
            if (replyMsg) return replyMsg.edit(payload);
            replyMsg = await message.reply(payload);
            return replyMsg;
        },
        fetchReply: async () => replyMsg,
        followUp: async (payload) => message.channel.send(payload)
    };

    // Warisi patch localeLang dari objek Message supaya helper bahasa
    // tetap tersedia di jalur prefix.
    for (const key of ['localeLang', 'lang', 't', 'fetchLang']) {
        if (message[key] !== undefined) {
            const value = message[key];
            mock[key] = typeof value === 'function' ? value.bind(message) : value;
        }
    }

    return mock;
}

module.exports = {
    data,
    aliases,

    async executePrefix(message, args, client) {
        const prefix = env.PREFIX || 'n!';
        const cmdName = message.content.slice(prefix.length).trim().split(/ +/)[0].toLowerCase();

        let subcommand = cmdName === 'core' ? (args[0] ? args[0].toLowerCase() : null) : cmdName;
        if (subcommand === 'lang') subcommand = 'language';

        const guildId = message.guild ? message.guild.id : null;
        const { code, lang } = await resolveLocale(message.author.id, guildId);

        const handler = HANDLERS[subcommand];
        if (!handler) return message.reply(unknownPayload(lang));

        let newLang = null;
        if (subcommand === 'language') {
            newLang = cmdName === 'core'
                ? (args[1] ? args[1].toLowerCase() : null)
                : (args[0] ? args[0].toLowerCase() : null);
        }

        const interaction = createMockInteraction(message, client || message.client);

        try {
            return await handler({ interaction, client: client || message.client, lang, code, guildId, newLang });
        } catch (err) {
            logger.error(`[Core] Gagal menjalankan ${subcommand} (prefix): ${err.stack || err.message}`);
            return message.reply(unknownPayload(lang)).catch(() => { });
        }
    },

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const client = interaction.client;
        const guildId = interaction.guild ? interaction.guild.id : null;
        const { code, lang } = await resolveLocale(interaction.user.id, guildId);

        const handler = HANDLERS[subcommand];
        if (!handler) {
            const payload = unknownPayload(lang);
            if (interaction.deferred || interaction.replied) return interaction.editReply(payload);
            return interaction.reply(payload);
        }

        const newLang = subcommand === 'language' ? interaction.options.getString('lang') : null;

        try {
            return await handler({ interaction, client, lang, code, guildId, newLang });
        } catch (err) {
            logger.error(`[Core] Gagal menjalankan ${subcommand}: ${err.stack || err.message}`);
            const payload = unknownPayload(lang);
            if (interaction.deferred || interaction.replied) return interaction.editReply(payload).catch(() => { });
            return interaction.reply(payload).catch(() => { });
        }
    }
};
