"use strict";

const { MessageFlags } = require("discord.js");
const fs = require("fs");
const path = require("path");
const UserTicket = require("../../models/UserTicket");
const ui = require("../../config/ui");

module.exports = [
  {
    id: "ticket_close",
    label: "ticket-close",
    async handler(interaction) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const channelOrThread = interaction.channel;

      try {
        const ticket = await UserTicket.findOne({
          where: {
            ticketId: channelOrThread.id,
            guildId: interaction.guild.id,
          },
        });

        if (!ticket) {
          return interaction.editReply(
            "❌ Data tiket tidak ditemukan di database.",
          );
        }

        if (ticket.status === "closed") {
          return interaction.editReply("❌ Tiket ini sudah ditutup.");
        }

        const discordTranscripts = require("discord-html-transcripts");

        // Generate Transcript
        const attachment = await discordTranscripts.createTranscript(
          channelOrThread,
          {
            limit: -1,
            returnType: "attachment",
            filename: `transcript-${channelOrThread.id}.html`,
            saveImages: true,
            footerText: "Diekspor oleh Naura Hoshino V2",
            poweredBy: false,
          },
        );

        // Simpan transcript ke local dashboard public folder
        const publicDir = path.join(
          process.cwd(),
          "src",
          "dashboard",
          "public",
          "transcripts",
        );
        if (!fs.existsSync(publicDir)) {
          fs.mkdirSync(publicDir, { recursive: true });
        }

        const transcriptFileName = `transcript-${channelOrThread.id}.html`;
        const transcriptPath = path.join(publicDir, transcriptFileName);

        fs.writeFileSync(transcriptPath, attachment.attachment);

        // Update Database
        ticket.status = "closed";
        ticket.transcriptPath = `/transcripts/${transcriptFileName}`;
        await ticket.save();

        // DM User
        try {
          const user = await interaction.client.users.fetch(ticket.userId);
          if (user) {
            const timeline = ui.ux.buildVisualTimeline({
              steps: [
                { label: "Isi Formulir" },
                { label: "Verifikasi Staff" },
                { label: "Tiket Tuntas" },
              ],
              currentStepIndex: 3,
              user,
              lang: "id",
            });

            await user.send({
              content: `${timeline.timeline}\n*${timeline.message}*\n\nHalo ${user.username}, tiketmu (**${ticket.topic}**) di server **${interaction.guild.name}** telah ditutup. Berikut adalah transkrip percakapan selama tiket berlangsung.\n\nKamu juga bisa melihat riwayat tiketmu melalui Dashboard.`,
              files: [attachment],
            });
          }
        } catch (err) {
          console.error("[TicketClose] Gagal DM user:", err);
        }

        await interaction.editReply(
          "✅ Tiket berhasil ditutup dan transkrip telah dikirim.",
        );

        // Lock dan arsipkan thread atau hapus channel
        await channelOrThread.send(
          `🔒 Tiket ini telah ditutup oleh <@${interaction.user.id}>. ${channelOrThread.isThread() ? "Thread ini akan segera diarsipkan." : "Channel ini akan dihapus."}`,
        );

        setTimeout(async () => {
          try {
            if (channelOrThread.isThread()) {
              await channelOrThread.setLocked(true);
              await channelOrThread.setArchived(true);
            } else {
              await channelOrThread.delete();
            }
          } catch (e) {
            console.error("Gagal menutup/menghapus tiket:", e);
          }
        }, 3000);
      } catch (error) {
        console.error("[TicketClose] Terjadi kesalahan:", error);
        return interaction.editReply(
          "❌ Terjadi kesalahan sistem saat mencoba menutup tiket.",
        );
      }
    },
  },
];
