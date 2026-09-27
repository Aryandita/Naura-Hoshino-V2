"use strict";

const {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  MessageFlags,
} = require("discord.js");
const { buildContainerV2 } = require("../../src/utils/NauraContainerBuilder");
const reportService = require("../../src/services/reportService");
const ui = require("../../src/config/ui");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("report")
    .setDescription("📝 Kirim laporan kendala, bug, atau keluhan langsung ke DM pengembang bot")
    .addAttachmentOption((opt) =>
      opt
        .setName("lampiran")
        .setDescription("Tangkapan layar atau foto bukti kendala (opsional)")
        .setRequired(false),
    )
    .addStringOption((opt) =>
      opt
        .setName("status_id")
        .setDescription("Cek status laporan yang pernah kamu kirim (contoh: REP-7K9A)")
        .setRequired(false),
    ),

  async execute(interaction) {
    const statusId = interaction.options.getString("status_id");

    // Jika user ingin mengecek status laporan yang pernah dikirim
    if (statusId) {
      const report = await reportService.getReport(statusId);

      if (!report) {
        return interaction.reply({
          ...buildContainerV2({
            accentColorHex: ui.getColor("warning") || "#F59E0B",
            authorName: "Naura Help Desk",
            title: "🔍 Laporan Tidak Ditemukan",
            description: [
              `Tidak ditemukan laporan dengan kode tiket **\`#${statusId.toUpperCase()}\`**.`,
              "",
              "-# *Pastikan kamu memasukkan kode ID laporan dengan benar (contoh: `REP-7K9A`).*",
            ].join("\n"),
            footerText: ui.getFooter("utility"),
          }),
          flags: MessageFlags.Ephemeral,
        });
      }

      const statusBadges = {
        PENDING: "🟡 Menunggu Tinjauan Pengembang",
        INVESTIGATING: "🔵 Sedang Ditindaklanjuti",
        RESOLVED: "🟢 Selesai / Ditangani",
      };

      const statusText = statusBadges[report.status] || "⚪ Dalam Antrean";

      return interaction.reply({
        ...buildContainerV2({
          accentColorHex:
            report.status === "RESOLVED"
              ? ui.getColor("success") || "#10B981"
              : report.status === "INVESTIGATING"
                ? ui.getColor("info") || "#3B82F6"
                : ui.getColor("warning") || "#F59E0B",
          authorName: "Status Tiket Laporan",
          title: `🎫 Tiket #${report.reportId}: ${report.title}`,
          description: [
            `Berikut status terkini untuk laporan yang kamu kirimkan:`,
            "",
            `📊 **Status:** ${statusText}`,
            `👤 **Pelapor:** **${report.userName}**`,
            `🕒 **Dikirim Pada:** <t:${Math.floor(new Date(report.createdAt).getTime() / 1000)}:R>`,
            "",
            `📌 **Judul:**`,
            `> ${report.title}`,
            "",
            `📝 **Keluhan:**`,
            `> ${report.description}`,
            report.ownerReply
              ? [
                  "",
                  `💬 **Balasan dari Pengembang (${report.repliedBy || "Owner"}):**`,
                  `> ${report.ownerReply}`,
                  report.repliedAt
                    ? `-# *Dibalas <t:${Math.floor(new Date(report.repliedAt).getTime() / 1000)}:R>*`
                    : "",
                ].join("\n")
              : "",
            "",
            "-# *Gunakan `/report` jika kamu ingin mengirimkan laporan atau kendala baru.*",
          ].filter(Boolean).join("\n"),
          footerText: ui.getFooter("utility"),
        }),
        flags: MessageFlags.Ephemeral,
      });
    }

    // Jika user mengunggah file attachment, simpan sementara ke memory cache
    const attachment = interaction.options.getAttachment("lampiran");
    if (attachment) {
      reportService.saveTempAttachment(interaction.user.id, attachment);
    }

    // Buka Discord Modal untuk input form laporan
    const modal = new ModalBuilder()
      .setCustomId("modal_user_report")
      .setTitle("Form Laporan ke Pengembang");

    const titleInput = new TextInputBuilder()
      .setCustomId("report_title")
      .setLabel("Judul Ringkas Kendala")
      .setPlaceholder("Contoh: Fitur lelang macet saat malam hari")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(100);

    const defaultUsername = interaction.user.globalName || interaction.user.username;
    const usernameInput = new TextInputBuilder()
      .setCustomId("report_username")
      .setLabel("Nama Pengguna Kamu")
      .setValue(defaultUsername.substring(0, 32))
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(50);

    const descInput = new TextInputBuilder()
      .setCustomId("report_desc")
      .setLabel("Deskripsi Lengkap Kendala")
      .setPlaceholder("Jelaskan apa yang terjadi dan langkah-langkah saat masalah muncul...")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(1000);

    const linkInput = new TextInputBuilder()
      .setCustomId("report_link")
      .setLabel("Link Foto Tambahan (Opsional)")
      .setPlaceholder("https://... (jika ada screenshot lain)")
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(200);

    modal.addComponents(
      new ActionRowBuilder().addComponents(titleInput),
      new ActionRowBuilder().addComponents(usernameInput),
      new ActionRowBuilder().addComponents(descInput),
      new ActionRowBuilder().addComponents(linkInput),
    );

    return interaction.showModal(modal);
  },
};
