"use strict";

const { MessageFlags } = require("discord.js");
const { buildContainerV2 } = require("../../utils/NauraContainerBuilder");
const { logger } = require("../../managers/logger");
const ui = require("../../config/ui");

module.exports = [
  {
    id: "modal_report_bug",
    label: "report-bug-modal",
    onError: "Gagal mengirimkan laporan bug.",
    async handler(interaction) {
      const title = interaction.fields.getTextInputValue("bug_title");
      const description = interaction.fields.getTextInputValue("bug_desc");
      const device = interaction.fields.getTextInputValue("bug_device") || "Tidak Disebutkan";

      const reportId = `BUG-${Date.now().toString(36).toUpperCase()}`;
      const userTag = interaction.user.tag || interaction.user.username;

      logger.warn(`[BUG REPORT] [${reportId}] dari ${userTag} (${interaction.user.id}): "${title}" [${device}]`);
      logger.info(`[BUG REPORT DETAIL] ${description}`);

      const successPayload = buildContainerV2({
        accentColorHex: ui.getColor("success") || "#10B981",
        authorName: "Naura Quality Assurance System",
        title: "🛡️ Laporan Bug Berhasil Dikirimkan!",
        description: [
          `Terima kasih Kak **${userTag}** telah membantu menyempurnakan Naura Hoshino!`,
          "",
          `🎫 **Nomor Laporan:** \`${reportId}\``,
          `📌 **Judul Masalah:** *"${title}"*`,
          `📱 **Perangkat:** \`${device}\``,
          "",
          "-# *Laporanmu telah dicatat ke sistem audit pengembang untuk ditinjau lebih lanjut.*",
        ].join("\n"),
        footerText: ui.getFooter("utility"),
      });

      return interaction.reply({
        ...successPayload,
        flags: MessageFlags.Ephemeral,
      });
    },
  },
];
