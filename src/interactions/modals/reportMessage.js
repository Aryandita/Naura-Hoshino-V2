"use strict";

const ui = require("../../config/ui");
const { logger } = require("../../managers/logger");
const {
  buildContainerV2,
} = require("../../utils/NauraContainerBuilder");

module.exports = [
  {
    prefix: "report_msg_",
    label: "report-message-modal-submit",
    defer: "reply",
    isEphemeral: true,
    async handler(interaction) {
      const messageId = interaction.customId.replace("report_msg_", "").trim();
      const reason = interaction.fields.getTextInputValue("report_reason");

      let targetMsg = null;
      if (interaction.channel && typeof interaction.channel.messages?.fetch === "function") {
        targetMsg = await interaction.channel.messages
          .fetch(messageId)
          .catch(() => null);
      }

      const guild = interaction.guild;
      let staffChannel = null;

      if (guild) {
        staffChannel = guild.channels.cache.find(
          (c) =>
            c.isTextBased() &&
            /^(laporan|report|mod-log|staff-log|audit)/i.test(c.name),
        );
      }

      if (staffChannel) {
        const staffPayload = buildContainerV2({
          accentColorHex: ui.getColor("warning") || "#F59E0B",
          title: "🛡️ Laporan Pelanggaran Pesan Baru",
          expression: "warning",
          description: [
            `**Pelapor:** <@${interaction.user.id}> (\`${interaction.user.tag}\`)`,
            `**Channel:** <#${interaction.channelId}>`,
            `**ID Pesan:** \`${messageId}\``,
            targetMsg ? `**Penulis Pesan:** <@${targetMsg.author.id}> (\`${targetMsg.author.tag}\`)` : "",
            targetMsg?.url ? `**Tautan Pesan:** [Lompat ke Pesan](${targetMsg.url})` : "",
            "",
            `📝 **Alasan Pelaporan:**`,
            `> ${reason}`,
            "",
            targetMsg?.content
              ? `💬 **Kutipan Isi Pesan:**\n\`\`\`\n${targetMsg.content.slice(0, 1000)}\n\`\`\``
              : "",
          ].filter(Boolean).join("\n"),
          footerText: ui.getFooter("core"),
        });

        await staffChannel.send(staffPayload).catch((err) => {
          logger.warn(`[ReportMessage] Gagal kirim ke channel staff: ${err.message}`);
        });
      }

      logger.info(
        `[ReportMessage] Pesan ${messageId} dilaporkan oleh ${interaction.user.tag} di guild ${guild?.name || "DM"}: ${reason}`,
      );

      const reporterPayload = buildContainerV2({
        accentColorHex: ui.getColor("success") || "#10B981",
        title: "🛡️ Laporan Berhasil Dikirim!",
        expression: "celebrate",
        description: [
          `Terima kasih telah melaporkan pesan yang melanggar ketentuan.`,
          "",
          `Tim staf dan moderator server telah menerima rincian laporanmu untuk ditindaklanjuti.`,
          `Bantuanmu sangat berharga dalam menjaga kenyamanan dan keamanan komunitas kita! 💖`,
        ].join("\n"),
        footerText: ui.getFooter("core"),
      });

      return interaction.editReply(reporterPayload);
    },
  },
];
