const { EmbedBuilder } = require('discord.js');
const ui = require('../../config/ui');
const env = require('../../config/env');
const UserProfile = require('../../models/UserProfile');
const { checkPremiumStatus } = require('../../../plugin/premium/premiumHelper');

const MAX_STORED_MENTIONS = 15;
const NOTICE_LIFETIME_MS = 10000;

/**
 * Memberi tahu bahwa seseorang yang di-tag sedang AFK, sekaligus mencatat
 * siapa saja yang mencarinya.
 */
async function notifyMentionedAfk(message) {
    if (message.mentions.users.size === 0) return;

    for (const mentioned of message.mentions.users.values()) {
        if (mentioned.id === message.author.id) continue;

        const profile = await UserProfile.findByPk(mentioned.id).catch(() => null);
        if (!profile || !profile.afk_reason) continue;

        const mentions = profile.afk_mentions || [];
        if (mentions.length < MAX_STORED_MENTIONS) {
            mentions.push({
                author: message.author.username,
                content: message.content.substring(0, 50),
                time: Date.now(),
                link: message.url
            });
            profile.afk_mentions = mentions;
            profile.changed('afk_mentions', true);
            await profile.save().catch(() => {});
        }

        const since = `<t:${Math.floor(new Date(profile.afk_timestamp).getTime() / 1000)}:R>`;
        const embed = new EmbedBuilder()
            .setColor(ui.getColor('primary') || '#FFB6C1')
            .setDescription(
                `${ui.getEmoji('sleepy') || ui.getEmoji('afk') || '\uD83D\uDCA4'} **${mentioned.username}** lagi AFK sejak ${since}.\n\n` +
                `> ${ui.getEmoji('read') || '\uD83D\uDCDD'} *${profile.afk_reason}*\n\n` +
                'Nanti Naura sampaikan pesanmu begitu dia balik, yaa!'
            );

        message.reply({ embeds: [embed] })
            .then(sent => setTimeout(() => sent?.delete().catch(() => null), NOTICE_LIFETIME_MS))
            .catch(() => {});
    }
}

/** Menyambut pengguna yang baru kembali dari AFK. */
async function welcomeBack(message) {
    const profile = await UserProfile.findByPk(message.author.id).catch(() => null);
    if (!profile || !profile.afk_reason) return;

    const isOwner = env.OWNER_IDS.includes(message.author.id);
    const isPremium = await checkPremiumStatus(message.author.id);
    const minutes = profile.afk_timestamp
        ? Math.floor((Date.now() - new Date(profile.afk_timestamp).getTime()) / 60000)
        : 0;
    const mentions = profile.afk_mentions || [];

    profile.afk_reason = null;
    profile.afk_timestamp = null;
    profile.afk_mentions = [];
    await profile.save().catch(() => {});

    let greeting = `${ui.getEmoji('happy') || '\uD83D\uDC4B'} Selamat datang kembali, <@${message.author.id}>! Naura tungguin dari tadi, lho.`;
    if (isOwner) {
        greeting = `${ui.getEmoji('blowkiss') || '\uD83E\uDD70'} Akhirnya kamu balik juga, sayang! Naura kangen banget tau... sekarang Naura siap bantu kamu lagi, ya!`;
    } else if (isPremium) {
        greeting = `${ui.getEmoji('cheers') || '\uD83C\uDF1F'} Yeyy, bestie Naura udah pulang! Selamat datang kembali <@${message.author.id}>, semoga istirahatnya nyenyak!`;
    }

    const embed = new EmbedBuilder()
        .setColor(ui.getColor('success') || '#00FF00')
        .setDescription(`${greeting}\n*(Kamu AFK selama ${minutes} menit)*`);

    if (mentions.length > 0) {
        const list = mentions
            .map(m => `- **${m.author}** (<t:${Math.floor(m.time / 1000)}:R>): [*Lihat pesan*](${m.link})`)
            .join('\n');
        embed.addFields({
            name: `${ui.getEmoji('chirping') || '\uD83D\uDD14'} Ada ${mentions.length} orang yang nyariin kamu:`,
            value: list
        });
    }

    if (message.member && message.member.displayName.startsWith('[AFK]')) {
        await message.member.setNickname(message.member.displayName.replace('[AFK] ', '')).catch(() => {});
    }

    message.reply({ embeds: [embed] }).catch(() => {});
}

/** Tidak pernah menghentikan alur; AFK hanya menyisipkan pemberitahuan. */
module.exports = async function handleAfk(message) {
    await notifyMentionedAfk(message);
    await welcomeBack(message);
    return false;
};
