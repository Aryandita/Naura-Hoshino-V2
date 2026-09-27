"use strict";

const { MessageFlags } = require("discord.js");
const reportService = require("../../services/reportService");
const env = require("../../config/env");

function isOwner(userId) {
  return Array.isArray(env.OWNER_IDS) && env.OWNER_IDS.includes(userId);
}

module.exports = [
  {
    prefix: "modal_owner_reply_",
    label: "owner-reply-report-modal",
    onError: "Gagal mengirimkan balasan ke pelapor.",
    async handler(interaction, client) {
      if (!isOwner(interaction.user.id)) {
        return interaction.reply({
          content: "⛔ Hanya pengembang atau owner bot yang dapat membalas laporan pengguna.",
          flags: MessageFlags.Ephemeral,
        });
      }

      const reportId = interaction.customId.replace("modal_owner_reply_", "").trim();
      const replyText = interaction.fields.getTextInputValue("reply_content");
      const repliedBy = interaction.user.globalName || interaction.user.username;

      const result = await reportService.replyToReport(
        reportId,
        replyText,
        repliedBy,
        client || interaction.client,
      );

      if (result.deliveredToUser) {
        return interaction.reply({
          content: `✅ Balasanmu untuk laporan **\`#${reportId}\`** berhasil dikirimkan langsung ke DM Kak **${result.report.userName}**!`,
          flags: MessageFlags.Ephemeral,
        });
      }

      return interaction.reply({
        content: `⚠️ Balasanmu telah disimpan pada tiket **\`#${reportId}\`**, namun DM pengguna (${result.report.userName}) tampaknya tertutup sehingga pesan langsung tidak terkirim. Pengguna tetap dapat melihatnya lewat \`/report status_id:${reportId}\`.`,
        flags: MessageFlags.Ephemeral,
      });
    },
  },
];
