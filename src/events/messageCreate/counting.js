const { EmbedBuilder } = require('discord.js');
const ui = require('../../config/ui');

const FAIL_NOTICE_MS = 5000;

/**
 * Reaksi hanya menerima nama unicode atau ID mentah, bukan format <:nama:id>.
 */
function toReactionEmoji(raw, fallback) {
    if (!raw) return fallback;
    const match = raw.match(/<a?:(\w+):(\d+)>/);
    return match ? match[2] : raw;
}

module.exports = async function handleCounting(message, client, ctx) {
    const channelId = ctx.guildChannels.counting;
    if (!channelId || message.channel.id !== channelId) return false;

    const trimmed = message.content.trim();
    if (trimmed === '' || isNaN(trimmed)) {
        await message.delete().catch(() => {});
        return true;
    }

    const input = parseInt(trimmed, 10);
    const game = ctx.settings.countingGame || { currentNumber: 0, lastUser: null };
    const expected = (game.currentNumber || 0) + 1;

    const successEmoji = toReactionEmoji(ui.getEmoji('success'), '\u2705');
    const errorEmoji = toReactionEmoji(ui.getEmoji('error'), '\u274C');

    const reset = async (reason) => {
        await message.react(errorEmoji).catch(() => {});
        const notice = await message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(ui.getColor('error') || '#FF0000')
                    .setDescription(`${ui.getEmoji('cry') || '\u274C'} ${reason} Hitungannya Naura mulai lagi dari **0**, yaa. Semangat!`)
            ]
        }).catch(() => null);

        if (notice) setTimeout(() => notice.delete().catch(() => {}), FAIL_NOTICE_MS);

        ctx.settings.countingGame = { currentNumber: 0, lastUser: null };
        await ctx.saveSettings('countingGame');
        return true;
    };

    if (game.lastUser === message.author.id) {
        return reset(`Eh, **${message.author.username}**, nggak boleh menghitung dua kali berturut-turut.`);
    }

    if (input !== expected) {
        return reset(`Yah, **${message.author.username}**, harusnya **${expected}**.`);
    }

    await message.react(successEmoji).catch(() => {});
    ctx.settings.countingGame = { currentNumber: input, lastUser: message.author.id };
    await ctx.saveSettings('countingGame');
    return true;
};
