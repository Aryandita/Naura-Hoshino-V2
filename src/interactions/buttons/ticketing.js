"use strict";

const { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags } = require("discord.js");
const { buildErrorContainerV2 } = require("../../utils/NauraContainerBuilder");

module.exports = [
  {
    id: "btn_ticket_open",
    label: "ticket-open-modal",
    defer: false, // TIDAK defer karena akan merender Modal
    async handler(interaction) {
      // Cek apakah user sudah punya tiket yang belum ditutup
      const UserTicket = require("../../models/UserTicket");
      const openTickets = await UserTicket.count({
        where: { userId: interaction.user.id, guildId: interaction.guildId, status: "open" },
      });

      if (openTickets >= 3) {
        return interaction.reply({
          embeds: [buildErrorContainerV2({ 
            title: "Batas Maksimal Tiket", 
            description: "Kamu sudah memiliki 3 tiket yang masih terbuka. Harap tunggu hingga staf menutupnya sebelum membuka yang baru." 
          })],
          flags: MessageFlags.Ephemeral,
        });
      }

      // Bangun Modal
      const modal = new ModalBuilder()
        .setCustomId("modal_ticket_open")
        .setTitle("Buat Tiket Bantuan");

      const topicInput = new TextInputBuilder()
        .setCustomId("ticket_topic")
        .setLabel("Topik/Masalah yang ingin dibahas")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Contoh: Saya ingin melaporkan bug pada fitur X...")
        .setMinLength(10)
        .setMaxLength(1000)
        .setRequired(true);

      const actionRow = new ActionRowBuilder().addComponents(topicInput);
      modal.addComponents(actionRow);

      await interaction.showModal(modal);
    },
  },
  {
    id: "btn_ticket_close",
    label: "ticket-close",
    defer: "reply",
    async handler(interaction, client) {
      // Hanya biarkan staf yang bisa mematikan tiket, atau pemilik tiket.
      // Untuk memastikannya, panggil helper dari ticketManager
      const { closeTicket } = require("../../managers/ticketManager");
      await closeTicket(interaction, client);
    },
  }
];
