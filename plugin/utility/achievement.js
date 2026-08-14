const { SlashCommandBuilder } = require("discord.js");
const ui = require("../../src/config/ui");
const { buildContainerV2 } = require("../../src/utils/NauraContainerBuilder");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("achievement")
    .setDescription("🏆 Buat pop-up pencapaian ala Minecraft.")
    .addStringOption((opt) =>
      opt
        .setName("teks")
        .setDescription("Teks pencapaian (maks 25 karakter)")
        .setRequired(true),
    )
    .addIntegerOption((opt) =>
      opt
        .setName("icon")
        .setDescription("Pilih ID icon (1-39)")
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(39),
    ),

  async execute(interaction) {
    let text = interaction.options.getString("teks");
    let icon =
      interaction.options.getInteger("icon") ||
      Math.floor(Math.random() * 39) + 1;

    if (text.length > 25) {
      text = text.substring(0, 25);
    }

    const url = `https://minecraftskinstealer.com/achievement/${icon}/Achievement+Get%21/${encodeURIComponent(text)}`;

    const payload = buildContainerV2({
      accentColorHex: ui.getColor("success") || "#22c55e",
      title: "🏆 Minecraft Achievement",
      footerText: `Pencapaian dibuka oleh ${interaction.user.username}`,
    });

    await interaction.reply({ ...payload, embeds: [] });
  },
};
