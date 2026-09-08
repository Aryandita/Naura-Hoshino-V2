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
      accentColorHex: ui.getColor("primary") || "#FFB6C1",
      authorName: `${interaction.user.username} sedang AFK`,
      iconURL: interaction.user.displayAvatarURL(),
      description: `${ui.getEmoji("zzz") || "💤"} **Sistem AFK Diaktifkan!**\nNaura akan menjaga notifikasimu saat kamu sedang tidak ada di sekitar.\n\n> ${ui.getEmoji("memo") || "📝"} **Pesan / Alasan:** *${alasan}*\n> ${ui.getEmoji("no_bell") || "🔕"} **Mode Senyap:** *${modeSenyap ? "Aktif" : "Tidak Aktif"}*`,
      footerText: "Naura Auto-Responder System",
    });

    await interaction.reply(payload);
  },
};
