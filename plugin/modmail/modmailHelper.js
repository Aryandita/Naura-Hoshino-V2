const {
    ChannelType,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    AttachmentBuilder
} = require('discord.js');
const { logger } = require('../../src/managers/logger');
const ModMail = require('../../src/models/ModMail');
const GuildSettings = require('../../src/models/GuildSettings');
const ui = require('../../src/config/ui');
const cacheManager = require('../../src/managers/cacheManager');
const { buildContainerV2, buildErrorContainerV2 } = require('../../src/utils/NauraContainerBuilder');

async function handleModmailDM(message, client) {
    const activeMail = await ModMail.findOne({ where: { userId: message.author.id, closed: false } });

    if (activeMail) {
        if (!activeMail.guildId) {
            await activeMail.update({ closed: true });
            return await initiateNewTicket(message, client);
        }
        const guild = client.guilds.cache.get(activeMail.guildId);
        const ticketChannel = guild?.channels.cache.get(activeMail.channelId);

        if (!guild || !ticketChannel) {
            await activeMail.update({ closed: true });
            return await initiateNewTicket(message, client);
        }
        return await forwardToTicket(message, ticketChannel, client);
    }
    return await initiateNewTicket(message, client);
}

async function forwardToTicket(message, channel, client) {
    try {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('mm_reply')
                .setLabel('Balas')
                .setEmoji(ui.getEmoji('support') || '💬')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('mm_reply_anon')
                .setLabel('Balas Anonim')
                .setEmoji(ui.getEmoji('mask') || '🎭')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('mm_close')
                .setLabel('Tutup Tiket')
                .setEmoji(ui.getEmoji('lock') || '🔒')
                .setStyle(ButtonStyle.Danger)
        );

        let bannerAtt = null;
        const files = [];
        if (message.attachments.size > 0) {
            const firstAtt = message.attachments.first();
            bannerAtt = firstAtt.name;
            files.push(firstAtt);
        }

        const payload = buildContainerV2({
            accentColorHex: ui.getColor('primary') || '#FFB6C1',
            authorName: message.author.tag,
            iconURL: message.author.displayAvatarURL(),
            description: message.content || '*Hanya mengirim lampiran*',
            bannerAttachmentName: bannerAtt,
            buttonsRow: row,
            footerText: ui.getFooter('core')
        });

        await channel.send({ ...payload, files });
        await message.react(ui.getEmoji('success') || '✅').catch(() => {});
    } catch (error) {
        logger.error('[MODMAIL ERROR]', error);
        await message.react(ui.getEmoji('error') || '❌').catch(() => {});
    }
    return true;
}

async function initiateNewTicket(message, client) {
    const guildsWithModmail = [];
    for (const [id, guild] of client.guilds.cache) {
        try {
            const member = await guild.members.fetch(message.author.id).catch(() => null);
            if (!member) continue;
            const settings = await cacheManager.getGuildSettings(id);
            if (settings?.settings?.modmail?.enabled && settings?.settings?.modmail?.categoryId) {
                guildsWithModmail.push({
                    id: guild.id,
                    name: guild.name,
                    categoryId: settings.settings.modmail.categoryId
                });
            }
        } catch (e) {
            continue;
        }
    }

    if (guildsWithModmail.length === 0) {
        const errPayload = buildErrorContainerV2({
            title: 'Modmail Tidak Aktif',
            description: `${ui.getEmoji('error') || '❌'} Maaf, saya tidak menemukan server yang mengaktifkan layanan Modmail di mana kamu bergabung.`,
            footerText: ui.getFooter('core')
        });
        await message.reply(errPayload);
        return true;
    }

    if (guildsWithModmail.length === 1) {
        await createTicketChannel(message, guildsWithModmail[0], client);
    } else {
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('mm_select_server')
            .setPlaceholder('Pilih server tujuan bantuan...')
            .addOptions(guildsWithModmail.map(g => ({ label: g.name.substring(0, 100), value: g.id })));
        const row = new ActionRowBuilder().addComponents(selectMenu);
        const payload = buildContainerV2({
            accentColorHex: ui.getColor('primary') || '#FFB6C1',
            title: `${ui.getEmoji('support') || '💬'} Pilihan Server Tujuan`,
            description: `Hai! Kamu terhubung dengan beberapa server yang menyediakan layanan Modmail. Silakan pilih salah satu server tujuan bantuanmu di bawah ini ya! 😊`,
            buttonsRow: row,
            footerText: 'Naura Modmail Support System'
        });

        await message.reply(payload);
    }
    return true;
}

async function createTicketChannel(message, guildData, client) {
    const guild = client.guilds.cache.get(guildData.id);
    if (!guild) return;

    try {
        const settings = await cacheManager.getGuildSettings(guild.id);
        const masterChannel = guild.channels.cache.get(guildData.categoryId) || guild.channels.cache.find(c => c.type === ChannelType.GuildText);

        if (!masterChannel) throw new Error('Master channel untuk modmail tidak ditemukan.');

        let channel;
        if (masterChannel.type === ChannelType.GuildCategory) {
            const overrides = [
                {
                    id: guild.roles.everyone.id,
                    deny: [PermissionFlagsBits.ViewChannel]
                },
                {
                    id: client.user.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels]
                }
            ];

            const staffRoleId = settings?.settings?.modmail?.staffRoleId;
            if (staffRoleId) {
                overrides.push({
                    id: staffRoleId,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
                });
            }

            channel = await guild.channels.create({
                name: `mm-${(message.author || message.user).username.substring(0, 20).toLowerCase()}`,
                type: ChannelType.GuildText,
                parent: masterChannel.id,
                permissionOverwrites: overrides,
                reason: 'Modmail Ticket'
            });
        } else {
            channel = await masterChannel.threads.create({
                name: `mm-${(message.author || message.user).username.substring(0, 20)}`,
                autoArchiveDuration: 10080,
                type: ChannelType.PrivateThread,
                reason: 'Modmail Ticket'
            });
        }

        const authorId = message.author ? message.author.id : message.user.id;

        await ModMail.destroy({
            where: {
                userId: authorId,
                closed: true
            }
        });

        await ModMail.create({ userId: authorId, channelId: channel.id, guildId: guild.id, closed: false });

        const staffRoleId = settings?.settings?.modmail?.staffRoleId;
        const tagContent = staffRoleId ? `<@&${staffRoleId}>` : '@here';

        const welcomePayload = buildContainerV2({
            accentColorHex: '#FFB6C1',
            title: '📩 Tiket Modmail Baru',
            iconURL: message.author ? message.author.displayAvatarURL() : message.user.displayAvatarURL(),
            description: `**Pengguna:** <@${authorId}> (${authorId})\n**Server:** ${guild.name}\n\n**Pesan Awal:**\n${message.content || '_Hanya Memilih Menu/Gambar_'}`,
            footerText: ui.getFooter('core')
        });

        const payload = { content: tagContent, ...welcomePayload };
        const ticketBanner = ui.getBanner('ticket');
        if (ticketBanner) {
            payload.files = [new AttachmentBuilder(ticketBanner, { name: 'banner.png' })];
            payload.bannerAttachmentName = 'banner.png';
        }

        await channel.send(payload);

        const isInteraction = typeof message.editReply === 'function';
        const successPayload = buildContainerV2({
            accentColorHex: ui.getColor('success') || '#22c55e',
            title: 'Tiket Dibuka',
            description: `${ui.getEmoji('success') || '✅'} Tiket telah dibuka di **${guild.name}**. Staf akan segera merespons.`,
            footerText: ui.getFooter('core')
        });

        if (isInteraction) {
            await message.editReply({ ...successPayload, components: [] }).catch(() => {});
        } else if (message.reply) {
            await message.reply(successPayload).catch(() => {});
        }
        if (message.author) await forwardToTicket(message, channel, client);
    } catch (err) {
        logger.error('[MODMAIL ERROR] Channel creation failed:', err);
        const isInteraction = typeof message.editReply === 'function';
        const errPayload = buildErrorContainerV2({
            title: 'Gagal Buat Channel',
            description: `${ui.getEmoji('error') || '❌'} Gagal membuat channel tiket. Pastikan bot memiliki izin yang cukup di server, atau kategori tiket masih valid.`,
            footerText: ui.getFooter('core')
        });

        if (isInteraction) {
            await message.editReply({ ...errPayload, components: [] }).catch(() => {});
        } else if (message.reply) {
            await message.reply(errPayload).catch(() => {});
        }
    }
}

module.exports = { handleModmailDM, createTicketChannel, initiateNewTicket };
