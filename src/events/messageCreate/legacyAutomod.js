const { PermissionFlagsBits } = require('discord.js');
const ui = require('../../config/ui');
const { logger } = require('../../managers/logger');
const gemini = require('./gemini');

const WARNING_LIFETIME_MS = 8000;
const MANNERS_PENALTY = 25;
const DEFAULT_MANNERS = 100;

const BAD_WORDS = ['anjing', 'bangsat', 'kontol', 'babi'];

// Tanpa flag /g. Versi lama memakai /gi lalu memanggil .test() berulang pada
// regex yang sama, sehingga lastIndex tertinggal dari pemeriksaan sebelumnya
// dan link lolos di setiap pesan kedua.
const LINK_REGEX = /(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})/i;

const ALLOWED_HOSTS = [
    'tenor.com', 'discordapp.', 'discord.com',
    'spotify.com', 'youtube.com', 'youtu.be', 'soundcloud.com'
];

async function classifyWithAi(content) {
    if (!gemini.isAvailable()) return null;

    const prompt = `Analisis teks Discord berikut: "${content}". Apakah teks ini secara konteks merupakan perundungan, pelecehan, atau ujaran kebencian? Jawab HANYA JSON: {"isViolation": true/false, "reason": "alasan"}`;
    const raw = await gemini.generateText(prompt);
    if (!raw) return null;

    const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
}

/**
 * @returns {Promise<boolean>} true bila pesan dihapus karena melanggar.
 */
module.exports = async function handleLegacyAutomod(message, client, ctx) {
    if (!message.member || message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return false;

    const automod = ctx.settings?.settings?.automod || {};
    if (!automod.enabled) return false;

    const content = message.content.toLowerCase();
    let violation = null;

    if (automod.antiInvite && /(discord\.gg|discord\.com\/invite)/i.test(content)) {
        violation = 'mengirim undangan server';
    } else if (LINK_REGEX.test(content) && !ALLOWED_HOSTS.some(host => content.includes(host))) {
        violation = 'mengirim link yang tidak diizinkan';
    } else if (message.mentions.users.size > (automod.massMention || 5)) {
        violation = 'menandai terlalu banyak orang sekaligus';
    } else if (content.length > 5 && BAD_WORDS.some(word => content.includes(word))) {
        try {
            const verdict = await classifyWithAi(message.content);
            if (verdict === null) {
                violation = 'menggunakan kata kasar';
            } else if (verdict.isViolation) {
                violation = verdict.reason;
            }
        } catch (err) {
            logger.error('[Automod AI Error]', err);
            violation = 'menggunakan kata kasar';
        }
    }

    if (!violation) return false;

    await message.delete().catch(() => {});

    const UserLeveling = require('../../models/UserLeveling');
    const [profile] = await UserLeveling.findOrCreate({
        where: { userId: message.author.id, guildId: message.guild.id }
    });

    const current = profile.mannersPoint !== undefined ? profile.mannersPoint : DEFAULT_MANNERS;
    profile.mannersPoint = Math.max(0, current - MANNERS_PENALTY);

    if (profile.mannersPoint === 0 && automod.punishRole) {
        try {
            const botMember = message.guild.members.me;
            const role = message.guild.roles.cache.get(automod.punishRole);
            const canPunish = botMember && role
                && botMember.roles.highest.position > message.member.roles.highest.position
                && botMember.roles.highest.position > role.position;

            if (canPunish) {
                await message.member.roles.add(automod.punishRole);
                await message.channel.send(`${ui.getEmoji('hmph') || '\uD83D\uDEA8'} <@${message.author.id}>, poin tata kramamu habis (0/100). Naura terpaksa mengisolasimu dulu, yaa.`);
            } else {
                await message.channel.send(`${ui.getEmoji('akward') || '\uD83D\uDEA8'} <@${message.author.id}>, poin tata kramamu habis (0/100), tapi Naura nggak punya izin yang cukup untuk memberi hukuman.`);
            }
        } catch (err) {
            logger.error('[Automod Role Error]', err);
        }
    } else if (profile.mannersPoint > 0) {
        const warning = await message.channel.send(
            `${ui.getEmoji('annoy') || '\u26A0\uFE0F'} <@${message.author.id}>, pesanmu Naura hapus karena **${violation}**. Poin tata kramamu sekarang **${profile.mannersPoint}/100**, yaa.`
        ).catch(() => null);

        if (warning) setTimeout(() => warning.delete().catch(() => {}), WARNING_LIFETIME_MS);
    }

    await profile.save();
    return true;
};
