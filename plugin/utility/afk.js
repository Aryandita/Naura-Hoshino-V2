const { SlashCommandBuilder } = require("discord.js");
const ui = require("../../src/config/ui");
const { buildContainerV2 } = require("../../src/utils/NauraContainerBuilder");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("afk")
    .setDescription("💤 Tinggalkan pesan saat kamu pergi.")
    .addStringOption((opt) =>
      opt.setName("alasan").setDescription("Kenapa kamu pergi?"),
    )
    .addBooleanOption((opt) =>
      opt
        .setName("senyap")
        .setDescription("Matikan notifikasi (Daily, dll) selama AFK?"),
    ),

  async execute(interaction) {
    const alasan =
      interaction.options.getString("alasan") || "Sedang istirahat sebentar.";
    const modeSenyap = interaction.options.getBoolean("senyap") || false;

    const cacheManager = require("../../src/managers/cacheManager");

    const updates = {
      afk_reason: alasan,
      afk_timestamp: new Date(),
      afk_mentions: [],
    };
    if (modeSenyap) {
      updates.dailyNotify = false;
    }

    await cacheManager.updateUserProfile(interaction.user.id, updates);

    try {
      await interaction.member.setNickname(
        `[AFK] ${interaction.member.displayName}`,
      );
    } catch (e) {}

    const payload = buildContainerV2({
      accentColorHex: ui.getColor("primary") || "#38BDF8",
      authorName: `${interaction.user.username} Menandai Status AFK`,
      iconURL: interaction.user.displayAvatarURL(),
      title: "Mode AFK Diaktifkan",
      description:
        `Statusmu telah dialihkan ke mode tidak aktif. Naura akan mencatat orang yang menyebut tokomu dan menyambutmu kembali saat kamu mengirim pesan.\n\n` +
        `• **Keterangan:** ${alasan}\n` +
        `• **Notifikasi Rutin:** ${modeSenyap ? "Dinonaktifkan Sementara" : "Tetap Berjalan"}\n` +
        `• **Waktu Mulai:** <t:${Math.floor(Date.now() / 1000)}:T>`,
      footerText: "Naura Auto-Responder System",
    });

    await interaction.reply(payload);
  },
};
