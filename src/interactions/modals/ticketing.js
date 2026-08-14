"use strict";

const { ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require("discord.js");
const { buildContainerV2, buildErrorContainerV2 } = require("../../utils/NauraContainerBuilder");
const UserTicket = require("../../models/UserTicket");
const ui = require("../../config/ui");

module.exports = [
  {
    id: "modal_ticket_open",
    label: "ticket-create",
    defer: "reply",
    async handler(interaction, client) {
      const topic = interaction.fields.getTextInputValue("ticket_topic");

      try {
        const channel = interaction.channel;
        
        // Buat private thread
        const thread = await channel.threads.create({
          name: `ticket-${interaction.user.username.substring(0, 10)}`,
          autoArchiveDuration: 10080,
          type: ChannelType.PrivateThread,
          reason: "Naura Ticketing System",
        });

        // Tambahkan user ke dalam thread
        await thread.members.add(interaction.user.id);

        // Rekam ke Database
        await UserTicket.create({
          userId: interaction.user.id,
          guildId: interaction.guildId,
          ticketId: thread.id,
          topic: topic,
          status: "open",
        });

        // Bangun Embed di dalam tiket
        const btnClose = new ButtonBuilder()
          .setCustomId("btn_ticket_close")
          .setLabel("Tutup Tiket")
          .setEmoji(ui.getEmoji("lock") || "🔒")
          .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(btnClose);

        const payload = buildContainerV2({
          accentColorHex: ui.getColor("primary") || "#FFB6C1",
          authorName: `Tiket Baru: ${interaction.user.tag}`,
          iconURL: interaction.user.displayAvatarURL(),
          title: "Silakan Jelaskan Masalahmu",
          description: `Topik: **${topic}**\n\nHalo <@${interaction.user.id}>! Tim staf kami akan segera membantu. Silakan berikan konteks tambahan atau lampiran gambar (jika ada).`,
          buttonsRow: row,
          footerText: "Tiket dijamin kerahasiaannya",
        });

        await thread.send({ content: `<@${interaction.user.id}>`, ...payload });

        // Beri respons ke user di channel publik
        await interaction.followUp({
          content: `${ui.getEmoji("success") || "✅"} Tiketmu berhasil dibuat! Silakan menuju ke ${thread}.`,
          flags: MessageFlags.Ephemeral,
        });

      } catch (error) {
        require("../../managers/logger").logger.error("[TICKETING] Gagal membuat tiket:", error);
        await interaction.followUp({
          embeds: [buildErrorContainerV2({ title: "Gagal Membuat Tiket", description: "Terjadi kesalahan saat memproses permintaanmu." })],
          flags: MessageFlags.Ephemeral,
        });
      }
    },
  },
];
