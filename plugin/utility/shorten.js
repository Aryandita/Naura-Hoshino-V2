const { SlashCommandBuilder } = require("discord.js");
const { logger } = require("../../src/managers/logger");
const ui = require("../../src/config/ui");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../src/utils/NauraContainerBuilder");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("shorten")
    .setDescription("🔗 Pendekkan URL yang panjang (Powered by is.gd).")
    .addStringOption((opt) =>
      opt
        .setName("url")
        .setDescription(
          "URL panjang yang ingin dipendekkan (harus diawali http/https)",
        )
        .setRequired(true),
    ),

  async execute(interaction) {
    await interaction.deferReply();
    const url = interaction.options.getString("url");

    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      const errPayload = buildErrorContainerV2({
        title: "URL Tidak Valid",
        description: "URL harus diawali dengan `http://` atau `https://`",
        footerText: ui.getFooter("utility"),
      });
      return interaction.editReply(errPayload);
    }

    try {
      const response = await fetch(
        `https://is.gd/create.php?format=json&url=${encodeURIComponent(url)}`,
      );
      const data = await response.json();

      if (data.errorcode) {
        const errPayload = buildErrorContainerV2({
          title: "Gagal Memendekkan URL",
          description:
            data.errormessage || "Terjadi kesalahan saat memendekkan URL.",
          footerText: ui.getFooter("utility"),
        });
        return interaction.editReply(errPayload);
      }

      const payload = buildContainerV2({
        accentColorHex: ui.getColor("success") || "#00FF00",
        title: "🔗 URL Berhasil Dipendekkan",
        fields: [
          { name: "URL Asli", value: url },
          { name: "URL Pendek", value: data.shorturl },
        ],
        footerText: ui.getFooter("utility"),
      });

      await interaction.editReply(payload);
    } catch (error) {
      logger.error("[Shorten Error]", error);
      const errPayload = buildErrorContainerV2({
        title: "Terjadi Kesalahan",
        description:
          "Terjadi kesalahan internal saat menghubungi layanan pemendek URL.",
        footerText: ui.getFooter("utility"),
      });
      await interaction.editReply(errPayload);
    }
  },
};
