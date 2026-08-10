'use strict';

const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags } = require('discord.js');
const ui = require('../../config/ui');

module.exports = {
    async execute(interaction, customId) {
        if (customId !== 'ticket_open') return false;

        const modal = new ModalBuilder()
            .setCustomId('ticket_submit')
            .setTitle('Buka Tiket Baru');

        const topicInput = new TextInputBuilder()
            .setCustomId('ticket_topic')
            .setLabel('Topik / Ringkasan Masalah')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Contoh: Lapor Bug, Pertanyaan VIP')
            .setRequired(true)
            .setMaxLength(100);

        const detailInput = new TextInputBuilder()
            .setCustomId('ticket_detail')
            .setLabel('Penjelasan Detail')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Ceritakan lebih lengkap masalah yang kamu alami...')
            .setRequired(true)
            .setMaxLength(2000);

        const firstActionRow = new ActionRowBuilder().addComponents(topicInput);
        const secondActionRow = new ActionRowBuilder().addComponents(detailInput);

        modal.addComponents(firstActionRow, secondActionRow);

        try {
            await interaction.showModal(modal);
        } catch (error) {
            console.error('[TicketOpen] Gagal menampilkan modal:', error);
            await interaction.reply({
                content: `${ui.emojis?.error || '❌'} Terjadi kesalahan saat mencoba membuka formulir tiket.`,
                flags: MessageFlags.Ephemeral
            });
        }
        
        return true;
    }
};
