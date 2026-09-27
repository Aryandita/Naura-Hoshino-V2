"use strict";

const { MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const languageManager = require("../../managers/languageManager");
const { buildContainerV2 } = require("../../utils/NauraContainerBuilder");
const ui = require("../../config/ui");

module.exports = [
  {
    prefix: "btn_lang_",
    label: "language-toggle",
    onError: "Gagal memperbarui preferensi bahasa.",
    async handler(interaction) {
      const customId = interaction.customId;
      const userId = interaction.user.id;

      let targetLang = "id";
      if (customId === "btn_lang_en") {
        targetLang = "en";
      } else if (customId === "btn_lang_id") {
        targetLang = "id";
      } else if (customId === "btn_lang_toggle") {
        const currentLang = await languageManager.getUserLanguage(userId, interaction.guildId);
        targetLang = currentLang === "id" ? "en" : "id";
      }

      await languageManager.setUserLanguage(userId, targetLang);

      const isId = targetLang === "id";
      const title = isId ? "🌐 Bahasa Berhasil Diubah!" : "🌐 Language Successfully Updated!";
      const description = isId
        ? "Seluruh respons bot Naura Hoshino kini disajikan dalam **Bahasa Indonesia**."
        : "All Naura Hoshino bot responses will now be served in **English**.";

      const nextLang = isId ? "en" : "id";
      const nextLabel = isId ? "Switch to English 🇬🇧" : "Ganti ke Bahasa Indonesia 🇮🇩";

      const toggleRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`btn_lang_${nextLang}`)
          .setLabel(nextLabel)
          .setStyle(ButtonStyle.Secondary),
      );

      const payload = buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#FFB6C1",
        authorName: "Naura Localization Engine",
        title,
        description,
        buttonsRow: toggleRow,
        footerText: ui.getFooter("core"),
      });

      return interaction.reply({
        ...payload,
        flags: MessageFlags.Ephemeral,
      });
    },
  },
];
