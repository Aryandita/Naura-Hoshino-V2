const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = [
    {
        id: 'master_setup_menu',
        label: 'master-setup',
        async handler(interaction) {
            const selected = interaction.values[0];

            if (selected === 'setup_ticket') {
                const modal = new ModalBuilder()
                    .setCustomId('modal_setup_ticket')
                    .setTitle('🎫 Setup Sistem Tiket');

                const categoryInput = new TextInputBuilder()
                    .setCustomId('ticket_category')
                    .setLabel('ID Kategori Tiket')
                    .setPlaceholder('Masukkan ID Kategori untuk tiket baru')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const logInput = new TextInputBuilder()
                    .setCustomId('ticket_log')
                    .setLabel('ID Channel Log (Opsional)')
                    .setPlaceholder('Tempat transkrip dikirim (ID Channel)')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false);

                const panelInput = new TextInputBuilder()
                    .setCustomId('ticket_panel')
                    .setLabel('ID Channel Panel (Opsional)')
                    .setPlaceholder('Tempat tombol Buka Tiket dimunculkan')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(categoryInput),
                    new ActionRowBuilder().addComponents(logInput),
                    new ActionRowBuilder().addComponents(panelInput)
                );

                return interaction.showModal(modal);
            }

            // Fallback for other modules not yet implemented via modal
            return interaction.reply({ 
                content: 'Modul ini belum sepenuhnya interaktif via Modal. Silakan gunakan slash command `/setup` secara manual untuk fitur ini.',
                ephemeral: true 
            });
        }
    }
];
