"use strict";

const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require("discord.js");
const { buildContainerV2 } = require("../../src/utils/NauraContainerBuilder");
const ui = require("../../src/config/ui");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Sistem manajemen tiket lanjutan (Naura Ticketing).")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName("setup")
        .setDescription("Kirim panel pembuatan tiket ke channel ini.")
    ),

  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "setup") {
      const btnOpen = new ButtonBuilder()
        .setCustomId("btn_ticket_open")
        .setLabel("Buka Tiket Baru")
        .setEmoji(ui.getEmoji("support") || "📩")
        .setStyle(ButtonStyle.Primary);

      const row = new ActionRowBuilder().addComponents(btnOpen);

      const payload = buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#FFB6C1",
        authorName: "Naura Support Center",
        title: "Pusat Bantuan & Layanan",
        description: `Halo! 👋\nJika kamu membutuhkan bantuan dari staf/moderator, silakan klik tombol di bawah ini.\n\nSatu tiket (berbentuk *Private Thread*) akan dibuatkan secara otomatis dan eksklusif antara kamu dan tim staf kami. Kami akan merespons secepat mungkin!`,
        buttonsRow: row,
        footerText: ui.getFooter("core") || "Naura Governance",
      });

      await interaction.channel.send(payload);
      
      await interaction.reply({
        content: `${ui.getEmoji("success") || "✅"} Panel Tiket berhasil dipasang di channel ini.`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
