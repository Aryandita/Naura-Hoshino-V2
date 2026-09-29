const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { logger } = require("../../src/managers/logger");
const ui = require("../../src/config/ui");
const LanguageManager = require("../../src/managers/languageManager");
const { buildContainerV2 } = require("../../src/utils/NauraContainerBuilder");

module.exports = {
  isSubcommand: true,
  data: new SlashCommandBuilder()
    .setName("lang")
    .setDescription("Ubah bahasa bot / Change bot language")
    .addStringOption((option) =>
      option
        .setName("bahasa")
        .setDescription("Pilih bahasa / Select language")
        .setRequired(true)
        .addChoices(
          { name: "🇮🇩 Indonesia", value: "id" },
          { name: "🇬🇧 English", value: "en" },
        ),
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const selectedLang = interaction.options.getString("bahasa");

    try {
      const cacheManager = require("../../src/managers/cacheManager");
      await cacheManager.updateUserProfile(interaction.user.id, {
        language: selectedLang,
      });

      const translatedMsg = await LanguageManager.translate(
        interaction.user.id,
        "lang_success",
      );

      const nextLang = selectedLang === "id" ? "en" : "id";
      const nextLabel = selectedLang === "id" ? "Switch to English 🇬🇧" : "Ganti ke Bahasa Indonesia 🇮🇩";
      const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
      const toggleRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`btn_lang_${nextLang}`)
          .setLabel(nextLabel)
          .setStyle(ButtonStyle.Secondary),
      );

      const payload = buildContainerV2({
        accentColorHex: ui.getColor("accent") || "#FF69B4",
        title: `${ui.getEmoji("translate") || "🌐"} Bahasa Diperbarui / Language Updated`,
        description: translatedMsg,
        buttonsRow: toggleRow,
        footerText: ui.getFooter("utility"),
      });

      await interaction.editReply(payload);
    } catch (error) {
      logger.error("Error changing language:", error);
      ui.sendError(
        interaction,
        "Gagal mengubah pengaturan bahasa / Failed to change language settings.",
        true,
      );
    }
  },
};
