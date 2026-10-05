"use strict";

const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");
const reportService = require("../../services/reportService");
const env = require("../../config/env");

function isOwner(userId) {
  return Array.isArray(env.OWNER_IDS) && env.OWNER_IDS.includes(userId);
}

module.exports = [
  {
    prefix: "report_reply_",
    label: "owner-reply-report-btn",
    onError: "Gagal membuka form balasan laporan.",
    async handler(interaction) {
      if (!isOwner(interaction.user.id)) {
        return interaction.reply({
          content: "⛔ Hanya pengembang atau owner bot yang dapat membalas laporan pengguna.",
          flags: MessageFlags.Ephemeral,
        });
      }

      const reportId = interaction.customId.replace("report_reply_", "").trim();
      const report = await reportService.getReport(reportId);

      const modal = new ModalBuilder()
        .setCustomId(`modal_owner_reply_${reportId}`)
        .setTitle(`Balas Laporan #${reportId}`.substring(0, 45));

      const replyInput = new TextInputBuilder()
        .setCustomId("reply_content")
        .setLabel(`Balasan untuk ${report?.userName || "Pelapor"}`.substring(0, 45))
        .setPlaceholder("Tulis penjelasan, status perbaikan, atau ucapan terima kasih di sini...")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1000);

      modal.addComponents(new ActionRowBuilder().addComponents(replyInput));

      return interaction.showModal(modal);
    },
  },
  {
    prefix: "report_resolve_",
    label: "owner-resolve-report-btn",
    onError: "Gagal memperbarui status laporan.",
    async handler(interaction) {
      if (!isOwner(interaction.user.id)) {
        return interaction.reply({
          content: "⛔ Hanya pengembang atau owner bot yang dapat menyelesaikan laporan.",
          flags: MessageFlags.Ephemeral,
        });
      }

      const reportId = interaction.customId.replace("report_resolve_", "").trim();
      const resolvedBy = interaction.user.globalName || interaction.user.username;
      const updated = await reportService.resolveReport(reportId, resolvedBy);

      if (!updated) {
        return interaction.reply({
          content: `⚠️ Laporan dengan ID #${reportId} tidak ditemukan.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      // Nonaktifkan tombol pada pesan DM owner
      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`resolved_btn_${reportId}`)
          .setLabel(`Selesai oleh ${resolvedBy}`)
          .setEmoji("✅")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
      );

      const msgComponents = interaction.message.components;
      let nextComponents = [disabledRow];

      if (msgComponents && msgComponents.length > 0) {
        const firstComp = msgComponents[0].toJSON ? msgComponents[0].toJSON() : msgComponents[0];
        if (firstComp.type === 17 && Array.isArray(firstComp.components)) {
          const innerComps = [...firstComp.components];
          const actionRowIdx = innerComps.findIndex((c) => c.type === 1);
          if (actionRowIdx !== -1) {
            innerComps[actionRowIdx] = disabledRow.toJSON();
          } else {
            innerComps.push(disabledRow.toJSON());
          }
          nextComponents = [{ ...firstComp, components: innerComps }];
        }
      }

      return interaction.update({
        components: nextComponents,
      });
    },
  },
];
