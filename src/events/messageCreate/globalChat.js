'use strict';

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { Op } = require('sequelize');

const { logger } = require('../../managers/logger');
const redisManager = require('../../managers/redisManager');
const UserFriend = require('../../models/UserFriend');

const BROADCAST_TOPIC = 'naura:globalchat';
const STREAK_COOLDOWN_MS = 12 * 60 * 60 * 1000;
const ACCENT = '#00FFFF';
const EMPTY_TEXT = '*[Tidak ada teks]*';
const BUTTON_PREFIX = 'gchat_add_';

function friendButtonRow(userId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`${BUTTON_PREFIX}${userId}`)
            .setLabel('Add Friend')
            .setEmoji('\u{1F91D}')
            .setStyle(ButtonStyle.Success)
    );
}

// Menelusuri pesan yang dibalas untuk mendapatkan nama dan id lawan bicara.
async function resolveReply(message, client) {
    const empty = { targetName: null, targetId: null };
    if (!message.reference?.messageId) return empty;

    const repliedMsg = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
    if (!repliedMsg) return empty;

    let targetName = repliedMsg.author.username;
    if (repliedMsg.author.id === client.user.id && repliedMsg.embeds.length > 0) {
        const embedAuthor = repliedMsg.embeds[0].author;
        if (embedAuthor?.name) {
            targetName = embedAuthor.name.replace('Pesan oleh ', '').replace('Dibalas oleh ', '');
        }
    }

    // Id sebenarnya hanya tersimpan di customId tombol Add Friend.
    let targetId = null;
    for (const row of repliedMsg.components || []) {
        const button = (row.components || []).find(c => c.customId && c.customId.startsWith(BUTTON_PREFIX));
        if (button) {
            targetId = button.customId.slice(BUTTON_PREFIX.length);
            break;
        }
    }

    return { targetName, targetId };
}

function buildEmbed(message, client, targetName) {
    const contentText = message.content ? message.content : EMPTY_TEXT;
    const replyText = targetName ? `\n\n> *Membalas pesan dari **${targetName}***` : '';
    const authorTitle = targetName
        ? `Dibalas oleh ${message.author.username}`
        : `Pesan oleh ${message.author.username}`;

    const embed = new EmbedBuilder()
        .setColor(ACCENT)
        .setAuthor({ name: authorTitle, iconURL: message.author.displayAvatarURL() })
        .setDescription(contentText + replyText)
        .setFooter({
            text: `Naura Global Chat System | ${message.guild.name}`,
            iconURL: client.user.displayAvatarURL()
        })
        .setTimestamp();

    const image = message.attachments.find(a => a.contentType && a.contentType.startsWith('image/'));
    if (image) embed.setImage(image.url);

    return embed;
}

async function bumpFriendshipStreak(message, targetId, targetName) {
    if (!targetId || targetId === message.author.id) return;

    try {
        const friendship = await UserFriend.findOne({
            where: {
                [Op.or]: [
                    { user1Id: message.author.id, user2Id: targetId },
                    { user1Id: targetId, user2Id: message.author.id }
                ],
                status: 'accepted'
            }
        });
        if (!friendship) return;

        const last = friendship.lastInteraction ? new Date(friendship.lastInteraction).getTime() : 0;
        if (Date.now() - last < STREAK_COOLDOWN_MS) return;

        friendship.streak += 1;
        friendship.lastInteraction = new Date();
        await friendship.save();

        await message.channel.send({
            content: `\u{1F525} **${message.author.username}** & **${targetName}** baru saja mengobrol! Streak pertemanan kalian naik jadi **${friendship.streak}** hari. Naura ikut senang lihatnya!`
        }).catch(() => {});
    } catch (err) {
        logger.error('[Global Chat] Gagal memperbarui streak pertemanan', err);
    }
}

async function broadcast(message, client, embed, row) {
    const payload = {
        sourceChannelId: message.channel.id,
        embedData: embed.toJSON(),
        componentsData: row.toJSON()
    };

    // Jalur utama: Redis pub/sub, menjangkau seluruh shard.
    if (redisManager.client && redisManager.client.isReady) {
        await redisManager.publish(BROADCAST_TOPIC, payload);
        return;
    }

    // Cadangan pertama: IPC bawaan discord.js.
    if (client.shard) {
        await client.shard.broadcastEval(async (c, { data }) => {
            if (!c.globalChatChannels) return;
            for (const [chanId] of c.globalChatChannels.entries()) {
                if (chanId === data.sourceChannelId) continue;
                const target = c.channels.cache.get(chanId);
                if (target && target.isTextBased()) {
                    await target.send({
                        embeds: [data.embedData],
                        components: [data.componentsData]
                    }).catch(() => {});
                }
            }
        }, { context: { data: payload } }).catch(() => {});
        return;
    }

    // Cadangan terakhir: proses tunggal tanpa shard.
    if (!client.globalChatChannels) return;
    for (const [chanId, guildId] of client.globalChatChannels.entries()) {
        if (chanId === message.channel.id) continue;
        const targetGuild = client.guilds.cache.get(guildId);
        const target = targetGuild?.channels.cache.get(chanId);
        if (target) target.send({ embeds: [embed], components: [row] }).catch(() => {});
    }
}

/**
 * Menyiarkan pesan dari channel global chat ke seluruh server yang terhubung.
 * Mengembalikan true bila channel ini memang channel global chat, sehingga
 * pesan tidak diproses lagi oleh XP, command, maupun AI.
 */
module.exports = async function handleGlobalChat(message, client) {
    if (!message.guild) return false;
    if (!client.globalChatChannels || !client.globalChatChannels.has(message.channel.id)) return false;

    try {
        await message.delete().catch(() => {});

        const { targetName, targetId } = await resolveReply(message, client);
        const embed = buildEmbed(message, client, targetName);
        const row = friendButtonRow(message.author.id);

        await bumpFriendshipStreak(message, targetId, targetName);
        await broadcast(message, client, embed, row);
    } catch (err) {
        logger.error('[Global Chat] Gagal menyiarkan pesan', err);
    }

    return true;
};
