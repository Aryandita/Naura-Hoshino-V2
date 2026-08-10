const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { buildContainerV2 } = require('../../src/utils/NauraContainerBuilder');
const ui = require('../../src/config/ui');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Sistem ticketing untuk menghubungi admin')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(subcommand =>
            subcommand
                .setName('setup')
                .setDescription('Pasang panel tiket di channel ini')
        ),

    async execute(interaction) {
        if (interaction.options.getSubcommand() === 'setup') {
            await interaction.deferReply({ ephemeral: true });

            const channel = interaction.channel;
            
            // Build the ticket panel container
            const container = buildContainerV2({
                title: '🎫 Layanan Bantuan & Tiket',
                description: 'Ada masalah, pertanyaan, atau ingin melaporkan sesuatu? Klik tombol di bawah ini untuk membuka tiket baru.\n\nAdmin akan segera membantumu di jalur pribadi (Thread).',
                color: '#93C5FD',
                footerText: ui.getFooter('core'),
                buttonsRow: [
                    {
                        customId: 'ticket_open',
                        label: 'Buka Tiket',
                        style: 1, // Primary (Blurple)
                        emoji: '📩'
                    }
                ]
            });

            await channel.send(container);
            await interaction.editReply('✅ Panel tiket berhasil dipasang di channel ini.');
        }
    }
};
