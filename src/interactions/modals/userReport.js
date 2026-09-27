"use strict";

const { MessageFlags } = require("discord.js");
const { buildContainerV2 } = require("../../utils/NauraContainerBuilder");
const reportService = require("../../services/reportService");
const ui = require("../../config/ui");

module.exports = [
  {
    id: "modal_user_report",
    label: "user-report-modal",
    onError: "Gagal mengirimkan laporan ke pengembang. Coba lagi beberapa saat lagi ya!",
    async handler(interaction, client) {
      const title = interaction.fields.getTextInputValue("report_title");
      const userName = interaction.fields.getTextInputValue("report_username");
      const description = interaction.fields.getTextInputValue("report_desc");
      const link = interaction.fields.getTextInputValue("report_link");

      // Cek apakah ada file lampiran yang sempat diunggah di slash command
      const cachedAttachment = reportService.getTempAttachment(interaction.user.id);
      let finalAttachmentUrl = null;

      if (cachedAttachment && cachedAttachment.url) {
        finalAttachmentUrl = cachedAttachment.url;
      } else if (link && /^https?:\/\//i.test(link.trim())) {
        finalAttachmentUrl = link.trim();
      }

      // Buat laporan dan teruskan ke DM Owner
      const result = await reportService.createReport({
        userId: interaction.user.id,
        userName,
        guildId: interaction.guildId,
        guildName: interaction.guild?.name,
        title,
        description,
        attachmentUrl: finalAttachmentUrl,
        client: client || interaction.client,
      });

      const responsePayload = buildContainerV2({
        accentColorHex: ui.getColor("success") || "#10B981",
        authorName: "Naura Help Desk",
        title: "💌 Laporanmu Berhasil Dikirimkan!",
        description: [
          `Terima kasih banyak, Kak **${userName}**!`,
          "",
          `Laporanmu sudah kuteruskan langsung ke DM pengembang bot agar segera dicek.`,
          "",
          `🎫 **Kode Tiket:** \`#${result.reportId}\``,
          `📌 **Judul Masalah:** *"${title}"*`,
          finalAttachmentUrl ? `📎 **Bukti Foto:** [Telah Dilampirkan](${finalAttachmentUrl})` : "",
          "",
          "-# *Kamu bisa mengecek status tindak lanjut laporanmu kapan saja dengan perintah:*",
          `-# \`/report status_id:${result.reportId}\``,
        ].filter(Boolean).join("\n"),
        footerText: ui.getFooter("utility"),
      });

      return interaction.reply({
        ...responsePayload,
        flags: MessageFlags.Ephemeral,
      });
    },
  },
];
