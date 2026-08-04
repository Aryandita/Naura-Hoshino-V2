'use strict';

const { EmbedBuilder } = require('discord.js');

const env = require('../../config/env');
const ui = require('../../config/ui');
const { logger } = require('../../managers/logger');
const { awardXp } = require('../../../plugin/leveling/leveling');

// Subcommand yang perlu dibuang dari argumen sebelum dibaca sebagai teks bebas.
const SUBCOMMAND_WORDS = ['balance', 'buy', 'ping', 'set', 'add', 'remove'];

function buildLoadingEmbed(message, client, commandName) {
    return new EmbedBuilder()
        .setColor(ui.getColor ? ui.getColor('primary') : '#FFB6C1')
        .setAuthor({ name: 'Naura Loading System...', iconURL: client.user.displayAvatarURL() })
        .setDescription(`${ui.getEmoji('loading') || '\u23F3'} Tunggu sebentar ya, Naura lagi siapin perintah \`${commandName}\` buat kamu! \u2728`)
        .setFooter({
            text: `Sedang menyiapkan untuk ${message.author.username}`,
            iconURL: message.author.displayAvatarURL()
        });
}

function normalizePayload(payload) {
    const base = typeof payload === 'string'
        ? { content: payload, embeds: [], components: [], files: [] }
        : { content: null, embeds: [], components: [], files: [], ...payload };

    delete base.ephemeral;
    delete base.fetchReply;
    return base;
}

// Meniru objek interaction agar satu command bisa dipanggil lewat slash maupun prefix.
function buildMockInteraction(message, client, command, commandName, args, loadingMsg) {
    const editOrSend = async (payload) => {
        const msgPayload = normalizePayload(payload);
        if (loadingMsg) {
            try {
                return await loadingMsg.edit(msgPayload);
            } catch (e) {
                return await message.channel.send(msgPayload);
            }
        }
        return await message.channel.send(msgPayload);
    };

    return {
        isChatInputCommand: () => true,
        isButton: () => false,
        isStringSelectMenu: () => false,
        commandName: command.data?.name || commandName,
        user: message.author,
        member: message.member,
        guild: message.guild,
        channel: message.channel,
        client,
        createdTimestamp: message.createdTimestamp,

        // Bahasa pengguna ikut diteruskan supaya terjemahan juga jalan di prefix.
        lang: message.localeLang,
        localeLang: message.localeLang,
        locale: message.localeLang,

        options: {
            getSubcommand: () => args[0]?.toLowerCase() || null,
            getString: () => {
                if (args.length === 0) return null;
                const rest = [...args];
                if (SUBCOMMAND_WORDS.includes(rest[0]?.toLowerCase())) rest.shift();
                return rest.join(' ') || null;
            },
            getUser: () => message.mentions.users.first() || null,
            getInteger: () => {
                const num = parseInt(args.find(a => !isNaN(parseInt(a, 10))), 10);
                return isNaN(num) ? null : num;
            },
            getNumber: () => {
                const num = parseFloat(args.find(a => !isNaN(parseFloat(a))));
                return isNaN(num) ? null : num;
            },
            getBoolean: () => {
                if (args.some(a => ['true', 'yes', '1', 'on'].includes(a.toLowerCase()))) return true;
                if (args.some(a => ['false', 'no', '0', 'off'].includes(a.toLowerCase()))) return false;
                return null;
            },
            getChannel: () => {
                const mention = message.mentions.channels.first();
                if (mention) return mention;
                const match = args.find(a => a.match(/^<#(\d+)>$/));
                return match ? message.guild?.channels.cache.get(match.replace(/\D/g, '')) || null : null;
            },
            getRole: () => {
                const mention = message.mentions.roles.first();
                if (mention) return mention;
                const match = args.find(a => a.match(/^<@&(\d+)>$/));
                return match ? message.guild?.roles.cache.get(match.replace(/\D/g, '')) || null : null;
            }
        },

        reply: editOrSend,
        editReply: editOrSend,
        followUp: async (payload) => {
            const msgPayload = typeof payload === 'string' ? { content: payload } : { ...payload };
            delete msgPayload.ephemeral;
            return await message.channel.send(msgPayload);
        },
        deferReply: async () => {},
        deleteReply: async () => {
            if (loadingMsg) await loadingMsg.delete().catch(() => {});
        }
    };
}

/**
 * Menjalankan perintah berawalan prefix. Pesan biasa tetap mendapat XP.
 * Selalu mengembalikan true karena ini langkah terakhir dalam rantai.
 */
module.exports = async function handlePrefixCommand(message, client) {
    const prefix = env.PREFIX || 'n!';

    if (!message.content.toLowerCase().startsWith(prefix.toLowerCase())) {
        if (message.guild) {
            await awardXp(message.author, message.guild, message.channel).catch(() => {});
        }
        return true;
    }

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift()?.toLowerCase();
    if (!commandName) return true;

    const command = client.commands.get(commandName)
        || client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));
    if (!command) return true;

    const loadingMsg = await message
        .reply({ embeds: [buildLoadingEmbed(message, client, commandName)] })
        .catch(() => null);

    try {
        if (typeof command.executePrefix === 'function') {
            if (loadingMsg) await loadingMsg.delete().catch(() => {});
            await command.executePrefix(message, args, client);
        } else if (!command.data && typeof command.execute === 'function') {
            if (loadingMsg) await loadingMsg.delete().catch(() => {});
            await command.execute(client, message, args);
        } else {
            await command.execute(
                buildMockInteraction(message, client, command, commandName, args, loadingMsg)
            );
        }
    } catch (error) {
        logger.error(`[HYBRID ERROR] Command (${commandName}):`, error);
        if (loadingMsg) {
            await loadingMsg.edit({
                content: null,
                embeds: [
                    new EmbedBuilder()
                        .setColor(ui.getColor ? ui.getColor('error') : '#FF0000')
                        .setDescription(`${ui.getEmoji('error') || '\u274C'} Maaf ya, ada yang tersendat waktu Naura jalanin \`${commandName}\`. Coba lagi sebentar lagi, ya?`)
                ]
            }).catch(() => {});
        }
    }

    return true;
};
