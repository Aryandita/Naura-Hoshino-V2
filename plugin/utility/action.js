const { SlashCommandBuilder } = require("discord.js");
const { logger } = require("../../src/managers/logger");
const ui = require("../../src/config/ui");
const { buildContainerV2 } = require("../../src/utils/NauraContainerBuilder");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("action")
    .setDescription("🎭 Lakukan aksi interaktif dengan member lain (Roleplay).")
    .addStringOption((opt) =>
      opt
        .setName("tipe")
        .setDescription("Jenis aksi")
        .setRequired(true)
        .addChoices(
          { name: "Peluk (Hug)", value: "hug" },
          { name: "Tampar (Slap)", value: "slap" },
          { name: "Elus (Pat)", value: "pat" },
          { name: "Cium (Kiss)", value: "kiss" },
          { name: "Tonjok (Punch)", value: "punch" },
        ),
    )
    .addUserOption((opt) =>
      opt.setName("user").setDescription("Target aksi").setRequired(true),
    ),

  async execute(interaction) {
    await interaction.deferReply();
    const actionType = interaction.options.getString("tipe");
    const target = interaction.options.getUser("user");

    if (target.id === interaction.user.id) {
      return interaction.editReply(
        `${ui.getEmoji("cross") || "❌"} Kamu tidak bisa melakukan aksi ini ke dirimu sendiri!`,
      );
    }

    try {
      const response = await fetch(
        `https://nekos.life/api/v2/img/${actionType}`,
      );
      const data = await response.json();

      let actionText = "";
      switch (actionType) {
        case "hug":
          actionText = "memeluk";
          break;
        case "slap":
          actionText = "menampar";
          break;
        case "pat":
          actionText = "mengelus";
          break;
        case "kiss":
          actionText = "mencium";
          break;
        case "punch":
          actionText = "menonjok";
          break;
      }

      const payload = buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#ff9ff3",
        title: "🎭 Anime Roleplay",
        description: `**${interaction.user.username}** ${actionText} **${target.username}**!`,
        bannerAttachmentName: data?.url,
        footerText: ui.getFooter("core"),
      });

      await interaction.editReply(payload);
    } catch (error) {
      logger.error("[Action Error]", error);
      await interaction.editReply(
        `${ui.getEmoji("cross") || "❌"} Gagal memuat aksi. Coba lagi nanti.`,
      );
    }
  },
};
