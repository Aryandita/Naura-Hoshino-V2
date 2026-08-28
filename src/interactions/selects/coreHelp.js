"use strict";

const languageManager = require("../../managers/languageManager");
const { buildHelpPayload, HELP_CATEGORY_KEYS } = require("../../core/helpView");

module.exports = [
  {
    id: "help_category_select",
    label: "help-category-select",
    defer: "update",
    async handler(interaction) {
      const selectedValue = interaction.values[0];
      const categoryIndex = HELP_CATEGORY_KEYS.indexOf(selectedValue);
      const userLang = await languageManager.getUserLanguage(
        interaction.user.id,
      );
      const lang = languageManager.getLanguageSync(userLang);

      const payload = buildHelpPayload(
        lang,
        categoryIndex >= 0 ? categoryIndex : 0,
      );

      if (interaction.deferred || interaction.replied) {
        return interaction.editReply(payload);
      }
      return interaction.update(payload);
    },
  },
  {
    id: "help_lang_select",
    label: "help-language-select",
    defer: "update",
    async handler(interaction) {
      const selectedLang = interaction.values[0];
      await languageManager.setUserLanguage(interaction.user.id, selectedLang);
      const lang = languageManager.getLanguageSync(selectedLang);

      const payload = buildHelpPayload(lang, 0);

      if (interaction.deferred || interaction.replied) {
        return interaction.editReply(payload);
      }
      return interaction.update(payload);
    },
  },
];
