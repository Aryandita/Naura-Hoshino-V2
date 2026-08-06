'use strict';

const { EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const ModMail = require('../../models/ModMail');
const cacheManager = require('../../managers/cacheManager');
const ui = require('../../config/ui');

module.exports = [
    {
        id: 'ticket_open',
        label: 'tiket-buka',
        // Membuat channel butuh beberapa panggilan API; defer lebih dulu supaya
        // tidak menabrak batas tiga detik.
        defer: 'reply',
        onError: 'Terjadi kesalahan saat membuat tiket.',
        async handler(interaction, client) {
            const { createTicketChannel } = require('../../../plugin/modmail/modmailHelper');
            const guildData = await cacheManager.getGuildSettings(interaction.guild.id);

            if (!guildData?.settings?.modmail?.categoryId) {
                return ui.sendError(interaction, 'err_sys_72', true);
            }

            return createTicketChannel(
                interaction,
                { id: interaction.guild.id, categoryId: guildData.settings.modmail.categoryId },
                client
            );
        }
    },

    {
        id: 'mm_close',
        label: 'tiket-tutup',
        onError: 'Terjadi kesalahan saat menutup tiket.',
        async handler(interaction, client) {
            const ticket = await ModMail.findOne({
                where: { channelId: interaction.channelId, closed: false }
            });
            if (!ticket) return ui.sendError(interaction, 'err_sys_73', true);

            ticket.closed = true;
            await ticket.save();

            const logEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setDescription('\ud83d\udd12 Tiket ini ditutup oleh Staf.');
            await interaction.channel.send({ embeds: [logEmbed] });

            const user = await client.users.fetch(ticket.userId).catch(() => null);
            if (user) {
                const notifyEmbed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setDescription(`\ud83d\udd12 Tiket bantuanmu dengan **${interaction.guild.name}** telah ditutup.`)
                    .setTimestamp();
                user.send({ embeds: [notifyEmbed] }).catch(() => {});
            }

            await interaction.reply('\u23f3 Channel ini akan dihapus dalam 5 detik...');
            setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
            return undefined;
        }
    },

    {
        id: 'mm_reply',
        label: 'tiket-balas',
        handler: (interaction) => showReplyModal(interaction, false)
    },

    {
        id: 'mm_reply_anon',
        label: 'tiket-balas-anonim',
        handler: (interaction) => showReplyModal(interaction, true)
    }
];

function showReplyModal(interaction, anonymous) {
    const modal = new ModalBuilder()
        .setCustomId(anonymous ? 'mm_modal_anon' : 'mm_modal_reply')
        .setTitle(anonymous ? '\ud83d\udd75\ufe0f Balas Anonim' : '\ud83d\udcac Balas Tiket');

    const input = new TextInputBuilder()
        .setCustomId('mm_text_input')
        .setLabel('Tulis balasanmu:')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal);
}
