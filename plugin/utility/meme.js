const { SlashCommandBuilder } = require("discord.js");
const { logger } = require("../../src/managers/logger");
const ui = require("../../src/config/ui");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../src/utils/NauraContainerBuilder");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("meme")
    .setDescription("😂 Ambil meme acak dari internet."),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const response = await fetch("https://meme-api.com/gimme");
      const data = await response.json();

      if (!data || data.nsfw) {
        const errPayload = buildErrorContainerV2({
          title: "Meme Tidak Ditemukan",
          description: "Gagal mendapatkan meme yang aman. Silakan coba lagi.",
          footerText: ui.getFooter("utility"),
        });
        return interaction.editReply(errPayload);
      }

      const payload = buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#ff9ff3",
        authorName: `r/${data.subreddit}`,
        title: `😂 ${data.title}`,
        description: `🔗 [Lihat Post Asli di Reddit](${data.postLink})`,
        mediaAttachmentNames: [data.url],
        footerText: `👍 ${data.ups} | ${ui.getFooter("utility")}`,
      });

      await interaction.editReply(payload);
    } catch (error) {
      logger.error("[Meme Error]", error);
      const errPayload = buildErrorContainerV2({
        title: "Gagal Mengambil Meme",
        description: "Terjadi kesalahan saat mengambil meme dari Reddit.",
        footerText: ui.getFooter("utility"),
      });
      await interaction.editReply(errPayload);
    }
  },
};
