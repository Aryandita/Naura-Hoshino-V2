'use strict';

const { MessageFlags, AttachmentBuilder } = require('discord.js');
const discordTranscripts = require('discord-html-transcripts');
const fs = require('fs');
const path = require('path');
const UserTicket = require('../../models/UserTicket');
const ui = require('../../config/ui');

module.exports = {
    async execute(interaction, customId) {
        if (customId !== 'ticket_close') return false;

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const thread = interaction.channel;
        if (!thread.isThread()) {
            return interaction.editReply('❌ Tombol ini hanya bisa digunakan di dalam Thread tiket.');
        }

        try {
            const ticket = await UserTicket.findOne({
                where: { ticketId: thread.id, guildId: interaction.guild.id }
            });

            if (!ticket) {
                return interaction.editReply('❌ Data tiket tidak ditemukan di database.');
            }

            if (ticket.status === 'closed') {
                return interaction.editReply('❌ Tiket ini sudah ditutup.');
            }

            // Generate Transcript
            const attachment = await discordTranscripts.createTranscript(thread, {
                limit: -1,
                returnType: 'attachment',
                filename: `transcript-${thread.id}.html`,
                saveImages: true,
                footerText: "Diekspor oleh Naura Hoshino V2",
                poweredBy: false
            });
            
            // Simpan transcript ke local dashboard public folder
            const publicDir = path.join(process.cwd(), 'src', 'dashboard', 'public', 'transcripts');
            if (!fs.existsSync(publicDir)) {
                fs.mkdirSync(publicDir, { recursive: true });
            }
            
            const transcriptFileName = `transcript-${thread.id}.html`;
            const transcriptPath = path.join(publicDir, transcriptFileName);
            
            fs.writeFileSync(transcriptPath, attachment.attachment);

            // Update Database
            ticket.status = 'closed';
            ticket.transcriptPath = `/transcripts/${transcriptFileName}`;
            await ticket.save();

            // DM User
            try {
                const user = await interaction.client.users.fetch(ticket.userId);
                if (user) {
                    await user.send({
                        content: `Halo ${user.username}, tiketmu (**${ticket.topic}**) di server **${interaction.guild.name}** telah ditutup. Berikut adalah transkrip percakapan selama tiket berlangsung.\n\nKamu juga bisa melihat riwayat tiketmu melalui Dashboard.`,
                        files: [attachment]
                    });
                }
            } catch (err) {
                console.error('[TicketClose] Gagal DM user:', err);
                // Lanjut saja meski gagal DM
            }

            await interaction.editReply('✅ Tiket berhasil ditutup dan transkrip telah dikirim.');
            
            // Lock dan arsipkan thread
            await thread.send(`🔒 Tiket ini telah ditutup oleh <@${interaction.user.id}>. Thread ini akan segera diarsipkan.`);
            setTimeout(async () => {
                try {
                    await thread.setLocked(true);
                    await thread.setArchived(true);
                } catch (e) {
                    console.error('Gagal mengarsipkan thread:', e);
                }
            }, 3000);

        } catch (error) {
            console.error('[TicketClose] Terjadi kesalahan:', error);
            await interaction.editReply('❌ Terjadi kesalahan sistem saat mencoba menutup tiket.');
        }

        return true;
    }
};
