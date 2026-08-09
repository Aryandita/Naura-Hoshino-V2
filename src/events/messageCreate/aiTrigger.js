'use strict';

const { PermissionFlagsBits } = require('discord.js');

const env = require('../../config/env');
const { checkPremiumStatus } = require('../../../plugin/premium/premiumHelper');
const AIRouterManager = require('../../../plugin/ai/aiRouterManager');
const persona = require('./persona');

function isMentioningBot(message, client) {
    return message.content.includes(`<@${client.user.id}>`)
        || message.content.includes(`<@!${client.user.id}>`);
}

// Mengambil kalimat terakhir Naura agar percakapan terasa nyambung.
async function readPreviousBotMessage(message, client) {
    if (!message.reference?.messageId) return { isReplyToBot: false, previousBotMessage: '' };

    const repliedMsg = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
    if (!repliedMsg || repliedMsg.author.id !== client.user.id) {
        return { isReplyToBot: false, previousBotMessage: '' };
    }

    return {
        isReplyToBot: true,
        previousBotMessage: `\n[Konteks] Sebelumnya kamu berkata: "${repliedMsg.content}"\n`
    };
}

/**
 * Menjawab pesan yang menyebut Naura, membalas Naura, atau berada di channel AI.
 * Mengembalikan true bila pesan sudah dijawab.
 */
module.exports = async function handleAiTrigger(message, client, ctx) {
    const guildChannels = ctx?.guildChannels || {};

    const isMentioned = isMentioningBot(message, client);
    const { isReplyToBot, previousBotMessage } = await readPreviousBotMessage(message, client);
    const isInAiChannel = Boolean(guildChannels.ai) && message.channel.id === guildChannels.ai;

    if (!isMentioned && !isReplyToBot && !isInAiChannel) return false;

    await message.channel.sendTyping().catch(() => {});

    const userMessage = message.content
        .replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '')
        .trim();

    const isOwner = env.OWNER_IDS.includes(message.author.id);
    const isAdmin = Boolean(
        message.member
        && (message.member.permissions.has(PermissionFlagsBits.Administrator)
            || message.member.permissions.has(PermissionFlagsBits.ManageGuild))
    );
    const isPremiumUser = await checkPremiumStatus(message.author.id);

    const prompt = persona.build({
        username: message.author.username,
        isOwner,
        isAdmin,
        aiPersona: ctx?.settings?.settings?.aiPersona || null
    });

    await AIRouterManager.processMessage(
        client,
        message,
        userMessage,
        prompt,
        previousBotMessage,
        isOwner,
        isPremiumUser,
        ctx?.settings || null
    );

    return true;
};
